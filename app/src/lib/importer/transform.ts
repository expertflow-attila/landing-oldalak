import type { ColumnMapping } from '../../db/schema'
import { extractTimeOfDay, parseBankDate } from '../dates'
import { parseBankAmount } from './numbers'
import type { ParsedRow } from './types'

/** Nyers CSV-sorok átalakítása a mapping szerint validált tétel-sorokká. */
export function transformRows(rawRows: string[][], mapping: ColumnMapping): ParsedRow[] {
  return rawRows.map((cells) => {
    const row: ParsedRow = { cells }

    const dateRaw = cells[mapping.date] ?? ''
    const date = parseBankDate(dateRaw)
    if (!date) {
      row.error = `Érvénytelen dátum: „${dateRaw}"`
      return row
    }
    row.date = date
    row.timeOfDay = extractTimeOfDay(dateRaw)

    let amount: number | null = null
    if (mapping.amount !== undefined) {
      amount = parseBankAmount(cells[mapping.amount] ?? '')
    } else {
      // Külön terhelés/jóváírás oszlopok (K&H-stílus).
      const debitRaw = mapping.debit !== undefined ? (cells[mapping.debit] ?? '').trim() : ''
      const creditRaw = mapping.credit !== undefined ? (cells[mapping.credit] ?? '').trim() : ''
      if (debitRaw) {
        const d = parseBankAmount(debitRaw)
        if (d !== null) amount = -Math.abs(d)
      } else if (creditRaw) {
        const c = parseBankAmount(creditRaw)
        if (c !== null) amount = Math.abs(c)
      }
    }
    if (amount === null || amount === 0) {
      row.error = 'Hiányzó vagy érvénytelen összeg'
      return row
    }
    row.amount = amount

    const payee = mapping.payee
      .map((c) => (cells[c] ?? '').trim())
      .filter(Boolean)
      .join(' — ')
    row.payee = payee || 'Ismeretlen partner'

    if (mapping.note !== undefined) {
      const note = (cells[mapping.note] ?? '').trim()
      if (note) row.note = note
    }

    if (mapping.currency !== undefined) {
      const cur = (cells[mapping.currency] ?? '').trim().toUpperCase()
      if (cur && cur !== 'HUF' && cur !== 'FT') {
        row.error = `Nem HUF tétel (${cur}) — kézzel rögzítsd árfolyammal`
      }
    }

    return row
  })
}
