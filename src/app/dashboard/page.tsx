'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

// ═══ Design Tokens ═══
const T = {
  bg: '#F4F7F5',
  bgCard: '#FFFFFF',
  accent: '#4CAF7D',
  accentBg: '#E9F5EE',
  text: '#1a2530',
  textSecondary: '#5F7068',
  textMuted: '#94A3A0',
  border: '#E2E8E4',
  borderLight: '#EEF2EF',
  ok: '#4CAF7D',
  okBg: '#EDF8F2',
  warning: '#EF9F27',
  warningBg: '#FEF7EC',
  critical: '#E24B4A',
  criticalBg: '#FDF0EF',
  info: '#4A90C4',
  infoBg: '#EEF5FB',
  barTrack: '#ECF0ED',
  barOk: '#CDD8D0',
  font: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
  r2: 10,
  r3: 14,
  sh1: '0 1px 3px rgba(0,0,0,0.04)',
  sh2: '0 8px 24px rgba(0,0,0,0.1)',
}

interface Silo {
  id: string; name: string; material: string | null; capacity_kg: number
  lat: number | null; lng: number | null; farm_id: string
}
interface Reading {
  silo_id: string; level_pct: number; kg_remaining: number; recorded_at: string
}
interface Sensor {
  silo_id: string; status: string; battery_pct: number; signal_strength: number
}
interface SiloRow extends Silo {
  level_pct: number; kg_remaining: number; days_remaining: number
  hours_since_reading: number; alert_level: string; sensor: Sensor | null
}
interface AIInsight {
  insights: { dashboard?: string; critical_action?: string }
}

function levelColor(pct: number) { return pct <= 20 ? T.critical : pct <= 40 ? T.warning : T.barOk }
function levelTextColor(pct: number) { return pct <= 20 ? T.critical : pct <= 40 ? T.warning : T.textSecondary }
function daysColor(d: number) { return d <= 7 ? T.critical : d <= 14 ? T.warning : T.text }

export default function DashboardPage() {
  const { currentFarm } = useFarm()
  const farmId = currentFarm?.id || ''

  const [silos,   setSilos]   = useState<SiloRow[]>([])
  const [insight, setInsight] = useState<AIInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [search,  setSearch]  = useState('')
  const [sort,    setSort]    = useState('level')
  const [drawer,  setDrawer]  = useState<SiloRow | null>(null)
  const [insightDismissed, setInsightDismissed] = useState(false)

  useEffect(() => {
    if (farmId) loadAll()
    else setLoading(false)
  }, [farmId])

  async function loadAll() {
    setLoading(true)
    setInsightDismissed(false)
    const [silosR, insightR] = await Promise.all([
      supabase.from('silos').select('*').eq('farm_id', farmId).order('name'),
      supabase.from('ai_insights').select('insights').eq('farm_id', farmId)
        .order('insight_date', { ascending: false }).limit(1).maybeSingle(),
    ])
    const silosData: Silo[] = silosR.data || []
    if (silosData.length === 0) { setSilos([]); setLoading(false); return }
    const siloIds = silosData.map(s => s.id)
    const [readingsR, sensorsR] = await Promise.all([
      supabase.from('readings').select('silo_id, level_pct, kg_remaining, recorded_at')
        .in('silo_id', siloIds).order('recorded_at', { ascending: false }),
      supabase.from('sensors').select('silo_id, status, battery_pct, signal_strength')
        .in('silo_id', siloIds),
    ])
    const latestMap: Record<string, Reading> = {}
    ;(readingsR.data || []).forEach(r => { if (!latestMap[r.silo_id]) latestMap[r.silo_id] = r })
    const sensorMap: Record<string, Sensor> = {}
    ;(sensorsR.data || []).forEach(s => { sensorMap[s.silo_id] = s })
    const now = Date.now()
    const enriched: SiloRow[] = silosData.map(s => {
      const r = latestMap[s.id]
      const level_pct           = r?.level_pct || 0
      const kg_remaining        = r?.kg_remaining || 0
      const kgDay               = s.capacity_kg * 0.02
      const days_remaining      = kgDay > 0 ? Math.floor(kg_remaining / kgDay) : 0
      const hours_since_reading = r ? (now - new Date(r.recorded_at).getTime()) / 3600000 : 999
      const alert_level         = level_pct <= 20 ? 'critical' : level_pct <= 40 ? 'low' : 'ok'
      return { ...s, level_pct, kg_remaining, days_remaining, hours_since_reading, alert_level, sensor: sensorMap[s.id] || null }
    })
    setSilos(enriched)
    setInsight(insightR.data || null)
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let data = [...silos]
    if (filter === 'attention') data = data.filter(s => s.alert_level !== 'ok')
    else if (filter === 'ok') data = data.filter(s => s.alert_level === 'ok')
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(s => s.name.toLowerCase().includes(q) || (s.material || '').toLowerCase().includes(q))
    }
    if (sort === 'level') data.sort((a, b) => a.level_pct - b.level_pct)
    else if (sort === 'days') data.sort((a, b) => a.days_remaining - b.days_remaining)
    else data.sort((a, b) => a.name.localeCompare(b.name))
    return data
  }, [silos, filter, search, sort])

  const needsAttention = silos.filter(s => s.alert_level !== 'ok').length
  const okCount        = silos.filter(s => s.alert_level === 'ok').length
  const totalKg        = silos.reduce((sum, s) => sum + s.kg_remaining, 0)
  const avgLevel       = silos.length > 0 ? Math.round(silos.reduce((s, x) => s + x.level_pct, 0) / silos.length) : 0
  const onlineSensors  = silos.filter(s => s.sensor?.status === 'online').length

  // ═══ LOADING ═══
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: T.textMuted, fontSize: 14, fontFamily: T.font }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #E2E8E4', borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        Loading dashboard...
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ═══ NO FARM ═══
  if (!farmId) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, fontFamily: T.font }}>
      <div style={{ textAlign: 'center', color: T.textMuted }}>
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🌾</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 8 }}>Select a farm</div>
        <div style={{ fontSize: 14 }}>Choose a farm from the sidebar to view its dashboard.</div>
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: T.font }}>
      {/* ═══ SILO DRAWER ═══ */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 200, transition: 'opacity 0.25s' }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: 400, height: '100vh',
            background: T.bgCard, zIndex: 201, display: 'flex', flexDirection: 'column',
            boxShadow: T.sh2, fontFamily: T.font,
          }}>
            {/* Drawer Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: T.text }}>{drawer.name}</div>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{drawer.material || '—'}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{
                width: 32, height: 32, borderRadius: '50%', border: `1px solid ${T.border}`,
                background: T.bgCard, cursor: 'pointer', fontSize: 16, color: T.textMuted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Visual Gauge + Level */}
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                {/* Silo visual */}
                <div style={{
                  width: 64, height: 120, borderRadius: 10, border: `2px solid ${T.border}`,
                  background: T.barTrack, position: 'relative', overflow: 'hidden', flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: `${drawer.level_pct}%`,
                    background: levelColor(drawer.level_pct),
                    transition: 'height 0.4s ease',
                    borderRadius: '0 0 8px 8px',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.mono,
                  }}>
                    {drawer.level_pct.toFixed(0)}%
                  </div>
                </div>
                {/* Key metrics */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Days remaining</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: daysColor(drawer.days_remaining), fontFamily: T.mono, letterSpacing: -1 }}>
                      {drawer.days_remaining}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Feed available</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: T.text, fontFamily: T.mono }}>
                      {Math.round(drawer.kg_remaining).toLocaleString()} kg
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats rows */}
              <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.r2 }}>
                {[
                  { k: 'Capacity',        v: `${Math.round(drawer.capacity_kg).toLocaleString()} kg` },
                  { k: 'Daily consumption', v: `~${Math.round(drawer.capacity_kg * 0.02).toLocaleString()} kg/day` },
                  { k: 'Sensor status',    v: drawer.sensor ? drawer.sensor.status.charAt(0).toUpperCase() + drawer.sensor.status.slice(1) : 'No sensor' },
                  { k: 'Battery',          v: drawer.sensor ? `${drawer.sensor.battery_pct}%` : '—' },
                  { k: 'Last reading',     v: drawer.hours_since_reading < 1 ? 'Just now' : drawer.hours_since_reading < 24 ? `${Math.round(drawer.hours_since_reading)}h ago` : `${Math.round(drawer.hours_since_reading / 24)}d ago` },
                ].map((r, i) => (
                  <div key={r.k} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
                    borderBottom: i < 4 ? `1px solid ${T.borderLight}` : 'none',
                  }}>
                    <span style={{ fontSize: 13, color: T.textMuted }}>{r.k}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.text, fontFamily: T.mono }}>{r.v}</span>
                  </div>
                ))}
              </div>

              {/* Order estimate */}
              <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.r2, padding: '14px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Order estimate</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: T.textSecondary }}>To refill to 85%</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.mono }}>
                    {Math.round(Math.max(0, drawer.capacity_kg * 0.85 - drawer.kg_remaining)).toLocaleString()} kg
                  </span>
                </div>
              </div>

              {/* Action links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button style={{
                  padding: '10px 14px', background: T.bgCard, border: `1px solid ${T.border}`,
                  borderRadius: T.r2, fontSize: 13, color: T.textSecondary, cursor: 'pointer',
                  fontFamily: T.font, textAlign: 'left', fontWeight: 500,
                }}>
                  View consumption history →
                </button>
                <button style={{
                  padding: '10px 14px', background: T.bgCard, border: `1px solid ${T.border}`,
                  borderRadius: T.r2, fontSize: 13, color: T.textSecondary, cursor: 'pointer',
                  fontFamily: T.font, textAlign: 'left', fontWeight: 500,
                }}>
                  Schedule delivery →
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: -0.3, margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: T.textMuted, margin: '4px 0 0' }}>
          {currentFarm?.name} · {silos.length} silos · Live data
        </p>
      </div>

      {/* ═══ STATUS STRIP ═══ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {needsAttention === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            background: T.okBg, border: `1px solid ${T.ok}22`, borderRadius: 20,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.ok }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#2D6A4F' }}>
              All {silos.length} silos OK · {onlineSensors}/{silos.length} sensors online · Avg {avgLevel}% fill
            </span>
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
              background: needsAttention > 0 && silos.some(s => s.alert_level === 'critical') ? T.criticalBg : T.warningBg,
              border: `1px solid ${needsAttention > 0 && silos.some(s => s.alert_level === 'critical') ? T.critical : T.warning}22`,
              borderRadius: 20,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: silos.some(s => s.alert_level === 'critical') ? T.critical : T.warning }}>
                {needsAttention} need{needsAttention === 1 ? 's' : ''} attention
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
              background: T.okBg, border: `1px solid ${T.ok}22`, borderRadius: 20,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.ok }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#2D6A4F' }}>{okCount} OK</span>
            </div>
          </>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 20,
          marginLeft: 'auto',
        }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>Total stock:</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.mono }}>{(totalKg / 1000).toFixed(1)} t</span>
        </div>
      </div>

      {/* ═══ AI INSIGHT ═══ */}
      {insight?.insights?.dashboard && !insightDismissed && (
        <div style={{
          background: T.infoBg, border: `1px solid ${T.info}15`,
          borderRadius: T.r3, padding: '16px 18px', marginBottom: 20,
          display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: T.bgCard, border: `1px solid ${T.info}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: T.info,
          }}>◎</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: T.info, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Daily Insight</span>
              <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: `${T.info}18`, color: T.info }}>AI</span>
            </div>
            <p style={{ fontSize: 13.5, color: T.textSecondary, lineHeight: 1.55, margin: 0 }}>{insight.insights.dashboard}</p>
            {insight.insights.critical_action && (
              <div style={{
                marginTop: 10, padding: '8px 12px',
                background: `${T.warning}10`, borderRadius: 8, borderLeft: `2px solid ${T.warning}`,
              }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: T.warning, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action · </span>
                <span style={{ fontSize: 13, color: T.textSecondary }}>{insight.insights.critical_action}</span>
              </div>
            )}
          </div>
          <button onClick={() => setInsightDismissed(true)} style={{
            background: 'none', border: 'none', fontSize: 16, color: T.textMuted,
            cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1,
          }}>×</button>
        </div>
      )}

      {/* ═══ SILO LIST CARD ═══ */}
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: T.r3, boxShadow: T.sh1, overflow: 'hidden',
      }}>
        {/* Filter bar */}
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${T.borderLight}`,
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: T.text, marginRight: 8 }}>Silos</span>
          {[
            { key: 'all',       label: `All (${silos.length})` },
            { key: 'attention', label: `Needs attention (${needsAttention})` },
            { key: 'ok',        label: `OK (${okCount})` },
          ].map(f => {
            const active = filter === f.key
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                  border: 'none', fontWeight: 500, fontFamily: T.font,
                  background: active ? T.text : 'transparent',
                  color: active ? '#fff' : T.textSecondary,
                  transition: 'all 0.15s',
                }}>
                {f.label}
              </button>
            )
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 8, padding: '0 10px',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                style={{
                  border: 'none', outline: 'none', fontSize: 13, color: T.text,
                  background: 'transparent', width: 120, padding: '7px 0', fontFamily: T.font,
                }} />
            </div>
          </div>
        </div>

        {/* Column headers */}
        {filtered.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '190px 1fr 65px 75px 16px',
            gap: 12, padding: '10px 18px', borderBottom: `1px solid ${T.borderLight}`,
          }}>
            {['Silo / Material', 'Level', 'Days', 'Sensor', ''].map(h => (
              <div key={h} style={{
                fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase',
                letterSpacing: '0.5px', fontWeight: 600,
              }}>{h}</div>
            ))}
          </div>
        )}

        {/* Silo rows */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: T.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📡</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: T.text, marginBottom: 8 }}>No silos found</div>
            <div style={{ fontSize: 14 }}>Try changing the filters or search term.</div>
          </div>
        ) : (
          <div>
            {filtered.map((s, i) => {
              const needsAtt = s.alert_level !== 'ok'
              const borderLeft = needsAtt
                ? `3px solid ${s.alert_level === 'critical' ? T.critical : T.warning}`
                : '3px solid transparent'

              return (
                <button key={s.id} onClick={() => setDrawer(s)}
                  style={{
                    display: 'grid', gridTemplateColumns: '190px 1fr 65px 75px 16px',
                    gap: 12, alignItems: 'center',
                    padding: '12px 18px', width: '100%',
                    background: T.bgCard, border: 'none', borderLeft,
                    borderBottom: i < filtered.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                    cursor: 'pointer', textAlign: 'left', fontFamily: T.font,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8FAF9'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.bgCard}
                >
                  {/* Name + Material */}
                  <div>
                    <div style={{
                      fontSize: 14, fontWeight: needsAtt ? 600 : 400,
                      color: needsAtt ? T.text : T.textSecondary,
                      marginBottom: 2,
                    }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>{s.material || '—'}</div>
                  </div>

                  {/* Level bar */}
                  <div style={{ maxWidth: 220 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600, fontFamily: T.mono,
                        color: levelTextColor(s.level_pct),
                      }}>{s.level_pct.toFixed(0)}%</span>
                      <span style={{ fontSize: 12, color: T.textMuted, fontFamily: T.mono }}>
                        {Math.round(s.kg_remaining).toLocaleString()} kg
                      </span>
                    </div>
                    <div style={{ height: 5, background: T.barTrack, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: levelColor(s.level_pct),
                        width: `${s.level_pct}%`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>

                  {/* Days remaining */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: 17, fontWeight: 600, fontFamily: T.mono,
                      color: daysColor(s.days_remaining),
                    }}>{s.days_remaining}</span>
                  </div>

                  {/* Sensor dot */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: s.sensor?.status === 'online' ? T.ok : s.sensor?.status === 'delayed' ? T.warning : T.critical,
                      boxShadow: `0 0 0 3px ${
                        s.sensor?.status === 'online' ? T.okBg :
                        s.sensor?.status === 'delayed' ? T.warningBg : T.criticalBg
                      }`,
                    }} />
                    {s.sensor?.status !== 'online' && (
                      <span style={{ fontSize: 11, color: T.textMuted, textTransform: 'capitalize' }}>
                        {s.sensor?.status || 'None'}
                      </span>
                    )}
                  </div>

                  {/* Chevron */}
                  <div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
