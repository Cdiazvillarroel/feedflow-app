'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

interface FeedPrice   { id: string; material: string; price_per_tonne: number }
interface AnimalGroup { id: string; name: string; type: string; count: number; icon: string | null }

const RATIONS: Record<string, { material: string; kgPerHead: number }[]> = {
  'Milking Herd':   [{ material: 'Dairy Mix',      kgPerHead: 10.0 }],
  'Calves':         [{ material: 'Calf Feed',       kgPerHead: 3.0  }],
  'Sows':           [{ material: 'Sow Lactation',   kgPerHead: 6.5  }],
  'Piglets':        [{ material: 'Starter Feed',    kgPerHead: 0.5  }],
  'Growers':        [{ material: 'Grower Feed',     kgPerHead: 1.5  }],
  'Finishers':      [{ material: 'Finisher Feed',   kgPerHead: 2.5  }],
  'Boars':          [{ material: 'Boar Feed',       kgPerHead: 2.5  }],
  'Laying Hens':    [{ material: 'Layer Mash',      kgPerHead: 0.12 }, { material: 'Shell Grit', kgPerHead: 0.01 }],
  'Pullets':        [{ material: 'Grower Feed',     kgPerHead: 0.08 }],
  'Chicks':         [{ material: 'Chick Starter',   kgPerHead: 0.02 }],
  'Broilers':       [{ material: 'Grower Feed',     kgPerHead: 0.10 }],
  'Broiler Chicks': [{ material: 'Chick Starter',   kgPerHead: 0.04 }],
}

const MATERIAL_COLORS: Record<string, string> = {
  'Dairy Mix': '#4CAF7D', 'Calf Feed': '#4A90C4', 'Protein Mix': '#EF9F27',
  'Barley': '#E24B4A', 'Wheat': '#9B59B6', 'Canola Meal': '#1ABC9C',
  'Starter Feed': '#F39C12', 'Grower Feed': '#2ECC71', 'Finisher Feed': '#E74C3C',
  'Sow Lactation': '#3498DB', 'Boar Feed': '#95A5A6', 'Layer Mash': '#F1C40F',
  'Shell Grit': '#BDC3C7', 'Chick Starter': '#E67E22',
}

function getRations(groupName: string, groupType: string) {
  if (RATIONS[groupName]) return RATIONS[groupName]
  // Fallback by type
  if (groupType === 'cattle') return [{ material: 'Dairy Mix', kgPerHead: 8.0 }]
  if (groupType === 'pig')    return [{ material: 'Grower Feed', kgPerHead: 2.0 }]
  if (groupType === 'poultry') return [{ material: 'Layer Mash', kgPerHead: 0.12 }]
  return [{ material: 'Dairy Mix', kgPerHead: 5.0 }]
}

export default function CostsPage() {
  const { currentFarm } = useFarm()
  const farmId = currentFarm?.id || ''

  const [prices,      setPrices]      = useState<FeedPrice[]>([])
  const [groups,      setGroups]      = useState<AnimalGroup[]>([])
  const [localPrices, setLocalPrices] = useState<Record<string, number>>({})
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [savedMsg,    setSavedMsg]    = useState('')

  useEffect(() => { if (farmId) loadAll() }, [farmId])

  async function loadAll() {
    setLoading(true)
    const [pricesR, groupsR] = await Promise.all([
      supabase.from('feed_prices').select('*').eq('farm_id', farmId).order('material'),
      supabase.from('animal_groups').select('*').eq('farm_id', farmId).order('name'),
    ])
    const p = pricesR.data || []
    setPrices(p)
    setGroups(groupsR.data || [])
    setLocalPrices(Object.fromEntries(p.map(x => [x.material, x.price_per_tonne])))
    setLoading(false)
  }

  async function savePrice(material: string, price: number) {
    setSaving(true)
    await supabase.from('feed_prices').update({ price_per_tonne: price }).eq('farm_id', farmId).eq('material', material)
    setSaving(false); setSavedMsg('Saved')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  async function saveCount(groupId: string, count: number) {
    await supabase.from('animal_groups').update({ count }).eq('id', groupId)
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, count } : g))
  }

  function getPrice(material: string) {
    return localPrices[material] ?? prices.find(p => p.material === material)?.price_per_tonne ?? 420
  }

  function groupDailyFeed(g: AnimalGroup) {
    return getRations(g.name, g.type).reduce((s, r) => s + r.kgPerHead * g.count, 0)
  }

  function groupDailyCost(g: AnimalGroup) {
    return getRations(g.name, g.type).reduce((s, r) => s + r.kgPerHead * g.count / 1000 * getPrice(r.material), 0)
  }

  const totalDaily   = groups.reduce((s, g) => s + groupDailyCost(g), 0)
  const totalAnimals = groups.reduce((s, g) => s + g.count, 0)
  const maxCost      = Math.max(...groups.map(g => groupDailyCost(g)), 1)

  const materialCosts: Record<string, number> = {}
  groups.forEach(g => getRations(g.name, g.type).forEach(r => {
    materialCosts[r.material] = (materialCosts[r.material] || 0) + r.kgPerHead * g.count / 1000 * getPrice(r.material)
  }))
  const donutMaterials = Object.keys(materialCosts).filter(m => materialCosts[m] > 0)
  const totalMatCost   = Object.values(materialCosts).reduce((s, v) => s + v, 0)

  const barColor = (cpp: number) => cpp > 2.0 ? '#E24B4A' : cpp > 1.0 ? '#EF9F27' : '#4CAF7D'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading feed costs...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Feed Costs</div>
          <div className="page-sub">{currentFarm?.name} · Cost per animal · Daily spend · Monthly projection</div>
        </div>
        <div className="page-actions">
          {saving   && <span style={{ fontSize: 11, color: '#4CAF7D' }}>Saving...</span>}
          {savedMsg && <span style={{ fontSize: 11, color: '#27500A', fontWeight: 600 }}>✓ {savedMsg}</span>}
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Monthly spend</div><div className="sum-val">${Math.round(totalDaily*30).toLocaleString()}</div><div className="sum-sub">At current rate</div></div>
        <div className="sum-card"><div className="sum-label">Daily spend</div><div className="sum-val">${Math.round(totalDaily).toLocaleString()}</div><div className="sum-sub">All groups</div></div>
        <div className="sum-card"><div className="sum-label">Cost / animal / day</div><div className="sum-val green">${totalAnimals > 0 ? (totalDaily/totalAnimals).toFixed(2) : '0.00'}</div><div className="sum-sub">{totalAnimals.toLocaleString()} animals</div></div>
        <div className="sum-card"><div className="sum-label">Annual projection</div><div className="sum-val">${Math.round(totalDaily*365/1000)}k</div><div className="sum-sub">At current prices</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Feed prices — edit to update all calculations</div>
          <span style={{ fontSize: 11, color: savedMsg ? '#27500A' : '#aab8c0', fontWeight: savedMsg ? 600 : 400 }}>{savedMsg ? '✓ Saved' : 'Click away to save'}</span>
        </div>
        {prices.length === 0 ? (
          <div style={{ color: '#8a9aaa', fontSize: 13 }}>No feed prices found for this farm.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {prices.map(p => (
              <div key={p.id} style={{ background: '#f7f9f8', borderRadius: 10, padding: '14px 16px', border: '0.5px solid #e8ede9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: MATERIAL_COLORS[p.material] || '#aab8c0' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2530' }}>{p.material}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 13, color: '#8a9aaa' }}>$</span>
                  <input type="number" value={localPrices[p.material] ?? p.price_per_tonne}
                    onChange={e => setLocalPrices(prev => ({ ...prev, [p.material]: Number(e.target.value) }))}
                    onBlur={e => savePrice(p.material, Number(e.target.value))}
                    step={5}
                    style={{ border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '5px 8px', fontSize: 14, fontWeight: 600, color: '#1a2530', background: '#fff', width: 80, fontFamily: 'inherit' }} />
                  <span style={{ fontSize: 11, color: '#aab8c0' }}>/t</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Cost per group</div><span style={{ fontSize: 11, color: '#aab8c0' }}>Edit counts to recalculate</span></div>
          {groups.length === 0 ? (
            <div style={{ color: '#8a9aaa', fontSize: 13 }}>No animal groups found for this farm.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Group', 'Count', 'Feed/day', '$/head/day', 'Daily cost', '30 days'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 10, color: '#aab8c0', fontWeight: 600, padding: '0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const cost = groupDailyCost(g)
                  const feed = groupDailyFeed(g)
                  const cpp  = g.count > 0 ? cost / g.count : 0
                  return (
                    <tr key={g.id}>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {g.icon && <span style={{ fontSize: 16 }}>{g.icon}</span>}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{g.name}</div>
                            <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'capitalize' }}>{g.type}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                        <input type="number" defaultValue={g.count}
                          onBlur={e => saveCount(g.id, Number(e.target.value))}
                          step={10}
                          style={{ border: '0.5px solid #e8ede9', borderRadius: 4, padding: '4px 8px', fontSize: 12, color: '#1a2530', background: '#f7f9f8', width: 68, fontFamily: 'inherit', textAlign: 'center' }} />
                      </td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{Math.round(feed).toLocaleString()} kg</td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, fontWeight: 600, color: '#27500A' }}>${cpp.toFixed(3)}</td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', minWidth: 56 }}>${Math.round(cost).toLocaleString()}</span>
                          <div style={{ flex: 1, height: 4, background: '#f0f4f0', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, background: barColor(cpp), width: `${Math.round(cost/maxCost*100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, fontWeight: 600, color: '#27500A' }}>${Math.round(cost*30).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Cost by diet type</div></div>
          {donutMaterials.length > 0 ? (
            <>
              <div style={{ height: 180, position: 'relative', marginBottom: 16 }}>
                <Doughnut
                  data={{ labels: donutMaterials, datasets: [{ data: donutMaterials.map(m => Math.round(materialCosts[m])), backgroundColor: donutMaterials.map(m => MATERIAL_COLORS[m] || '#aab8c0'), borderWidth: 0, hoverOffset: 4 }] }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 10, padding: 10 } }, tooltip: { callbacks: { label: (ctx) => ` $${ctx.parsed.toLocaleString()}/day` } } } }}
                />
              </div>
              {donutMaterials.map(m => {
                const pct = totalMatCost > 0 ? Math.round(materialCosts[m]/totalMatCost*100) : 0
                return (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: MATERIAL_COLORS[m] || '#aab8c0', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#1a2530', flex: 1 }}>{m}</span>
                    <div style={{ width: 70, height: 4, background: '#f0f4f0', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: MATERIAL_COLORS[m] || '#aab8c0', width: `${pct}%` }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#aab8c0', width: 28 }}>{pct}%</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2530', width: 72, textAlign: 'right' }}>${Math.round(materialCosts[m]).toLocaleString()}</span>
                  </div>
                )
              })}
            </>
          ) : (
            <div style={{ color: '#8a9aaa', fontSize: 13 }}>Configure feed prices and animal groups to see cost breakdown.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Cost projections</div></div>
        <div className="grid-3" style={{ marginBottom: 0 }}>
          {[
            { label: 'This month',        val: Math.round(totalDaily*30),      sub: 'At current rate'            },
            { label: 'Next month est.',   val: Math.round(totalDaily*30*1.05), sub: '+5% seasonal adjustment'    },
            { label: 'Annual projection', val: Math.round(totalDaily*365),     sub: 'At flat current rate'       },
          ].map(p => (
            <div key={p.label} style={{ background: '#f7f9f8', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>{p.label}</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1a2530', letterSpacing: -0.5 }}>${p.val.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 4 }}>{p.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
