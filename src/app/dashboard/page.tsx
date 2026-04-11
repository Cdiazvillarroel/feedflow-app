'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

interface Silo {
  id: string; name: string; material: string | null; capacity_kg: number
  lat: number | null; lng: number | null; farm_id: string
}
interface Reading {
  silo_id: string; level_pct: number; kg_remaining: number; recorded_at: string
}
interface Sensor {
  silo_id: string; status: string; battery_pct: number; signal_strength: number
}
interface SiloRow extends Silo {
  level_pct: number; kg_remaining: number; days_remaining: number
  hours_since_reading: number; alert_level: string; sensor: Sensor | null
}
interface AIInsight {
  insights: { dashboard?: string; critical_action?: string }
}

function levelColor(pct: number) { return pct <= 20 ? '#E24B4A' : pct <= 40 ? '#EF9F27' : '#4CAF7D' }
function borderColor(alert: string) { return alert === 'critical' ? '#E24B4A' : alert === 'low' ? '#EF9F27' : '#4CAF7D' }

export default function DashboardPage() {
  const { currentFarm } = useFarm()
  const farmId = currentFarm?.id || ''

  const [silos,   setSilos]   = useState<SiloRow[]>([])
  const [insight, setInsight] = useState<AIInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [search,  setSearch]  = useState('')
  const [sort,    setSort]    = useState('level')
  const [drawer,  setDrawer]  = useState<SiloRow | null>(null)

  useEffect(() => {
    if (farmId) {
      loadAll()
    } else {
      setLoading(false)
    }
  }, [farmId])

  async function loadAll() {
    setLoading(true)
    const [silosR, insightR] = await Promise.all([
      supabase.from('silos').select('*').eq('farm_id', farmId).order('name'),
      supabase.from('ai_insights').select('insights').eq('farm_id', farmId)
        .order('insight_date', { ascending: false }).limit(1).maybeSingle(),
    ])

    const silosData: Silo[] = silosR.data || []
    if (silosData.length === 0) { setSilos([]); setLoading(false); return }

    const siloIds = silosData.map(s => s.id)
    const [readingsR, sensorsR] = await Promise.all([
      supabase.from('readings').select('silo_id, level_pct, kg_remaining, recorded_at')
        .in('silo_id', siloIds).order('recorded_at', { ascending: false }),
      supabase.from('sensors').select('silo_id, status, battery_pct, signal_strength')
        .in('silo_id', siloIds),
    ])

    const latestMap: Record<string, Reading> = {}
    ;(readingsR.data || []).forEach(r => { if (!latestMap[r.silo_id]) latestMap[r.silo_id] = r })
    const sensorMap: Record<string, Sensor> = {}
    ;(sensorsR.data || []).forEach(s => { sensorMap[s.silo_id] = s })

    const now = Date.now()
    const enriched: SiloRow[] = silosData.map(s => {
      const r = latestMap[s.id]
      const level_pct           = r?.level_pct    || 0
      const kg_remaining        = r?.kg_remaining  || 0
      const kgDay               = s.capacity_kg * 0.02
      const days_remaining      = kgDay > 0 ? Math.floor(kg_remaining / kgDay) : 0
      const hours_since_reading = r ? (now - new Date(r.recorded_at).getTime()) / 3600000 : 999
      const alert_level         = level_pct <= 20 ? 'critical' : level_pct <= 40 ? 'low' : 'ok'
      return { ...s, level_pct, kg_remaining, days_remaining, hours_since_reading, alert_level, sensor: sensorMap[s.id] || null }
    })

    setSilos(enriched)
    setInsight(insightR.data || null)
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let data = [...silos]
    if (filter !== 'all') data = data.filter(s => s.alert_level === filter)
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(s => s.name.toLowerCase().includes(q) || (s.material || '').toLowerCase().includes(q))
    }
    if (sort === 'level') data.sort((a, b) => a.level_pct - b.level_pct)
    else if (sort === 'days') data.sort((a, b) => a.days_remaining - b.days_remaining)
    else data.sort((a, b) => a.name.localeCompare(b.name))
    return data
  }, [silos, filter, search, sort])

  const critical = silos.filter(s => s.alert_level === 'critical').length
  const low      = silos.filter(s => s.alert_level === 'low').length
  const totalKg  = silos.reduce((sum, s) => sum + s.kg_remaining, 0)
  const avgLevel = silos.length > 0 ? Math.round(silos.reduce((s, x) => s + x.level_pct, 0) / silos.length) : 0
  const onlineSensors = silos.filter(s => s.sensor?.status === 'online').length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        Loading dashboard...
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!farmId) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ textAlign: 'center', color: '#8a9aaa' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🌾</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2530', marginBottom: 8 }}>Select a farm</div>
        <div style={{ fontSize: 13 }}>Choose a farm from the sidebar to view its dashboard.</div>
      </div>
    </div>
  )

  return (
    <>
      {/* SILO DRAWER */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 440, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: levelColor(drawer.level_pct) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={levelColor(drawer.level_pct)} strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2530' }}>{drawer.name}</div>
                <div style={{ fontSize: 12, color: '#aab8c0', marginTop: 2 }}>{drawer.material || '—'} · {currentFarm?.name}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#1a2530', borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Current level</div>
                    <div style={{ fontSize: 44, fontWeight: 700, color: levelColor(drawer.level_pct), letterSpacing: -2 }}>{drawer.level_pct.toFixed(1)}%</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Days remaining</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: drawer.days_remaining <= 7 ? '#E24B4A' : drawer.days_remaining <= 14 ? '#EF9F27' : '#4CAF7D' }}>{drawer.days_remaining}</div>
                  </div>
                </div>
                <div style={{ height: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 5, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', background: levelColor(drawer.level_pct), borderRadius: 5, width: `${drawer.level_pct}%`, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  <span>0%</span><span>50%</span><span>100%</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Feed available', val: `${Math.round(drawer.kg_remaining).toLocaleString()} kg` },
                  { label: 'Capacity',       val: `${Math.round(drawer.capacity_kg).toLocaleString()} kg` },
                  { label: 'Material',       val: drawer.material || '—' },
                  { label: 'Last reading',   val: drawer.hours_since_reading < 1 ? 'Just now' : drawer.hours_since_reading < 24 ? `${Math.round(drawer.hours_since_reading)}h ago` : `${Math.round(drawer.hours_since_reading / 24)}d ago` },
                ].map(r => (
                  <div key={r.label} style={{ background: '#f7f9f8', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>{r.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{r.val}</div>
                  </div>
                ))}
              </div>

              {drawer.sensor && (
                <div style={{ background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Sensor</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: drawer.sensor.status === 'online' ? '#4CAF7D' : drawer.sensor.status === 'delayed' ? '#EF9F27' : '#E24B4A', margin: '0 auto 4px' }} />
                      <div style={{ fontSize: 11, color: '#1a2530', fontWeight: 600, textTransform: 'capitalize' }}>{drawer.sensor.status}</div>
                      <div style={{ fontSize: 10, color: '#aab8c0' }}>Status</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: drawer.sensor.battery_pct >= 70 ? '#27500A' : drawer.sensor.battery_pct >= 40 ? '#633806' : '#A32D2D' }}>{drawer.sensor.battery_pct}%</div>
                      <div style={{ fontSize: 10, color: '#aab8c0' }}>Battery</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'flex-end', marginBottom: 4 }}>
                        {[1,2,3].map(b => <div key={b} style={{ width: 4, height: b*5, borderRadius: 1, background: b <= drawer.sensor!.signal_strength ? '#4CAF7D' : '#e8ede9' }} />)}
                      </div>
                      <div style={{ fontSize: 10, color: '#aab8c0' }}>Signal</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ background: '#f7f9f8', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Consumption estimate</div>
                {[
                  { k: 'Daily consumption',    v: `${Math.round(drawer.capacity_kg * 0.02).toLocaleString()} kg/day` },
                  { k: 'Weekly consumption',   v: `${Math.round(drawer.capacity_kg * 0.02 * 7).toLocaleString()} kg` },
                  { k: 'Order needed (to 85%)', v: `${Math.round(Math.max(0, drawer.capacity_kg * 0.85 - drawer.kg_remaining)).toLocaleString()} kg` },
                ].map(r => (
                  <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #e8ede9' }}>
                    <span style={{ fontSize: 12, color: '#8a9aaa' }}>{r.k}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2530' }}>{r.v}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 10, background: drawer.alert_level === 'critical' ? '#FCEBEB' : drawer.alert_level === 'low' ? '#FAEEDA' : '#eaf5ee', border: `0.5px solid ${borderColor(drawer.alert_level)}33` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: borderColor(drawer.alert_level), textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                  {drawer.alert_level === 'critical' ? '🚨 Critical' : drawer.alert_level === 'low' ? '⚠ Low level' : '✓ Normal'}
                </div>
                <div style={{ fontSize: 12, color: borderColor(drawer.alert_level) }}>
                  {drawer.alert_level === 'critical' ? `Only ${drawer.days_remaining} days remaining. Order feed immediately.` : drawer.alert_level === 'low' ? `${drawer.days_remaining} days remaining. Plan a delivery soon.` : `${drawer.days_remaining} days remaining. No action required.`}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* HEADER */}
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">{currentFarm?.name} · {silos.length} silos · Live data</div>
        </div>
        <div className="page-actions">
          {critical > 0 && (
            <div style={{ padding: '7px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#A32D2D' }}>
              ⚠ {critical} critical silo{critical > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total silos</div><div className="sum-val">{silos.length}</div><div className="sum-sub">This farm</div></div>
        <div className="sum-card"><div className="sum-label">Critical (≤ 20%)</div><div className="sum-val red">{critical}</div><div className="sum-sub">{critical > 0 ? 'Action required' : 'All good'}</div></div>
        <div className="sum-card"><div className="sum-label">Low (21–40%)</div><div className="sum-val" style={{ color: '#633806' }}>{low}</div><div className="sum-sub">{low > 0 ? 'Order soon' : 'All good'}</div></div>
        <div className="sum-card"><div className="sum-label">Total available</div><div className="sum-val green">{(totalKg/1000).toFixed(1)} t</div><div className="sum-sub">Avg {avgLevel}% fill</div></div>
        <div className="sum-card"><div className="sum-label">Sensors online</div><div className="sum-val" style={{ color: '#4A90C4' }}>{onlineSensors}</div><div className="sum-sub">of {silos.length} total</div></div>
      </div>

      {/* AI INSIGHT BANNER */}
      {insight?.insights?.dashboard && (
        <div style={{ background: '#1a2530', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(76,175,125,0.15)', border: '0.5px solid rgba(76,175,125,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4CAF7D', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>AI Daily Insight</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{insight.insights.dashboard}</div>
            {insight.insights.critical_action && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 6, borderLeft: '2px solid #4CAF7D' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#4CAF7D', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Action · </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{insight.insights.critical_action}</span>
              </div>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'rgba(76,175,125,0.15)', color: '#4CAF7D', border: '0.5px solid rgba(76,175,125,0.3)', flexShrink: 0 }}>Claude AI</span>
        </div>
      )}

      {/* FILTER BAR */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '0 10px', flex: 1, maxWidth: 260 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search silo or material..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 12, color: '#1a2530', background: 'transparent', width: '100%', padding: '7px 0' }} />
        </div>
        {['all','critical','low','ok'].map(f => {
          const count  = f === 'all' ? silos.length : silos.filter(s => s.alert_level === f).length
          const active = filter === f
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid', fontWeight: active ? 600 : 400, fontFamily: 'inherit', borderColor: active ? '#1a2530' : '#e8ede9', background: active ? '#1a2530' : '#fff', color: active ? '#fff' : '#6a7a8a' }}>
              {f === 'all' ? `All (${count})` : f === 'critical' ? `⚠ Critical (${count})` : f === 'low' ? `Low (${count})` : `OK (${count})`}
            </button>
          )
        })}
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#6a7a8a', background: '#fff', marginLeft: 'auto', fontFamily: 'inherit' }}>
          <option value="level">Sort: Level (low first)</option>
          <option value="days">Sort: Days remaining</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* SILO LIST */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#1a2530', marginBottom: 8 }}>No silos found</div>
          <div style={{ fontSize: 13 }}>Try changing the filters or search term.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 90px 100px 110px 70px', gap: 12, padding: '0 16px 8px' }}>
            {['Silo / Material', 'Level', 'Days left', 'Sensor', 'Last reading', ''].map(h => (
              <div key={h} style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{h}</div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(s => (
              <button key={s.id} onClick={() => setDrawer(s)}
                style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', display: 'grid', gridTemplateColumns: '180px 1fr 90px 100px 110px 70px', gap: 12, alignItems: 'center', border: '0.5px solid #e8ede9', borderLeft: `3px solid ${borderColor(s.alert_level)}`, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafdfb'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#8a9aaa' }}>{s.material || '—'}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: levelColor(s.level_pct) }}>{s.level_pct.toFixed(1)}%</span>
                    <span style={{ fontSize: 11, color: '#aab8c0' }}>{Math.round(s.kg_remaining).toLocaleString()} kg</span>
                  </div>
                  <div style={{ height: 6, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: levelColor(s.level_pct), width: `${s.level_pct}%` }} />
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.days_remaining <= 7 ? '#A32D2D' : s.days_remaining <= 14 ? '#633806' : '#27500A' }}>{s.days_remaining}</div>
                  <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase' }}>days</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.sensor?.status === 'online' ? '#4CAF7D' : s.sensor?.status === 'delayed' ? '#EF9F27' : '#E24B4A' }} />
                  <div style={{ fontSize: 11, color: '#8a9aaa' }}>{s.sensor ? (s.sensor.status === 'online' ? 'Online' : s.sensor.status === 'delayed' ? 'Delayed' : 'Offline') : 'No sensor'}</div>
                </div>
                <div style={{ fontSize: 11, color: '#aab8c0', textAlign: 'center' }}>
                  {s.hours_since_reading < 1 ? 'Just now' : s.hours_since_reading < 24 ? `${Math.round(s.hours_since_reading)}h ago` : `${Math.round(s.hours_since_reading / 24)}d ago`}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, color: '#4CAF7D', fontWeight: 600 }}>View →</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
