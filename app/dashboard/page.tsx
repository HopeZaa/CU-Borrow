import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { money, categories, type Booking, type Item } from "@/lib/domain";
import { PageHead, Empty } from "@/components/ui";
import { BookingList } from "@/components/booking-list";
import { Plus, Package } from "@/components/icon";
export const metadata = { title: "ร้านของฉัน" };
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser(),
    db = await supabase();
  const [{ data: items, error: ie }, { data: bookings, error: be }] =
    await Promise.all([
      db
        .from("items")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
      db
        .from("bookings")
        .select("*,items(*),payments(*)")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
  if (ie || be) throw new Error((ie || be)!.message);
  const rows = (bookings || []) as Booking[];
  const simEarnings = rows
    .filter(
      (b) => b.status === "completed" && b.payments.some((p) => p.simulated),
    )
    .reduce((n, b) => n + Number(b.rental_total), 0);
  const tab = (await searchParams).tab || "items";
  return (
    <div className="container page">
      <PageHead
        kicker="YOUR SHARING SPACE"
        title="ร้านของฉัน"
        description="ให้ของที่คุณมี ได้สร้างประโยชน์อีกครั้ง"
      >
        <Link className="btn" href="/dashboard/items/new">
          <Plus size={17} />
          ลงประกาศใหม่
        </Link>
      </PageHead>
      <div className="stats-grid">
        <div className="stat">
          <p>ประกาศที่เปิดให้เช่า</p>
          <strong>
            {items?.filter((i) => i.status === "active").length || 0}
          </strong>
        </div>
        <div className="stat">
          <p>คำขอรอยืนยัน</p>
          <strong>{rows.filter((b) => b.status === "pending").length}</strong>
        </div>
        <div className="stat">
          <p>กำลังเช่า</p>
          <strong>{rows.filter((b) => b.status === "picked_up").length}</strong>
        </div>
        <div className="stat">
          <p>รายได้จำลองสะสม</p>
          <strong>{money(simEarnings)}</strong>
          <small>Development · ไม่มีรายรับเงินจริง</small>
        </div>
      </div>
      <nav className="dashboard-tabs" aria-label="หมวดร้านของฉัน">
        {[
          ["items", "สินค้าของฉัน"],
          ["requests", "คำขอเช่า"],
          ["active", "กำลังดำเนินการ"],
          ["history", "ประวัติการเช่า"],
        ].map(([v, l]) => (
          <Link
            key={v}
            className={tab === v ? "active" : ""}
            href={`/dashboard?tab=${v}`}
          >
            {l}
          </Link>
        ))}
      </nav>
      {tab === "items" ? (
        items?.length ? (
          <div className="list-rows">
            {(items as Item[]).map((i) => (
              <div key={i.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-thumb">
                    <Package size={25} />
                  </span>
                  <div>
                    <h3>{i.title}</h3>
                    <p>
                      {categories[i.category]} · {money(i.daily_price)} / วัน ·
                      ประกัน {money(i.deposit)}
                    </p>
                    <p>
                      {i.status === "active"
                        ? "เปิดให้เช่า"
                        : i.status === "suspended"
                          ? "ถูกระงับประกาศ"
                          : "เก็บประกาศแล้ว"}
                    </p>
                  </div>
                </div>
                <Link
                  className="btn secondary"
                  href={`/dashboard/items/${i.id}/edit`}
                >
                  จัดการประกาศ →
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="ของชิ้นไหนที่คุณอยากแบ่งปัน?"
            text="เริ่มต้นด้วยของที่คุณไม่ได้ใช้ทุกวัน"
            href="/dashboard/items/new"
            label="ลงประกาศชิ้นแรก"
          />
        )
      ) : (
        <BookingList
          owner
          bookings={rows.filter((b) =>
            tab === "requests"
              ? b.status === "pending"
              : tab === "history"
                ? ["completed", "cancelled"].includes(b.status)
                : !["pending", "completed", "cancelled"].includes(b.status),
          )}
        />
      )}
    </div>
  );
}
