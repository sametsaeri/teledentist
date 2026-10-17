// KVKK Aydınlatma Metni ve Açık Rıza Bileşeni
//
// YASAL DAYANAK: 6698 sayılı Kişisel Verilerin Korunması Kanunu.
// md. 5/1 "AYDINLATMA YÜKÜMLÜLÜĞÜ" — veri sorumlularının, veri sahibinin
// kişisel verilerinin işlenip işlenmeyeceği, amaçları ve hukuki sebebi
// hakkında bilgilendirme yapması gerekir.
//
// YASAL DAYANAK: 6698 md. 3 ve md. 5/1 "AÇIK RIZA" — sağlık verileri
// özel nitelikli veridir; işlenmesi için açık rıza veya kanun gereği
// istisna gerekir. Bu nedenle form, metin okunmadan gönderilemez.
//
// ÖNEMLİ: Rıza metni kayıt tarihiyle birlikte SUNUCUDA saklanır.
// Tarayıcıda tutmak kanuni olarak geçersizdir (bkz. db.js kayıt notu).
import { useState } from 'react'
import { Shield, Check, Lock, Alert } from '../components/Icons.jsx'

/** Rıza metninin sürümü. Metin değişirse sürüm artar; eski kayıtlar geçerli kalır. */
export const KVKK_SURUM = '1.0'

/** Kayıt anında saklanan onay kaydı (kanıt değeri taşır). */
export function rizaKaydi({ ad, kvkkSurum = KVKK_SURUM } = {}) {
  return {
    kvkk_onay: true,
    kvkk_surum: kvkkSurum,
    kvkk_zaman: new Date().toISOString(),
    kvkk_ip_notu: 'kayıt anındaki oturum',
    kvkk_versiyon_metni: '6698 sayılı Kanun / Aydınlatma Metni v' + kvkkSurum
  }
}

/**
 * KVKK onay kutusu.
 *
 * KURAL: onay işaretlenmeden "Talebi Gönder" düğmesi ETKİNLEŞMEZ.
 * Kutu boşken düğme `disabled` olur; ayrıca submit sırasında da
 * doğrulanır (ekran klavyesi / tarayıcı formu ile atlatılmasın).
 */
export function KvkkOnay({ onayli, degis }) {
  const [acik, setAcik] = useState(false)
  const [okundu, setOkundu] = useState(false)

  return (
    <div className="kvkk-kutu">
      <div className="kvkk-baslik">
        <Lock size={15} />
        <b>Kişisel Verilerin Korunması (KVKK) Aydınlatma Metni</b>
        <span className="kvkk-surum">v{KVKK_SURUM}</span>
      </div>

      <button type="button" className="ghost kvkk-ac" onClick={() => setAcik(!acik)}>
        {acik ? 'Metni kapat' : 'Aydınlatma metnini oku'}
      </button>

      {/* Metni görüntülemeden onay verilemez */}
      {!okundu && (
        <p className="kvkk-uyari">
          <Alert size={14} /> Devam etmek için metni açıp okuduğunuzu onaylayın.
        </p>
      )}

      {acik && (
        <div className="kvkk-metin">
          <h4>1. Veri sorumlusu</h4>
          <p>
            Kişisel verilerinizin işlenmesinden sorumlu kişi, TeleDentist
            (Karadeniz Teknik Üniversitesi Diş Hekimliği öğrencisi çalışması)
            projesi kapsamında işletilen randevu ve hasta takip hizmetidir.
          </p>

          <h4>2. İşlenen kişisel veriler ve amaçları</h4>
          <p>
            Ad soyad, e-posta adresi, telefon numarası, adres bilgileri, T.C.
            kimlik numarası, doğum tarihi ve <b>sağlık verileriniz</b>
            (anamnez, anamnez kapsamındaki geçmiş hastalık bilgileriniz,
            alerji ve ilaç bilgileriniz, diş muayenesi kayıtları, radyolojik
            görüntüler) aşağıdaki amaçlarla işlenir:
          </p>
          <ul>
            <li>Randevu planlaması ve hatırlatmaların yapılması</li>
            <li>Diş tedavisi planlaması ve tedavi sürecinin takibi</li>
            <li>Size özel diş sağlığı önerileri üretilmesi</li>
            <li>Yasal saklama yükümlülüklerinin yerine getirilmesi</li>
          </ul>

          <h4>3. Hukuki sebep</h4>
          <p>
            Sağlık verileriniz <b>özel nitelikli kişisel veridir</b> (KVKK md. 6).
            Bu verilerin işlenmesi <b>açık rızanıza</b> dayanmaktadır (KVKK md. 5/1).
            Rızanızı vermeden kayıt talebiniz oluşturulamaz.
          </p>

          <h4>4. Aktarım</h4>
          <p>
            Verileriniz üçüncü kişilere satılmaz veya reklam amacıyla
            paylaşılmaz. Yalnızca tedavi ve hizmet sunumu için gerekli
            olduğu ölçüde, yürürlükteki mevzuatta öngörülen kişilerle
            paylaşılabilir.
          </p>

          <h4>5. Saklama süresi</h4>
          <p>
            Kayıtlarınız, sağlık hizmetine ilişkin mevzuatta öngörülen süre
            boyunca ve yasal saklama yükümlülüğü sona erene kadar muhafaza edilir.
          </p>

          <h4>6. Haklarınız (KVKK md. 11)</h4>
          <p>
            Kanunun 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini
            öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme,
            işlemenin sınırlandırılmasını talep etme ve verilerinizin
            üçüncü kişilere aktarılıp aktarılmadığını öğrenme haklarına
            sahipsiniz. Bu haklarınızı klinik yönetimine başvurarak
            kullanabilirsiniz.
          </p>

          <h4>7. Rızanızı geri alma</h4>
          <p>
            Rızanızı dilediğiniz zaman geri çekebilirsiniz. Geri çekme,
            geri çekmeden önce yapılan işlemlerin geçerliliğini etkilemez.
          </p>

          <div className="kvkk-metin-alt">
            <button
              type="button"
              className="kvkk-okudum"
              onClick={() => { setOkundu(true); setAcik(false) }}
            >
              <Check size={15} /> Metni okudum ve anladım
            </button>
          </div>
        </div>
      )}

      <label className={`kvkk-onay ${okundu ? '' : 'pasif'}`}>
        <input
          type="checkbox"
          checked={!!onayli}
          disabled={!okundu}
          onChange={(e) => degis(e.target.checked)}
        />
        <span>
          Yukarıdaki Kişisel Verilerin Korunması (KVKK) Aydınlatma Metnini
          okudum; <b>kişisel ve sağlık verilerimin randevu ve tedavi amacıyla
          işlenmesine açık rıza veriyorum.</b>
        </span>
      </label>
    </div>
  )
}

export default KvkkOnay