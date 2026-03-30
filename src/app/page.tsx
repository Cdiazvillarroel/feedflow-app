import { getSilosWithReadings, getFarmSummary } from '@/lib/queries'
import Link from 'next/link'

export const revalidate = 120 // revalidate every 2 hours (matches sensor interval)

export default async function DashboardPage() {
  // Fetch real data from Supabase
  const [silos, summary] = await Promise.all([
    getSilosWithReadings(),
    getFarmSummary(),
  ])

  const levelColor = (pct: number) =>
    pct <= 20 ? '#E24B4A' : pct <= 40 ? '#EF9F27' : '#4CAF7D'

  const borderColor = (alert: string) =>
    alert === 'critical' ? '#E24B4A' : alert === 'low' ? '#EF9F27' : '#4CAF7D'

  const totalKg = silos.reduce((s, x) => s + x.kg_remaining, 0)
  const critical = silos.filter(s => s.alert_level === 'critical').length
  const low = silos.filter(s => s.alert_level === 'low').length

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Silo Dashboard</div>
          <div className="page-sub">
            {summary?.farm_name || 'Granja Engorde'} · {silos.length} sensors · Live data from Supabase
          </div>
        </div>
        <div className="page-actions">
          <button className="btn-outline">Export CSV</button>
          <Link href="/dashboard/alerts" className="btn-primary" style={{ display: 'inline-block', lineHeight: '1' }}>
            + New alarm
          </Link>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="summary-row">
        <div className="sum-card">
          <div className="sum-label">Total silos</div>
          <div className="sum-val">{silos.length}</div>
          <div className="sum-sub">Active & transmitting</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Critical (≤ 20%)</div>
          <div className="sum-val red">{critical}</div>
          <div className="sum-sub">Action required</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Low (21–40%)</div>
          <div className="sum-val" style={{ color: '#633806' }}>{low}</div>
          <div className="sum-sub">Order soon</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Total available</div>
          <div className="sum-val green">{(totalKg / 1000).toFixed(1)} t</div>
          <div className="sum-sub">Across all silos</div>
        </div>
      </div>

      {/* EMPTY STATE */}
      {silos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#1a2530', marginBottom: 8 }}>
            No sensor readings yet
          </div>
          <div style={{ fontSize: 13 }}>
            Waiting for first data from DigitPlan API via PipeDream.
          </div>
        </div>
      )}

      {/* SILO LIST */}
      {silos.length > 0 && (
        <>
          {/* COLUMN HEADERS */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 120px 130px 110px 100px', gap: 16, padding: '0 20px 8px', marginBottom: 2 }}>
            {['Silo / Material', 'Level', 'Days left', 'Sensor', 'Last reading', ''].map(h => (
              <div key={h} style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 500 }}>{h}</div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {silos.map(s => (
              <Link
                key={s.id}
                href={`/dashboard/silo/${s.id}`}
                style={{
                  background: '#fff',
                  borderRadius: 10,
                  padding: '16px 20px',
                  display: 'grid',
                  gridTemplateColumns: '200px 1fr 120px 130px 110px 100px',
                  gap: 16,
                  alignItems: 'center',
                  textDecoration: 'none',
                  border: '0.5px solid #e8ede9',
                  borderLeft: `3px solid ${borderColor(s.alert_level)}`,
                }}
              >
                {/* NAME */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2530' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#8a9aaa' }}>{s.material}</div>
                </div>

                {/* LEVEL BAR */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: '#1a2530' }}>{s.level_pct.toFixed(1)}%</span>
                    <span style={{ fontSize: 11, color: '#8a9aaa' }}>{Math.round(s.kg_remaining).toLocaleString()} kg</span>
                  </div>
                  <div style={{ height: 6, background: '#f7f9f8', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: levelColor(s.level_pct), width: `${s.level_pct}%` }} />
                  </div>
                </div>

                {/* DAYS LEFT */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 500, color: s.days_remaining <= 7 ? '#A32D2D' : s.days_remaining <= 14 ? '#633806' : '#27500A' }}>
                    {s.days_remaining}
                  </div>
                  <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.3px' }}>days left</div>
                </div>

                {/* SENSOR STATUS */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.sensor?.status === 'online' ? '#4CAF7D' : s.sensor?.status === 'delayed' ? '#EF9F27' : '#E24B4A' }} />
                  <div style={{ fontSize: 11, color: '#8a9aaa' }}>
                    {s.sensor?.status === 'online' ? 'Online' : s.sensor?.status === 'delayed' ? 'Delayed' : s.sensor ? 'Offline' : 'No sensor'}
                  </div>
                </div>

                {/* LAST READING */}
                <div style={{ fontSize: 11, color: '#aab8c0', textAlign: 'right' }}>
                  {s.hours_since_reading < 1
                    ? 'Just now'
                    : s.hours_since_reading < 24
                    ? `${Math.round(s.hours_since_reading)}h ago`
                    : `${Math.round(s.hours_since_reading / 24)}d ago`}
                </div>

                {/* VIEW LINK */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, color: '#4CAF7D', fontWeight: 500 }}>View →</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
