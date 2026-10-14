// Hibrit auth: Supabase varsa gerçek giriş, yoksa localStorage demo
// Politika: hasta/ebeveyn kaydını yalnızca hekim açar.
import { load, save, keys, getSession, setSession } from './store.js'
import { supabase, hasSupabase } from './supabase.js'
import { demoUsers } from '../data/mock.js'

const USERS_KEY = 'td_users'
const SEED = [
  { id: 'h1', role: 'hasta', email: 'hasta@demo', pass: 'hasta123', name: 'Demo Hasta', children: [] },
  { id: 'h2', role: 'hasta', email: 'ayse@demo', pass: 'hasta123', name: 'Ayşe Demo', children: [] },
  { id: 'e1', role: 'ebeveyn', email: 'ebeveyn@demo', pass: 'ebeveyn123', name: 'Demo Ebeveyn', children: ['h1'] },
  { id: 'd1', role: 'hekim', email: 'hekim@demo', pass: 'hekim123', name: 'Dt. Demo Hekim', children: [] }
]

export function allUsers() {
  let u = load(USERS_KEY, null)
  if (!u) {
    u = SEED.map((s) => ({ ...s, ...(demoUsers.find((d) => d.id === s.id) || {}) }))
    save(USERS_KEY, u)
  }
  return u
}

export async function login(email, pass) {
  email = String(email).trim().toLowerCase()
  if (hasSupabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) return { error: 'Giriş başarısız: ' + error.message }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    if (!prof) return { error: 'Profil bulunamadı, hekiminize başvurun.' }
    setSession({ ...prof, loginAt: new Date().toISOString(), supabase: true })
    return { user: prof }
  }
  const u = allUsers().find((x) => x.email === email)
  if (!u) return { error: 'Hesap bulunamadı.' }
  if (u.pass !== pass) return { error: 'Şifre hatalı.' }
  setSession({ ...u, loginAt: new Date().toISOString() })
  return { user: u }
}

// Yalnızca hekim hasta/ebeveyn açar (Supabase'te de RLS bunu zorunlu kılar)
export async function createUserByDoctor({ name, email, pass, role, childId }) {
  const me = getSession()
  if (!me || me.role !== 'hekim') return { error: 'Yetkisiz işlem.' }
  email = String(email).trim().toLowerCase()
  if (!name || !email || !pass) return { error: 'Ad, e-posta ve şifre zorunlu.' }
  if (!['hasta', 'ebeveyn'].includes(role)) return { error: 'Hekim yalnızca hasta/ebeveyn açabilir.' }
  if (hasSupabase) {
    // Not: service_role gerekir; MVP'de hekim panelinden davet linki üretilir.
    return { error: 'Supabase modunda kullanıcı hekim tarafından Auth panelinden açılmalı (RLS: hekim_insert).' }
  }
  const users = allUsers()
  if (users.some((x) => x.email === email)) return { error: 'Bu e-posta kayıtlı.' }
  const nu = { id: 'u' + Date.now(), role, email, pass, name, children: role === 'ebeveyn' && childId ? [childId] : [], created_by: me.id, lastVisit: new Date().toISOString().slice(0, 10), treatmentType: 'kontrol', plaqueIndex: 1, anxietyScore: 3 }
  users.push(nu)
  save(USERS_KEY, users)
  return { user: nu }
}

export async function logout() {
  if (hasSupabase) await supabase.auth.signOut()
  localStorage.removeItem(keys.session)
}

export function currentUser() { return getSession() }
