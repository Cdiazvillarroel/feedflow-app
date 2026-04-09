'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Client { id: string; name: string }
interface AppUser {
  id: string; email: string; created_at: string
  role: string | null; client_id: string | null; client_name: string | null
  last_sign_in: string | null
}

function iStyle(full = false): React.CSSProperties {
  return { width: full ? '100%' : 'auto', padding: '8px 10px', border: '0.5px solid #c8d8cc', borderRadius: 7, fontSize: 13, color: '#1a2530', background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
}
function lStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a8a', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 } as React.CSSProperties
}

export default function AdminUsersPage() {
  const [users,    setUsers]    = useState<AppUser[]>([])
  const [clients,  setClients]  = useState<Client[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const [drawer,   setDrawer]   = useState<AppUser | 'new' | null>(null)

  const emptyForm = { email: '', password: '', role: 'client', client_id: '' }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [rolesR, clientsR, clientUsersR] = await Promise.all([
      supabase.from('roles').select('user_id, role'),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('client_users').select('user_id, client_id, clients(name)'),
    ])

    setClients(clientsR.data || [])

    // Get users from auth via a workaround — list from roles + client_users
    const roleMap: Record<string, string> = {}
    ;(rolesR.data || []).forEach(r => { roleMap[r.user_id] = r.role })

    const clientMap: Record<string, { id: string; name: string }> = {}
    ;(clientUsersR.data || []).forEach((r: any) => {
      clientMap[r.user_id] = { id: r.client_id, name: r.clients?.name || '' }
    })

    // Fetch user emails from profiles or auth — use a combined approach
    const { data: profileData } = await supabase
      .from('roles')
      .select('user_id, role')

    // Build user list from known user IDs
    const allUserIds = [...new Set([
      ...(rolesR.data || []).map(r => r.user_id),
      ...(clientUsersR.data || []).map((r: any) => r.user_id),
    ])]

    // Use client_users joined with auth info via a custom approach
    const { data: authUsersData, error: rpcError } = await supabase.rpc('get_users_info')

    if (authUsersData) {
      const mapped: AppUser[] = (authUsersData || []).map((u: any) => ({
        id:           u.id,
        email:        u.email,
        created_at:   u.created_at,
        last_sign_in: u.last_sign_in_at,
        role:         roleMap[u.id] || 'client',
        client_id:    clientMap[u.id]?.id || null,
        client_name:  clientMap[u.id]?.name || null,
      }))
      setUsers(mapped)
    } else {
      // Fallback: show known users from roles table with limited info
      const fallback: AppUser[] = allUserIds.map(uid => ({
        id:           uid,
        email:        uid === 'a0000000-0000-0000-0000-000000000000' ? 'admin@feedflow.com' : `user-${uid.slice(0,6)}`,
        created_at:   new Date().toISOString(),
        last_sign_in: null,
        role:         roleMap[uid] || 'client',
        client_id:    clientMap[uid]?.id || null,
        client_name:  clientMap[uid]?.name || null,
      }))
      setUsers(fallback)
    }

    setLoading(false)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function openNew() { setForm(emptyForm); setDrawer('new') }
  function openEdit(u: AppUser) {
    setForm({ email: u.email, password: '', role: u.role || 'client', client_id: u.client_id || '' })
    setDrawer(u)
  }

  async function createUser() {
    if (!form.email.trim() || !form.password.trim()) return
    setSaving(true)
    // Call service role API to create user
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', email: form.email, password: form.password, role: form.role, client_id: form.client_id }),
    })
    const data = await res.json()
    if (data.error) { showMsg('Error: ' + data.error) }
    else { showMsg('User created'); setDrawer(null); loadAll() }
    setSaving(false)
  }

  async function updateUserRole(userId: string) {
    setSaving(true)
    await supabase.from('roles').upsert({ user_id: userId, role: form.role })
    if (form.client_id) {
      await supabase.from('client_users').upsert({ user_id: userId, client_id: form.client_id, role: 'owner' })
    }
    showMsg('User updated'); setDrawer(null); loadAll()
    setSaving(false)
  }

  async function deleteUser(userId: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', user_id: userId }),
    })
    const data = await res.json()
    if (data.ok) { showMsg('User deleted'); setDrawer(null); loadAll() }
    else showMsg('Error: ' + data.error)
  }

  const isEditing = drawer && drawer !== 'new'
  const filtered  = users
    .filter(u => filter === 'all' || u.role === filter)
    .filter(u => !search || u.email.toLowerCase().includes(search.toLowerCase()))

  const roleBadge = (role: string) =>
    role === 'admin'  ? { bg: '#FCEBEB', color: '#A32D2D' } :
    role === 'client' ? { bg: '#eaf5ee', color: '#27500A' } :
                        { bg: '#f0f4f0', color: '#6a7a8a'  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#8a9aaa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e8ede9', borderTopColor: '#4CAF7D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        Loading users...<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <>
      {drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 460, height: '100vh', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e8ede9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff' }}>
                {isEditing ? (drawer as AppUser).email.charAt(0).toUpperCase() : '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>{isEditing ? 'Edit user' : 'New user'}</div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 2 }}>{isEditing ? (drawer as AppUser).email : 'Create FeedFlow account'}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e8ede9', background: '#f7f9f8', cursor: 'pointer', fontSize: 16, color: '#8a9aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!isEditing && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9' }}>Account</div>
                  <div><label style={lStyle()}>Email *</label><input type="email" style={iStyle(true)} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="user@farm.com.au" /></div>
                  <div><label style={lStyle()}>Password *</label><input type="password" style={iStyle(true)} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" /></div>
                </>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '0.5px solid #e8ede9', marginTop: isEditing ? 0 : 4 }}>Role & access</div>
              <div>
                <label style={lStyle()}>Role</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['admin', 'client', 'viewer'].map(r => (
                    <button key={r} onClick={() => setForm(p => ({ ...p, role: r }))}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid ' + (form.role === r ? '#4CAF7D88' : '#e8ede9'), background: form.role === r ? '#eaf5ee' : '#fff', color: form.role === r ? '#27500A' : '#8a9aaa' }}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#aab8c0', marginTop: 6 }}>
                  {form.role === 'admin' ? '⚠ Full admin access to all data' : form.role === 'client' ? 'Access to assigned client farms only' : 'Read-only access'}
                </div>
              </div>
              <div>
                <label style={lStyle()}>Assign to client</label>
                <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))} style={{ ...iStyle(true), background: '#fff' }}>
                  <option value="">No client (admin only)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {isEditing && (
                <div style={{ background: '#f7f9f8', borderRadius: 10, padding: '14px 16px', marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2530', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Account info</div>
                  {[
                    { k: 'User ID',    v: (drawer as AppUser).id.slice(0, 8) + '...' },
                    { k: 'Created',    v: new Date((drawer as AppUser).created_at).toLocaleDateString('en-AU') },
                    { k: 'Last login', v: (drawer as AppUser).last_sign_in ? new Date((drawer as AppUser).last_sign_in!).toLocaleDateString('en-AU') : 'Never' },
                    { k: 'Client',     v: (drawer as AppUser).client_name || '—' },
                  ].map(r => (
                    <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #e8ede9' }}>
                      <span style={{ fontSize: 12, color: '#8a9aaa' }}>{r.k}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2530' }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '0.5px solid #e8ede9', display: 'flex', gap: 10 }}>
              <button
                onClick={() => isEditing ? updateUserRole((drawer as AppUser).id) : createUser()}
                disabled={saving || (!isEditing && (!form.email.trim() || !form.password.trim()))}
                style={{ flex: 1, padding: '10px', background: saving ? '#aab8c0' : '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving...' : isEditing ? 'Update user' : 'Create user'}
              </button>
              {isEditing && (
                <button onClick={() => deleteUser((drawer as AppUser).id)}
                  style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Delete
                </button>
              )}
              <button onClick={() => setDrawer(null)}
                style={{ padding: '10px 14px', background: '#fff', border: '0.5px solid #e8ede9', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6a7a8a', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2530', letterSpacing: -0.5 }}>Users</div>
          <div style={{ fontSize: 13, color: '#8a9aaa', marginTop: 4 }}>{users.length} total · {users.filter(u => u.role === 'admin').length} admins · {users.filter(u => u.role === 'client').length} clients</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {msg && <div style={{ padding: '7px 14px', background: msg.includes('Error') ? '#FCEBEB' : '#eaf5ee', border: '0.5px solid ' + (msg.includes('Error') ? '#F09595' : '#4CAF7D'), borderRadius: 8, fontSize: 12, fontWeight: 600, color: msg.includes('Error') ? '#A32D2D' : '#27500A' }}>{msg}</div>}
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#4CAF7D', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ New user</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total users', val: users.length,                                  color: '#1a2530' },
          { label: 'Admins',      val: users.filter(u => u.role === 'admin').length,   color: '#A32D2D' },
          { label: 'Clients',     val: users.filter(u => u.role === 'client').length,  color: '#27500A' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', border: '0.5px solid #e8ede9' }}>
            <div style={{ fontSize: 11, color: '#aab8c0', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #c8d8cc', borderRadius: 8, padding: '0 12px', flex: 1, maxWidth: 280 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aab8c0" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1a2530', background: 'transparent', width: '100%', padding: '9px 0' }} />
        </div>
        {['all', 'admin', 'client', 'viewer'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '0.5px solid', fontFamily: 'inherit', borderColor: filter === f ? '#1a2530' : '#e8ede9', background: filter === f ? '#1a2530' : '#fff', color: filter === f ? '#fff' : '#6a7a8a' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8ede9', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f9f8' }}>
              {['User', 'Role', 'Client', 'Last login', 'Created', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#aab8c0', fontWeight: 600, padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '0.5px solid #e8ede9' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#aab8c0', fontSize: 13 }}>No users found</td></tr>
            ) : filtered.map(u => {
              const badge = roleBadge(u.role || 'client')
              return (
                <tr key={u.id} onClick={() => openEdit(u)} style={{ cursor: 'pointer', borderBottom: '0.5px solid #f0f4f0' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f7f9f8'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {u.email.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2530' }}>{u.email}</div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10, background: badge.bg, color: badge.color }}>
                      {(u.role || 'client').charAt(0).toUpperCase() + (u.role || 'client').slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: '#8a9aaa' }}>{u.client_name || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: '#8a9aaa' }}>{u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString('en-AU') : 'Never'}</td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: '#8a9aaa' }}>{new Date(u.created_at).toLocaleDateString('en-AU')}</td>
                  <td style={{ padding: '14px 16px' }}><span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 600 }}>Edit →</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
