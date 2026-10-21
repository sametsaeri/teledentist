// svg-grafik: 3B diş modeli görselleştirmesidir; ikon değildir.
//
// Bu bileşen gerçek CSS 3B dönüşümleri (translate3d / rotate3d) kullanır.
// Harici kütüphane yoktur, bu yüzden bütçe 0 kalır ve site hızlı açılır.
//
// Özellikler:
//   - Diş kemiği yay şeklinde, her diş yayın teğetine göre döner (gerçek 3B)
//   - Fareyle sürükleyerek modeli döndürme, tekerlekle yakınlaştırma
//   - Üzerine gelince diş öne çıkar ve bilgi kartı belirir
//   - Dikkat gerektiren dişler nabız gibi atar
//   - Sürekli, çok yavaş otomatik dönüş (kapatılabilir)
//   - Durumuna göre renklenen, tiplerine göre farklı şekillerde dişler
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UST_SIRA, ALT_SIRA, disBilgisi, disEgitimi, kontrolAraligi } from '../data/disAdlari.js'
import { Clock } from './Icons.jsx'

/* ------------------------------------------------------------------ */
/*  Diş şekilleri — her tip için gerçekçi taç silueti                   */
/* ------------------------------------------------------------------ */
const SEKIL = {
  // Kesici: düz kesici kenar, hafif yuvarlatılmış köşeler
  kesici: (a) => `M${a * 0.18} ${a * 0.08}
    Q${a * 0.5} ${-a * 0.05} ${a * 0.82} ${a * 0.08}
    Q${a} ${a * 0.16} ${a} ${a * 0.42}
    L${a} ${a * 0.74}
    Q${a} ${a * 0.93} ${a * 0.82} ${a}
    L${a * 0.18} ${a}
    Q0 ${a * 0.93} 0 ${a * 0.74}
    L0 ${a * 0.42}
    Q0 ${a * 0.16} ${a * 0.18} ${a * 0.08} Z`,

  // Köpek: sivri tepe ucu
  kanin: (a) => `M${a * 0.2} ${a * 0.08}
    Q${a * 0.5} ${-a * 0.16} ${a * 0.8} ${a * 0.08}
    Q${a} ${a * 0.16} ${a} ${a * 0.44}
    L${a} ${a * 0.74}
    Q${a} ${a * 0.93} ${a * 0.82} ${a}
    L${a * 0.18} ${a}
    Q0 ${a * 0.93} 0 ${a * 0.74}
    L0 ${a * 0.44}
    Q0 ${a * 0.16} ${a * 0.2} ${a * 0.08} Z`,

  // Küçük azı: iki köşe
  kucukAzi: (a) => `M${a * 0.18} ${a * 0.1}
    Q${a * 0.32} ${-a * 0.1} ${a * 0.5} ${a * 0.04}
    Q${a * 0.68} ${-a * 0.1} ${a * 0.82} ${a * 0.1}
    Q${a} ${a * 0.18} ${a} ${a * 0.46}
    L${a} ${a * 0.74}
    Q${a} ${a * 0.93} ${a * 0.82} ${a}
    L${a * 0.18} ${a}
    Q0 ${a * 0.93} 0 ${a * 0.74}
    L0 ${a * 0.46}
    Q0 ${a * 0.18} ${a * 0.18} ${a * 0.1} Z`,

  // Büyük azı: dört köşe, ortada oluk
  buyukAzi: (a) => `M${a * 0.12} ${a * 0.12}
    Q${a * 0.26} ${-a * 0.12} ${a * 0.42} ${a * 0.02}
    Q${a * 0.5} ${a * 0.1} ${a * 0.58} ${a * 0.02}
    Q${a * 0.74} ${-a * 0.12} ${a * 0.88} ${a * 0.12}
    Q${a} ${a * 0.2} ${a} ${a * 0.48}
    L${a} ${a * 0.74}
    Q${a} ${a * 0.93} ${a * 0.84} ${a}
    L${a * 0.16} ${a}
    Q0 ${a * 0.93} 0 ${a * 0.74}
    L0 ${a * 0.48}
    Q0 ${a * 0.2} ${a * 0.12} ${a * 0.12} Z`
}

/** Dişin SVG'si — tıbbi görünüm (duyarlı dolgu, parlama, oluk) */
function DisCizimi({ tip, no, durum, secili, vurgu, boyut = 74 }) {
  const a = 44
  const cx = a
  const cy = a
  const path = (SEKIL[tip] || SEKIL.kesici)(a)
  const id = `dg${no}`

  return (
    <svg
      className="dis3d-svg"
      width={boyut}
      height={boyut * 1.12}
      viewBox="0 0 88 98"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={id} cx="34%" cy="24%" r="82%">
          <stop offset="0%" stopColor={vurgu ? '#ffffff' : '#fdfefe'} />
          <stop offset="38%" stopColor={durum.ana} />
          <stop offset="78%" stopColor={durum.koyu} />
          <stop offset="100%" stopColor={durum.golge} />
        </radialGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0b3d5f" stopOpacity="0.22" />
        </linearGradient>
      </defs>

      {/* gölge */}
      <ellipse cx={cx} cy={92} rx="26" ry="5" fill="#0b3d5f" opacity="0.16" />

      {/* gövde */}
      <path d={path} fill={`url(#${id})`} stroke={durum.kenar} strokeWidth="1.6" />

      {/* üst parlama — 3B algısını güçlendirir */}
      <path d={path} fill={`url(#${id}g)`} />
      <ellipse cx="30" cy="24" rx="9" ry="13" fill="#ffffff" opacity={vurgu ? 0.85 : 0.55} transform="rotate(-18 30 24)" />

      {/* büyük azıda çiğneme olukları */}
      {(tip === 'buyukAzi' || tip === 'kucukAzi') && (
        <>
          <path d="M30 16 Q44 12 58 16" stroke={durum.golge} strokeWidth="1.5" fill="none" opacity="0.5" />
          <path d="M30 22 Q44 18 58 22" stroke={durum.golge} strokeWidth="1.2" fill="none" opacity="0.35" />
        </>
      )}
      {/* köpek dişte sivre uç parlaması */}
      {tip === 'kanin' && <circle cx="44" cy="12" r="3.2" fill="#ffffff" opacity="0.6" />}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Seçili dişin özeti (dokunmatik/klavye ile seçim sonrası görünür)    */
/* ------------------------------------------------------------------ */
export function DisOzet({ fdi, kayit }) {
  const b = disBilgisi(fdi)
  if (!b) return null
  const status = kayit?.status || 'saglam'
  const renk = DURUM_RENK[status] || DURUM_RENK.saglam
  const aralik = kontrolAraligi(status)

  return (
    <div className="dis-ozet">
      <div className="dis-ozet-gorsel">
        <DisCizimi tip={b.tip.ikon} no={fdi} durum={renk} vurgu boyut={92} />
      </div>
      <div className="dis-ozet-metin">
        <p className="dis-ozet-bas">
          <b>{fdi}</b> <span>{b.tamAd}</span>
          <span className="badge" style={{ background: renk.koyu, borderColor: renk.kenar }}>
            {kayit?.status ? renk.etiket : 'Kayıt yok'}
          </span>
        </p>
        {kayit?.treatment && kayit.treatment !== '-' && (
          <p><strong>Tedavi:</strong> {kayit.treatment}{kayit?.date ? <span className="muted"> · {String(kayit.date).slice(0, 10)}</span> : null}</p>
        )}
        <p><strong>Hekim notu:</strong> {kayit?.doctorNote || 'Henüz not düşülmedi.'}</p>
        <p className="muted"><strong>Bu diş hakkında:</strong> {disEgitimi(fdi, status)}</p>
        <p className="muted"><Clock size={13} /> Önerilen kontrol aralığı: <b>{aralik.metin}</b></p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Durum renkleri                                                     */
/* ------------------------------------------------------------------ */
export const DURUM_RENK = {
  saglam: { ana: '#ffffff', koyu: '#e8f1f7', golge: '#c9dbe7', kenar: '#9dbdd2', etiket: 'Sağlam' },
  dolgu: { ana: '#fde68a', koyu: '#f4c95d', golge: '#d9a520', kenar: '#b8860b', etiket: 'Dolgu' },
  kanal: { ana: '#fecdd3', koyu: '#f9a8b4', golge: '#e46a7c', kenar: '#c2410c', etiket: 'Kanal Tedavili' },
  kaplama: { ana: '#dbeafe', koyu: '#a8ccfb', golge: '#6f9fe0', kenar: '#3b6fc4', etiket: 'Kaplama' },
  takip: { ana: '#ffedd5', koyu: '#fdba74', golge: '#ea9a4d', kenar: '#c2660f', etiket: 'Takipte' },
  cekim: { ana: '#e2e8f0', koyu: '#cbd5e1', golge: '#a8b6c6', kenar: '#8494a8', etiket: 'Çekilmiş' },
  implant: { ana: '#cffafe', koyu: '#8fe0f0', golge: '#4fc3d9', kenar: '#0e7490', etiket: 'İmplant' }
}

/* ------------------------------------------------------------------ */
/*  Yay geometrisi                                                     */
/* ------------------------------------------------------------------ */
/*
  İki deneme yapıldı:
   1) Dairesel yay (R=250, açı 152°)  -> uçlarda komşu dişler 14px
      arayla sıkıştı; dişler üst üste binip tıklanamaz oldu.
   2) Üslü eğri (x = n^1.4)          -> merkezde sıkıştı; 11 ve 21
      numaralı iki kesici diş üst üste düştü.

  Çözüm: yatay yerleşim DOĞRUSAL (tüm dişler eşit aralıklı),
  kemik yayı ise ön-arka derinlik parabolüyle oluşturulur.
  rotateX ile bakıldığında derinlik ekranda dikey bileşene dönüştüğü
  için kemik yine doğru kavis çizer, dişler okunur kalır.
*/
const YAY_SPAN = 262       // yatay yarı genişlik (px)
const YAY_DERINLIK = 100   // ön-arka derinlik (px)
const CENE_ACIKLIK = 132   // çeneler arası dikey mesafe

function disKonumu(fdi) {
  // Alt çene numaraları 31-48 aralığındadır; üst çene 11-28
  const sira = Number(fdi) >= 31 ? ALT_SIRA : UST_SIRA
  const i = sira.indexOf(Number(fdi))
  const b = disBilgisi(fdi)
  if (i < 0 || !b) return null

  const merkez = (sira.length - 1) / 2      // 7.5
  const normalize = (i - merkez) / merkez   // -1 .. 1, doğrusal

  // Doğrusal: her diş eşit aralıkta
  const x = normalize * YAY_SPAN

  // Kemik kavisi: ön dişler en derinde, arka dişler kenarda
  const derinlik = YAY_DERINLIK * (1 - normalize * normalize)
  const z = b.ceneUst ? -derinlik + 20 : derinlik + 20

  // Dikey ayrım: ekranda üst üste binmemeleri için diş yüksekliğinden büyük
  const y = b.ceneUst ? -CENE_ACIKLIK : CENE_ACIKLIK

  // Uç dişler yön doğrultusunda hafifçe döner (3B his)
  const ry = -normalize * 20
  const rx = b.ceneUst ? 12 : -12
  const aci = normalize * 76 // animasyon gecikmesi

  return { x, y, z, ry, rx, aci, tip: b.tip.ikon }
}

/* ------------------------------------------------------------------ */
/*  Bilgi kartı (üzerine gelince)                                    */
/* ------------------------------------------------------------------ */
function DisBilgiKarti({ fdi, teeth, secili }) {
  const b = disBilgisi(fdi)
  if (!b) return null
  const t = teeth?.[fdi] || {}
  const status = t.status || 'saglam'
  const renk = DURUM_RENK[status] || DURUM_RENK.saglam
  const aralik = kontrolAraligi(status)

  return (
    <div className={'dis-bilgi' + (secili ? ' secili' : '')} style={{ '--vurgu': renk.ana }}>
      <div className="dis-bilgi-bas">
        <b>{fdi}</b>
        <span>{b.tamAd}</span>
        {secili && <span className="dis-bilgi-secili-etiket">seçili diş</span>}
      </div>
      <div className="dis-bilgi-durum">
        <span className="dis-durum-nokta" style={{ background: renk.koyu, borderColor: renk.kenar }} />
        {t.status ? renk.etiket : 'Kayıt yok'}
        {t.date && <em> · {String(t.date).slice(0, 10)}</em>}
      </div>
      {t.treatment && t.treatment !== '-' && (
        <p className="dis-bilgi-tedavi"><span>Tedavi:</span> {t.treatment}</p>
      )}
      {t.doctorNote && (
        <p className="dis-bilgi-not"><span>Hekim notu:</span> {t.doctorNote}</p>
      )}
      <p className="dis-bilgi-egitim">{disEgitimi(fdi, status)}</p>
      <div className="dis-bilgi-alt">
        <span>Önerilen kontrol: <b>{aralik.metin}</b></span>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  ANA BİLEŞEN                                                       */
/* ================================================================== */
export function Tooth3D({
  teeth = {},
  selected,
  onSelect,
  onHoverChange,
  autoRotate = true,
  digerTab = null,
  digerTeeth = null,
  baslik = null
}) {
  const [rx, setRx] = useState(24)
  const [ry, setRy] = useState(-14)
  const [oto, setOto] = useState(autoRotate)
  const [fareUstu, setFareUstu] = useState(null)
  const [yaklaslik, setYaklaslik] = useState(1)
  const [kaydiriliyor, setKaydiriliyor] = useState(false)
  const sahneRef = useRef(null)
  const fsRef = useRef(null)
  const surukleme = useRef({ aktif: false, x: 0, y: 0, baslangicRy: 0, baslangicRx: 0, hareket: 0 })
  const otoRef = useRef(oto)
  otoRef.current = oto

  /* --- otomatik dönüş --- */
  useEffect(() => {
    let raf
    const adim = () => {
      if (otoRef.current && !surukleme.current.aktif) {
        setRy((r) => (r + 0.045) % 360)
      }
      raf = requestAnimationFrame(adim)
    }
    raf = requestAnimationFrame(adim)
    return () => cancelAnimationFrame(raf)
  }, [])

  /* --- fare ile 3B döndürme --- */
  const basla = useCallback((e) => {
    const nokta = e.touches?.[0] || e
    surukleme.current = {
      aktif: true, x: nokta.clientX, y: nokta.clientY,
      baslangicRy: ry, baslangicRx: rx, hareket: 0
    }
    setKaydiriliyor(true)
  }, [ry, rx])

  const tasi = useCallback((e) => {
    if (!surukleme.current.aktif) return
    const nokta = e.touches?.[0] || e
    const dx = nokta.clientX - surukleme.current.x
    const dy = nokta.clientY - surukleme.current.y
    surukleme.current.hareket += Math.abs(dx) + Math.abs(dy)
    setRy(surukleme.current.baslangicRy + dx * 0.42)
    setRx(Math.max(-78, Math.min(80, surukleme.current.baslangicRx + dy * 0.3)))
  }, [])

  const bitir = useCallback(() => {
    surukleme.current.aktif = false
    setKaydiriliyor(false)
  }, [])

  /* tam ekran aç/kapat */
  const toggleFullscreen = useCallback(() => {
    const el = fsRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  /* tekerlek = yakınlaştırma */
  const tekerlek = useCallback((e) => {
    e.preventDefault()
    setYaklaslik((z) => Math.max(0.65, Math.min(1.7, z - e.deltaY * 0.0011)))
  }, [])

  /* klavye erişimi */
  const tusaBas = useCallback((e, fdi) => {
    // sürükleme varken tıklama sayılmasın
    if (surukleme.current.hareket > 8) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(fdi) }
  }, [onSelect])

  const disler = useMemo(() => {
    const hepsi = [...UST_SIRA, ...ALT_SIRA]
    return hepsi.map((fdi) => ({ fdi, ...disKonumu(fdi) })).filter((d) => d.x !== undefined)
  }, [])

  const veriUstu = digerTab === 'ust'
  const veriAlti = digerTab === 'alt'
  const digerDurum = (fdi) => {
    if (!digerTeeth) return null
    return digerTeeth[fdi]?.status || 'saglam'
  }

  const ciz = (d) => {
    const kayit = teeth[d.fdi]
    const status = kayit?.status || 'saglam'
    const renk = DURUM_RENK[status] || DURUM_RENK.saglam
    const bilgi = disBilgisi(d.fdi)
    const aktif = selected === d.fdi
    const uzerinde = fareUstu === d.fdi
    const dikkat = status !== 'saglam'
    // Karşı çenenin dişi vurgulanıyorsa karşı tarafı da işaretle
    const karsiVurgu = (veriUstu && bilgi?.ceneUst) || (veriAlti && !bilgi?.ceneUst)
      ? digerDurum(d.fdi) !== 'saglam'
      : false

    return (
      <button
        key={d.fdi}
        className={[
          'dis3d-dis',
          bilgi?.ceneUst ? 'ust' : 'alt',
          aktif ? 'secili' : '',
          uzerinde ? 'uzerinde' : '',
          dikkat ? 'dikkat' : '',
          karsiVurgu ? 'karsi' : ''
        ].join(' ')}
        style={{
          transform: `translate3d(${d.x}px, ${d.y}px, ${d.z}px) rotateY(${d.ry}deg) rotateX(${d.rx}deg) scale(${aktif ? 1.22 : uzerinde ? 1.12 : 1})`,
          '--gecikme': `${Math.abs(d.aci) * 7}ms`,
          '--vurgu-renk': renk.kenar
        }}
        onClick={() => { if (surukleme.current.hareket <= 8) onSelect?.(d.fdi) }}
        onKeyDown={(e) => tusaBas(e, d.fdi)}
        onMouseEnter={() => { setFareUstu(d.fdi); onHoverChange?.(d.fdi) }}
        onMouseLeave={() => { setFareUstu((f) => (f === d.fdi ? null : f)); onHoverChange?.(null) }}
        onFocus={() => { setFareUstu(d.fdi); onHoverChange?.(d.fdi) }}
        onBlur={() => setFareUstu((f) => (f === d.fdi ? null : f))}
        aria-label={`${d.fdi} nolu ${bilgi?.tamAd} — ${renk.etiket}${kayit?.doctorNote ? `. Hekim notu: ${kayit.doctorNote}` : ''}`}
        aria-pressed={aktif}
        title={`${d.fdi} — ${bilgi?.tamAd}`}
      >
        <span className="dis3d-no">{d.fdi}</span>
        <DisCizimi tip={d.tip} no={d.fdi} durum={renk} vurgu={aktif || uzerinde} />
      </button>
    )
  }

  return (
    <div className="dis3d" ref={fsRef}>
      <div className="dis3d-araclar">
        <span className="muted">
          {baslik ? `${baslik} · ` : ''}3B diş modeli — sürükleyerek döndürün, tekerlek veya büyüt/küçült düğmeleriyle yakınlaştırın
        </span>
        <div className="dis3d-arac-dugmeler">
          <button className={oto ? '' : 'ghost'} onClick={() => setOto((o) => !o)} aria-pressed={oto}>
            {oto ? '⏸ Otomatik dönmeyi durdur' : '▶ Otomatik döndür'}
          </button>
          <button className="ghost" onClick={() => setYaklaslik((z) => Math.min(1.7, z + 0.15))} title="Büyüt">
            <span style={{ fontWeight: 'bold' }}>+</span> Büyüt
          </button>
          <button className="ghost" onClick={() => setYaklaslik((z) => Math.max(0.65, z - 0.15))} title="Küçült">
            <span style={{ fontWeight: 'bold' }}>−</span> Küçült
          </button>
          <button className="ghost" onClick={toggleFullscreen} title="Tam boyut ekran">
            Tam Ekran
          </button>
          <button className="ghost" onClick={() => { setRx(24); setRy(-14); setYaklaslik(1) }}>↺ Görünümü sıfırla</button>
        </div>
      </div>

      <div
        className={`dis3d-sahne${kaydiriliyor ? ' kaydiriliyor' : ''}`}
        ref={sahneRef}
        style={{ '--rx': `${rx}deg`, '--ry': `${ry}deg`, '--yaklaslik': yaklaslik }}
        onMouseDown={basla}
        onMouseMove={tasi}
        onMouseUp={bitir}
        onMouseLeave={bitir}
        onTouchStart={basla}
        onTouchMove={tasi}
        onTouchEnd={bitir}
        onWheel={tekerlek}
      >
        {/* ışık halesi — döndükçe yer değiştirir, 3B duygusunu güçlendirir */}
        <div className="dis3d-isik" />

        <div className="dis3d-duklem">
          <div className="dis3d-eksen">
            {disler.map(ciz)}
          </div>
        </div>

        {/* kemik tabanı */}
        <div className="dis3d-kemik dis3d-kemik-ust" />
        <div className="dis3d-kemik dis3d-kemik-alt" />
      </div>

      <div className="dis3d-bilgi-alani">
        {/* Fare üzerinde değilse seçili dişin bilgisi gösterilir;
            böylece bilgi her zaman ekrandadır (dokunmatik ve klavye için). */}
        {fareUstu
          ? <DisBilgiKarti fdi={fareUstu} teeth={teeth} />
          : selected
            ? <DisBilgiKarti fdi={selected} teeth={teeth} secili />
            : (
              <p className="muted dis3d-ipucu">
                Dişlerin üzerine gelerek durumunu ve bilgisini görebilirsiniz. Tıklayarak seçebilirsiniz.
              </p>
            )}
      </div>

      {/* renk açıklaması */}
      <div className="dis3d-efsane">
        {Object.entries(DURUM_RENK).map(([k, v]) => {
          const adet = Object.values(teeth).filter((t) => (t?.status || 'saglam') === k).length
          return (
            <span className="dis3d-efsane-oge" key={k}>
              <i style={{ background: v.koyu, borderColor: v.kenar }} />
              {v.etiket}
              {adet > 0 && <b>{adet}</b>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export { disKonumu, SEKIL, DisCizimi as Dis3DKutu }