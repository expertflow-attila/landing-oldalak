import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'
import { nowIso, todayIso } from '../lib/dates'
import { formatHuf } from '../lib/money'
import { normalizePayee } from '../lib/normalize'
import { CountdownBadge, EmptyState, RealPriceBadge } from '../components/common'

export default function WishlistPage() {
  const settings = useSettings()
  const items = useLiveQuery(() => db.wishlistItems.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []

  const waiting = items
    .filter((i) => i.status === 'waiting')
    .sort((a, b) => a.decideAfter.localeCompare(b.decideAfter))
  const decided = items
    .filter((i) => i.status !== 'waiting')
    .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''))

  const savedTotal = items
    .filter((i) => i.status === 'decided_drop')
    .reduce((s, i) => s + i.price, 0)

  const catName = (id?: number) => categories.find((c) => c.id === id)?.name

  async function decide(id: number, status: 'decided_buy' | 'decided_drop', item?: { name: string; price: number; categoryId?: number }) {
    await db.wishlistItems.update(id, { status, decidedAt: nowIso() })
    if (status === 'decided_buy' && item) {
      const accounts = await db.accounts.toArray()
      if (accounts.length > 0) {
        await db.transactions.add({
          accountId: accounts[0].id!,
          kind: 'expense',
          amount: -Math.abs(item.price),
          date: todayIso(),
          payee: item.name,
          normalizedPayee: normalizePayee(item.name),
          categoryId: item.categoryId,
          note: 'Kívánságlistáról, 72 óra várakozás után',
          source: 'manual',
          createdAt: nowIso(),
        })
      }
    }
  }

  return (
    <div>
      <h1 className="page-title">Kívánságlista</h1>
      <p className="page-sub">
        A 72 órás szabály: kosárba teheted, de csak 3 nap múlva dönthetsz. Az impulzus a
        legtöbbször 24–48 óra alatt elmúlik.
      </p>

      {savedTotal > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="stat">
            <span className="value" style={{ color: 'var(--color-positive)' }}>
              {formatHuf(savedTotal)}
            </span>
            <span className="label">„Meggondoltam magam" — ennyit nem költöttél el</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Várakozó tételek</div>
        {waiting.length === 0 ? (
          <EmptyState>
            Nincs várakozó tétel. Vásárlás előtt próbáld ki a{' '}
            <Link to="/megvegyem">Megvegyem?</Link> oldalt.
          </EmptyState>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Tétel</th>
                <th>Ár</th>
                <th>Állapot</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((item) => {
                const expired = new Date(item.decideAfter).getTime() <= Date.now()
                return (
                  <tr key={item.id}>
                    <td>
                      {item.name}
                      {catName(item.categoryId) && (
                        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-ink-faint)' }}>
                          {catName(item.categoryId)}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="amount">{formatHuf(item.price)}</span>{' '}
                      <RealPriceBadge price={item.price} settings={settings} />
                    </td>
                    <td>
                      <CountdownBadge decideAfter={item.decideAfter} />
                    </td>
                    <td>
                      {expired ? (
                        <span style={{ display: 'inline-flex', gap: 4 }}>
                          <button
                            className="btn small primary"
                            onClick={() => decide(item.id!, 'decided_drop')}
                          >
                            Mégsem kell
                          </button>
                          <button
                            className="btn small"
                            onClick={() => decide(item.id!, 'decided_buy', item)}
                          >
                            Megveszem
                          </button>
                        </span>
                      ) : (
                        <button
                          className="btn small danger"
                          onClick={() => decide(item.id!, 'decided_drop')}
                        >
                          Már nem kell
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {decided.length > 0 && (
        <div className="card">
          <div className="card-title">Korábbi döntések</div>
          <table className="data">
            <tbody>
              {decided.slice(0, 20).map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    <span className="amount">{formatHuf(item.price)}</span>
                  </td>
                  <td>
                    {item.status === 'decided_drop' ? (
                      <span className="badge positive">elengedted</span>
                    ) : (
                      <span className="badge">megvetted</span>
                    )}
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
