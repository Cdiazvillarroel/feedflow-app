'use client'
import { useState } from 'react'

const ALERTS = [
  { id: 1, type: 'critical', title: 'Silo 1 — Critical level', desc: 'Level at 12%. Approximately 4 days of feed remaining. Immediate order recommended.', silo: 'Silo 1', channel: 'Telegram + Email', time: '06:14', unread: true },
  { id: 2, type: 'critical', title: 'Silo 2 — Critical level', desc: 'Level at 18%. Approximately 6 days remaining. Schedule delivery within 2 days.', silo: 'Silo 2', channel: 'Telegram + Email', time: '06:14', unread: true },
  { id: 3, type: 'warning', title: 'Silo 3 — Low level', desc: 'Level dropped to 28%, below the 30% warning threshold. 9 days of feed remaining.', silo: 'Silo 3', channel: 'Email', time: '04:02', unread: true },
  { id: 4, type: 'warning', title: 'Silo 4 — Low level', desc: 'Level at 35%, approaching warning threshold. Monitor closely over next 48 hours.', silo: 'Silo 4', channel: 'Email', time: '04:02', unread: true },
  { id: 5, type: 'warning', title: 'Silo 5 — Delayed reading', desc: 'Last reading was 6 hours ago instead of the expected 2-hour interval.', silo: 'Silo 5', channel: 'Email', time: '02:30', unread: true },
  { id: 6, type: 'info', title: 'Silo 8 — Delivery registered', desc: 'Level jumped from 42% to 67%. A delivery of approximately 7,000 kg was detected.', silo: 'Silo 8', channel: 'System', time: 'Yesterday 18:45', unread: false },
  { id: 7, type: 'info', title: 'Silo 11 — Delivery registered', desc: 'Level jumped from 38% to 78%. A delivery of approximately 11,200 kg was detected.', silo: 'Silo 11', channel: 'System', time: 'Yesterday 17:20', unread: false },
  { id: 8, type: 'info', title: 'Weekly summary', desc: 'Average farm level: 61%. 3 silos below 40%. 2 deliveries registered this week.', silo: 'All silos', channel: 'Email', time: 'Yesterday 08:00', unread: false },
]

export default function AlertsPage() {
  const [filter, setFilter] = useState('all')
  const [acked, setAcked] = useState<Set<number>>(new Set())

  const unread = ALERTS.filter(a => a.unread && !acked.has(a.id)).length
  const filtered = filter === 'all' ? ALERTS : ALERTS.filter(a => a.type === filter || (filter === 'warning' && a.type === 'warning'))

  const iconColor = (type: string) => type === 'critical' ? '#A32D2D' : type === 'warning' ? '#633806' : '#aab8c0'
  const bgColor = (type: string) => type === 'critical' ? '#FCEBEB' : type === 'warning' ? '#FAEEDA' : '#f7f9f8'

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Alerts</div>
          <div className="page-sub">{unread} unread · Telegram connected</div>
        </div>
        <div className="page-actions">
          <button className="btn-outline" onClick={() => setAcked(new Set(ALERTS.map(a => a.id)))}>Mark all as read</button>
          <button className="btn-primary">+ New alarm</button>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Unread</div><div className="sum-val red">{unread}</div><div className="sum-sub">Require attention</div></div>
        <div className="sum-card"><div className="sum-label">Critical today</div><div className="sum-val red">2</div><div className="sum-sub">Silos 1 & 2</div></div>
        <div className="sum-card"><div className="sum-label">Warnings today</div><div className="sum-val" style={{ color: '#633806' }}>3</div><div className="sum-sub">Silos 3, 4 & 5</div></div>
        <div className="sum-card"><div className="sum-label">Sent via Telegram</div><div className="sum-val">18</div><div className="sum-sub">Last 7 days</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'critical', 'warning', 'info'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(a => {
          const isUnread = a.unread && !acked.has(a.id)
          return (
            <div key={a.id} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: '#fff', borderRadius: 8, border: `0.5px solid #e8ede9`, borderLeft: isUnread ? `3px solid ${a.type === 'critical' ? '#E24B4A' : '#EF9F27'}` : '0.5px solid #e8ede9' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: bgColor(a.type), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor(a.type)} strokeWidth="1.5" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: '#aab8c0' }}>{a.time}</div>
                </div>
                <div style={{ fontSize: 12, color: '#8a9aaa', lineHeight: 1.5, marginBottom: 6 }}>{a.desc}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[a.type, a.silo, a.channel].map(tag => (
                    <span key={tag} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: '0.5px solid #e8ede9', color: '#aab8c0', background: '#f7f9f8' }}>{tag}</span>
                  ))}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <button onClick={() => setAcked(prev => new Set([...prev, a.id]))} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, border: '0.5px solid #c8d8cc', background: acked.has(a.id) ? '#eaf5ee' : 'transparent', color: acked.has(a.id) ? '#27500A' : '#6a7a8a', cursor: 'pointer' }}>
                  {acked.has(a.id) ? '✓ Acknowledged' : 'Acknowledge'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
