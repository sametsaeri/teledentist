import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { load, save, keys, getSession } from '../services/store.js'
import { reminderService, campaignService } from '../services/reminders.js'
import { notesApi, listPatients } from '../services/db.js'
import { X } from '../components/Icons.jsx'

function who() { return getSession()?.id || '' }

// Memnuniyet anketi (kırsal / erişim araştırması için)
export function Satisfaction() {
  const [score, setScore] = useState(5)
  const [access, setAccess] = useState('kırsal')
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const submit = () => {
    const list = load('td_satisfaction', [])
    list.push({ id: Date.now(), patientId: who(), score: Number(score), access, note, date: new Date().toISOString().slice(0, 10) })
    save('td_satisfaction', list)
    campaignService.earn(who(), 20, 'memnuniyet anketi')
    setDone(true)
  }
  if (done) return <div className="card"><h1>Teşekkürler</h1><p>20 puan kazandınız. Kampanya sayfasında görünür.</p><Link to="/kampanya"><button className="ghost">Puanlarım</button></Link></div>
  return (
    <div>
      <h1>Memnuniyet Anketi</h1>
      <div className="card">
        <label>Genel memnuniyet (1-5): <input type="number" min="1" max="5" value={score} onChange={(e) => setScore(e.target.value)} /></label><br /><br />
        <label>Erişim durumunuz: <select value={access} onChange={(e) => setAccess(e.target.value)}>
          <option value="kırsal">Kırsal bölge</option>
          <option value="şehir">Şehir merkezi</option>
          <option value="hareket-kisitli">Hareket kısıtlılığı</option>
          <option value="ozel-bakim">Özel bakım gereksinimi</option>
        </select></label><br /><br />
        <textarea rows="3" cols="45" placeholder="Yüz yüze iletişim eksikliği / şikayet ifade zorluğu yaşadınız mı?" value={note} onChange={(e) => setNote(e.target.value)} /><br /><br />
        <button onClick={submit}>Gönder (20 puan)</button>
      </div>
    </div>
  )
}

// Ağız-diş sağlığı eğitimi (evde hijyen)
const LESSONS = [
  { id: 'fircalama', title: 'Doğru Fırçalama (2x2 kuralı)', text: 'Günde 2 kez 2 dakika, 45 derece açıyla. Azı dişlerin çiğneme yüzeyini unutmayın.' },
  { id: 'plak', title: 'Plak Kontrolü', text: 'Plak boyayıcı tablet ile haftada 1 kontrol. Dil temizliğini atlamayın.' },
  { id: 'cocuk', title: 'Çocuklarda Hijyen (ebeveyn)', text: '6 yaş altına ebeveyn fırçalatsın. Florlu macun bezelye büyüklüğünde.' }
]
export function Education() {
  const [doneIds, setDoneIds] = useState(load('td_lessons', []))
  const finish = (id) => {
    const cur = load('td_lessons', [])
    if (!cur.includes(id)) {
      cur.push(id)
      save('td_lessons', cur)
      setDoneIds(cur)
      campaignService.earn(who(), 10, `eğitim: ${id}`)
    }
  }
  return (
    <div>
      <h1>Ağız-Diş Sağlığı Eğitimi</h1>
      {LESSONS.map((l) => (
        <div className="card" key={l.id}>
          <h3>{l.title} {doneIds.includes(l.id) && <span className="badge">Tamamlandı +10 puan</span>}</h3>
          <p>{l.text}</p>
          {!doneIds.includes(l.id) && <button onClick={() => finish(l.id)}>Tamamladım</button>}
        </div>
      ))}
    </div>
  )
}

// Hatırlatma merkezi (SMS/mail soyut, şimdi kuyruk UI)
export function Reminders() {
  const [to, setTo] = useState('')
  const [msg, setMsg] = useState('6 aylık diş kontrolünüz yaklaşıyor.')
  const [log, setLog] = useState(reminderService.queue)
  const send = (type) => {
    reminderService.send(type, to, msg)
    setLog([...reminderService.queue])
    const all = load('td_reminders', [])
    all.push({ type, to, msg, date: new Date().toISOString() })
    save('td_reminders', all)
  }
  const saved = load('td_reminders', [])
  return (
    <div>
      <h1>Hatırlatma Merkezi</h1>
      <div className="card">
        <p className="muted">Şimdi: kuyruk + e-posta taslağı. SMS sağlayıcı (NetGSM vb.) Faz 3'te buraya bağlanacak.</p>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="alıcı" />{' '}
        <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="mesaj" style={{ width: '50%' }} /><br /><br />
        <button onClick={() => send('mail')}>Mail Kuyruğuna Ekle</button>{' '}
        <button className="ghost" onClick={() => send('sms')}>SMS Kuyruğuna Ekle</button>
      </div>
      <div className="card">
        <h3>Kuyruk ({log.length}) + Kayıtlı ({saved.length})</h3>
        {[...log, ...saved].map((r, i) => <p key={i} className="muted">[{r.type}] {r.to}: {r.message || r.msg}</p>)}
      </div>
    </div>
  )
}

// Kampanya / ödül
export function Campaigns() {
  const pts = campaignService.points[who()] || 0
  const [ref, setRef] = useState('')
  const useRef = () => {
    if (!ref) return alert('Referans kodu girin.')
    campaignService.earn(who(), 30, `referans: ${ref}`)
    campaignService.earn(ref, 30, `davet ödülü`)
    alert('Karşılıklı 30 puan tanımlandı.')
  }
  return (
    <div>
      <h1>Kampanya ve Ödüller</h1>
      <div className="card"><h3>Puanım: {pts}</h3><p className="muted">Anket 20, eğitim 10, referans 30 puan. Kötüye kullanımı önlemek için üst limit Faz 4'te eklenecek.</p></div>
      <div className="card">
        <h3>Arkadaşını Davet Et</h3>
        <input placeholder="Referans kodu (örn: h1)" value={ref} onChange={(e) => setRef(e.target.value)} />{' '}
        <button onClick={useRef}>Kodu Kullan</button>
        <p className="muted">Senin kodun: {who()} (başkasıyla paylaş)</p>
      </div>
    </div>
  )
}

// Hekimler arası konsültasyon — klinik_notes tablosuna yazılır,
// böylece diğer hekimler ve süper admin de görebilir.
export function Consultation() {
  const me = getSession()
  const [list, setList] = useState([])
  const [patients, setPatients] = useState([])
  const [text, setText] = useState('')
  const [pid, setPid] = useState('')
  const [msg, setMsg] = useState('')

  const reload = () => notesApi.list().then((r) => setList(r.filter((n) => n.kind === 'konsultasyon')))
  useEffect(() => {
    reload()
    listPatients().then(setPatients)
  }, [])

  const submit = async () => {
    setMsg('')
    const p = patients.find((x) => x.id === pid)
    if (!p) return setMsg('Konsültasyon için hasta seçin.')
    if (!text.trim()) return setMsg('Konsültasyon metni yazın.')
    const r = await notesApi.insert({
      patient_id: p.id, patient_name: p.name,
      doctor_id: me?.id || null, kind: 'konsultasyon', body: text
    })
    if (r.error) return setMsg(r.error)
    setText(''); setPid('')
    setMsg('Konsültasyon kaydedildi. Diğer hekimler görebilir.')
    reload()
  }

  const del = async (id) => {
    await notesApi.remove(id)
    setMsg('Konsültasyon silindi.')
    reload()
  }

  return (
    <div>
      <h1>Hekimler Arası Konsültasyon</h1>
      <p className="muted">
        Zor bir klinik kararında diğer hekimlerden görüş isteyin. Kayıtlar ortak veritabanında tutulur.
      </p>

      <div className="card">
        <div className="grid form-grid">
          <label>Hasta
            <select value={pid} onChange={(e) => setPid(e.target.value)}>
              <option value="">— seçin —</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <label>Soru / Değerlendirme
          <textarea rows="3" placeholder="Örn: 36 nolu kanal tedavili diş için kaplama önerisi?" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <button onClick={submit}>Konsültasyon Kaydı Oluştur</button>
        {msg && <p className="muted">{msg}</p>}
      </div>

      <div className="card">
        <h3>Konsültasyon Kayıtları ({list.length})</h3>
        {list.length === 0 && (
          <p className="muted">
            Henüz konsültasyon kaydı yok. Hasta seçip sorunuzu yazın.
          </p>
        )}
        {list.map((c) => (
          <div className="appt-row" key={c.id}>
            <div>
              <span className="badge">konsultasyon</span>
              <strong>{c.patient_name || '—'}</strong>
              <p className="muted">{String(c.created_at || '').slice(0, 16)}</p>
              <p>{c.body}</p>
            </div>
            <div className="toolbar">
              {c.patient_id && <Link to={`/hekim/hasta/${c.patient_id}`}><button className="ghost">Hastayı Aç</button></Link>}
              <button className="ghost tiny danger" onClick={() => del(c.id)}><X size={13} /> Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// SSS + KVKK
export function Faq() {
  return (
    <div>
      <h1>SSS ve KVKK</h1>
      <div className="card"><h3>Yüz yüze muayene yerine geçer mi?</h3><p>Hayır. Teledentistry tamamlayıcıdır; tanı ve tedavi planı hekim onayı gerektirir.</p></div>
      <div className="card"><h3>Şikayetimi ifade etmekte zorlanıyorum</h3><p>Triyaj anketi + fotoğraf yükleme bu yüzden var. Ağrı skoru ve görsel hekime önden gider.</p></div>
      <div className="card"><h3>Verilerim güvende mi?</h3><p>Verileriniz KVKK kapsamında korunur. Röntgen ve raporlar yalnızca hekiminiz ve siz (veya ebeveyniniz) tarafından görülür.</p></div>
      <div className="card"><h3>Kapsam</h3><p>Yalnızca diş hekimliği hastaları. Diğer branşlar kapsam dışıdır.</p></div>
    </div>
  )
}
