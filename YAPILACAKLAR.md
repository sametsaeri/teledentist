# Yapılacaklar Listesi — TeleDentist

Bu dosya, diş hekimi arkadaşlarından alınan geri bildirimlere dayalı geliştirme görevlerini içerir.
Kaynak: Hekim geri bildirimleri (doktor arkadaşlar) → daha iyi kaliteye sunulacak.

---

## 1. 3B Diş Görüntüleri (Tooth3D)

- [x] **Büyütme (yakınlaştırma) butonu eklendi** — `+ Büyüt` düğmesi, yaklaştırma seviyesini artırır (maks 1.7×)
- [x] **Küçültme (uzaklaştırma) butonu eklendi** — `− Küçült` düğmesi, uzaklaştırma seviyesini azaltır (maks 0.65×)
- [x] **Tam boyut ekran (Full Screen) butonu eklendi** — `Tam Ekran` düğmesi, 3B modeli tam ekrana alır

> İlgili dosya: `src/components/Tooth3D.jsx` — tekerlekle yakınlaştırma ile birlikte simge düğmeleri de eklendi.

---

## 2. Onam Sistemi (Consent / Rıza)

- [x] **Onam sistemi en üste alındı.** Hasta işlemle başlamadan önce onam versin. (PatientPanel.jsx — onay vermeden diğer içerikler görünmez)
- [x] **Hekim paneline detaylı onam raporu eklendi.** (Portal.jsx — DoctorPatient bileşeni)
- [x] Hasta ön kayıttan geçtikten sonra, randevu görüşmesine geldiğinde **hekim panelinden detaylı onam raporu girişi yapılabiliyor.** (Portal.jsx — Detaylı Onam Raporu kartı)

> Akış: Hasta ön kayıt → randevu görüşmesi → hekim panelinde detaylı onam raporu doldurulur → hasta onay verir → işlemlere başlar.

---

## 3. Karşılaştırma / Fiyatlandırma

- [x] **Karşılaştırma kartlarında "Düşük / Orta / Yüksek" risk etiketi eklendi** — `DisGelecek.jsx` (SenaryoKarti). Ağrı % yanında metin olarak "Düşük / Orta / Yüksek" görünüyor. Fiyatlandırma yoktur.
- [x] **Hekim panelinde fiyatlandırma yok** — `DoctorModules.jsx` (TedaviSureleri) sadece seans ve süre gösterir, ücret göstermez. Devlet projesi olduğından kesin ücret listesi yoktur.

> Not: Proje devlet projesi olduğundan kesin bir ücret listesi yoktur; bu yüzden karﬁyat yerine seviye tabanlı (Düşük/Orta/Yüksek) değerlendirme tercih edilir.

---

## 4. Online Görüşme

- [x] **Online görüşme alanları aktif.** (`/video` rotası hasta/ebeveyn/hekim rolleri için açık, `VideoVisit.jsx`)
- [x] **Test edilebilir.** Supabase yapılandırılmamışsa "Test / Demo Modu" otomatik açılır; kamera/mikrofon erişimi ve arayüz test edilebilir. Gerçek görüşme için Supabase env değişkenleri tanımlanmalı.

---


## 5. Acil Durum / Hasta Kayıt

- [x] **"Acil durum" işareti eklendi** (PatientPanel.jsx — Bilgilerim kartı) — hasta acil durum işaretini aktif edebilir.
- [x] **"Hekime Bildir" butonu aktif** — acil durum işaretli olduğunda "Hekime Bildir" düğmesi görünür ve aktif olur, hekime acil bildirim gönderir.
- [x] **Geri alma (undo / düzeltme) işlevi eklendi** — "Bilgilerimi Kaydet" sonrası 10 saniye boyunca "Geri Al" düğmesi görünür; yanlışlıkla işaretlenmiş/yenilenmiş veriler eski haline döndürülebilir.

---

## 6. Röntgen / Tıbbi Dosya Arşivi (en önemli)

- [x] **Ayrı Röntgen Arşivi sayfası eklendi** (`src/pages/RontgenArsivi.jsx`) — tüm hastaların röntgen, tomografi ve tıbbi dosyaları tek sayfada listelenir.
- [x] **Röntgen dosya barındırma ve arşivleme** — dosya sistemde (Supabase Storage) barınır, `medical_files` tablosunda kayıt tutulur (kim, ne zaman, hangi diş, kategori).
- [x] **Röntgen kayıt görüntüleme** — imzalı URL ile 1 saat geçerli görüntüleme, PDF/İndir destekli.
- [x] **Hasta filtresi, arama, sınıflandırma, arşivleme (pasif kayıt), kalıcı silme onayı.**
- [x] **Rotaya eklendi:** `/hekim/rontgen-arşivi` (hekim + admin rolleri) + PanelLayout menüsü.

---

## 7. Randevu / Kontrol Hatırlatma Servisi (Mail ve Cep/SMS)

- [x] **Mail hatırlatma servisi** — `api/email.js` + `src/services/email.js` eklendi (Resend hazır; anahtar yoksa `/api/email` kuyruğa alır).
- [x] **Cep telefonu (SMS) hatırlatma servisi** — `api/sms.js` + `src/services/sms.js` eklendi (Twilio hazır; anahtar yoksa `/api/sms` kuyruğa alır). `api/reminders.js` (vercel cron) günlük 09:00 UTC'de hatırlatma SMS'i gönderir.
- [x] **Hatırlatma günü ayarı** — hasta seçtiği gün sayısı kadar önceden bildirim (mevcut: `reminder_days` / `listNotifications()`).

---

## 9. Kod Temizliği & Ölü Buton Düzeltmeleri (tamamlandı)

- [x] **`Extra.jsx`'teki çift/ölü `VideoVisit` bileşeni kaldırıldı** — App.jsx zaten ayrı `VideoVisit.jsx`'i kullanıyordu, Extra.jsx'deki kopya kullanılmıyordu.
- [x] **`StaffPanel.jsx`'teki `METHOD_TR` sıralama hatası düzeltildi** — `METHOD_TR` sabiti kullanımdan önce tanımlandı, dosya sonundaki duplikat tanım kaldırıldı.
- [x] **SMS/e-posta servisleri akışlara bağlandı** — `api/reminders.js` (cron SMS), `db.js` (randevu onayı + talep alındı SMS), `Portal.jsx` (hesap açılış SMS/e-posta).

---

## 8. Değerlendirme & Kalite İyileştirmesi

- [x] Doktor arkadaşlardan alınan geri bildirimler değerlendirildi (gece oturumunda).
- [x] Öneri ve geliştirme tavsiyeleri değerlendirildi.
- [x] Tüm üst maddeler yerine getirildikten sonra uygulamanın kalitesi iyileştirildi.

---

## Durum Takibi

| Görev | Durum | Sorumlu / Not |
|---|---|---|
| 3B büyütme/küçültme/tam ekran simgeleri | Tamamlandı | Tooth3D.jsx — + Büyüt, − Küçült, Tam Ekran düğmeleri |
| Onam sistemi en üste alınıyor | Beklemede | Hasta akışı |
| Detaylı onam raporu (hekim panel) | Beklemede | Hekim paneli |
| Fiyat → Düşük/Orta/Yüksek | Tamamlandı | DisGelecek.jsx — SenaryoKarti |
| Hekim paneli fiyatlandırma kaldırılıyor | Tamamlandı | DoctorModules.jsx — zaten ücret yok |
| Online görüşme aktif + test | Tamamlandı | VideoVisit.jsx — Test modu eklendi |
| "Hekime Bildir" butonu aktif | Tamamlandı | PatientPanel.jsx — Acil durum kartı |
| Geri alma (undo) işlevi | Tamamlandı | PatientPanel.jsx — Geri Al düğmesi |
| Röntgen dosyalama/archive | Tamamlandı | RontgenArsivi.jsx — /hekim/rontgen-arşivi |
| Mail hatırlatma servisi | Tamamlandı | Bildirim servisi + mail entegrasyonu — /api/email (Resend kuyruğu) |
| Cep/SMS hatırlatma servisi | Tamamlandı | Bildirim servisi + SMS entegrasyonu — /api/sms (Twilio kuyruğu) + /api/reminders cron |
| Geri bildirim değerlendirme | Tamamlandı | Doktor geri bildirimleri gece oturumunda değerlendirildi |

---

Bu liste progres ile güncellenmelidir; tamamlanan öğeler işaretlenip Yeni TDD/test kapsamına alınmalıdır.