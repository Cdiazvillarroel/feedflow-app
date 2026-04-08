'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface FeedMill { id: string; name: string; location: string | null; lat: number | null; lng: number | null; phone: string | null; email: string | null; active: boolean }
interface Farm     { id: string; name: string; location: string | null; lat: number | null; lng: number | null }
interface Silo     { id: string; farm_id: string; name: string; material: string | null; capacity_kg: number; qr_token: string | null }
interface SiloStat { silo_id: string; level_pct: number; kg_remaining: number; alert_level: string }
interface Truck    { id: string; feed_mill_id: string; name: string; plate: string | null; capacity_kg: number; active: boolean }
interface Driver   { id: string; feed_mill_id: string; name: string; license: string | null; phone: string | null; email: string | null; truck_id: string | null; active: boolean }
interface DeliveryOrder { id: string; feed_mill_id: string; farm_id: string; driver_id: string | null; truck_id: string | null; status: string; scheduled_at: string | null; delivered_at: string | null; notes: string | null; created_at: string }
interface OrderItem     { id: string; delivery_order_id: string; silo_id: string; material: string | null; kg_requested: number; kg_delivered: number }
interface DeliveryRoute { id: string; feed_mill_id: string; driver_id: string | null; truck_id: string | null; name: string; planned_date: string; status: string; stops: any[]; ai_reasoning: string | null; total_km: number | null; created_at: string }

type Tab = 'monitor' | 'orders' | 'logistics' | 'drivers'

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: '#FAEEDA', color: '#633806', label: 'Pending'    },
  planned:    { bg: '#E6F1FB', color: '#0C447C', label: 'Planned'    },
  in_transit: { bg: '#eaf5ee', color: '#27500A', label: 'In transit' },
  delivered:  { bg: '#f0f4f0', color: '#6a7a8a', label: 'Delivered'  },
  cancelled:  { bg: '#FCEBEB', color: '#A32D2D', label: 'Cancelled'  },
}
const ROUTE_STATUS: Record<string, { bg: string; color: string }> = {
  draft:       { bg: '#f0f4f0', color: '#6a7a8a' },
  confirmed:   { bg: '#E6F1FB', color: '#0C447C' },
  in_progress: { bg: '#eaf5ee', color: '#27500A' },
  completed:   { bg: '#f0f4f0', color: '#aab8c0' },
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

export default function LogisticsPage() {
  const [tab,        setTab]        = useState<Tab>('monitor')
  const [feedMills,  setFeedMills]  = useState<FeedMill[]>([])
  const [farms,      setFarms]      = useState<Farm[]>([])
  const [silos,      setSilos]      = useState<Silo[]>([])
  const [siloStats,  setSiloStats]  = useState<SiloStat[]>([])
  const [trucks,     setTrucks]     = useState<Truck[]>([])
  const [drivers,    setDrivers]    = useState<Driver[]>([])
  const [orders,     setOrders]     = useState<DeliveryOrder[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [routes,     setRoutes]     = useState<DeliveryRoute[]>([])
  const [loading,    setLoading]    = useState(true)
  const [msg,        setMsg]        = useState('')
  const [saving,     setSaving]     = useState(false)

  const [farmDrawer,   setFarmDrawer]   = useState<Farm | null>(null)
  const [orderDrawer,  setOrderDrawer]  = useState<DeliveryOrder | 'new' | null>(null)
  const [routeDrawer,  setRouteDrawer]  = useState<DeliveryRoute | 'new' | null>(null)
  const [driverDrawer, setDriverDrawer] = useState<Driver | 'new' | null>(null)
  const [truckDrawer,  setTruckDrawer]  = useState<Truck | 'new' | null>(null)
  const [aiLoading,    setAiLoading]    = useState(false)

  const emptyOrder  = { feed_mill_id: '', farm_id: '', driver_id: '', truck_id: '', status: 'pending', scheduled_at: '', notes: '' }
  const emptyRoute  = { feed_mill_id: '', driver_id: '', truck_id: '', name: '', planned_date: new Date().toISOString().split('T')[0], status: 'draft' }
  const emptyDriver = { feed_mill_id: '', name: '', license: '', phone: '', email: '', truck_id: '', active: true }
  const emptyTruck  = { feed_mill_id: '', name: '', plate: '', capacity_kg: '20000', active: true }

  const [orderForm,       setOrderForm]       = useState(emptyOrder)
  const [orderItemForms,  setOrderItemForms]  = useState<{ silo_id: string; kg_requested: string }[]>([])
  const [routeForm,       setRouteForm]       = useState(emptyRoute)
  const [routeStops,      setRouteStops]      = useState<any[]>([])
  const [aiReasoning,     setAiReasoning]     = useState('')
  const [selectedFarmIds, setSelectedFarmIds] = useState<string[]>([])
  const [driverForm,      setDriverForm]      = useState(emptyDriver)
  const [truckForm,       setTruckForm]       = useState(emptyTruck)
  const [calView,         setCalView]         = useState<'day'|'week'|'month'>('week')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const fmR      = await supabase.from('feed_mills').select('*').order('name')
      const farmsR   = await supabase.from('farms').select('*').order('name')
      const silosR   = await supabase.from('silos').select('*').order('name')
      const statsR   = await supabase.from('silo_latest_readings').select('*')
      const trucksR  = await supabase.from('trucks').select('*').order('name')
      const driversR = await supabase.from('drivers').select('*').order('name')
      const ordersR  = await supabase.from('delivery_orders').select('*').order('created_at', { ascending: false })
      const itemsR   = await supabase.from('delivery_order_items').select('*')
      const routesR  = await supabase.from('delivery_routes').select('*').order('planned_date', { ascending: false })

      setFeedMills(fmR.data   || [])
      setFarms(farmsR.data    || [])
      setSilos(silosR.data    || [])
      setSiloStats(statsR.data || [])
      setTrucks(trucksR.data  || [])
      setDrivers(driversR.data || [])
      setOrders(ordersR.data  || [])
      setOrderItems(itemsR.data || [])
      setRoutes(routesR.data  || [])
    } catch (e) {
      console.error('loadAll error:', e)
    }
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const farmName   = (id: string) => farms.find(f => f.id === id)?.name || '—'
  const millName   = (id: string) => feedMills.find(m => m.id === id)?.name || '—'
  const driverName = (id: string | null) => id ? drivers.find(d => d.id === id)?.name || '—' : '—'
  const truckName  = (id: string | null) => id ? trucks.find(t => t.id === id)?.name || '—' : '—'

  function getStat(siloId: string) { return siloStats.find(s => s.silo_id === siloId) }
  function getDays(siloId: string) {
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
    return { farm, minDays, alertLevel, totalKg, siloCount: fs.length }
  }).sort((a, b) => a.minDays - b.minDays)

  async function saveOrder() {
    if (!orderForm.feed_mill_id || !orderForm.farm_id) return
    setSaving(true)
    const payload = { feed_mill_id: orderForm.feed_mill_id, farm_id: orderForm.farm_id, driver_id: orderForm.driver_id || null, truck_id: orderForm.truck_id || null, status: orderForm.status, scheduled_at: orderForm.scheduled_at ? new Date(orderForm.scheduled_at).toISOString() : null, notes: orderForm.notes || null }
    let orderId = ''
    if (orderDrawer && orderDrawer !== 'new') {
      orderId = (orderDrawer as DeliveryOrder).id
      await supabase.from('delivery_orders').update(payload).eq('id', orderId)
      await supabase.from('delivery_order_items').delete().eq('delivery_order_id', orderId)
      showMsg('Order updated')
    } else {
      const { data } = await supabase.from('delivery_orders').insert(payload).select().single()
      orderId = data?.id || ''
      showMsg('Order created')
    }
    const valid = orderItemForms.filter(i => i.silo_id && parseFloat(i.kg_requested) > 0)
    if (orderId && valid.length > 0) {
      await supabase.from('delivery_order_items').insert(valid.map(i => ({ delivery_order_id: orderId, silo_id: i.silo_id, material: silos.find(s => s.id === i.silo_id)?.material || null, kg_requested: parseFloat(i.kg_requested), kg_delivered: 0 })))
    }
    setSaving(false); setOrderDrawer(null); loadAll()
  }

  async function deleteOrder(id: string) {
    if (!confirm('Delete this order?')) return
    await supabase.from('delivery_orders').delete().eq('id', id)
    setOrderDrawer(null); showMsg('Order deleted'); loadAll()
  }

  async function saveDriver() {
    if (!driverForm.name.trim()) return
    setSaving(true)
    const payload = { feed_mill_id: driverForm.feed_mill_id || null, name: driverForm.name.trim(), license: driverForm.license || null, phone: driverForm.phone || null, email: driverForm.email || null, truck_id: driverForm.truck_id || null, active: driverForm.active }
    if (driverDrawer && driverDrawer !== 'new') {
      await supabase.from('drivers').update(payload).eq('id', (driverDrawer as Driver).id)
      showMsg('Driver updated')
    } else {
      await supabase.from('drivers').insert(payload)
      showMsg('Driver created')
    }
    setSaving(false); setDriverDrawer(null); loadAll()
  }

  async function deleteDriver(id: string) {
    if (!confirm('Delete this driver?')) return
    await supabase.from('drivers').delete().eq('id', id)
    setDriverDrawer(null); showMsg('Driver deleted'); loadAll()
  }

  async function saveTruck() {
    if (!truckForm.name.trim()) return
    setSaving(true)
    const payload = { feed_mill_id: truckForm.feed_mill_id || null, name: truckForm.name.trim(), plate: truckForm.plate || null, capacity_kg: parseFloat(truckForm.capacity_kg) || 20000, active: truckForm.active }
    if (truckDrawer && truckDrawer !== 'new') {
      await supabase.from('trucks').update(payload).eq('id', (truckDrawer as Truck).id)
      showMsg('Truck updated')
    } else {
      await supabase.from('trucks').insert(payload)
      showMsg('Truck created')
    }
    setSaving(false); setTruckDrawer(null); loadAll()
  }

  async function deleteTruck(id: string) {
    if (!confirm('Delete this truck?')) return
    await supabase.from('trucks').delete().eq('id', id)
    setTruckDrawer(null); showMsg('Truck deleted'); loadAll()
  }

  async function generateAIRoute() {
    if (!routeForm.feed_mill_id || selectedFarmIds.length === 0) return
    setAiLoading(true)
    const mill     = feedMills.find(m => m.id === routeForm.feed_mill_id)
    const selFarms = farms.filter(f => selectedFarmIds.includes(f.id))

    const farmData = selFarms.map(farm => {
      const fs    = silos.filter(s => s.farm_id === farm.id)
      const stats = fs.map(s => ({ silo: s, stat: getStat(s.id) })).filter(x => x.stat)
      const minDays = stats.length > 0 ? Math.min(...stats.map(x => {
        const kgDay = x.silo.capacity_kg * 0.02
        return Math.floor((x.stat?.kg_remaining || 0) / kgDay)
      })) : 999
      const alertLevel    = stats.some(x => x.stat?.alert_level === 'critical') ? 'critical' : stats.some(x => x.stat?.alert_level === 'low') ? 'low' : 'ok'
      const dist          = mill?.lat && mill?.lng && farm.lat && farm.lng ? Math.round(distKm(mill.lat, mill.lng, farm.lat, farm.lng)) : 999
      const totalKgNeeded = stats.reduce((sum, x) => sum + Math.max(0, x.silo.capacity_kg * 0.85 - (x.stat?.kg_remaining || 0)), 0)
      const score         = (alertLevel === 'critical' ? 100 : alertLevel === 'low' ? 60 : 20) + Math.max(0, 100 - minDays * 5) + Math.max(0, 50 - dist * 0.2)
      const materials     = [...new Set(fs.map(s => s.material).filter(Boolean))]
      return { farm, minDays, alertLevel, dist, totalKgNeeded: Math.round(totalKgNeeded), score: Math.round(score), materials }
    }).sort((a, b) => b.score - a.score)

    const prompt = [
      'You are a logistics optimizer for Reid Stockfeed, a feed distribution company in Victoria, Australia.',
      'Feed mill: ' + mill?.name + ', ' + (mill?.location || ''),
      'Route date: ' + routeForm.planned_date,
      '',
      'Farms to visit:',
      farmData.map((f, i) => [
        (i+1) + '. ' + f.farm.name + ' — ' + (f.farm.location || 'no address'),
        '   Days remaining: ' + f.minDays + ' | Alert: ' + f.alertLevel + ' | Distance: ' + f.dist + 'km',
        '   Feed needed: ' + (f.totalKgNeeded/1000).toFixed(1) + 't | Materials: ' + (f.materials.join(', ') || 'unknown'),
        '   Priority score: ' + f.score,
      ].join('\n')).join('\n\n'),
      '',
      'Return JSON only, no markdown:',
      '{"stops":[{"farm_id":"...","farm_name":"...","order":1,"reason":"...","estimated_km":0,"kg_to_deliver":0}],"total_km":0,"reasoning":"..."}',
    ].join('\n')

    try {
      const res    = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }) })
      const data   = await res.json()
      const rawText = data.content?.[0]?.text || ''
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed  = JSON.parse(cleaned)
      const stops  = (parsed.stops || []).map((s: any) => {
        const farm = farms.find(f => f.id === s.farm_id) || farms.find(f => f.name === s.farm_name)
        const fd   = farmData.find(f => f.farm.id === farm?.id)
        return { ...s, farm_id: farm?.id || s.farm_id, farm_name: farm?.name || s.farm_name, location: farm?.location, days_remaining: fd?.minDays, alert_level: fd?.alertLevel, kg_to_deliver: s.kg_to_deliver || fd?.totalKgNeeded || 0 }
      })
      setRouteStops(stops)
      setAiReasoning(parsed.reasoning || '')
      if (!routeForm.name) setRouteForm(p => ({ ...p, name: 'Route ' + routeForm.planned_date + ' — ' + (mill?.name || '') }))
    } catch {
      const stops = farmData.map((f, i) => ({ farm_id: f.farm.id, farm_name: f.farm.name, order: i+1, reason: f.alertLevel === 'critical' ? 'Critical urgency' : f.minDays + ' days remaining', estimated_km: f.dist, kg_to_deliver: f.totalKgNeeded, location: f.farm.location, days_remaining: f.minDays, alert_level: f.alertLevel }))
      setRouteStops(stops)
      setAiReasoning('Route generated by urgency + distance scoring (AI unavailable)')
    }
    setAiLoading(false)
  }

  async function saveRoute() {
    if (!routeForm.feed_mill_id || !routeForm.name) return
    setSaving(true)
    const totalKm = routeStops.reduce((sum, s) => sum + (s.estimated_km || 0), 0)
    const payload = { feed_mill_id: routeForm.feed_mill_id, driver_id: routeForm.driver_id || null, truck_id: routeForm.truck_id || null, name: routeForm.name, planned_date: routeForm.planned_date, status: routeForm.status, stops: routeStops, ai_reasoning: aiReasoning || null, total_km: totalKm }
    if (routeDrawer && routeDrawer !== 'new') {
      await supabase.from('delivery_routes').update(payload).eq('id', (routeDrawer as DeliveryRoute).id)
      showMsg('Route updated')
    } else {
      await supabase.from('delivery_routes').insert(payload)
      showMsg('Route saved')
    }
    setSaving(false); setRouteDrawer(null); loadAll()
  }

  async function deleteRoute(id: string) {
    if (!confirm('Delete this route?')) return
    await supabase.from('delivery_routes').delete().eq('id', id)
    setRouteDrawer(null); showMsg('Route deleted'); loadAll()
  }

  function qrUrl(token: string) {
    if (typeof window === 'undefined') return ''
    return window.location.origin + '/confirm/' + token
  }

  const isEditOrder  = orderDrawer  && orderDrawer  !== 'new'
  const isEditRoute  = routeDrawer  && routeDrawer  !== 'new'
  const isEditDriver = driverDrawer && driverDrawer !== 'new'
  const isEditTruck  = truckDrawer  && truckDrawer  !== 'new'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4A90C4', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading logistics...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {/* ── FARM DETAIL DRAWER ────────────────────────────────── */}
      {farmDrawer && (
        <>
          <div onClick={() => setFarmDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 460, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {farmDrawer.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{farmDrawer.name}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>{farmDrawer.location || 'No address'}</div>
              </div>
              <button onClick={() => setFarmDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <SecTitle title="Silo status" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {silos.filter(s => s.farm_id === farmDrawer.id).map(silo => {
                  const stat  = getStat(silo.id)
                  const days  = getDays(silo.id)
                  const color = stat?.alert_level === 'critical' ? '#E24B4A' : stat?.alert_level === 'low' ? '#EF9F27' : '#4CAF7D'
                  return (
                    <div key={silo.id} style={{ background: '#f7f9f8', borderRadius: 10, padding: '14px 16px', border: '0.5px solid #e8ede9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{silo.name}</div>
                          <div style={{ fontSize: 11, color: '#8a9aaa' }}>{silo.material || '—'} · {(silo.capacity_kg/1000).toFixed(0)}t capacity</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: days <= 7 ? '#A32D2D' : days <= 14 ? '#633806' : '#27500A' }}>{days < 999 ? days : '—'}</div>
                          <div style={{ fontSize: 10, color: '#aab8c0' }}>days left</div>
                        </div>
                      </div>
                      {stat ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color }}>{stat.level_pct.toFixed(1)}%</span>
                            <span style={{ fontSize: 11, color: '#8a9aaa' }}>{Math.round(stat.kg_remaining).toLocaleString()} kg</span>
                          </div>
                          <div style={{ height: 6, background: '#e8ede9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, background: color, width: stat.level_pct + '%' }} />
                          </div>
                          {stat.alert_level !== 'ok' && (
                            <div style={{ marginTop: 8, fontSize: 11, padding: '4px 10px', borderRadius: 6, background: stat.alert_level === 'critical' ? '#FCEBEB' : '#FAEEDA', color: stat.alert_level === 'critical' ? '#A32D2D' : '#633806', display: 'inline-block', fontWeight: 600 }}>
                              {stat.alert_level === 'critical' ? '⚠️ Critical — restock urgently' : '⚡ Low — order soon'}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: '#aab8c0' }}>No sensor data</div>
                      )}
                      {silo.qr_token && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, color: '#8a9aaa' }}>QR delivery confirmation</span>
                          <button onClick={() => { navigator.clipboard.writeText(qrUrl(silo.qr_token!)); showMsg('QR link copied') }}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #c8d8cc', background: '#fff', cursor: 'pointer', color: '#4A90C4', fontFamily: 'inherit' }}>
                            Copy QR link
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 20 }}>
                <SecTitle title="Recent orders" />
                {orders.filter(o => o.farm_id === farmDrawer.id).slice(0, 5).map(o => {
                  const sc = STATUS_COLORS[o.status] || STATUS_COLORS.pending
                  return (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: sc.bg, color: sc.color, fontWeight: 600, flexShrink: 0 }}>{sc.label}</span>
                      <span style={{ fontSize: 12, color: '#1a2530', flex: 1 }}>{millName(o.feed_mill_id)}</span>
                      <span style={{ fontSize: 11, color: '#aab8c0' }}>{o.scheduled_at ? new Date(o.scheduled_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}</span>
                    </div>
                  )
                })}
                {orders.filter(o => o.farm_id === farmDrawer.id).length === 0 && (
                  <div style={{ fontSize: 12, color: '#aab8c0', textAlign: 'center', padding: '12px 0' }}>No orders yet</div>
                )}
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9' }}>
              <button onClick={() => { setOrderForm({ ...emptyOrder, farm_id: farmDrawer.id }); setOrderItemForms([]); setFarmDrawer(null); setOrderDrawer('new') }}
                style={{ width: '100%', padding: '10px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                + Create delivery order
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── ORDER DRAWER ──────────────────────────────────────── */}
      {orderDrawer && (
        <>
          <div onClick={() => setOrderDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditOrder ? 'Edit order' : 'New delivery order'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Assign feed delivery to a farm</div>
              </div>
              <button onClick={() => setOrderDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SecTitle title="Order details" />
              <div>
                <label style={lStyle()}>Feed mill *</label>
                <select value={orderForm.feed_mill_id} onChange={e => setOrderForm(p => ({ ...p, feed_mill_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">Select feed mill</option>
                  {feedMills.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lStyle()}>Destination farm *</label>
                <select value={orderForm.farm_id} onChange={e => { setOrderForm(p => ({ ...p, farm_id: e.target.value })); setOrderItemForms([]) }} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">Select farm</option>
                  {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Driver</label>
                  <select value={orderForm.driver_id} onChange={e => setOrderForm(p => ({ ...p, driver_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Unassigned</option>
                    {drivers.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle()}>Truck</label>
                  <select value={orderForm.truck_id} onChange={e => setOrderForm(p => ({ ...p, truck_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Unassigned</option>
                    {trucks.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name} ({(t.capacity_kg/1000).toFixed(0)}t)</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Status</label>
                  <select value={orderForm.status} onChange={e => setOrderForm(p => ({ ...p, status: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle()}>Scheduled date</label>
                  <input type="date" style={iStyle(true)} value={orderForm.scheduled_at} onChange={e => setOrderForm(p => ({ ...p, scheduled_at: e.target.value }))} />
                </div>
              </div>
              <div><label style={lStyle()}>Notes</label><textarea value={orderForm.notes} onChange={e => setOrderForm(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...iStyle(true), resize: 'vertical' }} placeholder="Delivery instructions..." /></div>
              <SecTitle title="Silos to fill" />
              {!orderForm.farm_id ? (
                <div style={{ fontSize: 12, color: '#aab8c0', textAlign: 'center', padding: 12, background: '#f7f9f8', borderRadius: 8 }}>Select a farm first</div>
              ) : silos.filter(s => s.farm_id === orderForm.farm_id).map(silo => {
                const stat      = getStat(silo.id)
                const days      = getDays(silo.id)
                const idx       = orderItemForms.findIndex(i => i.silo_id === silo.id)
                const included  = idx >= 0
                const suggested = stat ? Math.max(0, Math.round(silo.capacity_kg * 0.85 - stat.kg_remaining)) : 0
                return (
                  <div key={silo.id} style={{ border: '0.5px solid ' + (included ? '#4CAF7D' : '#e8ede9'), borderRadius: 8, padding: '12px 14px', background: included ? '#f4fbf7' : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: included ? 10 : 0 }}>
                      <input type="checkbox" checked={included}
                        onChange={() => {
                          if (included) setOrderItemForms(prev => prev.filter(i => i.silo_id !== silo.id))
                          else setOrderItemForms(prev => [...prev, { silo_id: silo.id, kg_requested: suggested.toString() }])
                        }}
                        style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{silo.name}</div>
                        <div style={{ fontSize: 11, color: '#aab8c0' }}>{silo.material} · {stat ? stat.level_pct.toFixed(0) + '% · ' + days + ' days' : 'No data'}</div>
                      </div>
                      {stat && stat.alert_level !== 'ok' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: stat.alert_level === 'critical' ? '#FCEBEB' : '#FAEEDA', color: stat.alert_level === 'critical' ? '#A32D2D' : '#633806', fontWeight: 600 }}>{stat.alert_level}</span>}
                    </div>
                    {included && (
                      <div style={{ paddingLeft: 24 }}>
                        <label style={{ ...lStyle(), marginBottom: 4 }}>Kg to deliver</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="number" value={orderItemForms[idx]?.kg_requested || ''} onChange={e => setOrderItemForms(prev => prev.map((x, i) => i === idx ? { ...x, kg_requested: e.target.value } : x))} style={{ ...iStyle(true), flex: 1 }} placeholder="0" />
                          <button onClick={() => setOrderItemForms(prev => prev.map((x, i) => i === idx ? { ...x, kg_requested: suggested.toString() } : x))}
                            style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, border: '0.5px solid #c8d8cc', background: '#f7f9f8', cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                            {suggested.toLocaleString()} kg
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={saveOrder} disabled={saving || !orderForm.feed_mill_id || !orderForm.farm_id} style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditOrder ? 'Update order' : 'Create order'}
              </button>
              {isEditOrder && <button onClick={() => deleteOrder((orderDrawer as DeliveryOrder).id)} style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}
              <button onClick={() => setOrderDrawer(null)} style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── ROUTE DRAWER ──────────────────────────────────────── */}
      {routeDrawer && (
        <>
          <div onClick={() => setRouteDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 520, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A90C4" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditRoute ? 'Edit route' : 'Plan delivery route'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>AI-optimized multi-farm delivery planning</div>
              </div>
              <button onClick={() => setRouteDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SecTitle title="Route setup" />
              <div><label style={lStyle()}>Route name</label><input style={iStyle(true)} value={routeForm.name} onChange={e => setRouteForm(p => ({ ...p, name: e.target.value }))} placeholder="Monday run — Reid Stockfeed" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Feed mill *</label>
                  <select value={routeForm.feed_mill_id} onChange={e => setRouteForm(p => ({ ...p, feed_mill_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Select mill</option>
                    {feedMills.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div><label style={lStyle()}>Planned date</label><input type="date" style={iStyle(true)} value={routeForm.planned_date} onChange={e => setRouteForm(p => ({ ...p, planned_date: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Assign driver</label>
                  <select value={routeForm.driver_id} onChange={e => setRouteForm(p => ({ ...p, driver_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Unassigned</option>
                    {drivers.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle()}>Assign truck</label>
                  <select value={routeForm.truck_id} onChange={e => setRouteForm(p => ({ ...p, truck_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Unassigned</option>
                    {trucks.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name} ({(t.capacity_kg/1000).toFixed(0)}t)</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lStyle()}>Status</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.entries(ROUTE_STATUS).map(([k, v]) => (
                    <button key={k} onClick={() => setRouteForm(p => ({ ...p, status: k }))}
                      style={{ flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid ' + (routeForm.status === k ? v.color + '88' : '#e8ede9'), background: routeForm.status === k ? v.bg : '#fff', color: routeForm.status === k ? v.color : '#8a9aaa' }}>
                      {k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <SecTitle title="Select farms to visit" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {farmUrgency.map(({ farm, minDays, alertLevel, totalKg }) => {
                  const checked = selectedFarmIds.includes(farm.id)
                  const mill    = feedMills.find(m => m.id === routeForm.feed_mill_id)
                  const dist    = mill?.lat && mill?.lng && farm.lat && farm.lng ? Math.round(distKm(mill.lat, mill.lng, farm.lat, farm.lng)) : null
                  return (
                    <label key={farm.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (checked ? '#4CAF7D' : '#e8ede9'), background: checked ? '#f4fbf7' : '#fff', cursor: 'pointer' }}>
                      <input type="checkbox" checked={checked} onChange={() => setSelectedFarmIds(prev => checked ? prev.filter(id => id !== farm.id) : [...prev, farm.id])} style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: '#1a2530' }}>{farm.name}</div>
                        <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>
                          {minDays < 999 ? minDays + ' days' : 'No data'}{dist !== null ? ' · ' + dist + ' km' : ''} · {(totalKg/1000).toFixed(0)}t
                        </div>
                      </div>
                      {alertLevel !== 'ok' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: alertLevel === 'critical' ? '#FCEBEB' : '#FAEEDA', color: alertLevel === 'critical' ? '#A32D2D' : '#633806', fontWeight: 600 }}>{alertLevel}</span>}
                    </label>
                  )
                })}
              </div>
              <button onClick={generateAIRoute} disabled={aiLoading || !routeForm.feed_mill_id || selectedFarmIds.length === 0}
                style={{ padding: '11px', background: aiLoading ? '#aab8c0' : '#1a2530', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {aiLoading
                  ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Generating optimized route...</>
                  : '✦ Generate AI route'}
              </button>
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
                          <div style={{ fontSize: 11, color: '#8a9aaa' }}>{stop.location || 'No address'}{stop.estimated_km ? ' · ' + stop.estimated_km + ' km' : ''}</div>
                          {stop.reason && <div style={{ fontSize: 11, color: '#4CAF7D', fontStyle: 'italic', marginTop: 3 }}>{stop.reason}</div>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {stop.days_remaining && stop.days_remaining < 999 && <div style={{ fontSize: 11, fontWeight: 600, color: stop.days_remaining <= 7 ? '#A32D2D' : stop.days_remaining <= 14 ? '#633806' : '#27500A' }}>{stop.days_remaining}d</div>}
                          {stop.kg_to_deliver > 0 && <div style={{ fontSize: 11, color: '#aab8c0' }}>{(stop.kg_to_deliver/1000).toFixed(0)}t</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#E6F1FB', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#0C447C', fontWeight: 600 }}>Total estimated distance</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0C447C' }}>{routeStops.reduce((sum, s) => sum + (s.estimated_km || 0), 0)} km</span>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={saveRoute} disabled={saving || !routeForm.feed_mill_id || !routeForm.name || routeStops.length === 0} style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4A90C4', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditRoute ? 'Update route' : 'Save route'}
              </button>
              {isEditRoute && <button onClick={() => deleteRoute((routeDrawer as DeliveryRoute).id)} style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}
              <button onClick={() => setRouteDrawer(null)} style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── DRIVER DRAWER ─────────────────────────────────────── */}
      {driverDrawer && (
        <>
          <div onClick={() => setDriverDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 420, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {driverForm.name ? driverForm.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditDriver ? 'Edit driver' : 'New driver'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Delivery driver profile</div>
              </div>
              <button onClick={() => setDriverDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lStyle()}>Feed mill</label>
                <select value={driverForm.feed_mill_id} onChange={e => setDriverForm(p => ({ ...p, feed_mill_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">Select feed mill</option>
                  {feedMills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div style={{ height: '0.5px', background: '#e8ede9' }} />
              <div><label style={lStyle()}>Full name *</label><input style={iStyle(true)} value={driverForm.name} onChange={e => setDriverForm(p => ({ ...p, name: e.target.value }))} placeholder="James Mitchell" /></div>
              <div><label style={lStyle()}>License number</label><input style={iStyle(true)} value={driverForm.license} onChange={e => setDriverForm(p => ({ ...p, license: e.target.value }))} placeholder="HVL-001-VIC" /></div>
              <div><label style={lStyle()}>Phone</label><input style={iStyle(true)} value={driverForm.phone} onChange={e => setDriverForm(p => ({ ...p, phone: e.target.value }))} placeholder="+61 400 000 000" type="tel" /></div>
              <div><label style={lStyle()}>Email</label><input style={iStyle(true)} value={driverForm.email} onChange={e => setDriverForm(p => ({ ...p, email: e.target.value }))} placeholder="driver@mill.com" type="email" /></div>
              <div>
                <label style={lStyle()}>Assigned truck</label>
                <select value={driverForm.truck_id} onChange={e => setDriverForm(p => ({ ...p, truck_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">No truck assigned</option>
                  {trucks.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name} — {t.plate}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (driverForm.active ? '#4CAF7D' : '#e8ede9'), background: driverForm.active ? '#f4fbf7' : '#fff' }}>
                <input type="checkbox" checked={driverForm.active} onChange={e => setDriverForm(p => ({ ...p, active: e.target.checked }))} style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>Active driver</div>
                  <div style={{ fontSize: 11, color: '#aab8c0' }}>Available for route assignment</div>
                </div>
              </label>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={saveDriver} disabled={saving || !driverForm.name.trim()} style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditDriver ? 'Update driver' : 'Create driver'}
              </button>
              {isEditDriver && <button onClick={() => deleteDriver((driverDrawer as Driver).id)} style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}
              <button onClick={() => setDriverDrawer(null)} style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── TRUCK DRAWER ──────────────────────────────────────── */}
      {truckDrawer && (
        <>
          <div onClick={() => setTruckDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 400, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A90C4" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditTruck ? 'Edit truck' : 'New truck'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Fleet vehicle</div>
              </div>
              <button onClick={() => setTruckDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lStyle()}>Feed mill</label>
                <select value={truckForm.feed_mill_id} onChange={e => setTruckForm(p => ({ ...p, feed_mill_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">Select feed mill</option>
                  {feedMills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div><label style={lStyle()}>Truck name / model *</label><input style={iStyle(true)} value={truckForm.name} onChange={e => setTruckForm(p => ({ ...p, name: e.target.value }))} placeholder="Kenworth T610 — Red" /></div>
              <div><label style={lStyle()}>License plate</label><input style={iStyle(true)} value={truckForm.plate} onChange={e => setTruckForm(p => ({ ...p, plate: e.target.value }))} placeholder="ABC-123" /></div>
              <div><label style={lStyle()}>Capacity (kg)</label><input type="number" style={iStyle(true)} value={truckForm.capacity_kg} onChange={e => setTruckForm(p => ({ ...p, capacity_kg: e.target.value }))} placeholder="20000" step="1000" /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (truckForm.active ? '#4A90C4' : '#e8ede9'), background: truckForm.active ? '#E6F1FB' : '#fff' }}>
                <input type="checkbox" checked={truckForm.active} onChange={e => setTruckForm(p => ({ ...p, active: e.target.checked }))} style={{ accentColor: '#4A90C4', width: 14, height: 14 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>Active</div>
                  <div style={{ fontSize: 11, color: '#aab8c0' }}>Available for assignments</div>
                </div>
              </label>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={saveTruck} disabled={saving || !truckForm.name.trim()} style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4A90C4', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditTruck ? 'Update truck' : 'Create truck'}
              </button>
              {isEditTruck && <button onClick={() => deleteTruck((truckDrawer as Truck).id)} style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}
              <button onClick={() => setTruckDrawer(null)} style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── HEADER ────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-title">Logistics</div>
          <div className="page-sub">{feedMills.length} feed mills · {orders.filter(o => o.status === 'pending').length} pending · {drivers.filter(d => d.active).length} drivers</div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>{'✓ ' + msg}</div>}
          {tab === 'orders'    && <button className="btn-primary" onClick={() => { setOrderForm(emptyOrder); setOrderItemForms([]); setOrderDrawer('new') }}>+ New order</button>}
          {tab === 'logistics' && <button className="btn-primary" onClick={() => { setRouteForm(emptyRoute); setRouteStops([]); setAiReasoning(''); setSelectedFarmIds([]); setRouteDrawer('new') }}>+ Plan route</button>}
        </div>
      </div>

      {/* ── SUMMARY ───────────────────────────────────────────── */}
      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Critical farms</div><div className="sum-val red">{farmUrgency.filter(f => f.alertLevel === 'critical').length}</div><div className="sum-sub">Immediate restock</div></div>
        <div className="sum-card"><div className="sum-label">Pending orders</div><div className="sum-val" style={{ color: '#633806' }}>{orders.filter(o => o.status === 'pending').length}</div><div className="sum-sub">Awaiting assignment</div></div>
        <div className="sum-card"><div className="sum-label">In transit</div><div className="sum-val" style={{ color: '#0C447C' }}>{orders.filter(o => o.status === 'in_transit').length}</div><div className="sum-sub">Delivering now</div></div>
        <div className="sum-card"><div className="sum-label">Active drivers</div><div className="sum-val green">{drivers.filter(d => d.active).length}</div><div className="sum-sub">{trucks.filter(t => t.active).length} trucks</div></div>
      </div>

      {/* ── TABS ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid #e8ede9' }}>
        {[
          { key: 'monitor',   label: 'Farm monitor' },
          { key: 'orders',    label: 'Orders (' + orders.length + ')' },
          { key: 'logistics', label: 'Logistics (' + routes.length + ')' },
          { key: 'drivers',   label: 'Drivers (' + drivers.length + ')' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            style={{ padding: '9px 18px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer', border: 'none', background: 'transparent', fontFamily: 'inherit', color: tab === t.key ? '#1a2530' : '#8a9aaa', borderBottom: tab === t.key ? '2px solid #4A90C4' : '2px solid transparent', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── FARM MONITOR ──────────────────────────────────────── */}
      {tab === 'monitor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 90px 90px 100px 110px', gap: 12, padding: '0 16px 8px' }}>
            {['Farm', 'Feed status', 'Min days', 'Silos', 'Total feed', 'Action'].map(h => (
              <div key={h} style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{h}</div>
            ))}
          </div>
          {farmUrgency.map(({ farm, minDays, alertLevel, totalKg, siloCount }) => {
            const urgColor  = alertLevel === 'critical' ? '#E24B4A' : alertLevel === 'low' ? '#EF9F27' : '#4CAF7D'
            const daysColor = minDays <= 7 ? '#A32D2D' : minDays <= 14 ? '#633806' : '#27500A'
            return (
              <div key={farm.id}
                style={{ display: 'grid', gridTemplateColumns: '180px 1fr 90px 90px 100px 110px', gap: 12, alignItems: 'center', padding: '14px 16px', background: '#fff', borderRadius: 10, border: '0.5px solid #e8ede9', borderLeft: '3px solid ' + urgColor, cursor: 'pointer' }}
                onClick={() => setFarmDrawer(farm)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{farm.name}</div>
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>{farm.location || '—'}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: urgColor, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{alertLevel}</span>
                    <span style={{ fontSize: 11, color: '#aab8c0' }}>{(totalKg/1000).toFixed(1)}t</span>
                  </div>
                  <div style={{ height: 5, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: urgColor, width: Math.min(100, (totalKg/(siloCount*20000))*100) + '%' }} />
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: daysColor }}>{minDays < 999 ? minDays : '—'}</div>
                  <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase' }}>days</div>
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{siloCount}</div>
                <div style={{ fontSize: 12, color: '#1a2530', fontWeight: 500 }}>{(totalKg/1000).toFixed(1)}t</div>
                <div onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setOrderForm({ ...emptyOrder, farm_id: farm.id }); setOrderItemForms([]); setOrderDrawer('new') }}
                    style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '0.5px solid #4CAF7D', background: '#eaf5ee', color: '#27500A', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                    + Order
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ORDERS ────────────────────────────────────────────── */}
      {tab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No orders yet</div>
              <button onClick={() => { setOrderForm(emptyOrder); setOrderItemForms([]); setOrderDrawer('new') }} className="btn-primary">+ New order</button>
            </div>
          ) : orders.map(o => {
            const sc    = STATUS_COLORS[o.status] || STATUS_COLORS.pending
            const items = orderItems.filter(i => i.delivery_order_id === o.id)
            const totalKg = items.reduce((sum, i) => sum + i.kg_requested, 0)
            return (
              <div key={o.id}
                onClick={() => { setOrderForm({ feed_mill_id: o.feed_mill_id, farm_id: o.farm_id, driver_id: o.driver_id || '', truck_id: o.truck_id || '', status: o.status, scheduled_at: o.scheduled_at?.split('T')[0] || '', notes: o.notes || '' }); setOrderItemForms(items.map(i => ({ silo_id: i.silo_id, kg_requested: i.kg_requested.toString() }))); setOrderDrawer(o) }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9', borderLeft: '3px solid ' + sc.color, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{farmName(o.farm_id)}</div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: sc.bg, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#8a9aaa' }}>
                    {millName(o.feed_mill_id)}
                    {o.driver_id ? ' · ' + driverName(o.driver_id) : ''}
                    {o.truck_id  ? ' · ' + truckName(o.truck_id)   : ''}
                    {o.scheduled_at ? ' · ' + new Date(o.scheduled_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}
                    {items.length > 0 ? ' · ' + items.length + ' silo' + (items.length > 1 ? 's' : '') + ' · ' + (totalKg/1000).toFixed(1) + 't' : ''}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── LOGISTICS ─────────────────────────────────────────── */}
      {tab === 'logistics' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {(['day','week','month'] as const).map(v => (
              <button key={v} onClick={() => setCalView(v)}
                style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid ' + (calView === v ? '#4A90C4' : '#e8ede9'), background: calView === v ? '#E6F1FB' : '#fff', color: calView === v ? '#0C447C' : '#8a9aaa' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {routes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No routes planned</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Use AI planning to generate optimized delivery routes.</div>
              <button onClick={() => { setRouteForm(emptyRoute); setRouteStops([]); setAiReasoning(''); setSelectedFarmIds([]); setRouteDrawer('new') }} className="btn-primary">+ Plan first route</button>
            </div>
          ) : routes.map(r => {
            const sc  = ROUTE_STATUS[r.status] || ROUTE_STATUS.draft
            const drv = drivers.find(d => d.id === r.driver_id)
            const trk = trucks.find(t => t.id === r.truck_id)
            return (
              <div key={r.id}
                onClick={() => { setRouteForm({ feed_mill_id: r.feed_mill_id, driver_id: r.driver_id || '', truck_id: r.truck_id || '', name: r.name, planned_date: r.planned_date, status: r.status }); setRouteStops(r.stops || []); setAiReasoning(r.ai_reasoning || ''); setSelectedFarmIds((r.stops || []).map((s: any) => s.farm_id)); setRouteDrawer(r) }}
                style={{ display: 'flex', gap: 14, padding: '14px 16px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9', cursor: 'pointer', marginBottom: 8 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                <div style={{ width: 42, height: 42, borderRadius: 8, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sc.color} strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{r.name}</div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: sc.bg, color: sc.color, fontWeight: 600 }}>{r.status.replace('_', ' ')}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#8a9aaa', marginBottom: 4 }}>
                    {millName(r.feed_mill_id)} · {new Date(r.planned_date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {r.stops?.length > 0 ? ' · ' + r.stops.length + ' farms' : ''}
                    {r.total_km ? ' · ~' + r.total_km + 'km' : ''}
                  </div>
                  {(drv || trk) && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {drv && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#f0f4f0', color: '#6a7a8a' }}>{'👤 ' + drv.name}</span>}
                      {trk && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#E6F1FB', color: '#0C447C' }}>{'🚛 ' + (trk.plate || trk.name)}</span>}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600, alignSelf: 'center' }}>Edit →</span>
              </div>
            )
          })}
        </>
      )}

      {/* ── DRIVERS ───────────────────────────────────────────── */}
      {tab === 'drivers' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div className="card-title">Drivers</div>
              <button onClick={() => { setDriverForm(emptyDriver); setDriverDrawer('new') }}
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '0.5px solid #4CAF7D', background: '#eaf5ee', color: '#27500A', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                + New driver
              </button>
            </div>
            {drivers.length === 0 ? (
              <div style={{ color: '#8a9aaa', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No drivers yet.</div>
            ) : drivers.map(d => {
              const trk = trucks.find(t => t.id === d.truck_id)
              return (
                <div key={d.id}
                  onClick={() => { setDriverForm({ feed_mill_id: d.feed_mill_id, name: d.name, license: d.license || '', phone: d.phone || '', email: d.email || '', truck_id: d.truck_id || '', active: d.active }); setDriverDrawer(d) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '0.5px solid #f0f4f0', cursor: 'pointer' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: d.active ? '#1a2530' : '#e8ede9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: d.active ? '#fff' : '#aab8c0', flexShrink: 0 }}>
                    {d.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {d.name}
                      {!d.active && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#f0f4f0', color: '#aab8c0', fontWeight: 600 }}>Inactive</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>{d.license || 'No license'}{trk ? ' · ' + trk.name : ' · No truck'}</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span>
                </div>
              )
            })}
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <div className="card-title">Fleet</div>
              <button onClick={() => { setTruckForm(emptyTruck); setTruckDrawer('new') }}
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '0.5px solid #4A90C4', background: '#E6F1FB', color: '#0C447C', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                + New truck
              </button>
            </div>
            {trucks.length === 0 ? (
              <div style={{ color: '#8a9aaa', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No trucks yet.</div>
            ) : trucks.map(t => {
              const assignedDriver = drivers.find(d => d.truck_id === t.id)
              return (
                <div key={t.id}
                  onClick={() => { setTruckForm({ feed_mill_id: t.feed_mill_id, name: t.name, plate: t.plate || '', capacity_kg: t.capacity_kg.toString(), active: t.active }); setTruckDrawer(t) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '0.5px solid #f0f4f0', cursor: 'pointer' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: t.active ? '#E6F1FB' : '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.active ? '#4A90C4' : '#aab8c0'} strokeWidth="1.5" strokeLinecap="round">
                      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t.plate || t.name}
                      {!t.active && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#f0f4f0', color: '#aab8c0', fontWeight: 600 }}>Inactive</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>
                      {(t.capacity_kg/1000).toFixed(0)}t · {assignedDriver ? '👤 ' + assignedDriver.name : 'Unassigned'}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
```
