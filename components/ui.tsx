import Link from "next/link";
import { Package, ArrowRight, Star, MapPin } from "./icon";
import { categories, money, statuses, type Item } from "@/lib/domain";
import { imageUrl } from "@/lib/data";
export function Empty({
  title = "ยังไม่มีรายการ",
  text = "เมื่อมีรายการใหม่ จะแสดงที่นี่",
  href,
  label,
}: {
  title?: string;
  text?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <Package size={32} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{text}</p>
      {href && (
        <Link className="btn secondary" href={href}>
          {label || "ดูสินค้า"}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`badge status-${value}`}>{statuses[value] || value}</span>
  );
}
export function ItemCard({ item }: { item: Item }) {
  const path = item.item_images?.[0]?.storage_path;
  return (
    <article className="item-card">
      <Link href={`/items/${item.id}`} className="item-image">
        {path ? (
          <img src={imageUrl(path)} alt={item.title} loading="lazy" />
        ) : (
          <div className="image-placeholder">
            <Package size={62} strokeWidth={1} />
            <span>ยังไม่มีรูปสินค้า</span>
          </div>
        )}
        <span className="availability">
          <span />
          เปิดให้เช่า
        </span>
        <span className="image-arrow">
          <ArrowRight size={17} />
        </span>
      </Link>
      <div className="item-content">
        <div className="eyebrow">{categories[item.category]}</div>
        <Link className="item-title" href={`/items/${item.id}`}>
          {item.title}
        </Link>
        <p className="location">
          <MapPin size={13} />
          {item.pickup_location}
        </p>
        <div className="item-bottom">
          <div>
            <b>{money(item.daily_price)}</b>
            <span> / วัน</span>
            <small>ประกัน {money(item.deposit)}</small>
          </div>
          <span className="rating">
            <Star size={13} fill="currentColor" />
            {item.stats?.rating || "ใหม่"}
          </span>
        </div>
        <div className="owner-line">
          <span className="avatar tiny">
            {item.owner?.display_name?.slice(0, 1) || "C"}
          </span>
          <span>{item.owner?.display_name || "สมาชิก"}</span>
          <span>{item.stats?.completed_count || 0} ครั้งสำเร็จ</span>
        </div>
      </div>
    </article>
  );
}
export function ItemGrid({ items }: { items: Item[] }) {
  return items.length ? (
    <div className="item-grid">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  ) : (
    <Empty
      title="พบกันเร็ว ๆ นี้"
      text="ยังไม่มีสินค้าที่ตรงกับการค้นหา ลองเปลี่ยนตัวกรองหรือเป็นคนแรกที่แบ่งปัน"
      href="/dashboard/items/new"
      label="ลงประกาศสินค้า"
    />
  );
}
export function SetupNotice() {
  return (
    <div className="notice">
      <strong>เตรียมพื้นที่สำหรับการแบ่งปัน</strong>
      <p>
        ตั้งค่า Supabase ตาม README
        เพื่อเปิดใช้บัญชีสมาชิกและแสดงสินค้าจากฐานข้อมูลจริง
      </p>
    </div>
  );
}
export function PageHead({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
