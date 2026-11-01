import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container page">
      <div className="empty">
        <span className="eyebrow">404 / NOT FOUND</span>
        <h1>ไม่พบหน้านี้</h1>
        <p>รายการอาจถูกนำออก หรือบัญชีของคุณไม่มีสิทธิ์เข้าถึง</p>
        <Link className="btn" href="/marketplace">
          กลับไปสำรวจสินค้า →
        </Link>
      </div>
    </div>
  );
}
