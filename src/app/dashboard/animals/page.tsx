'use client'
import { useEffect, useState } from 'react'
import { getAnimalGroups, getFeedPrices, updateAnimalCount } from '@/lib/queries'
import type { AnimalGroup, FeedPrice } from '@/lib/types'

const RATIONS: Record<string, { material: string; kgPerHead: number; color: string }[]> = {
  'Grower pigs':  [{ material: 'Maize meal', kgPerHead: 1.4, color: '#4CAF7D' }, { material: 'Soybean meal', kgPerHead: 0.6, color: '#EF9F27' }, { material: 'Wheat bran', kgPerHead: 0.4, color: '#4A90C4' }],
  'Sow herd':     [{ material: 'Soybean meal', kgPerHead: 1.8, color: '#EF9F27' }, { material: 'Maize meal', kgPerHead: 1.3, color: '#4CAF7D' }],
  'Broilers':     [{ material: 'Wheat bran', kgPerHead: 0.12, color: '#4A90C4' }, { material: 'Soybean meal', kgPerHead: 0.06, color: '#EF9F27' }],
  'Beef cattle':  [{ material: 'Barley', kgPerHead: 5.2, color: '#E24B4A' }, { material: 'Maize meal', kgPerHead: 3.0, color: '#4CAF7D' }],
  'Weaners':      [{ material: 'Maize meal', kgPerHead: 0.4, color: '#4CAF7D' }, { material: 'Soybean meal', kgPerHead: 0.3, color: '#EF9F27' }],
}

const PHASES: Record<string, string[]> = {
  'Grower pigs':  ['Starter', 'Grower', 'Finisher'],
  'Sow herd':     ['Gestation', 'Lactation', 'Dry'],
  'Broilers':     ['Day 1–7', 'Day 8–21', 'Day 22–35'],
  'Beef cattle':  ['Backgrounding', 'Finishing'],
  'Weaners':      ['Early wean', 'Late wean'],
}

export default function AnimalsPage() {
  const [groups, setGroups] = useState<AnimalGroup[]>([])
  const [prices, setPrices] = useState<FeedPrice[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [g, p] = await Promise.all([getAnimalGroups(), getFeedPrices()])
      setGroups(g)
      setPrices(p)
      if (g.length > 0) setSelectedId(g[0].id)
      setLoading(false)
    }
    load()
  }, [])

  const selected = groups.find(g => g.id === selectedId) || groups[0]
  const priceMap = Object.fromEntries(prices.map(p => [p.material, p.price_per_tonne]))

  function dailyFeed(g: AnimalGroup) {
    const rations = RATIONS[g.name] || []
    return rations.reduce((s, r) => s + r.kgPerHead * g.count, 0)
  }

  function dailyCost(g: AnimalGroup) {
    const rations = RATIONS[g.name] || []
    return rations.reduce((s, r) => s + r.kgPerHead * g.count / 1000 * (priceMap[r.material] || 300), 0)
  }

  function costPerHead(g: AnimalGroup) {
    return g.count > 0 ? dailyCost(g) / g.count : 0
  }

  async function handleCountChange(g: AnimalGroup, count: number) {
    await updateAnimalCount(g.id, count)
    setGroups(prev => prev.map(x => x.id === g.id ? { ...x, count } : x))
  }

  const totalAnimals = groups.reduce((s, g) => s + g.count, 0)
  const totalFeed = groups.reduce((s, g) => s + dailyFeed(g), 0)
  const totalCost = groups.reduce((s, g) => s + dailyCost(g), 0)

  const typeBadge = (type: string) =>
    type === 'pig' ? { bg: '#FAEEDA', color: '#633806', label: 'Pigs' }
    : type === 'poultry' ? { bg: '#eaf5ee', color: '#27500A', label: 'Poultry' }
    : { bg: '#E6F1FB', color: '#0C447C', label: 'Cattle' }

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#8a9aaa' }}>Loading animal groups...</div>
  }

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Animals</div><div className="page-sub">Herd groups · Feed rations · Cost per head · {groups.length} groups from Supabase</div></div>
        <div className="page-actions">
          <button className="btn-outline">Export</button>
          <button className="btn-primary">+ Add group</button>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total animals</div><div className="sum-val">{totalAnimals.toLocaleString()}</div><div className="sum-sub">{groups.length} groups</div></div>
        <div className="sum-card"><div className="sum-label">Total feed / day</div><div className="sum-val">{Math.round(totalFeed).toLocaleString()} kg</div><div className="sum-sub">{(totalFeed / 1000).toFixed(1)} t/day</div></div>
        <div className="sum-card"><div className="sum-label">Total cost / day</div><div className="sum-val">${Math.round(totalCost).toLocaleString()}</div><div className="sum-sub">All groups</div></div>
        <div className="sum-card"><div className="sum-label">Avg $/head/day</div><div className="sum-val green">${totalAnimals > 0 ? (totalCost / totalAnimals).toFixed(2) : '0.00'}</div><div className="sum-sub">All animal types</div></div>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🐄</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No animal groups yet</div>
          <div style={{ fontSize: 13 }}>Add groups in Supabase → animal_groups table, or click "+ Add group".</div>
        </div>
      ) : (
        <>
          {/* GROUP CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14, marginBottom: 16 }}>
            {groups.map(g => {
              const badge = typeBadge(g.type)
              const cpp = costPerHead(g)
              return (
                <div key={g.id} onClick={() => setSelectedId(g.id)} style={{ background: g.id === selectedId ? '#f4fbf7' : '#fff', border: `0.5px solid ${g.id === selectedId ? '#4CAF7D' : '#e8ede9'}`, borderRadius: 10, padding: '16px 18px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 22 }}>{g.icon || '🐾'}</span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 3 }}>{g.name}</div>
                  <div style={{ fontSize: 24, fontWeight: 500, color: '#1a2530', letterSpacing: -0.5, marginBottom: 2 }}>{g.count.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#aab8c0', marginBottom: 10 }}>animals</div>
                  <div style={{ height: '0.5px', background: '#e8ede9', marginBottom: 10 }} />
                  {[
                    { k: 'Feed/day', v: `${Math.round(dailyFeed(g)).toLocaleString()} kg` },
                    { k: 'Cost/day', v: `$${Math.round(dailyCost(g)).toLocaleString()}` },
                    { k: '$/head/day', v: `$${cpp.toFixed(3)}`, green: true },
                  ].map(r => (
                    <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span style={{ fontSize: 11, color: '#8a9aaa' }}>{r.k}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: (r as any).green ? '#27500A' : '#1a2530' }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* DETAIL for selected group */}
          {selected && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-header">
                  <div className="card-title">Feed ration — {selected.name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(PHASES[selected.name] || []).map((p, i) => (
                      <span key={p} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, background: i === 0 ? '#1a2530' : '#fff', color: i === 0 ? '#fff' : '#6a7a8a', border: '0.5px solid', borderColor: i === 0 ? '#1a2530' : '#e8ede9', cursor: 'pointer' }}>{p}</span>
                    ))}
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Material', 'kg/head/day', '% of ration', 'Daily total', 'Daily cost'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 500, padding: '0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {(RATIONS[selected.name] || []).map(r => {
                      const totalKgHead = (RATIONS[selected.name] || []).reduce((s, x) => s + x.kgPerHead, 0)
                      const pct = totalKgHead > 0 ? Math.round(r.kgPerHead / totalKgHead * 100) : 0
                      const totalKg = r.kgPerHead * selected.count
                      const cost = totalKg / 1000 * (priceMap[r.material] || 300)
                      return (
                        <tr key={r.material}>
                          <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                              {r.material}
                            </div>
                          </td>
                          <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0', fontSize: 13, fontWeight: 500 }}>{r.kgPerHead}</td>
                          <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, color: '#8a9aaa', minWidth: 28 }}>{pct}%</span>
                              <div style={{ flex: 1, height: 5, background: '#f7f9f8', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 3, background: r.color, width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{Math.round(totalKg).toLocaleString()} kg</td>
                          <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0', fontSize: 12, fontWeight: 500, color: '#27500A' }}>${Math.round(cost).toLocaleString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-header"><div className="card-title">Cost per head</div></div>
                <div style={{ fontSize: 32, fontWeight: 500, color: '#27500A', letterSpacing: -1, margin: '8px 0 4px' }}>
                  ${costPerHead(selected).toFixed(3)}
                </div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginBottom: 14 }}>per animal per day</div>
                <div style={{ height: '0.5px', background: '#e8ede9', marginBottom: 14 }} />
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#8a9aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Animal count</label>
                  <input
                    type="number"
                    defaultValue={selected.count}
                    onBlur={e => handleCountChange(selected, Number(e.target.value))}
                    step={10}
                    style={{ border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '6px 10px', fontSize: 14, fontWeight: 500, color: '#1a2530', background: '#fff', width: '100%', fontFamily: 'inherit' }}
                  />
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 4 }}>Edit and click away to save to Supabase</div>
                </div>
                {[
                  { k: 'Feed/day', v: `${Math.round(dailyFeed(selected)).toLocaleString()} kg` },
                  { k: 'Cost/day', v: `$${Math.round(dailyCost(selected)).toLocaleString()}`, g: true },
                  { k: 'Cost/week', v: `$${(costPerHead(selected) * 7).toFixed(2)}`, g: true },
                  { k: 'Cost/month', v: `$${Math.round(costPerHead(selected) * 30)}`, g: true },
                ].map(r => (
                  <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                    <span style={{ fontSize: 12, color: '#8a9aaa' }}>{r.k}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: (r as any).g ? '#27500A' : '#1a2530' }}>{r.v}</span>
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
