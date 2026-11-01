import { spawnSync, spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
const target = process.env.TEST_DATABASE_URL;
if (!target)
  throw Error(
    "Set TEST_DATABASE_URL to a NEW disposable PostgreSQL database. Never use production.",
  );
if (process.env.ALLOW_DISPOSABLE_DB_TEST !== "true")
  throw Error(
    "Requires ALLOW_DISPOSABLE_DB_TEST=true; the database must be empty.",
  );
function run(sql) {
  const r = spawnSync("psql", [target, "-X", "-q", "-v", "ON_ERROR_STOP=1"], {
    input: "set time zone 'Asia/Bangkok';\n" + sql,
    encoding: "utf8",
  });
  if (r.status !== 0) throw Error(r.stderr);
  return r;
}
const check = run(
  "select count(*) from information_schema.tables where table_schema='public';",
);
if (!/^\s*count\s*\n-+\n\s*0\s*\n/m.test(check.stdout))
  throw Error("Refusing nonempty database");
run(readFileSync("supabase/tests/bootstrap.sql", "utf8"));
for (const migration of readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort())
  run(readFileSync(`supabase/migrations/${migration}`, "utf8"));
for (const suite of ["security.sql", "admin-security.sql"]) {
  const result = run(readFileSync(`supabase/tests/${suite}`, "utf8"));
  console.log(result.stderr);
}
// Commit isolated fixtures then race two real SQL connections against one date range.
run(
  `insert into auth.users(id,email,email_confirmed_at) values ('10000000-0000-0000-0000-000000000001','race-owner@test.invalid',now()),('10000000-0000-0000-0000-000000000002','race-a@test.invalid',now()),('10000000-0000-0000-0000-000000000003','race-b@test.invalid',now()); insert into items(id,owner_id,title,description,category,condition,daily_price,deposit,pickup_location,available_from,available_until) values('10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','Race camera','Race test camera in good working condition','camera','good',100,0,'Campus library',current_date,current_date+90);`,
);
const race = (uid) =>
  new Promise((resolve) => {
    const p = spawn("psql", [target, "-X", "-q", "-v", "ON_ERROR_STOP=1"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, err }));
    p.stdin.end(
      `begin;set local time zone 'Asia/Bangkok';set local role authenticated;select set_config('request.jwt.claim.sub','${uid}',true);select cu_book('10000000-0000-0000-0000-000000000010',current_date+30,current_date+32);select pg_sleep(0.3);commit;`,
    );
  });
const races = await Promise.all([
  race("10000000-0000-0000-0000-000000000002"),
  race("10000000-0000-0000-0000-000000000003"),
]);
if (
  races.filter((r) => r.code === 0).length !== 1 ||
  !races.some((r) => r.err.includes("ถูกจองแล้ว"))
)
  throw Error(JSON.stringify(races));
console.log("PASS: concurrent reservation race admits exactly one renter");
console.log(
  "Database security, lifecycle and concurrency tests passed. Auth/Storage services are NOT emulated by this test.",
);
