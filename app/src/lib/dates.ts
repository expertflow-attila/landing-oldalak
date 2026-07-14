// Minden dátum 'YYYY-MM-DD' string, hónapkulcs 'YYYY-MM'.
// Sosem konstruálunk new Date('YYYY-MM-DD')-t megjelenítéshez (UTC-csapda);
// a naptári aritmetika UTC-délhez horgonyzott, így DST-biztos.

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1) return false
  return d <= daysInMonth(y, m)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function currentMonthKey(): string {
  return monthKey(todayIso())
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${pad2(nm)}`
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const names = [
    'január', 'február', 'március', 'április', 'május', 'június',
    'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
  ]
  return `${y}. ${names[m - 1]}`
}

function toUtcNoon(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Date.UTC(y, m - 1, d, 12)
}

const DAY_MS = 24 * 60 * 60 * 1000

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtcNoon(toIso) - toUtcNoon(fromIso)) / DAY_MS)
}

export function addDays(isoDate: string, delta: number): string {
  const d = new Date(toUtcNoon(isoDate) + delta * DAY_MS)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** 0 = hétfő … 6 = vasárnap (magyar konvenció). */
export function dayOfWeek(isoDate: string): number {
  const jsDay = new Date(toUtcNoon(isoDate)).getUTCDay()
  return (jsDay + 6) % 7
}

export function isWeekend(isoDate: string): boolean {
  return dayOfWeek(isoDate) >= 5
}

export function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10))
}

export function formatDateHu(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${y}. ${m}. ${d}.`
}

/**
 * Banki dátumformátumok parse-olása ISO stringgé.
 * Támogatott: 'YYYY.MM.DD.' | 'YYYY.MM.DD' | 'YYYY-MM-DD' | 'DD/MM/YYYY' |
 * 'DD.MM.YYYY' | 'YYYY/MM/DD' | ISO datetime.
 */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim()
  let m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})\.?(?:[T ].*)?$/)
  if (m) return buildIso(m[1], m[2], m[3])
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})\.?$/)
  if (m) return buildIso(m[3], m[2], m[1])
  return null
}

function buildIso(y: string, mo: string, d: string): string | null {
  const iso = `${y}-${pad2(Number(mo))}-${pad2(Number(d))}`
  return isValidIsoDate(iso) ? iso : null
}

/** ISO datetime-ból 'HH:mm', ha van időkomponens. */
export function extractTimeOfDay(raw: string): string | undefined {
  const m = raw.match(/[T ](\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : undefined
}
