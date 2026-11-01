import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Repeat2, ArrowUpRight } from "@/components/icon";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "CU-Borrow — ของที่ใช่ ไม่จำเป็นต้องซื้อ",
    template: "%s | CU-Borrow",
  },
  description:
    "พื้นที่เช่าและแบ่งปันสิ่งของของนิสิตจุฬาฯ ใช้คุ้มขึ้น ซื้อให้น้อยลง เชื่อมต่อกันมากขึ้น",
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          ข้ามไปเนื้อหา
        </a>
        <Header />
        <main id="main">{children}</main>
        <footer className="footer">
          <div className="container footer-main">
            <div>
              <Link className="brand" href="/">
                <span className="brand-icon">
                  <Repeat2 size={21} />
                </span>
                CU<span>Borrow</span>
              </Link>
              <p>
                สิ่งของหมุนเวียน ความสัมพันธ์เติบโต
                <br />
                พื้นที่แบ่งปันของชาวจุฬาฯ
              </p>
            </div>
            <div>
              <span className="eyebrow">MAKE ROOM FOR MORE.</span>
              <Link href="/marketplace">
                ค้นหาของที่คุณต้องการ <ArrowUpRight size={18} />
              </Link>
              <Link href="/dashboard/items/new">
                แบ่งปันของที่คุณมี <ArrowUpRight size={18} />
              </Link>
            </div>
            <div>
              <Link href="/guide">คู่มือและข้อตกลงการเช่า</Link>
              <Link href="/privacy">ความเป็นส่วนตัว</Link>
              <p>
                โครงการอิสระสำหรับชุมชนนิสิต
                <br />
                ไม่ได้เป็นบริการทางการของมหาวิทยาลัย
              </p>
            </div>
          </div>
          <div className="container footer-bottom">
            <span>© {new Date().getFullYear()} CU-Borrow</span>
            <span>MADE FOR CAMPUS. BUILT FOR SHARING.</span>
            <span>Bangkok, Thailand</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
