// Hekim diş editörü — 3B modelde seçilen diş için bilgi girişi.
// svg-grafik: yok (yalnızca ikon kullanır).
import { useEffect, useRef, useState } from 'react'
import { Tooth3D } from './Tooth3D.jsx'
import { DURUM_RENK } from './Tooth3D.jsx'
import { STATUS_TR } from '../data/teeth.js'
import { disBilgisi, disEgitimi, kontrolAraligi } from '../data/disAdlari.js'
import { saveTooth } from '../services/db.js'
import { Tooth, Save, CheckCircle, Sparkle, RefreshCw, Microscope } from './Icons.jsx'

/** Tedavi için hızlı seçenekler — hekim tek tıkla doldurur */
export const TEDAVI_SABLON = [
  'Kontrol - sorun yok',
  'Dolgu - kompozit',
  'Dolgu - amalgam',
  'Kanal tedavisi',
  'Kaplama - porselen',
  'Kaplama - zirkonyum',
  'İmplant - titanyum',
  'Diş taşı temizliği',
  'Diş beyazlatma',
  'Gülüş tasarımı',
  'Ortodontik tedavi',
  'Çekim - gerekli',
  'Sehv düzeltme'
]

export function DisEditor({ pid, teeth, selected, onSelect, onKaydedildi, mesajGoster }) {
  const b = disBilgisi(selected)
  const kayit = teeth?.[selected] || {}

  const [status, setStatus] = useState(kayit.status || 'saglam')
  const [treatment, setTreatment] = useState(kayit.treatment && kayit.treatment !== '-' ? kayit.treatment : '')
  const [note, setNote] = useState(kayit.doctorNote || '')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [mesaj, setMesaj] = useState('')

  // Yalnızca başka diş seçilirse alanlar sıfırlanır.
  // teeth değiştiğinde (kayıt sonrası) mesajın silinmemesi için
  // sıfırlama bilinçli olarak selected'a bağlıdır.
  const sonraki = useRef(selected)
  useEffect(() => {
    if (sonraki.current !== selected) {
      sonraki.current = selected
      const k = teeth?.[selected] || {}
      setStatus(k.status || 'saglam')
      setTreatment(k.treatment && k.treatment !== '-' ? k.treatment : '')
      setNote(k.doctorNote || '')
      setMesaj('')
    }
  }, [selected, teeth])

  if (!b) return null

  const aralik = kontrolAraligi(status)
  const degisti = status !== (kayit.status || 'saglam')
    || treatment !== (kayit.treatment && kayit.treatment !== '-' ? kayit.treatment : '')
    || note !== (kayit.doctorNote || '')

  const kaydet = async () => {
    setKaydediliyor(true)
    setMesaj('')
    await saveTooth(pid, selected, {
      status,
      treatment: treatment || '-',
      doctorNote: note
    })
    setKaydediliyor(false)
    setMesaj(`${selected} nolu diş kaydedildi.`)
    mesajGoster?.(`${selected} nolu diş kaydedildi.`)
    onKaydedildi?.()
  }

  return (
    <div className="dis-editor">
      <div className="dis-editor-bas">
        <span className="dis-editor-no">{selected}</span>
        <span className="dis-editor-ad">{b.tamAd}</span>
        <span className="dis-editor-tip">{b.tip.ad}</span>
      </div>

      <div className="dis-editor-izgara">
        <label>
          Durum
          <div className="dis-durum-secim">
            {Object.entries(STATUS_TR).map(([k, ad]) => {
              const r = DURUM_RENK[k]
              return (
                <button
                  key={k}
                  type="button"
                  className={'dis-durum-dugme' + (status === k ? ' secili' : '')}
                  onClick={() => setStatus(k)}
                  aria-pressed={status === k}
                >
                  <i style={{ background: r.koyu, borderColor: r.kenar }} />
                  {ad}
                </button>
              )
            })}
          </div>
        </label>

        <label>
          Yapılan Tedavi
          <input
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            placeholder="örn. Kompozit dolgu"
            list="tedavi-sablonlari"
          />
          <datalist id="tedavi-sablonlari">
            {TEDAVI_SABLON.map((t) => <option key={t} value={t} />)}
          </datalist>
        </label>

        <label>
          Teşhis / Açıklama
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`${selected} nolu diş için muayene bulgusu...`}
          />
        </label>
      </div>

      <div className="dis-hizli">
        {TEDAVI_SABLON.slice(0, 6).map((t) => (
          <button key={t} type="button" onClick={() => setTreatment(t)}>{t}</button>
        ))}
      </div>

      <div className="dis-editor-alt">
        <button onClick={kaydet} disabled={kaydediliyor || !degisti}>
          <Save size={15} />
          {kaydediliyor ? 'Kaydediliyor...' : degisti ? 'Diş Kaydını Kaydet' : 'Değişiklik yok'}
        </button>
        <button
          className="ghost"
          onClick={() => {
            setStatus('saglam'); setTreatment(''); setNote('')
          }}
        >
          <RefreshCw size={14} /> Temizle
        </button>
        {mesaj && <span className="msg ok"><CheckCircle size={14} /> {mesaj}</span>}
      </div>

      <div className="dis-editor-bilgi">
        <p className="muted"><Sparkle size={13} /> {disEgitimi(selected, status)}</p>
        <p className="muted"><Microscope size={13} /> Önerilen kontrol aralığı: <b>{aralik.metin}</b></p>
        <p className="muted"><Tooth size={13} /> Yüzeyler: {b.tip.yuzey.join(' · ')}</p>
      </div>
    </div>
  )
}

/** Hekim için hazır 3B harita + editör */
export function Dis3DHekim({ pid, teeth, selected, onSelect, onKaydedildi, mesajGoster, digerTab, digerTeeth }) {
  return (
    <div>
      <Tooth3D
        teeth={teeth}
        selected={selected}
        onSelect={onSelect}
        digerTab={digerTab}
        digerTeeth={digerTeeth}
        baslik="Hekim diş haritası"
      />
      <DisEditor
        pid={pid}
        teeth={teeth}
        selected={selected}
        onSelect={onSelect}
        onKaydedildi={onKaydedildi}
        mesajGoster={mesajGoster}
      />
    </div>
  )
}