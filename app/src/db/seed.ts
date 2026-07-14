import { db } from './index'
import { todayIso } from '../lib/dates'

interface SeedCategory {
  name: string
  discretionary: 0 | 1
}

interface SeedGroup {
  name: string
  categories: SeedCategory[]
}

export const DEFAULT_GROUPS: SeedGroup[] = [
  {
    name: 'Alapok',
    categories: [
      { name: 'Lakhatás (lakbér / törlesztő)', discretionary: 0 },
      { name: 'Rezsi (villany, gáz, víz)', discretionary: 0 },
      { name: 'Internet és telefon', discretionary: 0 },
      { name: 'Élelmiszer', discretionary: 0 },
      { name: 'Közlekedés', discretionary: 0 },
      { name: 'Egészség és gyógyszertár', discretionary: 0 },
    ],
  },
  {
    name: 'Rendszeres kötelezettségek',
    categories: [
      { name: 'Előfizetések', discretionary: 0 },
      { name: 'Biztosítások', discretionary: 0 },
      { name: 'Bankköltség', discretionary: 0 },
      { name: 'Oktatás', discretionary: 0 },
    ],
  },
  {
    name: 'Életmód',
    categories: [
      { name: 'Étterem és kávézó', discretionary: 1 },
      { name: 'Szórakozás', discretionary: 1 },
      { name: 'Ruházat és cipő', discretionary: 1 },
      { name: 'Hobbi', discretionary: 1 },
      { name: 'Szépségápolás', discretionary: 1 },
      { name: 'Ajándékok', discretionary: 1 },
      { name: 'Utazás és nyaralás', discretionary: 1 },
      { name: 'Háztartás és lakásdekor', discretionary: 1 },
    ],
  },
  {
    name: 'Család',
    categories: [
      { name: 'Gyerekek', discretionary: 0 },
      { name: 'Háziállat', discretionary: 0 },
    ],
  },
  {
    name: 'Megtakarítási célok',
    categories: [
      { name: 'Vésztartalék', discretionary: 0 },
      { name: 'Lakás-önerő', discretionary: 0 },
      { name: 'Nagyobb vásárlásra gyűjtés', discretionary: 0 },
    ],
  },
  {
    name: 'Egyéb',
    categories: [
      { name: 'Készpénzfelvét', discretionary: 0 },
      { name: 'Besorolatlan', discretionary: 0 },
    ],
  },
]

/** Első indításkor: alap kategóriakészlet + két kezdő számla. */
export async function seedIfEmpty(): Promise<void> {
  const groupCount = await db.categoryGroups.count()
  if (groupCount > 0) return

  await db.transaction('rw', [db.categoryGroups, db.categories, db.accounts], async () => {
    for (let g = 0; g < DEFAULT_GROUPS.length; g++) {
      const group = DEFAULT_GROUPS[g]
      const groupId = await db.categoryGroups.add({ name: group.name, sortOrder: g })
      await db.categories.bulkAdd(
        group.categories.map((c, i) => ({
          groupId,
          name: c.name,
          sortOrder: i,
          discretionary: c.discretionary,
        })),
      )
    }
    const created = todayIso()
    await db.accounts.bulkAdd([
      { name: 'Bankszámla', type: 'bank', startingBalance: 0, createdAt: created },
      { name: 'Készpénz', type: 'cash', startingBalance: 0, createdAt: created },
    ])
  })
}
