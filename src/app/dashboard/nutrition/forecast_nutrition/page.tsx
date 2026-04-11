'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'
import { Bar, Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Tooltip, Legend)

interface FeedMill        { id: string; name: string }
interface Commodity       { id: string; name: string; category: string; price_per_tonne: number | null; stock_kg: number; min_stock_kg: number }
interface Formula         { id: string; name: string; animal_type: string; feed_mill_id: string; cost_per_tonne: number | null }
interface FormulaIng      { formula_id: string; commodity_id: string; inclusion_pct: number; kg_per_tonne: number }
interface AnimalGroup     { id: string; name: string; type: string; count: number; farm_id: string }
interface AnimalGroupFeed { animal_group_id: string; feed_id: string }
interface Feed            { id: string; name: string; material: string; kg_per_head_day: number; animal_type: string; farm_id: string }
interface Farm            { id: string; name: string; feed_mill_id: string | null }

const CATEGORY_COLORS: Record<string, string> = {
  grain: '#EF9F27', protein: '#4CAF7D', fat: '#E24B4A',
  fiber: '#9B59B6', mineral: '#4A90C4', vitamin: '#1ABC9C',
  additive: '#633806', other: '#8a9aaa',
}

export default function DemandForecastPage() {
  const { selectedMillId } = useFarm()

  const [mills,        setMills]        = useState<FeedMill[]>([])
  const [commodities,  setCommodities]  = useState<Commodity[]>([])
  const [formulas,     setFormulas]     = useState<Formula[]>([])
  const [formulaIngs,  setFormulaIngs]  = useState<FormulaIng[]>([])
  const [animalGroups, setAnimalGroups] = useState<AnimalGroup[]>([])
  const [groupFeeds,   setGroupFeeds]   = useState<AnimalGroupFeed[]>([])
  const [feeds,        setFeeds]        = useState<Feed[]>([])
  const [farms,        setFarms]        = useState<Farm[]>([])
  const [loading,      setLoading]      = useState(true)
  const [horizon,      setHorizon]      = useState(30)
  const [selected,     setSelected]     = useState<string | null>(null) // commodity id
  const [filterCat,    setFilterCat]    = useState('all')

  useEffect(() => { loadAll() }, [selectedMillId])

  async function loadAll() {
    setLoading(true)
    const [millsR, commR, formulasR, ingR, farmsR] = await Promise.all([
      supabase.from('feed_mills').select('id, name').order('name'),
      selectedMillId
        ? supabase.from('commodities').select('id, name, category, price_per_tonne, stock_kg, min_stock_kg').eq('feed_mill_id', selectedMillId).eq('active', true).order('name')
        : supabase.from('commodities').select('id, name, category, price_per_tonne, stock_kg, min_stock_kg').eq('active', true).order('name'),
      selectedMillId
        ? supabase.from('feed_formulas').select('id, name, animal_type, feed_mill_id, cost_per_tonne').eq('feed_mill_id', selectedMillId).eq('active', true)
        : supabase.from('feed_formulas').select('id, name, animal_type, feed_mill_id, cost_per_tonne').eq('active', true),
      supabase.from('formula_ingredients').select('formula_id, commodity_id, inclusion_pct, kg_per_tonne'),
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
      const [groupsR, feedsR, agfR] = await Promise.all([
        supabase.from('animal_groups').select('id, name, type, count, farm_id').in('farm_id', farmIds),
        supabase.from('feeds').select('id, name, material, kg_per_head_day, animal_type, farm_id').in('farm_id', farmIds).eq('active', true),
        supabase.from('animal_group_feeds').select('animal_group_id, feed_id'),
      ])
      setAnimalGroups(groupsR.data || [])
      setFeeds(feedsR.data || [])
      setGroupFeeds(agfR.data || [])
    }

    setLoading(false)
  }

  // Calculate daily kg demand per commodity
  const commodityDemand = useMemo(() => {
    const demand: Record<string, number> = {} // commodity_id → kg/day

    animalGroups.forEach(group => {
      // Get feeds assigned to this group
      const assignedFeedIds = groupFeeds
        .filter(gf => gf.animal_group_id === group.id)
        .map(gf => gf.feed_id)

      const groupFeedsData = assignedFeedIds.length > 0
        ? feeds.filter(f => assignedFeedIds.includes(f.id))
        : feeds.filter(f => f.animal_type === group.type && f.farm_id === group.farm_id)

      groupFeedsData.forEach(feed => {
        // Find formula matching this feed material
        const farmData  = farms.find(f => f.id === group.farm_id)
        const millId    = farmData?.feed_mill_id
        const formula   = formulas.find(f =>
          f.animal_type === group.type &&
          f.feed_mill_id === millId
        )
        if (!formula) return

        // Daily kg of this feed consumed
        const dailyKg = feed.kg_per_head_day * group.count

        // Distribute across formula ingredients
        const ings = formulaIngs.filter(i => i.formula_id === formula.id)
        ings.forEach(ing => {
          if (!demand[ing.commodity_id]) demand[ing.commodity_id] = 0
          demand[ing.commodity_id] += dailyKg * (ing.inclusion_pct / 100)
        })
      })
    })

    return demand
  }, [animalGroups, groupFeeds, feeds, formulas, formulaIngs, farms])

  // Build commodity rows with forecast data
  const commodityRows = useMemo(() => {
    return commodities.map(c => {
      const dailyKg    = commodityDemand[c.id] || 0
      const totalKg    = dailyKg * horizon
      const stockDays  = dailyKg > 0 ? Math.floor(c.stock_kg / dailyKg) : 999
      const needsOrder = c.stock_kg - totalKg < c.min_stock_kg
      const orderQty   = needsOrder ? Math.max(0, totalKg + c.min_stock_kg - c.stock_kg) : 0
      const orderCost  = orderQty / 1000 * (c.price_per_tonne || 0)
      const urgency    = stockDays <= 7 ? 'critical' : stockDays <= 14 ? 'low' : 'ok'
      return { ...c, dailyKg, totalKg, stockDays, needsOrder, orderQty, orderCost, urgency }
    }).filter(c => c.dailyKg > 0 || filterCat !== 'all')
  }, [commodities, commodityDemand, horizon, filterCat])

  const filtered = commodityRows
    .filter(c => filterCat === 'all' || c.category === filterCat)
    .filter(c => c.dailyKg > 0)
    .sort((a, b) => a.stockDays - b.stockDays)

  // Total demand & cost
  const totalDailyKg   = Object.values(commodityDemand).reduce((s, v) => s + v, 0)
  const totalOrderCost = filtered.reduce((s, c) => s + c.orderCost, 0)
  const criticalCount  = filtered.filter(c => c.urgency === 'critical').length
  const needsOrderCount = filtered.filter(c => c.needsOrder).length

  // Chart data — top 8 commodities by demand
  const top8 = [...filtered].sort((a, b) => b.dailyKg - a.dailyKg).slice(0, 8)

  const barData = {
    labels: top8.map(c => c.name),
    datasets: [{
      label: `Demand over ${horizon} days (t)`,
      data: top8.map(c => Math.round(c.totalKg / 10) / 100),
      backgroundColor: top8.map(c => CATEGORY_COLORS[c.category] || '#aab8c0'),
      borderRadius: 4,
    }]
  }

  // Projection line — cumulative consumption vs stock for selected commodity
  const selectedCommodity  = commodities.find(c => c.id === selected)
  const selectedRow        = commodityRows.find(c => c.id === selected)
  const projectionData = useMemo(() => {
    if (!selectedRow) return null
    const labels: string[] = []
    const stock:  number[] = []
    const demand: number[] = []
    const now = new Date()
    let currentStock = selectedRow.stock_kg
    for (let i = 0; i <= horizon; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i)
      labels.push(i === 0 ? 'Today' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }))
      currentStock = Math.max(0, currentStock - selectedRow.dailyKg)
      stock.push(Math.round(currentStock))
      demand.push(Math.round(selectedRow.dailyKg * i))
    }
    return { labels, stock, demand }
  }, [selectedRow, horizon])

  const millName  = (id: string) => mills.find(m => m.id === id)?.name || '—'
  const urgencyStyle = (u: string) =>
    u === 'critical' ? { bg: '#FCEBEB', color: '#A32D2D', label: 'Critical' } :
    u === 'low'      ? { bg: '#FAEEDA', color: '#633806', label: 'Low'      } :
                       { bg: '#eaf5ee', color: '#27500A', label: 'OK'       }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading demand forecast...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Demand Forecast</div>
          <div className="page-sub">
            {selectedMillId ? millName(selectedMillId) : 'All mills'} · Ingredient requirements · {farms.length} farms · {animalGroups.length} animal groups
          </div>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', gap: 0, background: '#f0f4f0', borderRadius: 8, padding: 3 }}>
            {[7, 14, 30, 60].map(h => (
              <button key={h} onClick={() => setHorizon(h)}
                style={{ padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: horizon === h ? '#1a2530' : 'transparent', color: horizon === h ? '#fff' : '#6a7a8a', transition: 'all 0.15s' }}>
                {h}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        <div className="sum-card">
          <div className="sum-label">Total demand</div>
          <div className="sum-val">{(totalDailyKg * horizon / 1000).toFixed(1)} t</div>
          <div className="sum-sub">Over {horizon} days · {(totalDailyKg / 1000).toFixed(1)}t/day</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Critical stock</div>
          <div className="sum-val red">{criticalCount}</div>
          <div className="sum-sub">Commodities ≤ 7 days</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Orders needed</div>
          <div className="sum-val" style={{ color: '#633806' }}>{needsOrderCount}</div>
          <div className="sum-sub">To cover {horizon}-day demand</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Est. order value</div>
          <div className="sum-val" style={{ color: '#4A90C4' }}>${Math.round(totalOrderCost).toLocaleString()}</div>
          <div className="sum-sub">AUD to replenish stock</div>
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Top commodity demand — {horizon} days</div>
            <span style={{ fontSize: 11, color: '#aab8c0' }}>Tonnes required</span>
          </div>
          {top8.length > 0 ? (
            <div style={{ height: 220, position: 'relative' }}>
              <Bar data={barData}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#aab8c0', maxRotation: 30 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => v + 't' }, border: { display: false } } } }} />
            </div>
          ) : (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aab8c0', fontSize: 13 }}>No demand data available.</div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">
              {selectedCommodity ? `${selectedCommodity.name} — stock projection` : 'Select a commodity to see projection'}
            </div>
            {selectedCommodity && <span style={{ fontSize: 11, color: '#aab8c0' }}>Stock depletion over {horizon} days</span>}
          </div>
          {projectionData ? (
            <div style={{ height: 220, position: 'relative' }}>
              <Line
                data={{
                  labels: projectionData.labels.filter((_, i) => i % Math.ceil(horizon / 10) === 0 || i === horizon),
                  datasets: [
                    {
                      label: 'Stock remaining (kg)',
                      data: projectionData.stock.filter((_, i) => i % Math.ceil(horizon / 10) === 0 || i === horizon),
                      borderColor: selectedRow?.urgency === 'critical' ? '#E24B4A' : '#4CAF7D',
                      backgroundColor: selectedRow?.urgency === 'critical' ? 'rgba(226,75,74,0.08)' : 'rgba(76,175,125,0.08)',
                      borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3,
                    },
                  ]
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxRotation: 0 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => v >= 1000 ? (v/1000).toFixed(1)+'t' : v+'kg' }, border: { display: false } } } }}
              />
            </div>
          ) : (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aab8c0', fontSize: 13, flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 24 }}>📈</div>
              Click a commodity below to see its stock projection
            </div>
          )}
        </div>
      </div>

      {/* FILTER */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'grain', 'protein', 'fat', 'fiber', 'mineral', 'vitamin', 'additive'].map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', borderColor: filterCat === cat ? '#1a2530' : '#e8ede9', background: filterCat === cat ? '#1a2530' : '#fff', color: filterCat === cat ? '#fff' : '#6a7a8a' }}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* COMMODITY DEMAND TABLE */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No demand data</div>
          <div style={{ fontSize: 13 }}>Assign formulas to animal groups to generate demand forecasts.</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f9f8' }}>
                {['Commodity', 'Category', 'Daily demand', `${horizon}-day total`, 'Current stock', 'Days left', 'Order needed', 'Order cost', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 600, padding: '12px 14px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #e8ede9', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const urg    = urgencyStyle(c.urgency)
                const isSelected = selected === c.id
                const catColor   = CATEGORY_COLORS[c.category] || '#aab8c0'
                return (
                  <tr key={c.id} onClick={() => setSelected(isSelected ? null : c.id)}
                    style={{ cursor: 'pointer', borderBottom: '0.5px solid #f0f4f0', background: isSelected ? '#f4fbf7' : '#fff' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f7f9f8' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#fff' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{c.name}</div>
                      {c.price_per_tonne && <div style={{ fontSize: 11, color: '#aab8c0' }}>${c.price_per_tonne}/t</div>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: catColor + '22', color: catColor, fontWeight: 700, textTransform: 'capitalize' }}>{c.category}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#1a2530' }}>
                      {c.dailyKg >= 1000 ? (c.dailyKg / 1000).toFixed(2) + 't' : Math.round(c.dailyKg) + 'kg'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1a2530' }}>
                      {c.totalKg >= 1000 ? (c.totalKg / 1000).toFixed(1) + 't' : Math.round(c.totalKg) + 'kg'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c.stock_kg <= c.min_stock_kg ? '#A32D2D' : '#1a2530' }}>
                        {c.stock_kg >= 1000 ? (c.stock_kg / 1000).toFixed(1) + 't' : c.stock_kg + 'kg'}
                      </div>
                      <div style={{ width: 60, height: 4, background: '#f0f4f0', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                        <div style={{ height: '100%', background: c.urgency === 'critical' ? '#E24B4A' : c.urgency === 'low' ? '#EF9F27' : '#4CAF7D', borderRadius: 2, width: `${Math.min(c.min_stock_kg > 0 ? (c.stock_kg / (c.totalKg + c.min_stock_kg)) * 100 : 100, 100)}%` }} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c.stockDays <= 7 ? '#A32D2D' : c.stockDays <= 14 ? '#633806' : '#27500A' }}>
                        {c.stockDays >= 999 ? '∞' : c.stockDays + 'd'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: c.needsOrder ? '#A32D2D' : '#aab8c0' }}>
                      {c.needsOrder ? (c.orderQty >= 1000 ? (c.orderQty / 1000).toFixed(1) + 't' : Math.round(c.orderQty) + 'kg') : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: c.needsOrder ? 700 : 400, color: c.needsOrder ? '#27500A' : '#aab8c0' }}>
                      {c.needsOrder ? '$' + Math.round(c.orderCost).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: urg.bg, color: urg.color }}>
                        {urg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* FOOTER TOTALS */}
          <div style={{ padding: '12px 14px', background: '#f7f9f8', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 24, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Totals</span>
            <span style={{ fontSize: 12, color: '#6a7a8a' }}>Daily: <strong>{(totalDailyKg / 1000).toFixed(1)}t</strong></span>
            <span style={{ fontSize: 12, color: '#6a7a8a' }}>{horizon}-day: <strong>{(totalDailyKg * horizon / 1000).toFixed(1)}t</strong></span>
            <span style={{ fontSize: 12, color: needsOrderCount > 0 ? '#A32D2D' : '#8a9aaa' }}>Orders needed: <strong>{needsOrderCount} commodities</strong></span>
            <span style={{ fontSize: 12, color: '#27500A', marginLeft: 'auto', fontWeight: 700 }}>Est. order total: ${Math.round(totalOrderCost).toLocaleString()} AUD</span>
          </div>
        </div>
      )}
    </>
  )
}
