import { UploadForm } from "@/components/upload-form";
import { uuidSchema } from "@/lib/domain";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { imageUrl } from "@/lib/data";
import { dateLabel, type Item } from "@/lib/domain";
import { PageHead } from "@/components/ui";
import { ItemForm } from "@/components/item-form";
import { ActionForm, Hidden } from "@/components/action-form";
import { mutationAction, uploadAction } from "@/app/actions";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const user = await requireUser(),
    db = await supabase();
  const { data: item, error } = await db
    .from("items")
    .select("*,item_images(*)")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) notFound();
  const { data: blocked, error: be } = await db
    .from("item_availability")
    .select("*")
    .eq("item_id", item.id);
  if (be) throw new Error(be.message);
  return (
    <div className="container page">
      <PageHead
        kicker="YOUR LISTING"
        title="จัดการประกาศ"
        description={item.title}
      >
        <Link className="btn secondary" href={`/items/${item.id}`}>
          ดูหน้าสินค้า →
        </Link>
      </PageHead>
      {item.status !== "active" && (
        <div className="notice">
          ประกาศนี้
          {item.status === "suspended"
            ? "ถูกระงับโดย Admin"
            : "ถูกเก็บแล้ว"}{" "}
          ไม่สามารถเพิ่มรูปหรือเปิดให้เช่าได้
        </div>
      )}
      <div className="two-column">
        <div className="panel">
          <ItemForm item={item as Item} />
        </div>
        <aside className="stack-panels">
          <section className="panel">
            <h3>รูปสินค้า ({item.item_images.length}/6)</h3>
            <p className="small-text muted">
              JPG, PNG หรือ WebP ไม่เกิน 5 MB ต่อรูป
            </p>
            <div className="listing-images">
              {item.item_images.map(
                (img: { id: string; storage_path: string }) => (
                  <div key={img.id}>
                    <img src={imageUrl(img.storage_path)} alt={item.title} />
                    <ActionForm
                      action={uploadAction}
                      label="ลบภาพ"
                      buttonClass="text-btn"
                      confirm="ลบภาพนี้ออกจากประกาศ?"
                    >
                      <Hidden name="target" value="remove_image" />
                      <Hidden name="id" value={item.id} />
                      <Hidden name="path" value={img.storage_path} />
                    </ActionForm>
                  </div>
                ),
              )}
            </div>
            {item.status === "active" && (
              <UploadForm id={item.id} target="item" label="อัปโหลดภาพ" />
            )}
          </section>
          <section className="panel">
            <h3>วันที่ไม่เปิดให้เช่า</h3>
            {blocked?.map((b) => (
              <div className="audit" key={b.id}>
                <p>
                  {dateLabel(b.start_date)} – {dateLabel(b.end_date)}
                </p>
                <ActionForm
                  action={mutationAction}
                  label="เปิดให้เช่าช่วงนี้"
                  buttonClass="text-btn"
                >
                  <Hidden name="operation" value="remove_blackout" />
                  <Hidden name="id" value={item.id} />
                  <Hidden name="blackout_id" value={b.id} />
                  <Hidden name="start_date" value={b.start_date} />
                  <Hidden name="end_date" value={b.end_date} />
                </ActionForm>
              </div>
            ))}
            {item.status === "active" && (
              <ActionForm
                action={mutationAction}
                className="stack"
                label="ปิดให้เช่าในช่วงนี้"
                buttonClass="btn secondary"
              >
                <Hidden name="operation" value="blackout" />
                <Hidden name="id" value={item.id} />
                <div className="form-row">
                  <label>
                    เริ่ม
                    <input required type="date" name="start_date" />
                  </label>
                  <label>
                    สิ้นสุด
                    <input required type="date" name="end_date" />
                  </label>
                </div>
              </ActionForm>
            )}
          </section>
          {item.status === "active" && (
            <section className="panel">
              <h3>เก็บประกาศ</h3>
              <p className="small-text muted">
                นำออกจาก Marketplace โดยเก็บประวัติการเช่าไว้
                ต้องไม่มีการเช่าค้างอยู่
              </p>
              <ActionForm
                action={mutationAction}
                className="stack"
                label="เก็บประกาศนี้"
                buttonClass="btn danger"
                confirm="นำประกาศนี้ออกจาก Marketplace? ประวัติการเช่าจะยังอยู่"
              >
                <Hidden name="operation" value="archive" />
                <Hidden name="id" value={item.id} />
              </ActionForm>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
