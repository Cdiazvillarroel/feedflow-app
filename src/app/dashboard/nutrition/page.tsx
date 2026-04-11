'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'
import Link from 'next/link'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

interface FeedMill    { id: string; name: string }
interface Commodity   { id: string; name: string; category: string; price_per_tonne: number | null; stock_kg: number; min_stock_kg: number; feed_mill_id: string }
interface Formula     { id: string; name: string; animal_type: string; feed_mill_id: string; cost_per_tonne: number | null }
interface FormulaIng  { formula_id: string; commodity_id: string; inclusion_pct: number }
interface AnimalGroup { id: string; name: string; type: string; count: number; farm_id: string }
interface Feed        { id: string; name: string; material: string; kg_per_head_day: number; animal_type: string; farm_id: string }
interface Farm        { id: string; name: string; feed_mill_id: string | null }
interface GroupFeed   { animal_group_id: string; feed_id: string }

interface AIInsightResult {
  summary: string
  critical_actions: string[]
  opportunities: string[]
  forecast_note: string
}

const ANIMAL_ICONS: Record<string, string> = {
  cattle: '🐄', pig: '🐖', poultry: '🐔', sheep: '🐑', other: '🐾'
}

const BAR_COLORS = ['#4CAF7D','#4A90C4','#EF9F27','#E24B4A','#9B59B6','#1ABC9C','#633806','#aab8c0']

export default function NutritionOverviewPage() {
  const { selectedMillId } = useFarm()

  const [mills,           setMills]           = useState<FeedMill[]>([])
  const [commodities,     setCommodities]     = useState<Commodity[]>([])
  const [formulas,        setFormulas]        = useState<Formula[]>([])
  const [formulaIngs,     setFormulaIngs]     = useState<FormulaIng[]>([])
  const [animalGroups,    setAnimalGroups]    = useState<AnimalGroup[]>([])
  const [feeds,           setFeeds]           = useState<Feed[]>([])
  const [farms,           setFarms]           = useState<Farm[]>([])
  const [groupFeeds,      setGroupFeeds]      = useState<GroupFeed[]>([])
  const [loading,         setLoading]         = useState(true)
  const [aiInsight,       setAiInsight]       = useState<AIInsightResult | null>(null)
  const [aiLoading,       setAiLoading]       = useState(false)
  const [aiError,         setAiError]         = useState('')
  const [forecastHorizon, setForecastHorizon] = useState(14)

  useEffect(() => { loadAll() }, [selectedMillId])

  async function loadAll() {
    setLoading(true)
    setAiInsight(null)

    const [millsR, commR, formulasR, ingR, farmsR] = await Promise.all([
      supabase.from('feed_mills').select('id, name').order('name'),
      selectedMillId
        ? supabase.from('commodities').select('*').eq('feed_mill_id', selectedMillId).eq('active', true)
        : supabase.from('commodities').select('*').eq('active', true),
      selectedMillId
        ? supabase.from('feed_formulas').select('id, name, animal_type, feed_mill_id, cost_per_tonne').eq('feed_mill_id', selectedMillId).eq('active', true)
        : supabase.from('feed_formulas').select('id, name, animal_type, feed_mill_id, cost_per_tonne').eq('active', true),
      supabase.from('formula_ingredients').select('formula_id, commodity_id, inclusion_pct'),
      supabase.from('farms').select('id, name, feed_mill_id'),
    ])

    const farmList = farmsR.data || []
    setMills(millsR.data || [])
    setCommodities(commR.data || [])
    setFormulas(formulasR.data || [])
    setFormulaIngs(ingR.data || [])
    setFarms(farmList)

    const relevantFarmIds = selectedMillId
      ? farmList.filter(f => f.feed_mill_id === selectedMillId).map(f => f.id)
      : farmList.map(f => f.id)

    if (relevantFarmIds.length > 0) {
      const [groupsR, feedsR, agfR] = await Promise.all([
        supabase.from('animal_groups').select('id, name, type, count, farm_id').in('farm_id', relevantFarmIds),
        supabase.from('feeds').select('id, name, material, kg_per_head_day, animal_type, farm_id').in('farm_id', relevantFarmIds).eq('active', true),
        supabase.from('animal_group_feeds').select('animal_group_id, feed_id'),
      ])
      setAnimalGroups(groupsR.data || [])
      setFeeds(feedsR.data || [])
      setGroupFeeds(agfR.data || [])
    } else {
      setAnimalGroups([])
      setFeeds([])
      setGroupFeeds([])
    }
    setLoading(false)
  }

  const millName = (id: string) => mills.find(m => m.id === id)?.name || '—'

  const lowStockItems = commodities.filter(c => c.stock_kg <= c.min_stock_kg)
  const criticalStock = commodities.filter(c => c.stock_kg <= c.min_stock_kg * 0.5)
  const okStock       = commodities.filter(c => c.stock_kg > c.min_stock_kg)

  const formulaCosts = formulas.filter(f => f.cost_per_tonne).map(f => f.cost_per_tonne!)
  const avgCost = formulaCosts.length > 0 ? Math.round(formulaCosts.reduce((a, b) => a + b, 0) / formulaCosts.length) : 0
  const minCost = formulaCosts.length > 0 ? Math.round(Math.min(...formulaCosts)) : 0
  const maxCost = formulaCosts.length > 0 ? Math.round(Math.max(...formulaCosts)) : 0

  const totalAnimals = animalGroups.reduce((s, g) => s + g.count, 0)

  const animalsByType = useMemo(() => {
    const map: Record<string, number> = {}
    animalGroups.forEach(g => { map[g.type] = (map[g.type] || 0) + g.count })
    return map
  }, [animalGroups])

  const dailyFeedKg = useMemo(() => {
    return animalGroups.reduce((s, g) => {
      const assignedFeedIds = groupFeeds.filter(gf => gf.animal_group_id === g.id).map(gf => gf.feed_id)
      const groupFeedList   = assignedFeedIds.length > 0
        ? feeds.filter(f => assignedFeedIds.includes(f.id))
        : feeds.filter(f => f.animal_type === g.type && f.farm_id === g.farm_id)
      return s + groupFeedList.reduce((fs, f) => fs + f.kg_per_head_day * g.count, 0)
    }, 0)
  }, [animalGroups, feeds, groupFeeds])

  const formulaDemand = useMemo(() => {
    return formulas.map(f => {
      const millFarms   = farms.filter(fa => fa.feed_mill_id === f.feed_mill_id)
      const millFarmIds = millFarms.map(fa => fa.id)

      // All animal groups of this type across ALL farms of this mill
      const matchingGroups = animalGroups.filter(g =>
        g.type === f.animal_type && millFarmIds.includes(g.farm_id)
      )
      if (matchingGroups.length === 0) return { ...f, dailyKg: 0, totalKg: 0, totalCost: 0 }

      // Global avg kg/head/day across ALL feeds of this type in this mill
      const allMillFeeds = feeds.filter(feed =>
        feed.animal_type === f.animal_type && millFarmIds.includes(feed.farm_id)
      )
      const globalAvgKgPerHead = allMillFeeds.length > 0
        ? allMillFeeds.reduce((s, feed) => s + feed.kg_per_head_day, 0) / allMillFeeds.length
        : 0

      if (globalAvgKgPerHead === 0) return { ...f, dailyKg: 0, totalKg: 0, totalCost: 0 }

      const dailyKg = matchingGroups.reduce((total, group) => {
        // Priority 1: assigned feeds via animal_group_feeds
        const assignedFeedIds = groupFeeds
          .filter(gf => gf.animal_group_id === group.id)
          .map(gf => gf.feed_id)

        let kgPerHead = 0
        if (assignedFeedIds.length > 0) {
          const assignedFeeds = feeds.filter(feed => assignedFeedIds.includes(feed.id))
          kgPerHead = assignedFeeds.reduce((s, feed) => s + feed.kg_per_head_day, 0)
        } else {
          // Priority 2: feeds of same type in same farm
          const farmFeeds = feeds.filter(feed =>
            feed.farm_id === group.farm_id && feed.animal_type === group.type
          )
          kgPerHead = farmFeeds.length > 0
            ? farmFeeds.reduce((s, feed) => s + feed.kg_per_head_day, 0) / farmFeeds.length
            : globalAvgKgPerHead // Priority 3: mill-wide average
        }

        return total + kgPerHead * group.count
      }, 0)

      const totalKg   = dailyKg * forecastHorizon
      const totalCost = totalKg / 1000 * (f.cost_per_tonne || 0)

      return { ...f, dailyKg, totalKg, totalCost }
    }).filter(f => f.totalKg > 0).sort((a, b) => b.totalKg - a.totalKg)
  }, [formulas, feeds, farms, animalGroups, groupFeeds, forecastHorizon])

  const topFormulas = [...formulas].filter(f => f.cost_per_tonne).sort((a, b) => (b.cost_per_tonne || 0) - (a.cost_per_tonne || 0)).slice(0, 5)

  const QUICK_LINKS = [
    { href: '/dashboard/nutrition/library',            label: 'Commodity Library', icon: '🌾', desc: `${commodities.length} commodities · ${lowStockItems.length} low stock`, color: '#4CAF7D' },
    { href: '/dashboard/nutrition/formulas',           label: 'Formula Manager',   icon: '🧪', desc: `${formulas.length} formulas · avg $${avgCost}/t`,                       color: '#4A90C4' },
    { href: '/dashboard/nutrition/forecast_nutrition', label: 'Demand Forecast',   icon: '📊', desc: `${(dailyFeedKg / 1000).toFixed(1)}t/day · ${farms.filter(f => !selectedMillId || f.feed_mill_id === selectedMillId).length} farms`, color: '#EF9F27' },
  ]

  async function generateAIInsight() {
    setAiLoading(true); setAiError('')
    try {
      const millLabel = selectedMillId ? millName(selectedMillId) : 'All mills'
      const prompt = `You are a livestock nutrition analyst for FeedFlow, an AgTech platform.

Analyze this feed mill nutrition data and provide a concise, actionable insight in JSON format.

MILL: ${millLabel}
COMMODITIES: ${commodities.length} total · ${criticalStock.length} critical stock · ${lowStockItems.length} low stock · ${okStock.length} OK
CRITICAL STOCK ITEMS: ${criticalStock.map(c => `${c.name} (${(c.stock_kg/1000).toFixed(1)}t stock, min ${(c.min_stock_kg/1000).toFixed(1)}t)`).join(', ') || 'None'}
LOW STOCK ITEMS: ${lowStockItems.filter(c => c.stock_kg > c.min_stock_kg * 0.5).map(c => `${c.name} (${(c.stock_kg/1000).toFixed(1)}t)`).join(', ') || 'None'}
FORMULAS: ${formulas.length} active · avg cost $${avgCost}/t · range $${minCost}–$${maxCost}/t
MOST EXPENSIVE FORMULA: ${topFormulas[0]?.name || '—'} at $${topFormulas[0]?.cost_per_tonne || 0}/t
CHEAPEST FORMULA: ${topFormulas[topFormulas.length-1]?.name || '—'} at $${topFormulas[topFormulas.length-1]?.cost_per_tonne || 0}/t
FARMS SERVED: ${farms.filter(f => !selectedMillId || f.feed_mill_id === selectedMillId).length}
ANIMAL GROUPS: ${animalGroups.length} groups · ${totalAnimals.toLocaleString()} animals total
ANIMAL BREAKDOWN: ${Object.entries(animalsByType).map(([t, c]) => `${t}: ${c.toLocaleString()}`).join(', ')}
DAILY FEED DEMAND: ${(dailyFeedKg/1000).toFixed(1)} tonnes/day
TOP FORMULA DEMAND: ${formulaDemand.slice(0,3).map(f => `${f.name}: ${(f.totalKg/1000).toFixed(1)}t over ${forecastHorizon} days`).join(', ')}

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "summary": "2-3 sentence overview of the current nutrition operation status",
  "critical_actions": ["action 1", "action 2"],
  "opportunities": ["opportunity 1", "opportunity 2"],
  "forecast_note": "1 sentence about demand outlook"
}`

      const response = await fetch('/api/nutrition-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data  = await response.json()
      const text  = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed: AIInsightResult = JSON.parse(clean)
      setAiInsight(parsed)
    } catch {
      setAiError('Failed to generate insight. Please try again.')
    }
    setAiLoading(false)
  }

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
      {/* HEADER */}
      <div className="page-header">
        <div>
          <div className="page-title">Nutrition Manager</div>
          <div className="page-sub">{selectedMillId ? millName(selectedMillId) : 'All mills'} · Commodities · Formulas · Demand Forecast</div>
        </div>
        <div className="page-actions">
          {criticalStock.length > 0 && (
            <div style={{ padding: '7px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#A32D2D' }}>
              ⚠ {criticalStock.length} critical stock alert{criticalStock.length > 1 ? 's' : ''}
            </div>
          )}
          <button onClick={generateAIInsight} disabled={aiLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: aiLoading ? '#aab8c0' : '#1a2530', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: aiLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            {aiLoading ? 'Analysing...' : aiInsight ? 'Refresh AI Analysis' : '✦ AI Analysis'}
          </button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Commodities</div><div className="sum-val">{commodities.length}</div><div className="sum-sub">{lowStockItems.length} low stock</div></div>
        <div className="sum-card"><div className="sum-label">Formulas</div><div className="sum-val" style={{ color: '#4A90C4' }}>{formulas.length}</div><div className="sum-sub">Avg ${avgCost}/tonne</div></div>
        <div className="sum-card"><div className="sum-label">Daily feed demand</div><div className="sum-val" style={{ color: '#EF9F27' }}>{(dailyFeedKg / 1000).toFixed(1)}t</div><div className="sum-sub">{farms.filter(f => !selectedMillId || f.feed_mill_id === selectedMillId).length} farms · {animalGroups.length} groups</div></div>
        <div className="sum-card"><div className="sum-label">Total animals</div><div className="sum-val green">{totalAnimals.toLocaleString()}</div><div className="sum-sub">Across all farms</div></div>
      </div>

      {/* AI LOADING */}
      {aiLoading && (
        <div style={{ background: '#1a2530', borderRadius: 12, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 32, height: 32, border: '2px solid rgba(76,175,125,0.3)', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Claude AI is analysing your nutrition data...</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Reviewing stock levels, formula costs and demand outlook</div>
          </div>
        </div>
      )}

      {aiError && (
        <div style={{ padding: '12px 16px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 10, fontSize: 13, color: '#A32D2D', marginBottom: 20 }}>{aiError}</div>
      )}

      {/* AI INSIGHT */}
      {aiInsight && !aiLoading && (
        <div style={{ background: '#1a2530', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(76,175,125,0.15)', border: '0.5px solid rgba(76,175,125,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>AI Nutrition Analysis</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Powered by Claude AI · {selectedMillId ? millName(selectedMillId) : 'All mills'}</div>
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: 'rgba(76,175,125,0.15)', color: '#4CAF7D', border: '0.5px solid rgba(76,175,125,0.3)' }}>Claude AI</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '12px 16px', marginBottom: 14, borderLeft: '3px solid #4CAF7D' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4CAF7D', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Overview</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.6 }}>{aiInsight.summary}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div style={{ background: 'rgba(226,75,74,0.08)', borderRadius: 8, padding: '12px 14px', border: '0.5px solid rgba(226,75,74,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#E24B4A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>🚨 Critical actions</div>
              {aiInsight.critical_actions.length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>No critical actions required.</div>
              ) : aiInsight.critical_actions.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#E24B4A', flexShrink: 0 }}>•</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{a}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(76,175,125,0.08)', borderRadius: 8, padding: '12px 14px', border: '0.5px solid rgba(76,175,125,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4CAF7D', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>💡 Opportunities</div>
              {aiInsight.opportunities.length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>No opportunities identified.</div>
              ) : aiInsight.opportunities.map((o, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#4CAF7D', flexShrink: 0 }}>•</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{o}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(74,144,196,0.08)', borderRadius: 8, padding: '12px 14px', border: '0.5px solid rgba(74,144,196,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4A90C4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>📈 Demand outlook</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{aiInsight.forecast_note}</div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>30-day demand estimate</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#4A90C4', marginTop: 2 }}>{(dailyFeedKg * 30 / 1000).toFixed(0)}t</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALERTS SECTION */}
      {(criticalStock.length > 0 || lowStockItems.length > 0) && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2530' }}>
              🔔 Stock Alerts
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: '#8a9aaa' }}>{lowStockItems.length} items need attention</span>
            </div>
            <Link href="/dashboard/nutrition/library" style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600, textDecoration: 'none' }}>Manage stock →</Link>
          </div>
          {criticalStock.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#A32D2D', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E24B4A' }} />Critical — immediate action required
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {criticalStock.map(c => (
                  <div key={c.id} style={{ padding: '12px 14px', borderRadius: 8, background: '#FCEBEB', border: '0.5px solid #F0959544', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#A32D2D' }}>{c.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#A32D2D', color: '#fff' }}>CRITICAL</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(163,45,45,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#E24B4A', borderRadius: 2, width: `${Math.min(c.min_stock_kg > 0 ? (c.stock_kg / c.min_stock_kg) * 100 : 0, 100)}%` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#A32D2D' }}>
                      <span>Stock: <strong>{(c.stock_kg / 1000).toFixed(1)}t</strong></span>
                      <span>Min: <strong>{(c.min_stock_kg / 1000).toFixed(1)}t</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {lowStockItems.filter(c => c.stock_kg > c.min_stock_kg * 0.5).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#633806', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF9F27' }} />Low — order soon
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {lowStockItems.filter(c => c.stock_kg > c.min_stock_kg * 0.5).map(c => (
                  <div key={c.id} style={{ padding: '12px 14px', borderRadius: 8, background: '#FAEEDA', border: '0.5px solid #EF9F2744', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#633806' }}>{c.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#EF9F27', color: '#fff' }}>LOW</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(99,56,6,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#EF9F27', borderRadius: 2, width: `${Math.min(c.min_stock_kg > 0 ? (c.stock_kg / c.min_stock_kg) * 100 : 0, 100)}%` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#633806' }}>
                      <span>Stock: <strong>{(c.stock_kg / 1000).toFixed(1)}t</strong></span>
                      <span>Min: <strong>{(c.min_stock_kg / 1000).toFixed(1)}t</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* QUICK LINKS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {QUICK_LINKS.map(link => (
          <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', border: '0.5px solid #e8ede9', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = link.color + '44' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = '#e8ede9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: link.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{link.icon}</div>
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
        {/* FORMULA DEMAND FORECAST */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Formula demand forecast</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[7, 14, 30].map(h => (
                <button key={h} onClick={() => setForecastHorizon(h)}
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: forecastHorizon === h ? '#1a2530' : '#f0f4f0', color: forecastHorizon === h ? '#fff' : '#6a7a8a' }}>
                  {h}d
                </button>
              ))}
            </div>
          </div>
          {formulaDemand.length > 0 ? (
            <>
              <div style={{ height: 200, position: 'relative', marginBottom: 12 }}>
                <Bar
                  data={{
                    labels: formulaDemand.slice(0, 8).map(f => f.name.length > 16 ? f.name.slice(0, 16) + '…' : f.name),
                    datasets: [{
                      label: `Demand (t) over ${forecastHorizon} days`,
                      data: formulaDemand.slice(0, 8).map(f => Math.round(f.totalKg / 10) / 100),
                      backgroundColor: formulaDemand.slice(0, 8).map((_, i) => BAR_COLORS[i % 8]),
                      borderRadius: 4,
                    }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aab8c0', maxRotation: 30 }, border: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: '#aab8c0', callback: (v: any) => v + 't' }, border: { display: false } } } }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {formulaDemand.slice(0, 5).map((f, i) => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: BAR_COLORS[i % 8], flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#1a2530', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', flexShrink: 0 }}>{(f.totalKg / 1000).toFixed(1)}t</span>
                    <span style={{ fontSize: 10, color: '#aab8c0', flexShrink: 0 }}>${Math.round(f.totalCost).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ color: '#aab8c0', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
              No formula demand data available for this mill.
            </div>
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

      {/* ANIMAL GROUPS */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Animals by type</div>
          <span style={{ fontSize: 11, color: '#aab8c0' }}>{totalAnimals.toLocaleString()} total · {farms.filter(f => !selectedMillId || f.feed_mill_id === selectedMillId).length} farms</span>
        </div>
        {Object.keys(animalsByType).length === 0 ? (
          <div style={{ color: '#aab8c0', fontSize: 13, padding: '20px 0' }}>No animal groups found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {Object.entries(animalsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const pct    = totalAnimals > 0 ? Math.round(count / totalAnimals * 100) : 0
              const groups = animalGroups.filter(g => g.type === type).length
              return (
                <div key={type} style={{ background: '#f7f9f8', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 22 }}>{ANIMAL_ICONS[type] || '🐾'}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', textTransform: 'capitalize' }}>{type}</div>
                      <div style={{ fontSize: 11, color: '#aab8c0' }}>{groups} groups</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', marginBottom: 6 }}>{count.toLocaleString()}</div>
                  <div style={{ height: 4, background: '#e8ede9', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', background: '#4CAF7D', borderRadius: 2, width: `${pct}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#8a9aaa' }}>{pct}% of total</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
