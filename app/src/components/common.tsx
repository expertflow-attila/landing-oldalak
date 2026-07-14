import { useEffect, useState } from 'react'
import { formatHuf, parseHufInput } from '../lib/money'
import { monthLabel } from '../lib/dates'
import { realPriceTexts } from '../lib/realPrice'
import type { AppSettings } from '../db/schema'

export function Amount({ value }: { value: number }) {
  return (
    <span className={`amount ${value < 0 ? 'negative' : value > 0 ? 'positive' : ''}`}>
      {formatHuf(value)}
    </span>
  )
}

interface MoneyInputProps {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  id?: string
}

export function MoneyInput({ value, onChange, placeholder, id }: MoneyInputProps) {
  const [text, setText] = useState(value !== null ? String(value) : '')
  useEffect(() => {
    // Külső reset (pl. űrlap-ürítés) követése.
    if (value === null && text !== '' && parseHufInput(text) !== null) setText('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      id={id}
      inputMode="numeric"
      placeholder={placeholder ?? 'pl. 12 500'}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseHufInput(e.target.value))
      }}
    />
  )
}

export function MonthNav({
  month,
  onShift,
}: {
  month: string
  onShift: (delta: number) => void
}) {
  return (
    <div className="month-nav">
      <button className="btn" onClick={() => onShift(-1)} aria-label="Előző hónap">
        ←
      </button>
      <span className="label">{monthLabel(month)}</span>
      <button className="btn" onClick={() => onShift(1)} aria-label="Következő hónap">
        →
      </button>
    </div>
  )
}

export function RealPriceBadge({ price, settings }: { price: number; settings: AppSettings }) {
  const rp = realPriceTexts(price, settings)
  if (!rp.workHoursText && !rp.goalText) return null
  return (
    <span className="badge accent">
      {[rp.workHoursText, rp.goalText].filter(Boolean).join(' · ')}
    </span>
  )
}

export function CountdownBadge({ decideAfter }: { decideAfter: string }) {
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])
  const msLeft = new Date(decideAfter).getTime() - Date.now()
  if (msLeft <= 0) return <span className="badge positive">Letelt a 72 óra — dönthetsz</span>
  const hours = Math.floor(msLeft / 3_600_000)
  const mins = Math.floor((msLeft % 3_600_000) / 60_000)
  return (
    <span className="badge warning">
      Még {hours} ó {mins} p a döntésig
    </span>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>
}
