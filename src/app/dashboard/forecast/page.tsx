'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'
import { Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

interface Silo     { id: string; name: string; material: string | null; capacity_kg: number }
interface SiloStat { silo_id: string; level_pct: number; kg_remaining: number; alert_level: string }
interface Reading  { silo_id: string; kg_remaining: number; recorded_at: string }
interface AnimalGroup { id: string; name: string; type: string; count: number }

function levelColor(pct: number) { return pct <= 20 ? '#E24B4A' : pct <= 40 ? '#EF9F27' : '#4CAF7D' }

export default function ForecastPage() {
  const { currentFarm } = useFarm()
  const farmId = currentFarm?.id || ''

  const [silos,      setSilos]      = useState<Silo[]>([])
  const [siloStats,  setSiloStats]  = useState<SiloStat[]>([])
  const [readings,   setReadings]   = useState<Reading[]>([])
  const [prices,     setPrices]     = useState<Record<string, number>>({})
  const [groups,     setGroups]     = useState<AnimalGroup[]>([])
  const [horizon,    setHorizon]    = useState(7)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => { if (farmId) loadAll() }, [farmId])

  async function loadAll() {
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - 14)

    const siloIds = await supabase.from('silos').select('id').eq('farm_id', farmId)
      .then(r => (r.data || []).map(s => s.id))

    const [silosR, statsR, readingsR, pricesR, groupsR] = await Promise.all([
      supabase.from('silos').select('*').eq('farm_id', farmId).order('name'),
      supabase.from('silo_latest_readings').select('*').in('silo_id', siloIds),
      supabase.from('readings').select('silo_id, kg_remaining, recorded_at')
        .in('silo_id', siloIds)
        .gte('recorded_at', since.toISOString())
        .order('recorded_at', { ascending: true }),
      supabase.from('feed_prices').select('material, price_per_tonne').eq('farm_id', farmId),
      supabase.from('animal_groups').select('*').eq('farm_id', farmId),
    ])
    setSilos(silosR.data || [])
    setSiloStats(statsR.data || [])
    setReadings(readingsR.data || [])
    setPrices(Object.fromEntries((pricesR.data || []).map(p => [p.material, p.price_per_tonne])))
    setGroups(groupsR.data || [])
    setLoading(false)
  }

  // Calculate real daily consumption per silo from historical readings
  const siloConsumption: Record<string, number> = useMemo(() => {
    const map: Record<string, Reading[]> = {}
    readings.forEach(r => {
      if (!map[r.silo_id]) map[r.silo_id] = []
      map[r.silo_id].push(r)
    })
    const result: Record<string, number> = {}
    Object.entries(map).forEach(([siloId, rds]) => {
      const sorted = [...rds].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      if (sorted.length < 2) {
        const silo = silos.find(s => s.id === siloId)
        result[siloId] = silo ? silo.capacity_kg * 0.02 : 400
        return
      }
      const consumed = sorted[0].kg_remaining - sorted[sorted.length-1].kg_remaining
      const days     = (new Date(sorted[sorted.length-1].recorded_at).getTime() - new Date(sorted[0].recorded_at).getTime()) / (1000 * 60 * 60 * 24)
      result[siloId] = days > 0 ? Math.max(50, consumed / days) : (silos.find(s => s.id === siloId)?.capacity_kg || 20000) * 0.02
    })
    return result
  }, [readings, silos])

  const silosWithStats = silos.map(s => ({
    ...s,
    stat:   siloStats.find(st => st.silo_id === s.id),
    kgDay:  siloConsumption[s.id] || s.capacity_kg * 0.02,
  })).filter(s => s.stat)

  const totalKgDay   = silosWithStats.reduce((sum, s) => sum + s.kgDay, 0)
  const totalCostDay = silosWithStats.reduce((sum, s) => sum + (s.kgDay / 1000 * (prices[s.material || ''] || 420)), 0)
  const totalCapKg   = silosWithStats.reduce((sum, s) => sum + s.capacity_kg, 0)
  const totalAnimals = groups.reduce((sum, g) => sum + g.count, 0)
  const avgLevelToday = silosWithStats.length > 0
    ? Math.round(silosWithStats.reduce((sum, s) => sum + (s.stat?.level_pct || 0), 0) / silosWithStats.length)
    : 0

  const projKgAtEnd      = silosWithStats.reduce((sum, s) => sum + Math.max(0, (s.stat?.kg_remaining || 0) - s.kgDay * horizon), 0)
  const criticalAtEnd    = silosWithStats.filter(s => {
    const projPct = Math.max(0, ((s.stat?.kg_remaining || 0) - s.kgDay * horizon) / s.capacity_kg * 100)
    return projPct <= 20
  }).length

  const { labels, consData, costData } = useMemo(() => {
    const labels: string[] = [], consData: number[] = [], costData: number[] = []
    const now = new Date()
    for (let i = 1; i <= horizon; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i)
      labels.push(d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }))
      consData.push(Math.round(totalKgDay))
      costData.push(Math.round(totalCostDay))
    }
    return { labels, consData, costData }
  }, [horizon, totalKgDay, totalCostDay])

  const scenarios = [
    { label: 'Base case',        color: '#4CAF7D', mult: 1.0,  cls: 'green' },
    { label: '+10% consumption', color: '#EF9F27', mult: 1.10, cls: 'amber' },
    { label: '+15% price spike', color: '#E24B4A', mult: 1.15, cls: 'red'   },
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
        <div>
          <div className="page-title">Forecast</div>
          <div className="page-sub">{currentFarm?.name} · Consumption & cost projections · Based on real sensor data</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, background: '#f0f4f0', borderRadius: 8, padding: 3, marginBottom: 20, width: 'fit-content' }}>
        {[7, 15, 30].map(h => (
          <button key={h} onClick={() => setHorizon(h)}
            style={{ padding: '8px 28px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: horizon === h ? '#1a2530' : 'transparent', color: horizon === h ? '#fff' : '#6a7a8a', transition: 'background 0.15s, color 0.15s' }}>
            {h} days
          </button>
        ))}
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Feed consumed</div><div className="sum-val">{(totalKgDay * horizon / 1000).toFixed(1)} t</div><div className="sum-sub">over {horizon} days</div></div>
        <div className="sum-card"><div className="sum-label">Projected cost</div><div className="sum-val">${Math.round(totalCostDay * horizon).toLocaleString()}</div><div className="sum-sub">at current prices</div></div>
        <div className="sum-card">
          <div className={`sum-val ${criticalAtEnd > 0 ? 'red' : 'green'}`} style={{ fontSize: 22, fontWeight: 500 }}>{criticalAtEnd}</div>
          <div className="sum-label">Critical at day {horizon}</div>
          <div className="sum-sub">{criticalAtEnd > 0 ? 'need restock' : 'all good'}</div>
        </div>
        <div className="sum-card"><div className="sum-label">Farm level at day {horizon}</div><div className="sum-val">{totalCapKg > 0 ? Math.round(projKgAtEnd / totalCapKg * 100) : 0}%</div><div className="sum-sub">vs {avgLevelToday}% today</div></div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Consumption forecast</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Next {horizon} days · {(totalKgDay/1000).toFixed(1)}t/day actual</span></div>
          <div style={{ height: 200, position: 'relative' }}>
            <Line
              data={{ labels, datasets: [{ label: 'Projected (kg)', data: consData, borderColor: '#4CAF7D', backgroundColor: 'rgba(76,175,125,0.08)', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 8, maxRotation: 0 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => v >= 1000 ? (v/1000).toFixed(1)+'t' : v }, border: { display: false } } } }}
            />
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Cost forecast</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Next {horizon} days · ${Math.round(totalCostDay)}/day</span></div>
          <div style={{ height: 200, position: 'relative' }}>
            <Bar
              data={{ labels, datasets: [{ label: 'Daily cost ($)', data: costData, backgroundColor: 'rgba(74,144,196,0.7)', borderRadius: 3 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 8, maxRotation: 0 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => '$'+Math.round(v) }, border: { display: false } } } }}
            />
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 16 }} />

      <div className="card">
        <div className="card-header"><div className="card-title">Silo-by-silo forecast</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Based on real consumption rates</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Silo', 'Material', 'Today', 'Day 7', 'Day 15', 'Day 30', 'Days left', 'Action'].map(h => (
              <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 500, padding: '0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {silosWithStats.map(s => {
              const p7  = Math.max(0, Math.round(Math.max(0, (s.stat?.kg_remaining || 0) - s.kgDay * 7)  / s.capacity_kg * 100))
              const p15 = Math.max(0, Math.round(Math.max(0, (s.stat?.kg_remaining || 0) - s.kgDay * 15) / s.capacity_kg * 100))
              const p30 = Math.max(0, Math.round(Math.max(0, (s.stat?.kg_remaining || 0) - s.kgDay * 30) / s.capacity_kg * 100))
              const days = Math.floor((s.stat?.kg_remaining || 0) / s.kgDay)
              return (
                <tr key={s.id}>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0', fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{s.name}</td>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0', fontSize: 11, color: '#8a9aaa' }}>{s.material}</td>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}><span style={{ fontSize: 13, fontWeight: 600, color: levelColor(s.stat?.level_pct || 0) }}>{(s.stat?.level_pct || 0).toFixed(0)}%</span></td>
                  {[p7, p15, p30].map((p, i) => (
                    <td key={i} style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0', textAlign: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: levelColor(p) }}>{p}%</span>
                    </td>
                  ))}
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10, background: days <= 7 ? '#FCEBEB' : days <= 14 ? '#FAEEDA' : '#eaf5ee', color: days <= 7 ? '#A32D2D' : days <= 14 ? '#633806' : '#27500A' }}>{days} days</span>
                  </td>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}>
                    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, fontWeight: 600, background: days <= 7 ? '#FCEBEB' : days <= 15 ? '#FAEEDA' : '#eaf5ee', color: days <= 7 ? '#A32D2D' : days <= 15 ? '#633806' : '#27500A' }}>
                      {days <= 7 ? 'Order now' : days <= 15 ? 'Monitor' : 'OK'}
                    </span>
                  </td>
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
            const costTotal     = Math.round(totalCostDay * sc.mult * horizon)
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
                  { k: 'Total cost',    v: `$${costTotal.toLocaleString()}`,   c: sc.cls },
                  { k: '$/animal/day', v: `$${costPerAnimal}`,                 c: sc.cls },
                  { k: 'Daily avg',    v: `$${Math.round(totalCostDay * sc.mult).toLocaleString()}` },
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
