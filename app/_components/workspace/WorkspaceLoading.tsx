export function WorkspaceLoading() {
  return (
    <main
      className="app-shell loading-shell"
      aria-busy="true"
      aria-label="Đang tải workspace"
    >
      <aside className="loading-sidebar" aria-hidden="true">
        <div className="loading-brand">
          <span />
          <i />
        </div>
        <div className="loading-nav">
          <i />
          <i />
          <i />
          <i />
        </div>
      </aside>
      <section className="loading-main" aria-hidden="true">
        <header className="loading-topbar">
          <i />
          <i />
        </header>
        <div className="loading-content">
          <div className="loading-title">
            <i />
            <i />
          </div>
          <div className="loading-stats">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="loading-panels">
            <i />
            <i />
          </div>
          <span>Đang tải workspace…</span>
        </div>
      </section>
    </main>
  );
}
