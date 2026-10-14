// Hibrit auth: Supabase varsa gerçek giriş, yoksa yerel hesaplar
// Politika: hasta/ebeveyn kaydını yalnızca hekim açar.
import { load, save, getSession, setSession } from './store.js'
import { supabase, hasSupabase } from './supabase.js'

const USERS_KEY = 'td_users'

export function allUsers() {
  return load(USERS_KEY, [])
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
  if (!u) return { error: 'Hesap bulunamadı, hekiminize başvurun.' }
  if (u.pass !== pass) return { error: 'Şifre hatalı.' }
  setSession({ ...u, loginAt: new Date().toISOString() })
  return { user: u }
}

// Yalnızca hekim hasta/ebeveyn açar
export async function createUserByDoctor({ name, email, pass, role, childId }) {
  const me = getSession()
  if (!me || me.role !== 'hekim') return { error: 'Yetkisiz işlem.' }
  email = String(email).trim().toLowerCase()
  if (!name || !email || !pass) return { error: 'Ad, e-posta ve şifre zorunlu.' }
  if (!['hasta', 'ebeveyn'].includes(role)) return { error: 'Hekim yalnızca hasta/ebeveyn açabilir.' }
  if (hasSupabase) {
    return { error: 'Kullanıcıyı önce Authentication ekranından açın, sonra panelden profili tamamlayın.' }
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
  localStorage.removeItem('td_session')
}

export function currentUser() { return getSession() }
