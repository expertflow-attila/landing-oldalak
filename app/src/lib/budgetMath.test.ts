import { describe, expect, it } from 'vitest'
import type { Account, BudgetEntry, Transaction } from '../db/schema'
import { envelopeStates, spendingByCategory, toBudget } from './budgetMath'

function tx(partial: Partial<Transaction> & Pick<Transaction, 'amount' | 'date'>): Transaction {
  return {
    accountId: 1,
    kind: partial.amount < 0 ? 'expense' : 'income',
    payee: 'x',
    normalizedPayee: 'x',
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

const entry = (month: string, categoryId: number, assigned: number): BudgetEntry => ({
  month,
  categoryId,
  assigned,
})

describe('envelopeStates', () => {
  it('carryover: előző havi maradvány öröklődik', () => {
    const entries = [entry('2026-06', 1, 50000), entry('2026-07', 1, 50000)]
    const txs = [
      tx({ amount: -30000, date: '2026-06-15', categoryId: 1 }),
      tx({ amount: -20000, date: '2026-07-10', categoryId: 1 }),
    ]
    const july = envelopeStates('2026-07', entries, txs).get(1)!
    // 50e + 50e hozzárendelve, 30e + 20e elköltve → 50e egyenleg.
    expect(july.balance).toBe(50000)
    expect(july.assigned).toBe(50000)
    expect(july.spent).toBe(20000)
    expect(july.overspent).toBe(false)
  })

  it('túlköltés jelzése', () => {
    const entries = [entry('2026-07', 2, 10000)]
    const txs = [tx({ amount: -15000, date: '2026-07-05', categoryId: 2 })]
    const state = envelopeStates('2026-07', entries, txs).get(2)!
    expect(state.balance).toBe(-5000)
    expect(state.overspent).toBe(true)
  })

  it('átvezetés nem számít költésnek', () => {
    const txs = [
      tx({ amount: -50000, date: '2026-07-01', categoryId: 1, kind: 'transfer' }),
    ]
    const state = envelopeStates('2026-07', [entry('2026-07', 1, 10000)], txs).get(1)!
    expect(state.spent).toBe(0)
  })
})

describe('toBudget', () => {
  const accounts: Account[] = [
    { id: 1, name: 'Bank', type: 'bank', startingBalance: 100000, createdAt: '2026-01-01' },
  ]
  it('nyitóegyenleg + bevétel − hozzárendelt', () => {
    const txs = [tx({ amount: 400000, date: '2026-07-05' })]
    const entries = [entry('2026-07', 1, 350000)]
    expect(toBudget('2026-07', accounts, entries, txs)).toBe(150000)
  })
  it('túl-beosztásnál negatív', () => {
    expect(toBudget('2026-07', accounts, [entry('2026-07', 1, 200000)], [])).toBe(-100000)
  })
})

describe('spendingByCategory', () => {
  it('csak az adott hónap kiadásait összegzi, csökkenő sorrendben', () => {
    const txs = [
      tx({ amount: -5000, date: '2026-07-01', categoryId: 1 }),
      tx({ amount: -8000, date: '2026-07-02', categoryId: 2 }),
      tx({ amount: -1000, date: '2026-06-30', categoryId: 1 }),
      tx({ amount: 100000, date: '2026-07-03' }),
    ]
    const result = spendingByCategory('2026-07', txs)
    expect(result).toEqual([
      { categoryId: 2, spent: 8000 },
      { categoryId: 1, spent: 5000 },
    ])
  })
})
