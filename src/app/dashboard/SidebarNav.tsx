'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useFarm } from './FarmContext'

const navItems = [
  { section: 'Monitor' },
  { href: '/dashboard',             label: 'Dashboard',   icon: 'grid' },
  { href: '/dashboard/alerts',      label: 'Alerts',      icon: 'bell',     badge: 5 },
  { href: '/dashboard/analytics',   label: 'Analytics',   icon: 'activity' },
  { href: '/dashboard/insights',    label: 'AI Insights', icon: 'ai' },
  { href: '/dashboard/map',         label: 'Map view',    icon: 'map' },
  { section: 'Manage' },
  { href: '/dashboard/forecast',    label: 'Forecast',    icon: 'trending' },
  { href: '/dashboard/costs',       label: 'Feed costs',  icon: 'dollar' },
  { href: '/dashboard/animals',     label: 'Animals',     icon: 'users' },
  { href: '/dashboard/sensors',     label: 'Sensors',     icon: 'wifi' },
]

const icons: Record<string, string> = {
  grid:     'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  bell:     'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  ai:       'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4l3 3',
  map:      'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  trending: 'M23 6l-9.5 9.5-5-5L1 18',
  dollar:   'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  users:    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  wifi:     'M12 20h.01M2 8.82a15 15 0 0 1 20 0M6 12.7a9 9 0 0 1 12 0M9.5 16.5a5 5 0 0 1 5 0',
}

export default function SidebarNav() {
  const path = usePathname()
  const { farms, currentFarm, setCurrentFarm, loading } = useFarm()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <aside style={{
      width: 220, minWidth: 220,
      background: '#ffffff',
      borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      padding: '16px 0 12px',
      overflowY: 'auto', flexShrink: 0,
      minHeight: 'calc(100vh - 56px)',
    }}>

      {/* NAV LINKS */}
      <div style={{ flex: 1 }}>
        {navItems.map((item, i) => {
          if ('section' in item) {
            return (
              <p key={i} style={{
                fontSize: 10, fontWeight: 700, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                padding: '8px 18px 4px', margin: 0,
              }}>
                {item.section}
              </p>
            )
          }

          const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href))
          const isAI   = item.icon === 'ai'

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 18px', margin: '1px 8px', borderRadius: 6,
                fontSize: 13, fontWeight: active ? 600 : 400,
                color:      active ? '#166534' : '#374151',
                background: active ? '#dcfce7' : 'transparent',
                textDecoration: 'none', transition: 'background 0.1s',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke={isAI && !active ? '#4CAF7D' : 'currentColor'}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}>
                <path d={icons[item.icon]} />
              </svg>

              <span style={{ flex: 1 }}>{item.label}</span>

              {isAI && !active && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 6px',
                  borderRadius: 10, background: 'rgba(76,175,125,0.12)',
                  color: '#4CAF7D', border: '0.5px solid rgba(76,175,125,0.3)',
                }}>
                  AI
                </span>
              )}

              {item.badge && !isAI && (
                <span style={{
                  background: '#ef4444', color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 10,
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* FARM SELECTOR */}
      <div style={{ margin: '0 10px', position: 'relative' }}>

        {/* Trigger button */}
        <button
          onClick={() => setDropdownOpen(prev => !prev)}
          style={{
            width: '100%', padding: '10px 12px',
            background: '#f9fafb',
            border: `1px solid ${dropdownOpen ? '#4CAF7D' : '#e5e7eb'}`,
            borderRadius: 8, cursor: 'pointer', textAlign: 'left',
            transition: 'border-color 0.15s',
          }}
        >
          <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current farm
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {loading ? 'Loading...' : currentFarm?.name ?? 'Select farm'}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"
              style={{ flexShrink: 0, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
          {currentFarm?.location && (
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentFarm.location}
            </p>
          )}
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <>
            {/* Backdrop to close */}
            <div
              onClick={() => setDropdownOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            />
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: 0, right: 0,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              boxShadow: '0 -8px 24px rgba(0,0,0,0.10)',
              overflow: 'hidden',
              zIndex: 100,
            }}>
              <div style={{ padding: '8px 12px 6px', borderBottom: '0.5px solid #f0f4f0' }}>
                <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                  Switch farm
                </span>
              </div>

              {loading ? (
                <div style={{ padding: '12px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  Loading farms...
                </div>
              ) : farms.length === 0 ? (
                <div style={{ padding: '12px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  No farms found
                </div>
              ) : (
                farms.map(farm => {
                  const selected = farm.id === currentFarm?.id
                  return (
                    <button
                      key={farm.id}
                      onClick={() => {
                        setDropdownOpen(false)
                        if (!selected) setCurrentFarm(farm)
                      }}
                      style={{
                        width: '100%', padding: '10px 12px',
                        background: selected ? '#f0fdf4' : '#fff',
                        border: 'none', textAlign: 'left',
                        cursor: selected ? 'default' : 'pointer',
                        borderBottom: '0.5px solid #f7f9f8',
                        transition: 'background 0.1s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: selected ? '#4CAF7D' : '#e5e7eb',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: selected ? '#166534' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {farm.name}
                          </div>
                          {farm.location && (
                            <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                              {farm.location}
                            </div>
                          )}
                        </div>
                        {selected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
