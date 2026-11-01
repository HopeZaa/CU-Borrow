import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
export default function Forgot() {
  return (
    <AuthShell
      title="ลืมรหัสผ่าน?"
      subtitle="เราจะส่งลิงก์ให้คุณเริ่มต้นใหม่ทางอีเมล"
    >
      <AuthForm mode="forgot" />
    </AuthShell>
  );
}
