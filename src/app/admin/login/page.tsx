'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLogin() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin() {
    setLoading(true); setError('')
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (data.ok) router.push('/admin')
    else { setError(data.error || 'Invalid credentials'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1720', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: 380, background: '#1a2530', borderRadius: 16, padding: '40px 36px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
            Feed<span style={{ color: '#4CAF7D' }}>Flow</span>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>Agrometrics Admin Panel</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@agrometrics.com"
              style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, color: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, color: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ fontSize: 12, color: '#E24B4A', padding: '8px 12px', background: 'rgba(226,75,74,0.1)', borderRadius: 6 }}>{error}</div>}
          <button onClick={handleLogin} disabled={loading}
            style={{ width: '100%', padding: '12px', background: loading ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
            {loading ? 'Signing in...' : 'Sign in to Admin'}
          </button>
        </div>
      </div>
    </div>
  )
}
