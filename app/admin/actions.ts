"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import {
  adminTables,
  adminTableSchema,
  adminFieldValue,
  changedAdminFields,
  type AdminRow,
} from "@/lib/admin";
import type { ActionState } from "../actions";
const reasonSchema = z
  .string()
  .trim()
  .min(5, "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร")
  .max(2000);
function failure(error: unknown): ActionState {
  return {
    error:
      error instanceof z.ZodError
        ? error.issues.map((i) => i.message).join(" · ")
        : error instanceof Error
          ? error.message
          : "บันทึกไม่สำเร็จ",
  };
}
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function adminDataAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  try {
    const db = await supabase(),
      operation = z
        .enum(["patch", "remove", "create", "role"])
        .parse(form.get("operation")),
      reason = reasonSchema.parse(form.get("reason"));
    if (operation === "role") {
      const id = z.string().uuid().parse(form.get("id")),
        value = z.enum(["true", "false"]).parse(form.get("value"));
      check(
        (
          await db.rpc("cu_admin_set_role", {
            p_user: id,
            p_admin: value === "true",
            p_reason: reason,
          })
        ).error,
      );
    } else {
      const table = adminTableSchema.parse(form.get("table"));
      if (operation === "create") {
        const definition = adminTables[table];
        if (!definition.create)
          throw new Error("สร้างข้อมูลประเภทนี้จาก flow หลักของระบบ");
        const data: AdminRow = {};
        for (const field of definition.fields)
          if (Object.hasOwn(definition.create, field.key))
            data[field.key] = adminFieldValue(field, form.get(field.key));
        check(
          (
            await db.rpc("cu_admin_create", {
              p_table: table,
              p_data: data,
              p_reason: reason,
            })
          ).error,
        );
      } else {
        const id = z.string().uuid().parse(form.get("id"));
        if (operation === "remove") {
          check(
            (
              await db.rpc("cu_admin_remove", {
                p_table: table,
                p_id: id,
                p_reason: reason,
              })
            ).error,
          );
        } else {
          const raw = z.string().max(30000).parse(form.get("original")),
            original = z.record(z.string(), z.unknown()).parse(JSON.parse(raw));
          const { patch, expected } = changedAdminFields(table, form, original);
          if (!Object.keys(patch).length)
            return { success: "ไม่มีข้อมูลที่เปลี่ยนแปลง" };
          check(
            (
              await db.rpc("cu_admin_patch", {
                p_table: table,
                p_id: id,
                p_patch: patch,
                p_reason: reason,
                p_expected: expected,
              })
            ).error,
          );
        }
      }
    }
    revalidatePath("/", "layout");
    return { success: "บันทึกข้อมูลและประวัติการแก้ไขแล้ว" };
  } catch (error) {
    return failure(error);
  }
}
