import { createClient } from "@supabase/supabase-js";
import { loadEnv, required } from "./env.mjs";
loadEnv();
const db = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  { auth: { persistSession: false } },
);
const catalog = await db.rpc("cu_search");
if (catalog.error) throw Error(catalog.error.message);
console.log(
  "PASS: live Supabase catalog RPC returns rows:",
  catalog.data.length,
);
for (const table of ["items", "profiles", "reviews", "owner_stats"]) {
  const { error } = await db.from(table).select("*").limit(1);
  if (error) throw Error(`${table}: ${error.message}`);
  console.log("PASS: public read", table);
}
for (const table of [
  "bookings",
  "payments",
  "handovers",
  "disputes",
  "notifications",
  "admin_audit_logs",
]) {
  const { data, error } = await db.from(table).select("*").limit(1);
  if (!error && data?.length) throw Error(`Private table leaked: ${table}`);
  console.log("PASS: anonymous private read denied/empty", table);
}
const { error: bookError } = await db.rpc("cu_book", {
  p_item: crypto.randomUUID(),
  p_start: "2030-01-01",
  p_end: "2030-01-02",
});
if (!bookError) throw Error("Anonymous booking unexpectedly accepted");
console.log("PASS: anonymous booking denied");
const { error: payError } = await db.rpc("cu_simulate_payment", {
  p_booking: crypto.randomUUID(),
  p_actor: crypto.randomUUID(),
});
if (!payError) throw Error("Anonymous payment unexpectedly accepted");
console.log("PASS: anonymous payment simulation denied");
const settings = await fetch(
  `${required("NEXT_PUBLIC_SUPABASE_URL")}/auth/v1/settings`,
  {
    headers: {
      apikey:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
);
if (!settings.ok) throw Error("Auth endpoint unavailable");
const body = await settings.json();
console.log(
  "PASS: Supabase Auth endpoint available; email provider:",
  body.external?.email,
  "autoconfirm:",
  body.mailer_autoconfirm,
);
