'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { getActiveFarmId } from '@/lib/queries'

interface Farm {
  id:       string
  name:     string
  location: string | null
}

interface DayInsight {
  id:           string
  farm_id:      string
  insight_date: string
  updated_at:   string
  insights: {
    dashboard?:                  string
    alerts?:                     string
    analytics?:                  string
    forecast?:                   string
    costs?:                      string
    animals?:                    string
    sensors?:                    string
    critical_action?:            string
    procurement_recommendation?: string
    telegram_message?:           string
    generated_at?:               string
  }
}

const SECTIONS = [
  { key: 'dashboard', label: 'Farm status',  dot: '#4CAF7D' },
  { key: 'alerts',    label: 'Alerts',        dot: '#E24B4A' },
  { key: 'forecast',  label: 'Forecast',      dot: '#4A90C4' },
  { key: 'analytics', label: 'Analytics',     dot: '#4A90C4' },
  { key: 'costs',     label: 'Feed costs',    dot: '#EF9F27' },
  { key: 'animals',   label: 'Animals',       dot: '#EF9F27' },
  { key: 'sensors',   label: 'Sensors',       dot: '#8a9aaa' },
]

const FARM_COLORS = ['#4CAF7D', '#4A90C4', '#EF9F27', '#9B59B6']
const FARM_BG     = ['rgba(76,175,125,0.15)', 'rgba(74,144,196,0.18)', 'rgba(239,159,39,0.15)', 'rgba(155,89,182,0.15)']

function formatDate(dateStr: string) {
  const todayStr  = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
  const yesterStr = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
  if (dateStr === todayStr)  return 'Today'
  if (dateStr === yesterStr) return 'Yesterday'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit',
  })
}

function farmShortName(name: string) {
  return name.replace(/^Granja\s+/i, '')
}

export default function InsightsPage() {
  const [allInsights, setAllInsights] = useState<DayInsight[]>([])
  const [farms,       setFarms]       = useState<Farm[]>([])
  const [loading,     setLoading]     = useState(true)
  const [selectedFarm, setSelectedFarm] = useState<string>('all')
  const [period,       setPeriod]       = useState<7 | 30>(7)
  const [view,         setView]         = useState<'timeline' | 'compare'>('timeline')
  const [expandedId,   setExpandedId]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const activeFarmId = getActiveFarmId()
      const [insightsResp, farmsResp] = await Promise.all([
        supabase
          .from('ai_insights')
          .select('id, farm_id, insight_date, updated_at, insights')
          .not('insight_date', 'is', null)
          .neq('insights', '{}')
          .order('insight_date', { ascending: false })
          .order('updated_at',   { ascending: false })
          .limit(period * 3),
        supabase
          .from('farms')
          .select('id, name, location')
          .order('name'),
      ])
      const farmList = farmsResp.data || []
      setFarms(farmList)
      setAllInsights(insightsResp.data || [])
      const match = farmList.find(f => f.id === activeFarmId)
      if (match) setSelectedFarm(activeFarmId)
      const first = insightsResp.data?.[0]
      if (first) setExpandedId(first.id)
      setLoading(false)
    }
    load()
  }, [period])

  const farmColorMap = useMemo(() => {
    const map: Record<string, { color: string; bg: string; short: string }> = {}
    farms.forEach((f, i) => {
      map[f.id] = {
        color: FARM_COLORS[i % FARM_COLORS.length],
        bg:    FARM_BG[i % FARM_BG.length],
        short: farmShortName(f.name),
      }
    })
    return map
  }, [farms])

  const filtered = useMemo(() =>
    allInsights.filter(i => selectedFarm === 'all' || i.farm_id === selectedFarm),
    [allInsights, selectedFarm]
  )

  const latestByFarm = useMemo(() => {
    const map: Record<string, DayInsight> = {}
    filtered.forEach(i => { if (!map[i.farm_id]) map[i.farm_id] = i })
    return map
  }, [filtered])

  const todayInsights = useMemo(() =>
    selectedFarm !== 'all'
      ? (latestByFarm[selectedFarm] ? [latestByFarm[selectedFarm]] : [])
      : Object.values(latestByFarm),
    [latestByFarm, selectedFarm]
  )

  const timelineByDate = useMemo(() => {
    const dateMap: Record<string, DayInsight[]> = {}
    filtered.forEach(i => {
      if (!dateMap[i.insight_date]) dateMap[i.insight_date] = []
      dateMap[i.insight_date].push(i)
    })
    return Object.entries(dateMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, period)
  }, [filtered, period])

  const compareData = useMemo(() =>
    timelineByDate.length > 0
      ? { date: timelineByDate[0][0], insights: timelineByDate[0][1] }
      : null,
    [timelineByDate]
  )

  // Pill button style
  const pill = (active: boolean, color?: string) => ({
    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit',
    background:  active ? (color || '#1a2530') : '#fff',
    color:       active ? '#fff' : '#6a7a8a',
    borderColor: active ? (color || '#1a2530') : '#e8ede9',
    transition:  'all 0.15s',
  } as React.CSSProperties)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading AI insights...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <div className="page-title">AI Insights</div>
          <div className="page-sub">Powered by Claude AI · Updated daily at 6:00 AM AEST</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(76,175,125,0.1)', border: '0.5px solid rgba(76,175,125,0.3)', borderRadius: 20 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF7D' }} />
          <span style={{ fontSize: 11, color: '#27500A', fontWeight: 600 }}>AI Engine Active</span>
        </div>
      </div>

      {/* FARM + PERIOD FILTER BAR */}
      <div style={{ display: 'flex', alignItems:
