export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <span className="art-label">
        LESS BUYING.
        <br />
        MORE LIVING.
      </span>
      <div className="art-card camera-card">
        <div className="art-card-top">
          <span>FOR YOUR NEXT STORY</span>
          <span>01 /</span>
        </div>
        <svg viewBox="0 0 280 190" fill="none">
          <path
            d="M58 59h41l12-20h57l12 20h41a14 14 0 0 1 14 14v80a15 15 0 0 1-15 15H59a15 15 0 0 1-15-15V73a14 14 0 0 1 14-14Z"
            fill="#343735"
          />
          <path d="M45 86h190v62H45z" fill="#484b47" />
          <circle
            cx="140"
            cy="114"
            r="52"
            fill="#252826"
            stroke="#808078"
            strokeWidth="5"
          />
          <circle
            cx="140"
            cy="114"
            r="39"
            fill="#101d20"
            stroke="#4d5550"
            strokeWidth="8"
          />
          <circle cx="140" cy="114" r="25" fill="#183b40" />
          <ellipse
            cx="132"
            cy="103"
            rx="12"
            ry="8"
            fill="#728e89"
            opacity=".5"
          />
          <rect x="188" y="67" width="26" height="12" rx="3" fill="#d3d0bd" />
          <rect x="65" y="51" width="24" height="8" rx="2" fill="#252826" />
          <path d="M57 105v34" stroke="#5f625a" strokeWidth="4" />
        </svg>
        <div className="art-caption">
          <span>
            เก็บทุกโมเมนต์
            <br />
            <strong>โดยไม่ต้องซื้อใหม่</strong>
          </span>
          <span className="art-circle">↗</span>
        </div>
      </div>
      <div className="art-card book-card">
        <span>PASS IT ON.</span>
        <div className="book-spine" />
        <div className="book-title">
          THINK
          <br />
          OUTSIDE
          <br />
          <i>the book.</i>
        </div>
        <div className="book-footer">
          A LITTLE KNOWLEDGE
          <br />
          GOES A LONG WAY.
        </div>
      </div>
      <div className="art-card calculator-card">
        <span className="calc-brand">STUDY BUDDY</span>
        <div className="calc-screen">
          1 + 1 = <b>more</b>
        </div>
        <div className="calc-keys">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className={i === 19 ? "accent" : ""}>
              {
                [
                  "AC",
                  "±",
                  "%",
                  "÷",
                  "7",
                  "8",
                  "9",
                  "×",
                  "4",
                  "5",
                  "6",
                  "−",
                  "1",
                  "2",
                  "3",
                  "+",
                  "0",
                  ".",
                  "=",
                  "↵",
                ][i]
              }
            </span>
          ))}
        </div>
      </div>
      <div className="sharing-tag">
        <span className="tag-dot" />
        <span>
          ของที่ไม่ได้ใช้
          <br />
          <b>อาจเป็นของที่ใครกำลังหา</b>
        </span>
      </div>
      <div className="art-spark">✳</div>
      <span className="art-coordinate">13.7384° N &nbsp; 100.5329° E</span>
    </div>
  );
}
