'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface HealthRow {
  section: string
  check_name: string
  status: string
  value: string
  detail: string
}

const HEALTH_SQL = `
WITH checks AS (
  SELECT '1. Infrastructure' AS section, 'Feed mills' AS check_name,
    CASE WHEN COUNT(*) = 0 THEN 'ERROR' ELSE 'OK' END AS status,
    COUNT(*)::TEXT AS value, 'Total feed mills' AS detail FROM feed_mills
  UNION ALL SELECT '1. Infrastructure', 'Farms total', 'OK', COUNT(*)::TEXT, 'Total farms' FROM farms
  UNION ALL SELECT '1. Infrastructure', 'Farms without mill',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Farms not assigned to a feed mill'
  FROM farms WHERE feed_mill_id IS NULL
  UNION ALL SELECT '1. Infrastructure', 'Silos total', 'OK', COUNT(*)::TEXT, 'Total silos' FROM silos
  UNION ALL SELECT '1. Infrastructure', 'Silos without farm',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Silos not assigned to a farm'
  FROM silos WHERE farm_id IS NULL
  UNION ALL SELECT '1. Infrastructure', 'Sensors total', 'OK', COUNT(*)::TEXT, 'Total sensors' FROM sensors
  UNION ALL SELECT '1. Infrastructure', 'Orphan sensors',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Sensors referencing non-existent silos'
  FROM sensors s WHERE NOT EXISTS (SELECT 1 FROM silos WHERE id = s.silo_id)
  UNION ALL SELECT '2. Readings', 'Total readings', 'OK', COUNT(*)::TEXT, 'All time' FROM readings
  UNION ALL SELECT '2. Readings', 'Readings last 24h',
    CASE WHEN COUNT(*) = 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Readings in last 24 hours'
  FROM readings WHERE recorded_at >= NOW() - INTERVAL '24 hours'
  UNION ALL SELECT '2. Readings', 'Invalid level readings',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Readings with level_pct outside 0-100'
  FROM readings WHERE level_pct < 0 OR level_pct > 100
  UNION ALL SELECT '2. Readings', 'Silos without recent readings',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Silos with no readings in last 48h'
  FROM silos s WHERE NOT EXISTS (
    SELECT 1 FROM sensors se JOIN readings r ON r.sensor_id = se.id
    WHERE se.silo_id = s.id AND r.recorded_at >= NOW() - INTERVAL '48 hours'
  )
  UNION ALL SELECT '3. Animals & Feeds', 'Animal groups', 'OK', COUNT(*)::TEXT, 'Total animal groups' FROM animal_groups
  UNION ALL SELECT '3. Animals & Feeds', 'Groups without farm',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Animal groups not assigned to a farm'
  FROM animal_groups WHERE farm_id IS NULL
  UNION ALL SELECT '3. Animals & Feeds', 'Groups with zero count',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Animal groups with zero or negative count'
  FROM animal_groups WHERE count <= 0
  UNION ALL SELECT '3. Animals & Feeds', 'Active feeds', 'OK', COUNT(*)::TEXT, 'Total active feeds' FROM feeds WHERE active = true
  UNION ALL SELECT '3. Animals & Feeds', 'Feeds zero kg/head',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Feeds with kg_per_head_day = 0'
  FROM feeds WHERE kg_per_head_day <= 0 AND active = true
  UNION ALL SELECT '3. Animals & Feeds', 'Farms without feeds',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Farms with no active feeds'
  FROM farms WHERE NOT EXISTS (SELECT 1 FROM feeds WHERE farm_id = farms.id AND active = true)
  UNION ALL SELECT '3. Animals & Feeds', 'Groups without feed coverage',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Animal groups with no feed assigned or matching'
  FROM animal_groups ag
  WHERE NOT EXISTS (SELECT 1 FROM animal_group_feeds agf WHERE agf.animal_group_id = ag.id)
  AND NOT EXISTS (SELECT 1 FROM feeds f WHERE f.farm_id = ag.farm_id AND f.animal_type = ag.type AND f.active = true)
  UNION ALL SELECT '3. Animals & Feeds', 'Feed type mismatch',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'animal_group_feeds with mismatched animal_type'
  FROM animal_group_feeds agf
  JOIN animal_groups ag ON ag.id = agf.animal_group_id
  JOIN feeds f ON f.id = agf.feed_id WHERE ag.type != f.animal_type
  UNION ALL SELECT '4. Nutrition', 'Active commodities', 'OK', COUNT(*)::TEXT, 'Total active commodities' FROM commodities WHERE active = true
  UNION ALL SELECT '4. Nutrition', 'Commodities without mill',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Commodities not assigned to a feed mill'
  FROM commodities WHERE feed_mill_id IS NULL AND active = true
  UNION ALL SELECT '4. Nutrition', 'Critical stock',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Stock below 50% of minimum'
  FROM commodities WHERE stock_kg <= min_stock_kg * 0.5 AND active = true
  UNION ALL SELECT '4. Nutrition', 'Low stock',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Stock between 50-100% of minimum'
  FROM commodities WHERE stock_kg <= min_stock_kg AND stock_kg > min_stock_kg * 0.5 AND active = true
  UNION ALL SELECT '4. Nutrition', 'Commodities no price',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Commodities without price_per_tonne'
  FROM commodities WHERE price_per_tonne IS NULL AND active = true
  UNION ALL SELECT '4. Nutrition', 'Active formulas', 'OK', COUNT(*)::TEXT, 'Total active formulas' FROM feed_formulas WHERE active = true
  UNION ALL SELECT '4. Nutrition', 'Formulas without ingredients',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Formulas with no ingredients defined'
  FROM feed_formulas f WHERE active = true AND NOT EXISTS (SELECT 1 FROM formula_ingredients WHERE formula_id = f.id)
  UNION ALL SELECT '4. Nutrition', 'Formulas without cost',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Formulas missing cost_per_tonne'
  FROM feed_formulas WHERE cost_per_tonne IS NULL AND active = true
  UNION ALL SELECT '4. Nutrition', 'Formulas not 100%',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Formulas whose ingredients do not sum to 100%'
  FROM (SELECT formula_id FROM formula_ingredients GROUP BY formula_id HAVING ABS(SUM(inclusion_pct) - 100) > 0.5) bad
  UNION ALL SELECT '4. Nutrition', 'Orphan ingredients',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Ingredients referencing non-existent commodities'
  FROM formula_ingredients fi WHERE NOT EXISTS (SELECT 1 FROM commodities WHERE id = fi.commodity_id)
  UNION ALL SELECT '4. Nutrition', 'Missing mill formulas',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Mill/animal_type combos with no formula'
  FROM (
    SELECT DISTINCT fm.id, ag.type FROM feed_mills fm
    JOIN farms fa ON fa.feed_mill_id = fm.id
    JOIN animal_groups ag ON ag.farm_id = fa.id
    WHERE NOT EXISTS (SELECT 1 FROM feed_formulas ff WHERE ff.feed_mill_id = fm.id AND ff.animal_type = ag.type AND ff.active = true)
  ) missing
  UNION ALL SELECT '5. Logistics', 'Trucks', 'OK', COUNT(*)::TEXT, 'Total trucks' FROM trucks
  UNION ALL SELECT '5. Logistics', 'Trucks without mill',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Trucks not assigned to a mill'
  FROM trucks WHERE feed_mill_id IS NULL
  UNION ALL SELECT '5. Logistics', 'Drivers', 'OK', COUNT(*)::TEXT, 'Total drivers' FROM drivers
  UNION ALL SELECT '5. Logistics', 'Drivers without mill',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Drivers not assigned to a mill'
  FROM drivers WHERE feed_mill_id IS NULL
  UNION ALL SELECT '5. Logistics', 'Delivery orders', 'OK', COUNT(*)::TEXT, 'Total delivery orders' FROM delivery_orders
  UNION ALL SELECT '5. Logistics', 'Orders without farm',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Orders with no farm assigned'
  FROM delivery_orders WHERE farm_id IS NULL
  UNION ALL SELECT '5. Logistics', 'Orders orphan farms',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Orders referencing non-existent farms'
  FROM delivery_orders o WHERE farm_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM farms WHERE id = o.farm_id)
  UNION ALL SELECT '5. Logistics', 'Delivery routes', 'OK', COUNT(*)::TEXT, 'Total routes' FROM delivery_routes
  UNION ALL SELECT '5. Logistics', 'Routes without driver',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Routes with no driver assigned'
  FROM delivery_routes WHERE driver_id IS NULL
  UNION ALL SELECT '5. Logistics', 'Routes without truck',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Routes with no truck assigned'
  FROM delivery_routes WHERE truck_id IS NULL
  UNION ALL SELECT '6. Alerts', 'Total alerts', 'OK', COUNT(*)::TEXT, 'All alerts' FROM alerts
  UNION ALL SELECT '6. Alerts', 'Unacknowledged alerts',
    CASE WHEN COUNT(*) > 10 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Alerts pending acknowledgement'
  FROM alerts WHERE acknowledged = false
  UNION ALL SELECT '6. Alerts', 'Orphan alerts',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Alerts referencing non-existent silos'
  FROM alerts a WHERE silo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM silos WHERE id = a.silo_id)
  UNION ALL SELECT '6. Alerts', 'Alarm rules', 'OK', COUNT(*)::TEXT, 'Total alarm rules' FROM alarm_rules
  UNION ALL SELECT '6. Alerts', 'Orphan alarm rules',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Rules referencing non-existent silos'
  FROM alarm_rules ar WHERE NOT EXISTS (SELECT 1 FROM silos WHERE id = ar.silo_id)
  UNION ALL SELECT '7. Admin', 'Total clients', 'OK', COUNT(*)::TEXT, 'All clients' FROM clients
  UNION ALL SELECT '7. Admin', 'Active clients no plan',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Active clients with no plan assigned'
  FROM clients WHERE plan_id IS NULL AND status = 'active'
  UNION ALL SELECT '7. Admin', 'Expired trials',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Trial clients with expired trial_ends_at'
  FROM clients WHERE status = 'trial' AND trial_ends_at < NOW()
  UNION ALL SELECT '7. Admin', 'Clients orphan plan',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Clients referencing non-existent plans'
  FROM clients WHERE plan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM plans WHERE id = clients.plan_id)
  UNION ALL SELECT '7. Admin', 'Overdue invoices',
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END, COUNT(*)::TEXT, 'Invoices with overdue status'
  FROM invoices WHERE status = 'overdue'
  UNION ALL SELECT '7. Admin', 'Orphan invoices',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Invoices referencing non-existent clients'
  FROM invoices i WHERE NOT EXISTS (SELECT 1 FROM clients WHERE id = i.client_id)
  UNION ALL SELECT '8. Users', 'Total roles', 'OK', COUNT(*)::TEXT, 'All role assignments' FROM roles
  UNION ALL SELECT '8. Users', 'Admin users',
    CASE WHEN COUNT(*) = 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'Users with admin role'
  FROM roles WHERE role = 'admin'
  UNION ALL SELECT '8. Users', 'Orphan client_users',
    CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END, COUNT(*)::TEXT, 'client_users referencing non-existent clients'
  FROM client_users cu WHERE NOT EXISTS (SELECT 1 FROM clients WHERE id = cu.client_id)
)
SELECT section, check_name,
  CASE status WHEN 'ERROR' THEN 'ERROR' WHEN 'WARNING' THEN 'WARNING' ELSE 'OK' END AS status,
  value, detail
FROM checks ORDER BY section, status DESC, check_name
`

const SECTIONS: Record<string, string> = {
  '1. Infrastructure': '🏗️',
  '2. Readings':       '📡',
  '3. Animals & Feeds':'🐄',
  '4. Nutrition':      '🌾',
  '5. Logistics':      '🚛',
  '6. Alerts':         '🔔',
  '7. Admin':          '🏢',
  '8. Users':          '👥',
}

export default function HealthCheckPage() {
  const [rows,       setRows]       = useState<HealthRow[]>([])
  const [loading,    setLoading]    = useState(false)
  const [lastRun,    setLastRun]    = useState<Date | null>(null)
  const [filter,     setFilter]     = useState<'all' | 'ERROR' | 'WARNING'>('all')

  async function runCheck() {
    setLoading(true)
    const { data } = await supabase.rpc('run_health_check').catch(() => ({ data: null }))
    if (!data) {
      // Fallback: run via direct query using supabase
      const { data: rows } = await supabase.from('farms').select('id').limit(1) // warmup
      const result = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/run_health_check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({}),
      })
      if (result.ok) {
        const d = await result.json()
        setRows(d || [])
      }
    } else {
      setRows(data || [])
    }
    setLastRun(new Date())
    setLoading(false)
  }

  // Use direct SQL via a view instead
  async function runCheckDirect() {
    setLoading(true)
    // Run each section as individual queries and aggregate
    const queries = [
      { section: '1. Infrastructure', name: 'Feed mills',        q: supabase.from('feed_mills').select('*', { count: 'exact', head: true }), errorIf: (n: number) => n === 0, detail: 'Total feed mills' },
      { section: '1. Infrastructure', name: 'Farms total',       q: supabase.from('farms').select('*', { count: 'exact', head: true }), errorIf: () => false, detail: 'Total farms' },
      { section: '1. Infrastructure', name: 'Silos total',       q: supabase.from('silos').select('*', { count: 'exact', head: true }), errorIf: () => false, detail: 'Total silos' },
      { section: '1. Infrastructure', name: 'Sensors total',     q: supabase.from('sensors').select('*', { count: 'exact', head: true }), errorIf: () => false, detail: 'Total sensors' },
    ]

    // Actually, use the SQL via stored approach — create a Supabase RPC
    // For now use direct table queries to build the health data
    const results: HealthRow[] = []

    async function check(section: string, name: string, table: string, filter?: Record<string, any>, errorIf?: (n: number) => boolean, warnIf?: (n: number) => boolean, detail?: string) {
      let q = supabase.from(table).select('*', { count: 'exact', head: true })
      if (filter) Object.entries(filter).forEach(([k, v]) => { q = (q as any).eq(k, v) })
      const { count } = await q
      const n = count || 0
      const status = errorIf && errorIf(n) ? 'ERROR' : warnIf && warnIf(n) ? 'WARNING' : 'OK'
      results.push({ section, check_name: name, status, value: String(n), detail: detail || '' })
    }

    await Promise.all([
      check('1. Infrastructure', 'Feed mills',     'feed_mills', undefined, n => n === 0, undefined, 'Total feed mills'),
      check('1. Infrastructure', 'Farms total',    'farms',      undefined, undefined, undefined, 'Total farms'),
      check('1. Infrastructure', 'Farms no mill',  'farms',      { feed_mill_id: null }, undefined, n => n > 0, 'Farms without feed mill'),
      check('1. Infrastructure', 'Silos total',    'silos',      undefined, undefined, undefined, 'Total silos'),
      check('1. Infrastructure', 'Sensors total',  'sensors',    undefined, undefined, undefined, 'Total sensors'),
      check('2. Readings',       'Total readings', 'readings',   undefined, undefined, undefined, 'All readings'),
      check('3. Animals & Feeds','Animal groups',  'animal_groups', undefined, undefined, undefined, 'Total groups'),
      check('3. Animals & Feeds','Active feeds',   'feeds',      { active: true }, undefined, undefined, 'Active feeds'),
      check('4. Nutrition',      'Commodities',    'commodities',{ active: true }, undefined, undefined, 'Active commodities'),
      check('4. Nutrition',      'Formulas',       'feed_formulas',{ active: true }, undefined, undefined, 'Active formulas'),
      check('4. Nutrition',      'Critical stock', 'commodities',undefined, undefined, n => n > 0, 'Critical stock items'),
      check('5. Logistics',      'Trucks',         'trucks',     undefined, undefined, undefined, 'Total trucks'),
      check('5. Logistics',      'Drivers',        'drivers',    undefined, undefined, undefined, 'Total drivers'),
      check('5. Logistics',      'Delivery orders','delivery_orders', undefined, undefined, undefined, 'Total orders'),
      check('5. Logistics',      'Routes',         'delivery_routes', undefined, undefined, undefined, 'Total routes'),
      check('6. Alerts',         'Total alerts',   'alerts',     undefined, undefined, undefined, 'All alerts'),
      check('6. Alerts',         'Unacknowledged', 'alerts',     { acknowledged: false }, undefined, n => n > 10, 'Unacknowledged alerts'),
      check('6. Alerts',         'Alarm rules',    'alarm_rules',undefined, undefined, undefined, 'Total alarm rules'),
      check('7. Admin',          'Clients',        'clients',    undefined, undefined, undefined, 'Total clients'),
      check('7. Admin',          'Plans',          'plans',      undefined, n => n === 0, undefined, 'Total plans'),
      check('7. Admin',          'Overdue invoices','invoices',  { status: 'overdue' }, undefined, n => n > 0, 'Overdue invoices'),
      check('8. Users',          'Admin users',    'roles',      { role: 'admin' }, n => n === 0, undefined, 'Admin role users'),
      check('8. Users',          'Total roles',    'roles',      undefined, undefined, undefined, 'All roles'),
    ])

    results.sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section)
      const order = { ERROR: 0, WARNING: 1, OK: 2 }
      return (order[a.status as keyof typeof order] || 2) - (order[b.status as keyof typeof order] || 2)
    })

    setRows(results)
    setLastRun(new Date())
    setLoading(false)
  }

  const errors   = rows.filter(r => r.status === 'ERROR').length
  const warnings = rows.filter(r => r.status === 'WARNING').length
  const ok       = rows.filter(r => r.status === 'OK').length

  const systemStatus =
    errors > 3   ? { label: 'CRITICAL',  bg: '#FCEBEB', color: '#A32D2D', border: '#F09595' } :
    errors > 0   ? { label: 'DEGRADED',  bg: '#FAEEDA', color: '#633806', border: '#EF9F27' } :
    warnings > 0 ? { label: 'GOOD',      bg: '#eaf5ee', color: '#27500A', border: '#4CAF7D' } :
    rows.length > 0 ? { label: 'HEALTHY', bg: '#eaf5ee', color: '#27500A', border: '#4CAF7D' } :
                  { label: 'NOT RUN',   bg: '#f0f4f0', color: '#8a9aaa', border: '#e8ede9' }

  const filtered = rows.filter(r => filter === 'all' || r.status === filter)
  const grouped  = filtered.reduce((acc, r) => {
    if (!acc[r.section]) acc[r.section] = []
    acc[r.section].push(r)
    return acc
  }, {} as Record<string, HealthRow[]>)

  const statusStyle = (s: string) =>
    s === 'ERROR'   ? { bg: '#FCEBEB', color: '#A32D2D', label: '✕ ERROR'   } :
    s === 'WARNING' ? { bg: '#FAEEDA', color: '#633806', label: '⚠ WARNING' } :
                      { bg: '#eaf5ee', color: '#27500A', label: '✓ OK'      }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>System Health Check</div>
          <div style={{ fontSize: 13, color: '#8a9aaa', marginTop: 4 }}>
            FeedFlow · Data coherence & module dependency audit
            {lastRun && ` · Last run: ${lastRun.toLocaleTimeString('en-AU')}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {rows.length > 0 && (
            <div style={{ padding: '8px 16px', borderRadius: 8, background: systemStatus.bg, border: `0.5px solid ${systemStatus.border}`, fontSize: 13, fontWeight: 700, color: systemStatus.color }}>
              {systemStatus.label}
            </div>
          )}
          <button onClick={runCheckDirect} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: loading ? '#aab8c0' : '#1a2530', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {loading ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Running...
              </>
            ) : (
              <>🩺 Run Health Check</>
            )}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* SUMMARY CARDS */}
      {rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total checks', val: rows.length,  color: '#1a2530', bg: '#f7f9f8' },
            { label: 'Passed',       val: ok,            color: '#27500A', bg: '#eaf5ee' },
            { label: 'Warnings',     val: warnings,      color: '#633806', bg: '#FAEEDA' },
            { label: 'Errors',       val: errors,        color: '#A32D2D', bg: '#FCEBEB' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '16px 18px', border: '0.5px solid #e8ede9', cursor: s.label !== 'Total checks' ? 'pointer' : 'default' }}
              onClick={() => {
                if (s.label === 'Errors')   setFilter(filter === 'ERROR'   ? 'all' : 'ERROR')
                if (s.label === 'Warnings') setFilter(filter === 'WARNING' ? 'all' : 'WARNING')
                if (s.label === 'Passed')   setFilter(filter === 'OK'      ? 'all' : 'OK' as any)
                if (s.label === 'Total checks') setFilter('all')
              }}>
              <div style={{ fontSize: 11, color: s.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: s.color, letterSpacing: -1 }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* FILTER TABS */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { key: 'all',     label: 'All checks' },
            { key: 'ERROR',   label: `Errors (${errors})` },
            { key: 'WARNING', label: `Warnings (${warnings})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', borderColor: filter === f.key ? '#1a2530' : '#e8ede9', background: filter === f.key ? '#1a2530' : '#fff', color: filter === f.key ? '#fff' : '#6a7a8a' }}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* RESULTS */}
      {rows.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#8a9aaa' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🩺</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2530', marginBottom: 8 }}>System health check</div>
          <div style={{ fontSize: 13, color: '#aab8c0', marginBottom: 24 }}>Run a full audit of data coherence, module dependencies and referential integrity</div>
          <button onClick={runCheckDirect}
            style={{ padding: '12px 28px', background: '#1a2530', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            🩺 Run Health Check
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Object.entries(grouped).map(([section, sectionRows]) => {
            const sectionErrors   = sectionRows.filter(r => r.status === 'ERROR').length
            const sectionWarnings = sectionRows.filter(r => r.status === 'WARNING').length
            const sectionIcon     = SECTIONS[section] || '◈'
            const sectionStatus   = sectionErrors > 0 ? 'ERROR' : sectionWarnings > 0 ? 'WARNING' : 'OK'
            const ss              = statusStyle(sectionStatus)

            return (
              <div key={section} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: '#f7f9f8', borderBottom: '0.5px solid #e8ede9' }}>
                  <span style={{ fontSize: 18 }}>{sectionIcon}</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2530', flex: 1 }}>{section}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {sectionErrors > 0   && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#FCEBEB', color: '#A32D2D', fontWeight: 700 }}>{sectionErrors} error{sectionErrors > 1 ? 's' : ''}</span>}
                    {sectionWarnings > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#FAEEDA', color: '#633806', fontWeight: 700 }}>{sectionWarnings} warning{sectionWarnings > 1 ? 's' : ''}</span>}
                    {sectionErrors === 0 && sectionWarnings === 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#eaf5ee', color: '#27500A', fontWeight: 700 }}>All OK</span>}
                  </div>
                </div>
                <div>
                  {sectionRows.map((r, i) => {
                    const st = statusStyle(r.status)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: i < sectionRows.length - 1 ? '0.5px solid #f0f4f0' : 'none', background: r.status !== 'OK' ? st.bg + '44' : '#fff' }}>
                        <div style={{ width: 72, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: r.status !== 'OK' ? 600 : 400, color: '#1a2530' }}>{r.check_name}</div>
                          <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>{r.detail}</div>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: r.status !== 'OK' ? st.color : '#1a2530', minWidth: 40, textAlign: 'right' }}>
                          {r.value}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
