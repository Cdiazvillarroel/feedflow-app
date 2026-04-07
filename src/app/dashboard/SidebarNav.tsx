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
                  font
