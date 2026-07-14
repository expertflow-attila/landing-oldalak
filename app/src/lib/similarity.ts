import { normalizePayee, tokens } from './normalize'

function bigrams(s: string): Map<string, number> {
  const map = new Map<string, number>()
  const padded = s.replace(/ /g, '_')
  for (let i = 0; i < padded.length - 1; i++) {
    const bg = padded.slice(i, i + 2)
    map.set(bg, (map.get(bg) ?? 0) + 1)
  }
  return map
}

export function diceBigram(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0
  const ba = bigrams(a)
  const bb = bigrams(b)
  let overlap = 0
  let totalA = 0
  let totalB = 0
  for (const n of ba.values()) totalA += n
  for (const n of bb.values()) totalB += n
  for (const [bg, n] of ba) overlap += Math.min(n, bb.get(bg) ?? 0)
  return (2 * overlap) / (totalA + totalB)
}

export function tokenJaccard(a: string, b: string): number {
  const ta = new Set(tokens(a))
  const tb = new Set(tokens(b))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter)
}

/** 0..1: bigram- és token-hasonlóság átlaga normalizált neveken. */
export function similarityScore(rawA: string, rawB: string): number {
  const na = normalizePayee(rawA)
  const nb = normalizePayee(rawB)
  if (!na || !nb) return 0
  if (na === nb) return 1
  return 0.5 * diceBigram(na, nb) + 0.5 * tokenJaccard(na, nb)
}

export const SIMILARITY_THRESHOLD = 0.35

export interface SimilarMatch<T> {
  item: T
  score: number
  matchType: 'name' | 'category'
}

/**
 * Hasonló tételek keresése név és/vagy kategória alapján.
 * Név-találatok előrébb, azon belül pontszám szerint csökkenő.
 */
export function findSimilar<T>(
  query: { name: string; categoryId?: number },
  items: T[],
  getName: (item: T) => string,
  getCategoryId: (item: T) => number | undefined,
): SimilarMatch<T>[] {
  const out: SimilarMatch<T>[] = []
  for (const item of items) {
    const score = similarityScore(query.name, getName(item))
    if (score >= SIMILARITY_THRESHOLD) {
      out.push({ item, score, matchType: 'name' })
    } else if (
      query.categoryId !== undefined &&
      getCategoryId(item) === query.categoryId
    ) {
      out.push({ item, score, matchType: 'category' })
    }
  }
  return out.sort((a, b) => {
    if (a.matchType !== b.matchType) return a.matchType === 'name' ? -1 : 1
    return b.score - a.score
  })
}
