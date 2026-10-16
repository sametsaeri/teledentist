# Testler

Her commit'te koşan otomatik kontroller.

## Komutlar

```bash
npm test          # tüm testleri bir kez çalıştır
npm run test:watch # geliştirirken canlı izle
npm run check     # ölü buton denetimi + testler + derleme (hepsi)
```

## Kapsam

| Dosya | Ne denetler |
|---|---|
| `src/test/kod-kurallari.test.js` | **Statik kurallar** — kaynak kodu okur: `useEffect` kalıbı, ölü menü/yer tutucu, emoji yasağı, gizli anahtar sızıntısı |
| `src/pages/panel-regression.test.jsx` | **Beyaz ekran regresyonu** — her panel açılıp kapatılır, menü akordiyonu ve rol menüleri denetlenir |
| `src/services/db.test.js` | **Veri katmanı** — tablo yoksa tarayıcıya kaydetme, güncelleme/silme, `where` filtresi, veri kaybı yok |
| `src/test/supabase-mock.js` | Supabase taklidi (zincirleme sorgu, "tablo yok" hatası) |

## 16.10.2026 beyaz ekran hatası

Hata, `useEffect(load, [])` yazımından kaynaklanıyordu: `load` bir
Promise döndürdüğü için React onu **temizleme (cleanup) fonksiyonu**
sanıp modülden çıkarken çağırıyor, uygulama çöküyordu.

Artık iki katman koruma var:

1. `src/test/kod-kurallari.test.js` — bu kalıbı kaynak kodda arar
2. `src/components/ErrorBoundary.jsx` — yine de hata olursa beyaz ekran yerine
   "Tekrar Dene" ekranı gelir

## Test yazarken

```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// Ağ gerektiren bileşenler için:
vi.mock('../services/supabase.js', async () => {
  const { supabaseMock } = await import('../test/supabase-mock.js')
  return supabaseMock()
})
```