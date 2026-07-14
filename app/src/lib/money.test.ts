import { describe, expect, it } from 'vitest'
import { formatHuf, parseHufInput } from './money'

describe('formatHuf', () => {
  it('magyar formátumban, fillér nélkül formáz', () => {
    // Az Intl nem törő szóközt használ ezreselválasztónak.
    expect(formatHuf(12345).replace(/\s/g, ' ')).toBe('12 345 Ft')
    expect(formatHuf(-1200).replace(/\s/g, ' ')).toBe('-1200 Ft')
  })
})

describe('parseHufInput', () => {
  it('szóközös és pontos ezreselválasztót is kezel', () => {
    expect(parseHufInput('12 345')).toBe(12345)
    expect(parseHufInput('12.345')).toBe(12345)
    expect(parseHufInput('12345 Ft')).toBe(12345)
    expect(parseHufInput('-1 200')).toBe(-1200)
    expect(parseHufInput('1 234,56')).toBe(1235)
  })
  it('érvénytelen bemenetre null', () => {
    expect(parseHufInput('')).toBeNull()
    expect(parseHufInput('abc')).toBeNull()
  })
})
