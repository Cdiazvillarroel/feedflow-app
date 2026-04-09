'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

interface AnimalGroup { id: string; farm_id: string; name: string; type: string; icon: string | null; count: number }
interface Feed        { id: string; name: string; material: string; kg_per_head_day: number; price_per_tonne: number | null; animal_type: string }

const ANIMAL_TYPES = ['cattle', 'pig', 'poultry', 'sheep', 'other']
const ICONS: Record<string, string> = {
  cattle: '🐄', pig: '🐖', poultry: '🐔', sheep: '🐑', other: '🐾'
}
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

export default function AnimalsPage() {
  const { currentFarm } = useFarm()
  const farmId = currentFarm?.id || ''

  const [groups,        setGroups]        = useState<AnimalGroup[]>([])
  const [feeds,         setFeeds]         = useState<Feed[]>([])
  const [groupFeeds,    setGroupFeeds]    = useState<Record<string, string[]>>({})  // groupId → feedIds
  const [selectedId,    setSelectedId]    = useState<string | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [msg,           setMsg]           = useState('')
  const [drawer,        setDrawer]        = useState<AnimalGroup | 'new' | null>(null)
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([])

  const emptyForm = { name: '', type: 'cattle', icon: '', count: '0' }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { if (farmId) loadAll() }, [farmId])

  async function loadAll() {
    setLoading(true)
    const [groupsR, feedsR, agfR] = await Promise.all([
      supabase.from('animal_groups').select('*').eq('farm_id', farmId).order('name'),
      supabase.from('feeds').select('id, name, material, kg_per_head_day, price_per_tonne, animal_type').eq('farm_id', farmId).eq('active', true).order('name'),
      supabase.from('animal_group_feeds').select('animal_group_id, feed_id'),
    ])
    const g = groupsR.data || []
    setGroups(g)
    setFeeds(feedsR.data || [])
    // Build groupFeeds map
    const map: Record<string, string[]> = {}
    ;(agfR.data || []).forEach(r => {
      if (!map[r.animal_group_id]) map[r.animal_group_id] = []
      map[r.animal_group_id].push(r.feed_id)
    })
    setGroupFeeds(map)
    if (g.length > 0 && !selectedId) setSelectedId(g[0].id)
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function openNew() { setForm(emptyForm); setSelectedFeeds([]); setDrawer('new') }
  function openEdit(g: AnimalGroup) {
    setForm({ name: g.name, type: g.type, icon: g.icon || '', count: g.count.toString() })
    setSelectedFeeds(groupFeeds[g.id] || [])
    setDrawer(g)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      farm_id: farmId,
      name:    form.name.trim(),
      type:    form.type,
      icon:    form.icon || ICONS[form.type] || '🐾',
      count:   parseInt(form.count) || 0,
    }
    let groupId = ''
    if (drawer && drawer !== 'new') {
      groupId = (drawer as AnimalGroup).id
      await supabase.from('animal_groups').update(payload).eq('id', groupId)
      showMsg('Group updated')
    } else {
      const { data } = await supabase.from('animal_groups').insert(payload).select().single()
      groupId = data?.id || ''
      showMsg('Group created')
    }
    // Save feed assignments
    if (groupId) {
      await supabase.from('animal_group_feeds').delete().eq('animal_group_id', groupId)
      if (selectedFeeds.length > 0) {
        const feed = feeds.filter(f => selectedFeeds.includes(f.id))
        await supabase.from('animal_group_feeds').insert(
          feed.map(f => ({ animal_group_id: groupId, feed_id: f.id, kg_per_head_day: f.kg_per_head_day }))
        )
      }
    }
    setSaving(false); setDrawer(null); loadAll()
  }

  async function remove(id: string) {
    if (!confirm('Delete this animal group?')) return
    await supabase.from('animal_group_feeds').delete().eq('animal_group_id', id)
    await supabase.from('animal_groups').delete().eq('id', id)
    setDrawer(null); showMsg('Group deleted')
    if (selectedId === id) setSelectedId(null)
    loadAll()
  }

  async function handleCountChange(g: AnimalGroup, count: number) {
    await supabase.from('animal_groups').update({ count }).eq('id', g.id)
    setGroups(prev => prev.map(x => x.id === g.id ? { ...x, count } : x))
  }

  // Get feeds assigned to a group, falling back to feeds matching animal type
  function getGroupFeeds(g: AnimalGroup): Feed[] {
    const assigned = groupFeeds[g.id] || []
    if (assigned.length > 0) return feeds.filter(f => assigned.includes(f.id))
    return feeds.filter(f => f.animal_type === g.type)
  }

  function dailyFeed(g: AnimalGroup)  { return getGroupFeeds(g).reduce((s, f) => s + f.kg_per_head_day * g.count, 0) }
  function dailyCost(g: AnimalGroup)  { return getGroupFeeds(g).reduce((s, f) => s + f.kg_per_head_day * g.count / 1000 * (f.price_per_tonne || 420), 0) }
  function costPerHead(g: AnimalGroup){ return g.count > 0 ? dailyCost(g) / g.count : 0 }
  function kgPerHeadTotal(g: AnimalGroup) { return getGroupFeeds(g).reduce((s, f) => s + f.kg_per_head_day, 0) }

  const selected     = groups.find(g => g.id === selectedId) || groups[0]
  const totalAnimals = groups.reduce((s, g) => s + g.count, 0)
  const totalFeed    = groups.reduce((s, g) => s + dailyFeed(g), 0)
  const totalCost    = groups.reduce((s, g) => s + dailyCost(g), 0)

  const typeBadge = (type: string) =>
    type === 'pig'     ? { bg: '#FAEEDA', color: '#633806', label: 'Pigs'    } :
    type === 'poultry' ? { bg: '#eaf5ee', color: '#27500A', label: 'Poultry' } :
    type === 'sheep'   ? { bg: '#f0f4f0', color: '#6a7a8a', label: 'Sheep'   } :
                         { bg: '#E6F1FB', color: '#0C447C', label: 'Cattle'  }

  const isEditing     = drawer && drawer !== 'new'
  const drawerType    = form.type
  const availableFeeds = feeds.filter(f => f.animal_type === drawerType)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading animals...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {/* DRAWER */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 460, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {form.icon || ICONS[form.type] || '🐾'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditing ? 'Edit animal group' : 'New animal group'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>{currentFarm?.name}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Basic info */}
              <div>
                <label style={lStyle()}>Group name *</label>
                <input style={iStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Milking Herd" />
              </div>
              <div>
                <label style={lStyle()}>Animal type *</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ANIMAL_TYPES.map(t => (
                    <button key={t} onClick={() => { setForm(p => ({ ...p, type: t, icon: ICONS[t] })); setSelectedFeeds([]) }}
                      style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid ' + (form.type === t ? '#4CAF7D88' : '#e8ede9'), background: form.type === t ? '#eaf5ee' : '#fff', color: form.type === t ? '#27500A' : '#8a9aaa' }}>
                      {ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Icon (emoji)</label>
                  <input style={iStyle(true)} value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} placeholder="🐄" maxLength={4} />
                </div>
                <div>
                  <label style={lStyle()}>Animal count</label>
                  <input type="number" style={iStyle(true)} value={form.count} onChange={e => setForm(p => ({ ...p, count: e.target.value }))} placeholder="0" min="0" step="10" />
                </div>
              </div>

              {/* Feed assignment */}
              <div style={{ borderTop: '0.5px solid #e8ede9', paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={lStyle()}>Assign feeds</label>
                  <span style={{ fontSize: 11, color: '#aab8c0' }}>{availableFeeds.length} available for {drawerType}</span>
                </div>
                {availableFeeds.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#aab8c0', padding: '10px', background: '#f7f9f8', borderRadius: 8, textAlign: 'center' }}>
                    No feeds for {drawerType}. Add feeds in the Feed Library module.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {availableFeeds.map(f => {
                      const checked = selectedFeeds.includes(f.id)
                      const mc      = MATERIAL_COLORS[f.material] || '#aab8c0'
                      return (
                        <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (checked ? '#4CAF7D' : '#e8ede9'), background: checked ? '#f4fbf7' : '#fff', cursor: 'pointer' }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setSelectedFeeds(prev => checked ? prev.filter(id => id !== f.id) : [...prev, f.id])}
                            style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: mc, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: '#1a2530' }}>{f.name}</div>
                            <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>{f.material} · {f.kg_per_head_day} kg/head/day{f.price_per_tonne ? ' · $' + f.price_per_tonne + '/t' : ''}</div>
                          </div>
                          {checked && f.price_per_tonne && (
                            <span style={{ fontSize: 11, color: '#4CAF7D', fontWeight: 600, flexShrink: 0 }}>
                              ${(f.kg_per_head_day / 1000 * f.price_per_tonne).toFixed(4)}/head
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Ration summary */}
              {selectedFeeds.length > 0 && parseInt(form.count) > 0 && (
                <div style={{ background: '#eaf5ee', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#27500A', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Ration summary</div>
                  {feeds.filter(f => selectedFeeds.includes(f.id)).map(f => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#1a2530', padding: '3px 0' }}>
                      <span>{f.material}</span>
                      <span>{(f.kg_per_head_day * parseInt(form.count)).toFixed(0)} kg/day</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.1)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#27500A' }}>
                    <span>Total</span>
                    <span>{feeds.filter(f => selectedFeeds.includes(f.id)).reduce((s, f) => s + f.kg_per_head_day * parseInt(form.count), 0).toFixed(0)} kg/day</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving || !form.name.trim()}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditing ? 'Update group' : 'Create group'}
              </button>
              {isEditing && (
                <button onClick={() => remove((drawer as AnimalGroup).id)}
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
          <div className="page-title">Animals</div>
          <div className="page-sub">{currentFarm?.name} · Herd groups · Feed rations · Cost per head</div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>{'✓ ' + msg}</div>}
          <button className="btn-primary" onClick={openNew}>+ Add group</button>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total animals</div><div className="sum-val">{totalAnimals.toLocaleString()}</div><div className="sum-sub">{groups.length} groups</div></div>
        <div className="sum-card"><div className="sum-label">Feed / day</div><div className="sum-val">{(totalFeed/1000).toFixed(1)} t</div><div className="sum-sub">{Math.round(totalFeed).toLocaleString()} kg total</div></div>
        <div className="sum-card"><div className="sum-label">Cost / day</div><div className="sum-val">${Math.round(totalCost).toLocaleString()}</div><div className="sum-sub">All groups combined</div></div>
        <div className="sum-card"><div className="sum-label">Avg $/head/day</div><div className="sum-val green">${totalAnimals > 0 ? (totalCost/totalAnimals).toFixed(3) : '0.00'}</div><div className="sum-sub">Across all groups</div></div>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🐄</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2530', marginBottom: 6 }}>No animal groups for {currentFarm?.name}</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Add the first group to start tracking feed consumption and costs.</div>
          <button className="btn-primary" onClick={openNew}>+ Add first group</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14, marginBottom: 20 }}>
            {groups.map(g => {
              const badge = typeBadge(g.type)
              const cpp   = costPerHead(g)
              const on    = g.id === selectedId
              const gf    = getGroupFeeds(g)
              return (
                <div key={g.id} onClick={() => setSelectedId(g.id)}
                  style={{ background: on ? '#f4fbf7' : '#fff', border: `${on ? '1.5px' : '0.5px'} solid ${on ? '#4CAF7D' : '#e8ede9'}`, borderRadius: 12, padding: '18px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', position: 'relative' }}>
                  <button onClick={e => { e.stopPropagation(); openEdit(g) }}
                    style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '0.5px solid #e8ede9', background: '#f7f9f8', color: '#8a9aaa', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Edit
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 26 }}>{g.icon || ICONS[g.type] || '🐾'}</span>
                    <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2530', marginBottom: 2 }}>{g.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 6 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: '#1a2530', letterSpacing: -1 }}>{g.count.toLocaleString()}</span>
                    <span style={{ fontSize: 12, color: '#aab8c0' }}>animals</span>
                  </div>
                  {gf.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                      {gf.slice(0,3).map(f => (
                        <span key={f.id} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: (MATERIAL_COLORS[f.material] || '#aab8c0') + '22', color: MATERIAL_COLORS[f.material] || '#aab8c0', fontWeight: 600 }}>{f.material}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ height: '0.5px', background: '#e8ede9', marginBottom: 10 }} />
                  {[
                    { k: 'kg/head/day',    v: `${kgPerHeadTotal(g).toFixed(2)} kg` },
                    { k: 'Feed/day total', v: `${Math.round(dailyFeed(g)).toLocaleString()} kg` },
                    { k: 'Cost/day',       v: `$${Math.round(dailyCost(g)).toLocaleString()}` },
                    { k: '$/head/day',     v: `$${cpp.toFixed(3)}`, green: true },
                  ].map(r => (
                    <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '0.5px solid #f7f9f8' }}>
                      <span style={{ fontSize: 11, color: '#8a9aaa' }}>{r.k}</span>
                      <span style={{ fontSize: 12, fontWeight: (r as any).green ? 700 : 600, color: (r as any).green ? '#27500A' : '#1a2530' }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {selected && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-header">
                  <div className="card-title">Feed ration — {selected.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#aab8c0' }}>{selected.count.toLocaleString()} {selected.type}</span>
                    {groupFeeds[selected.id]?.length > 0
                      ? <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#eaf5ee', color: '#27500A', fontWeight: 600 }}>From Feed Library</span>
                      : <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#FAEEDA', color: '#633806', fontWeight: 600 }}>Auto-matched by type</span>
                    }
                  </div>
                </div>
                {getGroupFeeds(selected).length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#aab8c0', fontSize: 13 }}>
                    No feeds assigned. Edit this group to assign feeds from the Feed Library.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['Feed', 'Material', 'kg/head/day', '% of ration', 'Daily total', 'Daily cost'].map(h => (
                        <th key={h} style={{ textAlign: 'left', fontSize: 10, color: '#aab8c0', fontWeight: 600, padding: '0 12px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {getGroupFeeds(selected).map(f => {
                        const totalKgHead = getGroupFeeds(selected).reduce((s, x) => s + x.kg_per_head_day, 0)
                        const pct     = totalKgHead > 0 ? Math.round(f.kg_per_head_day / totalKgHead * 100) : 100
                        const totalKg = f.kg_per_head_day * selected.count
                        const cost    = totalKg / 1000 * (f.price_per_tonne || 420)
                        const mc      = MATERIAL_COLORS[f.material] || '#aab8c0'
                        return (
                          <tr key={f.id}>
                            <td style={{ padding: '12px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, fontWeight: 600, color: '#1a2530' }}>{f.name}</td>
                            <td style={{ padding: '12px', borderBottom: '0.5px solid #f0f4f0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: mc }} />
                                <span style={{ fontSize: 12, color: '#8a9aaa' }}>{f.material}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px', borderBottom: '0.5px solid #f0f4f0', fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{f.kg_per_head_day}</td>
                            <td style={{ padding: '12px', borderBottom: '0.5px solid #f0f4f0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, color: '#8a9aaa', minWidth: 32 }}>{pct}%</span>
                                <div style={{ flex: 1, height: 6, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', borderRadius: 3, background: mc, width: `${pct}%` }} />
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{Math.round(totalKg).toLocaleString()} kg</td>
                            <td style={{ padding: '12px', borderBottom: '0.5px solid #f0f4f0', fontSize: 13, fontWeight: 600, color: '#27500A' }}>${Math.round(cost).toLocaleString()}</td>
                          </tr>
                        )
                      })}
                      <tr style={{ background: '#f7f9f8' }}>
                        <td colSpan={2} style={{ padding: '12px', fontWeight: 700, fontSize: 13, color: '#1a2530' }}>Total</td>
                        <td style={{ padding: '12px', fontSize: 14, fontWeight: 700, color: '#1a2530' }}>{kgPerHeadTotal(selected).toFixed(2)} kg</td>
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 600 }}>100%</td>
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 600 }}>{Math.round(dailyFeed(selected)).toLocaleString()} kg</td>
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, color: '#27500A' }}>${Math.round(dailyCost(selected)).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-header"><div className="card-title">Cost summary</div></div>
                <div style={{ background: '#f4fbf7', borderRadius: 10, padding: '16px', marginBottom: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Cost per head per day</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: '#27500A', letterSpacing: -1.5 }}>${costPerHead(selected).toFixed(3)}</div>
                  <div style={{ fontSize: 12, color: '#8a9aaa', marginTop: 4 }}>{kgPerHeadTotal(selected).toFixed(2)} kg feed/head/day</div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#8a9aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Animal count</label>
                  <input type="number" defaultValue={selected.count} key={selected.id}
                    onBlur={e => handleCountChange(selected, Number(e.target.value))}
                    step={10}
                    style={{ border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '8px 12px', fontSize: 16, fontWeight: 600, color: '#1a2530', background: '#fff', width: '100%', fontFamily: 'inherit' }} />
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 4 }}>Edit and click away — saves to Supabase</div>
                </div>
                <div style={{ height: '0.5px', background: '#e8ede9', marginBottom: 14 }} />
                {[
                  { k: 'Feed / day',   v: `${Math.round(dailyFeed(selected)).toLocaleString()} kg` },
                  { k: 'Cost / day',   v: `$${Math.round(dailyCost(selected)).toLocaleString()}`,     g: true },
                  { k: 'Cost / week',  v: `$${Math.round(dailyCost(selected)*7).toLocaleString()}`,   g: true },
                  { k: 'Cost / month', v: `$${Math.round(dailyCost(selected)*30).toLocaleString()}`,  g: true },
                  { k: 'Cost / year',  v: `$${Math.round(dailyCost(selected)*365).toLocaleString()}`, g: true },
                ].map(r => (
                  <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                    <span style={{ fontSize: 12, color: '#8a9aaa' }}>{r.k}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: (r as any).g ? '#27500A' : '#1a2530' }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
