'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/admin',              label: 'Overview',   icon: '◈' },
  { href: '/admin/clients',      label: 'Clients',    icon: '🏢' },
  { href: '/admin/plans',        label: 'Plans',      icon: '📋' },
  { href: '/admin/farms',        label: 'Farms',      icon: '🌾' },
  { href: '/admin/mills',        label: 'Feed Mills', icon: '🏭' },
  { href: '/admin/users',        label: 'Users',      icon: '👥' },
  { href: '/admin/modules',      label: 'Modules',    icon: '🔧' },
  { href: '/admin/invoices',     label: 'Invoices',   icon: '💳' },
  { href: '/admin/database',     label: 'Database',   icon: '🗄️' },
  { href: '/admin/audit',        label: 'Audit Log',  icon: '📋' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()

  if (pathname === '/admin/login') return <>{children}</>

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f0f4f0' }}>
      {/* SIDEBAR */}
      <div style={{ width: 220, background: '#0f1720', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100 }}>
        <div style={{ padding: '24px 20px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
            Feed<span style={{ color: '#4CAF7D' }}>Flow</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Admin Panel</div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#fff' : 'rgba(255,255,255,0.45)', background: active ? 'rgba(76,175,125,0.15)' : 'transparent', textDecoration: 'none', marginBottom: 2, transition: 'all 0.15s' }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
                {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#4CAF7D', marginLeft: 'auto' }} />}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '16px 10px', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#4CAF7D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>A</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Agrometrics</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Super Admin</div>
            </div>
          </div>
          <button onClick={logout} style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ marginLeft: 220, flex: 1, padding: '28px 32px', minHeight: '100vh' }}>
        {children}
      </div>
    </div>
  )
}
