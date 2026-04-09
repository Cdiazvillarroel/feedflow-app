'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Plan   { id: string; name: string; price_monthly: number }
interface Client {
  id: string; name: string; email: string | null; phone: string | null
  address: string | null; country: string; abn: string | null
  plan_id: string | null; status: string; trial_ends_at: string | null
  notes: string | null; created_at: string
}

const STATUS_OPTIONS = ['active','trial','inactive','suspended']

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [plans,   setPlans]   = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('all')
  const [drawer,  setDrawer]  = useState<Client | 'new' | null>(null)

  const emptyForm = {
    name: '', email: '', phone: '', address: '', country: 'Australia',
    abn: '', plan_id: '', status: 'trial', trial_ends_at: '', notes: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [clientsR, plansR] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('plans').select('id, name, price_monthly').order('price_monthly'),
    ])
    setClients(clientsR.data || [])
    setPlans(plansR.data || [])
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function openNew() { setForm(emptyForm); setDrawer('new') }
  function openEdit(c: Client) {
    setForm({
      name: c.name, email: c.email || '', phone: c.phone || '',
      address: c.address || '', country: c.country || 'Australia',
      abn: c.abn || '', plan_id: c.plan_id || '', status: c.status,
      trial_ends_at: c.trial_ends_at ? c.trial_ends_at.split('T')[0] : '',
      notes: c.notes || '',
    })
    setDrawer(c)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name:          form.name.trim(),
      email:         form.email || null,
      phone:         form.phone || null,
      address:       form.address || null,
      country:       form.country || 'Australia',
      abn:           form.abn || null,
      plan_id:       form.plan_id || null,
      status:        form.status,
      trial_ends_at: form.trial_ends_at || null,
      notes:         form.notes || null,
      updated_at:    new Date().toISOString(),
    }
    if (drawer && drawer !== 'new') {
      await supabase.from('clients').update(payload).eq('id', (drawer as Client).id)
      showMsg('Client updated')
    } else {
      await supabase.from('clients').insert(payload)
      showMsg('Client created')
    }
    setSaving(false); setDrawer(null); loadAll()
  }

  async function remove(id: string) {
    if (!confirm('Delete this client? This cannot be undone.')) return
    await supabase.from('clients').delete().eq('id', id)
    setDrawer(null); showMsg('Client deleted'); loadAll()
  }

  const planName   = (id: string | null) => plans.find(p => p.id === id)?.name || '—'
  const isEditing  = drawer && drawer !== 'new'
  const filtered   = clients
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))

  const statusBadge = (s: string) =>
    s === 'active'    ? { bg: '#eaf5ee', color: '#27500A' } :
    s === 'trial'     ? { bg: '#E6F1FB', color: '#0C447C' } :
    s === 'suspended' ? { bg: '#FCEBEB', color: '#A32D2D' } :
                        { bg: '#f0f4f0', color: '#6a7a8a'  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading clients...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {/* DRAWER */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 520, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏢</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditing ? 'Edit client' : 'New client'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Agrometrics CRM</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Company info */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9' }}>Company info</div>
              <div><label style={lStyle()}>Company name *</label><input style={iStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Green Valley Farms Pty Ltd" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lStyle()}>Email</label><input type="email" style={iStyle(true)} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="contact@farm.com.au" /></div>
                <div><label style={lStyle()}>Phone</label><input style={iStyle(true)} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+61 3 0000 0000" /></div>
              </div>
              <div><label style={lStyle()}>Address</label><input style={iStyle(true)} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Farm Rd, Bendigo VIC 3550" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lStyle()}>Country</label><input style={iStyle(true)} value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="Australia" /></div>
                <div><label style={lStyle()}>ABN</label><input style={iStyle(true)} value={form.abn} onChange={e => setForm(p => ({ ...p, abn: e.target.value }))} placeholder="12 345 678 901" /></div>
              </div>

              {/* Plan & status */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Plan & status</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Plan</label>
                  <select value={form.plan_id} onChange={e => setForm(p => ({ ...p, plan_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">No plan assigned</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price_monthly}/mo</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle()}>Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              {form.status === 'trial' && (
                <div><label style={lStyle()}>Trial ends</label><input type="date" style={iStyle(true)} value={form.trial_ends_at} onChange={e => setForm(p => ({ ...p, trial_ends_at: e.target.value }))} /></div>
              )}

              {/* Notes */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Notes</div>
              <div>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={4}
                  placeholder="Internal notes about this client..."
                  style={{ ...iStyle(true), resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              {/* Client stats if editing */}
              {isEditing && (
                <div style={{ background: '#f7f9f8', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Client details</div>
                  {[
                    { k: 'Client ID',   v: (drawer as Client).id.slice(0, 8) + '...' },
                    { k: 'Created',     v: new Date((drawer as Client).created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) },
                    { k: 'Plan',        v: planName((drawer as Client).plan_id) },
                  ].map(r => (
                    <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #e8ede9' }}>
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
                {saving ? 'Saving...' : isEditing ? 'Update client' : 'Create client'}
              </button>
              {isEditing && (
                <button onClick={() => remove((drawer as Client).id)}
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
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>Clients</div>
          <div style={{ fontSize: 13, color: '#8a9aaa', marginTop: 4 }}>{clients.length} total · {clients.filter(c => c.status === 'active').length} active · {clients.filter(c => c.status === 'trial').length} trial</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>✓ {msg}</div>}
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ New client</button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total clients',  val: clients.length,                                  color: '#1a2530' },
          { label: 'Active',         val: clients.filter(c => c.status === 'active').length,  color: '#27500A' },
          { label: 'Trial',          val: clients.filter(c => c.status === 'trial').length,   color: '#0C447C' },
          { label: 'Suspended',      val: clients.filter(c => c.status === 'suspended').length, color: '#A32D2D' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', border: '0.5px solid #e8ede9' }}>
            <div style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* FILTER + SEARCH */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '0 12px', flex: 1, maxWidth: 300 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1a2530', background: 'transparent', width: '100%', padding: '9px 0' }} />
        </div>
        {['all', ...STATUS_OPTIONS].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* CLIENT LIST */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No clients yet</div>
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add first client</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f9f8' }}>
                {['Client', 'Contact', 'Plan', 'Status', 'ABN', 'Created', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 600, padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #e8ede9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const badge = statusBadge(c.status)
                return (
                  <tr key={c.id} onClick={() => openEdit(c)} style={{ cursor: 'pointer', borderBottom: '0.5px solid #f0f4f0' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f7f9f8'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{c.name}</div>
                      {c.notes && <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{c.notes}</div>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 12, color: '#1a2530' }}>{c.email || '—'}</div>
                      <div style={{ fontSize: 11, color: '#aab8c0' }}>{c.phone || ''}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2530' }}>{planName(c.plan_id)}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10, background: badge.bg, color: badge.color }}>
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#8a9aaa', fontFamily: 'monospace' }}>{c.abn || '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#8a9aaa' }}>{new Date(c.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
