'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  {
    section: 'Monitor',
    items: [
      { href: '/dashboard',           label: 'Dashboard',  icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
      { href: '/dashboard/alerts',    label: 'Alerts',     icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', badge: true },
      { href: '/dashboard/analytics', label: 'Analytics',  icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
      { href: '/dashboard/map',       label: 'Map view',   icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6' },
    ],
  },
  {
    section: 'Manage',
    items: [
      { href: '/dashboard/forecast',  label: 'Forecast',   icon: 'M23 6l-9.5 9.5-5-5L1 18' },
      { href: '/dashboard/costs',     label: 'Feed costs', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
      { href: '/dashboard/animals',   label: 'Animals',    icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
      { href: '/dashboard/sensors',   label: 'Sensors',    icon: 'M12 20h.01M2 8.82a15 15 0 0 1 20 0M6 12.7a9 9 0 0 1 12 0M9.5 16.5a5 5 0 0 1 5 0' },
    ],
  },
]

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      width="16" height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  )
}

function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href)

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      background: '#ffffff',
      borderRight: '0.5px solid #e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      overflowY: 'auto',
    }}>

      {/* LOGO */}
      <div style={{ padding: '0 20px 24px' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: '#111827', letterSpacing: '-0.5px' }}>
            Feed<span style={{ color: '#4CAF7D' }}>Flow</span>
          </span>
        </Link>
      </div>

      {/* NAV SECTIONS */}
      {NAV.map(group => (
        <div key={group.section} style={{ marginBottom: 8 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0 20px',
            marginBottom: 4,
          }}>
            {group.section}
          </div>

          {group.items.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? '#166534' : '#374151',
                  background: active ? '#f0fdf4' : 'transparent',
                  borderRight: active ? '2px solid #4CAF7D' : '2px solid transparent',
                  textDecoration: 'none',
                  transition: 'background 0.15s, color 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = '#f9fafb'
                    ;(e.currentTarget as HTMLElement).style.color = '#111827'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = '#374151'
                  }
                }}
              >
                <NavIcon d={item.icon} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 10,
                    lineHeight: '16px',
                  }}>
                    •
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}

      {/* BOTTOM SPACER */}
      <div style={{ flex: 1 }} />

      {/* FARM SELECTOR */}
      <div style={{
        margin: '0 12px 12px',
        padding: '10px 12px',
        background: '#f9fafb',
        border: '0.5px solid #e5e7eb',
        borderRadius: 8,
        cursor: 'pointer',
      }}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Current farm</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Granja El Roble
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
    </aside>
  )
}

function Topbar() {
  return (
    <header style={{
      height: 56,
      background: '#1a2530',
      display: 'flex',
      alignItems: 'center',
      padding: '0 28px',
      gap: 16,
      flexShrink: 0,
    }}>
      <div style={{ flex: 1 }} />

      {/* ALERTS BELL */}
      <Link href="/dashboard/alerts" style={{
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
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span style={{
          position: 'absolute',
          top: 7,
          right: 7,
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#ef4444',
          border: '1.5px solid #1a2530',
        }} />
      </Link>

      {/* AVATAR */}
      <div style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: '#2D3E50',
        border: '0.5px solid rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.75)',
        cursor: 'pointer',
        flexShrink: 0,
      }}>
        CD
      </div>
    </header>
  )
}

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
      <Topbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
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
