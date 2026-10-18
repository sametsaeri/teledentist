// Ön Değerlendirme (Pre-Anamnez) Asistanı — hasta ekranı
//
// Tasarım ilkeleri:
//   1) TEK SEFERDE HEPPSİ SORULMAZ. Her adımda tek konu, sade dil.
//   2) ACİL BAYRAK TESPİTİ HER ADIMDA ÇALIŞIR. Bulunursa süreç durur
//      ve hastaya derhal acil servise gitmesi söylenir.
//   3) TEŞHİS KONULMAZ. Ekranda her yerde "ön değerlendirme" ve
//      "kararı hekiminiz verir" notu vardır.
//   4) VERİ KAYBOLMAZ: her adım otomatik kaydedilir. Kullanıcı kapatırsa
//      kaldığı yerden devam eder.
//   5) "Şimdi değil" seçeneği vardır — hasta zorlanmaz.

import { useEffect, useState } from 'react'
import {
  ADIMLAR, SAGLIK_SECENEKLERI, ALISKANLIK_SORULARI, ILAC_RISKLERI,
  KIRMIZI_BAYRAKLAR, cevabiKaydet, onGorusmeyiTamamla, onGorusmeyiErtele,
  onGorusmeTamamMi, kirmiziBayraklariBul
} from '../services/onGorusme.js'
import { Alert, Check, CheckCircle, ChevronRight, Clock, Shield, Sparkle, X } from './Icons.jsx'

export function OnGorusmeAnamnez({ pid, hekimAdi, zorunlu = false, onBitti, onKapat }) {
  const [adimNo, setAdimNo] = useState(0)
  const [cevaplar, setCevaplar] = useState({})
  const [acil, setAcil] = useState(null)      // bulunan kırmızı bayraklar
  const [tamamlandi, setTamamlandi] = useState(false)

  useEffect(() => {
    setTamamlandi(onGorusmeTamamMi(pid))
  }, [pid])

  const adim = ADIMLAR[adimNo]
  const sonAdim = adimNo >= ADIMLAR.length - 1

  /* --- Yanıtları güncelle + acil kontrol + otomatik kayıt --- */
  const guncelle = (yeni) => {
    const birlestirilmis = { ...cevaplar, ...yeni }
    setCevaplar(birlestirilmis)
    cevabiKaydet(pid, birlestirilmis)
    // ACİL KONTROL: her yanıttan sonra
    const bayraklar = kirmiziBayraklariBul(birlestirilmis)
    if (bayraklar.length) setAcil(bayraklar)
  }

  const cokluDegistir = (alan, id) => {
    const liste = cevaplar[alan] || []
    const yeni = liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]
    // "Hiçbiri yok" seçilirse diğerleri temizlenir (çelişkiyi önler)
    if (id === 'yok') {
      guncelle({ [alan]: yeni.includes('yok') ? ['yok'] : liste.filter((x) => x !== 'yok') })
      return
    }
    guncelle({ [alan]: yeni.filter((x) => x !== 'yok') })
  }

  /* --- ACİL DURUM EKRANI --- */
  if (acil) {
    return (
      <div className="og-acil">
        <div className="og-acil-ikon"><Alert size={28} /></div>
        <h2>Acil durum tespit edildi</h2>
        <p className="og-acil-metin">
          Bildirdiğiniz bulgu <b>acil müdahale gerektirebilir</b>. Bu bir ön
          değerlendirme aracıdır ve tanı koyamaz; ancak bu belirtileri
          <b> geciktirmemeniz</b> önemlidir.
        </p>
        <div className="og-acil-bayraklar">
          {acil.map((b) => (
            <span key={b.id} className="og-acil-etiket"><Alert size={13} /> {b.ad}</span>
          ))}
        </div>
        <div className="og-acil-kutu">
          <b>Lütfen şu anda:</b>
          <ol>
            <li><b>En yakın acil servise gidin</b> veya diş kliniğine yüz yüfe başvurun.</li>
            <li>Bu ekrandaki bilgileriniz hekiminize aktarılacaktır.</li>
            <li>Ağrı kesici kullanmadan önce mutlaka hekiminize danışın.</li>
          </ol>
        </div>
        <p className="og-kural">
          <Alert size={14} /> Zor nefes alma, hızla yayılan yüz/boyun şişliği,
          çene kırığı şüphesi ve durdurulamayan kanama yaşarsanız
          <b> beklemeden</b> acil servise başvurun.
        </p>
        <button onClick={onKapat || (() => onBitti?.('acil'))}>
          <Check size={15} /> Anladım, hekime bildir
        </button>
      </div>
    )
  }

  /* --- TAMAMLANDI EKRANI --- */
  if (tamamlandi) {
    return (
      <div className="og-tamam">
        <div className="og-tamam-ikon"><CheckCircle size={28} /></div>
        <h2>Ön değerlendirmeniz tamamlandı</h2>
        <p className="muted">
          Bilgileriniz hekiminize iletildi. Muayene sırasında hekiminiz bu
          bilgileri kullanacak ve tıbbi değerlendirmeyi kendisi yapacaktır.
        </p>
        <p className="og-disclaimer">
          <Shield size={14} /> Bu bir ön değerlendirmedir; tanı veya reçete içermez.
        </p>
        {onKapat && <button className="ghost" onClick={onKapat}><X size={15} /> Kapat</button>}
      </div>
    )
  }

  /* --- ANA AKIŞ --- */
  const ilerleme = ((adimNo + 1) / ADIMLAR.length) * 100
  const cevapVar = (a) => {
    const v = cevaplar[a.id]
    if (a.tip === 'coklu') return (v || []).length > 0
    if (a.tip === 'uzunmetin') return String(v || '').trim().length > 3
    return !!v
  }

  const ilerleyebilir = cevapVar(adim)

  return (
    <div className="og">
      {/* Başlık */}
      <div className="og-baslik">
        <div>
          <h2><Sparkle size={20} /> Ön Değerlendirme</h2>
          <p className="muted">{adim.baslik}</p>
        </div>
        <span className="og-sayac">{adimNo + 1} / {ADIMLAR.length}</span>
      </div>

      {/* İlerleme çubuğu */}
      <div className="og-ilerleme" role="progressbar" aria-valuenow={adimNo + 1} aria-valuemax={ADIMLAR.length}>
        <span style={{ width: `${ilerleme}%` }} />
      </div>

      {/* Onay mesajı (hekim kabul ettiyse) */}
      {adimNo === 0 && hekimAdi && (
        <p className="og-kabul">
          <CheckCircle size={14} /> {hekimAdi} tarafından başvurunuz onaylanmıştır.
        </p>
      )}

      {/* Soru */}
      <div className="og-soru">
        <p className="og-soru-metin">{adim.soru}</p>
        {adim.yardim && <p className="og-yardim">{adim.yardim}</p>}
      </div>

      {/* Cevap alanı */}
      <div className="og-cevap">
        {adim.tip === 'uzunmetin' && (
          <textarea
            rows={4}
            autoFocus
            value={cevaplar[adim.id] || ''}
            onChange={(e) => guncelle({ [adim.id]: e.target.value })}
            placeholder="Örn: Sol arka dişim ağrıyor"
          />
        )}

        {adim.tip === 'coklu' && adim.id === 'saglik' && (
          <div className="og-secenekler">
            {SAGLIK_SECENEKLERI.map((s) => (
              <button
                key={s.id}
                className={`og-secenek ${(cevaplar.saglik || []).includes(s.id) ? 'secili' : ''}`}
                onClick={() => cokluDegistir('saglik', s.id)}
              >
                {(cevaplar.saglik || []).includes(s.id) && <Check size={14} />}
                {s.ad}
              </button>
            ))}
            {(cevaplar.saglik || []).includes('alerji') && (
              <input
                className="og-alerji"
                value={cevaplar.alerji || ''}
                onChange={(e) => guncelle({ alerji: e.target.value })}
                placeholder="Hangi alerji? (örn: penisilin, lateks)"
              />
            )}
          </div>
        )}

        {adim.tip === 'soru' && adim.id === 'agri' && <AgriSoruular cevaplar={cevaplar} guncelle={guncelle} />}
        {adim.tip === 'soru' && adim.id === 'ilac' && <IlacSorular cevaplar={cevaplar} guncelle={guncelle} />}
        {adim.tip === 'soru' && adim.id === 'bulasici' && <BulasiciSorular cevaplar={cevaplar} guncelle={guncelle} />}

        {adim.tip === 'coklu' && adim.id === 'hijyen' && (
          <div className="og-secenekler">
            {ALISKANLIK_SORULARI.map((s) => (
              <button
                key={s.id}
                className={`og-secenek ${s.riskli ? 'riskli' : ''} ${(cevaplar.hijyen || []).includes(s.id) ? 'secili' : ''}`}
                onClick={() => cokluDegistir('hijyen', s.id)}
              >
                {(cevaplar.hijyen || []).includes(s.id) && <Check size={14} />}
                {s.ad}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ACİL bayrak soruları her adımda sonunda gösterilir */}
      <AcilKontrol cevaplar={cevaplar} guncelle={guncelle} />

      {/* Navigasyon */}
      <div className="og-alt">
        {adimNo > 0 && (
          <button className="ghost" onClick={() => setAdimNo(adimNo - 1)}>Geri</button>
        )}
        <span className="spacer" />
        {!zorunlu && (
          <button className="ghost" onClick={() => { onGorusmeyiErtele(pid); onKapat?.() }}>
            <Clock size={15} /> Şimdi değil
          </button>
        )}
        {sonAdim ? (
          <button
            disabled={!ilerleyebilir}
            onClick={() => {
              const kayit = onGorusmeyiTamamla(pid, {
                tarih: new Date().toLocaleDateString('tr-TR')
              })
              setTamamlandi(true)
              onBitti?.(kayit)
            }}
          ><CheckCircle size={16} /> Tamamla ve hekime gönder</button>
        ) : (
          <button disabled={!ilerleyebilir} onClick={() => setAdimNo(adimNo + 1)}>
            Devam <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* Yasal uyarı — her ekranda */}
      <p className="og-disclaimer">
        <Shield size={13} /> Bu bir <b>ön değerlendirmedir</b>. Tanı koymaz ve reçete
        yazmaz; nihai kararı ve tedavi planını diş hekiminiz verir.
      </p>
    </div>
  )
}

/* ---------------- Ağrı soruları ---------------- */
function AgriSorular({ cevaplar, guncelle }) {
  const tur = [
    { id: 'zonklayici', ad: 'Zonklayıcı' },
    { id: 'keskin', ad: 'Keskin / bıçak gibi' },
    { id: 'sizi', ad: 'Sızlama / sürekli' },
    { id: 'basi', ad: 'Baş ağrısı gibi basınç' }
  ]
  return (
    <div className="og-grup">
      <div className="og-etiket">Ağrı nasıl hissediliyor?</div>
      <div className="og-secenekler">
        {tur.map((t) => (
          <button
            key={t.id}
            className={`og-secenek ${cevaplar.agri_tur === t.id ? 'secili' : ''}`}
            onClick={() => guncelle({ agri_tur: t.id })}
          >{t.ad}</button>
        ))}
      </div>
      <div className="og-etiket">Ne zaman başladı?</div>
      <div className="og-secenekler">
        {[['bugun', 'Bugün'], ['1-3gun', '1–3 gün'], ['1hafta', '1 hafta+'], ['aylar', 'Aylardır']].map(([id, ad]) => (
          <button
            key={id}
            className={`og-secenek ${cevaplar.agri_sure === id ? 'secili' : ''}`}
            onClick={() => guncelle({ agri_sure: id })}
          >{ad}</button>
        ))}
      </div>
      <div className="og-etiket">Ağrıyı ne tetikliyor?</div>
      <div className="og-secenekler">
        {[['sicak', 'Sıcak'], ['soguk', 'Soğuk'], ['sikma', 'Çiğneme / sıkma'], ['gece', 'Gece'], ['yok', 'Tetikleyen yok']].map(([id, ad]) => (
          <button
            key={id}
            className={`og-secenek ${(cevaplar.agri_tetik || []).includes(id) ? 'secili' : ''}`}
            onClick={() => {
              const l = cevaplar.agri_tetik || []
              guncelle({ agri_tetik: l.includes(id) ? l.filter((x) => x !== id) : [...l.filter((x) => x !== 'yok'), id] })
            }}
          >{ad}</button>
        ))}
      </div>
      <div className="og-etiket">Gece uykunuzu böldü mü?</div>
      <div className="og-secenekler">
        {[['evet', 'Evet'], ['hayir', 'Hayır']].map(([id, ad]) => (
          <button
            key={id}
            className={`og-secenek ${cevaplar.agri_gece === id ? 'secili' : ''}`}
            onClick={() => guncelle({ agri_gece: id })}
          >{ad}</button>
        ))}
      </div>
      <textarea
        rows={2}
        value={cevaplar.agri || ''}
        onChange={(e) => guncelle({ agri: e.target.value })}
        placeholder="Başka bir açıklamanız varsa yazabilirsiniz"
      />
    </div>
  )
}

/* ---------------- İlaç soruları ---------------- */
function IlacSorular({ cevaplar, guncelle }) {
  return (
    <div className="og-grup">
      <div className="og-etiket">Hangi ilaçları kullanıyorsunuz?</div>
      <div className="og-secenekler">
        {ILAC_RISKLERI.map((i) => (
          <button
            key={i.id}
            className={`og-secenek ${i.riskli ? 'riskli' : ''} ${(cevaplar.ilac_isaret || []).includes(i.id) ? 'secili' : ''}`}
            onClick={() => {
              const l = cevaplar.ilac_isaret || []
              guncelle({ ilac_isaret: i.id === 'yok' ? (l.includes('yok') ? [] : ['yok']) : [...l.filter((x) => x !== 'yok'), i.id].filter((x) => !l.includes(x) || x === i.id) })
            }}
          >
            {(cevaplar.ilac_isaret || []).includes(i.id) && <Check size={14} />}
            {i.riskli && <Alert size={12} />}
            {i.ad}
          </button>
        ))}
      </div>
      {(cevaplar.ilac_isaret || []).length > 0 && !(cevaplar.ilac_isaret || []).includes('yok') && (
        <input
          value={cevaplar.ilac_not || ''}
          onChange={(e) => guncelle({ ilac_not: e.target.value })}
          placeholder="İlaç isimleri (örn: Coumadin 5mg, Metformin)"
        />
      )}
      <p className="og-ipucu">
        <Alert size={13} /> Kan sulandırıcı ve kemik ilacı (bisfosfonat) kullanıyorsanız
        mutlaka belirtin — diş çekimi ve implant öncesi önemlidir.
      </p>
    </div>
  )
}

/* ---------------- Bulaşıcı hastalık soruları ---------------- */
function BulasiciSorular({ cevaplar, guncelle }) {
  return (
    <div className="og-grup">
      <div className="og-secenekler">
        {[['yok', 'Bilinen bulaşıcı hastalık yok'], ['gecmis', 'Geçmişte oldu, tedavi aldım'], ['var', 'Şu anda devam ediyor']].map(([id, ad]) => (
          <button
            key={id}
            className={`og-secenek ${id === 'var' ? 'riskli' : ''} ${cevaplar.bulasici_durum === id ? 'secili' : ''}`}
            onClick={() => guncelle({ bulasici_durum: id })}
          >{ad}</button>
        ))}
      </div>
      {cevaplar.bulasici_durum && cevaplar.bulasici_durum !== 'yok' && (
        <input
          value={cevaplar.bulasici || ''}
          onChange={(e) => guncelle({ bulasici: e.target.value })}
          placeholder="Hangi durum? (örn: Hepatit B)"
        />
      )}
      <p className="og-ipucu">
        <Alert size={13} /> Bu bilgi tedavi planını doğrudan etkiler; paylaşmanız
        tedavinizin güvenliği için önemlidir.
      </p>
    </div>
  )
}

/* ---------------- Acil kontrol (her adımda) ---------------- */
function AcilKontrol({ cevaplar, guncelle }) {
  const [acik, setAcik] = useState(false)
  if (!acik) {
    return (
      <button className="og-acil-ac" onClick={() => setAcik(true)}>
        <Alert size={13} /> Acil bir durumunuz mu var? Tıklayıp kontrol edin.
      </button>
    )
  }
  return (
    <div className="og-acil-kontrol">
      <p className="og-etiket">Aşağıdakilerden biri varsa hemen belirtin:</p>
      {KIRMIZI_BAYRAKLAR.map((b) => (
        <button
          key={b.id}
          className={`og-secenek tehlike ${cevaplar[b.id] ? 'secili tehlike-secili' : ''}`}
          onClick={() => guncelle({ [b.id]: cevaplar[b.id] ? false : true })}
        >
          {cevaplar[b.id] ? <Alert size={14} /> : <span className="og-bos-kutu" />}
          {b.soru}
        </button>
      ))}
      <button className="ghost tiny" onClick={() => setAcik(false)}>Kontrolü kapat</button>
    </div>
  )
}

export default OnGorusmeAnamnez