import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { PageHead } from "@/components/ui";
import { ActionForm, Hidden } from "@/components/action-form";
import { mutationAction } from "@/app/actions";
export default async function Profile() {
  const u = await requireUser();
  const { data: p, error } = await (
    await supabase()
  )
    .from("profiles")
    .select("*")
    .eq("id", u.id)
    .single();
  if (error) throw new Error(error.message);
  return (
    <div className="container page">
      <div className="profile-card">
        <PageHead kicker="A LITTLE ABOUT YOU" title="โปรไฟล์ของฉัน" />
        <div className="panel">
          <div className="avatar">{p.display_name.slice(0, 1)}</div>
          <p className="small-text muted">
            อีเมล: {u.email} ·{" "}
            {u.email_confirmed_at ? "ยืนยันอีเมลแล้ว" : "ยังไม่ได้ยืนยันอีเมล"}
          </p>
          <div className="notice">
            {p.verification_status === "verified"
              ? "สถานะนิสิตได้รับการตรวจสอบแล้ว"
              : "สถานะนิสิตยังไม่ได้รับการตรวจสอบ การยืนยันอีเมลไม่เท่ากับการยืนยันสถานะนิสิต"}
          </div>
          {p.suspended && (
            <div className="feedback error">บัญชีนี้ถูกระงับการทำรายการ</div>
          )}
          <ActionForm
            action={mutationAction}
            className="stack"
            label="บันทึกโปรไฟล์"
          >
            <Hidden name="operation" value="profile" />
            <label>
              ชื่อที่แสดง
              <input
                name="display_name"
                defaultValue={p.display_name}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label>
              คณะ
              <input name="faculty" defaultValue={p.faculty} maxLength={100} />
            </label>
            <label>
              แนะนำตัว
              <textarea
                name="bio"
                defaultValue={p.bio}
                rows={4}
                maxLength={500}
              />
            </label>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
