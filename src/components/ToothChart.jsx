// svg-grafik: dis haritasi gorsellestirmesidir; ikon degildir.
import { FDI_UPPER, FDI_LOWER, STATUS_TR } from '../data/teeth.js'

const STATUS_COLOR = {
  saglam: '#dcfce7',
  dolgu: '#fef3c7',
  kanal: '#ffe4e6',
  kaplama: '#dbeafe',
  takip: '#ffedd5',
  cekim: '#e2e8f0',
  implant: '#cffafe'
}

function ToothButton({ no, data, selected, onSelect }) {
  const status = data?.status || 'saglam'
  return (
    <button
      className={'tooth' + (selected === no ? ' sel' : '')}
      onClick={() => onSelect(no)}
      title={`${no} - ${STATUS_TR[status]}`}
      style={{ background: STATUS_COLOR[status] }}
    >
      <span>{no}</span>
      <small>{STATUS_TR[status]}</small>
    </button>
  )
}

export function ToothChart({ teeth = {}, selected, onSelect }) {
  return (
    <div>
      <p className="muted">Üst çene</p>
      <div className="tooth-row">
        {FDI_UPPER.map((no) => (
          <ToothButton key={no} no={no} data={teeth[no]} selected={selected} onSelect={onSelect} />
        ))}
      </div>
      <p className="muted">Alt çene</p>
      <div className="tooth-row">
        {FDI_LOWER.map((no) => (
          <ToothButton key={no} no={no} data={teeth[no]} selected={selected} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

export function ToothVisual({ no, status }) {
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width="132" height="150" viewBox="0 0 120 140">
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#d9ecfc" />
            <stop offset="1" stopColor="#9ec5e6" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="128" rx="36" ry="9" fill="#cbd5e1" opacity="0.7" />
        <path
          d="M30 20 Q30 5 60 5 Q90 5 90 20 Q90 55 78 75 Q72 95 66 120 Q62 130 60 130 Q58 130 54 120 Q48 95 42 75 Q30 55 30 20 Z"
          fill="url(#tg)" stroke="#0b3d5f" strokeWidth="2"
        />
        <path d="M42 18 Q60 12 78 18" stroke="white" strokeWidth="4" fill="none" opacity="0.8" strokeLinecap="round" />
        {status !== 'saglam' && (
          <circle cx="60" cy="45" r="13" fill={status === 'dolgu' ? '#d97706' : '#dc2626'} opacity="0.9" />
        )}
        <text x="60" y="49" textAnchor="middle" fontSize="12" fontWeight="800" fill="white">{no}</text>
      </svg>
      <div>
        <strong style={{ fontSize: 18 }}>{no} nolu diş</strong>
        <div className="muted">Durum: {STATUS_TR[status] || status}</div>
        <div className="muted">İnteraktif diş önizlemesi.</div>
      </div>
    </div>
  )
}
