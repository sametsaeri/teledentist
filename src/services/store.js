// Basit localStorage katmanı (backend gelene kadar)
export function load(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}
export function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}
export const keys = {
  session: 'td_session',
  appointments: 'td_appointments',
  teethNotes: 'td_teeth_notes',
  xrays: 'td_xrays',
  triage: 'td_triage',
  hygiene: 'td_hygiene',
  anxiety: 'td_anxiety',
  photos: 'td_photos',
  photoNotes: 'td_photo_notes'
}
export function getSession() { return load(keys.session, null) }
export function setSession(s) { save(keys.session, s) }
