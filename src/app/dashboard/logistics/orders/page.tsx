'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

interface FeedMill { id: string; name: string }
interface Farm     { id: string; name: string; location: string | null }
interface Silo     { id: string; farm_id: string; name: string; material: string | null; capacity_kg: number }
interface SiloStat { silo_id: string; level_pct: number; kg_remaining: number; alert_level: string }
interface Driver   { id: string; name: string; feed_mill_id: string }
interface Truck    { id: string; name: string; plate: string | null; capacity_kg: number; feed_mill_id: string }
interface DeliveryOrder {
  id: string; feed_mill_id: string; farm_id: string
  driver_id: string | null; truck_id: string | null
  status: string; scheduled_at: string | null
  delivered_at: string | null; notes: string | null; created_at: string
}
interface OrderItem {
  id: string; delivery_order_id: string; silo_id: string
  material: string | null; kg_requested: number; kg_delivered: number
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: '#FAEEDA', color: '#633806', label: 'Pending'    },
  planned:    { bg: '#E6F1FB', color: '#0C447C', label: 'Planned'    },
  in_transit: { bg: '#eaf5ee', color: '#27500A', label: 'In transit' },
  delivered:  { bg: '#f0f4f0', color: '#6a7a8a', label: 'Delivered'  },
  cancelled:  { bg: '#FCEBEB', color: '#A32D2D', label: 'Cancelled'  },
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

export default function OrdersPage() {
  const { selectedMillId } = useFarm()
  const [feedMills,  setFeedMills]  = useState<FeedMill[]>([])
  const [farms,      setFarms]      = useState<Farm[]>([])
  const [silos,      setSilos]      = useState<Silo[]>([])
  const [siloStats,  setSiloStats]  = useState<SiloStat[]>([])
  const [drivers,    setDrivers]    = useState<Driver[]>([])
  const [trucks,     setTrucks]     = useState<Truck[]>([])
  const [orders,     setOrders]     = useState<DeliveryOrder[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState('')
  const [drawer,     setDrawer]     = useState<DeliveryOrder | 'new' | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search,       setSearch]       = useState('')

  const emptyForm = { feed_mill_id: '', farm_id: '', driver_id: '', truck_id: '', status: 'pending', scheduled_at: '', notes: '' }
  const [form,      setForm]      = useState(emptyForm)
  const [itemForms, setItemForms] = useState<{ silo_id: string; kg_requested: string }[]>([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [fmR, farmsR, silosR, statsR, driversR, trucksR, ordersR, itemsR] = await Promise.all([
      supabase.from('feed_mills').select('id, name').order('name'),
      supabase.from('farms').select('id, name, location').order('name'),
      supabase.from('silos').select('*').order('name'),
      supabase.from('silo_latest_readings').select('*'),
      supabase.from('drivers').select('id, name, feed_mill_id').order('name'),
      supabase.from('trucks').select('id, name, plate, capacity_kg, feed_mill_id').order('name'),
      supabase.from('delivery_orders').select('*').order('created_at', { ascending: false }).then(r => selectedMillId ? { ...r, data: (r.data || []).filter((o: any) => o.feed_mill_id === selectedMillId) } : r),
      supabase.from('delivery_order_items').select('*'),
    ])
    setFeedMills(fmR.data || [])
    setFarms(farmsR.data || [])
    setSilos(silosR.data || [])
    setSiloStats(statsR.data || [])
    setDrivers(driversR.data || [])
    setTrucks(trucksR.data || [])
    setOrders(ordersR.data || [])
    setOrderItems(itemsR.data || [])
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const farmName   = (id: string) => farms.find(f => f.id === id)?.name || '—'
  const millName   = (id: string) => feedMills.find(m => m.id === id)?.name || '—'
  const driverName = (id: string | null) => id ? drivers.find(d => d.id === id)?.name || '—' : '—'
  const truckName  = (id: string | null) => id ? trucks.find(t => t.id === id)?.name || '—' : '—'
  const getStat    = (siloId: string) => siloStats.find(s => s.silo_id === siloId)
  const getDays    = (siloId: string) => {
    const stat = getStat(siloId)
    const silo = silos.find(s => s.id === siloId)
    if (!stat || !silo) return 999
    return Math.floor(stat.kg_remaining / (silo.capacity_kg * 0.02))
  }

  function openNew() {
    setForm(emptyForm)
    setItemForms([])
    setDrawer('new')
  }

  function openEdit(o: DeliveryOrder) {
    setForm({ feed_mill_id: o.feed_mill_id, farm_id: o.farm_id, driver_id: o.driver_id || '', truck_id: o.truck_id || '', status: o.status, scheduled_at: o.scheduled_at?.split('T')[0] || '', notes: o.notes || '' })
    const items = orderItems.filter(i => i.delivery_order_id === o.id)
    setItemForms(items.map(i => ({ silo_id: i.silo_id, kg_requested: i.kg_requested.toString() })))
    setDrawer(o)
  }

  async function save() {
    if (!form.feed_mill_id || !form.farm_id) return
    setSaving(true)
    const payload = {
      feed_mill_id: form.feed_mill_id,
      farm_id:      form.farm_id,
      driver_id:    form.driver_id || null,
      truck_id:     form.truck_id  || null,
      status:       form.status,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      notes:        form.notes || null,
    }
    let orderId = ''
    if (drawer && drawer !== 'new') {
      orderId = (drawer as DeliveryOrder).id
      await supabase.from('delivery_orders').update(payload).eq('id', orderId)
      await supabase.from('delivery_order_items').delete().eq('delivery_order_id', orderId)
      showMsg('Order updated')
    } else {
      const { data } = await supabase.from('delivery_orders').insert(payload).select().single()
      orderId = data?.id || ''
      showMsg('Order created')
    }
    const valid = itemForms.filter(i => i.silo_id && parseFloat(i.kg_requested) > 0)
    if (orderId && valid.length > 0) {
      await supabase.from('delivery_order_items').insert(valid.map(i => ({
        delivery_order_id: orderId,
        silo_id:           i.silo_id,
        material:          silos.find(s => s.id === i.silo_id)?.material || null,
        kg_requested:      parseFloat(i.kg_requested),
        kg_delivered:      0,
      })))
    }
    setSaving(false); setDrawer(null); loadAll()
  }

  async function remove(id: string) {
    if (!confirm('Delete this order?')) return
    await supabase.from('delivery_orders').delete().eq('id', id)
    setDrawer(null); showMsg('Order deleted'); loadAll()
  }

  const isEdit = drawer && drawer !== 'new'

  const filtered = orders.filter(o => {
  const matchMill   = !selectedMillId || o.feed_mill_id === selectedMillId
  const matchStatus = filterStatus === 'all' || o.status === filterStatus
  const matchSearch = !search || farmName(o.farm_id).toLowerCase().includes(search.toLowerCase()) || millName(o.feed_mill_id).toLowerCase().includes(search.toLowerCase())
  return matchMill && matchStatus && matchSearch
  })

  const counts = Object.keys(STATUS_COLORS).reduce((acc, k) => {
    acc[k] = orders.filter(o => o.status === k).length
    return acc
  }, {} as Record<string, number>)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading orders...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {/* DRAWER */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 500, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>

            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEdit ? 'Edit delivery order' : 'New delivery order'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>
                  {isEdit ? farmName((drawer as DeliveryOrder).farm_id) : 'Assign feed delivery to a farm'}
                </div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SecTitle title="Order details" />

              <div>
                <label style={lStyle()}>Feed mill *</label>
                <select value={form.feed_mill_id} onChange={e => setForm(p => ({ ...p, feed_mill_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">Select feed mill</option>
                  {feedMills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              <div>
                <label style={lStyle()}>Destination farm *</label>
                <select value={form.farm_id} onChange={e => { setForm(p => ({ ...p, farm_id: e.target.value })); setItemForms([]) }} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">Select farm</option>
                  {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Driver</label>
                  <select value={form.driver_id} onChange={e => setForm(p => ({ ...p, driver_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Unassigned</option>
                    {drivers.filter(d => !form.feed_mill_id || d.feed_mill_id === form.feed_mill_id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle()}>Truck</label>
                  <select value={form.truck_id} onChange={e => setForm(p => ({ ...p, truck_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Unassigned</option>
                    {trucks.filter(t => !form.feed_mill_id || t.feed_mill_id === form.feed_mill_id).map(t => <option key={t.id} value={t.id}>{t.name} ({(t.capacity_kg/1000).toFixed(0)}t)</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle()}>Scheduled date</label>
                  <input type="date" style={iStyle(true)} value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={lStyle()}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...iStyle(true), resize: 'vertical' }} placeholder="Delivery instructions..." />
              </div>

              <SecTitle title="Silos to fill" />

              {!form.farm_id ? (
                <div style={{ fontSize: 12, color: '#aab8c0', textAlign: 'center', padding: 16, background: '#f7f9f8', borderRadius: 8 }}>Select a farm first</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {silos.filter(s => s.farm_id === form.farm_id).map(silo => {
                    const stat      = getStat(silo.id)
                    const days      = getDays(silo.id)
                    const idx       = itemForms.findIndex(i => i.silo_id === silo.id)
                    const included  = idx >= 0
                    const suggested = stat ? Math.max(0, Math.round(silo.capacity_kg * 0.85 - stat.kg_remaining)) : 0
                    const color     = stat?.alert_level === 'critical' ? '#E24B4A' : stat?.alert_level === 'low' ? '#EF9F27' : '#4CAF7D'
                    return (
                      <div key={silo.id} style={{ border: '0.5px solid ' + (included ? '#4CAF7D' : '#e8ede9'), borderRadius: 8, padding: '12px 14px', background: included ? '#f4fbf7' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: included ? 10 : 0 }}>
                          <input type="checkbox" checked={included}
                            onChange={() => {
                              if (included) setItemForms(prev => prev.filter(i => i.silo_id !== silo.id))
                              else setItemForms(prev => [...prev, { silo_id: silo.id, kg_requested: suggested.toString() }])
                            }}
                            style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{silo.name}</div>
                            <div style={{ fontSize: 11, color: '#aab8c0' }}>
                              {silo.material} · {stat ? stat.level_pct.toFixed(0) + '% · ' + days + ' days' : 'No sensor data'}
                            </div>
                          </div>
                          {stat && stat.alert_level !== 'ok' && (
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: stat.alert_level === 'critical' ? '#FCEBEB' : '#FAEEDA', color: stat.alert_level === 'critical' ? '#A32D2D' : '#633806', fontWeight: 600 }}>
                              {stat.alert_level}
                            </span>
                          )}
                        </div>
                        {included && (
                          <>
                            {stat && (
                              <div style={{ paddingLeft: 24, marginBottom: 8 }}>
                                <div style={{ height: 4, background: '#e8ede9', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', background: color, width: stat.level_pct + '%', borderRadius: 2 }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                                  <span style={{ fontSize: 10, color: '#aab8c0' }}>{Math.round(stat.kg_remaining).toLocaleString()} kg remaining</span>
                                  <span style={{ fontSize: 10, color: '#aab8c0' }}>Capacity: {(silo.capacity_kg/1000).toFixed(0)}t</span>
                                </div>
                              </div>
                            )}
                            <div style={{ paddingLeft: 24 }}>
                              <label style={{ ...lStyle(), marginBottom: 4 }}>Kg to deliver</label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input type="number" value={itemForms[idx]?.kg_requested || ''} onChange={e => setItemForms(prev => prev.map((x, i) => i === idx ? { ...x, kg_requested: e.target.value } : x))} style={{ ...iStyle(true), flex: 1 }} placeholder="0" />
                                <button onClick={() => setItemForms(prev => prev.map((x, i) => i === idx ? { ...x, kg_requested: suggested.toString() } : x))}
                                  style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, border: '0.5px solid #c8d8cc', background: '#f7f9f8', cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                  Fill to 85% ({suggested.toLocaleString()} kg)
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                  {silos.filter(s => s.farm_id === form.farm_id).length === 0 && (
                    <div style={{ fontSize: 12, color: '#aab8c0', textAlign: 'center', padding: 12, background: '#f7f9f8', borderRadius: 8 }}>No silos found for this farm</div>
                  )}
                </div>
              )}

              {/* Order summary */}
              {itemForms.length > 0 && (
                <div style={{ background: '#eaf5ee', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#27500A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total to deliver</div>
                    <div style={{ fontSize: 11, color: '#6a9a80', marginTop: 2 }}>{itemForms.length} silo{itemForms.length > 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#27500A' }}>
                    {(itemForms.reduce((sum, i) => sum + (parseFloat(i.kg_requested) || 0), 0) / 1000).toFixed(1)} t
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving || !form.feed_mill_id || !form.farm_id}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEdit ? 'Update order' : 'Create order'}
              </button>
              {isEdit && (
                <button onClick={() => remove((drawer as DeliveryOrder).id)}
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
          <div className="page-title">Delivery Orders</div>
          <div className="page-sub">{orders.length} total · {counts.pending || 0} pending · {counts.in_transit || 0} in transit</div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>{'✓ ' + msg}</div>}
          <button className="btn-primary" onClick={openNew}>+ New order</button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        {Object.entries(STATUS_COLORS).map(([k, v]) => (
          <div key={k} className="sum-card" onClick={() => setFilterStatus(filterStatus === k ? 'all' : k)}
            style={{ cursor: 'pointer', borderBottom: filterStatus === k ? '2px solid ' + v.color : '2px solid transparent' }}>
            <div className="sum-label">{v.label}</div>
            <div className="sum-val" style={{ color: v.color }}>{counts[k] || 0}</div>
            <div className="sum-sub">orders</div>
          </div>
        ))}
      </div>

      {/* SEARCH */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '0 12px', marginBottom: 16, maxWidth: 340 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" placeholder="Search farm or mill..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1a2530', background: 'transparent', width: '100%', padding: '9px 0' }} />
      </div>

      {/* TABLE HEADER */}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 160px 120px 120px 100px 120px 80px', gap: 12, padding: '0 16px 10px' }}>
        {['Farm', 'Feed mill', 'Driver', 'Truck', 'Scheduled', 'Status', 'Total'].map(h => (
          <div key={h} style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{h}</div>
        ))}
      </div>

      {/* ORDERS LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No orders found</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Create your first delivery order.</div>
            <button onClick={openNew} className="btn-primary">+ New order</button>
          </div>
        ) : filtered.map(o => {
          const sc    = STATUS_COLORS[o.status] || STATUS_COLORS.pending
          const items = orderItems.filter(i => i.delivery_order_id === o.id)
          const totalKg = items.reduce((sum, i) => sum + i.kg_requested, 0)
          return (
            <div key={o.id} onClick={() => openEdit(o)}
              style={{ display: 'grid', gridTemplateColumns: '180px 160px 120px 120px 100px 120px 80px', gap: 12, alignItems: 'center', padding: '13px 16px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9', borderLeft: '3px solid ' + sc.color, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{farmName(o.farm_id)}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>{farms.find(f => f.id === o.farm_id)?.location || '—'}</div>
              </div>

              <div style={{ fontSize: 12, color: '#1a2530' }}>{millName(o.feed_mill_id)}</div>

              <div style={{ fontSize: 12, color: o.driver_id ? '#1a2530' : '#aab8c0' }}>
                {o.driver_id ? driverName(o.driver_id) : 'Unassigned'}
              </div>

              <div style={{ fontSize: 12, color: o.truck_id ? '#1a2530' : '#aab8c0' }}>
                {o.truck_id ? truckName(o.truck_id) : 'Unassigned'}
              </div>

              <div style={{ fontSize: 12, color: '#1a2530' }}>
                {o.scheduled_at ? new Date(o.scheduled_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
              </div>

              <div>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8, background: sc.bg, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a2530', textAlign: 'right' }}>
                {totalKg > 0 ? (totalKg/1000).toFixed(1) + 't' : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
