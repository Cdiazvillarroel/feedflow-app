'use client'
import { useEffect, useState } from 'react'
import { getSilosWithReadings, getFarmReadings, getFeedPrices } from '@/lib/queries'
import type { SiloWithReading, Reading, FeedPrice } from '@/lib/types'
import { Line, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend } from 'chart.js'
import AIInsightCard from '@/components/AIInsightCard'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend)

type RichReading = Reading & { silo_name: string; material: string }

const MATERIAL_COLORS: Record<string, string> = {
  'Maize meal': '#4CAF7D', 'Wheat bran': '#4A90C4',
  'Soybean meal': '#EF9F27', 'Barley': '#E24B4A',
  'Lactation diet': '#4CAF7D', 'Gestation diet': '#4A90C4',
}

export default function AnalyticsPage() {
  const [silos,    setSilos]    = useState<SiloWithReading[]>([])
  const [readings, setReadings] = useState<RichReading[]>([])
  const [prices,   setPrices]   = useState<FeedPrice[]>([])
  const [period,   setPeriod]   = useState(30)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getSilosWithReadings(), getFarmReadings(undefined, period), getFeedPrices()])
      .then(([s, r, p]) => { setSilos(s); setReadings(r); setPrices(p); setLoading(false) })
  }, [period])

  const dailyConsumptionMap: Record<string, number> = {}
  const siloReadingsMap: Record<string, RichReading[]> = {}
  readings.forEach(r => {
    if (!siloReadingsMap[r.silo_id]) siloReadingsMap[r.silo_id] = []
    siloReadingsMap[r.silo_id].push(r)
  })
  Object.values(siloReadingsMap).forEach(siloReadings => {
    const sorted = [...siloReadings].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    for (let i = 1; i < sorted.length; i++) {
      const consumed = sorted[i-1].kg_remaining - sorted[i].kg_remaining
      if (consumed > 0) {
        const day = new Date(sorted[i].recorded_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
        dailyConsumptionMap[day] = (dailyConsumptionMap[day] || 0) + consumed
      }
    }
  })

  const allDays = Object.keys(dailyConsumptionMap).slice(-period)
  const dailyConsumptionData = allDays.map(d => Math.round(dailyConsumptionMap[d]))

  const matMap: Record<string, number> = {}
  silos.forEach(s => { const mat = s.material || 'Unknown'; matMap[mat] = (matMap[mat] || 0) + s.kg_remaining })
  const materials = Object.keys(matMap)
  const matColors = materials.map(m => MATERIAL_COLORS[m] || '#aab8c0')
  const priceMap  = Object.fromEntries(prices.map(p => [p.material, p.price_per_tonne]))

  const totalKg        = silos.reduce((s, x) => s + x.kg_remaining, 0)
  const totalDailyCons = silos.reduce((s, x) => s + (x.kg_remaining / Math.max(x.days_remaining, 1)), 0)
  const totalDailyCost = silos.reduce((s, silo) => {
    const price = priceMap[silo.material || ''] || 520
    const kgDay = silo.days_remaining > 0 ? silo.kg_remaining / silo.days_remaining : 400
    return s + (kgDay / 1000 * price)
  }, 0)
  const avgConsPerDay = allDays.length > 0 ? Math.round(dailyConsumptionData.reduce((a, b) => a + b, 0) / dailyConsumptionData.length) : 0

  const predictions = [...silos].filter(s => s.days_remaining <= 30).sort((a, b) => a.days_remaining - b.days_remaining).slice(0, 5)
    .map(s => ({ silo: s.name, material: s.material || '—', days: s.days_remaining, kg: s.kg_remaining, level: s.level_pct, order: Math.round(s.capacity_kg * 0.85 / 1000) * 1000 }))

  const urgStyle = (d: number) => d <= 7 ? { bg: '#FCEBEB', color: '#A32D2D', label: 'Critical' } : d <= 14 ? { bg: '#FAEEDA', color: '#633806', label: 'High' } : { bg: '#eaf5ee', color: '#27500A', label: 'Medium' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading analytics...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-sub">Consumption trends · Material breakdown · AI predictions</div>
        </div>
        <div className="page-actions">
          <select value={period} onChange={e => setPeriod(Number(e.target.value))} style={{ border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: '#6a7a8a', background: '#fff', fontFamily: 'inherit' }}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 3 months</option>
          </select>
          <button className="btn-outline">Export CSV</button>
        </div>
      </div>

      <AIInsightCard page="analytics" />

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total available</div><div className="sum-val">{(totalKg/1000).toFixed(1)} t</div><div className="sum-sub">Across all silos</div></div>
        <div className="sum-card"><div className="sum-label">Avg daily consumption</div><div className="sum-val">{avgConsPerDay > 0 ? `${(avgConsPerDay/1000).toFixed(1)} t` : `${(totalDailyCons/1000).toFixed(1)} t`}</div><div className="sum-sub">Real sensor data</div></div>
        <div className="sum-card"><div className="sum-label">Daily feed cost</div><div className="sum-val">${Math.round(totalDailyCost).toLocaleString()}</div><div className="sum-sub">Based on current prices</div></div>
        <div className="sum-card"><div className="sum-label">Silos monitored</div><div className="sum-val green">{silos.length}</div><div className="sum-sub">{silos.filter(s => s.alert_level === 'critical').length} critical · {silos.filter(s => s.alert_level === 'low').length} low</div></div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Daily consumption — real sensor data</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Last {period} days</span></div>
          {allDays.length > 1 ? (
            <div style={{ height: 220, position: 'relative' }}>
              <Line data={{ labels: allDays, datasets: [{ label: 'Consumed (kg)', data: dailyConsumptionData, borderColor: '#4CAF7D', backgroundColor: 'rgba(76,175,125,0.08)', borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.3 }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 10, maxRotation: 0 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => v >= 1000 ? (v/1000).toFixed(1)+'t' : v }, border: { display: false } } } }} />
            </div>
          ) : (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aab8c0', fontSize: 13 }}>Accumulating readings to build the consumption chart.</div>
          )}
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Feed available by material</div></div>
          {materials.length > 0 ? (
            <div style={{ height: 220, position: 'relative' }}>
              <Doughnut data={{ labels: materials, datasets: [{ data: materials.map(m => Math.round(matMap[m]/1000*10)/10), backgroundColor: matColors, borderWidth: 0, hoverOffset: 4 }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 10, padding: 12 } }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} t` } } } }} />
            </div>
          ) : (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aab8c0', fontSize: 13 }}>Waiting for sensor data.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Silo levels — ranked by availability</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Sorted by kg remaining</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...silos].sort((a, b) => a.kg_remaining - b.kg_remaining).map((s, i) => {
            const color = s.level_pct <= 20 ? '#E24B4A' : s.level_pct <= 40 ? '#EF9F27' : '#4CAF7D'
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: '#aab8c0', width: 18, textAlign: 'right', flexShrink: 0 }}>{i+1}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1a2530', width: 72, flexShrink: 0 }}>{s.name}</span>
                <span style={{ fontSize: 11, color: '#8a9aaa', width: 100, flexShrink: 0 }}>{s.material}</span>
                <div style={{ flex: 1, height: 6, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: color, width: `${s.level_pct}%`, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color, width: 42, textAlign: 'right', flexShrink: 0 }}>{s.level_pct.toFixed(0)}%</span>
                <span style={{ fontSize: 11, color: '#8a9aaa', width: 84, textAlign: 'right', flexShrink: 0 }}>{Math.round(s.kg_remaining).toLocaleString()} kg</span>
                <span style={{ fontSize: 11, color: s.days_remaining <= 7 ? '#A32D2D' : s.days_remaining <= 14 ? '#633806' : '#27500A', width: 48, textAlign: 'right', flexShrink: 0, fontWeight: 500 }}>{s.days_remaining}d</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Restock predictions — silos needing attention</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#aab8c0' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4CAF7D' }} />Based on real consumption rates
          </div>
        </div>
        {predictions.length === 0 ? (
          <div style={{ color: '#8a9aaa', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>All silos have more than 30 days of feed remaining. ✓</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(predictions.length, 5)}, minmax(0,1fr))`, gap: 12 }}>
            {predictions.map(p => {
              const u = urgStyle(p.days)
              return (
                <div key={p.silo} style={{ borderRadius: 12, padding: 16, background: u.bg, border: `0.5px solid ${u.color}33`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: u.bg, color: u.color, border: `0.5px solid ${u.color}55`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{u.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: u.color }}>{p.days}d</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2530' }}>{p.silo}</div>
                  <div style={{ fontSize: 11, color: '#8a9aaa' }}>{p.material}</div>
                  <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.level}%`, background: u.color, borderRadius: 999 }} />
                  </div>
                  <div style={{ height: '0.5px', background: 'rgba(0,0,0,0.08)' }} />
                  {[{ k: 'Level', v: `${p.level.toFixed(1)}%` }, { k: 'Available', v: `${Math.round(p.kg).toLocaleString()} kg` }, { k: 'Order needed', v: `${p.order.toLocaleString()} kg`, bold: true }].map(r => (
                    <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#8a9aaa' }}>{r.k}</span>
                      <span style={{ fontSize: 12, fontWeight: r.bold ? 700 : 500, color: r.bold ? '#27500A' : '#1a2530' }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
