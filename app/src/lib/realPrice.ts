import type { AppSettings } from '../db/schema'
import { formatHours, formatPercent } from './money'

// Az absztrakt ár konkréttá tétele: munkaóra-egyenérték és a saját
// megtakarítási cél százaléka.

export function hourlyWage(settings: AppSettings): number | null {
  if (settings.netHourlyWage && settings.netHourlyWage > 0) return settings.netHourlyWage
  if (settings.netMonthlyIncome && settings.weeklyWorkHours) {
    const monthlyHours = (settings.weeklyWorkHours * 52) / 12
    if (monthlyHours > 0) return settings.netMonthlyIncome / monthlyHours
  }
  return null
}

export function workHoursFor(price: number, settings: AppSettings): number | null {
  const wage = hourlyWage(settings)
  return wage ? price / wage : null
}

export function goalPercent(price: number, settings: AppSettings): number | null {
  const { savingsGoalAmount, savingsGoalSaved } = settings
  if (!savingsGoalAmount || savingsGoalAmount <= 0) return null
  const remaining = savingsGoalAmount - (savingsGoalSaved ?? 0)
  if (remaining <= 0) return null
  return price / remaining
}

export interface RealPrice {
  workHoursText?: string
  goalText?: string
}

export function realPriceTexts(price: number, settings: AppSettings): RealPrice {
  const out: RealPrice = {}
  const hours = workHoursFor(price, settings)
  if (hours !== null) out.workHoursText = `≈ ${formatHours(hours)} munkaóra`
  const pct = goalPercent(price, settings)
  if (pct !== null) {
    const goalName = settings.savingsGoalName || 'a megtakarítási célod'
    out.goalText = `${goalName} hátralévő részének ${formatPercent(pct)}-a`
  }
  return out
}
