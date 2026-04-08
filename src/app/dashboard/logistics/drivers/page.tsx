'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

interface FeedMill { id: string; name: string }
interface Driver   { id: string; feed_mill_id: string; name: string; license: string | null; phone: string | null; email: string | null; truck_id: string | null; active: boolean; created_at: string }
interface Truck    { id: string; feed_mill_id: string; name: string; plate: string | null; capacity_kg: number; active: boolean }
interface DeliveryRoute { id: string; driver_id: string | null; truck_id: string | null; name: string; planned_date: string; status: string }

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

export default function DriversPage() {
  const { selectedMillId } = useFarm()
  const [feedMills, setFeedMills] = useState<FeedMill[]>([])
  const [drivers,   setDrivers]   = useState<Driver[]>([])
  const [trucks,    setTrucks]    = useState<Truck[]>([])
  const [routes,    setRoutes]    = useState<DeliveryRoute[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState('')
  const [view,      setView]      = useState<'drivers' | 'fleet'>('drivers')

  const [driverDrawer, setDriverDrawer] = useState<Driver | 'new' | null>(null)
  const [truckDrawer,  setTruckDrawer]  = useState<Truck  | 'new' | null>(null)

  const emptyDriver = { feed_mill_id: '', name: '', license: '', phone: '', email: '', truck_id: '', active: true }
  const emptyTruck  = { feed_mill_id: '', name: '', plate: '', capacity_kg: '20000', active: true }
  const [driverForm, setDriverForm] = useState(emptyDriver)
  const [truckForm,  setTruckForm]  = useState(emptyTruck)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [fmR, driversR, trucksR, routesR] = await Promise.all([
      supabase.from('feed_mills').select('id, name').order('name'),
      supabase.from('drivers').select('*').order('name'),
      supabase.from('trucks').select('*').order('name'),
      supabase.from('delivery_routes').select('id, driver_id, truck_id, name, planned_date, status').order('planned_date', { ascending: false }),
    ])
    setFeedMills(fmR.data || [])
    setDrivers(driversR.data || [])
    setTrucks(trucksR.data || [])
    setRoutes(routesR.data || [])
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }
  const millName = (id: string) => feedMills.find(m => m.id === id)?.name || '—'
  const truckName = (id: string | null) => id ? trucks.find(t => t.id === id)?.name || '—' : '—'

  // ── DRIVER CRUD ──────────────────────────────────────────────
  function openNewDriver() { setDriverForm(emptyDriver); setDriverDrawer('new') }
  function openEditDriver(d: Driver) {
    setDriverForm({ feed_mill_id: d.feed_mill_id, name: d.name, license: d.license || '', phone: d.phone || '', email: d.email || '', truck_id: d.truck_id || '', active: d.active })
    setDriverDrawer(d)
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

  // ── TRUCK CRUD ───────────────────────────────────────────────
  function openNewTruck() { setTruckForm(emptyTruck); setTruckDrawer('new') }
  function openEditTruck(t: Truck) {
    setTruckForm({ feed_mill_id: t.feed_mill_id, name: t.name, plate: t.plate || '', capacity_kg: t.capacity_kg.toString(), active: t.active })
    setTruckDrawer(t)
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

  const isEditDriver = driverDrawer && driverDrawer !== 'new'
  const isEditTruck  = truckDrawer  && truckDrawer  !== 'new'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading drivers...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {/* ── DRIVER DRAWER ─────────────────────────────────────── */}
      {driverDrawer && (
        <>
          <div onClick={() => setDriverDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 440, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
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
                  {trucks.filter(t => t.active && (!driverForm.feed_mill_id || t.feed_mill_id === driverForm.feed_mill_id)).map(t => <option key={t.id} value={t.id}>{t.name} — {t.plate}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (driverForm.active ? '#4CAF7D' : '#e8ede9'), background: driverForm.active ? '#f4fbf7' : '#fff' }}>
                <input type="checkbox" checked={driverForm.active} onChange={e => setDriverForm(p => ({ ...p, active: e.target.checked }))} style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>Active driver</div>
                  <div style={{ fontSize: 11, color: '#aab8c0' }}>Available for route assignment</div>
                </div>
              </label>

              {/* Assigned routes */}
              {isEditDriver && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, paddingTop: 8, borderTop: '0.5px solid #e8ede9' }}>Assigned routes</div>
                  {routes.filter(r => r.driver_id === (driverDrawer as Driver).id).slice(0, 5).map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.status === 'completed' ? '#aab8c0' : '#4A90C4', flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12, color: '#1a2530' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#aab8c0' }}>{new Date(r.planned_date + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                    </div>
                  ))}
                  {routes.filter(r => r.driver_id === (driverDrawer as Driver).id).length === 0 && (
                    <div style={{ fontSize: 12, color: '#aab8c0' }}>No routes assigned yet</div>
                  )}
                </div>
              )}
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
          <div style={{ position: 'fixed', top: 0, right: 0, width: 420, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
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
                  <div style={{ fontSize: 11, color: '#aab8c0' }}>Available for delivery assignments</div>
                </div>
              </label>

              {/* Assigned driver */}
              {isEditTruck && (
                <div style={{ paddingTop: 8, borderTop: '0.5px solid #e8ede9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Assigned driver</div>
                  {(() => {
                    const assignedDriver = drivers.find(d => d.truck_id === (truckDrawer as Truck).id)
                    return assignedDriver ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f7f9f8', borderRadius: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                          {assignedDriver.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{assignedDriver.name}</div>
                          <div style={{ fontSize: 11, color: '#aab8c0' }}>{assignedDriver.license || 'No license'}</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#aab8c0' }}>No driver assigned to this truck</div>
                    )
                  })()}
                </div>
              )}

              {/* Assigned routes */}
              {isEditTruck && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, paddingTop: 8, borderTop: '0.5px solid #e8ede9' }}>Recent routes</div>
                  {routes.filter(r => r.truck_id === (truckDrawer as Truck).id).slice(0, 4).map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.status === 'completed' ? '#aab8c0' : '#4A90C4', flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12, color: '#1a2530' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#aab8c0' }}>{new Date(r.planned_date + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                    </div>
                  ))}
                  {routes.filter(r => r.truck_id === (truckDrawer as Truck).id).length === 0 && (
                    <div style={{ fontSize: 12, color: '#aab8c0' }}>No routes assigned yet</div>
                  )}
                </div>
              )}
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

      {/* HEADER */}
      <div className="page-header">
        <div>
          <div className="page-title">Drivers & Fleet</div>
          <div className="page-sub">{drivers.filter(d => d.active).length} active drivers · {trucks.filter(t => t.active).length} active trucks</div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>{'✓ ' + msg}</div>}
          {view === 'drivers' && <button className="btn-primary" onClick={openNewDriver}>+ New driver</button>}
          {view === 'fleet'   && <button className="btn-primary" style={{ background: '#4A90C4' }} onClick={openNewTruck}>+ New truck</button>}
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Active drivers</div><div className="sum-val green">{drivers.filter(d => d.active && (!selectedMillId || d.feed_mill_id === selectedMillId)).length}</div>
        <div className="sum-card"><div className="sum-label">Inactive</div><div className="sum-val" style={{ color: '#aab8c0' }}>{drivers.filter(d => !d.active && (!selectedMillId || d.feed_mill_id === selectedMillId)).length}</div><<div className="sum-sub">Drivers</div></div>
        <div className="sum-card"><div className="sum-label">Active trucks</div><div className="sum-val" style={{ color: '#4A90C4' }}>{trucks.filter(t => t.active && (!selectedMillId || t.feed_mill_id === selectedMillId)).length}</div><div className="sum-sub">Fleet vehicles</div></div>
        <div className="sum-card"><div className="sum-label">Total capacity</div><div className="sum-val" style={{ color: '#4A90C4' }}>{(trucks.filter(t => t.active && (!selectedMillId || t.feed_mill_id === selectedMillId)).reduce((sum, t) => sum + t.capacity_kg, 0) / 1000).toFixed(0)}t</div><div className="sum-sub">Active fleet</div></div>
      </div>

      {/* VIEW TOGGLE */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid #e8ede9' }}>
        {[{ key: 'drivers', label: 'Drivers (' + drivers.length + ')' }, { key: 'fleet', label: 'Fleet (' + trucks.length + ')' }].map(v => (
          <button key={v.key} onClick={() => setView(v.key as any)}
            style={{ padding: '9px 18px', fontSize: 13, fontWeight: view === v.key ? 600 : 400, cursor: 'pointer', border: 'none', background: 'transparent', fontFamily: 'inherit', color: view === v.key ? '#1a2530' : '#8a9aaa', borderBottom: view === v.key ? '2px solid #4CAF7D' : '2px solid transparent', marginBottom: -1 }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* DRIVERS VIEW */}
      {view === 'drivers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {drivers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No drivers yet</div>
              <button onClick={openNewDriver} className="btn-primary">+ Add first driver</button>
            </div>
          ) : drivers.filter(d => !selectedMillId || d.feed_mill_id === selectedMillId).map(d => {  
            const trk          = trucks.find(t => t.id === d.truck_id)
            const driverRoutes = routes.filter(r => r.driver_id === d.id && r.status !== 'completed')
            return (
              <div key={d.id} onClick={() => openEditDriver(d)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: '#fff', borderRadius: 10, border: '0.5px solid #e8ede9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: d.active ? '#1a2530' : '#e8ede9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: d.active ? '#fff' : '#aab8c0', flexShrink: 0 }}>
                  {d.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{d.name}</div>
                    {!d.active && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#f0f4f0', color: '#aab8c0', fontWeight: 600 }}>Inactive</span>}
                    {driverRoutes.length > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#E6F1FB', color: '#0C447C', fontWeight: 600 }}>{driverRoutes.length} active route{driverRoutes.length > 1 ? 's' : ''}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#8a9aaa' }}>
                    {d.license || 'No license'} · {millName(d.feed_mill_id)}
                    {d.phone ? ' · ' + d.phone : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {trk ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4A90C4" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                      </svg>
                      <span style={{ fontSize: 12, color: '#4A90C4', fontWeight: 600 }}>{trk.plate || trk.name}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: '#aab8c0' }}>No truck</span>
                  )}
                  <div style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600, marginTop: 6 }}>Edit →</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FLEET VIEW */}
      {view === 'fleet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trucks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🚛</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No trucks yet</div>
              <button onClick={openNewTruck} style={{ background: '#4A90C4' }} className="btn-primary">+ Add first truck</button>
            </div>
          ) : trucks.filter(t => !selectedMillId || t.feed_mill_id === selectedMillId).map(t => {
            const assignedDriver = drivers.find(d => d.truck_id === t.id)
            const truckRoutes    = routes.filter(r => r.truck_id === t.id && r.status !== 'completed')
            return (
              <div key={t.id} onClick={() => openEditTruck(t)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: '#fff', borderRadius: 10, border: '0.5px solid #e8ede9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: t.active ? '#E6F1FB' : '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.active ? '#4A90C4' : '#aab8c0'} strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{t.name}</div>
                    {t.plate && <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 6, background: '#f0f4f0', color: '#6a7a8a', fontWeight: 600 }}>{t.plate}</span>}
                    {!t.active && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#f0f4f0', color: '#aab8c0', fontWeight: 600 }}>Inactive</span>}
                    {truckRoutes.length > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#E6F1FB', color: '#0C447C', fontWeight: 600 }}>{truckRoutes.length} active route{truckRoutes.length > 1 ? 's' : ''}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#8a9aaa' }}>
                    {(t.capacity_kg/1000).toFixed(0)}t capacity · {millName(t.feed_mill_id)}
                    {assignedDriver ? ' · 👤 ' + assignedDriver.name : ' · No driver'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#4A90C4' }}>{(t.capacity_kg/1000).toFixed(0)}t</div>
                  <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase' }}>capacity</div>
                  <div style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600, marginTop: 6 }}>Edit →</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
