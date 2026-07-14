import type { ColumnMapping } from '../../db/schema'
import { stripAccents } from '../normalize'
import { parseBankDate } from '../dates'
import { parseBankAmount } from './numbers'
import { BUILT_IN_PRESETS, type BuiltInPreset } from './presets'

export interface DetectionResult {
  preset: BuiltInPreset | null
  mapping: ColumnMapping
  delimiter: string
  score: number
}

export function guessDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n')
  const counts: Record<string, number> = {
    ';': (firstLines.match(/;/g) ?? []).length,
    ',': (firstLines.match(/,/g) ?? []).length,
    '\t': (firstLines.match(/\t/g) ?? []).length,
  }
  let best = ';'
  let bestCount = -1
  for (const [d, c] of Object.entries(counts)) {
    if (c > bestCount) {
      best = d
      bestCount = c
    }
  }
  return best
}

function normHeader(h: string): string {
  return stripAccents(h.toLowerCase()).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function presetScore(preset: BuiltInPreset, headers: string[]): number {
  const normed = headers.map(normHeader)
  let hits = 0
  for (const kw of preset.headerKeywords) {
    if (normed.some((h) => h.includes(kw) || kw.includes(h))) hits++
  }
  return hits / preset.headerKeywords.length
}

/** Oszlopszerep-tippelés mintasorokból: melyik oszlop dátum, melyik összeg. */
export function guessMapping(headers: string[], sampleRows: string[][]): ColumnMapping {
  const colCount = Math.max(headers.length, ...sampleRows.map((r) => r.length), 0)
  const dateScores: number[] = []
  const amountScores: number[] = []

  for (let c = 0; c < colCount; c++) {
    const values = sampleRows.map((r) => r[c] ?? '').filter((v) => v.trim() !== '')
    const dateOk = values.filter((v) => parseBankDate(v) !== null).length
    const amountOk = values.filter((v) => parseBankAmount(v) !== null && /\d/.test(v)).length
    dateScores.push(values.length ? dateOk / values.length : 0)
    amountScores.push(values.length ? amountOk / values.length : 0)
  }

  const dateCol = argmaxAbove(dateScores, 0.8) ?? 0
  // Összeg: a legjobb szám-oszlop, ami nem a dátumoszlop.
  let amountCol: number | undefined
  let bestAmount = 0.8
  for (let c = 0; c < colCount; c++) {
    if (c === dateCol) continue
    // Dátumnak is parse-olható oszlopot ne tekintsünk összegnek.
    if (dateScores[c] >= 0.8) continue
    if (amountScores[c] >= bestAmount) {
      bestAmount = amountScores[c]
      amountCol = c
    }
  }

  // Partner: az első olyan szöveges oszlop, ami se dátum, se összeg.
  const payeeCols: number[] = []
  for (let c = 0; c < colCount; c++) {
    if (c === dateCol || c === amountCol) continue
    if (dateScores[c] >= 0.5 || amountScores[c] >= 0.5) continue
    payeeCols.push(c)
    if (payeeCols.length >= 2) break
  }

  return {
    date: dateCol,
    amount: amountCol,
    payee: payeeCols.length ? [payeeCols[0]] : [dateCol === 0 ? 1 : 0],
    note: payeeCols[1],
    hasHeader: true,
  }
}

function argmaxAbove(scores: number[], threshold: number): number | null {
  let best: number | null = null
  let bestScore = threshold
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] >= bestScore) {
      best = i
      bestScore = scores[i]
    }
  }
  return best
}

/** Sorok alapján validálja, hogy egy preset mappingje tényleg működik-e. */
function mappingWorks(mapping: ColumnMapping, sampleRows: string[][]): boolean {
  if (sampleRows.length === 0) return false
  let ok = 0
  for (const row of sampleRows) {
    const dateOk = parseBankDate(row[mapping.date] ?? '') !== null
    const amountRaw =
      mapping.amount !== undefined
        ? row[mapping.amount]
        : (row[mapping.debit ?? -1] || row[mapping.credit ?? -1])
    const amountOk = parseBankAmount(amountRaw ?? '') !== null
    if (dateOk && amountOk) ok++
  }
  return ok / sampleRows.length >= 0.6
}

export function detectPreset(headers: string[], sampleRows: string[][]): DetectionResult {
  let best: { preset: BuiltInPreset; score: number } | null = null
  for (const preset of BUILT_IN_PRESETS) {
    const score = presetScore(preset, headers)
    if (score >= 0.5 && (!best || score > best.score)) best = { preset, score }
  }

  if (best && mappingWorks(best.preset.defaultMapping, sampleRows)) {
    return {
      preset: best.preset,
      mapping: best.preset.defaultMapping,
      delimiter: best.preset.delimiterHint ?? ';',
      score: best.score,
    }
  }

  return {
    preset: null,
    mapping: guessMapping(headers, sampleRows),
    delimiter: ';',
    score: 0,
  }
}
