// Magyar banki összeg-formátumok parse-olása integer HUF-fá.
// Előfordul: "1 234", "1.234", "-12 345,67", "1,234.56" (Revolut/Wise angol),
// "12345", pénznem-jelölések ("HUF", "Ft").

export function parseBankAmount(raw: string): number | null {
  let s = raw.trim().replace(/huf|ft|eur|usd/gi, '').replace(/[\s  ]/g, '')
  if (!s || s === '-') return null

  const negative = s.startsWith('-') || (s.startsWith('(') && s.endsWith(')'))
  s = s.replace(/[()+-]/g, '')

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    // Mindkettő szerepel: a hátsó a tizedesjel, az első az ezreselválasztó.
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    // Csak vessző: magyar tizedesjel, KIVÉVE ha ezreselválasztónak néz ki
    // (pl. "1,234" és pontosan 3 számjegy követi több csoportban).
    const parts = s.split(',')
    const looksLikeThousands =
      parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3 && Number(parts[0]) !== 0 && !raw.includes(' '))
    // Magyar kontextusban a vessző alapból tizedesjel; ezres-vessző (angol)
    // csak akkor valószínű, ha nincs szóköz-ezrese és 3 jegyű csoport követi.
    s = looksLikeThousands ? parts.join('') : parts.join('.')
  } else if (lastDot !== -1) {
    // Csak pont: magyar exportban ezreselválasztó ("12.345"),
    // angolban tizedesjel ("12.34"). Döntés: ha pontosan 3 számjegy követi
    // és nincs más pont előtte 1-3 jegynél többel, ezresnek vesszük.
    const parts = s.split('.')
    const allThrees = parts.slice(1).every((p) => p.length === 3)
    if (allThrees && parts[0].length >= 1) {
      s = parts.join('')
    }
    // különben marad tizedespontnak
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.round(negative ? -n : n)
}
