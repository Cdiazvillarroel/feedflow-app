'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Client   { id: string; name: string }
interface FeedMill { id: string; name: string }
interface Farm {
  id: string; name: string; location: string | null
  client_id: string | null; feed_mill_id: string | null
  created_at: string
}
interface SiloCount { farm_id: string; count: number }

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

export default function AdminFarmsPage() {
  const [farms,      setFarms]      = useState<Farm[]>([])
  const [clients,    setClients]    = useState<Client[]>([])
  const [mills,      setMills]      = useState<FeedMill[]>([])
  const [siloCounts, setSiloCounts] = useState<Record<string, number>>({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState('')
  const [search,     setSearch]     = useState('')
  const [filterClient, setFilterClient] = useState('all')
  const [drawer,     setDrawer]     = useState<Farm | 'new' | null>(null)

  const emptyForm = { name: '', location: '', client_id: '', feed_mill_id: '' }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [farmsR, clientsR, millsR, silosR] = await Promise.all([
      supabase.from('farms').select('*').order('name'),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('feed_mills').select('id, name').order('name'),
      supabase.from('silos').select('farm_id'),
    ])
    setFarms(farmsR.data || [])
    setClients(clientsR.data || [])
    setMills(millsR.data || [])
    const counts: Record<string, number> = {}
    ;(silosR.data || []).forEach(s => { counts[s.farm_id] = (counts[s.farm_id] || 0) + 1 })
    setSiloCounts(counts)
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function openNew() { setForm(emptyForm); setDrawer('new') }
  function openEdit(f: Farm) {
    setForm({ name: f.name, location: f.location || '', client_id: f.client_id || '', feed_mill_id: f.feed_mill_id || '' })
    setDrawer(f)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name:         form.name.trim(),
      location:     form.location || null,
      client_id:    form.client_id || null,
      feed_mill_id: form.feed_mill_id || null,
    }
    if (drawer && drawer !== 'new') {
      await supabase.from('farms').update(payload).eq('id', (drawer as Farm).id)
      showMsg('Farm updated')
    } else {
      await supabase.from('farms').insert(payload)
      showMsg('Farm created')
    }
    setSaving(false); setDrawer(null); loadAll()
  }

  async function remove(id: string) {
    if (!confirm('Delete this farm? All associated silos and data will be lost.')) return
    await supabase.from('farms').delete().eq('id', id)
    setDrawer(null); showMsg('Farm deleted'); loadAll()
  }

  const clientName = (id: string | null) => clients.find(c => c.id === id)?.name || '—'
  const millName   = (id: string | null) => mills.find(m => m.id === id)?.name   || '—'
  const isEditing  = drawer && drawer !== 'new'

  const filtered = farms
    .filter(f => filterClient === 'all' || f.client_id === filterClient)
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || (f.location || '').toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading farms...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {/* DRAWER */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌾</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditing ? 'Edit farm' : 'New farm'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>FeedFlow farm management</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9' }}>Farm details</div>

              <div><label style={lStyle()}>Farm name *</label><input style={iStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Sunrise Dairy Farm" /></div>
              <div><label style={lStyle()}>Location</label><input style={iStyle(true)} value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Bendigo VIC 3550" /></div>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Assignments</div>

              <div>
                <label style={lStyle()}>Assign to client</label>
                <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">No client assigned</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label style={lStyle()}>Feed mill</label>
                <select value={form.feed_mill_id} onChange={e => setForm(p => ({ ...p, feed_mill_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">No mill assigned</option>
                  {mills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              {isEditing && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Farm info</div>
                  <div style={{ background: '#f7f9f8', borderRadius: 10, padding: '14px 16px' }}>
                    {[
                      { k: 'Farm ID',   v: (drawer as Farm).id.slice(0, 8) + '...' },
                      { k: 'Silos',     v: siloCounts[(drawer as Farm).id] || 0 },
                      { k: 'Client',    v: clientName((drawer as Farm).client_id) },
                      { k: 'Mill',      v: millName((drawer as Farm).feed_mill_id) },
                      { k: 'Created',   v: new Date((drawer as Farm).created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) },
                    ].map(r => (
                      <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #e8ede9' }}>
                        <span style={{ fontSize: 12, color: '#8a9aaa' }}>{r.k}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2530' }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving || !form.name.trim()}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditing ? 'Update farm' : 'Create farm'}
              </button>
              {isEditing && (
                <button onClick={() => remove((drawer as Farm).id)}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>Farms</div>
          <div style={{ fontSize: 13, color: '#8a9aaa', marginTop: 4 }}>{farms.length} total farms · {Object.values(siloCounts).reduce((a, b) => a + b, 0)} silos</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>✓ {msg}</div>}
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ New farm</button>
        </div>
      </div>

      {/* SUMMARY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total farms',   val: farms.length },
          { label: 'Total silos',   val: Object.values(siloCounts).reduce((a, b) => a + b, 0) },
          { label: 'Clients',       val: new Set(farms.map(f => f.client_id).filter(Boolean)).size },
          { label: 'Feed mills',    val: new Set(farms.map(f => f.feed_mill_id).filter(Boolean)).size },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', border: '0.5px solid #e8ede9' }}>
            <div style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1a2530' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '0 12px', flex: 1, maxWidth: 280 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search farms..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1a2530', background: 'transparent', width: '100%', padding: '9px 0' }} />
        </div>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          style={{ border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#6a7a8a', background: '#fff', fontFamily: 'inherit' }}>
          <option value="all">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* TABLE */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌾</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No farms found</div>
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add first farm</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f9f8' }}>
                {['Farm', 'Location', 'Client', 'Feed mill', 'Silos', 'Created', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 600, padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #e8ede9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} onClick={() => openEdit(f)} style={{ cursor: 'pointer', borderBottom: '0.5px solid #f0f4f0' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f7f9f8'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}>
                  <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{f.name}</td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: '#8a9aaa' }}>{f.location || '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {f.client_id ? (
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: '#E6F1FB', color: '#0C447C' }}>{clientName(f.client_id)}</span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#aab8c0' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: '#8a9aaa' }}>{millName(f.feed_mill_id)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#4A90C4' }}>{siloCounts[f.id] || 0}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: '#8a9aaa' }}>{new Date(f.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td style={{ padding: '14px 16px' }}><span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
