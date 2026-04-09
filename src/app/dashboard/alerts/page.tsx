'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

interface Alert {
  id: string; farm_id: string; silo_id: string | null; type: string; severity: string
  title: string; message: string | null; acknowledged: boolean
  triggered_at: string; acked_at: string | null; acked_by: string | null
}

interface AlarmRule {
  id: string; farm_id: string; silo_id: string | null; name: string
  trigger_type: string; threshold_pct: number; channel: string
  contact_ids: string[]; active: boolean; created_at: string
}

interface Contact {
  id: string; farm_id: string; name: string; position: string | null
  phone: string | null; email: string | null; telegram_id: string | null; active: boolean
}

interface Silo { id: string; name: string; farm_id: string }
interface Farm { id: string; name: string }

const TRIGGER_TYPES = [
  { value: 'level_below',    label: 'Level below threshold' },
  { value: 'level_above',    label: 'Level above threshold' },
  { value: 'sensor_offline', label: 'Sensor offline'        },
  { value: 'no_reading',     label: 'No reading received'   },
]

const SEVERITIES = [
  { value: 'critical', label: 'Critical', color: '#A32D2D', bg: '#FCEBEB' },
  { value: 'high',     label: 'High',     color: '#633806', bg: '#FAEEDA' },
  { value: 'medium',   label: 'Medium',   color: '#0C447C', bg: '#E6F1FB' },
  { value: 'low',      label: 'Low',      color: '#27500A', bg: '#eaf5ee' },
]

const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'sms',   label: 'SMS'   },
  { value: 'push',  label: 'Push'  },
]

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}
function SectionTitle({ title }: { title: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0 8px', borderBottom: '0.5px solid #e8ede9', marginBottom: 12 }}>{title}</div>
}

export default function AlertsPage() {
  const { currentFarm } = useFarm()
  const farmId = currentFarm?.id || ''

  const [alerts,        setAlerts]        = useState<Alert[]>([])
  const [rules,         setRules]         = useState<AlarmRule[]>([])
  const [contacts,      setContacts]      = useState<Contact[]>([])
  const [silos,         setSilos]         = useState<Silo[]>([])
  const [farms,         setFarms]         = useState<Farm[]>([])
  const [filter,        setFilter]        = useState('all')
  const [view,          setView]          = useState<'alerts' | 'rules' | 'contacts'>('alerts')
  const [loading,       setLoading]       = useState(true)
  const [drawer,        setDrawer]        = useState<AlarmRule | 'new' | null>(null)
  const [contactDrawer, setContactDrawer] = useState<Contact | 'new' | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [msg,           setMsg]           = useState('')

  const emptyRule = {
    name: '', farm_id: farmId, silo_id: '', trigger_type: 'level_below',
    threshold_pct: '20', channel: 'email', active: true, contact_ids: [] as string[],
  }
  const emptyContact = {
    name: '', position: '', phone: '', email: '', telegram_id: '', farm_id: farmId, active: true,
  }

  const [ruleForm,    setRuleForm]    = useState(emptyRule)
  const [contactForm, setContactForm] = useState(emptyContact)

  useEffect(() => { if (farmId) loadAll() }, [farmId])

  async function loadAll() {
    setLoading(true)
    const [alertsR, rulesR, silosR, farmsR, contactsR] = await Promise.all([
      supabase.from('alerts').select('*').eq('farm_id', farmId).order('triggered_at', { ascending: false }),
      supabase.from('alarm_rules').select('*').eq('farm_id', farmId).order('created_at', { ascending: false }),
      supabase.from('silos').select('id, name, farm_id').eq('farm_id', farmId).order('name'),
      supabase.from('farms').select('id, name').order('name'),
      supabase.from('contacts').select('*').eq('farm_id', farmId).order('name'),
    ])
    setAlerts(alertsR.data || [])
    setRules(rulesR.data || [])
    setSilos(silosR.data || [])
    setFarms(farmsR.data || [])
    setContacts(contactsR.data || [])
    setLoading(false)
  }

  function showMsg(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  function openNewRule() { setRuleForm({ ...emptyRule, farm_id: farmId }); setDrawer('new') }
  function openEditRule(r: AlarmRule) {
    setRuleForm({
      name: r.name, farm_id: r.farm_id, silo_id: r.silo_id || '',
      trigger_type: r.trigger_type, threshold_pct: r.threshold_pct.toString(),
      channel: r.channel, active: r.active, contact_ids: r.contact_ids || [],
    })
    setDrawer(r)
  }

  async function saveRule() {
    if (!ruleForm.name.trim()) return
    setSaving(true)
    const payload = {
      farm_id: ruleForm.farm_id || farmId,
      silo_id: ruleForm.silo_id || null,
      name: ruleForm.name.trim(),
      trigger_type: ruleForm.trigger_type,
      threshold_pct: parseFloat(ruleForm.threshold_pct) || 0,
      channel: ruleForm.channel,
      active: ruleForm.active,
      contact_ids: ruleForm.contact_ids,
    }
    if (drawer && drawer !== 'new') {
      await supabase.from('alarm_rules').update(payload).eq('id', (drawer as AlarmRule).id)
      showMsg('Rule updated')
    } else {
      await supabase.from('alarm_rules').insert(payload)
      showMsg('Rule created')
    }
    setSaving(false); setDrawer(null); loadAll()
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this alarm rule?')) return
    await supabase.from('alarm_rules').delete().eq('id', id)
    setDrawer(null); showMsg('Rule deleted'); loadAll()
  }

  async function toggleRule(id: string, active: boolean) {
    await supabase.from('alarm_rules').update({ active }).eq('id', id)
    setRules(prev => prev.map(r => r.id === id ? { ...r, active } : r))
  }

  function openNewContact() { setContactForm({ ...emptyContact, farm_id: farmId }); setContactDrawer('new') }
  function openEditContact(c: Contact) {
    setContactForm({ name: c.name, position: c.position || '', phone: c.phone || '', email: c.email || '', telegram_id: c.telegram_id || '', farm_id: c.farm_id, active: c.active })
    setContactDrawer(c)
  }

  async function saveContact() {
    if (!contactForm.name.trim()) return
    setSaving(true)
    const payload = { farm_id: contactForm.farm_id || farmId, name: contactForm.name.trim(), position: contactForm.position || null, phone: contactForm.phone || null, email: contactForm.email || null, telegram_id: contactForm.telegram_id || null, active: contactForm.active }
    if (contactDrawer && contactDrawer !== 'new') {
      await supabase.from('contacts').update(payload).eq('id', (contactDrawer as Contact).id)
      showMsg('Contact updated')
    } else {
      await supabase.from('contacts').insert(payload)
      showMsg('Contact created')
    }
    setSaving(false); setContactDrawer(null); loadAll()
  }

  async function deleteContact(id: string) {
    if (!confirm('Delete this contact?')) return
    await supabase.from('contacts').delete().eq('id', id)
    setContactDrawer(null); showMsg('Contact deleted'); loadAll()
  }

  async function handleAck(id: string) {
    await supabase.from('alerts').update({ acknowledged: true, acked_at: new Date().toISOString() }).eq('id', id)
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true, acked_at: new Date().toISOString() } : a))
  }

  async function handleAckAll() {
    const ids = alerts.filter(a => !a.acknowledged).map(a => a.id)
    for (const id of ids) await supabase.from('alerts').update({ acknowledged: true, acked_at: new Date().toISOString() }).eq('id', id)
    setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })))
  }

  const unread       = alerts.filter(a => !a.acknowledged).length
  const filtered     = filter === 'all' ? alerts : alerts.filter(a => a.type === filter)
  const siloName     = (id: string | null) => id ? silos.find(s => s.id === id)?.name || '—' : 'All silos'
  const sevInfo      = (s: string) => SEVERITIES.find(x => x.value === s) || SEVERITIES[1]
  const bgColor      = (type: string) => type === 'critical' ? '#FCEBEB' : type === 'warning' ? '#FAEEDA' : '#f7f9f8'
  const iconColor    = (type: string) => type === 'critical' ? '#A32D2D' : type === 'warning' ? '#633806' : '#aab8c0'
  const triggerLabel = (t: string) => TRIGGER_TYPES.find(x => x.value === t)?.label || t
  const contactName  = (id: string) => contacts.find(c => c.id === id)?.name || '—'
  const isEditingRule    = drawer && drawer !== 'new'
  const isEditingContact = contactDrawer && contactDrawer !== 'new'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading alerts...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {/* RULE DRAWER */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditingRule ? 'Edit alarm rule' : 'New alarm rule'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>{currentFarm?.name}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionTitle title="Rule details" />
              <div>
                <label style={lStyle()}>Rule name *</label>
                <input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Critical level alert" style={iStyle(true)} />
              </div>

              <SectionTitle title="Trigger" />
              <div>
                <label style={lStyle()}>Silo (optional)</label>
                <select value={ruleForm.silo_id} onChange={e => setRuleForm(p => ({ ...p, silo_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">All silos</option>
                  {silos.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lStyle()}>Trigger type</label>
                <select value={ruleForm.trigger_type} onChange={e => setRuleForm(p => ({ ...p, trigger_type: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {(ruleForm.trigger_type === 'level_below' || ruleForm.trigger_type === 'level_above') && (
                <div>
                  <label style={lStyle()}>Threshold (%)</label>
                  <input type="number" value={ruleForm.threshold_pct} onChange={e => setRuleForm(p => ({ ...p, threshold_pct: e.target.value }))} placeholder="e.g. 20" style={iStyle(true)} min="0" max="100" />
                </div>
              )}

              <SectionTitle title="Notification" />
              <div>
                <label style={lStyle()}>Channel</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {CHANNELS.map(c => (
                    <button key={c.value} onClick={() => setRuleForm(p => ({ ...p, channel: c.value }))}
                      style={{ flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid ' + (ruleForm.channel === c.value ? '#4CAF7D88' : '#e8ede9'), background: ruleForm.channel === c.value ? '#eaf5ee' : '#fff', color: ruleForm.channel === c.value ? '#27500A' : '#8a9aaa' }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={lStyle()}>Notify contacts</label>
                  <span style={{ fontSize: 11, color: '#aab8c0' }}>{contacts.length} available</span>
                </div>
                {contacts.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#aab8c0', padding: '12px', background: '#f7f9f8', borderRadius: 8, textAlign: 'center' }}>
                    No contacts for this farm. Add them in the Contacts tab.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {contacts.map(c => {
                      const checked = ruleForm.contact_ids.includes(c.id)
                      return (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (checked ? '#4CAF7D' : '#e8ede9'), background: checked ? '#f4fbf7' : '#fff', cursor: 'pointer' }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setRuleForm(p => ({
                              ...p,
                              contact_ids: checked
                                ? p.contact_ids.filter(id => id !== c.id)
                                : [...p.contact_ids, c.id]
                            }))}
                            style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: '#1a2530' }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>
                              {[c.position, c.email, c.telegram_id ? 'Telegram: ' + c.telegram_id : null].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {c.email       && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#E6F1FB', color: '#0C447C', fontWeight: 600 }}>EMAIL</span>}
                            {c.telegram_id && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#eaf5ee', color: '#27500A', fontWeight: 600 }}>TG</span>}
                            {c.phone       && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#f0f4f0', color: '#6a7a8a', fontWeight: 600 }}>PHONE</span>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px', borderRadius: 8, border: '0.5px solid ' + (ruleForm.active ? '#4CAF7D' : '#e8ede9'), background: ruleForm.active ? '#f4fbf7' : '#fff' }}>
                <input type="checkbox" checked={ruleForm.active} onChange={e => setRuleForm(p => ({ ...p, active: e.target.checked }))} style={{ accentColor: '#4CAF7D', width: 16, height: 16 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>Rule active</div>
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>Alert will trigger when conditions are met</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: ruleForm.active ? '#eaf5ee' : '#f0f4f0', color: ruleForm.active ? '#27500A' : '#aab8c0' }}>
                  {ruleForm.active ? 'ON' : 'OFF'}
                </div>
              </label>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={saveRule} disabled={saving || !ruleForm.name.trim()}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditingRule ? 'Update rule' : 'Create rule'}
              </button>
              {isEditingRule && <button onClick={() => deleteRule((drawer as AlarmRule).id)} style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}
              <button onClick={() => setDrawer(null)} style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* CONTACT DRAWER */}
      {contactDrawer && (
        <>
          <div onClick={() => setContactDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 420, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {contactForm.name ? contactForm.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditingContact ? 'Edit contact' : 'New contact'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>{currentFarm?.name}</div>
              </div>
              <button onClick={() => setContactDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={lStyle()}>Full name *</label><input style={iStyle(true)} value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} placeholder="James Mitchell" /></div>
              <div><label style={lStyle()}>Position / Role</label><input style={iStyle(true)} value={contactForm.position} onChange={e => setContactForm(p => ({ ...p, position: e.target.value }))} placeholder="Farm Manager" /></div>
              <div><label style={lStyle()}>Phone</label><input style={iStyle(true)} value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} placeholder="+61 400 000 000" type="tel" /></div>
              <div style={{ height: '0.5px', background: '#e8ede9' }} />
              <div><label style={lStyle()}>Email</label><input style={iStyle(true)} value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} placeholder="manager@farm.com" type="email" /></div>
              <div><label style={lStyle()}>Telegram ID</label><input style={iStyle(true)} value={contactForm.telegram_id} onChange={e => setContactForm(p => ({ ...p, telegram_id: e.target.value }))} placeholder="@username or chat ID" /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (contactForm.active ? '#4CAF7D' : '#e8ede9'), background: contactForm.active ? '#f4fbf7' : '#fff' }}>
                <input type="checkbox" checked={contactForm.active} onChange={e => setContactForm(p => ({ ...p, active: e.target.checked }))} style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>Active contact</div>
                  <div style={{ fontSize: 11, color: '#aab8c0' }}>Will receive alert notifications</div>
                </div>
              </label>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={saveContact} disabled={saving || !contactForm.name.trim()}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditingContact ? 'Update contact' : 'Create contact'}
              </button>
              {isEditingContact && <button onClick={() => deleteContact((contactDrawer as Contact).id)} style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}
              <button onClick={() => setContactDrawer(null)} style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* HEADER */}
      <div className="page-header">
        <div>
          <div className="page-title">Alerts</div>
          <div className="page-sub">{currentFarm?.name} · {unread} unread · {alerts.length} total · {rules.filter(r => r.active).length} active rules</div>
        </div>
        <div className="page-actions">
          {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>{'✓ ' + msg}</div>}
          {view === 'alerts'   && <button className="btn-outline" onClick={handleAckAll}>Mark all as read</button>}
          {view === 'contacts' && <button className="btn-primary" onClick={openNewContact}>+ New contact</button>}
          {view !== 'contacts' && <button className="btn-primary" onClick={openNewRule}>+ New alarm rule</button>}
        </div>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Unread</div><div className="sum-val red">{unread}</div><div className="sum-sub">Require attention</div></div>
        <div className="sum-card"><div className="sum-label">Critical</div><div className="sum-val red">{alerts.filter(a => a.type === 'critical').length}</div><div className="sum-sub">This farm</div></div>
        <div className="sum-card"><div className="sum-label">Warnings</div><div className="sum-val" style={{ color: '#633806' }}>{alerts.filter(a => a.type === 'warning').length}</div><div className="sum-sub">This farm</div></div>
        <div className="sum-card"><div className="sum-label">Active rules</div><div className="sum-val green">{rules.filter(r => r.active).length}</div><div className="sum-sub">{contacts.length} contacts</div></div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid #e8ede9' }}>
        {[
          { key: 'alerts',   label: 'Alerts (' + alerts.length + ')'     },
          { key: 'rules',    label: 'Alarm rules (' + rules.length + ')'  },
          { key: 'contacts', label: 'Contacts (' + contacts.length + ')' },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key as any)}
            style={{ padding: '9px 18px', fontSize: 13, fontWeight: view === v.key ? 600 : 400, cursor: 'pointer', border: 'none', background: 'transparent', fontFamily: 'inherit', color: view === v.key ? '#1a2530' : '#8a9aaa', borderBottom: view === v.key ? '2px solid #4CAF7D' : '2px solid transparent', marginBottom: -1 }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ALERTS */}
      {view === 'alerts' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['all', 'critical', 'warning', 'info'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No alerts for {currentFarm?.name}</div>
              <div style={{ fontSize: 13 }}>All silos are operating normally.</div>
            </div>
          ) : filtered.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9', borderLeft: !a.acknowledged ? '3px solid ' + (a.type === 'critical' ? '#E24B4A' : '#EF9F27') : '0.5px solid #e8ede9', marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: bgColor(a.type), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor(a.type)} strokeWidth="1.5" strokeLinecap="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: '#aab8c0' }}>{new Date(a.triggered_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                {a.message && <div style={{ fontSize: 12, color: '#8a9aaa', lineHeight: 1.5, marginBottom: 6 }}>{a.message}</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: '0.5px solid #e8ede9', color: '#aab8c0', background: '#f7f9f8' }}>{a.type}</span>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: '0.5px solid ' + sevInfo(a.severity).color + '44', color: sevInfo(a.severity).color, background: sevInfo(a.severity).bg, fontWeight: 600 }}>{a.severity}</span>
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <button onClick={() => handleAck(a.id)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, border: '0.5px solid #c8d8cc', background: a.acknowledged ? '#eaf5ee' : 'transparent', color: a.acknowledged ? '#27500A' : '#6a7a8a', cursor: 'pointer' }}>
                  {a.acknowledged ? '✓ Acknowledged' : 'Acknowledge'}
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* RULES */}
      {view === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No alarm rules for {currentFarm?.name}</div>
              <button onClick={openNewRule} className="btn-primary">+ Create first rule</button>
            </div>
          ) : rules.map(r => (
            <div key={r.id} onClick={() => openEditRule(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9', borderLeft: '3px solid ' + (r.active ? '#4CAF7D' : '#e8ede9'), cursor: 'pointer' }}
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
                  {triggerLabel(r.trigger_type)}
                  {(r.trigger_type === 'level_below' || r.trigger_type === 'level_above') ? ' · ' + r.threshold_pct + '%' : ''}
                  {r.silo_id ? ' · ' + siloName(r.silo_id) : ' · All silos'}
                  {' · ' + r.channel}
                </div>
                {r.contact_ids && r.contact_ids.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                    {r.contact_ids.map(id => (
                      <span key={id} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#f0f4f0', color: '#6a7a8a', fontWeight: 600 }}>
                        👤 {contactName(id)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => toggleRule(r.id, !r.active)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid ' + (r.active ? '#4CAF7D' : '#e8ede9'), background: r.active ? '#eaf5ee' : '#fff', color: r.active ? '#27500A' : '#aab8c0', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {r.active ? 'Active' : 'Inactive'}
                </button>
                <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CONTACTS */}
      {view === 'contacts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8a9aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>No contacts for {currentFarm?.name}</div>
              <button onClick={openNewContact} className="btn-primary">+ Add first contact</button>
            </div>
          ) : contacts.map(c => (
            <div key={c.id} onClick={() => openEditContact(c)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#fff', borderRadius: 8, border: '0.5px solid #e8ede9', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: c.active ? '#1a2530' : '#e8ede9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: c.active ? '#fff' : '#aab8c0', flexShrink: 0 }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{c.name}</div>
                  {!c.active && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#f0f4f0', color: '#aab8c0', fontWeight: 600 }}>Inactive</span>}
                </div>
                <div style={{ fontSize: 11, color: '#8a9aaa' }}>{c.position || '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {c.email       && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#E6F1FB', color: '#0C447C', fontWeight: 600 }}>EMAIL</span>}
                {c.telegram_id && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#eaf5ee', color: '#27500A', fontWeight: 600 }}>TG</span>}
                {c.phone       && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#f0f4f0', color: '#6a7a8a', fontWeight: 600 }}>PHONE</span>}
                <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600, marginLeft: 4 }}>Edit →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
