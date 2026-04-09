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

declare global {
  interface Window { google: any; initGoogleMap: () => void }
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
  const [mapReady, setMapReady] = useState(false)

  // Load Google Maps script once
  useEffect(() => {
    if (window.google?.maps) { setMapReady(true); return }
    if (document.getElementById('gmap-script')) return

    window.initGoogleMap = () => setMapReady(true)
    const script = document.createElement('script')
    script.id  = 'gmap-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&callback=initGoogleMap&loading=async`
    script.async = true
    document.head.appendChild(script)
  }, [])

  useEffect(() => { if (farmId) loadAll() }, [farmId])

  async function loadAll() {
    setLoading(true)
    // Clear markers from previous farm
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const { data: silosData } = await supabase
      .from('silos').select('id, name, material, capacity_kg, lat, lng').eq('farm_id', farmId)

    if (!silosData || silosData.length === 0) { setSilos([]); setLoading(false); return }

    const siloIds = silosData.map(s => s.id)
    const { data: readings } = await supabase
      .from('readings').select('silo_id, level_pct, kg_remaining, recorded_at')
      .in('silo_id', siloIds).order('recorded_at', { ascending: false })

    const latestMap: Record<string, any> = {}
    ;(readings || []).forEach(r => { if (!latestMap[r.silo_id]) latestMap[r.silo_id] = r })

    const now = Date.now()
    const enriched: SiloWithReading[] = silosData.map(s => {
      const r = latestMap[s.id]
      const level_pct    = r?.level_pct    || 0
      const kg_remaining = r?.kg_remaining || 0
      const kgDay        = s.capacity_kg * 0.02
      const days_remaining      = kgDay > 0 ? Math.floor(kg_remaining / kgDay) : 0
      const hours_since_reading = r ? (now - new Date(r.recorded_at).getTime()) / 3600000 : 999
      const alert_level = level_pct <= 20 ? 'critical' : level_pct <= 40 ? 'low' : 'ok'
      return { ...s, level_pct, kg_remaining, days_remaining, hours_since_reading, alert_level }
    })
    setSilos(enriched)
    setLoading(false)
  }

  // Build / rebuild map when data + script are ready
  useEffect(() => {
    if (!mapReady || loading || !mapRef.current || silos.length === 0) return

    const G          = window.google.maps
    const withGps    = silos.filter(s => s.lat && s.lng)
    const centerLat  = withGps.length ? withGps.reduce((a, b) => a + b.lat!, 0) / withGps.length : -36.7614
    const centerLng  = withGps.length ? withGps.reduce((a, b) => a + b.lng!, 0) / withGps.length : 144.2795

    // Create or re-center map
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new G.Map(mapRef.current, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 16,
        mapTypeId: 'roadmap',
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
      })
    } else {
      mapInstanceRef.current.setCenter({ lat: centerLat, lng: centerLng })
    }

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const infoWindow = new G.InfoWindow()

    withGps.forEach(silo => {
      const color     = silo.level_pct <= 20 ? '#E24B4A' : silo.level_pct <= 40 ? '#EF9F27' : '#4CAF7D'
      const pct       = silo.level_pct.toFixed(0)
      const daysColor = silo.days_remaining <= 7 ? '#A32D2D' : silo.days_remaining <= 14 ? '#633806' : '#27500A'
      const lastRead  = silo.hours_since_reading < 24
        ? `${Math.round(silo.hours_since_reading)}h ago`
        : `${Math.round(silo.hours_since_reading / 24)}d ago`

      const svgMarker = {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
            <circle cx="22" cy="22" r="20" fill="${color}" stroke="white" stroke-width="3"/>
            <text x="22" y="27" text-anchor="middle" font-size="12" font-weight="700" fill="white" font-family="system-ui,sans-serif">${pct}%</text>
            <polygon points="22,50 14,34 30,34" fill="${color}"/>
          </svg>
        `)}`,
        scaledSize: new G.Size(44, 52),
        anchor:     new G.Point(22, 50),
      }

      const marker = new G.Marker({
        position: { lat: silo.lat!, lng: silo.lng! },
        map:      mapInstanceRef.current,
        icon:     svgMarker,
        title:    silo.name,
      })

      const content = `
        <div style="font-family:system-ui,sans-serif;padding:4px;min-width:200px">
          <div style="font-size:15px;font-weight:700;color:#1a2530;margin-bottom:2px">${silo.name}</div>
          <div style="font-size:12px;color:#8a9aaa;margin-bottom:10px">${silo.material || '—'}</div>
          <div style="height:6px;background:#f0f4f0;border-radius:3px;margin-bottom:12px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:3px"></div>
          </div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr><td style="color:#8a9aaa;padding:3px 0">Level</td><td style="text-align:right;font-weight:700;color:${color}">${pct}%</td></tr>
            <tr><td style="color:#8a9aaa;padding:3px 0">Available</td><td style="text-align:right;font-weight:600">${Math.round(silo.kg_remaining).toLocaleString()} kg</td></tr>
            <tr><td style="color:#8a9aaa;padding:3px 0">Days left</td><td style="text-align:right;font-weight:700;color:${daysColor}">${silo.days_remaining}d</td></tr>
            <tr><td style="color:#8a9aaa;padding:3px 0">Last reading</td><td style="text-align:right">${lastRead}</td></tr>
          </table>
        </div>
      `

      marker.addListener('click', () => {
        infoWindow.setContent(content)
        infoWindow.open(mapInstanceRef.current, marker)
        setSelected(silo.id)
      })

      markersRef.current.push(marker)
    })
  }, [mapReady, loading, silos])

  const displayed      = filter === 'all' ? silos : silos.filter(s => s.alert_level === filter)
  const criticalCount  = silos.filter(s => s.alert_level === 'critical').length
  const lowCount       = silos.filter(s => s.alert_level === 'low').length
  const okCount        = silos.filter(s => s.alert_level === 'ok').length
  const withGpsCount   = silos.filter(s => s.lat && s.lng).length

  function panToSilo(silo: SiloWithReading) {
    if (!mapInstanceRef.current || !silo.lat || !silo.lng) return
    mapInstanceRef.current.panTo({ lat: silo.lat, lng: silo.lng })
    mapInstanceRef.current.setZoom(19)
    setSelected(silo.id)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Map view</div>
          <div className="page-sub">{currentFarm?.name} · {withGpsCount} silos with GPS · Live feed levels</div>
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
        <div style={{ height: 580, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a9aaa', fontSize: 14, background: '#f7f9f8', borderRadius: 10 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, height: 600 }}>

          {/* MAP */}
          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '0.5px solid #e8ede9' }}>
            <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
            {/* Legend */}
            <div style={{ position: 'absolute', bottom: 32, left: 12, zIndex: 5, background: 'rgba(255,255,255,0.95)', border: '0.5px solid #dde8e0', borderRadius: 8, padding: '10px 14px', backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              {[
                { color: '#4CAF7D', label: `OK  (${okCount})` },
                { color: '#EF9F27', label: `Low  (${lowCount})` },
                { color: '#E24B4A', label: `Critical  (${criticalCount})` },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, fontSize: 11, color: '#6a7a8a' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{ background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #e8ede9' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{currentFarm?.name}</div>
              <div style={{ fontSize: 11, color: '#8a9aaa', marginTop: 2 }}>{silos.length} silos · {withGpsCount} with GPS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 10 }}>
                {[
                  { label: 'OK',       val: okCount,       color: '#27500A', bg: '#eaf5ee' },
                  { label: 'Low',      val: lowCount,      color: '#633806', bg: '#FAEEDA' },
                  { label: 'Critical', val: criticalCount, color: '#A32D2D', bg: '#FCEBEB' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: '10px 12px', borderBottom: '0.5px solid #e8ede9' }}>
              {['all','critical','low','ok'].map(f => (
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
                const c          = s.alert_level === 'critical' ? '#E24B4A' : s.alert_level === 'low' ? '#EF9F27' : '#4CAF7D'
                const isSelected = selected === s.id
                return (
                  <div key={s.id} onClick={() => panToSilo(s)}
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
                    {!s.lat && <span style={{ fontSize: 9, color: '#aab8c0' }}>No GPS</span>}
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
