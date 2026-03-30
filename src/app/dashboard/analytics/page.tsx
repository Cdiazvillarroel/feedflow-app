'use client'
import { useEffect, useState } from 'react'
import { getFarmReadings, getSilos, getFeedPrices } from '@/lib/queries'
import type { Reading, Silo, FeedPrice } from '@/lib/types'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

type RichReading = Reading & { silo_name: string; material: string }

const MATERIAL_COLORS: Record<string, string> = {
  'Maize meal':   '#4CAF7D',
  'Wheat bran':   '#4A90C4',
  'Soybean meal': '#EF9F27',
  'Barley':       '#E24B4A',
}

export default function AnalyticsPage() {
  const [readings, setReadings] = useState<RichReading[]>([])
  const [silos, setSilos] = useState<Silo[]>([])
  const [prices, setPrices] = useState<FeedPrice[]>([])
  const [period, setPeriod] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [r, s, p] = await Promise.all([
        getFarmReadings(undefined, period),
        getSilos(),
        getFeedPrices(),
      ])
      setReadings(r)
      setSilos(s)
      setPrices(p)
      setLoading(false)
    }
    load()
  }, [period])

  // Build daily consumption data from readings
  const dailyMap: Record<string, number> = {}
  readings.forEach(r => {
    const day = new Date(r.recorded_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
    if (!dailyMap[day]) dailyMap[day] = 0
    dailyMap[day] += r.kg_remaining
  })
  const chartLabels = Object.keys(dailyMap).slice(-period)
  const chartConsumed = chartLabels.map(d => Math.round(dailyMap[d] || 0))

  // Material breakdown from latest readings per silo
  const matMap: Record<string, number> = {}
  silos.forEach(s => {
    const mat = s.material || 'Unknown'
    const latest = readings.find(r => r.silo_id === s.id)
    if (latest) matMap[mat] = (matMap[mat] || 0) + latest.kg_remaining
  })
  const materials = Object.keys(matMap)
  const matColors = materials.map(m => MATERIAL_COLORS[m] || '#aab8c0')

  // Total stats
  const totalKg = silos.reduce((s, x) => {
    const r = readings.find(r => r.silo_id === x.id)
    return s + (r?.kg_remaining || 0)
  }, 0)
  const priceMap = Object.fromEntries(prices.map(p => [p.material, p.price_per_tonne]))
  const totalDailyCost = silos.reduce((s, silo) => {
    const r = readings.find(r => r.silo_id === silo.id)
    if (!r) return s
    const price = priceMap[silo.material || ''] || 400
    const kgDay = 400 // estimated
    return s + (kgDay / 1000 * price)
  }, 0)

  // AI restock predictions
  const predictions = silos
    .map(s => {
      const r = readings.find(r => r.silo_id === s.id)
      const kg = r?.kg_remaining || 0
      const kgDay = 400
      const days = Math.floor(kg / kgDay)
      return { silo: s.name, material: s.material || '—', days, kg, order: Math.round(s.capacity_kg * 0.85 / 1000) * 1000 }
    })
    .filter(p => p.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5)

  const urgStyle = (d: number) => d <= 7
    ? { bg: '#FCEBEB', color: '#A32D2D', label: 'Critical' }
    : d <= 14
    ? { bg: '#FAEEDA', color: '#633806', label: 'High' }
    : { bg: '#eaf5ee', color: '#27500A', label: 'Medium' }

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#8a9aaa' }}>Loading analytics...</div>
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-sub">Consumption trends · Deliveries · AI predictions</div>
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

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total available</div><div className="sum-val">{(totalKg / 1000).toFixed(1)} t</div><div className="sum-sub">Across all silos</div></div>
        <div className="sum-card"><div className="sum-label">Daily est. cost</div><div className="sum-val">${Math.round(totalDailyCost).toLocaleString()}</div><div className="sum-sub">Based on current prices</div></div>
        <div className="sum-card"><div className="sum-label">Silos monitored</div><div className="sum-val green">{silos.length}</div><div className="sum-sub">Active & transmitting</div></div>
        <div className="sum-card"><div className="sum-label">Readings stored</div><div className="sum-val">{readings.length}</div><div className="sum-sub">Last {period} days</div></div>
      </div>

      {/* CHARTS */}
      <div className="grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Daily kg across farm</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Last {period} days</span></div>
          {chartLabels.length > 0 ? (
            <div style={{ height: 220, position: 'relative' }}>
              <Bar
                data={{ labels: chartLabels, datasets: [{ label: 'kg available', data: chartConsumed, backgroundColor: 'rgba(76,175,125,0.7)', borderRadius: 3 }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 10, maxRotation: 0 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => v >= 1000 ? (v/1000).toFixed(0)+'t' : v }, border: { display: false } } } }}
              />
            </div>
          ) : (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aab8c0', fontSize: 13 }}>
              No readings yet — chart will populate after first sensor transmission.
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Feed by material</div></div>
          {materials.length > 0 ? (
            <div style={{ height: 220, position: 'relative' }}>
              <Doughnut
                data={{ labels: materials, datasets: [{ data: materials.map(m => Math.round(matMap[m] / 1000)), backgroundColor: matColors, borderWidth: 0, hoverOffset: 4 }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 10, padding: 10 } } } }}
              />
            </div>
          ) : (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aab8c0', fontSize: 13 }}>
              Waiting for sensor data.
            </div>
          )}
        </div>
      </div>

      {/* SILO RANKING */}
      <div className="card">
        <div className="card-header"><div className="card-title">Current levels — all silos</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {silos.length === 0 ? (
            <div style={{ color: '#aab8c0', fontSize: 13 }}>No silos found.</div>
          ) : (
            [...silos]
              .map(s => ({ ...s, r: readings.find(r => r.silo_id === s.id) }))
              .sort((a, b) => (a.r?.kg_remaining || 0) - (b.r?.kg_remaining || 0))
              .map((s, i) => {
                const pct = s.r?.level_pct || 0
                const kg = s.r?.kg_remaining || 0
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: '#aab8c0', width: 16, textAlign: 'right' }}>{i + 1}</span>
                    <span style={{ fontSize: 12, color: '#1a2530', width: 64, flexShrink: 0 }}>{s.name}</span>
                    <div style={{ flex: 1, height: 6, background: '#f7f9f8', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: pct <= 20 ? '#E24B4A' : pct <= 40 ? '#EF9F27' : '#4CAF7D', width: `${pct}%` }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#8a9aaa', width: 80, textAlign: 'right' }}>{kg > 0 ? `${Math.round(kg).toLocaleString()} kg` : '—'}</span>
                    <span style={{ fontSize: 11, color: '#8a9aaa', width: 32, textAlign: 'right' }}>{pct > 0 ? `${pct.toFixed(0)}%` : '—'}</span>
                  </div>
                )
              })
          )}
        </div>
      </div>

      {/* AI RESTOCK PREDICTIONS */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">AI restock predictions — next 30 days</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#aab8c0' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF7D' }} />PipeDream AI engine
          </div>
        </div>
        {predictions.length === 0 ? (
          <div style={{ color: '#8a9aaa', fontSize: 13, padding: '12px 0' }}>
            {readings.length === 0 ? 'Waiting for sensor data to generate predictions.' : 'All silos have more than 30 days of feed remaining.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(predictions.length, 5)}, minmax(0,1fr))`, gap: 10 }}>
            {predictions.map(p => {
              const u = urgStyle(p.days)
              return (
                <div key={p.silo} style={{ borderRadius: 10, padding: '16px 14px', background: u.bg, border: `0.5px solid ${u.color}33`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: u.bg, color: u.color, border: `0.5px solid ${u.color}66`, width: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{u.label}</span>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#1a2530' }}>{p.silo}</div>
                  <div style={{ fontSize: 12, color: '#8a9aaa' }}>{p.material}</div>
                  <div style={{ height: '0.5px', background: 'rgba(0,0,0,0.08)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: '#8a9aaa' }}>Days left</span><span style={{ fontSize: 12, fontWeight: 500, color: u.color }}>{p.days}d</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: '#8a9aaa' }}>Available</span><span style={{ fontSize: 12, fontWeight: 500, color: '#1a2530' }}>{Math.round(p.kg).toLocaleString()} kg</span></div>
                  <div style={{ height: '0.5px', background: 'rgba(0,0,0,0.08)' }} />
                  <div style={{ fontSize: 10, color: '#8a9aaa' }}>Suggested order</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#27500A' }}>{p.order.toLocaleString()} kg</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
