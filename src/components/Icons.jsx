// Modern SVG ikon seti (Feather/Lucide tarzı, 24x24, currentColor)
// Emoji yerine kullanılır: <Icon size={18} />

const S = ({ children, size = 18, className = '', strokeWidth = 1.8, ...rest }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true" {...rest}
  >{children}</svg>
)

/* --- Marka: TeleDentist diş logosu --- */
export const Logo = ({ size = 32, ...r }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...r}>
    <defs>
      <linearGradient id="tdGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#14b8a6" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#tdGrad)" />
    <path
      d="M24 11c-4.6 0-7.6 3.1-7.6 7.1 0 3 1.9 4.1 2.7 6.6.6 1.9.9 5.3 2.2 5.3 1.4 0 .9-4.2 2.7-4.2s1.3 4.2 2.7 4.2c1.3 0 1.6-3.4 2.2-5.3.8-2.5 2.7-3.6 2.7-6.6C31.6 14.1 28.6 11 24 11z"
      fill="#fff" opacity="0.95"
    />
  </svg>
)

/* --- Diş --- */
export const Tooth = (p) => <S {...p}><path d="M12 5.5C8.7 5.5 6.2 8 6.2 11.2c0 2.5 1.5 3.4 2.2 5.5.5 1.6.8 4.4 1.9 4.4 1.2 0 .8-3.5 2.2-3.5s1 3.5 2.2 3.5c1.1 0 1.4-2.8 1.9-4.4.7-2.1 2.2-3 2.2-5.5C18.8 8 16.3 5.5 12 5.5z" /></S>

export const Home = (p) => <S {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></S>
export const Calendar = (p) => <S {...p}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></S>
export const Clock = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></S>
export const Phone = (p) => <S {...p}><path d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 5.6 5.6l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2C11.4 18.4 5.6 12.6 4.5 5.7a2 2 0 0 1 2-2.2z" /></S>
export const Book = (p) => <S {...p}><path d="M4 5.5A2 2 0 0 1 6 3.5h5v17H6a2 2 0 0 0-2 1.5z" /><path d="M20 5.5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 1.5z" /></S>
export const Help = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.4" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></S>
export const Globe = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M3.2 9.5h17.6M3.2 14.5h17.6" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" /></S>
export const Cap = (p) => <S {...p}><path d="M12 4 2.5 8.5 12 13l9.5-4.5z" /><path d="M6.5 10.8V16c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-5.2" /><path d="M21.5 8.5v5" /></S>

/* --- Kişi / roller --- */
export const User = (p) => <S {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></S>
export const Users = (p) => <S {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" /><path d="M16.5 5.6a3.2 3.2 0 0 1 0 5.9" /><path d="M18 14.6A6.2 6.2 0 0 1 21.2 20" /></S>
export const UserPlus = (p) => <S {...p}><circle cx="9.5" cy="8" r="3.6" /><path d="M3 20.5a6.5 6.5 0 0 1 13 0" /><path d="M18.5 8v6M15.5 11h6" /></S>
export const Stethoscope = (p) => <S {...p}><path d="M6 3v5a4 4 0 0 0 8 0V3" /><path d="M6 3H4.5M14 3h1.5" /><path d="M10 12v2.5a5 5 0 0 0 5 5 2.5 2.5 0 0 0 2.5-2.5V15" /><circle cx="17.5" cy="13" r="2" /></S>
export const Shield = (p) => <S {...p}><path d="M12 3 5 5.8v5.4c0 4.3 3 8.3 7 9.8 4-1.5 7-5.5 7-9.8V5.8z" /><path d="m9.2 12 2 2 3.6-3.8" /></S>
export const Doctor = User

/* --- Klinik --- */
export const Stetho = Stethoscope
export const Clipboard = (p) => <S {...p}><path d="M9 4.5H7.5A1.5 1.5 0 0 0 6 6v13.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15" /><rect x="9" y="3" width="6" height="3.5" rx="1" /><path d="M9 11h6M9 15h4" /></S>
export const Sparkle = (p) => <S {...p}><path d="M12 3.5c.8 4 2.5 5.7 6.5 6.5-4 .8-5.7 2.5-6.5 6.5-.8-4-2.5-5.7-6.5-6.5 4-.8 5.7-2.5 6.5-6.5z" /></S>
export const Drop = (p) => <S {...p}><path d="M12 3.5s5.5 5.6 5.5 9.3A5.5 5.5 0 0 1 12 18.3a5.5 5.5 0 0 1-5.5-5.5C6.5 9.1 12 3.5 12 3.5z" /></S>
export const Camera = (p) => <S {...p}><path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h1.8l1.2-2h6.9l1.2 2h1.9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.4" /></S>
export const Video = (p) => <S {...p}><rect x="2.5" y="6" width="12.5" height="12" rx="2.5" /><path d="m15 11 6.5-3.5v9L15 13z" /></S>
export const Chat = (p) => <S {...p}><path d="M20.5 12c0 4.1-3.8 7.5-8.5 7.5a9.8 9.8 0 0 1-2.6-.3L4 21l1.3-4A7.3 7.3 0 0 1 3.5 12C3.5 7.9 7.3 4.5 12 4.5s8.5 3.4 8.5 7.5z" /></S>
export const FileText = (p) => <S {...p}><path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5z" /><path d="M13.5 3.5V8H18" /><path d="M9 13h6M9 16.5h4" /></S>
export const Chart = (p) => <S {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></S>
export const Gift = (p) => <S {...p}><rect x="3" y="9" width="18" height="12" rx="2" /><path d="M3 13h18M12 9v12" /><path d="M12 9S10.5 4 8 4a2.5 2.5 0 0 0 0 5M12 9s1.5-5 4-5a2.5 2.5 0 0 1 0 5" /></S>
export const Star = (p) => <S {...p}><path d="m12 3.8 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 10l5.9-.9z" /></S>
export const Microscope = (p) => <S {...p}><path d="M9 4h4v7H9z" /><path d="M11 11v3a5 5 0 0 0 5 5h1" /><path d="M6 20h13" /><path d="M9 7h4" /><path d="M14 6.5 19 4" /></S>

/* --- Arayüz --- */
export const Search = (p) => <S {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></S>
export const Plus = (p) => <S {...p}><path d="M12 5v14M5 12h14" /></S>
export const Check = (p) => <S {...p}><path d="m4.5 12.5 5 5 10-11" /></S>
export const CheckCircle = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12.2 2.7 2.7L16 9.5" /></S>
export const Alert = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.3v.2" /></S>
export const Bell = (p) => <S {...p}><path d="M18 15.5V10a6 6 0 1 0-12 0v5.5L4.5 18h15z" /><path d="M9.5 21h5" /></S>
export const ChevronLeft = (p) => <S {...p}><path d="m14.5 5-7 7 7 7" /></S>
export const ChevronRight = (p) => <S {...p}><path d="m9.5 5 7 7-7 7" /></S>
export const ChevronDown = (p) => <S {...p}><path d="m5 9 7 7 7-7" /></S>
export const X = (p) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>
export const LogOut = (p) => <S {...p}><path d="M14 4.5H7.5A1.5 1.5 0 0 0 6 6v12a1.5 1.5 0 0 0 1.5 1.5H14" /><path d="M17 8.5 20.5 12 17 15.5M20 12h-9" /></S>
export const Pin = (p) => <S {...p}><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></S>
export const Save = (p) => <S {...p}><path d="M5 4.5h11L20 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V6a1.5 1.5 0 0 1 1-1.5z" /><path d="M8 4.5v5h7v-5M8 20.5V14h8v6.5" /></S>
export const Lock = (p) => <S {...p}><rect x="4.5" y="10" width="15" height="11" rx="2.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></S>
export const Key = (p) => <S {...p}><circle cx="8" cy="12" r="4" /><path d="M12 12h9M18.5 12v3.5M15.5 12v2.2" /></S>
export const Refresh = (p) => <S {...p}><path d="M20 11.5a8 8 0 1 1-2.5-5.8" /><path d="M20.2 3.5V9h-5.5" /></S>
export const Grid = (p) => <S {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></S>
export const Send = (p) => <S {...p}><path d="M21 3 10.5 13.5" /><path d="M21 3 14.5 21l-4-7.5L3 9.5z" /></S>
export const Eye = (p) => <S {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></S>
export const Mic = (p) => <S {...p}><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21M9 21h6" /></S>
export const MicOff = (p) => <S {...p}><path d="M3 3l18 18" /><path d="M15 9V5.5a3 3 0 0 0-5.9-.7" /><path d="M9 9v2a3 3 0 0 0 4.6 2.5" /><path d="M5.5 11a6.5 6.5 0 0 0 10 5.5M18.5 11v.5" /><path d="M12 17.5V21M9 21h6" /></S>
export const PhoneOff = (p) => <S {...p}><path d="M3 3l18 18" /><path d="M5.5 4.5l2-.7 3.5 7-1.7 1.4a13 13 0 0 0 5 5l1.4-1.7 7 3.5-.7 2" /></S>
export const Copy = (p) => <S {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></S>
export const Settings = (p) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></S>

/* --- Bölüm ikonları --- */
export const DeptRestorative = (p) => <S {...p}><path d="M12 4.5c-2.6 0-4.2 1.8-4.2 4 0 1.8 1.1 2.4 1.6 3.9.4 1.1.6 3 .9 3s.5-2.4.9-2.4.5 2.4.9 2.4c.3 0 .5-1.9.9-3 .5-1.5 1.6-2.1 1.6-3.9 0-2.2-1.6-4-4.2-4z" /><path d="M18.5 9.5 22 13M22 9.5l-3.5 3.5" /></S>
export const DeptEndo = (p) => <S {...p}><path d="M12 4.5c-2.6 0-4.2 1.8-4.2 4 0 1.8 1.1 2.4 1.6 3.9.4 1.1.6 3 .9 3s.5-2.4.9-2.4.5 2.4.9 2.4c.3 0 .5-1.9.9-3 .5-1.5 1.6-2.1 1.6-3.9 0-2.2-1.6-4-4.2-4z" /><path d="M12 13.5v6.5M9.5 17.5h5" /></S>
export const DeptPerio = (p) => <S {...p}><path d="M12 4.5c-2.6 0-4.2 1.8-4.2 4 0 1.8 1.1 2.4 1.6 3.9.4 1.1.6 3 .9 3s.5-2.4.9-2.4.5 2.4.9 2.4c.3 0 .5-1.9.9-3 .5-1.5 1.6-2.1 1.6-3.9 0-2.2-1.6-4-4.2-4z" /><path d="M3 12c2 2 4 3 5.5 3M21 12c-2 2-4 3-5.5 3" /></S>
export const DeptPedo = (p) => <S {...p}><circle cx="12" cy="9" r="4.5" /><path d="M5 20.5a7 7 0 0 1 14 0" /><path d="M10.5 8.5h.01M13.5 8.5h.01" /></S>