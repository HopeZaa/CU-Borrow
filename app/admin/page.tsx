import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import {
  adminTables,
  type AdminField,
  type AdminRow,
  type AdminPage,
} from "@/lib/admin";
import { PageHead, Empty } from "@/components/ui";
import { ActionForm, Hidden } from "@/components/action-form";
import { mutationAction } from "@/app/actions";
import { adminDataAction } from "./actions";

function Reason() {
  return (
    <label>
      เหตุผลการดำเนินการ
      <textarea
        name="reason"
        required
        minLength={5}
        maxLength={2000}
        rows={2}
        placeholder="ระบุเหตุผลเพื่อตรวจสอบย้อนหลัง"
      />
    </label>
  );
}
function Field({ field, value }: { field: AdminField; value: unknown }) {
  const text = value == null ? "" : String(value);
  return (
    <label>
      {field.label}
      {field.options || field.type === "boolean" ? (
        <select name={field.key} defaultValue={text}>
          {(field.options || ["false", "true"]).map((option) => (
            <option key={option} value={option}>
              {field.type === "boolean"
                ? option === "true"
                  ? "ใช่"
                  : "ไม่"
                : option}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          name={field.key}
          defaultValue={text}
          rows={3}
          maxLength={4000}
        />
      ) : (
        <input
          name={field.key}
          type={
            field.type === "number"
              ? "number"
              : field.type === "date"
                ? "date"
                : "text"
          }
          step={field.type === "number" ? "any" : undefined}
          defaultValue={text}
          required={!field.nullable}
          placeholder={
            field.type === "datetime"
              ? "2026-11-02T08:00:00Z หรือเว้นว่าง"
              : undefined
          }
        />
      )}
    </label>
  );
}
function Editor({
  table,
  row,
  create = false,
}: {
  table: string;
  row: AdminRow;
  create?: boolean;
}) {
  const definition = adminTables[table];
  return (
    <ActionForm
      action={adminDataAction}
      className="stack"
      label={create ? "สร้างข้อมูล" : "บันทึกการแก้ไข"}
    >
      <Hidden name="operation" value={create ? "create" : "patch"} />
      <Hidden name="table" value={table} />
      {!create && (
        <>
          <Hidden name="id" value={String(row.id)} />
          <Hidden name="original" value={JSON.stringify(row)} />
        </>
      )}
      <div className="admin-fields">
        {definition.fields
          .filter(
            (f) => !create || Object.hasOwn(definition.create || {}, f.key),
          )
          .map((field) => (
            <Field key={field.key} field={field} value={row[field.key]} />
          ))}
      </div>
      <Reason />
    </ActionForm>
  );
}
function Record({ table, row }: { table: string; row: AdminRow }) {
  const definition = adminTables[table],
    id = String(row.id || row.user_id),
    title = String(
      row.title ||
        row.display_name ||
        row.message ||
        row.action ||
        row.reason ||
        `#${id.slice(0, 8)}`,
    );
  return (
    <section className="panel admin-record">
      <h3>{title}</h3>
      <p className="muted small-text admin-id">
        {id}
        {row.status ? ` · ${row.status}` : ""}
        {row.email ? ` · ${row.email}` : ""}
      </p>
      {table === "bookings" && (
        <Link className="arrow-link" href={`/bookings/${id}`}>
          ดูรายละเอียดการเช่า →
        </Link>
      )}
      {Boolean(row.booking_id) && (
        <Link
          className="arrow-link"
          href={`/bookings/${String(row.booking_id)}`}
        >
          ดูรายการเช่าที่เกี่ยวข้อง →
        </Link>
      )}
      <details>
        <summary>ดูข้อมูลทั้งหมด</summary>
        <pre className="admin-json">{JSON.stringify(row, null, 2)}</pre>
      </details>
      {definition.fields.length > 0 && (
        <details>
          <summary>แก้ไขข้อมูล</summary>
          {table === "payments" && (
            <p className="notice">
              แก้ไขได้เฉพาะรายการจำลอง ยอดเงินต้องตรงกับการจอง
              ปรับราคาและสถานะคืนเงินจากหมวดการจอง
            </p>
          )}
          <Editor table={table} row={row} />
        </details>
      )}
      {table === "profiles" && (
        <details>
          <summary>จัดการสิทธิ์ Admin · {String(row.role)}</summary>
          <ActionForm
            action={adminDataAction}
            className="stack"
            label={row.role === "admin" ? "ถอนสิทธิ์ Admin" : "ให้สิทธิ์ Admin"}
            confirm="ยืนยันการเปลี่ยนสิทธิ์ผู้ดูแลระบบของบัญชีนี้?"
          >
            <Hidden name="operation" value="role" />
            <Hidden name="id" value={id} />
            <Hidden
              name="value"
              value={row.role === "admin" ? "false" : "true"}
            />
            <Reason />
          </ActionForm>
        </details>
      )}
      {table === "disputes" && row.status === "open" && (
        <details>
          <summary>ตัดสินข้อพิพาท</summary>
          <ActionForm
            action={mutationAction}
            className="stack"
            label="บันทึกผลการตัดสิน"
          >
            <Hidden name="operation" value="admin" />
            <Hidden name="admin_action" value="resolve_dispute" />
            <Hidden name="id" value={id} />
            <label>
              ผลการตัดสิน
              <select name="value">
                <option value="resume">ดำเนินการเช่าต่อ</option>
                <option value="cancel">ยกเลิกและคืนเงินจำลอง</option>
              </select>
            </label>
            <label>
              รายละเอียด
              <textarea
                name="detail"
                required
                minLength={5}
                maxLength={2000}
                rows={3}
              />
            </label>
          </ActionForm>
        </details>
      )}
      {definition.remove && (
        <details>
          <summary>{definition.remove}</summary>
          <ActionForm
            action={adminDataAction}
            className="stack"
            label={definition.remove}
            buttonClass="btn secondary"
            confirm={`ยืนยัน${definition.remove}?`}
          >
            <Hidden name="operation" value="remove" />
            <Hidden name="table" value={table} />
            <Hidden name="id" value={id} />
            <Reason />
          </ActionForm>
        </details>
      )}
    </section>
  );
}
export const metadata = { title: "Admin · จัดการระบบ" };
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    page?: string;
    bucket?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams,
    tab =
      params.tab === "files"
        ? "files"
        : Object.hasOwn(adminTables, params.tab || "")
          ? params.tab!
          : "profiles",
    q = (params.q || "").slice(0, 200),
    page = Math.max(
      1,
      Math.min(1000000, Number.parseInt(params.page || "1", 10) || 1),
    ),
    bucket =
      params.bucket === "item-images" ? "item-images" : "handover-evidence",
    db = await supabase();
  const [summary, result] = await Promise.all([
    db.rpc("cu_admin_summary"),
    tab === "files"
      ? db.rpc("cu_admin_files", {
          p_bucket: bucket,
          p_search: q,
          p_page: page,
          p_size: 20,
        })
      : db.rpc("cu_admin_rows", {
          p_table: tab,
          p_search: q,
          p_page: page,
          p_size: 20,
        }),
  ]);
  if (summary.error || result.error)
    throw new Error(summary.error?.message || result.error?.message);
  const counts = summary.data as Record<string, number>,
    data = result.data as AdminPage;
  const files =
    tab === "files"
      ? await Promise.all(
          data.rows.map(async (row) => {
            const { data: signed, error } = await db.storage
              .from(bucket)
              .createSignedUrl(String(row.name), 300);
            return { row, url: error ? null : signed?.signedUrl };
          }),
        )
      : [];
  const href = (n: number) =>
    `/admin?${new URLSearchParams({ tab, q, page: String(n), ...(tab === "files" ? { bucket } : {}) })}`;
  return (
    <div className="container page">
      <PageHead
        kicker="ADMINISTRATION"
        title="จัดการ CU-Borrow"
        description="ค้นหา ดู และแก้ไขข้อมูลระบบ พร้อมบันทึกผู้ดำเนินการ เวลา เหตุผล และข้อมูลก่อน–หลัง"
      />
      <div className="stats-grid">
        {[
          ["ผู้ใช้", counts.profiles],
          ["สินค้า", counts.items],
          ["การจอง", counts.bookings],
          ["ข้อพิพาทที่เปิด", counts.open_disputes],
        ].map(([label, count]) => (
          <div className="stat" key={String(label)}>
            <p>{label}</p>
            <strong>{count || 0}</strong>
          </div>
        ))}
      </div>
      <nav className="dashboard-tabs admin-tabs" aria-label="หมวดข้อมูล Admin">
        {Object.entries(adminTables).map(([key, value]) => (
          <Link
            className={key === tab ? "active" : ""}
            key={key}
            href={`/admin?tab=${key}`}
          >
            {value.label} ({counts[key] || 0})
          </Link>
        ))}
        <Link
          href="/admin?tab=files"
          className={tab === "files" ? "active" : ""}
        >
          ไฟล์และหลักฐาน
        </Link>
      </nav>
      <form method="get" className="admin-search">
        <Hidden name="tab" value={tab} />
        <label>
          ค้นหาข้อมูล
          <input
            name="q"
            defaultValue={q}
            maxLength={200}
            placeholder="ชื่อ อีเมล UUID หรือข้อความ"
          />
        </label>
        {tab === "files" && (
          <label>
            ประเภทไฟล์
            <select name="bucket" defaultValue={bucket}>
              <option value="handover-evidence">หลักฐานรับ–คืน</option>
              <option value="item-images">ภาพสินค้า</option>
            </select>
          </label>
        )}
        <button className="btn secondary" type="submit">
          ค้นหา
        </button>
      </form>
      <p className="muted small-text">
        พบ {data.total} รายการ · หน้า {page} /{" "}
        {Math.max(1, Math.ceil(data.total / 20))}
      </p>
      {tab !== "files" && adminTables[tab].create && (
        <details className="panel">
          <summary>เพิ่ม{adminTables[tab].label}</summary>
          <Editor table={tab} row={adminTables[tab].create!} create />
        </details>
      )}
      <div className="stack-panels">
        {tab === "files"
          ? files.map(({ row, url }) => (
              <section className="panel" key={String(row.id)}>
                <p className="admin-id">{String(row.name)}</p>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="arrow-link"
                  >
                    เปิดไฟล์ (ลิงก์หมดอายุใน 5 นาที) ↗
                  </a>
                ) : (
                  <p className="feedback error">
                    สร้างลิงก์ไม่ได้ กรุณาลองใหม่
                  </p>
                )}
              </section>
            ))
          : data.rows.map((row) => (
              <Record
                key={String(row.id || row.user_id)}
                table={tab}
                row={row}
              />
            ))}
      </div>
      {!data.rows.length && (
        <Empty title="ไม่พบข้อมูล" text="ลองเปลี่ยนคำค้นหรือเลือกหมวดอื่น" />
      )}
      <nav className="admin-pagination" aria-label="เปลี่ยนหน้าข้อมูล">
        {page > 1 && (
          <Link className="btn secondary" href={href(page - 1)}>
            ← ก่อนหน้า
          </Link>
        )}
        {page * 20 < data.total && (
          <Link className="btn secondary" href={href(page + 1)}>
            ถัดไป →
          </Link>
        )}
      </nav>
    </div>
  );
}
