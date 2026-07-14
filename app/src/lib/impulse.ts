import type { Category, Transaction } from '../db/schema'
import { formatHuf } from './money'
import { addDays, isWeekend, todayIso } from './dates'
import { daysSincePayday } from './payday'

// Zajszűrés: kis személyes adathalmazon csak elég mintából és elég nagy
// hatásméretnél mondunk bármit — tényt közlünk, nem ítélkezünk.
const MIN_SAMPLES = 8
const MIN_EFFECT = 1.3

export interface Insight {
  id: string
  textHu: string
  /** 0..1 — rendezéshez. */
  weight: number
}

export interface RiskFlag {
  id: string
  textHu: string
}

interface BucketStat {
  n: number
  total: number
  avg: number
}

export interface ImpulseProfile {
  weekend: BucketStat
  weekday: BucketStat
  byTimeBucket: Map<string, BucketStat>
  byPaydayBucket: Map<string, BucketStat>
  merchantBursts: { payee: string; displayName: string; count: number; windowDays: number }[]
  paydayDay: number | null
}

const TIME_BUCKETS: { id: string; label: string; from: number; to: number }[] = [
  { id: 'morning', label: 'délelőtt (5–11)', from: 5, to: 11 },
  { id: 'midday', label: 'napközben (11–15)', from: 11, to: 15 },
  { id: 'afternoon', label: 'délután (15–19)', from: 15, to: 19 },
  { id: 'evening', label: 'este (19–24)', from: 19, to: 24 },
  { id: 'night', label: 'éjszaka (0–5)', from: 0, to: 5 },
]

const PAYDAY_BUCKETS: { id: string; label: string; from: number; to: number }[] = [
  { id: 'pd0_3', label: 'fizetés utáni 0–3. nap', from: 0, to: 3 },
  { id: 'pd4_10', label: 'fizetés utáni 4–10. nap', from: 4, to: 10 },
  { id: 'pd11_20', label: 'fizetés utáni 11–20. nap', from: 11, to: 20 },
  { id: 'pd21', label: 'fizetés utáni 21. naptól', from: 21, to: 99 },
]

function stat(txs: Transaction[]): BucketStat {
  const total = txs.reduce((s, t) => s + Math.abs(t.amount), 0)
  return { n: txs.length, total, avg: txs.length ? total / txs.length : 0 }
}

export function buildImpulseProfile(
  transactions: Transaction[],
  categories: Category[],
  paydayDay: number | null,
): ImpulseProfile {
  const discretionaryIds = new Set(
    categories.filter((c) => c.discretionary === 1).map((c) => c.id!),
  )
  const cutoff = addDays(todayIso(), -183)
  const disc = transactions.filter(
    (t) =>
      t.kind === 'expense' &&
      t.categoryId !== undefined &&
      discretionaryIds.has(t.categoryId) &&
      t.date >= cutoff,
  )

  const byTimeBucket = new Map<string, BucketStat>()
  for (const b of TIME_BUCKETS) {
    const txs = disc.filter((t) => {
      if (!t.timeOfDay) return false
      const h = Number(t.timeOfDay.slice(0, 2))
      return h >= b.from && h < b.to
    })
    byTimeBucket.set(b.id, stat(txs))
  }

  const byPaydayBucket = new Map<string, BucketStat>()
  if (paydayDay) {
    for (const b of PAYDAY_BUCKETS) {
      const txs = disc.filter((t) => {
        const d = daysSincePayday(t.date, paydayDay)
        return d >= b.from && d <= b.to
      })
      byPaydayBucket.set(b.id, stat(txs))
    }
  }

  // Merchant-burst: ugyanaz a partner ≥3× egy 7 napos ablakban.
  const byPayee = new Map<string, Transaction[]>()
  for (const t of disc) {
    const list = byPayee.get(t.normalizedPayee) ?? []
    list.push(t)
    byPayee.set(t.normalizedPayee, list)
  }
  const merchantBursts: ImpulseProfile['merchantBursts'] = []
  for (const [payee, txs] of byPayee) {
    const dates = txs.map((t) => t.date).sort()
    for (let i = 0; i + 2 < dates.length; i++) {
      if (addDays(dates[i], 7) >= dates[i + 2]) {
        merchantBursts.push({
          payee,
          displayName: txs[0].payee,
          count: dates.length,
          windowDays: 7,
        })
        break
      }
    }
  }

  return {
    weekend: stat(disc.filter((t) => isWeekend(t.date))),
    weekday: stat(disc.filter((t) => !isWeekend(t.date))),
    byTimeBucket,
    byPaydayBucket,
    merchantBursts,
    paydayDay,
  }
}

function ratioHu(r: number): string {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(r)
}

/** Megfigyelés-stílusú insightok a profilból — csak elég erős jel esetén. */
export function insightsFrom(profile: ImpulseProfile): Insight[] {
  const out: Insight[] = []

  const { weekend, weekday } = profile
  if (weekend.n >= MIN_SAMPLES && weekday.n >= MIN_SAMPLES && weekday.avg > 0) {
    const ratio = weekend.avg / weekday.avg
    if (ratio >= MIN_EFFECT) {
      out.push({
        id: 'weekend',
        textHu: `A hétvégi vásárlásaid átlaga ${ratioHu(ratio)}× magasabb, mint hétköznap (${formatHuf(weekend.avg)} vs. ${formatHuf(weekday.avg)}).`,
        weight: Math.min(1, ratio / 3),
      })
    }
  }

  const timeStats = [...profile.byTimeBucket.entries()].filter(([, s]) => s.n >= MIN_SAMPLES)
  if (timeStats.length >= 2) {
    const totalN = timeStats.reduce((s, [, b]) => s + b.n, 0)
    const overallAvg = timeStats.reduce((s, [, b]) => s + b.total, 0) / totalN
    for (const [id, s] of timeStats) {
      if (overallAvg > 0 && s.avg / overallAvg >= MIN_EFFECT) {
        const label = TIME_BUCKETS.find((b) => b.id === id)!.label
        out.push({
          id: `time_${id}`,
          textHu: `A ${label} időszakban átlagosan ${ratioHu(s.avg / overallAvg)}× nagyobb összegeket költesz, mint máskor.`,
          weight: Math.min(1, s.avg / overallAvg / 3),
        })
      }
    }
  }

  const pdStats = [...profile.byPaydayBucket.entries()].filter(([, s]) => s.n >= MIN_SAMPLES)
  if (pdStats.length >= 2) {
    const totalSpend = pdStats.reduce((s, [, b]) => s + b.total, 0)
    for (const [id, s] of pdStats) {
      const share = s.total / totalSpend
      if (share >= 0.45) {
        const label = PAYDAY_BUCKETS.find((b) => b.id === id)!.label
        out.push({
          id: `payday_${id}`,
          textHu: `A szabadon elkölthető pénzed ${Math.round(share * 100)}%-a a ${label} időszakban megy el.`,
          weight: share,
        })
      }
    }
  }

  for (const burst of profile.merchantBursts.slice(0, 3)) {
    out.push({
      id: `burst_${burst.payee}`,
      textHu: `${burst.displayName}: legalább 3 vásárlás egyetlen héten belül az elmúlt fél évben.`,
      weight: 0.5,
    })
  }

  return out.sort((a, b) => b.weight - a.weight)
}

/** A "Megvegyem?" flow pillanatnyi kockázati jelzései (most vagyunk-e mintázatban). */
export function riskFlagsFor(
  now: { date: string; hour: number },
  profile: ImpulseProfile,
  insights: Insight[],
): RiskFlag[] {
  const flags: RiskFlag[] = []

  if (isWeekend(now.date) && insights.some((i) => i.id === 'weekend')) {
    flags.push({
      id: 'weekend_now',
      textHu: 'Most hétvége van — az adataid szerint ilyenkor szoktál nagyobb összegeket költeni.',
    })
  }

  const bucket = TIME_BUCKETS.find((b) => now.hour >= b.from && now.hour < b.to)
  if (bucket && insights.some((i) => i.id === `time_${bucket.id}`)) {
    flags.push({
      id: 'time_now',
      textHu: `A mostani időszak (${bucket.label}) az adataid szerint az impulzívabb sávjaid közé tartozik.`,
    })
  }

  if (profile.paydayDay) {
    const d = daysSincePayday(now.date, profile.paydayDay)
    const pdBucket = PAYDAY_BUCKETS.find((b) => d >= b.from && d <= b.to)
    if (pdBucket && insights.some((i) => i.id === `payday_${pdBucket.id}`)) {
      flags.push({
        id: 'payday_now',
        textHu: `${d} nappal vagy fizetés után — az adataid szerint ebben a sávban költesz a legtöbbet.`,
      })
    }
  }

  return flags
}
