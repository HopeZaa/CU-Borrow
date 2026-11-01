import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { loadEnv, required } from "./env.mjs";
loadEnv();
if (
  process.env.ALLOW_DEV_SEED !== "true" ||
  process.env.NODE_ENV === "production"
)
  throw Error("Seed is development-only. Set ALLOW_DEV_SEED=true explicitly.");
const db = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const accounts = [
  ["owner", "เจ้าของตัวอย่าง"],
  ["renter", "ผู้เช่าตัวอย่าง"],
  ["admin", "ผู้ดูแลตัวอย่าง"],
];
const users = {};
let credentials = "CU-Borrow DEVELOPMENT fixtures. Never use in production.\n";
for (const [role, name] of accounts) {
  const email = `${role}.cu-borrow@example.com`,
    password = randomBytes(20).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error)
    throw Error(
      `${role}: ${error.message}. Seed is intentionally one-time; do not overwrite existing users.`,
    );
  users[role] = data.user;
  credentials += `${role}: ${email} / ${password}\n`;
}
// Save generated test credentials only to an ignored local file with restrictive permissions.
writeFileSync(".env.seed-credentials", credentials, { mode: 0o600 });
const { error: roleError } = await db
  .from("user_roles")
  .insert({ user_id: users.admin.id, role: "admin" });
if (roleError) throw roleError;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
}).format(new Date());
const products = [
  [
    "เครื่องคิดเลข Casio fx-991EX",
    "เครื่องคิดเลขสำหรับเตรียมสอบ ใช้งานปกติ มีฝาปิดและคู่มือภาษาอังกฤษ",
    "study",
    35,
    300,
  ],
  [
    "กล้อง Fujifilm X-T30 พร้อมเลนส์",
    "กล้องสภาพดี พร้อมเลนส์และสายคล้อง แบตเตอรี่ 2 ก้อน กรุณาตรวจอุปกรณ์ตอนรับ",
    "camera",
    350,
    3000,
  ],
  [
    "บอร์ด Arduino พร้อมชุดเซนเซอร์",
    "ชุดสำหรับทำโปรเจกต์ มีสาย jumper และ breadboard ครบ ตรวจนับก่อนรับคืน",
    "project",
    60,
    500,
  ],
  [
    "หนังสือ Calculus Early Transcendentals",
    "หนังสือเรียนแคลคูลัส มีรอยขีดเขียนบางหน้า เนื้อหาครบทุกบท ใช้อ่านทบทวนได้",
    "study",
    20,
    250,
  ],
];
for (const [title, description, category, daily_price, deposit] of products) {
  const { error } = await db
    .from("items")
    .insert({
      owner_id: users.owner.id,
      title: `[DEV] ${title}`,
      description,
      category,
      condition: "good",
      daily_price,
      deposit,
      pickup_location: "หน้าหอสมุดกลาง จุฬาฯ",
      available_from: today,
      available_until: `${Number(today.slice(0, 4)) + 1}-12-31`,
    });
  if (error) throw error;
}
console.log(
  "Development users and listings created. Generated passwords are in ignored .env.seed-credentials. No email was sent.",
);
