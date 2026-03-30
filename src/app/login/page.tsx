import Link from 'next/link'

export default function LoginPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{ width: '42%', background: '#1a2530', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 44px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -80, top: -80, width: 320, height: 320, borderRadius: '50%', border: '0.5px solid rgba(76,175,125,0.1)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 30, top: 30, width: 180, height: 180, borderRadius: '50%', border: '0.5px solid rgba(74,144,196,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 28, fontWeight: 500, color: '#fff', letterSpacing: -0.8, marginBottom: 14 }}>Feed<span style={{ color: '#4CAF7D' }}>Flow</span></div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.65, maxWidth: 220 }}>Monitor. Optimize. Control.<br />Smart feed management for Australian farming.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', zIndex: 2 }}>
          {[
            { title: 'Real-time silo levels', sub: '15 sensors · reading every 2 hours' },
            { title: 'AI consumption forecast', sub: 'Days remaining · automated alerts' },
            { title: 'Cost per animal', sub: 'Live feed cost tracking per head' },
            { title: 'Instant Telegram alerts', sub: 'Smart notifications 24/7' },
          ].map(f => (
            <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF7D', marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.88)', marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', position: 'relative', zIndex: 2 }}>© 2025 FeedFlow · feedflow.cloud · Bendigo VIC</div>
      </div>

      <div style={{ flex: 1, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 44px' }}>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, color: '#1a2530', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: '#8a9aaa', marginBottom: 30 }}>Sign in to your FeedFlow account</p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Email address</label>
            <input type="email" placeholder="you@farm.com.au" style={{ height: 42, borderRadius: 8, border: '0.5px solid #dde8e0', background: '#f7f9f8', padding: '0 13px', fontSize: 14, color: '#1a2530', width: '100%' }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#8a9aaa', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Password</label>
            <input type="password" placeholder="••••••••" style={{ height: 42, borderRadius: 8, border: '0.5px solid #dde8e0', background: '#f7f9f8', padding: '0 13px', fontSize: 14, color: '#1a2530', width: '100%' }} />
          </div>
          <div style={{ textAlign: 'right', marginBottom: 22 }}>
            <a href="#" style={{ fontSize: 12, color: '#4A90C4' }}>Forgot password?</a>
          </div>

          <Link href="/dashboard" style={{ display: 'block', width: '100%', height: 44, borderRadius: 8, background: '#2D3E50', color: '#fff', fontSize: 14, fontWeight: 500, textAlign: 'center', lineHeight: '44px', textDecoration: 'none', marginBottom: 16 }}>Sign in</Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
            <hr style={{ flex: 1, border: 'none', borderTop: '0.5px solid #e8ede9' }} />
            <span style={{ fontSize: 12, color: '#aab8c0' }}>or</span>
            <hr style={{ flex: 1, border: 'none', borderTop: '0.5px solid #e8ede9' }} />
          </div>

          <Link href="/home#contact" style={{ display: 'block', width: '100%', height: 42, borderRadius: 8, background: 'transparent', border: '0.5px solid #dde8e0', color: '#6a7a8a', fontSize: 13, textAlign: 'center', lineHeight: '42px', textDecoration: 'none' }}>Request a demo</Link>

          <p style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#aab8c0' }}>
            No account? <Link href="/home#contact" style={{ color: '#4A90C4' }}>Contact FeedFlow</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
