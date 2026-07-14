import type { Cadence, RecurringSeries, Transaction } from '../db/schema'
import { addDays, daysBetween } from './dates'
import { db } from '../db'

export interface DetectedSeries {
  normalizedPayee: string
  displayName: string
  categoryId?: number
  cadence: Cadence
  avgAmount: number
  lastSeen: string
  nextExpected: string
  occurrenceCount: number
  confidence: number
}

const MIN_CONFIDENCE = 0.55

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function stdev(nums: number[]): number {
  if (nums.length < 2) return 0
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length - 1)
  return Math.sqrt(variance)
}

function cadenceOf(medianInterval: number): Cadence | null {
  if (medianInterval >= 6 && medianInterval <= 8) return 'weekly'
  if (medianInterval >= 26 && medianInterval <= 33) return 'monthly'
  if (medianInterval >= 350 && medianInterval <= 380) return 'yearly'
  return null
}

/** Összeg-klaszterezés: előfizetések ára kúszik, ±10% (min. 200 Ft) tűrés. */
function clusterByAmount(txs: Transaction[]): Transaction[][] {
  const clusters: Transaction[][] = []
  for (const tx of [...txs].sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))) {
    const abs = Math.abs(tx.amount)
    const cluster = clusters.find((c) => {
      const ref = c.reduce((s, t) => s + Math.abs(t.amount), 0) / c.length
      return Math.abs(abs - ref) <= Math.max(200, ref * 0.1)
    })
    if (cluster) cluster.push(tx)
    else clusters.push([tx])
  }
  return clusters
}

/**
 * Ismétlődő kiadássorozatok detektálása (előfizetések, rendszeres díjak).
 * Bemenet: tetszőleges tranzakciólista — belül szűr kiadásokra.
 */
export function detectRecurring(transactions: Transaction[]): DetectedSeries[] {
  const expenses = transactions.filter((t) => t.kind === 'expense')
  const byPayee = new Map<string, Transaction[]>()
  for (const tx of expenses) {
    if (!tx.normalizedPayee) continue
    const list = byPayee.get(tx.normalizedPayee) ?? []
    list.push(tx)
    byPayee.set(tx.normalizedPayee, list)
  }

  const out: DetectedSeries[] = []
  for (const [payee, group] of byPayee) {
    for (const cluster of clusterByAmount(group)) {
      const series = analyseCluster(payee, cluster)
      if (series) out.push(series)
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence)
}

function analyseCluster(payee: string, cluster: Transaction[]): DetectedSeries | null {
  const sorted = [...cluster].sort((a, b) => a.date.localeCompare(b.date))
  const dates = sorted.map((t) => t.date)
  const intervals: number[] = []
  for (let i = 1; i < dates.length; i++) intervals.push(daysBetween(dates[i - 1], dates[i]))
  if (intervals.length === 0) return null

  const med = median(intervals)
  const cadence = cadenceOf(med)
  if (!cadence) return null

  // Évesnél 2 előfordulás is elég, egyébként legalább 3 kell.
  const minOccurrences = cadence === 'yearly' ? 2 : 3
  if (sorted.length < minOccurrences) return null

  const regularity = 1 - Math.min(1, Math.max(0, med === 0 ? 1 : stdev(intervals) / med))
  const amounts = sorted.map((t) => Math.abs(t.amount))
  const avgAmount = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length)
  const spread = (Math.max(...amounts) - Math.min(...amounts)) / avgAmount
  const confidence =
    0.5 * regularity + 0.3 * Math.min(sorted.length / 6, 1) + 0.2 * (spread <= 0.1 ? 1 : 0.5)
  if (confidence < MIN_CONFIDENCE) return null

  const last = sorted[sorted.length - 1]
  return {
    normalizedPayee: payee,
    displayName: last.payee,
    categoryId: last.categoryId,
    cadence,
    avgAmount,
    lastSeen: last.date,
    nextExpected: addDays(last.date, Math.round(med)),
    occurrenceCount: sorted.length,
    confidence: Math.round(confidence * 100) / 100,
  }
}

/** Havi egyenérték-költség egy sorozathoz. */
export function monthlyEquivalent(series: Pick<RecurringSeries, 'cadence' | 'avgAmount'>): number {
  switch (series.cadence) {
    case 'weekly':
      return Math.round((series.avgAmount * 52) / 12)
    case 'monthly':
      return series.avgAmount
    case 'yearly':
      return Math.round(series.avgAmount / 12)
  }
}

/**
 * Detektált sorozatok szinkronizálása a recurringSeries táblába
 * a felhasználó korábbi döntéseinek (status, dismissed) megőrzésével.
 */
export async function syncRecurringSeries(transactions: Transaction[]): Promise<void> {
  const detected = detectRecurring(transactions)
  // Payee-nként a legmagasabb konfidenciájú klaszter nyer (unique index a táblán).
  const bestByPayee = new Map<string, DetectedSeries>()
  for (const s of detected) {
    if (!bestByPayee.has(s.normalizedPayee)) bestByPayee.set(s.normalizedPayee, s)
  }

  await db.transaction('rw', db.recurringSeries, async () => {
    const existing = await db.recurringSeries.toArray()
    const existingByPayee = new Map(existing.map((s) => [s.normalizedPayee, s]))

    for (const s of bestByPayee.values()) {
      const prior = existingByPayee.get(s.normalizedPayee)
      if (prior) {
        await db.recurringSeries.update(prior.id!, {
          displayName: s.displayName,
          categoryId: s.categoryId ?? prior.categoryId,
          cadence: s.cadence,
          avgAmount: s.avgAmount,
          lastSeen: s.lastSeen,
          nextExpected: s.nextExpected,
          occurrenceCount: s.occurrenceCount,
          confidence: s.confidence,
        })
      } else {
        await db.recurringSeries.add({ ...s, status: 'unreviewed' })
      }
    }
  })
}
