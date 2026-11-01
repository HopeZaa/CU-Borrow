import { z } from "zod";
export const categories = {
  electronics: "อิเล็กทรอนิกส์",
  camera: "กล้องและอุปกรณ์",
  study: "หนังสือและการเรียน",
  project: "อุปกรณ์โปรเจกต์",
  lifestyle: "ไลฟ์สไตล์",
  other: "อื่น ๆ",
} as const;
export const conditions = {
  like_new: "เหมือนใหม่",
  good: "สภาพดี",
  fair: "มีร่องรอยการใช้งาน",
} as const;
export const statuses: Record<string, string> = {
  pending: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  paid: "บันทึกการชำระแล้ว",
  picked_up: "รับของแล้ว",
  returned: "คืนของแล้ว",
  completed: "สำเร็จ",
  cancelled: "ยกเลิก",
  disputed: "มีข้อพิพาท",
};
export const uuidSchema = z.string().uuid();
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาระบุวันที่")
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "วันที่ไม่ถูกต้อง",
  );
export const bookingSchema = z
  .object({
    item_id: z.string().uuid(),
    start_date: dateSchema,
    end_date: dateSchema,
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "วันคืนต้องไม่ก่อนวันรับ",
    path: ["end_date"],
  })
  .refine((v) => days(v.start_date, v.end_date) <= 366, {
    message: "เช่าได้ไม่เกิน 366 วัน",
    path: ["end_date"],
  });
export const itemSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(3, "อย่างน้อย 3 ตัวอักษร").max(120),
    description: z.string().trim().min(20, "อย่างน้อย 20 ตัวอักษร").max(4000),
    category: z.enum([
      "electronics",
      "camera",
      "study",
      "project",
      "lifestyle",
      "other",
    ]),
    condition: z.enum(["like_new", "good", "fair"]),
    daily_price: z.coerce.number<number>().min(1).max(100000),
    deposit: z.coerce.number<number>().min(0).max(1000000),
    pickup_location: z.string().trim().min(3).max(200),
    available_from: dateSchema,
    available_until: dateSchema,
  })
  .refine((v) => v.available_until >= v.available_from, {
    message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
    path: ["available_until"],
  });
export type ItemInput = z.input<typeof itemSchema>;
export type Item = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: keyof typeof categories;
  condition: keyof typeof conditions;
  daily_price: number;
  deposit: number;
  pickup_location: string;
  available_from: string;
  available_until: string;
  status: string;
  created_at: string;
  item_images?: { storage_path: string }[];
  owner?: Profile;
  stats?: OwnerStats;
};
export type Profile = {
  id: string;
  display_name: string;
  faculty: string;
  bio: string;
  verification_status: string;
  suspended: boolean;
  created_at: string;
};
export type OwnerStats = {
  id: string;
  rating: number | null;
  review_count: number;
  completed_count: number;
};
export type Booking = {
  id: string;
  item_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  rental_days: number;
  daily_price: number;
  rental_total: number;
  deposit: number;
  platform_fee: number;
  status: string;
  created_at: string;
  items: Item | null;
  payments: { simulated: boolean; status: string; amount: number }[];
};
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function days(start: string, end: string) {
  return Math.floor((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
}
export function quote(
  price: number,
  deposit: number,
  start: string,
  end: string,
) {
  const count = days(start, end);
  if (!Number.isFinite(count) || count < 1 || count > 366) return null;
  return {
    days: count,
    rental: (Math.round(price * 100) * count) / 100,
    deposit,
    total: (Math.round(price * 100) * count + Math.round(deposit * 100)) / 100,
  };
}
export const money = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(Number(n));
export const dateLabel = (s: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(s.length === 10 ? s + "T00:00:00+07:00" : s));
export function safeNext(next: string | null | undefined) {
  return next?.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("\\") &&
    !/[\r\n]/.test(next)
    ? next
    : "/marketplace";
}
export function validImage(bytes: Uint8Array, mime: string) {
  return (
    (mime === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255) ||
    (mime === "image/png" &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) ||
    (mime === "image/webp" &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP")
  );
}
export function isUnavailable(
  start: string,
  end: string,
  periods: { start_date: string; end_date: string }[],
) {
  return periods.some((p) => start <= p.end_date && end >= p.start_date);
}
