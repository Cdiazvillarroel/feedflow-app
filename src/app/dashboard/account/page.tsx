'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getActiveFarmId } from '@/lib/queries'

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface Farm        { id: string; name: string; location: string | null; lat: number | null; lng: number | null; timezone: string }
interface Silo        { id: string; farm_id: string; name: string; material: string | null; capacity_kg: number; digitplan_silo_id: number | null; active: boolean }
interface Sensor      { id: string; silo_id: string; serial: string; model: string; status: string; battery_pct: number; signal_strength: number }
interface AnimalGroup { id: string; farm_id: string; name: string; type: string; icon: string | null; count: number }

type Tab = 'farms' | 'silos' | 'sensors' | 'animals' | 'users'

const ANIMAL_TYPES = ['pig', 'poultry', 'cattle', 'sheep', 'other']
const MATERIALS    = ['Lactation diet', 'Gestation diet', 'Maize meal', 'Wheat bran', 'Soybean meal', 'Barley', 'Other']
const TIMEZONES    = ['Australia/Melbourne', 'Australia/Sydney', 'Australia/Brisbane', 'Australia/Perth']
const ROLES        = ['owner', 'manager', 'viewer']

function inputStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function labelStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const [tab,     setTab]     = useState<Tab>('farms')
  const [farms,   setFarms]   = useState<Farm[]>([])
  const [silos,   setSilos]   = useState<Silo[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [animals, setAnimals] = useState<AnimalGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [msg,     setMsg]     = useState('')

  const activeFarmId = getActiveFarmId()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [f, s, sen, a] = await Promise.all([
      supabase.from('farms').select('*').order('name'),
      supabase.from('silos').select('*').order('name'),
      supabase.from('sensors').select('*'),
      supabase.from('animal_groups').select('*').order('name'),
    ])
    setFarms(f.data || [])
    setSilos(s.data || [])
    setSensors(sen.data || [])
    setAnimals(a.data || [])
    setLoading(false)
  }

  function showMsg(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'farms',   label: 'Farms',   count: farms.length },
    { key: 'silos',   label: 'Silos',   count: silos.length },
    { key: 'sensors', label: 'Sensors', count: sensors.length },
    { key: 'animals', label: 'Animals', count: animals.length },
    { key: 'users',   label: 'Users',   count: 0 },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading account...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Account</div>
          <div className="page-sub">Manage farms, silos, sensors, animals and users</div>
        </div>
        {msg && (
          <div style={{ padding: '7px 14px', background: '#eaf5ee', border: '0.5px solid #4CAF7D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#27500A' }}>
            ✓ {msg}
          </div>
        )}
      </div>

      <div style={{ displ
