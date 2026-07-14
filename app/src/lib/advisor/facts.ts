import type {
  Account,
  AppSettings,
  BudgetEntry,
  Category,
  RecurringSeries,
  Transaction,
  WishlistItem,
} from '../../db/schema'
import { addDays, todayIso } from '../dates'
import { envelopeStates, type EnvelopeState } from '../budgetMath'
import { currentMonthKey } from '../dates'
import { findSimilar, similarityScore, SIMILARITY_THRESHOLD } from '../similarity'
import {
  buildImpulseProfile,
  insightsFrom,
  riskFlagsFor,
  type Insight,
  type RiskFlag,
} from '../impulse'
import { inferPayday } from '../payday'
import { realPriceTexts, type RealPrice } from '../realPrice'

// A "Megvegyem?" flow tényeit gyűjti össze determinisztikusan.
// Ez a JSON megy az (opcionális) LLM-nek is — nyers tranzakciódump soha.

export interface PlannedPurchase {
  name: string
  categoryId?: number
  price: number
}

export interface SimilarPastBuy {
  payee: string
  date: string
  amount: number
  matchType: 'name' | 'category'
}

export interface PurchaseFacts {
  purchase: PlannedPurchase
  categoryName?: string
  similarBuys: SimilarPastBuy[]
  similarBuysTotal: number
  droppedWishes: { name: string; decidedAt?: string }[]
  envelope?: EnvelopeState & { categoryName: string }
  riskFlags: RiskFlag[]
  insights: Insight[]
  realPrice: RealPrice
  similarSubscription?: { displayName: string; avgAmount: number }
}

export interface FactsInput {
  transactions: Transaction[]
  wishlistItems: WishlistItem[]
  categories: Category[]
  budgetEntries: BudgetEntry[]
  accounts: Account[]
  recurringSeries: RecurringSeries[]
  settings: AppSettings
}

export function gatherFacts(purchase: PlannedPurchase, input: FactsInput): PurchaseFacts {
  const { transactions, wishlistItems, categories, budgetEntries, recurringSeries, settings } =
    input
  const today = todayIso()
  const sixMonthsAgo = addDays(today, -183)

  const recentExpenses = transactions.filter(
    (t) => t.kind === 'expense' && t.date >= sixMonthsAgo,
  )
  const matches = findSimilar(
    { name: purchase.name, categoryId: purchase.categoryId },
    recentExpenses,
    (t) => t.payee,
    (t) => t.categoryId,
  )
  const similarBuys: SimilarPastBuy[] = matches.slice(0, 8).map((m) => ({
    payee: m.item.payee,
    date: m.item.date,
    amount: Math.abs(m.item.amount),
    matchType: m.matchType,
  }))
  const nameMatchTotal = matches
    .filter((m) => m.matchType === 'name')
    .reduce((s, m) => s + Math.abs(m.item.amount), 0)

  const droppedWishes = wishlistItems
    .filter(
      (w) =>
        w.status === 'decided_drop' &&
        similarityScore(purchase.name, w.name) >= SIMILARITY_THRESHOLD,
    )
    .map((w) => ({ name: w.name, decidedAt: w.decidedAt }))

  let envelope: PurchaseFacts['envelope']
  const categoryName = categories.find((c) => c.id === purchase.categoryId)?.name
  if (purchase.categoryId !== undefined) {
    const state = envelopeStates(currentMonthKey(), budgetEntries, transactions).get(
      purchase.categoryId,
    )
    if (state && categoryName) envelope = { ...state, categoryName }
  }

  const payday = inferPayday(transactions, settings)
  const profile = buildImpulseProfile(transactions, categories, payday?.dayOfMonth ?? null)
  const insights = insightsFrom(profile)
  const riskFlags = riskFlagsFor(
    { date: today, hour: new Date().getHours() },
    profile,
    insights,
  )

  const similarSub = recurringSeries.find(
    (s) =>
      s.status !== 'cancelled' &&
      s.dismissed !== 1 &&
      similarityScore(purchase.name, s.displayName) >= SIMILARITY_THRESHOLD,
  )

  return {
    purchase,
    categoryName,
    similarBuys,
    similarBuysTotal: nameMatchTotal,
    droppedWishes,
    envelope,
    riskFlags,
    insights: insights.slice(0, 3),
    realPrice: realPriceTexts(purchase.price, settings),
    similarSubscription: similarSub
      ? { displayName: similarSub.displayName, avgAmount: similarSub.avgAmount }
      : undefined,
  }
}
