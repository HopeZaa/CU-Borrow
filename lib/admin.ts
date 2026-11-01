import { z } from "zod";
export type AdminField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "boolean" | "date" | "datetime";
  options?: string[];
  nullable?: boolean;
};
const f = (
  key: string,
  label: string,
  type: AdminField["type"] = "text",
  options?: string[],
  nullable = false,
): AdminField => ({ key, label, type, options, nullable });
const dateFields = [
  f("start_date", "วันเริ่ม", "date"),
  f("end_date", "วันสิ้นสุด", "date"),
];
const itemFields = [
  f("owner_id", "UUID เจ้าของ"),
  f("title", "ชื่อสินค้า"),
  f("description", "รายละเอียด", "textarea"),
  f("category", "หมวดหมู่", "text", [
    "electronics",
    "camera",
    "study",
    "project",
    "lifestyle",
    "other",
  ]),
  f("condition", "สภาพ", "text", ["like_new", "good", "fair"]),
  f("daily_price", "ค่าเช่าต่อวัน", "number"),
  f("deposit", "เงินประกัน", "number"),
  f("pickup_location", "จุดรับ–คืน"),
  f("available_from", "เปิดให้เช่าตั้งแต่", "date"),
  f("available_until", "เปิดให้เช่าถึง", "date"),
  f("status", "สถานะประกาศ", "text", ["active", "suspended", "archived"]),
];
export const adminTables: Record<
  string,
  {
    label: string;
    fields: AdminField[];
    create?: Record<string, unknown>;
    remove?: string;
  }
> = {
  profiles: {
    label: "ผู้ใช้",
    fields: [
      f("display_name", "ชื่อที่แสดง"),
      f("faculty", "คณะ"),
      f("bio", "แนะนำตัว", "textarea"),
      f("verification_status", "ยืนยันสถานะนิสิต", "text", [
        "unverified",
        "pending",
        "verified",
      ]),
      f("suspended", "ระงับบัญชี", "boolean"),
    ],
    remove: "ระงับบัญชี",
  },
  items: {
    label: "สินค้า",
    fields: itemFields,
    create: {
      owner_id: "",
      title: "",
      description: "",
      category: "other",
      condition: "good",
      daily_price: 1,
      deposit: 0,
      pickup_location: "",
      available_from: "",
      available_until: "",
      status: "active",
    },
    remove: "เก็บประกาศ",
  },
  bookings: {
    label: "การจอง",
    fields: [
      f("item_id", "UUID สินค้า"),
      f("owner_id", "UUID เจ้าของ"),
      f("renter_id", "UUID ผู้เช่า"),
      ...dateFields,
      f("daily_price", "ค่าเช่าต่อวัน", "number"),
      f("deposit", "เงินประกัน", "number"),
      f("platform_fee", "ค่าธรรมเนียม", "number"),
      f("status", "สถานะการเช่า", "text", [
        "pending",
        "confirmed",
        "paid",
        "picked_up",
        "returned",
        "completed",
        "cancelled",
        "disputed",
      ]),
    ],
    remove: "ยกเลิกรายการ",
  },
  payments: {
    label: "การชำระ",
    fields: [
      f("amount", "ยอดรวมจำลอง", "number"),
      f("deposit_amount", "เงินประกันจำลอง", "number"),
      f("status", "สถานะเงินจำลอง", "text", [
        "simulated",
        "held",
        "released",
        "refunded",
      ]),
    ],
  },
  handovers: {
    label: "รับ–คืน",
    fields: [
      f("evidence_path", "เส้นทางภาพหลักฐาน"),
      f("confirmed_at", "เวลายืนยัน (ISO พร้อมเขตเวลา)", "datetime"),
    ],
  },
  reviews: {
    label: "รีวิว",
    fields: [
      f("rating", "คะแนน 1–5", "number"),
      f("comment", "ข้อความรีวิว", "textarea"),
    ],
    remove: "ลบรีวิว",
  },
  disputes: {
    label: "ข้อพิพาท",
    fields: [
      f("reason", "รายละเอียดปัญหา", "textarea"),
      f("resolution", "ผลการตรวจสอบ", "textarea", undefined, true),
    ],
  },
  notifications: {
    label: "แจ้งเตือน",
    fields: [
      f("user_id", "UUID ผู้รับ"),
      f("message", "ข้อความ", "textarea"),
      f("booking_id", "UUID รายการเช่า", "text", undefined, true),
      f("read_at", "เวลาอ่าน (ISO พร้อมเขตเวลา)", "datetime", undefined, true),
    ],
    create: { user_id: "", message: "", booking_id: null, read_at: null },
    remove: "ลบการแจ้งเตือน",
  },
  item_availability: {
    label: "วันไม่ว่าง",
    fields: [f("item_id", "UUID สินค้า"), ...dateFields],
    create: { item_id: "", start_date: "", end_date: "" },
    remove: "เปิดให้เช่าในช่วงนี้",
  },
  item_images: {
    label: "รูปสินค้า",
    fields: [
      f("item_id", "UUID สินค้า"),
      f("storage_path", "เส้นทางไฟล์ใน Storage"),
    ],
    remove: "นำภาพออกจากประกาศ",
  },
  user_roles: { label: "สิทธิ์ Admin", fields: [] },
  admin_audit_logs: { label: "ประวัติ Admin", fields: [] },
};
export const adminTableSchema = z
  .string()
  .refine((value) => Object.hasOwn(adminTables, value), "ไม่พบหมวดข้อมูล");
export type AdminRow = Record<string, unknown>;
export type AdminPage = {
  rows: AdminRow[];
  total: number;
  page: number;
  size: number;
};
export function adminFieldValue(
  field: AdminField,
  raw: FormDataEntryValue | null,
) {
  if (typeof raw !== "string") throw new Error(`กรุณาระบุ ${field.label}`);
  if (field.nullable && raw === "") return null;
  if (field.type === "boolean") {
    if (raw !== "true" && raw !== "false")
      throw new Error("ค่าบูลีนไม่ถูกต้อง");
    return raw === "true";
  }
  if (field.type === "number") {
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value) || Math.abs(value) > 1e12)
      throw new Error(`ตัวเลขไม่ถูกต้อง: ${field.label}`);
    return value;
  }
  if (field.type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw)))
      throw new Error(`วันที่ไม่ถูกต้อง: ${field.label}`);
    return raw;
  }
  if (field.type === "datetime") {
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(raw))
      throw new Error(`ระบุเขตเวลา เช่น Z หรือ +07:00: ${field.label}`);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.valueOf()))
      throw new Error(`เวลาไม่ถูกต้อง: ${field.label}`);
    return parsed.toISOString();
  }
  if (field.options && !field.options.includes(raw))
    throw new Error(`ค่าที่เลือกไม่ถูกต้อง: ${field.label}`);
  if (raw.length > 4000) throw new Error(`ข้อมูลยาวเกินไป: ${field.label}`);
  return raw;
}
export function changedAdminFields(
  table: string,
  form: FormData,
  original: AdminRow,
) {
  const definition = adminTables[adminTableSchema.parse(table)],
    patch: AdminRow = {},
    expected: AdminRow = {};
  for (const field of definition.fields) {
    const value = adminFieldValue(field, form.get(field.key));
    const before = original[field.key];
    const same =
      field.type === "number"
        ? Number(before) === value
        : field.type === "datetime" && before && value
          ? new Date(String(before)).getTime() ===
            new Date(String(value)).getTime()
          : before === value;
    if (!same) {
      patch[field.key] = value;
      expected[field.key] = before ?? null;
    }
  }
  return { patch, expected };
}
