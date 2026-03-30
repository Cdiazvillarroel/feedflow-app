'use client'
import { useState } from 'react'
import Link from 'next/link'
import { SILOS, levelColor, alertClass } from '@/lib/data'

export default function DashboardPage() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name')

  const critical = SILOS.filter(s => s.alert === 'critical').length
  const low = SILOS.filter(s => s.alert === 'low').length
  const totalKg = SILOS.reduce((s, x) => s + x.kg, 0)

  let filtered = SILOS
  if (filter !== 'all') filtered = filtered.filter(s => s.alert === filter)
  if (search) filtered = filtered.filter(s => s.name.toLowerCase().includes(search) || s.material.toLowerCase().includes(search))
  if (sort === 'level') filtered = [...filtered].sort((a, b) => a.pct - b.pct)
  else if (sort === 'days') filtered = [...filtered].sort((a, b) => a.days - b.days)
  else filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Silo Dashboard</div>
          <div className="page-sub">Granja Engorde · 15 sensors · Last sync 14 min ago</div>
        </div>
        <div className="page-actions">
          <button className="btn-outline">Export CSV</button>
          <Link href="/dashboard/alerts" className="btn-primary" style={{ display: 'inline-block', lineHeight: '1' }}>+ New alarm</Link>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total silos</div><div className="sum-val">15</div><div className="sum-sub">All sensors online</div></div>
        <div className="sum-card"><div className="sum-label">Critical (≤ 20%)</div><div className="sum-val red">{critical}</div><div className="sum-sub">Action required</div></div>
        <div className="sum-card"><div className="sum-label">Low (21–40%)</div><div className="sum-val" style={{ color: '#633806' }}>{low}</div><div className="sum-sub">Order soon</div></div>
        <div className="sum-card"><div className="sum-label">Total available</div><div className="sum-val green">{(totalKg / 1000).toFixed(1)} t</div><div className="sum-sub">Across all silos</div></div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '0 10px', flex: 1, maxWidth: 280 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search silo or material..." value={search} onChange={e => setSearch(e.target.value.toLowerCase())} style={{ border: 'none', outline: 'none', fontSize: 12, color: '#1a2530', background: 'transparent', width: '100%', padding: '7px 0' }} />
        </div>
        {['all', 'critical', 'low', 'ok'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
            {f === 'all' ? 'All (15)' : f === 'critical' ? 'Critical (2)' : f === 'low' ? 'Low (3)' : 'OK (10)'}
          </button>
        ))}
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#6a7a8a', background: '#fff', marginLeft: 'auto' }}>
          <option value="name">Sort: Name</option>
          <option value="level">Sort: Level (low first)</option>
          <option value="days">Sort: Days remaining</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 120px 130px 110px 100px', gap: 16, padding: '0 20px 8px', marginBottom: 2 }}>
        {['Silo / Material', 'Level', 'Days left', 'Sensor status', 'Last reading', ''].map(h => (
          <div key={h} style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 500 }}>{h}</div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(s => (
          <Link key={s.id} href={`/dashboard/silo/${s.id}`} style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', display: 'grid', gridTemplateColumns: '200px 1fr 120px 130px 110px 100px', gap: 16, alignItems: 'center', textDecoration: 'none', border: `0.5px solid #e8ede9`, borderLeft: `3px solid ${s.alert === 'critical' ? '#E24B4A' : s.alert === 'low' ? '#EF9F27' : '#4CAF7D'}` }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2530' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#8a9aaa' }}>{s.material}</div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#1a2530' }}>{s.pct}%</span>
                <span style={{ fontSize: 11, color: '#8a9aaa' }}>{s.kg.toLocaleString()} kg</span>
              </div>
              <div style={{ height: 6, background: '#f7f9f8', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: levelColor(s.pct), width: `${s.pct}%` }} />
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: s.days <= 7 ? '#A32D2D' : s.days <= 14 ? '#633806' : '#27500A' }}>{s.days}</div>
              <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.3px' }}>days left</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.status === 'ok' ? '#4CAF7D' : s.status === 'warn' ? '#EF9F27' : '#E24B4A' }} />
              <div style={{ fontSize: 11, color: '#8a9aaa' }}>{s.status === 'ok' ? 'Online' : s.status === 'warn' ? 'Delayed' : 'Offline'}</div>
            </div>
            <div style={{ fontSize: 11, color: '#aab8c0', textAlign: 'right' }}>{s.reading}</div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, color: '#4CAF7D', fontWeight: 500 }}>View →</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
