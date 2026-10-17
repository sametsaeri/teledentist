// Hekim anamnez formu — hastanın geçmiş hastalık bilgilerini HEKİM doldurur.
//
// NEDEN ayrı dosya: anamnez klinik verisidir; hasta kendi geçmişini yazmaz,
// hekim muayene sırasında hasta ile konuşarak girer. Bu yüzden form yalnızca
// hekim panelinde görünür ve hasta paneline hiç bağlanmaz.
import { useEffect, useState } from 'react'
import { anamnesisApi } from '../services/db.js'
import { bildirimOlustur } from '../services/bildirim.js'
import { getSession } from '../services/store.js'
import { Save, Clipboard, Alert, Check, Plus, X } from './Icons.jsx'

// Sistemik hastalıklar — diş tedavisini doğrudan etkileyen durumlar.
// `riskli` olanlar tedavi öncesi hekim kararı gerektirir.
export const HASTALIKLAR = [
  { id: 'kalp', ad: 'Kalp hastalığı / kapağı', riskli: true },
  { id: 'kan_sulandirici', ad: 'Kan sulandırıcı kullanımı', riskli: true },
  { id: 'diyabet', ad: 'Diyabet', riskli: true },
  { id: 'hipertansiyon', ad: 'Tansiyon (hipertansiyon)', riskli: true },
  { id: 'astim', ad: 'Astım / KOAH', riskli: false },
  { id: 'tiroid', ad: 'Tiroid hastalığı', riskli: false },
  { id: 'bobrek', ad: 'Böbrek hastalığı / diyaliz', riskli: true },
  { id: 'karaciger', ad: 'Karaciğer hastalığı', riskli: true },
  { id: 'epilepsi', ad: 'Epilepsi', riskli: true },
  { id: 'gebelik', ad: 'Gebelik / emzirme', riskli: true },
  { id: 'alerji', ad: 'İlaç / lateks alerjisi', riskli: true },
  { id: 'kanser', ad: 'Kanser tedavisi / kemoterapi', riskli: true },
  { id: 'immunsupresif', ad: 'Bağışıklığı düşüren durum', riskli: true },
  { id: 'romatizma', ad: 'Romatizma / eklem hastalığı', riskli: false },
  { id: 'beslenme', ad: 'Beslenme bozukluğu', riskli: false },
  { id: 'uyku', ad: 'Uyku apnesi / horlama', riskli: false }
]

const BOS_FORM = {
  sistemik: [],
  alerjiler: '',
  ilaclar: '',
  gecmis_hastaliklar: '',
  gecmis_ameliyatlar: '',
  aile_saglik: '',
  sigara: '',
  alkol: '',
  gebelik_durumu: '',
  aik: '',
  dis_gecmisi: '',
  agri_ozeti: '',
  kullandigi_hekim: '',
  notlar: ''
}

/** Bir anamnez kaydını forma çevirir (eski şema da olsa okunur). */
export function kayittanFormu(kayit) {
  const k = kayit || {}
  const sistemik = Array.isArray(k.sistemik)
    ? k.sistemik
    : typeof k.sistemik === 'string' && k.sistemik
      ? k.sistemik.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  return { ...BOS_FORM, ...k, sistemik }
}

/** Formu sunucu satırına çevirir. */
export function formdanKayit(form, pid) {
  return {
    patient_id: pid,
    sistemik: form.sistemik || [],
    alerjiler: form.alerjiler || '',
    ilaclar: form.ilaclar || '',
    gecmis_hastaliklar: form.gecmis_hastaliklar || '',
    gecmis_ameliyatlar: form.gecmis_ameliyatlar || '',
    aile_saglik: form.aile_saglik || '',
    sigara: form.sigara || '',
    alkol: form.alkol || '',
    gebelik_durumu: form.gebelik_durumu || '',
    aik: form.aik || '',
    dis_gecmisi: form.dis_gecmisi || '',
    agri_ozeti: form.agri_ozeti || '',
    kullandigi_hekim: form.kullandigi_hekim || '',
    notlar: form.notlar || '',
    // critical: hastaya panelde gösterilecek kritik uyarı üretir
    critical: (form.sistemik || []).some((s) => HASTALIKLAR.find((h) => h.id === s)?.riskli),
    doctor_id: getSession()?.id || null,
    updated_at: new Date().toISOString().slice(0, 10)
  }
}

const toggle = (liste, id) =>
  liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]

export function AnamnezForm({ pid, mesajGoster }) {
  const [form, setForm] = useState(BOS_FORM)
  const [kayitlar, setKayitlar] = useState([])
  const [aktifId, setAktifId] = useState(null)
  const [msg, setMsg] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const yukle = () => anamnesisApi.list({ where: { patient_id: pid } }).then((r) => setKayitlar(r || []))
  useEffect(() => { yukle() }, [pid])

  // Kayıt yoksa boş form açılır; varsa en güncel kayıt düzenlenir
  useEffect(() => {
    if (!kayitlar.length) { setForm(BOS_FORM); setAktifId(null); return }
    const son = kayitlar[0]
    setForm(kayittanFormu(son))
    setAktifId(son.id)
  }, [kayitlar])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const kaydet = async () => {
    setKaydediliyor(true); setMsg('')
    const satir = formdanKayit(form, pid)
    const r = aktifId
      ? await anamnesisApi.update(aktifId, satir)
      : await anamnesisApi.insert(satir)
    setKaydediliyor(false)
    if (r.error) { setMsg(r.error); mesajGoster?.(r.error); return }
    const riskli = (form.sistemik || []).filter((s) => HASTALIKLAR.find((h) => h.id === s)?.riskli)
    const metin = riskli.length
      ? `Anamnez kaydedildi. Dikkat: ${riskli.map((s) => HASTALIKLAR.find((h) => h.id === s)?.ad).join(', ')} — tedavi planında dikkat edilmeli.`
      : 'Anamnez kaydedildi.'
    setMsg(metin)
    mesajGoster?.(metin)
    // Kritik durum varsa hekimin kendi paneline bildirim düşsün:
    // bir sonraki hasta için de hatırlatma olur
    if (riskli.length) {
      bildirimOlustur({
        tur: 'anamnez',
        title: `Kritik anamnez kaydedildi — ${riskli.map((s) => HASTALIKLAR.find((h) => h.id === s)?.ad).join(', ')}`,
        body: 'Bu durumlar tedavi planında dikkat gerektirir. Tedavi öncesi gözden geçirin.',
        hastaId: pid,
        onem: 'yuksek'
      })
    }
    yukle()
  }

  const yeniKayit = () => { setForm(BOS_FORM); setAktifId(null); setMsg('') }

  const sil = async (id) => {
    const r = await anamnesisApi.remove(id)
    if (r.error) { setMsg(r.error); return }
    setMsg('Anamnez kaydı silindi.')
    yukle()
  }

  const secili = form.sistemik || []
  const riskliVar = secili.some((s) => HASTALIKLAR.find((h) => h.id === s)?.riskli)

  return (
    <div>
      <div className="grid form-grid">
        <label>Sistemik Hastalıklar
          <span className="muted small">Tedaviyi etkileyen durumları işaretleyin</span>
        </label>
      </div>

      {/* Hastalık kutucukları */}
      <div className="hastalik-listesi">
        {HASTALIKLAR.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`hastalik-chip ${secili.includes(h.id) ? 'secili' : ''} ${h.riskli ? 'riskli' : ''}`}
            onClick={() => setForm({ ...form, sistemik: toggle(secili, h.id) })}
          >
            {h.riskli && <Alert size={12} />}
            {h.ad}
          </button>
        ))}
      </div>

      {riskliVar && (
        <p className="auth-err"><Alert size={15} /> İşaretli durumlar tedavi öncesi hekim değerlendirmesi gerektirir.</p>
      )}

      <div className="grid form-grid">
        <label style={{ gridColumn: '1 / -1' }}>Alerjiler
          <input value={form.alerjiler} onChange={set('alerjiler')} placeholder="örn. Penisilin, lateks, anestezi" />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>Kullandığı İlaçlar
          <input value={form.ilaclar} onChange={set('ilaclar')} placeholder="örn. Coumadin 5mg, Metformin" />
        </label>
        <label>Geçmiş Hastalıklar
          <textarea rows={2} value={form.gecmis_hastaliklar} onChange={set('gecmis_hastaliklar')} placeholder="Geçirdiği hastalıklar ve tarihleri" />
        </label>
        <label>Geçmiş Ameliyatlar
          <textarea rows={2} value={form.gecmis_ameliyatlar} onChange={set('gecmis_ameliyatlar')} placeholder="örn. 2019 appendektomi" />
        </label>
        <label>Aile Sağlık Öyküsü
          <textarea rows={2} value={form.aile_saglik} onChange={set('aile_saglik')} placeholder="Ailede görülen hastalıklar" />
        </label>
        <label>Diş Hekimliği Geçmişi
          <textarea rows={2} value={form.dis_gecmisi} onChange={set('dis_gecmisi')} placeholder="Diş tedavileri, kanal, dolgu, çekim" />
        </label>
        <label>Şikâyeti / Ağrı Özeti
          <textarea rows={2} value={form.agri_ozeti} onChange={set('agri_ozeti')} placeholder="Hastanın şikâyeti, süresi, bölgesi" />
        </label>
        <label>Devam Eden Ağız Bakımı (AİK)
          <input value={form.aik} onChange={set('aik')} placeholder="Ağız bakımı alışkanlıkları" />
        </label>
        <label>Sigara
          <select value={form.sigara} onChange={set('sigara')}>
            <option value="">Seç</option><option value="Yok">Yok</option>
            <option value="Ara sıra">Ara sıra</option><option value="Günlük">Günlük</option>
          </select>
        </label>
        <label>Alkol
          <select value={form.alkol} onChange={set('alkol')}>
            <option value="">Seç</option><option value="Yok">Yok</option>
            <option value="Ara sıra">Ara sıra</option><option value="Düzenli">Düzenli</option>
          </select>
        </label>
        <label>Gebelik Durumu
          <select value={form.gebelik_durumu} onChange={set('gebelik_durumu')}>
            <option value="">Seç</option><option value="Yok">Yok</option>
            <option value="Hamile">Hamile</option><option value="Emzirme">Emzirme</option>
          </select>
        </label>
        <label>Başka Hekimde Tedavi
          <select value={form.kullandigi_hekim} onChange={set('kullandigi_hekim')}>
            <option value="">Seç</option><option value="Yok">Yok</option><option value="Var">Var</option>
          </select>
        </label>
        <label style={{ gridColumn: '1 / -1' }}>Hekim Notu
          <textarea rows={3} value={form.notlar} onChange={set('notlar')} placeholder="Muayene sırasında ek notlar" />
        </label>
      </div>

      <div className="toolbar">
        <button onClick={kaydet} disabled={kaydediliyor}>
          <Save size={15} /> {kaydediliyor ? 'Kaydediliyor...' : aktifId ? 'Anamnezi Güncelle' : 'Anamnezi Kaydet'}
        </button>
        {aktifId && <button className="ghost" onClick={yeniKayit}><Plus size={15} /> Yeni Anamnez Kaydı</button>}
      </div>
      {msg && <p className={riskliVar ? 'auth-err' : 'msg ok'}>{riskliVar ? <Alert size={15} /> : <Check size={15} />} {msg}</p>}

      {/* Kayıt geçmişi */}
      {kayitlar.length > 0 && (
        <>
          <h4 className="modal-sub"><Clipboard size={15} /> Anamnez Kayıt Geçmişi ({kayitlar.length})</h4>
          <div className="kayit-listesi">
            {kayitlar.map((k) => (
              <div className="kayit-satir" key={k.id}>
                <div>
                  <b>{String(k.updated_at || k.created_at || '').slice(0, 10)}</b>
                  {k.critical && <span className="badge warn"><Alert size={12} /> Kritik</span>}
                  {k.sistemik?.length > 0 && <span className="badge">{k.sistemik.length} hastalık</span>}
                </div>
                <span className="muted">{(k.sistemik || []).map((s) => HASTALIKLAR.find((h) => h.id === s)?.ad).filter(Boolean).join(', ') || 'Kayıt yok'}</span>
                <button className="ghost tiny" onClick={() => { setForm(kayittanFormu(k)); setAktifId(k.id); setMsg('') }}>
                  Düzenle
                </button>
                <button className="ghost tiny danger" onClick={() => sil(k.id)}><X size={13} /> Sil</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default AnamnezForm