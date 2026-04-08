'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface FeedMill {
  id: string; name: string; location: string | null
  lat: number | null; lng: number | null
  phone: string | null; email: string | null; active: boolean
}
interface Farm {
  id: string; name: string; location: string | null
  lat: number | null; lng: number | null
}
interface Silo {
  id: string; farm_id: string; name: string
  material: string | null; capacity_kg: number
}
interface SiloStatus {
  silo_id: string; level_pct: number; kg_remaining: number
  days_remaining: number; alert_level: string
}
interface DeliveryOrder {
  id: string; feed_mill_id: string; farm_id: string
  status: string; scheduled_at: string | null
  delivered_at: string | null; notes: string | null
  created_at: string
}
interface DeliveryOrderItem {
  id: string; delivery_order_id: string; silo_id: string
  material: string | null; kg_requested: number; kg_delivered: number
}
interface DeliveryRoute {
  id: string; feed_mill_id: string; name: string
  route_date: string; status: string; stops: any[]
  ai_reasoning: string | null; total_km: number | null
  created_at: string
}

type Tab = 'dashboard' | 'orders' | 'routes' | 'feedmills'

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: '#FAEEDA', color: '#633806', label: 'Pending'    },
  planned:    { bg: '#E6F1FB', color: '#0C447C', label: 'Planned'    },
  in_transit: { bg: '#eaf5ee', color: '#27500A', label: 'In transit' },
  delivered:  { bg: '#f0f4f0', color: '#6a7a8a', label: 'Delivered'  },
  cancelled:  { bg: '#FCEBEB', color: '#A32D2D', label: 'Cancelled'  },
}
const ROUTE_STATUS: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#f0f4f0', color: '#6a7a8a' },
  confirmed: { bg: '#E6F1FB', color: '#0C447C' },
  completed: { bg: '#eaf5ee', color: '#27500A' },
}

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}
function SectionTitle({ title }: { title: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0 8px', borderBottom: '0.5px solid #e8ede9', marginBottom: 12 }}>{title}</div>
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function urgencyScore(days: number, alertLevel: string, distKm: number) {
  const urgency = alertLevel === 'critical' ? 100 : alertLevel === 'low' ? 60 : 20
  const dayScore = Math.max(0, 100 - days * 5)
  const distScore = Math.max(0, 50 - distKm * 0.2)
  return urgency + dayScore + distScore
}

export default function LogisticsPage() {
  const [tab,       setTab]       = useState<Tab>('dashboard')
  const [feedMills, setFeedMills] = useState<FeedMill[]>([])
  const [farms,     setFarms]     = useState<Farm[]>([])
  const [silos,     setSilos]     = useState<Silo[]>([])
  const [siloStats, setSiloStats] = useState<SiloStatus[]>([])
  const [orders,    setOrders]    = useState<DeliveryOrder[]>([])
  const [orderItems,setOrderItems]= useState<DeliveryOrderItem[]>([])
  const [routes,    setRoutes]    = useState<DeliveryRoute[]>([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState('')
  const [saving,    setSaving]    = useState(false)

  // Drawers
  const [millDrawer,  setMillDrawer]  = useState<FeedMill | 'new' | null>(null)
  const [orderDrawer, setOrderDrawer] = useState<DeliveryOrder | 'new' | null>(null)
  const [routeDrawer, setRouteDrawer] = useState<DeliveryRoute | 'new' | null>(null)
  const [aiLoading,   setAiLoading]   = useState(false)

  // Forms
  const emptyMill  = { name: '', location: '', lat: '', lng: '', phone: '', email: '', active: true }
  const emptyOrder = { feed_mill_id: '', farm_id: '', status: 'pending', scheduled_at: '', notes: '' }
  const emptyRoute = { feed_mill_id: '', name: '', route_date: new Date().toISOString().split('T')[0], status: 'draft' }

  const [millForm,  setMillForm]  = useState(emptyMill)
  const [orderForm, setOrderForm] = useState(emptyOrder)
  const [orderItemForms, setOrderItemForms] = useState<{ silo_id: string; kg_requested: string }[]>([])
  const [routeForm, setRouteForm] = useState(emptyRoute)
  const [routeStops, setRouteStops] = useState<any[]>([])
  const [aiReasoning, setAiReasoning] = useState('')
  const [selectedFarmIds, setSelectedFarmIds] = useState<string[]>([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [fmRes, farmsRes, silosRes, statsRes, ordersRes, itemsRes, routesRes] = await Promise.all([
      supabase.from('feed_mills').select('*').order('name'),
      supabase.from('farms').select('*').order('name'),
      supabase.from('silos').select('*').order('name'),
      supabase.from('silo_latest_readings').select('*'),
      supabase.from('delivery_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('delivery_order_items').select('*'),
      supabase.from('delivery_routes').select('*').order('created_at', { ascending: false }),
    ])
    setFeedMills(fmRes.data || [])
    setFarms(farmsRes.data || [])
    setSilos(silosRes.data || [])
    setSiloStats(statsRes.data || [])
    setOrders(ordersRes.data || [])
    setOrderItems(itemsRes.data || [])
    setRoutes(routesRes.data || [])
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  // ── SILO STATUS HELPERS ──────────────────────────────────────
  function getSiloStat(siloId: string) {
    return siloStats.find(s => s.silo_id === siloId)
  }
  function getDaysRemaining(siloId: string) {
    const stat = getSiloStat(siloId)
    if (!stat) return 999
    const kg = stat.kg_remaining
    const silo = silos.find(s => s.id === siloId)
    const kgDay = silo ? (silo.capacity_kg * 0.02) : 400
    return Math.floor(kg / kgDay)
  }

  // ── DASHBOARD: Farm urgency list ─────────────────────────────
  const farmUrgency = farms.map(farm => {
    const farmSilos = silos.filter(s => s.farm_id === farm.id)
    const stats     = farmSilos.map(s => getSiloStat(s.id)).filter(Boolean) as SiloStatus[]
    const minDays   = stats.length > 0 ? Math.min(...stats.map(s => {
      const silo  = silos.find(x => x.id === s.silo_id)
      const kgDay = silo ? (silo.capacity_kg * 0.02) : 400
      return Math.floor(s.kg_remaining / kgDay)
    })) : 999
    const alertLevel = stats.some(s => s.alert_level === 'critical') ? 'critical'
      : stats.some(s => s.alert_level === 'low') ? 'low' : 'ok'
    const totalKg  = stats.reduce((sum, s) => sum + s.kg_remaining, 0)
    return { farm, minDays, alertLevel, totalKg, siloCount: farmSilos.length }
  }).sort((a, b) => a.minDays - b.minDays)

  // ── FEED MILL CRUD ───────────────────────────────────────────
  function openNewMill() { setMillForm(emptyMill); setMillDrawer('new') }
  function openEditMill(m: FeedMill) {
    setMillForm({ name: m.name, location: m.location || '', lat: m.lat?.toString() || '', lng: m.lng?.toString() || '', phone: m.phone || '', email: m.email || '', active: m.active })
    setMillDrawer(m)
  }
  async function saveMill() {
    if (!millForm.name.trim()) return
    setSaving(true)
    const payload = { name: millForm.name.trim(), location: millForm.location || null, lat: millForm.lat ? parseFloat(millForm.lat) : null, lng: millForm.lng ? parseFloat(millForm.lng) : null, phone: millForm.phone || null, email: millForm.email || null, active: millForm.active }
    if (millDrawer && millDrawer !== 'new') {
      await supabase.from('feed_mills').update(payload).eq('id', (millDrawer as FeedMill).id)
      showMsg('Feed mill updated')
    } else {
      await supabase.from('feed_mills').insert(payload)
      showMsg('Feed mill created')
    }
    setSaving(false); setMillDrawer(null); loadAll()
  }
  async function deleteMill(id: string) {
    if (!confirm('Delete this feed mill?')) return
    await supabase.from('feed_mills').delete().eq('id', id)
    setMillDrawer(null); showMsg('Feed mill deleted'); loadAll()
  }

  // ── ORDER CRUD ───────────────────────────────────────────────
  function openNewOrder() {
    setOrderForm(emptyOrder)
    setOrderItemForms([])
    setOrderDrawer('new')
  }
  function openEditOrder(o: DeliveryOrder) {
    setOrderForm({ feed_mill_id: o.feed_mill_id, farm_id: o.farm_id, status: o.status, scheduled_at: o.scheduled_at?.split('T')[0] || '', notes: o.notes || '' })
    const items = orderItems.filter(i => i.delivery_order_id === o.id)
    setOrderItemForms(items.map(i => ({ silo_id: i.silo_id, kg_requested: i.kg_requested.toString() })))
    setOrderDrawer(o)
  }
  async function saveOrder() {
    if (!orderForm.feed_mill_id || !orderForm.farm_id) return
    setSaving(true)
    const payload = { feed_mill_id: orderForm.feed_mill_id, farm_id: orderForm.farm_id, status: orderForm.status, scheduled_at: orderForm.scheduled_at ? new Date(orderForm.scheduled_at).toISOString() : null, notes: orderForm.notes || null }
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
    if (orderId && orderItemForms.length > 0) {
      const validItems = orderItemForms.filter(i => i.silo_id && i.kg_requested)
      if (validItems.length > 0) {
        await supabase.from('delivery_order_items').insert(
          validItems.map(i => ({ delivery_order_id: orderId, silo_id: i.silo_id, material: silos.find(s => s.id === i.silo_id)?.material || null, kg_requested: parseFloat(i.kg_requested) || 0, kg_delivered: 0 }))
        )
      }
    }
    setSaving(false); setOrderDrawer(null); loadAll()
  }
  async function deleteOrder(id: string) {
    if (!confirm('Delete this order?')) return
    await supabase.from('delivery_orders').delete().eq('id', id)
    setOrderDrawer(null); showMsg('Order deleted'); loadAll()
  }

  // ── ROUTE + AI ───────────────────────────────────────────────
  function openNewRoute() {
    setRouteForm(emptyRoute)
    setRouteStops([])
    setAiReasoning('')
    setSelectedFarmIds([])
    setRouteDrawer('new')
  }
  function openEditRoute(r: DeliveryRoute) {
    setRouteForm({ feed_mill_id: r.feed_mill_id, name: r.name, route_date: r.route_date, status: r.status })
    setRouteStops(r.stops || [])
    setAiReasoning(r.ai_reasoning || '')
    setRouteDrawer(r)
  }

  async function generateAIRoute() {
    if (!routeForm.feed_mill_id || selectedFarmIds.length === 0) return
    setAiLoading(true)
    const mill = feedMills.find(m => m.id === routeForm.feed_mill_id)
    const selectedFarms = farms.filter(f => selectedFarmIds.includes(f.id))

    const farmData = selectedFarms.map(farm => {
      const farmSilos = silos.filter(s => s.farm_id === farm.id)
      const stats     = farmSilos.map(s => ({ silo: s, stat: getSiloStat(s.id) })).filter(x => x.stat)
      const minDays   = stats.length > 0 ? Math.min(...stats.map(x => {
        const kgDay = x.silo.capacity_kg * 0.02
        return Math.floor((x.stat?.kg_remaining || 0) / kgDay)
      })) : 999
      const alertLevel = stats.some(x => x.stat?.alert_level === 'critical') ? 'critical'
        : stats.some(x => x.stat?.alert_level === 'low') ? 'low' : 'ok'
      const distKm = mill?.lat && mill?.lng && farm.lat && farm.lng
        ? distanceKm(mill.lat, mill.lng, farm.lat, farm.lng) : 999
      const score = urgencyScore(minDays, alertLevel, distKm)
      const totalKgNeeded = stats.reduce((sum, x) => {
        const capacity  = x.silo.capacity_kg
        const remaining = x.stat?.kg_remaining || 0
        return sum + Math.max(0, capacity * 0.85 - remaining)
      }, 0)
      return { farm, minDays, alertLevel, distKm: Math.round(distKm), score: Math.round(score), totalKgNeeded: Math.round(totalKgNeeded), siloCount: farmSilos.length }
    }).sort((a, b) => b.score - a.score)

    const prompt = [
      'You are a logistics optimizer for a feed distribution company.',
      'Feed mill: ' + mill?.name + ' located at ' + (mill?.location || 'unknown location'),
      '',
      'Farms to visit on ' + routeForm.route_date + ':',
      farmData.map((f, i) => [
        (i+1) + '. ' + f.farm.name + ' (' + (f.farm.location || 'no address') + ')',
        '   - Distance from mill: ' + f.distKm + ' km',
        '   - Days of feed remaining: ' + f.minDays + ' days',
        '   - Alert level: ' + f.alertLevel,
        '   - Feed needed: ' + f.totalKgNeeded + ' kg',
        '   - Priority score: ' + f.score,
      ].join('\n')).join('\n\n'),
      '',
      'Generate an optimized delivery route considering:',
      '1. Urgency (farms with fewer days of feed get higher priority)',
      '2. Geographic proximity (minimize total travel distance)',
      '3. Load optimization (total kg to deliver)',
      '',
      'Respond with a JSON object only, no markdown:',
      '{"stops":[{"farm_id":"...","farm_name":"...","order":1,"reason":"...","estimated_km":0,"kg_to_deliver":0}],"total_km":0,"reasoning":"Brief explanation of the route logic"}',
    ].join('\n')

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      const stops = (parsed.stops || []).map((s: any) => {
        const farm = farms.find(f => f.id === s.farm_id) || farms.find(f => f.name === s.farm_name)
        const fd   = farmData.find(f => f.farm.id === farm?.id)
        return { ...s, farm_id: farm?.id || s.farm_id, farm_name: farm?.name || s.farm_name, lat: farm?.lat, lng: farm?.lng, location: farm?.location, days_remaining: fd?.minDays, alert_level: fd?.alertLevel, kg_to_deliver: s.kg_to_deliver || fd?.totalKgNeeded || 0 }
      })

      setRouteStops(stops)
      setAiReasoning(parsed.reasoning || '')
      if (routeForm.name === '') setRouteForm(p => ({ ...p, name: 'Route ' + routeForm.route_date + ' — ' + (mill?.name || '') }))
    } catch (e) {
      const sorted = farmData.map((f, i) => ({ farm_id: f.farm.id, farm_name: f.farm.name, order: i + 1, reason: f.alertLevel === 'critical' ? 'Critical urgency' : f.minDays + ' days remaining', estimated_km: f.distKm, kg_to_deliver: f.totalKgNeeded, lat: f.farm.lat, lng: f.farm.lng, location: f.farm.location, days_remaining: f.minDays, alert_level: f.alertLevel }))
      setRouteStops(sorted)
      setAiReasoning('Route generated by urgency + distance scoring (AI unavailable)')
    }
    setAiLoading(false)
  }

  async function saveRoute() {
    if (!routeForm.feed_mill_id || !routeForm.name) return
    setSaving(true)
    const totalKm = routeStops.reduce((sum, s) => sum + (s.estimated_km || 0), 0)
    const payload = { feed_mill_id: routeForm.feed_mill_id, name: routeForm.name, route_date: routeForm.route_date, status: routeForm.status, stops: routeStops, ai_reasoning: aiReasoning || null, total_km: totalKm }
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

  const farmName = (id: string) => farms.find(f => f.id === id)?.name || '—'
  const millName = (id: string) => feedMills.find(m => m.id === id)?.name || '—'
  const isEditMill  = millDrawer  && millDrawer  !== 'new'
  const isEditOrder = orderDrawer && orderDrawer !== 'new'
  const isEditRoute = routeDrawer && routeDrawer !== 'new'

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
      {/* ── FEED MILL DRAWER ─────────────────────────────────────── */}
      {millDrawer && (
        <>
          <div onClick={() => setMillDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 420, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A90C4" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditMill ? 'Edit feed mill' : 'New feed mill'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Feed distribution plant</div>
              </div>
              <button onClick={() => setMillDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={lStyle()}>Mill name *</label><input style={iStyle(true)} value={millForm.name} onChange={e => setMillForm(p => ({ ...p, name: e.target.value }))} placeholder="Molino Central SA" /></div>
              <div><label style={lStyle()}>Location / Address</label><input style={iStyle(true)} value={millForm.location} onChange={e => setMillForm(p => ({ ...p, location: e.target.value }))} placeholder="123 Industrial Ave, Melbourne VIC" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lStyle()}>Latitude</label><input style={iStyle(true)} value={millForm.lat} onChange={e => setMillForm(p => ({ ...p, lat: e.target.value }))} placeholder="-37.8136" type="number" step="any" /></div>
                <div><label style={lStyle()}>Longitude</label><input style={iStyle(true)} value={millForm.lng} onChange={e => setMillForm(p => ({ ...p, lng: e.target.value }))} placeholder="144.9631" type="number" step="any" /></div>
              </div>
              <div style={{ height: '0.5px', background: '#e8ede9' }} />
              <div><label style={lStyle()}>Phone</label><input style={iStyle(true)} value={millForm.phone} onChange={e => setMillForm(p => ({ ...p, phone: e.target.value }))} placeholder="+61 3 0000 0000" type="tel" /></div>
              <div><label style={lStyle()}>Email</label><input style={iStyle(true)} value={millForm.email} onChange={e => setMillForm(p => ({ ...p, email: e.target.value }))} placeholder="ops@molino.com" type="email" /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (millForm.active ? '#4A90C4' : '#e8ede9'), background: millForm.active ? '#E6F1FB' : '#fff' }}>
                <input type="checkbox" checked={millForm.active} onChange={e => setMillForm(p => ({ ...p, active: e.target.checked }))} style={{ accentColor: '#4A90C4', width: 14, height: 14 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>Active</div>
                  <div style={{ fontSize: 11, color: '#aab8c0' }}>Available for route planning</div>
                </div>
              </label>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={saveMill} disabled={saving || !millForm.name.trim()} style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4A90C4', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditMill ? 'Update mill' : 'Create mill'}
              </button>
              {isEditMill && <button onClick={() => deleteMill((millDrawer as FeedMill).id)} style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}
              <button onClick={() => setMillDrawer(null)} style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── ORDER DRAWER ─────────────────────────────────────────── */}
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
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditOrder ? 'Edit delivery order' : 'New delivery order'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Assign feed delivery to a farm</div>
              </div>
              <button onClick={() => setOrderDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionTitle title="Order details" />
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

              <SectionTitle title="Silos to fill" />
              {!orderForm.farm_id ? (
                <div style={{ fontSize: 12, color: '#aab8c0', textAlign: 'center', padding: '12px', background: '#f7f9f8', borderRadius: 8 }}>Select a farm first</div>
              ) : (
                <>
                  {silos.filter(s => s.farm_id === orderForm.farm_id).map(silo => {
                    const stat      = getSiloStat(silo.id)
                    const itemIndex = orderItemForms.findIndex(i => i.silo_id === silo.id)
                    const included  = itemIndex >= 0
                    const kgDay     = silo.capacity_kg * 0.02
                    const days      = stat ? Math.floor(stat.kg_remaining / kgDay) : null
                    const suggestedKg = stat ? Math.max(0, Math.round(silo.capacity_kg * 0.85 - stat.kg_remaining)) : 0
                    return (
                      <div key={silo.id} style={{ border: '0.5px solid ' + (included ? '#4CAF7D' : '#e8ede9'), borderRadius: 8, padding: '12px 14px', background: included ? '#f4fbf7' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: included ? 10 : 0 }}>
                          <input type="checkbox" checked={included}
                            onChange={() => {
                              if (included) setOrderItemForms(prev => prev.filter(i => i.silo_id !== silo.id))
                              else setOrderItemForms(prev => [...prev, { silo_id: silo.id, kg_requested: suggestedKg.toString() }])
                            }}
                            style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{silo.name}</div>
                            <div style={{ fontSize: 11, color: '#aab8c0' }}>
                              {silo.material} · {stat ? stat.level_pct.toFixed(0) + '% · ' + (days ?? '?') + ' days' : 'No data'}
                            </div>
                          </div>
                          {stat && stat.alert_level !== 'ok' && (
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: stat.alert_level === 'critical' ? '#FCEBEB' : '#FAEEDA', color: stat.alert_level === 'critical' ? '#A32D2D' : '#633806', fontWeight: 600 }}>
                              {stat.alert_level}
                            </span>
                          )}
                        </div>
                        {included && (
                          <div style={{ paddingLeft: 24 }}>
                            <label style={{ ...lStyle(), marginBottom: 4 }}>Kg to deliver</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input type="number" value={orderItemForms[itemIndex]?.kg_requested || ''} onChange={e => setOrderItemForms(prev => prev.map((x, i) => i === itemIndex ? { ...x, kg_requested: e.target.value } : x))} style={{ ...iStyle(true), flex: 1 }} placeholder="0" />
                              <button onClick={() => setOrderItemForms(prev => prev.map((x, i) => i === itemIndex ? { ...x, kg_requested: suggestedKg.toString() } : x))} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, border: '0.5px solid #c8d8cc', background: '#f7f9f8', cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                Use {suggestedKg.toLocaleString()} kg
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {silos.filter(s => s.farm_id === orderForm.farm_id).length === 0 && (
                    <div style={{ fontSize: 12, color: '#aab8c0', textAlign: 'center', padding: '12px', background: '#f7f9f8', borderRadius: 8 }}>No silos found for this farm</div>
                  )}
                </>
              )}
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

      {/* ── ROUTE DRAWER ─────────────────────────────────────────── */}
      {routeDrawer && (
        <>
          <div onClick={() => setRouteDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 520, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f4fbf7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditRoute ? 'Edit route' : 'Plan delivery route'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>AI-optimized multi-farm delivery</div>
              </div>
              <button onClick={() => setRouteDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              <SectionTitle title="Route setup" />
              <div><label style={lStyle()}>Route name</label><input style={iStyle(true)} value={routeForm.name} onChange={e => setRouteForm(p => ({ ...p, name: e.target.value }))} placeholder="Monday run — Molino Central" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Feed mill *</label>
                  <select value={routeForm.feed_mill_id} onChange={e => setRouteForm(p => ({ ...p, feed_mill_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Select mill</option>
                    {feedMills.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div><label style={lStyle()}>Route date</label><input type="date" style={iStyle(true)} value={routeForm.route_date} onChange={e => setRouteForm(p => ({ ...p, route_date: e.target.value }))} /></div>
              </div>
              <div>
                <label style={lStyle()}>Status</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.entries(ROUTE_STATUS).map(([k, v]) => (
                    <button key={k} onClick={() => setRouteForm(p => ({ ...p, status: k }))}
                      style={{ flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid ' + (routeForm.status === k ? v.color + '88' : '#e8ede9'), background: routeForm.status === k ? v.bg : '#fff', color: routeForm.status === k ? v.color : '#8a9aaa' }}>
                      {k.charAt(0).toUpperCase() + k.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <SectionTitle title="Select farms to visit" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {farmUrgency.map(({ farm, minDays, alertLevel, totalKg }) => {
                  const checked = selectedFarmIds.includes(farm.id)
                  const mill = feedMills.find(m => m.id === routeForm.feed_mill_id)
                  const dist = mill?.lat && mill?.lng && farm.lat && farm.lng ? Math.round(distanceKm(mill.lat, mill.lng, farm.lat, farm.lng)) : null
                  return (
                    <label key={farm.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (checked ? '#4CAF7D' : '#e8ede9'), background: checked ? '#f4fbf7' : '#fff', cursor: 'pointer' }}>
                      <input type="checkbox" checked={checked} onChange={() => setSelectedFarmIds(prev => checked ? prev.filter(id => id !== farm.id) : [...prev, farm.id])} style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: '#1a2530' }}>{farm.name}</div>
                        <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>
                          {minDays < 999 ? minDays + ' days left' : 'No sensor data'}
                          {dist !== null ? ' · ' + dist + ' km' : ''}
                          {' · ' + (totalKg / 1000).toFixed(0) + ' t available'}
                        </div>
                      </div>
                      {alertLevel !== 'ok' && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: alertLevel === 'critical' ? '#FCEBEB' : '#FAEEDA', color: alertLevel === 'critical' ? '#A32D2D' : '#633806', fontWeight: 600 }}>
                          {alertLevel}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>

              <button onClick={generateAIRoute} disabled={aiLoading || !routeForm.feed_mill_id || selectedFarmIds.length === 0}
                style={{ padding: '11px', background: aiLoading ? '#aab8c0' : '#1a2530', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {aiLoading ? (
                  <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Generating optimized route...</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> Generate AI route</>
                )}
              </button>

              {routeStops.length > 0 && (
                <>
                  <SectionTitle title={'Optimized route — ' + routeStops.length + ' stops'} />
                  {aiReasoning && (
                    <div style={{ background: '#f7f9f8', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#6a7a8a', lineHeight: 1.6, borderLeft: '3px solid #4CAF7D' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#4CAF7D', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>AI Reasoning</div>
                      {aiReasoning}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {routeStops.sort((a, b) => a.order - b.order).map((stop, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{idx + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', marginBottom: 2 }}>{stop.farm_name}</div>
                          <div style={{ fontSize: 11, color: '#8a9aaa', marginBottom: 4 }}>
                            {stop.location || 'No address'}
                            {stop.estimated_km ? ' · ' + stop.estimated_km + ' km from mill' : ''}
                          </div>
                          {stop.reason && <div style={{ fontSize: 11, color: '#4CAF7D', fontStyle: 'italic' }}>{stop.reason}</div>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {stop.days_remaining && stop.days_remaining < 999 && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: stop.days_remaining <= 7 ? '#A32D2D' : stop.days_remaining <= 14 ? '#633806' : '#27500A' }}>
                              {stop.days_remaining}d left
                            </div>
                          )}
                          {stop.kg_to_deliver > 0 && <div style={{ fontSize: 11, color: '#aab8c0' }}>{Math.round(stop.kg_to_deliver / 1000).toFixed(0)} t</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#eaf5ee', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#27500A', fontWeight: 600 }}>Total estimated distance</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#27500A' }}>{routeStops.reduce((sum, s) => sum + (s.estimated_km || 0), 0)} km</span>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={saveRoute} disabled={saving || !routeForm.feed_mill_id || !routeForm.name || routeStops.length === 0} style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditRoute ? 'Update route' : 'Save route'}
              </button>
              {isEditRoute && <button onClick={() => deleteRoute((routeDrawer as DeliveryRoute).id)} style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}
              <button onClick={() => setRouteDrawer(null)} style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-title">Logistics</div>
          <div className="page-sub">{feedMills.length} feed mills · {orders.filter(o => o.status === 'pending').length} pending orders · {routes.filter(r => r.status !== 'completed').length} active routes</div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>{'✓ ' + msg}</div>}
          {tab === 'feedmills' && <button className="btn-primary" onClick={openNewMill}>+ New feed mill</button>}
          {tab === 'orders'    && <button className="btn-primary" onClick={openNewOrder}>+ New order</button>}
          {tab === 'routes'    && <button className="btn-primary" onClick={openNewRoute}>+ Plan route</button>}
        </div>
      </div>

      {/* ── SUMMARY ────────────────────────────────────────────────── */}
      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Feed mills</div><div className="sum-val" style={{ color: '#4A90C4' }}>{feedMills.filter(m => m.active).length}</div><div className="sum-sub">Active mills</div></div>
        <div className="sum-card"><div className="sum-label">Pending orders</div><div className="sum-val red">{orders.filter(o => o.status === 'pending').length}</div><div className="sum-sub">Awaiting planning</div></div>
        <div className="sum-card"><div className="sum-label">In transit</div><div className="sum-val" style={{ color: '#633806' }}>{orders.filter(o => o.status === 'in_transit').length}</div><div className="sum-sub">Currently delivering</div></div>
        <div className="sum-card"><div className="sum-label">Critical farms</div><div className="sum-val red">{farmUrgency.filter(f => f.alertLevel === 'critical').length}</div><div className="sum-sub">Need immediate restock</div></div>
      </div>

      {/* ── TABS ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid #e8ede9' }}>
        {[
          { key: 'dashboard', label: 'Farm urgency' },
          { key: 'orders',    label: 'Orders (' + orders.length + ')' },
          { key: 'routes',    label: 'Routes (' + routes.length + ')' },
          { key: 'feedmills', label: 'Feed mills (' + feedMills.length + ')' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            style={{ padding: '9px 18px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer', border: 'none', background: 'transparent', fontFamily: 'inherit', color: tab === t.key ? '#1a2530' : '#8a9aaa', borderBottom: tab === t.key ? '2px solid #4A90C4' : '2px solid transparent', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ──────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 100px 100px 120px 120px', gap: 12, padding: '0 16px 8px' }}>
            {['Farm', 'Feed status', 'Min days', 'Silos', 'Total feed', 'Action'].map(h => (
              <div key={h} style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{h}</div>
            ))}
          </div>
          {farmUrgency.map(({ farm, minDays, alertLevel, totalKg, siloCount }) => {
            const urgColor = alertLevel === 'critical' ? '#E24B4A' : alertLevel === 'low' ? '#EF9F27' : '#4CAF7D'
            const daysColor = minDays <= 7 ? '#A32D2D' : minDays <= 14 ? '#633806' : '#27500A'
            return (
              <div key={farm.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 100px 100px 120px 120px', gap: 12, alignItems: 'center', padding: '14px 16px', background: '#fff', borderRadius: 10, border: '0.5px solid #e8ede9', borderLeft: '3px solid ' + urgColor }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{farm.name}</div>
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>{farm.location || '—'}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: urgColor, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{alertLevel}</span>
                    <span style={{ fontSize: 11, color: '#aab8c0' }}>{(totalKg / 1000).toFixed(1)} t</span>
                  </div>
                  <div style={{ height: 5, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: urgColor, width: Math.min(100, (totalKg / (siloCount * 20000)) * 100) + '%' }} />
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: daysColor }}>{minDays < 999 ? minDays : '—'}</div>
                  <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase' }}>days</div>
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{siloCount}</div>
                <div style={{ fontSize: 12, color: '#1a2530', fontWeight: 500 }}>{(totalKg / 1000).toFixed(1)} t</div>
                <div>
                  <button onClick={() => { setOrderForm({ ...emptyOrder, farm_id: farm.id }); setOrderItemForms([]); setOrderDrawer('new') }}
                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '0.5px solid #4CAF7D', background: '#eaf5ee', color: '#27500A', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                    + Order
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ORDERS TAB ─────────────────────────────────────────────── */}
      {tab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No orders yet</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Create your first delivery order.</div>
              <button onClick={openNewOrder} className="btn-primary">+ New order</button>
            </div>
          ) : orders.map(o => {
            const sc    = STATUS_COLORS[o.status] || STATUS_COLORS.pending
            const items = orderItems.filter(i => i.delivery_order_id === o.id)
            const totalKg = items.reduce((sum, i) => sum + i.kg_requested, 0)
            return (
              <div key={o.id} onClick={() => openEditOrder(o)}
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
                    {o.scheduled_at ? ' · ' + new Date(o.scheduled_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}
                    {items.length > 0 ? ' · ' + items.length + ' silo' + (items.length > 1 ? 's' : '') + ' · ' + (totalKg / 1000).toFixed(1) + ' t' : ''}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ROUTES TAB ─────────────────────────────────────────────── */}
      {tab === 'routes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {routes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No routes planned yet</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Use AI to generate optimized delivery routes.</div>
              <button onClick={openNewRoute} className="btn-primary">+ Plan first route</button>
            </div>
          ) : routes.map(r => {
            const sc = ROUTE_STATUS[r.status] || ROUTE_STATUS.draft
            return (
              <div key={r.id} onClick={() => openEditRoute(r)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sc.color} strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{r.name}</div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: sc.bg, color: sc.color, fontWeight: 600 }}>{r.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#8a9aaa' }}>
                    {millName(r.feed_mill_id)}
                    {' · ' + new Date(r.route_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {r.stops?.length > 0 ? ' · ' + r.stops.length + ' stops' : ''}
                    {r.total_km ? ' · ~' + r.total_km + ' km' : ''}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── FEED MILLS TAB ─────────────────────────────────────────── */}
      {tab === 'feedmills' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {feedMills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏭</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No feed mills yet</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Add your first feed mill to start planning deliveries.</div>
              <button onClick={openNewMill} className="btn-primary">+ Add feed mill</button>
            </div>
          ) : feedMills.map(m => (
            <div key={m.id} onClick={() => openEditMill(m)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: m.active ? '#E6F1FB' : '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={m.active ? '#4A90C4' : '#aab8c0'} strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{m.name}</div>
                  {!m.active && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#f0f4f0', color: '#aab8c0', fontWeight: 600 }}>Inactive</span>}
                </div>
                <div style={{ fontSize: 11, color: '#8a9aaa' }}>
                  {[m.location, m.email, m.phone].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#aab8c0' }}>{orders.filter(o => o.feed_mill_id === m.id).length} orders</div>
                  <div style={{ fontSize: 11, color: '#aab8c0' }}>{routes.filter(r => r.feed_mill_id === m.id).length} routes</div>
                </div>
                <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
