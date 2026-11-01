"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container page">
      <div className="empty">
        <h1>โหลดข้อมูลไม่สำเร็จ</h1>
        <p>
          กรุณาลองใหม่ หากเพิ่งติดตั้ง ให้ตรวจสอบ Supabase URL, key และ
          migration ตาม README
        </p>
        <button className="btn" onClick={() => reset()}>
          ลองใหม่
        </button>
        <Link href="/">กลับหน้าแรก →</Link>
      </div>
    </div>
  );
}
