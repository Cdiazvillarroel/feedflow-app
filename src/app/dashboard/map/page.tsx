'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFarm } from '@/app/dashboard/FarmContext'

interface SiloWithReading {
  id: string; name: string; material: string | null; capacity_kg: number
  lat: number | null; lng: number | null
  level_pct: number; kg_remaining: number; alert_level: string
  days_remaining: number; hours_since_reading: number
}

export default function MapPage() {
  const { currentFarm } = useFarm()
  const farmId = currentFarm?.id || ''

  const mapRef         = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef     = useRef<any[]>([])

  const [silos,    setSilos]    = useState<SiloWithReading[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [filter,   setFilter]   = useState('all')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { if (farmId) loadAll() }, [farmId])

  async function loadAll() {
    setLoading(true)
    // Destroy existing map when farm changes
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
      markersRef.current = []
    }
    const { data: silosData } = await supabase
      .from('silos')
      .select('id, name, material, capacity_kg, lat, lng')
      .eq('farm_id', farmId)

    if (!silosData || silosData.length === 0) { setSilos([]); setLoading(false); return }

    const siloIds = silosData.map(s => s.id)
    const { data: readings } = await supabase
      .from('readings')
      .select('silo_id, level_pct, kg_remaining, recorded_at')
      .in('silo_id', siloIds)
      .order('recorded_at', { ascending: false })

    // Get latest reading per silo
    const latestMap: Record<string, any> = {}
    ;(readings || []).forEach(r => { if (!latestMap[r.silo_id]) latestMap[r.silo_id] = r })

    const now = Date.now()
    const enriched: SiloWithReading[] = silosData.map(s => {
      const r = latestMap[s.id]
      const level_pct    = r?.level_pct    || 0
      const kg_remaining = r?.kg_remaining || 0
      const kgDay        = s.capacity_kg * 0.02
      const days_remaining = kgDay > 0 ? Math.floor(kg_remaining / kgDay) : 0
      const hours_since_reading = r ? (now - new Date(r.recorded_at).getTime()) / 3600000 : 999
      const alert_level = level_pct <= 20 ? 'critical' : level_pct <= 40 ? 'low' : 'ok'
      return { ...s, level_pct, kg_remaining, days_remaining, hours_since_reading, alert_level }
    })

    setSilos(enriched)
    setLoading(false)
  }

  useEffect(() => {
    if (loading || !mapRef.current || mapInstanceRef.current || silos.length === 0) return

    const withGps  = silos.filter(s => s.lat && s.lng)
    const centerLat = withGps.length ? withGps.reduce((a, b) => a + b.lat!, 0) / withGps.length : -36.7614
    const centerLng = withGps.length ? withGps.reduce((a, b) => a + b.lng!, 0) / withGps.length : 144.2795

    import('leaflet').then(L => {
      if (!mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current!, { zoomControl: true }).setView([centerLat, centerLng], 17)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 20,
      }).addTo(map)

      silos.forEach(silo => {
        if (!silo.lat || !silo.lng) return

        const color     = silo.level_pct <= 20 ? '#E24B4A' : silo.level_pct <= 40 ? '#EF9F27' : '#4CAF7D'
        const pct       = silo.level_pct.toFixed(0)
        const daysColor = silo.days_remaining <= 7 ? '#A32D2D' : silo.days_remaining <= 14 ? '#633806' : '#27500A'
        const lastRead  = silo.hours_since_reading < 24
          ? `${Math.round(silo.hours_since_reading)}h ago`
          : `${Math.round(silo.hours_since_reading / 24)}d ago`

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
          <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="2.5"/>
          <text x="20" y="25" text-anchor="middle" font-size="11" font-weight="600" fill="white" font-family="system-ui">${pct}%</text>
          <polygon points="20,44 13,32 27,32" fill="${color}"/>
        </svg>`

        const popup = `<div style="padding:14px;font-family:system-ui;min-width:190px">
          <b style="font-size:14px">${silo.name}</b>
          <p style="font-size:11px;color:#8a9aaa;margin:2px 0 10px">${silo.material || '—'}</p>
          <div style="height:4px;background:#f0f4f0;border-radius:2px;margin-bottom:10px">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
          </div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr><td style="color:#8a9aaa;padding:3px 0">Level</td><td style="text-align:right;font-weight:600;color:${color}">${pct}%</td></tr>
            <tr><td style="color:#8a9aaa;padding:3px 0">Available</td><td style="text-align:right;font-weight:500">${Math.round(silo.kg_remaining).toLocaleString()} kg</td></tr>
            <tr><td style="color:#8a9aaa;padding:3px 0">Days left</td><td style="text-align:right;font-weight:600;color:${daysColor}">${silo.days_remaining}d</td></tr>
            <tr><td style="color:#8a9aaa;padding:3px 0">Last reading</td><td style="text-align:right">${lastRead}</td></tr>
          </table>
        </div>`

        const marker = L.marker([silo.lat!, silo.lng!], {
          icon: L.divIcon({ html: svg, iconSize: [40, 48], iconAnchor: [20, 44], popupAnchor: [0, -44], className: '' }),
        }).addTo(map).bindPopup(popup, { maxWidth: 220 })

        markersRef.current.push(marker)
      })
    })
  }, [loading, silos])

  const displayed = filter === 'all' ? silos : silos.filter(s => s.alert_level === filter)

  const criticalCount = silos.filter(s => s.alert_level === 'critical').length
  const lowCount      = silos.filter(s => s.alert_level === 'low').length
  const okCount       = silos.filter(s => s.alert_level === 'ok').length
  const withGps       = silos.filter(s => s.lat && s.lng).length

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Map view</div>
          <div className="page-sub">{currentFarm?.name} · {withGps} silos with GPS · Live feed levels</div>
        </div>
        <div className="page-actions">
          {criticalCount > 0 && (
            <div style={{ padding: '7px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#A32D2D' }}>
              ⚠ {criticalCount} critical silo{criticalCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a9aaa', fontSize: 14, background: '#f7f9f8', borderRadius: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
            Loading map...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        </div>
      ) : silos.length === 0 ? (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a9aaa', fontSize: 14, background: '#f7f9f8', borderRadius: 10 }}>
          No silos found for {currentFarm?.name}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, height: 580 }}>

          {/* MAP */}
          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '0.5px solid #e8ede9' }}>
            <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
            {/* Legend */}
            <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 1000, background: 'rgba(255,255,255,0.95)', border: '0.5px solid #dde8e0', borderRadius: 8, padding: '10px 14px', backdropFilter: 'blur(4px)' }}>
              {[
                { color: '#4CAF7D', label: `OK — above 40% (${okCount})` },
                { color: '#EF9F27', label: `Low — 21–40% (${lowCount})` },
                { color: '#E24B4A', label: `Critical — ≤20% (${criticalCount})` },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, fontSize: 11, color: '#6a7a8a' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  {l.label}
                </div>
              ))}
            </div>
            {/* GPS coverage badge */}
            {withGps < silos.length && (
              <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, background: 'rgba(255,255,255,0.95)', border: '0.5px solid #e8ede9', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#8a9aaa' }}>
                {withGps}/{silos.length} silos have GPS
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div style={{ background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #e8ede9' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{currentFarm?.name}</div>
              <div style={{ fontSize: 11, color: '#8a9aaa', marginTop: 2 }}>{silos.length} silos · {withGps} with GPS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 10 }}>
                {[
                  { label: 'OK',       val: okCount,       color: '#4CAF7D', bg: '#eaf5ee' },
                  { label: 'Low',      val: lowCount,      color: '#EF9F27', bg: '#FAEEDA' },
                  { label: 'Critical', val: criticalCount, color: '#E24B4A', bg: '#FCEBEB' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: '10px 14px', borderBottom: '0.5px solid #e8ede9' }}>
              {['all', 'critical', 'low', 'ok'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ flex: 1, padding: '5px 4px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit',
                    borderColor: filter === f ? '#1a2530' : '#e8ede9',
                    background:  filter === f ? '#1a2530' : '#fff',
                    color:       filter === f ? '#fff' : '#6a7a8a' }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {displayed.length === 0 ? (
                <div style={{ padding: 20, color: '#aab8c0', fontSize: 13, textAlign: 'center' }}>No silos in this category.</div>
              ) : displayed.map(s => {
                const c = s.alert_level === 'critical' ? '#E24B4A' : s.alert_level === 'low' ? '#EF9F27' : '#4CAF7D'
                const isSelected = selected === s.id
                return (
                  <div key={s.id} onClick={() => setSelected(s.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '0.5px solid #f0f4f0', cursor: 'pointer', background: isSelected ? '#f4fbf7' : '#fff' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f7f9f8' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#fff' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#8a9aaa' }}>{s.material || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{s.level_pct.toFixed(0)}%</div>
                      <div style={{ fontSize: 10, color: '#aab8c0' }}>{s.days_remaining}d left</div>
                    </div>
                    {!s.lat && <div style={{ fontSize: 9, color: '#aab8c0', flexShrink: 0 }}>No GPS</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
