import SidebarNav from './SidebarNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>

      {/* TOPBAR */}
      <header style={{
        height: 56,
        background: '#1a2530',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <a href="/dashboard" style={{
          fontSize: 20,
          fontWeight: 600,
          color: '#ffffff',
          textDecoration: 'none',
          letterSpacing: '-0.5px',
          marginRight: 'auto',
        }}>
          Feed<span style={{ color: '#4CAF7D' }}>Flow</span>
        </a>

        <a href="/dashboard/alerts" style={{
          position: 'relative',
          width: 34,
          height: 34,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.07)',
          border: '0.5px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          textDecoration: 'none',
          marginRight: 12,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{
            position: 'absolute',
            top: 7, right: 7,
            width: 7, height: 7,
            borderRadius: '50%',
            background: '#ef4444',
            border: '1.5px solid #1a2530',
          }} />
        </a>

        <div style={{
          width: 34, height: 34,
          borderRadius: '50%',
          background: '#2D3E50',
          border: '0.5px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.75)',
        }}>
          CD
        </div>
      </header>

      {/* BODY */}
      <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 56px)' }}>

        {/* SIDEBAR — client component for active state */}
        <SidebarNav />

        {/* MAIN CONTENT */}
        <main style={{
          flex: 1,
          background: '#f7f9f8',
          padding: '28px 32px',
          overflowY: 'auto',
          minHeight: 0,
        }}>
          {children}
        </main>

      </div>
    </div>
  )
}
