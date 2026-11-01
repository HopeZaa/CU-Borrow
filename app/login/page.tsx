import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
export const metadata = { title: "เข้าสู่ระบบ" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const p = await searchParams;
  return (
    <AuthShell
      title="ยินดีต้อนรับกลับ"
      subtitle="เข้าสู่ระบบ แล้วค้นหาสิ่งที่คุณกำลังมองหา"
    >
      {p.error && (
        <p className="feedback error">
          ลิงก์ยืนยันหมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่หรือลองเข้าสู่ระบบ
        </p>
      )}
      <AuthForm mode="login" next={p.next} />
      <p className="auth-switch">
        ยังไม่มีบัญชี? <Link href="/signup">เริ่มต้นแบ่งปัน</Link>
      </p>
    </AuthShell>
  );
}
