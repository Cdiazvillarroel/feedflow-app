import { supabase } from './supabase'
import type {
  Farm, Silo, Sensor, Reading, Alert, AlarmRule,
  AnimalGroup, FeedPrice, SiloWithReading, SiloLatestReading, FarmSummary
} from './types'

export const DEFAULT_FARM_ID = 'f0000001-0000-0000-0000-000000000001'

// Gets the active farm ID from localStorage (set by farm selector)
// Falls back to DEFAULT_FARM_ID if not set
export function getActiveFarmId(): string {
  if (typeof window === 'undefined') return DEFAULT_FARM_ID
  return localStorage.getItem('feedflow_farm_id') || DEFAULT_FARM_ID
}

// ─── DAILY CONSUMPTION ESTIMATE ──────────────────────────────────────────────
function estimateDailyConsumption(
  readings: { kg_remaining: number; recorded_at: string }[]
): number {
  if (readings.length < 2) return 400
  const latest   = readings[0]
  const previous = readings[1]
  const hoursDiff =
    (new Date(latest.recorded_at).getTime() -
      new Date(previous.recorded_at).getTime()) / 3600000
  if (hoursDiff <= 0) return 400
  const kgConsumed = previous.kg_remaining - latest.kg_remaining
  if (kgConsumed <= 0) return 400 // delivery event or no change
  return Math.max(50, Math.round((kgConsumed / hoursDiff) * 24))
}

// ─── FARMS ────────────────────────────────────────────────────────────────────

export async function getFarm(farmId = DEFAULT_FARM_ID): Promise<Farm | null> {
  const { data, error } = await supabase
    .from('farms').select('*').eq('id', farmId).single()
  if (error) { console.error('getFarm:', error); return null }
  return data
}

export async function getFarmSummary(farmId?: string): Promise<FarmSummary | null> {
  const id = farmId || getActiveFarmId()
  const { data, error } = await supabase
    .from('farm_summary').select('*').eq('farm_id', id).single()
  if (error) { console.error('getFarmSummary:', error); return null }
  return data
}

// ─── SILOS ────────────────────────────────────────────────────────────────────

export async function getSilos(farmId?: string): Promise<Silo[]> {
  const id = farmId || getActiveFarmId()
  const { data, error } = await supabase
    .from('silos').select('*').eq('farm_id', id).order('name')
  if (error) { console.error('getSilos:', error); return [] }
  return data || []
}

export async function getSiloById(siloId: string): Promise<Silo | null> {
  const { data, error } = await supabase
    .from('silos').select('*').eq('id', siloId).single()
  if (error) { console.error('getSiloById:', error); return null }
  return data
}

export async function getSilosWithReadings(farmId?: string): Promise<SiloWithReading[]> {
  const id = farmId || getActiveFarmId()

  const { data: latestReadings, error: lrError } = await supabase
    .from('silo_latest_readings').select('*')
  if (lrError) console.error('getSilosWithReadings view:', lrError)

  const silos = await getSilos(id)

  const { data: sensors, error: sensorsError } = await supabase
    .from('sensors').select('*')
  if (sensorsError) console.error('getSilosWithReadings sensors:', sensorsError)

  const siloIds = silos.map(s => s.id)
  const { data: recentReadings } = await supabase
    .from('readings')
    .select('silo_id, kg_remaining, recorded_at')
    .in('silo_id', siloIds)
    .order('recorded_at', { ascending: false })
    .limit(siloIds.length * 4)

  const readingsBySilo: Record<string, { kg_remaining: number; recorded_at: string }[]> = {}
  for (const r of recentReadings || []) {
    if (!readingsBySilo[r.silo_id]) readingsBySilo[r.silo_id] = []
    if (readingsBySilo[r.silo_id].length < 4) readingsBySilo[r.silo_id].push(r)
  }

  return silos.map(silo => {
    const lr = (latestReadings || []).find(
      (r: SiloLatestReading) => r.silo_id === silo.id
    )
    const sensor = (sensors || []).find((s: Sensor) => s.silo_id === silo.id)

    const level_pct    = lr?.level_pct    ?? 0
    const kg_remaining = lr?.kg_remaining ?? 0
    const hours_since  = lr?.hours_since_reading ?? 999

    const siloReadings = readingsBySilo[silo.id] || []
    const kgDay        = estimateDailyConsumption(siloReadings)
    const days_remaining = kgDay > 0 ? Math.floor(kg_remaining / kgDay) : 0

    return {
      ...silo,
      latest_reading: lr ? {
        id: '', sensor_id: '', silo_id: silo.id,
        level_pct:    lr.level_pct,
        kg_remaining: lr.kg_remaining,
        cubic_meters: lr.cubic_meters,
        distance_cm:  lr.distance_cm,
        valid:        lr.valid,
        error_type:   lr.error_type,
        recorded_at:  lr.recorded_at,
      } : null,
      sensor:              sensor || null,
      level_pct,
      kg_remaining,
      days_remaining,
      alert_level:         lr?.alert_level ?? 'ok',
      hours_since_reading: hours_since,
    } as SiloWithReading
  })
}

// ─── READINGS ─────────────────────────────────────────────────────────────────

export async function getLatestReading(siloId: string): Promise<Reading | null> {
  const { data, error } = await supabase
    .from('readings').select('*').eq('silo_id', siloId)
    .order('recorded_at', { ascending: false }).limit(1).single()
  if (error) { console.error('getLatestReading:', error); return null }
  return data
}

export async function getReadingHistory(siloId: string, days = 30): Promise<Reading[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data, error } = await supabase
    .from('readings').select('*').eq('silo_id', siloId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true })
  if (error) { console.error('getReadingHistory:', error); return [] }
  return data || []
}

export async function getDailyConsumption(siloId: string): Promise<number> {
  const { data, error } = await supabase
    .from('readings').select('kg_remaining, recorded_at')
    .eq('silo_id', siloId)
    .order('recorded_at', { ascending: false }).limit(10)
  if (error || !data || data.length < 2) return 400
  return estimateDailyConsumption(data)
}

export async function getFarmReadings(
  farmId?: string,
  days = 30
): Promise<(Reading & { silo_name: string; material: string })[]> {
  const id = farmId || getActiveFarmId()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data, error } = await supabase
    .from('readings')
    .select('*, silos!inner(name, material, farm_id)')
    .eq('silos.farm_id', id)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: false })
  if (error) { console.error('getFarmReadings:', error); return [] }
  return (data || []).map((r: any) => ({
    ...r,
    silo_name: r.silos?.name     || '',
    material:  r.silos?.material || '',
  }))
}

// ─── SENSORS ─────────────────────────────────────────────────────────────────

export async function getSensors(
  farmId?: string
): Promise<(Sensor & { silo_name: string; silo_lat: number | null; silo_lng: number | null })[]> {
  const id = farmId || getActiveFarmId()
  const { data, error } = await supabase
    .from('sensors')
    .select('*, silos!inner(name, lat, lng, farm_id)')
    .eq('silos.farm_id', id)
  if (error) { console.error('getSensors:', error); return [] }
  return (data || []).map((s: any) => ({
    ...s,
    silo_name: s.silos?.name || '',
    silo_lat:  s.silos?.lat  || null,
    silo_lng:  s.silos?.lng  || null,
  }))
}

export async function getSensorBySiloId(siloId: string): Promise<Sensor | null> {
  const { data, error } = await supabase
    .from('sensors').select('*').eq('silo_id', siloId).single()
  if (error) { console.error('getSensorBySiloId:', error); return null }
  return data
}

// ─── ALERTS ───────────────────────────────────────────────────────────────────

export async function getAlerts(farmId?: string, limit = 50): Promise<Alert[]> {
  const id = farmId || getActiveFarmId()
  const { data, error } = await supabase
    .from('alerts').select('*').eq('farm_id', id)
    .order('triggered_at', { ascending: false }).limit(limit)
  if (error) { console.error('getAlerts:', error); return [] }
  return data || []
}

export async function acknowledgeAlert(alertId: string): Promise<boolean> {
  const { error } = await supabase
    .from('alerts')
    .update({ acknowledged: true, acked_at: new Date().toISOString() })
    .eq('id', alertId)
  if (error) { console.error('acknowledgeAlert:', error); return false }
  return true
}

// ─── ALARM RULES ──────────────────────────────────────────────────────────────

export async function getAlarmRules(farmId?: string): Promise<AlarmRule[]> {
  const id = farmId || getActiveFarmId()
  const { data, error } = await supabase
    .from('alarm_rules').select('*').eq('farm_id', id).order('created_at')
  if (error) { console.error('getAlarmRules:', error); return [] }
  return data || []
}

export async function toggleAlarmRule(ruleId: string, active: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('alarm_rules').update({ active }).eq('id', ruleId)
  if (error) { console.error('toggleAlarmRule:', error); return false }
  return true
}

// ─── ANIMAL GROUPS ────────────────────────────────────────────────────────────

export async function getAnimalGroups(farmId?: string): Promise<AnimalGroup[]> {
  const id = farmId || getActiveFarmId()
  const { data, error } = await supabase
    .from('animal_groups').select('*').eq('farm_id', id).order('name')
  if (error) { console.error('getAnimalGroups:', error); return [] }
  return data || []
}

export async function updateAnimalCount(groupId: string, count: number): Promise<boolean> {
  const { error } = await supabase
    .from('animal_groups')
    .update({ count, updated_at: new Date().toISOString() })
    .eq('id', groupId)
  if (error) { console.error('updateAnimalCount:', error); return false }
  return true
}

// ─── FEED PRICES ──────────────────────────────────────────────────────────────

export async function getFeedPrices(farmId?: string): Promise<FeedPrice[]> {
  const id = farmId || getActiveFarmId()
  const { data, error } = await supabase
    .from('feed_prices').select('*').eq('farm_id', id).order('material')
  if (error) { console.error('getFeedPrices:', error); return [] }
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
      { farm_id: farmId, material, price_per_tonne: price, updated_at: new Date().toISOString() },
      { onConflict: 'farm_id,material' }
    )
  if (error) { console.error('updateFeedPrice:', error); return false }
  return true
}

// ─── WRITE ────────────────────────────────────────────────────────────────────

export async function insertReading(reading: Omit<Reading, 'id'>): Promise<boolean> {
  const { error } = await supabase.from('readings').insert(reading)
  if (error) { console.error('insertReading:', error); return false }
  return true
}

export async function createAlert(
  alert: Omit<Alert, 'id' | 'acknowledged' | 'triggered_at' | 'acked_at' | 'acked_by'>
): Promise<boolean> {
  const { error } = await supabase
    .from('alerts').insert({ ...alert, acknowledged: false })
  if (error) { console.error('createAlert:', error); return false }
  return true
}
