import type { Account, BudgetEntry, Transaction } from '../db/schema'
import { monthKey } from './dates'

// Boríték-egyenlegek kumulatív összegekből: a maradvány (carryover)
// automatikusan öröklődik hónapról hónapra.

export interface EnvelopeState {
  categoryId: number
  /** Az adott hónapban hozzárendelt összeg. */
  assigned: number
  /** Az adott hónap költése (pozitív számként). */
  spent: number
  /** Kumulatív boríték-egyenleg a hónap végén (carryoverrel). */
  balance: number
  overspent: boolean
}

/** Költés-aggregátumokhoz közös szűrő: átvezetés sosem költés. */
export function selectSpending(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.kind === 'expense')
}

export function envelopeStates(
  month: string,
  budgetEntries: BudgetEntry[],
  transactions: Transaction[],
): Map<number, EnvelopeState> {
  const spending = selectSpending(transactions)
  const states = new Map<number, EnvelopeState>()

  const categoryIds = new Set<number>()
  for (const e of budgetEntries) categoryIds.add(e.categoryId)
  for (const t of spending) if (t.categoryId !== undefined) categoryIds.add(t.categoryId)

  for (const categoryId of categoryIds) {
    let assignedCum = 0
    let assignedThis = 0
    for (const e of budgetEntries) {
      if (e.categoryId !== categoryId || e.month > month) continue
      assignedCum += e.assigned
      if (e.month === month) assignedThis += e.assigned
    }
    let spentCum = 0
    let spentThis = 0
    for (const t of spending) {
      if (t.categoryId !== categoryId) continue
      const m = monthKey(t.date)
      if (m > month) continue
      spentCum += Math.abs(t.amount)
      if (m === month) spentThis += Math.abs(t.amount)
    }
    const balance = assignedCum - spentCum
    states.set(categoryId, {
      categoryId,
      assigned: assignedThis,
      spent: spentThis,
      balance,
      overspent: balance < 0,
    })
  }
  return states
}

/**
 * "Beosztható" összeg egy hónapra: az addig beérkezett összes pénz
 * (nyitóegyenlegek + bevételek) mínusz az összes valaha hozzárendelt keret.
 * Negatív = többet osztottál be, mint amennyi pénzed van.
 */
export function toBudget(
  month: string,
  accounts: Account[],
  budgetEntries: BudgetEntry[],
  transactions: Transaction[],
): number {
  const starting = accounts.reduce((s, a) => s + a.startingBalance, 0)
  let income = 0
  for (const t of transactions) {
    if (t.kind === 'income' && monthKey(t.date) <= month) income += t.amount
  }
  let assigned = 0
  for (const e of budgetEntries) {
    if (e.month <= month) assigned += e.assigned
  }
  return starting + income - assigned
}

/** Számlaegyenleg: nyitóegyenleg + minden tranzakció (átvezetésekkel együtt). */
export function accountBalance(account: Account, transactions: Transaction[]): number {
  let balance = account.startingBalance
  for (const t of transactions) {
    if (t.accountId === account.id) balance += t.amount
  }
  return balance
}

export interface CategorySpend {
  categoryId: number
  spent: number
}

/** Havi költés kategóriánként (dashboard chartokhoz). */
export function spendingByCategory(
  month: string,
  transactions: Transaction[],
): CategorySpend[] {
  const totals = new Map<number, number>()
  for (const t of selectSpending(transactions)) {
    if (monthKey(t.date) !== month) continue
    const key = t.categoryId ?? -1
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(t.amount))
  }
  return [...totals.entries()]
    .map(([categoryId, spent]) => ({ categoryId, spent }))
    .sort((a, b) => b.spent - a.spent)
}

/** Az utolsó N hónap összköltése (trend charthoz). */
export function monthlyTotals(
  months: string[],
  transactions: Transaction[],
): { month: string; spent: number; income: number }[] {
  return months.map((month) => {
    let spent = 0
    let income = 0
    for (const t of transactions) {
      if (monthKey(t.date) !== month) continue
      if (t.kind === 'expense') spent += Math.abs(t.amount)
      else if (t.kind === 'income') income += t.amount
    }
    return { month, spent, income }
  })
}
