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

const FARM_COLORS: string[] = ['#4CAF7D', '#4A90C4', '#EF9F27', '#9B59B6']
const FARM_BG: string[]     = ['rgba(76,175,125,0.15)', 'rgba(74,144,196,0.18)', 'rgba(239,159,39,0.15)', 'rgba(155,89,182,0.15)']

function formatDate(dateStr: string) {
  const d         = new Date(dateStr + 'T12:00:00')
  const todayStr  = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
  const yesterStr = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
  if (dateStr === todayStr)  return 'Today'
  if (dateStr === yesterStr) return 'Yesterday'
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit',
  })
}

function farmShortName(name: string) {
  // Return short label: "El Roble", "Los Pinos", etc.
  return name.replace(/^Granja\s+/i, '')
}

export default function InsightsPage() {
  const [allInsights, setAllInsights] = useState<DayInsight[]>([])
  const [farms,       setFarms]       = useState<Farm[]>([])
  const [loading,     setLoading]     = useState(true)

  // Filters
  const [selectedFarm, setSelectedFarm] = useState<string>('all')  // 'all' or farm_id
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

      // Default: select active farm
      const match = farmList.find(f => f.id === activeFarmId)
      if (match) setSelectedFarm(activeFarmId)

      // Auto-expand today
      const today = insightsResp.data?.find(i =>
        i.farm_id === activeFarmId || i.farm_id === farmList[0]?.id
      )
      if (today) setExpandedId(today.id)

      setLoading(false)
    }
    load()
  }, [period])

  // Farm color lookup
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

  // Filter insights
  const filtered = useMemo(() => {
    return allInsights.filter(i =>
      selectedFarm === 'all' || i.farm_id === selectedFarm
    )
  }, [allInsights, selectedFarm])

  // Latest insight per farm (for today summary)
  const latestByFarm = useMemo(() => {
    const map: Record<string, DayInsight> = {}
    filtered.forEach(i => {
      if (!map[i.farm_id]) map[i.farm_id] = i
    })
    return map
  }, [filtered])

  // Today's insights — one per farm
  const todayInsights = useMemo(() => {
    if (selectedFarm !== 'all') {
      const ins = latestByFarm[selectedFarm]
      return ins ? [ins] : []
    }
    return Object.values(latestByFarm)
  }, [latestByFarm, selectedFarm])

  // Timeline — deduplicated by date, showing best insight per date
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

  // Compare view — latest per farm for same day
  const compareData = useMemo(() => {
    if (timelineByDate.length === 0) return null
    const [latestDate, insightsOnDate] = timelineByDate[0]
    return { date: latestDate, insights: insightsOnDate }
  }, [timelineByDate])

  const hasCritical = (ins: DayInsight) =>
    ins.insights.critical_action &&
    (ins.insights.alerts?.toLowerCase().includes('critical') ||
     ins.insights.dashboard?.toLowerCase().includes('critical'))

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
          Loading AI insights...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── PAGE HEADER ─────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-title">AI Insights</div>
          <div className="page-sub">
            Powered by Claude AI · Updated daily at 6:00 AM AEST
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(76,175,125,0.1)', border: '0.5px solid rgba(76,175,125,0.3)', borderRadius: 20 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF7D' }} />
          <span style={{ fontSize: 11, color: '#27500A', fontWeight: 600 }}>AI Engine Active</span>
        </div>
      </div>

      {/* ── FARM SELECTOR + PERIOD FILTER ───────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#8a9aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Farm</span>

        {/* All farms */}
        <button
          onClick={() => setSelectedFarm('all')}
          style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit',
            background: selectedFarm === 'all' ? '#1a2530' : '#fff',
            color:      selectedFarm === 'all' ? '#fff'    : '#6a7a8a',
            borderColor: selectedFarm === 'all' ? '#1a2530' : '#e8ede9',
          }}
        >
          All farms
        </button>

        {/* Per farm */}
        {farms.map(f => {
          const fc    = farmColorMap[f.id]
          const on    = selectedFarm === f.id
          return (
            <button
              key={f.id}
              onClick={() => setSelectedFarm(f.id)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit',
                background:  on ? fc?.color : '#fff',
                color:       on ? '#fff'    : '#6a7a8a',
                borderColor: on ? fc?.color : '#e8ede9',
              }}
            >
              {fc?.short || f.name}
            </button>
          )
        })}

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: '#e8ede9', margin: '0 4px' }} />

        <span style={{ fontSize: 11, color: '#8a9aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Period</span>
        {([7, 30] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit',
              background:  period === p ? '#1a2530' : '#fff',
              color:       period === p ? '#fff'    : '#6a7a8a',
              borderColor: period === p ? '#1a2530' : '#e8ede9',
            }}
          >
            {p === 7 ? 'Last 7 days' : 'Last 30 days'}
          </button>
        ))}
      </div>

      {/* ── EMPTY STATE ─────────────────────────────────────────── */}
      {todayInsights.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2530', marginBottom: 8 }}>No insights yet</div>
          <div style={{ fontSize: 13, maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
            The AI Engine runs daily at 6:00 AM AEST. Run the FeedFlow AI Daily workflow manually in PipeDream to generate insights now.
          </div>
        </div>
      ) : (
        <>
          {/* ── TODAY'S SUMMARY CARDS ─────────────────────────── */}
          {todayInsights.map(ins => {
            const fc = farmColorMap[ins.farm_id]
            return (
              <div key={ins.id} style={{ background: '#1a2530', borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>

                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(76,175,125,0.15)', border: '0.5px solid rgba(76,175,125,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                        Today's Farm Intelligence
                        {selectedFarm === 'all' && fc && (
                          <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: fc.bg, color: fc.color, fontWeight: 700 }}>
                            {fc.short}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                        Generated {formatDate(ins.insight_date)} at {formatTime(ins.updated_at)} AEST
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: 'rgba(76,175,125,0.15)', color: '#4CAF7D', border: '0.5px solid rgba(76,175,125,0.3)' }}>
                    Claude AI
                  </span>
                </div>

                {/* Priority action */}
                {ins.insights.critical_action && (
                  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, borderLeft: '3px solid #4CAF7D' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4CAF7D', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Priority action</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.5 }}>{ins.insights.critical_action}</div>
                  </div>
                )}

                {/* Section grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 12 }}>
                  {SECTIONS.map(sec => {
                    const text = ins.insights[sec.key as keyof typeof ins.insights] as string | undefined
                    if (!text) return null
                    return (
                      <div key={sec.key} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: sec.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{sec.label}</span>
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)', lineHeight: 1.55, margin: 0 }}>{text}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Procurement note */}
                {ins.insights.procurement_recommendation && (
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8l4 2v5h-4M5 17v2m6-2v2"/>
                    </svg>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Procurement note</div>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, margin: 0 }}>{ins.insights.procurement_recommendation}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── TIMELINE / COMPARE ────────────────────────────── */}
          {timelineByDate.length > 1 && (
            <div style={{ background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 12, padding: '18px 20px' }}>
              {/* Header + view toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>Insight history</div>
                  <div style={{ fontSize: 12, color: '#8a9aaa', marginTop: 2 }}>{timelineByDate.length} reports</div>
                </div>
                {/* Toggle */}
                <div style={{ display: 'flex', background: '#f0f4f0', borderRadius: 8, padding: 3, gap: 0 }}>
                  {(['timeline', 'compare'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      style={{
                        padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                        cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                        background: view === v ? '#1a2530' : 'transparent',
                        color:      view === v ? '#fff'    : '#6a7a8a',
                        transition: 'all 0.15s',
                      }}
                    >
                      {v === 'timeline' ? 'Timeline' : 'Compare farms'}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── TIMELINE VIEW ─────────────────────────────── */}
              {view === 'timeline' && (
                <div>
                  {timelineByDate.slice(1).map(([date, insights]) => {
                    const primary   = insights[0]
                    const isOpen    = expandedId === primary.id
                    const critical  = insights.some(i => hasCritical(i))
                    const farmCount = insights.length

                    return (
                      <div key={date} style={{ borderBottom: '0.5px solid #f0f4f0' }}>
                        <button
                          onClick={() => setExpandedId(isOpen ? null : primary.id)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ width: 88, flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{formatDate(date)}</div>
                            <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>{formatTime(primary.updated_at)}</div>
                          </div>

                          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: critical ? '#E24B4A' : '#4CAF7D' }} />

                          <div style={{ flex: 1, fontSize: 12, color: '#6a7a8a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {primary.insights.dashboard || 'No summary available'}
                          </div>

                          {/* Farm pills */}
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            {insights.map(i => {
                              const fc = farmColorMap[i.farm_id]
                              return fc ? (
                                <span key={i.id} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: fc.bg, color: fc.color, fontWeight: 600 }}>
                                  {fc.short}
                                </span>
                              ) : null
                            })}
                          </div>

                          {critical && (
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#FCEBEB', color: '#A32D2D', flexShrink: 0 }}>Action</span>
                          )}

                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="2" style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </button>

                        {/* Expanded rows — one per farm */}
                        {isOpen && (
                          <div style={{ paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {insights.map(ins => {
                              const fc = farmColorMap[ins.farm_id]
                              return (
                                <div key={ins.id}>
                                  {farmCount > 1 && fc && (
                                    <div style={{ fontSize: 11, fontWeight: 700, color: fc.color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: fc.color }} />
                                      {fc.short}
                                    </div>
                                  )}

                                  {ins.insights.critical_action && (
                                    <div style={{ background: '#fff8f0', border: '0.5px solid #EF9F2744', borderRadius: 8, padding: '10px 14px', marginBottom: 10, display: 'flex', gap: 8 }}>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#633806', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', marginTop: 1 }}>Action</span>
                                      <p style={{ fontSize: 12, color: '#633806', lineHeight: 1.5, margin: 0 }}>{ins.insights.critical_action}</p>
                                    </div>
                                  )}

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                                    {SECTIONS.map(sec => {
                                      const text = ins.insights[sec.key as keyof typeof ins.insights] as string | undefined
                                      if (!text) return null
                                      return (
                                        <div key={sec.key} style={{ background: '#f7f9f8', borderRadius: 8, padding: '10px 12px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: sec.dot }} />
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{sec.label}</span>
                                          </div>
                                          <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 }}>{text}</p>
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {ins.insights.procurement_recommendation && (
                                    <div style={{ marginTop: 8, background: '#f7f9f8', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                                      <span style={{ fontSize: 10, fontWeight: 600, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', marginTop: 1 }}>Procurement</span>
                                      <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 }}>{ins.insights.procurement_recommendation}</p>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── COMPARE VIEW ──────────────────────────────── */}
              {view === 'compare' && compareData && (
                <div>
                  <div style={{ fontSize: 12, color: '#8a9aaa', marginBottom: 14 }}>
                    Comparing farms — {formatDate(compareData.date)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compareData.insights.length}, minmax(0,1fr))`, gap: 14 }}>
                    {compareData.insights.map(ins => {
                      const fc = farmColorMap[ins.farm_id]
                      return (
                        <div key={ins.id} style={{ border: `1px solid ${fc?.color || '#e8ede9'}22`, borderRadius: 10, padding: 16, background: fc?.bg || '#f7f9f8' }}>
                          {/* Farm header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: fc?.color || '#aab8c0' }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2530' }}>{fc?.short || 'Farm'}</span>
                          </div>

                          {ins.insights.critical_action && (
                            <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '8px 10px', marginBottom: 12, borderLeft: `2px solid ${fc?.color}` }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: fc?.color, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Action</div>
                              <p style={{ fontSize: 12, color: '#1a2530', lineHeight: 1.5, margin: 0 }}>{ins.insights.critical_action}</p>
                            </div>
                          )}

                          {SECTIONS.map(sec => {
                            const text = ins.insights[sec.key as keyof typeof ins.insights] as string | undefined
                            if (!text) return null
                            return (
                              <div key={sec.key} style={{ padding: '7px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{sec.label}</div>
                                <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 }}>{text}</p>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}
