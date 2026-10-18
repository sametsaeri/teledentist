// Hasta paneli zengin modülleri
// Her modül yalnızca hastanın KENDİ verisini gösterir.
// Hekime özel hiçbir alan (ücret, reçete, triyaj skoru vb.) burada yoktur.
//
// svg-grafik: aşağıdaki dairesel göstergeler veri görselleştirmesidir,
// ikon değildir; bu yüzden elle <svg> kullanırlar.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  bakimOnerileri, ACIL, GUNLUK_ADIMLAR, listeyiOku, listeyiYaz
} from '../ai/saglikSkoru.js'
import { HASTALIKLAR } from '../components/AnamnezForm.jsx'
import {
  Sparkle, Alert, CheckCircle, Clipboard, Phone, Clock,
  ChevronRight, Camera, Drop, Shield, Info, Calendar, Video
} from '../components/Icons.jsx'

/* ================================================================== */
/*  1. Diş sağlığı puanı — dairesel gösterge                       */
/* ================================================================== */
export function PuanGostergesi({ puan }) {
  const yaricap = 54
  const cevre = 2 * Math.PI * yaricap
  const dolu = (Math.max(0, Math.min(100, Number(puan.toplam) || 0)) / 100) * cevre
  return (
    <svg className="puan-gosterge" viewBox="0 0 140 140" width="140" height="140" role="img" aria-label={`Diş sağlığı puanı ${puan.toplam} / 100`}>
      <circle cx="70" cy="70" r={yaricap} fill="none" stroke="#e8f0f7" strokeWidth="13" />
      <circle
        cx="70" cy="70" r={yaricap} fill="none"
        stroke={puan.renk} strokeWidth="13" strokeLinecap="round"
        strokeDasharray={`${dolu} ${cevre}`}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="64" textAnchor="middle" className="puan-sayi" fill={puan.renk}>{puan.toplam}</text>
      <text x="70" y="86" textAnchor="middle" className="puan-etiket">{puan.baslik}</text>
    </svg>
  )
}

export function PuanKarti({ puan }) {
  // Veri yokken puan göstermek yanıltıcı olur; gerçek eksik bilgi verilir
  if (!puan.veriVar) {
    return (
      <div className="puan-bos">
        <Sparkle size={30} />
        <b>Henüz puanlanacak veri yok</b>
        <p className="muted">
          Diş sağlığı puanınız; muayene kaydınız, hijyen ölçümünüz ve kaygı testiniz
          oluştukça hesaplanır. İlk adım olarak aşağıdaki üç formu doldurabilirsiniz.
        </p>
        <div className="puan-bos-buton">
          <Link to="/triyaj"><button className="ghost"><Alert size={15} /> Ağrı Anketi</button></Link>
          <Link to="/hijyen"><button className="ghost"><Drop size={15} /> Hijyen Takibi</button></Link>
          <Link to="/anksiyete"><button className="ghost"><Sparkle size={15} /> Kaygı Testi</button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="puan-karti">
      <div className="puan-sol">
        <PuanGostergesi puan={puan} />
        <p className="puan-ozet">{puan.ozet}</p>
        {puan.yas !== null && (
          <p className="muted puan-yas"><Info size={13} /> {puan.yas} yaşındasınız, bu skor yaşa göre değil genel olarak hesaplanır.</p>
        )}
      </div>
      <div className="puan-bolumler">
        {puan.bolumler.map((b) => (
          <div className="puan-bolum" key={b.ad}>
            <div className="puan-bolum-bas">
              <b>{b.ad}</b>
              <span className="puan-bolum-sayi">{b.puan}<i>/{b.azami}</i></span>
            </div>
            <div className="puan-cubuk">
              <span style={{ width: `${(b.puan / b.azami) * 100}%` }} />
            </div>
            <p className="muted">{b.not}</p>
          </div>
        ))}
        {puan.bekleyenFoto > 0 && (
          <p className="muted puan-bekleyen">
            <Camera size={13} /> {puan.bekleyenFoto} fotoğrafınız hekim değerlendirmesi bekliyor.
            Fotoğraflar puanı etkilemez ama yanıt süresini kısaltır.
          </p>
        )}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  2. Günlük ağız bakımı kontrol listesi                            */
/* ================================================================== */
export function GunlukListe({ pid }) {
  const [adimlar, setAdimlar] = useState(() => listeyiOku(pid))
  const tamam = GUNLUK_ADIMLAR.filter((a) => adimlar[a.id]).length
  const oran = Math.round((tamam / GUNLUK_ADIMLAR.length) * 100)

  const degistir = (id) => {
    // Fonksiyonel güncelleme: hızlı arka arkaya tıklamada adım kaybolmaz
    setAdimlar((oncekiler) => {
      const sonraki = { ...oncekiler, [id]: !oncekiler[id] }
      listeyiYaz(pid, sonraki)
      return sonraki
    })
  }

  return (
    <div className="gunluk-liste">
      <div className="liste-ozet">
        <div className="liste-halka">
          <svg viewBox="0 0 44 44" width="44" height="44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#e8f0f7" strokeWidth="5" />
            <circle
              cx="22" cy="22" r="18" fill="none" stroke="#0f9d58" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${(oran / 100) * 113} 113`} transform="rotate(-90 22 22)"
            />
          </svg>
          <span>{tamam}/{GUNLUK_ADIMLAR.length}</span>
        </div>
        <p className="muted">
          {tamam === 0
            ? 'Bugün için henüz bir adım işaretlemediniz.'
            : tamam === GUNLUK_ADIMLAR.length
              ? 'Bugünkü bakımınızı tamamladınız, tebrikler.'
              : `${GUNLUK_ADIMLAR.length - tamam} adım kaldı.`}
        </p>
      </div>
      <div className="liste-adimlar">
        {GUNLUK_ADIMLAR.map((a) => (
          <button
            key={a.id}
            className={`liste-adim ${adimlar[a.id] ? 'bitti' : ''}`}
            onClick={() => degistir(a.id)}
            aria-pressed={!!adimlar[a.id]}
          >
            <span className="liste-kutu">{adimlar[a.id] ? <CheckCircle size={17} /> : <span />}</span>
            {a.ad}
          </button>
        ))}
      </div>
      <p className="muted liste-not">Liste her gün sıfırlanır ve yalnızca bu cihazda saklanır.</p>
    </div>
  )
}

/* ================================================================== */
/*  3. Kişiselleştirilmiş ağız bakımı rehberi                        */
/* ================================================================== */
export function BakimRehberi({ veri }) {
  const oneri = useMemo(() => bakimOnerileri(veri), [veri])
  const [acik, setAcik] = useState(null)

  return (
    <div className="bakim-rehber">
      {oneri.map((o, i) => (
        <div
          key={o.baslik + i}
          className={`bakim-kart ${acik === i ? 'acik' : ''}`}
          onClick={() => setAcik(acik === i ? null : i)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAcik(acik === i ? null : i) } }}
        >
          <div className="bakim-kart-bas">
            <span className={`onem-etiket ${o.onem}`}>{o.onem === 'yuksek' ? 'Öncelikli' : o.onem === 'onemli' ? 'Önemli' : 'Temel'}</span>
            <b>{o.baslik}</b>
            <ChevronRight size={16} className={acik === i ? 'dondur' : ''} />
          </div>
          {acik === i && <p>{o.metin}</p>}
        </div>
      ))}
    </div>
  )
}

/* ================================================================== */
/*  4. Acil durum rehberi                                            */
/* ================================================================== */
export function AcilRehber() {
  const [acik, setAcik] = useState(null)
  const [telefon, setTelefon] = useState(() => {
    try { return localStorage.getItem('td_klinik_tel') || '' } catch { return '' }
  })

  return (
    <div className="acil-rehber">
      <p className="muted acil-giris">
        <Alert size={15} /> Ağrınız başladıysa aşağıdakilerden size en yakın olanı açın.
        Bu bölüm reçete değildir; geçici rahatlama ve doğru adımı göstermek içindir.
      </p>

      <div className="acil-kayit">
        <label className="acil-tel">
          <Phone size={15} /> Kliniğinizin telefonu
          <input
            value={telefon}
            onChange={(e) => {
              setTelefon(e.target.value)
              try { localStorage.setItem('td_klinik_tel', e.target.value) } catch { /* yoksay */ }
            }}
            placeholder="örn: 0462 377 20 00"
            inputMode="tel"
          />
        </label>
        {telefon.replace(/[^\d+]/g, '').length >= 7 && (
          <a className="btn acil-ara" href={`tel:${telefon.replace(/\s/g, '')}`}>
            <Phone size={15} /> Hemen Ara
          </a>
        )}
        <p className="muted">Telefon numarası yalnızca tarayıcınızda saklanır, panele kaydedilmez.</p>
        {telefon && (
          <button className="ghost tiny" onClick={() => { setTelefon(''); try { localStorage.removeItem('td_klinik_tel') } catch { /* yoksay */ } }}>
            Temizle
          </button>
        )}
      </div>

      <div className="acil-liste">
        {ACIL.map((a, i) => (
          <div className={`acil-kart ${acik === i ? 'acik' : ''}`} key={a.ad}>
            <button className="acil-kart-bas" onClick={() => setAcik(acik === i ? null : i)} aria-expanded={acik === i}>
              <span className="acil-no">{i + 1}</span>
              <b>{a.ad}</b>
              <ChevronRight size={16} className={acik === i ? 'dondur' : ''} />
            </button>
            {acik === i && (
              <div className="acil-icerik">
                <p className="acil-belirti"><b>Belirtiler:</b> {a.belirti.join(' · ')}</p>
                <ul className="acil-adim">
                  {a.ilkyardim.map((s, j) => <li key={j}>{s}</li>)}
                </ul>
                <p className="acil-kritik"><Alert size={14} /> {a.acil}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  5. Sağlık geçmişi zaman çizelgesi                                */
/* ================================================================== */
export function GecmisZamanCizelgesi({ appts = [], photos = [], teeth = {} }) {
  const olaylar = useMemo(() => {
    const liste = []
    appts.forEach((a) => {
      if (!a.appt_date) return
      liste.push({
        tarih: a.appt_date,
        baslik: a.status === 'tamamlandı' ? 'Tamamlanan muayene' : 'Randevu',
        detay: a.complaint || (a.is_online ? 'Online görüşme' : 'Klinik ziyareti'),
        tur: a.status === 'tamamlandı' ? 'muayene' : 'randevu'
      })
    })
    photos.forEach((f) => {
      if (!f.created_at) return
      liste.push({
        tarih: String(f.created_at).slice(0, 10),
        baslik: 'Fotoğraf gönderildi',
        detay: f.note || 'Hekim değerlendirmesi bekleniyor',
        tur: 'foto'
      })
    })
    Object.entries(teeth || {}).forEach(([fdi, t]) => {
      if (!t?.date) return
      liste.push({
        tarih: String(t.date).slice(0, 10),
        baslik: `${fdi} nolu diş — ${t.treatment || t.status}`,
        detay: t.doctorNote || 'Hekim kaydı',
        tur: 'dis'
      })
    })
    return liste
      .filter((o) => o.tarih && o.tarih.length >= 10)
      .sort((a, b) => b.tarih.localeCompare(a.tarih))
      .slice(0, 12)
  }, [appts, photos, teeth])

  if (!olaylar.length) {
    return (
      <p className="muted empty-state">
        Henüz geçmiş kaydınız yok. İlk muayeneniz ve gönderdiğiniz fotoğraflar burada kronolojik olarak listelenir.
      </p>
    )
  }

  const nokta = { muayene: '#0f9d58', randevu: '#2f80ed', foto: '#9b51e0', dis: '#f2994a' }

  return (
    <div className="zaman-cizelgesi">
      {olaylar.map((o, i) => (
        <div className="zc-kayit" key={i}>
          <span className="zc-nokta" style={{ background: nokta[o.tur] || '#8ba6bf' }} />
          <div className="zc-icerik">
            <span className="zc-tarih"><Clock size={12} /> {o.tarih}</span>
            <b>{o.baslik}</b>
            <p className="muted">{o.detay}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ================================================================== */
/*  6. Randevu hazırlığı                                             */
/* ================================================================== */

/**
 * Hekimin doldurduğu anamnezin HASTAYA gösterilen özeti.
 *
 * Hastanın veri GİRMEZ; yalnızca hekimin kaydettiği bilgileri okur.
 * Alan yoksa "henüz kaydedilmedi" denir ve form gösterilmez.
 */
export function AnamnezOzet({ kayitlar = [] }) {
  const k = kayitlar[0]
  if (!k) {
    return <p className="muted">Henüz anamnez kaydı yapılmadı. Bir sonraki muayenenizde hekiminiz bu bilgileri dolduracaktır.</p>
  }
  const ad = (id) => HASTALIKLAR.find((h) => h.id === id)?.ad || id
  const sistemik = Array.isArray(k.sistemik) ? k.sistemik : []
  const satirlar = [
    ['Sistemik hastalıklar', sistemik.length ? sistemik.map(ad).join(', ') : 'Belirtilmedi'],
    ['Alerjiler', k.alerjiler || 'Belirtilmedi'],
    ['Kullandığı ilaçlar', k.ilaclar || 'Belirtilmedi'],
    ['Geçmiş hastalıklar', k.gecmis_hastaliklar || 'Belirtilmedi'],
    ['Geçmiş ameliyatlar', k.gecmis_ameliyatlar || 'Belirtilmedi'],
    ['Aile sağlık öyküsü', k.aile_saglik || 'Belirtilmedi']
  ]
  return (
    <div className="anamnez-ozet">
      <p className="muted">
        <Clock size={14} /> Son güncelleme: {String(k.updated_at || k.created_at || '').slice(0, 10)}
      </p>
      <div className="record-grid">
        {satirlar.map(([baslik, deger]) => (
          <div className="record-box" key={baslik}>
            <b>{baslik}</b>
            <p>{deger}</p>
          </div>
        ))}
      </div>
      {k.notlar && (
        <>
          <h4 className="modal-sub"><Clipboard size={15} /> Hekimin notu</h4>
          <p className="muted">{k.notlar}</p>
        </>
      )}
      <p className="muted">
        <Shield size={14} /> Bu kaydı siz doldurmazsınız; hekiminiz muayene sırasında girer.
        Bilgilerinizi değiştirmek isterseniz hekiminize söyleyin.
      </p>
    </div>
  )
}

/* ================================================================== */
/*  7. Randevu hazırlığı                                             */
/* ================================================================== */
export function RandevuHazirligi({ randevu, yas }) {
  if (!randevu) {
    return (
      <div className="hazirlik">
        <p className="muted">Yaklaşan bir randevunuz yok.</p>
        <Link to="/randevu"><button className="btn"><Calendar size={16} /> Randevu İste</button></Link>
      </div>
    )
  }
  const gunler = Math.max(0, Math.floor((new Date(randevu.appt_date) - new Date()) / 86400000))

  const getir = [
    'Kimlik veya TC kimlik numaranız',
    'Kullandığınız ilaçların listesi',
    yas && yas > 60 ? 'Daha önce yapılan kalp, şeker veya tansiyon tedavileriniz' : 'Daha önce yapılan diş tedavileriniz',
    randevu.is_online ? 'Görüşme için telefonunuz ve internetiniz hazır olsun' : 'Randevu saatinizden 10 dakika önce gelin'
  ]

  return (
    <div className="hazirlik">
      <div className="hazirlik-bas">
        <div>
          <b>{randevu.appt_date} {randevu.appt_time ? `· ${randevu.appt_time}` : ''}</b>
          {randevu.complaint && <p className="muted">Şikâyetiniz: {randevu.complaint}</p>}
        </div>
        <span className="badge online">{randevu.is_online ? 'Online görüşme' : 'Klinikte'}</span>
      </div>
      <p className="muted hazirlik-sure">
        <Clock size={14} />
        {gunler > 0 ? <>Randevunuza <b>{gunler} gün</b> kaldı.</> : gunler === 0 ? 'Randevunuz bugün.' : 'Randevu tarihi geçmiş, panelinizden yeni randevu isteyin.'}
      </p>
      <h4 className="modal-sub"><Clipboard size={15} /> Yanınızda bulundurun</h4>
      <ul className="hazirlik-liste">
        {getir.map((g, i) => <li key={i}><CheckCircle size={14} /> {g}</li>)}
      </ul>
      {randevu.is_online && (
        <Link to="/video"><button className="btn"><Video size={16} /> Görüşmeye Gir</button></Link>
      )}
    </div>
  )
}

/* ================================================================== */
/*  7. Başvuru / danışma formu (panel içi, hekime iletilir)          */
/* ================================================================== */
/**
 * Randevu ve görüşme kartı — hastanın paneldeki ANA eylem alanı.
 *
 * NEDEN form yok: Anamnez ve klinik geçmiş hekim tarafından doldurulur.
 * Hasta panelinde veri toplayan boş formlar, veri hiçbir yere ulaşmıyorsa
 * (tarayıcıda kalıyorsa) yanıltıcıdır. Bunun yerine hastanın yapabileceği
 * iki gerçek eylem bırakıldı: randevu almak ve hekimiyle görüşmek.
 */
export function RandevuGorusmeKarti({ sonrakiRandevu }) {
  return (
    <div className="randevu-gorusme">
      <div className="rg-satir">
        <div>
          <b>Randevu almak</b>
          <p className="muted">
            Seçtiğiniz tarih hekiminizce onaylanır; onaylandığında panelde görünür.
          </p>
        </div>
        <Link to="/randevu"><button className="btn-new"><Calendar size={16} /> Randevu İste</button></Link>
      </div>

      <div className="rg-satir">
        <div>
          <b>Hekiminizle görüşmek</b>
          <p className="muted">
            Şikâyet ve sorularınızı yüz yüze anlatın. Acil durumlarda
            hekiminizin sekreterini arayın.
          </p>
        </div>
        <Link to="/video"><button className="btn-new"><Video size={16} /> Görüşme Başlat</button></Link>
      </div>

      {sonrakiRandevu?.appt_date && (
        <p className="muted rg-not">
          <Clock size={14} /> Yaklaşan randevunuz: <b>{String(sonrakiRandevu.appt_date).slice(0, 10)}</b>
          {sonrakiRandevu.appt_time ? ` · ${sonrakiRandevu.appt_time}` : ''}
        </p>
      )}

      <p className="muted rg-not">
        <Shield size={14} /> Geçmiş hastalık bilgilerinizi hekiminiz muayene sırasında sizinle konuşarak kaydeder.
        Siz form doldurmazsınız; bu bilgiler yalnız hekiminiz tarafından girilir.
      </p>
    </div>
  )
}