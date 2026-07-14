import { useSearchParams } from 'react-router-dom'
import { addMonths, currentMonthKey } from '../lib/dates'

/** Az aktuálisan nézett hónap az URL ?h= paraméteréből — linkelhető, tab-váltásálló. */
export function useMonth(): [string, (m: string) => void, (delta: number) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('h')
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonthKey()

  const setMonth = (m: string) => {
    const next = new URLSearchParams(params)
    if (m === currentMonthKey()) next.delete('h')
    else next.set('h', m)
    setParams(next, { replace: true })
  }

  const shift = (delta: number) => setMonth(addMonths(month, delta))

  return [month, setMonth, shift]
}
