'use client'
import { useEffect, useRef, useState } from 'react'
import { SILOS } from '@/lib/data'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

const materials = [
  { name: 'Maize meal',   color: '#4CAF7D', consumption: 38200, priceT: 420 },
  { name: 'Wheat bran',   color: '#4A90C4', consumption: 22800, priceT: 310 },
  { name: 'Soybean meal', color: '#EF9F27', consumption: 26100, priceT: 680 },
  { name: 'Barley',       color: '#E24B4A', consumption: 13700, priceT: 290 },
]

function genDays(n: number) {
  const labels: string[] = [], consumed: number[] = [], delivered: number[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }))
    consumed.push(Math.round(2400 + Math.random() * 900))
    delivered.push([4, 8, 15, 22].includes(n - 1 - i) ? Math.round(8000 + Math.random() * 5000) : 0)
  }
  return { labels, consumed, delivered }
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(30)
  const { labels, consumed, delivered } = genDays(period)

  const predictions = [
    { silo: 'Silo 1', material: 'Maize meal', emptyDate: 'Apr 3',  days: 4,  consumption: '420 kg/day', order: '12,000 kg', urg: 'critical' },
    { silo: 'Silo 2', material: 'Wheat bran', emptyDate: 'Apr 5',  days: 6,  consumption: '380 kg/day', order: '10,500 kg', urg: 'critical' },
    { silo: 'Silo 3', material: 'Soybean meal', emptyDate: 'Apr 8', days: 9, consumption: '310 kg/day', order: '11,000 kg', urg: 'high' },
    { silo: 'Silo 4', material: 'Maize meal', emptyDate: 'Apr 11', days: 12, consumption: '290 kg/day', order: '9,800 kg',  urg: 'high' },
    { silo: 'Silo 5', material: 'Barley',     emptyDate: 'Apr 14', days: 15, consumption: '260 kg/day', order: '8,400 kg',  urg: 'medium' },
  ]

  const urgStyle = (u: string) => u === 'critical'
    ? { background: '#FCEBEB', color: '#A32D2D' }
    : u === 'high' ? { background: '#FAEEDA', color: '#633806' }
    : { background: '#eaf5ee', color: '#27500A' }

  const siloRank = [...SILOS].sort((a, b) => b.kgDay - a.kgDay).slice(0, 7)
  const maxKgDay = siloRank[0]?.kgDay || 1

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-sub">Consumption trends, deliveries and AI predictions</div>
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
        <div className="sum-card"><div className="sum-label">Total consumed</div><div className="sum-val">84.2 t</div><div className="sum-sub" style={{ color: '#A32D2D' }}>↑ +8.3% vs prev period</div></div>
        <div className="sum-card"><div className="sum-label">Daily avg</div><div className="sum-val">2,807 kg</div><div className="sum-sub" style={{ color: '#A32D2D' }}>↑ +6.1%</div></div>
        <div className="sum-card"><div className="sum-label">Deliveries</div><div className="sum-val green">4</div><div className="sum-sub">Same as prev period</div></div>
        <div className="sum-card"><div className="sum-label">Total delivered</div><div className="sum-val">112.0 t</div><div className="sum-sub" style={{ color: '#27500A' }}>↓ −4.2%</div></div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Farm consumption & deliveries</div></div>
          <div style={{ height: 220, position: 'relative' }}>
            <Bar data={{ labels, datasets: [
              { label: 'Consumed (kg)', data: consumed, backgroundColor: 'rgba(76,175,125,0.7)', borderRadius: 3 },
              { label: 'Delivered (kg)', data: delivered, backgroundColor: 'rgba(74,144,196,0.8)', borderRadius: 3 },
            ]}} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { size: 11 }, boxWidth: 10 } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxTicksLimit: 10, maxRotation: 0 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => v >= 1000 ? (v/1000).toFixed(0)+'t' : v }, border: { display: false } } } }} />
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Consumption by material</div></div>
          <div style={{ height: 220, position: 'relative' }}>
            <Doughnut data={{ labels: materials.map(m => m.name), datasets: [{ data: materials.map(m => m.consumption), backgroundColor: materials.map(m => m.color), borderWidth: 0, hoverOffset: 4 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 10, padding: 10 } } } }} />
          </div>
        </div>
      </div>

      {/* SILO RANKING */}
      <div className="card">
        <div className="card-header"><div className="card-title">Consumption ranking — silos</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Last 30 days</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {siloRank.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: '#aab8c0', width: 16, textAlign: 'right' }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: '#1a2530', width: 56, flexShrink: 0 }}>{s.name}</span>
              <div style={{ flex: 1, height: 6, background: '#f7f9f8', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: '#4CAF7D', width: `${Math.round(s.kgDay / maxKgDay * 100)}%` }} />
              </div>
              <span style={{ fontSize: 11, color: '#8a9aaa', width: 70, textAlign: 'right' }}>{(s.kgDay * 30).toLocaleString()} kg</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI PREDICTIONS */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">AI restock predictions — next 30 days</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#aab8c0' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF7D' }} /> PipeDream AI engine
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
          {predictions.map(p => {
            const us = urgStyle(p.urg)
            const dColor = p.days <= 7 ? '#A32D2D' : p.days <= 14 ? '#633806' : '#27500A'
            return (
              <div key={p.silo} style={{ borderRadius: 10, padding: '16px 14px', background: us.background, border: `0.5px solid ${us.color}33`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: us.background, color: us.color, border: `0.5px solid ${us.color}66`, width: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{p.urg}</span>
                <div style={{ fontSize: 16, fontWeight: 500, color: '#1a2530' }}>{p.silo}</div>
                <div style={{ fontSize: 12, color: '#8a9aaa' }}>{p.material}</div>
                <div style={{ height: '0.5px', background: 'rgba(0,0,0,0.08)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: '#8a9aaa' }}>Empty by</span><span style={{ fontSize: 12, fontWeight: 500, color: dColor }}>{p.emptyDate}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: '#8a9aaa' }}>Days left</span><span style={{ fontSize: 12, fontWeight: 500, color: dColor }}>{p.days}d</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: '#8a9aaa' }}>Daily use</span><span style={{ fontSize: 12, fontWeight: 500, color: '#1a2530' }}>{p.consumption}</span></div>
                <div style={{ height: '0.5px', background: 'rgba(0,0,0,0.08)' }} />
                <div style={{ fontSize: 10, color: '#8a9aaa' }}>Suggested order</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#27500A' }}>{p.order}</div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
