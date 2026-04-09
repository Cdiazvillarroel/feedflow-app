'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TABLES = [
  { name: 'clients',          icon: '🏢', desc: 'Client accounts'        },
  { name: 'plans',            icon: '📋', desc: 'Subscription plans'     },
  { name: 'farms',            icon: '🌾', desc: 'Farm records'           },
  { name: 'silos',            icon: '🏗️', desc: 'Silo inventory'         },
  { name: 'sensors',          icon: '📡', desc: 'IoT sensors'            },
  { name: 'readings',         icon: '📊', desc: 'Sensor readings'        },
  { name: 'alerts',           icon: '🔔', desc: 'System alerts'          },
  { name: 'alarm_rules',      icon: '⚙️', desc: 'Alarm rules'            },
  { name: 'animal_groups',    icon: '🐄', desc: 'Animal groups'          },
  { name: 'feeds',            icon: '🌾', desc: 'Feed library'           },
  { name: 'feed_prices',      icon: '💰', desc: 'Feed prices'            },
  { name: 'feed_mills',       icon: '🏭', desc: 'Feed mills'             },
  { name: 'contacts',         icon: '👤', desc: 'Farm contacts'          },
  { name: 'delivery_orders',  icon: '📦', desc: 'Delivery orders'        },
  { name: 'delivery_routes',  icon: '🗺️', desc: 'Delivery routes'        },
  { name: 'drivers',          icon: '🚛', desc: 'Drivers'                },
  { name: 'trucks',           icon: '🚚', desc: 'Trucks'                 },
  { name: 'ai_insights',      icon: '🤖', desc: 'AI insights'            },
  { name: 'client_modules',   icon: '🔧', desc: 'Module permissions'     },
  { name: 'client_users',     icon: '👥', desc: 'Client users'           },
  { name: 'roles',            icon: '🔑', desc: 'User roles'             },
  { name: 'invoices',         icon: '💳', desc: 'Invoices'               },
  { name: 'admin_audit_log',  icon: '📋', desc: 'Audit log'              },
]

interface QueryResult { columns: string[]; rows: any[]; count: number; error?: string; duration: number }

export default function DatabasePage() {
  const [selectedTable, setSelectedTable]   = useState<string>('clients')
  const [tableData,     setTableData]       = useState<QueryResult | null>(null)
  const [loading,       setLoading]         = useState(false)
  const [tableCounts,   setTableCounts]     = useState<Record<string, number>>({})
  const [search,        setSearch]          = useState('')
  const [page,          setPage]            = useState(0)
  const [editRow,       setEditRow]         = useState<any | null>(null)
  const [editData,      setEditData]        = useState<Record<string, any>>({})
  const [saving,        setSaving]          = useState(false)
  const [msg,           setMsg]             = useState('')
  const [sqlMode,       setSqlMode]         = useState(false)
  const [sqlQuery,      setSqlQuery]        = useState('')
  const [sqlResult,     setSqlResult]       = useState<any>(null)
  const [sqlLoading,    setSqlLoading]      = useState(false)

  const PAGE_SIZE = 20

  useEffect(() => { loadCounts() }, [])
  useEffect(() => { if (!sqlMode) loadTable(selectedTable) }, [selectedTable, page])

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function loadCounts() {
    const counts: Record<string, number> = {}
    await Promise.all(TABLES.map(async t => {
      const { count } = await supabase.from(t.name).select('*', { count: 'exact', head: true })
      counts[t.name] = count || 0
    }))
    setTableCounts(counts)
  }

  async function loadTable(table: string) {
    setLoading(true)
    const start = Date.now()
    let query = supabase.from(table).select('*', { count: 'exact' })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .order('created_at', { ascending: false })

    const { data, error, count } = await query
    const duration = Date.now() - start

    if (error) {
      setTableData({ columns: [], rows: [], count: 0, error: error.message, duration })
    } else {
      const rows    = data || []
      const columns = rows.length > 0 ? Object.keys(rows[0]) : []
      setTableData({ columns, rows, count: count || 0, duration })
    }
    setLoading(false)
  }

  async function runSQL() {
    if (!sqlQuery.trim()) return
    setSqlLoading(true)
    const start = Date.now()
    // Only allow SELECT for safety
    const trimmed = sqlQuery.trim().toLowerCase()
    if (!trimmed.startsWith('select')) {
      setSqlResult({ error: 'Only SELECT queries are allowed in this interface. Use the table editor for modifications.', duration: 0 })
      setSqlLoading(false)
      return
    }
    const { data, error } = await supabase.rpc('exec_sql', { query: sqlQuery }).catch(() => ({ data: null, error: { message: 'SQL execution not available. Use the table editor instead.' } }))
    const duration = Date.now() - start
    setSqlResult({ data, error: error?.message, duration })
    setSqlLoading(false)
  }

  async function saveEdit() {
    if (!editRow) return
    setSaving(true)
    const { error } = await supabase.from(selectedTable).update(editData).eq('id', editRow.id)
    if (error) showMsg('Error: ' + error.message)
    else { showMsg('Row updated'); setEditRow(null); loadTable(selectedTable) }
    setSaving(false)
  }

  async function deleteRow(id: string) {
    if (!confirm('Delete this row? This cannot be undone.')) return
    const { error } = await supabase.from(selectedTable).delete().eq('id', id)
    if (error) showMsg('Error: ' + error.message)
    else { showMsg('Row deleted'); loadTable(selectedTable); loadCounts() }
  }

  function openEdit(row: any) {
    setEditRow(row)
    setEditData({ ...row })
  }

  const filteredTables = TABLES.filter(t => !search || t.name.includes(search.toLowerCase()))

  function formatCell(val: any): string {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'object') return JSON.stringify(val).slice(0, 80)
    const str = String(val)
    return str.length > 60 ? str.slice(0, 60) + '...' : str
  }

  const totalPages = tableData ? Math.ceil(tableData.count / PAGE_SIZE) : 0

  return (
    <>
      {/* EDIT ROW MODAL */}
      {editRow && (
        <>
          <div onClick={() => setEditRow(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} />
          <div style={{ position: 'fixed', top: '5%', left: '50%', transform: 'translateX(-50%)', width: 600, maxHeight: '90vh', background: '#fff', zIndex: 301, borderRadius: 14, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>Edit row — {selectedTable}</div>
              <button onClick={() => setEditRow(null)} style={{ width: 28, height: 28, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 14, color: '#8a9aaa' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.keys(editData).map(key => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{key}</label>
                  {key === 'id' || key === 'created_at' || key === 'updated_at' ? (
                    <div style={{ padding: '8px 10px', background: '#f7f9f8', borderRadius: 7, fontSize: 12, color: '#aab8c0', fontFamily: 'monospace' }}>{String(editData[key] || '—')}</div>
                  ) : typeof editData[key] === 'boolean' ? (
                    <select value={String(editData[key])} onChange={e => setEditData(p => ({ ...p, [key]: e.target.value === 'true' }))}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none' }}>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : typeof editData[key] === 'object' && editData[key] !== null ? (
                    <textarea
                      value={JSON.stringify(editData[key], null, 2)}
                      onChange={e => { try { setEditData(p => ({ ...p, [key]: JSON.parse(e.target.value) })) } catch {} }}
                      rows={4}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 12, color: '#1a2530', background: '#fff', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                  ) : (
                    <input
                      value={editData[key] ?? ''}
                      onChange={e => setEditData(p => ({ ...p, [key]: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={saveEdit} disabled={saving}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button onClick={() => setEditRow(null)}
                style={{ padding: '10px 16px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>Database</div>
          <div style={{ fontSize: 13, color: '#8a9aaa', marginTop: 4 }}>{TABLES.length} tables · Direct data access</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {msg && <div style={{ padding: '7px 14px', background: msg.includes('Error') ? '#FCEBEB' : '#eaf5ee', border: '0.5px solid ' + (msg.includes('Error') ? '#F09595' : '#4CAF7D'), borderRadius: 8, fontSize: 12, fontWeight: 600, color: msg.includes('Error') ? '#A32D2D' : '#27500A' }}>{msg}</div>}
          <button onClick={() => setSqlMode(!sqlMode)}
            style={{ padding: '8px 16px', background: sqlMode ? '#1a2530' : '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, fontSize: 12, fontWeight: 600, color: sqlMode ? '#fff' : '#6a7a8a', cursor: 'pointer', fontFamily: 'inherit' }}>
            {sqlMode ? '← Table view' : 'SQL Console →'}
          </button>
        </div>
      </div>

      {sqlMode ? (
        /* SQL CONSOLE */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#1a2530', borderRadius: 12, padding: '16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>SQL Console — SELECT only</div>
            <textarea value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} rows={6} placeholder="SELECT * FROM clients WHERE status = 'active' LIMIT 10;"
              style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, color: '#fff', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Only SELECT queries are permitted for safety</div>
              <button onClick={runSQL} disabled={sqlLoading || !sqlQuery.trim()}
                style={{ padding: '8px 20px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {sqlLoading ? 'Running...' : '▶ Run'}
              </button>
            </div>
          </div>

          {sqlResult && (
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #e8ede9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f9f8' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: sqlResult.error ? '#A32D2D' : '#27500A' }}>
                  {sqlResult.error ? '✕ Error' : `✓ ${(sqlResult.data || []).length} rows · ${sqlResult.duration}ms`}
                </span>
              </div>
              {sqlResult.error ? (
                <div style={{ padding: 16, fontSize: 13, color: '#A32D2D', fontFamily: 'monospace' }}>{sqlResult.error}</div>
              ) : sqlResult.data && sqlResult.data.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f7f9f8' }}>
                        {Object.keys(sqlResult.data[0]).map((col: string) => (
                          <th key={col} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#aab8c0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #e8ede9', whiteSpace: 'nowrap' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sqlResult.data.map((row: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '0.5px solid #f0f4f0' }}>
                          {Object.values(row).map((val: any, j: number) => (
                            <td key={j} style={{ padding: '8px 12px', color: '#1a2530', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatCell(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 16, fontSize: 13, color: '#aab8c0' }}>No results returned.</div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* TABLE VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
          {/* TABLE LIST */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', overflow: 'hidden', height: 'fit-content' }}>
            <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #e8ede9' }}>
              <input type="text" placeholder="Filter tables..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e8ede9', borderRadius: 6, fontSize: 12, color: '#1a2530', background: '#f7f9f8', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {filteredTables.map(t => {
              const isActive = selectedTable === t.name
              return (
                <div key={t.name} onClick={() => { setSelectedTable(t.name); setPage(0) }}
                  style={{ padding: '10px 14px', borderBottom: '0.5px solid #f0f4f0', cursor: 'pointer', background: isActive ? '#f4fbf7' : '#fff', borderLeft: isActive ? '3px solid #4CAF7D' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#f7f9f8' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#fff' }}>
                  <span style={{ fontSize: 14 }}>{t.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: '#1a2530', fontFamily: 'monospace' }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: '#aab8c0' }}>{tableCounts[t.name] || 0} rows</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* TABLE DATA */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1a2530', fontFamily: 'monospace' }}>{selectedTable}</span>
                {tableData && <span style={{ fontSize: 12, color: '#8a9aaa', marginLeft: 10 }}>{tableData.count} rows · {tableData.duration}ms</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => loadTable(selectedTable)}
                  style={{ padding: '6px 12px', border: '0.5px solid #c8d8cc', borderRadius: 6, fontSize: 11, color: '#6a7a8a', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ↻ Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#8a9aaa', fontSize: 13 }}>
                <div style={{ width: 20, height: 20, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 10 }} />
                Loading...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : tableData?.error ? (
              <div style={{ padding: 20, background: '#FCEBEB', borderRadius: 10, fontSize: 13, color: '#A32D2D', fontFamily: 'monospace' }}>{tableData.error}</div>
            ) : tableData && tableData.rows.length > 0 ? (
              <>
                <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f7f9f8' }}>
                          {tableData.columns.map(col => (
                            <th key={col} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#aab8c0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #e8ede9', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{col}</th>
                          ))}
                          <th style={{ padding: '10px 12px', borderBottom: '0.5px solid #e8ede9', width: 80 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.rows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '0.5px solid #f0f4f0' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f7f9f8'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}>
                            {tableData.columns.map(col => (
                              <td key={col} style={{ padding: '10px 12px', color: row[col] === null ? '#aab8c0' : '#1a2530', fontFamily: 'monospace', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {formatCell(row[col])}
                              </td>
                            ))}
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => openEdit(row)}
                                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '0.5px solid #c8d8cc', background: '#fff', color: '#4A90C4', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                                  Edit
                                </button>
                                {row.id && (
                                  <button onClick={() => deleteRow(row.id)}
                                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '0.5px solid #F09595', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                                    Del
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PAGINATION */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '0 4px' }}>
                    <span style={{ fontSize: 12, color: '#8a9aaa' }}>
                      Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, tableData.count)} of {tableData.count}
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
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aab8c0', fontSize: 13 }}>
                No data in this table.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
