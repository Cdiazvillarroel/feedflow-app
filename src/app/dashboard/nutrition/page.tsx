'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'
import Link from 'next/link'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

interface FeedMill    { id: string; name: string }
interface Commodity   { id: string; name: string; category: string; price_per_tonne: number | null; stock_kg: number; min_stock_kg: number; feed_mill_id: string }
interface Formula     { id: string; name: string; animal_type: string; feed_mill_id: string; cost_per_tonne: number | null }
interface FormulaIng  { formula_id: string; commodity_id: string; inclusion_pct: number }
interface AnimalGroup { id: string; name: string; type: string; count: number; farm_id: string }
interface Feed        { id: string; name: string; material: string; kg_per_head_day: number; animal_type: string; farm_id: string }
interface Farm        { id: string; name: string; feed_mill_id: string | null }

const CATEGORY_COLORS: Record<string, string> = {
  grain: '#EF9F27', protein: '#4CAF7D', fat: '#E24B4A',
  fiber: '#9B59B6', mineral: '#4A90C4', vitamin: '#1ABC9C',
  additive: '#633806', other: '#8a9aaa',
}

const ANIMAL_ICONS: Record<string, string> = {
  cattle: '🐄', pig: '🐖', poultry: '🐔', sheep: '🐑', other: '🐾'
}

export default function NutritionOverviewPage() {
  const { selectedMillId } = useFarm()

  const [mills,        setMills]        = useState<FeedMill[]>([])
  const [commodities,  setCommodities]  = useState<Commodity[]>([])
  const [formulas,     setFormulas]     = useState<Formula[]>([])
  const [formulaIngs,  setFormulaIngs]  = useState<FormulaIng[]>([])
  const [animalGroups, setAnimalGroups] = useState<AnimalGroup[]>([])
  const [feeds,        setFeeds]        = useState<Feed[]>([])
  const [farms,        setFarms]        = useState<Farm[]>([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => { loadAll() }, [selectedMillId])

  async function loadAll() {
    setLoading(true)
    const [millsR, commR, formulasR, ingR, farmsR] = await Promise.all([
      supabase.from('feed_mills').select('id, name').order('name'),
      selectedMillId
        ? supabase.from('commodities').select('*').eq('feed_mill_id', selectedMillId).eq('active', true)
        : supabase.from('commodities').select('*').eq('active', true),
      selectedMillId
        ? supabase.from('feed_formulas').select('id, name, animal_type, feed_mill_id, cost_per_tonne').eq('feed_mill_id', selectedMillId).eq('active', true)
        : supabase.from('feed_formulas').select('id, name, animal_type, feed_mill_id, cost_per_tonne').eq('active', true),
      supabase.from('formula_ingredients').select('formula_id, commodity_id, inclusion_pct'),
      selectedMillId
        ? supabase.from('farms').select('id, name, feed_mill_id').eq('feed_mill_id', selectedMillId)
        : supabase.from('farms').select('id, name, feed_mill_id'),
    ])

    const farmList = farmsR.data || []
    setMills(millsR.data || [])
    setCommodities(commR.data || [])
    setFormulas(formulasR.data || [])
    setFormulaIngs(ingR.data || [])
    setFarms(farmList)

    const farmIds = farmList.map(f => f.id)
    if (farmIds.length > 0) {
      const [groupsR, feedsR] = await Promise.all([
        supabase.from('animal_groups').select('id, name, type, count, farm_id').in('farm_id', farmIds),
        supabase.from('feeds').select('id, name, material, kg_per_head_day, animal_type, farm_id').in('farm_id', farmIds).eq('active', true),
      ])
      setAnimalGroups(groupsR.data || [])
      setFeeds(feedsR.data || [])
    }
    setLoading(false)
  }

  const millName = (id: string) => mills.find(m => m.id === id)?.name || '—'

  // Stock alerts
  const lowStockItems = commodities.filter(c => c.stock_kg <= c.min_stock_kg)
  const criticalStock = commodities.filter(c => c.stock_kg <= c.min_stock_kg * 0.5)

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    commodities.forEach(c => { map[c.category] = (map[c.category] || 0) + 1 })
    return map
  }, [commodities])

  // Formula cost range
  const formulaCosts = formulas.filter(f => f.cost_per_tonne).map(f => f.cost_per_tonne!)
  const avgCost  = formulaCosts.length > 0 ? Math.round(formulaCosts.reduce((a, b) => a + b, 0) / formulaCosts.length) : 0
  const minCost  = formulaCosts.length > 0 ? Math.round(Math.min(...formulaCosts)) : 0
  const maxCost  = formulaCosts.length > 0 ? Math.round(Math.max(...formulaCosts)) : 0

  // Total animals
  const totalAnimals = animalGroups.reduce((s, g) => s + g.count, 0)

  // Animals by type
  const animalsByType = useMemo(() => {
    const map: Record<string, number> = {}
    animalGroups.forEach(g => { map[g.type] = (map[g.type] || 0) + g.count })
    return map
  }, [animalGroups])

  // Daily feed demand estimate
  const dailyFeedKg = useMemo(() => {
    return animalGroups.reduce((s, g) => {
      const groupFeeds = feeds.filter(f => f.animal_type === g.type && f.farm_id === g.farm_id)
      return s + groupFeeds.reduce((fs, f) => fs + f.kg_per_head_day * g.count, 0)
    }, 0)
  }, [animalGroups, feeds])

  // Top formulas by cost
  const topFormulas = [...formulas]
    .filter(f => f.cost_per_tonne)
    .sort((a, b) => (b.cost_per_tonne || 0) - (a.cost_per_tonne || 0))
    .slice(0, 5)

  // Doughnut data
  const catLabels = Object.keys(catBreakdown)
  const donutData = {
    labels: catLabels.map(c => c.charAt(0).toUpperCase() + c.slice(1)),
    datasets: [{
      data: catLabels.map(c => catBreakdown[c]),
      backgroundColor: catLabels.map(c => CATEGORY_COLORS[c] || '#aab8c0'),
      borderWidth: 0, hoverOffset: 4,
    }]
  }

  const QUICK_LINKS = [
    { href: '/dashboard/nutrition/library',           label: 'Commodity Library', icon: '🌾', desc: `${commodities.length} commodities · ${lowStockItems.length} low stock`,     color: '#4CAF7D' },
    { href: '/dashboard/nutrition/formulas',          label: 'Formula Manager',   icon: '🧪', desc: `${formulas.length} formulas · avg $${avgCost}/t`,                           color: '#4A90C4' },
    { href: '/dashboard/nutrition/forecast_nutrition',label: 'Demand Forecast',   icon: '📊', desc: `${(dailyFeedKg / 1000).toFixed(1)}t/day · ${farms.length} farms`,           color: '#EF9F27' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading Nutrition Manager...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Nutrition Manager</div>
          <div className="page-sub">
            {selectedMillId ? millName(selectedMillId) : 'All mills'} · Commodities · Formulas · Demand Forecast
          </div>
        </div>
        {criticalStock.length > 0 && (
          <div style={{ padding: '7px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#A32D2D' }}>
            ⚠ {criticalStock.length} critical stock alert{criticalStock.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Commodities</div><div className="sum-val">{commodities.length}</div><div className="sum-sub">{lowStockItems.length} low stock</div></div>
        <div className="sum-card"><div className="sum-label">Formulas</div><div className="sum-val" style={{ color: '#4A90C4' }}>{formulas.length}</div><div className="sum-sub">Avg ${avgCost}/tonne</div></div>
        <div className="sum-card"><div className="sum-label">Daily feed demand</div><div className="sum-val" style={{ color: '#EF9F27' }}>{(dailyFeedKg / 1000).toFixed(1)}t</div><div className="sum-sub">{farms.length} farms · {animalGroups.length} groups</div></div>
        <div className="sum-card"><div className="sum-label">Total animals</div><div className="sum-val green">{totalAnimals.toLocaleString()}</div><div className="sum-sub">Across all farms</div></div>
      </div>

      {/* QUICK LINKS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {QUICK_LINKS.map(link => (
          <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', border: '0.5px solid #e8ede9', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = link.color + '44' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = '#e8ede9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: link.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {link.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2530' }}>{link.label}</div>
                  <div style={{ fontSize: 11, color: '#8a9aaa', marginTop: 2 }}>{link.desc}</div>
                </div>
                <span style={{ fontSize: 16, color: link.color }}>→</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid-2">
        {/* COMMODITY BREAKDOWN */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Commodity breakdown by category</div></div>
          {catLabels.length > 0 ? (
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ height: 180, width: 180, flexShrink: 0 }}>
                <Doughnut data={donutData}
                  options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, cutout: '65%' }} />
              </div>
              <div style={{ flex: 1 }}>
                {catLabels.map(cat => {
                  const pct = Math.round(catBreakdown[cat] / commodities.length * 100)
                  return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[cat] || '#aab8c0', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#1a2530', flex: 1, textTransform: 'capitalize' }}>{cat}</span>
                      <div style={{ width: 60, height: 4, background: '#f0f4f0', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: CATEGORY_COLORS[cat] || '#aab8c0', borderRadius: 2, width: `${pct}%` }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#aab8c0', width: 24, textAlign: 'right' }}>{catBreakdown[cat]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ color: '#aab8c0', fontSize: 13, padding: '20px 0' }}>No commodities yet.</div>
          )}
        </div>

        {/* FORMULA COST RANKING */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Formula cost ranking</div>
            <span style={{ fontSize: 11, color: '#aab8c0' }}>${minCost} – ${maxCost}/t range</span>
          </div>
          {topFormulas.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topFormulas.map(f => {
                const pct = maxCost > 0 ? Math.round((f.cost_per_tonne! / maxCost) * 100) : 0
                return (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{ANIMAL_ICONS[f.animal_type] || '🐾'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1a2530', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div style={{ height: 5, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#4A90C4', borderRadius: 3, width: `${pct}%` }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2530', flexShrink: 0, minWidth: 60, textAlign: 'right' }}>${f.cost_per_tonne}/t</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ color: '#aab8c0', fontSize: 13, padding: '20px 0' }}>No formulas yet.</div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16 }} />

      <div className="grid-2">
        {/* STOCK ALERTS */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Stock alerts</div>
            <Link href="/dashboard/nutrition/library" style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>
          </div>
          {lowStockItems.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', color: '#27500A' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>All commodities above minimum stock</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lowStockItems.slice(0, 6).map(c => {
                const pct = c.min_stock_kg > 0 ? Math.round(c.stock_kg / c.min_stock_kg * 100) : 100
                const isCrit = c.stock_kg <= c.min_stock_kg * 0.5
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: isCrit ? '#FCEBEB' : '#FAEEDA', border: `0.5px solid ${isCrit ? '#F09595' : '#EF9F27'}44` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', marginBottom: 3 }}>{c.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: isCrit ? '#E24B4A' : '#EF9F27', borderRadius: 2, width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: isCrit ? '#A32D2D' : '#633806', fontWeight: 600, flexShrink: 0 }}>{pct}% of min</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isCrit ? '#A32D2D' : '#633806' }}>{(c.stock_kg / 1000).toFixed(1)}t</div>
                      <div style={{ fontSize: 10, color: '#aab8c0' }}>min {(c.min_stock_kg / 1000).toFixed(1)}t</div>
                    </div>
                  </div>
                )
              })}
              {lowStockItems.length > 6 && (
                <div style={{ fontSize: 12, color: '#aab8c0', textAlign: 'center', padding: '4px 0' }}>+{lowStockItems.length - 6} more</div>
              )}
            </div>
          )}
        </div>

        {/* ANIMAL GROUPS SUMMARY */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Animals by type</div>
            <span style={{ fontSize: 11, color: '#aab8c0' }}>{totalAnimals.toLocaleString()} total</span>
          </div>
          {Object.keys(animalsByType).length === 0 ? (
            <div style={{ color: '#aab8c0', fontSize: 13, padding: '20px 0' }}>No animal groups found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(animalsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const pct = totalAnimals > 0 ? Math.round(count / totalAnimals * 100) : 0
                const groups = animalGroups.filter(g => g.type === type).length
                return (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{ANIMAL_ICONS[type] || '🐾'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2530', textTransform: 'capitalize' }}>{type}</span>
                        <span style={{ fontSize: 12, color: '#8a9aaa' }}>{count.toLocaleString()} · {groups} groups</span>
                      </div>
                      <div style={{ height: 6, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#4CAF7D', borderRadius: 3, width: `${pct}%` }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2530', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
