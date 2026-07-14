import type { ColumnMapping } from '../../db/schema'

export interface ParsedRow {
  /** Az eredeti CSV-sor cellái. */
  cells: string[]
  /** Sikeres feldolgozás esetén kitöltve: */
  date?: string
  timeOfDay?: string
  amount?: number
  payee?: string
  note?: string
  /** Hibaüzenet, ha a sor nem dolgozható fel. */
  error?: string
  /** Duplikátum-jelzés a meglévő adatokkal szemben. */
  duplicate?: boolean
  /** A felhasználó felülbírálta a duplikátum-kihagyást. */
  forceImport?: boolean
  importHash?: string
}

export interface ImportBatch {
  rows: ParsedRow[]
  mapping: ColumnMapping
  encoding: string
  delimiter: string
}
