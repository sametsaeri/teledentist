// Hibrit auth: Supabase varsa gerçek giriş, yoksa yerel hesaplar
// Politika: hasta/ebeveyn kaydını yalnızca hekim açar.
import { load, save, getSession, setSession } from './store.js'
import { supabase, hasSupabase } from './supabase.js'

const USERS_KEY = 'td_users'

export function allUsers() {
  return load(USERS_KEY, [])
}

export async function login(email, pass, allowedRoles) {
  email = String(email).trim().toLowerCase()
  if (hasSupabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) return { error: 'Giriş başarısız: ' + error.message }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    if (!prof) { await supabase.auth.signOut(); return { error: 'Hesabınız hekim onayı bekliyor.' } }
    if (allowedRoles && !allowedRoles.includes(prof.role)) { await supabase.auth.signOut(); return { error: 'Bu giriş bu role kapalı.' } }
    setSession({ ...prof, loginAt: new Date().toISOString(), supabase: true })
    return { user: prof }
  }
  const u = allUsers().find((x) => x.email === email)
  if (!u) return { error: 'Hesap bulunamadı, hekiminize başvurun.' }
  if (u.pass !== pass) return { error: 'Şifre hatalı.' }
  if (allowedRoles && !allowedRoles.includes(u.role)) return { error: 'Bu giriş bu role kapalı.' }
  setSession({ ...u, loginAt: new Date().toISOString() })
  return { user: u }
}

// Hasta kayıt isteği: hesap açılır, hekim onaylayınca profil tanımlanır
export async function registerRequest({ name, email, pass, role, childEmail }) {
  email = String(email).trim().toLowerCase()
  if (!name || !email || !pass) return { error: 'Ad, e-posta ve şifre zorunlu.' }
  if (!['hasta', 'ebeveyn'].includes(role)) return { error: 'Kayıt yalnızca hasta/ebeveyn için.' }
  if (!hasSupabase) return { error: 'Kayıt şu an kapalı, hekiminize başvurun.' }
  const { data, error } = await supabase.auth.signUp({ email, password: pass })
  if (error) return { error: error.message }
  const uid = data.user?.id
  if (!uid) return { error: 'Kayıt oluşturulamadı.' }
  const { error: e2 } = await supabase.from('kayit_istekleri').insert({ user_id: uid, email, name, role, child_email: childEmail || null })
  if (e2) return { error: e2.message }
  return { ok: true }
}

// Hekim veya süper admin panelden tek tuşla hesap açar (UID gerekmez)
// - hekim yalnızca hasta/ebeveyn açabilir
// - süper admin hekim/hasta/ebeveyn açabilir
export async function createUserByDoctor({ name, email, pass, role, childEmail, branch, extra }) {
  const me = getSession()
  if (!me || (me.role !== 'hekim' && me.role !== 'admin')) return { error: 'Yetkisiz işlem.' }
  email = String(email || '').trim().toLowerCase()
  if (!name || !email || !pass) return { error: 'Ad, e-posta ve şifre zorunlu.' }
  if (!['hasta', 'ebeveyn', 'hekim'].includes(role)) return { error: 'Rol seçin.' }
  if (role === 'hekim' && me.role !== 'admin') return { error: 'Hekim hesabını yalnızca süper admin açabilir.' }
  if (pass.length < 6) return { error: 'Şifre en az 6 karakter olmalı.' }
  if (hasSupabase) {
    // Auth kullanıcısını aç; hekimin oturumu bozulmasın diye sakla ve geri yükle
    const { data: s } = await supabase.auth.getSession()
    const prev = s?.session
    const { data, error } = await supabase.auth.signUp({ email, password: pass })
    if (error) {
      if (prev) await supabase.auth.setSession({ access_token: prev.access_token, refresh_token: prev.refresh_token })
      return { error: /already registered/i.test(error.message) ? 'Bu e-posta zaten kayıtlı.' : error.message }
    }
    const uid = data.user?.id
    if (prev) await supabase.auth.setSession({ access_token: prev.access_token, refresh_token: prev.refresh_token })
    if (!uid) return { error: 'Kullanıcı oluşturulamadı.' }
    const row = {
      id: uid, role, email, name,
      created_by: me.id,
      branch: role === 'hekim' ? (branch || 'genel') : 'genel',
      reminder_days: 5,
      last_visit: new Date().toISOString().slice(0, 10),
      ...(extra || {})
    }
    const { error: e2 } = await supabase.from('profiles').upsert(row)
    if (e2) return { error: e2.message }
    if (role === 'ebeveyn' && childEmail) {
      const { data: child } = await supabase.from('profiles').select('id').eq('email', String(childEmail).toLowerCase()).single()
      if (child) await supabase.from('parent_child').upsert({ parent_id: uid, child_id: child.id }, { onConflict: 'parent_id,child_id' })
    }
    return { ok: true, uid }
  }
  const users = allUsers()
  if (users.some((x) => x.email === email)) return { error: 'Bu e-posta kayıtlı.' }
  const nu = {
    id: 'u' + Date.now(), role, email, pass, name,
    branch: role === 'hekim' ? (branch || 'genel') : 'genel',
    children: role === 'ebeveyn' && childEmail ? [childEmail] : [],
    created_by: me.id,
    lastVisit: new Date().toISOString().slice(0, 10),
    treatmentType: 'kontrol', plaqueIndex: 1, anxietyScore: 3, reminderDays: 5,
    ...(extra || {})
  }
  users.push(nu)
  save(USERS_KEY, users)
  return { ok: true, user: nu }
}

// Süper admin: kullanıcı rolünü/değerlerini günceller
export async function updateUserByAdmin(uid, patch) {
  const me = getSession()
  if (!me || me.role !== 'admin') return { error: 'Yalnızca süper admin.' }
  if (hasSupabase) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', uid)
    return { error: error?.message }
  }
  save(USERS_KEY, allUsers().map((u) => u.id === uid ? { ...u, ...patch } : u))
  return { ok: true }
}

export async function logout() {
  if (hasSupabase) await supabase.auth.signOut()
  localStorage.removeItem('td_session')
}

export function currentUser() { return getSession() }
