'use client'
import { useEffect, useState } from 'react'
import { getAnimalGroups, getFeedPrices, updateAnimalCount } from '@/lib/queries'
import type { AnimalGroup, FeedPrice } from '@/lib/types'

const RATIONS: Record<string, { material: string; kgPerHead: number; color: string }[]> = {
  'Sows lactating':  [{ material: 'Lactation diet', kgPerHead: 6.5, color: '#4CAF7D' }],
  'Sows gestating':  [{ material: 'Gestation diet', kgPerHead: 2.5, color: '#4A90C4' }],
  'Gilt developers': [{ material: 'Gestation diet', kgPerHead: 2.0, color: '#4A90C4' }],
  'Lactating sows':  [{ material: 'Lactation diet', kgPerHead: 6.5, color: '#4CAF7D' }],
  'Gestating sows':  [{ material: 'Gestation diet', kgPerHead: 2.5, color: '#4A90C4' }],
  'Grower pigs':     [{ material: 'Lactation diet', kgPerHead: 2.4, color: '#4CAF7D' }, { material: 'Gestation diet', kgPerHead: 0.4, color: '#4A90C4' }],
  'Sow herd':        [{ material: 'Lactation diet', kgPerHead: 5.5, color: '#4CAF7D' }],
  'Weaners':         [{ material: 'Lactation diet', kgPerHead: 0.4, color: '#4CAF7D' }],
  'Broilers':        [{ material: 'Gestation diet', kgPerHead: 0.18, color: '#4A90C4' }],
  'Beef cattle':     [{ material: 'Gestation diet', kgPerHead: 8.2, color: '#EF9F27' }],
}

const PHASES: Record<string, string[]> = {
  'Sows lactating':  ['Lactation', 'Dry', 'Pre-weaning'],
  'Sows gestating':  ['Early gestation', 'Mid gestation', 'Late gestation'],
  'Gilt developers': ['Selection', 'Development', 'Pre-service'],
  'Lactating sows':  ['Lactation', 'Dry'],
  'Gestating sows':  ['Early', 'Mid', 'Late'],
  'Grower pigs':     ['Starter', 'Grower', 'Finisher'],
  'Sow herd':        ['Gestation', 'Lactation', 'Dry'],
  'Weaners':         ['Early wean', 'Late wean'],
  'Broilers':        ['Day 1–7', 'Day 8–21', 'Day 22–35'],
  'Beef cattle':     ['Backgrounding', 'Finishing'],
}

function getRations(name: string) { return RATIONS[name] || [{ material: 'Lactation diet', kgPerHead: 3.0, color: '#4CAF7D' }] }

export default function AnimalsPage() {
  const [groups,      setGroups]      = useState<AnimalGroup[]>([])
  const [prices,      setPrices]      = useState<FeedPrice[]>([])
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [activePhase, setActivePhase] = useState<Record<string, number>>({})
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([getAnimalGroups(), getFeedPrices()]).then(([g, p]) => {
      setGroups(g); setPrices(p)
      if (g.length > 0) setSelectedId(g[0].id)
      setLoading(false)
    })
  }, [])

  const selected = groups.find(g => g.id === selectedId) || groups[0]
  const priceMap = Object.fromEntries(prices.map(p => [p.material, p.price_per_tonne]))

  function dailyFeed(g: AnimalGroup) { return getRations(g.name).reduce((s, r) => s + r.kgPerHead * g.count, 0) }
  function dailyCost(g: AnimalGroup) { return getRations(g.name).reduce((s, r) => s + r.kgPerHead * g.count / 1000 * (priceMap[r.material] || 520), 0) }
  function costPerHead(g: AnimalGroup) { return g.count > 0 ? dailyCost(g) / g.count : 0 }
  function kgPerHeadTotal(g: AnimalGroup) { return getRations(g.name).reduce((s, r) => s + r.kgPerHead, 0) }

  async function handleCountChange(g: AnimalGroup, count: number) {
    await updateAnimalCount(g.id, count)
    setGroups(prev => prev.map(x => x.id === g.id ? { ...x, count } : x))
  }

  const totalAnimals = groups.reduce((s, g) => s + g.count, 0)
  const totalFeed    = groups.reduce((s, g) => s + dailyFeed(g), 0)
  const totalCost    = groups.reduce((s, g) => s + dailyCost(g), 0)

  const typeBadge = (type: string) =>
    type === 'pig'     ? { bg: '#FAEEDA', color: '#633806', label: 'Pigs' } :
    type === 'poultry' ? { bg: '#eaf5ee', color: '#27500A', label: 'Poultry' } :
                         { bg: '#E6F1FB', color: '#0C447C', label: 'Cattle' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading animal groups...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Animals</div><div className="page-sub">Herd groups · Feed rations · Cost per head</div></div>
        <div className="page-actions"><button className="btn-outline">Export</button><button className="btn-primary">+ Add group</button></div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total animals</div><div className="sum-val">{totalAnimals.toLocaleString()}</div><div className="sum-sub">{groups.length} groups</div></div>
        <div className="sum-card"><div className="sum-label">Feed / day</div><div className="sum-val">{(totalFeed/1000).toFixed(1)} t</div><div className="sum-sub">{Math.round(totalFeed).toLocaleString()} kg total</div></div>
        <div className="sum-card"><div className="sum-label">Cost / day</div><div className="sum-val">${Math.round(totalCost).toLocaleString()}</div><div className="sum-sub">All groups combined</div></div>
        <div className="sum-card"><div className="sum-label">Avg $/head/day</div><div className="sum-val green">${totalAnimals > 0 ? (totalCost/totalAnimals).toFixed(2) : '0.00'}</div><div className="sum-sub">Across all groups</div></div>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🐖</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2530', marginBottom: 6 }}>No animal groups yet</div>
          <div style={{ fontSize: 13 }}>Add groups in Supabase → animal_groups table.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14, marginBottom: 20 }}>
            {groups.map(g => {
              const badge = typeBadge(g.type), cpp = costPerHead(g), on = g.id === selectedId
              return (
                <button key={g.id} onClick={() => setSelectedId(g.id)} style={{ background: on ? '#f4fbf7' : '#fff', border: `${on ? '1.5px' : '0.5px'} solid ${on ? '#4CAF7D' : '#e8ede9'}`, borderRadius: 12, padding: '18px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontSize: 26 }}>{g.icon || '🐾'}</span>
                    <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2530', marginBottom: 2 }}>{g.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: '#1a2530', letterSpacing: -1 }}>{g.count.toLocaleString()}</span>
                    <span style={{ fontSize: 12, color: '#aab8c0' }}>animals</span>
                  </div>
                  <div style={{ height: '0.5px', background: '#e8ede9', marginBottom: 10 }} />
                  {[
                    { k: 'kg/head/day', v: `${kgPerHeadTotal(g).toFixed(1)} kg` },
                    { k: 'Feed/day total', v: `${Math.round(dailyFeed(g)).toLocaleString()} kg` },
                    { k: 'Cost/day', v: `$${Math.round(dailyCost(g)).toLocaleString()}` },
                    { k: '$/head/day', v: `$${cpp.toFixed(2)}`, green: true },
                  ].map(r => (
                    <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '0.5px solid #f7f9f8' }}>
                      <span style={{ fontSize: 11, color: '#8a9aaa' }}>{r.k}</span>
                      <span style={{ fontSize: 12, fontWeight: (r as any).green ? 700 : 600, color: (r as any).green ? '#27500A' : '#1a2530' }}>{r.v}</span>
                    </div>
                  ))}
                </button>
              )
            })}
          </div>

          {selected && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-header">
                  <div className="card-title">Feed ration — {selected.name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(PHASES[selected.name] || []).map((p, i) => {
                      const phaseActive = (activePhase[selected.id] ?? 0) === i
                      return (
                        <button key={p} onClick={() => setActivePhase(prev => ({ ...prev, [selected.id]: i }))}
                          style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid', background: phaseActive ? '#1a2530' : '#fff', color: phaseActive ? '#fff' : '#6a7a8a', borderColor: phaseActive ? '#1a2530' : '#e8ede9', fontFamily: 'inherit' }}>{p}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Material','kg/head/day','% of ration','Daily total','Daily cost'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 10, color: '#aab8c0', fontWeight: 600, padding: '0 12px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {getRations(selected.name).map(r => {
                      const totalKgHead = getRations(selected.name).reduce((s, x) => s + x.kgPerHead, 0)
                      const pct     = totalKgHead > 0 ? Math.round(r.kgPerHead/totalKgHead*100) : 100
                      const totalKg = r.kgPerHead * selected.count
                      const cost    = totalKg / 1000 * (priceMap[r.material] || 520)
                      return (
                        <tr key={r.material}>
                          <td style={{ padding: '12px', borderBottom: '0.5px solid #f0f4f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color }} />
                              <span style={{ fontSize: 13, color: '#1a2530' }}>{r.material}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px', borderBottom: '0.5px solid #f0f4f0', fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{r.kgPerHead}</td>
                          <td style={{ padding: '12px', borderBottom: '0.5px solid #f0f4f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, color: '#8a9aaa', minWidth: 32 }}>{pct}%</span>
                              <div style={{ flex: 1, height: 6, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 3, background: r.color, width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{Math.round(totalKg).toLocaleString()} kg</td>
                          <td style={{ padding: '12px', borderBottom: '0.5px solid #f0f4f0', fontSize: 13, fontWeight: 600, color: '#27500A' }}>${Math.round(cost).toLocaleString()}</td>
                        </tr>
                      )
                    })}
                    <tr style={{ background: '#f7f9f8' }}>
                      <td style={{ padding: '12px', fontWeight: 700, fontSize: 13, color: '#1a2530' }}>Total</td>
                      <td style={{ padding: '12px', fontSize: 14, fontWeight: 700, color: '#1a2530' }}>{getRations(selected.name).reduce((s, r) => s + r.kgPerHead, 0).toFixed(1)} kg</td>
                      <td style={{ padding: '12px', fontSize: 13, fontWeight: 600 }}>100%</td>
                      <td style={{ padding: '12px', fontSize: 13, fontWeight: 600 }}>{Math.round(dailyFeed(selected)).toLocaleString()} kg</td>
                      <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, color: '#27500A' }}>${Math.round(dailyCost(selected)).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-header"><div className="card-title">Cost summary</div></div>
                <div style={{ background: '#f4fbf7', borderRadius: 10, padding: '16px', marginBottom: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Cost per head per day</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: '#27500A', letterSpacing: -1.5 }}>${costPerHead(selected).toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: '#8a9aaa', marginTop: 4 }}>{kgPerHeadTotal(selected).toFixed(1)} kg feed/head/day</div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#8a9aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Animal count</label>
                  <input type="number" defaultValue={selected.count} key={selected.id} onBlur={e => handleCountChange(selected, Number(e.target.value))} step={10}
                    style={{ border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '8px 12px', fontSize: 16, fontWeight: 600, color: '#1a2530', background: '#fff', width: '100%', fontFamily: 'inherit' }} />
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 4 }}>Edit and click away — saves to Supabase</div>
                </div>
                <div style={{ height: '0.5px', background: '#e8ede9', marginBottom: 14 }} />
                {[
                  { k: 'Feed / day',   v: `${Math.round(dailyFeed(selected)).toLocaleString()} kg` },
                  { k: 'Cost / day',   v: `$${Math.round(dailyCost(selected)).toLocaleString()}`,    g: true },
                  { k: 'Cost / week',  v: `$${Math.round(dailyCost(selected)*7).toLocaleString()}`,  g: true },
                  { k: 'Cost / month', v: `$${Math.round(dailyCost(selected)*30).toLocaleString()}`, g: true },
                  { k: 'Cost / year',  v: `$${Math.round(dailyCost(selected)*365).toLocaleString()}`,g: true },
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
