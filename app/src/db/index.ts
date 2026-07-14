import Dexie, { type Table } from 'dexie'
import type {
  Account,
  BudgetEntry,
  Category,
  CategoryGroup,
  ImportPreset,
  RecurringSeries,
  Setting,
  Transaction,
  WishlistItem,
} from './schema'

export class KeretDB extends Dexie {
  accounts!: Table<Account, number>
  transactions!: Table<Transaction, number>
  categoryGroups!: Table<CategoryGroup, number>
  categories!: Table<Category, number>
  budgetEntries!: Table<BudgetEntry, number>
  wishlistItems!: Table<WishlistItem, number>
  recurringSeries!: Table<RecurringSeries, number>
  importPresets!: Table<ImportPreset, number>
  settings!: Table<Setting, string>

  constructor() {
    super('keret')
    this.version(1).stores({
      accounts: '++id, type',
      transactions:
        '++id, accountId, date, categoryId, normalizedPayee, importHash, [categoryId+date]',
      categoryGroups: '++id, sortOrder',
      categories: '++id, groupId',
      budgetEntries: '++id, month, categoryId, &[month+categoryId]',
      wishlistItems: '++id, status, decideAfter',
      recurringSeries: '++id, &normalizedPayee, status',
      importPresets: '++id, bankId',
      settings: 'key',
    })
  }
}

export const db = new KeretDB()
