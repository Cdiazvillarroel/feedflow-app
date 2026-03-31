import { supabase } from './supabase'
import type {
  Farm, Silo, Sensor, Reading, Alert, AlarmRule,
  AnimalGroup, FeedPrice, SiloWithReading, SiloLatestReading, FarmSummary
} from './types'

// Default farm ID — Granja El Roble demo
// In production this comes from the logged-in user's session
export const DEFAULT_FARM_ID = 'f0000001-0000-0000-0000-000000000001'

// ─── DAILY CONSUMPTION ESTIMATE ──────────────────────────────────────────────
// Calculates kg/day from last 2 readings
function estimateDailyConsumption(readings: Reading[]): number {
  if (readings.length < 2) return 400 // fallback default
  const latest = readings[0]
  const previous = readings[1]
  const hoursDiff =
    (new Date(latest.recorded_at).getTime() -
      new Date(previous.recorded_at).getTime()) /
    (1000 * 60 * 60)
  if (hoursDiff <= 0) return 400
  const kgConsumed = previous.kg_remaining - latest.kg_remaining
  const kgPerHour = kgConsumed / hoursDiff
  return Math.max(0, Math.round(kgPerHour * 24))
}

// ─── FARMS ────────────────────────────────────────────────────────────────────

export async function getFarm(farmId = DEFAULT_FARM_ID): Promise<Farm | null> {
  const { data, error } = await supabase
    .from('farms')
    .select('*')
    .eq('id', farmId)
    .single()
  if (error) {
    console.error('getFarm:', error)
    return null
  }
  return data
}

export async function getFarmSummary(farmId = DEFAULT_FARM_ID): Promise<FarmSummary | null> {
  const { data, error } = await supabase
    .from('farm_summary')
    .select('*')
    .eq('farm_id', farmId)
    .single()
  if (error) {
    console.error('getFarmSummary:', error)
    return null
  }
  return data
}

// ─── SILOS ────────────────────────────────────────────────────────────────────

export async function getSilos(farmId = DEFAULT_FARM_ID): Promise<Silo[]> {
  const { data, error } = await supabase
    .from('silos')
    .select('*')
    .eq('farm_id', farmId)
    .order('name')

  if (error) {
    console.error('getSilos:', error)
    return []
  }
  return data || []
}

export async function getSiloById(siloId: string): Promise<Silo | null> {
  const { data, error } = await supabase
    .from('silos')
    .select('*')
    .eq('id', siloId)
    .single()
  if (error) {
    console.error('getSiloById:', error)
    return null
  }
  return data
}

// Get all silos with their latest reading enriched
export async function getSilosWithReadings(farmId = DEFAULT_FARM_ID): Promise<SiloWithReading[]> {
  const { data: latestReadings, error: lrError } = await supabase
    .from('silo_latest_readings')
    .select('*')

  if (lrError) console.error('getSilosWithReadings view:', lrError)

  const silos = await getSilos(farmId)

  const { data: sensors, error: sensorsError } = await supabase
    .from('sensors')
    .select('*')

  if (sensorsError) console.error('getSilosWithReadings sensors:', sensorsError)

  return silos.map(silo => {
    const lr = (latestReadings || []).find(
      (r: SiloLatestReading) => r.silo_id === silo.id
    )
    const sensor = (sensors || []).find(
      (s: Sensor) => s.silo_id === silo.id
    )

    const level_pct = lr?.level_pct ?? 0
    const kg_remaining = lr?.kg_remaining ?? 0
    const kgDay = 400
    const days_remaining = kgDay > 0 ? Math.floor(kg_remaining / kgDay) : 0
    const hours_since = lr?.hours_since_reading ?? 999

    return {
      ...silo,
      latest_reading: lr
        ? {
            id: '',
            sensor_id: '',
            silo_id: silo.id,
            level_pct: lr.level_pct,
            kg_remaining: lr.kg_remaining,
            cubic_meters: lr.cubic_meters,
            distance_cm: lr.distance_cm,
            valid: lr.valid,
            error_type: lr.error_type,
            recorded_at: lr.recorded_at,
          }
        : null,
      sensor: sensor || null,
      level_pct,
      kg_remaining,
      days_remaining,
      alert_level: lr?.alert_level ?? 'ok',
      hours_since_reading: hours_since,
    } as SiloWithReading
  })
}

// ─── READINGS ─────────────────────────────────────────────────────────────────

export async function getLatestReading(siloId: string): Promise<Reading | null> {
  const { data, error } = await supabase
    .from('readings')
    .select('*')
    .eq('silo_id', siloId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('getLatestReading:', error)
    return null
  }
  return data
}

export async function getReadingHistory(
  siloId: string,
  days = 30
): Promise<Reading[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('readings')
    .select('*')
    .eq('silo_id', siloId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true })

  if (error) {
    console.error('getReadingHistory:', error)
    return []
  }
  return data || []
}

export async function getDailyConsumption(siloId: string): Promise<number> {
  const { data, error } = await supabase
    .from('readings')
    .select('kg_remaining, recorded_at')
    .eq('silo_id', siloId)
    .order('recorded_at', { ascending: false })
    .limit(10)

  if (error || !data || data.length < 2) return 400
  return estimateDailyConsumption(data as Reading[])
}

export async function getFarmReadings(
  farmId = DEFAULT_FARM_ID,
  days = 30
): Promise<(Reading & { silo_name: string; material: string })[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('readings')
    .select(`
      *,
      silos!inner (
        name,
        material,
        farm_id
      )
    `)
    .eq('silos.farm_id', farmId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: false })

  if (error) {
    console.error('getFarmReadings:', error)
    return []
  }

  return (data || []).map((r: any) => ({
    ...r,
    silo_name: r.silos?.name || '',
    material: r.silos?.material || '',
  }))
}

// ─── SENSORS ─────────────────────────────────────────────────────────────────

export async function getSensors(
  farmId = DEFAULT_FARM_ID
): Promise<(Sensor & { silo_name: string; silo_lat: number | null; silo_lng: number | null })[]> {
  const { data, error } = await supabase
    .from('sensors')
    .select(`
      *,
      silos!inner (
        name,
        lat,
        lng,
        farm_id
      )
    `)
    .eq('silos.farm_id', farmId)

  if (error) {
    console.error('getSensors:', error)
    return []
  }

  return (data || []).map((s: any) => ({
    ...s,
    silo_name: s.silos?.name || '',
    silo_lat: s.silos?.lat || null,
    silo_lng: s.silos?.lng || null,
  }))
}

export async function getSensorBySiloId(siloId: string): Promise<Sensor | null> {
  const { data, error } = await supabase
    .from('sensors')
    .select('*')
    .eq('silo_id', siloId)
    .single()

  if (error) {
    console.error('getSensorBySiloId:', error)
    return null
  }
  return data
}

// ─── ALERTS ───────────────────────────────────────────────────────────────────

export async function getAlerts(
  farmId = DEFAULT_FARM_ID,
  limit = 50
): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('farm_id', farmId)
    .order('triggered_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getAlerts:', error)
    return []
  }
  return data || []
}

export async function acknowledgeAlert(alertId: string): Promise<boolean> {
  const { error } = await supabase
    .from('alerts')
    .update({
      acknowledged: true,
      acked_at: new Date().toISOString(),
    })
    .eq('id', alertId)

  if (error) {
    console.error('acknowledgeAlert:', error)
    return false
  }
  return true
}

// ─── ALARM RULES ──────────────────────────────────────────────────────────────

export async function getAlarmRules(farmId = DEFAULT_FARM_ID): Promise<AlarmRule[]> {
  const { data, error } = await supabase
    .from('alarm_rules')
    .select('*')
    .eq('farm_id', farmId)
    .order('created_at')

  if (error) {
    console.error('getAlarmRules:', error)
    return []
  }
  return data || []
}

export async function toggleAlarmRule(ruleId: string, active: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('alarm_rules')
    .update({ active })
    .eq('id', ruleId)

  if (error) {
    console.error('toggleAlarmRule:', error)
    return false
  }
  return true
}

// ─── ANIMAL GROUPS ────────────────────────────────────────────────────────────

export async function getAnimalGroups(farmId = DEFAULT_FARM_ID): Promise<AnimalGroup[]> {
  const { data, error } = await supabase
    .from('animal_groups')
    .select('*')
    .eq('farm_id', farmId)
    .order('name')

  if (error) {
    console.error('getAnimalGroups:', error)
    return []
  }
  return data || []
}

export async function updateAnimalCount(groupId: string, count: number): Promise<boolean> {
  const { error } = await supabase
    .from('animal_groups')
    .update({ count, updated_at: new Date().toISOString() })
    .eq('id', groupId)

  if (error) {
    console.error('updateAnimalCount:', error)
    return false
  }
  return true
}

// ─── FEED PRICES ──────────────────────────────────────────────────────────────

export async function getFeedPrices(farmId = DEFAULT_FARM_ID): Promise<FeedPrice[]> {
  const { data, error } = await supabase
    .from('feed_prices')
    .select('*')
    .eq('farm_id', farmId)
    .order('material')

  if (error) {
    console.error('getFeedPrices:', error)
    return []
  }
  return data || []
}

export async function updateFeedPrice(
  farmId: string,
  material: string,
  price: number
): Promise<boolean> {
  const { error } = await supabase
    .from('feed_prices')
    .upsert(
      {
        farm_id: farmId,
        material,
        price_per_tonne: price,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'farm_id,material' }
    )

  if (error) {
    console.error('updateFeedPrice:', error)
    return false
  }
  return true
}

// ─── WRITE: Insert a new reading (used by PipeDream) ─────────────────────────

export async function insertReading(reading: Omit<Reading, 'id'>): Promise<boolean> {
  const { error } = await supabase
    .from('readings')
    .insert(reading)

  if (error) {
    console.error('insertReading:', error)
    return false
  }
  return true
}

// ─── WRITE: Create alert ──────────────────────────────────────────────────────

export async function createAlert(
  alert: Omit<Alert, 'id' | 'acknowledged' | 'triggered_at' | 'acked_at' | 'acked_by'>
): Promise<boolean> {
  const { error } = await supabase
    .from('alerts')
    .insert({ ...alert, acknowledged: false })

  if (error) {
    console.error('createAlert:', error)
    return false
  }
  return true
}
