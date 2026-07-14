import { db } from '../../db'
import type { Transaction } from '../../db/schema'
import { nowIso } from '../dates'
import { normalizePayee } from '../normalize'
import type { ParsedRow } from './types'

export interface CommitResult {
  imported: number
  skippedDuplicates: number
  skippedErrors: number
}

/** A validált batch beírása egyetlen Dexie-tranzakcióban. */
export async function commitBatch(rows: ParsedRow[], accountId: number): Promise<CommitResult> {
  const toInsert: Transaction[] = []
  let skippedDuplicates = 0
  let skippedErrors = 0

  for (const row of rows) {
    if (row.error || row.date === undefined || row.amount === undefined) {
      skippedErrors++
      continue
    }
    if (row.duplicate && !row.forceImport) {
      skippedDuplicates++
      continue
    }
    toInsert.push({
      accountId,
      kind: row.amount < 0 ? 'expense' : 'income',
      amount: row.amount,
      date: row.date,
      timeOfDay: row.timeOfDay,
      payee: row.payee ?? 'Ismeretlen partner',
      normalizedPayee: normalizePayee(row.payee ?? ''),
      note: row.note,
      importHash: row.importHash,
      source: 'import',
      createdAt: nowIso(),
    })
  }

  await db.transaction('rw', db.transactions, async () => {
    await db.transactions.bulkAdd(toInsert)
  })

  return { imported: toInsert.length, skippedDuplicates, skippedErrors }
}
