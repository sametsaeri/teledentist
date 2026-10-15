// Supabase varsa gerçek tablolar, yoksa yerel kayıtlar
import { supabase, hasSupabase } from './supabase.js'
import { load, save, keys } from './store.js'
import { allUsers } from './auth.js'

export async function listPatients() {
  if (hasSupabase) {
    const { data, error } = await supabase.from('profiles').select('*').in('role', ['hasta', 'ebeveyn']).order('created_at', { ascending: false })
    if (!error && data) return data
  }
  return allUsers().filter((u) => u.role === 'hasta' || u.role === 'ebeveyn')
}

export async function listDoctors() {
  if (hasSupabase) {
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'hekim').order('created_at', { ascending: false })
    if (!error && data) return data
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

// Triyaj kayıtlarını oku (hekim paneli). Sunucu yoksa yerel kayıt.
export async function listTriage(pid) {
  if (hasSupabase) {
    let q = supabase.from('triage').select('*').order('created_at', { ascending: false }).limit(100)
    if (pid) q = q.eq('patient_id', pid)
    const { data, error } = await q
    if (!error && data && data.length) return data
    if (!error) return []
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
    let q = supabase.from('photos').select('*').order('created_at', { ascending: false }).limit(100)
    if (pid) q = q.eq('patient_id', pid)
    const { data, error } = await q
    if (!error && data) return data
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
    return { error: error?.message }
  }
  return { error: 'Supabase bağlı değil.' }
}

// Kayıt istekleri: hasta ister, hekim onaylar
export async function listRequests() {
  if (hasSupabase) {
    const { data } = await supabase.from('kayit_istekleri').select('*').order('created_at', { ascending: false })
    if (data) return data
  }
  return []
}

export async function approveRequest(req, createdBy) {
  if (!hasSupabase) return { error: 'Supabase bağlı değil.' }
  const { error } = await supabase.from('profiles').upsert({ id: req.user_id, role: req.role, email: req.email.toLowerCase(), name: req.name, created_by: createdBy || null })
  if (error) return { error: error.message }
  if (req.role === 'ebeveyn' && req.child_email) {
    const { data: child } = await supabase.from('profiles').select('id').eq('email', req.child_email.toLowerCase()).single()
    if (child) await supabase.from('parent_child').upsert({ parent_id: req.user_id, child_id: child.id }, { onConflict: 'parent_id,child_id' })
  }
  await supabase.from('kayit_istekleri').delete().eq('id', req.id)
  return { ok: true }
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

export async function uploadImage(bucket, patientId, label, dataUrl) {
  if (!hasSupabase) return { error: 'Supabase bağlı değil, yerel kayıt kullanıldı.' }
  const path = `${patientId}/${label}-${Date.now()}.png`
  const { error } = await supabase.storage.from(bucket).upload(path, dataUrlToBlob(dataUrl), {
    contentType: 'image/png', upsert: false
  })
  if (error) return { error: error.message }
  return { ok: true, path }
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
  const { data, error } = await supabase.rpc('setup_status')
  if (error) {
    return { error: 'setup_status fonksiyonu bulunamadı — kurulum SQL\'i henüz çalıştırılmamış.' }
  }
  return { data }
}

// ---------- Randevu / Takvim / Bildirim ----------

export async function listAppointments() {
  if (hasSupabase) {
    // Sıralamayı tarayıcıda yapıyoruz: appt_date kolonu (migration_v2) yoksa da 400 almayalım
    const { data, error } = await supabase.from('appointments').select('*')
    if (!error && data) return data.slice().sort((a, b) => String(a.appt_date || '').localeCompare(String(b.appt_date || '')))
  }
  return load(keys.appointments, [])
}

export async function insertAppointment({ name, contact, dept, complaint, apptDate, online }) {
  if (hasSupabase) {
    const row = {
      name, contact, dept: dept || 'genel-dis', complaint,
      appt_date: apptDate || null, status: 'yeni'
    }
    // is_online kolonu yoksa (migration_v2 çalışmamışsa) onsuz tekrar dene
    let { error } = await supabase.from('appointments').insert({ ...row, is_online: !!online })
    if (error && /is_online|appt_date/i.test(error.message || '')) {
      const retry = await supabase.from('appointments').insert({ name, contact, dept: row.dept, complaint, status: 'yeni' })
      error = retry.error
    }
    return { error: error?.message }
  }
  const list = load(keys.appointments, [])
  list.push({ id: Date.now(), name, contact, dept: dept || 'genel-dis', complaint, appt_date: apptDate || null, status: 'yeni', is_online: !!online, created_at: new Date().toISOString() })
  save(keys.appointments, list)
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
    return { error: error?.message }
  }
  const list = load(keys.appointments, []).map((a) => a.id === id ? { ...a, status: 'onaylı', doctor_id: doctorId, appt_date: dateStr || a.appt_date } : a)
  save(keys.appointments, list)
  return {}
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
