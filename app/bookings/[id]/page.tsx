import { siteUrl } from "@/lib/site";
import { UploadForm } from "@/components/upload-form";
import { uuidSchema } from "@/lib/domain";
import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { money, dateLabel, statuses, today, type Booking } from "@/lib/domain";
import { Status } from "@/components/ui";
import { ActionForm, Hidden } from "@/components/action-form";
import { mutationAction } from "@/app/actions";
function Transition({
  id,
  action,
  label,
  danger = false,
}: {
  id: string;
  action: string;
  label: string;
  danger?: boolean;
}) {
  return (
    <ActionForm
      action={mutationAction}
      label={label}
      buttonClass={danger ? "btn danger" : "btn"}
      confirm={danger ? "ยืนยันการยกเลิกรายการนี้?" : undefined}
    >
      <Hidden name="operation" value="transition" />
      <Hidden name="id" value={id} />
      <Hidden name="value" value={action} />
    </ActionForm>
  );
}
export default async function BookingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const user = await requireUser(),
    db = await supabase();
  const { data, error } = await db
    .from("bookings")
    .select("*,items(*),payments(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const b = data as Booking,
    owner = b.owner_id === user.id,
    renter = b.renter_id === user.id,
    participant = owner || renter;
  const [
    { data: handovers, error: he },
    { data: disputes, error: de },
    { data: reviews, error: re },
    { data: people, error: pe },
  ] = await Promise.all([
    db.from("handovers").select("*").eq("booking_id", b.id),
    db.from("disputes").select("*").eq("booking_id", b.id),
    db.from("reviews").select("*").eq("booking_id", b.id),
    db.from("profiles").select("*").in("id", [b.owner_id, b.renter_id]),
  ]);
  if (he || de || re || pe) throw new Error((he || de || re || pe)!.message);
  const evidence = await Promise.all(
    (handovers || []).map(async (h) => {
      const { data: signed } = await db.storage
        .from("handover-evidence")
        .createSignedUrl(h.evidence_path, 300);
      return { ...h, url: signed?.signedUrl };
    }),
  );
  const path = `${siteUrl()}/bookings/${b.id}`,
    qr = await QRCode.toDataURL(path, {
      width: 220,
      margin: 1,
      color: { dark: "#7b253c", light: "#ffffff" },
    });
  const canSimulate =
    process.env.NODE_ENV === "development" &&
    process.env.ENABLE_DEV_PAYMENTS === "true" &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const steps = [
    "pending",
    "confirmed",
    "paid",
    "picked_up",
    "returned",
    "completed",
  ];
  const kind =
    b.status === "paid" ? "pickup" : b.status === "picked_up" ? "return" : null;
  const myHandover =
    kind && evidence.some((h) => h.kind === kind && h.user_id === user.id);
  return (
    <div className="container page">
      <div className="breadcrumbs">
        <Link href={owner ? "/dashboard?tab=active" : "/bookings"}>
          รายการเช่า
        </Link>
        <span>/</span>
        <span>#{b.id.slice(0, 8)}</span>
      </div>
      <div className="booking-title">
        <h1>{b.items?.title || "รายละเอียดการเช่า"}</h1>
        <Status value={b.status} />
      </div>
      {b.payments.some((p) => p.simulated) && (
        <div className="notice">
          <strong>รายการทดสอบ Development — ไม่มีการชำระเงินจริง</strong>
          <p>
            ค่าเช่า เงินประกัน การพักเงิน
            และการคืนเงินในรายการนี้เป็นข้อมูลจำลองทั้งหมด
          </p>
        </div>
      )}
      <div className="two-column">
        <div className="stack-panels">
          <section className="panel">
            <h2>รายละเอียดการจอง</h2>
            <Link className="arrow-link" href={`/items/${b.item_id}`}>
              ดูสินค้า →
            </Link>
            <div className="booking-meta">
              <div>
                <small>วันรับ</small>
                <strong>{dateLabel(b.start_date)}</strong>
              </div>
              <div>
                <small>วันคืน</small>
                <strong>{dateLabel(b.end_date)}</strong>
              </div>
              <div>
                <small>เจ้าของ</small>
                <strong>
                  {people?.find((p) => p.id === b.owner_id)?.display_name}
                </strong>
              </div>
              <div>
                <small>ผู้เช่า</small>
                <strong>
                  {people?.find((p) => p.id === b.renter_id)?.display_name}
                </strong>
              </div>
              <div>
                <small>จุดรับ–คืน</small>
                <strong>{b.items?.pickup_location}</strong>
              </div>
              <div>
                <small>เลขรายการ</small>
                <strong>#{b.id.slice(0, 8)}</strong>
              </div>
            </div>
            <div className="cost-lines">
              <p>
                <span>
                  {money(b.daily_price)} × {b.rental_days} วัน
                </span>
                <b>{money(b.rental_total)}</b>
              </p>
              <p>
                <span>เงินประกัน</span>
                <b>{money(b.deposit)}</b>
              </p>
              <p>
                <span>ค่าธรรมเนียม</span>
                <b>{money(b.platform_fee)}</b>
              </p>
              <p className="total">
                <span>รวม</span>
                <strong>
                  {money(
                    Number(b.rental_total) +
                      Number(b.deposit) +
                      Number(b.platform_fee),
                  )}
                </strong>
              </p>
            </div>
            <ol className="timeline">
              {steps.map((s, i) => (
                <li
                  key={s}
                  className={steps.indexOf(b.status) >= i ? "done" : ""}
                >
                  {statuses[s]}
                </li>
              ))}
            </ol>
            <div className="action-buttons">
              {owner && b.status === "pending" && (
                <>
                  <Transition id={b.id} action="confirm" label="ยืนยันคำขอ" />
                  <Transition
                    id={b.id}
                    action="reject"
                    label="ปฏิเสธคำขอ"
                    danger
                  />
                </>
              )}
              {renter &&
                ["pending", "confirmed"].includes(b.status) &&
                b.start_date >= today() && (
                  <Transition
                    id={b.id}
                    action="cancel"
                    label="ยกเลิกการจอง"
                    danger
                  />
                )}
              {participant && b.status === "returned" && (
                <Transition
                  id={b.id}
                  action="complete"
                  label="ยืนยันเสร็จสิ้นการเช่า"
                />
              )}
            </div>
            {b.status === "confirmed" &&
              renter &&
              (canSimulate ? (
                <ActionForm
                  action={mutationAction}
                  className="stack"
                  label="จำลองการชำระเงิน (ไม่มีเงินจริง)"
                  confirm="จำลองการชำระเงินสำหรับทดสอบรายการนี้? ไม่มีการชำระเงินจริง"
                >
                  <Hidden name="operation" value="simulate" />
                  <Hidden name="id" value={b.id} />
                </ActionForm>
              ) : (
                <div className="notice">
                  ยังไม่มี Payment Gateway สำหรับชำระเงินจริง
                  โหมดจำลองต้องเปิดใน Development ตาม README
                </div>
              ))}
            {b.status === "returned" && (
              <p className="small-text muted" style={{ marginTop: 15 }}>
                ทั้งสองฝ่ายยืนยันคืนของแล้ว
                ตรวจสอบให้เรียบร้อยก่อนยืนยันเสร็จสิ้น การคืนเงินประกันในโหมด
                Development เป็นการจำลอง
              </p>
            )}
          </section>
          <section className="panel">
            <h2>การส่งมอบ</h2>
            <div className="qr-panel">
              <img src={qr} alt={`QR Code รายการเช่า ${b.id.slice(0, 8)}`} />
              <p>
                ให้อีกฝ่ายสแกนเพื่อเปิดรายการนี้
                <br />
                แต่ละคนต้องเข้าสู่ระบบด้วยบัญชีของตนเอง
                และอัปโหลดภาพสภาพสินค้าก่อนยืนยัน
              </p>
            </div>
            {participant &&
              kind &&
              !myHandover &&
              (kind !== "pickup" || today() >= b.start_date) && (
                <UploadForm
                  id={b.id}
                  target={kind}
                  label={
                    kind === "pickup"
                      ? "อัปโหลดภาพและยืนยันรับของ"
                      : "อัปโหลดภาพและยืนยันคืนของ"
                  }
                />
              )}
            {kind === "pickup" && today() < b.start_date && (
              <div className="notice">
                ยืนยันรับของได้ตั้งแต่ {dateLabel(b.start_date)}
              </div>
            )}
            {myHandover && (
              <div className="feedback success">
                คุณยืนยันแล้ว รออีกฝ่ายยืนยันการส่งมอบ
              </div>
            )}
            <div className="evidence-list">
              {evidence.map((h) => (
                <div key={h.id}>
                  {h.url && (
                    <a href={h.url} target="_blank" rel="noreferrer">
                      <img src={h.url} alt="หลักฐานสภาพสินค้า" />
                    </a>
                  )}
                  <p>
                    {h.user_id === b.owner_id ? "เจ้าของ" : "ผู้เช่า"} ·{" "}
                    {h.kind === "pickup" ? "รับของ" : "คืนของ"}
                    <br />
                    {dateLabel(h.confirmed_at)}{" "}
                    {new Intl.DateTimeFormat("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Bangkok",
                    }).format(new Date(h.confirmed_at))}
                  </p>
                </div>
              ))}
            </div>
          </section>
          {renter && b.status === "completed" && !reviews?.length && (
            <section className="panel">
              <h2>แบ่งปันประสบการณ์</h2>
              <ActionForm
                action={mutationAction}
                className="stack"
                label="ส่งรีวิว"
              >
                <Hidden name="operation" value="review" />
                <Hidden name="id" value={b.id} />
                <label>
                  คะแนน
                  <select name="rating">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} / 5
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  รีวิว
                  <textarea
                    name="comment"
                    required
                    minLength={3}
                    maxLength={1000}
                    rows={3}
                  />
                </label>
              </ActionForm>
            </section>
          )}
          {!!reviews?.length && (
            <section className="panel">
              <h2>รีวิวการเช่า</h2>
              <p className="rating">{reviews[0].rating} / 5</p>
              <p className="preserve-lines">{reviews[0].comment}</p>
            </section>
          )}
        </div>
        <aside className="stack-panels">
          <section className="panel">
            <h3>เช่าอย่างสบายใจ</h3>
            <p className="muted small-text">
              นัดรับในพื้นที่สาธารณะ ตรวจสภาพและอุปกรณ์ให้ครบ
              บันทึกภาพด้วยบัญชีของแต่ละฝ่าย
              ระบบจะเปลี่ยนสถานะเมื่อยืนยันครบสองคน
            </p>
            <Link
              className="arrow-link"
              style={{ marginTop: 15 }}
              href="/guide"
            >
              อ่านคู่มือการเช่า →
            </Link>
          </section>
          {participant &&
            ["confirmed", "paid", "picked_up", "returned"].includes(
              b.status,
            ) && (
              <section className="panel">
                <h3>พบปัญหาในการเช่า?</h3>
                <ActionForm
                  action={mutationAction}
                  className="stack"
                  label="รายงานปัญหา"
                  buttonClass="btn secondary"
                >
                  <Hidden name="operation" value="dispute" />
                  <Hidden name="id" value={b.id} />
                  <label>
                    รายละเอียดปัญหา
                    <textarea
                      required
                      minLength={10}
                      maxLength={2000}
                      rows={4}
                      name="reason"
                      placeholder="อธิบายปัญหาและสิ่งที่ต้องการให้ตรวจสอบ"
                    />
                  </label>
                </ActionForm>
              </section>
            )}
          {disputes?.map((d) => (
            <section key={d.id} className="panel">
              <h3>
                ข้อพิพาท · {d.status === "open" ? "รอตรวจสอบ" : "แก้ไขแล้ว"}
              </h3>
              <p className="preserve-lines small-text">{d.reason}</p>
              {d.resolution && <p className="notice">{d.resolution}</p>}
              <small className="muted">{dateLabel(d.created_at)}</small>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
