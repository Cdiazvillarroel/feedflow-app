'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Stats {
  clients: number; farms: number; silos: number; sensors: number
  activeClients: number; trialClients: number; mrr: number
}

export default function AdminOverview() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    const [clientsR, farmsR, silosR, sensorsR, plansR, invoicesR] = await Promise.all([
      supabase.from('clients').select('id, status, plan_id'),
      supabase.from('farms').select('id'),
      supabase.from('silos').select('id'),
      supabase.from('sensors').select('id'),
      supabase.from('plans').select('id, price_monthly'),
      supabase.from('invoices').select('amount, status').eq('status', 'paid'),
    ])
    const clients = clientsR.data || []
    const paidInvoices = invoicesR.data || []
    setStats({
      clients:       clients.length,
      activeClients: clients.filter(c => c.status === 'active').length,
      trialClients:  clients.filter(c => c.status === 'trial').length,
      farms:   (farmsR.data   || []).length,
      silos:   (silosR.data   || []).length,
      sensors: (sensorsR.data || []).length,
      mrr:     paidInvoices.reduce((s, i) => s + i.amount, 0),
    })
    setLoading(false)
  }

  const KPI = ({ label, val, sub, color }: { label: string; val: string | number; sub?: string; color?: string }) => (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', border: '0.5px solid #e8ede9' }}>
      <div style={{ fontSize: 11, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || '#1a2530', letterSpacing: -1 }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>Admin Overview</div>
        <div style={{ fontSize: 13, color: '#8a9aaa', marginTop: 4 }}>Agrometrics · FeedFlow SaaS Platform</div>
      </div>

      {loading ? (
        <div style={{ color: '#8a9aaa', fontSize: 14 }}>Loading stats...</div>
      ) : stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <KPI label="Total clients"   val={stats.clients}       sub={`${stats.activeClients} active · ${stats.trialClients} trial`} />
            <KPI label="Total farms"     val={stats.farms}         sub="Across all clients" />
            <KPI label="Total silos"     val={stats.silos}         sub="Monitored" />
            <KPI label="Paid invoices"   val={`$${Math.round(stats.mrr).toLocaleString()}`} sub="Total collected AUD" color="#27500A" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <KPI label="Active sensors" val={stats.sensors} sub="Registered" color="#4A90C4" />
            <KPI label="Active clients" val={stats.activeClients} color="#27500A" />
            <KPI label="Trial clients"  val={stats.trialClients}  color="#633806" />
          </div>

          <div style={{ background: '#1a2530', borderRadius: 12, padding: '20px 24px', color: '#fff' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Quick actions</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              {[
                { label: '+ New client',  href: '/admin/clients?new=1',  color: '#4CAF7D' },
                { label: '+ New farm',    href: '/admin/farms?new=1',    color: '#4A90C4' },
                { label: '+ New invoice', href: '/admin/invoices?new=1', color: '#EF9F27' },
                { label: 'View audit log',href: '/admin/audit',          color: '#aab8c0' },
              ].map(a => (
                <a key={a.label} href={a.href}
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', background: a.color + '22', border: `0.5px solid ${a.color}44`, textDecoration: 'none' }}>
                  {a.label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
