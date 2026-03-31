'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getActiveFarmId } from '@/lib/queries'

type InsightKey = 'dashboard' | 'alerts' | 'analytics' | 'forecast' | 'costs' | 'animals' | 'sensors'

interface Props {
  page: InsightKey
}

export default function AIInsightCard({ page }: Props) {
  const [text,      setText]      = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const farmId = getActiveFarmId()
      const { data, error } = await supabase
        .from('ai_insights')
        .select('insights, updated_at')
        .eq('farm_id', farmId)
        .single()

      if (error || !data) { setLoading(false); return }

      const insight = data.insights?.[page]
      if (insight) {
        setText(insight)
        setUpdatedAt(data.updated_at)
      }
      setLoading(false)
    }
    load()
  }, [page])

  if (loading || !text) return null

  const timeLabel = updatedAt
    ? new Date(updatedAt).toLocaleString('en-AU', {
        timeZone: 'Australia/Melbourne',
        hour: '2-digit', minute: '2-digit',
        day: 'numeric', month: 'short',
      })
    : null

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#f7f9f8', border: '0.5px solid #e8ede9',
          borderRadius: 8, padding: '9px 14px', marginBottom: 20,
          cursor: 'pointer',
        }}
      >
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4CAF7D', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: '#6a7a8a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <strong style={{ color: '#1a2530' }}>AI Insight</strong> · {text.substring(0, 90)}{text.length > 90 ? '...' : ''}
        </span>
        <span style={{ fontSize: 11, color: '#aab8c0', flexShrink: 0 }}>▼ expand</span>
      </div>
    )
  }

  return (
    <div style={{
      background: '#1a2530', borderRadius: 10, padding: '14px 18px',
      marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: 'rgba(76,175,125,0.15)', border: '0.5px solid rgba(76,175,125,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#4CAF7D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            AI Insight · {page.charAt(0).toUpperCase() + page.slice(1)}
          </span>
          {timeLabel && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>Updated {timeLabel}</span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, margin: 0 }}>
          {text}
        </p>
      </div>
      <button
        onClick={() => setCollapsed(true)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: 'rgba(255,255,255,0.28)',
          flexShrink: 0, padding: '2px 0', marginTop: 2, fontFamily: 'inherit',
        }}
      >
        ▲ collapse
      </button>
    </div>
  )
}
