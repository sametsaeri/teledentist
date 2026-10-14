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
    if (data) return data
  }
  return allUsers()
}

// ---------- Randevu / Takvim / Bildirim ----------

export async function listAppointments() {
  if (hasSupabase) {
    const { data } = await supabase.from('appointments').select('*').order('appt_date', { ascending: true })
    if (data) return data
  }
  return load(keys.appointments, [])
}

export async function insertAppointment({ name, contact, dept, complaint, apptDate }) {
  if (hasSupabase) {
    const { error } = await supabase.from('appointments').insert({
      name, contact, dept: dept || 'genel-dis', complaint,
      appt_date: apptDate || null, status: 'yeni'
    })
    return { error: error?.message }
  }
  const list = load(keys.appointments, [])
  list.push({ id: Date.now(), name, contact, dept: dept || 'genel-dis', complaint, appt_date: apptDate || null, status: 'yeni', created_at: new Date().toISOString() })
  save(keys.appointments, list)
  return {}
}

export async function approveAppointment(id, doctorId, dateStr) {
  if (hasSupabase) {
    const { error } = await supabase.from('appointments')
      .update({ status: 'onaylı', doctor_id: doctorId || null, appt_date: dateStr || null })
      .eq('id', id)
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
