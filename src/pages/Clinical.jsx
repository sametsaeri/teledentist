import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { STATUS_TR } from '../data/teeth.js'
import { load, save, keys, getSession } from '../services/store.js'
import { triageScore, anxietyLevel, hygieneTip } from '../services/clinical.js'
import { suggestRecall } from '../ai/recall.js'
import { toothEducation } from '../ai/toothAi.js'
import {
  getPatient, getTeeth, listPhotos, insertPhoto, setPhotoNote, uploadImage, signedPhotoUrl,
  insertTriage, insertHygiene, insertAnxiety, listHygiene,
  anamnesisApi, notesApi, listMedicalFiles, listTriage, listAppointments
} from '../services/db.js'
import { HASTALIKLAR } from '../components/AnamnezForm.jsx'

function pid() { return getSession()?.id || '' }

// 1. Triyaj anketi
export function Triage() {
  const [pain, setPain] = useState(5)
  const [swelling, setSwelling] = useState(false)
  const [trauma, setTrauma] = useState(false)
  const [bleeding, setBleeding] = useState(false)
  const [fever, setFever] = useState(false)
  const [tooth, setTooth] = useState('16')
  const [done, setDone] = useState(null)
  const submit = async () => {
    const r = triageScore({ pain, swelling, trauma, bleeding, fever })
    const rec = { id: Date.now(), patientId: pid(), tooth, pain, swelling, trauma, bleeding, fever, ...r, date: new Date().toISOString().slice(0, 16) }
    const list = load(keys.triage, [])
    list.push(rec)
    save(keys.triage, list)
    // Hekimin görebilmesi için sunucuya da yaz
    await insertTriage(pid(), { tooth: String(tooth), pain: Number(pain), swelling, trauma, bleeding, fever, score: r.score, level: r.level })
    setDone(r)
  }
  return (
    <div>
      <h1>Diş Triyaj Anketi</h1>
      <div className="card">
        <label>İlgili diş (FDI): <input value={tooth} onChange={(e) => setTooth(e.target.value)} style={{ width: 70 }} /></label><br /><br />
        <label>Ağrı (0-10): <input type="range" min="0" max="10" value={pain} onChange={(e) => setPain(e.target.value)} /> <b>{pain}</b></label><br />
        <label><input type="checkbox" checked={swelling} onChange={(e) => setSwelling(e.target.checked)} /> Şişlik var</label><br />
        <label><input type="checkbox" checked={trauma} onChange={(e) => setTrauma(e.target.checked)} /> Travma / darbe</label><br />
        <label><input type="checkbox" checked={bleeding} onChange={(e) => setBleeding(e.target.checked)} /> Kanama</label><br />
        <label><input type="checkbox" checked={fever} onChange={(e) => setFever(e.target.checked)} /> Ateş</label><br /><br />
        <button onClick={submit}>Skoru Hesapla ve Kaydet</button>
        {done && <p><span className="badge">{done.level} (skor {done.score})</span></p>}
      </div>
    </div>
  )
}

// 2. Plak ve hijyen takibi
export function Hygiene() {
  const [plaque, setPlaque] = useState(1.5)
  const [brush, setBrush] = useState(2)
  const [done, setDone] = useState(false)
  const [history, setHistory] = useState([])
  const reload = () => { listHygiene(pid()).then(setHistory) }
  useEffect(() => { reload() }, [])
  const submit = async () => {
    const list = load(keys.hygiene, [])
    list.push({ id: Date.now(), patientId: pid(), plaque: Number(plaque), brush: Number(brush), date: new Date().toISOString().slice(0, 10) })
    save(keys.hygiene, list)
    await insertHygiene(pid(), { plaque: Number(plaque), brush: Number(brush) })
    setDone(true)
    reload()
  }
  return (
    <div>
      <h1>Plak ve Hijyen Takibi</h1>
      <div className="card">
        <label>Plak indeksi (0-3): <input type="number" step="0.1" min="0" max="3" value={plaque} onChange={(e) => setPlaque(e.target.value)} /></label><br /><br />
        <label>Günde fırçalama: <input type="number" min="0" max="5" value={brush} onChange={(e) => setBrush(e.target.value)} /></label><br /><br />
        <button onClick={submit}>Kaydet</button>
        {done && <p className="muted">{hygieneTip(Number(plaque), Number(brush))}</p>}
      </div>
      <div className="card">
        <h3>Geçmişim</h3>
        {history.length === 0 && <p className="muted">Kayıt yok.</p>}
        {history.map((h) => (
          <div key={h.id} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
            <span className="muted">{h.date}</span>
            <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 6, height: 12 }}>
              <div style={{ width: `${(h.plaque / 3) * 100}%`, background: h.plaque >= 2 ? '#dc2626' : '#0284c7', height: 12, borderRadius: 6 }} />
            </div>
            <b>{h.plaque}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

// 3. Dental anksiyete ölçeği (MDAS kısa)
const ANX_Q = ['Diş randevusu yarın olsa nasıl hissedersiniz?', 'Bekleme salonunda nasıl hissedersiniz?', 'Diş temizliği sırasında?', 'Dolgu için iğne olurken?', 'Diş çekimi düşününce?']
export function Anxiety() {
  const [ans, setAns] = useState([3, 3, 3, 3, 3])
  const [done, setDone] = useState(null)
  const submit = async () => {
    const total = ans.reduce((a, b) => a + Number(b), 0)
    const list = load(keys.anxiety, [])
    list.push({ id: Date.now(), patientId: pid(), total, date: new Date().toISOString().slice(0, 10) })
    save(keys.anxiety, list)
    await insertAnxiety(pid(), total)
    setDone(total)
  }
  return (
    <div>
      <h1>Dental Anksiyete Ölçeği</h1>
      <div className="card">
        {ANX_Q.map((q, i) => (
          <p key={i}>{q}<br />
            {[1, 2, 3, 4, 5].map((v) => (
              <label key={v} style={{ marginRight: 8 }}><input type="radio" checked={Number(ans[i]) === v} onChange={() => setAns((a) => a.map((x, j) => (j === i ? v : x)))} />{v}</label>
            ))}
          </p>
        ))}
        <button onClick={submit}>Kaydet</button>
        {done && <p><span className="badge">{done} puan - {anxietyLevel(done)}</span></p>}
      </div>
    </div>
  )
}

// 4. Fotoğrafla ön değerlendirme
export function PhotoReview() {
  const me = getSession()
  const [list, setList] = useState([])
  const [img, setImg] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = () => { listPhotos(pid()).then(setList) }
  useEffect(() => { reload() }, [])

  // Kayıt satırındaki dosya için imzalı bağlantı üret
  useEffect(() => {
    let alive = true
    ;(async () => {
      const rows = await listPhotos(pid())
      const withUrls = await Promise.all(rows.map(async (r) => ({
        ...r,
        url: r.path ? await signedPhotoUrl(r.path) : r.img || null
      })))
      if (alive) setList(withUrls)
    })()
    return () => { alive = false }
  }, [])

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setMsg(''); setBusy(true)
    const r = new FileReader()
    r.onload = async () => {
      const dataUrl = r.result
      setImg(dataUrl)
      const up = await uploadImage('photos', pid(), 'foto', dataUrl)
      if (up.error) {
        setBusy(false)
        return setMsg('Yükleme yapılamadı: ' + up.error)
      }
      const ins = await insertPhoto({ patientId: pid(), path: up.path, createdBy: me?.id })
      setBusy(false)
      if (ins.error) return setMsg(ins.error)
      setMsg('Fotoğrafınız hekiminize iletildi.')
      e.target.value = ''
      reload()
    }
    r.readAsDataURL(f)
  }

  return (
    <div>
      <h1>Fotoğrafla Ön Değerlendirme</h1>
      <div className="card">
        <p className="muted">Ağız içi fotoğraf yükleyin, hekiminiz yorumunu yazar.</p>
        <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={busy} />
        {busy && <p className="muted">Yükleniyor...</p>}
        {img && <div><br /><img src={img} alt="ağız" className="xray" /></div>}
        {msg && <p className="muted">{msg}</p>}
      </div>
      {list.length === 0 && <div className="card"><p className="muted">Henüz fotoğraf yüklemediniz.</p></div>}
      {list.map((p) => (
        <div className="card" key={p.id}>
          {p.url
            ? <img src={p.url} alt="ağız" className="xray" />
            : <p className="muted">Görüntü yüklenemedi.</p>}
          <p className="muted">
            {p.created_at ? String(p.created_at).slice(0, 16) : p.date} ·{' '}
            <span className="badge">{p.status === 'degerlendirildi' ? 'Değerlendirildi' : 'Hekim bekleniyor'}</span>
          </p>
          <p><strong>Hekim yorumu:</strong> {p.note || 'Henüz yorum yok.'}</p>
        </div>
      ))}
    </div>
  )
}

// 5. PDF rapor ve onam (yazdırma)
export function Report({ patientId }) {
  const [p, setP] = useState(null)
  const [teeth, setTeeth] = useState({})
  const [anamnesis, setAnamnesis] = useState([])
  const [dosyalar, setDosyalar] = useState([])
  const [triage, setTriage] = useState([])
  const [notlar, setNotlar] = useState([])
  const [appts, setAppts] = useState([])

  useEffect(() => {
    getPatient(patientId).then((x) => setP(x || null))
    getTeeth(patientId).then(setTeeth)
    anamnesisApi.list({ where: { patient_id: patientId } }).then((r) => setAnamnesis(r || []))
    listMedicalFiles(patientId).then((r) => setDosyalar(r || []))
    listTriage(patientId).then((r) => setTriage(r || []))
    notesApi.list({ order: 'created_at', asc: false }).then((r) => setNotlar((r || []).filter((n) => String(n.patient_id) === String(patientId))))
    listAppointments().then((r) => setAppts(r || []))
  }, [patientId])

  if (!p) return <p>Yükleniyor...</p>

  const recall = suggestRecall({
    lastVisit: p.last_visit || p.lastVisit || new Date().toISOString().slice(0, 10),
    treatmentType: p.treatment_type || p.treatmentType || 'kontrol',
    plaqueIndex: Number(p.plaque_index ?? p.plaqueIndex ?? 1),
    anxietyScore: Number(p.anxiety_score ?? p.anxietyScore ?? 3)
  })
  const anx = load(keys.anxiety, []).filter((a) => a.patientId === p.id).slice(-1)[0]

  const anam = anamnesis[0]
  const ad = (id) => HASTALIKLAR.find((h) => h.id === id)?.ad || id
  const sistemik = Array.isArray(anam?.sistemik) ? anam.sistemik : []

  // Dişleri FDI sırasına göre grupla (üst / alt)
  const disleri = Object.entries(teeth).sort((a, b) => Number(a[0]) - Number(b[0]))
  const ust = disleri.filter(([n]) => Number(n) <= 16 || Number(n) >= 21 && Number(n) <= 28)
  const alt = disleri.filter(([n]) => Number(n) >= 31 && Number(n) <= 38 || Number(n) >= 41 && Number(n) <= 48)

  // Hastanın randevuları (isimden eşleşen)
  const hastaRandevulari = appts.filter((a) =>
    String(a.name || '').toLowerCase() === String(p.name || '').toLowerCase()
  ).sort((a, b) => String(b.appt_date || '').localeCompare(String(a.appt_date || '')))

  const bugun = new Date().toISOString().slice(0, 10)
  const yas = dogumYas(p.birth_date)

  return (
    <div className="rapor-sayfa">
      {/* ---------- Yazdırma üst çubuğu (yazdırmada görünmez) ---------- */}
      <div className="rapor-arac no-print">
        <Link to={`/hekim/hasta/${p.id}`}><button className="ghost">Geri</button></Link>
        <button onClick={() => window.print()}>Yazdır / PDF Kaydet</button>
        <span className="muted">
          Rapor {String(bugun).replace(/-/g, '.')} tarihinde oluşturuldu
        </span>
      </div>

      <div className="card rapor-kart">
        {/* ---------- Başlık ---------- */}
        <div className="rapor-baslik">
          <img src="/ktu-logo.png" alt="KTÜ" className="ktu-logo-lg" />
          <div>
            <h1>Diş Hekimliği Klinik Raporu</h1>
            <p className="muted">TeleDentist — Karadeniz Teknik Üniversitesi Diş Hekimliği</p>
          </div>
        </div>

        {/* ---------- Hasta kimlik ---------- */}
        <section className="rapor-bolum">
          <h3>Hasta Bilgileri</h3>
          <div className="rapor-izgara">
            <Satir etiket="Ad Soyad" deger={p.name} />
            <Satir etiket="T.C. Kimlik" deger={p.tc_no || '-'} />
            <Satir etiket="Doğum Tarihi" deger={p.birth_date || '-'} />
            <Satir etiket="Yaş" deger={yas !== null ? `${yas}` : '-'} />
            <Satir etiket="Cinsiyet" deger={p.gender || '-'} />
            <Satir etiket="Kan Grubu" deger={p.blood || '-'} />
            <Satir etiket="Telefon" deger={p.phone || '-'} />
            <Satir etiket="Son Muayene" deger={p.last_visit || p.lastVisit || '-'} />
            <Satir etiket="Şehir / İlçe" deger={[p.city, p.district].filter(Boolean).join(' / ') || '-'} />
            <Satir etiket="Sağlık Sigortası" deger={p.insurance || '-'} />
          </div>
        </section>

        {/* ---------- ANAMNEZ ---------- */}
        <section className="rapor-bolum">
          <h3>Anamnez — Geçmiş Hastalık Öyküsü</h3>
          {!anam ? (
            <p className="muted">Kayıtlı anamnez yok. Muayene sırasında hekim tarafından doldurulur.</p>
          ) : (
            <>
              {anam.critical && (
                <div className="rapor-uyari">
                  <strong>Kritik uyarı:</strong> Aşağıdaki durumlar tedavi planında dikkat gerektirir.
                </div>
              )}
              {sistemik.length > 0 && (
                <p>
                  <strong>Sistemik hastalıklar:</strong> {sistemik.map(ad).join(', ')}
                </p>
              )}
              <SatirSatir etiket="Alerjiler" deger={anam.alerjiler || 'Belirtilmedi'} />
              <SatirSatir etiket="Kullandığı ilaçlar" deger={anam.ilaclar || 'Belirtilmedi'} />
              <SatirSatir etiket="Geçmiş hastalıklar" deger={anam.gecmis_hastaliklar || 'Belirtilmedi'} />
              <SatirSatir etiket="Geçmiş ameliyatlar" deger={anam.gecmis_ameliyatlar || 'Belirtilmedi'} />
              <SatirSatir etiket="Aile sağlık öyküsü" deger={anam.aile_saglik || 'Belirtilmedi'} />
              <SatirSatir etiket="Diş hekimliği geçmişi" deger={anam.dis_gecmisi || 'Belirtilmedi'} />
              <SatirSatir etiket="Şikâyet" deger={anam.agri_ozeti || 'Belirtilmedi'} />
              <SatirSatir etiket="Aburcubur / Atıştırmalık" deger={anam.abur_cubur || 'Belirtilmedi'} />
              <SatirSatir etiket="Gece Şekerli Gıda" deger={anam.sekerli_gida_gece || 'Belirtilmedi'} />
              <SatirSatir etiket="Diş Fırçalama Alışkanlığı" deger={anam.dis_fircalama || 'Belirtilmedi'} />
              {anam.gebelik_durumu && <SatirSatir etiket="Gebelik" deger={anam.gebelik_durumu} />}
              {anam.notlar && <SatirSatir etiket="Hekim notu" deger={anam.notlar} />}
              <p className="muted rapor-kayit">
                Kayıt tarihi: {String(anam.updated_at || anam.created_at || '').slice(0, 10)}
              </p>
            </>
          )}
        </section>

        {/* ---------- ÖLÇÜMLER ---------- */}
        <section className="rapor-bolum">
          <h3>Klinik Ölçümler</h3>
          <div className="rapor-izgara">
            <Satir etiket="Plak İndeksi" deger={`${p.plaque_index ?? p.plaqueIndex ?? '-'} / 3`} />
            <Satir etiket="Diş Kaygısı" deger={anx ? `${anx.total} / 25` : (p.anxiety_score ?? p.anxietyScore ?? '-')} />
            <Satir etiket="Triyaj" deger={triage[0]?.level || 'Kayıt yok'} />
            <Satir etiket="Önerilen Kontrol" deger={recall.nextVisit} />
          </div>
        </section>

        {/* ---------- DİŞ DURUMU ---------- */}
        <section className="rapor-bolum">
          <h3>Diş Durumu</h3>
          {disleri.length === 0 && <p className="muted">Kayıtlı diş tedavisi yok.</p>}
          {ust.length > 0 && (
            <>
              <h4 className="rapor-alt-baslik">Üst çene</h4>
              <div className="rapor-disler">
                {ust.map(([no, t]) => <DisSatiri key={no} no={no} t={t} />)}
              </div>
            </>
          )}
          {alt.length > 0 && (
            <>
              <h4 className="rapor-alt-baslik">Alt çene</h4>
              <div className="rapor-disler">
                {alt.map(([no, t]) => <DisSatiri key={no} no={no} t={t} />)}
              </div>
            </>
          )}
        </section>

        {/* ---------- DOSYA ARŞİVİ ---------- */}
        <section className="rapor-bolum">
          <h3>Dosya Arşivi — Röntgen ve Belgeler</h3>
          {dosyalar.length === 0 ? (
            <p className="muted">Arşivde dosya yok.</p>
          ) : (
            <table className="rapor-tablo">
              <thead>
                <tr>
                  <th>Tarih</th><th>Tür</th><th>Diş</th><th>Sınıflandırma</th><th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {dosyalar.map((d) => (
                  <tr key={d.path || d.id}>
                    <td>{String(d.created_at || '').slice(0, 10)}</td>
                    <td>{d.tur === 'xray' ? 'Röntgen' : d.tur === 'foto' ? 'Fotoğraf' : 'Belge'}</td>
                    <td>{d.tooth || '-'}</td>
                    <td>{KAT_ADI[d.category] || '-'}</td>
                    <td>{d.arsiv ? 'Arşivde' : 'Aktif'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted rapor-kayit">
            Toplam {dosyalar.length} dosya ({dosyalar.filter((d) => d.arsiv).length} arşivde).
            Görüntüler klinik kayıt sisteminde saklanır.
          </p>
        </section>

        {/* ---------- RANDEVU GEÇMİŞİ ---------- */}
        <section className="rapor-bolum">
          <h3>Randevu Geçmişi</h3>
          {hastaRandevulari.length === 0 ? (
            <p className="muted">Randevu kaydı yok.</p>
          ) : (
            <table className="rapor-tablo">
              <thead>
                <tr><th>Tarih</th><th>Saat</th><th>Durum</th><th>Şikâyet</th></tr>
              </thead>
              <tbody>
                {hastaRandevulari.slice(0, 10).map((a) => (
                  <tr key={a.id}>
                    <td>{String(a.appt_date || '-').slice(0, 10)}</td>
                    <td>{a.appt_time || '-'}</td>
                    <td>{APPT_TR[a.status] || a.status}</td>
                    <td>{a.complaint || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ---------- KLINIK NOTLAR ---------- */}
        <section className="rapor-bolum">
          <h3>Klinik Notlar</h3>
          {notlar.length === 0 ? (
            <p className="muted">Klinik not yok.</p>
          ) : (
            <ul className="rapor-notlar">
              {notlar.slice(0, 12).map((n) => (
                <li key={n.id}>
                  <span className="muted">{String(n.created_at || '').slice(0, 10)}</span>
                  <strong> {NOT_TR[n.kind] || n.kind || 'Not'}:</strong> {n.body}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- AI ÖNERİSİ ---------- */}
        <section className="rapor-bolum">
          <h3>Kontrol Önerisi</h3>
          <p>
            Önerilen sonraki kontrol: <strong>{recall.nextVisit}</strong>
            <span className="muted"> ({recall.months} ay arayla — {recall.reason})</span>
          </p>
          <p className="muted rapor-kayit">
            Bu rapor klinik kayıt amaçlıdır. Tıbbi tanı içermez; tedavi kararı muayene sonrası hekimindir.
          </p>
        </section>

        {/* ---------- İMZA ---------- */}
        <section className="rapor-bolum">
          <h3>Onam ve İmza</h3>
          <p className="rapor-onam">
            Yukarıdaki bilgiler muayene sırasında tarafıma anlatılmış, okunmuş ve onaylanmıştır.
            Kişisel ve sağlık verilerimin randevu ve tedavi amacıyla işlenmesine (KVKK md. 5/1)
            açık rıza veriyorum.
          </p>
          <div className="rapor-imza">
            <div>
              <span className="muted">Hasta / Ebeveyn</span>
              <div className="imza-cizgi" />
              <span className="muted">Tarih: .... / .... / ........</span>
            </div>
            <div>
              <span className="muted">Hekim</span>
              <div className="imza-cizgi" />
              <span className="muted">Tarih: .... / .... / ........</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

const KAT_ADI = {
  radyoloji: 'Radyoloji', tani: 'Tanı raporu', tedavi: 'Tedavi planı',
  sozelmes: 'Sözlü onam', laboratuvar: 'Laboratuvar', odeme: 'Ödeme', kimlik: 'Kimlik', diger: 'Diğer'
}
const APPT_TR = { yeni: 'Bekliyor', onaylı: 'Onaylandı', tamamlandı: 'Tamamlandı', iptal: 'İptal' }
const NOT_TR = { not: 'Not', rapor: 'Rapor', sevk: 'Sevk', konsultasyon: 'Konsültasyon' }

/** Doğum tarihinden yaş hesaplar. */
function dogumYas(dogum) {
  if (!dogum) return null
  const d = new Date(dogum)
  if (isNaN(d)) return null
  const fark = new Date()
  let yas = fark.getFullYear() - d.getFullYear()
  const ay = fark.getMonth() - d.getMonth()
  if (ay < 0 || (ay === 0 && fark.getDate() < d.getDate())) yas--
  return yas >= 0 && yas < 130 ? yas : null
}

/** Etiket-değer ikilisi (ızgara içinde). */
function Satir({ etiket, deger }) {
  return (
    <div className="rapor-alan">
      <span className="muted">{etiket}</span>
      <b>{deger}</b>
    </div>
  )
}

/** Etiket-değer ikilisi (satır içinde). */
function SatirSatir({ etiket, deger }) {
  return (
    <p className="rapor-satir">
      <strong>{etiket}:</strong> {deger}
    </p>
  )
}

/** Diş durumu satırı — hastaya ne öğretildiğini de gösterir. */
function DisSatiri({ no, t }) {
  return (
    <div className="rapor-dis">
      <b>{no}</b>
      <span className="badge">{STATUS_TR[t.status] || t.status}</span>
      {t.treatment && t.treatment !== '-' && <span className="muted">{t.treatment}</span>}
      {t.doctorNote && <span className="muted">— {t.doctorNote}</span>}
      <span className="muted rapor-egitim">[{toothEducation(no, t.status)}]</span>
    </div>
  )
}
