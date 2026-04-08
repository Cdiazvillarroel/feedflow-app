'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

interface Farm     { id: string; name: string; location: string | null; lat: number | null; lng: number | null; feed_mill_id: string | null }
interface Silo     { id: string; farm_id: string; name: string; material: string | null; capacity_kg: number; qr_token: string | null }
interface SiloStat { silo_id: string; level_pct: number; kg_remaining: number; alert_level: string }
interface DeliveryOrder { id: string; farm_id: string; feed_mill_id: string; status: string; scheduled_at: string | null }
interface FeedMill { id: string; name: string }

export default function FarmMonitorPage() {
  const { visibleFarms: farms } = useFarm() 

  const [silos,     setSilos]     = useState<Silo[]>([])
  const [siloStats, setSiloStats] = useState<SiloStat[]>([])
  const [orders,    setOrders]    = useState<DeliveryOrder[]>([])
  const [feedMills, setFeedMills] = useState<FeedMill[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState<'all' | 'critical' | 'low' | 'ok'>('all')
  const [selected,  setSelected]  = useState<Farm | null>(null)

  // Use farms from context (already filtered by mill via sidebar)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [silosR, statsR, ordersR, millsR] = await Promise.all([
      supabase.from('silos').select('*').order('name'),
      supabase.from('silo_latest_readings').select('*'),
      supabase.from('delivery_orders').select('id, farm_id, feed_mill_id, status, scheduled_at').order('created_at', { ascending: false }),
      supabase.from('feed_mills').select('id, name'),
    ])
    setSilos(silosR.data || [])
    setSiloStats(statsR.data || [])
    setOrders(ordersR.data || [])
    setFeedMills(millsR.data || [])
    setLoading(false)
  }

  function getStat(siloId: string) { return siloStats.find(s => s.silo_id === siloId) }

  function getDays(siloId: string) {
    const stat = getStat(siloId)
    const silo = silos.find(s => s.id === siloId)
    if (!stat || !silo) return 999
    return Math.floor(stat.kg_remaining / (silo.capacity_kg * 0.02))
  }

  function getFarmData(farm: Farm) {
    const fs     = silos.filter(s => s.farm_id === farm.id)
    const stats  = fs.map(s => getStat(s.id)).filter(Boolean) as SiloStat[]
    const minDays = fs.length > 0 ? Math.min(...fs.map(s => getDays(s.id))) : 999
    const alertLevel = stats.some(s => s.alert_level === 'critical') ? 'critical'
      : stats.some(s => s.alert_level === 'low') ? 'low' : 'ok'
    const totalKg   = stats.reduce((sum, s) => sum + s.kg_remaining, 0)
    const totalCap  = fs.reduce((sum, s) => sum + s.capacity_kg, 0)
    const pendingOrder = orders.find(o => o.farm_id === farm.id && ['pending','planned','in_transit'].includes(o.status))
    return { fs, stats, minDays, alertLevel, totalKg, totalCap, pendingOrder, siloCount: fs.length }
  }

  const urgColor  = (a: string) => a === 'critical' ? '#E24B4A' : a === 'low' ? '#EF9F27' : '#4CAF7D'
  const urgBg     = (a: string) => a === 'critical' ? '#FCEBEB' : a === 'low' ? '#FAEEDA' : '#eaf5ee'
  const urgText   = (a: string) => a === 'critical' ? '#A32D2D' : a === 'low' ? '#633806' : '#27500A'
  const daysColor = (d: number) => d <= 7 ? '#A32D2D' : d <= 14 ? '#633806' : '#27500A'
  const millName  = (id: string) => feedMills.find(m => m.id === id)?.name || '—'

  const farmList = farms
    .map(farm => ({ farm, ...getFarmData(farm) }))
    .filter(({ farm, alertLevel }) => {
      const matchSearch = !search || farm.name.toLowerCase().includes(search.toLowerCase()) || (farm.location || '').toLowerCase().includes(search.toLowerCase())
      const matchFilter = filter === 'all' || alertLevel === filter
      return matchSearch && matchFilter
    })
    .sort((a, b) => a.minDays - b.minDays)

  const counts = {
    critical: farms.map(f => getFarmData(f)).filter(d => d.alertLevel === 'critical').length,
    low:      farms.map(f => getFarmData(f)).filter(d => d.alertLevel === 'low').length,
    ok:       farms.map(f => getFarmData(f)).filter(d => d.alertLevel === 'ok').length,
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4A90C4', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading farm monitor...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            {(() => {
              const { fs, stats, minDays, alertLevel, totalKg, totalCap, pendingOrder } = getFarmData(selected)
              return (
                <>
                  <div style={{ background: '#1a2530', padding: '24px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: urgBg(alertLevel), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: urgText(alertLevel), flexShrink: 0 }}>
                      {selected.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{selected.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>{selected.location || 'No address'}</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: daysColor(minDays) === '#A32D2D' ? '#EF9F27' : '#4CAF7D' }}>{minDays < 999 ? minDays : '—'}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>min days</div>
                        </div>
                        <div style={{ width: '0.5px', background: 'rgba(255,255,255,0.1)' }} />
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{fs.length}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>silos</div>
                        </div>
                        <div style={{ width: '0.5px', background: 'rgba(255,255,255,0.1)' }} />
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#4CAF7D' }}>{totalCap > 0 ? Math.round((totalKg / totalCap) * 100) : 0}%</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>avg fill</div>
                        </div>
                        <div style={{ width: '0.5px', background: 'rgba(255,255,255,0.1)' }} />
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{(totalKg / 1000).toFixed(0)}t</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>available</div>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: '50%', border: '0.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>

                  {pendingOrder && (
                    <div style={{ background: '#FAEEDA', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '0.5px solid #f0d0a0' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#633806" strokeWidth="1.8" strokeLinecap="round"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"/></svg>
                      <span style={{ fontSize: 12, color: '#633806', fontWeight: 600 }}>
                        {pendingOrder.status === 'in_transit' ? 'Delivery in transit' : 'Delivery scheduled'} — {millName(pendingOrder.feed_mill_id)}
                        {pendingOrder.scheduled_at ? ' · ' + new Date(pendingOrder.scheduled_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                  )}

                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Silo status</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {fs.map(silo => {
                        const stat  = getStat(silo.id)
                        const days  = getDays(silo.id)
                        const color = stat?.alert_level === 'critical' ? '#E24B4A' : stat?.alert_level === 'low' ? '#EF9F27' : '#4CAF7D'
                        const pct   = stat?.level_pct || 0
                        return (
                          <div key={silo.id} style={{ background: '#f7f9f8', borderRadius: 12, padding: '16px', border: '0.5px solid #e8ede9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2530' }}>{silo.name}</div>
                                <div style={{ fontSize: 11, color: '#8a9aaa', marginTop: 2 }}>{silo.material || '—'} · {(silo.capacity_kg/1000).toFixed(0)}t capacity</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 26, fontWeight: 700, color: daysColor(days) }}>{days < 999 ? days : '—'}</div>
                                <div style={{ fontSize: 10, color: '#aab8c0' }}>days left</div>
                              </div>
                            </div>
                            {stat ? (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{pct.toFixed(1)}%</span>
                                  <span style={{ fontSize: 12, color: '#8a9aaa' }}>{Math.round(stat.kg_remaining).toLocaleString()} kg remaining</span>
                                </div>
                                <div style={{ height: 8, background: '#e8ede9', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                                  <div style={{ height: '100%', borderRadius: 4, background: color, width: pct + '%', transition: 'width 0.4s ease' }} />
                                </div>
                                {stat.alert_level !== 'ok' && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 10px', borderRadius: 6, background: urgBg(stat.alert_level), color: urgText(stat.alert_level), fontWeight: 600 }}>
                                    {stat.alert_level === 'critical' ? '⚠️ Critical — restock urgently' : '⚡ Low — order soon'}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div style={{ fontSize: 12, color: '#aab8c0', padding: '8px 0' }}>No sensor data available</div>
                            )}
                            {silo.qr_token && (
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 11, color: '#aab8c0' }}>QR delivery scan</span>
                                <button onClick={() => navigator.clipboard.writeText(window.location.origin + '/confirm/' + silo.qr_token)}
                                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #c8d8cc', background: '#fff', cursor: 'pointer', color: '#4A90C4', fontFamily: 'inherit' }}>
                                  Copy QR link
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {fs.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: '#aab8c0', fontSize: 13 }}>No silos registered for this farm</div>}
                    </div>

                    <div style={{ marginTop: 24 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Recent orders</div>
                      {orders.filter(o => o.farm_id === selected.id).slice(0, 4).map(o => {
                        const sc: Record<string, { bg: string; color: string; label: string }> = {
                          pending:    { bg: '#FAEEDA', color: '#633806', label: 'Pending'    },
                          planned:    { bg: '#E6F1FB', color: '#0C447C', label: 'Planned'    },
                          in_transit: { bg: '#eaf5ee', color: '#27500A', label: 'In transit' },
                          delivered:  { bg: '#f0f4f0', color: '#6a7a8a', label: 'Delivered'  },
                          cancelled:  { bg: '#FCEBEB', color: '#A32D2D', label: 'Cancelled'  },
                        }
                        const s = sc[o.status] || sc.pending
                        return (
                          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: s.bg, color: s.color, fontWeight: 600, flexShrink: 0 }}>{s.label}</span>
                            <span style={{ fontSize: 12, color: '#1a2530', flex: 1 }}>{millName(o.feed_mill_id)}</span>
                            <span style={{ fontSize: 11, color: '#aab8c0' }}>{o.scheduled_at ? new Date(o.scheduled_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}</span>
                          </div>
                        )
                      })}
                      {orders.filter(o => o.farm_id === selected.id).length === 0 && (
                        <div style={{ fontSize: 12, color: '#aab8c0', padding: '10px 0' }}>No orders yet</div>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9' }}>
                    <a href="/dashboard/logistics/orders" style={{ display: 'block', width: '100%', padding: '11px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', textDecoration: 'none' }}>
                      + Create delivery order for this farm
                    </a>
                  </div>
                </>
              )
            })()}
          </div>
        </>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Farm Monitor</div>
          <div className="page-sub">{farms.length} farms · {counts.critical} critical · {counts.low} low · {counts.ok} ok</div>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card" onClick={() => setFilter('all')} style={{ cursor: 'pointer', borderBottom: filter === 'all' ? '2px solid #4A90C4' : '2px solid transparent' }}>
          <div className="sum-label">All farms</div>
          <div className="sum-val" style={{ color: '#4A90C4' }}>{farms.length}</div>
          <div className="sum-sub">Total monitored</div>
        </div>
        <div className="sum-card" onClick={() => setFilter('critical')} style={{ cursor: 'pointer', borderBottom: filter === 'critical' ? '2px solid #E24B4A' : '2px solid transparent' }}>
          <div className="sum-label">Critical</div>
          <div className="sum-val red">{counts.critical}</div>
          <div className="sum-sub">Restock urgently</div>
        </div>
        <div className="sum-card" onClick={() => setFilter('low')} style={{ cursor: 'pointer', borderBottom: filter === 'low' ? '2px solid #EF9F27' : '2px solid transparent' }}>
          <div className="sum-label">Low</div>
          <div className="sum-val" style={{ color: '#633806' }}>{counts.low}</div>
          <div className="sum-sub">Order soon</div>
        </div>
        <div className="sum-card" onClick={() => setFilter('ok')} style={{ cursor: 'pointer', borderBottom: filter === 'ok' ? '2px solid #4CAF7D' : '2px solid transparent' }}>
          <div className="sum-label">OK</div>
          <div className="sum-val green">{counts.ok}</div>
          <div className="sum-sub">No action needed</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '0 12px', marginBottom: 16, maxWidth: 340 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" placeholder="Search farm or location..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1a2530', background: 'transparent', width: '100%', padding: '9px 0' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 80px 80px 100px 120px 110px', gap: 12, padding: '0 16px 10px' }}>
        {['Farm', 'Feed level', 'Min days', 'Silos', 'Available', 'Status', 'Action'].map(h => (
          <div key={h} style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{h}</div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {farmList.map(({ farm, minDays, alertLevel, totalKg, totalCap, siloCount, pendingOrder }) => {
          const uc  = urgColor(alertLevel)
          const dc  = daysColor(minDays)
          const pct = totalCap > 0 ? Math.round((totalKg / totalCap) * 100) : 0
          return (
            <div key={farm.id} onClick={() => setSelected(farm)}
              style={{ display: 'grid', gridTemplateColumns: '200px 1fr 80px 80px 100px 120px 110px', gap: 12, alignItems: 'center', padding: '14px 16px', background: '#fff', borderRadius: 10, border: '0.5px solid #e8ede9', borderLeft: '3px solid ' + uc, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{farm.name}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>{farm.location || '—'}</div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: uc }}>{pct}%</span>
                  <span style={{ fontSize: 11, color: '#aab8c0' }}>{(totalKg/1000).toFixed(1)}t</span>
                </div>
                <div style={{ height: 6, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: uc, width: pct + '%' }} />
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: dc }}>{minDays < 999 ? minDays : '—'}</div>
                <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase' }}>days</div>
              </div>
              <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{siloCount}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1a2530' }}>{(totalKg/1000).toFixed(1)} t</div>
              <div>
                {pendingOrder ? (
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: pendingOrder.status === 'in_transit' ? '#eaf5ee' : '#E6F1FB', color: pendingOrder.status === 'in_transit' ? '#27500A' : '#0C447C', fontWeight: 600, display: 'inline-block' }}>
                    {pendingOrder.status === 'in_transit' ? '🚛 In transit' : '📋 Planned'}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: urgBg(alertLevel), color: urgText(alertLevel), fontWeight: 600, display: 'inline-block' }}>
                    {alertLevel === 'critical' ? '⚠️ Critical' : alertLevel === 'low' ? '⚡ Low' : '✓ OK'}
                  </span>
                )}
              </div>
              <div onClick={e => e.stopPropagation()}>
                <a href="/dashboard/logistics/orders"
                  style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '0.5px solid #4CAF7D', background: '#eaf5ee', color: '#27500A', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                  + Order
                </a>
              </div>
            </div>
          )
        })}
        {farmList.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No farms found</div>
            <div style={{ fontSize: 13 }}>Try changing the search or filter.</div>
          </div>
        )}
      </div>
    </>
  )
}
