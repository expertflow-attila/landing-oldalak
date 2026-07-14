import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { SubscriptionStatus } from '../db/schema'
import { formatDateHu, nowIso } from '../lib/dates'
import { formatHuf } from '../lib/money'
import { monthlyEquivalent, syncRecurringSeries } from '../lib/recurrence'
import { EmptyState } from '../components/common'

const CADENCE_LABEL = { weekly: 'heti', monthly: 'havi', yearly: 'éves' } as const

export default function SubscriptionsPage() {
  const series = useLiveQuery(() => db.recurringSeries.toArray(), []) ?? []

  const active = series.filter((s) => s.dismissed !== 1 && s.status !== 'cancelled')
  const cancelled = series.filter((s) => s.status === 'cancelled')
  const monthlyTotal = active.reduce((sum, s) => sum + monthlyEquivalent(s), 0)
  const cancelledMonthly = cancelled.reduce((sum, s) => sum + monthlyEquivalent(s), 0)
  const unused = active.filter((s) => s.status === 'unused')

  async function setStatus(id: number, status: SubscriptionStatus) {
    await db.recurringSeries.update(id, {
      status,
      cancelledAt: status === 'cancelled' ? nowIso() : undefined,
    })
  }

  async function rescan() {
    await syncRecurringSeries(await db.transactions.toArray())
  }

  return (
    <div>
      <h1 className="page-title">Előfizetés-audit</h1>
      <p className="page-sub">
        Ismétlődő terheléseket keresünk a tranzakcióid között, és megmutatjuk, mit fizetsz
        anélkül, hogy használnád.
      </p>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat">
            <span className="value">{formatHuf(monthlyTotal)}</span>
            <span className="label">Aktív ismétlődő tételek — havi összköltség</span>
          </div>
        </div>
        {cancelledMonthly > 0 && (
          <div className="card">
            <div className="stat">
              <span className="value" style={{ color: 'var(--color-positive)' }}>
                {formatHuf(cancelledMonthly)}
              </span>
              <span className="label">Lemondásokkal megspórolt összeg havonta</span>
            </div>
          </div>
        )}
      </div>

      {unused.length > 0 && (
        <div className="banner warning">
          {unused.length} előfizetésről jelezted, hogy nem használod — ezek együtt{' '}
          {formatHuf(unused.reduce((s, x) => s + monthlyEquivalent(x), 0))}/hó.
        </div>
      )}

      <div className="card">
        <div className="card-title">Felismert ismétlődő tételek</div>
        <button className="btn small" onClick={rescan} style={{ marginBottom: 12 }}>
          Újrakeresés a tranzakciókban
        </button>
        {active.length === 0 ? (
          <EmptyState>
            Még nincs felismert előfizetés. Legalább 3 azonos összegű, kb. havonta ismétlődő
            terhelés kell hozzá — importálj pár hónapnyi banki kivonatot.
          </EmptyState>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Szolgáltatás</th>
                <th>Gyakoriság</th>
                <th style={{ textAlign: 'right' }}>Összeg</th>
                <th>Következő várható</th>
                <th>Használod?</th>
              </tr>
            </thead>
            <tbody>
              {active.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.displayName}
                    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-ink-faint)' }}>
                      {s.occurrenceCount} alkalom · utoljára {formatDateHu(s.lastSeen)}
                    </div>
                  </td>
                  <td>
                    <span className="badge">{CADENCE_LABEL[s.cadence]}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="amount">{formatHuf(s.avgAmount)}</span>
                    {s.cadence !== 'monthly' && (
                      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-ink-faint)' }}>
                        ≈ {formatHuf(monthlyEquivalent(s))}/hó
                      </div>
                    )}
                  </td>
                  <td>{formatDateHu(s.nextExpected)}</td>
                  <td>
                    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                      <button
                        className={`btn small${s.status === 'keep' ? ' primary' : ''}`}
                        onClick={() => setStatus(s.id!, 'keep')}
                      >
                        használom
                      </button>
                      <button
                        className={`btn small${s.status === 'unused' ? ' primary' : ''}`}
                        onClick={() => setStatus(s.id!, 'unused')}
                      >
                        nem használom
                      </button>
                      <button className="btn small" onClick={() => setStatus(s.id!, 'cancelled')}>
                        lemondtam
                      </button>
                      <button
                        className="btn small"
                        title="Ez nem előfizetés"
                        onClick={() => db.recurringSeries.update(s.id!, { dismissed: 1 })}
                      >
                        nem előfizetés
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {cancelled.length > 0 && (
        <div className="card">
          <div className="card-title">Lemondott előfizetések</div>
          <table className="data">
            <tbody>
              {cancelled.map((s) => (
                <tr key={s.id}>
                  <td>{s.displayName}</td>
                  <td>
                    <span className="amount">{formatHuf(monthlyEquivalent(s))}/hó</span>
                  </td>
                  <td>
                    <span className="badge positive">lemondva</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
