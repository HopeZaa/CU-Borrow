import { uuidSchema } from "@/lib/domain";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase, configured } from "@/lib/supabase/server";
import { enrich, imageUrl } from "@/lib/data";
import { currentUser } from "@/lib/auth";
import {
  categories,
  conditions,
  money,
  dateLabel,
  type Item,
} from "@/lib/domain";
import { BookingForm, AvailabilityCalendar } from "@/components/booking-form";
import { MapPin, Star, Package, ShieldCheck } from "@/components/icon";
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!configured() || !uuidSchema.safeParse(id).success) notFound();
  const db = await supabase();
  const [{ data: item, error }, user] = await Promise.all([
    db.from("items").select("*").eq("id", id).maybeSingle(),
    currentUser(),
  ]);
  if (error) throw new Error(error.message);
  if (!item) notFound();
  const [details] = await enrich([item as Item]);
  const [
    { data: periods, error: periodError },
    { data: reviews, error: reviewError },
  ] = await Promise.all([
    db.rpc("cu_unavailable", { p_item: item.id }),
    db
      .from("reviews")
      .select("*,profiles!reviews_reviewer_id_fkey(display_name)")
      .eq("reviewee_id", item.owner_id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (periodError || reviewError)
    throw new Error((periodError || reviewError)!.message);
  return (
    <div className="container page">
      <div className="breadcrumbs">
        <Link href="/marketplace">สำรวจสินค้า</Link>
        <span>/</span>
        <Link href={`/marketplace?category=${item.category}`}>
          {categories[details.category]}
        </Link>
        <span>/</span>
        <span>{item.title}</span>
      </div>
      <div className="detail-layout">
        <div>
          <div className="detail-gallery">
            {details.item_images?.length ? (
              details.item_images.map((img, i) => (
                <a
                  key={img.storage_path}
                  href={imageUrl(img.storage_path)}
                  target="_blank"
                  rel="noreferrer"
                  className={i === 0 ? "main-image" : ""}
                >
                  <img
                    src={imageUrl(img.storage_path)}
                    alt={`${item.title} ภาพที่ ${i + 1}`}
                  />
                </a>
              ))
            ) : (
              <div className="image-placeholder main-image">
                <Package size={90} strokeWidth={1} />
                <span>เจ้าของยังไม่ได้เพิ่มรูปภาพ</span>
              </div>
            )}
          </div>
          <div className="detail-heading">
            <span className="eyebrow">{categories[details.category]}</span>
            <h1>{item.title}</h1>
            <p>
              <MapPin size={16} />
              {item.pickup_location}
            </p>
          </div>
          <div className="detail-owner">
            <span className="avatar">
              {details.owner?.display_name.slice(0, 1)}
            </span>
            <div>
              <b>{details.owner?.display_name}</b>
              <p>{details.owner?.faculty || "สมาชิก CU-Borrow"}</p>
            </div>
            <span className="rating">
              <Star size={15} />
              {details.stats?.rating || "ยังไม่มีคะแนน"} ·{" "}
              {details.stats?.completed_count || 0} ครั้งสำเร็จ
            </span>
          </div>
          <p className="verification-note">
            <ShieldCheck size={16} />
            {details.owner?.verification_status === "verified"
              ? "สถานะนิสิตผ่านการตรวจสอบแล้ว"
              : "ยังไม่ได้ยืนยันสถานะนิสิต"}
          </p>
          <section className="detail-section">
            <h2>รายละเอียดสินค้า</h2>
            <p className="preserve-lines">{item.description}</p>
            <div className="facts">
              <div>
                <small>สภาพสินค้า</small>
                <b>{conditions[details.condition]}</b>
              </div>
              <div>
                <small>เงินประกัน</small>
                <b>{money(item.deposit)}</b>
              </div>
            </div>
          </section>
          <section className="detail-section">
            <h2>เช็กวันที่ว่าง</h2>
            <AvailabilityCalendar
              periods={periods || []}
              from={item.available_from}
              until={item.available_until}
            />
          </section>
          <section className="detail-section">
            <h2>รีวิวเจ้าของ ({details.stats?.review_count || 0})</h2>
            {reviews?.length ? (
              reviews.map((r) => (
                <div className="review" key={r.id}>
                  <b>{r.profiles?.display_name || "ผู้เช่า"}</b>
                  <span className="rating">{r.rating} / 5</span>
                  <p>{r.comment}</p>
                  <small>{dateLabel(r.created_at)}</small>
                </div>
              ))
            ) : (
              <p className="muted">ยังไม่มีรีวิวจากการเช่าสำเร็จ</p>
            )}
          </section>
        </div>
        <aside>
          {item.status === "active" ? (
            <BookingForm
              id={item.id}
              price={Number(item.daily_price)}
              deposit={Number(item.deposit)}
              from={item.available_from}
              until={item.available_until}
              periods={periods || []}
              loggedIn={!!user}
              isOwner={user?.id === item.owner_id}
            />
          ) : (
            <div className="notice">ประกาศนี้ปิดให้เช่าแล้ว</div>
          )}
          <p className="detail-safe">
            อ่านรายละเอียดและตรวจสภาพก่อนรับของ
            <br />
            <Link href="/guide">ดูข้อตกลงและวิธีรับ–คืน →</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
