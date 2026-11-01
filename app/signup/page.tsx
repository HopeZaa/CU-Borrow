import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
export const metadata = { title: "สมัครสมาชิก" };
export default function Signup() {
  return (
    <AuthShell
      title="มาแบ่งปันด้วยกัน"
      subtitle="สร้างบัญชีเพื่อเช่าและแบ่งปันสิ่งของ"
    >
      <AuthForm mode="signup" />
      <p className="auth-switch">
        มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link>
      </p>
      <p className="small-text muted">
        อ่าน <Link href="/guide">ข้อตกลงการเช่า</Link> และ{" "}
        <Link href="/privacy">ความเป็นส่วนตัว</Link> ก่อนเริ่มใช้งาน
      </p>
    </AuthShell>
  );
}
