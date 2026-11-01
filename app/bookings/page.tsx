import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import type { Booking } from "@/lib/domain";
import { PageHead } from "@/components/ui";
import { BookingList } from "@/components/booking-list";
export const metadata = { title: "การเช่าของฉัน" };
export default async function Bookings({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { data, error } = await (
    await supabase()
  )
    .from("bookings")
    .select("*,items(*),payments(*)")
    .eq("renter_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const tab = (await searchParams).tab || "all",
    rows = (data || []) as Booking[];
  const filtered = rows.filter((b) =>
    tab === "all"
      ? true
      : tab === "pending"
        ? b.status === "pending"
        : tab === "history"
          ? ["completed", "cancelled"].includes(b.status)
          : tab === "handover"
            ? ["paid", "picked_up", "returned"].includes(b.status)
            : !["pending", "completed", "cancelled"].includes(b.status),
  );
  return (
    <div className="container page">
      <PageHead
        kicker="YOUR NEXT LITTLE ADVENTURE"
        title="การเช่าของฉัน"
        description="ติดตามตั้งแต่คำขอแรก จนถึงวันส่งคืน"
      />
      <nav className="dashboard-tabs" aria-label="กรองรายการเช่า">
        {[
          ["all", "ทั้งหมด"],
          ["pending", "รอยืนยัน"],
          ["active", "กำลังดำเนินการ"],
          ["handover", "ต้องรับ–คืน"],
          ["history", "ประวัติ"],
        ].map(([v, l]) => (
          <Link
            key={v}
            className={tab === v ? "active" : ""}
            href={`/bookings?tab=${v}`}
          >
            {l}
          </Link>
        ))}
      </nav>
      <BookingList bookings={filtered} />
    </div>
  );
}
