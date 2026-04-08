'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

interface Silo  { id: string; name: string; material: string | null; capacity_kg: number; farm_id: string }
interface Farm  { id: string; name: string; location: string | null }
interface Order { id: string; farm_id: string; status: string; scheduled_at: string | null; driver_id: string | null }

export default function ConfirmPage() {
  const { token } = useParams()
  const [silo,      setSilo]      = useState<Silo | null>(null)
  const [farm,      setFarm]      = useState<Farm | null>(null)
  const [order,     setOrder]     = useState<Order | null>(null)
  const [kg,        setKg]        = useState('')
  const [notes,     setNotes]     = useState('')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    async function load() {
      if (!token) return
      const { data: siloData } = await supabase
        .from('silos').select('*').eq('qr_token', token).single()
      if (!siloData) { setError('Invalid QR code. Silo not found.'); setLoading(false); return }
      setSilo(siloData)

      const { data: farmData } = await supabase
        .from('farms').select('*').eq('id', siloData.farm_id).single()
      setFarm(farmData)

      const { data: orderData } = await supabase
        .from('delivery_orders')
        .select('*')
        .eq('farm_id', siloData.farm_id)
        .in('status', ['planned', 'in_transit'])
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single()
      setOrder(orderData)
      setLoading(false)
    }
    load()
  }, [token])

  async function confirm() {
    if (!silo || !kg) return
    setSaving(true)
    await supabase.from('delivery_confirmations').insert({
      silo_id:           silo.id,
      delivery_order_id: order?.id || null,
      driver_id:         order?.driver_id || null,
      kg_delivered:      parseFloat(kg) || 0,
      notes:             notes || null,
      confirmed_at:      new Date().toISOString(),
    })
    if (order) {
      await supabase.from('delivery_orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', order.id)
      await supabase.from('delivery_order_items').update({ kg_delivered: parseFloat(kg) || 0 }).eq('delivery_order_id', order.id).eq('silo_id', silo.id)
    }
    setSaving(false)
    setConfirmed(true)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f7f9f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#8a9aaa' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        Loading...
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#f7f9f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2530', marginBottom: 8 }}>Invalid QR code</div>
        <div style={{ fontSize: 14, color: '#8a9aaa' }}>{error}</div>
      </div>
    </div>
  )

  if (confirmed) return (
    <div style={{ minHeight: '100vh', background: '#f7f9f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#eaf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>✓</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', marginBottom: 8 }}>Delivery confirmed!</div>
        <div style={{ fontSize: 14, color: '#8a9aaa', marginBottom: 24, lineHeight: 1.6 }}>
          {kg} kg delivered to <strong>{silo?.name}</strong> at <strong>{farm?.name}</strong>.
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '0.5px solid #e8ede9', textAlign: 'left' }}>
          <div style={{ fontSize: 12, color: '#aab8c0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Confirmation details</div>
          {[
            { label: 'Silo',     value: silo?.name },
            { label: 'Farm',     value: farm?.name },
            { label: 'Material', value: silo?.material || '—' },
            { label: 'Kg delivered', value: kg + ' kg' },
            { label: 'Time',     value: new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f0f4f0' }}>
              <span style={{ fontSize: 12, color: '#8a9aaa' }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, fontSize: 12, color: '#aab8c0' }}>You can close this page.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f7f9f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#4CAF7D', fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 4 }}>
            Feed<span style={{ color: '#1a2530' }}>Flow</span>
          </div>
          <div style={{ fontSize: 11, color: '#aab8c0' }}>Delivery confirmation</div>
        </div>

        {/* Silo card */}
        <div style={{ background: '#1a2530', borderRadius: 14, padding: '20px 22px', marginBottom: 16, color: '#fff' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Delivery destination</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{silo?.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>{farm?.name} · {farm?.location || 'No address'}</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Material</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#4CAF7D', marginTop: 2 }}>{silo?.material || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Capacity</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{silo ? (silo.capacity_kg/1000).toFixed(0) + 't' : '—'}</div>
            </div>
            {order && (
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Order</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#EF9F27', marginTop: 2 }}>{order.status}</div>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e8ede9', padding: '24px 22px' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2530', marginBottom: 4 }}>Confirm delivery</div>
          <div style={{ fontSize: 12, color: '#8a9aaa', marginBottom: 20 }}>Enter the amount delivered to this silo</div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
              Kg delivered *
            </label>
            <input
              type="number" value={kg} onChange={e => setKg(e.target.value)}
              placeholder="e.g. 8500"
              style={{ width: '100%', padding: '12px 14px', border: '0.5px solid #c8d8cc', borderRadius: 8, fontSize: 16, color: '#1a2530', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
              Notes (optional)
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any delivery notes..."
              rows={2}
              style={{ width: '100%', padding: '10px 14px', border: '0.5px solid #c8d8cc', borderRadius: 8, fontSize: 14, color: '#1a2530', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>

          <button onClick={confirm} disabled={saving || !kg}
            style={{ width: '100%', padding: '14px', background: saving || !kg ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, color: '#fff', cursor: saving || !kg ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Confirming...' : 'Confirm delivery ✓'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#aab8c0' }}>
          FeedFlow · Powered by sensor intelligence
        </div>
      </div>
    </div>
  )
}
