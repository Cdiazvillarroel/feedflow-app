'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface FeedMill {
  id: string; name: string; location: string | null
  lat: number | null; lng: number | null
  phone: string | null; email: string | null; active: boolean
}
interface Farm {
  id: string; name: string; location: string | null
  lat: number | null; lng: number | null
}
interface Silo {
  id: string; farm_id: string; name: string
  material: string | null; capacity_kg: number
}
interface SiloStatus {
  silo_id: string; level_pct: number; kg_remaining: number
  days_remaining: number; alert_level: string
}
interface DeliveryOrder {
  id: string; feed_mill_id: string; farm_id: string
  status: string; scheduled_at: string | null
  delivered_at: string | null; notes: string | null
  created_at: string
}
interface DeliveryOrderItem {
  id: string; delivery_order_id: string; silo_id: string
  material: string | null; kg_requested: number; kg_delivered: number
}
interface DeliveryRoute {
  id: string; feed_mill_id: string; name: string
  route_date: string; status: string; stops: any[]
  ai_reasoning: string | null; total_km: number | null
  created_at: string
}

type Tab = 'dashboard' | 'orders' | 'routes' | 'feedmills'

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: '#FAEEDA', color: '#633806', label: 'Pending'    },
  planned:    { bg: '#E6F1FB', color: '#0C447C', label: 'Planned'    },
  in_transit: { bg: '#eaf5ee', color: '#27500A', label: 'In transit' },
  delivered:  { bg: '#f0f4f0', color: '#6a7a8a', label: 'Delivered'  },
  cancelled:  { bg: '#FCEBEB', color: '#A32D2D', label: 'Cancelled'  },
}
const ROUTE_STATUS: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#f0f4f0', color: '#6a7a8a' },
  confirmed: { bg: '#E6F1FB', color: '#0C447C' },
  completed: { bg: '#eaf5ee', color: '#27500A' },
}

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}
function SectionTitle({ title }: { title: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0 8px', borderBottom: '0.5px solid #e8ede9', marginBottom: 12 }}>{title}</div>
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function urgencyScore(days: number, alertLevel: string, distKm: number) {
  const urgency = alertLevel === 'critical' ? 100 : alertLevel === 'low' ? 60 : 20
  const dayScore = Math.max(0, 100 - days * 5)
  const distScore = Math.max(0, 50 - distKm * 0.2)
  return urgency + dayScore + distScore
}

export default function LogisticsPage() {
  const [tab,       setTab]       = useState<Tab>('dashboard')
  const [feedMills, setFeedMills] = useState<FeedMill[]>([])
  const [farms,     setFarms]     = useState<Farm[]>([])
  const [silos,     setSilos]     = useState<Silo[]>([])
  const [siloStats, setSiloStats] = useState<SiloStatus[]>([])
  const [orders,    setOrders]    = useState<DeliveryOrder[]>([])
  const [orderItems,setOrderItems]= useState<DeliveryOrderItem[]>([])
  const [routes,    setRoutes]    = useState<DeliveryRoute[]>([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState('')
  const [saving,    setSaving]    = useState(false)

  // Drawers
  const [millDrawer,  setMillDrawer]  = useState<FeedMill | 'new' | null>(null)
  const [orderDrawer, setOrderDrawer] = useState<DeliveryOrder | 'new' | null>(null)
  const [routeDrawer, setRouteDrawer] = useState<DeliveryRoute | 'new' | null>(null)
  const [aiLoading,   setAiLoading]   = useState(false)

  // Forms
  const emptyMill  = { name: '', location: '', lat: '', lng: '', phone: '', email: '', active: true }
  const emptyOrder = { feed_mill_id: '', farm_id: '', status: 'pending', scheduled_at: '', notes: '' }
  const emptyRoute = { feed_mill_id: '', name: '', route_date: new Date().toISOString().split('T')[0], status: 'draft' }

  const [millForm,  setMillForm]  = useState(emptyMill)
  const [orderForm, setOrderForm] = useState(emptyOrder)
  const [orderItemForms, setOrderItemForms] = useState<{ silo_id: string; kg_requested: string }[]>([])
  const [routeForm, setRouteForm] =
