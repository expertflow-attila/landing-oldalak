import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import { useMonth } from '../hooks/useMonth'
import { envelopeStates, toBudget } from '../lib/budgetMath'
import { formatHuf, parseHufInput } from '../lib/money'
import { Amount, MonthNav } from '../components/common'

export default function BudgetPage() {
  const [month, , shift] = useMonth()
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? []
  const budgetEntries = useLiveQuery(() => db.budgetEntries.toArray(), []) ?? []
  const groups = useLiveQuery(() => db.categoryGroups.orderBy('sortOrder').toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const [editing, setEditing] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const states = envelopeStates(month, budgetEntries, transactions)
  const available = toBudget(month, accounts, budgetEntries, transactions)

  async function saveAssigned(categoryId: number) {
    const value = parseHufInput(editValue) ?? 0
    const existing = budgetEntries.find(
      (e) => e.month === month && e.categoryId === categoryId,
    )
    if (existing) await db.budgetEntries.update(existing.id!, { assigned: value })
    else await db.budgetEntries.add({ month, categoryId, assigned: value })
    setEditing(null)
  }

  return (
    <div>
      <h1 className="page-title">Keretek</h1>
      <p className="page-sub">
        Boríték-módszer: minden forintnak adj feladatot. Amit nem költesz el, átcsúszik a
        következő hónapra.
      </p>
      <MonthNav month={month} onShift={shift} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="stat">
          <span
            className="value"
            style={{ color: available < 0 ? 'var(--color-danger)' : 'var(--color-positive)' }}
            data-testid="to-budget"
          >
            {formatHuf(available)}
          </span>
          <span className="label">
            {available >= 0
              ? 'Beosztható — ennyi pénznek nincs még feladata'
              : 'Többet osztottál be, mint amennyi pénzed van'}
          </span>
        </div>
      </div>

      {groups.map((group) => {
        const groupCats = categories
          .filter((c) => c.groupId === group.id && c.archived !== 1)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        if (groupCats.length === 0) return null
        return (
          <div className="card" key={group.id}>
            <div className="card-title">{group.name}</div>
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Kategória</th>
                  <th>E havi keret</th>
                  <th>E havi költés</th>
                  <th>Boríték-egyenleg</th>
                </tr>
              </thead>
              <tbody>
                {groupCats.map((cat) => {
                  const s = states.get(cat.id!) ?? {
                    assigned: 0,
                    spent: 0,
                    balance: 0,
                    overspent: false,
                  }
                  return (
                    <tr key={cat.id}>
                      <td>{cat.name}</td>
                      <td>
                        {editing === cat.id ? (
                          <span style={{ display: 'inline-flex', gap: 4 }}>
                            <input
                              autoFocus
                              style={{ width: 110, padding: '2px 6px' }}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveAssigned(cat.id!)
                                if (e.key === 'Escape') setEditing(null)
                              }}
                            />
                            <button className="btn small" onClick={() => saveAssigned(cat.id!)}>
                              OK
                            </button>
                          </span>
                        ) : (
                          <button
                            className="btn small"
                            onClick={() => {
                              setEditing(cat.id!)
                              setEditValue(s.assigned ? String(s.assigned) : '')
                            }}
                          >
                            {formatHuf(s.assigned)} ✎
                          </button>
                        )}
                      </td>
                      <td>
                        <Amount value={-s.spent} />
                      </td>
                      <td>
                        <Amount value={s.balance} />{' '}
                        {s.overspent && <span className="badge danger">túlköltve</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
