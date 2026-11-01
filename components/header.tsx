import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { Repeat2, Plus, UserRound, Bell } from "./icon";
import { ActionForm, Hidden } from "./action-form";
import { authAction } from "@/app/actions";
export async function Header() {
  const user = await currentUser();
  let admin = false;
  if (user) {
    const { data } = await (await supabase()).rpc("cu_admin_me");
    admin = data === true;
  }
  return (
    <>
      <div className="topbar">
        <span>ใช้เท่าที่จำเป็น แบ่งปันเท่าที่มี</span>
        <span>THE CAMPUS SHARING COMMUNITY</span>
      </div>
      <header className="header">
        <div className="container nav">
          <Link href="/" className="brand">
            <span className="brand-icon">
              <Repeat2 size={23} />
            </span>
            CU<span>Borrow</span>
            <sup>↗</sup>
          </Link>
          <nav aria-label="เมนูหลัก" className="main-nav">
            <Link href="/marketplace">สำรวจสินค้า</Link>
            <Link href="/#how-it-works">เริ่มใช้งานอย่างไร</Link>
            {user && <Link href="/bookings">การเช่าของฉัน</Link>}
            {admin && <Link href="/admin">Admin</Link>}
          </nav>
          <div className="nav-actions">
            {user ? (
              <>
                <Link
                  className="icon-btn"
                  aria-label="การแจ้งเตือน"
                  href="/notifications"
                >
                  <Bell size={18} />
                </Link>
                <Link className="icon-btn" aria-label="โปรไฟล์" href="/profile">
                  <UserRound size={18} />
                </Link>
                <ActionForm
                  action={authAction}
                  label="ออกจากระบบ"
                  buttonClass="text-btn"
                >
                  <Hidden name="action" value="logout" />
                </ActionForm>
              </>
            ) : (
              <Link className="login-link" href="/login">
                เข้าสู่ระบบ
              </Link>
            )}
            <Link href={user ? "/dashboard" : "/signup"} className="btn small">
              <Plus size={16} />
              {user ? "จัดการร้านของฉัน" : "เริ่มแบ่งปัน"}
            </Link>
          </div>
        </div>
        <nav className="mobile-nav" aria-label="เมนูมือถือ">
          <Link href="/marketplace">สำรวจสินค้า</Link>
          <Link href="/bookings">การเช่าของฉัน</Link>
          <Link href="/dashboard">ร้านของฉัน</Link>
          <Link href="/profile">บัญชี</Link>
        </nav>
      </header>
    </>
  );
}
