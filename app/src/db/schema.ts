export type AccountType = 'bank' | 'cash' | 'savings'

export interface Account {
  id?: number
  name: string
  type: AccountType
  startingBalance: number
  createdAt: string
  archived?: 0 | 1
}

export type TxKind = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id?: number
  accountId: number
  kind: TxKind
  /** Előjeles integer HUF: kiadás negatív, bevétel pozitív. */
  amount: number
  /** 'YYYY-MM-DD' */
  date: string
  /** 'HH:mm', ha ismert (kézi rögzítés / egyes bankok). */
  timeOfDay?: string
  payee: string
  normalizedPayee: string
  categoryId?: number
  note?: string
  /** Átvezetés másik lába. */
  transferPairId?: number
  importHash?: string
  source: 'manual' | 'import'
  createdAt: string
}

export interface CategoryGroup {
  id?: number
  name: string
  sortOrder: number
}

export interface Category {
  id?: number
  groupId: number
  name: string
  sortOrder: number
  /** 1 = diszkrecionális (impulzus-motor figyeli). */
  discretionary: 0 | 1
  archived?: 0 | 1
}

export interface BudgetEntry {
  id?: number
  /** 'YYYY-MM' */
  month: string
  categoryId: number
  assigned: number
}

export type WishStatus = 'waiting' | 'decided_buy' | 'decided_drop'

export interface WishlistItem {
  id?: number
  name: string
  normalizedName: string
  categoryId?: number
  price: number
  url?: string
  /** ISO datetime — a 72 órás visszaszámlálás alapja. */
  createdAt: string
  /** createdAt + 72h, ISO datetime. */
  decideAfter: string
  status: WishStatus
  decidedAt?: string
  note?: string
}

export type SubscriptionStatus = 'unreviewed' | 'keep' | 'unused' | 'cancelled'
export type Cadence = 'weekly' | 'monthly' | 'yearly'

export interface RecurringSeries {
  id?: number
  normalizedPayee: string
  displayName: string
  categoryId?: number
  cadence: Cadence
  avgAmount: number
  lastSeen: string
  nextExpected: string
  occurrenceCount: number
  confidence: number
  status: SubscriptionStatus
  cancelledAt?: string
  /** 1 = a felhasználó szerint ez nem előfizetés. */
  dismissed?: 0 | 1
}

export interface ColumnMapping {
  date: number
  /** Egyetlen előjeles összeg-oszlop… */
  amount?: number
  /** …vagy külön terhelés/jóváírás oszlopok (K&H-stílus). */
  debit?: number
  credit?: number
  payee: number[]
  note?: number
  currency?: number
  hasHeader: boolean
}

export type BankId = 'otp' | 'kh' | 'erste' | 'revolut' | 'wise' | 'custom'

export interface ImportPreset {
  id?: number
  name: string
  bankId: BankId
  headerFingerprint?: string
  mapping: ColumnMapping
  encoding?: string
  delimiter?: string
}

export interface Setting {
  key: string
  value: unknown
}

export interface AppSettings {
  netMonthlyIncome?: number
  weeklyWorkHours?: number
  netHourlyWage?: number
  savingsGoalName?: string
  savingsGoalAmount?: number
  savingsGoalSaved?: number
  paydayDayOfMonth?: number
  anthropicApiKey?: string
  llmModel?: string
  onboardingDone?: boolean
  lastExportAt?: string
}
