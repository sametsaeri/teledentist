// React hata sınırı
// Bir ekran render sırasında hata olursa uygulama tamamen boşalır (beyaz ekran).
// Bu bileşen hatayı yakalar, kullanıcıya anlaşılır bir mesaj gösterir ve
// düğmeye basılınca ya da otomatik olarak uygulamayı aynı yolda yeniden başlatır.
import { Component } from 'react'
import { Alert, RefreshCw, Home, LogOut } from './Icons.jsx'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hata: null, sayac: 0 }
  }

  static getDerivedStateFromError(hata) {
    return { hata }
  }

  componentDidCatch(hata, bilgi) {
    // Konsola ayrıntıyı bırak, geliştirici için
    console.error('TeleDentist ekran hatası:', hata, bilgi?.componentStack)
  }

  yenidenBaslat = () => {
    this.setState((s) => ({ hata: null, sayac: s.sayac + 1 }))
    // React aynı bileşeni yeniden kurmazsa sayfayı da tazele
    if (typeof window !== 'undefined') {
      window.setTimeout(() => window.location.reload(), 60)
    }
  }

  render() {
    if (!this.state.hata) return this.props.children
    return (
      <div className="crash-screen">
        <div className="crash-card">
          <Alert size={40} />
          <h1>Bu ekran yüklenemedi</h1>
          <p>
            Beklenmeyen bir hata oluştu. Verileriniz silinmedi.
            Aşağıdaki düğmeyle aynı ekranı tekrar yükleyebilirsiniz.
          </p>
          <pre>{String(this.state.hata?.message || this.state.hata).slice(0, 300)}</pre>
          <div className="crash-actions">
            <button onClick={this.yenidenBaslat}><RefreshCw size={17} /> Tekrar Dene</button>
            <a className="btn btn-ghost" href="/"><Home size={17} /> Ana Sayfa</a>
            <button
              className="ghost"
              onClick={() => {
                try { localStorage.removeItem('td_session') } catch { /* yoksay */ }
                window.location.href = '/danisan-girisi'
              }}
            >
              <LogOut size={17} /> Çıkış
            </button>
          </div>
        </div>
      </div>
    )
  }
}
