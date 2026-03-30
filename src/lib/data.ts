// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface Silo {
  id: number
  name: string
  material: string
  pct: number
  kg: number
  days: number
  status: 'ok' | 'warn' | 'offline'
  reading: string
  alert: 'critical' | 'low' | 'ok'
  lat: number
  lng: number
  capacity: number
  density: number
  kgDay: number
  priceT: number
}

export interface Sensor {
  id: number
  silo: string
  serial: string
  model: string
  status: 'online' | 'delayed' | 'offline'
  batt: number
  signal: 1 | 2 | 3
  lastReading: string
  interval: string
  firmware: string
  installed: string
  lat: number
  lng: number
}

export interface AnimalGroup {
  id: string
  name: string
  type: 'pig' | 'poultry' | 'cattle'
  icon: string
  count: number
  phases: string[]
  activePhase: number
  rations: { material: string; kgPerHead: number; color: string; priceT: number }[]
  avgWeight: number
  targetWeight: number
  daysToMarket: number | null
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

export const SILOS: Silo[] = [
  { id: 1,  name: 'Silo 1',  material: 'Maize meal',   pct: 12, kg: 1680,  days: 4,  status: 'ok',   reading: '2h ago', alert: 'critical', lat: -36.7608, lng: 144.2788, capacity: 14000, density: 600, kgDay: 420, priceT: 420 },
  { id: 2,  name: 'Silo 2',  material: 'Wheat bran',   pct: 18, kg: 2520,  days: 6,  status: 'ok',   reading: '2h ago', alert: 'critical', lat: -36.7610, lng: 144.2792, capacity: 14000, density: 380, kgDay: 380, priceT: 310 },
  { id: 3,  name: 'Silo 3',  material: 'Soybean meal', pct: 28, kg: 4200,  days: 9,  status: 'ok',   reading: '2h ago', alert: 'low',      lat: -36.7612, lng: 144.2796, capacity: 15000, density: 590, kgDay: 310, priceT: 680 },
  { id: 4,  name: 'Silo 4',  material: 'Maize meal',   pct: 35, kg: 5250,  days: 11, status: 'ok',   reading: '2h ago', alert: 'low',      lat: -36.7614, lng: 144.2800, capacity: 15000, density: 600, kgDay: 290, priceT: 420 },
  { id: 5,  name: 'Silo 5',  material: 'Barley',       pct: 38, kg: 5320,  days: 12, status: 'warn', reading: '6h ago', alert: 'low',      lat: -36.7616, lng: 144.2788, capacity: 14000, density: 620, kgDay: 260, priceT: 290 },
  { id: 6,  name: 'Silo 6',  material: 'Soybean meal', pct: 52, kg: 7280,  days: 17, status: 'ok',   reading: '2h ago', alert: 'ok',       lat: -36.7618, lng: 144.2792, capacity: 14000, density: 590, kgDay: 340, priceT: 680 },
  { id: 7,  name: 'Silo 7',  material: 'Wheat bran',   pct: 61, kg: 8540,  days: 20, status: 'ok',   reading: '2h ago', alert: 'ok',       lat: -36.7620, lng: 144.2796, capacity: 14000, density: 380, kgDay: 295, priceT: 310 },
  { id: 8,  name: 'Silo 8',  material: 'Maize meal',   pct: 67, kg: 9380,  days: 22, status: 'ok',   reading: '2h ago', alert: 'ok',       lat: -36.7622, lng: 144.2800, capacity: 14000, density: 600, kgDay: 410, priceT: 420 },
  { id: 9,  name: 'Silo 9',  material: 'Barley',       pct: 71, kg: 9940,  days: 24, status: 'ok',   reading: '2h ago', alert: 'ok',       lat: -36.7606, lng: 144.2804, capacity: 14000, density: 620, kgDay: 275, priceT: 290 },
  { id: 10, name: 'Silo 10', material: 'Soybean meal', pct: 74, kg: 10360, days: 25, status: 'ok',   reading: '2h ago', alert: 'ok',       lat: -36.7608, lng: 144.2808, capacity: 14000, density: 590, kgDay: 320, priceT: 680 },
  { id: 11, name: 'Silo 11', material: 'Maize meal',   pct: 78, kg: 10920, days: 26, status: 'ok',   reading: '2h ago', alert: 'ok',       lat: -36.7610, lng: 144.2812, capacity: 14000, density: 600, kgDay: 390, priceT: 420 },
  { id: 12, name: 'Silo 12', material: 'Wheat bran',   pct: 81, kg: 11340, days: 27, status: 'ok',   reading: '2h ago', alert: 'ok',       lat: -36.7624, lng: 144.2804, capacity: 14000, density: 380, kgDay: 280, priceT: 310 },
  { id: 13, name: 'Silo 13', material: 'Barley',       pct: 85, kg: 11900, days: 28, status: 'ok',   reading: '2h ago', alert: 'ok',       lat: -36.7626, lng: 144.2808, capacity: 14000, density: 620, kgDay: 265, priceT: 290 },
  { id: 14, name: 'Silo 14', material: 'Soybean meal', pct: 88, kg: 12320, days: 30, status: 'ok',   reading: '2h ago', alert: 'ok',       lat: -36.7628, lng: 144.2812, capacity: 14000, density: 590, kgDay: 305, priceT: 680 },
  { id: 15, name: 'Silo 15', material: 'Maize meal',   pct: 92, kg: 12880, days: 31, status: 'ok',   reading: '2h ago', alert: 'ok',       lat: -36.7620, lng: 144.2816, capacity: 14000, density: 600, kgDay: 440, priceT: 420 },
]

export const SENSORS: Sensor[] = SILOS.map((s, i) => ({
  id: s.id,
  silo: s.name,
  serial: `20${67 + i}DC`,
  model: 'SiloMetric Laser',
  status: i === 4 ? 'delayed' : 'online',
  batt: [87,82,79,91,74,68,95,88,61,77,83,92,56,71,89][i],
  signal: [3,3,2,3,2,3,3,3,2,3,3,3,2,3,3][i] as 1|2|3,
  lastReading: i === 4 ? '6h ago' : '2h ago',
  interval: '2h',
  firmware: i === 4 ? 'v3.1.1' : 'v3.1.2',
  installed: `Jan ${12 + Math.floor(i/3)}, 2025`,
  lat: s.lat,
  lng: s.lng,
}))

export const ANIMAL_GROUPS: AnimalGroup[] = [
  {
    id: 'pig-grower', name: 'Grower pigs', type: 'pig', icon: '🐷', count: 850,
    phases: ['Starter', 'Grower', 'Finisher'], activePhase: 1,
    rations: [
      { material: 'Maize meal', kgPerHead: 1.4, color: '#4CAF7D', priceT: 420 },
      { material: 'Soybean meal', kgPerHead: 0.6, color: '#EF9F27', priceT: 680 },
      { material: 'Wheat bran', kgPerHead: 0.4, color: '#4A90C4', priceT: 310 },
    ],
    avgWeight: 62, targetWeight: 110, daysToMarket: 38,
  },
  {
    id: 'pig-sow', name: 'Sow herd', type: 'pig', icon: '🐖', count: 120,
    phases: ['Gestation', 'Lactation', 'Dry'], activePhase: 0,
    rations: [
      { material: 'Soybean meal', kgPerHead: 1.8, color: '#EF9F27', priceT: 680 },
      { material: 'Maize meal', kgPerHead: 1.3, color: '#4CAF7D', priceT: 420 },
    ],
    avgWeight: 210, targetWeight: 210, daysToMarket: null,
  },
  {
    id: 'broilers', name: 'Broilers', type: 'poultry', icon: '🐔', count: 4200,
    phases: ['Day 1–7', 'Day 8–21', 'Day 22–35'], activePhase: 2,
    rations: [
      { material: 'Wheat bran', kgPerHead: 0.12, color: '#4A90C4', priceT: 310 },
      { material: 'Soybean meal', kgPerHead: 0.06, color: '#EF9F27', priceT: 680 },
    ],
    avgWeight: 1.8, targetWeight: 2.5, daysToMarket: 14,
  },
  {
    id: 'cattle', name: 'Beef cattle', type: 'cattle', icon: '🐄', count: 65,
    phases: ['Backgrounding', 'Finishing'], activePhase: 1,
    rations: [
      { material: 'Barley', kgPerHead: 5.2, color: '#E24B4A', priceT: 290 },
      { material: 'Maize meal', kgPerHead: 3.0, color: '#4CAF7D', priceT: 420 },
    ],
    avgWeight: 420, targetWeight: 580, daysToMarket: 55,
  },
  {
    id: 'pig-wean', name: 'Weaners', type: 'pig', icon: '🐽', count: 320,
    phases: ['Early wean', 'Late wean'], activePhase: 0,
    rations: [
      { material: 'Maize meal', kgPerHead: 0.4, color: '#4CAF7D', priceT: 420 },
      { material: 'Soybean meal', kgPerHead: 0.3, color: '#EF9F27', priceT: 680 },
    ],
    avgWeight: 8, targetWeight: 28, daysToMarket: 42,
  },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function levelColor(pct: number): string {
  if (pct <= 20) return '#E24B4A'
  if (pct <= 40) return '#EF9F27'
  return '#4CAF7D'
}

export function alertClass(alert: string): string {
  if (alert === 'critical') return 'red'
  if (alert === 'low') return 'amber'
  return 'green'
}
