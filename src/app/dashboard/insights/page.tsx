'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getActiveFarmId, getFarmSummary } from '@/lib/queries'
import type { FarmSummary } from '@/lib/types'

interface DayInsight {
  id:           string
  insight_date: string
  updated_at:   string
  insights: {
    dashboard?:                 string
    alerts?:                    string
    analytics?:                 string
    forecast?:                  string
    costs?:                     string
    animals?:                   string
    sensors?:                   string
    critical_action?:           string
    procurement_recommendation?: string
    telegram_message?:          string
    generated_at?:              string
  }
}

const SECTIONS = [
  { key: 'dashboard',  label: 'Farm Status',    icon: '📊', color: '#4CAF7D' },
  { key: 'alerts',     label: 'Alerts',          icon: '🔔', color: '#E24B4A' },
  { key: 'forecast',   label: 'Forecast',        icon: '📈', color: '#4A90C4' },
  { key: 'analytics',  label: 'Analytics',       icon: '📉', color: '#4A90C4' },
  { key: 'costs',      label: 'Feed Costs',      icon: '💰', color: '#EF9F27' },
  { key: 'animals',    label: 'Animals',         icon: '🐖', color: '#EF9F27' },
  { key: 'sensors',    label: 'Sensors',         icon: '📡', color: '#8a9aaa' },
]

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)

  if (dateStr === today.toLocaleDateString('en-CA')) return 'Today'
  if (dateStr === yesterday.toLocaleDateString('en-CA')) return 'Yesterday'
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Melbourne',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function InsightsPage() {
  const [insights,  setInsights]  = useState<DayInsight[]>([])
  const [summary,   setSummary]   = useState<FarmSummary | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<string | null>(null)  // day expanded in timeline

  useEffect(() => {
    async function load() {
      const farmId = getActiveFarmId()

      const [insightsResp, summaryData] = await Promise.all([
        supabase
          .from('ai_insights')
          .select('id, insight_date, updated_at, insights')
          .eq('farm_id', farmId)
          .not('insight_date', 'is', null)
          .order('insight_date', { ascending: false })
          .limit(7),
        getFarmSummary(),
      ])

      setInsights(insightsResp.data || [])
      setSummary(summaryData)
      // Auto-expand today
      if (insightsResp.data && insightsResp.data.length > 0) {
        setExpanded(insightsResp.data[0].id)
      }
      setLoading(false)
    }
    load()
  }, [])

  const today = insights[0] || null

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
            {summary?.farm_name || 'Farm'} · Powered by Claude AI · Updated daily at 6:00 AM
          </div>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(76,175,125,0.1)', border: '0.5px solid rgba(76,175,125,0.3)', borderRadius: 20 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF7D' }} />
            <span style={{ fontSize: 11, color: '#27500A', fontWeight: 600 }}>AI Engine Active</span>
          </div>
        </div>
      </div>

      {insights.length === 0 ? (
        /* ── EMPTY STATE ──────────────────────────────────────── */
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2530', marginBottom: 8 }}>No insights yet</div>
          <div style={{ fontSize: 13, maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
            The AI Engine runs daily at 6:00 AM AEST. Insights will appear here after the first run.
          </div>
          <div style={{ marginTop: 20, padding: '12px 20px', background: '#f7f9f8', borderRadius: 10, display: 'inline-block', fontSize: 12, color: '#8a9aaa' }}>
            Make sure the <strong style={{ color: '#1a2530' }}>FeedFlow AI Daily</strong> workflow is active in PipeDream
          </div>
        </div>
      ) : (
        <>
          {/* ── TODAY'S SUMMARY ───────────────────────────────── */}
          {today && (
            <div style={{ background: '#1a2530', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(76,175,125,0.15)', border: '0.5px solid rgba(76,175,125,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Today's Farm Intelligence</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                      Generated {formatDate(today.insight_date)} at {formatTime(today.updated_at)} AEST
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: 'rgba(76,175,125,0.15)', color: '#4CAF7D', border: '0.5px solid rgba(76,175,125,0.3)' }}>
                  Claude AI
                </span>
              </div>

              {/* Critical action banner */}
              {today.insights.critical_action && (
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, borderLeft: '3px solid #4CAF7D' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4CAF7D', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Priority Action</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{today.insights.critical_action}</div>
                </div>
              )}

              {/* Section cards grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {SECTIONS.map(sec => {
                  const text = today.insights[sec.key as keyof typeof today.insights] as string | undefined
                  if (!text) return null
                  return (
                    <div key={sec.key} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                        <span style={{ fontSize: 13 }}>{sec.icon}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{sec.label}</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, margin: 0 }}>{text}</p>
                    </div>
                  )
                })}
              </div>

              {/* Procurement note */}
              {today.insights.procurement_recommendation && (
                <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>🚚</span>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Procurement Note</div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, margin: 0 }}>{today.insights.procurement_recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 7-DAY TIMELINE ────────────────────────────────── */}
          {insights.length > 1 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Insight history — last 7 days</div>
                <span style={{ fontSize: 11, color: '#aab8c0' }}>{insights.length} reports</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {insights.slice(1).map((day, idx) => {
                  const isOpen = expanded === day.id
                  const label  = formatDate(day.insight_date)
                  const time   = formatTime(day.updated_at)
                  const hasCritical = day.insights.critical_action

                  return (
                    <div key={day.id} style={{ borderBottom: idx < insights.length - 2 ? '0.5px solid #f0f4f0' : 'none' }}>
                      {/* Row header */}
                      <button
                        onClick={() => setExpanded(isOpen ? null : day.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                          padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {/* Date badge */}
                        <div style={{ width: 88, flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{label}</div>
                          <div style={{ fontSize: 11, color: '#aab8c0' }}>{time} AEST</div>
                        </div>

                        {/* Preview of dashboard insight */}
                        <div style={{ flex: 1, fontSize: 12, color: '#6a7a8a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {day.insights.dashboard || 'No summary available'}
                        </div>

                        {/* Indicators */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {hasCritical && (
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#FCEBEB', color: '#A32D2D', fontWeight: 600 }}>Action</span>
                          )}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isOpen && (
                        <div style={{ paddingBottom: 16 }}>
                          {day.insights.critical_action && (
                            <div style={{ background: '#fff8f0', border: '0.5px solid #EF9F2744', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8 }}>
                              <span style={{ fontSize: 12, flexShrink: 0 }}>⚡</span>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#633806', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Priority Action</div>
                                <p style={{ fontSize: 12, color: '#633806', lineHeight: 1.5, margin: 0 }}>{day.insights.critical_action}</p>
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            {SECTIONS.map(sec => {
                              const text = day.insights[sec.key as keyof typeof day.insights] as string | undefined
                              if (!text) return null
                              return (
                                <div key={sec.key} style={{ background: '#f7f9f8', borderRadius: 8, padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                                    <span style={{ fontSize: 12 }}>{sec.icon}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{sec.label}</span>
                                  </div>
                                  <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 }}>{text}</p>
                                </div>
                              )
                            })}
                          </div>

                          {day.insights.procurement_recommendation && (
                            <div style={{ marginTop: 8, background: '#f7f9f8', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                              <span style={{ fontSize: 12, flexShrink: 0 }}>🚚</span>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Procurement</div>
                                <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 }}>{day.insights.procurement_recommendation}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
