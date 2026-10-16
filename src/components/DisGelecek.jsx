// DİŞ GELECEĞİ SİMÜLATÖRÜ — animasyonlu görsel bileşen
// svg-grafik: ağız içi diş görselleştirmesidir; ikon değildir.
//
// Piyasadaki "3D gülüş tasarımı" siteleri yalnızca SONUCU gösterir.
// Bu bileşen karşılaştırmayı gösterir: tedavi olmazsam diş nasıl ilerler?
import { useEffect, useMemo, useRef, useState } from 'react'
import { senaryolar, paraTL, maliyetMetni } from '../ai/prognos.js'
import { disBilgisi, UST_SIRA, ALT_SIRA } from '../data/disAdlari.js'

// Geçerli 32 diş (UST_SIRA ve ALT_SIRA zaten doğru FDI sırasıdır).
// Tanımsız numara elenir ki liste hiçbir koşulda çökmesin.
const HEPSIFDI = [...UST_SIRA, ...ALT_SIRA].filter((n) => disBilgisi(n))
import {
  Tooth, Alert, CheckCircle, Clock, Sparkle, TrendingUp, ChevronRight,
  RefreshCw, Info, Shield
} from './Icons.jsx'

/* ------------------------------------------------------------------ */
/*  Ağız içi görünüm — dişin evreye göre değişimi                      */
/* ------------------------------------------------------------------ */
function DisGorsel({ evre, boyut = 180, etiket }) {
  const renkler = [
    { mine: '#fdfefe', golge: '#dfeaf2', mine2: '#f4f9fc' }, // sağlam
    { mine: '#fdf3e3', golge: '#e8d3b0', mine2: '#faf0df' }, // risk
    { mine: '#f6e2c8', golge: '#c9a170', mine2: '#efdcc0' }, // erken çürük
    { mine: '#e9c396', golge: '#a87c4e', mine2: '#e0bb8c' }, // orta
    { mine: '#d9a771', golge: '#8a5a2c', mine2: '#cf9d68' }, // ileri
    { mine: '#c98a5c', golge: '#5c3413', mine2: '#b87c50' } // kritik
  ][Math.max(0, Math.min(5, evre))]

  const oyukluk = [0.0, 0.06, 0.2, 0.42, 0.68, 0.9][Math.max(0, Math.min(5, evre))]
  const koyuluk = [0, 0.25, 0.5, 0.72, 0.88, 1][Math.max(0, Math.min(5, evre))]
  const kırık = evre >= 4
  const id = `gg${boyut}${evre}`

  return (
    <svg
      className="dis-gorsel"
      width={boyut}
      height={boyut * 1.06}
      viewBox="0 0 180 190"
      role="img"
      aria-label={`Dişin görünümü: ${etiket}`}
    >
      <defs>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={renkler.mine} />
          <stop offset="55%" stopColor={renkler.mine2} />
          <stop offset="100%" stopColor={renkler.golge} />
        </linearGradient>
        <radialGradient id={`${id}c`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2b1608" />
          <stop offset="60%" stopColor="#5a3013" />
          <stop offset="100%" stopColor="#8a5a2c" />
        </radialGradient>
        <clipPath id={`${id}k`}>
          <path d="M40 22 Q90 8 140 22 Q152 28 152 44 L150 78 Q146 104 134 128 Q126 150 116 172 Q108 186 90 186 Q72 186 64 172 Q54 150 46 128 Q34 104 30 78 L28 44 Q28 28 40 22 Z" />
        </clipPath>
      </defs>

      {/* diş eti dokusu */}
      <path
        d="M22 30 Q90 6 158 30 L158 58 Q90 44 22 58 Z"
        fill="#f4a7ae" opacity="0.85"
      />
      <path d="M22 30 Q90 6 158 30" stroke="#e08b95" strokeWidth="2.5" fill="none" />

      {/* diş gövdesi */}
      <path
        d="M40 22 Q90 8 140 22 Q152 28 152 44 L150 78 Q146 104 134 128 Q126 150 116 172 Q108 186 90 186 Q72 186 64 172 Q54 150 46 128 Q34 104 30 78 L28 44 Q28 28 40 22 Z"
        fill={`url(#${id}m)`}
        stroke="#9dbdd2"
        strokeWidth="2"
      />

      {/* mine parlaklığı */}
      <ellipse cx="62" cy="52" rx="17" ry="25" fill="#ffffff" opacity="0.45" transform="rotate(-16 62 52)" />

      {/* çürük oyuğu */}
      {evre > 1 && (
        <g clipPath={`url(#${id}k)`}>
          <ellipse
            cx="90" cy="52"
            rx={8 + oyukluk * 46}
            ry={6 + oyukluk * 30}
            fill={`url(#${id}c)`}
            opacity={0.35 + koyuluk * 0.6}
            style={{ transition: 'all .6s cubic-bezier(.34,1.4,.64,1)' }}
          />
          {/* iç koyulaşma */}
          {evre >= 3 && (
            <ellipse
              cx="90" cy="56"
              rx={5 + oyukluk * 22}
              ry={4 + oyukluk * 14}
              fill="#1a0d04"
              opacity="0.75"
              style={{ transition: 'all .6s cubic-bezier(.34,1.4,.64,1)' }}
            />
          )}
          {/* sinire ulaşma */}
          {evre >= 3 && (
            <path d="M90 60 L86 118 L94 118 Z" fill="#6b1a1a" opacity="0.65" />
          )}
        </g>
      )}

      {/* çatlak (kritik evre) */}
      {kırık && (
        <path
          d="M90 20 L84 62 L94 78 L86 104"
          stroke="#5c3413" strokeWidth="2.6" fill="none"
          strokeLinecap="round" opacity="0.85"
        />
      )}

      {/* apse / şişlik */}
      {evre >= 5 && (
        <g className="dis-apse">
          <circle cx="90" cy="120" r="7" fill="#b91c1c" opacity="0.85" />
          <circle cx="90" cy="120" r="13" fill="#b91c1c" opacity="0.25" />
        </g>
      )}

      {/* kök kanalı */}
      {evre >= 2 && (
        <g opacity="0.35" style={{ transition: 'opacity .6s ease' }}>
          <path d="M84 96 L80 168" stroke="#7a5a3a" strokeWidth="3" strokeLinecap="round" />
          <path d="M96 96 L100 168" stroke="#7a5a3a" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Zaman çizgisi                                                      */
/* ------------------------------------------------------------------ */
function ZamanCubugu({ adimlar, aktifIndex }) {
  const enUzun = Math.max(...adimlar.map((a) => a.ay), 1)
  return (
    <div className="sim-zaman">
      {adimlar.map((a, i) => (
        <div className={`sim-zaman-adim${i <= aktifIndex ? ' gecildi' : ''}${i === aktifIndex ? ' aktif' : ''}`} key={i}>
          <span className="sim-zaman-nokta" />
          <span className="sim-zaman-ay">{a.ay === 0 ? 'bugün' : `${a.ay} ay`}</span>
          <span className="sim-zaman-bas">{a.baslik}</span>
        </div>
      ))}
      <div className="sim-zaman-eksen" style={{ '--toplam': enUzun }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Senaryo kartı                                                     */
/* ------------------------------------------------------------------ */
function SenaryoKarti({ s, aktif, onTikla, gecikmeli }) {
  const agirSinif = s.agirPuan >= 60 ? 'yuksek' : s.agirPuan >= 30 ? 'orta' : 'dusuk'
  return (
    <button
      className={`sim-kart${aktif ? ' secili' : ''}${gecikmeli ? ' riskli' : ''}`}
      onClick={onTikla}
      aria-pressed={aktif}
    >
      <div className="sim-kart-bas">
        <b>{s.baslik}</b>
        {s.acilMi && <span className="sim-acil"><Alert size={12} /> dikkat</span>}
      </div>
      <div className="sim-kart-maliyet">
        <span className="sim-maliyet">{maliyetMetni(s.maliyet)}</span>
        <span className="sim-seans">{s.maliyet.seans} seans</span>
      </div>
      <div className="sim-olcumler">
        <span className={`sim-olcum ${agirSinif}`}>
          Ağrı <b>%{s.agirPuan}</b>
        </span>
        <span className="sim-olcum kayip">
          Diş kaybı <b>%{s.kayipRiski}</b>
        </span>
      </div>
    </button>
  )
}

/* ================================================================== */
/*  ANA BİLEŞEN                                                       */
/* ================================================================== */
export function DisGelecekSimulatoru({
  teeth = {}, fdi = 16, plaque, yas,
  hekimModu = false, onSec
}) {
  const b = disBilgisi(fdi)
  const kayit = teeth[fdi] || {}
  const status = kayit.status || 'saglam'

  const veri = useMemo(
    () => senaryolar({ fdi, status, plaque, yas }),
    [fdi, status, plaque, yas]
  )

  const [aktifSenaryo, setAktifSenaryo] = useState(0)
  const [zaman, setZaman] = useState(0)     // ay cinsinden zaman imleci
  const otomatik = useRef(true)

  // Senaryo değişince zaman imleci başa döner
  useEffect(() => { setZaman(0); otomatik.current = true }, [aktifSenaryo, fdi])

  const s = veri.senaryolar[aktifSenaryo]
  const suankiAsama = useMemo(() => {
    let idx = 0
    s.adimlar.forEach((a, i) => { if (a.ay <= zaman) idx = i })
    return idx
  }, [s, zaman])

  const gorunenAsama = s.adimlar[suankiAsama]

  // Zamanı otomatik ilerlet (simülasyonu oynat)
  useEffect(() => {
    const enUzun = Math.max(...s.adimlar.map((a) => a.ay), 1)
    if (!otomatik.current || zaman >= enUzun) return
    const t = setTimeout(() => setZaman((z) => Math.min(enUzun, z + 1)), 900)
    return () => clearTimeout(t)
  }, [zaman, s])

  if (!b) return null

  return (
    <div className="sim">
      <div className="sim-uyari">
        <Shield size={15} />
        <p>
          <b>Bu bir eğitim simülasyonudur, tıbbi tanı değildir.</b>
          Hesaplanan süreçler diş hekimliğinde kabul görmüş klinik ilerleme kurallarına
          dayanır. Gerçek tedavi planınızı hekiminiz belirler.
        </p>
      </div>

      {/* --- diş seçici --- */}
      <div className="sim-dis-sec">
        <span className="muted">Simülasyon yapılacak diş:</span>
        <select
          value={fdi}
          onChange={(e) => {
            const y = Number(e.target.value)
            onSec?.(y)
            setZaman(0)
            setAktifSenaryo(0)
          }}
        >
          {HEPSIFDI.map((n) => {
            const bb = disBilgisi(n)
            const d = kayitDurum(teeth, n)
            return (
              <option key={n} value={n}>
                {n} — {bb?.tamAd}{d ? ` (${d})` : ''}
              </option>
            )
          })}
        </select>
        <span className="sim-dis-ozet">
          {b.tamAd} · <b>{statusEtiket(status)}</b>
          {kayit.treatment && kayit.treatment !== '-' && <> · {kayit.treatment}</>}
        </span>
      </div>

      {/* --- görsel + zaman imleci --- */}
      <div className="sim-gorsel-alani">
        <div className="sim-gorsel-kutu">
          <DisGorsel evre={gorunenAsama.evre} etiket={gorunenAsama.baslik} />
          <div className="sim-asama-etiket">
            <b>{gorunenAsama.baslik}</b>
            <span className="muted">{gorunenAsama.ay === 0 ? 'başlangıç' : `${gorunenAsama.ay}. ay`}</span>
          </div>
        </div>

        <div className="sim-zaman-kutu">
          <div className="sim-zaman-bas">
            <Clock size={15} />
            <span>Zaman: <b>{zaman === 0 ? 'bugün' : `${zaman}. ay`}</b></span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(...s.adimlar.map((a) => a.ay), 1)}
            value={zaman}
            onChange={(e) => { otomatik.current = false; setZaman(Number(e.target.value)) }}
            aria-label="Zaman imleci"
          />
          <ZamanCubugu adimlar={s.adimlar} aktifIndex={suankiAsama} />
          <div className="sim-anlatim">
            <p>{gorunenAsama.anlatim}</p>
            <p className="sim-risk-notu"><Info size={13} /> {gorunenAsama.riskNotu}</p>
          </div>
          <button className="ghost tiny" onClick={() => { otomatik.current = false; setZaman(0) }}>
            <RefreshCw size={13} /> Baştan başlat
          </button>
        </div>
      </div>

      {/* --- senaryo karşılaştırması --- */}
      <h4 className="sim-baslik"><TrendingUp size={15} /> Karşılaştırma — ne olursa ne olur?</h4>
      <div className="sim-senaryolar">
        {veri.senaryolar.map((sc, i) => (
          <SenaryoKarti
            key={i}
            s={sc}
            aktif={i === aktifSenaryo}
            gecikmeli={i > 0}
            onTikla={() => setAktifSenaryo(i)}
          />
        ))}
      </div>

      <div className="sim-ozet">
        <p>
          <b>{s.baslik}:</b> {s.ozet}
        </p>
        <p className="muted">
          Gereken işlemler: <b>{s.isler.join(' → ')}</b> · Toplam <b>{s.maliyet.seans} seans</b> · Yaklaşık süre <b>{s.sure}</b>
        </p>
      </div>

      {hekimModu ? (
        <p className="sim-hekim-not">
          <Sparkle size={14} /> Bu simülasyonu hasta ile birlikte ekrandan inceleyip
          konuşabilirsiniz. Karar ve planlama hekimindir.
        </p>
      ) : (
        <p className="sim-hekim-not">
          <CheckCircle size={14} /> Bu sonuçları hekiminizle görüşün. Karar ve planlama hekiminindir.
        </p>
      )}
    </div>
  )
}

function kayitDurum(teeth, n) {
  const t = teeth[n]
  if (!t?.status || t.status === 'saglam') return ''
  return {
    dolgu: 'dolgu', kanal: 'kanal', kaplama: 'kaplama',
    takip: 'takipte', cekim: 'çekilmiş', implant: 'implant'
  }[t.status] || t.status
}

function statusEtiket(s) {
  return {
    saglam: 'Sağlıklı', dolgu: 'Dolgulu', kanal: 'Kanal tedavili',
    kaplama: 'Kaplamalı', takip: 'Takipte', cekim: 'Çekilmiş', implant: 'İmplantlı'
  }[s] || s
}

export { DisGorsel }