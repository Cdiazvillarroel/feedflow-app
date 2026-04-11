'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

interface Commodity { id: string; name: string; category: string; price_per_tonne: number | null; protein_pct: number | null; energy_mj: number | null }
interface FormulaIngredient { id: string; formula_id: string; commodity_id: string; inclusion_pct: number; kg_per_tonne: number; commodity?: Commodity }
interface Formula {
  id: string; feed_mill_id: string; name: string; animal_type: string
  description: string | null; batch_size_kg: number; cost_per_tonne: number | null
  active: boolean; created_at: string
}
interface FeedMill { id: string; name: string }

const ANIMAL_TYPES = [
  { value: 'cattle',  label: 'Cattle',  icon: '🐄' },
  { value: 'pig',     label: 'Pig',     icon: '🐖' },
  { value: 'poultry', label: 'Poultry', icon: '🐔' },
  { value: 'sheep',   label: 'Sheep',   icon: '🐑' },
  { value: 'other',   label: 'Other',   icon: '🐾' },
]

const CATEGORY_COLORS: Record<string, string> = {
  grain: '#EF9F27', protein: '#4CAF7D', fat: '#E24B4A',
  fiber: '#9B59B6', mineral: '#4A90C4', vitamin: '#1ABC9C',
  additive: '#633806', other: '#8a9aaa',
}

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

export default function FormulasPage() {
  const { selectedMillId } = useFarm()

  const [formulas,     setFormulas]     = useState<Formula[]>([])
  const [commodities,  setCommodities]  = useState<Commodity[]>([])
  const [mills,        setMills]        = useState<FeedMill[]>([])
  const [ingredients,  setIngredients]  = useState<FormulaIngredient[]>([])
  const [selected,     setSelected]     = useState<Formula | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState('')
  const [search,       setSearch]       = useState('')
  const [filterType,   setFilterType]   = useState('all')
  const [drawer,       setDrawer]       = useState<Formula | 'new' | null>(null)

  const emptyForm = {
    feed_mill_id: selectedMillId || '', name: '', animal_type: 'cattle',
    description: '', batch_size_kg: '1000', active: true,
  }
  const [form,         setForm]         = useState(emptyForm)
  const [formIngredients, setFormIngredients] = useState<{ commodity_id: string; inclusion_pct: string; kg_per_tonne: string }[]>([])

  useEffect(() => { loadAll() }, [selectedMillId])

  async function loadAll() {
    setLoading(true)
    const millFilter = selectedMillId
    const [formulasR, commR, millsR, ingR] = await Promise.all([
      millFilter
        ? supabase.from('feed_formulas').select('*').eq('feed_mill_id', millFilter).order('name')
        : supabase.from('feed_formulas').select('*').order('name'),
      millFilter
        ? supabase.from('commodities').select('id, name, category, price_per_tonne, protein_pct, energy_mj').eq('feed_mill_id', millFilter).eq('active', true).order('name')
        : supabase.from('commodities').select('id, name, category, price_per_tonne, protein_pct, energy_mj').eq('active', true).order('name'),
      supabase.from('feed_mills').select('id, name').order('name'),
      supabase.from('formula_ingredients').select('*, commodity:commodities(id, name, category, price_per_tonne, protein_pct, energy_mj)'),
    ])
    const f = formulasR.data || []
    setFormulas(f)
    setCommodities(commR.data || [])
    setMills(millsR.data || [])
    setIngredients(ingR.data || [])
    if (f.length > 0 && !selected) setSelected(f[0])
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function openNew() {
    setForm({ ...emptyForm, feed_mill_id: selectedMillId || '' })
    setFormIngredients([{ commodity_id: '', inclusion_pct: '', kg_per_tonne: '' }])
    setDrawer('new')
  }

  function openEdit(f: Formula) {
    setForm({ feed_mill_id: f.feed_mill_id, name: f.name, animal_type: f.animal_type, description: f.description || '', batch_size_kg: f.batch_size_kg.toString(), active: f.active })
    const ing = ingredients.filter(i => i.formula_id === f.id)
    setFormIngredients(ing.map(i => ({ commodity_id: i.commodity_id, inclusion_pct: i.inclusion_pct.toString(), kg_per_tonne: i.kg_per_tonne.toString() })))
    setDrawer(f)
  }

  function addIngredient() {
    setFormIngredients(p => [...p, { commodity_id: '', inclusion_pct: '', kg_per_tonne: '' }])
  }

  function removeIngredient(idx: number) {
    setFormIngredients(p => p.filter((_, i) => i !== idx))
  }

  function updateIngredient(idx: number, field: string, value: string) {
    setFormIngredients(p => p.map((ing, i) => {
      if (i !== idx) return ing
      const updated = { ...ing, [field]: value }
      // Auto-calc kg_per_tonne from inclusion_pct
      if (field === 'inclusion_pct' && value) {
        updated.kg_per_tonne = (parseFloat(value) * 10).toString()
      }
      return updated
    }))
  }

  const totalInclusion = formIngredients.reduce((s, i) => s + (parseFloat(i.inclusion_pct) || 0), 0)

  function calcFormulaCost() {
    return formIngredients.reduce((s, i) => {
      const comm  = commodities.find(c => c.id === i.commodity_id)
      const price = comm?.price_per_tonne || 0
      const pct   = parseFloat(i.inclusion_pct) || 0
      return s + (pct / 100 * price)
    }, 0)
  }

  async function save() {
    if (!form.name.trim() || !form.feed_mill_id) return
    setSaving(true)

    const payload = {
      feed_mill_id:  form.feed_mill_id,
      name:          form.name.trim(),
      animal_type:   form.animal_type,
      description:   form.description || null,
      batch_size_kg: parseFloat(form.batch_size_kg) || 1000,
      cost_per_tonne: Math.round(calcFormulaCost() * 100) / 100,
      active:        form.active,
      updated_at:    new Date().toISOString(),
    }

    let formulaId = ''
    if (drawer && drawer !== 'new') {
      formulaId = (drawer as Formula).id
      await supabase.from('feed_formulas').update(payload).eq('id', formulaId)
      await supabase.from('formula_ingredients').delete().eq('formula_id', formulaId)
      showMsg('Formula updated')
    } else {
      const { data } = await supabase.from('feed_formulas').insert(payload).select().single()
      formulaId = data?.id || ''
      showMsg('Formula created')
    }

    // Save ingredients
    const validIngredients = formIngredients.filter(i => i.commodity_id && i.inclusion_pct)
    if (validIngredients.length > 0 && formulaId) {
      await supabase.from('formula_ingredients').insert(
        validIngredients.map(i => ({
          formula_id:    formulaId,
          commodity_id:  i.commodity_id,
          inclusion_pct: parseFloat(i.inclusion_pct),
          kg_per_tonne:  parseFloat(i.kg_per_tonne) || parseFloat(i.inclusion_pct) * 10,
        }))
      )
    }

    setSaving(false); setDrawer(null); loadAll()
  }

  async function remove(id: string) {
    if (!confirm('Delete this formula?')) return
    await supabase.from('formula_ingredients').delete().eq('formula_id', id)
    await supabase.from('feed_formulas').delete().eq('id', id)
    setDrawer(null); showMsg('Formula deleted'); setSelected(null); loadAll()
  }

  const millName    = (id: string) => mills.find(m => m.id === id)?.name || '—'
  const typeInfo    = (t: string) => ANIMAL_TYPES.find(x => x.value === t) || ANIMAL_TYPES[4]
  const isEditing   = drawer && drawer !== 'new'
  const selIngredients = selected ? ingredients.filter(i => i.formula_id === selected.id) : []

  // Calculated nutritional profile for selected formula
  const calcNutrition = (ings: FormulaIngredient[]) => {
    const protein = ings.reduce((s, i) => s + (i.inclusion_pct / 100) * (i.commodity?.protein_pct || 0), 0)
    const energy  = ings.reduce((s, i) => s + (i.inclusion_pct / 100) * (i.commodity?.energy_mj   || 0), 0)
    return { protein: Math.round(protein * 10) / 10, energy: Math.round(energy * 100) / 100 }
  }

  const filtered = formulas
    .filter(f => filterType === 'all' || f.animal_type === filterType)
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading formulas...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {/* DRAWER */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 560, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {typeInfo(form.animal_type).icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditing ? 'Edit formula' : 'New formula'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Nutrition Manager · Formula Manager</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Basic */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9' }}>Formula details</div>
              <div>
                <label style={lStyle()}>Feed mill *</label>
                <select value={form.feed_mill_id} onChange={e => setForm(p => ({ ...p, feed_mill_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">Select mill</option>
                  {mills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lStyle()}>Formula name *</label><input style={iStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Dairy Mix Premium" /></div>
                <div><label style={lStyle()}>Batch size (kg)</label><input type="number" style={iStyle(true)} value={form.batch_size_kg} onChange={e => setForm(p => ({ ...p, batch_size_kg: e.target.value }))} placeholder="1000" step="100" /></div>
              </div>
              <div>
                <label style={lStyle()}>Animal type *</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ANIMAL_TYPES.map(t => (
                    <button key={t.value} onClick={() => setForm(p => ({ ...p, animal_type: t.value }))}
                      style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid ' + (form.animal_type === t.value ? '#4CAF7D88' : '#e8ede9'), background: form.animal_type === t.value ? '#eaf5ee' : '#fff', color: form.animal_type === t.value ? '#27500A' : '#8a9aaa' }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div><label style={lStyle()}>Description</label><textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="High energy dairy ration for milking cows..." style={{ ...iStyle(true), resize: 'vertical', lineHeight: 1.5 }} /></div>

              {/* Ingredients */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>
                Ingredients
                <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 8, background: Math.abs(totalInclusion - 100) < 0.1 ? '#eaf5ee' : '#FAEEDA', color: Math.abs(totalInclusion - 100) < 0.1 ? '#27500A' : '#633806', fontWeight: 600 }}>
                  {totalInclusion.toFixed(1)}% / 100%
                </span>
              </div>

              {formIngredients.map((ing, idx) => (
                <div key={idx} style={{ background: '#f7f9f8', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Ingredient {idx + 1}</span>
                    {formIngredients.length > 1 && (
                      <button onClick={() => removeIngredient(idx)} style={{ fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                    )}
                  </div>
                  <select value={ing.commodity_id} onChange={e => updateIngredient(idx, 'commodity_id', e.target.value)} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">Select commodity</option>
                    {commodities
                      .filter(c => !formIngredients.some((fi, i) => i !== idx && fi.commodity_id === c.id))
                      .map(c => <option key={c.id} value={c.id}>{c.name} ({c.category})</option>)}
                  </select>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={lStyle()}>Inclusion (%)</label>
                      <input type="number" style={iStyle(true)} value={ing.inclusion_pct} onChange={e => updateIngredient(idx, 'inclusion_pct', e.target.value)} placeholder="35" step="0.1" min="0" max="100" />
                    </div>
                    <div>
                      <label style={lStyle()}>kg/tonne</label>
                      <input type="number" style={iStyle(true)} value={ing.kg_per_tonne} onChange={e => updateIngredient(idx, 'kg_per_tonne', e.target.value)} placeholder="350" step="1" />
                    </div>
                    <div>
                      <label style={lStyle()}>Cost contribution</label>
                      <div style={{ padding: '8px 10px', background: '#eaf5ee', borderRadius: 7, fontSize: 12, fontWeight: 700, color: '#27500A' }}>
                        ${(() => {
                          const comm  = commodities.find(c => c.id === ing.commodity_id)
                          const price = comm?.price_per_tonne || 0
                          const pct   = parseFloat(ing.inclusion_pct) || 0
                          return (pct / 100 * price).toFixed(2)
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addIngredient} style={{ padding: '8px', border: '0.5px dashed #c8d8cc', borderRadius: 8, fontSize: 12, color: '#8a9aaa', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                + Add ingredient
              </button>

              {/* Cost summary */}
              <div style={{ background: '#1a2530', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Estimated cost/tonne</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#4CAF7D', letterSpacing: -0.5 }}>${calcFormulaCost().toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Total inclusion</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: Math.abs(totalInclusion - 100) < 0.1 ? '#4CAF7D' : '#EF9F27' }}>{totalInclusion.toFixed(1)}%</span>
                </div>
                {Math.abs(totalInclusion - 100) > 0.1 && (
                  <div style={{ fontSize: 11, color: '#EF9F27', marginTop: 6 }}>⚠ Ingredients should total 100%</div>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px', borderRadius: 8, border: '0.5px solid ' + (form.active ? '#4CAF7D' : '#e8ede9'), background: form.active ? '#f4fbf7' : '#fff' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} style={{ accentColor: '#4CAF7D', width: 16, height: 16 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>Active formula</div>
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Available for production scheduling</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: form.active ? '#eaf5ee' : '#f0f4f0', color: form.active ? '#27500A' : '#aab8c0' }}>
                  {form.active ? 'ON' : 'OFF'}
                </div>
              </label>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving || !form.name.trim() || !form.feed_mill_id}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditing ? 'Update formula' : 'Create formula'}
              </button>
              {isEditing && (
                <button onClick={() => remove((drawer as Formula).id)}
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
          <div className="page-title">Formula Manager</div>
          <div className="page-sub">
            {selectedMillId ? mills.find(m => m.id === selectedMillId)?.name : 'All mills'} · {formulas.length} formulas · {formulas.filter(f => f.active).length} active
          </div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>✓ {msg}</div>}
          <button className="btn-primary" onClick={openNew}>+ New formula</button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total formulas</div><div className="sum-val">{formulas.length}</div><div className="sum-sub">{formulas.filter(f => f.active).length} active</div></div>
        <div className="sum-card"><div className="sum-label">Avg cost/tonne</div><div className="sum-val">${formulas.length > 0 ? Math.round(formulas.reduce((s, f) => s + (f.cost_per_tonne || 0), 0) / formulas.length) : 0}</div><div className="sum-sub">Across all formulas</div></div>
        <div className="sum-card"><div className="sum-label">Avg ingredients</div><div className="sum-val" style={{ color: '#4A90C4' }}>{formulas.length > 0 ? Math.round(ingredients.length / formulas.length) : 0}</div><div className="sum-sub">Per formula</div></div>
        <div className="sum-card"><div className="sum-label">Animal types</div><div className="sum-val" style={{ color: '#EF9F27' }}>{new Set(formulas.map(f => f.animal_type)).size}</div><div className="sum-sub">Covered</div></div>
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '0 12px', flex: 1, maxWidth: 280 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search formulas..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1a2530', background: 'transparent', width: '100%', padding: '9px 0' }} />
        </div>
        <button onClick={() => setFilterType('all')}
          style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', borderColor: filterType === 'all' ? '#1a2530' : '#e8ede9', background: filterType === 'all' ? '#1a2530' : '#fff', color: filterType === 'all' ? '#fff' : '#6a7a8a' }}>
          All
        </button>
        {ANIMAL_TYPES.map(t => (
          <button key={t.value} onClick={() => setFilterType(filterType === t.value ? 'all' : t.value)}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', borderColor: filterType === t.value ? '#4CAF7D' : '#e8ede9', background: filterType === t.value ? '#eaf5ee' : '#fff', color: filterType === t.value ? '#27500A' : '#6a7a8a' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      {formulas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧪</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No formulas yet</div>
          <button className="btn-primary" onClick={openNew}>+ Create first formula</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: filtered.length > 0 && selected ? '1fr 340px' : '1fr', gap: 16 }}>

          {/* FORMULA LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(f => {
              const ti   = typeInfo(f.animal_type)
              const isOn = selected?.id === f.id
              const ings = ingredients.filter(i => i.formula_id === f.id)
              const nutr = calcNutrition(ings)
              return (
                <div key={f.id} onClick={() => setSelected(f)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: isOn ? '#f4fbf7' : '#fff', borderRadius: 10, border: `${isOn ? '1.5px' : '0.5px'} solid ${isOn ? '#4CAF7D' : '#e8ede9'}`, cursor: 'pointer' }}
                  onMouseEnter={e => { if (!isOn) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                  <div style={{ width: 46, height: 46, borderRadius: 10, background: '#f7f9f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {ti.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{f.name}</div>
                      {!f.active && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#f0f4f0', color: '#aab8c0', fontWeight: 600 }}>Inactive</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#8a9aaa', marginBottom: 5 }}>
                      {millName(f.feed_mill_id)} · {ti.label} · {ings.length} ingredients
                      {f.description ? ` · ${f.description}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {nutr.protein > 0 && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: '#eaf5ee', color: '#27500A', fontWeight: 600 }}>Protein {nutr.protein}%</span>}
                      {nutr.energy > 0  && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: '#E6F1FB', color: '#0C447C', fontWeight: 600 }}>Energy {nutr.energy} MJ</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {f.cost_per_tonne && (
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2530' }}>${f.cost_per_tonne}</div>
                        <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase' }}>per tonne</div>
                      </div>
                    )}
                    <button onClick={e => { e.stopPropagation(); openEdit(f) }}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #e8ede9', background: '#f7f9f8', color: '#6a7a8a', cursor: 'pointer', fontFamily: 'inherit', marginTop: 6 }}>
                      Edit
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* DETAIL PANEL */}
          {selected && (() => {
            const ings = ingredients.filter(i => i.formula_id === selected.id)
            const nutr = calcNutrition(ings)
            const ti   = typeInfo(selected.animal_type)
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Header */}
                <div style={{ background: '#1a2530', borderRadius: 12, padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{ti.icon}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{selected.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{millName(selected.feed_mill_id)} · {ti.label}</div>
                    </div>
                  </div>
                  {selected.description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.5 }}>{selected.description}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { k: 'Cost/tonne', v: selected.cost_per_tonne ? `$${selected.cost_per_tonne}` : '—' },
                      { k: 'Batch size', v: `${selected.batch_size_kg}kg` },
                      { k: 'Ingredients', v: ings.length },
                    ].map(r => (
                      <div key={r.k} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{r.k}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#4CAF7D' }}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ingredients breakdown */}
                <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '0.5px solid #e8ede9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Ingredient breakdown</div>
                  {ings.map(ing => {
                    const catColor = CATEGORY_COLORS[ing.commodity?.category || 'other'] || '#aab8c0'
                    return (
                      <div key={ing.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#1a2530', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.commodity?.name || '—'}</span>
                        <div style={{ width: 80, height: 5, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{ height: '100%', background: catColor, borderRadius: 3, width: `${ing.inclusion_pct}%` }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2530', width: 44, textAlign: 'right', flexShrink: 0 }}>{ing.inclusion_pct}%</span>
                      </div>
                    )
                  })}
                </div>

                {/* Calculated nutrition */}
                {(nutr.protein > 0 || nutr.energy > 0) && (
                  <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '0.5px solid #e8ede9' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Calculated nutrition</div>
                    {[
                      { label: 'Crude protein', value: nutr.protein, unit: '%',     color: '#4CAF7D' },
                      { label: 'Energy',        value: nutr.energy,  unit: 'MJ/kg', color: '#4A90C4', noBar: true },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#6a7a8a', width: 100, flexShrink: 0 }}>{r.label}</span>
                        {!r.noBar && (
                          <div style={{ flex: 1, height: 5, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: r.color, borderRadius: 3, width: `${Math.min(r.value, 100)}%` }} />
                          </div>
                        )}
                        {r.noBar && <div style={{ flex: 1 }} />}
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2530', flexShrink: 0 }}>{r.value} {r.unit}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 11, color: '#aab8c0', textAlign: 'center' }}>
                  Created {new Date(selected.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </>
  )
}
