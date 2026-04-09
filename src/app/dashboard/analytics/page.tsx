'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'
import { Line, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend)

interface Silo     { id: string; name: string; material: string | null; capacity_kg: number; farm_id: string }
interface Reading  { id: string; silo_id: string; level_pct: number; kg_remaining: number; recorded_at: string }
interface SiloStat { silo_id: string; level_pct: number; kg_remaining: number; alert_level: string }

const MATERIAL_COLORS: Record<string, string> = {
  'Dairy Mix': '#4CAF7D', 'Calf Feed': '#4A90C4', 'Protein Mix': '#EF9F27',
  'Barley': '#E24B4A', 'Wheat': '#9B59B6', 'Canola Meal': '#1ABC9C',
  'Starter Feed': '#F39C12', 'Grower Feed': '#2ECC71', 'Finisher Feed': '#E74C3C',
  'Sow Lactation': '#3498DB', 'Boar Feed': '#95A5A6', 'Layer Mash': '#F1C40F',
  'Shell Grit': '#BDC3C7', 'Chick Starter': '#E67E22',
}

export default function AnalyticsPage() {
  const { currentFarm } = useFarm()
  const farmId = currentFarm?.id || ''

  const [silos,     setSilos]     = useState<Silo[]>([])
  const [readings,  setReadings]  = useState<Reading[]>([])
  const [siloStats, setSiloStats] = useState<SiloStat[]>([])
  const [prices,    setPrices]    = useState<Record<string, number>>({})
  const [period,    setPeriod]    = useState(14)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => { if (farmId) loadAll() }, [farmId, period])

  async function loadAll() {
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - period)

    const [silosR, readingsR, statsR, pricesR] = await Promise.all([
      supabase.from('silos').select('*').eq('farm_id', farmId).order('name'),
      supabase.from('readings').select('id, silo_id, level_pct, kg_remaining, recorded_at')
        .in('silo_id', await getSiloIds(farmId))
        .gte('recorded_at', since.toISOString())
        .order('recorded_at', { ascending: true }),
      supabase.from('silo_latest_readings').select('*'),
      supabase.from('feed_prices').select('material, price_per_tonne').eq('farm_id', farmId),
    ])
    setSilos(silosR.data || [])
    setReadings(readingsR.data || [])
    setSiloStats(statsR.data || [])
    setPrices(Object.fromEntries((pricesR.data || []).map(p => [p.material, p.price_per_tonne])))
    setLoading(false)
  }

  async function getSiloIds(fid: string) {
    const { data } = await supabase.from('silos').select('id').eq('farm_id', fid)
    return (data || []).map(s => s.id)
  }

  // Build daily consumption from readings
  const siloReadingsMap: Record<string, Reading[]> = {}
  readings.forEach(r => {
    if (!siloReadingsMap[r.silo_id]) siloReadingsMap[r.silo_id] = []
    siloReadingsMap[r.silo_id].push(r)
  })

  const dailyConsumptionMap: Record<string, number> = {}
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

  const allDays = Object.keys(dailyConsumptionMap)
  const dailyConsumptionData = allDays.map(d => Math.round(dailyConsumptionMap[d]))
  const avgConsPerDay = dailyConsumptionData.length > 0
    ? Math.round(dailyConsumptionData.reduce((a, b) => a + b, 0) / dailyConsumptionData.length)
    : 0

  // Material breakdown from latest readings
  const matMap: Record<string, number> = {}
  silos.forEach(s => {
    const stat = siloStats.find(st => st.silo_id === s.id)
    if (stat) {
      const mat = s.material || 'Unknown'
      matMap[mat] = (matMap[mat] || 0) + stat.kg_remaining
    }
  })
  const materials = Object.keys(matMap)
  const matColors = materials.map(m => MATERIAL_COLORS[m] || '#aab8c0')

  // KPIs
  const silosWithStats = silos.map(s => ({
    ...s,
    stat: siloStats.find(st => st.silo_id === s.id),
  }))
  const totalKg = silosWithStats.reduce((sum, s) => sum + (s.stat?.kg_remaining || 0), 0)
  const totalDailyCost = silosWithStats.reduce((sum, s) => {
    if (!s.stat) return sum
    const kgDay = avgConsPerDay > 0 ? avgConsPerDay / silos.length : s.capacity_kg * 0.02
    const price = prices[s.material || ''] || 420
    return sum + (kgDay / 1000 * price)
  }, 0)

  // Predictions — silos with < 30 days
  const predictions = silosWithStats
    .filter(s => s.stat)
    .map(s => {
      const kgDay = s.capacity_kg * 0.02
      const days  = s.stat ? Math.floor(s.stat.kg_remaining / kgDay) : 999
      return { silo: s.name, material: s.material || '—', days, kg: s.stat?.kg_remaining || 0, level: s.stat?.level_pct || 0, order: Math.round(s.capacity_kg * 0.85 / 1000) * 1000 }
    })
    .filter(p => p.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5)

  const urgStyle = (d: number) => d <= 7
    ? { bg: '#FCEBEB', color: '#A32D2D', label: 'Critical' }
    : d <= 14
      ? { bg: '#FAEEDA', color: '#633806', label: 'High' }
      : { bg: '#eaf5ee', color: '#27500A', label: 'Medium' }

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
          <div className="page-sub">{currentFarm?.name} · Consumption trends · Material breakdown · Restock predictions</div>
        </div>
        <div className="page-actions">
          <select value={period} onChange={e => setPeriod(Number(e.target.value))} style={{ border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: '#6a7a8a', background: '#fff', fontFamily: 'inherit' }}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total available</div><div className="sum-val">{(totalKg/1000).toFixed(1)} t</div><div className="sum-sub">Across all silos</div></div>
        <div className="sum-card"><div className="sum-label">Avg daily consumption</div><div className="sum-val">{avgConsPerDay > 0 ? (avgConsPerDay/1000).toFixed(1)+' t' : '—'}</div><div className="sum-sub">From sensor readings</div></div>
        <div className="sum-card"><div className="sum-label">Est. daily feed cost</div><div className="sum-val">${Math.round(totalDailyCost).toLocaleString()}</div><div className="sum-sub">Based on current prices</div></div>
        <div className="sum-card"><div className="sum-label">Silos monitored</div><div className="sum-val green">{silos.length}</div><div className="sum-sub">{silosWithStats.filter(s => s.stat?.alert_level === 'critical').length} critical · {silosWithStats.filter(s => s.stat?.alert_level === 'low').length} low</div></div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Daily consumption — sensor data</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Last {period} days</span></div>
          {allDays.length > 1 ? (
            <div style={{ height: 220, position: 'relative' }}>
              <Line
                data={{ labels: allDays, datasets: [{ label: 'Consumed (kg)', data: dailyConsumptionData, borderColor: '#4CAF7D', backgroundColor: 'rgba(76,175,125,0.08)', borderWidth: 1.5, pointRadius: 2, fill: true, tension: 0.3 }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 10, maxRotation: 0 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => v >= 1000 ? (v/1000).toFixed(1)+'t' : v }, border: { display: false } } } }}
              />
            </div>
          ) : (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aab8c0', fontSize: 13 }}>Accumulating readings to build the chart.</div>
          )}
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Feed available by material</div></div>
          {materials.length > 0 ? (
            <div style={{ height: 220, position: 'relative' }}>
              <Doughnut
                data={{ labels: materials, datasets: [{ data: materials.map(m => Math.round(matMap[m]/1000*10)/10), backgroundColor: matColors, borderWidth: 0, hoverOffset: 4 }] }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 10, padding: 12 } }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} t` } } } }}
              />
            </div>
          ) : (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aab8c0', fontSize: 13 }}>No data available.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Silo levels — ranked by availability</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {silosWithStats
            .filter(s => s.stat)
            .sort((a, b) => (a.stat?.kg_remaining || 0) - (b.stat?.kg_remaining || 0))
            .map((s, i) => {
              const pct   = s.stat?.level_pct || 0
              const color = pct <= 20 ? '#E24B4A' : pct <= 40 ? '#EF9F27' : '#4CAF7D'
              const kgDay = s.capacity_kg * 0.02
              const days  = s.stat ? Math.floor(s.stat.kg_remaining / kgDay) : 0
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#aab8c0', width: 18, textAlign: 'right', flexShrink: 0 }}>{i+1}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1a2530', width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: '#8a9aaa', width: 110, flexShrink: 0 }}>{s.material}</span>
                  <div style={{ flex: 1, height: 6, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.4s ease' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color, width: 42, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                  <span style={{ fontSize: 11, color: '#8a9aaa', width: 90, textAlign: 'right', flexShrink: 0 }}>{Math.round(s.stat?.kg_remaining || 0).toLocaleString()} kg</span>
                  <span style={{ fontSize: 11, color: days <= 7 ? '#A32D2D' : days <= 14 ? '#633806' : '#27500A', width: 48, textAlign: 'right', flexShrink: 0, fontWeight: 500 }}>{days}d</span>
                </div>
              )
          })}
        </div>
      </div>

      {predictions.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">Restock predictions — silos needing attention</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(predictions.length, 5)}, minmax(0,1fr))`, gap: 12 }}>
            {predictions.map(p => {
              const u = urgStyle(p.days)
              return (
                <div key={p.silo} style={{ borderRadius: 12, padding: 16, background: u.bg, border: `0.5px solid ${u.color}33`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: u.bg, color: u.color, border: `0.5px solid ${u.color}55`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{u.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: u.color }}>{p.days}d</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2530' }}>{p.silo}</div>
                  <div style={{ fontSize: 11, color: '#8a9aaa' }}>{p.material}</div>
                  <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.level}%`, background: u.color, borderRadius: 999 }} />
                  </div>
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
        </div>
      )}
    </>
  )
}
