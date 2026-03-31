'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    section: 'Monitor',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
      { href: '/dashboard/alerts', label: 'Alerts', icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', badge: true },
      { href: '/dashboard/analytics', label: 'Analytics', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
      { href: '/dashboard/map', label: 'Map view', icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6' },
    ],
  },
  {
    section: 'Manage',
    items: [
      { href: '/dashboard/forecast', label: 'Forecast', icon: 'M23 6l-9.5 9.5-5-5L1 18' },
      { href: '/dashboard/costs', label: 'Feed costs', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
      { href: '/dashboard/animals', label: 'Animals', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
      { href: '/dashboard/sensors', label: 'Sensors', icon: 'M12 20h.01M2 8.82a15 15 0 0 1 20 0M6 12.7a9 9 0 0 1 12 0M9.5 16.5a5 5 0 0 1 5 0' },
    ],
  },
]

export default function SidebarNav() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href)

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        flexShrink: 0,
        background: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
        overflowY: 'auto',
        minHeight: 'calc(100vh - 56px)',
      }}
    >
      {NAV.map(group => (
        <div key={group.section} style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0 20px',
              marginBottom: 6,
            }}
          >
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
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? '#166534' : '#374151',
                  background: active ? '#f0fdf4' : 'transparent',
                  borderRight: active ? '2px solid #4CAF7D' : '2px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    flexShrink: 0,
                    opacity: active ? 1 : 0.85,
                  }}
                >
                  <path d={item.icon} />
                </svg>

                <span style={{ flex: 1 }}>{item.label}</span>

                {item.badge && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 999,
                      lineHeight: 1.2,
                    }}
                  >
                    •
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      <div
        style={{
          margin: '0 12px 12px',
          padding: '10px 12px',
          background: '#f9fafb',
          border: '0.5px solid #e5e7eb',
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
          Current farm
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#111827',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          Granja El Roble
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>
    </aside>
  )
}
