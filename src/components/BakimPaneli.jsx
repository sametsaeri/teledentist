// Bakım modu arayüzü — kullanıcıya açıklama, yöneticiler için kontrol paneli
//
// KULLANICI GÖRÜNÜMÜ: Üstte turuncu bant ne olduğunu ve verilerinin güvende
// olduğunu söyler. Panele giriş engellenmez ama yazma işlemleri durdurulur —
// kullanıcı verisini görebilir, yanlışlıkla bozamaz.
//
// YÖNETİCİ GÖRÜNÜMÜ: Süper admin bakımı açıp kapatır, neden ve tahmini süre yazar.
import { useEffect, useState } from 'react'
import {
  bakimDurumu, bakimdaMi, bakimAc, bakimKapat, bakimMesaji, bakimKontrol,
  bakimSenkronla, bakimDurumunuCek, BAKIM_NEDENLER
} from '../services/bakim.js'
import { Wrench, Alert, Check, CheckCircle, Clock, Lock } from './Icons.jsx'

/**
 * Tüm panellerde gösterilen bakım bandı.
 *
 * Sunucudan da kontrol edilir: bakım başka bir cihazda açıldığında
 * bu cihaz da dakikalar içinde öğrenir. Bakımda değilse hiçbir şey
 * basılmaz (DOM'a bile girmemesi tercih edilir).
 */
export function BakimBanti() {
  const [b, setB] = useState(bakimDurumu())

  useEffect(() => {
    let iptal = false
    const kontrol = async () => {
      // Sunucu varsa ondan oku, yoksa tarayıcı kaydını kullan
      const d = await bakimDurumunuCek()
      if (iptal) return
      if (d) { setB(d); return }
      setB(bakimDurumu())
    }
    kontrol()
    // 60 saniyede bir yeniden bak (bakım açılıp kapanabilir)
    const t = setInterval(kontrol, 60000)
    return () => { iptal = true; clearInterval(t) }
  }, [])

  if (!b?.acik) return null

  return (
    <div className="bakim-bant" role="status" aria-live="polite">
      <Wrench size={16} />
      <div>
        <b>Bakımdayız</b>
        <p>{b.aciklama || bakimMesaji()}</p>
        {b.tahmini && <p className="muted">Tahmini bitiş: {b.tahmini}</p>}
        <p className="muted">
          Verileriniz güvende ve kayıt altındadır. Bu süre boyunca yeni kayıt giremiyoruz;
          mevcut bilgilerinize ulaşabilirsiniz.
        </p>
      </div>
    </div>
  )
}

/**
 * Bir yazma işlemi çağrısından önce kullanılır.
 * @returns {string|null} hata mesajı (yazma yapılamıyorsa) veya null
 */
export function bakimEngeli() {
  return bakimKontrol('yazma')?.error || null
}

/**
 * Süper admin bakım paneli.
 * Bakım açıkken uygulamayı kullanılabilir tutar ama veri yazılmasını engeller.
 */
export function BakimPaneli({ rol }) {
  const [b, setB] = useState(bakimDurumu())
  const [neden, setNeden] = useState('planli')
  const [not, setNot] = useState('')
  const [tahmini, setTahmini] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [sunucuda, setSunucuda] = useState(null)

  useEffect(() => {
    let iptal = false
    bakimDurumunuCek().then((d) => {
      if (iptal) return
      // Sunucuda kayıt varsa tüm cihazlar etkilenir
      setSunucuda(!!d)
      if (d) { setB(d); return }
      setB(bakimDurumu())
    })
    return () => { iptal = true }
  }, [])

  if (rol !== 'admin') return null

  const yenile = async () => setB(await bakimSenkronla())

  return (
    <div className="card">
      <h3><Wrench size={18} /> Bakım Modu</h3>
      <p className="muted">
        Bakım modunu açtığınızda tüm panellerde kullanıcıya "bakımdayız" açıklaması
        gösterilir ve <b>veri yazma işlemleri durdurulur</b>. Görüntüleme devam eder;
        hiçbir kayıt silinmez veya bozulmaz.
      </p>

      {b?.acik ? (
        <>
          <div className="bakim-durum acik">
            <Alert size={16} />
            <div>
              <b>Şu an bakım modunda</b>
              <p>{b.aciklama || bakimMesaji()}</p>
              <p className="muted">
                Başlangıç: {String(b.baslangic || '').slice(0, 16).replace('T', ' ')}
                {b.kim ? ` · ${b.kim}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              await bakimKapat({ kim: 'sistem yöneticisi' })
              setMesaj('Bakım kapatıldı. Sistem yeniden hizmet veriyor.')
              yenile()
            }}
          ><CheckCircle size={15} /> Bakımı Bitir</button>
        </>
      ) : (
        <>
          {b?.bitti && (
            <p className="muted">
              Son bakım: {String(b.bitti).slice(0, 16).replace('T', ' ')}
              {b.bittiKim ? ` · ${b.bittiKim}` : ''}
              {b.bitisNotu ? ` — ${b.bitisNotu}` : ''}
            </p>
          )}
          <div className="grid form-grid">
            <label>Bakım nedeni
              <select value={neden} onChange={(e) => setNeden(e.target.value)}>
                {BAKIM_NEDENLER.map((n) => <option key={n.id} value={n.id}>{n.ad}</option>)}
              </select>
            </label>
            <label>Tahmini bitiş (isteğe bağlı)
              <input value={tahmini} onChange={(e) => setTahmini(e.target.value)} placeholder="örn. 18:00" />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>Kullanıcıya gösterilecek açıklama
              <textarea
                rows={2}
                value={not}
                onChange={(e) => setNot(e.target.value)}
                placeholder="Boş bırakırsanız seçili neden için hazır açıklama kullanılır."
              />
            </label>
          </div>
          <button
            onClick={async () => {
              await bakimAc({ neden, not, tahmini, kim: 'sistem yöneticisi' })
              setMesaj('Bakım modu açıldı. Kullanıcılara açıklama gösteriliyor.')
              yenile()
            }}
          ><Wrench size={15} /> Bakım Modunu Aç</button>
        </>
      )}

      {mesaj && <p className="msg ok"><Check size={15} /> {mesaj}</p>}

      <p className="muted bakim-uyari">
        {sunucuda
          ? <><Clock size={14} /> Bakım bilgisi sunucuda saklanıyor — açtığınızda <b>tüm cihazlardaki</b> tüm kullanıcılar bu açıklamayı görür.</>
          : <><Lock size={14} /> Bakım bilgisi şu an bu tarayıcıda saklanıyor. Tüm kullanıcıları aynı anda etkilemek için <b>db/migration_arsiv_kvkk.sql</b> dosyasını çalıştırın.</>}
      </p>
    </div>
  )
}

export default BakimBanti