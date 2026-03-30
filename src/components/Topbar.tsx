'use client'
import Link from 'next/link'

export default function Topbar() {
  return (
    <div className="topbar">
      <Link href="/dashboard" className="logo-t" style={{ textDecoration: 'none' }}>
        Feed<span>Flow</span>
      </Link>
      <div className="farm-pill">Granja Engorde ▾</div>
      <div className="topbar-right">
        <Link href="/dashboard/alerts" className="alert-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <div className="alert-dot" />
        </Link>
        <div className="avatar">CD</div>
      </div>
    </div>
  )
}
