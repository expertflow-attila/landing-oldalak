import type { AppSettings, Transaction } from '../db/schema'
import { addDays, dayOfMonth, dayOfWeek, daysBetween, monthKey } from './dates'

export interface PaydayInfo {
  dayOfMonth: number
  source: 'setting' | 'inferred'
  confidence: number
}

function mode(nums: number[]): number {
  const counts = new Map<number, number>()
  for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1)
  let best = nums[0]
  let bestCount = 0
  for (const [n, c] of counts) {
    if (c > bestCount) {
      best = n
      bestCount = c
    }
  }
  return best
}

/**
 * Fizetésnap: beállításból, vagy a legnagyobb ismétlődő havi bevételből következtetve.
 */
export function inferPayday(
  transactions: Transaction[],
  settings: AppSettings,
): PaydayInfo | null {
  if (settings.paydayDayOfMonth) {
    return { dayOfMonth: settings.paydayDayOfMonth, source: 'setting', confidence: 1 }
  }

  const incomes = transactions.filter((t) => t.kind === 'income' && t.amount > 0)
  if (incomes.length < 3) return null

  // Havi max bevételek mediánjának fele fölötti tételek = "fizetés-gyanús" bevételek.
  const maxByMonth = new Map<string, number>()
  for (const t of incomes) {
    const m = monthKey(t.date)
    maxByMonth.set(m, Math.max(maxByMonth.get(m) ?? 0, t.amount))
  }
  const monthlyMaxes = [...maxByMonth.values()].sort((a, b) => a - b)
  const medianMax = monthlyMaxes[Math.floor(monthlyMaxes.length / 2)]
  const salaryLike = incomes
    .filter((t) => t.amount >= medianMax * 0.5)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (salaryLike.length < 3) return null

  const intervals: number[] = []
  for (let i = 1; i < salaryLike.length; i++) {
    intervals.push(daysBetween(salaryLike[i - 1].date, salaryLike[i].date))
  }
  const monthlyish = intervals.filter((d) => d >= 25 && d <= 36)
  const regularity = monthlyish.length / intervals.length
  if (regularity < 0.5) return null

  const day = mode(salaryLike.map((t) => dayOfMonth(t.date)))
  return {
    dayOfMonth: Math.min(day, 28),
    source: 'inferred',
    confidence: Math.round(regularity * 100) / 100,
  }
}

/** A legutóbbi fizetésnap ISO dátuma egy adott naphoz képest (hétvége → előző péntek). */
export function lastPaydayBefore(isoDate: string, paydayDay: number): string {
  const ym = monthKey(isoDate)
  let candidate = `${ym}-${String(paydayDay).padStart(2, '0')}`
  if (candidate > isoDate) {
    const [y, m] = ym.split('-').map(Number)
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    candidate = `${prev}-${String(paydayDay).padStart(2, '0')}`
  }
  // Hétvégére eső fizetésnap a gyakorlatban az előző munkanapon érkezik.
  while (dayOfWeek(candidate) >= 5) candidate = addDays(candidate, -1)
  return candidate
}

export function daysSincePayday(isoDate: string, paydayDay: number): number {
  return daysBetween(lastPaydayBefore(isoDate, paydayDay), isoDate)
}
