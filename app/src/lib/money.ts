// Minden összeg integer HUF — nincs fillér, nincs lebegőpontos hiba.

const hufFormat = new Intl.NumberFormat('hu-HU', {
  style: 'currency',
  currency: 'HUF',
  maximumFractionDigits: 0,
})

const numberFormat = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 })

export function formatHuf(amount: number): string {
  return hufFormat.format(Math.round(amount))
}

export function formatNumber(n: number): string {
  return numberFormat.format(Math.round(n))
}

/** Felhasználói bevitel: "12 345", "12.345", "12345 Ft", "-1 200" → integer HUF vagy null. */
export function parseHufInput(raw: string): number | null {
  const cleaned = raw
    .replace(/ft|huf/gi, '')
    .replace(/[\s  ]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()
  if (cleaned === '' || cleaned === '-') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

/** Óra tizedes formában → "14,5 munkaóra" jellegű szöveghez. */
export function formatHours(hours: number): string {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(hours)
}

export function formatPercent(fraction: number, digits = 1): string {
  return new Intl.NumberFormat('hu-HU', {
    style: 'percent',
    maximumFractionDigits: digits,
  }).format(fraction)
}
