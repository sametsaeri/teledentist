// Röntgen / Tıbbi Dosya Arşivi — Tüm Hasta Görselleri (Hekim Paneli)
//
// Tüm hastaların röntgen, tomografi ve tıbbi dosyalarını tek sayfada listeler.
// Özellikler:
//   - Hasta seçimine göre filtreleme
//   - Dosya yükleme (röntgen, tomografi, belge, foto)
//   - Görüntüleme (imzalı URL, 1 saat geçerli)
//   - Arşivleme (pasif kayıt, silmek değil)
//   - Sınıflandırma (radyoloji, tanı raporu, tedavi, vb.)
//   - Ara / arşivi gör seçeneği
//
// Veri kaybı kuralı: Supabase yoksa tarayıcıya düşer, hiçbir dosya silinmez.
import { useEffect, useMemo, useState } from 'react'
import {
  uploadFile, listMedicalFiles, listAllMedicalFiles, deleteMedicalFile, setFileArsiv, setFileCategory, fileUrl
} from '../services/db.js'
import { getSession, load, save, keys } from '../services/store.js'
import { listPatients } from '../services/db.js'
import { bakimKontrol } from '../services/bakim.js'

/** Bir dosyayı Data URL'ye çevirir (yükleme için). */
function dosyayiOku(seciliDosya) {
  return new Promise((coz, reddet) => {
    const r = new FileReader()
    r.onload = () => coz(r.result)
    r.onerror = () => reddet(new Error('Dosya okunamadı.'))
    r.readAsDataURL(seciliDosya)
  })
}
import {
  Box, Camera, Search, Alert, CheckCircle, Clock, Trash, ChevronRight, User, X
} from '../components/Icons.jsx'

export const KATEGORILER = [
  { id: 'radyoloji', ad: 'Radyoloji (Röntgen / Tomografi)' },
  { id: 'tani', ad: 'Tanı Raporu' },
  { id: 'tedavi', ad: 'Tedavi Planı / Formu' },
  { id: 'sozelmes', ad: 'Sözlü Onam / Bilgilendirme' },
  { id: 'laboratuvar', ad: 'Laboratuvar / Protez' },
  { id: 'odeme', ad: 'Ödeme / Makbuz' },
  { id: 'kimlik', ad: 'Kimlik / Adres' },
  { id: 'diger', ad: 'Diğer' }
]

const KATEGORI_ADI = Object.fromEntries(KATEGORILER.map((k) => [k.id, k.ad]))

export function RontgenArsivi() {
  const me = getSession()
  const [dosyalar, setDosyalar] = useState([])
  const [hastalar, setHastalar] = useState([])
  const [seciliHasta, setSeciliHasta] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [mesaj, setMesaj] = useState('')
  const [hata, setHata] = useState('')
  const [arsivGoster, setArsivGoster] = useState(false)
  const [onayBekleyen, setOnayBekleyen] = useState(null)
  const [izleme, setIzleme] = useState(null)
  const [ara, setAra] = useState('')
  const [klasor, setKlasor] = useState('tumu')
  const [yeniKlasor, setYeniKlasor] = useState('')
  const [klasorler, setKlasorler] = useState(() => load('td_klasorler', ['genel', 'rontgen', 'tomografi']))
  const [yukleModal, setYukleModal] = useState(false)
  const [yukleForm, setYukleForm] = useState({
    patientId: '', tur: 'xray', tooth: '', category: '', not: ''
  })

  // Hasta listesini yükle
  useEffect(() => {
    listPatients().then((liste) => {
      const hs = liste.filter((u) => u.role === 'hasta' || u.role === 'ebeveyn')
      setHastalar(hs)
      if (hs.length && !seciliHasta) setSeciliHasta(hs[0].id)
    })
  }, [seciliHasta])

  const yenile = () => {
    if (seciliHasta) {
      listMedicalFiles(seciliHasta, { arsiv: arsivGoster, tur: 'xray' }).then(setDosyalar)
    } else {
      listAllMedicalFiles({ arsiv: arsivGoster, tur: 'xray' }).then(setDosyalar)
    }
  }
  useEffect(() => { yenile() }, [seciliHasta, arsivGoster])

  const hastaAd = (pid) => {
    const h = hastalar.find((x) => x.id === pid)
    return h?.name || pid
  }

  const yuke = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const bakimHatasi = bakimKontrol('Dosya yükleme')
    if (bakimHatasi) { setHata(bakimHatasi.error); e.target.value = ''; return }
    if (f.size > 12 * 1024 * 1024) {
      setHata('Dosya çok büyük (en fazla 12 MB).')
      e.target.value = ''
      return
    }
    setYukleniyor(true); setHata(''); setMesaj('')
    try {
      const dataUrl = await dosyayiOku(f)
      const kova = 'xrays'
      const etiket = yukleForm.tooth ? `tooth${yukleForm.tooth}` : 'röntgen'
      const sonuc = await uploadFile(kova, yukleForm.patientId || seciliHasta, etiket, dataUrl, {
        tur: yukleForm.tur,
        tooth: yukleForm.tooth || null,
        category: yukleForm.category || null,
        not: yukleForm.not,
        createdBy: me?.id,
        folder: klasor === 'tumu' ? 'genel' : klasor
      })
      if (sonuc.hata) {
        // Supabase bağlantısı yok — dosya yalnız bu cihazda kalır
        const mevcut = load(keys.medicalFiles, [])
        mevcut.unshift({
          id: `l${Date.now()}`, patient_id: yukleForm.patientId || seciliHasta,
          tur: yukleForm.tur, label: etiket, tooth: yukleForm.tooth || null,
          path: null, img: dataUrl, bucket: kova, arsiv: false,
          category: yukleForm.category || null,
          created_at: new Date().toISOString(),
          olusturan: me?.id,
          not: yukleForm.not || 'Tarayıcıda saklandı (sunucuya ulaşılamadı)'
        })
        save(keys.medicalFiles, mevcut)
        setMesaj('Sunucuya ulaşılamadı; dosya yalnız bu cihazda kaydedildi.')
      } else if (sonuc.kayitYok) {
        // Dosya storage'a yüklendi ama medical_files tablosu yok — yerel kayda düş
        const mevcut = load(keys.medicalFiles, [])
        mevcut.unshift({
          id: `l${Date.now()}`, patient_id: yukleForm.patientId || seciliHasta,
          tur: yukleForm.tur, label: etiket, tooth: yukleForm.tooth || null,
          path: sonuc.path, img: null, bucket: kova, arsiv: false,
          category: yukleForm.category || null,
          created_at: new Date().toISOString(),
          olusturan: me?.id,
          not: yukleForm.not || 'Dosya storage\'da var ancak medical_files kaydı yok. Tablosu kurulmalı.'
        })
        save(keys.medicalFiles, mevcut)
        setMesaj(sonuc.uyari)
      } else {
        setMesaj('Röntgen dosyası yüklendi ve arşive kaydedildi.')
      }
      yenile()
      setYukleModal(false)
      setYukleForm({ patientId: '', tur: 'xray', tooth: '', category: '', not: '' })
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

  const goruntule = async (kayit) => {
    if (kayit.img) { setIzleme({ ...kayit, url: kayit.img }); return }
    const url = await fileUrl(kayit.path)
    if (!url) { setHata('Dosya görüntülenemedi. Bağlantı süresi dolmuş olabilir.'); return }
    setIzleme({ ...kayit, url })
  }

  const klasorOf = (d) => {
    const parcalar = String(d.path || '').split('/')
    return parcalar.length >= 3 ? parcalar[1] : 'genel'
  }
  const q = ara.toLowerCase()
  const liste = useMemo(() => dosyalar.filter((d) => {
    if (klasor !== 'tumu' && klasorOf(d) !== klasor) return false
    if (!q) return true
    return (
      String(d.label).toLowerCase().includes(q) ||
      String(d.category || '').toLowerCase().includes(q) ||
      (KATEGORI_ADI[d.category] || '').toLowerCase().includes(q) ||
      hastaAd(d.patient_id).toLowerCase().includes(q)
    )
  }), [dosyalar, q, hastalar, klasor])

  return (
    <div>
      <div className="panel-hero">
        <div>
          <h1><Box size={24} /> Röntgen ve Tıbbi Dosya Arşivi</h1>
          <p className="muted">
            Tüm röntgen, tomografi ve tıbbi dosyalar burada listelenir.
            Dosya sistemde barındırılır, kayıt tutulur ve görüntülenebilir.
          </p>
        </div>
        <span className="spacer" />
        <button className="btn-new" onClick={() => setYukleModal(true)}>
          <Camera size={16} /> Yeni Röntgen/Dosya Yükle
        </button>
      </div>

      {/* Hasta filtresi */}
      {hastalar.length > 0 && (
        <div className="card toolbar" style={{ marginBottom: 12 }}>
          <span><User size={15} /> Hasta:</span>
          <select value={seciliHasta || ''} onChange={(e) => setSeciliHasta(e.target.value)} style={{ marginLeft: 8, minWidth: 220 }}>
            <option value="">Tüm hastalar</option>
            {hastalar.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <button
            className={`ghost ${arsivGoster ? '' : ''}`}
            onClick={() => setArsivGoster(!arsivGoster)}
          >
            <Clock size={15} /> {arsivGoster ? 'Aktif Dosyalar' : 'Arşivi Gör'}
          </button>
          <input
            className="arsiv-ara"
            placeholder="Dosya, hasta veya kategori ile ara..."
            value={ara}
            onChange={(e) => setAra(e.target.value)}
          />
        </div>
      )}

      {hata && <p className="auth-err"><Alert size={15} /> {hata}</p>}
      {mesaj && <p className="msg ok"><CheckCircle size={15} /> {mesaj}</p>}

      {/* Yükleme formu (modal) */}
      {yukleModal && (
        <div className="modal-backdrop" onClick={() => setYukleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3><Camera size={18} /> Yeni Röntgen / Dosya Yükle</h3>
              <button className="ghost" onClick={() => setYukleModal(false)}><X size={18} /></button>
            </div>
            <div className="grid form-grid">
              <label>Hasta
                <select value={yukleForm.patientId} onChange={(e) => setYukleForm({ ...yukleForm, patientId: e.target.value })}>
                  <option value="">Seçin</option>
                  {hastalar.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </label>
              <label>Tür
                <select value={yukleForm.tur} onChange={(e) => setYukleForm({ ...yukleForm, tur: e.target.value })}>
                  <option value="xray">Röntgen</option>
                  <option value="foto">Fotoğraf</option>
                  <option value="belge">Belge</option>
                </select>
              </label>
              <label>Diş (isteğe bağlı)
                <input value={yukleForm.tooth} onChange={(e) => setYukleForm({ ...yukleForm, tooth: e.target.value })} placeholder="örn: 16" />
              </label>
              <label>Kategori
                <select value={yukleForm.category} onChange={(e) => setYukleForm({ ...yukleForm, category: e.target.value })}>
                  <option value="">Sınıflandırılmamış</option>
                  {KATEGORILER.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
                </select>
              </label>
              <label style={{ gridColumn: '1 / -1' }}>Not<textarea rows="2" value={yukleForm.not} onChange={(e) => setYukleForm({ ...yukleForm, not: e.target.value })} /></label>
              <label style={{ gridColumn: '1 / -1' }}>Dosya
                <input type="file" accept="image/*,application/pdf" onChange={yuke} disabled={yukleniyor} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setYukleModal(false)}>Vazgeç</button>
              <button onClick={() => { setYukleModal(false); setMesaj('Dosya seçildiğinde otomatik yüklenir.') }} disabled={yukleniyor || !yukleForm.patientId}>
                {yukleniyor ? 'Yükleniyor...' : <><Camera size={15} /> Dosya Seçip Yükle</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {liste.length === 0 ? (
        <p className="muted">
          {arsivGoster ? 'Arşivde dosya yok.' : `Henüz ${seciliHasta ? hastaAd(seciliHasta) : 'herhangi bir hasta için'} röntgen dosyası yüklenmedi.`}
        </p>
      ) : (
        <div className="arsiv-liste">
          {liste.map((d) => {
            const h = hastalar.find((x) => x.id === d.patient_id)
            return (
              <div className={`arsiv-satir ${d.arsiv ? 'arsivli' : ''}`} key={d.path || d.id}>
                <div className="arsiv-bilgi">
                  <div>
                    <b>{d.tur === 'xray' ? `Röntgen${d.tooth ? ` — ${d.tooth} nolu diş` : ''}` : d.tur === 'foto' ? 'Fotoğraf' : 'Belge'}</b>
                    <span className="muted">
                      {h?.name || 'Bilinmeyen hasta'} ·
                      {String(d.created_at || '').slice(0, 16).replace('T', ' ')}
                    </span>
                    <span className="badge">{d.boyut ? `${(d.boyut / 1024).toFixed(0)} KB` : ''}</span>
                  </div>
                  <select
                    value={d.category || ''}
                    onChange={(e) => setFileCategory(d, e.target.value).then(() => { setMesaj('Sınıflandırma güncellendi.'); yenile() })}
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
            )
          })}
        </div>
      )}

      {/* Silme onayı */}
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
              <button className="ghost" onClick={() => { arsivle(onayBekleyen, true); setOnayBekleyen(null) }}>
                <Clock size={15} /> Arşivle (önerilen)
              </button>
              <button className="danger-btn" onClick={() => { sil(onayBekleyen); setOnayBekleyen(null) }}>
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
              {izleme.tur === 'xray' ? `Röntgen${izleme.tooth ? ` — ${izleme.tooth} nolu diş` : ''}` : 'Belge'}
            </h3>
            <p className="muted">
              {hastalar.find((x) => x.id === izleme.patient_id)?.name || ''} ·
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

export default RontgenArsivi
