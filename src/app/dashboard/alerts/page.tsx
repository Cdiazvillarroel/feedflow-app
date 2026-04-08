'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getAlerts, acknowledgeAlert, getActiveFarmId } from '@/lib/queries'
import type { Alert } from '@/lib/types'

interface AlarmRule {
  id:        string
  farm_id:   string
  silo_id:   string | null
  name:      string
  metric:    string
  operator:  string
  threshold: number
  active:    boolean
  created_at: string
}

interface Silo { id: string; name: string; farm_id: string }
interface Farm { id: string; name: string }

const METRICS = [
  { value: 'level_pct',      label: 'Level (%)' },
  { value: 'kg_remaining',   label: 'Kg remaining' },
  { value: 'days_remaining', label: 'Days remaining' },
  { value: 'battery_pct',    label: 'Battery (%)' },
]
const OPERATORS = [
  { value: 'lt',  label: 'is less than' },
  { value: 'lte', label: 'is less than or equal to' },
  { value: 'gt',  label: 'is greater than' },
  { value: 'gte', label: 'is greater than or equal to' },
  { value: 'eq',  label: 'equals' },
]

function inputStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function labelStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

export default function AlertsPage() {
  const [alerts,    setAlerts]    = useState<Alert[]>([])
  const [rules,     setRules]     = useState<AlarmRule[]>([])
  const [silos,     setSilos]     = useState<Silo[]>([])
  const [filter,    setFilter]    = useState('all')
  const [view,      setView]      = useState<'alerts' | 'rules'>('alerts')
  const [loading,   setLoading]   = useState(true)
  const [drawer,    setDrawer]    = useState<AlarmRule | 'new' | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState('')

  const activeFarmId = getActiveFarmId()
  const emptyForm    = { name: '', silo_id: '', metric: 'level_pct', operator: 'lt', threshold: '20', active: true }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [alertData, rulesData, silosData] = await Promise.all([
      getAlerts(),
      supabase.from('alarm_rules').select('*').order('created_at', { ascending: false }),
      supabase.from('silos').select('id, name, farm_id').order('name'),
    ])
    setAlerts(alertData)
    setRules(rulesData.data || [])
    setSilos(silosData.data || [])
    setLoading(false)
  }

  function showMsg(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  function openNew() {
    setForm(emptyForm)
    setDrawer('new')
  }

  function openEdit(r: AlarmRule) {
    setForm({ name: r.name, silo_id: r.silo_id || '', metric: r.metric, operator: r.operator, threshold: r.threshold.toString(), active: r.active })
    setDrawer(r)
  }

  async function saveRule() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { farm_id: activeFarmId, silo_id: form.silo_id || null, name: form.name.trim(), metric: form.metric, operator: form.operator, threshold: parseFloat(form.threshold) || 0, active: form.active }
    if (drawer && drawer !== 'new') {
      await supabase.from('alarm_rules').update(payload).eq('id', (drawer as AlarmRule).id)
      showMsg('Rule updated')
    } else {
      await supabase.from('alarm_rules').insert(payload)
      showMsg('Rule created')
    }
    setSaving(false)
    setDrawer(null)
    loadAll()
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this alarm rule?')) return
    await supabase.from('alarm_rules').delete().eq('id', id)
    setDrawer(null)
    showMsg('Rule deleted')
    loadAll()
  }

  async function toggleRule(id: string, active: boolean) {
    await supabase.from('alarm_rules').update({ active }).eq('id', id)
    setRules(prev => prev.map(r => r.id === id ? { ...r, active } : r))
  }

  async function handleAck(id: string) {
    const ok = await acknowledgeAlert(id)
    if (ok) setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true, acked_at: new Date().toISOString() } : a))
  }

  async function handleAckAll() {
    await Promise.all(alerts.filter(a => !a.acknowledged).map(a => acknowledgeAlert(a.id)))
    setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })))
  }

  const unread        = alerts.filter(a => !a.acknowledged).length
  const filtered      = filter === 'all' ? alerts : alerts.filter(a => a.type === filter)
  const siloName      = (id: string | null) => id ? silos.find(s => s.id === id)?.name || '—' : 'All silos'
  const metricLabel   = (m: string) => METRICS.find(x => x.value === m)?.label || m
  const operatorLabel = (o: string) => OPERATORS.find(x => x.value === o)?.label || o
  const metricSuffix  = (m: string) => m === 'level_pct' || m === 'battery_pct' ? '%' : m === 'kg_remaining' ? ' kg' : ' days'
  const bgColor       = (type: string) => type === 'critical' ? '#FCEBEB' : type === 'warning' ? '#FAEEDA' : '#f7f9f8'
  const iconColor     = (type: string) => type === 'critical' ? '#A32D2D' : type === 'warning' ? '#633806' : '#aab8c0'
  const isEditing     = drawer && drawer !== 'new'

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#8a9aaa' }}>Loading alerts...</div>

  return (
    <>
      {/* ── DRAWER ───────────────────────────────────────────── */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 420, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>

            {/* Drawer header */}
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>
                  {isEditing ? 'Edit alarm rule' : 'New alarm rule'}
                </div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>
                  {isEditing ? (drawer as AlarmRule).name : 'Configure when to trigger an alert'}
                </div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              <div>
                <label style={labelStyle()}>Rule name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Critical level — Silo R1"
                  style={inputStyle(true)} />
              </div>

              <div>
                <label style={labelStyle()}>Silo (optional)</label>
                <select value={form.silo_id} onChange={e => setForm(p => ({ ...p, silo_id: e.target.value }))}
                  style={{ ...inputStyle(true), background: '#fff' }}>
                  <option value="">All silos (applies to all)</option>
                  {silos.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <p style={{ fontSize: 11, color: '#aab8c0', marginTop: 4 }}>Leave blank to apply this rule to every silo</p>
              </div>

              <div style={{ height: '0.5px', background: '#e8ede9' }} />

              <div>
                <label style={labelStyle()}>Trigger condition</label>
                <div style={{ background: '#f7f9f8', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#8a9aaa', marginBottom: 6 }}>Metric to monitor</div>
                    <select value={form.metric} onChange={e => setForm(p => ({ ...p, metric: e.target.value }))}
                      style={{ ...inputStyle(true), background: '#fff' }}>
                      {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8a9aaa', marginBottom: 6 }}>Condition</div>
                    <select value={form.operator} onChange={e => setForm(p => ({ ...p, operator: e.target.value }))}
                      style={{ ...inputStyle(true), background: '#fff' }}>
                      {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8a9aaa', marginBottom: 6 }}>Threshold value</div>
                    <input type="number" value={form.threshold} onChange={e => setForm(p => ({ ...p, threshold: e.target.value }))}
                      placeholder="e.g. 20" style={inputStyle(true)} />
                  </div>

                  {/* Preview */}
                  <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '0.5px solid #e8ede9' }}>
                    <div style={{ fontSize: 10, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Preview</div>
                    <div style={{ fontSize: 12, color: '#1a2530', lineHeight: 1.6 }}>
                      Trigger alert when <strong>{metricLabel(form.metric)}</strong> {operatorLabel(form.operator)} <strong style={{ color: '#4CAF7D' }}>{form.threshold}{metricSuffix(form.metric)}</strong>
                      {form.silo_id ? <> on <strong>{siloName(form.silo_id)}</strong></> : <> on <strong>any silo</strong></>}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ height: '0.5px', background: '#e8ede9' }} />

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px', borderRadius: 8, border: `0.5px solid ${form.active ? '#4CAF7D' : '#e8ede9'}`, background: form.active ? '#f4fbf7' : '#fff' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
                  style={{ accentColor: '#4CAF7D', width: 16, height: 16 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>Rule active</div>
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Alert will trigger when conditions are met</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: form.active ? '#eaf5ee' : '#f0f4f0', color: form.active ? '#27500A' : '#aab8c0' }}>
                  {form.active ? 'ON' : 'OFF'}
                </div>
              </label>
            </div>

            {/* Drawer footer */}
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={saveRule} disabled={saving || !form.name.trim()}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditing ? 'Update rule' : 'Create rule'}
              </button>
              {isEditing && (
                <button onClick={() => deleteRule((drawer as AlarmRule).id)}
                  style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Delete
                </button>
              )}
              <button onClick={() => setDrawer(null)}
                style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── HEADER ───────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-title">Alerts</div>
          <div className="page-sub">{unread} unread · {alerts.length} total · {rules.filter(r => r.active).length} active rules</div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>✓ {msg}</div>}
          {view === 'alerts' && <button className="btn-outline" onClick={handleAckAll}>Mark all as read</button>}
          <button className="btn-primary" onClick={openNew}>+ New alarm rule</button>
        </div>
      </div>

      {/* ── SUMMARY ──────────────────────────────────────────── */}
      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Unread</div><div className="sum-val red">{unread}</div><div className="sum-sub">Require attention</div></div>
        <div className="sum-card"><div className="sum-label">Critical</div><div className="sum-val red">{alerts.filter(a => a.type === 'critical').length}</div><div className="sum-sub">Today</div></div>
        <div className="sum-card"><div className="sum-label">Warnings</div><div className="sum-val" style={{ color: '#633806' }}>{alerts.filter(a => a.type === 'warning').length}</div><div className="sum-sub">Today</div></div>
        <div className="sum-card"><div className="sum-label">Active rules</div><div className="sum-val green">{rules.filter(r => r.active).length}</div><div className="sum-sub">{rules.length} total</div></div>
      </div>

      {/* ── VIEW TOGGLE ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid #e8ede9' }}>
        {[{ key: 'alerts', label: `Alerts (${alerts.length})` }, { key: 'rules', label: `Alarm rules (${rules.length})` }].map(v => (
          <button key={v.key} onClick={() => setView(v.key as any)}
            style={{ padding: '9px 18px', fontSize: 13, fontWeight: view === v.key ? 600 : 400, cursor: 'pointer', border: 'none', background: 'transparent', fontFamily: 'inherit', color: view === v.key ? '#1a2530' : '#8a9aaa', borderBottom: view === v.key ? '2px solid #4CAF7D' : '2px solid transparent', marginBottom: -1 }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ── ALERTS VIEW ──────────────────────────────────────── */}
      {view === 'alerts' && (
        <>
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor(a.type)} strokeWidth="1.5" strokeLinecap="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
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
      )}

      {/* ── RULES VIEW ───────────────────────────────────────── */}
      {view === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No alarm rules yet</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Create rules to get notified when silo levels drop.</div>
              <button onClick={openNew} className="btn-primary">+ Create first rule</button>
            </div>
          ) : rules.map(r => (
            <div key={r.id} onClick={() => openEdit(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9', borderLeft: `3px solid ${r.active ? '#4CAF7D' : '#e8ede9'}`, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: r.active ? '#eaf5ee' : '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={r.active ? '#4CAF7D' : '#aab8c0'} strokeWidth="1.5" strokeLinecap="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', marginBottom: 3 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#8a9aaa' }}>
                  {siloName(r.silo_id)} · {metricLabel(r.metric)} {operatorLabel(r.operator)} <strong>{r.threshold}{metricSuffix(r.metric)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => toggleRule(r.id, !r.active)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${r.active ? '#4CAF7D' : '#e8ede9'}`, background: r.active ? '#eaf5ee' : '#fff', color: r.active ? '#27500A' : '#aab8c0', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {r.active ? 'Active' : 'Inactive'}
                </button>
                <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
