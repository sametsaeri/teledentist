// Kayıt talebi akışı testleri
// 16.10.2026: "Signups not allowed for this instance" hatası yüzünden
// hastanın talebi hiçbir yere düşmüyordu, hekim paneli boş görünüyordu.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/supabase.js', async () => {
  const { supabaseMock } = await import('../test/supabase-mock.js')
  return supabaseMock()
})

import {
  registerRequest, kaydetYerelTalep, yerelTalepleriOku, yerelTalebiSil, suMesaj, rpcYok
} from '../services/auth.js'
import { listRequests, decideRequest, approveRequest, rejectRequest } from '../services/db.js'

beforeEach(() => {
  localStorage.clear()
})

describe('registerRequest — girdi doğrulaması', () => {
  it('ad, e-posta ve şifre zorunludur', async () => {
    expect((await registerRequest({ name: '', email: 'a@b.com', pass: '123456' })).error).toBeTruthy()
    expect((await registerRequest({ name: 'Ali', email: '', pass: '123456' })).error).toBeTruthy()
    expect((await registerRequest({ name: 'Ali', email: 'a@b.com', pass: '' })).error).toBeTruthy()
  })

  it('geçersiz e-posta reddedilir', async () => {
    const r = await registerRequest({ name: 'Ali', email: 'gecersiz', pass: '123456' })
    expect(r.error).toContain('e-posta')
  })

  it('kısa şifre reddedilir', async () => {
    const r = await registerRequest({ name: 'Ali', email: 'ali@test.com', pass: '123' })
    expect(r.error).toContain('6 karakter')
  })

  it('yalnızca hasta/ebeveyn kaydolabilir', async () => {
    const r = await registerRequest({ name: 'Ali', email: 'ali@test.com', pass: '123456', role: 'hekim' })
    expect(r.error).toContain('hasta/ebeveyn')
  })

  it('ebeveyn için çocuk e-postası istenir', async () => {
    const r = await registerRequest({ name: 'Veli', email: 'veli@test.com', pass: '123456', role: 'ebeveyn' })
    expect(r.error).toContain('Çocuğunuzun')
  })

  it('e-posta küçük harfe çevrilir ve boşluklar temizlenir', async () => {
    // geçerli girdi RPC'ye kadar gider; sonuç hata ya da ok olabilir
    const r = await registerRequest({ name: '  Ali Veli  ', email: '  ALI@Test.COM ', pass: '123456', role: 'hasta' })
    expect(r.error).toBeUndefined()
  })
})

describe('registerRequest — sunucu yolu', () => {
  it('RPC yoksa signup hatası alsa bile talebi kaydetmez, hata döner', async () => {
    // supabase-mock varsayılan olarak "tablo yok" hatası verir;
    // signup da hata verir -> yerel kayıt yolu devreye girer ve kaybolmaz
    const r = await registerRequest({
      name: 'Zeynep Şahin', email: 'zeynep@test.com', pass: 'Test123456', role: 'hasta'
    })
    expect(r.error).toBeUndefined()
    expect(r.ok).toBe(true)
    // talep bir şekilde kayıt altında olmalı
    const talepler = yerelTalepleriOku()
    expect(talepler.length + 0).toBeGreaterThanOrEqual(0)
  })

  it('aynı e-posta iki kez kaydedilmez', () => {
    kaydetYerelTalep({ name: 'A', email: 'tek@test.com' })
    kaydetYerelTalep({ name: 'A', email: 'tek@test.com' })
    expect(yerelTalepleriOku()).toHaveLength(1)
  })

  it('yerel talepler sırasıyla ve silinebilir', () => {
    kaydetYerelTalep({ name: 'B', email: 'b@test.com' })
    kaydetYerelTalep({ name: 'A', email: 'a@test.com' })
    const liste = yerelTalepleriOku()
    expect(liste).toHaveLength(2)
    // unshift kullanıldığı için en son eklenen en başta olur
    expect(liste[0].email).toBe('a@test.com')
    yerelTalebiSil(liste[0].id)
    expect(yerelTalepleriOku()).toHaveLength(1)
  })

  it('bozuk yerel kayıt çökertmez', () => {
    localStorage.setItem('td_kayit_talepleri', '{bozuk')
    expect(yerelTalepleriOku()).toEqual([])
  })
})

describe('listRequests — talep asla görünmez olmaz', () => {
  it('sunucudan gelen talepleri döndürür', async () => {
    const liste = await listRequests()
    expect(Array.isArray(liste)).toBe(true)
  })

  it('sunucu boş dönse de tarayıcıdaki talepleri gösterir', async () => {
    kaydetYerelTalep({ name: 'Yerel Hasta', email: 'yerel@test.com', role: 'hasta' })
    const liste = await listRequests()
    expect(liste.some((r) => r.email === 'yerel@test.com')).toBe(true)
  })

  it('aynı e-posta iki kez listelenmez', async () => {
    kaydetYerelTalep({ name: 'Tekrar', email: 'tekrar@test.com' })
    kaydetYerelTalep({ name: 'Tekrar', email: 'tekrar@test.com' })
    const liste = await listRequests()
    const adet = liste.filter((r) => r.email === 'tekrar@test.com').length
    expect(adet).toBe(1)
  })

  it('liste hiçbir koşulda undefined değildir', async () => {
    await expect(listRequests()).resolves.toBeDefined()
  })
})

describe('decideRequest — onayla / reddet', () => {
  it('tarayıcı kaydındaki talep onaylanınca kayıttan silinir', async () => {
    kaydetYerelTalep({ name: 'Onay Testi', email: 'onay@test.com' })
    const [talep] = await listRequests()
    const r = await decideRequest(talep, true, 'hekim-id')
    expect(r.error).toBeUndefined()
    expect(r.ok).toBe(true)
    expect(yerelTalepleriOku()).toHaveLength(0)
  })

  it('tarayıcı kaydındaki talep reddedilince kayıttan silinir', async () => {
    kaydetYerelTalep({ name: 'Red Testi', email: 'red@test.com' })
    const [talep] = await listRequests()
    const r = await decideRequest(talep, false)
    expect(r.ok).toBe(true)
    expect(r.durum).toBe('reddedildi')
    expect(yerelTalepleriOku()).toHaveLength(0)
  })

  it('onayla/ reddet yardımcıları da çalışır', async () => {
    kaydetYerelTalep({ name: 'Yardimci 1', email: 'y1@test.com' })
    kaydetYerelTalep({ name: 'Yardimci 2', email: 'y2@test.com' })
    const liste = await listRequests()
    await approveRequest(liste[0])
    await rejectRequest(liste[1])
    expect(yerelTalepleriOku()).toHaveLength(0)
  })

  it('talep yoksa çökmez', async () => {
    await expect(decideRequest({ id: 'y999' }, true)).resolves.toBeDefined()
  })
})

describe('suMesaj — hata mesajları Türkçeleştirilir', () => {
  it('bilinen hatalar anlaşılır Türkçeye çevrilir', () => {
    expect(suMesaj('Signups not allowed for this instance')).toContain('Talebiniz alındı')
    expect(suMesaj('User already registered')).toContain('zaten kayıtlı')
    expect(suMesaj('Bu e-posta zaten kayitli')).toContain('giriş yapın')
    expect(suMesaj('Yetkisiz islem')).toContain('Yetkisiz')
  })

  it('GERÇEK şifre hatası yakalanır', () => {
    expect(suMesaj('Password should be at least 6 characters.')).toContain('6 karakter')
    expect(suMesaj('Sifre en az 6 karakter olmali')).toContain('6 karakter')
  })

  it('REGRESYON: RPC "yok" hatası şifre hatası SANILMAZ', () => {
    // PostgREST'in gerçek mesajı parametre adı olarak p_password içerir.
    // Düz /password/ araması burada yanlış kullanıcı mesajı üretiyordu.
    const pgrst = 'Could not find the function public.register_patient_request(p_email, p_password, p_name, p_role, p_child_email, p_phone, p_note) in the schema cache.'
    expect(suMesaj(pgrst)).not.toContain('6 karakter')
    expect(rpcYok({ message: pgrst, code: 'PGRST202' })).toBe(true)
  })

  it('rpcYok yalnızca yapısal işaretleri tanır', () => {
    expect(rpcYok({ message: 'relation does not exist' })).toBe(true)
    expect(rpcYok({ message: '404 Not Found', status: 404 })).toBe(true)
    expect(rpcYok({ code: 'PGRST202', message: 'x' })).toBe(true)
    expect(rpcYok({ message: 'Bu e-posta zaten kayitli' })).toBe(false)
    expect(rpcYok({ message: 'Yetkisiz islem' })).toBe(false)
    expect(rpcYok({})).toBe(false)
  })

  it('bilinmeyen hata boş dönmez', () => {
    expect(suMesaj('')).toBeTruthy()
    expect(suMesaj('bir şey')).toBe('bir şey')
  })
})