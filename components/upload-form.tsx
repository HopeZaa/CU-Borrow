"use client";
import { useHydrated } from "./use-hydrated";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  prepareUpload,
  finishUpload,
  type UploadState,
} from "@/app/upload-actions";
import {
  MAX_IMAGE_BYTES,
  imageMimeSchema,
  type UploadTarget,
} from "@/lib/uploads";
import { validImage } from "@/lib/domain";
export function UploadForm({
  id,
  target,
  label,
}: {
  id: string;
  target: UploadTarget;
  label: string;
}) {
  const hydrated = useHydrated();
  const [state, setState] = useState<UploadState>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <form
      method="post"
      inert={!hydrated}
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const element = event.currentTarget,
          file = new FormData(element).get("file");
        startTransition(async () => {
          try {
            setState({});
            if (
              !(file instanceof File) ||
              file.size === 0 ||
              file.size > MAX_IMAGE_BYTES ||
              !imageMimeSchema.safeParse(file.type).success ||
              !validImage(
                new Uint8Array(await file.slice(0, 16).arrayBuffer()),
                file.type,
              )
            )
              throw new Error("เลือกภาพ JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB");
            const request = new FormData();
            request.set("id", id);
            request.set("target", target);
            request.set("mime", file.type);
            request.set("size", String(file.size));
            const prepared = await prepareUpload(request);
            if (!prepared.upload) {
              setState(prepared);
              return;
            }
            const ticket = prepared.upload;
            const { createClient } = await import("@supabase/supabase-js");
            const storage = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
              {
                auth: {
                  persistSession: false,
                  autoRefreshToken: false,
                  detectSessionInUrl: false,
                },
              },
            );
            const { error } = await storage.storage
              .from(ticket.bucket)
              .uploadToSignedUrl(ticket.path, ticket.token, file, {
                contentType: file.type,
              });
            if (error) throw new Error(error.message);
            const complete = new FormData();
            complete.set("id", id);
            complete.set("target", target);
            complete.set("path", ticket.path);
            const result = await finishUpload(complete);
            setState(result);
            if (result.success) {
              element.reset();
              router.refresh();
            }
          } catch (error) {
            setState({
              error:
                error instanceof Error
                  ? error.message
                  : "อัปโหลดไม่สำเร็จ กรุณาลองใหม่",
            });
          }
        });
      }}
    >
      <label>
        {target === "item" ? "เลือกรูปสินค้า" : "ภาพสภาพสินค้า (ไม่เกิน 5 MB)"}
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          disabled={!hydrated || pending}
        />
      </label>
      <button className="btn" type="submit" disabled={!hydrated || pending}>
        {pending ? "กำลังอัปโหลด…" : label}
      </button>
      {state.error && (
        <p className="feedback error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="feedback success" role="status">
          {state.success}
        </p>
      )}
    </form>
  );
}
