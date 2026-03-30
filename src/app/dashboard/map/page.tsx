'use client'
import { useEffect, useRef, useState } from 'react'
import { getSilosWithReadings } from '@/lib/queries'
import type { SiloWithReading } from '@/lib/types'

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [silos, setSilos] = useState<SiloWithReading[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSilosWithReadings().then(data => {
      setSilos(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (loading || !mapRef.current || mapInstanceRef.current || silos.length === 0) return

    // Calculate center from real GPS coordinates
    const lats = silos.filter(s => s.lat).map(s => s.lat!)
    const lngs = silos.filter(s => s.lng).map(s => s.lng!)
    const centerLat = lats.length ? lats.reduce((a, b) => a + b) / lats.length : -36.7614
    const centerLng = lngs.length ? lngs.reduce((a, b) => a + b) / lngs.length : 144.2795

    import('leaflet').then(L => {
      const map = L.map(mapRef.current!, { zoomControl: true }).setView([centerLat, centerLng], 17)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        maxZoom: 20,
      }).addTo(map)

      silos.forEach(silo => {
        if (!silo.lat || !silo.lng) return

        const color = silo.level_pct <= 20 ? '#E24B4A' : silo.level_pct <= 40 ? '#EF9F27' : '#4CAF7D'
        const pct = silo.level_pct.toFixed(0)
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="2.5"/><text x="20" y="25" text-anchor="middle" font-size="11" font-weight="600" fill="white" font-family="system-ui">${pct}%</text><polygon points="20,44 13,32 27,32" fill="${color}"/></svg>`

        const daysColor = silo.days_remaining <= 7 ? '#A32D2D' : silo.days_remaining <= 14 ? '#633806' : '#27500A'
        const lastRead = silo.hours_since_reading < 24
          ? `${Math.round(silo.hours_since_reading)}h ago`
          : `${Math.round(silo.hours_since_reading / 24)}d ago`

        const popup = `<div style="padding:14px;font-family:system-ui;min-width:190px">
          <b style="font-size:14px">${silo.name}</b>
          <p style="font-size:11px;color:#8a9aaa;margin:2px 0 10px">${silo.material || '—'}</p>
          <div style="height:4px;background:#f0f4f0;border-radius:2px;margin-bottom:10px">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
          </div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr><td style="color:#8a9aaa;padding:3px 0">Level</td><td style="text-align:right;font-weight:500;color:${color}">${pct}%</td></tr>
            <tr><td style="color:#8a9aaa;padding:3px 0">Available</td><td style="text-align:right;font-weight:500">${Math.round(silo.kg_remaining).toLocaleString()} kg</td></tr>
            <tr><td style="color:#8a9aaa;padding:3px 0">Days left</td><td style="text-align:right;font-weight:500;color:${daysColor}">${silo.days_remaining}d</td></tr>
            <tr><td style="color:#8a9aaa;padding:3px 0">Last reading</td><td style="text-align:right">${lastRead}</td></tr>
          </table>
          <a href="/dashboard/silo/${silo.id}" style="display:block;margin-top:10px;padding:7px;background:#1a2530;color:#fff;border-radius:6px;text-align:center;font-size:12px;text-decoration:none">View detail</a>
        </div>`

        L.marker([silo.lat!, silo.lng!], {
          icon: L.divIcon({ html: svg, iconSize: [40, 48], iconAnchor: [20, 44], popupAnchor: [0, -44], className: '' }),
        }).addTo(map).bindPopup(popup, { maxWidth: 220 })
      })
    })
  }, [loading, silos])

  const displayed = filter === 'all' ? silos : silos.filter(s => s.alert_level === filter)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Map view</div>
          <div className="page-sub">Real GPS coordinates · {silos.filter(s => s.lat).length} silos with GPS · Bendigo VIC</div>
        </div>
        <div className="page-actions">
          <a href="https://www.google.com/maps/@-36.7614,144.2800,18z" target="_blank" rel="noreferrer" className="btn-outline">
            Open in Google Maps
          </a>
        </div>
      </div>

      {loading ? (
        <div style={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a9aaa', fontSize: 14, background: '#f7f9f8', borderRadius: 10 }}>
          Loading map data...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, height: 560 }}>
          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '0.5px solid #e8ede9' }}>
            <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

            {/* LEGEND */}
            <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 1000, background: '#fff', border: '0.5px solid #dde8e0', borderRadius: 8, padding: '10px 14px' }}>
              {[
                { color: '#4CAF7D', label: 'OK — above 40%' },
                { color: '#EF9F27', label: 'Low — 21 to 40%' },
                { color: '#E24B4A', label: 'Critical — ≤ 20%' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, fontSize: 11, color: '#6a7a8a' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{ background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #e8ede9' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2530' }}>Granja Engorde</div>
              <div style={{ fontSize: 11, color: '#8a9aaa', marginTop: 2 }}>{silos.length} silos · Live data</div>
            </div>
            <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '0.5px solid #e8ede9' }}>
              {['all', 'critical', 'low'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {displayed.length === 0 ? (
                <div style={{ padding: 20, color: '#aab8c0', fontSize: 13, textAlign: 'center' }}>No silos in this category.</div>
              ) : (
                displayed.map(s => {
                  const c = s.alert_level === 'critical' ? '#E24B4A' : s.alert_level === 'low' ? '#EF9F27' : '#4CAF7D'
                  return (
                    <a key={s.id} href={`/dashboard/silo/${s.id}`} onClick={() => setSelected(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '0.5px solid #f0f4f0', textDecoration: 'none', background: selected === s.id ? '#eaf5ee' : '#fff' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2530' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#8a9aaa' }}>{s.material}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: c }}>{s.level_pct.toFixed(0)}%</div>
                        <div style={{ fontSize: 10, color: '#aab8c0' }}>{s.days_remaining}d left</div>
                      </div>
                    </a>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
