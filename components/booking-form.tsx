"use client";
import { useHydrated } from "./use-hydrated";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  bookingSchema,
  money,
  quote,
  today,
  isUnavailable,
} from "@/lib/domain";
import { bookingAction, type ActionState } from "@/app/actions";
import { ShieldCheck } from "./icon";
export function BookingForm({
  id,
  price,
  deposit,
  from,
  until,
  periods,
  loggedIn,
  isOwner,
}: {
  id: string;
  price: number;
  deposit: number;
  from: string;
  until: string;
  periods: { start_date: string; end_date: string }[];
  loggedIn: boolean;
  isOwner: boolean;
}) {
  const hydrated = useHydrated();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState>({}),
    router = useRouter();
  const {
    register,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ item_id: string; start_date: string; end_date: string }>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { item_id: id, start_date: "", end_date: "" },
  });
  const start = watch("start_date"),
    end = watch("end_date"),
    cost = quote(price, deposit, start, end),
    blocked = !!(start && end && isUnavailable(start, end, periods));
  return (
    <div className="booking-panel">
      <p className="eyebrow">MAKE IT YOURS, FOR A WHILE.</p>
      <div className="detail-price">
        {money(price)}
        <span> / วัน</span>
      </div>
      <p className="muted small-text">
        เงินประกัน {money(deposit)} · ไม่มีค่าธรรมเนียมใน MVP
      </p>
      {isOwner ? (
        <Link className="btn" href={`/dashboard/items/${id}/edit`}>
          จัดการประกาศของคุณ
        </Link>
      ) : (
        <form
          method="post"
          inert={!hydrated}
          className="stack"
          onSubmit={handleSubmit((v) => {
            startTransition(async () => {
              const fd = new FormData();
              Object.entries(v).forEach(([k, value]) => fd.set(k, value));
              const res = await bookingAction({}, fd);
              setResult(res);
              if (res.redirectTo) {
                router.push(res.redirectTo);
                router.refresh();
              }
            });
          })}
        >
          <input {...register("item_id")} type="hidden" />
          <div className="form-row">
            <label>
              วันรับ
              <input
                type="date"
                {...register("start_date")}
                min={from > today() ? from : today()}
                max={until}
              />
            </label>
            <label>
              วันคืน
              <input
                type="date"
                {...register("end_date")}
                min={start || today()}
                max={until}
              />
            </label>
          </div>
          {cost && (
            <div className="cost-lines">
              <p>
                <span>
                  {money(price)} × {cost.days} วัน
                </span>
                <b>{money(cost.rental)}</b>
              </p>
              <p>
                <span>เงินประกัน</span>
                <b>{money(deposit)}</b>
              </p>
              <p className="total">
                <span>รวม</span>
                <strong>{money(cost.total)}</strong>
              </p>
            </div>
          )}
          {blocked && (
            <p className="feedback error">
              วันที่เลือกไม่ว่าง กรุณาเลือกช่วงอื่น
            </p>
          )}
          {Object.entries(errors).map(([k, e]) => (
            <p key={k} className="field-error">
              {e?.message}
            </p>
          ))}
          {loggedIn ? (
            <button
              disabled={!hydrated || isSubmitting || isPending || blocked}
              className="btn"
              type="submit"
            >
              {isSubmitting || isPending ? "กำลังส่งคำขอ…" : "ส่งคำขอจอง"}
            </button>
          ) : (
            <Link className="btn" href={`/login?next=/items/${id}`}>
              เข้าสู่ระบบเพื่อจอง
            </Link>
          )}
          {result.error && (
            <p role="alert" className="feedback error">
              {result.error}
            </p>
          )}
          <p className="booking-fine">
            <ShieldCheck size={15} />
            ยังไม่มีการเรียกเก็บเงินในขั้นตอนนี้
          </p>
          <p className="small-text muted">
            คิดค่าเช่ารวมวันรับและวันคืน รอเจ้าของยืนยันก่อนเริ่มขั้นตอนชำระเงิน
          </p>
        </form>
      )}
    </div>
  );
}
export function AvailabilityCalendar({
  periods,
  from,
  until,
}: {
  periods: { start_date: string; end_date: string }[];
  from: string;
  until: string;
}) {
  const [month, setMonth] = useState(() => new Date(today() + "T00:00:00Z"));
  const first = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1),
    ),
    offset = first.getUTCDay(),
    count = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    ).getUTCDate();
  return (
    <div className="calendar">
      <div className="calendar-heading">
        <button
          className="icon-btn"
          aria-label="เดือนก่อน"
          onClick={() =>
            setMonth(
              new Date(
                Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1),
              ),
            )
          }
        >
          ←
        </button>
        <strong>
          {new Intl.DateTimeFormat("th-TH", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(first)}
        </strong>
        <button
          className="icon-btn"
          aria-label="เดือนถัดไป"
          onClick={() =>
            setMonth(
              new Date(
                Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1),
              ),
            )
          }
        >
          →
        </button>
      </div>
      <div className="calendar-grid">
        {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
          <small key={d}>{d}</small>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={"e" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = new Date(
              Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), i + 1),
            )
              .toISOString()
              .slice(0, 10),
            off =
              date < today() ||
              date < from ||
              date > until ||
              isUnavailable(date, date, periods);
          return (
            <span
              key={date}
              className={off ? "calendar-off" : "calendar-available"}
              title={off ? "ไม่ว่าง" : "ว่าง"}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
      <p className="muted small-text">
        วันที่ขีดทับ = ไม่พร้อมให้เช่า · เลือกวันรับ–คืนในแบบฟอร์ม
      </p>
    </div>
  );
}
