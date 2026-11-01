// Reads credentials from a hidden terminal prompt. Never pass passwords in argv.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { loadEnv, required } from "./env.mjs";
loadEnv();
const key = required("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let input;
if (process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = (await rl.question("Admin email: ")).trim();
  rl.close();
  const silent = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const secret = createInterface({
    input: process.stdin,
    output: silent,
    terminal: true,
  });
  process.stdout.write("Admin password (hidden): ");
  const password = await secret.question("");
  secret.close();
  process.stdout.write("\n");
  input = { email, password };
} else input = JSON.parse(readFileSync(0, "utf8"));
if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
  typeof input.password !== "string" ||
  input.password.length < 8
)
  throw Error("Valid email and password of at least 8 characters required");
let user = null;
for (let page = 1; page <= 10000; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw Error(error.message);
  user = data.users.find(
    (u) => u.email?.toLowerCase() === input.email.toLowerCase(),
  );
  if (user || data.users.length < 100) break;
}
const result = user
  ? await db.auth.admin.updateUserById(user.id, {
      password: input.password,
      email_confirm: true,
    })
  : await db.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { display_name: "CU-Borrow Admin" },
    });
if (result.error) throw Error(result.error.message);
user = result.data.user;
const assert = (error) => {
  if (error) throw Error(error.message);
};
assert(
  (await db.from("profiles").update({ suspended: false }).eq("id", user.id))
    .error,
);
assert(
  (
    await db
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id" })
  ).error,
);
assert(
  (
    await db.from("admin_audit_logs").insert({
      admin_id: user.id,
      action: "bootstrap_admin",
      target_id: user.id,
      detail:
        "Account provisioned by authorized local administrator; credentials omitted",
    })
  ).error,
);
const browser = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const signed = await browser.auth.signInWithPassword({
  email: input.email,
  password: input.password,
});
input.password = "";
assert(signed.error);
const verified = await browser.rpc("cu_admin_me");
assert(verified.error);
if (verified.data !== true) throw Error("Admin role verification failed");
await browser.auth.signOut({scope:"local"});
console.log(
  JSON.stringify({ email: user.email, userId: user.id, adminVerified: true }),
);
