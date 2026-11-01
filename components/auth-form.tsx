"use client";
import { useHydrated } from "./use-hydrated";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authAction, type ActionState } from "@/app/actions";
export function AuthForm({
  mode,
  next = "",
}: {
  mode: "login" | "signup" | "forgot" | "password";
  next?: string;
}) {
  const hydrated = useHydrated();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState>({});
  const router = useRouter();
  const schema = z.object({
    email:
      mode === "password"
        ? z.string().optional()
        : z.string().email("กรุณาระบุอีเมลให้ถูกต้อง"),
    password:
      mode === "forgot"
        ? z.string().optional()
        : z
            .string()
            .min(mode === "login" ? 1 : 10, "รหัสผ่านอย่างน้อย 10 ตัวอักษร")
            .max(128),
    display_name:
      mode === "signup"
        ? z.string().trim().min(2, "ชื่ออย่างน้อย 2 ตัวอักษร").max(80)
        : z.string().optional(),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  return (
    <form
      method="post"
      inert={!hydrated}
      className="stack"
      onSubmit={handleSubmit((data) => {
        startTransition(async () => {
          const form = new FormData();
          form.set("action", mode);
          form.set("next", next);
          Object.entries(data).forEach(([k, v]) => form.set(k, String(v)));
          const res = await authAction({}, form);
          setResult(res);
          if (res.redirectTo) {
            router.push(res.redirectTo);
            router.refresh();
          }
        });
      })}
    >
      {mode === "signup" && (
        <label>
          ชื่อที่แสดง
          <input
            {...register("display_name")}
            autoComplete="name"
            placeholder="เพื่อน ๆ เรียกคุณว่าอะไร"
          />
          {errors.display_name && (
            <small className="field-error">
              {String(errors.display_name.message)}
            </small>
          )}
        </label>
      )}
      {mode !== "password" && (
        <label>
          อีเมล
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
          />
          {errors.email && (
            <small className="field-error">
              {String(errors.email.message)}
            </small>
          )}
        </label>
      )}
      {mode !== "forgot" && (
        <label>
          รหัสผ่าน
          <input
            {...register("password")}
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            placeholder={
              mode === "login" ? "รหัสผ่านของคุณ" : "อย่างน้อย 10 ตัวอักษร"
            }
          />
          {errors.password && (
            <small className="field-error">
              {String(errors.password.message)}
            </small>
          )}
        </label>
      )}
      {mode === "login" && (
        <Link className="form-link" href="/forgot-password">
          ลืมรหัสผ่าน?
        </Link>
      )}
      {mode === "signup" && (
        <p className="muted small-text">
          การยืนยันอีเมลยืนยันสิทธิ์เข้าถึงอีเมลเท่านั้น
          สถานะนิสิตยังไม่ได้รับการตรวจสอบ
        </p>
      )}
      <button
        className="btn"
        disabled={!hydrated || isSubmitting || isPending}
        type="submit"
      >
        {isSubmitting || isPending
          ? "กำลังดำเนินการ…"
          : {
              login: "เข้าสู่ระบบ",
              signup: "สร้างบัญชี",
              forgot: "ส่งลิงก์เปลี่ยนรหัสผ่าน",
              password: "บันทึกรหัสผ่านใหม่",
            }[mode]}
      </button>
      {result.error && (
        <p className="feedback error" role="alert">
          {result.error}
        </p>
      )}
      {result.success && (
        <p className="feedback success" role="status">
          {result.success}
        </p>
      )}
    </form>
  );
}
