'use client'
import { useEffect, useMemo, useState } from 'react'
import { getSilosWithReadings, getFeedPrices, getAnimalGroups } from '@/lib/queries'
import type { SiloWithReading, FeedPrice, AnimalGroup } from '@/lib/types'
import { Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend } from 'chart.js'
import AIInsightCard from '@/components/AIInsightCard'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

function projPct(silo: SiloWithReading, kgDay: number, days: number) {
  return Math.max(0, Math.round(Math.max(0, silo.kg_remaining - kgDay * days) / silo.capacity_kg * 100))
}
function levelColor(pct: number) { return pct <= 20 ? '#E24B4A' : pct <= 40 ? '#EF9F27' : '#4CAF7D' }
function siloKgDay(s: SiloWithReading) { return s.days_remaining > 0 ? Math.round(s.kg_remaining / s.days_remaining) : 400 }

export default function ForecastPage() {
  const [silos,   setSilos]   = useState<SiloWithReading[]>([])
  const [prices,  setPrices]  = useState<FeedPrice[]>([])
  const [groups,  setGroups]  = useState<AnimalGroup[]>([])
  const [horizon, setHorizon] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getSilosWithReadings(), getFeedPrices(), getAnimalGroups()])
      .then(([s, p, g]) => { setSilos(s); setPrices(p); setGroups(g); setLoading(false) })
  }, [])

  const priceMap     = Object.fromEntries(prices.map(p => [p.material, p.price_per_tonne]))
  const totalAnimals = groups.reduce((s, g) => s + g.count, 0)
  const totalKgDay   = silos.reduce((s, x) => s + siloKgDay(x), 0)
  const totalCostDay = silos.reduce((s, silo) => s + (siloKgDay(silo) / 1000 * (priceMap[silo.material || ''] || 520)), 0)
  const totalCapKg   = silos.reduce((s, x) => s + x.capacity_kg, 0)
  const projKg       = silos.reduce((s, x) => s + Math.max(0, x.kg_remaining - siloKgDay(x) * horizon), 0)
  const criticalAtEnd = silos.filter(x => projPct(x, siloKgDay(x), horizon) <= 20).length
  const avgDays      = silos.length > 0 ? Math.round(silos.reduce((s, x) => s + x.days_remaining, 0) / silos.length) : 0
  const avgLevelToday = silos.length > 0 ? Math.round(silos.reduce((s, x) => s + x.level_pct, 0) / silos.length) : 0

  const { labels, consData, costData } = useMemo(() => {
    const labels: string[] = [], consData: number[] = [], costData: number[] = []
    const now = new Date()
    for (let i = 1; i <= horizon; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i)
      labels.push(d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }))
      const decay = 1 - (i / (horizon * 20))
      consData.push(Math.round(totalKgDay * decay))
      costData.push(Math.round(totalCostDay * decay))
    }
    return { labels, consData, costData }
  }, [horizon, totalKgDay, totalCostDay])

  const scenarios = [
    { label: 'Base case', color: '#4CAF7D', mult: 1.0, cls: 'green' },
    { label: '+10% consumption', color: '#EF9F27', mult: 1.10, cls: 'amber' },
    { label: '+15% price spike', color: '#E24B4A', mult: 1.15, cls: 'red' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading forecast...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Forecast</div><div className="page-sub">Consumption & cost projections · Based on real sensor data</div></div>
        <div className="page-actions"><button className="btn-outline">Export report</button></div>
      </div>

      <AIInsightCard page="forecast" />

      <div style={{ display: 'flex', gap: 0, background: '#f0f4f0', borderRadius: 8, padding: 3, marginBottom: 20, width: 'fit-content' }}>
        {[7, 15, 30].map(h => (
          <button key={h} onClick={() => setHorizon(h)} style={{ padding: '8px 28px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: horizon === h ? '#1a2530' : 'transparent', color: horizon === h ? '#fff' : '#6a7a8a', transition: 'background 0.15s, color 0.15s' }}>
            {h} days
          </button>
        ))}
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Feed consumed</div><div className="sum-val">{(totalKgDay * horizon / 1000).toFixed(1)} t</div><div className="sum-sub">over {horizon} days</div></div>
        <div className="sum-card"><div className="sum-label">Projected cost</div><div className="sum-val">${Math.round(totalCostDay * horizon).toLocaleString()}</div><div className="sum-sub">at current prices</div></div>
        <div className="sum-card"><div className={`sum-val ${criticalAtEnd > 0 ? 'red' : 'green'}`} style={{ fontSize: 22, fontWeight: 500 }}>{criticalAtEnd}</div><div className="sum-label">Critical at day {horizon}</div><div className="sum-sub">{criticalAtEnd > 0 ? 'need restock' : 'all good'}</div></div>
        <div className="sum-card"><div className="sum-label">Farm level at day {horizon}</div><div className="sum-val">{totalCapKg > 0 ? Math.round(projKg / totalCapKg * 100) : 0}%</div><div className="sum-sub">vs {avgLevelToday}% today</div></div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Consumption forecast</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Next {horizon} days</span></div>
          <div style={{ height: 200, position: 'relative' }}>
            <Line data={{ labels, datasets: [{ label: 'Projected (kg)', data: consData, borderColor: '#4CAF7D', backgroundColor: 'rgba(76,175,125,0.08)', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 8, maxRotation: 0 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => v >= 1000 ? (v/1000).toFixed(1)+'t' : v }, border: { display: false } } } }} />
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Cost forecast</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Next {horizon} days</span></div>
          <div style={{ height: 200, position: 'relative' }}>
            <Bar data={{ labels, datasets: [{ label: 'Daily cost ($)', data: costData, backgroundColor: 'rgba(74,144,196,0.7)', borderRadius: 3 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 8, maxRotation: 0 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => '$'+Math.round(v) }, border: { display: false } } } }} />
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 16 }} />

      <div className="card">
        <div className="card-header"><div className="card-title">Silo-by-silo forecast</div></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Silo', 'Today', 'Day 7', 'Day 15', 'Day 30', 'Days left', 'Action'].map(h => (
              <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 500, padding: '0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {silos.map(s => {
              const kd = siloKgDay(s)
              const p7 = projPct(s, kd, 7), p15 = projPct(s, kd, 15), p30 = projPct(s, kd, 30)
              const days = s.days_remaining, urgent = days <= 7
              return (
                <tr key={s.id}>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{s.name}</div><div style={{ fontSize: 11, color: '#aab8c0' }}>{s.material}</div></td>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}><span style={{ fontSize: 13, fontWeight: 600, color: levelColor(s.level_pct) }}>{s.level_pct.toFixed(0)}%</span></td>
                  {[p7, p15, p30].map((p, i) => (<td key={i} style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0', textAlign: 'center' }}><span style={{ fontSize: 13, fontWeight: 600, color: levelColor(p) }}>{p}%</span></td>))}
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10, background: days <= 7 ? '#FCEBEB' : days <= 14 ? '#FAEEDA' : '#eaf5ee', color: days <= 7 ? '#A32D2D' : days <= 14 ? '#633806' : '#27500A' }}>{days} days</span></td>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}><span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, fontWeight: 600, background: urgent ? '#FCEBEB' : days <= 15 ? '#FAEEDA' : '#eaf5ee', color: urgent ? '#A32D2D' : days <= 15 ? '#633806' : '#27500A' }}>{urgent ? 'Order now' : days <= 15 ? 'Monitor' : 'OK'}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Cost scenarios — next {horizon} days</div></div>
        <div className="grid-3" style={{ marginBottom: 0 }}>
          {scenarios.map((sc, i) => {
            const costTotal = Math.round(totalCostDay * sc.mult * horizon)
            const costPerAnimal = totalAnimals > 0 ? (totalCostDay * sc.mult / totalAnimals).toFixed(2) : '—'
            return (
              <div key={sc.label} style={{ borderRadius: 10, padding: 18, border: `0.5px solid ${i === 0 ? '#4CAF7D' : '#e8ede9'}`, background: i === 0 ? '#f4fbf7' : '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{sc.label}</span>
                </div>
                <div style={{ height: '0.5px', background: '#e8ede9', marginBottom: 12 }} />
                {[
                  { k: 'Feed consumed', v: `${(totalKgDay * sc.mult * horizon / 1000).toFixed(1)} t` },
                  { k: 'Total cost', v: `$${costTotal.toLocaleString()}`, c: sc.cls },
                  { k: '$/animal/day', v: `$${costPerAnimal}`, c: sc.cls },
                  { k: 'Daily avg', v: `$${Math.round(totalCostDay * sc.mult).toLocaleString()}` },
                ].map(r => (
                  <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                    <span style={{ fontSize: 11, color: '#8a9aaa' }}>{r.k}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: r.c === 'green' ? '#27500A' : r.c === 'amber' ? '#633806' : r.c === 'red' ? '#A32D2D' : '#1a2530' }}>{r.v}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
