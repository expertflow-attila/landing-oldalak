import { describe, expect, it } from 'vitest'
import type { Transaction } from '../db/schema'
import { detectRecurring, monthlyEquivalent } from './recurrence'
import { normalizePayee } from './normalize'

let idCounter = 1
function tx(date: string, amount: number, payee: string): Transaction {
  return {
    id: idCounter++,
    accountId: 1,
    kind: amount < 0 ? 'expense' : 'income',
    amount,
    date,
    payee,
    normalizedPayee: normalizePayee(payee),
    source: 'import',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('detectRecurring', () => {
  it('havi előfizetést felismer', () => {
    const txs = [
      tx('2026-01-05', -4990, 'Spotify AB'),
      tx('2026-02-05', -4990, 'Spotify AB'),
      tx('2026-03-05', -4990, 'Spotify AB'),
      tx('2026-04-06', -4990, 'Spotify AB'),
    ]
    const found = detectRecurring(txs)
    expect(found).toHaveLength(1)
    expect(found[0].cadence).toBe('monthly')
    expect(found[0].avgAmount).toBe(4990)
    expect(found[0].nextExpected > '2026-04-06').toBe(true)
  })

  it('árkúszást (±10%) egy sorozatként kezel', () => {
    const txs = [
      tx('2026-01-10', -3490, 'Netflix'),
      tx('2026-02-10', -3490, 'Netflix'),
      tx('2026-03-10', -3690, 'Netflix'),
      tx('2026-04-10', -3690, 'Netflix'),
    ]
    const found = detectRecurring(txs)
    expect(found).toHaveLength(1)
    expect(found[0].occurrenceCount).toBe(4)
  })

  it('szabálytalan vásárlásokat nem jelöl előfizetésnek', () => {
    const txs = [
      tx('2026-01-03', -8500, 'Étterem Kft'),
      tx('2026-01-19', -12000, 'Étterem Kft'),
      tx('2026-02-02', -6300, 'Étterem Kft'),
      tx('2026-03-27', -9100, 'Étterem Kft'),
    ]
    expect(detectRecurring(txs)).toHaveLength(0)
  })

  it('éves díjat 2 előfordulásból is felismer', () => {
    const txs = [
      tx('2025-03-01', -12000, 'Domain reg'),
      tx('2026-03-01', -12000, 'Domain reg'),
    ]
    const found = detectRecurring(txs)
    expect(found).toHaveLength(1)
    expect(found[0].cadence).toBe('yearly')
  })
})

describe('monthlyEquivalent', () => {
  it('kadenciák havi egyenértéke', () => {
    expect(monthlyEquivalent({ cadence: 'monthly', avgAmount: 3000 })).toBe(3000)
    expect(monthlyEquivalent({ cadence: 'weekly', avgAmount: 1000 })).toBe(4333)
    expect(monthlyEquivalent({ cadence: 'yearly', avgAmount: 12000 })).toBe(1000)
  })
})
