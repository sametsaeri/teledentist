// Hibrit auth: Supabase varsa gerçek giriş, yoksa yerel hesaplar
// Politika: hasta/ebeveyn kaydını yalnızca hekim açar.
import { load, save, getSession, setSession } from './store.js'
import { supabase, hasSupabase } from './supabase.js'
import { rizaKaydi } from '../components/KvkkOnay.jsx'
import { bildirimOlustur } from './bildirim.js'

const USERS_KEY = 'td_users'

export function allUsers() {
  return load(USERS_KEY, [])
}

/**
 * Giriş kimliğini ("kullanıcı adı") e-posta adresine çevirir.
 *
 * ÖNEMLİ — iki kaynak denenir, ikisi de tutmazsa hata VERİLMEZ:
 *   1) resolve_login_id RPC'si (kuruluysa en doğrusu)
 *   2) profiles tablosunda doğrudan arama (RPC hiç yoksa)
 *
 * Neden 2. adım şart: profilde `username` kolonu boşsa RPC boş döner ve
 * kullanıcı "Bu kullanıcı adı bulunamadı" hatası görür — hesap ise vardır.
 * Arama `username` ve `email` üzerinden yapılır; eşleşen satırın e-postası
 * döndürülür. RLS bu okumayı engellerse yine de temiz bir hata mesajı verilir.
 */
export async function kimligeCevir(kimlik) {
  const k = String(kimlik || '').trim()
  if (!k) return null
  if (k.includes('@')) return k.toLowerCase()
  if (!hasSupabase) return null

  // 1) RPC
  try {
    const { data: rid, error: rerr } = await supabase.rpc('resolve_login_id', { p_identifier: k })
    if (!rerr && rid) return String(rid).toLowerCase()
  } catch { /* RPC yok/erişilemiyor — aşağıdaki aramaya düş */ }

  // 2) profiles tablosunda arama
  try {
    const q = supabase.from('profiles').select('email, username, name').limit(1)
    if (typeof q.or === 'function') {
      const { data, error } = await q.or(`username.eq.${k},email.eq.${k},name.eq.${k}`)
      if (!error && data && data.length && data[0]?.email) return String(data[0].email).toLowerCase()
    } else {
      const { data, error } = await q.eq('username', k)
      if (!error && data && data.length && data[0]?.email) return String(data[0].email).toLowerCase()
    }
  } catch { /* RLS engelledi — aşağıda anlaşılır hata döner */ }

  return null
}

export async function login(email, pass, allowedRoles) {
  email = String(email || '').trim()
  if (!email) return { error: 'Kullanıcı adı veya e-posta girin.' }
  if (!pass) return { error: 'Şifrenizi girin.' }
  if (hasSupabase) {
    // Kullanıcı adı ile giriş: kimliği e-postaya çevir
    if (!email.includes('@')) {
      const rid = await kimligeCevir(email)
      if (!rid) {
        return {
          // Bu mesaj bilerek EYLEM GÖSTERİR. Kullanıcı hesabı var olsa bile
          // (profilde username kolonu boşsa veya sunucu fonksiyonu kurulmamışsa)
          // çözümleme yapılamaz; en hızlı çözüm e-posta ile giriş denemektir.
          error: 'Bu kullanıcı adıyla giriş yapılamadı. Hesabınız varsa E-POSTA adresinizle ' +
            'girmeyi deneyin (örn. ad.soyad@ornek.com). Yine olmuyorsa hekiminizden ' +
            'hesabınızı kontrol etmesini isteyin.'
        }
      }
      email = rid
    }
    email = email.toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) {
      await supabase.auth.signOut()
      return { error: girisHatasi(error?.message) }
    }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
    if (!prof) {
      await supabase.auth.signOut()
      return {
        error: 'Şifreniz doğru ancak profil kaydınız henüz oluşmamış. Hekiminizden ' +
          'hesabınızı tamamlamasını isteyin.'
      }
    }
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

// Hasta kayıt isteği: hesabı sunucuda açılır, hekim onaylayınca profil oluşur.
//
// ÖNEMLİ — talep ASLA tarayıcıya kaydedilmez. Kayıt yalnızca sunucuda
// durmalıdır; aksi hâlde hekim başka bir cihazdan talebi göremez ve
// hasta hesabı hiçbir bilgisayardan açamaz.
//
// Sunucuya yazmanın iki yolu vardır:
//   1) register_patient_request() RPC  (SQL kuruluysa; signup kapalıyken bile çalışır)
//   2) auth.signUp() + kayit_istekleri tablosuna INSERT
//      (Supabase'de "Allow new users to sign up" anahtarı AÇIKSA çalışır)
/**
 * E-postadan kısa, tahmin edilebilir bir kullanıcı adı türetir.
 *
 * NEDEN VAR: hastalar kullanıcı adıyla giriş yapmak ister ama kayıt
 * formunda kullanıcı adı alanı yoktur. Profil `username` kolonu boş
 * kalırsa sunucudaki çözümleme fonksiyonu boş döner ve kullanıcı
 * "Bu kullanıcı adı bulunamadı" hatası görür — hesabı varken bile.
 * Bu yüzden varsayılan ad e-postanın @ öncesi kısmından türetilir.
 */
export function kullaniciAdiTuret(email, ad = '') {
  const temizle = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9._-]/g, '')
  // E-posta varsa @ öncesi kısım kullanılır (en tahmin edilebilir olan)
  const epostaAdi = temizle(String(email || '').split('@')[0])
  if (epostaAdi) return epostaAdi
  // Yoksa addan İLK kelime: boşlukları temizlemeden ÖNCE ayır,
  // yoksa "Zeynep Demir" -> "zeynepdemir" olur ve yanlış olur.
  const ilkKelime = String(ad || '').trim().split(/\s+/)[0] || ''
  return temizle(ilkKelime) || 'hasta'
}

/**
 * Kayıt talebi — KVKK onayı olmadan TALEP OLUŞTURULAMAZ.
 *
 * YASAL DAYANAK: 6698 md. 5/1 aydınlatma yükümlülüğü ve md. 3/6 açık rıza.
 * Sağlık verisi özel nitelikli veridir; onay kaydı talep satırına yazılır.
 * Bu kontrol SUNUCUDA tekrar yapılır; tarayıcı doğrulaması tek başına yeterli
 * değildir (isteğe bağlı: RPC içinde de karşılaştırılabilir).
 *
 * @param {boolean} kvkkOnay  kullanıcının metni okuduğuna dair beyanı
 */
export async function registerRequest({ name, email, pass, role, childEmail, phone, note, kvkkOnay }) {
  email = String(email).trim().toLowerCase()
  // Supabase Türkçe karakterleri kabul etmez (örn: "ö" → "o")
  email = email.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!name || !name.trim()) return { error: 'Ad soyad zorunlu.' }
  if (!email || !email.includes('@') || !email.includes('.', email.indexOf('@'))) return { error: 'Geçerli bir e-posta girin.' }
  if (!pass || pass.length < 6) return { error: 'Şifre en az 6 karakter olmalı.' }
  if (!['hasta', 'ebeveyn'].includes(role)) return { error: 'Kayıt yalnızca hasta/ebeveyn için.' }
  if (role === 'ebeveyn' && !childEmail) {
    return { error: 'Çocuğunuzun e-posta adresini girin; kayıt sonrası bağlanacak.' }
  }
  // KVKK: onay yoksa talep yazılmaz. Bu satır olmadan "rıza" beyanı eksiktir.
  if (kvkkOnay !== true) {
    return { error: 'KVKK aydınlatma metnini okuduğunuzu onaylamadan kayıt talebi gönderemezsiniz.' }
  }

  const username = kullaniciAdiTuret(email, name)
  // Rıza kanıtı: kim, ne zaman, hangi metin sürümü
  const riza = rizaKaydi({ ad: name.trim() })

  if (!hasSupabase) {
    return { error: 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.' }
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
        p_note: note || null,
        p_username: username,
        p_kvkk_onay: true,
        p_kvkk_surum: riza.kvkk_surum,
        p_kvkk_zaman: riza.kvkk_zaman,
        p_kvkk_ip_notu: 'kayıt anındaki oturim'
      }),
      8000
    )
    if (!error) {
      // RPC hata fırlatmadan ok:false dönebilir (ör. "zaten talep var") — gerçek sonucu oku
      if (data && data.ok === false) return { error: suMesaj(data?.error) }
      // Hekimlere bildir: yeni kayıt talebi geçti
      bildirimOlustur({
        tur: 'kayit_talebi',
        title: `${name.trim()} kayıt talebi gönderdi`,
        body: `${email} · ${role === 'ebeveyn' ? 'Ebeveyn' : 'Hasta'}${phone ? ` · ${phone}` : ''}`,
        link: '/hekim?tab=istek'
      })
      return { ok: true, uid: data?.uid, email: data?.email, username }
    }
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

  // 2) Yedek yol: auth.signUp KALDIRILDI.
  //    Supabase "email rate limit exceeded" hatası veriyordu.
  //    RPC (register_patient_request) rate limit'e takılmaz ve signup kapalıyken de çalışır.
  //    RPC başarısız olursa hata gösterilir.
  return { error: 'Kayıt talebi gönderilemedi. Lütfen daha sonra tekrar deneyin veya klinik yönetimiyle iletişime geçin.' }
}

/**
 * "Signups not allowed" hatası: kullanıcıya ne yapması gerektiğini SÖYLER.
 * Bu hata sunucu tarafı bir ayardır; kod ile aşılamaz.
 */
export function signupKapatliMesaji(mesaj) {
  if (/Signups not allowed/i.test(String(mesaj || ''))) {
    return 'Klinik kayıt sistemi şu anda kapalı. Hekiminiz veya klinik yöneticinizle ' +
      'iletişime geçin; kayıt talebiniz açıldığında tekrar deneyebilirsiniz.'
  }
  return suMesaj(mesaj)
}

/**
 * Tarayıcıda kalmış eski kayıt taleplerini temizler.
 * Artık kullanılmıyor; yalnızca önceki sürümden kalan veriyi siler.
 */
export function eskiYerelTalepleriTemizle() {
  try { localStorage.removeItem('td_kayit_talepleri') } catch { /* yoksay */ }
}

/**
 * Giriş hatasını kullanıcıya yol göstererek çevirir.
 *
 * DİKKAT: "Invalid login credentials" iki farklı durumu birleştirir:
 *   (a) şifre yanlış, (b) hesap hiç yok. Hangisi olduğunu bilemeyiz;
 *   bu yüzden ikisini de kapsayan ama panik ettirmeyen bir mesaj verilir
 *   ve "e-posta mı kullanıcı adı mı" ayrımı hatırlatılır.
 */
export function girisHatasi(mesaj) {
  const m = String(mesaj || '')
  if (/Invalid login credentials|invalid credentials/i.test(m)) {
    return 'Giriş yapılamadı. Şifreyi ve giriş bilgisini (e-posta ya da kullanıcı adı) ' +
      'kontrol edin. Hekiminizden geçici şifrenizi isteyebilirsiniz.'
  }
  if (/Email not confirmed/i.test(m)) {
    return 'E-posta adresiniz henüz doğrulanmamış. Hekiminizden hesabınızı tamamlamasını isteyin.'
  }
  if (/rate limit|too many/i.test(m)) {
    return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.'
  }
  return suMesaj(m)
}

/* --- Yardımcılar --- */

/** Ağ yavaş kalırsa istek asılı kalmasın; zaman aşımına düşer. */
function zamanAsimli(soru, ms = 8000) {
  return Promise.race([
    soru,
    new Promise((_, reddet) => setTimeout(() => reddet(new Error('zaman aşımı')), ms))
  ])
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
  if (/unable to validate email|invalid format/i.test(m)) return 'E-posta adresinizde İngilizce olmayan karakterler (ç,ğ,ı,ö,ş,ü) olamaz. Lütfen ad.soyad@gmail.com biçiminde girin.'
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
