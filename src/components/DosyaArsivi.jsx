// Hasta dosya arşivi — röntgen, belge, foto yükleme / görüntüleme / arşivleme
//
// AMAÇ: Hiçbir görsel veri kaybolmasın.
//   1) Her yüklenen dosyanın KAYDI tutulur (kim, ne zaman, hangi diş)
//   2) Çağrıldığında hekim tüm dosyaları görebilir
//   3) Arşivleme SİLMEK DEĞİLDİR — dosya depolamada kalır
//   4) Silme yalnızca açık onayla ve iki kademeli geri alınabilir
import { useEffect, useState } from 'react'
import {
  uploadFile, listMedicalFiles, deleteMedicalFile, setFileArsiv, setFileCategory, fileUrl
} from '../services/db.js'
import { getSession, load, save, keys } from '../services/store.js'
import { bakimKontrol } from '../services/bakim.js'
import {
  Camera, Save, Trash, Box, Alert, Check, CheckCircle, Clock, ChevronRight, Search
} from './Icons.jsx'

// Belgeler için sınıflandırma — arşivde düzenleme için
export const KATEGORILER = [
  { id: 'radyoloji', ad: 'Radyoloji (röntgen / tomografi)' },
  { id: 'tani', ad: 'Tanı raporu' },
  { id: 'tedavi', ad: 'Tedavi planı / formu' },
  { id: 'sozelmes', ad: 'Sözlü onam / bilgilendirme' },
  { id: 'laboratuvar', ad: 'Laboratuvar / protez' },
  { id: 'odeme', ad: 'Ödeme / makbuz' },
  { id: 'kimlik', ad: 'Kimlik / adres' },
  { id: 'diger', ad: 'Diğer' }
]

const KATEGORI_ADI = Object.fromEntries(KATEGORILER.map((k) => [k.id, k.ad]))

/**
 * Bir dosyayı Data URL'ye çevirir (yükleme için).
 * PDF ve resim dosyalarını destekler.
 */
function dosyayiOku(seciliDosya) {
  return new Promise((coz, reddet) => {
    const r = new FileReader()
    r.onload = () => coz(r.result)
    r.onerror = () => reddet(new Error('Dosya okunamadı.'))
    r.readAsDataURL(seciliDosya)
  })
}

export function DosyaArsivi({ pid, tooth = null, tur = 'xray', baslik = 'Dosyalar' }) {
  const [dosyalar, setDosyalar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [mesaj, setMesaj] = useState('')
  const [hata, setHata] = useState('')
  const [arsivGoster, setArsivGoster] = useState(null) // null = tümü, true = arşiv, false = aktif
  const [onayBekleyen, setOnayBekleyen] = useState(null)
  const [izleme, setIzleme] = useState(null)
  const [ara, setAra] = useState('')
  const [klasor, setKlasor] = useState('tumu')
  const [yeniKlasor, setYeniKlasor] = useState('')
  const [klasorler, setKlasorler] = useState(() => load('td_klasorler', ['genel', 'rontgen', 'tomografi']))

  const yenile = () => listMedicalFiles(pid, { arsiv: arsivGoster }).then(setDosyalar)
  useEffect(() => { yenile() }, [pid, arsivGoster])

  const yuke = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    // Bakımda yazma yapılmaz — veri kaybolmasın
    const bakimHatasi = bakimKontrol('Dosya yükleme')
    if (bakimHatasi) { setHata(bakimHatasi.error); e.target.value = ''; return }
    if (f.size > 12 * 1024 * 1024) {
      setHata('Dosya çok büyük (en fazla 12 MB). Lütfen küçültün.')
      e.target.value = ''
      return
    }

    setYukleniyor(true); setHata(''); setMesaj('')
    try {
      const dataUrl = await dosyayiOku(f)
      const kova = tur === 'xray' ? 'xrays' : tur === 'foto' ? 'photos' : 'belgeler'
      const etiket = tooth ? `tooth${tooth}` : tur
      const sonuc = await uploadFile(kova, pid, etiket, dataUrl, {
        tur,
        tooth,
        category: tur === 'xray' ? 'radyoloji' : null,
        createdBy: getSession()?.id || null,
        folder: klasor === 'tumu' ? 'genel' : klasor
      })

      if (sonuc.hata) {
        // Dosya sunucuya ulaşmadı: tarayıcıya kaydet, KAYBOLMASIN
        const mevcut = load(keys.medicalFiles, [])
        mevcut.unshift({
          id: `l${Date.now()}`, patient_id: pid, tur, label: etiket, tooth,
          path: null, img: dataUrl, bucket: kova, arsiv: false,
          category: tur === 'xray' ? 'radyoloji' : null,
          created_at: new Date().toISOString(),
          olusturan: getSession()?.id || null,
          not: 'Tarayıcıda saklandı (sunucuya ulaşılamadı)'
        })
        save(keys.medicalFiles, mevcut)
        setMesaj('Sunucuya ulaşılamadı; dosya yalnız bu cihazda kaydedildi. Kalıcı olması için bağlantı kurun.')
        yenile()
        return
      }
      if (sonuc.kayitYok) {
        setHata(sonuc.uyari)
      } else {
        setMesaj('Dosya yüklendi ve kaydedildi.')
      }
      yenile()
    } catch (err) {
      setHata('Dosya yüklenemedi: ' + (err?.message || 'bilinmeyen hata'))
    } finally {
      setYukleniyor(false)
      e.target.value = ''
    }
  }

  const sil = async (kayit) => {
    const bakimHatasi = bakimKontrol('Dosya silme')
    if (bakimHatasi) { setHata(bakimHatasi.error); return }
    // Kayıt yoksa (tarayıcı kaydı) sadece yerelden silinir
    if (!kayit.path) {
      save(keys.medicalFiles, load(keys.medicalFiles, []).filter((f) => f.id !== kayit.id))
      setMesaj('Dosya kaydı silindi.')
      setOnayBekleyen(null)
      yenile()
      return
    }
    const r = await deleteMedicalFile(kayit)
    if (r.error) { setHata(r.error); setOnayBekleyen(null); return }
    setMesaj('Dosya kalıcı olarak silindi.')
    setOnayBekleyen(null)
    yenile()
  }

  const arsivle = async (kayit, deger) => {
    const bakimHatasi = bakimKontrol('Arşiv değişikliği')
    if (bakimHatasi) { setHata(bakimHatasi.error); return }
    const r = await setFileArsiv(kayit, deger)
    if (r.error) { setHata(r.error); return }
    setMesaj(deger ? 'Dosya arşive alındı (silinmedi).' : 'Dosya arşivden çıkarıldı.')
    yenile()
  }

  const siniflandir = async (kayit, kategori) => {
    const r = await setFileCategory(kayit, kategori)
    if (r.error) { setHata(r.error); return }
    setMesaj('Sınıflandırma güncellendi.')
    yenile()
  }

  const goruntule = async (kayit) => {
    if (kayit.img) { setIzleme({ ...kayit, url: kayit.img }); return }
    const url = await fileUrl(kayit.path, kayit.bucket)
    if (!url) { setHata('Dosya görüntülenemedi. Bağlantı süresi dolmuş olabilir, tekrar deneyin.'); return }
    setIzleme({ ...kayit, url })
  }

  const klasorOf = (d) => {
    const parcalar = String(d.path || '').split('/')
    return parcalar.length >= 3 ? parcalar[1] : 'genel'
  }
  const q = ara.toLowerCase()
  const liste = dosyalar.filter((d) => {
    if (klasor !== 'tumu' && klasorOf(d) !== klasor) return false
    if (!q) return true
    return (
      String(d.label).toLowerCase().includes(q) ||
      String(d.category || '').toLowerCase().includes(q) ||
      (KATEGORI_ADI[d.category] || '').toLowerCase().includes(q) ||
      String(d.note || d.not || '').toLowerCase().includes(q)
    )
  })

  const toplamBoyut = dosyalar.reduce((s, d) => s + (d.boyut || 0), 0)

  return (
    <div className="arsiv">
      <div className="arsiv-baslik">
        <h4><Box size={16} /> {baslik} ({dosyalar.length})</h4>
        <span className="muted">
          {toplamBoyut > 0 ? `${(toplamBoyut / 1024 / 1024).toFixed(1)} MB · ` : ''}
          {arsivGoster === true ? 'Arşivdeki dosyalar' : arsivGoster === false ? 'Aktif dosyalar' : 'Tüm dosyalar'}
        </span>
      </div>

      {/* Klasör seçici — birden fazla klasöre ayırma */}
      <div className="arsiv-klasorler" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button className={`ghost ${klasor === 'tumu' ? 'active' : ''}`} onClick={() => setKlasor('tumu')}>Tümü</button>
        {klasorler.map((k) => (
          <button key={k} className={`ghost ${klasor === k ? 'active' : ''}`} onClick={() => setKlasor(k)}>{k}</button>
        ))}
        <input
          placeholder="Yeni klasör"
          value={yeniKlasor}
          onChange={(e) => setYeniKlasor(e.target.value)}
          style={{ width: 120 }}
        />
        <button className="ghost" onClick={() => {
          const ad = yeniKlasor.trim()
          if (!ad) return
          if (!klasorler.includes(ad)) {
            const yeni = [...klasorler, ad]
            setKlasorler(yeni)
            save('td_klasorler', yeni)
          }
          setKlasor(ad)
          setYeniKlasor('')
        }}>Klasör Oluştur</button>
      </div>

      {/* Yükleme */}
      <div className="arsiv-yukle">
        <label className="ghost btn-file">
          <Camera size={15} />
          {yukleniyor ? 'Yükleniyor...' : 'Dosya Yükle'}
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={yuke}
            disabled={yukleniyor}
            hidden
          />
        </label>
        <button
          type="button"
          className={`ghost ${arsivGoster === null ? 'active' : ''}`}
          onClick={() => setArsivGoster(null)}
        >
          <Box size={15} /> Tümü
        </button>
        <button
          type="button"
          className={`ghost ${arsivGoster === false ? 'active' : ''}`}
          onClick={() => setArsivGoster(false)}
        >
          <Clock size={15} /> Aktif
        </button>
        <button
          type="button"
          className={`ghost ${arsivGoster === true ? 'active' : ''}`}
          onClick={() => setArsivGoster(true)}
        >
          <Clock size={15} /> Arşiv
        </button>
        <input
          className="arsiv-ara"
          placeholder="Dosyalarda ara..."
          value={ara}
          onChange={(e) => setAra(e.target.value)}
        />
      </div>

      {hata && <p className="auth-err"><Alert size={15} /> {hata}</p>}
      {mesaj && <p className="msg ok"><CheckCircle size={15} /> {mesaj}</p>}

      {liste.length === 0 ? (
        <p className="muted">
          {arsivGoster === true ? 'Arşivde dosya yok.' : 'Henüz dosya yüklenmedi. Röntgen, tomografi veya belge yükleyebilirsiniz.'}
        </p>
      ) : (
        <div className="arsiv-liste">
          {liste.map((d) => (
            <div className={`arsiv-satir ${d.arsiv ? 'arsivli' : ''}`} key={d.path || d.id}>
              <div className="arsiv-bilgi">
                <b>{d.tur === 'xray' ? `Röntgen${d.tooth ? ` — ${d.tooth} nolu diş` : ''}` : d.tur === 'foto' ? 'Fotoğraf' : 'Belge'}</b>
                <span className="muted">
                  {String(d.created_at || '').slice(0, 16).replace('T', ' ')}
                  {d.boyut ? ` · ${(d.boyut / 1024).toFixed(0)} KB` : ''}
                </span>
                <select
                  value={d.category || ''}
                  onChange={(e) => siniflandir(d, e.target.value)}
                >
                  <option value="">Sınıflandırılmamış</option>
                  {KATEGORILER.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
                </select>
              </div>

              <div className="arsiv-eylem">
                <button className="ghost" onClick={() => goruntule(d)}>
                  <Search size={14} /> Görüntüle
                </button>
                <button className="ghost" onClick={() => arsivle(d, !d.arsiv)}>
                  <Clock size={14} /> {d.arsiv ? 'Geri Al' : 'Arşivle'}
                </button>
                <button className="ghost danger" onClick={() => setOnayBekleyen(d)}>
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Silme onayı — iki kademeli, yanlışlıkla silme zorlaştırılır */}
      {onayBekleyen && (
        <div className="modal-backdrop" onClick={() => setOnayBekleyen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3><Alert size={18} /> Dosyayı kalıcı sil</h3>
            <p className="muted">
              Bu işlem geri alınamaz. Silmek yerine <b>arşivlemeyi</b> öneririz —
              arşivlenen dosya depolamada kalır, yalnız aktif listeden çıkar.
            </p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setOnayBekleyen(null)}>Vazgeç</button>
              <button
                className="ghost"
                onClick={async () => { await arsivle(onayBekleyen, true); setOnayBekleyen(null) }}
              ><Clock size={15} /> Arşivle (önerilen)</button>
              <button className="danger-btn" onClick={() => sil(onayBekleyen)}>
                <Trash size={15} /> Kalıcı Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Görüntüleyici */}
      {izleme && (
        <div className="modal-backdrop" onClick={() => setIzleme(null)}>
          <div className="modal modal-gorsel" onClick={(e) => e.stopPropagation()}>
            <h3>
              {izleme.tur === 'xray' ? `Röntgen — ${izleme.tooth} nolu diş` : 'Belge'}
            </h3>
            <p className="muted">
              {String(izleme.created_at || '').slice(0, 16).replace('T', ' ')}
              {izleme.category ? ` · ${KATEGORI_ADI[izleme.category] || izleme.category}` : ''}
            </p>
            {String(izleme.path || '').endsWith('.pdf') ? (
              <iframe src={izleme.url} title="Belge" className="pdf-goster" />
            ) : (
              <img src={izleme.url} alt="röntgen" className="arsiv-gorsel" />
            )}
            <div className="modal-actions">
              <button className="ghost" onClick={() => setIzleme(null)}>Kapat</button>
              <a href={izleme.url} download={izleme.path?.split('/').pop()} target="_blank" rel="noreferrer">
                <button className="ghost"><ChevronRight size={15} /> İndir</button>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DosyaArsivi