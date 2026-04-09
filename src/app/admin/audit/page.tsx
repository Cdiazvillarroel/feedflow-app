'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface AuditLog {
  id: string; admin_id: string | null; action: string
  table_name: string | null; record_id: string | null
  old_data: any; new_data: any; created_at: string
}

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  INSERT: { bg: '#eaf5ee', color: '#27500A' },
  UPDATE: { bg: '#E6F1FB', color: '#0C447C' },
  DELETE: { bg: '#FCEBEB', color: '#A32D2D' },
  LOGIN:  { bg: '#FAEEDA', color: '#633806' },
  EXPORT: { bg: '#f0f4f0', color: '#6a7a8a' },
}

export default function AuditLogPage() {
  const [logs,    setLogs]    = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(0)
  const [total,   setTotal]   = useState(0)
  const [selected, setSelected] = useState<AuditLog | null>(null)

  const PAGE_SIZE = 30

  useEffect(() => { loadLogs() }, [page, filter])

  async function loadLogs() {
    setLoading(true)
    let query = supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filter !== 'all') query = query.eq('action', filter)

    const { data, count } = await query
    setLogs(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  async function clearOldLogs() {
    if (!confirm('Delete audit logs older than 90 days?')) return
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('admin_audit_log').delete().lt('created_at', cutoff)
    loadLogs()
  }

  // Helper to write audit log entries
  async function writeLog(action: string, table_name: string, record_id: string, old_data?: any, new_data?: any) {
    await supabase.from('admin_audit_log').insert({ action, table_name, record_id, old_data, new_data })
  }

  const filtered = logs.filter(l =>
    !search ||
    (l.action || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.table_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.record_id || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const actionBadge = (action: string) => {
    const style = ACTION_COLORS[action] || { bg: '#f0f4f0', color: '#6a7a8a' }
    return style
  }

  if (loading && logs.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading audit log...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {/* DETAIL MODAL */}
      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} />
          <div style={{ position: 'fixed', top: '5%', left: '50%', transform: 'translateX(-50%)', width: 640, maxHeight: '90vh', background: '#fff', zIndex: 301, borderRadius: 14, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>Audit entry detail</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>{new Date(selected.created_at).toLocaleString('en-AU')}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 14, color: '#8a9aaa' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[
                  { k: 'Action',     v: selected.action },
                  { k: 'Table',      v: selected.table_name || '—' },
                  { k: 'Record ID',  v: selected.record_id || '—' },
                  { k: 'Admin ID',   v: selected.admin_id ? selected.admin_id.slice(0, 8) + '...' : 'System' },
                  { k: 'Timestamp',  v: new Date(selected.created_at).toLocaleString('en-AU') },
                ].map(r => (
                  <div key={r.k} style={{ background: '#f7f9f8', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{r.k}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', fontFamily: 'monospace' }}>{r.v}</div>
                  </div>
                ))}
              </div>

              {selected.old_data && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#A32D2D', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Before</div>
                  <pre style={{ background: '#FCEBEB', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#A32D2D', overflow: 'auto', margin: 0, fontFamily: 'monospace', lineHeight: 1.5 }}>
                    {JSON.stringify(selected.old_data, null, 2)}
                  </pre>
                </div>
              )}
              {selected.new_data && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#27500A', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>After</div>
                  <pre style={{ background: '#eaf5ee', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#27500A', overflow: 'auto', margin: 0, fontFamily: 'monospace', lineHeight: 1.5 }}>
                    {JSON.stringify(selected.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>Audit Log</div>
          <div style={{ fontSize: 13, color: '#8a9aaa', marginTop: 4 }}>{total} entries · All admin actions recorded</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={clearOldLogs}
            style={{ padding: '8px 14px', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 12, color: '#8a9aaa', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            Clear old logs (90d+)
          </button>
        </div>
      </div>

      {/* SUMMARY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {Object.entries(ACTION_COLORS).map(([action, style]) => {
          const count = logs.filter(l => l.action === action).length
          return (
            <div key={action} style={{ background: style.bg, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', border: `0.5px solid ${style.color}22` }}
              onClick={() => setFilter(filter === action ? 'all' : action)}>
              <div style={{ fontSize: 11, color: style.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{action}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: style.color }}>{count}</div>
            </div>
          )
        })}
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '0 12px', flex: 1, maxWidth: 300 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search action, table, record..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1a2530', background: 'transparent', width: '100%', padding: '9px 0' }} />
        </div>
        {['all', 'INSERT', 'UPDATE', 'DELETE', 'LOGIN'].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(0) }}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
            {f}
          </button>
        ))}
      </div>

      {/* LOG TABLE */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aab8c0', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No audit entries yet</div>
          <div>Actions performed in the admin panel will be recorded here.</div>
        </div>
      ) : (
        <>
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7f9f8' }}>
                  {['Timestamp', 'Action', 'Table', 'Record ID', 'Admin', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 600, padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #e8ede9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => {
                  const badge = actionBadge(log.action)
                  return (
                    <tr key={log.id} onClick={() => setSelected(log)} style={{ cursor: 'pointer', borderBottom: '0.5px solid #f0f4f0' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f7f9f8'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#8a9aaa', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: badge.bg, color: badge.color }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#1a2530', fontFamily: 'monospace' }}>{log.table_name || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#8a9aaa', fontFamily: 'monospace' }}>
                        {log.record_id ? log.record_id.slice(0, 8) + '...' : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#8a9aaa', fontFamily: 'monospace' }}>
                        {log.admin_id ? log.admin_id.slice(0, 8) + '...' : 'System'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>View →</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={{ fontSize: 12, color: '#8a9aaa' }}>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={{ padding: '5px 12px', borderRadius: 6, border: '0.5px solid #e8ede9', background: page === 0 ? '#f7f9f8' : '#fff', color: page === 0 ? '#aab8c0' : '#1a2530', cursor: page === 0 ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                  ← Prev
                </button>
                <span style={{ padding: '5px 12px', fontSize: 12, color: '#6a7a8a' }}>Page {page + 1} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  style={{ padding: '5px 12px', borderRadius: 6, border: '0.5px solid #e8ede9', background: page >= totalPages - 1 ? '#f7f9f8' : '#fff', color: page >= totalPages - 1 ? '#aab8c0' : '#1a2530', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
