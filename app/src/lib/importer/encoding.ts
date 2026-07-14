// Magyar banki CSV-k kódolás-detektálása. A hazai bankok gyakran
// ISO-8859-2 vagy Windows-1250 kódolással exportálnak, nem UTF-8-cal.
// A két közép-európai kódolás pont az ő/ű karakterek leképezésében tér el,
// ezért magyar betű-frekvencia alapján pontozunk.

export interface DecodedCsv {
  text: string
  encoding: string
}

const HUNGARIAN_LETTERS = /[őűáéíóöúüŐŰÁÉÍÓÖÚÜ]/g
// Tipikus mojibake-karakterek rossz közép-európai dekódolásnál.
const MOJIBAKE = /[ĂĹŘľ˝¤§÷¸ˇ˘°]/g

function scoreHungarian(text: string): number {
  const good = (text.match(HUNGARIAN_LETTERS) ?? []).length
  const bad = (text.match(MOJIBAKE) ?? []).length
  const replacement = (text.match(/�/g) ?? []).length
  return good - 3 * bad - 10 * replacement
}

export const SUPPORTED_ENCODINGS = ['utf-8', 'windows-1250', 'iso-8859-2'] as const

export function decodeBankCsv(buf: ArrayBuffer, forcedEncoding?: string): DecodedCsv {
  const bytes = new Uint8Array(buf)

  if (forcedEncoding) {
    return { text: decode(bytes, forcedEncoding), encoding: forcedEncoding }
  }

  // UTF-8 BOM → egyértelmű.
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: decode(bytes, 'utf-8'), encoding: 'utf-8' }
  }

  // Szigorú UTF-8 próba: ha érvényes, az szinte biztosan az.
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { text, encoding: 'utf-8' }
  } catch {
    // nem UTF-8, jöhet a közép-európai pontozás
  }

  let best: DecodedCsv = { text: decode(bytes, 'windows-1250'), encoding: 'windows-1250' }
  let bestScore = scoreHungarian(best.text)
  const iso = decode(bytes, 'iso-8859-2')
  const isoScore = scoreHungarian(iso)
  if (isoScore > bestScore) {
    best = { text: iso, encoding: 'iso-8859-2' }
    bestScore = isoScore
  }
  return best
}

function decode(bytes: Uint8Array, encoding: string): string {
  const text = new TextDecoder(encoding).decode(bytes)
  // Esetleges BOM eltávolítása a szöveg elejéről.
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}
