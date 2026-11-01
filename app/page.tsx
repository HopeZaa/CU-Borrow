import Link from "next/link";
import { catalog } from "@/lib/data";
import { configured } from "@/lib/supabase/server";
import { categories } from "@/lib/domain";
import { HeroArt } from "@/components/hero-art";
import { ItemGrid, SetupNotice } from "@/components/ui";
import {
  categoryIcons,
  Search,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  CalendarDays,
  Repeat2,
} from "@/components/icon";
export default async function Home() {
  let items = await catalog();
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span /> A LITTLE SHARING, A LOT OF POSSIBILITIES
            </div>
            <h1>
              ของที่ใช่
              <br />
              ไม่จำเป็นต้อง<span>ซื้อ.</span>
            </h1>
            <p>
              กล้องสำหรับทริปหน้า เครื่องคิดเลขสำหรับสอบ
              <br />
              หรือของที่ใช้แค่บางครั้ง — ลองยืมจากเพื่อนจุฬาฯ ดูสิ
            </p>
            <form action="/marketplace" className="hero-search">
              <Search size={21} />
              <input
                name="q"
                aria-label="ค้นหาสินค้า"
                placeholder="กำลังมองหาอะไรอยู่?"
              />
              <button type="submit" aria-label="ค้นหา">
                <ArrowRight size={21} />
              </button>
            </form>
            <div className="hero-suggestions">
              <span>ลองค้นหา</span>
              {["กล้อง", "เครื่องคิดเลข", "หนังสือ"].map((q) => (
                <Link key={q} href={`/marketplace?q=${encodeURIComponent(q)}`}>
                  {q} ↗
                </Link>
              ))}
            </div>
            <div className="hero-note">
              <span className="note-line" />
              <p>
                ใช้คุ้มขึ้น ซื้อให้น้อยลง
                <br />
                <b>เริ่มต้นจากการแบ่งปันเล็ก ๆ ของเรา</b>
              </p>
            </div>
          </div>
          <HeroArt />
        </div>
      </section>
      <div className="trust-strip">
        <div className="container">
          {[
            [
              ShieldCheck,
              "โปร่งใสทุกขั้นตอน",
              "รายละเอียดและประวัติการเช่าที่ตรวจสอบได้",
            ],
            [
              CalendarDays,
              "เลือกวันที่ แล้วไปใช้ชีวิต",
              "จองล่วงหน้า รับ–คืนตามนัดหมาย",
            ],
            [
              Repeat2,
              "แบ่งปันอย่างสบายใจ",
              "ยืนยันส่งมอบและบันทึกสภาพทั้งสองฝ่าย",
            ],
          ].map(([Icon, title, text]) => (
            <div key={String(title)}>
              {typeof Icon !== "string" && <Icon size={25} strokeWidth={1.5} />}
              <span>
                <b>{String(title)}</b>
                <small>{String(text)}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FIND YOUR EVERYDAY EXTRA</p>
            <h2>วันนี้ คุณต้องการอะไร?</h2>
          </div>
          <Link href="/marketplace" className="arrow-link">
            ดูทั้งหมด <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="categories">
          {Object.entries(categories).map(([key, label], index) => {
            const Icon = categoryIcons[key as keyof typeof categoryIcons];
            return (
              <Link href={`/marketplace?category=${key}`} key={key}>
                <span className="category-number">0{index + 1}</span>
                <Icon size={31} strokeWidth={1.25} />
                <span>{label}</span>
                <ArrowUpRight size={15} />
              </Link>
            );
          })}
        </div>
      </section>
      <section className="container section items-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GOOD FINDS, RIGHT AROUND YOU</p>
            <h2>น่าใช้ น่าลอง น่ายืม</h2>
            <p>ของดีจากเพื่อนในแคมปัส สำหรับแพลนถัดไปของคุณ</p>
          </div>
          <Link className="arrow-link" href="/marketplace">
            สำรวจสินค้า <ArrowUpRight size={18} />
          </Link>
        </div>
        {!configured() && <SetupNotice />}
        <ItemGrid
          items={[...items]
            .sort(
              (a, b) =>
                Number(b.stats?.rating || 0) - Number(a.stats?.rating || 0),
            )
            .slice(0, 4)}
        />
      </section>
      <section className="share-banner container">
        <div>
          <p className="eyebrow">YOUR UNUSED. SOMEONE’S NEXT.</p>
          <h2>
            วางไว้เฉย ๆ<br />
            หรือส่งต่อให้เกิดเรื่องราวใหม่?
          </h2>
          <p>
            เปลี่ยนของที่ไม่ได้ใช้ ให้มีประโยชน์อีกครั้ง
            <br />
            ลงประกาศ กำหนดราคา แล้วเริ่มแบ่งปันได้เลย
          </p>
          <Link className="btn" href="/dashboard/items/new">
            ลงประกาศชิ้นแรก <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="banner-graphic" aria-hidden="true">
          <Repeat2 size={165} strokeWidth={0.8} />
          <span>
            GOOD THINGS
            <br />
            GO AROUND.
          </span>
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FRESH ON THE SHELF</p>
            <h2>เพิ่งเข้ามาในคอมมูนิตี้</h2>
          </div>
          <Link className="arrow-link" href="/marketplace?sort=newest">
            ดูสินค้าใหม่ <ArrowUpRight size={18} />
          </Link>
        </div>
        <ItemGrid items={items.slice(0, 4)} />
      </section>
      <section id="how-it-works" className="how-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LESS COMPLICATED. MORE CONNECTED.</p>
              <h2>จากของที่หา สู่ของที่ได้ใช้</h2>
            </div>
            <Link className="arrow-link" href="/guide">
              อ่านคู่มือการเช่า <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="steps">
            {[
              [
                "01",
                "ค้นหาของที่ใช่",
                "เลือกสินค้า เช็กวันว่าง และอ่านรายละเอียดก่อนส่งคำขอ",
              ],
              [
                "02",
                "จองและนัดรับ",
                "รอเจ้าของยืนยัน ตรวจสอบค่าเช่าและเงินประกันให้ครบ",
              ],
              [
                "03",
                "ใช้ให้คุ้ม ส่งคืนด้วยใจ",
                "บันทึกสภาพ ยืนยันรับ–คืนทั้งสองฝ่าย แล้วแบ่งปันรีวิว",
              ],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
