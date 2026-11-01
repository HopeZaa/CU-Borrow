"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import { today, validImage } from "@/lib/domain";
import {
  imageBucket,
  imagePrefix,
  MAX_IMAGE_BYTES,
  ownedImagePath,
  uploadRequestSchema,
  uploadTargetSchema,
  type UploadTarget,
  type UploadTicket,
} from "@/lib/uploads";
import type { ActionState } from "./actions";
export type UploadState = ActionState & { upload?: UploadTicket };
function failure(error: unknown): UploadState {
  if (error instanceof z.ZodError)
    return { error: "กรุณาเลือกภาพ JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB" };
  return {
    error:
      error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ กรุณาลองใหม่",
  };
}
function checked(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
async function authorize(id: string, target: UploadTarget) {
  const db = await supabase();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  checked(error);
  if (!user?.email_confirmed_at)
    throw new Error("กรุณายืนยันอีเมลและเข้าสู่ระบบ");
  const profile = await db
    .from("profiles")
    .select("suspended")
    .eq("id", user.id)
    .single();
  checked(profile.error);
  if (!profile.data || profile.data.suspended)
    throw new Error("บัญชีนี้ถูกระงับการทำรายการ");
  if (target === "item") {
    const item = await db
      .from("items")
      .select("id")
      .eq("id", id)
      .eq("owner_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    checked(item.error);
    if (!item.data) throw new Error("ไม่มีสิทธิ์จัดการภาพของประกาศนี้");
    const images = await db
      .from("item_images")
      .select("id", { count: "exact", head: true })
      .eq("item_id", id);
    checked(images.error);
    if ((images.count || 0) >= 6) throw new Error("เพิ่มภาพได้สูงสุด 6 รูป");
  } else {
    const booking = await db
      .from("bookings")
      .select("owner_id,renter_id,status,start_date")
      .eq("id", id)
      .maybeSingle();
    checked(booking.error);
    const b = booking.data;
    if (
      !b ||
      ![b.owner_id, b.renter_id].includes(user.id) ||
      (target === "pickup"
        ? b.status !== "paid" || b.start_date > today()
        : b.status !== "picked_up")
    )
      throw new Error("รายการยังไม่พร้อมยืนยันรับ–คืนหรือไม่มีสิทธิ์");
  }
  return { db, user };
}
// Only metadata crosses the application server. The file goes directly to Storage.
export async function prepareUpload(form: FormData): Promise<UploadState> {
  try {
    const request = uploadRequestSchema.parse(
      Object.fromEntries(form.entries()),
    );
    const { db, user } = await authorize(request.id, request.target);
    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[request.mime];
    const path = `${imagePrefix(user.id, request.id, request.target)}${crypto.randomUUID()}.${extension}`;
    const bucket = imageBucket(request.target);
    const { data, error } = await db.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });
    checked(error);
    if (!data) throw new Error("สร้างช่องทางอัปโหลดไม่สำเร็จ");
    return { upload: { path, bucket, token: data.token } };
  } catch (error) {
    return failure(error);
  }
}
// Re-read the actual uploaded bytes; never trust browser-supplied size/MIME claims.
export async function finishUpload(form: FormData): Promise<UploadState> {
  try {
    const { id, target, path } = z
      .object({
        id: z.string().uuid(),
        target: uploadTargetSchema,
        path: z.string().max(250),
      })
      .parse(Object.fromEntries(form.entries()));
    const { db, user } = await authorize(id, target);
    if (!ownedImagePath(path, user.id, id, target))
      throw new Error("เส้นทางภาพไม่ถูกต้อง");
    const bucket = imageBucket(target);
    const { data: file, error } = await db.storage.from(bucket).download(path);
    checked(error);
    if (!file) throw new Error("ไม่พบภาพที่อัปโหลด");
    if (
      file.size === 0 ||
      file.size > MAX_IMAGE_BYTES ||
      !validImage(new Uint8Array(await file.arrayBuffer()), file.type)
    ) {
      if (target === "item") await db.storage.from(bucket).remove([path]);
      throw new Error(
        "ไฟล์ไม่ใช่ภาพ JPG, PNG หรือ WebP ที่ถูกต้อง หรือมีขนาดเกิน 5 MB",
      );
    }
    const result =
      target === "item"
        ? await db.rpc("cu_image", {
            p_item: id,
            p_path: path,
            p_remove: false,
          })
        : await db.rpc("cu_handover", {
            p_booking: id,
            p_kind: target,
            p_evidence: path,
          });
    if (result.error && target === "item") {
      // A repeated finalize request must not delete an already attached image.
      const attached = await db
        .from("item_images")
        .select("id")
        .eq("item_id", id)
        .eq("storage_path", path)
        .maybeSingle();
      if (attached.data && result.error.code === "23505")
        return { success: "อัปโหลดภาพแล้ว" };
      if (!attached.error && !attached.data)
        await db.storage.from(bucket).remove([path]);
    }
    checked(result.error);
    revalidatePath("/", "layout");
    return {
      success:
        target === "item"
          ? "อัปโหลดภาพแล้ว"
          : "บันทึกหลักฐานและยืนยันแล้ว รออีกฝ่ายยืนยัน",
    };
  } catch (error) {
    return failure(error);
  }
}
