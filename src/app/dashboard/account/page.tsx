'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getActiveFarmId } from '@/lib/queries'

interface Farm        { id: string; name: string; location: string | null; lat: number | null; lng: number | null; timezone: string }
interface Silo        { id: string; farm_id: string; name: string; material: string | null; capacity_kg: number; digitplan_silo_id: number | null; active: boolean }
interface Sensor      { id: string; silo_id: string; serial: string; model: string; status: string; battery_pct: number; signal_strength: number }
interface AnimalGroup { id: string; farm_id: string; name: string; type: string; icon: string | null; count: number }

type Tab = 'farms' | 'silos' | 'sensors' | 'animals' | 'users'

const ANIMAL_TYPES = ['pig', 'poultry', 'cattle', 'sheep', 'other']
const MATERIALS    = ['Lactation diet', 'Gestation diet', 'Maize meal', 'Wheat bran', 'Soybean meal', 'Barley', 'Other']
const TIMEZONES    = ['Australia/Melbourne', 'Australia/Sydney', 'Australia/Brisbane', 'Australia/Perth']
const ROLES        = ['owner', 'manager', 'viewer']

function inputStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function labelStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

export default function AccountPage() {
  const [tab,     setTab]     = useState<Tab>('farms')
  const [farms,   setFarms]   = useState<Farm[]>([])
  const [silos,   setSilos]   = useState<Silo[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [animals, setAnimals] = useState<AnimalGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [msg,     setMsg]     = useState('')

  const activeFarmId = getActiveFarmId()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [f, s, sen, a] = await Promise.all([
      supabase.from('farms').select('*').order('name'),
      supabase.from('silos').select('*').order('name'),
      supabase.from('sensors').select('*'),
      supabase.from('animal_groups').select('*').order('name'),
    ])
    setFarms(f.data || [])
    setSilos(s.data || [])
    setSensors(sen.data || [])
    setAnimals(a.data || [])
    setLoading(false)
  }

  function showMsg(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'farms',   label: 'Farms',   count: farms.length },
    { key: 'silos',   label: 'Silos',   count: silos.length },
    { key: 'sensors', label: 'Sensors', count: sensors.length },
    { key: 'animals', label: 'Animals', count: animals.length },
    { key: 'users',   label: 'Users',   count: 0 },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading account...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Account</div>
          <div className="page-sub">Manage farms, silos, sensors, animals and users</div>
        </div>
        {msg && (
          <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>
            ✓ {msg}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '0.5px solid #e8ede9' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '9px 18px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer', border: 'none', background: 'transparent', fontFamily: 'inherit', color: tab === t.key ? '#1a2530' : '#8a9aaa', borderBottom: tab === t.key ? '2px solid #4CAF7D' : '2px solid transparent', marginBottom: -1 }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 10, background: tab === t.key ? '#eaf5ee' : '#f0f4f0', color: tab === t.key ? '#27500A' : '#aab8c0', fontWeight: 600 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'farms'   && <FarmsTab   farms={farms}   onRefresh={loadAll} onMsg={showMsg} activeFarmId={activeFarmId} />}
      {tab === 'silos'   && <SilosTab   silos={silos}   farms={farms} onRefresh={loadAll} onMsg={showMsg} activeFarmId={activeFarmId} />}
      {tab === 'sensors' && <SensorsTab sensors={sensors} silos={silos} farms={farms} onRefresh={loadAll} onMsg={showMsg} />}
      {tab === 'animals' && <AnimalsTab animals={animals} farms={farms} onRefresh={loadAll} onMsg={showMsg} activeFarmId={activeFarmId} />}
      {tab === 'users'   && <UsersTab   farms={farms} onMsg={showMsg} />}
    </>
  )
}

// ── FARMS TAB ─────────────────────────────────────────────────────────────────
function FarmsTab({ farms, onRefresh, onMsg, activeFarmId }: { farms: Farm[]; onRefresh: () => void; onMsg: (m: string) => void; activeFarmId: string }) {
  const empty = { name: '', location: '', lat: '', lng: '', timezone: 'Australia/Melbourne' }
  const [form,    setForm]    = useState(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { name: form.name.trim(), location: form.location || null, lat: form.lat ? parseFloat(form.lat) : null, lng: form.lng ? parseFloat(form.lng) : null, timezone: form.timezone }
    if (editing) {
      await supabase.from('farms').update(payload).eq('id', editing)
      onMsg('Farm updated')
    } else {
      const { data } = await supabase.from('farms').insert(payload).select().single()
      if (data) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await supabase.from('user_farms').insert({ user_id: user.id, farm_id: data.id, role: 'owner' })
      }
      onMsg('Farm created')
    }
    setForm(empty); setEditing(null); setSaving(false); onRefresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this farm and all its data?')) return
    await supabase.from('farms').delete().eq('id', id)
    onMsg('Farm deleted'); onRefresh()
  }

  function edit(f: Farm) {
    setEditing(f.id)
    setForm({ name: f.name, location: f.location || '', lat: f.lat?.toString() || '', lng: f.lng?.toString() || '', timezone: f.timezone })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">Your farms</div></div>
        {farms.length === 0 ? (
          <div style={{ color: '#8a9aaa', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No farms yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {farms.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '0.5px solid #f0f4f0' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.id === activeFarmId ? '#4CAF7D' : '#e8ede9', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>{f.location || '—'} · {f.timezone}</div>
                </div>
                {f.id === activeFarmId && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#eaf5ee', color: '#27500A', fontWeight: 600 }}>Active</span>}
                <button onClick={() => edit(f)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #e8ede9', background: '#fff', cursor: 'pointer', color: '#6a7a8a' }}>Edit</button>
                <button onClick={() => remove(f.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #FCEBEB', background: '#FCEBEB', cursor: 'pointer', color: '#A32D2D' }}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">{editing ? 'Edit farm' : 'New farm'}</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle()}>Farm name *</label>
            <input style={inputStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Granja El Roble" />
          </div>
          <div>
            <label style={labelStyle()}>Location</label>
            <input style={inputStyle(true)} value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="142 Harcourt Rd, Elmore VIC" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle()}>Latitude</label>
              <input style={inputStyle(true)} value={form.lat} onChange={e => setForm(p => ({ ...p, lat: e.target.value }))} placeholder="-36.4982" type="number" step="any" />
            </div>
            <div>
              <label style={labelStyle()}>Longitude</label>
              <input style={inputStyle(true)} value={form.lng} onChange={e => setForm(p => ({ ...p, lng: e.target.value }))} placeholder="144.6101" type="number" step="any" />
            </div>
          </div>
          <div>
            <label style={labelStyle()}>Timezone</label>
            <select style={{ ...inputStyle(true) }} value={form.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}>
              {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={saving || !form.name.trim()}
              style={{ flex: 1, padding: '9px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving...' : editing ? 'Update farm' : 'Create farm'}
            </button>
            {editing && (
              <button onClick={() => { setEditing(null); setForm(empty) }}
                style={{ padding: '9px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SILOS TAB ─────────────────────────────────────────────────────────────────
function SilosTab({ silos, farms, onRefresh, onMsg, activeFarmId }: { silos: Silo[]; farms: Farm[]; onRefresh: () => void; onMsg: (m: string) => void; activeFarmId: string }) {
  const empty = { farm_id: activeFarmId, name: '', material: 'Lactation diet', capacity_kg: '20000', digitplan_silo_id: '' }
  const [form,    setForm]    = useState(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [filter,  setFilter]  = useState(activeFarmId)

  const filtered = silos.filter(s => !filter || s.farm_id === filter)
  const farmName = (id: string) => farms.find(f => f.id === id)?.name || '—'

  async function save() {
    if (!form.name.trim() || !form.farm_id) return
    setSaving(true)
    const payload = { farm_id: form.farm_id, name: form.name.trim(), material: form.material || null, capacity_kg: parseFloat(form.capacity_kg) || 20000, digitplan_silo_id: form.digitplan_silo_id ? parseInt(form.digitplan_silo_id) : null, active: true }
    if (editing) {
      await supabase.from('silos').update(payload).eq('id', editing)
      onMsg('Silo updated')
    } else {
      await supabase.from('silos').insert(payload)
      onMsg('Silo created')
    }
    setForm(empty); setEditing(null); setSaving(false); onRefresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this silo?')) return
    await supabase.from('silos').delete().eq('id', id)
    onMsg('Silo deleted'); onRefresh()
  }

  function edit(s: Silo) {
    setEditing(s.id)
    setForm({ farm_id: s.farm_id, name: s.name, material: s.material || '', capacity_kg: s.capacity_kg.toString(), digitplan_silo_id: s.digitplan_silo_id?.toString() || '' })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">Silos</div>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inputStyle(), fontSize: 12 }}>
            <option value="">All farms</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div style={{ color: '#8a9aaa', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No silos found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Silo', 'Farm', 'Material', 'Capacity', 'DigitPlan ID', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 10, color: '#aab8c0', fontWeight: 600, padding: '0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{s.name}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{farmName(s.farm_id)}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{s.material || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{(s.capacity_kg / 1000).toFixed(0)} t</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa', fontFamily: 'monospace' }}>{s.digitplan_silo_id || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => edit(s)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '0.5px solid #e8ede9', background: '#fff', cursor: 'pointer', color: '#6a7a8a' }}>Edit</button>
                      <button onClick={() => remove(s.id)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '0.5px solid #FCEBEB', background: '#FCEBEB', cursor: 'pointer', color: '#A32D2D' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">{editing ? 'Edit silo' : 'New silo'}</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle()}>Farm *</label>
            <select style={{ ...inputStyle(true) }} value={form.farm_id} onChange={e => setForm(p => ({ ...p, farm_id: e.target.value }))}>
              <option value="">Select farm</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>Silo name *</label>
            <input style={inputStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Silo R-1" />
          </div>
          <div>
            <label style={labelStyle()}>Material</label>
            <select style={{ ...inputStyle(true) }} value={form.material} onChange={e => setForm(p => ({ ...p, material: e.target.value }))}>
              {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>Capacity (kg)</label>
            <input style={inputStyle(true)} value={form.capacity_kg} onChange={e => setForm(p => ({ ...p, capacity_kg: e.target.value }))} placeholder="20000" type="number" step="1000" />
          </div>
          <div>
            <label style={labelStyle()}>DigitPlan Silo ID</label>
            <input style={inputStyle(true)} value={form.digitplan_silo_id} onChange={e => setForm(p => ({ ...p, digitplan_silo_id: e.target.value }))} placeholder="101" type="number" />
            <p style={{ fontSize: 11, color: '#aab8c0', marginTop: 4 }}>ID from DigitPlan API — links sensor data to this silo</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={saving || !form.name.trim() || !form.farm_id}
              style={{ flex: 1, padding: '9px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving...' : editing ? 'Update silo' : 'Create silo'}
            </button>
            {editing && (
              <button onClick={() => { setEditing(null); setForm(empty) }}
                style={{ padding: '9px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SENSORS TAB ───────────────────────────────────────────────────────────────
function SensorsTab({ sensors, silos, farms, onRefresh, onMsg }: { sensors: Sensor[]; silos: Silo[]; farms: Farm[]; onRefresh: () => void; onMsg: (m: string) => void }) {
  const empty = { silo_id: '', serial: '', model: 'SiloMetric Laser', firmware: '' }
  const [form,       setForm]       = useState(empty)
  const [editing,    setEditing]    = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [farmFilter, setFarmFilter] = useState('')

  const filteredSilos   = farmFilter ? silos.filter(s => s.farm_id === farmFilter) : silos
  const filteredSensors = farmFilter ? sensors.filter(sen => silos.find(s => s.id === sen.silo_id && s.farm_id === farmFilter)) : sensors
  const siloName    = (id: string) => silos.find(s => s.id === id)?.name || '—'
  const farmOfSilo  = (siloId: string) => { const silo = silos.find(s => s.id === siloId); return silo ? farms.find(f => f.id === silo.farm_id)?.name || '—' : '—' }
  const statusColor = (s: string) => s === 'online' ? '#27500A' : s === 'delayed' ? '#633806' : '#A32D2D'
  const statusBg    = (s: string) => s === 'online' ? '#eaf5ee' : s === 'delayed' ? '#FAEEDA' : '#FCEBEB'

  async function save() {
    if (!form.silo_id || !form.serial.trim()) return
    setSaving(true)
    if (editing) {
      await supabase.from('sensors').update({ silo_id: form.silo_id, serial: form.serial.trim().toUpperCase(), model: form.model, firmware: form.firmware || null }).eq('id', editing)
      onMsg('Sensor updated')
    } else {
      const existing = sensors.find(s => s.silo_id === form.silo_id)
      if (existing) { onMsg('This silo already has a sensor — edit it instead'); setSaving(false); return }
      await supabase.from('sensors').insert({ silo_id: form.silo_id, serial: form.serial.trim().toUpperCase(), model: form.model, firmware: form.firmware || null, status: 'online', battery_pct: 100, signal_strength: 3, installed_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
      onMsg('Sensor enrolled')
    }
    setForm(empty); setEditing(null); setSaving(false); onRefresh()
  }

  async function remove(id: string) {
    if (!confirm('Remove this sensor?')) return
    await supabase.from('sensors').delete().eq('id', id)
    onMsg('Sensor removed'); onRefresh()
  }

  function edit(s: Sensor) {
    setEditing(s.id)
    setForm({ silo_id: s.silo_id, serial: s.serial, model: s.model, firmware: '' })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">Enrolled sensors</div>
          <select value={farmFilter} onChange={e => setFarmFilter(e.target.value)} style={{ ...inputStyle(), fontSize: 12 }}>
            <option value="">All farms</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        {filteredSensors.length === 0 ? (
          <div style={{ color: '#8a9aaa', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No sensors enrolled yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Serial', 'Silo', 'Farm', 'Model', 'Status', 'Battery', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 10, color: '#aab8c0', fontWeight: 600, padding: '0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filteredSensors.map(s => (
                <tr key={s.id}>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: '#1a2530' }}>{s.serial}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#1a2530' }}>{siloName(s.silo_id)}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{farmOfSilo(s.silo_id)}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{s.model}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: statusBg(s.status), color: statusColor(s.status), fontWeight: 600 }}>{s.status}</span>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 36, height: 5, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: s.battery_pct > 50 ? '#4CAF7D' : '#EF9F27', width: `${s.battery_pct}%` }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#8a9aaa' }}>{s.battery_pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => edit(s)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '0.5px solid #e8ede9', background: '#fff', cursor: 'pointer', color: '#6a7a8a' }}>Edit</button>
                      <button onClick={() => remove(s.id)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '0.5px solid #FCEBEB', background: '#FCEBEB', cursor: 'pointer', color: '#A32D2D' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">{editing ? 'Edit sensor' : 'Enroll sensor'}</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#f7f9f8', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#6a7a8a', lineHeight: 1.5 }}>
            Each sensor is assigned to one silo. The serial number links the physical device to FeedFlow.
          </div>
          <div>
            <label style={labelStyle()}>Farm (filter)</label>
            <select style={{ ...inputStyle(true) }} value={farmFilter} onChange={e => { setFarmFilter(e.target.value); setForm(p => ({ ...p, silo_id: '' })) }}>
              <option value="">All farms</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>Silo *</label>
            <select style={{ ...inputStyle(true) }} value={form.silo_id} onChange={e => setForm(p => ({ ...p, silo_id: e.target.value }))}>
              <option value="">Select silo</option>
              {filteredSilos.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>Serial number *</label>
            <input style={inputStyle(true)} value={form.serial} onChange={e => setForm(p => ({ ...p, serial: e.target.value }))} placeholder="SM-R101" />
            <p style={{ fontSize: 11, color: '#aab8c0', marginTop: 4 }}>Found on the physical sensor device</p>
          </div>
          <div>
            <label style={labelStyle()}>Model</label>
            <input style={inputStyle(true)} value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} placeholder="SiloMetric Laser" />
          </div>
          <div>
            <label style={labelStyle()}>Firmware version</label>
            <input style={inputStyle(true)} value={form.firmware} onChange={e => setForm(p => ({ ...p, firmware: e.target.value }))} placeholder="v3.1.2" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={saving || !form.silo_id || !form.serial.trim()}
              style={{ flex: 1, padding: '9px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving...' : editing ? 'Update sensor' : 'Enroll sensor'}
            </button>
            {editing && (
              <button onClick={() => { setEditing(null); setForm(empty) }}
                style={{ padding: '9px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ANIMALS TAB ───────────────────────────────────────────────────────────────
function AnimalsTab({ animals, farms, onRefresh, onMsg, activeFarmId }: { animals: AnimalGroup[]; farms: Farm[]; onRefresh: () => void; onMsg: (m: string) => void; activeFarmId: string }) {
  const TYPE_ICONS: Record<string, string> = { pig: '🐖', poultry: '🐔', cattle: '🐄', sheep: '🐑', other: '🐾' }
  const empty = { farm_id: activeFarmId, name: '', type: 'pig', icon: '🐖', count: '0' }
  const [form,    setForm]    = useState(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [filter,  setFilter]  = useState(activeFarmId)

  const filtered = animals.filter(a => !filter || a.farm_id === filter)
  const farmName = (id: string) => farms.find(f => f.id === id)?.name || '—'

  async function save() {
    if (!form.name.trim() || !form.farm_id) return
    setSaving(true)
    const payload = { farm_id: form.farm_id, name: form.name.trim(), type: form.type, icon: form.icon || TYPE_ICONS[form.type], count: parseInt(form.count) || 0 }
    if (editing) {
      await supabase.from('animal_groups').update(payload).eq('id', editing)
      onMsg('Group updated')
    } else {
      await supabase.from('animal_groups').insert(payload)
      onMsg('Group created')
    }
    setForm(empty); setEditing(null); setSaving(false); onRefresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this animal group?')) return
    await supabase.from('animal_groups').delete().eq('id', id)
    onMsg('Group deleted'); onRefresh()
  }

  function edit(a: AnimalGroup) {
    setEditing(a.id)
    setForm({ farm_id: a.farm_id, name: a.name, type: a.type, icon: a.icon || '', count: a.count.toString() })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">Animal groups</div>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inputStyle(), fontSize: 12 }}>
            <option value="">All farms</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div style={{ color: '#8a9aaa', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No animal groups found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Group', 'Farm', 'Type', 'Count', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 10, color: '#aab8c0', fontWeight: 600, padding: '0 10px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{a.icon || TYPE_ICONS[a.type]}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{a.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{farmName(a.farm_id)}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa', textTransform: 'capitalize' }}>{a.type}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0', fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{a.count.toLocaleString()}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => edit(a)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '0.5px solid #e8ede9', background: '#fff', cursor: 'pointer', color: '#6a7a8a' }}>Edit</button>
                      <button onClick={() => remove(a.id)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '0.5px solid #FCEBEB', background: '#FCEBEB', cursor: 'pointer', color: '#A32D2D' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">{editing ? 'Edit group' : 'New group'}</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle()}>Farm *</label>
            <select style={{ ...inputStyle(true) }} value={form.farm_id} onChange={e => setForm(p => ({ ...p, farm_id: e.target.value }))}>
              <option value="">Select farm</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>Group name *</label>
            <input style={inputStyle(true)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Lactating sows" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
            <div>
              <label style={labelStyle()}>Animal type</label>
              <select style={{ ...inputStyle(true) }} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value, icon: TYPE_ICONS[e.target.value] }))}>
                {ANIMAL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle()}>Icon</label>
              <input style={inputStyle(true)} value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} placeholder="🐖" />
            </div>
          </div>
          <div>
            <label style={labelStyle()}>Head count</label>
            <input style={inputStyle(true)} value={form.count} onChange={e => setForm(p => ({ ...p, count: e.target.value }))} placeholder="120" type="number" min="0" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={saving || !form.name.trim() || !form.farm_id}
              style={{ flex: 1, padding: '9px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving...' : editing ? 'Update group' : 'Create group'}
            </button>
            {editing && (
              <button onClick={() => { setEditing(null); setForm(empty) }}
                style={{ padding: '9px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────
function UsersTab({ farms, onMsg }: { farms: Farm[]; onMsg: (m: string) => void }) {
  interface UserRow {
    id:         string
    email:      string
    created_at: string
    user_farms: { farm_id: string; role: string; farm_name: string }[]
  }

  const empty = { email: '', password: '', role: 'viewer', farm_ids: [] as string[] }
  const [users,      setUsers]      = useState<UserRow[]>([])
  const [form,       setForm]       = useState(empty)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [drawer,     setDrawer]     = useState<UserRow | null>(null)
  const [editPass,   setEditPass]   = useState('')
  const [editFarms,  setEditFarms]  = useState<any[]>([])
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const [ufRes, authRes] = await Promise.all([
      supabase.from('user_farms').select('user_id, farm_id, role, farms(id, name)'),
      fetch('/api/admin/list-users'),
    ])
    const uf        = ufRes.data || []
    const authData  = await authRes.json()
    const authUsers = authData.users || []

    const rows: UserRow[] = authUsers.map((u: any) => ({
      id:         u.id,
      email:      u.email,
      created_at: u.created_at,
      user_farms: uf
        .filter((r: any) => r.user_id === u.id)
        .map((r: any) => ({
          farm_id:   r.farm_id,
          role:      r.role,
          farm_name: Array.isArray(r.farms) ? r.farms[0]?.name || '—' : r.farms?.name || '—',
        })),
    }))
    setUsers(rows)
    setLoading(false)
  }

  function openDrawer(u: UserRow) {
    setDrawer(u)
    setEditPass('')
    setEditFarms(farms.map(f => {
      const existing = u.user_farms.find(uf => uf.farm_id === f.id)
      return { farm_id: f.id, role: existing?.role || 'viewer', assigned: !!existing }
    }))
  }

  async function saveDrawer() {
    if (!drawer) return
    setSavingEdit(true)
    if (editPass.trim()) {
      await fetch('/api/admin/update-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: drawer.id, password: editPass }),
      })
    }
    for (const f of editFarms.filter((f: any) => !f.assigned)) {
      await supabase.from('user_farms').delete().eq('user_id', drawer.id).eq('farm_id', f.farm_id)
    }
    for (const f of editFarms.filter((f: any) => f.assigned)) {
      await supabase.from('user_farms').upsert(
        { user_id: drawer.id, farm_id: f.farm_id, role: f.role },
        { onConflict: 'user_id,farm_id' }
      )
    }
    setSavingEdit(false)
    setDrawer(null)
    onMsg('User updated')
    loadUsers()
  }

  async function removeUser(userId: string, email: string) {
    if (!confirm(`Remove user ${email}?`)) return
    const res  = await fetch('/api/admin/delete-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    const data = await res.json()
    if (data.error) { onMsg('Error: ' + data.error); return }
    onMsg('User removed')
    loadUsers()
  }

  async function createUser() {
  if (!form.email || !form.password || form.farm_ids.length === 0) {
    setError('Email, password and at least one farm are required')
    return
  }
  setSaving(true); setError('')
  const res = await fetch('/api/admin/create-user', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: form.email, password: form.password, role: form.role, farm_ids: form.farm_ids }),
  })
  const data = await res.json()
  if (data.error) { setError(data.error); setSaving(false); return }
  onMsg('User created')
  setForm(empty)
  setSaving(false)
  // Small delay to let Supabase propagate the new user
  await new Promise(r => setTimeout(r, 800))
  await loadUsers()
  }
  
  const roleBadge = (r: string) =>
    r === 'owner'   ? { bg: '#eaf5ee', color: '#27500A' } :
    r === 'manager' ? { bg: '#E6F1FB', color: '#0C447C' } :
                      { bg: '#f0f4f0', color: '#6a7a8a'  }

  return (
    <>
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 420, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {drawer.email.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{drawer.email}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>
                  Joined {new Date(drawer.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <button onClick={() => setDrawer(null)}
                style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Reset password</div>
                <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)}
                  placeholder="New password (leave blank to keep current)" style={{ ...inputStyle(true) }} />
              </div>
              <div style={{ height: '0.5px', background: '#e8ede9', marginBottom: 24 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Farm access & roles</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {editFarms.map((ef: any, idx: number) => {
                    const farm = farms.find(f => f.id === ef.farm_id)
                    if (!farm) return null
                    const badge = roleBadge(ef.role)
                    return (
                      <div key={ef.farm_id} style={{ border: `0.5px solid ${ef.assigned ? '#4CAF7D' : '#e8ede9'}`, borderRadius: 8, padding: '12px 14px', background: ef.assigned ? '#f4fbf7' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: ef.assigned ? 10 : 0 }}>
                          <input type="checkbox" checked={ef.assigned}
                            onChange={() => setEditFarms(prev => prev.map((f, i) => i === idx ? { ...f, assigned: !f.assigned } : f))}
                            style={{ accentColor: '#4CAF7D', width: 15, height: 15, cursor: 'pointer' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: ef.assigned ? 600 : 400, color: '#1a2530' }}>{farm.name}</div>
                            {farm.location && <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 1 }}>{farm.location}</div>}
                          </div>
                        </div>
                        {ef.assigned && (
                          <div style={{ paddingLeft: 25 }}>
                            <div style={{ fontSize: 11, color: '#8a9aaa', marginBottom: 6 }}>Role</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {ROLES.map(r => (
                                <button key={r} onClick={() => setEditFarms(prev => prev.map((f, i) => i === idx ? { ...f, role: r } : f))}
                                  style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `0.5px solid ${ef.role === r ? roleBadge(r).color + '88' : '#e8ede9'}`, background: ef.role === r ? roleBadge(r).bg : '#fff', color: ef.role === r ? roleBadge(r).color : '#8a9aaa' }}>
                                  {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button onClick={saveDrawer} disabled={savingEdit}
                style={{ flex: 1, padding: '10px', background: savingEdit ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {savingEdit ? 'Saving...' : 'Save changes'}
              </button>
              <button onClick={() => removeUser(drawer.id, drawer.email)}
                style={{ padding: '10px 16px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>
                Remove user
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Users with access</div>
            <span style={{ fontSize: 12, color: '#aab8c0' }}>{users.length} users</span>
          </div>
          {loading ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#aab8c0', fontSize: 13 }}>Loading users...</div>
          ) : users.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#aab8c0', fontSize: 13 }}>No users yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {users.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '0.5px solid #f0f4f0', cursor: 'pointer' }}
                  onClick={() => openDrawer(u)}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {u.email.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{u.email}</div>
                    <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>
                      {u.user_farms.length === 0 ? 'No farms assigned' : u.user_farms.map(f => {
                        const badge = roleBadge(f.role)
                        return (
                          <span key={f.farm_id} style={{ marginRight: 8 }}>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: badge.bg, color: badge.color, fontWeight: 600, marginRight: 3 }}>
                              {f.role.charAt(0).toUpperCase() + f.role.slice(1)}
                            </span>
                            {f.farm_name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">Create new user</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle()}>Email *</label>
              <input style={inputStyle(true)} type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="user@email.com" />
            </div>
            <div>
              <label style={labelStyle()}>Password *</label>
              <input style={inputStyle(true)} type="password" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" />
            </div>
            <div>
              <label style={labelStyle()}>Default role</label>
              <select style={{ ...inputStyle(true) }} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
              <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 6, lineHeight: 1.6 }}>
                <strong style={{ color: '#1a2530' }}>Owner</strong> — full access &nbsp;·&nbsp;
                <strong style={{ color: '#1a2530' }}>Manager</strong> — edit only &nbsp;·&nbsp;
                <strong style={{ color: '#1a2530' }}>Viewer</strong> — read only
              </div>
            </div>
            <div>
              <label style={labelStyle()}>Assign farms * (select at least one)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {farms.map(f => {
                  const checked = form.farm_ids.includes(f.id)
                  return (
                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 7, border: `0.5px solid ${checked ? '#4CAF7D' : '#e8ede9'}`, background: checked ? '#f4fbf7' : '#fff' }}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setForm(p => ({ ...p, farm_ids: p.farm_ids.includes(f.id) ? p.farm_ids.filter(id => id !== f.id) : [...p.farm_ids, f.id] }))}
                        style={{ accentColor: '#4CAF7D', width: 14, height: 14 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: '#1a2530' }}>{f.name}</div>
                        {f.location && <div style={{ fontSize: 11, color: '#aab8c0' }}>{f.location}</div>}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
            {error && (
              <div style={{ background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#A32D2D' }}>{error}</div>
            )}
            <button onClick={createUser} disabled={saving}
              style={{ width: '100%', padding: '9px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Creating...' : 'Create user'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
