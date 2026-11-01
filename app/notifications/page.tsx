import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { dateLabel } from "@/lib/domain";
import { PageHead, Empty } from "@/components/ui";
import { ActionForm, Hidden } from "@/components/action-form";
import { mutationAction } from "@/app/actions";
export default async function Notifications() {
  const user = await requireUser();
  const { data, error } = await (
    await supabase()
  )
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (
    <div className="container page">
      <PageHead kicker="KEEP IN THE LOOP" title="การแจ้งเตือน">
        <ActionForm
          action={mutationAction}
          label="อ่านทั้งหมดแล้ว"
          buttonClass="btn secondary"
        >
          <Hidden name="operation" value="read" />
        </ActionForm>
      </PageHead>
      {data?.length ? (
        <div className="list-rows">
          {data.map((n) => (
            <article
              key={n.id}
              className={`list-row notification ${n.read_at ? "" : "unread"}`}
            >
              <div>
                <h3>{n.message}</h3>
                <p>{dateLabel(n.created_at)}</p>
              </div>
              {n.booking_id && (
                <Link
                  className="btn secondary"
                  href={`/bookings/${n.booking_id}`}
                >
                  ดูรายการ →
                </Link>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="ยังไม่มีการแจ้งเตือน"
          text="อัปเดตคำขอและการเช่าจะแสดงที่นี่"
        />
      )}
    </div>
  );
}
