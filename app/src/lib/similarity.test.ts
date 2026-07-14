import { describe, expect, it } from 'vitest'
import { normalizePayee } from './normalize'
import { similarityScore, SIMILARITY_THRESHOLD } from './similarity'

describe('normalizePayee', () => {
  it('POS-zajt és számokat eltávolít, ékezetet leképez', () => {
    expect(normalizePayee('LIDL ÁRUHÁZ 0123 BUDAPEST VÁSÁRLÁS')).toBe('lidl')
    expect(normalizePayee('Spotify AB')).toBe('spotify ab')
  })
})

describe('similarityScore', () => {
  it('azonos kereskedő különböző terminálokkal egyezik', () => {
    const a = 'LIDL ÁRUHÁZ 0123 BUDAPEST'
    const b = 'LIDL ÁRUHÁZ 4567 DEBRECEN'
    expect(similarityScore(a, b)).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD)
  })
  it('hasonló terméknevek egyeznek', () => {
    expect(similarityScore('Nike futócipő', 'nike cipő')).toBeGreaterThanOrEqual(
      SIMILARITY_THRESHOLD,
    )
  })
  it('különböző kereskedők nem egyeznek', () => {
    expect(similarityScore('Spotify', 'MÁV jegyvásárlás')).toBeLessThan(SIMILARITY_THRESHOLD)
  })
})
