'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface FeedMill { id: string; name: string; location: string | null; lat: number | null; lng: number | null }
interface Farm     { id: string; name: string; location: string | null; lat: number | null; lng: number | null }
interface Silo     { id: string; farm_id: string; name: string; material: string | null; capacity_kg: number }
interface SiloStat { silo_id: string; level_pct: number; kg_remaining: number; alert_level: string }
interface Driver   { id: string; name: string; feed_mill_id: string }
interface Truck    { id: string; name: string; plate: string | null; capacity_kg: number; feed_mill_id: string }
interface DeliveryRoute {
  id: string; feed_mill_id: string; driver_id: string | null; truck_id: string | null
  name: string; planned_date: string; status: string
  stops: any[]; ai_reasoning: string | null; total_km: number | null; created_at: string
}

const ROUTE_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  draft:       { bg: '#f0f4f0', color: '#6a7a8a', label: 'Draft'       },
  confirmed:   { bg: '#E6F1FB', color: '#0C447C', label: 'Confirmed'   },
  in_progress: { bg: '#eaf5ee', color: '#27500A', label: 'In progress' },
  completed:   { bg: '#f0f4f0', color: '#aab8c0', label: 'Completed'   },
}

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}
function SecTitle({ title }: { title: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0 8px', borderBottom: '0.5px solid #e8ede9', marginBottom: 12 }}>{title}</div>
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export default function RoutesPage() {
  const [feedMills,  setFeedMills]  = useState<FeedMill[]>([])
  const [farms,      setFarms]      = useState<Farm[]>([])
  const [silos,      setSilos]      = useState<Silo[]>([])
  const [siloStats,  setSiloStats]  = useState<SiloStat[]>([])
  const [drivers,    setDrivers]    = useState<Driver[]>([])
  const [trucks,     setTrucks]     = useState<Truck[]>([])
  const [routes,     setRoutes]     = useState<DeliveryRoute[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [aiLoading,  setAiLoading]  = useState(false)
  const [msg,        setMsg]        = useState('')
  const [drawer,     setDrawer]     = useState<DeliveryRoute | 'new' | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const emptyForm = { feed_mill_id: '', driver_id: '', truck_id: '', name: '', planned_date: new Date().toISOString().split('T')[0], status: 'draft' }
  const [form,           setForm]           = useState(emptyForm)
  const [routeStops,     setRouteStops]     = useState<any[]>([])
  const [aiReasoning,    setAiReasoning]    = useState('')
  const [selectedFarmIds,setSelectedFarmIds]= useState<string[]>([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [fmR, farmsR, silosR, statsR, driversR, trucksR, routesR] = await Promise.all([
      supabase.from('feed_mills').select('*').order('name'),
      supabase.from('farms').select('*').order('name'),
      supabase.from('silos').select('*').order('name'),
      supabase.from('silo_latest_readings').select('*'),
      supabase.from('drivers').select('id, name, feed_mill_id').order('name'),
      supabase.from('trucks').select('id, name, plate, capacity_kg, feed_mill_id').order('name'),
      supabase.from('delivery_routes').select('*').order('planned_date', { ascending: false }),
    ])
    setFeedMills(fmR.data || [])
    setFarms(farmsR.data || [])
    setSilos(silosR.data || [])
    setSiloStats(statsR.data || [])
    setDrivers(driversR.data || [])
    setTrucks(trucksR.data || [])
    setRoutes(routesR.data || [])
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const millName   = (id: string) => feedMills.find(m => m.id === id)?.name || '—'
  const driverName = (id: string | null) => id ? drivers.find(d => d.id === id)?.name || '—' : '—'
  const truckName  = (id: string | null) => id ? trucks.find(t => t.id === id)?.name || '—' : '—'
  const getStat    = (id: string) => siloStats.find(s => s.silo_id === id)
  const getDays    = (siloId: string) => {
    const stat = getStat(siloId)
    const silo = silos.find(s => s.id === siloId)
    if (!stat || !silo) return 999
    return Math.floor(stat.kg_remaining / (silo.capacity_kg * 0.02))
  }

  const farmUrgency = farms.map(farm => {
    const fs    = silos.filter(s => s.farm_id === farm.id)
    const stats = fs.map(s => getStat(s.id)).filter(Boolean) as SiloStat[]
    const minDays    = fs.length > 0 ? Math.min(...fs.map(s => getDays(s.id))) : 999
    const alertLevel = stats.some(s => s.alert_level === 'critical') ? 'critical' : stats.some(s => s.alert_level === 'low') ? 'low' : 'ok'
    const totalKg    = stats.reduce((sum, s) => sum + s.kg_remaining, 0)
    const totalKgNeeded = fs.reduce((sum, s) => {
      const stat = getStat(s.id)
      return sum + Math.max(0, s.capacity_kg * 0.85 - (stat?.kg_remaining || 0))
    }, 0)
    return { farm, minDays, alertLevel, totalKg, totalKgNeeded }
  }).sort((a, b) => a.minDays - b.minDays)

  function openNew() {
    setForm(emptyForm)
    setRouteStops([])
    setAiReasoning('')
    setSelectedFarmIds([])
    setDrawer('new')
  }

  function openEdit(r: DeliveryRoute) {
    setForm({ feed_mill_id: r.feed_mill_id, driver_id: r.driver_id || '', truck_id: r.truck_id || '', name: r.name, planned_date: r.planned_date, status: r.status })
    setRouteStops(r.stops || [])
    setAiReasoning(r.ai_reasoning || '')
    setSelectedFarmIds((r.stops || []).map((s: any) => s.farm_id))
    setDrawer(r)
  }

  async function generateAIRoute() {
    if (!form.feed_mill_id || selectedFarmIds.length === 0) return
    setAiLoading(true)
    const mill     = feedMills.find(m => m.id === form.feed_mill_id)
    const selFarms = farms.filter(f => selectedFarmIds.includes(f.id))

    const farmData = selFarms.map(farm => {
      const fu = farmUrgency.find(f => f.farm.id === farm.id)
      const dist = mill?.lat && mill?.lng && farm.lat && farm.lng
        ? Math.round(distKm(mill.lat, mill.lng, farm.lat, farm.lng)) : 999
      const score = (fu?.alertLevel === 'critical' ? 100 : fu?.alertLevel === 'low' ? 60 : 20)
        + Math.max(0, 100 - (fu?.minDays || 999) * 5)
        + Math.max(0, 50 - dist * 0.2)
      const materials = [...new Set(silos.filter(s => s.farm_id === farm.id).map(s => s.material).filter(Boolean))]
      return { farm, minDays: fu?.minDays || 999, alertLevel: fu?.alertLevel || 'ok', dist, totalKgNeeded: Math.round(fu?.totalKgNeeded || 0), score: Math.round(score), materials }
    }).sort((a, b) => b.score - a.score)

    const prompt = [
      'You are a logistics optimizer for ' + (mill?.name || 'a feed mill') + ' in Victoria, Australia.',
      'Feed mill location: ' + (mill?.location || 'unknown'),
      'Route date: ' + form.planned_date,
      '',
      'Farms to visit:',
      farmData.map((f, i) => [
        (i+1) + '. ' + f.farm.name + ' (' + (f.farm.location || 'no address') + ')',
        '   Days remaining: ' + f.minDays + ' | Alert: ' + f.alertLevel + ' | Distance from mill: ' + f.dist + 'km',
        '   Feed needed: ' + (f.totalKgNeeded/1000).toFixed(1) + 't | Materials: ' + (f.materials.join(', ') || 'unknown'),
        '   Priority score: ' + f.score,
      ].join('\n')).join('\n\n'),
      '',
      'Optimize the delivery sequence considering urgency, geographic proximity, and load. Return JSON only:',
      '{"stops":[{"farm_id":"...","farm_name":"...","order":1,"reason":"...","estimated_km":0,"kg_to_deliver":0}],"total_km":0,"reasoning":"..."}',
    ].join('\n')

    try {
      const res  = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      })
      const data    = await res.json()
      const rawText = data.content?.[0]?.text || ''
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed  = JSON.parse(cleaned)
      const stops   = (parsed.stops || []).map((s: any) => {
        const farm = farms.find(f => f.id === s.farm_id) || farms.find(f => f.name === s.farm_name)
        const fd   = farmData.find(f => f.farm.id === farm?.id)
        return { ...s, farm_id: farm?.id || s.farm_id, farm_name: farm?.name || s.farm_name, location: farm?.location, days_remaining: fd?.minDays, alert_level: fd?.alertLevel, kg_to_deliver: s.kg_to_deliver || fd?.totalKgNeeded || 0 }
      })
      setRouteStops(stops)
      setAiReasoning(parsed.reasoning || '')
      if (!form.name) setRouteForm(form.planned_date + ' — ' + (mill?.name || ''))
    } catch {
      const stops = farmData.map((f, i) => ({ farm_id: f.farm.id, farm_name: f.farm.name, order: i+1, reason: f.alertLevel === 'critical' ? 'Critical urgency' : f.minDays + ' days remaining', estimated_km: f.dist, kg_to_deliver: f.totalKgNeeded, location: f.farm.location, days_remaining: f.minDays, alert_level: f.alertLevel }))
      setRouteStops(stops)
      setAiReasoning('Route generated by urgency + distance scoring (AI unavailable)')
    }
    setAiLoading(false)
  }

  function setRouteForm(name: string) { setForm(p => ({ ...p, name })) }

  async function save() {
    if (!form.feed_mill_id || !form.name) return
    setSaving(true)
    const totalKm = routeStops.reduce((sum, s) => sum + (s.estimated_km || 0), 0)
    const payload = { feed_mill_id: form.feed_mill_id, driver_id: form.driver_id || null, truck_id: form.truck_id || null, name: form.name, planned_date: form.planned_date, status: form.status, stops: routeStops, ai_reasoning: aiReasoning || null, total_km: totalKm }
    if (drawer && drawer !== 'new') {
      await supabase.from('delivery_routes').update(payload).eq('id', (drawer as DeliveryRoute).id)
      showMsg('Route updated')
    } else {
      await supabase.from('delivery_routes').insert(payload)
      showMsg('Route saved')
    }
    setSaving(false); setDrawer(null); loadAll()
  }

  async function remove(id: string) {
    if (!confirm('Delete this route?')) return
    await supabase.from('delivery_routes').delete().eq('id', id)
    setDrawer(null); showMsg('Route deleted'); loadAll()
  }

  const isEdit   = drawer && drawer !== 'new'
  const filtered = filterStatus === 'all' ? routes : routes.filter(r => r.status === filterStatus)
  const counts   = Object.keys(ROUTE_STATUS).reduce((acc, k) => { acc[k] = routes.filter(r => r.status === k).length; return acc }, {} as Record<string, number>)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4A90C4', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading routes...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {/* DRAWER */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 540, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>

            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A90C4" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEdit ? 'Edit route' : 'Plan delivery route'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>AI-optimized multi-farm delivery planning</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SecTitle title="Route setup" />

              <div><label style={lStyle()}>Route name</label>
                <input style={iStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Monday run — Reid Stockfeed" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Feed mill *</label>
                  <select value={form.feed_mill_id} onChange={e => setForm(p => ({ ...p, feed_mill_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Select mill</option>
                    {feedMills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div><label style={lStyle()}>Planned date</label>
                  <input type="date" style={iStyle(true)} value={form.planned_date} onChange={e => setForm(p => ({ ...p, planned_date: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Assign driver</label>
                  <select value={form.driver_id} onChange={e => setForm(p => ({ ...p, driver_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Unassigned</option>
                    {drivers.filter(d => !form.feed_mill_id || d.feed_mill_id === form.feed_mill_id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle()}>Assign truck</label>
                  <select value={form.truck_id} onChange={e => setForm(p => ({ ...p, truck_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Unassigned</option>
                    {trucks.filter(t => !form.feed_mill_id || t.feed_mill_id === form.feed_mill_id).map(t => <option key={t.id} value={t.id}>{t.name} ({(t.capacity_kg/1000).toFixed(0)}t)</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={lStyle()}>Status</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.entries(ROUTE_STATUS).map(([k, v]) => (
                    <button key={k} onClick={() => setForm(p => ({ ...p, status: k }))}
                      style={{ flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid ' + (form.status === k ? v.color + '88' : '#e8ede9'), background: form.status === k ? v.bg : '#fff', color: form.status === k ? v.color : '#8a9aaa' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <SecTitle title="AI route planner" />

              <div style={{ background: '#f7f9f8', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: '#6a7a8a', marginBottom: 12, lineHeight: 1.5 }}>
                  Select farms to visit. The AI will optimize the delivery sequence based on urgency, distance from the mill, and feed requirements.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {farmUrgency.map(({ farm, minDays, alertLevel, totalKgNeeded }) => {
                    const checked = selectedFarmIds.includes(farm.id)
                    const mill    = feedMills.find(m => m.id === form.feed_mill_id)
                    const dist    = mill?.lat && mill?.lng && farm.lat && farm.lng ? Math.round(distKm(mill.lat, mill.lng, farm.lat, farm.lng)) : null
                    const urgColor = alertLevel === 'critical' ? '#E24B4A' : alertLevel === 'low' ? '#EF9F27' : '#4CAF7D'
                    return (
                      <label key={farm.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (checked ? '#4CAF7D' : '#e8ede9'), background: checked ? '#f4fbf7' : '#fff', cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={() => setSelectedFarmIds(prev => checked ? prev.filter(id => id !== farm.id) : [...prev, farm.id])} style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: '#1a2530' }}>{farm.name}</div>
                          <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>
                            {minDays < 999 ? minDays + ' days' : 'No data'}
                            {dist !== null ? ' · ' + dist + ' km from mill' : ''}
                            {totalKgNeeded > 0 ? ' · ' + (totalKgNeeded/1000).toFixed(0) + 't needed' : ''}
                          </div>
                        </div>
                        {alertLevel !== 'ok' && (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: alertLevel === 'critical' ? '#FCEBEB' : '#FAEEDA', color: alertLevel === 'critical' ? '#A32D2D' : '#633806', fontWeight: 600 }}>
                            {alertLevel}
                          </span>
                        )}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: minDays <= 7 ? '#A32D2D' : minDays <= 14 ? '#633806' : urgColor }}>{minDays < 999 ? minDays + 'd' : '—'}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>

                <button onClick={generateAIRoute} disabled={aiLoading || !form.feed_mill_id || selectedFarmIds.length === 0}
                  style={{ width: '100%', padding: '11px', background: aiLoading ? '#aab8c0' : '#1a2530', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {aiLoading
                    ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Generating optimized route...</>
                    : '✦ Generate AI route'}
                </button>
              </div>

              {routeStops.length > 0 && (
                <>
                  <SecTitle title={'Optimized route — ' + routeStops.length + ' stops'} />

                  {aiReasoning && (
                    <div style={{ background: '#f7f9f8', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#6a7a8a', lineHeight: 1.6, borderLeft: '3px solid #4CAF7D' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#4CAF7D', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>AI Reasoning</div>
                      {aiReasoning}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[...routeStops].sort((a, b) => a.order - b.order).map((stop, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{idx+1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', marginBottom: 2 }}>{stop.farm_name}</div>
                          <div style={{ fontSize: 11, color: '#8a9aaa' }}>
                            {stop.location || 'No address'}
                            {stop.estimated_km ? ' · ' + stop.estimated_km + ' km from mill' : ''}
                          </div>
                          {stop.reason && <div style={{ fontSize: 11, color: '#4CAF7D', fontStyle: 'italic', marginTop: 3 }}>{stop.reason}</div>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {stop.days_remaining && stop.days_remaining < 999 && (
                            <div style={{ fontSize: 12, fontWeight: 700, color: stop.days_remaining <= 7 ? '#A32D2D' : stop.days_remaining <= 14 ? '#633806' : '#27500A' }}>{stop.days_remaining}d</div>
                          )}
                          {stop.kg_to_deliver > 0 && <div style={{ fontSize: 11, color: '#aab8c0' }}>{(stop.kg_to_deliver/1000).toFixed(0)}t</div>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#E6F1FB', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0C447C', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total estimated</div>
                      <div style={{ fontSize: 11, color: '#4A90C4', marginTop: 2 }}>{routeStops.length} stops · {routeStops.reduce((sum, s) => sum + (s.kg_to_deliver || 0), 0) > 0 ? (routeStops.reduce((sum, s) => sum + (s.kg_to_deliver || 0), 0)/1000).toFixed(0) + 't to deliver' : ''}</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#0C447C' }}>{routeStops.reduce((sum, s) => sum + (s.estimated_km || 0), 0)} km</div>
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving || !form.feed_mill_id || !form.name || routeStops.length === 0}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4A90C4', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEdit ? 'Update route' : 'Save route'}
              </button>
              {isEdit && (
                <button onClick={() => remove((drawer as DeliveryRoute).id)}
                  style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Delete
                </button>
              )}
              <button onClick={() => setDrawer(null)}
                style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* HEADER */}
      <div className="page-header">
        <div>
          <div className="page-title">Route Planner</div>
          <div className="page-sub">{routes.length} routes · {counts.confirmed || 0} confirmed · {counts.in_progress || 0} in progress</div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>{'✓ ' + msg}</div>}
          <button className="btn-primary" onClick={openNew}>+ Plan route</button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        {Object.entries(ROUTE_STATUS).map(([k, v]) => (
          <div key={k} className="sum-card" onClick={() => setFilterStatus(filterStatus === k ? 'all' : k)}
            style={{ cursor: 'pointer', borderBottom: filterStatus === k ? '2px solid ' + v.color : '2px solid transparent' }}>
            <div className="sum-label">{v.label}</div>
            <div className="sum-val" style={{ color: v.color }}>{counts[k] || 0}</div>
            <div className="sum-sub">routes</div>
          </div>
        ))}
      </div>

      {/* ROUTES LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No routes planned yet</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Use the AI planner to generate optimized delivery routes.</div>
            <button onClick={openNew} className="btn-primary">+ Plan first route</button>
          </div>
        ) : filtered.map(r => {
          const sc  = ROUTE_STATUS[r.status] || ROUTE_STATUS.draft
          const drv = drivers.find(d => d.id === r.driver_id)
          const trk = trucks.find(t => t.id === r.truck_id)
          return (
            <div key={r.id} onClick={() => openEdit(r)}
              style={{ display: 'flex', gap: 16, padding: '16px 20px', background: '#fff', borderRadius: 10, border: '0.5px solid #e8ede9', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={sc.color} strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{r.name}</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: sc.bg, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
                </div>
                <div style={{ fontSize: 12, color: '#8a9aaa', marginBottom: 6 }}>
                  {millName(r.feed_mill_id)} · {new Date(r.planned_date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                  {r.stops?.length > 0 ? ' · ' + r.stops.length + ' farm' + (r.stops.length > 1 ? 's' : '') : ''}
                  {r.total_km ? ' · ~' + r.total_km + ' km' : ''}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {drv && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f0f4f0', color: '#6a7a8a' }}>👤 {drv.name}</span>}
                  {trk && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#E6F1FB', color: '#0C447C' }}>🚛 {trk.plate || trk.name}</span>}
                </div>
                {r.stops?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    {r.stops.sort((a: any, b: any) => a.order - b.order).map((stop: any, idx: number) => (
                      <span key={idx} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#f7f9f8', color: '#8a9aaa', border: '0.5px solid #e8ede9' }}>
                        {idx+1}. {stop.farm_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0C447C' }}>{r.total_km || '—'}</div>
                <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase' }}>km</div>
                <div style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600, marginTop: 8 }}>Edit →</div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
