// Real Supabase Auth + PostgREST + Storage test. Use dedicated seeded test accounts.
import { createClient } from "@supabase/supabase-js";
import { loadEnv, required } from "./env.mjs";
loadEnv();
if (process.env.ALLOW_DEV_INTEGRATION !== "true")
  throw Error(
    "Set ALLOW_DEV_INTEGRATION=true for a dedicated test project. This test creates archived fixtures.",
  );
const url = required("NEXT_PUBLIC_SUPABASE_URL"),
  key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const make = () =>
    createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  owner = make(),
  renter = make();
const assert = (v, msg) => {
  if (!v) throw Error(msg);
  console.log("PASS:", msg);
};
const unwrap = (r) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
const ownerAuth = unwrap(
  await owner.auth.signInWithPassword({
    email: required("TEST_OWNER_EMAIL"),
    password: process.env.TEST_OWNER_PASSWORD || required("TEST_PASSWORD"),
  }),
);
const renterAuth = unwrap(
  await renter.auth.signInWithPassword({
    email: required("TEST_RENTER_EMAIL"),
    password: process.env.TEST_RENTER_PASSWORD || required("TEST_PASSWORD"),
  }),
);
assert(
  ownerAuth.user.id !== renterAuth.user.id,
  "two distinct confirmed users can sign in",
);
assert(
  !!unwrap(
    await owner
      .from("profiles")
      .select("id")
      .eq("id", ownerAuth.user.id)
      .single(),
  ),
  "signup profile trigger connected",
);
const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
  }).format(new Date()),
  until = `${Number(date.slice(0, 4)) + 1}-12-31`;
let item, booking;
try {
  item = unwrap(
    await owner.rpc("cu_save_item", {
      p_id: null,
      p_title: "[INTEGRATION] camera",
      p_description:
        "Dedicated disposable integration test listing for CU-Borrow",
      p_category: "camera",
      p_condition: "good",
      p_price: 100,
      p_deposit: 500,
      p_location: "Test campus library",
      p_from: date,
      p_until: until,
    }),
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0o0AAAAASUVORK5CYII=",
    "base64",
  );
  const path = `${ownerAuth.user.id}/${item}/test.png`;
  unwrap(
    await owner.storage
      .from("item-images")
      .upload(path, png, { contentType: "image/png" }),
  );
  unwrap(await owner.rpc("cu_image", { p_item: item, p_path: path }));
  assert(true, "actual Storage upload and listing metadata");
  booking = unwrap(
    await renter.rpc("cu_book", { p_item: item, p_start: date, p_end: date }),
  );
  assert(!!booking, "actual authenticated booking");
  const duplicate = await renter.rpc("cu_book", {
    p_item: item,
    p_start: date,
    p_end: date,
  });
  assert(!!duplicate.error, "actual server overlap rejection");
  const hacked = await renter
    .from("bookings")
    .update({ status: "paid", daily_price: 1 })
    .eq("id", booking);
  assert(!!hacked.error, "actual PostgREST denies price/status tampering");
  unwrap(
    await owner.rpc("cu_transition", {
      p_booking: booking,
      p_action: "confirm",
    }),
  );
  assert(true, "actual owner confirmation");
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    unwrap(
      await service.rpc("cu_simulate_payment", {
        p_booking: booking,
        p_actor: renterAuth.user.id,
      }),
    );
    const payment = unwrap(
      await renter
        .from("payments")
        .select("*")
        .eq("booking_id", booking)
        .single(),
    );
    assert(
      payment.simulated &&
        payment.provider === "development" &&
        Number(payment.amount) === 600,
      "actual service payment remains explicitly simulated",
    );
    for (const kind of ["pickup", "return"]) {
      for (const [client, user] of [
        [owner, ownerAuth.user],
        [renter, renterAuth.user],
      ]) {
        const evidence = `${user.id}/${booking}/${kind}/${crypto.randomUUID()}.png`;
        unwrap(
          await client.storage
            .from("handover-evidence")
            .upload(evidence, png, { contentType: "image/png" }),
        );
        const denied = await make()
          .storage.from("handover-evidence")
          .createSignedUrl(evidence, 60);
        assert(
          !!denied.error,
          "anonymous users cannot access private evidence",
        );
        unwrap(
          await client.rpc("cu_handover", {
            p_booking: booking,
            p_kind: kind,
            p_evidence: evidence,
          }),
        );
      }
      const current = unwrap(
        await renter
          .from("bookings")
          .select("status")
          .eq("id", booking)
          .single(),
      );
      assert(
        current.status === (kind === "pickup" ? "picked_up" : "returned"),
        "actual dual " + kind + " confirmation",
      );
    }
    unwrap(
      await renter.rpc("cu_transition", {
        p_booking: booking,
        p_action: "complete",
      }),
    );
    unwrap(
      await renter.rpc("cu_review", {
        p_booking: booking,
        p_rating: 5,
        p_comment: "[INTEGRATION TEST] completed simulated rental",
      }),
    );
    const duplicateReview = await renter.rpc("cu_review", {
      p_booking: booking,
      p_rating: 5,
      p_comment: "Duplicate test",
    });
    assert(!!duplicateReview.error, "actual duplicate review denied");
    booking = null;
    const cancellable = unwrap(
      await renter.rpc("cu_book", { p_item: item, p_start: date, p_end: date }),
    );
    unwrap(
      await renter.rpc("cu_transition", {
        p_booking: cancellable,
        p_action: "cancel",
      }),
    );
    assert(true, "actual cancellation releases dates");
  } else {
    unwrap(
      await renter.rpc("cu_transition", {
        p_booking: booking,
        p_action: "cancel",
      }),
    );
    booking = null;
    assert(true, "actual renter cancellation");
    console.log(
      "SKIP: service-only simulation and dual handover require SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  unwrap(
    await owner.rpc("cu_image", { p_item: item, p_path: path, p_remove: true }),
  );
  unwrap(await owner.storage.from("item-images").remove([path]));
} finally {
  if (booking)
    await renter.rpc("cu_transition", {
      p_booking: booking,
      p_action: "cancel",
    });
  if (item) await owner.rpc("cu_archive_item", { p_id: item });
  await owner.auth.signOut();
  await renter.auth.signOut();
}
console.log(
  "Integration passed. Test listings are archived; private evidence and booking history remain for audit.",
);
