'use client'
import { useEffect, useState } from 'react'
import { getSensors } from '@/lib/queries'
import type { Sensor } from '@/lib/types'

type SensorWithSilo = Sensor & { silo_name: string; silo_lat: number | null; silo_lng: number | null }

export default function SensorsPage() {
  const [sensors,  setSensors]  = useState<SensorWithSilo[]>([])
  const [selected, setSelected] = useState<SensorWithSilo | null>(null)
  const [filter,   setFilter]   = useState('all')
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    getSensors().then(data => { setSensors(data); if (data.length > 0) setSelected(data[0]); setLoading(false) })
  }, [])

  const online   = sensors.filter(s => s.status === 'online').length
  const delayed  = sensors.filter(s => s.status === 'delayed').length
  const lowBatt  = sensors.filter(s => s.battery_pct < 60).length

  let filtered = [...sensors]
  if (filter !== 'all') filtered = filtered.filter(s => s.status === filter)
  if (search) filtered = filtered.filter(s => s.silo_name.toLowerCase().includes(search) || s.serial.toLowerCase().includes(search))

  const statusColor = (s: string) => s === 'online' ? '#27500A' : s === 'delayed' ? '#633806' : '#A32D2D'
  const statusBg    = (s: string) => s === 'online' ? '#eaf5ee' : s === 'delayed' ? '#FAEEDA' : '#FCEBEB'
  const battColor   = (b: number) => b >= 70 ? '#4CAF7D' : b >= 40 ? '#EF9F27' : '#E24B4A'

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#8a9aaa' }}>Loading sensors...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Sensors</div>
          <div className="page-sub">Device inventory · Diagnostics · {sensors.length} sensors registered</div>
        </div>
        <div className="page-actions">
          <button className="btn-outline">Export inventory</button>
          <button className="btn-primary">+ Register sensor</button>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total</div><div className="sum-val">{sensors.length}</div><div className="sum-sub">Registered sensors</div></div>
        <div className="sum-card"><div className="sum-label">Online</div><div className="sum-val green">{online}</div><div className="sum-sub">Transmitting normally</div></div>
        <div className="sum-card"><div className="sum-label">Delayed</div><div className={`sum-val ${delayed > 0 ? 'amber' : 'green'}`}>{delayed}</div><div className="sum-sub">Check required</div></div>
        <div className="sum-card"><div className="sum-label">Low battery</div><div className={`sum-val ${lowBatt > 0 ? 'amber' : 'green'}`}>{lowBatt}</div><div className="sum-sub">Below 60%</div></div>
      </div>

      {selected && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#1a2530' }}>{selected.silo_name} — {selected.model}</div>
              <div style={{ fontSize: 12, color: '#aab8c0', fontFamily: 'monospace', marginTop: 3 }}>
                Serial: {selected.serial} · Firmware: {selected.firmware ?? '—'} · Installed: {new Date(selected.installed_at).toLocaleDateString('en-AU')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selected.silo_lat && selected.silo_lng && (
                <a href={`https://www.google.com/maps?q=${selected.silo_lat},${selected.silo_lng}`} target="_blank" rel="noreferrer"
                  style={{ padding: '7px 14px', border: '0.5px solid #B5D4F4', borderRadius: 6, fontSize: 12, color: '#4A90C4', background: '#fff', textDecoration: 'none' }}>
                  View on map
                </a>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
            {[
              { label: 'Status',    val: selected.status.charAt(0).toUpperCase() + selected.status.slice(1), cls: selected.status },
              { label: 'Battery',   val: `${selected.battery_pct}%`, cls: selected.battery_pct >= 70 ? 'green' : selected.battery_pct >= 40 ? 'amber' : 'red' },
              { label: 'Signal',    val: ['—','Weak','Fair','Good'][selected.signal_strength] ?? '—', cls: selected.signal_strength === 3 ? 'green' : 'amber' },
              { label: 'Last seen', val: new Date(selected.last_seen_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), cls: '' },
            ].map(d => (
              <div key={d.label} style={{ background: '#f7f9f8', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 5 }}>{d.label}</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: d.cls === 'online' || d.cls === 'green' ? '#27500A' : d.cls === 'delayed' || d.cls === 'amber' ? '#633806' : d.cls === 'offline' || d.cls === 'red' ? '#A32D2D' : '#1a2530' }}>
                  {d.val}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">All sensors</div></div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f9f8', border: '0.5px solid #e8ede9', borderRadius: 6, padding: '0 10px', width: 220 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search silo or serial..." value={search} onChange={e => setSearch(e.target.value.toLowerCase())}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: '#1a2530', background: 'transparent', width: '100%', padding: '7px 0' }} />
          </div>
          {['all','online','delayed','offline'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {sensors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8a9aaa', fontSize: 13 }}>No sensors registered yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Silo','Status','Battery','Signal','Serial','Last seen',''].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 500, padding: '0 12px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => setSelected(s)} style={{ cursor: 'pointer', background: selected?.id === s.id ? '#eaf5ee' : '#fff' }}>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0', fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{s.silo_name}</td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 10, background: statusBg(s.status), color: statusColor(s.status) }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(s.status) }} />
                      {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 40, height: 6, background: '#f7f9f8', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: battColor(s.battery_pct), width: `${s.battery_pct}%` }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#8a9aaa' }}>{s.battery_pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                      {[1,2,3].map(b => <div key={b} style={{ width: 4, height: b*5+2, borderRadius: 1, background: b <= s.signal_strength ? '#4CAF7D' : '#e8ede9' }} />)}
                    </div>
                  </td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0', fontSize: 11, color: '#8a9aaa', fontFamily: 'monospace' }}>{s.serial}</td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0', fontSize: 11, color: '#8a9aaa' }}>
                    {new Date(s.last_seen_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                    {s.silo_lat && s.silo_lng && (
                      <a href={`https://www.google.com/maps?q=${s.silo_lat},${s.silo_lng}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, border: '0.5px solid #c8d8cc', color: '#4A90C4', textDecoration: 'none' }}>Map</a>
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
