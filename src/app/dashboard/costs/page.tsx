'use client'
import { useEffect, useState } from 'react'
import { getFeedPrices, getAnimalGroups, updateFeedPrice, updateAnimalCount, getActiveFarmId } from '@/lib/queries'
import type { FeedPrice, AnimalGroup } from '@/lib/types'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

// Rations per animal group name — keys match Supabase animal_groups.name
// Covers both the demo data groups and generic fallbacks
const RATIONS: Record<string, { material: string; kgPerHead: number }[]> = {
  // Demo pig farm groups
  'Sows lactating':  [{ material: 'Lactation diet', kgPerHead: 6.5 }],
  'Sows gestating':  [{ material: 'Gestation diet', kgPerHead: 2.5 }],
  'Gilt developers': [{ material: 'Gestation diet', kgPerHead: 2.0 }],
  // Generic fallbacks
  'Lactating sows':  [{ material: 'Lactation diet', kgPerHead: 6.5 }],
  'Gestating sows':  [{ material: 'Gestation diet', kgPerHead: 2.5 }],
  'Grower pigs':     [{ material: 'Lactation diet', kgPerHead: 2.4 }],
  'Sow herd':        [{ material: 'Lactation diet', kgPerHead: 5.5 }],
  'Weaners':         [{ material: 'Lactation diet', kgPerHead: 0.4 }],
  'Broilers':        [{ material: 'Wheat bran',     kgPerHead: 0.18 }],
  'Beef cattle':     [{ material: 'Barley',         kgPerHead: 8.2 }],
}

const MATERIAL_COLORS: Record<string, string> = {
  'Lactation diet': '#4CAF7D',
  'Gestation diet': '#4A90C4',
  'Maize meal':     '#4CAF7D',
  'Wheat bran':     '#4A90C4',
  'Soybean meal':   '#EF9F27',
  'Barley':         '#E24B4A',
}

function getRations(groupName: string) {
  return RATIONS[groupName] || [{ material: 'Lactation diet', kgPerHead: 3.0 }]
}

export default function CostsPage() {
  const [prices,      setPrices]      = useState<FeedPrice[]>([])
  const [groups,      setGroups]      = useState<AnimalGroup[]>([])
  const [localPrices, setLocalPrices] = useState<Record<string, number>>({})
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [savedMsg,    setSavedMsg]    = useState('')

  useEffect(() => {
    Promise.all([getFeedPrices(), getAnimalGroups()]).then(([p, g]) => {
      setPrices(p)
      setGroups(g)
      setLocalPrices(Object.fromEntries(p.map(x => [x.material, x.price_per_tonne])))
      setLoading(false)
    })
  }, [])

  async function savePrice(material: string, price: number) {
    setSaving(true)
    const farmId = getActiveFarmId()
    await updateFeedPrice(farmId, material, price)
    setSaving(false)
    setSavedMsg('Saved')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  async function saveCount(groupId: string, count: number) {
    await updateAnimalCount(groupId, count)
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, count } : g))
  }

  function groupDailyFeed(g: AnimalGroup): number {
    return getRations(g.name).reduce((s, r) => s + r.kgPerHead * g.count, 0)
  }

  function groupDailyCost(g: AnimalGroup): number {
    return getRations(g.name).reduce((s, r) => {
      const price = localPrices[r.material] ?? prices.find(p => p.material === r.material)?.price_per_tonne ?? 520
      return s + r.kgPerHead * g.count / 1000 * price
    }, 0)
  }

  const totalDaily   = groups.reduce((s, g) => s + groupDailyCost(g), 0)
  const totalAnimals = groups.reduce((s, g) => s + g.count, 0)
  const maxCost      = Math.max(...groups.map(g => groupDailyCost(g)), 1)

  const barColor = (cpp: number) =>
    cpp > 2.0 ? '#E24B4A' : cpp > 1.0 ? '#EF9F27' : '#4CAF7D'

  // Cost by material for donut
  const materialCosts: Record<string, number> = {}
  groups.forEach(g => {
    getRations(g.name).forEach(r => {
      const price = localPrices[r.material] ?? prices.find(p => p.material === r.material)?.price_per_tonne ?? 520
      const cost = r.kgPerHead * g.count / 1000 * price
      materialCosts[r.material] = (materialCosts[r.material] || 0) + cost
    })
  })
  const donutMaterials = Object.keys(materialCosts).filter(m => materialCosts[m] > 0)
  const totalMatCost   = Object.values(materialCosts).reduce((s, v) => s + v, 0)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
          Loading feed costs...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Feed costs</div>
          <div className="page-sub">Cost per animal · Daily spend · Monthly projection</div>
        </div>
        <div className="page-actions">
          <button className="btn-outline">Export CSV</button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        <div className="sum-card">
          <div className="sum-label">Monthly spend</div>
          <div className="sum-val">${Math.round(totalDaily * 30).toLocaleString()}</div>
          <div className="sum-sub">At current rate</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Daily spend</div>
          <div className="sum-val">${Math.round(totalDaily).toLocaleString()}</div>
          <div className="sum-sub">All groups</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Cost / animal / day</div>
          <div className="sum-val green">${totalAnimals > 0 ? (totalDaily / totalAnimals).toFixed(2) : '0.00'}</div>
          <div className="sum-sub">{totalAnimals.toLocaleString()} animals</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Annual projection</div>
          <div className="sum-val">${Math.round(totalDaily * 365 / 1000)}k</div>
          <div className="sum-sub">At current prices</div>
        </div>
      </div>

      {/* AI INSIGHT */}
      <div style={{ background: '#1a2530', borderRadius: 10, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(76,175,125,0.15)', border: '0.5px solid rgba(76,175,125,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 2 }}>
            ${totalAnimals > 0 ? (totalDaily / totalAnimals).toFixed(2) : '0.00'} per animal per day
            {totalAnimals > 0 && (totalDaily / totalAnimals) < 3 ? ' — within normal range for sow herd' : ''}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            Total: ${Math.round(totalDaily).toLocaleString()}/day · Edit prices or animal counts to recalculate
          </div>
        </div>
        <span style={{ background: 'rgba(76,175,125,0.18)', border: '0.5px solid rgba(76,175,125,0.3)', color: '#4CAF7D', fontSize: 10, padding: '2px 10px', borderRadius: 10, flexShrink: 0 }}>
          {saving ? 'Saving...' : savedMsg || 'Live calculation'}
        </span>
      </div>

      {/* FEED PRICES */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Feed prices — edit to update all calculations</div>
          <span style={{ fontSize: 11, color: savedMsg ? '#27500A' : '#aab8c0', fontWeight: savedMsg ? 600 : 400, transition: 'color 0.3s' }}>
            {savedMsg ? '✓ Saved to Supabase' : 'Saved on blur'}
          </span>
        </div>
        {prices.length === 0 ? (
          <div style={{ color: '#8a9aaa', fontSize: 13 }}>No feed prices found. Check Supabase → feed_prices table.</div>
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
                  <input
                    type="number"
                    value={localPrices[p.material] ?? p.price_per_tonne}
                    onChange={e => setLocalPrices(prev => ({ ...prev, [p.material]: Number(e.target.value) }))}
                    onBlur={e => savePrice(p.material, Number(e.target.value))}
                    step={5}
                    style={{ border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '5px 8px', fontSize: 14, fontWeight: 600, color: '#1a2530', background: '#fff', width: 80, fontFamily: 'inherit' }}
                  />
                  <span style={{ fontSize: 11, color: '#aab8c0' }}>/t</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ANIMAL TABLE + DONUT */}
      <div className="grid-2">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Cost per group</div>
            <span style={{ fontSize: 11, color: '#aab8c0' }}>Edit counts to recalculate</span>
          </div>
          {groups.length === 0 ? (
            <div style={{ color: '#8a9aaa', fontSize: 13 }}>No animal groups found in Supabase.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Group', 'Count', 'Feed/day', '$/head/day', 'Daily cost', '30 days'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 10, color: '#aab8c0', fontWeight: 600, padding: '0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
                  ))}
                </tr>
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
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{g.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                        <input
                          type="number"
                          defaultValue={g.count}
                          onBlur={e => saveCount(g.id, Number(e.target.value))}
                          step={10}
                          style={{ border: '0.5px solid #e8ede9', borderRadius: 4, padding: '4px 8px', fontSize: 12, color: '#1a2530', background: '#f7f9f8', width: 68, fontFamily: 'inherit', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>
                        {Math.round(feed).toLocaleString()} kg
                      </td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, fontWeight: 600, color: '#27500A' }}>
                        ${cpp.toFixed(3)}
                      </td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', minWidth: 56 }}>${Math.round(cost).toLocaleString()}</span>
                          <div style={{ flex: 1, height: 4, background: '#f0f4f0', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, background: barColor(cpp), width: `${Math.round(cost / maxCost * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, fontWeight: 600, color: '#27500A' }}>
                        ${Math.round(cost * 30).toLocaleString()}
                      </td>
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
                  data={{
                    labels: donutMaterials,
                    datasets: [{
                      data: donutMaterials.map(m => Math.round(materialCosts[m])),
                      backgroundColor: donutMaterials.map(m => MATERIAL_COLORS[m] || '#aab8c0'),
                      borderWidth: 0,
                      hoverOffset: 4,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 10, padding: 10 } },
                      tooltip: { callbacks: { label: (ctx) => ` $${ctx.parsed.toLocaleString()}/day` } },
                    },
                  }}
                />
              </div>
              {donutMaterials.map(m => {
                const pct = totalMatCost > 0 ? Math.round(materialCosts[m] / totalMatCost * 100) : 0
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

      {/* PROJECTIONS */}
      <div className="card">
        <div className="card-header"><div className="card-title">Cost projections</div></div>
        <div className="grid-3" style={{ marginBottom: 0 }}>
          {[
            { label: 'This month',        val: Math.round(totalDaily * 30),        sub: 'At current rate' },
            { label: 'Next month est.',   val: Math.round(totalDaily * 30 * 1.05), sub: '+5% seasonal adjustment' },
            { label: 'Annual projection', val: Math.round(totalDaily * 365),       sub: 'At flat current rate' },
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
