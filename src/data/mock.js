export const demoUsers = [
  { id: 'h1', role: 'hasta', email: 'hasta@demo', name: 'Demo Hasta', lastVisit: '2026-04-10', treatmentType: 'dolgu', plaqueIndex: 1.2, anxietyScore: 4 },
  { id: 'h2', role: 'hasta', email: 'ayse@demo', name: 'Ayşe Demo', lastVisit: '2026-02-15', treatmentType: 'kanal', plaqueIndex: 2.4, anxietyScore: 8 },
  { id: 'e1', role: 'ebeveyn', email: 'ebeveyn@demo', name: 'Demo Ebeveyn', children: ['h1'] },
  { id: 'd1', role: 'hekim', email: 'hekim@demo', name: 'Dt. Demo Hekim' }
]

export const demoReports = [
  { id: 'r1', patientId: 'h1', title: 'Muayene Raporu - Nisan', date: '2026-04-10', note: 'Üst çene dolgu, 6 ay kontrol önerildi.' },
  { id: 'r2', patientId: 'h2', title: 'Kanal Tedavi Raporu', date: '2026-02-15', note: '36 nolu dişe kanal tedavi, 3 ay takip.' }
]

// FDI numaralı diş kayıtları: status = saglam | dolgu | kanal | kaplama | cekim | takip | implant
export const demoTeeth = {
  h1: {
    16: { status: 'dolgu', treatment: 'Kompozit dolgu', date: '2026-04-10', doctorNote: '16 nolu üst sağ azı dişi: derin çürük temizlendi, kompozit dolgu yapıldı. Sert gıdada 1 hafta dikkat.', xray: null },
    36: { status: 'takip', treatment: 'Gözlem', date: '2026-04-10', doctorNote: '36 nolu alt sol azı: mine çatlağı şüphesi, takip. Hassasiyet olursa erken gel.', xray: null },
    11: { status: 'saglam', treatment: '-', date: '-', doctorNote: 'Sağlam, rutin fırçalama yeterli.', xray: null }
  },
  h2: {
    36: { status: 'kanal', treatment: 'Kanal tedavisi', date: '2026-02-15', doctorNote: '36 nolu azı dişi kanal tedavisi tamamlandı. Kaplama önerilir, 3 ay kontrol.', xray: null },
    26: { status: 'dolgu', treatment: 'Amalgam değişim', date: '2026-02-15', doctorNote: '26 nolu azı: eski dolgu yenilendi.', xray: null }
  }
}

export const FDI_UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28]
export const FDI_LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]

export const STATUS_TR = {
  saglam: 'Sağlam',
  dolgu: 'Dolgu',
  kanal: 'Kanal Tedavili',
  kaplama: 'Kaplama',
  takip: 'Takipte',
  cekim: 'Çekim',
  implant: 'İmplant'
}
