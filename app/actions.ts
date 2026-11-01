"use server";
import { z } from "zod";
import { siteUrl } from "@/lib/site";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/server";
import { bookingSchema, itemSchema, safeNext, dateSchema } from "@/lib/domain";
export type ActionState = {
  error?: string;
  success?: string;
  redirectTo?: string;
};
const uuid = z.string().uuid();
function values(form: FormData) {
  return Object.fromEntries(form.entries());
}
function issue(e: unknown): ActionState {
  if (e instanceof z.ZodError)
    return { error: e.issues.map((i) => i.message).join(" · ") };
  const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  if (msg.includes("Invalid login credentials"))
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  if (msg.includes("Email not confirmed"))
    return { error: "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ" };
  if (msg.toLowerCase().includes("rate limit"))
    return { error: "ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" };
  if (msg.includes("duplicate key"))
    return { error: "รายการนี้ถูกบันทึกแล้ว กรุณารีเฟรชหน้าจอ" };
  if (msg.includes("violates check constraint"))
    return { error: "รายละเอียดไม่ตรงกับเงื่อนไข กรุณาตรวจสอบข้อมูลอีกครั้ง" };
  return {
    error: msg.includes("fetch failed")
      ? "เชื่อมต่อ Supabase ไม่สำเร็จ กรุณาลองใหม่"
      : msg,
  };
}
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function authAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const db = await supabase(),
      action = z
        .enum(["login", "signup", "forgot", "password", "logout"])
        .parse(form.get("action"));
    const site = siteUrl();
    if (action === "logout") {
      check((await db.auth.signOut()).error);
      revalidatePath("/", "layout");
      return { redirectTo: "/" };
    }
    if (action === "password") {
      const password = z
        .string()
        .min(10, "รหัสผ่านอย่างน้อย 10 ตัวอักษร")
        .max(128)
        .parse(form.get("password"));
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error("ลิงก์หมดอายุ กรุณาขอลิงก์ใหม่");
      check((await db.auth.updateUser({ password })).error);
      return { success: "เปลี่ยนรหัสผ่านแล้ว", redirectTo: "/profile" };
    }
    const email = z
      .string()
      .email("รูปแบบอีเมลไม่ถูกต้อง")
      .max(254)
      .parse(form.get("email"));
    if (action === "forgot") {
      check(
        (
          await db.auth.resetPasswordForEmail(email, {
            redirectTo: `${site}/auth/callback?next=/reset-password`,
          })
        ).error,
      );
      return {
        success: "หากมีบัญชีนี้ ระบบจะส่งลิงก์เปลี่ยนรหัสผ่านไปยังอีเมล",
      };
    }
    const password = z
      .string()
      .min(action === "signup" ? 10 : 1, "รหัสผ่านอย่างน้อย 10 ตัวอักษร")
      .max(128)
      .parse(form.get("password"));
    if (action === "signup") {
      const name = z
        .string()
        .trim()
        .min(2)
        .max(80)
        .parse(form.get("display_name"));
      check(
        (
          await db.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: name },
              emailRedirectTo: `${site}/auth/callback`,
            },
          })
        ).error,
      );
      return {
        success:
          "สมัครสมาชิกแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ",
      };
    }
    check((await db.auth.signInWithPassword({ email, password })).error);
    revalidatePath("/", "layout");
    return { redirectTo: safeNext(String(form.get("next") || "")) };
  } catch (e) {
    return issue(e);
  }
}
export async function itemAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const raw = values(form);
    if (!raw.id) delete raw.id;
    const v = itemSchema.parse(raw);
    const { data, error } = await (
      await supabase()
    ).rpc("cu_save_item", {
      p_id: v.id || null,
      p_title: v.title,
      p_description: v.description,
      p_category: v.category,
      p_condition: v.condition,
      p_price: v.daily_price,
      p_deposit: v.deposit,
      p_location: v.pickup_location,
      p_from: v.available_from,
      p_until: v.available_until,
    });
    check(error);
    revalidatePath("/", "layout");
    return {
      success: "บันทึกประกาศแล้ว",
      redirectTo: `/dashboard/items/${data}/edit`,
    };
  } catch (e) {
    return issue(e);
  }
}
export async function bookingAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const v = bookingSchema.parse(values(form));
    const { data, error } = await (
      await supabase()
    ).rpc("cu_book", {
      p_item: v.item_id,
      p_start: v.start_date,
      p_end: v.end_date,
    });
    check(error);
    revalidatePath("/", "layout");
    return { redirectTo: `/bookings/${data}` };
  } catch (e) {
    return issue(e);
  }
}
export async function mutationAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const db = await supabase();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    check(authError);
    if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
    const operation = z
      .enum([
        "transition",
        "simulate",
        "review",
        "dispute",
        "profile",
        "archive",
        "blackout",
        "remove_blackout",
        "admin",
        "read",
      ])
      .parse(form.get("operation"));
    const id = () => uuid.parse(form.get("id"));
    if (operation === "transition") {
      const action = z
        .enum(["confirm", "reject", "cancel", "complete"])
        .parse(form.get("value"));
      check(
        (await db.rpc("cu_transition", { p_booking: id(), p_action: action }))
          .error,
      );
    }
    if (operation === "simulate") {
      if (
        process.env.NODE_ENV !== "development" ||
        process.env.ENABLE_DEV_PAYMENTS !== "true" ||
        !process.env.SUPABASE_SERVICE_ROLE_KEY
      )
        throw new Error(
          "การชำระจำลองเปิดได้เฉพาะ Development ที่ตั้งค่าไว้เท่านั้น",
        );
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      check(
        (
          await admin.rpc("cu_simulate_payment", {
            p_booking: id(),
            p_actor: user.id,
          })
        ).error,
      );
    }
    if (operation === "review") {
      const v = z
        .object({
          rating: z.coerce.number().int().min(1).max(5),
          comment: z.string().trim().min(3).max(1000),
        })
        .parse(values(form));
      check(
        (
          await db.rpc("cu_review", {
            p_booking: id(),
            p_rating: v.rating,
            p_comment: v.comment,
          })
        ).error,
      );
    }
    if (operation === "dispute") {
      const reason = z
        .string()
        .trim()
        .min(10, "กรุณาระบุอย่างน้อย 10 ตัวอักษร")
        .max(2000)
        .parse(form.get("reason"));
      check(
        (await db.rpc("cu_dispute", { p_booking: id(), p_reason: reason }))
          .error,
      );
    }
    if (operation === "profile") {
      const v = z
        .object({
          display_name: z.string().trim().min(2).max(80),
          faculty: z.string().trim().max(100),
          bio: z.string().trim().max(500),
        })
        .parse(values(form));
      const { error, data } = await db
        .from("profiles")
        .update(v)
        .eq("id", user.id)
        .select("id");
      check(error);
      if (!data?.length) throw new Error("บัญชีนี้ไม่สามารถแก้ไขข้อมูลได้");
    }
    if (operation === "archive") {
      check((await db.rpc("cu_archive_item", { p_id: id() })).error);
      revalidatePath("/", "layout");
      return { redirectTo: "/dashboard" };
    }
    if (operation === "blackout" || operation === "remove_blackout") {
      const v = z
        .object({ start_date: dateSchema, end_date: dateSchema })
        .parse(values(form));
      if (v.end_date < v.start_date)
        throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
      check(
        (
          await db.rpc("cu_blackout", {
            p_item: id(),
            p_start: v.start_date,
            p_end: v.end_date,
            p_remove:
              operation === "remove_blackout"
                ? uuid.parse(form.get("blackout_id"))
                : null,
          })
        ).error,
      );
    }
    if (operation === "admin") {
      const v = z
        .object({
          admin_action: z.enum([
            "suspend_user",
            "moderate_item",
            "resolve_dispute",
          ]),
          detail: z.string().trim().min(5).max(2000),
          value: z.string().max(20),
        })
        .parse(values(form));
      check(
        (
          await db.rpc("cu_admin", {
            p_action: v.admin_action,
            p_target: id(),
            p_detail: v.detail,
            p_value: v.value,
          })
        ).error,
      );
    }
    if (operation === "read") {
      check(
        (
          await db
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", user.id)
        ).error,
      );
    }
    revalidatePath("/", "layout");
    return {
      success:
        operation === "simulate"
          ? "บันทึกการชำระจำลองแล้ว ไม่มีการชำระเงินจริง"
          : "บันทึกเรียบร้อยแล้ว",
    };
  } catch (e) {
    return issue(e);
  }
}
// Listing image removal is metadata-only; binary uploads use upload-actions.ts.
export async function uploadAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const db = await supabase();
    const {
      data: { user },
      error,
    } = await db.auth.getUser();
    check(error);
    if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
    z.literal("remove_image").parse(form.get("target"));
    const id = uuid.parse(form.get("id"));
    const path = z
      .string()
      .startsWith(`${user.id}/${id}/`)
      .parse(form.get("path"));
    check(
      (await db.rpc("cu_image", { p_item: id, p_path: path, p_remove: true }))
        .error,
    );
    check((await db.storage.from("item-images").remove([path])).error);
    revalidatePath("/", "layout");
    return { success: "ลบภาพแล้ว" };
  } catch (error) {
    return issue(error);
  }
}
