'use client'
import { useState } from 'react'
import { SILOS, levelColor } from '@/lib/data'
import { Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

const totalKgDay = SILOS.reduce((s, x) => s + x.kgDay, 0)
const totalCostDay = SILOS.reduce((s, x) => s + (x.kgDay / 1000 * x.priceT), 0)
const totalCapKg = SILOS.reduce((s, x) => s + (x.kg / x.pct * 100), 0)

function projPct(silo: typeof SILOS[0], days: number) {
  const remaining = Math.max(0, silo.kg - silo.kgDay * days)
  const cap = silo.kg / silo.pct * 100
  return Math.max(0, Math.round(remaining / cap * 100))
}

function genForecast(horizon: number) {
  const labels: string[] = [], cons: number[] = [], costs: number[] = []
  const now = new Date()
  for (let i = 1; i <= horizon; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i)
    labels.push(d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }))
    const v = 0.92 + Math.random() * 0.16
    cons.push(Math.round(totalKgDay * v))
    costs.push(Math.round(totalCostDay * v))
  }
  return { labels, cons, costs }
}

export default function ForecastPage() {
  const [horizon, setHorizon] = useState(7)
  const { labels, cons, costs } = genForecast(horizon)

  const projKg = SILOS.reduce((s, x) => s + Math.max(0, x.kg - x.kgDay * horizon), 0)
  const criticalAtEnd = SILOS.filter(x => projPct(x, horizon) <= 20).length
  const avgDays = Math.round(SILOS.reduce((s, x) => s + Math.floor(x.kg / x.kgDay), 0) / SILOS.length)
  const urgentSilos = SILOS.filter(x => Math.floor(x.kg / x.kgDay) <= horizon).length

  const scenarios = [
    { label: '+0% (Base)', color: '#4CAF7D', name: 'Current consumption', mult: 1.0, cls: 'green' },
    { label: '+10% consumption', color: '#EF9F27', name: 'Increased consumption', mult: 1.10, cls: 'amber' },
    { label: '+15% price spike', color: '#E24B4A', name: 'Feed price spike', mult: 1.15, cls: 'red' },
  ]

  const urgColor = (d: number) => d <= 7 ? '#A32D2D' : d <= 15 ? '#633806' : '#27500A'
  const urgBg = (d: number) => d <= 7 ? '#FCEBEB' : d <= 15 ? '#FAEEDA' : '#eaf5ee'

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Forecast</div><div className="page-sub">AI-powered consumption & cost projections · Granja Engorde</div></div>
        <div className="page-actions"><button className="btn-outline">Export report</button></div>
      </div>

      {/* HORIZON */}
      <div style={{ display: 'flex', gap: 0, background: '#f7f9f8', borderRadius: 8, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {[7, 15, 30].map(h => (
          <button key={h} onClick={() => setHorizon(h)} style={{ padding: '8px 24px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', background: horizon === h ? '#1a2530' : 'transparent', color: horizon === h ? '#fff' : '#6a7a8a', fontFamily: 'inherit' }}>{h} days</button>
        ))}
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total consumed</div><div className="sum-val">{Math.round(totalKgDay * horizon / 1000)} t</div><div className="sum-sub">over {horizon} days</div></div>
        <div className="sum-card"><div className="sum-label">Projected cost</div><div className="sum-val">${Math.round(totalCostDay * horizon).toLocaleString()}</div><div className="sum-sub">at current prices</div></div>
        <div className="sum-card"><div className="sum-label">Silos critical at end</div><div className={`sum-val ${criticalAtEnd > 2 ? 'red' : criticalAtEnd > 0 ? 'amber' : 'green'}`}>{criticalAtEnd}</div><div className="sum-sub">{criticalAtEnd > 0 ? 'need restock' : 'all good'}</div></div>
        <div className="sum-card"><div className="sum-label">Farm level at day {horizon}</div><div className="sum-val">{Math.round(projKg / totalCapKg * 100)}%</div><div className="sum-sub">vs {Math.round(SILOS.reduce((s, x) => s + x.pct, 0) / SILOS.length)}% today</div></div>
      </div>

      {/* AI BANNER */}
      <div style={{ background: '#1a2530', borderRadius: 10, padding: '18px 22px', marginBottom: 16, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(76,175,125,0.15)', border: '0.5px solid rgba(76,175,125,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 4 }}>{urgentSilos > 0 ? `${urgentSilos} silo${urgentSilos > 1 ? 's' : ''} will reach critical levels within ${horizon} days — schedule deliveries now` : `All silos have sufficient feed beyond the ${horizon}-day horizon`}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Avg daily consumption: {Math.round(totalKgDay).toLocaleString()} kg/day · Projected spend: ${Math.round(totalCostDay * horizon).toLocaleString()} · Avg silo lifespan: {avgDays} days</div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { val: urgentSilos, lbl: 'urgent silos', c: urgentSilos > 0 ? '#F09595' : '#4CAF7D' },
            { val: `$${Math.round(totalCostDay * horizon / 1000)}k`, lbl: 'projected cost', c: '#FAC775' },
            { val: `${avgDays}d`, lbl: 'avg lifespan', c: '#4CAF7D' },
          ].map(s => (
            <div key={s.lbl} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 500, color: s.c }}>{s.val}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Consumption forecast</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Next {horizon} days</span></div>
          <div style={{ height: 200, position: 'relative' }}>
            <Line data={{ labels, datasets: [{ label: 'Projected (kg)', data: cons, borderColor: '#4CAF7D', backgroundColor: 'rgba(76,175,125,0.08)', borderWidth: 2, pointRadius: 2, fill: true, tension: 0.3 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 8, maxRotation: 0 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => v >= 1000 ? (v/1000).toFixed(1)+'t' : v }, border: { display: false } } } }} />
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Cost forecast</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Next {horizon} days</span></div>
          <div style={{ height: 200, position: 'relative' }}>
            <Bar data={{ labels, datasets: [{ label: 'Daily cost ($)', data: costs, backgroundColor: 'rgba(74,144,196,0.7)', borderRadius: 3 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 8, maxRotation: 0 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => '$'+v }, border: { display: false } } } }} />
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 16 }} />

      {/* SILO TABLE */}
      <div className="card">
        <div className="card-header"><div className="card-title">Silo-by-silo forecast</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Projected levels at end of each horizon</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Silo', 'Current', 'At day 7', 'At day 15', 'At day 30', 'Days left', 'Action'].map(h => <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 500, padding: '0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>)}</tr></thead>
          <tbody>
            {SILOS.map(s => {
              const p7 = projPct(s, 7), p15 = projPct(s, 15), p30 = projPct(s, 30)
              const days = Math.floor(s.kg / s.kgDay)
              const urgent = days <= 7
              return (
                <tr key={s.id}>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}><div style={{ fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{s.name}</div><div style={{ fontSize: 11, color: '#aab8c0' }}>{s.material}</div></td>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}><span style={{ fontSize: 13, fontWeight: 500, color: levelColor(s.pct) }}>{s.pct}%</span></td>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0', textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 500, color: levelColor(p7) }}>{p7}%</div></td>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0', textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 500, color: levelColor(p15) }}>{p15}%</div></td>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0', textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 500, color: levelColor(p30) }}>{p30}%</div></td>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}><span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: urgBg(days), color: urgColor(days) }}>{days} days</span></td>
                  <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}><span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: urgent ? '#FCEBEB' : days <= 15 ? '#FAEEDA' : '#eaf5ee', color: urgent ? '#A32D2D' : days <= 15 ? '#633806' : '#27500A', fontWeight: 500 }}>{urgent ? 'Order now' : days <= 15 ? 'Monitor' : 'OK'}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* SCENARIOS */}
      <div className="card">
        <div className="card-header"><div className="card-title">Cost scenarios — next {horizon} days</div></div>
        <div className="grid-3" style={{ marginBottom: 0 }}>
          {scenarios.map((sc, i) => (
            <div key={sc.label} style={{ borderRadius: 10, padding: 18, border: `0.5px solid ${i === 0 ? '#4CAF7D' : '#e8ede9'}`, background: i === 0 ? '#f4fbf7' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color }} />
                <span style={{ fontSize: 10, fontWeight: 500, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{sc.label}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 12 }}>{sc.name}</div>
              <div style={{ height: '0.5px', background: '#e8ede9', marginBottom: 12 }} />
              {[
                { k: 'Total consumed', v: `${Math.round(totalKgDay * sc.mult * horizon / 1000 * 10) / 10} t` },
                { k: 'Total cost', v: `$${Math.round(totalCostDay * sc.mult * horizon).toLocaleString()}`, c: sc.cls },
                { k: '$/animal/day', v: `$${(totalCostDay * sc.mult / 5235).toFixed(2)}`, c: sc.cls },
                { k: 'Silos going critical', v: `${SILOS.filter(x => Math.floor(x.kg / (x.kgDay * (sc.mult > 1.05 ? sc.mult : 1))) <= horizon).length} silos` },
              ].map(r => (
                <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontSize: 11, color: '#8a9aaa' }}>{r.k}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: r.c === 'green' ? '#27500A' : r.c === 'amber' ? '#633806' : r.c === 'red' ? '#A32D2D' : '#1a2530' }}>{r.v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
