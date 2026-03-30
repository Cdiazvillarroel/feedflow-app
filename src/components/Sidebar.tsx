'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { section: 'Monitor' },
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/dashboard/alerts', label: 'Alerts', icon: 'bell', badge: 5 },
  { href: '/dashboard/analytics', label: 'Analytics', icon: 'activity' },
  { href: '/dashboard/map', label: 'Map view', icon: 'map' },
  { section: 'Manage' },
  { href: '/dashboard/forecast', label: 'Forecast', icon: 'trending' },
  { href: '/dashboard/costs', label: 'Feed costs', icon: 'dollar' },
  { href: '/dashboard/animals', label: 'Animals', icon: 'users' },
  { href: '/dashboard/sensors', label: 'Sensors', icon: 'wifi' },
]

const icons: Record<string, string> = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  map: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  trending: 'M23 6l-9.5 9.5-5-5L1 18',
  dollar: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  wifi: 'M12 20h.01M2 8.82a15 15 0 0 1 20 0M6 12.7a9 9 0 0 1 12 0M9.5 16.5a5 5 0 0 1 5 0',
}

export default function Sidebar() {
  const path = usePathname()
  return (
    <div className="sidebar">
      {navItems.map((item, i) => {
        if ('section' in item) {
          return <div key={i} className="nav-section">{item.section}</div>
        }
        const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href))
        return (
          <Link key={item.href} href={item.href} className={`nav-item${active ? ' active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 13, color: active ? '#27500A' : '#6a7a8a', background: active ? '#eaf5ee' : 'transparent', borderRight: active ? '2px solid #4CAF7D' : 'none', textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={icons[item.icon]} />
            </svg>
            {item.label}
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </Link>
        )
      })}
    </div>
  )
}
