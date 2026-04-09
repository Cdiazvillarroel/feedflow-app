'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Plan {
  id: string; name: string; price_monthly: number; price_annual: number
  max_farms: number; max_silos: number; max_users: number
  modules: string[]; active: boolean; created_at: string
}

const ALL_MODULES = [
  'dashboard', 'alerts', 'analytics', 'sensors', 'forecast',
  'costs', 'animals', 'feeds', 'logistics', 'insights', 'map', 'ai_routes', 'api_access'
]

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

export default function PlansPage() {
  const [plans,   setPlans]   = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [drawer,  setDrawer]  = useState<Plan | 'new' | null>(null)

  const emptyForm = {
    name: '', price_monthly: '', price_annual: '',
    max_farms: '1', max_silos: '10', max_users: '3',
    modules: [] as string[], active: true,
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data } = await supabase.from('plans').select('*').order('price_monthly')
    setPlans(data || [])
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function openNew() { setForm(emptyForm); setDrawer('new') }
  function openEdit(p: Plan) {
    setForm({
      name: p.name, price_monthly: p.price_monthly.toString(),
      price_annual: p.price_annual.toString(), max_farms: p.max_farms.toString(),
      max_silos: p.max_silos.toString(), max_users: p.max_users.toString(),
      modules: p.modules || [], active: p.active,
    })
    setDrawer(p)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name:          form.name.trim(),
      price_monthly: parseFloat(form.price_monthly) || 0,
      price_annual:  parseFloat(form.price_annual)  || 0,
      max_farms:     parseInt(form.max_farms)        || 1,
      max_silos:     parseInt(form.max_silos)        || 10,
      max_users:     parseInt(form.max_users)        || 3,
      modules:       form.modules,
      active:        form.active,
    }
    if (drawer && drawer !== 'new') {
      await supabase.from('plans').update(payload).eq('id', (drawer as Plan).id)
      showMsg('Plan updated')
    } else {
      await supabase.from('plans').insert(payload)
      showMsg('Plan created')
    }
    setSaving(false); setDrawer(null); loadAll()
  }

  async function remove(id: string) {
    if (!confirm('Delete this plan? Clients assigned to it will lose their plan.')) return
    await supabase.from('plans').delete().eq('id', id)
    setDrawer(null); showMsg('Plan deleted'); loadAll()
  }

  function toggleModule(mod: string) {
    setForm(p => ({
      ...p,
      modules: p.modules.includes(mod)
        ? p.modules.filter(m => m !== mod)
        : [...p.modules, mod]
    }))
  }

  const isEditing = drawer && drawer !== 'new'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading plans...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📋</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditing ? 'Edit plan' : 'New plan'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>FeedFlow subscription plan</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9' }}>Plan details</div>

              <div><label style={lStyle()}>Plan name *</label><input style={iStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Starter / Growth / Enterprise" /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lStyle()}>Monthly price (AUD)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, color: '#8a9aaa' }}>$</span>
                    <input type="number" style={iStyle(true)} value={form.price_monthly} onChange={e => setForm(p => ({ ...p, price_monthly: e.target.value }))} placeholder="149" step="1" />
                  </div>
                </div>
                <div>
                  <label style={lStyle()}>Annual price (AUD)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, color: '#8a9aaa' }}>$</span>
                    <input type="number" style={iStyle(true)} value={form.price_annual} onChange={e => setForm(p => ({ ...p, price_annual: e.target.value }))} placeholder="1490" step="1" />
                  </div>
                </div>
              </div>

              {form.price_monthly && form.price_annual && (
                <div style={{ fontSize: 11, color: '#4CAF7D', fontWeight: 600 }}>
                  Annual saving: ${Math.round(parseFloat(form.price_monthly) * 12 - parseFloat(form.price_annual))} AUD ({Math.round((1 - parseFloat(form.price_annual) / (parseFloat(form.price_monthly) * 12)) * 100)}% off)
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Limits</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div><label style={lStyle()}>Max farms</label><input type="number" style={iStyle(true)} value={form.max_farms} onChange={e => setForm(p => ({ ...p, max_farms: e.target.value }))} min="1" /></div>
                <div><label style={lStyle()}>Max silos</label><input type="number" style={iStyle(true)} value={form.max_silos} onChange={e => setForm(p => ({ ...p, max_silos: e.target.value }))} min="1" /></div>
                <div><label style={lStyle()}>Max users</label><input type="number" style={iStyle(true)} value={form.max_users} onChange={e => setForm(p => ({ ...p, max_users: e.target.value }))} min="1" /></div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: 4 }}>Modules included</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {ALL_MODULES.map(mod => {
                  const checked = form.modules.includes(mod)
                  return (
                    <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '0.5px solid ' + (checked ? '#4CAF7D' : '#e8ede9'), background: checked ? '#f4fbf7' : '#fff', cursor: 'pointer' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleModule(mod)} style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                      <span style={{ fontSize: 12, fontWeight: checked ? 600 : 400, color: '#1a2530', textTransform: 'capitalize' }}>{mod.replace('_', ' ')}</span>
                    </label>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setForm(p => ({ ...p, modules: ALL_MODULES }))}
                  style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '0.5px solid #4CAF7D', background: '#eaf5ee', color: '#27500A', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Select all
                </button>
                <button onClick={() => setForm(p => ({ ...p, modules: [] }))}
                  style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '0.5px solid #e8ede9', background: '#fff', color: '#8a9aaa', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Clear all
                </button>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px', borderRadius: 8, border: '0.5px solid ' + (form.active ? '#4CAF7D' : '#e8ede9'), background: form.active ? '#f4fbf7' : '#fff', marginTop: 4 }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} style={{ accentColor: '#4CAF7D', width: 16, height: 16 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>Active plan</div>
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Available for new client subscriptions</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: form.active ? '#eaf5ee' : '#f0f4f0', color: form.active ? '#27500A' : '#aab8c0' }}>
                  {form.active ? 'ON' : 'OFF'}
                </div>
              </label>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving || !form.name.trim()}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditing ? 'Update plan' : 'Create plan'}
              </button>
              {isEditing && (
                <button onClick={() => remove((drawer as Plan).id)}
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
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>Plans</div>
          <div style={{ fontSize: 13, color: '#8a9aaa', marginTop: 4 }}>{plans.filter(p => p.active).length} active plans · FeedFlow subscription tiers</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>✓ {msg}</div>}
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ New plan</button>
        </div>
      </div>

      {/* PLAN CARDS */}
      {plans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No plans yet</div>
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ Create first plan</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {plans.map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e8ede9', overflow: 'hidden' }}>
              <div style={{ padding: '20px 22px', borderBottom: '0.5px solid #e8ede9', background: p.active ? '#f4fbf7' : '#f7f9f8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2530' }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!p.active && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#f0f4f0', color: '#aab8c0', fontWeight: 600 }}>Inactive</span>}
                    <button onClick={() => openEdit(p)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #e8ede9', background: '#fff', color: '#6a7a8a', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 32, fontWeight: 800, color: '#1a2530', letterSpacing: -1 }}>${p.price_monthly}</span>
                  <span style={{ fontSize: 13, color: '#8a9aaa' }}>/mo AUD</span>
                </div>
                <div style={{ fontSize: 11, color: '#4CAF7D', fontWeight: 600, marginTop: 4 }}>${p.price_annual}/yr — save ${Math.round(p.price_monthly * 12 - p.price_annual)}</div>
              </div>
              <div style={{ padding: '16px 22px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { k: 'Farms', v: p.max_farms },
                    { k: 'Silos', v: p.max_silos },
                    { k: 'Users', v: p.max_users },
                  ].map(r => (
                    <div key={r.k} style={{ textAlign: 'center', background: '#f7f9f8', borderRadius: 8, padding: '8px 4px' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2530' }}>{r.v}</div>
                      <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{r.k}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, fontWeight: 600 }}>Modules ({p.modules?.length || 0})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(p.modules || []).map(m => (
                    <span key={m} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: '#eaf5ee', color: '#27500A', fontWeight: 600, textTransform: 'capitalize' }}>
                      {m.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
