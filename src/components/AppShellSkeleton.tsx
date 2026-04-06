function AppShellSkeleton() {
  return (
    <div className="app-shell" data-testid="app-shell-skeleton" aria-busy="true" aria-live="polite">
      <header className="navbar navbar-dark bg-primary sticky-top shadow-sm px-3 py-2 appbar-root">
        <div className="d-flex align-items-center gap-2 w-100 justify-content-between">
          <span className="placeholder col-4 col-md-3 bg-light" style={{ height: '32px' }} />
          <span className="placeholder col-2 col-md-1 bg-light" style={{ height: '32px' }} />
        </div>
      </header>

      <div className="app-shell-body">
        <aside className="sidebar-menu expanded bg-light border-end p-3">
          <div className="placeholder-glow d-flex flex-column gap-3">
            <span className="placeholder col-11" style={{ height: '20px' }} />
            <span className="placeholder col-9" style={{ height: '20px' }} />
            <span className="placeholder col-10" style={{ height: '20px' }} />
          </div>
        </aside>

        <main className="app-shell-content p-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4 p-md-5 placeholder-glow">
              <span className="placeholder col-3 mb-3" style={{ height: '20px' }} />
              <span className="placeholder col-8 mb-3" style={{ height: '36px' }} />
              <span className="placeholder col-10 mb-2" style={{ height: '18px' }} />
              <span className="placeholder col-7" style={{ height: '18px' }} />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppShellSkeleton
