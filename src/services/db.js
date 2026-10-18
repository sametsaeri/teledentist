// Supabase varsa gerçek tablolar, yoksa yerel kayıtlar
import { supabase, hasSupabase } from './supabase.js'
import { load, save, keys, getSession } from './store.js'
import { allUsers, suMesaj, rpcYok, kullaniciAdiTuret } from './auth.js'
import { bakimKontrol } from './bakim.js'
import { bildirimOlustur } from './bildirim.js'

// Ağ yavaş kalırsa veri katmanı asılı kalmasın: okuma isteklerine zaman aşımı.
// Başarısız olursa çağıran taraf yerel kayda düşer.
function withTimeout(promise, ms = 6000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('zaman aşımı')), ms))
  ])
}

export async function listPatients() {
  if (hasSupabase) {
    try {
      const { data, error } = await withTimeout(supabase.from('profiles').select('*').in('role', ['hasta', 'ebeveyn']).order('created_at', { ascending: false }))
      if (!error && data && data.length) return data
    } catch { /* sunucuya ulaşılamadı, yerele düş */ }
  }
  return allUsers().filter((u) => u.role === 'hasta' || u.role === 'ebeveyn')
}

export async function listDoctors() {
  if (hasSupabase) {
    try {
      const { data, error } = await withTimeout(supabase.from('profiles').select('*').eq('role', 'hekim').order('created_at', { ascending: false }))
      if (!error && data && data.length) return data
    } catch { /* sunucuya ulaşılamadı, yerele düş */ }
  }
  return allUsers().filter((u) => u.role === 'hekim')
}

export async function getPatient(id) {
  if (hasSupabase) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (data) return data
  }
  return allUsers().find((u) => u.id === id) || null
}

export async function getChildren(parentId) {
  if (hasSupabase) {
    const { data } = await supabase.from('parent_child').select('child_id, profiles!parent_child_child_id_fkey(id, name)').eq('parent_id', parentId)
    if (data) return data.map((r) => ({ id: r.child_id, name: r.profiles?.name || r.child_id }))
  }
  const me = allUsers().find((u) => u.id === parentId)
  return (me?.children || []).map((c) => ({ id: c, name: c }))
}

export async function getTeeth(pid) {
  const base = {}
  if (hasSupabase) {
    const { data } = await supabase.from('teeth').select('*').eq('patient_id', pid)
    if (data) data.forEach((t) => { base[t.fdi] = { status: t.status, treatment: t.treatment, date: t.updated_at, doctorNote: t.doctor_note } })
  }
  const saved = load(keys.teethNotes, {})
  Object.keys(saved).forEach((k) => {
    if (k.startsWith(pid + '_')) {
      const fdi = k.slice(pid.length + 1)
      base[fdi] = { ...(base[fdi] || { status: 'saglam' }), doctorNote: saved[k] }
    }
  })
  return base
}

export async function saveTooth(pid, fdi, { status, treatment, doctorNote }) {
  if (hasSupabase) {
    await supabase.from('teeth').upsert({ patient_id: pid, fdi: Number(fdi), status, treatment: treatment || '-', doctor_note: doctorNote || '', updated_at: new Date().toISOString().slice(0, 10) }, { onConflict: 'patient_id,fdi' })
  }
  const cur = load(keys.teethNotes, {})
  if (doctorNote) { cur[`${pid}_${fdi}`] = doctorNote; save(keys.teethNotes, cur) }
}

export async function lastRecords(pid) {
  if (hasSupabase) {
    const [t, h, a] = await Promise.all([
      supabase.from('triage').select('level').eq('patient_id', pid).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('hygiene').select('plaque').eq('patient_id', pid).order('hdate', { ascending: false }).limit(1).single(),
      supabase.from('anxiety').select('total').eq('patient_id', pid).order('adate', { ascending: false }).limit(1).single()
    ])
    return { triage: t.data?.level || 'kayıt yok', hygiene: (h.data?.plaque ?? 'kayıt yok') + ' plak', anxiety: (a.data?.total ?? 'kayıt yok') + ' puan' }
  }
  return {
    triage: (load(keys.triage, []).filter((x) => x.patientId === pid).slice(-1)[0]?.level) || 'kayıt yok',
    hygiene: ((load(keys.hygiene, []).filter((x) => x.patientId === pid).slice(-1)[0]?.plaque) ?? 'kayıt yok') + ' plak',
    anxiety: ((load(keys.anxiety, []).filter((x) => x.patientId === pid).slice(-1)[0]?.total) ?? 'kayıt yok') + ' puan'
  }
}

// Hekim hasta adına ölçüm girer
export async function insertTriage(pid, row) {
  if (hasSupabase) {
    const { error } = await supabase.from('triage').insert({ patient_id: pid, ...row })
    return { error: error?.message }
  }
  const list = load(keys.triage, [])
  list.push({ id: Date.now(), patientId: pid, ...row })
  save(keys.triage, list)
  return {}
}

export async function insertHygiene(pid, row) {
  if (hasSupabase) {
    const { error } = await supabase.from('hygiene').insert({ patient_id: pid, plaque: row.plaque, brush: row.brush })
    return { error: error?.message }
  }
  const list = load(keys.hygiene, [])
  list.push({ id: Date.now(), patientId: pid, ...row })
  save(keys.hygiene, list)
  return {}
}

export async function insertAnxiety(pid, total) {
  if (hasSupabase) {
    const { error } = await supabase.from('anxiety').insert({ patient_id: pid, total })
    return { error: error?.message }
  }
  const list = load(keys.anxiety, [])
  list.push({ id: Date.now(), patientId: pid, total })
  save(keys.anxiety, list)
  return {}
}

// Triyaj kayıtlarını oku (hekim paneli). Sunucu yoksa veya boşsa yerel kayıt.
export async function listTriage(pid) {
  if (hasSupabase) {
    try {
      let q = supabase.from('triage').select('*').order('created_at', { ascending: false }).limit(100)
      if (pid) q = q.eq('patient_id', pid)
      const { data, error } = await withTimeout(q)
      if (!error && data && data.length) return data
    } catch { /* sunucuya ulaşılamadı, yerele düş */ }
  }
  const all = load(keys.triage, [])
  const list = pid ? all.filter((t) => t.patientId === pid) : all
  return list.slice().sort((a, b) => (b.score || 0) - (a.score || 0))
}

// ---------- Ağız fotoğrafları ----------
// Dosya Storage'a, kayıt photos tablosuna yazılır. Böylece hekim
// başka bir cihazdan da hastanın fotoğraflarını görür.
export async function listPhotos(pid) {
  if (hasSupabase) {
    try {
      let q = supabase.from('photos').select('*').order('created_at', { ascending: false }).limit(100)
      if (pid) q = q.eq('patient_id', pid)
      const { data, error } = await withTimeout(q)
      if (!error && data && data.length) return data
    } catch { /* sunucuya ulaşılamadı, yerele düş */ }
  }
  // Yedek: tarayıcıdaki eski kayıtlar
  return load(keys.photos, []).filter((p) => !pid || p.patientId === pid)
}

export async function insertPhoto({ patientId, path, label = 'foto', createdBy, note = '' }) {
  if (hasSupabase) {
    const { error } = await supabase.from('photos').insert({
      patient_id: patientId, path, label, note, status: 'bekliyor', created_by: createdBy || null
    })
    return { error: error?.message }
  }
  const list = load(keys.photos, [])
  list.push({ id: Date.now(), patientId, img: null, path, label, note, date: new Date().toISOString().slice(0, 16), status: 'bekliyor' })
  save(keys.photos, list)
  return {}
}

// Kayıttaki tam dosya yolu için geçici (1 saat) imzalı bağlantı
export async function signedPhotoUrl(path) {
  if (!hasSupabase || !path) return null
  try {
    const { data, error } = await supabase.storage.from('photos').createSignedUrl(path, 3600)
    return error ? null : data?.signedUrl || null
  } catch {
    return null
  }
}

export async function setPhotoNote(id, note, status = 'degerlendirildi') {  if (hasSupabase) {
    const { error } = await supabase.from('photos').update({ note, status }).eq('id', id)
    return { error: error?.message }
  }
  save(keys.photos, load(keys.photos, []).map((p) => (p.id === id ? { ...p, note } : p)))
  const notes = load(keys.photoNotes, {})
  notes[id] = note
  save(keys.photoNotes, notes)
  return {}
}

export async function listReferrals() {
  if (hasSupabase) {
    const { data } = await supabase.from('referrals').select('*').order('created_at', { ascending: false }).limit(50)
    if (data) return data
  }
  return []
}
export async function referPatient({ patientId, toDoctor, branch, note, fromDoctor }) {
  if (hasSupabase) {
    const { error } = await supabase.from('referrals').insert({ patient_id: patientId, from_doctor: fromDoctor || null, to_doctor: toDoctor, branch: branch || 'genel', note: note || '' })
    if (error) return { error: error?.message }
    // Hedef hekime sevk bildirimi
    const hasta = await getPatient(patientId)
    bildirimOlustur({
      tur: 'sevk',
      title: `${hasta?.name || 'Bir hasta'} size sevk edildi`,
      body: `${branch || 'genel'} · ${note || 'Muayene sonrası sevk'}`,
      hekimId: toDoctor || null,
      hastaId: patientId || null
    })
    return {}
  }
  return { error: 'Supabase bağlı değil.' }
}

// Kayıt istekleri: hasta ister, hekim onaylar.
//
// ÖNEMLİ: Talep YALNIZCA sunucuda tutulur. Tarayıcıda kopya tutulmaz —
// aksi hâlde hekim başka cihazdan göremez ve hasta hesabı hiçbir
// bilgisayardan açamaz.
export async function listRequests() {
  if (!hasSupabase) return []
  try {
    const { data, error } = await withTimeout(
      supabase.from('kayit_istekleri').select('*').order('created_at', { ascending: false })
    )
    if (!error && data) return data
  } catch { /* sunucuya ulaşılamadı */ }
  return []
}

/**
 * Hatırlanabilir ama tahmin edilemeyecek geçici şifre üretir.
 * Hasta bu şifreyi hekim panelinden alır; sonra kendi şifresini değiştirir.
 */
export function geciciSifreUret(email = '') {
  const kisa = String(email).split('@')[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toLowerCase() || 'hasta'
  const sayi = Math.floor(1000 + Math.random() * 9000)
  return `${kisa}${sayi}`
}

/**
 * Talebi onayla veya reddet.
 * Öncelikli yol: decide_registration_request RPC'si (profil + auth kaydını
 * sunucuda tek adımda yapar). RPC yoksa doğrudan tablo işlemleri.
 *
 * DÖNÜŞ: onaylandıysa `geciciSifre` de döner; hekim paneli bunu
 * hastaya iletir. Şifre üretilmediyse (auth kullanıcısı zaten vardı)
 * alan boş gelir ve hasta kendi şifresiyle girebilir.
 */
export async function decideRequest(req, onayla, createdBy) {
  if (!hasSupabase) return { error: 'Sunucuya bağlanılamadı. İnternetinizi kontrol edin.' }
  if (!req?.id || !Number.isFinite(Number(req.id))) {
    return { error: 'Talep kaydı sunucuda bulunamadı. Sayfayı yenileyip tekrar deneyin.' }
  }

  const sunucuTalebi = req && req.id !== undefined && req.id !== null
  if (sunucuTalebi) {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('decide_registration_request', {
          p_request_id: Number(req.id),
          p_approve: !!onayla,
          p_doctor_id: createdBy || null
        })
      )
      if (!error && data) {
        // RPC tüm anahtarları döndürür (sifre, username, email, uid) — Portal bunları gösterir
        if (data.ok === false) return { error: suMesaj(data?.error) }
        return {
          ok: true,
          durum: data?.durum || (onayla ? 'onaylandi' : 'reddedildi'),
          uid: data?.uid || null,
          email: data?.email || null,
          username: data?.username || null,
          geciciSifre: data?.sifre || null
        }
      }
      // RPC yoksa aşağıdaki manuel yola düş
      if (!rpcYok(error)) return { error: suMesaj(error?.message) }
    } catch (e) {
      if (!rpcYok({ message: e?.message }) && !/fetch|network|zaman aşımı|timeout/i.test(String(e?.message || ''))) {
        return { error: suMesaj(e?.message) }
      }
    }
  }

  if (!onayla) {
    const { error } = await supabase.from('kayit_istekleri').delete().eq('id', req.id)
    if (error) return { error: suMesaj(error.message) }
    return { ok: true, durum: 'reddedildi' }
  }

  // Onayla: profili oluştur
  const email = String(req.email || '').toLowerCase()
  let uid = req.user_id

  // NEDEN VAR: hasta kendi şifresini seçti. Hesap auth'da yoksa
  // geçici şifre üretip HESABIN SAHİBİNE (hekim paneline) bildiriyoruz.
  // Daha önce sabit "teledentist" şifresi veriliyordu; hasta kendi
  // şifresiyle giremeyince "kullanıcı bulunamadı" sanıyordu.
  const geciciSifre = geciciSifreUret(email)

  // auth kullanıcısı yoksa oluştur (signup kapalı olabilir)
  if (!uid) {
    try {
      const { data: ac, error: acErr } = await withTimeout(
        supabase.auth.admin.createUser({ email, password: geciciSifre, email_confirm: true })
      )
      if (!acErr && ac?.user?.id) uid = ac.user.id
    } catch { /* admin API erişimi yoksa RPC yoluna bırakılır */ }
  }

  // Profil yazımı RLS'e takılabilir; en sağlam yol SECURITY DEFINER RPC.
  if (!uid) {
    return {
      error: 'Hesap sunucuda oluşturulamadı. Proje kurulumu tamamlanmalı: ' +
        '"npm run db:push" komutunu çalıştırın.'
    }
  }

  const { error } = await supabase.from('profiles').upsert({
    id: uid,
    role: req.role,
    email,
    name: req.name,
    // Kullanıcı adı boş kalırsa "Bu kullanıcı adı bulunamadı" hatası verir
    username: req.username || kullaniciAdiTuret(email, req.name),
    created_by: createdBy || null
  })
  if (error) return { error: suMesaj(error.message) }

  if (req.role === 'ebeveyn' && req.child_email) {
    const { data: child } = await supabase.from('profiles')
      .select('id').eq('email', String(req.child_email).toLowerCase()).maybeSingle()
    if (child) {
      await supabase.from('parent_child')
        .upsert({ parent_id: uid, child_id: child.id }, { onConflict: 'parent_id,child_id' })
    }
  }
  await supabase.from('kayit_istekleri').delete().eq('id', req.id)
  // Yalnızca auth kullanıcısı YENİDEN oluşturulduysa geçici şifre verilir;
  // kullanıcı zaten varsa hasta kendi şifresiyle girebilir (geciciSifre: null).
  return {
    ok: true,
    durum: 'onaylandi',
    uid,
    email,
    username: req.username || kullaniciAdiTuret(email, req.name),
    geciciSifre: uid === req.user_id ? null : geciciSifre
  }
}

/** Geriye uyumluluk: yalnızca onaylama */
export async function approveRequest(req, createdBy) {
  return decideRequest(req, true, createdBy)
}

/**
 * Onaylanmış ama giriş yapamayan hastalar için hesap onarımı.
 *
 * SORUN: profil satırı var ama auth kaydı yok (ya da şifre bilinmiyor).
 * Bu fonksiyon auth kullanıcısını bulur/oluşturur ve profil satırını
 * e-postaya göre yeniden yazar. SQL gerektirmez.
 *
 * @param {string} email  hastanın e-postası
 * @param {string} sifre  yeni/hatırlanabilir şifre (boşsa üretilir)
 */
export async function repairAccount(email, sifre, createdBy) {
  if (!hasSupabase) return { error: 'Sunucuya bağlanılamadı.' }
  email = String(email || '').trim().toLowerCase()
  if (!email.includes('@')) return { error: 'Geçerli bir e-posta girin.' }
  const yeniSifre = String(sifre || '').trim() || geciciSifreUret(email)
  if (yeniSifre.length < 6) return { error: 'Şifre en az 6 karakter olmalı.' }

  // 1) Profil var mı?
  const { data: prof } = await withTimeout(
    supabase.from('profiles').select('*').eq('email', email).maybeSingle()
  )
  if (!prof) {
    return { error: 'Bu e-posta için profil kaydı yok. Önce kayıt talebini onaylayın.' }
  }

  // 2) Auth kullanıcısını oluştur/garantile
  let uid = prof.id
  let yeniHesap = false
  try {
    const { data: ac, error: acErr } = await withTimeout(
      supabase.auth.admin.createUser({ email, password: yeniSifre, email_confirm: true })
    )
    if (!acErr && ac?.user?.id) { uid = ac.user.id; yeniHesap = true }
  } catch { /* kullanıcı zaten varsa admin API hata verir — yoksay */ }

  // 3) Profil satırını tamamla (username boşsa doldur)
  const { error: upErr } = await supabase.from('profiles').upsert({
    id: uid,
    role: prof.role,
    email,
    name: prof.name,
    username: prof.username || kullaniciAdiTuret(email, prof.name),
    created_by: prof.created_by || createdBy || null
  })
  if (upErr) return { error: suMesaj(upErr.message) }

  return {
    ok: true,
    yeniHesap,
    uid,
    username: prof.username || kullaniciAdiTuret(email, prof.name),
    sifre: yeniSifre,
    not: yeniHesap
      ? 'Yeni giriş bilgileri oluşturuldu.'
      : 'Auth kullanıcısı zaten vardı; profil tamamlandı. Şifre değişmediyse eski şifre geçerlidir.'
  }
}

/** Geriye uyumluluk: reddetme */
export async function rejectRequest(req) {
  return decideRequest(req, false)
}

// Hekim panelinden profil tamamlama (Auth kullanıcısı panelden açıldıktan sonra)
export async function createProfile({ uid, role, email, name, childId, createdBy }) {
  if (!uid || !role || !email || !name) return { error: 'UID, rol, e-posta ve ad zorunlu.' }
  if (hasSupabase) {
    const { error } = await supabase.from('profiles').upsert({ id: uid, role, email: email.toLowerCase(), name, created_by: createdBy || null })
    if (error) return { error: error.message }
    if (role === 'ebeveyn' && childId) await supabase.from('parent_child').upsert({ parent_id: uid, child_id: childId }, { onConflict: 'parent_id,child_id' })
    return { ok: true }
  }
  return { error: 'Supabase bağlı değil.' }
}

// ---------- Depolama (röntgen / fotoğraf) ----------

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',')
  const mime = (head.match(/:(.*?);/) || [])[1] || 'image/png'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/**
 * Görsel yükler ve KAYIT TUTAR.
 *
 * VERİ KAYBI KURALI: Dosya yüklenince `medical_files` tablosuna bir satır
 * yazılır (hangi hasta, hangi diş, ne zaman, kim yükledi, boyut, tür).
 * Dosya adı tek başına bilgi taşımaz; silme/yeniden adlandırma/arşivleme
 * işlemleri bu kayıt üzerinden yapılır. Kayıt yazılamazsa dosya SİLİNMEZ —
 * önce uyarılır; veri kaybetmektense kayıtsız dosya kalmak yeğdir.
 *
 * @param {string} tur  'xray' | 'belge' | 'foto'
 */
export async function uploadFile(bucket, patientId, label, dataUrl, { tur = 'xray', tooth = null, not = '', category = '', createdBy } = {}) {
  // Bakımdayken veri yazılmaz: yarım kalan dosya/kayıt oluşmaz
  const bakimHatasi = bakimKontrol('Dosya yükleme')
  if (bakimHatasi) return bakimHatasi
  if (!hasSupabase) return { error: 'Supabase bağlı değil, yerel kayıt kullanıldı.' }

  // Hasta mı yüklüyor hekim mi? Buna göre bildirim kime gider
  const yukleyen = getSession()
  const hastaYukledi = ['hasta', 'ebeveyn'].includes(yukleyen?.role)

  // Dosya adı benzersiz olmalı: aynı dişe iki saniyede iki röntgen yüklenebilir
  const zaman = new Date()
  const damga = `${zaman.getTime()}-${Math.random().toString(36).slice(2, 7)}`
  const uzanti = (dataUrl.split(';')[0] || '').includes('pdf') ? 'pdf' : 'png'
  const path = `${patientId}/${label}-${damga}.${uzanti}`

  const up = await supabase.storage.from(bucket).upload(path, dataUrlToBlob(dataUrl), {
    contentType: uzanti === 'pdf' ? 'application/pdf' : 'image/png', upsert: false
  })
  if (up.error) return { error: up.error.message }

  // Kayıt satırı: silme ve arşivleme buna göre yapılır
  const satir = {
    patient_id: patientId,
    path,
    bucket,
    tur,
    category: category || null,
    label,
    tooth,
    not,
    boyut: dataUrl.length,
    olusturan: createdBy || null,
    created_at: zaman.toISOString(),
    arsiv: false
  }
  const { data: kayit, error: kErr } = await supabase.from('medical_files').insert(satir).select().single()
  if (kErr) {
    // Dosya yüklendi ama kayıt tutulamadı — KULLANICIYA BİLDİR, silme
    return {
      ok: true,
      path,
      kayitYok: true,
      uyari: `Dosya yüklendi ancak kaydı tutulamadı (${kErr.message}). Dosya arşivlenemez; Supabase "medical_files" tablosu kurulmalı.`
    }
  }

  // Hasta yüklediyse hekime bildir — muayene öncesi görülmeli
  if (hastaYukledi) {
    const hasta = await getPatient(patientId)
    bildirimOlustur({
      tur: tur === 'belge' ? 'belge' : 'foto',
      title: `${hasta?.name || 'Hasta'} yeni ${tur === 'belge' ? 'belge' : 'görsel'} yükledi`,
      body: tooth ? `${tooth} nolu diş · ${category || 'sınıflandırılmamış'}` : (not || 'Sınıflandırılmamış'),
      hastaId: patientId
    })
  }
  return { ok: true, path, kayit }
}

// Geriye uyumluluk: eski çağrılar çalışmaya devam eder
export async function uploadImage(bucket, patientId, label, dataUrl) {
  return uploadFile(bucket, patientId, label, dataUrl, { tur: 'xray' })
}

/** Hastanın TÜM dosyalarını (röntgen, belge, foto) listeler. */
export async function listMedicalFiles(patientId, { arsiv = null, tur = null } = {}) {
  if (!hasSupabase) {
    const hepsi = load(keys.medicalFiles, []).filter((f) => String(f.patient_id) === String(patientId))
    return hepsi.filter((f) => (arsiv === null ? true : !!f.arsiv === arsiv))
      .filter((f) => (tur ? f.tur === tur : true))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  }
  try {
    let q = supabase.from('medical_files').select('*').eq('patient_id', patientId)
    if (arsiv !== null) q = q.eq('arsiv', arsiv)
    if (tur) q = q.eq('tur', tur)
    const { data, error } = await withTimeout(q.order('created_at', { ascending: false }))
    if (!error && data) return data
  } catch { /* sunucuya ulaşılamadı */ }
  // Yedek: tarayıcıdaki kayıtlar (SQL kurulmamışsa)
  return load(keys.medicalFiles, [])
    .filter((f) => String(f.patient_id) === String(patientId))
    .filter((f) => (arsiv === null ? true : !!f.arsiv === arsiv))
    .filter((f) => (tur ? f.tur === tur : true))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}

/** Tek bir dosyanın imzalı bağlantısını üretir (1 saat geçerli). */
export async function fileUrl(path) {
  return signedPhotoUrl(path)
}

/**
 * Dosya silinir: hem kayıt satırı hem depolamadaki dosya silinir.
 * ÖNCE kayıt silinmez, dosya silinir; dosya silinemezse kayıt kalır —
 * aksi hâlde kayıt var ama dosya yok olurdu (ölü kayıt).
 */
export async function deleteMedicalFile(kayit) {
  const bakimHatasi = bakimKontrol('Dosya silme')
  if (bakimHatasi) return bakimHatasi
  if (!kayit?.path) return { error: 'Dosya kaydı bulunamadı.' }
  if (hasSupabase) {
    try {
      const { error } = await supabase.storage.from(kayit.bucket || 'xrays').remove([kayit.path])
      if (error) return { error: 'Dosya depolamadan silinemedi: ' + error.message }
    } catch { /* depolama erişimi yoksa yalnız kayıt silinir */ }
    const { error: kErr } = await supabase.from('medical_files').delete().eq('path', kayit.path)
    if (kErr) return { error: kErr.message }
    return { ok: true }
  }
  save(keys.medicalFiles, load(keys.medicalFiles, []).filter((f) => f.path !== kayit.path))
  return { ok: true }
}

/** Arşiv durumunu değiştirir (arşiv = pasif kayıt, silmek DEĞİL). */
export async function setFileArsiv(kayit, arsiv) {
  const bakimHatasi = bakimKontrol('Arşiv değişikliği')
  if (bakimHatasi) return bakimHatasi
  if (!kayit?.path) return { error: 'Dosya kaydı bulunamadı.' }
  if (hasSupabase) {
    const { error } = await supabase.from('medical_files').update({ arsiv: !!arsiv }).eq('path', kayit.path)
    if (error) return { error: error.message }
    return { ok: true }
  }
  save(keys.medicalFiles, load(keys.medicalFiles, [])
    .map((f) => (f.path === kayit.path ? { ...f, arsiv: !!arsiv } : f)))
  return { ok: true }
}

/** Dosya sınıflandırmasını (kategori) günceller. */
export async function setFileCategory(kayit, category) {
  if (!kayit?.path) return { error: 'Dosya kaydı bulunamadı.' }
  if (hasSupabase) {
    const { error } = await supabase.from('medical_files').update({ category }).eq('path', kayit.path)
    if (error) return { error: error.message }
    return { ok: true }
  }
  save(keys.medicalFiles, load(keys.medicalFiles, [])
    .map((f) => (f.path === kayit.path ? { ...f, category } : f)))
  return { ok: true }
}

// Önce storage, yoksa yerel kayıt (yedek)
export async function loadImage(bucket, patientId, label) {
  if (!hasSupabase) return null
  try {
    const { data: files, error } = await supabase.storage.from(bucket)
      .list(patientId)
    if (error || !files || !files.length) return null
    const hit = files.filter((f) => f.name.startsWith(label + '-')).sort((a, b) => b.name.localeCompare(a.name))[0]
    if (!hit) return null
    const { data, error: e2 } = await supabase.storage.from(bucket)
      .createSignedUrl(`${patientId}/${hit.name}`, 3600)
    if (e2) return null
    return data?.signedUrl || null
  } catch {
    return null
  }
}

export async function updatePatient(pid, patch) {
  if (hasSupabase) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', pid)
    return { error: error?.message }
  }
  const { save: s, load: l } = { save, load }
  s('td_users', l('td_users', []).map((u) => u.id === pid ? { ...u, ...patch } : u))
  return { ok: true }
}

export async function listAllProfiles() {
  if (hasSupabase) {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data && data.length) return data
    // Sunucuda kayıt yoksa (örn. yerel demo) tarayıcı verisine düş
    const local = allUsers()
    if (local.length) return local
    return data || []
  }
  return allUsers()
}

// ---------- Kurulum durumu (admin paneli "Sistem Durumu" kartı) ----------
export async function getSetupStatus() {
  if (!hasSupabase) return { error: 'Supabase bağlantısı yok — yerel mod çalışıyor.' }
  try {
    const { data, error } = await withTimeout(supabase.rpc('setup_status'))
    if (error) {
      return { error: 'setup_status fonksiyonu bulunamadı — kurulum SQL\'i henüz çalıştırılmamış.' }
    }
    return { data }
  } catch {
    return { error: 'Kurulum durumu okunamadı (sunucuya ulaşılamadı).' }
  }
}

// ---------- Hasta Kayıtları (salt okunur izlem) ----------
// Hastanın kendi panelinde girdiği verileri hekim panelinde gösterir.
export async function listHygiene(pid) {
  if (hasSupabase) {
    try {
      const { data, error } = await withTimeout(supabase.from('hygiene').select('*').eq('patient_id', pid).order('hdate', { ascending: false }))
      if (!error && data && data.length) return data
    } catch { /* sunucuya ulaşılamadı, yerele düş */ }
  }
  return load(keys.hygiene, []).filter((h) => String(h.patientId) === String(pid)).slice().reverse()
}

export async function listAnxiety(pid) {
  if (hasSupabase) {
    try {
      const { data, error } = await withTimeout(supabase.from('anxiety').select('*').eq('patient_id', pid).order('adate', { ascending: false }))
      if (!error && data && data.length) return data
    } catch { /* sunucuya ulaşılamadı, yerele düş */ }
  }
  return load(keys.anxiety, []).filter((a) => String(a.patientId) === String(pid)).slice().reverse()
}

// ---------- Genel tablo katmanı (klinik modülleri) ----------
// Supabase kuruluysa sunucuya yazar; tablo/kolon yoksa veya hata
// dönerse TARAYICIYA kaydeder. Böylece SQL henüz çalıştırılmamış
// olsa bile hiçbir modül ölü kalmaz.
// Aynı milisaniyede eklenen kayıtlar çakışmasın diye id benzersiz üretilir.
// (Date.now() tek başına yeterli değildi: iki kayıt aynı id'yi alıyor,
//  güncelleme/silme yanlış kaydı etkiliyordu.)
function yeniId() {
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function store(table) {
  const k = 'td_' + table
  let localOnly = false // tablo sunucuda yoksa kalıcı olarak yere düş
  const missing = (msg) => /does not exist|schema cache|not found|PGRST/i.test(String(msg || ''))

  const localList = (where) => {
    const all = load(k, [])
    return where ? all.filter((r) => Object.entries(where).every(([c, v]) => String(r[c]) === String(v))) : all
  }

  return {
    table,
    async list({ order = 'created_at', asc = false, where } = {}) {
      if (hasSupabase && !localOnly) {
        try {
          let q = supabase.from(table).select('*')
          Object.entries(where || {}).forEach(([c, v]) => { q = q.eq(c, v) })
          const { data, error } = await q.order(order, { ascending: asc })
          if (!error) return data && data.length ? data : localList(where)
          if (missing(error.message)) localOnly = true
        } catch (e) {
          if (missing(e.message)) localOnly = true
        }
      }
      return localList(where)
    },

    async insert(row) {
      if (hasSupabase && !localOnly) {
        const { error } = await supabase.from(table).insert(row)
        if (!error) return { ok: true }
        if (missing(error.message)) localOnly = true
      }
      const all = localList()
      all.push({ id: yeniId(), created_at: new Date().toISOString(), ...row })
      save(k, all)
      return { ok: true, local: true }
    },

    async update(id, patch) {
      if (hasSupabase && !localOnly) {
        const { error } = await supabase.from(table).update(patch).eq('id', id)
        if (!error) return { ok: true }
        if (missing(error.message)) localOnly = true
      }
      save(k, localList().map((r) => (String(r.id) === String(id) ? { ...r, ...patch } : r)))
      return { ok: true, local: true }
    },

    async remove(id) {
      if (hasSupabase && !localOnly) {
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (!error) return { ok: true }
        if (missing(error.message)) localOnly = true
      }
      save(k, localList().filter((r) => String(r.id) !== String(id)))
      return { ok: true, local: true }
    }
  }
}

export const anamnesisApi = store('anamnesis')
export const plansApi = store('treatment_plans')
export const materialsApi = store('materials')
export const labApi = store('lab_cases')
// NOT: pricesApi (price_items) ve invoicesApi (invoices) KALDIRILDI.
// Bu proje devlet projesidir; devlet tarafından belirlenmiş bir ücret
// listesi yoktur ve uygulamada ücret gösterilmez. Tablolar veritabanında
// dursa da (veri kaybı olmasın diye) artık hiçbir yerden okunmaz/yazılmaz.
export const notesApi = store('clinical_notes')
export const eventsApi = store('doctor_events')
export const intakeApi = store('intake_records')
export const prepApi = store('prep_notes')

// ---------- Randevu / Takvim / Bildirim ----------

export async function listAppointments() {
  if (hasSupabase) {
    // Sıralamayı tarayıcıda yapıyoruz: appt_date kolonu (migration_v2) yoksa da 400 almayalım
    const { data, error } = await supabase.from('appointments').select('*')
    // Sunucuda kayıt yoksa da tarayıcıdaki talepler görünmeye devam etmeli
    if (!error && data && data.length) return data.slice().sort((a, b) => String(a.appt_date || '').localeCompare(String(b.appt_date || '')))
  }
  return load(keys.appointments, [])
}

export async function insertAppointment({ name, contact, dept, complaint, apptDate, online, patientId }) {
  if (hasSupabase) {
    const row = {
      name, contact, dept: dept || 'genel-dis', complaint,
      appt_date: apptDate || null, status: 'yeni'
    }
    if (patientId) row.patient_id = patientId
    // is_online kolonu yoksa (migration_v2 çalışmamışsa) onsuz tekrar dene
    let { error } = await supabase.from('appointments').insert({ ...row, is_online: !!online })
    if (error && /is_online|appt_date|patient_id/i.test(error.message || '')) {
      const retry = await supabase.from('appointments').insert({ name, contact, dept: row.dept, complaint, status: 'yeni' })
      error = retry.error
    }
    if (error) return { error: error?.message }
    // Hekime bildir: randevu talebi onay bekliyor
    bildirimOlustur({
      tur: 'randevu',
      title: `${name} randevu talebi gönderdi`,
      body: `${complaint || 'Şikâyet belirtilmedi'}${apptDate ? ` · ${String(apptDate).slice(0, 10)}` : ' · tarih bekleniyor'}`,
      hastaId: patientId || null,
      link: '/hekim?tab=randevu'
    })
    return {}
  }
  const list = load(keys.appointments, [])
  list.push({ id: Date.now(), name, contact, dept: dept || 'genel-dis', complaint, appt_date: apptDate || null, status: 'yeni', is_online: !!online, created_at: new Date().toISOString() })
  save(keys.appointments, list)
  bildirimOlustur({
    tur: 'randevu',
    title: `${name} randevu talebi gönderdi`,
    body: `${complaint || 'Şikâyet belirtilmedi'}${apptDate ? ` · ${String(apptDate).slice(0, 10)}` : ' · tarih bekleniyor'}`,
    hastaId: patientId || null,
    link: '/hekim?tab=randevu'
  })
  return {}
}

export async function setAppointmentOnline(id, online) {
  if (hasSupabase) {
    const { error } = await supabase.from('appointments').update({ is_online: !!online }).eq('id', id)
    return { error: error?.message }
  }
  const list = load(keys.appointments, []).map((a) => a.id === id ? { ...a, is_online: !!online } : a)
  save(keys.appointments, list)
  return {}
}

export async function approveAppointment(id, doctorId, dateStr) {
  if (hasSupabase) {
    let { error } = await supabase.from('appointments')
      .update({ status: 'onaylı', doctor_id: doctorId || null, appt_date: dateStr || null })
      .eq('id', id)
    if (error && /appt_date/i.test(error.message || '')) {
      const retry = await supabase.from('appointments').update({ status: 'onaylı', doctor_id: doctorId || null }).eq('id', id)
      error = retry.error
    }
    if (error) return { error: error?.message }
    randevuOnayBildirimi(id, dateStr)
    return {}
  }
  const list = load(keys.appointments, []).map((a) => a.id === id ? { ...a, status: 'onaylı', doctor_id: doctorId, appt_date: dateStr || a.appt_date } : a)
  save(keys.appointments, list)
  randevuOnayBildirimi(id, dateStr)
  return {}
}

/** Randevu onaylandı — hastaya bildirilir. */
function randevuOnayBildirimi(id, dateStr) {
  const a = load(keys.appointments, []).find((x) => String(x.id) === String(id))
  if (!a) return
  bildirimOlustur({
    tur: 'randevu_bildirimi',
    title: `Randevunuz onaylandı — ${a.name}`,
    body: dateStr
      ? `${String(dateStr).slice(0, 10)}${a.appt_time ? ` · ${a.appt_time}` : ''} tarihinde clinicamızda bekleriz.`
      : 'Randevunuz onaylandı. Detaylı bilgi için hekiminizle iletişime geçin.',
    hastaId: a.patient_id || null,
    link: '/hastam'
  })
}

export async function completeAppointment(id) {
  if (hasSupabase) {
    const { error } = await supabase.from('appointments').update({ status: 'tamamlandı' }).eq('id', id)
    return { error: error?.message }
  }
  const list = load(keys.appointments, []).map((a) => a.id === id ? { ...a, status: 'tamamlandı' } : a)
  save(keys.appointments, list)
  return {}
}

export async function updateReminderDays(pid, days) {
  if (hasSupabase) {
    const { error } = await supabase.from('profiles').update({ reminder_days: Number(days) }).eq('id', pid)
    return { error: error?.message }
  }
  const users = load('td_users', []).map((u) => u.id === pid ? { ...u, reminderDays: Number(days) } : u)
  save('td_users', users)
  return {}
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const now = new Date()
  return Math.ceil((d - now) / 86400000)
}

// Hekim köşe bildirimleri: yaklaşan randevular + kontrolü gelen hastalar
export async function listNotifications() {
  const appts = await listAppointments()
  const pats = await listPatients()
  const out = []
  const today = new Date().toISOString().slice(0, 10)

  appts.forEach((a) => {
    if (a.status !== 'onaylı' || !a.appt_date) return
    const left = daysUntil(a.appt_date)
    if (left === null) return
    const p = pats.find((x) => (x.name || '').toLowerCase() === (a.name || '').toLowerCase())
    const days = Number(p?.reminder_days ?? p?.reminderDays ?? 5)
    if (left < 0) return
    if (left <= days) {
      out.push({
        id: 'a' + a.id, type: 'randevu', days: left,
        title: `${a.name}`,
        text: `${left === 0 ? 'Bugün' : left + ' gün sonra'} randevusu var (${a.appt_date.slice(0, 10)}). Hasta ile iletişime geçin.`,
        patientId: p?.id || null
      })
    }
  })

  pats.forEach((p) => {
    const lv = p.last_visit || p.lastVisit
    if (!lv) return
    const days = Number(p.reminder_days ?? p.reminderDays ?? 5)
    const visit = new Date(lv)
    visit.setMonth(visit.getMonth() + 3) // 3 aylık bakım kontrolü
    const left = Math.ceil((visit - new Date()) / 86400000)
    if (left >= 0 && left <= days) {
      out.push({
        id: 'k' + p.id, type: 'kontrol', days: left,
        title: `${p.name}`,
        text: `${left === 0 ? 'Bugün' : left + ' gün sonra'} 3 aylık kontrol/bakım zamanı. Arayıp bilgilendirin.`,
        patientId: p.id
      })
    }
  })

  out.sort((a, b) => a.days - b.days)
  return { items: out, today }
}
