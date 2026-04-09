'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface FeedMill {
  id: string; name: string; location: string | null
  contact_name: string | null; contact_email: string | null
  contact_phone: string | null; notes: string | null
  created_at: string
}

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

export default function AdminMillsPage() {
  const [mills,   setMills]   = useState<FeedMill[]>([])
  const [farmCounts, setFarmCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [search,  setSearch]  = useState('')
  const [drawer,  setDrawer]  = useState<FeedMill | 'new' | null>(null)

  const emptyForm = { name: '', location: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [millsR, farmsR] = await Promise.all([
      supabase.from('feed_mills').select('*').order('name'),
      supabase.from('farms').select('feed_mill_id'),
    ])
    setMills(millsR.data || [])
    const counts: Record<string, number> = {}
    ;(farmsR.data || []).forEach(f => {
      if (f.feed_mill_id) counts[f.feed_mill_id] = (counts[f.feed_mill_id] || 0) + 1
    })
    setFarmCounts(counts)
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function openNew() { setForm(emptyForm); setDrawer('new') }
  function openEdit(m: FeedMill) {
    setForm({ name: m.name, location: m.location || '', contact_name: m.contact_name || '', contact_email: m.contact_email || '', contact_phone: m.contact_phone || '', notes: m.notes || '' })
    setDrawer(m)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name:          form.name.trim(),
      location:      form.location || null,
      contact_name:  form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      notes:         form.notes || null,
    }
    if (drawer && drawer !== 'new') {
      await supabase.from('feed_mills').update(payload).eq('id', (drawer as FeedMill).id)
      showMsg('Mill updated')
    } else {
      await supabase.from('feed_mills').insert(payload)
      showMsg('Mill created')
    }
    setSaving(false); setDrawer(null); loadAll()
  }

  async function remove(id: string) {
    if (!confirm('Delete this feed mill? Farms assigned to it will lose their mill.')) return
    await supabase.from('feed_mills').delete().eq('id', id)
    setDrawer(null); showMsg('Mill deleted'); loadAll()
  }

  const isEditing = drawer && drawer !== 'new'
  const filtered  = mills.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.location || '').toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading mills...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏭</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditing ? 'Edit feed mill' : 'New feed mill'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Feed mill management</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9' }}>Mill details</div>
              <div><label style={lStyle()}>Mill name *</label><input style={iStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Performance Grains Victoria" /></div>
              <div><label style={lStyle()}>Location</label><input style={iStyle(true)} value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Bendigo VIC 3550" /></div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Contact</div>
              <div><label style={lStyle()}>Contact name</label><input style={iStyle(true)} value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} placeholder="John Smith" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lStyle()}>Email</label><input type="email" style={iStyle(true)} value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} placeholder="john@mill.com.au" /></div>
                <div><label style={lStyle()}>Phone</label><input style={iStyle(true)} value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} placeholder="+61 3 0000 0000" /></div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Notes</div>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                placeholder="Internal notes about this mill..."
                style={{ ...iStyle(true), resize: 'vertical', lineHeight: 1.5 }} />
              {isEditing && (
                <div style={{ background: '#f7f9f8', borderRadius: 10, padding: '14px 16px', marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Mill stats</div>
                  {[
                    { k: 'Farms assigned', v: farmCounts[(drawer as FeedMill).id] || 0 },
                    { k: 'Created', v: new Date((drawer as FeedMill).created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) },
                  ].map(r => (
                    <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #e8ede9' }}>
                      <span style={{ fontSize: 12, color: '#8a9aaa' }}>{r.k}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2530' }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving || !form.name.trim()}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditing ? 'Update mill' : 'Create mill'}
              </button>
              {isEditing && (
                <button onClick={() => remove((drawer as FeedMill).id)}
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>Feed Mills</div>
          <div style={{ fontSize: 13, color: '#8a9aaa', marginTop: 4 }}>{mills.length} mills · {Object.values(farmCounts).reduce((a, b) => a + b, 0)} farms assigned</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>✓ {msg}</div>}
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ New mill</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '0 12px', flex: 1, maxWidth: 280 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search mills..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1a2530', background: 'transparent', width: '100%', padding: '9px 0' }} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏭</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No feed mills yet</div>
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add first mill</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map(m => (
            <div key={m.id} onClick={() => openEdit(m)}
              style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', padding: '18px 20px', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏭</div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: '#eaf5ee', color: '#27500A' }}>
                  {farmCounts[m.id] || 0} farms
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2530', marginBottom: 4 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: '#8a9aaa', marginBottom: 10 }}>{m.location || '—'}</div>
              {m.contact_name && (
                <div style={{ fontSize: 12, color: '#6a7a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>👤</span>{m.contact_name}
                  {m.contact_phone && <span style={{ color: '#aab8c0' }}>· {m.contact_phone}</span>}
                </div>
              )}
              {m.contact_email && (
                <div style={{ fontSize: 12, color: '#4A90C4', marginTop: 4 }}>{m.contact_email}</div>
              )}
              <div style={{ marginTop: 12, fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
