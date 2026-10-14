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
