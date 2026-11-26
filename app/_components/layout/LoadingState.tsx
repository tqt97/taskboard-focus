export function LoadingState() {
  return (
    <main className="app-shell loading-shell loading-card-shell" aria-busy="true">
      <div className="loading-card">
        <div className="loading-mark" aria-hidden="true" />
        <span>Đang tải workspace…</span>
      </div>
    </main>
  );
}
