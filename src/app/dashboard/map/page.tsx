'use client'
import { useEffect, useRef, useState } from 'react'
import { SILOS, levelColor } from '@/lib/data'

export default function MapPage() {
  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (typeof window === 'undefined' || mapInstanceRef.current) return
    import('leaflet').then(L => {
      const map = L.map(mapRef.current!, { zoomControl: true }).setView([-36.7614, 144.2800], 17)
      mapInstanceRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        maxZoom: 20,
      }).addTo(map)

      const gwSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38"><rect x="1" y="1" width="36" height="36" rx="8" fill="#2D3E50" stroke="#4A90C4" stroke-width="2"/><path d="M8 19 a11 11 0 0 1 22 0" fill="none" stroke="#4A90C4" stroke-width="1.5" stroke-linecap="round"/><path d="M11 19 a8 8 0 0 1 16 0" fill="none" stroke="#4A90C4" stroke-width="1.5" stroke-linecap="round"/><path d="M14 19 a5 5 0 0 1 10 0" fill="none" stroke="#4A90C4" stroke-width="1.5" stroke-linecap="round"/><circle cx="19" cy="19" r="2" fill="#4A90C4"/></svg>`
      L.marker([-36.7614, 144.2800], { icon: L.divIcon({ html: gwSvg, iconSize: [38, 38], iconAnchor: [19, 19], className: '' }) }).addTo(map).bindPopup('<div style="padding:12px;font-family:system-ui;min-width:160px"><b>Master Gateway</b><br><small style="color:#8a9aaa">MQTT v2 · 15 sensors connected</small></div>')

      SILOS.forEach(silo => {
        const color = levelColor(silo.pct)
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="2.5"/><text x="20" y="25" text-anchor="middle" font-size="11" font-weight="600" fill="white" font-family="system-ui">${silo.pct}%</text><polygon points="20,44 13,32 27,32" fill="${color}"/></svg>`
        const popup = `<div style="padding:14px;font-family:system-ui;min-width:190px"><b style="font-size:14px">${silo.name}</b><p style="font-size:11px;color:#8a9aaa;margin:2px 0 10px">${silo.material}</p><div style="height:4px;background:#f0f4f0;border-radius:2px;margin-bottom:10px"><div style="height:100%;width:${silo.pct}%;background:${color};border-radius:2px"></div></div><table style="width:100%;font-size:12px"><tr><td style="color:#8a9aaa">Level</td><td style="text-align:right;font-weight:500;color:${color}">${silo.pct}%</td></tr><tr><td style="color:#8a9aaa">Available</td><td style="text-align:right;font-weight:500">${silo.kg.toLocaleString()} kg</td></tr><tr><td style="color:#8a9aaa">Days left</td><td style="text-align:right;font-weight:500;color:${color}">${silo.days} days</td></tr></table><a href="/dashboard/silo/${silo.id}" style="display:block;margin-top:10px;padding:7px;background:#1a2530;color:#fff;border-radius:6px;text-align:center;font-size:12px;text-decoration:none">View detail</a></div>`
        L.marker([silo.lat, silo.lng], { icon: L.divIcon({ html: svg, iconSize: [40, 48], iconAnchor: [20, 44], popupAnchor: [0, -44], className: '' }) }).addTo(map).bindPopup(popup, { maxWidth: 220 })
      })
    })
  }, [])

  const displayed = filter === 'all' ? SILOS : SILOS.filter(s => s.alert === filter)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Map view</div>
          <div className="page-sub">GPS location of all 15 silos · Granja Engorde · Bendigo VIC</div>
        </div>
        <div className="page-actions">
          <a href={`https://www.google.com/maps/@-36.7614,144.2800,18z`} target="_blank" rel="noreferrer" className="btn-outline">Open in Google Maps</a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, height: 560 }}>
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '0.5px solid #e8ede9' }}>
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
          <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 1000, background: '#fff', border: '0.5px solid #dde8e0', borderRadius: 8, padding: '10px 14px' }}>
            {[{ color: '#4CAF7D', label: 'OK — above 40%' }, { color: '#EF9F27', label: 'Low — 21 to 40%' }, { color: '#E24B4A', label: 'Critical — ≤ 20%' }, { color: '#4A90C4', label: 'Master Gateway', radius: 3 }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, fontSize: 11, color: '#6a7a8a' }}>
                <div style={{ width: 10, height: 10, borderRadius: l.radius ? 3 : '50%', background: l.color, flexShrink: 0 }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #e8ede9' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2530' }}>Granja Engorde</div>
            <div style={{ fontSize: 11, color: '#8a9aaa', marginTop: 2 }}>15 silos · All sensors online</div>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '0.5px solid #e8ede9' }}>
            {['all', 'critical', 'low'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {displayed.map(s => {
              const c = s.alert === 'critical' ? '#E24B4A' : s.alert === 'low' ? '#EF9F27' : '#4CAF7D'
              return (
                <a key={s.id} href={`/dashboard/silo/${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '0.5px solid #f0f4f0', textDecoration: 'none', background: selected === s.id ? '#eaf5ee' : '#fff' }} onClick={() => setSelected(s.id)}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#8a9aaa' }}>{s.material}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: c }}>{s.pct}%</div>
                    <div style={{ fontSize: 10, color: '#aab8c0' }}>{s.days}d left</div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
