// ─── DATABASE TYPES ───────────────────────────────────────────────────────────
// These match exactly the columns in Supabase

export interface Farm {
  id: string
  name: string
  location: string | null
  lat: number | null
  lng: number | null
  timezone: string
  created_at: string
}

export interface Silo {
  id: string
  farm_id: string
  name: string
  material: string | null
  capacity_kg: number
  density_kg_m3: number | null
  lat: number | null
  lng: number | null
  digitplan_silo_id: number | null
  active: boolean
  created_at: string
}

export interface Sensor {
  id: string
  silo_id: string
  serial: string
  model: string
  firmware: string | null
  status: 'online' | 'delayed' | 'offline'
  battery_pct: number
  signal_strength: number
  installed_at: string
  last_seen_at: string
}

export interface Reading {
  id: string
  sensor_id: string
  silo_id: string
  level_pct: number
  kg_remaining: number
  cubic_meters: number | null
  distance_cm: number | null
  valid: boolean
  error_type: string | null
  recorded_at: string
}

export interface Alert {
  id: string
  silo_id: string | null
  farm_id: string
  type: 'critical' | 'warning' | 'info'
  severity: string
  title: string
  message: string | null
  acknowledged: boolean
  triggered_at: string
  acked_at: string | null
  acked_by: string | null
}

export interface AlarmRule {
  id: string
  silo_id: string | null
  farm_id: string
  name: string
  trigger_type: 'level_below' | 'level_above' | 'sensor_offline' | 'no_reading'
  threshold_pct: number | null
  channel: 'telegram' | 'email' | 'both'
  active: boolean
  created_at: string
}

export interface AnimalGroup {
  id: string
  farm_id: string
  name: string
  type: 'pig' | 'poultry' | 'cattle' | 'sheep' | 'other'
  icon: string | null
  count: number
  updated_at: string
}

export interface FeedPrice {
  id: string
  farm_id: string
  material: string
  price_per_tonne: number
  updated_at: string
}

// ─── ENRICHED TYPES (joins) ───────────────────────────────────────────────────

// Silo with its latest reading attached
export interface SiloWithReading extends Silo {
  latest_reading: Reading | null
  sensor: Sensor | null
  // Computed fields
  level_pct: number
  kg_remaining: number
  days_remaining: number
  alert_level: 'critical' | 'low' | 'ok'
  hours_since_reading: number
}

// Summary view returned by Supabase view
export interface SiloLatestReading {
  silo_id: string
  silo_name: string
  material: string
  capacity_kg: number
  level_pct: number
  kg_remaining: number
  cubic_meters: number | null
  distance_cm: number | null
  valid: boolean
  error_type: string | null
  recorded_at: string
  alert_level: 'critical' | 'low' | 'ok'
  hours_since_reading: number
}

export interface FarmSummary {
  farm_id: string
  farm_name: string
  total_silos: number
  critical_silos: number
  low_silos: number
  total_kg_available: number
  avg_level_pct: number
}
