'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

interface Sensor {
  id: string; silo_id: string; serial: string; model: string
  status: string; battery_pct: number; signal_strength: number
  firmware: string | null; installed_at: string; last_seen_at: string
  silo_name: string; silo_lat: number | null; silo_lng: number | null
}

export default function SensorsPage() {
  const { currentFarm } = useFarm()
  const farmId = currentFarm?.id || ''

  const [sensors,  setSensors]  = useState<Sensor[]>([])
  const [selected, setSelected] = useState<Sensor | null>(null)
  const [filter,   setFilter]   = useState('all')
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { if (farmId) loadAll() }, [farmId])

  async function loadAll() {
    setLoading(true)
    const { data } = await supabase
      .from('sensors')
      .select('*, silos(name, lat, lng)')
      .in('silo_id',
        await supabase.from('silos').select('id').eq('farm_id', farmId)
          .then(r => (r.data || []).map(s => s.id))
      )
      .order('status')
    const mapped: Sensor[] = (data || []).map((s: any) => ({
      ...s,
      silo_name: s.silos?.name || '—',
      silo_lat:  s.silos?.lat  || null,
      silo_lng:  s.silos?.lng  || null,
    }))
    setSensors(mapped)
    if (mapped.length > 0) setSelected(mapped[0])
    setLoading(false)
  }

  const online  = sensors.filter(s => s.status === 'online').length
  const delayed = sensors.filter(s => s.status === 'delayed').length
  const offline = sensors.filter(s => s.status === 'offline').length
  const lowBatt = sensors.filter(s => s.battery_pct < 60).length

  const filtered = sensors
    .filter(s => filter === 'all' || s.status === filter)
    .filter(s => !search || s.silo_name.toLowerCase().includes(search) || s.serial.toLowerCase().includes(search))

  const statusColor = (s: string) => s === 'online' ? '#27500A' : s === 'delayed' ? '#633806' : '#A32D2D'
  const statusBg    = (s: string) => s === 'online' ? '#eaf5ee' : s === 'delayed' ? '#FAEEDA' : '#FCEBEB'
  const battColor   = (b: number) => b >= 70 ? '#4CAF7D' : b >= 40 ? '#EF9F27' : '#E24B4A'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading sensors...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Sensors</div>
          <div className="page-sub">{currentFarm?.name} · Device inventory · Diagnostics · {sensors.length} sensors registered</div>
        </div>
        <div className="page-actions">
          <button className="btn-primary">+ Register sensor</button>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total</div><div className="sum-val">{sensors.length}</div><div className="sum-sub">Registered sensors</div></div>
        <div className="sum-card"><div className="sum-label">Online</div><div className="sum-val green">{online}</div><div className="sum-sub">Transmitting normally</div></div>
        <div className="sum-card"><div className="sum-label">Delayed</div><div className={`sum-val ${delayed > 0 ? 'amber' : 'green'}`}>{delayed}</div><div className="sum-sub">Check required</div></div>
        <div className="sum-card"><div className="sum-label">Offline</div><div className={`sum-val ${offline > 0 ? 'red' : 'green'}`}>{offline}</div><div className="sum-sub">Not transmitting</div></div>
        <div className="sum-card"><div className="sum-label">Low battery</div><div className={`sum-val ${lowBatt > 0 ? 'amber' : 'green'}`}>{lowBatt}</div><div className="sum-sub">Below 60%</div></div>
      </div>

      {selected && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2530' }}>{selected.silo_name} — {selected.model}</div>
              <div style={{ fontSize: 12, color: '#aab8c0', fontFamily: 'monospace', marginTop: 3 }}>
                Serial: {selected.serial} · Firmware: {selected.firmware ?? '—'} · Installed: {new Date(selected.installed_at).toLocaleDateString('en-AU')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 600, background: statusBg(selected.status), color: statusColor(selected.status) }}>
                {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
              </span>
              {selected.silo_lat && selected.silo_lng && (
                <a href={`https://www.google.com/maps?q=${selected.silo_lat},${selected.silo_lng}`} target="_blank" rel="noreferrer"
                  style={{ padding: '5px 12px', border: '0.5px solid #B5D4F4', borderRadius: 6, fontSize: 12, color: '#4A90C4', background: '#fff', textDecoration: 'none' }}>
                  View on map
                </a>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 }}>
            {[
              { label: 'Status',    val: selected.status.charAt(0).toUpperCase() + selected.status.slice(1), color: statusColor(selected.status) },
              { label: 'Battery',   val: `${selected.battery_pct}%`, color: battColor(selected.battery_pct) },
              { label: 'Signal',    val: ['—','Weak','Fair','Good'][selected.signal_strength] ?? '—', color: selected.signal_strength === 3 ? '#27500A' : selected.signal_strength === 2 ? '#633806' : '#A32D2D' },
              { label: 'Model',     val: selected.model, color: '#1a2530' },
              { label: 'Last seen', val: new Date(selected.last_seen_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), color: '#1a2530' },
            ].map(d => (
              <div key={d.label} style={{ background: '#f7f9f8', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 5 }}>{d.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: d.color }}>{d.val}</div>
              </div>
            ))}
          </div>

          {/* Battery visual */}
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#f7f9f8', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>Battery level</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 10, background: '#e8ede9', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: battColor(selected.battery_pct), borderRadius: 5, width: `${selected.battery_pct}%`, transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: battColor(selected.battery_pct), minWidth: 36 }}>{selected.battery_pct}%</span>
              </div>
              {selected.battery_pct < 40 && (
                <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 6, fontWeight: 600 }}>⚠ Replace battery soon</div>
              )}
            </div>
            <div style={{ background: '#f7f9f8', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>Signal strength</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                {[1,2,3].map(b => (
                  <div key={b} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: 18, height: b * 12 + 6, borderRadius: 3, background: b <= selected.signal_strength ? '#4CAF7D' : '#e8ede9' }} />
                    <span style={{ fontSize: 9, color: '#aab8c0' }}>{['W','F','G'][b-1]}</span>
                  </div>
                ))}
                <span style={{ fontSize: 14, fontWeight: 700, color: selected.signal_strength === 3 ? '#27500A' : selected.signal_strength === 2 ? '#633806' : '#A32D2D', marginLeft: 8 }}>
                  {['—','Weak','Fair','Good'][selected.signal_strength]}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">All sensors — {currentFarm?.name}</div></div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f9f8', border: '0.5px solid #e8ede9', borderRadius: 6, padding: '0 10px', width: 240 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search silo or serial..." value={search} onChange={e => setSearch(e.target.value.toLowerCase())}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: '#1a2530', background: 'transparent', width: '100%', padding: '7px 0' }} />
          </div>
          {['all','online','delayed','offline'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit',
                borderColor: filter === f ? '#1a2530' : '#e8ede9',
                background:  filter === f ? '#1a2530' : '#fff',
                color:       filter === f ? '#fff' : '#6a7a8a' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>
                {f === 'online' ? online : f === 'delayed' ? delayed : offline}
              </span>}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8a9aaa', fontSize: 13 }}>No sensors match your filter.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Silo', 'Status', 'Battery', 'Signal', 'Model', 'Serial', 'Last seen', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 500, padding: '0 12px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => setSelected(s)}
                  style={{ cursor: 'pointer', background: selected?.id === s.id ? '#f4fbf7' : '#fff' }}
                  onMouseEnter={e => { if (selected?.id !== s.id) (e.currentTarget as HTMLElement).style.background = '#f7f9f8' }}
                  onMouseLeave={e => { if (selected?.id !== s.id) (e.currentTarget as HTMLElement).style.background = '#fff' }}>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0', fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{s.silo_name}</td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 10, background: statusBg(s.status), color: statusColor(s.status) }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor(s.status) }} />
                      {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 44, height: 6, background: '#f0f4f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: battColor(s.battery_pct), width: `${s.battery_pct}%` }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#8a9aaa', minWidth: 28 }}>{s.battery_pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                      {[1,2,3].map(b => <div key={b} style={{ width: 4, height: b*5+2, borderRadius: 1, background: b <= s.signal_strength ? '#4CAF7D' : '#e8ede9' }} />)}
                    </div>
                  </td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{s.model}</td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0', fontSize: 11, color: '#8a9aaa', fontFamily: 'monospace' }}>{s.serial}</td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0', fontSize: 11, color: '#8a9aaa' }}>
                    {new Date(s.last_seen_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                    {s.silo_lat && s.silo_lng && (
                      <a href={`https://www.google.com/maps?q=${s.silo_lat},${s.silo_lng}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #c8d8cc', color: '#4A90C4', textDecoration: 'none', background: '#fff' }}>
                        Map
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
