'use client'
import { useState } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
ChartJS.register(ArcElement, Tooltip, Legend)

const MATERIALS = [
  { id: 'maize', name: 'Maize meal',   density: 600, color: '#4CAF7D', consumption: 38200 },
  { id: 'wheat', name: 'Wheat bran',   density: 380, color: '#4A90C4', consumption: 22800 },
  { id: 'soy',   name: 'Soybean meal', density: 590, color: '#EF9F27', consumption: 26100 },
  { id: 'barley',name: 'Barley',       density: 620, color: '#E24B4A', consumption: 13700 },
]

const GROUPS = [
  { name: 'Grower pigs', type: 'pig',     count: 850,  feedKgDay: 2.4, matId: 'maize' },
  { name: 'Sow herd',    type: 'pig',     count: 120,  feedKgDay: 3.1, matId: 'soy'   },
  { name: 'Broilers',    type: 'poultry', count: 4200, feedKgDay: 0.18,matId: 'wheat' },
  { name: 'Beef cattle', type: 'cattle',  count: 65,   feedKgDay: 8.2, matId: 'barley'},
]

export default function CostsPage() {
  const [prices, setPrices] = useState<Record<string, number>>({ maize: 420, wheat: 310, soy: 680, barley: 290 })
  const [counts, setCounts] = useState<Record<string, number>>({ 'Grower pigs': 850, 'Sow herd': 120, 'Broilers': 4200, 'Beef cattle': 65 })

  const rows = GROUPS.map(g => {
    const count = counts[g.name] || g.count
    const price = prices[g.matId] || 300
    const dailyFeed = count * g.feedKgDay
    const dailyCost = (dailyFeed / 1000) * price
    const costPerHead = g.feedKgDay * (price / 1000)
    return { ...g, count, dailyFeed, dailyCost, costPerHead }
  })
  const totalDaily = rows.reduce((s, r) => s + r.dailyCost, 0)
  const totalAnimals = rows.reduce((s, r) => s + r.count, 0)
  const maxCost = Math.max(...rows.map(r => r.dailyCost))

  const barColor = (cpp: number) => cpp > 1.5 ? '#E24B4A' : cpp > 0.8 ? '#EF9F27' : '#4CAF7D'

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Feed costs</div><div className="page-sub">Cost per animal · Daily spend · Monthly projection</div></div>
        <div className="page-actions"><button className="btn-outline">Export CSV</button></div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total this month</div><div className="sum-val">${Math.round(totalDaily * 30).toLocaleString()}</div><div className="sum-sub" style={{ color: '#A32D2D' }}>↑ +8.3% vs last month</div></div>
        <div className="sum-card"><div className="sum-label">Daily feed spend</div><div className="sum-val">${Math.round(totalDaily).toLocaleString()}</div><div className="sum-sub">avg last 30 days</div></div>
        <div className="sum-card"><div className="sum-label">Cost / animal / day</div><div className="sum-val green">${(totalDaily / totalAnimals).toFixed(2)}</div><div className="sum-sub">across all groups</div></div>
        <div className="sum-card"><div className="sum-label">Monthly projection</div><div className="sum-val">${Math.round(totalDaily * 30 * 1.08).toLocaleString()}</div><div className="sum-sub" style={{ color: '#A32D2D' }}>↑ projected</div></div>
      </div>

      {/* AI INSIGHT */}
      <div style={{ background: '#1a2530', borderRadius: 10, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(76,175,125,0.15)', border: '0.5px solid rgba(76,175,125,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 3 }}>Feed cost is ${(totalDaily / totalAnimals).toFixed(2)} per animal per day — {totalDaily / totalAnimals < 1.5 ? 'within normal range' : 'above seasonal average'}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Total farm spend: ${Math.round(totalDaily).toLocaleString()}/day · Edit prices or animal counts to recalculate</div>
        </div>
        <span style={{ background: 'rgba(76,175,125,0.18)', border: '0.5px solid rgba(76,175,125,0.3)', color: '#4CAF7D', fontSize: 10, padding: '2px 8px', borderRadius: 10 }}>PipeDream AI</span>
      </div>

      {/* PRICES */}
      <div className="card">
        <div className="card-header"><div className="card-title">Feed prices — set your current purchase price</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Edit to update all calculations</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          {MATERIALS.map(m => (
            <div key={m.id} style={{ background: '#f7f9f8', borderRadius: 8, padding: '14px 16px', border: '0.5px solid #e8ede9' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1a2530', marginBottom: 4 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: '#aab8c0', marginBottom: 10 }}>Density: {m.density} kg/m³</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: '#8a9aaa' }}>$</span>
                <input type="number" value={prices[m.id]} onChange={e => setPrices(p => ({ ...p, [m.id]: Number(e.target.value) }))} step={5} style={{ border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '6px 8px', fontSize: 14, fontWeight: 500, color: '#1a2530', background: '#fff', width: 80, fontFamily: 'inherit' }} />
                <span style={{ fontSize: 11, color: '#aab8c0' }}>/ tonne</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ANIMAL TABLE + PIE */}
      <div className="grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Cost per animal group</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Edit counts to recalculate</span></div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Group', 'Animals', 'Feed/day', '$/head/day', 'Daily cost', '30d cost'].map(h => <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 500, padding: '0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name}>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{r.name}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}><input type="number" value={r.count} onChange={e => setCounts(c => ({ ...c, [r.name]: Number(e.target.value) }))} step={10} style={{ border: '0.5px solid #e8ede9', borderRadius: 4, padding: '4px 8px', fontSize: 12, color: '#1a2530', background: '#f7f9f8', width: 64, fontFamily: 'inherit', textAlign: 'center' }} /></td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{Math.round(r.dailyFeed).toLocaleString()} kg</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, fontWeight: 500, color: '#27500A' }}>${r.costPerHead.toFixed(3)}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1a2530', minWidth: 60 }}>${Math.round(r.dailyCost).toLocaleString()}</span>
                      <div style={{ flex: 1, height: 4, background: '#f7f9f8', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: barColor(r.costPerHead), width: `${Math.round(r.dailyCost / maxCost * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, fontWeight: 500, color: '#27500A' }}>${Math.round(r.dailyCost * 30).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Cost breakdown by material</div></div>
          {MATERIALS.map(m => {
            const cost = (m.consumption / 1000) * (prices[m.id] || 300)
            const total = MATERIALS.reduce((s, x) => s + (x.consumption / 1000) * (prices[x.id] || 300), 0)
            const pct = Math.round(cost / total * 100)
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#1a2530', flex: 1 }}>{m.name}</span>
                <div style={{ width: 80, height: 4, background: '#f7f9f8', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: m.color, width: `${pct}%` }} />
                </div>
                <span style={{ fontSize: 11, color: '#aab8c0', width: 32 }}>{pct}%</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1a2530', width: 70, textAlign: 'right' }}>${Math.round(cost).toLocaleString()}</span>
              </div>
            )
          })}
          <div style={{ height: 160, position: 'relative', marginTop: 16 }}>
            <Doughnut data={{ labels: MATERIALS.map(m => m.name), datasets: [{ data: MATERIALS.map(m => Math.round((m.consumption / 1000) * (prices[m.id] || 300))), backgroundColor: MATERIALS.map(m => m.color), borderWidth: 0, hoverOffset: 4 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 8, padding: 8 } } } }} />
          </div>
        </div>
      </div>

      {/* PROJECTIONS */}
      <div className="card">
        <div className="card-header"><div className="card-title">Monthly cost projections</div></div>
        <div className="grid-3" style={{ marginBottom: 0 }}>
          {[
            { label: 'This month',      val: Math.round(totalDaily * 30), sub: 'At current rate' },
            { label: 'Next month est.', val: Math.round(totalDaily * 30 * 1.05), sub: '+5% seasonal adj.' },
            { label: 'Annual projection',val: Math.round(totalDaily * 365 * 1.04), sub: '4% avg price increase' },
          ].map(p => (
            <div key={p.label} style={{ background: '#f7f9f8', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>{p.label}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: '#1a2530', letterSpacing: -0.5 }}>${p.val.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 4 }}>{p.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
