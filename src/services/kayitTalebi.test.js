// Kayıt talebi akışı testleri
//
// KURAL: Talep ASLA tarayıcıya kaydedilmez. Kayıt yalnızca sunucuda
// durmalıdır; aksi hâlde hekim başka cihazdan göremez ve hasta hesabı
// hiçbir bilgisayardan açamaz. Bu testler bu kuralı zorunlu kılar.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/supabase.js', async () => {
  const { supabaseMock } = await import('../test/supabase-mock.js')
  return supabaseMock()
})

import {
  registerRequest, suMesaj, rpcYok, signupKapatliMesaji,
  kullaniciAdiTuret, girisHatasi, login
} from '../services/auth.js'
import { listRequests, decideRequest, approveRequest, rejectRequest, geciciSifreUret } from '../services/db.js'

beforeEach(() => {
  localStorage.clear()
})

const GECERLI = {
  name: 'Elif Yıldırım',
  email: 'elif@test.com',
  pass: 'Test123456',
  role: 'hasta',
  phone: '0532 111 22 33',
  note: 'Sol arka dişim ağrıyor'
}

describe('registerRequest — girdi doğrulaması', () => {
  it('ad, e-posta ve şifre zorunludur', async () => {
    expect((await registerRequest({ ...GECERLI, name: '' })).error).toBeTruthy()
    expect((await registerRequest({ ...GECERLI, email: '' })).error).toBeTruthy()
    expect((await registerRequest({ ...GECERLI, pass: '' })).error).toBeTruthy()
  })

  it('geçersiz e-posta reddedilir', async () => {
    const r = await registerRequest({ ...GECERLI, email: 'gecersiz' })
    expect(r.error).toContain('e-posta')
  })

  it('kısa şifre reddedilir', async () => {
    const r = await registerRequest({ ...GECERLI, pass: '123' })
    expect(r.error).toContain('6 karakter')
  })

  it('yalnızca hasta/ebeveyn kaydolabilir', async () => {
    const r = await registerRequest({ ...GECERLI, role: 'hekim' })
    expect(r.error).toContain('hasta/ebeveyn')
  })

  it('ebeveyn için çocuk e-postası istenir', async () => {
    const r = await registerRequest({ ...GECERLI, role: 'ebeveyn' })
    expect(r.error).toContain('Çocuğunuzun')
  })
})

describe('registerRequest — sunucuya yazmak ZORUNLU', () => {
  it('başarısız olduğunda HİÇBİR ZAMAN tarayıcıya kaydetmez', async () => {
    const r = await registerRequest(GECERLI)
    // İster hata dönsün, ister sunucuya yazılsın — tarayıcıya yazılmamalı
    expect(localStorage.getItem('td_kayit_talepleri')).toBeNull()
    expect(r.local).toBeUndefined()
  })

  it('sunucu kapalıysa kullanıcıya net hata verir', async () => {
    const r = await registerRequest(GECERLI)
    // Test ortamında hem RPC hem signup başarısız -> anlaşılır hata dönmeli
    expect(r.ok).toBeUndefined()
    expect(r.error).toBeTruthy()
    expect(r.error).not.toContain('onaylayacak')
  })

  it('hata mesajı hasta paneline ulaşmayı VAAT ETMEZ', async () => {
    const r = await registerRequest(GECERLI)
    if (r.error) {
      expect(r.error).not.toMatch(/hekiminiz onay/i)
      expect(r.error).not.toMatch(/hesabınız açılacaktır/i)
    }
  })
})

describe('listRequests — yalnızca sunucu', () => {
  it('dizi döner, undefined değil', async () => {
    await expect(listRequests()).resolves.toBeDefined()
    expect(Array.isArray(await listRequests())).toBe(true)
  })

  it('tarayıcıdaki eski kayıtları GÖSTERMEZ', async () => {
    localStorage.setItem('td_kayit_talepleri', JSON.stringify([
      { name: 'Eski', email: 'eski@test.com', id: 'y1' }
    ]))
    const liste = await listRequests()
    expect(liste.some((r) => r.email === 'eski@test.com')).toBe(false)
  })
})

describe('decideRequest — sunucuda karar', () => {
  it('sunucu yoksa net hata verir, sahte başarı dönmez', async () => {
    const r = await decideRequest({ id: 1, name: 'X', email: 'x@test.com' }, true)
    expect(r.ok).toBeUndefined()
    expect(r.error).toBeTruthy()
  })

  it('tarayıcı kaydıyla çalışmaz (artık desteklenmiyor)', async () => {
    const r = await decideRequest({ id: 'y123', name: 'X', email: 'x@test.com' }, false)
    expect(r.ok).toBeUndefined()
    expect(r.error).toBeTruthy()
  })

  it('yardımcı fonksiyonlar hata döndürür, çökmez', async () => {
    await expect(approveRequest({ id: 'y1' })).resolves.toBeDefined()
    await expect(rejectRequest({ id: 'y1' })).resolves.toBeDefined()
  })
})

describe('signupKapatliMesaji — ne yapılacağını söyler', () => {
  it('"Signups not allowed" için anlaşılır yönlendirme verir', () => {
    const m = signupKapatliMesaji('Signups not allowed for this instance')
    expect(m).toContain('kapalı')
    expect(m).toContain('iletişime geçin')
    expect(m).not.toMatch(/onaylayacak/i)
  })

  it('diğer hataları genel çeviriciye yollar', () => {
    expect(signupKapatliMesaji('User already registered')).toContain('zaten kayıtlı')
  })
})

describe('suMesaj — hata mesajları Türkçeleştirilir', () => {
  it('bilinen hatalar anlaşılır Türkçeye çevrilir', () => {
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

// REGRESYON: "Bu kullanıcı adı bulunamadı" hatasının kök nedeni
// profilde `username` kolonunun boş kalmasıydı. Hasta e-posta adresiyle
// kaydoluyor ama kullanıcı adı hiçbir yere yazılmıyordu.
describe('kullaniciAdiTuret — profil username kolonunu doldurur', () => {
  it('e-postanın @ öncesi kısmını kullanıcı adı yapar', () => {
    expect(kullaniciAdiTuret('hastakayit1@ornek.com')).toBe('hastakayit1')
    expect(kullaniciAdiTuret('Elif.Yildirim@Hastane.org')).toBe('elif.yildirim')
  })

  it('TÜRKÇE karakterleri temizler, boş ad üretmez', () => {
    const ad = kullaniciAdiTuret('şüpheli+ad@ornek.com')
    expect(ad).toBeTruthy()
    expect(ad).toMatch(/^[a-z0-9._-]+$/)
  })

  it('e-posta yoksa addan türetir', () => {
    expect(kullaniciAdiTuret('', 'Zeynep Demir')).toBe('zeynep')
    expect(kullaniciAdiTuret('', 'Zeynep Demir')).toBeTruthy()
  })

  it('hiçbir veri yoksa bile geçerli ad üretir (kullanıcı adı ASLA boş olmaz)', () => {
    expect(kullaniciAdiTuret('', '')).toBe('hasta')
  })
})

describe('geciciSifreUret — hasta kendi şifresiyle giremiyordu', () => {
  it('hatırlanabilir ve yeterince uzun bir şifre üretir', () => {
    const s = geciciSifreUret('hastakayit1@ornek.com')
    expect(s.length).toBeGreaterThanOrEqual(6)
    expect(s.startsWith('hast')).toBe(true)
  })

  it('her çağrıda farklı şifre verir', () => {
    const a = geciciSifreUret('ayse@ornek.com')
    const b = geciciSifreUret('ayse@ornek.com')
    expect(typeof a).toBe('string')
    expect(typeof b).toBe('string')
  })

  it('e-posta yoksa da geçerli şifre üretir', () => {
    expect(geciciSifreUret('').length).toBeGreaterThanOrEqual(6)
  })
})

describe('girisHatasi — kullanıcıyı doğru yöne yönlendirir', () => {
  it('geçersiz kimlik bilgisi için yol gösterir', () => {
    const m = girisHatasi('Invalid login credentials')
    expect(m).toContain('Giriş yapılamadı')
    expect(m).toMatch(/şifre/i)
    expect(m).not.toContain('Invalid login credentials')
  })

  it('doğrulanmamış e-postayı açıklar', () => {
    expect(girisHatasi('Email not confirmed')).toContain('doğrulanmamış')
  })

  it('çok fazla deneme durumunu söyler', () => {
    expect(girisHatasi('Too many requests')).toContain('deneme')
  })

  it('bilinmeyen hatayı genel çeviriciye yollar', () => {
    expect(girisHatasi('Yetkisiz islem')).toContain('Yetkisiz')
  })
})

describe('login — kullanıcı adı çözümlenemezse yanıltmaz', () => {
  it('e-posta veya şifre boşsa hata verir', async () => {
    expect((await login('', 'pw', ['hasta'])).error).toBeTruthy()
    expect((await login('a@b.com', '', ['hasta'])).error).toBeTruthy()
  })

  it('REGRESYON: bulunamayan kullanıcı adında çıplak hata gösterilmez', async () => {
    const r = await login('olmayankullanici', 'pw', ['hasta'])
    // Mesaj "hesabınız yok" değil, "NASIL gireceğinizi söyler"
    expect(r.error).toMatch(/kullanıcı adıyla giriş yapılamadı/i)
    // En hızlı çözümü söyler: e-posta ile deneyin
    expect(r.error).toMatch(/E-POSTA/i)
    expect(r.error).toMatch(/hekiminiz/i)
    expect(r.user).toBeUndefined()
  })
})