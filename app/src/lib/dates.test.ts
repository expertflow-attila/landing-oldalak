import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  dayOfWeek,
  daysBetween,
  isWeekend,
  monthKey,
  parseBankDate,
  extractTimeOfDay,
} from './dates'

describe('hónap-aritmetika', () => {
  it('addMonths évhatáron át is jó', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2025-12', 1)).toBe('2026-01')
    expect(addMonths('2026-07', -6)).toBe('2026-01')
  })
  it('monthKey', () => {
    expect(monthKey('2026-07-14')).toBe('2026-07')
  })
})

describe('nap-aritmetika', () => {
  it('daysBetween és addDays konzisztens', () => {
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2)
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('hétvége-detektálás (2026-07-14 kedd)', () => {
    expect(dayOfWeek('2026-07-14')).toBe(1)
    expect(isWeekend('2026-07-14')).toBe(false)
    expect(isWeekend('2026-07-18')).toBe(true)
    expect(isWeekend('2026-07-19')).toBe(true)
  })
})

describe('parseBankDate', () => {
  it('magyar és nemzetközi formátumok', () => {
    expect(parseBankDate('2026.01.15.')).toBe('2026-01-15')
    expect(parseBankDate('2026.1.5')).toBe('2026-01-05')
    expect(parseBankDate('2026-01-15')).toBe('2026-01-15')
    expect(parseBankDate('15/01/2026')).toBe('2026-01-15')
    expect(parseBankDate('15.01.2026')).toBe('2026-01-15')
    expect(parseBankDate('2026-01-15 14:32:00')).toBe('2026-01-15')
  })
  it('érvénytelen dátumra null', () => {
    expect(parseBankDate('nem datum')).toBeNull()
    expect(parseBankDate('2026.13.40.')).toBeNull()
  })
  it('időkomponens kinyerése', () => {
    expect(extractTimeOfDay('2026-01-15 14:32:00')).toBe('14:32')
    expect(extractTimeOfDay('2026-01-15')).toBeUndefined()
  })
})
