'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f9f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, background: '#4CAF7D', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>FeedFlow</span>
          </div>
          <p style={{ fontSize: 13, color: '#8a9aaa', margin: 0 }}>Smart feed management</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e8ede9', padding: '32px 28px' }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#1a2530', marginBottom: 6 }}>Sign in</h1>
          <p style={{ fontSize: 13, color: '#8a9aaa', marginBottom: 24 }}>Enter your credentials to access your farms</p>

          <form onSubmit={handleLogin} style={
