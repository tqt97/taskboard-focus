export function ErrorState({ reset }: { reset: () => void }) {
  return (
    <main className="app-shell loading-shell">
      <div className="loading-card error-card" role="alert">
        <strong>Không thể tải workspace</strong>
        <button className="secondary-button" onClick={reset}>
          Thử lại
        </button>
      </div>
    </main>
  );
}
