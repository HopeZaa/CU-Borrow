import { Repeat2 } from "./icon";
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container auth-shell">
      <div className="auth-story">
        <p className="eyebrow">A COMMUNITY THAT GOES AROUND.</p>
        <h1>
          ยืมของกัน
          <br />
          สร้างเรื่องราว
          <br />
          <i>ไปด้วยกัน.</i>
        </h1>
        <Repeat2 size={130} strokeWidth={0.8} />
        <p>
          ของชิ้นเดียว สร้างความเป็นไปได้อีกมากมาย
          <br />
          เริ่มต้นแบ่งปันในคอมมูนิตี้ของเรา
        </p>
      </div>
      <div className="auth-panel">
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
