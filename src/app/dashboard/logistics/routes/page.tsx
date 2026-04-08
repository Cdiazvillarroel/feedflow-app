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

const AU_HOLIDAYS: Record<string, { name: string; states: string[] }> = {
  '2025-01-01': { name: "New Year's Day",  states: ['ALL'] },
  '2025-01-27': { name: 'Australia Day',   states: ['ALL'] },
  '2025-04-18': { name: 'Good Friday',     states: ['ALL'] },
  '2025-04-19': { name: 'Easter Saturday', states: ['VIC','NSW','QLD','SA'] },
  '2025-04-20': { name: 'Easter Sunday',   states: ['ALL'] },
  '2025-04-21': { name: 'Easter Monday',   states: ['ALL'] },
  '2025-04-25': { name: 'ANZAC Day',       states: ['ALL'] },
  '2025-06-09': { name: "King's Birthday", states: ['VIC','NSW','SA','TAS'] },
  '2025-11-04': { name: 'Melbourne Cup',   states: ['VIC'] },
  '2025-12-25': { name: 'Christmas Day',   states: ['ALL'] },
  '2025-12-26': { name: 'Boxing Day',      states: ['ALL'] },
  '2026-01-01': { name: "New Year's Day",  states: ['ALL'] },
  '2026-01-26': { name: 'Australia Day',   states: ['ALL'] },
  '2026-04-03': { name: 'Good Friday',     states: ['ALL'] },
  '2026-04-04': { name: 'Easter Saturday', states: ['VIC','NSW','QLD','SA'] },
  '2026-04-05': { name: 'Easter Sunday',   states: ['ALL'] },
  '2026-04-06': { name: 'Easter Monday',   states: ['ALL'] },
  '2026-04-25': { name: 'ANZAC Day',       states: ['ALL'] },
  '2026-06-08': { name: "King's Birthday", states: ['VIC','NSW','SA','TAS'] },
  '2026-11-03': { name: 'Melbourne Cup',   states: ['VIC'] },
  '2026-12-25': { name: 'Christmas Day',   states: ['ALL'] },
  '2026-12-26': { name: 'Boxing Day',      states: ['ALL'] },
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

function buildGoogleMapsUrl(mill: FeedMill, stops: any[], farms: Farm[]) {
  const origin  = mill.lat && mill.lng ? `${mill.lat},${mill.lng}` : encodeURIComponent(mill.location || mill.name)
  const sorted  = [...stops].sort((a, b) => a.order - b.order)
  if (sorted.length === 0) return `https://www.google.com/maps/search/?q=${encodeURIComponent(mill.location || mill.name)}`
  const getFarm = (s: any) => { const f = farms.find(f => f.id === s.farm_id); return f?.lat && f?.lng ? `${f.lat},${f.lng}` : encodeURIComponent(s.location || s.farm_name || '') }
  const last    = sorted[sorted.length - 1]
  const wps     = sorted.slice(0, -1).map(getFarm)
  const dest    = getFarm(last)
  return `https://www.google.com/maps/dir/${origin}/${wps.join('/')}/${dest}`
}

function buildWazeUrl(mill: FeedMill, stops: any[], farms: Farm[]) {
  const sorted = [...stops].sort((a, b) => a.order - b.order)
  if (sorted.length === 0) return null
  const first = sorted[0]
  const farm  = farms.find(f => f.id === first.farm_id)
  if (farm?.lat && farm?.lng) return `https://waze.com/ul?ll=${farm.lat},${farm.lng}&navigate=yes`
  if (first.location) return `https://waze.com/ul?q=${encodeURIComponent(first.location)}&navigate=yes`
  return null
}

function buildAppleMapsUrl(mill: FeedMill, stops: any[], farms: Farm[]) {
  const sorted = [...stops].sort((a, b) => a.order - b.order)
  if (sorted.length === 0) return null
  const origin = mill.lat && mill.lng ? `${mill.lat},${mill.lng}` : encodeURIComponent(mill.location || mill.name)
  const last   = sorted[sorted.length - 1]
  const farm   = farms.find(f => f.id === last.farm_id)
  const dest   = farm?.lat && farm?.lng ? `${farm.lat},${farm.lng}` : encodeURIComponent(last.location || last.farm_name)
  return `https://maps.apple.com/?saddr=${origin}&daddr=${dest}&dirflg=d`
}

function buildGoogleMapsEmbedUrl(mill: FeedMill, stops: any[], farms: Farm[]) {
  const key    = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key || stops.length === 0) return null
  const sorted = [...stops].sort((a, b) => a.order - b.order)
  const origin = mill.lat && mill.lng ? `${mill.lat},${mill.lng}` : encodeURIComponent(mill.location || mill.name)
  const last   = sorted[sorted.length - 1]
  const getFarm = (s: any) => { const f = farms.find(f => f.id === s.farm_id); return f?.lat && f?.lng ? `${f.lat},${f.lng}` : encodeURIComponent(s.location || s.farm_name) }
  const dest   = getFarm(last)
  const wps    = sorted.slice(0, -1).map(getFarm).join('|')
  let url = `https://www.google.com/maps/embed/v1/directions?key=${key}&origin=${origin}&destination=${dest}&mode=driving`
  if (wps) url += `&waypoints=${wps}`
  return url
}

function NavButtons({ mill, stops, farms }: { mill: FeedMill; stops: any[]; farms: Farm[] }) {
  const gmUrl    = buildGoogleMapsUrl(mill, stops, farms)
  const wazeUrl  = buildWazeUrl(mill, stops, farms)
  const appleUrl = buildAppleMapsUrl(mill, stops, farms)
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <a href={gmUrl} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 12, padding: '7px 12px', borderRadius: 7, background: '#4A90C4', color: '#fff', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
        Google Maps
      </a>
      {wazeUrl && (
        <a href={wazeUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, padding: '7px 12px', borderRadius: 7, background: '#06CCFF', color: '#fff', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          Waze
        </a>
      )}
      {appleUrl && (
        <a href={appleUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, padding: '7px 12px', borderRadius: 7, background: '#1a2530', color: '#fff', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/></svg>
          Apple Maps
        </a>
      )}
    </div>
  )
}

export default function RoutesPage() {
  const [feedMills,    setFeedMills]    = useState<FeedMill[]>([])
  const [farms,        setFarms]        = useState<Farm[]>([])
  const [silos,        setSilos]        = useState<Silo[]>([])
  const [siloStats,    setSiloStats]    = useState<SiloStat[]>([])
  const [drivers,      setDrivers]      = useState<Driver[]>([])
  const [trucks,       setTrucks]       = useState<Truck[]>([])
  const [routes,       setRoutes]       = useState<DeliveryRoute[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [aiLoading,    setAiLoading]    = useState(false)
  const [msg,          setMsg]          = useState('')
  const [drawer,       setDrawer]       = useState<DeliveryRoute | 'new' | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showCal,      setShowCal]      = useState(true)
  const [calMonth,     setCalMonth]     = useState(new Date())
  const [mapModal,     setMapModal]     = useState<DeliveryRoute | null>(null)
  const [aiResult,     setAiResult]     = useState<any[] | null>(null)
  const [aiReasoning,  setAiReasoning]  = useState('')

  const emptyForm = { feed_mill_id: '', driver_id: '', truck_id: '', name: '', planned_date: new Date().toISOString().split('T')[0], status: 'draft' }
  const [form,            setForm]            = useState(emptyForm)
  const [routeStops,      setRouteStops]      = useState<any[]>([])
  const [selectedFarmIds, setSelectedFarmIds] = useState<string[]>([])

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

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  const millName   = (id: string) => feedMills.find(m => m.id === id)?.name || '—'
  const driverName = (id: string | null) => id ? drivers.find(d => d.id === id)?.name || '—' : '—'
  const truckName  = (id: string | null) => id ? trucks.find(t => t.id === id)?.name || '—' : '—'
  const getStat    = (id: string) => siloStats.find(s => s.silo_id === id)
  const getDays    = (siloId: string) => {
    const stat = getStat(siloId); const silo = silos.find(s => s.id === siloId)
    if (!stat || !silo) return 999
    return Math.floor(stat.kg_remaining / (silo.capacity_kg * 0.02))
  }

  const farmUrgency = farms.map(farm => {
    const fs    = silos.filter(s => s.farm_id === farm.id)
    const stats = fs.map(s => getStat(s.id)).filter(Boolean) as SiloStat[]
    const minDays       = fs.length > 0 ? Math.min(...fs.map(s => getDays(s.id))) : 999
    const alertLevel    = stats.some(s => s.alert_level === 'critical') ? 'critical' : stats.some(s => s.alert_level === 'low') ? 'low' : 'ok'
    const totalKgNeeded = fs.reduce((sum, s) => { const stat = getStat(s.id); return sum + Math.max(0, s.capacity_kg * 0.85 - (stat?.kg_remaining || 0)) }, 0)
    return { farm, minDays, alertLevel, totalKgNeeded }
  }).sort((a, b) => a.minDays - b.minDays)

  function calDays() {
    const year = calMonth.getFullYear(), month = calMonth.getMonth()
    const first = new Date(year, month, 1).getDay()
    const total = new Date(year, month + 1, 0).getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < (first === 0 ? 6 : first - 1); i++) days.push(null)
    for (let i = 1; i <= total; i++) days.push(i)
    return days
  }
  function dateStr(day: number) {
    const y = calMonth.getFullYear(), m = String(calMonth.getMonth()+1).padStart(2,'0'), d = String(day).padStart(2,'0')
    return `${y}-${m}-${d}`
  }
  const routesForDay  = (day: number) => routes.filter(r => r.planned_date === dateStr(day))
  const holidayForDay = (day: number) => AU_HOLIDAYS[dateStr(day)]
  const isToday = (day: number) => { const t = new Date(); return t.getFullYear()===calMonth.getFullYear() && t.getMonth()===calMonth.getMonth() && t.getDate()===day }

  function openNew(date?: string) {
    setForm({ ...emptyForm, planned_date: date || new Date().toISOString().split('T')[0] })
    setRouteStops([]); setAiResult(null); setAiReasoning(''); setSelectedFarmIds([])
    setDrawer('new')
  }
  function openEdit(r: DeliveryRoute) {
    setForm({ feed_mill_id: r.feed_mill_id, driver_id: r.driver_id||'', truck_id: r.truck_id||'', name: r.name, planned_date: r.planned_date, status: r.status })
    setRouteStops(r.stops||[]); setAiResult(null); setAiReasoning(r.ai_reasoning||'')
    setSelectedFarmIds((r.stops||[]).map((s:any) => s.farm_id))
    setDrawer(r)
  }

  async function generateAIRoute() {
    if (!form.feed_mill_id || selectedFarmIds.length === 0) return
    setAiLoading(true); setAiResult(null)
    const mill     = feedMills.find(m => m.id === form.feed_mill_id)
    const selFarms = farms.filter(f => selectedFarmIds.includes(f.id))
    const farmData = selFarms.map(farm => {
      const fu   = farmUrgency.find(f => f.farm.id === farm.id)
      const dist = mill?.lat && mill?.lng && farm.lat && farm.lng ? Math.round(distKm(mill.lat, mill.lng, farm.lat, farm.lng)) : 999
      const score = (fu?.alertLevel==='critical'?100:fu?.alertLevel==='low'?60:20) + Math.max(0,100-(fu?.minDays||999)*5) + Math.max(0,50-dist*0.2)
      const materials = [...new Set(silos.filter(s => s.farm_id===farm.id).map(s => s.material).filter(Boolean))]
      return { farm, minDays: fu?.minDays||999, alertLevel: fu?.alertLevel||'ok', dist, totalKgNeeded: Math.round(fu?.totalKgNeeded||0), score: Math.round(score), materials }
    }).sort((a,b) => b.score-a.score)

    const prompt = [
      'You are a logistics optimizer for ' + (mill?.name||'a feed mill') + ' in Victoria, Australia.',
      'Feed mill: ' + (mill?.location||mill?.name||'unknown'), 'Route date: ' + form.planned_date, '',
      'Farms to visit:',
      farmData.map((f,i) => [
        (i+1)+'. '+f.farm.name+' ('+(f.farm.location||'no address')+')',
        '   Days: '+f.minDays+' | Alert: '+f.alertLevel+' | Dist: '+f.dist+'km',
        '   Needed: '+(f.totalKgNeeded/1000).toFixed(1)+'t | Materials: '+(f.materials.join(', ')||'mixed'),
        '   Score: '+f.score,
      ].join('\n')).join('\n\n'),
      '', 'Optimize by urgency + proximity + load. Return JSON only:',
      '{"stops":[{"farm_id":"...","farm_name":"...","order":1,"reason":"...","estimated_km":0,"kg_to_deliver":0}],"total_km":0,"reasoning":"..."}',
    ].join('\n')

    try {
      const res     = await fetch('/api/ai-route', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ messages:[{role:'user',content:prompt}] }) })
      const data    = await res.json()
      const cleaned = (data.content?.[0]?.text||'').replace(/```json/g,'').replace(/```/g,'').trim()
      const parsed  = JSON.parse(cleaned)
      const stops   = (parsed.stops||[]).map((s:any) => {
        const farm = farms.find(f=>f.id===s.farm_id)||farms.find(f=>f.name===s.farm_name)
        const fd   = farmData.find(f=>f.farm.id===farm?.id)
        return { ...s, farm_id:farm?.id||s.farm_id, farm_name:farm?.name||s.farm_name, location:farm?.location, lat:farm?.lat, lng:farm?.lng, days_remaining:fd?.minDays, alert_level:fd?.alertLevel, kg_to_deliver:s.kg_to_deliver||fd?.totalKgNeeded||0 }
      })
      setAiResult(stops); setAiReasoning(parsed.reasoning||'')
      if (!form.name) setForm(p => ({ ...p, name: form.planned_date+' — '+(mill?.name||'') }))
    } catch {
      const sorted = [...farmData]
      const stops  = sorted.map((f,i) => {
        let km = 0
        if (i===0) { km = mill?.lat&&mill?.lng&&f.farm.lat&&f.farm.lng ? Math.round(distKm(mill.lat,mill.lng,f.farm.lat,f.farm.lng)) : 0 }
        else { const prev=sorted[i-1]; km = prev.farm.lat&&prev.farm.lng&&f.farm.lat&&f.farm.lng ? Math.round(distKm(prev.farm.lat,prev.farm.lng,f.farm.lat,f.farm.lng)) : 0 }
        return { farm_id:f.farm.id, farm_name:f.farm.name, order:i+1, reason:f.alertLevel==='critical'?'Critical urgency':f.minDays+'d remaining', estimated_km:km, kg_to_deliver:f.totalKgNeeded, location:f.farm.location, lat:f.farm.lat, lng:f.farm.lng, days_remaining:f.minDays, alert_level:f.alertLevel }
      })
      setAiResult(stops); setAiReasoning('Generated by urgency + distance scoring (AI temporarily unavailable)')
      if (!form.name) setForm(p => ({ ...p, name: form.planned_date+' — '+(mill?.name||'') }))
    }
    setAiLoading(false)
  }

  function approveAiRoute() {
    if (!aiResult) return
    const mill   = feedMills.find(m => m.id === form.feed_mill_id)
    const sorted = [...aiResult].sort((a,b) => a.order-b.order)
    const stopsWithKm = sorted.map((stop,idx) => {
      let km = stop.estimated_km || 0
      if (idx===0 && mill?.lat && mill?.lng && stop.lat && stop.lng) km = Math.round(distKm(mill.lat,mill.lng,stop.lat,stop.lng))
      else if (idx>0) { const prev=sorted[idx-1]; if (prev.lat&&prev.lng&&stop.lat&&stop.lng) km = Math.round(distKm(prev.lat,prev.lng,stop.lat,stop.lng)) }
      return { ...stop, estimated_km: km }
    })
    setRouteStops(stopsWithKm); setAiResult(null)
    showMsg('Route approved — edit stops if needed, then save')
  }

  function moveStop(idx: number, dir: -1|1) {
    const s=[...routeStops]; const t=idx+dir
    if (t<0||t>=s.length) return
    ;[s[idx],s[t]]=[s[t],s[idx]]; s.forEach((x,i)=>x.order=i+1); setRouteStops(s)
  }
  function removeStop(idx: number) { const s=routeStops.filter((_,i)=>i!==idx); s.forEach((x,i)=>x.order=i+1); setRouteStops(s) }

  async function save() {
    if (!form.feed_mill_id) { showMsg('Please select a feed mill'); return }
    if (!form.name.trim())  { showMsg('Please enter a route name'); return }
    setSaving(true)
    try {
      const totalKm = routeStops.reduce((sum,s)=>sum+(s.estimated_km||0),0)
      const payload = { feed_mill_id:form.feed_mill_id, driver_id:form.driver_id||null, truck_id:form.truck_id||null, name:form.name.trim(), planned_date:form.planned_date, status:form.status||'draft', stops:routeStops, ai_reasoning:aiReasoning||null, total_km:totalKm||null }
      if (drawer && drawer!=='new') {
        const { error } = await supabase.from('delivery_routes').update(payload).eq('id',(drawer as DeliveryRoute).id)
        if (error) throw error
        showMsg('Route updated ✓')
      } else {
        const { error } = await supabase.from('delivery_routes').insert(payload)
        if (error) throw error
        showMsg('Route saved ✓')
      }
      setDrawer(null); await loadAll()
    } catch (e:any) {
      showMsg('Error: '+(e?.message||'Could not save route'))
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this route?')) return
    await supabase.from('delivery_routes').delete().eq('id',id)
    setDrawer(null); showMsg('Route deleted'); loadAll()
  }

  async function duplicate(r: DeliveryRoute) {
    const { error } = await supabase.from('delivery_routes').insert({ feed_mill_id:r.feed_mill_id, driver_id:r.driver_id, truck_id:r.truck_id, name:r.name+' (copy)', planned_date:r.planned_date, status:'draft', stops:r.stops, ai_reasoning:r.ai_reasoning, total_km:r.total_km })
    if (error) showMsg('Error: '+error.message)
    else { showMsg('Route duplicated'); loadAll() }
  }

  const isEdit   = drawer && drawer!=='new'
  const filtered = filterStatus==='all' ? routes : routes.filter(r=>r.status===filterStatus)
  const counts   = Object.keys(ROUTE_STATUS).reduce((acc,k)=>{ acc[k]=routes.filter(r=>r.status===k).length; return acc },{} as Record<string,number>)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, color:'#8a9aaa', fontSize:14 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:28, height:28, border:'2px solid #e8ede9', borderTopColor:'#4A90C4', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 10px' }} />
        Loading routes...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  const emptyMill: FeedMill = { id:'', name:'', location:null, lat:null, lng:null }

  return (
    <>
      {/* MAP MODAL */}
      {mapModal && (
        <>
          <div onClick={()=>setMapModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300 }} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'90vw', maxWidth:900, height:'80vh', background:'#fff', zIndex:301, borderRadius:16, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.3)', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'16px 20px', borderBottom:'0.5px solid #e8ede9', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a2530' }}>{mapModal.name}</div>
                <div style={{ fontSize:11, color:'#aab8c0', marginTop:2 }}>{millName(mapModal.feed_mill_id)} · {new Date(mapModal.planned_date+'T12:00:00').toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'})} · {mapModal.stops?.length||0} stops</div>
              </div>
              <NavButtons mill={feedMills.find(m=>m.id===mapModal.feed_mill_id)||emptyMill} stops={mapModal.stops||[]} farms={farms} />
              <button onClick={()=>setMapModal(null)} style={{ width:30, height:30, borderRadius:'50%', border:'0.5px solid #e8ede9', background:'#f7f9f8', cursor:'pointer', fontSize:16, color:'#8a9aaa', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            </div>
            {(() => {
              const mill     = feedMills.find(m=>m.id===mapModal.feed_mill_id)
              const embedUrl = mill ? buildGoogleMapsEmbedUrl(mill, mapModal.stops||[], farms) : null
              return embedUrl ? (
                <iframe src={embedUrl} style={{ flex:1, border:'none' }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              ) : (
                <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, color:'#8a9aaa' }}>
                  <div style={{ fontSize:40 }}>🗺️</div>
                  <div style={{ fontSize:14, color:'#1a2530', fontWeight:500 }}>Embedded map unavailable</div>
                  <div style={{ fontSize:12, color:'#aab8c0', textAlign:'center', maxWidth:320 }}>Add <code style={{ background:'#f0f4f0', padding:'2px 6px', borderRadius:4 }}>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to Vercel to enable the embedded map.</div>
                  <NavButtons mill={mill||emptyMill} stops={mapModal.stops||[]} farms={farms} />
                </div>
              )
            })()}
            <div style={{ padding:'12px 20px', borderTop:'0.5px solid #e8ede9', display:'flex', gap:8, overflowX:'auto' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'#1a2530', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>S</div>
                <span style={{ fontSize:11, color:'#6a7a8a', maxWidth:100, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{feedMills.find(m=>m.id===mapModal.feed_mill_id)?.name}</span>
              </div>
              {[...(mapModal.stops||[])].sort((a,b)=>a.order-b.order).map((stop,idx) => (
                <div key={idx} style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <div style={{ color:'#aab8c0', fontSize:16 }}>→</div>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:stop.alert_level==='critical'?'#E24B4A':stop.alert_level==='low'?'#EF9F27':'#4CAF7D', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff' }}>{idx+1}</div>
                  <span style={{ fontSize:11, color:'#1a2530', maxWidth:120, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontWeight:500 }}>{stop.farm_name}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ROUTE DRAWER */}
      {drawer && (
        <>
          <div onClick={()=>setDrawer(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:200 }} />
          <div style={{ position:'fixed', top:0, right:0, width:560, height:'100vh', background:'#fff', zIndex:201, display:'flex', flexDirection:'column', boxShadow:'-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'0.5px solid #e8ede9', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:'#E6F1FB', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A90C4" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a2530' }}>{isEdit?'Edit route':'Plan delivery route'}</div>
                <div style={{ fontSize:11, color:'#aab8c0', marginTop:2 }}>AI-assisted multi-farm delivery planning</div>
              </div>
              <button onClick={()=>setDrawer(null)} style={{ width:30, height:30, borderRadius:'50%', border:'0.5px solid #e8ede9', background:'#f7f9f8', cursor:'pointer', fontSize:16, color:'#8a9aaa', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
              <SecTitle title="Route setup" />
              <div><label style={lStyle()}>Route name *</label>
                <input style={iStyle(true)} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Monday run — Reid Stockfeed" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={lStyle()}>Feed mill *</label>
                  <select value={form.feed_mill_id} onChange={e=>setForm(p=>({...p,feed_mill_id:e.target.value}))} style={{ ...iStyle(true), background:'#fff' }}>
                    <option value="">Select mill</option>
                    {feedMills.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle()}>Planned date</label>
                  <input type="date" style={iStyle(true)} value={form.planned_date} onChange={e=>setForm(p=>({...p,planned_date:e.target.value}))} />
                  {AU_HOLIDAYS[form.planned_date] && <div style={{ fontSize:10, color:'#A32D2D', marginTop:4, fontWeight:600 }}>⚠️ {AU_HOLIDAYS[form.planned_date].name}</div>}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={lStyle()}>Assign driver</label>
                  <select value={form.driver_id} onChange={e=>setForm(p=>({...p,driver_id:e.target.value}))} style={{ ...iStyle(true), background:'#fff' }}>
                    <option value="">Unassigned</option>
                    {drivers.filter(d=>!form.feed_mill_id||d.feed_mill_id===form.feed_mill_id).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle()}>Assign truck</label>
                  <select value={form.truck_id} onChange={e=>setForm(p=>({...p,truck_id:e.target.value}))} style={{ ...iStyle(true), background:'#fff' }}>
                    <option value="">Unassigned</option>
                    {trucks.filter(t=>!form.feed_mill_id||t.feed_mill_id===form.feed_mill_id).map(t=><option key={t.id} value={t.id}>{t.name} ({(t.capacity_kg/1000).toFixed(0)}t)</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lStyle()}>Status</label>
                <div style={{ display:'flex', gap:6 }}>
                  {Object.entries(ROUTE_STATUS).map(([k,v]) => (
                    <button key={k} onClick={()=>setForm(p=>({...p,status:k}))}
                      style={{ flex:1, padding:'7px 4px', borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'0.5px solid '+(form.status===k?v.color+'88':'#e8ede9'), background:form.status===k?v.bg:'#fff', color:form.status===k?v.color:'#8a9aaa' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <SecTitle title="✦ AI Route Planner" />
              <div style={{ background:'#f7f9f8', borderRadius:12, padding:'16px' }}>
                <div style={{ fontSize:12, color:'#6a7a8a', marginBottom:12, lineHeight:1.6 }}>Select farms · AI optimizes by urgency, distance and load · Review before approving</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14, maxHeight:240, overflowY:'auto' }}>
                  {farmUrgency.map(({ farm, minDays, alertLevel, totalKgNeeded }) => {
                    const checked  = selectedFarmIds.includes(farm.id)
                    const mill     = feedMills.find(m=>m.id===form.feed_mill_id)
                    const dist     = mill?.lat&&mill?.lng&&farm.lat&&farm.lng ? Math.round(distKm(mill.lat,mill.lng,farm.lat,farm.lng)) : null
                    const urgColor = alertLevel==='critical'?'#E24B4A':alertLevel==='low'?'#EF9F27':'#4CAF7D'
                    return (
                      <label key={farm.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, border:'0.5px solid '+(checked?'#4CAF7D':'#e8ede9'), background:checked?'#f4fbf7':'#fff', cursor:'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={()=>setSelectedFarmIds(prev=>checked?prev.filter(id=>id!==farm.id):[...prev,farm.id])} style={{ accentColor:'#4CAF7D', width:14, height:14 }} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:checked?600:400, color:'#1a2530' }}>{farm.name}</div>
                          <div style={{ fontSize:11, color:'#aab8c0', marginTop:1 }}>
                            {minDays<999?minDays+'d left':'No data'}{dist!==null?' · '+dist+' km':''}{totalKgNeeded>0?' · '+(totalKgNeeded/1000).toFixed(0)+'t needed':''}
                          </div>
                        </div>
                        {alertLevel!=='ok' && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:8, background:alertLevel==='critical'?'#FCEBEB':'#FAEEDA', color:alertLevel==='critical'?'#A32D2D':'#633806', fontWeight:600 }}>{alertLevel}</span>}
                        <div style={{ fontSize:14, fontWeight:700, color:minDays<=7?'#A32D2D':minDays<=14?'#633806':urgColor, flexShrink:0 }}>{minDays<999?minDays+'d':'—'}</div>
                      </label>
                    )
                  })}
                </div>
                <button onClick={generateAIRoute} disabled={aiLoading||!form.feed_mill_id||selectedFarmIds.length===0}
                  style={{ width:'100%', padding:'11px', background:aiLoading?'#aab8c0':'linear-gradient(135deg,#1a2530 0%,#2d3f50 100%)', border:'none', borderRadius:8, fontSize:13, fontWeight:600, color:'#fff', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {aiLoading?<><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />Generating optimized route...</>:'✦ Generate AI route'}
                </button>
              </div>

              {aiResult && (
                <div style={{ background:'#fff8e6', borderRadius:12, padding:'16px', border:'0.5px solid #f0cc70' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#633806', textTransform:'uppercase', letterSpacing:'0.4px' }}>✦ AI Suggestion — Review before approving</div>
                    <button onClick={()=>setAiResult(null)} style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'0.5px solid #e0c060', background:'transparent', color:'#633806', cursor:'pointer', fontFamily:'inherit' }}>Dismiss</button>
                  </div>
                  {aiReasoning && <div style={{ fontSize:12, color:'#633806', lineHeight:1.6, marginBottom:12, padding:'8px 12px', background:'rgba(255,200,50,0.15)', borderRadius:6 }}>{aiReasoning}</div>}
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                    {[...aiResult].sort((a,b)=>a.order-b.order).map((stop,idx) => (
                      <div key={idx} style={{ display:'flex', gap:10, padding:'10px 12px', background:'#fff', borderRadius:8, border:'0.5px solid #e8ede9' }}>
                        <div style={{ width:26, height:26, borderRadius:'50%', background:'#EF9F27', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>{idx+1}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#1a2530' }}>{stop.farm_name}</div>
                          <div style={{ fontSize:11, color:'#8a9aaa' }}>{stop.reason}{stop.estimated_km?' · '+stop.estimated_km+'km':''}</div>
                        </div>
                        {stop.kg_to_deliver>0 && <div style={{ fontSize:11, color:'#aab8c0', flexShrink:0 }}>{(stop.kg_to_deliver/1000).toFixed(0)}t</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <button onClick={approveAiRoute} style={{ flex:1, padding:'10px', background:'#4CAF7D', border:'none', borderRadius:8, fontSize:13, fontWeight:600, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>✓ Approve this route</button>
                    <div style={{ fontSize:12, color:'#8a9aaa' }}>{aiResult.reduce((sum,s)=>sum+(s.estimated_km||0),0)} km est.</div>
                  </div>
                </div>
              )}

              {routeStops.length > 0 && (
                <>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#1a2530', textTransform:'uppercase', letterSpacing:'0.5px' }}>Route stops — {routeStops.length} farms</div>
                    {isEdit && (
                      <button onClick={()=>setMapModal(drawer as DeliveryRoute)}
                        style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'0.5px solid #4A90C4', background:'#E6F1FB', color:'#0C447C', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                        🗺️ View on map
                      </button>
                    )}
                  </div>
                  {aiReasoning && !aiResult && (
                    <div style={{ background:'#f7f9f8', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#6a7a8a', lineHeight:1.5, borderLeft:'3px solid #4CAF7D' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#4CAF7D', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:3 }}>AI Reasoning</div>
                      {aiReasoning}
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {[...routeStops].sort((a,b)=>a.order-b.order).map((stop,idx) => (
                      <div key={idx} style={{ display:'flex', gap:10, padding:'12px 14px', background:'#fff', borderRadius:8, border:'0.5px solid #e8ede9' }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background:'#1a2530', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>{idx+1}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#1a2530', marginBottom:2 }}>{stop.farm_name}</div>
                          <div style={{ fontSize:11, color:'#8a9aaa' }}>{stop.location||'No address'}{stop.estimated_km?' · '+stop.estimated_km+'km':''}</div>
                          {stop.reason && <div style={{ fontSize:11, color:'#4CAF7D', fontStyle:'italic', marginTop:2 }}>{stop.reason}</div>}
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flexShrink:0 }}>
                          <button onClick={()=>moveStop(idx,-1)} disabled={idx===0} style={{ width:22, height:22, borderRadius:4, border:'0.5px solid #e8ede9', background:'#fff', cursor:idx===0?'default':'pointer', fontSize:10, color:idx===0?'#e8ede9':'#6a7a8a', display:'flex', alignItems:'center', justifyContent:'center' }}>▲</button>
                          <button onClick={()=>moveStop(idx,1)} disabled={idx===routeStops.length-1} style={{ width:22, height:22, borderRadius:4, border:'0.5px solid #e8ede9', background:'#fff', cursor:idx===routeStops.length-1?'default':'pointer', fontSize:10, color:idx===routeStops.length-1?'#e8ede9':'#6a7a8a', display:'flex', alignItems:'center', justifyContent:'center' }}>▼</button>
                          <button onClick={()=>removeStop(idx)} style={{ width:22, height:22, borderRadius:4, border:'0.5px solid #F09595', background:'#FCEBEB', cursor:'pointer', fontSize:10, color:'#A32D2D', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:'#E6F1FB', borderRadius:8, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#0C447C', textTransform:'uppercase', letterSpacing:'0.4px' }}>Total estimated</div>
                      <div style={{ fontSize:11, color:'#4A90C4', marginTop:2 }}>{routeStops.length} stops · {(routeStops.reduce((sum,s)=>sum+(s.kg_to_deliver||0),0)/1000).toFixed(0)}t</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:24, fontWeight:700, color:'#0C447C' }}>{routeStops.reduce((sum,s)=>sum+(s.estimated_km||0),0)}</div>
                      <div style={{ fontSize:10, color:'#4A90C4', textTransform:'uppercase' }}>km</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ padding:'16px 24px', borderTop:'0.5px solid #e8ede9', display:'flex', gap:10 }}>
              <button onClick={save} disabled={saving}
                style={{ flex:1, padding:'10px', background:saving?'#aab8c0':'#4A90C4', border:'none', borderRadius:8, fontSize:13, fontWeight:600, color:'#fff', cursor:saving?'not-allowed':'pointer', fontFamily:'inherit' }}>
                {saving?'Saving...':isEdit?'Update route':'Save route'}
              </button>
              {isEdit && (
                <>
                  <button onClick={()=>duplicate(drawer as DeliveryRoute)} style={{ padding:'10px 14px', background:'#E6F1FB', border:'0.5px solid #4A90C4', borderRadius:8, fontSize:13, fontWeight:600, color:'#0C447C', cursor:'pointer', fontFamily:'inherit' }}>Duplicate</button>
                  <button onClick={()=>remove((drawer as DeliveryRoute).id)} style={{ padding:'10px 14px', background:'#FCEBEB', border:'0.5px solid #F09595', borderRadius:8, fontSize:13, fontWeight:600, color:'#A32D2D', cursor:'pointer', fontFamily:'inherit' }}>Delete</button>
                </>
              )}
              <button onClick={()=>setDrawer(null)} style={{ padding:'10px 14px', background:'#fff', border:'0.5px solid #e8ede9', borderRadius:8, fontSize:13, cursor:'pointer', color:'#6a7a8a', fontFamily:'inherit' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* HEADER */}
      <div className="page-header">
        <div>
          <div className="page-title">Route Planner</div>
          <div className="page-sub">{routes.length} routes · {counts.confirmed||0} confirmed · {counts.in_progress||0} in progress</div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding:'7px 14px', background:msg.startsWith('Error')?'#FCEBEB':'#eaf5ee', border:'0.5px solid '+(msg.startsWith('Error')?'#F09595':'#4CAF7D'), borderRadius:8, fontSize:12, fontWeight:600, color:msg.startsWith('Error')?'#A32D2D':'#27500A' }}>{msg}</div>}
          <button onClick={()=>setShowCal(p=>!p)} style={{ padding:'8px 14px', borderRadius:7, border:'0.5px solid #e8ede9', background:showCal?'#E6F1FB':'#fff', color:showCal?'#0C447C':'#6a7a8a', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>📅 Calendar</button>
          <button className="btn-primary" onClick={()=>openNew()}>+ Plan route</button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        {Object.entries(ROUTE_STATUS).map(([k,v]) => (
          <div key={k} className="sum-card" onClick={()=>setFilterStatus(filterStatus===k?'all':k)} style={{ cursor:'pointer', borderBottom:filterStatus===k?'2px solid '+v.color:'2px solid transparent' }}>
            <div className="sum-label">{v.label}</div>
            <div className="sum-val" style={{ color:v.color }}>{counts[k]||0}</div>
            <div className="sum-sub">routes</div>
          </div>
        ))}
      </div>

      {/* CALENDAR */}
      {showCal && (
        <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid #e8ede9', padding:'20px', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <button onClick={()=>setCalMonth(new Date(calMonth.getFullYear(),calMonth.getMonth()-1))} style={{ width:28, height:28, borderRadius:6, border:'0.5px solid #e8ede9', background:'#f7f9f8', cursor:'pointer', fontSize:14, color:'#6a7a8a', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
            <div style={{ fontSize:14, fontWeight:700, color:'#1a2530' }}>{calMonth.toLocaleDateString('en-AU',{month:'long',year:'numeric'})}</div>
            <button onClick={()=>setCalMonth(new Date(calMonth.getFullYear(),calMonth.getMonth()+1))} style={{ width:28, height:28, borderRadius:6, border:'0.5px solid #e8ede9', background:'#f7f9f8', cursor:'pointer', fontSize:14, color:'#6a7a8a', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(
              <div key={d} style={{ textAlign:'center', fontSize:10, color:'#aab8c0', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.4px', padding:'4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
            {calDays().map((day,i) => {
              if (!day) return <div key={i} />
              const dayRoutes = routesForDay(day)
              const holiday   = holidayForDay(day)
              const today     = isToday(day)
              return (
                <div key={i} style={{ minHeight:64, padding:'6px 8px', borderRadius:8, border:'0.5px solid '+(today?'#4A90C4':'#f0f4f0'), background:today?'#E6F1FB':holiday?'#FFF8E6':'#fff', position:'relative' }}>
                  <div style={{ fontSize:12, fontWeight:today?700:400, color:today?'#0C447C':'#1a2530', marginBottom:3 }}>{day}</div>
                  {holiday && <div style={{ fontSize:9, color:'#633806', lineHeight:1.2, marginBottom:3, fontWeight:600 }}>{holiday.name}</div>}
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {dayRoutes.slice(0,2).map((r,ri) => {
                      const sc = ROUTE_STATUS[r.status]||ROUTE_STATUS.draft
                      return (
                        <div key={ri} onClick={()=>openEdit(r)}
                          style={{ fontSize:9, fontWeight:600, padding:'2px 5px', borderRadius:4, background:sc.bg, color:sc.color, cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {r.name}
                        </div>
                      )
                    })}
                    {dayRoutes.length>2 && <div style={{ fontSize:9, color:'#aab8c0' }}>+{dayRoutes.length-2} more</div>}
                  </div>
                  <button onClick={()=>openNew(dateStr(day))}
                    style={{ position:'absolute', top:4, right:4, width:16, height:16, borderRadius:'50%', border:'none', background:'transparent', cursor:'pointer', fontSize:14, color:'#c8d8cc', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>+</button>
                </div>
              )
            })}
          </div>
          <div style={{ display:'flex', gap:16, marginTop:14, paddingTop:12, borderTop:'0.5px solid #f0f4f0', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:10, height:10, borderRadius:2, background:'#E6F1FB', border:'0.5px solid #4A90C4' }} /><span style={{ fontSize:10, color:'#6a7a8a' }}>Today</span></div>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:10, height:10, borderRadius:2, background:'#FFF8E6' }} /><span style={{ fontSize:10, color:'#6a7a8a' }}>Public holiday</span></div>
            {Object.entries(ROUTE_STATUS).map(([k,v])=>(
              <div key={k} style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:10, height:10, borderRadius:2, background:v.bg }} /><span style={{ fontSize:10, color:'#6a7a8a' }}>{v.label}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* ROUTES LIST */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.length===0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#8a9aaa' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🗺️</div>
            <div style={{ fontSize:15, fontWeight:500, color:'#1a2530', marginBottom:6 }}>No routes planned yet</div>
            <div style={{ fontSize:13, marginBottom:20 }}>Use the AI planner to generate optimized delivery routes.</div>
            <button onClick={()=>openNew()} className="btn-primary">+ Plan first route</button>
          </div>
        ) : filtered.map(r => {
          const sc      = ROUTE_STATUS[r.status]||ROUTE_STATUS.draft
          const drv     = drivers.find(d=>d.id===r.driver_id)
          const trk     = trucks.find(t=>t.id===r.truck_id)
          const holiday = AU_HOLIDAYS[r.planned_date]
          const mill    = feedMills.find(m=>m.id===r.feed_mill_id)||emptyMill
          return (
            <div key={r.id} style={{ display:'flex', gap:16, padding:'16px 20px', background:'#fff', borderRadius:10, border:'0.5px solid #e8ede9' }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.boxShadow='0 2px 12px rgba(0,0,0,0.06)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.boxShadow='none'}>
              <div style={{ width:44, height:44, borderRadius:10, background:sc.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={sc.color} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1a2530' }}>{r.name}</div>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:sc.bg, color:sc.color, fontWeight:600 }}>{sc.label}</span>
                  {holiday && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'#FAEEDA', color:'#633806', fontWeight:600 }}>⚠️ {holiday.name}</span>}
                </div>
                <div style={{ fontSize:12, color:'#8a9aaa', marginBottom:6 }}>
                  {millName(r.feed_mill_id)} · {new Date(r.planned_date+'T12:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
                  {r.stops?.length>0?' · '+r.stops.length+' farm'+(r.stops.length>1?'s':''):''}
                  {r.total_km?' · ~'+r.total_km+'km':''}
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {drv && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'#f0f4f0', color:'#6a7a8a' }}>👤 {drv.name}</span>}
                  {trk && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'#E6F1FB', color:'#0C447C' }}>🚛 {trk.plate||trk.name}</span>}
                  {r.stops?.length>0 && [...r.stops].sort((a:any,b:any)=>a.order-b.order).map((stop:any,idx:number)=>(
                    <span key={idx} style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:'#f7f9f8', color:'#8a9aaa', border:'0.5px solid #e8ede9' }}>{idx+1}. {stop.farm_name}</span>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:'#0C447C' }}>{r.total_km||'—'}</div>
                  <div style={{ fontSize:10, color:'#aab8c0', textTransform:'uppercase' }}>km</div>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
                  {r.stops?.length>0 && (
                    <button onClick={()=>setMapModal(r)} style={{ fontSize:11, padding:'5px 10px', borderRadius:6, border:'0.5px solid #4A90C4', background:'#E6F1FB', color:'#0C447C', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>🗺️ Map</button>
                  )}
                  {r.stops?.length>0 && <NavButtons mill={mill} stops={r.stops||[]} farms={farms} />}
                  <button onClick={()=>openEdit(r)} style={{ fontSize:11, padding:'5px 10px', borderRadius:6, border:'0.5px solid #4CAF7D', background:'#eaf5ee', color:'#27500A', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Edit</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
