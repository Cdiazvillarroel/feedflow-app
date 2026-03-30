'use client'
import { useEffect, useState } from 'react'
import { getFeedPrices, getAnimalGroups, updateFeedPrice, updateAnimalCount } from '@/lib/queries'
import type { FeedPrice, AnimalGroup } from '@/lib/types'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const MATERIAL_COLORS: Record<string, string> = {
  'Maize meal':   '#4CAF7D',
  'Wheat bran':   '#4A90C4',
  'Soybean meal': '#EF9F27',
  'Barley':       '#E24B4A',
}

const RATIONS: Record<string, { material: string; kgPerHead: number }[]> = {
  'Grower pigs':  [{ material: 'Maize meal', kgPerHead: 1.4 }, { material: 'Soybean meal', kgPerHead: 0.6 }, { material: 'Wheat bran', kgPerHead: 0.4 }],
  'Sow herd':     [{ material: 'Soybean meal', kgPerHead: 1.8 }, { material: 'Maize meal', kgPerHead: 1.3 }],
  'Broilers':     [{ material: 'Wheat bran', kgPerHead: 0.12 }, { material: 'Soybean meal', kgPerHead: 0.06 }],
  'Beef cattle':  [{ material: 'Barley', kgPerHead: 5.2 }, { material: 'Maize meal', kgPerHead: 3.0 }],
  'Weaners':      [{ material: 'Maize meal', kgPerHead: 0.4 }, { material: 'Soybean meal', kgPerHead: 0.3 }],
}

export default function CostsPage() {
  const [prices, setPrices] = useState<FeedPrice[]>([])
  const [groups, setGroups] = useState<AnimalGroup[]>([])
  const [localPrices, setLocalPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [p, g] = await Promise.all([getFeedPrices(), getAnimalGroups()])
      setPrices(p)
      setGroups(g)
      setLocalPrices(Object.fromEntries(p.map(x => [x.material, x.price_per_tonne])))
      setLoading(false)
    }
    load()
  }, [])

  async function savePrice(material: string, price: number) {
    setSaving(true)
    await updateFeedPrice(undefined as any, material, price)
    setSaving(false)
  }

  async function saveCount(groupId: string, count: number) {
    await updateAnimalCount(groupId, count)
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, count } : g))
  }

  function groupDailyCost(g: AnimalGroup) {
    const rations = RATIONS[g.name] || []
    return rations.reduce((s, r) => s + r.kgPerHead * g.count / 1000 * (localPrices[r.material] || 0), 0)
  }

  function groupDailyFeed(g: AnimalGroup) {
    const rations = RATIONS[g.name] || []
    return rations.reduce((s, r) => s + r.kgPerHead * g.count, 0)
  }

  const totalDaily = groups.reduce((s, g) => s + groupDailyCost(g), 0)
  const totalAnimals = groups.reduce((s, g) => s + g.count, 0)
  const maxCost = Math.max(...groups.map(g => groupDailyCost(g)), 1)
  const barColor = (cpp: number) => cpp > 1.5 ? '#E24B4A' : cpp > 0.8 ? '#EF9F27' : '#4CAF7D'

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#8a9aaa' }}>Loading feed costs...</div>
  }

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Feed costs</div><div className="page-sub">Cost per animal · Daily spend · Monthly projection</div></div>
        <div className="page-actions"><button className="btn-outline">Export CSV</button></div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total this month</div><div className="sum-val">${Math.round(totalDaily * 30).toLocaleString()}</div><div className="sum-sub">At current rate</div></div>
        <div className="sum-card"><div className="sum-label">Daily spend</div><div className="sum-val">${Math.round(totalDaily).toLocaleString()}</div><div className="sum-sub">Based on current prices</div></div>
        <div className="sum-card"><div className="sum-label">Cost / animal / day</div><div className="sum-val green">${totalAnimals > 0 ? (totalDaily / totalAnimals).toFixed(2) : '0.00'}</div><div className="sum-sub">All groups</div></div>
        <div className="sum-card"><div className="sum-label">Monthly projection</div><div className="sum-val">${Math.round(totalDaily * 30 * 1.05).toLocaleString()}</div><div className="sum-sub">+5% seasonal adj.</div></div>
      </div>

      {/* AI INSIGHT */}
      <div style={{ background: '#1a2530', borderRadius: 10, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(76,175,125,0.15)', border: '0.5px solid rgba(76,175,125,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 3 }}>
            Feed cost is ${totalAnimals > 0 ? (totalDaily / totalAnimals).toFixed(2) : '0.00'} per animal per day
            {totalAnimals > 0 && totalDaily / totalAnimals < 1.5 ? ' — within normal range' : ' — edit prices to recalculate'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            Total farm spend: ${Math.round(totalDaily).toLocaleString()}/day · Prices saved to Supabase automatically
          </div>
        </div>
        <span style={{ background: 'rgba(76,175,125,0.18)', border: '0.5px solid rgba(76,175,125,0.3)', color: '#4CAF7D', fontSize: 10, padding: '2px 8px', borderRadius: 10 }}>
          {saving ? 'Saving...' : 'PipeDream AI'}
        </span>
      </div>

      {/* PRICES from Supabase */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Feed prices — edit to update all calculations</div>
          <span style={{ fontSize: 11, color: '#aab8c0' }}>Saved to Supabase on change</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
          {prices.length === 0 ? (
            <div style={{ gridColumn: '1/-1', color: '#8a9aaa', fontSize: 13 }}>No feed prices configured. Add them in Supabase → feed_prices table.</div>
          ) : (
            prices.map(p => (
              <div key={p.id} style={{ background: '#f7f9f8', borderRadius: 8, padding: '14px 16px', border: '0.5px solid #e8ede9' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1a2530', marginBottom: 4 }}>{p.material}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginBottom: 10 }}>Color: <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: MATERIAL_COLORS[p.material] || '#aab8c0', verticalAlign: 'middle' }} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: '#8a9aaa' }}>$</span>
                  <input
                    type="number"
                    value={localPrices[p.material] || p.price_per_tonne}
                    onChange={e => setLocalPrices(prev => ({ ...prev, [p.material]: Number(e.target.value) }))}
                    onBlur={e => savePrice(p.material, Number(e.target.value))}
                    step={5}
                    style={{ border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '6px 8px', fontSize: 14, fontWeight: 500, color: '#1a2530', background: '#fff', width: 80, fontFamily: 'inherit' }}
                  />
                  <span style={{ fontSize: 11, color: '#aab8c0' }}>/ tonne</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ANIMAL TABLE from Supabase */}
      <div className="grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Cost per animal group</div>
            <span style={{ fontSize: 11, color: '#aab8c0' }}>Edit counts → auto-saves to Supabase</span>
          </div>
          {groups.length === 0 ? (
            <div style={{ color: '#8a9aaa', fontSize: 13 }}>No animal groups found. Add them in Supabase → animal_groups table.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Group', 'Animals', 'Feed/day', '$/head/day', 'Daily cost', '30d'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 500, padding: '0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const cost = groupDailyCost(g)
                  const feed = groupDailyFeed(g)
                  const cpp = g.count > 0 ? cost / g.count : 0
                  return (
                    <tr key={g.id}>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 13, fontWeight: 500, color: '#1a2530' }}>
                        {g.icon && <span style={{ marginRight: 6 }}>{g.icon}</span>}{g.name}
                      </td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                        <input
                          type="number"
                          defaultValue={g.count}
                          onBlur={e => saveCount(g.id, Number(e.target.value))}
                          step={10}
                          style={{ border: '0.5px solid #e8ede9', borderRadius: 4, padding: '4px 8px', fontSize: 12, color: '#1a2530', background: '#f7f9f8', width: 64, fontFamily: 'inherit', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{Math.round(feed).toLocaleString()} kg</td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, fontWeight: 500, color: '#27500A' }}>${cpp.toFixed(3)}</td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#1a2530', minWidth: 60 }}>${Math.round(cost).toLocaleString()}</span>
                          <div style={{ flex: 1, height: 4, background: '#f7f9f8', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, background: barColor(cpp), width: `${Math.round(cost / maxCost * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, fontWeight: 500, color: '#27500A' }}>${Math.round(cost * 30).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Cost breakdown by material</div></div>
          {prices.length > 0 && groups.length > 0 ? (
            <>
              {prices.map(p => {
                const totalCostMat = groups.reduce((s, g) => {
                  const r = (RATIONS[g.name] || []).find(x => x.material === p.material)
                  return s + (r ? r.kgPerHead * g.count / 1000 * (localPrices[p.material] || p.price_per_tonne) : 0)
                }, 0)
                const totalAll = prices.reduce((s, x) => {
                  return s + groups.reduce((gs, g) => {
                    const r2 = (RATIONS[g.name] || []).find(r => r.material === x.material)
                    return gs + (r2 ? r2.kgPerHead * g.count / 1000 * (localPrices[x.material] || x.price_per_tonne) : 0)
                  }, 0)
                }, 0)
                const pct = totalAll > 0 ? Math.round(totalCostMat / totalAll * 100) : 0
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: MATERIAL_COLORS[p.material] || '#aab8c0', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#1a2530', flex: 1 }}>{p.material}</span>
                    <div style={{ width: 80, height: 4, background: '#f7f9f8', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: MATERIAL_COLORS[p.material] || '#aab8c0', width: `${pct}%` }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#aab8c0', width: 32 }}>{pct}%</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1a2530', width: 70, textAlign: 'right' }}>${Math.round(totalCostMat).toLocaleString()}</span>
                  </div>
                )
              })}
              <div style={{ height: 160, position: 'relative', marginTop: 16 }}>
                <Doughnut
                  data={{
                    labels: prices.map(p => p.material),
                    datasets: [{
                      data: prices.map(p => groups.reduce((s, g) => {
                        const r = (RATIONS[g.name] || []).find(x => x.material === p.material)
                        return s + (r ? r.kgPerHead * g.count / 1000 * (localPrices[p.material] || p.price_per_tonne) : 0)
                      }, 0)),
                      backgroundColor: prices.map(p => MATERIAL_COLORS[p.material] || '#aab8c0'),
                      borderWidth: 0,
                      hoverOffset: 4,
                    }],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 8, padding: 8 } } } }}
                />
              </div>
            </>
          ) : (
            <div style={{ color: '#8a9aaa', fontSize: 13 }}>Add feed prices and animal groups to see the breakdown.</div>
          )}
        </div>
      </div>

      {/* PROJECTIONS */}
      <div className="card">
        <div className="card-header"><div className="card-title">Monthly cost projections</div></div>
        <div className="grid-3" style={{ marginBottom: 0 }}>
          {[
            { label: 'This month',       val: Math.round(totalDaily * 30),       sub: 'At current rate' },
            { label: 'Next month est.',  val: Math.round(totalDaily * 30 * 1.05), sub: '+5% seasonal adj.' },
            { label: 'Annual projection',val: Math.round(totalDaily * 365 * 1.04),sub: '4% avg price increase' },
          ].map(p => (
            <div key={p.label} style={{ background: '#f7f9f8', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>{p.label}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: '#1a2530', letterSpacing: -0.5 }}>${p.val.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 4 }}>{p.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
