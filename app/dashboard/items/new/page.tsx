import { requireUser } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { ItemForm } from "@/components/item-form";
export default async function NewItem() {
  await requireUser();
  return (
    <div className="container page">
      <PageHead
        kicker="GIVE IT ANOTHER STORY"
        title="ลงประกาศสินค้า"
        description="รายละเอียดที่ชัดเจน ทำให้แบ่งปันกันได้อย่างสบายใจ"
      />
      <div className="two-column">
        <div className="panel">
          <ItemForm />
        </div>
        <aside className="panel">
          <h3>ประกาศที่ดี เริ่มจากความใส่ใจ</h3>
          <p className="muted small-text">
            ระบุสภาพจริง รวมถึงตำหนิและอุปกรณ์ที่ให้ยืม
            เลือกจุดรับ–คืนที่เป็นพื้นที่สาธารณะ
            กำหนดค่าเช่าและเงินประกันที่เหมาะสม
          </p>
          <p className="muted small-text" style={{ marginTop: 15 }}>
            หลังสร้างประกาศ คุณสามารถเพิ่มภาพและปิดวันที่ไม่สะดวกให้เช่าได้
          </p>
        </aside>
      </div>
    </div>
  );
}
