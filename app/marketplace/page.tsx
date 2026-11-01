import { catalog } from "@/lib/data";
import { categories, dateSchema } from "@/lib/domain";
import { PageHead, ItemGrid, SetupNotice } from "@/components/ui";
import { configured } from "@/lib/supabase/server";
import { Search, SlidersHorizontal } from "@/components/icon";
import Link from "next/link";
export const metadata = { title: "สำรวจสินค้า" };
export default async function Marketplace({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  const filterError =
    (p.start && !dateSchema.safeParse(p.start).success) ||
    (p.end && !dateSchema.safeParse(p.end).success) ||
    (p.start && p.end && p.end < p.start) ||
    !!p.start !== !!p.end ||
    (p.min && (!Number.isFinite(Number(p.min)) || Number(p.min) < 0)) ||
    (p.max &&
      (!Number.isFinite(Number(p.max)) || Number(p.max) < Number(p.min || 0)));
  const items = filterError ? [] : await catalog(p);
  return (
    <div className="container page">
      <PageHead
        kicker="THE CAMPUS COLLECTION"
        title="ของที่คุณหา อาจอยู่ใกล้กว่าที่คิด"
        description="สำรวจสิ่งของพร้อมแบ่งปันจากเพื่อนในแคมปัส"
      />
      <form className="filter-panel" action="/marketplace">
        <div className="filter-search">
          <Search size={19} />
          <input
            name="q"
            defaultValue={p.q}
            placeholder="ค้นหาสินค้า…"
            aria-label="ชื่อสินค้า"
          />
        </div>
        <div className="filter-fields">
          <label>
            หมวดหมู่
            <select name="category" defaultValue={p.category || ""}>
              <option value="">ทุกหมวดหมู่</option>
              {Object.entries(categories).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            ราคาต่ำสุด / วัน
            <input
              name="min"
              type="number"
              min="0"
              defaultValue={p.min}
              placeholder="0"
            />
          </label>
          <label>
            ราคาสูงสุด / วัน
            <input
              name="max"
              type="number"
              min="0"
              defaultValue={p.max}
              placeholder="ไม่จำกัด"
            />
          </label>
          <label>
            วันรับ
            <input name="start" type="date" defaultValue={p.start} />
          </label>
          <label>
            วันคืน
            <input name="end" type="date" defaultValue={p.end} />
          </label>
          <label>
            เรียงตาม
            <select name="sort" defaultValue={p.sort || "newest"}>
              <option value="newest">ลงประกาศล่าสุด</option>
              <option value="price_asc">ราคา: ต่ำไปสูง</option>
              <option value="price_desc">ราคา: สูงไปต่ำ</option>
            </select>
          </label>
          <button className="btn" type="submit">
            <SlidersHorizontal size={16} />
            ค้นหา
          </button>
        </div>
      </form>
      {filterError && (
        <p className="feedback error" role="alert">
          กรุณาระบุวันรับ–คืนให้ครบและช่วงราคาให้ถูกต้อง
        </p>
      )}
      <div className="results-line">
        <p>
          พบ{" "}
          <strong>
            {items.length}
            {items.length === 100 ? "+" : ""}
          </strong>{" "}
          รายการ
        </p>
        <Link href="/marketplace">ล้างตัวกรอง</Link>
      </div>
      {!configured() && <SetupNotice />}
      <ItemGrid items={items} />
    </div>
  );
}
