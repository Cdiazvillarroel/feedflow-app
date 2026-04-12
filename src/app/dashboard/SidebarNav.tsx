'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { useFarm } from './FarmContext'
import { supabase } from '@/lib/supabase'
import { useClientModules } from '@/hooks/useClientModules'
import type { SidebarItem } from '@/lib/modules/config'

interface FeedMill { id: string; name: string }

const T = {
  bgSidebar: '#1A2530',
  bgSidebarHover: '#243240',
  bgSidebarActive: '#2A3A4A',
  accent: '#4CAF7D',
  accentSoft: '#74C49A',
  textSidebarPrimary: '#C4D3DC',
  textSidebarMuted: '#6E8494',
  critical: '#E24B4A',
  warning: '#EF9F27',
  font: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
}

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
  const [collapsed,    setCollapsed]    = useState<Record<string, boolean>>({})

  const { sidebarGroups, hasAI, loading: modulesLoading } = useClientModules(userId)

  useEffect(() => {
    supabase.from('feed_mills').select('id, name').order('name')
      .then(({ data }) => setAllFeedMills(data || []))
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('acknowledged', false)
      .then(({ count }) => setAlertCount(count || 0))
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  // Initialize collapsed state: MONITOR expanded, others collapsed
  useEffect(() => {
    if (sidebarGroups.length > 0 && Object.keys(collapsed).length === 0) {
      const init: Record<string, boolean> = {}
      sidebarGroups.forEach((g, i) => {
        init[g.section] = i !== 0 // first section expanded, rest collapsed
      })
      setCollapsed(init)
    }
  }, [sidebarGroups])

  const clientMillIds = useMemo(() => {
    const ids = new Set<string>()
    farms.forEach(f => { if (f.feed_mill_id) ids.add(f.feed_mill_id) })
    return ids
  }, [farms])

  const feedMills = useMemo(() =>
    allFeedMills.filter(m => clientMillIds.has(m.id)),
    [allFeedMills, clientMillIds]
  )

  const showMillSelector = feedMills.length > 0

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function toggleSection(section: string) {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Check if section has badges (alerts)
  function sectionBadgeCount(items: SidebarItem[]) {
    return items.some(i => i.badge) ? alertCount : 0
  }

  function renderItem(item: SidebarItem) {
    const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href))
    const isAI   = item.icon === 'ai'

    return (
      <Link key={item.href} href={item.href}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', margin: '1px 8px', borderRadius: 6,
          fontSize: 14, fontFamily: T.font,
          fontWeight: active ? 500 : 400,
          color: active ? '#fff' : T.textSidebarPrimary,
          background: active ? T.bgSidebarActive : 'transparent',
          borderLeft: active ? `3px solid ${T.accent}` : '3px solid transparent',
          textDecoration: 'none',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = T.bgSidebarHover }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke={active ? '#fff' : isAI ? T.accentSoft : T.textSidebarMuted}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}>
          <path d={icons[item.icon] || icons.grid} />
        </svg>
        <span style={{ flex: 1 }}>{item.label}</span>
        {isAI && !active && (
          <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'rgba(76,175,125,0.15)', color: T.accent, border: '0.5px solid rgba(76,175,125,0.25)' }}>AI</span>
        )}
        {item.badge && alertCount > 0 && (
          <span style={{ background: T.critical, color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center' }}>{alertCount}</span>
        )}
      </Link>
    )
  }

  return (
    <aside style={{
      width: 230, minWidth: 230, background: T.bgSidebar,
      display: 'flex', flexDirection: 'column',
      flexShrink: 0, height: '100vh',
      position: 'sticky', top: 0,
      fontFamily: T.font,
    }}>

      {/* ═══ LOGO ═══ */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'center' }}>
        <img src="/logo-feedflow.png" alt="FeedFlow" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
      </div>

      {/* ═══ FARM SELECTOR ═══ */}
      <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Mill selector */}
        {showMillSelector && (
          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 10, color: T.textSidebarMuted, margin: '0 0 4px 2px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Feed mill</p>
            <div style={{ position: 'relative' }}>
              <select value={selectedMillId} onChange={e => setSelectedMillId(e.target.value)}
                style={{
                  width: '100%', padding: '7px 28px 7px 10px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid ' + (selectedMillId ? 'rgba(76,175,125,0.4)' : 'rgba(255,255,255,0.1)'),
                  borderRadius: 7, fontSize: 12, color: T.textSidebarPrimary,
                  fontFamily: T.font, cursor: 'pointer',
                  appearance: 'none', WebkitAppearance: 'none',
                }}>
                <option value="">All mills ({feedMills.length})</option>
                {feedMills.map(m => {
                  const count = farms.filter(f => f.feed_mill_id === m.id).length
                  return <option key={m.id} value={m.id}>{m.name} ({count})</option>
                })}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textSidebarMuted} strokeWidth="2.5"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
            {selectedMillId && (
              <button onClick={() => setSelectedMillId('')}
                style={{ fontSize: 10, color: T.accentSoft, background: 'none', border: 'none', cursor: 'pointer', padding: '3px 2px 0', fontFamily: T.font }}>
                ✕ Clear filter
              </button>
            )}
          </div>
        )}

        {/* Farm selector */}
        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: 10, color: T.textSidebarMuted, margin: '0 0 4px 2px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
            Current farm
          </p>
          <button onClick={() => setDropdownOpen(prev => !prev)}
            style={{
              width: '100%', padding: '8px 10px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid ' + (dropdownOpen ? 'rgba(76,175,125,0.4)' : 'rgba(255,255,255,0.1)'),
              borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              fontFamily: T.font,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {farmLoading ? 'Loading...' : currentFarm?.name ?? 'Select farm'}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textSidebarMuted} strokeWidth="2.5"
                style={{ flexShrink: 0, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
            {currentFarm?.location && (
              <p style={{ fontSize: 11, color: T.textSidebarMuted, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentFarm.location}</p>
            )}
          </button>

          {dropdownOpen && (
            <>
              <div onClick={() => setDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                background: '#fff', border: '1px solid #E2E8E4', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)', overflow: 'hidden', zIndex: 100,
                maxHeight: 320, overflowY: 'auto',
              }}>
                <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid #EEF2EF', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                  <span style={{ fontSize: 10, color: '#94A3A0', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                    {visibleFarms.length} farm{visibleFarms.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {farmLoading ? (
                  <div style={{ padding: '16px', fontSize: 12, color: '#94A3A0', textAlign: 'center' }}>Loading...</div>
                ) : visibleFarms.length === 0 ? (
                  <div style={{ padding: '16px', fontSize: 12, color: '#94A3A0', textAlign: 'center' }}>No farms found</div>
                ) : visibleFarms.map(farm => {
                  const selected = farm.id === currentFarm?.id
                  return (
                    <button key={farm.id} onClick={() => { setDropdownOpen(false); if (!selected) setCurrentFarm(farm) }}
                      style={{
                        width: '100%', padding: '10px 12px', background: selected ? '#F4F7F5' : '#fff',
                        border: 'none', textAlign: 'left', cursor: selected ? 'default' : 'pointer',
                        borderBottom: '1px solid #EEF2EF', fontFamily: T.font,
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: selected ? T.accent : '#E2E8E4' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: selected ? '#1a2530' : '#5F7068' }}>{farm.name}</div>
                          {farm.location && <div style={{ fontSize: 11, color: '#94A3A0', marginTop: 1 }}>{farm.location}</div>}
                        </div>
                        {selected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round">
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
      <div style={{ flex: 1, paddingTop: 6, overflowY: 'auto' }}>
        {modulesLoading ? (
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite', opacity: 1 - i * 0.1 }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
          </div>
        ) : (
          sidebarGroups.map(group => {
            const isCollapsed = collapsed[group.section] ?? false
            const badgeCount = sectionBadgeCount(group.items)
            return (
              <div key={group.section} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <button
                  onClick={() => toggleSection(group.section)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '12px 18px 6px', margin: 0, border: 'none', background: 'none',
                    cursor: 'pointer', fontFamily: T.font,
                  }}
                >
                  <span style={{
                    fontSize: 10.5, fontWeight: 600, color: T.textSidebarMuted,
                    textTransform: 'uppercase', letterSpacing: '1.2px', flex: 1, textAlign: 'left',
                  }}>
                    {group.section}
                  </span>
                  {isCollapsed && badgeCount > 0 && (
                    <span style={{ background: T.critical, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, minWidth: 16, textAlign: 'center' }}>
                      {badgeCount}
                    </span>
                  )}
                  <span style={{
                    fontSize: 11, color: T.textSidebarMuted,
                    transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                    transition: 'transform 0.2s', display: 'inline-block',
                  }}>›</span>
                </button>
                {!isCollapsed && (
                  <div style={{ paddingBottom: 6 }}>
                    {group.items.map(item => renderItem(item))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ═══ BOTTOM: USER + LOGOUT ═══ */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={handleLogout}
          style={{
            width: '100%', padding: '9px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: T.textSidebarMuted, fontFamily: T.font,
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}
