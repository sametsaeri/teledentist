import { useEffect, useRef, useState } from 'react'
import { supabase, hasSupabase } from '../services/supabase.js'
import { getSession } from '../services/store.js'
import { listAppointments } from '../services/db.js'
import { Video, Mic, MicOff, PhoneOff, Users, Alert, Copy } from '../components/Icons.jsx'

const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
]

// Oda seçimi ekranı
export function VideoVisit() {
  const me = getSession() || {}
  const [room, setRoom] = useState('')
  const [started, setStarted] = useState('')
  const [err, setErr] = useState('')
  const [appts, setAppts] = useState([])
  const demoMode = !hasSupabase

  useEffect(() => { listAppointments().then(setAppts) }, [])
  const confirmed = appts.filter((a) => a.status === 'onaylı' && a.is_online)

  const join = (code) => {
    const clean = String(code || '').trim()
    if (!clean) return setErr('Oda kodu girin.')
    setErr('')
    setStarted(clean)
  }

  if (started) return <CallRoom room={started} user={me} onLeave={() => setStarted('')} />

  return (
    <div>
      <h1><Video size={24} /> Online Görüşme</h1>
      <p className="muted">Kamera ve sesli görüşme ile uzaktan hasta desteği.</p>

      {confirmed.length > 0 && (
        <div className="card">
          <h3>Online Randevularınız</h3>
          {confirmed.map((a) => (
            <button key={a.id} className="ghost" style={{ marginRight: 8 }} onClick={() => join('r' + a.id)}>
              <Video size={15} /> {a.name} — {a.appt_date}
            </button>
          ))}
        </div>
      )}

      {demoMode && (
        <div className="card warn-card">
          <h3><Alert size={16} /> Test / Demo Modu Aktif</h3>
          <p className="muted">
            Supabase ortamı yapılandırılmadığı için online görüşme <b>test modunda</b> çalışıyor.
            Kamera/mikrofon erişimi ve arayüzü test edebilirsiniz. Gerçek iki taraflı görüntülü
            görüşme için <code>VITE_SUPABASE_URL</code> ve <code>VITE_SUPABASE_ANON_KEY</code>
            ortam değişkenlerini tanımlayıp uygulamayı yeniden başlatın.
          </p>
        </div>
      )}

      <div className="card">
        <h3>Oda Kodu ile Bağlan</h3>
        <p className="muted">Karşı tarafa oda kodunu iletin, ikiniz de aynı kodu girin.</p>
        <div className="toolbar">
          <input placeholder="örn: 1234" value={room} onChange={(e) => setRoom(e.target.value)} style={{ minWidth: 200 }} />
          <button onClick={() => join(room)}><Video size={16} /> Bağlan</button>
        </div>
        {err && <p className="auth-err"><Alert size={15} /> {err}</p>}
      </div>
    </div>
  )
}

function CallRoom({ room, user, onLeave }) {
  const localVideo = useRef(null)
  const remoteVideo = useRef(null)
  const pcRef = useRef(null)
  const chanRef = useRef(null)
  const streamRef = useRef(null)

  const [status, setStatus] = useState('hazırlanıyor')
  const [peerHere, setPeerHere] = useState(false)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [copied, setCopied] = useState(false)
  const [logs, setLogs] = useState([])
  const [demo, setDemo] = useState(!hasSupabase)
  const note = (t) => setLogs((l) => [...l.slice(-6), t])

  useEffect(() => {
    let alive = true
    let poll = null

    async function setup() {
      // 1) Kamera + mikrofon
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = s
        if (localVideo.current) localVideo.current.srcObject = s
        setStatus(demo ? 'test modu — karşı taraf bekleniyor' : 'karşı taraf bekleniyor')
      } catch {
        setStatus('kamera/mikrofon izni verilmedi')
        return
      }

      // Supabase yoksa test modunda kal, gerçek bağlantıyı deneme
      if (!hasSupabase) {
        setStatus('test modu aktif — gerçek görüşme için Supabase yapılandırılmalı')
        note('Demo modu: WebRTC sinyalleştirme simüle ediliyor')
        return
      }

      // 2) Sinyalleşme kanalı
      const ch = supabase.channel('call-' + room, { config: { broadcast: { self: false } } })
      chanRef.current = ch

      const send = (event, payload) => ch.send({ type: 'broadcast', event, payload })

      const ensurePc = () => {
        if (pcRef.current) return pcRef.current
        const pc = new RTCPeerConnection({ iceServers: ICE })
        streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current))
        pc.ontrack = (e) => {
          if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0]
          setStatus('bağlandı')
          note('Karşı taraf görüntüsü alındı')
        }
        pc.onicecandidate = (e) => { if (e.candidate) send('ice', e.candidate) }
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') setStatus('bağlandı')
          note('Bağlantı: ' + pc.connectionState)
        }
        pcRef.current = pc
        return pc
      }

      ch.onBroadcast({ event: 'sdp' }, async ({ payload }) => {
        if (!payload) return
        const pc = ensurePc()
        await pc.setRemoteDescription(new RTCSessionDescription(payload))
        if (payload.type === 'offer') {
          const ans = await pc.createAnswer()
          await pc.setLocalDescription(ans)
          await send('sdp', ans)
        }
      })

      ch.onBroadcast({ event: 'ice' }, async ({ payload }) => {
        if (!payload || !pcRef.current) return
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(payload)) } catch {}
      })

      const onPresence = () => {
        const st = ch.presenceState()
        const others = Object.keys(st).filter((k) => k !== String(ch.myChannelId || ''))
        const count = Object.keys(st).length
        setPeerHere(count > 1 || others.length > 0)
      }
      ch.onPresence({ event: 'join' }, onPresence)
      ch.onPresence({ event: 'leave' }, onPresence)
      ch.onPresenceSync(onPresence)

      await ch.subscribe(async (state) => {
        if (state !== 'SUBSCRIBED') return
        await ch.track({ userId: user.id, name: user.name })
        note('Odaya girildi: ' + room)

        // İlk katılımcı teklif gönderir; diğerleri cevap verir
        poll = setInterval(async () => {
          if (pcRef.current?.signalingState === 'have-local-offer') return
          const st = ch.presenceState()
          const total = Object.keys(st).length
          if (total >= 2 && !pcRef.current) {
            clearInterval(poll)
            try {
              const pc = ensurePc()
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              await send('sdp', offer)
              setStatus('bağlanıyor...')
              note('Arama teklifi gönderildi')
            } catch (e) { note('Teklif hatası: ' + e.message) }
          }
        }, 1500)
      })
    }

    setup()

    return () => {
      alive = false
      if (poll) clearInterval(poll)
      try { pcRef.current?.close() } catch {}
      if (hasSupabase) {
        try { chanRef.current && supabase.removeChannel(chanRef.current) } catch {}
      }
      try { streamRef.current?.getTracks().forEach((t) => t.stop()) } catch {}
    }
  }, [room, user.id])

  const toggle = (kind) => {
    const s = streamRef.current
    if (!s) return
    if (kind === 'mic') {
      const on = muted
      s.getAudioTracks().forEach((t) => { t.enabled = on })
      setMuted(!muted)
    } else {
      const on = camOff
      s.getVideoTracks().forEach((t) => { t.enabled = on })
      setCamOff(!camOff)
    }
  }

  const copy = () => {
    navigator.clipboard?.writeText(room)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div>
      <div className="panel-hero">
        <div>
          <h1><Video size={24} /> Online Görüşme {demo && <span className="badge warn">TEST MODU</span>}</h1>
          <p className="muted">Oda kodu: <b>{room}</b> — {status}</p>
        </div>
        <span className="spacer" />
        <button className="btn-new" onClick={copy}><Copy size={16} /> {copied ? 'Kopyalandı' : 'Oda Kodunu Kopyala'}</button>
        <button className="ghost" onClick={onLeave}><PhoneOff size={16} /> Ayrıl</button>
      </div>

      <div className="card">
        <div className="video-grid">
          <div className="video-box">
            <video ref={localVideo} autoPlay playsInline muted />
            <span className="video-label">Ben — {user.name}</span>
          </div>
          <div className="video-box">
            <video ref={remoteVideo} autoPlay playsInline />
            <span className="video-label">{peerHere ? 'Karşı taraf' : 'Karşı taraf bekleniyor...'}</span>
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button className="ghost" onClick={() => toggle('mic')}>
            {muted ? <MicOff size={16} /> : <Mic size={16} />} {muted ? 'Sesi Aç' : 'Sessiz'}
          </button>
          <button className="ghost" onClick={() => toggle('cam')}>
            <Video size={16} /> {camOff ? 'Kamerayı Aç' : 'Kamerayı Kapat'}
          </button>
          <span className="badge"><Users size={13} /> {peerHere ? 'Bağlandı' : 'Bekliyor'}</span>
        </div>
      </div>

      <div className="card">
        <h3>Bağlantı Günlüğü</h3>
        {logs.length === 0 && <p className="muted">Henüz kayıt yok.</p>}
        {logs.map((l, i) => <p key={i} className="muted">{l}</p>)}
        <p className="muted">İki taraf aynı oda kodunu girdiğinde görüntü otomatik açılır.</p>
      </div>
    </div>
  )
}