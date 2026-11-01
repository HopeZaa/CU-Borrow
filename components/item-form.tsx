"use client";
import { useHydrated } from "./use-hydrated";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  categories,
  conditions,
  itemSchema,
  today,
  type ItemInput,
  type Item,
} from "@/lib/domain";
import { itemAction, type ActionState } from "@/app/actions";
export function ItemForm({ item }: { item?: Item }) {
  const hydrated = useHydrated();
  const [isPending, startTransition] = useTransition();
  const router = useRouter(),
    [result, setResult] = useState<ActionState>({});
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: item || {
      category: "electronics",
      condition: "good",
      deposit: 0,
      available_from: today(),
      available_until: `${Number(today().slice(0, 4)) + 1}-12-31`,
    },
  });
  return (
    <form
      method="post"
      inert={!hydrated}
      className="stack item-form"
      onSubmit={handleSubmit((data) => {
        startTransition(async () => {
          const fd = new FormData();
          Object.entries(data).forEach(([k, v]) => fd.set(k, String(v)));
          const res = await itemAction({}, fd);
          setResult(res);
          if (res.redirectTo) {
            router.push(res.redirectTo);
            router.refresh();
          }
        });
      })}
    >
      {item && <input type="hidden" {...register("id")} />}
      <label>
        ชื่อสินค้า
        <input
          {...register("title")}
          placeholder="เช่น กล้อง Fujifilm X-T30 พร้อมเลนส์"
        />
      </label>
      <div className="form-row">
        <label>
          หมวดหมู่
          <select {...register("category")}>
            {Object.entries(categories).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          สภาพสินค้า
          <select {...register("condition")}>
            {Object.entries(conditions).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        รายละเอียดและตำหนิ
        <textarea
          {...register("description")}
          rows={5}
          placeholder="บอกสิ่งที่รวมอยู่ วิธีใช้ และร่องรอยการใช้งานอย่างตรงไปตรงมา (อย่างน้อย 20 ตัวอักษร)"
        />
      </label>
      <div className="form-row">
        <label>
          ค่าเช่าต่อวัน (บาท)
          <input
            {...register("daily_price")}
            type="number"
            min="1"
            max="100000"
            step="0.01"
          />
        </label>
        <label>
          เงินประกัน (บาท)
          <input
            {...register("deposit")}
            type="number"
            min="0"
            max="1000000"
            step="0.01"
          />
        </label>
      </div>
      <label>
        จุดรับ–คืน
        <input
          {...register("pickup_location")}
          placeholder="เช่น หน้าหอสมุดกลาง จุฬาฯ"
        />
      </label>
      <div className="form-row">
        <label>
          เปิดให้เช่าตั้งแต่
          <input {...register("available_from")} type="date" />
        </label>
        <label>
          ถึงวันที่
          <input {...register("available_until")} type="date" />
        </label>
      </div>
      {Object.entries(errors).map(([k, e]) => (
        <p key={k} className="field-error">
          {String(e?.message)}
        </p>
      ))}
      <p className="muted small-text">
        หลังบันทึก คุณสามารถเพิ่มรูปได้สูงสุด 6 รูปและกำหนดวันไม่ว่าง
        รายการจองเดิมจะใช้ราคาที่ตกลง ณ เวลาจอง
      </p>
      <button
        className="btn"
        disabled={!hydrated || isSubmitting || isPending}
        type="submit"
      >
        {isSubmitting || isPending
          ? "กำลังบันทึก…"
          : item
            ? "บันทึกการแก้ไข"
            : "สร้างประกาศและเพิ่มรูปภาพ"}
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
