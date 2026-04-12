import { FarmProvider } from './FarmContext'
import SidebarNav from './SidebarNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FarmProvider>
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>
        <SidebarNav />
        <main style={{
          flex: 1, background: '#F4F7F5',
          padding: '28px 32px', overflowY: 'auto',
          minHeight: '100vh',
        }}>
          {children}
        </main>
      </div>
    </FarmProvider>
  )
}
