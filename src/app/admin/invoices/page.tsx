'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Client  { id: string; name: string }
interface Invoice {
  id: string; client_id: string; amount: number; currency: string
  status: string; due_date: string | null; paid_at: string | null
  description: string | null; line_items: LineItem[]
  stripe_invoice_id: string | null; pdf_url: string | null; created_at: string
}
interface LineItem { description: string; quantity: number; unit_price: number }

const STATUS_OPTIONS = ['draft', 'sent', 'paid', 'overdue', 'cancelled']

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

const statusBadge = (s: string) =>
  s === 'paid'      ? { bg: '#eaf5ee', color: '#27500A' } :
  s === 'sent'      ? { bg: '#E6F1FB', color: '#0C447C' } :
  s === 'overdue'   ? { bg: '#FCEBEB', color: '#A32D2D' } :
  s === 'cancelled' ? { bg: '#f0f4f0', color: '#aab8c0' } :
                      { bg: '#FAEEDA', color: '#633806'  }

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients,  setClients]  = useState<Client[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')
  const [filter,   setFilter]   = useState('all')
  const [search,   setSearch]   = useState('')
  const [drawer,   setDrawer]   = useState<Invoice | 'new' | null>(null)

  const emptyForm = {
    client_id: '', description: '', due_date: '', status: 'draft',
    stripe_invoice_id: '', pdf_url: '',
    line_items: [{ description: '', quantity: 1, unit_price: 0 }] as LineItem[],
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [invR, cliR] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
    ])
    setInvoices(invR.data || [])
    setClients(cliR.data || [])
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function openNew() { setForm(emptyForm); setDrawer('new') }
  function openEdit(inv: Invoice) {
    setForm({
      client_id: inv.client_id, description: inv.description || '',
      due_date: inv.due_date || '', status: inv.status,
      stripe_invoice_id: inv.stripe_invoice_id || '', pdf_url: inv.pdf_url || '',
      line_items: inv.line_items?.length > 0 ? inv.line_items : [{ description: '', quantity: 1, unit_price: 0 }],
    })
    setDrawer(inv)
  }

  function calcTotal(items: LineItem[]) {
    return items.reduce((s, i) => s + (i.quantity * i.unit_price), 0)
  }

  function updateLineItem(idx: number, field: keyof LineItem, value: string | number) {
    setForm(p => {
      const items = [...p.line_items]
      items[idx] = { ...items[idx], [field]: field === 'description' ? value : Number(value) }
      return { ...p, line_items: items }
    })
  }

  function addLineItem() {
    setForm(p => ({ ...p, line_items: [...p.line_items, { description: '', quantity: 1, unit_price: 0 }] }))
  }

  function removeLineItem(idx: number) {
    setForm(p => ({ ...p, line_items: p.line_items.filter((_, i) => i !== idx) }))
  }

  async function save() {
    if (!form.client_id) return
    setSaving(true)
    const payload = {
      client_id:         form.client_id,
      amount:            calcTotal(form.line_items),
      currency:          'AUD',
      status:            form.status,
      due_date:          form.due_date || null,
      description:       form.description || null,
      line_items:        form.line_items,
      stripe_invoice_id: form.stripe_invoice_id || null,
      pdf_url:           form.pdf_url || null,
      paid_at:           form.status === 'paid' ? new Date().toISOString() : null,
    }
    if (drawer && drawer !== 'new') {
      await supabase.from('invoices').update(payload).eq('id', (drawer as Invoice).id)
      showMsg('Invoice updated')
    } else {
      await supabase.from('invoices').insert(payload)
      showMsg('Invoice created')
    }
    setSaving(false); setDrawer(null); loadAll()
  }

  async function remove(id: string) {
    if (!confirm('Delete this invoice?')) return
    await supabase.from('invoices').delete().eq('id', id)
    setDrawer(null); showMsg('Invoice deleted'); loadAll()
  }

  async function markPaid(id: string) {
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    showMsg('Marked as paid'); loadAll()
  }

  const clientName = (id: string) => clients.find(c => c.id === id)?.name || '—'
  const isEditing  = drawer && drawer !== 'new'

  const filtered = invoices
    .filter(i => filter === 'all' || i.status === filter)
    .filter(i => !search || clientName(i.client_id).toLowerCase().includes(search.toLowerCase()) || (i.description || '').toLowerCase().includes(search.toLowerCase()))

  const totalRevenue  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const totalPending  = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.amount, 0)
  const totalOverdue  = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading invoices...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💳</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditing ? 'Edit invoice' : 'New invoice'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Agrometrics billing</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9' }}>Invoice details</div>

              <div>
                <label style={lStyle()}>Client *</label>
                <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div><label style={lStyle()}>Description</label><input style={iStyle(true)} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Monthly FeedFlow subscription — May 2026" /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div><label style={lStyle()}>Due date</label><input type="date" style={iStyle(true)} value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Line items</div>

              {form.line_items.map((item, idx) => (
                <div key={idx} style={{ background: '#f7f9f8', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Item {idx + 1}</span>
                    {form.line_items.length > 1 && (
                      <button onClick={() => removeLineItem(idx)} style={{ fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                    )}
                  </div>
                  <input style={iStyle(true)} value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} placeholder="FeedFlow Growth Plan — Monthly" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={lStyle()}>Qty</label>
                      <input type="number" style={iStyle(true)} value={item.quantity} onChange={e => updateLineItem(idx, 'quantity', e.target.value)} min="1" step="1" />
                    </div>
                    <div>
                      <label style={lStyle()}>Unit price (AUD)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 12, color: '#8a9aaa' }}>$</span>
                        <input type="number" style={iStyle(true)} value={item.unit_price} onChange={e => updateLineItem(idx, 'unit_price', e.target.value)} min="0" step="0.01" />
                      </div>
                    </div>
                    <div>
                      <label style={lStyle()}>Subtotal</label>
                      <div style={{ padding: '8px 10px', background: '#eaf5ee', borderRadius: 7, fontSize: 13, fontWeight: 700, color: '#27500A' }}>
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addLineItem} style={{ padding: '8px', border: '0.5px dashed #c8d8cc', borderRadius: 8, fontSize: 12, color: '#8a9aaa', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                + Add line item
              </button>

              <div style={{ background: '#1a2530', borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#4CAF7D', letterSpacing: -0.5 }}>${calcTotal(form.line_items).toFixed(2)} AUD</span>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Stripe (optional)</div>
              <div><label style={lStyle()}>Stripe Invoice ID</label><input style={iStyle(true)} value={form.stripe_invoice_id} onChange={e => setForm(p => ({ ...p, stripe_invoice_id: e.target.value }))} placeholder="in_1234567890" /></div>
              <div><label style={lStyle()}>PDF URL</label><input style={iStyle(true)} value={form.pdf_url} onChange={e => setForm(p => ({ ...p, pdf_url: e.target.value }))} placeholder="https://..." /></div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving || !form.client_id}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditing ? 'Update invoice' : 'Create invoice'}
              </button>
              {isEditing && (drawer as Invoice).status !== 'paid' && (
                <button onClick={() => markPaid((drawer as Invoice).id)}
                  style={{ padding: '10px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#27500A', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Mark paid
                </button>
              )}
              {isEditing && (
                <button onClick={() => remove((drawer as Invoice).id)}
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
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>Invoices</div>
          <div style={{ fontSize: 13, color: '#8a9aaa', marginTop: 4 }}>{invoices.length} total · ${totalRevenue.toLocaleString()} AUD collected</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>✓ {msg}</div>}
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ New invoice</button>
        </div>
      </div>

      {/* SUMMARY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total collected', val: `$${Math.round(totalRevenue).toLocaleString()}`, color: '#27500A', bg: '#eaf5ee' },
          { label: 'Pending',         val: `$${Math.round(totalPending).toLocaleString()}`,  color: '#0C447C', bg: '#E6F1FB' },
          { label: 'Overdue',         val: `$${Math.round(totalOverdue).toLocaleString()}`,  color: '#A32D2D', bg: '#FCEBEB' },
          { label: 'Total invoices',  val: invoices.length,                                  color: '#1a2530', bg: '#f7f9f8' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '16px 18px', border: '0.5px solid #e8ede9' }}>
            <div style={{ fontSize: 11, color: s.color, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6, fontWeight: 600, opacity: 0.7 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '0 12px', flex: 1, maxWidth: 280 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1a2530', background: 'transparent', width: '100%', padding: '9px 0' }} />
        </div>
        {['all', ...STATUS_OPTIONS].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* TABLE */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💳</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No invoices yet</div>
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ Create first invoice</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f9f8' }}>
                {['Client', 'Description', 'Amount', 'Status', 'Due date', 'Created', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 600, padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #e8ede9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const badge = statusBadge(inv.status)
                return (
                  <tr key={inv.id} onClick={() => openEdit(inv)} style={{ cursor: 'pointer', borderBottom: '0.5px solid #f0f4f0' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f7f9f8'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{clientName(inv.client_id)}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#8a9aaa', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.description || '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 700, color: '#1a2530' }}>${inv.amount.toFixed(2)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10, background: badge.bg, color: badge.color }}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#8a9aaa' }}>
                      {inv.due_date ? new Date(inv.due_date + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#8a9aaa' }}>{new Date(inv.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {inv.pdf_url && (
                          <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#E6F1FB', color: '#0C447C', fontWeight: 600, textDecoration: 'none' }}>PDF</a>
                        )}
                        {inv.status !== 'paid' && (
                          <button onClick={e => { e.stopPropagation(); markPaid(inv.id) }}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#eaf5ee', color: '#27500A', border: 'none', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Mark paid
                          </button>
                        )}
                        <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span>
                      </div>
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
