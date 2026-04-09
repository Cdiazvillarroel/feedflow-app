'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

interface Feed {
  id:              string
  farm_id:         string
  feed_mill_id:    string | null
  name:            string
  material:        string
  animal_type:     string
  kg_per_head_day: number
  price_per_tonne: number | null
  protein_pct:     number | null
  energy_mj:       number | null
  fat_pct:         number | null
  fiber_pct:       number | null
  moisture_pct:    number | null
  notes:           string | null
  feed_test_url:   string | null
  feed_test_name:  string | null
  active:          boolean
  created_at:      string
}

interface FeedMill    { id: string; name: string }
interface AnimalGroup { id: string; name: string; type: string }

const ANIMAL_TYPES = [
  { value: 'cattle',  label: 'Cattle',  icon: '🐄' },
  { value: 'pig',     label: 'Pig',     icon: '🐖' },
  { value: 'poultry', label: 'Poultry', icon: '🐔' },
  { value: 'sheep',   label: 'Sheep',   icon: '🐑' },
  { value: 'other',   label: 'Other',   icon: '🐾' },
]

const MATERIAL_COLORS: Record<string, string> = {
  'Dairy Mix': '#4CAF7D', 'Calf Feed': '#4A90C4', 'Protein Mix': '#EF9F27',
  'Barley': '#E24B4A', 'Wheat': '#9B59B6', 'Canola Meal': '#1ABC9C',
  'Starter Feed': '#F39C12', 'Grower Feed': '#2ECC71', 'Finisher Feed': '#E74C3C',
  'Sow Lactation': '#3498DB', 'Boar Feed': '#95A5A6', 'Layer Mash': '#F1C40F',
  'Shell Grit': '#BDC3C7', 'Chick Starter': '#E67E22',
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

export default function FeedsPage() {
  const { currentFarm } = useFarm()
  const farmId = currentFarm?.id || ''

  const [feeds,      setFeeds]      = useState<Feed[]>([])
  const [feedMills,  setFeedMills]  = useState<FeedMill[]>([])
  const [groups,     setGroups]     = useState<AnimalGroup[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [msg,        setMsg]        = useState('')
  const [drawer,     setDrawer]     = useState<Feed | 'new' | null>(null)
  const [filterType, setFilterType] = useState('all')
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<Feed | null>(null)

  const emptyForm = {
    name: '', material: '', animal_type: 'cattle', feed_mill_id: '',
    kg_per_head_day: '', price_per_tonne: '',
    protein_pct: '', energy_mj: '', fat_pct: '', fiber_pct: '', moisture_pct: '',
    notes: '', feed_test_url: '', feed_test_name: '', active: true,
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { if (farmId) loadAll() }, [farmId])

  async function loadAll() {
    setLoading(true)
    const [feedsR, millsR, groupsR] = await Promise.all([
      supabase.from('feeds').select('*').eq('farm_id', farmId).order('name'),
      supabase.from('feed_mills').select('id, name').order('name'),
      supabase.from('animal_groups').select('id, name, type').eq('farm_id', farmId).order('name'),
    ])
    const f = feedsR.data || []
    setFeeds(f)
    setFeedMills(millsR.data || [])
    setGroups(groupsR.data || [])
    if (f.length > 0 && !selected) setSelected(f[0])
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function openNew() { setForm(emptyForm); setDrawer('new') }
  function openEdit(f: Feed) {
    setForm({
      name:            f.name,
      material:        f.material,
      animal_type:     f.animal_type,
      feed_mill_id:    f.feed_mill_id || '',
      kg_per_head_day: f.kg_per_head_day.toString(),
      price_per_tonne: f.price_per_tonne?.toString() || '',
      protein_pct:     f.protein_pct?.toString() || '',
      energy_mj:       f.energy_mj?.toString() || '',
      fat_pct:         f.fat_pct?.toString() || '',
      fiber_pct:       f.fiber_pct?.toString() || '',
      moisture_pct:    f.moisture_pct?.toString() || '',
      notes:           f.notes || '',
      feed_test_url:   f.feed_test_url || '',
      feed_test_name:  f.feed_test_name || '',
      active:          f.active,
    })
    setDrawer(f)
  }

  async function save() {
    if (!form.name.trim() || !form.material.trim()) return
    setSaving(true)
    const payload = {
      farm_id:         farmId,
      feed_mill_id:    form.feed_mill_id || null,
      name:            form.name.trim(),
      material:        form.material.trim(),
      animal_type:     form.animal_type,
      kg_per_head_day: parseFloat(form.kg_per_head_day) || 0,
      price_per_tonne: parseFloat(form.price_per_tonne) || null,
      protein_pct:     parseFloat(form.protein_pct) || null,
      energy_mj:       parseFloat(form.energy_mj) || null,
      fat_pct:         parseFloat(form.fat_pct) || null,
      fiber_pct:       parseFloat(form.fiber_pct) || null,
      moisture_pct:    parseFloat(form.moisture_pct) || null,
      notes:           form.notes || null,
      feed_test_url:   form.feed_test_url || null,
      feed_test_name:  form.feed_test_name || null,
      active:          form.active,
      updated_at:      new Date().toISOString(),
    }
    if (drawer && drawer !== 'new') {
      await supabase.from('feeds').update(payload).eq('id', (drawer as Feed).id)
      showMsg('Feed updated')
    } else {
      await supabase.from('feeds').insert(payload)
      showMsg('Feed created')
    }
    setSaving(false); setDrawer(null); loadAll()
  }

  async function remove(id: string) {
    if (!confirm('Delete this feed?')) return
    await supabase.from('feeds').delete().eq('id', id)
    setDrawer(null); showMsg('Feed deleted')
    if (selected?.id === id) setSelected(null)
    loadAll()
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `feed-tests/${farmId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('feedflow').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('feedflow').getPublicUrl(path)
      setForm(p => ({ ...p, feed_test_url: publicUrl, feed_test_name: file.name }))
      showMsg('File uploaded ✓')
    } catch {
      // Storage not configured — store as local reference
      setForm(p => ({ ...p, feed_test_name: file.name }))
      showMsg('File name saved (configure Supabase Storage for full upload)')
    }
    setUploading(false)
  }

  const filtered = feeds.filter(f => {
    const matchType   = filterType === 'all' || f.animal_type === filterType
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.material.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const isEditing = drawer && drawer !== 'new'
  const typeInfo  = (t: string) => ANIMAL_TYPES.find(x => x.value === t) || ANIMAL_TYPES[4]
  const millName  = (id: string | null) => id ? feedMills.find(m => m.id === id)?.name || '—' : '—'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading feeds...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                🌾
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditing ? 'Edit feed' : 'New feed'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>{currentFarm?.name}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              <SectionTitle title="Basic info" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Feed name *</label>
                  <input style={iStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Premium Dairy Blend" />
                </div>
                <div>
                  <label style={lStyle()}>Material / type *</label>
                  <input style={iStyle(true)} value={form.material} onChange={e => setForm(p => ({ ...p, material: e.target.value }))} placeholder="e.g. Dairy Mix" />
                </div>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Feed mill</label>
                  <select value={form.feed_mill_id} onChange={e => setForm(p => ({ ...p, feed_mill_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                    <option value="">No mill assigned</option>
                    {feedMills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle()}>Price ($/tonne)</label>
                  <input type="number" style={iStyle(true)} value={form.price_per_tonne} onChange={e => setForm(p => ({ ...p, price_per_tonne: e.target.value }))} placeholder="420" step="5" />
                </div>
              </div>

              <div>
                <label style={lStyle()}>kg / head / day</label>
                <input type="number" style={iStyle(true)} value={form.kg_per_head_day} onChange={e => setForm(p => ({ ...p, kg_per_head_day: e.target.value }))} placeholder="e.g. 10.0" step="0.1" />
                {parseFloat(form.kg_per_head_day) > 0 && parseFloat(form.price_per_tonne) > 0 && (
                  <div style={{ fontSize: 11, color: '#4CAF7D', marginTop: 4, fontWeight: 600 }}>
                    ≈ ${(parseFloat(form.kg_per_head_day) / 1000 * parseFloat(form.price_per_tonne)).toFixed(4)}/head/day
                  </div>
                )}
              </div>

              <SectionTitle title="Nutritional information" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Crude protein (%)</label>
                  <input type="number" style={iStyle(true)} value={form.protein_pct} onChange={e => setForm(p => ({ ...p, protein_pct: e.target.value }))} placeholder="e.g. 18.5" step="0.1" />
                </div>
                <div>
                  <label style={lStyle()}>Energy (MJ/kg)</label>
                  <input type="number" style={iStyle(true)} value={form.energy_mj} onChange={e => setForm(p => ({ ...p, energy_mj: e.target.value }))} placeholder="e.g. 12.5" step="0.1" />
                </div>
                <div>
                  <label style={lStyle()}>Crude fat (%)</label>
                  <input type="number" style={iStyle(true)} value={form.fat_pct} onChange={e => setForm(p => ({ ...p, fat_pct: e.target.value }))} placeholder="e.g. 4.2" step="0.1" />
                </div>
                <div>
                  <label style={lStyle()}>Crude fibre (%)</label>
                  <input type="number" style={iStyle(true)} value={form.fiber_pct} onChange={e => setForm(p => ({ ...p, fiber_pct: e.target.value }))} placeholder="e.g. 8.0" step="0.1" />
                </div>
                <div>
                  <label style={lStyle()}>Moisture (%)</label>
                  <input type="number" style={iStyle(true)} value={form.moisture_pct} onChange={e => setForm(p => ({ ...p, moisture_pct: e.target.value }))} placeholder="e.g. 12.0" step="0.1" />
                </div>
              </div>

              {/* Nutritional bar preview */}
              {(form.protein_pct || form.fat_pct || form.fiber_pct || form.moisture_pct) && (
                <div style={{ background: '#f7f9f8', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Nutritional profile</div>
                  {[
                    { label: 'Protein',  value: form.protein_pct,  color: '#4CAF7D' },
                    { label: 'Fat',      value: form.fat_pct,       color: '#4A90C4' },
                    { label: 'Fibre',    value: form.fiber_pct,     color: '#EF9F27' },
                    { label: 'Moisture', value: form.moisture_pct,  color: '#aab8c0' },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#8a9aaa', width: 56, flexShrink: 0 }}>{r.label}</span>
                      <div style={{ flex: 1, height: 6, background: '#e8ede9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: r.color, borderRadius: 3, width: `${Math.min(parseFloat(r.value!) || 0, 100)}%` }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#1a2530', width: 36, textAlign: 'right' }}>{r.value}%</span>
                    </div>
                  ))}
                </div>
              )}

              <SectionTitle title="Feed test & notes" />

              <div>
                <label style={lStyle()}>Feed test document</label>
                {form.feed_test_name ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#eaf5ee', borderRadius: 8, border: '0.5px solid #4CAF7D' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span style={{ fontSize: 12, color: '#27500A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.feed_test_name}</span>
                    {form.feed_test_url && (
                      <a href={form.feed_test_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#4A90C4', fontWeight: 600, textDecoration: 'none' }}>View</a>
                    )}
                    <button onClick={() => setForm(p => ({ ...p, feed_test_url: '', feed_test_name: '' }))} style={{ fontSize: 12, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f7f9f8', borderRadius: 8, border: '0.5px dashed #c8d8cc', cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a9aaa" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span style={{ fontSize: 12, color: '#8a9aaa' }}>{uploading ? 'Uploading...' : 'Click to upload feed test (PDF, DOCX, XLSX)'}</span>
                    <input type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.csv" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
                  </label>
                )}
              </div>

              <div>
                <label style={lStyle()}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                  placeholder="Supplier info, batch number, storage conditions, special instructions..."
                  style={{ ...iStyle(true), resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px', borderRadius: 8, border: '0.5px solid ' + (form.active ? '#4CAF7D' : '#e8ede9'), background: form.active ? '#f4fbf7' : '#fff' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} style={{ accentColor: '#4CAF7D', width: 16, height: 16 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>Active feed</div>
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Available for assignment to animal groups</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: form.active ? '#eaf5ee' : '#f0f4f0', color: form.active ? '#27500A' : '#aab8c0' }}>
                  {form.active ? 'ON' : 'OFF'}
                </div>
              </label>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving || !form.name.trim() || !form.material.trim()}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditing ? 'Update feed' : 'Create feed'}
              </button>
              {isEditing && (
                <button onClick={() => remove((drawer as Feed).id)}
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
          <div className="page-title">Feed</div>
          <div className="page-sub">{currentFarm?.name} · Feed library · Rations · Nutritional profiles</div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding: '7px 14px', background: msg.includes('Error') ? '#FCEBEB' : '#eaf5ee', border: '0.5px solid ' + (msg.includes('Error') ? '#F09595' : '#4CAF7D'), borderRadius: 8, fontSize: 12, fontWeight: 600, color: msg.includes('Error') ? '#A32D2D' : '#27500A' }}>{'✓ ' + msg}</div>}
          <button className="btn-primary" onClick={openNew}>+ New feed</button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total feeds</div><div className="sum-val">{feeds.length}</div><div className="sum-sub">{feeds.filter(f => f.active).length} active</div></div>
        <div className="sum-card"><div className="sum-label">Avg price</div><div className="sum-val">${feeds.filter(f => f.price_per_tonne).length > 0 ? Math.round(feeds.filter(f => f.price_per_tonne).reduce((s, f) => s + (f.price_per_tonne || 0), 0) / feeds.filter(f => f.price_per_tonne).length) : '—'}</div><div className="sum-sub">per tonne</div></div>
        <div className="sum-card"><div className="sum-label">With feed tests</div><div className="sum-val green">{feeds.filter(f => f.feed_test_name).length}</div><div className="sum-sub">documents attached</div></div>
        <div className="sum-card"><div className="sum-label">Animal types</div><div className="sum-val" style={{ color: '#4A90C4' }}>{new Set(feeds.map(f => f.animal_type)).size}</div><div className="sum-sub">covered</div></div>
      </div>

      {/* FILTER BAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '0 12px', flex: 1, maxWidth: 300 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Search feeds..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1a2530', background: 'transparent', width: '100%', padding: '9px 0' }} />
        </div>
        <button onClick={() => setFilterType('all')}
          style={{ padding: '7px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', borderColor: filterType === 'all' ? '#1a2530' : '#e8ede9', background: filterType === 'all' ? '#1a2530' : '#fff', color: filterType === 'all' ? '#fff' : '#6a7a8a', fontFamily: 'inherit' }}>
          All
        </button>
        {ANIMAL_TYPES.map(t => (
          <button key={t.value} onClick={() => setFilterType(t.value)}
            style={{ padding: '7px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', borderColor: filterType === t.value ? '#4CAF7D' : '#e8ede9', background: filterType === t.value ? '#eaf5ee' : '#fff', color: filterType === t.value ? '#27500A' : '#6a7a8a', fontFamily: 'inherit' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {feeds.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌾</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No feeds for {currentFarm?.name}</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Create your feed library with nutritional profiles and pricing.</div>
          <button className="btn-primary" onClick={openNew}>+ Create first feed</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: filtered.length > 0 && selected ? '1fr 340px' : '1fr', gap: 16 }}>

          {/* FEED LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#8a9aaa', fontSize: 13 }}>No feeds match your filter.</div>
            ) : filtered.map(f => {
              const ti   = typeInfo(f.animal_type)
              const isOn = selected?.id === f.id
              const mc   = MATERIAL_COLORS[f.material] || '#aab8c0'
              return (
                <div key={f.id} onClick={() => setSelected(f)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: isOn ? '#f4fbf7' : '#fff', borderRadius: 10, border: `${isOn ? '1.5px' : '0.5px'} solid ${isOn ? '#4CAF7D' : '#e8ede9'}`, cursor: 'pointer' }}
                  onMouseEnter={e => { if (!isOn) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>

                  <div style={{ width: 44, height: 44, borderRadius: 10, background: mc + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {ti.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{f.name}</div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: mc + '22', color: mc, fontWeight: 600 }}>{f.material}</span>
                      {!f.active && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#f0f4f0', color: '#aab8c0', fontWeight: 600 }}>Inactive</span>}
                      {f.feed_test_name && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#E6F1FB', color: '#0C447C', fontWeight: 600 }}>📄 Feed test</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#8a9aaa' }}>
                      {ti.icon} {ti.label}
                      {f.feed_mill_id ? ' · ' + millName(f.feed_mill_id) : ''}
                      {f.kg_per_head_day > 0 ? ' · ' + f.kg_per_head_day + ' kg/head/day' : ''}
                      {f.price_per_tonne ? ' · $' + f.price_per_tonne + '/t' : ''}
                    </div>
                    {(f.protein_pct || f.energy_mj) && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
                        {f.protein_pct && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#eaf5ee', color: '#27500A', fontWeight: 600 }}>Protein {f.protein_pct}%</span>}
                        {f.energy_mj   && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#E6F1FB', color: '#0C447C', fontWeight: 600 }}>Energy {f.energy_mj} MJ</span>}
                        {f.fat_pct     && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#FAEEDA', color: '#633806', fontWeight: 600 }}>Fat {f.fat_pct}%</span>}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {f.price_per_tonne && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2530' }}>${f.price_per_tonne}</div>
                        <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase' }}>per tonne</div>
                      </div>
                    )}
                    <button onClick={e => { e.stopPropagation(); openEdit(f) }}
                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '0.5px solid #e8ede9', background: '#f7f9f8', color: '#6a7a8a', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, alignSelf: 'center' }}>
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
              <div style={{ background: '#1a2530', borderRadius: 12, padding: '20px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>{selected.material} · {typeInfo(selected.animal_type).icon} {typeInfo(selected.animal_type).label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { k: 'Price/tonne', v: selected.price_per_tonne ? `$${selected.price_per_tonne}` : '—' },
                    { k: 'kg/head/day', v: selected.kg_per_head_day > 0 ? `${selected.kg_per_head_day} kg` : '—' },
                    { k: 'Cost/head/day', v: selected.price_per_tonne && selected.kg_per_head_day ? `$${(selected.kg_per_head_day / 1000 * selected.price_per_tonne).toFixed(4)}` : '—' },
                    { k: 'Feed mill', v: millName(selected.feed_mill_id) },
                  ].map(r => (
                    <div key={r.k} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{r.k}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{r.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nutritional profile */}
              {(selected.protein_pct || selected.energy_mj || selected.fat_pct || selected.fiber_pct || selected.moisture_pct) && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '0.5px solid #e8ede9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Nutritional profile</div>
                  {[
                    { label: 'Crude protein', value: selected.protein_pct, unit: '%', color: '#4CAF7D' },
                    { label: 'Energy',         value: selected.energy_mj,   unit: 'MJ/kg', color: '#4A90C4', noBar: true },
                    { label: 'Crude fat',      value: selected.fat_pct,     unit: '%', color: '#EF9F27' },
                    { label: 'Crude fibre',    value: selected.fiber_pct,   unit: '%', color: '#E24B4A' },
                    { label: 'Moisture',       value: selected.moisture_pct,unit: '%', color: '#aab8c0' },
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

              {/* Feed test */}
              {selected.feed_test_name && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '0.5px solid #e8ede9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Feed test</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A90C4" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span style={{ fontSize: 12, color: '#1a2530', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.feed_test_name}</span>
                    {selected.feed_test_url && (
                      <a href={selected.feed_test_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#E6F1FB', color: '#0C447C', fontWeight: 600, textDecoration: 'none' }}>
                        Download
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selected.notes && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '0.5px solid #e8ede9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Notes</div>
                  <p style={{ fontSize: 12, color: '#6a7a8a', lineHeight: 1.6, margin: 0 }}>{selected.notes}</p>
                </div>
              )}

              {/* Assigned groups */}
              {groups.filter(g => g.type === selected.animal_type).length > 0 && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '0.5px solid #e8ede9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Compatible groups</div>
                  {groups.filter(g => g.type === selected.animal_type).map(g => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF7D', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#1a2530' }}>{g.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Meta */}
              <div style={{ fontSize: 11, color: '#aab8c0', textAlign: 'center' }}>
                Created {new Date(selected.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
