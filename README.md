# TeleDentist — KTÜ Diş Hekimliği

**Pedodonti odaklı dijital hasta yönetim ve tele-dentistry platformu** (React 19 + Vite + Supabase + Vercel).

## Proje Özeti

- **Çalışma alanı:** Diş hekimliği öğrencisi kliniği verileri (pedodonti, çocuk hasta, engelli hasta, Down sendromlu hasta).
- **Kullanıcı akışları:** Hasta / Ebeveyn Girişi → Dişlerim paneli; **Hekim Girişi** → Panel; Admin / Sekreter / Teknisyen girişleri.
- **Hesap modeli:** Dış kayıt kapalıdır. **Sadece hekimler** hastaya hesap açar (credentials SMS + e-posta ile bilgilendirilir).

## İçerik / Özellikler

### Hasta Paneli (`/hastam`)
- Diş şeması (2D SVG, 32 diş pedodonti)
- Sağlık puanı, ağız bakımı, kontrol aralığı
- Dişlerim Hakkında (görevler / günlük bakım)
- Randevularım / Son Kontrol
- **Hekimimle Görüşme Talebi** — hekim seç → bildirim → hekim onayı → `/video?room=…`
- Bildirimler (zil + merkez)
- Hesap Ayarları

### Hediim Paneli (`/hekim`)
- Genel Bakış, Hastalarım, Klinik Günlük, Randevu Talepleri, Takvim, Yaklaşan Randevular
- Triyaj ve Sevk, Tedavi Süreleri
- Röntgen Arşivi (`/hekim/rontgen-arşivi`)
- Konsültasyon, Online Görüşme, Bildirimler, Hesap Ayarları

### Bildirimler ve Haberler
- `kind` tipleri: `kayit_talebi`, `randevu`, `randevu_bildirimi`, `randevu_hatirlatma`, `foto`, `belge`, `anamnez`, `sevk`, `kontrol`, `bakim`, `gorusme`, `kabul`, `onam`
- Okundu / okunmadı durumu, yüksek önemli haberler öne çıkar.
- `src/services/bildirim.js` → `bildirimLinki()` ile bildirim tıklandığında ilgili sayfaya gider.

### Randevu ve SMS / E-posta
- Hasta randevu talebi → hekime bildirim (`randevu`).
- Hediim onayı → hasta bildirimi (`randevu_bildirimi`) + SMS onayı (`randevuOnayMesaji`).
- Yeni hasta hesabı açılışı → SMS (`hesapAcildiMesaji`) + e-posta (`hesapAcildiMail`).
- Cron (`/api/reminders`, günlük 09:00 UTC, 3 gün) → hatırlatma bildirimi + SMS.

### Online Görüşme
- Hasta hekim seçip talep gönderir → bildirim → hekim `/video?room=…` ile onay/katıl.

## API (Vercel Serverless)

| Endpoint | Method | Amaç |
|---|---|---|
| `/api/sms` | POST | SMS gönder (Twilio). Anahtar yoksa kuyruğa alır. Body: `{ to, message }` |
| `/api/email` | POST | E-posta gönder (Resend). Anahtar yoksa kuyruğa alır. Body: `{ to, subject, text }` |
| `/api/reminders` | GET (cron `0 9 * * *`) | Yaklaşan onaylı randevular için hatırlatma bildirimi + SMS gönderir (3 gün pencere, tekrar yok) |

## Ortam Değişkenleri (Vercel)

| Değişken | Amaç |
|---|---|
| `VITE_SUPABASE_URL` | Supabase proje URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_ACCESS_TOKEN` | Supabase SQL erişimi (migration push) |
| `SUPABASE_PROJECT_REF` | Proje ref |
| `TWILIO_ACCOUNT_SID` | Twilio — SMS gönderimi (ücretsiz kuruluma gerek yok, `null` ise kuyruk) |
| `TWILIO_AUTH_TOKEN` | Twilio — kimlik doğrulama |
| `TWILIO_PHONE_NUMBER` | Twilio — gönderici telefon |
| `RESEND_API_KEY` | Resend — e-posta (ücretsiz: 3000/ay) |
| `EMAIL_FROM` | Gönderici adresi (doğrulanmış alan adı) |

## Veritabanı

- Tüm SQL dosyaları: `db/` altında — build aracı `npm run db:build` ile tek dosyaya (`db/SUPABASE_SETUP.sql`) birleştirilir, `npm run db:push` ile Supabase'e yüklenir.
- Migrasyonlar sıralı olarak uygulanır (tablo → roller → fonksiyon → migrations → setup_status → admin/demo).

## Testler

```bash
npm test        # 297+ otomatik test
npm run build   # derleme doğrulaması
npm run check   # test + derleme + ölü buton denetimi (tek komut)
```

## Kurulum (yeniden)

1. `npm install`
2. `.env` dosyasına `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` ekle.
3. `npm run db:build` → `npm run db:push`
4. `npm run dev`

## Deployment

- GitHub `main` → Vercel otomatik deploy (teledentist.vercel.app).
- Migration değişiklikleri: `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` kullanılıp `npm run db:push`.

## Ücretsiz Ağ / SMS / Mail Tamamlanması

- **SMS:** Twilio kuralları (kurumsal ses numarası, alıcı kaydı) → `TWILIO_*` env'leri → canlı SMS.
- **E-posta:** Resend → `RESEND_API_KEY` + `EMAIL_FROM` → hesap açılış, randevu onayı e-postaları.
- **Cron:** Vercel projesi cron tanımı zaten kurulu (`0 9 * * *` → `/api/reminders`).

## Çalışma Notları

- Hasta listesi → `hastaya_hekim_listesi()` SECURITY DEFINER fonksiyonu (RLS bypass, yalnız id/name/branch döner).
- `notifications` RLS: read (hekim/kendi hasta/admin/hekim kanalı) + insert (hedefin hekimi veya hasta ya da admin).
- `bildirimOlustur` — hekimden ve hastadan farklı akışlarda aynı fonksiyon; hedef hekim `doctor_id` üzerinden bildirir.
