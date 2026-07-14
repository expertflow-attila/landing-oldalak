import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { AppSettings } from '../db/schema'

export function useSettings(): AppSettings {
  return (
    useLiveQuery(async () => {
      const rows = await db.settings.toArray()
      return Object.fromEntries(rows.map((r) => [r.key, r.value])) as AppSettings
    }) ?? {}
  )
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  if (value === undefined || value === null || value === '') {
    await db.settings.delete(key as string)
  } else {
    await db.settings.put({ key: key as string, value })
  }
}
