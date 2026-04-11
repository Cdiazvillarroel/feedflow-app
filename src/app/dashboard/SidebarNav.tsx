'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { useFarm } from './FarmContext'
import { supabase } from '@/lib/supabase'
import { useClientModules } from '@/hooks/useClientModules'
import type { SidebarItem } from '@/lib/modules/config'

interface FeedMill { id: string; name: string }

const icons: Record<string, string> = {
  grid:      'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  bell:      'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  activity:  'M22 12h-4l-3 9L9 3l-3 9H2',
  ai:        'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4l3 3',
  map:       'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  trending:  'M23 6l-9.5 9.5-5-5L1 18',
  dollar:    'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  users:     'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  wifi:      'M12 20h.01M2 8.82a15 15 0 0 1 20 0M6 12.7a9 9 0 0 1 12 0M9.5 16.5a5 5 0 0 1 5 0',
  truck:     'M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  clipboard: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
  route:     'M3 12h18M3 6h18M3 18h18',
  driver:    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  settings:  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  grain:     'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 12h8M12 8v8',
  nutrition: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM8 12h8M12 8v8',
  formula:   'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18',
  forecast:  'M23 6l-9.5 9.5-5-5L1 18',
}

export default function SidebarNav() {
  const path   = usePathname()
  const router = useRouter()
  const { farms, visibleFarms, currentFarm, setCurrentFarm, selectedMillId, setSelectedMillId, loading: farmLoading } = useFarm()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [allFeedMills, setAllFeedMills] = useState<FeedMill[]>([])
  const [alertCount,   setAlertCount]   = useState(0)
  const [userId,       setUserId]       = useState<string | null>(null)

  const { sidebarGroups, hasAI, loading: modulesLoading } = useClientModules(userId)

  useEffect(() => {
    supabase.from('feed_mills').select('id, name').order('name')
      .then(({ data }) => setAllFeedMills(data || []))
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('acknowledged', false)
      .then(({ count }) => setAlertCount(count || 0))
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  // Filter mills to only those assigned to the client's farms
  const clientMillIds = useMemo(() => {
    const ids = new Set<string>()
    farms.forEach(f => { if (f.feed_mill_id) ids.add(f.feed_mill_id) })
    return ids
  }, [farms])

  const feedMills = useMemo(() =>
    allFeedMills.filter(m => clientMillIds.has(m.id)),
    [allFeedMills, clientMillIds]
  )

  // Only show mill selector if there are mills assigned
  const showMillSelector = feedMills.length > 0

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function renderItem(item: SidebarItem) {
    const active  = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href))
    const isAI    = item.icon === 'ai'
    const isTruck = item.icon === 'truck'
    const aiEnabled = hasAI(item.key)

    return (
      <Link key={item.href} href={item.href}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', margin: '1px 8px', borderRadius: 6, fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#166534' : '#374151', background: active ? '#dcfce7' : 'transparent', textDecoration: 'none' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke={isAI && !active ? '#4CAF7D' : isTruck && !active ? '#4A90C4' : 'currentColor'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}>
          <path d={icons[item.icon] || icons.grid} />
        </svg>
        <span style={{ flex: 1 }}>{item.label}</span>
        {isAI && !active && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(76,175,125,0.12)', color: '#4CAF7D', border: '0.5px solid rgba(76,175,125,0.3)' }}>AI</span>
        )}
        {aiEnabled && !isAI && !active && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: 'rgba(76,175,125,0.08)', color: '#4CAF7D', border: '0.5px solid rgba(76,175,125,0.2)' }}>✦</span>
        )}
        {item.badge && alertCount > 0 && (
          <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{alertCount}</span>
        )}
      </Link>
    )
  }

  return (
    <aside style={{ width: 220, minWidth: 220, background: '#ffffff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', padding: '0', overflowY: 'auto', flexShrink: 0, minHeight: 'calc(100vh - 56px)' }}>

      {/* ═══ TOP: FARM & MILL SELECTORS ═══ */}
      <div style={{ padding: '12px 10px 8px', borderBottom: '0.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Mill selector — only if client has mills */}
        {showMillSelector && (
          <div>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Feed mill</p>
            <div style={{ position: 'relative' }}>
              <select value={selectedMillId} onChange={e => setSelectedMillId(e.target.value)}
                style={{ width: '100%', padding: '7px 28px 7px 10px', background: '#f9fafb', border: '1px solid ' + (selectedMillId ? '#4A90C4' : '#e5e7eb'), borderRadius: 7, fontSize: 12, color: '#111827', fontFamily: 'inherit', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
                <option value="">All mills ({feedMills.length})</option>
                {feedMills.map(m => {
                  const count = farms.filter(f => f.feed_mill_id === m.id).length
                  return <option key={m.id} value={m.id}>{m.name} ({count})</option>
                })}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
            {selectedMillId && (
              <button onClick={() => setSelectedMillId('')}
                style={{ fontSize: 10, color: '#4A90C4', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>
                ✕ Clear mill filter
              </button>
            )}
          </div>
        )}

        {/* Farm selector */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setDropdownOpen(prev => !prev)}
            style={{ width: '100%', padding: '8px 10px', background: '#f9fafb', border: '1px solid ' + (dropdownOpen ? '#4CAF7D' : '#e5e7eb'), borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Current farm {selectedMillId ? '· filtered' : ''}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {farmLoading ? 'Loading...' : currentFarm?.name ?? 'Select farm'}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"
                style={{ flexShrink: 0, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
            {currentFarm?.location && (
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentFarm.location}</p>
            )}
          </button>

          {dropdownOpen && (
            <>
              <div onClick={() => setDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden', zIndex: 100, maxHeight: 320, overflowY: 'auto' }}>
                <div style={{ padding: '8px 12px 6px', borderBottom: '0.5px solid #f0f4f0', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                  <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                    {visibleFarms.length} farm{visibleFarms.length !== 1 ? 's' : ''}{selectedMillId ? ' — filtered' : ''}
                  </span>
                </div>
                {farmLoading ? (
                  <div style={{ padding: '12px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Loading...</div>
                ) : visibleFarms.length === 0 ? (
                  <div style={{ padding: '12px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>No farms for this mill</div>
                ) : visibleFarms.map(farm => {
                  const selected = farm.id === currentFarm?.id
                  return (
                    <button key={farm.id} onClick={() => { setDropdownOpen(false); if (!selected) setCurrentFarm(farm) }}
                      style={{ width: '100%', padding: '10px 12px', background: selected ? '#f0fdf4' : '#fff', border: 'none', textAlign: 'left', cursor: selected ? 'default' : 'pointer', borderBottom: '0.5px solid #f7f9f8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: selected ? '#4CAF7D' : '#e5e7eb' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: selected ? '#166534' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{farm.name}</div>
                          {farm.location && (
                            <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{farm.location}</div>
                          )}
                        </div>
                        {selected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4CAF7D" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ NAVIGATION ═══ */}
      <div style={{ flex: 1, paddingTop: 4 }}>
        {modulesLoading ? (
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ height: 32, borderRadius: 6, background: '#f0f4f0', animation: 'pulse 1.5s ease-in-out infinite', opacity: 1 - i * 0.08 }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:0.6}50%{opacity:1}}`}</style>
          </div>
        ) : (
          sidebarGroups.map(group => (
            <div key={group.section}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 18px 4px', margin: 0 }}>
                {group.section}
              </p>
              {group.items.map(item => renderItem(item))}
            </div>
          ))
        )}
      </div>

      {/* ═══ BOTTOM: SIGN OUT ═══ */}
      <div style={{ padding: '8px 10px 12px', borderTop: '0.5px solid #e5e7eb' }}>
        <button onClick={handleLogout}
          style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: '0.5px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6a7a8a', fontFamily: 'inherit' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}
