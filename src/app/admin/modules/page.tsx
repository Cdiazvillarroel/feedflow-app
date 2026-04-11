'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Client { id: string; name: string; plan_id: string | null; status: string }
interface Plan   { id: string; name: string; modules: string[] }
interface ClientModule { id: string; client_id: string; module: string; is_enabled: boolean }

const ALL_MODULES = [
  // Monitor
  { key: 'dashboard',   label: 'Dashboard',      icon: '◈',  desc: 'Main silo overview',              section: 'Monitor' },
  { key: 'alerts',      label: 'Alerts',          icon: '🔔', desc: 'Alarm rules & notifications',     section: 'Monitor' },
  { key: 'analytics',   label: 'Analytics',       icon: '📊', desc: 'Consumption charts & trends',     section: 'Monitor' },
  { key: 'forecast',    label: 'Forecast',        icon: '📈', desc: 'Consumption & cost projections',  section: 'Monitor' },
  { key: 'ai_insights', label: 'AI Insights',     icon: '🤖', desc: 'Claude AI daily analysis',        section: 'Monitor' },
  { key: 'map_view',    label: 'Map View',        icon: '🗺️', desc: 'GPS silo map',                    section: 'Monitor' },
  // Manage
  { key: 'feed_library', label: 'Feed Library',   icon: '🌾', desc: 'Feed profiles & nutrition',       section: 'Manage' },
  { key: 'feed_costs',   label: 'Feed Costs',     icon: '💰', desc: 'Cost per animal & projections',   section: 'Manage' },
  { key: 'animals',      label: 'Animals',        icon: '🐄', desc: 'Herd groups & rations',           section: 'Manage' },
  { key: 'sensors',      label: 'Sensors',        icon: '📡', desc: 'Device inventory & diagnostics',  section: 'Manage' },
  // Nutrition
  { key: 'nutrition_overview', label: 'Nutrition Overview',  icon: '🧪', desc: 'Mill KPIs & AI analysis',        section: 'Nutrition' },
  { key: 'commodity_library',  label: 'Commodity Library',   icon: '🌿', desc: 'Raw materials & stock tracking',  section: 'Nutrition' },
  { key: 'formula_manager',    label: 'Formula Manager',     icon: '⚗️', desc: 'Production formulas & costs',     section: 'Nutrition' },
  { key: 'demand_forecast',    label: 'Demand Forecast',     icon: '📉', desc: 'Ingredient demand projections',   section: 'Nutrition' },
  // Logistics
  { key: 'farm_monitor',  label: 'Farm Monitor',    icon: '🚛', desc: 'Multi-farm silo overview',       section: 'Logistics' },
  { key: 'orders',        label: 'Orders',           icon: '📋', desc: 'Delivery order management',      section: 'Logistics' },
  { key: 'route_planner', label: 'Route Planner',    icon: '🗂️', desc: 'Delivery route planning',        section: 'Logistics' },
  { key: 'drivers',       label: 'Drivers',           icon: '👤', desc: 'Driver & truck management',      section: 'Logistics' },
  // Settings
  { key: 'account',       label: 'Account',           icon: '⚙️', desc: 'Account settings',               section: 'Settings' },
]

export default function ModulesPage() {
  const [clients,       setClients]       = useState<Client[]>([])
  const [plans,         setPlans]         = useState<Plan[]>([])
  const [clientModules, setClientModules] = useState<ClientModule[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState<string>('')
  const [msg,           setMsg]           = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [clientsR, plansR, modulesR] = await Promise.all([
      supabase.from('clients').select('id, name, plan_id, status').order('name'),
      supabase.from('plans').select('id, name, modules').order('price_monthly'),
      supabase.from('client_modules').select('*'),
    ])
    const c = clientsR.data || []
    setClients(c)
    setPlans(plansR.data || [])
    setClientModules(modulesR.data || [])
    if (c.length > 0 && !selectedClient) setSelectedClient(c[0].id)
    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const currentClient = clients.find(c => c.id === selectedClient)
  const currentPlan   = plans.find(p => p.id === currentClient?.plan_id)
  const enabledForClient = clientModules
    .filter(m => m.client_id === selectedClient && m.is_enabled)
    .map(m => m.module)

  function isModuleEnabled(mod: string) {
    const override = clientModules.find(m => m.client_id === selectedClient && m.module === mod)
    if (override) return override.is_enabled
    return currentPlan?.modules.includes(mod) || false
  }

  function isInPlan(mod: string) {
    return currentPlan?.modules.includes(mod) || false
  }

  async function toggleModule(mod: string) {
    if (!selectedClient) return
    setSaving(mod)
    const current  = isModuleEnabled(mod)
    const existing = clientModules.find(m => m.client_id === selectedClient && m.module === mod)

    if (existing) {
      await supabase.from('client_modules').update({ is_enabled: !current }).eq('id', existing.id)
    } else {
      await supabase.from('client_modules').insert({ client_id: selectedClient, module: mod, is_enabled: !current })
    }
    showMsg(`${mod} ${!current ? 'enabled' : 'disabled'}`)
    setSaving('')
    loadAll()
  }

  async function applyPlanModules() {
    if (!selectedClient || !currentPlan) return
    setSaving('all')
    // Delete existing overrides
    await supabase.from('client_modules').delete().eq('client_id', selectedClient)
    // Insert plan modules as enabled
    await supabase.from('client_modules').insert(
      currentPlan.modules.map(mod => ({ client_id: selectedClient, module: mod, is_enabled: true }))
    )
    showMsg('Plan modules applied')
    setSaving('')
    loadAll()
  }

  async function disableAll() {
    if (!selectedClient || !confirm('Disable all modules for this client?')) return
    setSaving('all')
    await supabase.from('client_modules').delete().eq('client_id', selectedClient)
    await supabase.from('client_modules').insert(
      ALL_MODULES.map(m => ({ client_id: selectedClient, module: m.key, is_enabled: false }))
    )
    showMsg('All modules disabled')
    setSaving('')
    loadAll()
  }

  const statusBadge = (s: string) =>
    s === 'active'    ? { bg: '#eaf5ee', color: '#27500A' } :
    s === 'trial'     ? { bg: '#E6F1FB', color: '#0C447C' } :
    s === 'suspended' ? { bg: '#FCEBEB', color: '#A32D2D' } :
                        { bg: '#f0f4f0', color: '#6a7a8a'  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading modules...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>Module Access</div>
          <div style={{ fontSize: 13, color: '#8a9aaa', marginTop: 4 }}>Enable or disable modules per client — overrides plan defaults</div>
        </div>
        {msg && <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>✓ {msg}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>

        {/* CLIENT LIST */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', overflow: 'hidden', height: 'fit-content' }}>
          <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #e8ede9', fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Select client
          </div>
          {clients.map(c => {
            const badge    = statusBadge(c.status)
            const plan     = plans.find(p => p.id === c.plan_id)
            const isActive = c.id === selectedClient
            return (
              <div key={c.id} onClick={() => setSelectedClient(c.id)}
                style={{ padding: '12px 16px', borderBottom: '0.5px solid #f0f4f0', cursor: 'pointer', background: isActive ? '#f4fbf7' : '#fff', borderLeft: isActive ? '3px solid #4CAF7D' : '3px solid transparent' }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#f7f9f8' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#fff' }}>
                <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: '#1a2530', marginBottom: 4 }}>{c.name}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: badge.bg, color: badge.color, fontWeight: 600 }}>{c.status}</span>
                  {plan && <span style={{ fontSize: 10, color: '#aab8c0' }}>{plan.name}</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* MODULE GRID */}
        <div>
          {currentClient && (
            <div style={{ background: '#1a2530', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{currentClient.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  Plan: {currentPlan?.name || 'No plan'} · {enabledForClient.length} modules enabled
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {currentPlan && (
                  <button onClick={applyPlanModules} disabled={saving === 'all'}
                    style={{ padding: '7px 14px', background: 'rgba(76,175,125,0.15)', border: '0.5px solid rgba(76,175,125,0.3)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#4CAF7D', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Reset to plan
                  </button>
                )}
                <button onClick={disableAll} disabled={saving === 'all'}
                  style={{ padding: '7px 14px', background: 'rgba(226,75,74,0.15)', border: '0.5px solid rgba(226,75,74,0.3)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#E24B4A', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Disable all
                </button>
              </div>
            </div>
          )}

          {['Monitor', 'Manage', 'Nutrition', 'Logistics', 'Settings'].map(section => {
            const sectionModules = ALL_MODULES.filter(m => m.section === section)
            if (sectionModules.length === 0) return null
            return (
              <div key={section} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 0 8px', borderBottom: '0.5px solid #e8ede9', marginBottom: 10 }}>
                  {section}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {sectionModules.map(mod => {
                    const enabled   = isModuleEnabled(mod.key)
                    const inPlan    = isInPlan(mod.key)
                    const isLoading = saving === mod.key
                    const isOverride = clientModules.some(m => m.client_id === selectedClient && m.module === mod.key)

                    return (
                      <div key={mod.key} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid ' + (enabled ? '#4CAF7D44' : '#e8ede9'), padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: enabled ? '#eaf5ee' : '#f7f9f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                          {mod.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{mod.label}</span>
                            {isOverride && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#FAEEDA', color: '#633806', fontWeight: 600 }}>OVERRIDE</span>}
                            {inPlan && !isOverride && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#eaf5ee', color: '#27500A', fontWeight: 600 }}>PLAN</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#aab8c0' }}>{mod.desc}</div>
                        </div>
                        <button onClick={() => toggleModule(mod.key)} disabled={!!saving || !selectedClient}
                          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: enabled ? '#4CAF7D' : '#e8ede9', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: enabled ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
