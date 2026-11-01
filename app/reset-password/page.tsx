import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { requireUser } from "@/lib/auth";
export default async function Reset() {
  await requireUser();
  return (
    <AuthShell
      title="ตั้งรหัสผ่านใหม่"
      subtitle="เลือกรหัสผ่านอย่างน้อย 10 ตัวอักษร"
    >
      <AuthForm mode="password" />
    </AuthShell>
  );
}
