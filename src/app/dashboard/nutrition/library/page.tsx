'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

interface Commodity {
  id: string; feed_mill_id: string; name: string; category: string
  price_per_tonne: number | null; dry_matter_pct: number | null
  protein_pct: number | null; energy_mj: number | null
  fat_pct: number | null; fiber_pct: number | null
  moisture_pct: number | null; ash_pct: number | null
  stock_kg: number; min_stock_kg: number
  supplier: string | null; notes: string | null; active: boolean
  created_at: string
}

interface FeedMill { id: string; name: string }

const CATEGORIES = [
  { value: 'grain',    label: 'Grain',     color: '#EF9F27', bg: '#FAEEDA' },
  { value: 'protein',  label: 'Protein',   color: '#4CAF7D', bg: '#eaf5ee' },
  { value: 'fat',      label: 'Fat',       color: '#E24B4A', bg: '#FCEBEB' },
  { value: 'fiber',    label: 'Fiber',     color: '#9B59B6', bg: '#f3eefb' },
  { value: 'mineral',  label: 'Mineral',   color: '#4A90C4', bg: '#E6F1FB' },
  { value: 'vitamin',  label: 'Vitamin',   color: '#1ABC9C', bg: '#e8faf6' },
  { value: 'additive', label: 'Additive',  color: '#633806', bg: '#FAEEDA' },
  { value: 'other',    label: 'Other',     color: '#8a9aaa', bg: '#f0f4f0' },
]

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

export default function CommodityLibraryPage() {
  const { selectedMillId } = useFarm()

  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [mills,       setMills]       = useState<FeedMill[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [msg,         setMsg]         = useState('')
  const [search,      setSearch]      = useState('')
  const [filterCat,   setFilterCat]   = useState('all')
  const [drawer,      setDrawer]      = useState<Commodity | 'new' | null>(null)
  const [selected,    setSelected]    = useState<Commodity | null>(null)

  const emptyForm = {
    feed_mill_id: selectedMillId || '', name: '', category: 'grain',
    price_per_tonne: '', dry_matter_pct: '', protein_pct: '', energy_mj: '',
    fat_pct: '', fiber_pct: '', moisture_pct: '', ash_pct: '',
    stock_kg: '0', min_stock_kg: '0', supplier: '', notes: '', active: true,
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadAll() }, [selectedMillId])

  async function loadAll() {
    setLoading(true)
    const [commR, millsR] = await Promise.all([
      selectedMillId
        ? supabase.from('commodities').select('*').eq('feed_mill_id', selectedMillId).order('name')
        : supabase.from('commodities').select('*').order('name'),
      supabase.from('feed_mills').select('id, name').order('name'),
    ])
    const c = commR.data || []
    setCommodities(c)
    setMills(millsR.data || [])
    if (c.length > 0 && !selected) setSelected(c[0])
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function openNew() {
    setForm({ ...emptyForm, feed_mill_id: selectedMillId || '' })
    setDrawer('new')
  }
  function openEdit(c: Commodity) {
    setForm({
      feed_mill_id:    c.feed_mill_id,
      name:            c.name,
      category:        c.category,
      price_per_tonne: c.price_per_tonne?.toString() || '',
      dry_matter_pct:  c.dry_matter_pct?.toString()  || '',
      protein_pct:     c.protein_pct?.toString()     || '',
      energy_mj:       c.energy_mj?.toString()       || '',
      fat_pct:         c.fat_pct?.toString()         || '',
      fiber_pct:       c.fiber_pct?.toString()       || '',
      moisture_pct:    c.moisture_pct?.toString()    || '',
      ash_pct:         c.ash_pct?.toString()         || '',
      stock_kg:        c.stock_kg?.toString()        || '0',
      min_stock_kg:    c.min_stock_kg?.toString()    || '0',
      supplier:        c.supplier || '',
      notes:           c.notes   || '',
      active:          c.active,
    })
    setDrawer(c)
  }

  async function save() {
    if (!form.name.trim() || !form.feed_mill_id) return
    setSaving(true)
    const payload = {
      feed_mill_id:    form.feed_mill_id,
      name:            form.name.trim(),
      category:        form.category,
      price_per_tonne: parseFloat(form.price_per_tonne) || null,
      dry_matter_pct:  parseFloat(form.dry_matter_pct)  || null,
      protein_pct:     parseFloat(form.protein_pct)     || null,
      energy_mj:       parseFloat(form.energy_mj)       || null,
      fat_pct:         parseFloat(form.fat_pct)         || null,
      fiber_pct:       parseFloat(form.fiber_pct)       || null,
      moisture_pct:    parseFloat(form.moisture_pct)    || null,
      ash_pct:         parseFloat(form.ash_pct)         || null,
      stock_kg:        parseFloat(form.stock_kg)        || 0,
      min_stock_kg:    parseFloat(form.min_stock_kg)    || 0,
      supplier:        form.supplier || null,
      notes:           form.notes   || null,
      active:          form.active,
      updated_at:      new Date().toISOString(),
    }
    if (drawer && drawer !== 'new') {
      await supabase.from('commodities').update(payload).eq('id', (drawer as Commodity).id)
      showMsg('Commodity updated')
    } else {
      await supabase.from('commodities').insert(payload)
      showMsg('Commodity created')
    }
    setSaving(false); setDrawer(null); loadAll()
  }

  async function remove(id: string) {
    if (!confirm('Delete this commodity? It will be removed from all formulas.')) return
    await supabase.from('commodities').delete().eq('id', id)
    setDrawer(null); showMsg('Commodity deleted'); setSelected(null); loadAll()
  }

  const catInfo    = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[7]
  const millName   = (id: string) => mills.find(m => m.id === id)?.name || '—'
  const isEditing  = drawer && drawer !== 'new'
  const isLowStock = (c: Commodity) => c.stock_kg <= c.min_stock_kg

  const filtered = commodities
    .filter(c => filterCat === 'all' || c.category === filterCat)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.supplier || '').toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading commodity library...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
              <div style={{ width: 38, height: 38, borderRadius: 10, background: catInfo(form.category).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌾</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditing ? 'Edit commodity' : 'New commodity'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Nutrition Manager · Commodity Library</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Basic */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9' }}>Basic info</div>
              <div>
                <label style={lStyle()}>Feed mill *</label>
                <select value={form.feed_mill_id} onChange={e => setForm(p => ({ ...p, feed_mill_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">Select mill</option>
                  {mills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lStyle()}>Name *</label><input style={iStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Wheat" /></div>
                <div>
                  <label style={lStyle()}>Category *</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Price ($/tonne)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#8a9aaa' }}>$</span>
                    <input type="number" style={iStyle(true)} value={form.price_per_tonne} onChange={e => setForm(p => ({ ...p, price_per_tonne: e.target.value }))} placeholder="340" step="5" />
                  </div>
                </div>
                <div><label style={lStyle()}>Supplier</label><input style={iStyle(true)} value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} placeholder="GrainCorp Victoria" /></div>
              </div>

              {/* Nutritional */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Nutritional composition</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { k: 'dry_matter_pct', label: 'Dry matter (%)',  placeholder: '88' },
                  { k: 'protein_pct',    label: 'Crude protein (%)', placeholder: '11.5' },
                  { k: 'energy_mj',      label: 'Energy (MJ/kg)',   placeholder: '13.5' },
                  { k: 'fat_pct',        label: 'Crude fat (%)',    placeholder: '1.8' },
                  { k: 'fiber_pct',      label: 'Crude fibre (%)',  placeholder: '2.5' },
                  { k: 'moisture_pct',   label: 'Moisture (%)',     placeholder: '12' },
                  { k: 'ash_pct',        label: 'Ash (%)',          placeholder: '1.8' },
                ].map(f => (
                  <div key={f.k}>
                    <label style={lStyle()}>{f.label}</label>
                    <input type="number" style={iStyle(true)} value={(form as any)[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.placeholder} step="0.1" />
                  </div>
                ))}
              </div>

              {/* Nutritional preview bars */}
              {(form.protein_pct || form.fat_pct || form.fiber_pct || form.moisture_pct) && (
                <div style={{ background: '#f7f9f8', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Profile preview</div>
                  {[
                    { label: 'Protein',  val: form.protein_pct,  color: '#4CAF7D' },
                    { label: 'Energy',   val: form.energy_mj,    color: '#4A90C4', noBar: true },
                    { label: 'Fat',      val: form.fat_pct,      color: '#EF9F27' },
                    { label: 'Fibre',    val: form.fiber_pct,    color: '#E24B4A' },
                    { label: 'Moisture', val: form.moisture_pct, color: '#aab8c0' },
                  ].filter(r => r.val).map(r => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#8a9aaa', width: 56, flexShrink: 0 }}>{r.label}</span>
                      {!r.noBar && (
                        <div style={{ flex: 1, height: 5, background: '#e8ede9', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: r.color, borderRadius: 3, width: `${Math.min(parseFloat(r.val!) || 0, 100)}%` }} />
                        </div>
                      )}
                      {r.noBar && <div style={{ flex: 1 }} />}
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#1a2530', flexShrink: 0 }}>{r.val}{r.noBar ? ' MJ' : '%'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Stock */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Stock</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Current stock (kg)</label>
                  <input type="number" style={iStyle(true)} value={form.stock_kg} onChange={e => setForm(p => ({ ...p, stock_kg: e.target.value }))} placeholder="0" step="100" />
                </div>
                <div>
                  <label style={lStyle()}>Min stock (kg)</label>
                  <input type="number" style={iStyle(true)} value={form.min_stock_kg} onChange={e => setForm(p => ({ ...p, min_stock_kg: e.target.value }))} placeholder="0" step="100" />
                </div>
              </div>

              {/* Notes */}
              <div><label style={lStyle()}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                  placeholder="Storage conditions, quality specs, sourcing notes..."
                  style={{ ...iStyle(true), resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px', borderRadius: 8, border: '0.5px solid ' + (form.active ? '#4CAF7D' : '#e8ede9'), background: form.active ? '#f4fbf7' : '#fff' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} style={{ accentColor: '#4CAF7D', width: 16, height: 16 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>Active commodity</div>
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Available for use in formulas</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: form.active ? '#eaf5ee' : '#f0f4f0', color: form.active ? '#27500A' : '#aab8c0' }}>
                  {form.active ? 'ON' : 'OFF'}
                </div>
              </label>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving || !form.name.trim() || !form.feed_mill_id}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditing ? 'Update commodity' : 'Create commodity'}
              </button>
              {isEditing && (
                <button onClick={() => remove((drawer as Commodity).id)}
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
          <div className="page-title">Commodity Library</div>
          <div className="page-sub">
            {selectedMillId ? mills.find(m => m.id === selectedMillId)?.name : 'All mills'} · {commodities.length} commodities · {commodities.filter(c => isLowStock(c)).length} low stock
          </div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>✓ {msg}</div>}
          <button className="btn-primary" onClick={openNew}>+ New commodity</button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        {CATEGORIES.slice(0, 4).map(cat => {
          const count = commodities.filter(c => c.category === cat.value).length
          return (
            <div key={cat.value} className="sum-card" onClick={() => setFilterCat(filterCat === cat.value ? 'all' : cat.value)} style={{ cursor: 'pointer', borderTop: filterCat === cat.value ? `2px solid ${cat.color}` : '2px solid transparent' }}>
              <div className="sum-label">{cat.label}</div>
              <div className="sum-val" style={{ color: cat.color }}>{count}</div>
              <div className="sum-sub">commodities</div>
            </div>
          )
        })}
      </div>

      {/* FILTER BAR */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '0 12px', flex: 1, maxWidth: 280 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search commodities..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1a2530', background: 'transparent', width: '100%', padding: '9px 0' }} />
        </div>
        <button onClick={() => setFilterCat('all')}
          style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', borderColor: filterCat === 'all' ? '#1a2530' : '#e8ede9', background: filterCat === 'all' ? '#1a2530' : '#fff', color: filterCat === 'all' ? '#fff' : '#6a7a8a' }}>
          All
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat.value} onClick={() => setFilterCat(filterCat === cat.value ? 'all' : cat.value)}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', borderColor: filterCat === cat.value ? cat.color : '#e8ede9', background: filterCat === cat.value ? cat.bg : '#fff', color: filterCat === cat.value ? cat.color : '#6a7a8a' }}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      {commodities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌾</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No commodities yet</div>
          <button className="btn-primary" onClick={openNew}>+ Add first commodity</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: filtered.length > 0 && selected ? '1fr 320px' : '1fr', gap: 16 }}>

          {/* LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(c => {
              const cat     = catInfo(c.category)
              const isOn    = selected?.id === c.id
              const lowStock = isLowStock(c)
              return (
                <div key={c.id} onClick={() => setSelected(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: isOn ? '#f4fbf7' : '#fff', borderRadius: 10, border: `${isOn ? '1.5px' : '0.5px'} solid ${isOn ? '#4CAF7D' : '#e8ede9'}`, cursor: 'pointer' }}
                  onMouseEnter={e => { if (!isOn) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c.category.slice(0, 3)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{c.name}</div>
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 6, background: cat.bg, color: cat.color, fontWeight: 700 }}>{cat.label}</span>
                      {!c.active   && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#f0f4f0', color: '#aab8c0', fontWeight: 600 }}>Inactive</span>}
                      {lowStock    && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#FCEBEB', color: '#A32D2D', fontWeight: 600 }}>Low stock</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#8a9aaa' }}>
                      {c.supplier || '—'}
                      {c.protein_pct ? ` · Protein ${c.protein_pct}%` : ''}
                      {c.energy_mj  ? ` · ${c.energy_mj} MJ` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {c.price_per_tonne && (
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2530' }}>${c.price_per_tonne}</div>
                    )}
                    <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase', marginTop: 2 }}>per tonne</div>
                    <button onClick={e => { e.stopPropagation(); openEdit(c) }}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '0.5px solid #e8ede9', background: '#f7f9f8', color: '#6a7a8a', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                      Edit
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* DETAIL PANEL */}
          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Header card */}
              <div style={{ background: '#1a2530', borderRadius: 12, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{selected.name}</div>
                    <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 8, background: catInfo(selected.category).bg, color: catInfo(selected.category).color, fontWeight: 700 }}>
                      {catInfo(selected.category).label}
                    </span>
                  </div>
                  {selected.price_per_tonne && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#4CAF7D', letterSpacing: -1 }}>${selected.price_per_tonne}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>per tonne</div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
                  {millName(selected.feed_mill_id)}{selected.supplier ? ' · ' + selected.supplier : ''}
                </div>
                {/* Stock bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Stock level</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isLowStock(selected) ? '#E24B4A' : '#4CAF7D' }}>
                      {(selected.stock_kg / 1000).toFixed(1)}t / {(selected.min_stock_kg / 1000).toFixed(1)}t min
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: isLowStock(selected) ? '#E24B4A' : '#4CAF7D', borderRadius: 4, width: `${Math.min(selected.min_stock_kg > 0 ? (selected.stock_kg / selected.min_stock_kg) * 100 : 100, 100)}%` }} />
                  </div>
                  {isLowStock(selected) && (
                    <div style={{ fontSize: 11, color: '#E24B4A', marginTop: 6, fontWeight: 600 }}>⚠ Below minimum stock level</div>
                  )}
                </div>
              </div>

              {/* Nutritional profile */}
              {(selected.protein_pct || selected.energy_mj || selected.fat_pct || selected.fiber_pct || selected.moisture_pct || selected.ash_pct) && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '0.5px solid #e8ede9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Nutritional profile</div>
                  {[
                    { label: 'Dry matter',    value: selected.dry_matter_pct, unit: '%',     color: '#1a2530' },
                    { label: 'Crude protein', value: selected.protein_pct,    unit: '%',     color: '#4CAF7D' },
                    { label: 'Energy',        value: selected.energy_mj,      unit: 'MJ/kg', color: '#4A90C4', noBar: true },
                    { label: 'Crude fat',     value: selected.fat_pct,        unit: '%',     color: '#EF9F27' },
                    { label: 'Crude fibre',   value: selected.fiber_pct,      unit: '%',     color: '#E24B4A' },
                    { label: 'Moisture',      value: selected.moisture_pct,   unit: '%',     color: '#aab8c0' },
                    { label: 'Ash',           value: selected.ash_pct,        unit: '%',     color: '#8a9aaa' },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#6a7a8a', width: 100, flexShrink: 0 }}>{r.label}</span>
                      {!r.noBar && (
                        <div style={{ flex: 1, height: 5, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: r.color, borderRadius: 3, width: `${Math.min(r.value! as number, 100)}%` }} />
                        </div>
                      )}
                      {r.noBar && <div style={{ flex: 1 }} />}
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2530', flexShrink: 0 }}>{r.value} {r.unit}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {selected.notes && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '0.5px solid #e8ede9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Notes</div>
                  <p style={{ fontSize: 12, color: '#6a7a8a', lineHeight: 1.6, margin: 0 }}>{selected.notes}</p>
                </div>
              )}

              <div style={{ fontSize: 11, color: '#aab8c0', textAlign: 'center' }}>
                Added {new Date(selected.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
