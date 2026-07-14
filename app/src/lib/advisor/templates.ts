import { formatDateHu } from '../dates'
import { formatHuf } from '../money'
import type { PurchaseFacts } from './facts'

// Szabályalapú "tükör": tényszerű, nem moralizáló mondatok.
// Hangnem-szabály: megfigyelés és adat — se tiltás, se felszólítás, se ítélet.

export function renderAdviceHu(facts: PurchaseFacts): string[] {
  const lines: string[] = []

  const nameMatches = facts.similarBuys.filter((b) => b.matchType === 'name')
  if (nameMatches.length > 0) {
    const latest = nameMatches.reduce((a, b) => (a.date > b.date ? a : b))
    lines.push(
      `Az elmúlt 6 hónapban ${nameMatches.length} hasonló vásárlásod volt` +
        ` (összesen ${formatHuf(facts.similarBuysTotal)}), a legutóbbi ${formatDateHu(latest.date)}-én: ${latest.payee}.`,
    )
  } else if (facts.similarBuys.length > 0 && facts.categoryName) {
    const total = facts.similarBuys.reduce((s, b) => s + b.amount, 0)
    lines.push(
      `Ebben a kategóriában (${facts.categoryName}) ${facts.similarBuys.length} vásárlásod volt az elmúlt fél évben, összesen ${formatHuf(total)}.`,
    )
  }

  if (facts.droppedWishes.length > 0) {
    lines.push(
      `Korábban ${facts.droppedWishes.length} hasonló tételt tettél kívánságlistára, és 72 óra után úgy döntöttél, nem kell (pl. „${facts.droppedWishes[0].name}").`,
    )
  }

  if (facts.similarSubscription) {
    lines.push(
      `Van már egy hasonló ismétlődő tételed: ${facts.similarSubscription.displayName}, ${formatHuf(facts.similarSubscription.avgAmount)}/alkalom.`,
    )
  }

  if (facts.envelope) {
    if (facts.envelope.balance <= 0) {
      lines.push(
        `A(z) ${facts.envelope.categoryName} borítékod jelenleg ${formatHuf(facts.envelope.balance)}-on áll — ez a vásárlás máshonnan venne el pénzt.`,
      )
    } else if (facts.purchase.price > facts.envelope.balance) {
      lines.push(
        `A(z) ${facts.envelope.categoryName} borítékban ${formatHuf(facts.envelope.balance)} van — ez a tétel ${formatHuf(facts.purchase.price - facts.envelope.balance)}-tal többe kerül.`,
      )
    } else {
      lines.push(
        `A(z) ${facts.envelope.categoryName} borítékban van rá fedezet: ${formatHuf(facts.envelope.balance)} az egyenlege.`,
      )
    }
  }

  for (const flag of facts.riskFlags) lines.push(flag.textHu)

  const rp = facts.realPrice
  if (rp.workHoursText || rp.goalText) {
    const parts = [rp.workHoursText, rp.goalText].filter(Boolean)
    lines.push(`Ez az összeg a te számaiddal: ${parts.join(' · ')}.`)
  }

  if (lines.length === 0) {
    lines.push(
      'Nem találtam hasonló korábbi vásárlást az adataid között — ez az első ilyen tétel.',
    )
  }

  return lines
}
