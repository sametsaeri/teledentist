// Hibrit auth: Supabase varsa gerçek giriş, yoksa yerel hesaplar
// Politika: hasta/ebeveyn kaydını yalnızca hekim açar.
import { load, save, getSession, setSession } from './store.js'
import { supabase, hasSupabase } from './supabase.js'

const USERS_KEY = 'td_users'

export function allUsers() {
  return load(USERS_KEY, [])
}

export async function login(email, pass, allowedRoles) {  email = String(email || '').trim()
  if (!email) return { error: 'Kullanıcı adı veya e-posta girin.' }
  if (hasSupabase) {
    // Kullanıcı adı ile giriş: adı e-postaya çevir
    if (!email.includes('@')) {
      const { data: rid, error: rerr } = await supabase.rpc('resolve_login_id', { p_identifier: email })
      if (rerr) return { error: 'Giriş başarısız: ' + rerr.message }
      if (!rid) return { error: 'Bu kullanıcı adı bulunamadı.' }
      email = rid
    }
    email = email.toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) return { error: 'Giriş başarısız: ' + error.message }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    if (!prof) { await supabase.auth.signOut(); return { error: 'Hesabınız hekim onayı bekliyor.' } }
    if (allowedRoles && !allowedRoles.includes(prof.role)) { await supabase.auth.signOut(); return { error: 'Bu giriş bu role kapalı.' } }
    setSession({ ...prof, loginAt: new Date().toISOString(), supabase: true })
    return { user: prof }
  }
  const lkey = email.toLowerCase()
  const u = allUsers().find((x) => x.email === lkey || (x.username || '').toLowerCase() === lkey)
  if (!u) return { error: 'Hesap bulunamadı, hekiminize başvurun.' }
  if (u.pass !== pass) return { error: 'Şifre hatalı.' }
  if (allowedRoles && !allowedRoles.includes(u.role)) return { error: 'Bu giriş bu role kapalı.' }
  setSession({ ...u, loginAt: new Date().toISOString() })
  return { user: u }
}

// Hasta kayıt isteği: hesap açılır, hekim onaylayınca profil tanımlanır.
//
// ÖNEMLİ: Projede "Allow new users to sign up" KAPALI olduğunda
// supabase.auth.signUp() "Signups not allowed for this instance" hatası
// verir ve talep hiçbir yere düşmez. Bu yüzden SECURITY DEFINER olan
// register_patient_request() RPC'si kullanılır; o fonksiyon signup
// kısıtlamasını aşar ve talebi doğrudan kayit_istekleri tablosuna yazar.
export async function registerRequest({ name, email, pass, role, childEmail, phone, note }) {
  email = String(email).trim().toLowerCase()
  if (!name || !name.trim()) return { error: 'Ad soyad zorunlu.' }
  if (!email || !email.includes('@')) return { error: 'Geçerli bir e-posta girin.' }
  if (!pass || pass.length < 6) return { error: 'Şifre en az 6 karakter olmalı.' }
  if (!['hasta', 'ebeveyn'].includes(role)) return { error: 'Kayıt yalnızca hasta/ebeveyn için.' }
  if (role === 'ebeveyn' && !childEmail) {
    return { error: 'Çocuğunuzun e-posta adresini girin; kayıt sonrası bağlanacak.' }
  }

  const yerel = { name: name.trim(), email, role, childEmail, phone, note }

  if (!hasSupabase) {
    // Sunucu yoksa talebi tarayıcıda sakla ki hekim panelinde görünsün
    kaydetYerelTalep(yerel)
    return { ok: true, local: true }
  }

  // 1) Öncelikli yol: SECURITY DEFINER RPC
  //    Ağ yavaş kalırsa asılı kalmasın: 8 saniyede vazgeçip yedeğe düşeriz.
  try {
    const { data, error } = await zamanAsimli(
      supabase.rpc('register_patient_request', {
        p_email: email,
        p_password: pass,
        p_name: name.trim(),
        p_role: role,
        p_child_email: childEmail || null,
        p_phone: phone || null,
        p_note: note || null
      }),
      8000
    )
    if (!error) return { ok: true, uid: data?.uid, email: data?.email }
    // RPC yoksa eski yola düş; gerçek bir hata ise göster
    if (!rpcYok(error)) {
      return { error: suMesaj(error.message) }
    }
  } catch (e) {
    const m = String(e?.message || '')
    if (/zaman aşımı|timeout/i.test(m)) { /* yedeğe düş */ }
    else if (!rpcYok({ message: m }) && !/fetch|network/i.test(m)) {
      return { error: suMesaj(m) }
    }
  }

  // 2) Yedek yol: RPC yoksa doğrudan signup + tabloya yaz
  try {
    const { data, error } = await zamanAsimli(
      supabase.auth.signUp({ email, password: pass }),
      8000
    )
    if (error) {
      // Kayıt kapalıysa da talebi kaydet; hekim hesabı açabilir
      kaydetYerelTalep(yerel)
      return {
        ok: true,
        local: true,
        uyari: 'Talebiniz alındı. Hesabınız hekiminiz onayladığında açılacaktır.'
      }
    }
    const uid = data?.user?.id
    if (!uid) return { error: 'Kayıt oluşturulamadı.' }
    const { error: e2 } = await supabase.from('kayit_istekleri')
      .insert({ user_id: uid, email, name: name.trim(), role, child_email: childEmail || null })
    if (e2) {
      kaydetYerelTalep({ ...yerel, user_id: uid })
      return { ok: true, local: true }
    }
    return { ok: true, uid }
  } catch {
    kaydetYerelTalep(yerel)
    return { ok: true, local: true }
  }
}

/* --- Yerel talep yedeği: sunucu yoksa veya hata verirse kaybolmasın --- */
const YEREL_TALEP_ANAHTARI = 'td_kayit_talepleri'

/** Ağ yavaş kalırsa istek asılı kalmasın; zaman aşımına düşer. */
function zamanAsimli(soru, ms = 8000) {
  return Promise.race([
    soru,
    new Promise((_, reddet) => setTimeout(() => reddet(new Error('zaman aşımı')), ms))
  ])
}

export function kaydetYerelTalep(talep) {
  try {
    const liste = JSON.parse(localStorage.getItem(YEREL_TALEP_ANAHTARI) || '[]')
    if (liste.some((t) => t.email === talep.email)) return
    liste.unshift({
      ...talep,
      id: yeniTalepId(),
      created_at: new Date().toISOString(),
      durum: 'bekliyor'
    })
    localStorage.setItem(YEREL_TALEP_ANAHTARI, JSON.stringify(liste))
  } catch { /* tarayıcı kaydı kapalı olabilir */ }
}

/**
 * Aynı milisaniyede eklenen iki talep Date.now() ile AYNI id alıyordu;
 * biri silinince ikisi de kayboluyordu. Bu yüzden benzersiz üretilir.
 */
function yeniTalepId() {
  return `y${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function yerelTalepleriOku() {
  try {
    return JSON.parse(localStorage.getItem(YEREL_TALEP_ANAHTARI) || '[]')
  } catch {
    return []
  }
}

export function yerelTalebiSil(id) {
  try {
    const liste = JSON.parse(localStorage.getItem(YEREL_TALEP_ANAHTARI) || '[]')
    localStorage.setItem(YEREL_TALEP_ANAHTARI, JSON.stringify(liste.filter((t) => t.id !== id)))
  } catch { /* yoksay */ }
}

/**
 * PostgREST'in "fonksiyon yok" hatasını tanı.
 *
 * DİKKAT: Gerçek mesaj şöyledir:
 *   "Could not find the function public.register_patient_request(p_email,
 *    p_password, ...) in the schema cache."
 * Bu metinde "p_password" GEÇER; düz bir /password/ araması yanlışlıkla
 * "şifre hatası" sanabilir. Bu yüzden önce yapısal işaretler aranır.
 */
export function rpcYok(hata) {
  const birlestir = [
    hata?.message, hata?.code, hata?.details, hata?.status, hata?.hint
  ].map((x) => String(x || '')).join(' ')
  return /does not exist|not found|404|PGRST|schema cache|Could not find the function|no matches were found|undefined function/i.test(birlestir)
}

/** Postgres/Auth hata mesajlarını Türkçeye çevirir */
export function suMesaj(mesaj) {
  const m = String(mesaj || '')
  // Sıralama önemli: en spesifik eşleşme önce gelmeli.
  if (/Signups not allowed/i.test(m)) return 'Sunucu kayıtları geçici olarak kapalı. Talebiniz alındı, hekiminiz onaylayınca hesabınız açılacak.'
  if (/already registered|User already exists/i.test(m)) return 'Bu e-posta zaten kayıtlı.'
  if (/Bu e-posta zaten kayitli/i.test(m)) return 'Bu e-posta zaten kayıtlı. Lütfen giriş yapın.'
  if (/zaten talep/i.test(m)) return 'Bu e-posta için zaten talep gönderilmiş. Hekiminiz inceliyor.'
  if (/yetkisiz|Yetkisiz islem/i.test(m)) return 'Yetkisiz işlem.'
  if (/row-level security|401|403|Unauthorized|new row violates row-level/i.test(m)) {
    return 'Veritabanı izni yok. Süper admin’den "npm run db:push" ile SQL kurulumunun tamamlanmasını isteyin.'
  }
  if (/gecersiz e-posta|Gecersiz e-posta|Invalid email|invalid email|email address/i.test(m)) return 'Geçerli bir e-posta adresi girin.'
  if (/Ad soyad zorunlu|name.*zorunlu/i.test(m)) return 'Ad soyad zorunlu.'
  // Şifre kuralı: yalnızca GERÇEK şifre hataları. Parametre adı (p_password)
  // yanlışlıkla eşleşmesin diye "en az N karakter" kalıbı aranır.
  if (/sifre en az|şifre en az|password should be at least|password must be at least|at least \d+ characters|minimum \d+ characters/i.test(m)) {
    return 'Şifre en az 6 karakter olmalı.'
  }
  return m || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
}

// Hekim veya süper admin panelden tek tuşla hesap açar (UID gerekmez)
// - hekim yalnızca hasta/ebeveyn açabilir
// - süper admin hekim/hasta/ebeveyn açabilir
export async function createUserByDoctor({ name, email, pass, role, childEmail, branch, username, extra }) {
  const me = getSession()
  if (!me || (me.role !== 'hekim' && me.role !== 'admin')) return { error: 'Yetkisiz işlem.' }
  email = String(email || '').trim().toLowerCase()
  if (!name || !email || !pass) return { error: 'Ad, e-posta ve şifre zorunlu.' }
  if (!['hasta', 'ebeveyn', 'hekim', 'sekreter', 'teknisyen'].includes(role)) return { error: 'Rol seçin.' }
  if (role === 'hekim' && me.role !== 'admin') return { error: 'Hekim hesabını yalnızca süper admin açabilir.' }
  if (pass.length < 6) return { error: 'Şifre en az 6 karakter olmalı.' }
  if (hasSupabase) {
    // Yöntem 1 (tercih edilen): veritabanı fonksiyonu — signup kapalıyken de çalışır
    const { data: res, error: rerr } = await supabase.rpc('create_account', {
      p_email: email,
      p_password: pass,
      p_name: name,
      p_role: role,
      p_branch: role === 'hekim' ? (branch || 'genel') : 'genel',
      p_username: username || '',
      p_extra: extra || {}
    })
    if (!rerr && res && res.ok) {
      if (role === 'ebeveyn' && childEmail) {
        const { data: child } = await supabase.from('profiles').select('id').eq('email', String(childEmail).toLowerCase()).single()
        if (child) await supabase.from('parent_child').upsert({ parent_id: res.uid, child_id: child.id }, { onConflict: 'parent_id,child_id' })
      }
      return { ok: true, uid: res.uid }
    }
    // Yöntem 2: yedek — doğrudan signup (func kurulmamışsa)
    const { data: s } = await supabase.auth.getSession()
    const prev = s?.session
    const { data, error } = await supabase.auth.signUp({ email, password: pass })
    if (error) {
      if (prev) await supabase.auth.setSession({ access_token: prev.access_token, refresh_token: prev.refresh_token })
      return { error: /already registered/i.test(error.message)
        ? 'Bu e-posta zaten kayıtlı.'
        : /signups not allowed/i.test(error.message)
          ? 'Sunucu kayıtları kapalı. db/migration_users.sql dosyasını çalıştırın.'
          : error.message }
    }
    const uid = data.user?.id
    if (prev) await supabase.auth.setSession({ access_token: prev.access_token, refresh_token: prev.refresh_token })
    if (!uid) return { error: 'Kullanıcı oluşturulamadı.' }
    const row = {
      id: uid, role, email, name,
      created_by: me.id,
      branch: role === 'hekim' ? (branch || 'genel') : 'genel',
      username: username || '',
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
    username: username || '',
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

// Süper admin: bir kullanıcıya yeni şifre atar (kullanıcının açık oturumları kapanır)
export async function setPasswordByAdmin(uid, pass) {
  const me = getSession()
  if (!me || me.role !== 'admin') return { error: 'Yalnızca süper admin.' }
  pass = String(pass || '')
  if (pass.length < 6) return { error: 'Şifre en az 6 karakter olmalı.' }
  if (!hasSupabase) {
    save(USERS_KEY, allUsers().map((u) => u.id === uid ? { ...u, pass } : u))
    return { ok: true }
  }
  const { data, error } = await supabase.rpc('admin_set_password', {
    p_user_id: uid,
    p_new_password: pass
  })
  if (error) {
    if (/does not exist|not found|schema cache/i.test(error.message || '')) {
      return { error: 'Sunucu fonksiyonu kurulu değil. db/migration_admin_manage.sql dosyasını çalıştırın.' }
    }
    return { error: error.message }
  }
  if (!data || data.ok !== true) return { error: 'Şifre atanamadı.' }
  return { ok: true }
}

// Süper admin: kullanıcının TÜM verisini günceller (ad, e-posta, kimlik, iletişim, klinik...)
export async function updateProfileByAdmin(uid, patch) {
  const me = getSession()
  if (!me || me.role !== 'admin') return { error: 'Yalnızca süper admin.' }
  if (!hasSupabase) {
    save(USERS_KEY, allUsers().map((u) => u.id === uid ? { ...u, ...patch } : u))
    return { ok: true }
  }
  const { data, error } = await supabase.rpc('admin_update_profile', {
    p_user_id: uid,
    p_patch: patch || {}
  })
  if (!error && data && data.ok === true) return { ok: true }
  // Sunucu fonksiyonu yoksa doğrudan güncellemeyi dene (e-posta senkronu olmadan)
  const { error: e2 } = await supabase.from('profiles').update(patch).eq('id', uid)
  if (!e2) return { ok: true, fallback: true }
  return {
    error: error
      ? (e2.message || error.message)
      : (e2.message || 'Güncellenemedi.')
  }
}

export async function logout() {
  if (hasSupabase) await supabase.auth.signOut()
  localStorage.removeItem('td_session')
}

export function currentUser() { return getSession() }
