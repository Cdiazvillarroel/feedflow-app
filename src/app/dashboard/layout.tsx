import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="db">
      <Topbar />
      <div className="main">
        <Sidebar />
        <div className="content">{children}</div>
      </div>
    </div>
  )
}
