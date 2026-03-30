'use client'
import { useEffect, useState } from 'react'
import { getAlerts, acknowledgeAlert } from '@/lib/queries'
import type { Alert } from '@/lib/types'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAlerts().then(data => {
      setAlerts(data)
      setLoading(false)
    })
  }, [])

  async function handleAck(id: string) {
    const ok = await acknowledgeAlert(id)
    if (ok) {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true, acked_at: new Date().toISOString() } : a))
    }
  }

  async function handleAckAll() {
    const unacked = alerts.filter(a => !a.acknowledged)
    await Promise.all(unacked.map(a => acknowledgeAlert(a.id)))
    setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })))
  }

  const unread = alerts.filter(a => !a.acknowledged).length
  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.type === filter)

  const bgColor = (type: string) => type === 'critical' ? '#FCEBEB' : type === 'warning' ? '#FAEEDA' : '#f7f9f8'
  const iconColor = (type: string) => type === 'critical' ? '#A32D2D' : type === 'warning' ? '#633806' : '#aab8c0'

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#8a9aaa' }}>Loading alerts...</div>
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Alerts</div>
          <div className="page-sub">{unread} unread · {alerts.length} total</div>
        </div>
        <div className="page-actions">
          <button className="btn-outline" onClick={handleAckAll}>Mark all as read</button>
          <button className="btn-primary">+ New alarm rule</button>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Unread</div><div className="sum-val red">{unread}</div><div className="sum-sub">Require attention</div></div>
        <div className="sum-card"><div className="sum-label">Critical</div><div className="sum-val red">{alerts.filter(a => a.type === 'critical').length}</div><div className="sum-sub">Today</div></div>
        <div className="sum-card"><div className="sum-label">Warnings</div><div className="sum-val" style={{ color: '#633806' }}>{alerts.filter(a => a.type === 'warning').length}</div><div className="sum-sub">Today</div></div>
        <div className="sum-card"><div className="sum-label">Total</div><div className="sum-val">{alerts.length}</div><div className="sum-sub">All time</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'critical', 'warning', 'info'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No alerts</div>
          <div style={{ fontSize: 13 }}>All silos are operating normally.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9', borderLeft: !a.acknowledged ? `3px solid ${a.type === 'critical' ? '#E24B4A' : '#EF9F27'}` : '0.5px solid #e8ede9' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: bgColor(a.type), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor(a.type)} strokeWidth="1.5" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: '#aab8c0' }}>
                    {new Date(a.triggered_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {a.message && <div style={{ fontSize: 12, color: '#8a9aaa', lineHeight: 1.5, marginBottom: 6 }}>{a.message}</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: '0.5px solid #e8ede9', color: '#aab8c0', background: '#f7f9f8' }}>{a.type}</span>
                  {a.severity && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: '0.5px solid #e8ede9', color: '#aab8c0', background: '#f7f9f8' }}>{a.severity}</span>}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <button onClick={() => handleAck(a.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, border: '0.5px solid #c8d8cc', background: a.acknowledged ? '#eaf5ee' : 'transparent', color: a.acknowledged ? '#27500A' : '#6a7a8a', cursor: 'pointer' }}>
                  {a.acknowledged ? '✓ Acknowledged' : 'Acknowledge'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
