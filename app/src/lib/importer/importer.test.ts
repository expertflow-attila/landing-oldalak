import { describe, expect, it } from 'vitest'
import { decodeBankCsv } from './encoding'
import { parseBankAmount } from './numbers'
import { detectPreset, guessDelimiter } from './detect'
import { parseCsvText } from './parseCsv'
import { transformRows } from './transform'
import { fnv1a, importHashFor } from './dedup'

describe('decodeBankCsv', () => {
  it('UTF-8 szöveget felismer', () => {
    const buf = new TextEncoder().encode('Dátum;Összeg\n2026.01.15.;-1200').buffer
    const result = decodeBankCsv(buf as ArrayBuffer)
    expect(result.encoding).toBe('utf-8')
    expect(result.text).toContain('Dátum')
  })

  it('ISO-8859-2 magyar szöveget helyesen dekódol', () => {
    // "őszi ruha vásárlás" ISO-8859-2 bájtokkal: ő=0xF5, á=0xE1
    const bytes = new Uint8Array([
      0xf5, 0x73, 0x7a, 0x69, 0x20, 0x72, 0x75, 0x68, 0x61, 0x20,
      0x76, 0xe1, 0x73, 0xe1, 0x72, 0x6c, 0xe1, 0x73,
    ])
    const result = decodeBankCsv(bytes.buffer as ArrayBuffer)
    expect(result.text).toContain('vásárlás')
    expect(['iso-8859-2', 'windows-1250']).toContain(result.encoding)
  })

  it('kényszerített kódolást tiszteletben tart', () => {
    const bytes = new TextEncoder().encode('abc').buffer
    expect(decodeBankCsv(bytes as ArrayBuffer, 'windows-1250').encoding).toBe('windows-1250')
  })
})

describe('parseBankAmount', () => {
  it('magyar formátumok', () => {
    expect(parseBankAmount('-12 345')).toBe(-12345)
    expect(parseBankAmount('12.345')).toBe(12345)
    expect(parseBankAmount('-1 234,56')).toBe(-1235)
    expect(parseBankAmount('3490')).toBe(3490)
  })
  it('angol formátumok (Revolut/Wise)', () => {
    expect(parseBankAmount('-1,234.56')).toBe(-1235)
    expect(parseBankAmount('12.34')).toBe(12)
  })
  it('pénznem-jelölés eltávolítása', () => {
    expect(parseBankAmount('-4 990 Ft')).toBe(-4990)
    expect(parseBankAmount('1200 HUF')).toBe(1200)
  })
  it('érvénytelen bemenet null', () => {
    expect(parseBankAmount('')).toBeNull()
    expect(parseBankAmount('n/a')).toBeNull()
  })
})

describe('delimiter + preset detektálás', () => {
  it('pontosvesszős magyar CSV', () => {
    const text = 'Könyvelési dátum;Partner neve;Terhelés;Jóváírás;Közlemény\n2026.01.15.;LIDL;12 345;;kártyás vásárlás'
    expect(guessDelimiter(text)).toBe(';')
    const { headers, rows } = parseCsvText(text, ';', true)
    const detection = detectPreset(headers, rows)
    expect(detection.preset?.bankId).toBe('kh')
  })

  it('Revolut-stílusú CSV', () => {
    const text =
      'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\n' +
      'CARD_PAYMENT,Current,2026-01-14 21:03:11,2026-01-15 08:00:00,Spotify,-4990,0,HUF,COMPLETED,150000'
    const { headers, rows } = parseCsvText(text, ',', true)
    const detection = detectPreset(headers, rows)
    expect(detection.preset?.bankId).toBe('revolut')
  })

  it('ismeretlen formátumnál oszlopszerep-tippelés működik', () => {
    const text = 'datum|szoveg|osszeg'
    const rows = [
      ['2026.01.15.', 'LIDL BUDAPEST', '-12 345'],
      ['2026.01.16.', 'SPAR', '-3 200'],
      ['2026.01.17.', 'Munkabér', '450 000'],
    ]
    const detection = detectPreset(text.split('|'), rows)
    expect(detection.preset).toBeNull()
    expect(detection.mapping.date).toBe(0)
    expect(detection.mapping.amount).toBe(2)
    expect(detection.mapping.payee).toEqual([1])
  })
})

describe('transformRows', () => {
  it('K&H-stílusú terhelés/jóváírás oszlopokat előjelez', () => {
    const rows = transformRows(
      [
        ['2026.01.15.', 'LIDL', '12 345', '', 'vásárlás'],
        ['2026.01.20.', 'Munkáltató', '', '450 000', 'munkabér'],
      ],
      { date: 0, debit: 2, credit: 3, payee: [1], note: 4, hasHeader: true },
    )
    expect(rows[0].amount).toBe(-12345)
    expect(rows[1].amount).toBe(450000)
    expect(rows[0].payee).toBe('LIDL')
  })

  it('hibás sort hibával jelöl, nem dob', () => {
    const rows = transformRows([['nem datum', 'X', '100']], {
      date: 0,
      amount: 2,
      payee: [1],
      hasHeader: true,
    })
    expect(rows[0].error).toContain('dátum')
  })

  it('nem HUF tételt hibával jelöl', () => {
    const rows = transformRows(
      [['2026-01-15', 'Amazon', '-25.99', 'EUR']],
      { date: 0, amount: 2, payee: [1], currency: 3, hasHeader: true },
    )
    expect(rows[0].error).toContain('EUR')
  })
})

describe('dedup hash', () => {
  it('determinisztikus és partner-normalizált', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'))
    // Csak terminálszámban/zajban eltérő partnernevek ugyanoda hash-elődnek.
    expect(importHashFor(1, '2026-01-15', -12345, 'LIDL ÁRUHÁZ 0123 BUDAPEST')).toBe(
      importHashFor(1, '2026-01-15', -12345, 'LIDL ÁRUHÁZ 9999 BUDAPEST VÁSÁRLÁS'),
    )
    expect(importHashFor(1, '2026-01-15', -12345, 'LIDL')).not.toBe(
      importHashFor(2, '2026-01-15', -12345, 'LIDL'),
    )
  })
})
