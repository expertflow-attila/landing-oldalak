import type { BankId, ColumnMapping } from '../../db/schema'

// Beépített banki presetek. A bankok exportformátumai időnként változnak,
// ezért ezek csak KIINDULÓPONTOK: a detektor mintasorokon validál, és a
// felhasználó a hozzárendelő felületen bármit felülbírálhat.

export interface BuiltInPreset {
  bankId: BankId
  name: string
  /** Ékezet-érzéketlen kulcsszavak a fejléc-egyezés pontozásához. */
  headerKeywords: string[]
  defaultMapping: ColumnMapping
  encodingHint?: string
  delimiterHint?: string
}

export const BUILT_IN_PRESETS: BuiltInPreset[] = [
  {
    bankId: 'otp',
    name: 'OTP Bank',
    headerKeywords: ['tranzakcio datuma', 'ellenoldali nev', 'osszeg', 'kozlemeny', 'ertaknap', 'ertekesnap', 'ertek nap'],
    defaultMapping: { date: 0, amount: 1, payee: [2], note: 3, hasHeader: true },
    encodingHint: 'iso-8859-2',
    delimiterHint: ';',
  },
  {
    bankId: 'kh',
    name: 'K&H Bank',
    headerKeywords: ['konyvelesi datum', 'partner neve', 'terheles', 'jovairas', 'kozlemeny'],
    defaultMapping: { date: 0, debit: 2, credit: 3, payee: [1], note: 4, hasHeader: true },
    encodingHint: 'windows-1250',
    delimiterHint: ';',
  },
  {
    bankId: 'erste',
    name: 'Erste Bank',
    headerKeywords: ['datum', 'partner nev', 'osszeg', 'penznem', 'kategoria', 'kozlemeny'],
    defaultMapping: { date: 0, amount: 2, payee: [1], note: 5, currency: 3, hasHeader: true },
    encodingHint: 'windows-1250',
    delimiterHint: ';',
  },
  {
    bankId: 'revolut',
    name: 'Revolut',
    headerKeywords: ['type', 'started date', 'completed date', 'description', 'amount', 'currency', 'state'],
    defaultMapping: { date: 3, amount: 5, payee: [4], currency: 7, hasHeader: true },
    encodingHint: 'utf-8',
    delimiterHint: ',',
  },
  {
    bankId: 'wise',
    name: 'Wise',
    headerKeywords: ['transferwise id', 'date', 'amount', 'currency', 'description', 'merchant'],
    defaultMapping: { date: 1, amount: 2, payee: [4], currency: 3, hasHeader: true },
    encodingHint: 'utf-8',
    delimiterHint: ',',
  },
]
