'use client'
import Link from 'next/link'
import { SILOS, levelColor } from '@/lib/data'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

export default function SiloPage({ params }: { params: { id: string } }) {
  const { id } = params
  const silo = SILOS.find(s => s.id === parseInt(id, 10)) || SILOS[0]
  const color = levelColor(silo.pct)

  const labels: string[] = []
  const data: number[] = []
  const now = new Date()

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    labels.push(
      d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
    )

    const base =
      i === 0
        ? silo.pct
        : i <= 5
        ? silo.pct + i * 3
        : Math.min(100, silo.pct + i * 2.5 + Math.random() * 8)

    data.push(Math.round(Math.min(100, base)))
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#aab8c0', marginBottom: 16 }}>
        <Link href="/dashboard" style={{ color: '#aab8c0', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
        <span>›</span>
        <span style={{ color: '#1a2530', fontWeight: 500 }}>{silo.name}</span>
      </div>

      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
            <div className="page-title">{silo.name}</div>
          </div>
          <div className="page-sub" style={{ marginLeft: 22 }}>
            {silo.material} · Sensor #{SILOS.indexOf(silo) + 1} · Last reading {silo.reading}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn-outline">Export data</button>
          <Link href="/dashboard/alerts" className="btn-primary" style={{ display: 'inline-block' }}>
            + Add alarm
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div className="card-title">Current level</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 500, color, letterSpacing: -2, margin: '12px 0 4px' }}>
                {silo.pct}%
              </div>
              <div style={{ height: 8, background: '#f7f9f8', borderRadius: 4, overflow: 'hidden', margin: '8px 0 16px' }}>
                <div style={{ height: '100%', borderRadius: 4, background: color, width: `${silo.pct}%` }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { val: silo.kg.toLocaleString(), lbl: 'kg available' },
                  { val: (silo.kg / silo.density).toFixed(1) + ' m³', lbl: 'volume' },
                  { val: silo.capacity.toLocaleString(), lbl: 'kg capacity' },
                  { val: Math.round(((silo.capacity - silo.kg) / silo.density) * 100 / 100) + ' cm', lbl: 'distance' },
                ].map(item => (
                  <div key={item.lbl} style={{ background: '#f7f9f8', borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 500, color: '#1a2530' }}>{item.val}</div>
                    <div style={{ fontSize: 10, color: '#aab8c0', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {item.lbl}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: '#1a2530', borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              AI forecast · <span style={{ background: 'rgba(76,175,125,0.18)', color: '#4CAF7D', fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '0.5px solid rgba(76,175,125,0.3)' }}>PipeDream</span>
            </div>
            <div style={{ fontSize: 44, fontWeight: 500, color: '#fff', letterSpacing: -2, marginBottom: 2 }}>{silo.days}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>days of feed remaining</div>
            {[
              { k: 'Daily consumption', v: `${silo.kgDay} kg/day` },
              { k: 'Suggested order', v: `${Math.round(silo.capacity * 0.85 / 1000) * 1000} kg`, c: '#4CAF7D' },
              { k: 'Feed cost / day', v: `$${Math.round((silo.kgDay / 1000) * silo.priceT)}` },
            ].map(row => (
              <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{row.k}</span>
                <span style={{ fontSize: 12, color: row.c || 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{row.v}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div className="card-title">Sensor status</div>
            </div>
            {[
              { k: 'Connection', v: silo.status === 'ok' ? 'Online' : 'Delayed', color: silo.status === 'ok' ? '#27500A' : '#633806' },
              { k: 'Battery', v: '87%' },
              { k: 'Signal', v: 'Good (−72 dBm)' },
              { k: 'Last sync', v: silo.reading },
              { k: 'Model', v: 'SiloMetric Laser' },
              { k: 'Serial', v: `20${66 + silo.id}DC` },
            ].map(row => (
              <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                <span style={{ fontSize: 12, color: '#8a9aaa' }}>{row.k}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: row.color || '#1a2530', fontFamily: row.k === 'Serial' ? 'monospace' : 'inherit' }}>
                  {row.v}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div className="card-title">Level history — last 30 days</div>
              <Link href={`https://www.google.com/maps?q=${silo.lat},${silo.lng}`} target="_blank" style={{ fontSize: 11, color: '#4A90C4' }}>
                View on map →
              </Link>
            </div>
            <div style={{ height: 220, position: 'relative' }}>
              <Line
                data={{
                  labels,
                  datasets: [
                    {
                      label: 'Level %',
                      data,
                      borderColor: '#4CAF7D',
                      backgroundColor: 'rgba(76,175,125,0.08)',
                      borderWidth: 1.5,
                      pointRadius: 0,
                      fill: true,
                      tension: 0.3,
                    },
                    {
                      label: 'Critical threshold',
                      data: Array(30).fill(20),
                      borderColor: '#E24B4A',
                      borderWidth: 1,
                      borderDash: [4, 4],
                      pointRadius: 0,
                      fill: false,
                    } as any,
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 8, maxRotation: 0 },
                      border: { display: false },
                    },
                    y: {
                      min: 0,
                      max: 100,
                      grid: { color: 'rgba(0,0,0,0.04)' },
                      ticks: {
                        font: { size: 10 },
                        color: '#aab8c0',
                        callback: value => `${value}%`,
                      },
                      border: { display: false },
                    },
                  },
                }}
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div className="card-title">Configured alarms</div>
            </div>
            {[
              { title: 'Critical low — 15%', sub: 'Telegram · @granja_engorde', status: 'Active', color: 'red' },
              { title: 'Low level — 25%', sub: 'Email · admin@feedflow.cloud', status: 'Active', color: 'amber' },
              { title: 'Sensor offline', sub: 'Email · admin@feedflow.cloud', status: 'Inactive', color: 'gray' },
            ].map(alarm => (
              <div key={alarm.title} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f7f9f8', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: alarm.color === 'red' ? '#FCEBEB' : alarm.color === 'amber' ? '#FAEEDA' : '#f7f9f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={alarm.color === 'red' ? '#A32D2D' : alarm.color === 'amber' ? '#633806' : '#aab8c0'} strokeWidth="1.5" strokeLinecap="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{alarm.title}</div>
                  <div style={{ fontSize: 11, color: '#8a9aaa', marginTop: 2 }}>{alarm.sub}</div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: alarm.status === 'Active' ? '#FCEBEB' : '#f7f9f8', color: alarm.status === 'Active' ? '#A32D2D' : '#aab8c0', border: alarm.status === 'Inactive' ? '0.5px solid #e8ede9' : 'none' }}>
                  {alarm.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
