function AppShellSkeleton() {
  return (
    <div
      className="p-4"
      data-testid="app-shell-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4 p-md-5 placeholder-glow">
          <span className="placeholder col-3 mb-3" style={{ height: '20px' }} />
          <span className="placeholder col-8 mb-3" style={{ height: '36px' }} />
          <span className="placeholder col-10 mb-2" style={{ height: '18px' }} />
          <span className="placeholder col-7" style={{ height: '18px' }} />
        </div>
      </div>
    </div>
  )
}

export default AppShellSkeleton
