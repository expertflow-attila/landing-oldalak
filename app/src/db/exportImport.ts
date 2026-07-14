import { db } from './index'
import type { Setting } from './schema'
import { nowIso } from '../lib/dates'

const EXPORT_VERSION = 1

/** Az API-kulcs sosem kerül export-fájlba. */
const EXCLUDED_SETTING_KEYS = new Set(['anthropicApiKey'])

export interface ExportFile {
  app: 'keret'
  version: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

export async function exportAll(): Promise<ExportFile> {
  const [
    accounts, transactions, categoryGroups, categories,
    budgetEntries, wishlistItems, recurringSeries, importPresets, settings,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.categoryGroups.toArray(),
    db.categories.toArray(),
    db.budgetEntries.toArray(),
    db.wishlistItems.toArray(),
    db.recurringSeries.toArray(),
    db.importPresets.toArray(),
    db.settings.toArray(),
  ])
  return {
    app: 'keret',
    version: EXPORT_VERSION,
    exportedAt: nowIso(),
    tables: {
      accounts,
      transactions,
      categoryGroups,
      categories,
      budgetEntries,
      wishlistItems,
      recurringSeries,
      importPresets,
      settings: settings.filter((s: Setting) => !EXCLUDED_SETTING_KEYS.has(s.key)),
    },
  }
}

/** Teljes visszaállítás: a meglévő adatot lecseréli az export tartalmára. */
export async function importAll(data: ExportFile): Promise<void> {
  if (data.app !== 'keret' || typeof data.version !== 'number') {
    throw new Error('Ez a fájl nem Keret-mentés.')
  }
  if (data.version > EXPORT_VERSION) {
    throw new Error('A mentés újabb app-verzióval készült — frissítsd az appot.')
  }
  const tables = [
    db.accounts, db.transactions, db.categoryGroups, db.categories,
    db.budgetEntries, db.wishlistItems, db.recurringSeries, db.importPresets, db.settings,
  ]
  await db.transaction('rw', tables, async () => {
    for (const table of tables) await table.clear()
    const t = data.tables
    if (t.accounts) await db.accounts.bulkAdd(t.accounts as never[])
    if (t.transactions) await db.transactions.bulkAdd(t.transactions as never[])
    if (t.categoryGroups) await db.categoryGroups.bulkAdd(t.categoryGroups as never[])
    if (t.categories) await db.categories.bulkAdd(t.categories as never[])
    if (t.budgetEntries) await db.budgetEntries.bulkAdd(t.budgetEntries as never[])
    if (t.wishlistItems) await db.wishlistItems.bulkAdd(t.wishlistItems as never[])
    if (t.recurringSeries) await db.recurringSeries.bulkAdd(t.recurringSeries as never[])
    if (t.importPresets) await db.importPresets.bulkAdd(t.importPresets as never[])
    if (t.settings) await db.settings.bulkAdd(t.settings as never[])
  })
}
