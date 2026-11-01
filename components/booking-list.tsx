import Link from "next/link";
import { money, dateLabel, type Booking } from "@/lib/domain";
import { Empty, Status } from "./ui";
import { Package } from "./icon";
export function BookingList({
  bookings,
  owner = false,
}: {
  bookings: Booking[];
  owner?: boolean;
}) {
  return bookings.length ? (
    <div className="list-rows">
      {bookings.map((b) => (
        <article className="list-row" key={b.id}>
          <div className="list-row-main">
            <span className="list-thumb">
              <Package size={26} strokeWidth={1.2} />
            </span>
            <div>
              <Link href={`/bookings/${b.id}`}>
                <h3>{b.items?.title || "สินค้า"}</h3>
              </Link>
              <p>
                {dateLabel(b.start_date)} – {dateLabel(b.end_date)} ·{" "}
                {b.rental_days} วัน
              </p>
              <p>
                ค่าเช่า {money(b.rental_total)} · ประกัน {money(b.deposit)}
              </p>
              {b.payments?.some((p) => p.simulated) && (
                <p>Development · เงินจำลอง</p>
              )}
            </div>
          </div>
          <Status value={b.status} />
          <Link className="btn secondary" href={`/bookings/${b.id}`}>
            {owner ? "จัดการคำขอ" : "ดูรายละเอียด"} →
          </Link>
        </article>
      ))}
    </div>
  ) : (
    <Empty
      title={owner ? "ยังไม่มีคำขอเช่า" : "ยังไม่มีรายการเช่า"}
      text={
        owner
          ? "คำขอใหม่จะปรากฏที่นี่เมื่อมีเพื่อนสนใจสินค้าของคุณ"
          : "เริ่มจากค้นหาสินค้าที่คุณต้องการ แล้วเลือกวันที่ว่าง"
      }
      href="/marketplace"
    />
  );
}
