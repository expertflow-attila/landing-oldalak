import { db } from '../../db'
import { normalizePayee } from '../normalize'
import type { ParsedRow } from './types'

// Dedup-kulcs: számla + dátum + összeg + normalizált partner.
// FNV-1a hash — gyors, determinisztikus, nem kriptográfiai célú.

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

export function importHashFor(
  accountId: number,
  date: string,
  amount: number,
  payee: string,
): string {
  return fnv1a(`${accountId}|${date}|${amount}|${normalizePayee(payee)}`)
}

/**
 * Duplikátumok megjelölése a meglévő adatbázissal ÉS a batchen belül.
 * Batchen belüli ismétlődésnél sorszám-diszambiguátort fűzünk a hash-hez,
 * mert egy kivonatban jogosan lehet két azonos tétel ugyanaznap.
 */
export async function markDuplicates(rows: ParsedRow[], accountId: number): Promise<void> {
  const seenInBatch = new Map<string, number>()

  for (const row of rows) {
    if (row.error || row.date === undefined || row.amount === undefined) continue
    const baseHash = importHashFor(accountId, row.date, row.amount, row.payee ?? '')
    const nthInBatch = seenInBatch.get(baseHash) ?? 0
    seenInBatch.set(baseHash, nthInBatch + 1)
    const hash = nthInBatch === 0 ? baseHash : `${baseHash}#${nthInBatch + 1}`
    row.importHash = hash
    row.duplicate = (await db.transactions.where('importHash').equals(hash).count()) > 0
  }
}
