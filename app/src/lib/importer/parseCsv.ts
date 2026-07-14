import Papa from 'papaparse'

// A papaparse mindig már DEKÓDOLT stringet kap (encoding.ts után) —
// File-objektumot soha, mert azt UTF-8-ként olvasná.

export interface RawCsv {
  headers: string[]
  rows: string[][]
}

export function parseCsvText(text: string, delimiter: string, hasHeader: boolean): RawCsv {
  const result = Papa.parse<string[]>(text.trim(), {
    delimiter,
    skipEmptyLines: 'greedy',
  })
  const all = (result.data as string[][]).filter((r) => r.some((c) => c && c.trim() !== ''))
  if (all.length === 0) return { headers: [], rows: [] }
  if (hasHeader) return { headers: all[0].map((h) => h.trim()), rows: all.slice(1) }
  return { headers: [], rows: all }
}
