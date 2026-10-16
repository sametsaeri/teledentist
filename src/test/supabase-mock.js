// Testler için Supabase taklidi.
// Amaç: gerçek ağ olmadan uygulamanın "yedek yollarını" (localStorage)
// denemek. Tüm zincir seviyeleri thenable olduğu için
// supabase-js'in .select().eq().order().limit() kalıbı taklit edilebilir.

const BULUNAMADI = { data: null, error: { message: 'relation "x" does not exist', code: '42P01' } }
const BOS = { data: [], error: null }
const YOK = { data: null, error: null }

/** Zincirleme sorgu taklidi — her seviye await edilebilir. */
function zincir(veri = null, hata = BULUNAMADI.error) {
  const sonuc = { data: veri, error: hata }
  const q = {}
  const zincirle = (ekVeri, ekHata) => {
    // Her zincir noktasında hem mevcut hem yeni sonucu taşı
    Object.assign(q, zincir(ekVeri, ekHata))
    return q
  }
  q.select = () => zincirle(veri, hata)
  q.insert = () => zincirle(BOS, hata)
  q.upsert = () => zincirle(BOS, null)
  q.update = () => zincirle(BOS, null)
  q.delete = () => zincirle(BOS, null)
  q.eq = q.neq = q.gt = q.gte = q.lt = q.lte = q.like = q.ilike = q.in = q.contains = () => zincirle(veri, hata)
  q.order = q.limit = q.offset = q.range = q.single = q.maybeSingle = () => zincirle(veri, hata)
  q.then = (coz, red) => Promise.resolve(sonuc).then(coz, red)
  q.catch = (red) => Promise.resolve(sonuc).catch(red)
  q.finally = (f) => Promise.resolve(sonuc).finally(f)
  return q
}

export function supabaseMock() {
  return {
    supabase: {
      from: () => zincir(),
      rpc: () => Promise.resolve(BULUNAMADI),
      storage: {
        from: () => ({
          list: () => Promise.resolve({ data: [], error: null }),
          upload: () => Promise.resolve({ error: null }),
          remove: () => Promise.resolve({ error: null }),
          getPublicUrl: (yol) => ({ data: { publicUrl: yol } }),
          createSignedUrl: () => Promise.resolve({ data: { signedUrl: '' }, error: null })
        })
      },
      auth: {
        signInWithPassword: () => Promise.resolve({ data: {}, error: { message: 'test ortami' } }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        setSession: () => Promise.resolve({ data: {}, error: null }),
        signOut: () => Promise.resolve({ error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
      }
    },
    hasSupabase: true
  }
}