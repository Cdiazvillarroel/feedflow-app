'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getSiloById, getLatestReading, getReadingHistory,
  getSensorBySiloId, getDailyConsumption,
} from '@/lib/queries'
import type { Silo, Reading, Sensor } from '@/lib/types'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Filler, Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

function levelColor(pct: number) {
  return pct <= 20 ? '#E24B4A' : pct <= 40 ? '#EF9F27' : '#4CAF7D'
}
function levelBg(pct: number) {
  return pct <= 20 ? '#FCEBEB' : pct <= 40 ? '#FAEEDA' : '#eaf5ee'
}
function levelLabel(pct: number) {
  return pct <= 20 ? 'Critical' : pct <= 40 ? 'Low' : 'OK'
}
function battColor(b: number) {
  return b >= 70 ? '#4CAF7D' : b >= 40 ? '#EF9F27' : '#E24B4A'
}
function signalLabel(s: number) {
  return ['—', 'Weak', 'Fair', 'Good'][s] ?? '—'
}

// ── SILO GRAPHIC ─────────────────────────────────────────────────────────────
function SiloGraphic({ pct, color }: { pct: number; color: string }) {
  const W = 120, H = 200
  const bodyX = 20, bodyY = 30
  const bodyW = W - 40, bodyH = H - 70

  const fillH = Math.round((pct / 100) * bodyH)
  const fillY  = bodyY + bodyH - fillH

  const rx = bodyW / 2, ry = 10
  const cx = W / 2

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id="silo-body-clip">
          <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} />
        </clipPath>
        <linearGradient id="fill-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={color} stopOpacity="0.85" />
          <stop offset="40%"  stopColor={color} stopOpacity="1"    />
          <stop offset="100%" stopColor={color} stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="wall-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#d0dbd4" />
          <stop offset="30%"  stopColor="#f0f4f0" />
          <stop offset="70%"  stopColor="#e8ede9" />
          <stop offset="100%" stopColor="#c8d4cc" />
        </linearGradient>
      </defs>

      {pct > 0 && (
        <g clipPath="url(#silo-body-clip)">
          <rect x={bodyX} y={fillY} width={bodyW} height={fillH} fill="url(#fill-shine)" style={{ transition: 'all 0.6s ease' }} />
          <ellipse cx={cx} cy={fillY} rx={rx} ry={ry * 0.6} fill={color} opacity="0.6" style={{ transition: 'all 0.6s ease' }} />
        </g>
      )}

      <rect x={bodyX} y={bodyY} width={3} height={bodyH} fill="#c8d4cc" />
      <rect x={bodyX + bodyW - 3} y={bodyY} width={3} height={bodyH} fill="#a8b8ac" />
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} fill="none" stroke="#c8d4cc" strokeWidth="1.5" />

      <ellipse cx={cx} cy={bodyY} rx={rx} ry={ry} fill="#e0e8e2" stroke="#c8d4cc" strokeWidth="1" />
      <path d={`M ${bodyX} ${bodyY} Q ${cx} ${bodyY - 28} ${bodyX + bodyW} ${bodyY}`} fill="#d8e2da" stroke="#c0ccc4" strokeWidth="1" />
      <ellipse cx={cx} cy={bodyY - 22} rx={rx * 0.25} ry={ry * 0.4} fill="#c8d4cc" />

      <ellipse cx={cx} cy={bodyY + bodyH} rx={rx} ry={ry} fill={pct > 0 ? color : '#e0e8e2'} stroke="#c8d4cc" strokeWidth="1" opacity={pct > 0 ? 0.8 : 1} />
      {[-1, 1].map(side => (
        <line key={side} x1={cx + side * (rx * 0.5)} y1={bodyY + bodyH + ry} x2={cx + side * (rx * 0.7)} y2={H - 5} stroke="#c8d4cc" strokeWidth="3" strokeLinecap="round" />
      ))}

      <text x={cx} y={fillY > bodyY + 24 ? fillY - 8 : bodyY + bodyH / 2} textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="-apple-system, sans-serif" fill={pct > 0 ? '#fff' : '#8a9aaa'}>
        {pct.toFixed(1)}%
      </text>

      {[25, 50, 75].map(tick => {
        const ty = bodyY + bodyH - (tick / 100) * bodyH
        return (
          <g key={tick}>
            <line x1={bodyX + bodyW} y1={ty} x2={bodyX + bodyW + 8} y2={ty} stroke="#aab8c0" strokeWidth="0.5" />
            <text x={bodyX + bodyW + 11} y={ty + 4} fontSize="8" fill="#aab8c0" fontFamily="-apple-system, sans-serif">{tick}%</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function SiloDrawer({
  siloId, open, onClose, farmId,
}: {
  siloId: string | null
  open: boolean
  onClose: () => void
  farmId?: string
}) {
  const router = useRouter()
  const [silo,    setSilo]    = useState<Silo    | null>(null)
  const [reading, setReading] = useState<Reading | null>(null)
  const [history, setHistory] = useState<Reading[]>([])
  const [sensor,  setSensor]  = useState<Sensor  | null>(null)
  const [kgDay,   setKgDay]   = useState(400)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !siloId) return
    setSilo(null); setReading(null); setHistory([]); setSensor(null)

    async function load() {
      setLoading(true)
      const [s, r, h, sen, cons] = await Promise.all([
        getSiloById(siloId!),
        getLatestReading(siloId!),
        getReadingHistory(siloId!, 30),
        getSensorBySiloId(siloId!),
        getDailyConsumption(siloId!),
      ])
      setSilo(s); setReading(r); setHistory(h); setSensor(sen); setKgDay(cons)
      setLoading(false)
    }
    load()
  }, [siloId, open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const pct    = reading?.level_pct   ?? 0
  const kg     = reading?.kg_remaining ?? 0
  const color  = levelColor(pct)
  const days   = kgDay > 0 ? Math.floor(kg / kgDay) : 0
  const dColor = days <= 7 ? '#A32D2D' : days <= 14 ? '#633806' : '#27500A'

  const hoursAgo = reading
    ? Math.round((Date.now() - new Date(reading.recorded_at).getTime()) / 3600000)
    : null
  const lastRead = hoursAgo === null ? '—'
    : hoursAgo < 1   ? 'Just now'
    : hoursAgo < 24  ? `${hoursAgo}h ago`
    : `${Math.round(hoursAgo / 24)}d ago`

  const step = Math.max(1, Math.floor(history.length / 60))
  const chartHistory = history.filter((_, i) => i % step === 0)
  const labels    = chartHistory.map(r =>
    new Date(r.recorded_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  )
  const chartData = chartHistory.map(r => r.level_pct)

  // ── ACTION HANDLERS ─────────────────────────────────────────────────────
  function handleViewHistory() {
    onClose()
    router.push(`/dashboard/silo/${siloId}`)
  }

  function handleScheduleDelivery() {
    onClose()
    const params = new URLSearchParams()
    if (farmId) params.set('farm_id', farmId)
    if (siloId) params.set('silo_id', siloId)
    router.push(`/dashboard/logistics/orders?${params.toString()}`)
  }

  return (
    <>
      {/* BACKDROP */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.25)',
        zIndex: 40,
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.2s ease',
      }} />

      {/* DRAWER */}
      <div style={{
        position: 'fixed', top: 56, right: 0,
        width: 480, maxWidth: '93vw',
        height: 'calc(100vh - 56px)',
        background: '#ffffff',
        borderLeft: '1px solid #e5e7eb',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.10)',
        zIndex: 50,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* ── HEADER ──────────────────────────────────────────── */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f0f4f0',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: levelBg(pct),
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>
              {loading ? '—' : `${Math.round(pct)}%`}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2530', lineHeight: 1.2 }}>
              {silo?.name || (loading ? 'Loading...' : 'Silo detail')}
            </div>
            <div style={{ fontSize: 12, color: '#8a9aaa', marginTop: 2 }}>
              {silo?.material || '—'} · {lastRead}
            </div>
          </div>
          {!loading && silo && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px',
              borderRadius: 20, background: levelBg(pct), color, flexShrink: 0,
            }}>
              {levelLabel(pct)}
            </span>
          )}
          <button onClick={onClose} style={{
            border: '0.5px solid #e5e7eb', background: '#f9fafb',
            borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
            color: '#6a7a8a', fontSize: 14, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>

          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#aab8c0', fontSize: 13 }}>
              Loading silo data...
            </div>
          ) : !silo ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#aab8c0', fontSize: 13 }}>
              Silo not found.
            </div>
          ) : (
            <>
              {/* ── SILO GRAPHIC + STATS ─────────────────────── */}
              <div style={{
                background: '#f7f9f8', borderRadius: 12, padding: '20px 16px',
                display: 'flex', alignItems: 'center', gap: 20,
              }}>
                <div style={{ flexShrink: 0 }}>
                  <SiloGraphic pct={pct} color={color} />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>
                      Available
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#1a2530', letterSpacing: -1 }}>
                      {Math.round(kg).toLocaleString()}
                      <span style={{ fontSize: 14, fontWeight: 400, color: '#8a9aaa', marginLeft: 4 }}>kg</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>
                      of {(silo.capacity_kg || 0).toLocaleString()} kg capacity
                    </div>
                  </div>

                  <div style={{ height: '0.5px', background: '#e8ede9' }} />

                  {[
                    { label: 'Days left',  value: String(days),              vColor: dColor },
                    { label: 'Daily use',  value: `${kgDay.toLocaleString()} kg/day` },
                    { label: 'Distance',   value: reading?.distance_cm ? `${reading.distance_cm.toFixed(0)} cm` : '—' },
                    { label: 'Volume',     value: reading?.cubic_meters  ? `${reading.cubic_meters.toFixed(1)} m³`  : '—' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#8a9aaa' }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: item.vColor || '#1a2530' }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── FORECAST ──────────────────────────────────── */}
              <div style={{ background: '#1a2530', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    AI Forecast
                  </div>
                  <span style={{ background: 'rgba(76,175,125,0.2)', color: '#4CAF7D', fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '0.5px solid rgba(76,175,125,0.3)' }}>
                    PipeDream
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 38, fontWeight: 700, color: '#fff', letterSpacing: -1 }}>{days}</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>days remaining</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (days / 30) * 100)}%`,
                    background: days <= 7 ? '#E24B4A' : days <= 14 ? '#EF9F27' : '#4CAF7D',
                    borderRadius: 999,
                  }} />
                </div>
                {[
                  { k: 'Daily consumption', v: `~${kgDay.toLocaleString()} kg/day` },
                  { k: 'Suggested order', v: `${Math.round((silo.capacity_kg || 20000) * 0.85 / 1000) * 1000} kg`, c: '#4CAF7D' },
                  { k: 'Cost/day est.', v: `$${Math.round(kgDay / 1000 * 520)}` },
                ].map(row => (
                  <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{row.k}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: row.c || '#fff' }}>{row.v}</span>
                  </div>
                ))}
              </div>

              {/* ── SENSOR ────────────────────────────────────── */}
              <div style={{ background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                  Sensor status
                </div>
                {sensor ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: sensor.status === 'online' ? '#4CAF7D' : sensor.status === 'delayed' ? '#EF9F27' : '#E24B4A' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>
                        {sensor.status === 'online' ? 'Online' : sensor.status === 'delayed' ? 'Delayed' : 'Offline'}
                      </span>
                      <span style={{ fontSize: 11, color: '#aab8c0', marginLeft: 'auto', fontFamily: 'monospace' }}>{sensor.serial}</span>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: '#8a9aaa' }}>Battery</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: battColor(sensor.battery_pct) }}>{sensor.battery_pct}%</span>
                      </div>
                      <div style={{ height: 4, background: '#f0f4f0', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${sensor.battery_pct}%`, background: battColor(sensor.battery_pct), borderRadius: 999 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#8a9aaa' }}>Signal</span>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                        {[1,2,3].map(b => (
                          <div key={b} style={{ width: 5, height: b * 6 + 3, borderRadius: 2, background: b <= sensor.signal_strength ? '#4CAF7D' : '#e8ede9' }} />
                        ))}
                        <span style={{ fontSize: 11, color: '#8a9aaa', marginLeft: 6 }}>{signalLabel(sensor.signal_strength)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: '#aab8c0' }}>No sensor registered.</div>
                )}
              </div>

              {/* ── HISTORY CHART ─────────────────────────────── */}
              <div style={{ background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                  Level history — last 30 days
                </div>
                {history.length > 0 ? (
                  <div style={{ height: 160, position: 'relative' }}>
                    <Line
                      data={{
                        labels,
                        datasets: [
                          {
                            label: 'Level %',
                            data: chartData,
                            borderColor: color,
                            backgroundColor: `${color}14`,
                            borderWidth: 1.5,
                            pointRadius: 0,
                            fill: true,
                            tension: 0.3,
                          },
                          {
                            label: 'Critical',
                            data: Array(chartData.length).fill(20),
                            borderColor: '#E24B4A44',
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
                            ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 6, maxRotation: 0 },
                            border: { display: false },
                          },
                          y: {
                            min: 0, max: 100,
                            grid: { color: 'rgba(0,0,0,0.04)' },
                            ticks: { font: { size: 9 }, color: '#aab8c0', callback: (v: any) => `${v}%` },
                            border: { display: false },
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aab8c0', fontSize: 12 }}>
                    No reading history yet
                  </div>
                )}
              </div>

              {/* ── ACTION BUTTONS ────────────────────────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={handleViewHistory} style={{
                  padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9',
                  borderRadius: 8, fontSize: 13, color: '#1a2530', cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left', fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#4CAF7D'; (e.currentTarget as HTMLElement).style.background = '#f4fbf7' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e8ede9'; (e.currentTarget as HTMLElement).style.background = '#fff' }}
                >
                  <span>View consumption history</span>
                  <span style={{ color: '#8a9aaa' }}>→</span>
                </button>
                <button onClick={handleScheduleDelivery} style={{
                  padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9',
                  borderRadius: 8, fontSize: 13, color: '#1a2530', cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left', fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#4A90C4'; (e.currentTarget as HTMLElement).style.background = '#EEF5FB' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e8ede9'; (e.currentTarget as HTMLElement).style.background = '#fff' }}
                >
                  <span>Schedule delivery</span>
                  <span style={{ color: '#8a9aaa' }}>→</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ──────────────────────────────────────────── */}
        {!loading && silo && siloId && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid #f0f4f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0, background: '#fff',
          }}>
            <span style={{ fontSize: 12, color: '#aab8c0' }}>
              {silo.name} · {silo.material}
            </span>
            <Link
              href={`/dashboard/silo/${siloId}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', background: '#1a2530', color: '#fff',
                borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none',
              }}
            >
              Full detail
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
