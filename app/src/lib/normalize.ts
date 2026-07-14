// Kereskedő-/partnernevek normalizálása: kisbetű, ékezet-eltávolítás,
// POS-zaj (kártyaszám-töredékek, terminál-azonosítók, városnevek) kiszűrése.

const NOISE_TOKENS = new Set([
  'vasarlas', 'kartyas', 'kartya', 'poz', 'pos', 'terminal', 'fizetes',
  'budapest', 'bp', 'hu', 'hun', 'kft', 'bt', 'zrt', 'nyrt', 'ev', 'korlatolt',
  'aruhaz', 'uzlet', 'shop', 'store', 'payment', 'purchase', 'card',
])

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function tokens(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean)
}

export function normalizePayee(raw: string): string {
  const base = stripAccents(raw.toLowerCase())
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const kept = base.split(' ').filter((t) => t.length > 1 && !NOISE_TOKENS.has(t))
  const result = kept.join(' ')
  // Ha minden token zajnak minősült, inkább a nyers alapot adjuk vissza,
  // hogy két különböző partner ne olvadjon üres stringgé.
  return result || base
}
