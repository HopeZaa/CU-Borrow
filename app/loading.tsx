export default function Loading() {
  return (
    <div className="container page" role="status" aria-label="กำลังโหลด">
      <div className="skeleton" style={{ height: 75, marginBottom: 25 }} />
      <div className="loading-grid">
        {[1, 2, 3, 4].map((n) => (
          <div className="skeleton" key={n} />
        ))}
      </div>
      <span className="sr-only">กำลังโหลดข้อมูล…</span>
    </div>
  );
}
