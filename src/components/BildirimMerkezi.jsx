// Bildirim Merkezi — zil ikonu ve tam sayfa liste
//
// ESKİ SİSTEMDEN FARK: Bildirimler artık KAYDEDİLİR ve okundu bilgisi
// tutulur. Önceden yalnız randevu/kontrol tarihinden hesaplanıyordu; yeni
// kayıt talebi, hasta yüklediği görsel ve kritik anamnez bildirilmiyordu.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listBildirimler, okunmamisSayisi, bildirimOkundu, tumunuOkundu,
  bildirimSil, bildirimLinki, gecenSure, TURLER
} from '../services/bildirim.js'
import {
  Bell, Clipboard, Calendar, Camera, FileText, Stethoscope, Send,
  Clock, Check, X, Alert, CheckCircle, ChevronRight, User
} from './Icons.jsx'

/** Tür → ikon eşlemesi. Yeni tür eklenirse buraya da eklenmelidir. */
const IKON = {
  kayit_talebi: Clipboard,
  randevu: Calendar,
  randevu_bildirimi: CheckCircle,
  foto: Camera,
  belge: FileText,
  anamnez: Alert,
  sevk: Send,
  kontrol: Clock,
  bakim: Alert
}

/** Bildirim satırı — tıklanınca okunur ve ilgili sayfaya gider. */
function BildirimSatiri({ b, onOkundu, onSil }) {
  const I = IKON[b.kind] || Bell
  const hedef = bildirimLinki(b)
  return (
    <div className={`bildirim-satir ${b.okundu ? 'okunmus' : ''} ${b.onem || 'normal'}`}>
      <Link
        to={hedef}
        className="bildirim-ic"
        onClick={() => onOkundu(b.id)}
      >
        <span className="bildirim-ikon"><I size={16} /></span>
        <span className="bildirim-metin">
          <b>{b.title}</b>
          {b.body && <span className="muted">{b.body}</span>}
          <span className="bildirim-zaman">
            {gecenSure(b.created_at)} · {TURLER[b.kind]?.ad || b.kind}
          </span>
        </span>
        {!b.okundu && <span className="bildirim-nokta" aria-label="okunmadı" />}
      </Link>
      <button
        className="ghost tiny"
        onClick={() => onSil(b.id)}
        aria-label="Bildirimi kaldır"
      ><X size={13} /></button>
    </div>
  )
}

/**
 * Zil menüsü — panel üst çubuğunda.
 * Okunmamış sayısını rozet olarak gösterir.
 */
export function BildirimZil() {
  const [liste, setListe] = useState([])
  const [okunmamis, setOkunmamis] = useState(0)
  const [acik, setAcik] = useState(false)

  const yenile = async () => {
    const l = await listBildirimler({ limit: 8 })
    setListe(l)
    setOkunmamis(await okunmamisSayisi())
  }

  useEffect(() => {
    yenile()
    const t = setInterval(yenile, 45000)
    return () => clearInterval(t)
  }, [])

  const tikla = async (id) => { await bildirimOkundu(id); yenile() }
  const sil = async (id) => { await bildirimSil(id); yenile() }

  return (
    <div className="bell-wrap">
      <button
        className="bell"
        onClick={() => { setAcik(!acik); if (!acik) yenile() }}
        aria-label={`Bildirimler${okunmamis ? ` (${okunmamis} okunmamış)` : ''}`}
      >
        <Bell size={18} />
        {okunmamis > 0 && <span className="bell-count">{okunmamis > 99 ? '99+' : okunmamis}</span>}
      </button>

      {acik && (
        <div className="bell-menu">
          <div className="bell-baslik">
            <h4>Bildirimler {okunmamis > 0 && <span className="badge">{okunmamis} yeni</span>}</h4>
            {okunmamis > 0 && (
              <button
                className="ghost tiny"
                onClick={async () => { await tumunuOkundu(); yenile() }}
              ><Check size={13} /> Tümünü okundu işaretle</button>
            )}
          </div>

          {liste.length === 0 && <p className="muted">Yeni bildirim yok.</p>}
          {liste.map((b) => (
            <BildirimSatiri key={b.id} b={b} onOkundu={tikla} onSil={sil} />
          ))}

          <Link to="/bildirimler" className="bell-hepsi" onClick={() => setAcik(false)}>
            <ChevronRight size={15} /> Tüm bildirimleri gör
          </Link>
        </div>
      )}
    </div>
  )
}

/**
 * Tam sayfa bildirim listesi — geçmiş sorgulanabilir.
 * Rol bazlı filtre: hekime hekim bildirimleri, hastaya kendi bildirimleri.
 */
export function BildirimMerkezi({ rol }) {
  const [liste, setListe] = useState([])
  const [sekme, setSekme] = useState('okunmamis')
  const [mesaj, setMesaj] = useState('')

  const yenile = async () => setListe(await listBildirimler({ limit: 200 }))
  useEffect(() => { yenile() }, [])

  const okunmamis = liste.filter((b) => !b.okundu)
  const gorunen = sekme === 'okunmamis' ? okunmamis : liste

  const hekimMi = ['hekim', 'admin'].includes(rol)

  const tikla = async (id) => { await bildirimOkundu(id); yenile() }
  const sil = async (id) => { await bildirimSil(id); yenile() }

  return (
    <div>
      <div className="panel-hero">
        <div>
          <h1><Bell size={22} /> Bildirim Merkezi</h1>
          <p className="muted">
            {hekimMi
              ? 'Kayıt talepleri, yeni görseller, sevkler ve randevu değişiklikleri burada.'
              : 'Randevu onayları ve hekiminizden gelen bilgilendirmeler burada.'}
          </p>
        </div>
      </div>

      <div className="tabs">
        <button
          className={sekme === 'okunmamis' ? 'tab active' : 'tab'}
          onClick={() => setSekme('okunmamis')}
        >
          Okunmamış ({okunmamis.length})
        </button>
        <button
          className={sekme === 'tum' ? 'tab active' : 'tab'}
          onClick={() => setSekme('tum')}
        >
          Tümü ({liste.length})
        </button>
        {okunmamis.length > 0 && (
          <button
            className="ghost"
            onClick={async () => { await tumunuOkundu(); setMesaj('Tüm bildirimler okundu işaretlendi.'); yenile() }}
          ><Check size={15} /> Tümünü okundu işaretle</button>
        )}
      </div>

      {mesaj && <p className="msg ok"><CheckCircle size={15} /> {mesaj}</p>}

      <div className="card">
        {gorunen.length === 0 ? (
          <p className="muted empty-state">
            {sekme === 'okunmamis'
              ? 'Okunmamış bildiriminiz yok.'
              : 'Henüz bildirim yok. Yeni kayıt talebi, görsel yükleme veya randevu onayı olduğunda burada görünür.'}
          </p>
        ) : (
          <div className="bildirim-liste">
            {gorunen.map((b) => (
              <BildirimSatiri key={b.id} b={b} onOkundu={tikla} onSil={sil} />
            ))}
          </div>
        )}
      </div>

      <p className="muted">
        <User size={14} /> Bildirimler yalnız size gösterilir ve sunucuda saklanır;
        başka bir cihazdan giriş yaptığınızda da burada görürsünüz.
      </p>
    </div>
  )
}

export default BildirimZil