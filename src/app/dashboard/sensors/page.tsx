'use client'
import { useState } from 'react'
import { SENSORS } from '@/lib/data'

export default function SensorsPage() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('silo')
  const [selectedId, setSelectedId] = useState(1)

  const selected = SENSORS.find(s => s.id === selectedId) || SENSORS[0]

  const online = SENSORS.filter(s => s.status === 'online').length
  const delayed = SENSORS.filter(s => s.status === 'delayed').length
  const lowBatt = SENSORS.filter(s => s.batt < 60).length

  let filtered = [...SENSORS]
  if (filter !== 'all') filtered = filtered.filter(s => s.status === filter)
  if (search) filtered = filtered.filter(s => s.silo.toLowerCase().includes(search) || s.serial.toLowerCase().includes(search))
  if (sort === 'battery') filtered = filtered.sort((a, b) => a.batt - b.batt)
  else if (sort === 'signal') filtered = filtered.sort((a, b) => a.signal - b.signal)
  else filtered = filtered.sort((a, b) => a.silo.localeCompare(b.silo))

  const statusColor = (s: string) => s === 'online' ? '#27500A' : s === 'delayed' ? '#633806' : '#A32D2D'
  const statusBg = (s: string) => s === 'online' ? '#eaf5ee' : s === 'delayed' ? '#FAEEDA' : '#FCEBEB'
  const battColor = (b: number) => b >= 70 ? '#4CAF7D' : b >= 40 ? '#EF9F27' : '#E24B4A'
  const signalLabel = (s: number) => s === 3 ? 'Good' : s === 2 ? 'Fair' : 'Weak'

  const logs = [
    { type: 'ok', text: 'Reading transmitted successfully', time: '2h ago' },
    { type: 'ok', text: 'Reading transmitted successfully', time: '4h ago' },
    { type: selected.status === 'delayed' ? 'warn' : 'ok', text: selected.status === 'delayed' ? 'Transmission delayed — retrying...' : 'Reading transmitted successfully', time: '6h ago' },
    { type: 'ok', text: 'Daily health check passed', time: 'Yesterday 08:00' },
  ]

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Sensors</div><div className="page-sub">Device inventory · Diagnostics · Gateway status</div></div>
        <div className="page-actions"><button className="btn-outline">Export inventory</button><button className="btn-primary">+ Register sensor</button></div>
      </div>

      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Total sensors</div><div className="sum-val">{SENSORS.length}</div><div className="sum-sub">1 Master Gateway</div></div>
        <div className="sum-card"><div className="sum-label">Online</div><div className="sum-val green">{online}</div><div className="sum-sub">Transmitting normally</div></div>
        <div className="sum-card"><div className="sum-label">Delayed / offline</div><div className={`sum-val ${delayed > 0 ? 'amber' : 'green'}`}>{delayed}</div><div className="sum-sub">{delayed} delayed</div></div>
        <div className="sum-card"><div className="sum-label">Low battery (&lt; 60%)</div><div className={`sum-val ${lowBatt > 0 ? 'amber' : 'green'}`}>{lowBatt}</div><div className="sum-sub">Schedule inspection</div></div>
      </div>

      {/* GATEWAY */}
      <div style={{ background: '#1a2530', borderRadius: 10, padding: '18px 20px', marginBottom: 16, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(74,144,196,0.15)', border: '0.5px solid rgba(74,144,196,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A90C4" strokeWidth="1.5" strokeLinecap="round"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="#4A90C4"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 3 }}>Master Gateway — GW-001</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>MQTT v2 · POE 48V · 868 MHz · Serial: MC-GW-0000A00A · Firmware v2.4.1</div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {[{ val: 'Online', lbl: 'Status', c: '#4CAF7D' }, { val: '15', lbl: 'Connected', c: '#fff' }, { val: '14m', lbl: 'Last sync', c: '#fff' }, { val: '300m', lbl: 'Range', c: '#fff' }].map(s => (
            <div key={s.lbl} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: s.c }}>{s.val}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SELECTED DETAIL */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#1a2530' }}>{selected.silo} — {selected.model}</div>
            <div style={{ fontSize: 12, color: '#aab8c0', fontFamily: 'monospace', marginTop: 3 }}>Serial: {selected.serial} · Installed: {selected.installed} · Firmware: {selected.firmware}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline">Update firmware</button>
            <a href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer" style={{ padding: '7px 14px', border: '0.5px solid #B5D4F4', borderRadius: 6, fontSize: 12, color: '#4A90C4', background: '#fff', textDecoration: 'none' }}>View on map</a>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Status', val: selected.status === 'online' ? 'Online' : 'Delayed', cls: selected.status === 'online' ? 'green' : 'amber', sub: 'As of now' },
            { label: 'Battery', val: `${selected.batt}%`, cls: selected.batt >= 70 ? 'green' : selected.batt >= 40 ? 'amber' : 'red', sub: `Est. ${selected.batt >= 70 ? '4+' : '2-4'} years remaining` },
            { label: 'Signal', val: signalLabel(selected.signal), cls: selected.signal === 3 ? 'green' : selected.signal === 2 ? 'amber' : 'red', sub: 'RSSI −72 dBm' },
            { label: 'Last reading', val: selected.lastReading, cls: '', sub: `Interval: ${selected.interval}` },
          ].map(d => (
            <div key={d.label} style={{ background: '#f7f9f8', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 5 }}>{d.label}</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: d.cls === 'green' ? '#27500A' : d.cls === 'amber' ? '#633806' : d.cls === 'red' ? '#A32D2D' : '#1a2530' }}>{d.val}</div>
              <div style={{ fontSize: 10, color: '#aab8c0', marginTop: 2 }}>{d.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 500, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Activity log</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {logs.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: '#f7f9f8', borderRadius: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.type === 'ok' ? '#4CAF7D' : l.type === 'warn' ? '#EF9F27' : '#E24B4A', flexShrink: 0, marginTop: 4 }} />
              <div style={{ fontSize: 12, color: '#1a2530', flex: 1 }}>{l.text}</div>
              <div style={{ fontSize: 11, color: '#aab8c0', whiteSpace: 'nowrap' }}>{l.time}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FILTER + TABLE */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">Sensor inventory — {SENSORS.length} devices</div></div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f9f8', border: '0.5px solid #e8ede9', borderRadius: 6, padding: '0 10px', width: 220 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search silo or serial..." value={search} onChange={e => setSearch(e.target.value.toLowerCase())} style={{ border: 'none', outline: 'none', fontSize: 12, color: '#1a2530', background: 'transparent', width: '100%', padding: '7px 0' }} />
          </div>
          {['all', 'online', 'delayed', 'offline'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ border: '0.5px solid #c8d8cc', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#6a7a8a', background: '#fff', marginLeft: 'auto', fontFamily: 'inherit' }}>
            <option value="silo">Sort: Silo name</option>
            <option value="battery">Sort: Battery (low first)</option>
            <option value="signal">Sort: Signal strength</option>
          </select>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Silo / Sensor', 'Status', 'Battery', 'Signal', 'Model', 'Last reading', 'Actions'].map(h => <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 500, padding: '0 12px 10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #f0f4f0' }}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} onClick={() => setSelectedId(s.id)} style={{ cursor: 'pointer', background: s.id === selectedId ? '#eaf5ee' : '#fff' }}>
                <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{s.silo}</div>
                  <div style={{ fontSize: 11, color: '#aab8c0', fontFamily: 'monospace' }}>{s.serial}</div>
                </td>
                <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 10, background: statusBg(s.status), color: statusColor(s.status) }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(s.status) }} />
                    {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                  </span>
                </td>
                <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 40, height: 6, background: '#f7f9f8', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: battColor(s.batt), width: `${s.batt}%` }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#8a9aaa' }}>{s.batt}%</span>
                  </div>
                </td>
                <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                    {[1,2,3].map(b => <div key={b} style={{ width: 4, height: b * 5 + 2, borderRadius: 1, background: b <= s.signal ? '#4CAF7D' : '#e8ede9' }} />)}
                  </div>
                </td>
                <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{s.model}</td>
                <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0', fontSize: 12, color: '#8a9aaa' }}>{s.lastReading}</td>
                <td style={{ padding: 12, borderBottom: '0.5px solid #f0f4f0' }}>
                  <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, border: '0.5px solid #c8d8cc', background: 'transparent', color: '#4A90C4', textDecoration: 'none' }}>Map</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
