'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { getSiloById, getLatestReading, getReadingHistory, getSensorBySiloId, getDailyConsumption } from '@/lib/queries'
import type { Silo, Reading, Sensor } from '@/lib/types'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

function levelColor(pct: number) {
  return pct <= 20 ? '#E24B4A' : pct <= 40 ? '#EF9F27' : '#4CAF7D'
}

export default function SiloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [silo, setSilo] = useState<Silo | null>(null)
  const [reading, setReading] = useState<Reading | null>(null)
  const [history, setHistory] = useState<Reading[]>([])
  const [sensor, setSensor] = useState<Sensor | null>(null)
  const [kgDay, setKgDay] = useState(400)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [s, r, h, sen, consumption] = await Promise.all([
        getSiloById(id),
        getLatestReading(id),
        getReadingHistory(id, 30),
        getSensorBySiloId(id),
        getDailyConsumption(id),
      ])
      setSilo(s)
      setReading(r)
      setHistory(h)
      setSensor(sen)
      setKgDay(consumption)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
        Loading silo data...
      </div>
    )
  }

  if (!silo) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#8a9aaa' }}>
        Silo not found. <Link href="/dashboard" style={{ color: '#4A90C4' }}>Back to dashboard</Link>
      </div>
    )
  }

  const pct = reading?.level_pct ?? 0
  const kg = reading?.kg_remaining ?? 0
  const color = levelColor(pct)
  const days = kgDay > 0 ? Math.floor(kg / kgDay) : 0
  const dColor = days <= 7 ? '#A32D2D' : days <= 14 ? '#633806' : '#27500A'

  // Chart data from real history
  const labels = history.map(r =>
    new Date(r.recorded_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  )
  const chartData = history.map(r => r.level_pct)

  const hoursAgo = reading
    ? Math.round((Date.now() - new Date(reading.recorded_at).getTime()) / 3600000)
    : null

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#aab8c0', marginBottom: 16 }}>
        <Link href="/dashboard" style={{ color: '#aab8c0', textDecoration: 'none' }}>← Dashboard</Link>
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
            {silo.material} · Serial {sensor?.serial ?? '—'} · {hoursAgo !== null ? `${hoursAgo}h ago` : 'No readings yet'}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn-outline">Export data</button>
          <Link href="/dashboard/alerts" className="btn-primary" style={{ display: 'inline-block' }}>+ Add alarm</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* CURRENT LEVEL */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header"><div className="card-title">Current level</div></div>
            <div style={{ textAlign: 'center' }}>
              {reading ? (
                <>
                  <div style={{ fontSize: 48, fontWeight: 500, color, letterSpacing: -2, margin: '12px 0 4px' }}>
                    {pct.toFixed(1)}%
                  </div>
                  <div style={{ height: 8, background: '#f7f9f8', borderRadius: 4, overflow: 'hidden', margin: '8px 0 16px' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: color, width: `${pct}%` }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { val: `${Math.round(kg).toLocaleString()} kg`, lbl: 'available' },
                      { val: reading.cubic_meters ? `${reading.cubic_meters.toFixed(1)} m³` : '—', lbl: 'volume' },
                      { val: `${silo.capacity_kg.toLocaleString()} kg`, lbl: 'capacity' },
                      { val: reading.distance_cm ? `${reading.distance_cm.toFixed(0)} cm` : '—', lbl: 'distance' },
                    ].map(item => (
                      <div key={item.lbl} style={{ background: '#f7f9f8', borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530' }}>{item.val}</div>
                        <div style={{ fontSize: 10, color: '#aab8c0', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.lbl}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 0', color: '#aab8c0', fontSize: 13 }}>
                  No readings available yet.<br />Waiting for first sensor transmission.
                </div>
              )}
            </div>
          </div>

          {/* AI FORECAST */}
          <div style={{ background: '#1a2530', borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              AI forecast · <span style={{ background: 'rgba(76,175,125,0.18)', color: '#4CAF7D', fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '0.5px solid rgba(76,175,125,0.3)' }}>PipeDream</span>
            </div>
            <div style={{ fontSize: 44, fontWeight: 500, color: '#fff', letterSpacing: -2, marginBottom: 2 }}>{days}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>days of feed remaining</div>
            {[
              { k: 'Daily consumption', v: `~${kgDay.toLocaleString()} kg/day` },
              { k: 'Suggested order', v: `${Math.round(silo.capacity_kg * 0.85 / 1000) * 1000} kg`, c: '#4CAF7D' },
              { k: 'Feed cost / day', v: `est. $${Math.round(kgDay / 1000 * 420)}` },
            ].map(row => (
              <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{row.k}</span>
                <span style={{ fontSize: 12, color: row.c || 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{row.v}</span>
              </div>
            ))}
          </div>

          {/* SENSOR STATUS */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header"><div className="card-title">Sensor status</div></div>
            {sensor ? (
              <>
                {[
                  { k: 'Connection', v: sensor.status.charAt(0).toUpperCase() + sensor.status.slice(1), color: sensor.status === 'online' ? '#27500A' : '#633806' },
                  { k: 'Battery', v: `${sensor.battery_pct}%`, color: sensor.battery_pct >= 70 ? '#27500A' : sensor.battery_pct >= 40 ? '#633806' : '#A32D2D' },
                  { k: 'Signal', v: ['—', 'Weak', 'Fair', 'Good'][sensor.signal_strength] || '—' },
                  { k: 'Model', v: sensor.model },
                  { k: 'Serial', v: sensor.serial },
                  { k: 'Firmware', v: sensor.firmware || '—' },
                  { k: 'Last seen', v: hoursAgo !== null ? `${hoursAgo}h ago` : '—' },
                ].map(row => (
                  <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                    <span style={{ fontSize: 12, color: '#8a9aaa' }}>{row.k}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: row.color || '#1a2530', fontFamily: row.k === 'Serial' ? 'monospace' : 'inherit' }}>{row.v}</span>
                  </div>
                ))}
                {silo.lat && silo.lng && (
                  <a href={`https://www.google.com/maps?q=${silo.lat},${silo.lng}`} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 12, fontSize: 12, color: '#4A90C4', textAlign: 'center' }}>
                    View on Google Maps →
                  </a>
                )}
              </>
            ) : (
              <div style={{ color: '#8a9aaa', fontSize: 13 }}>No sensor registered for this silo.</div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div className="card-title">
                Level history — last 30 days
                {history.length === 0 && <span style={{ fontSize: 11, color: '#aab8c0', marginLeft: 8, fontWeight: 400, textTransform: 'none' }}>(no data yet)</span>}
              </div>
            </div>
            {history.length > 0 ? (
              <div style={{ height: 220, position: 'relative' }}>
                <Line
                  data={{
                    labels,
                    datasets: [
                      {
                        label: 'Level %',
                        data: chartData,
                        borderColor: '#4CAF7D',
                        backgroundColor: 'rgba(76,175,125,0.08)',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.3,
                      },
                      {
                        label: 'Critical threshold',
                        data: Array(history.length).fill(20),
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
                      x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 8, maxRotation: 0 }, border: { display: false } },
                      y: { min: 0, max: 100, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => v + '%' }, border: { display: false } },
                    },
                  }}
                />
              </div>
            ) : (
              <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aab8c0', fontSize: 13 }}>
                Waiting for sensor readings to build the history chart.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
