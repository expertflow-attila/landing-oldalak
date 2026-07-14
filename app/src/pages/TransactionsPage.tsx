import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import type { TxKind } from '../db/schema'
import { nowIso, todayIso } from '../lib/dates'
import { normalizePayee } from '../lib/normalize'
import { syncRecurringSeries } from '../lib/recurrence'
import { Amount, EmptyState, MoneyInput } from '../components/common'
import { formatDateHu } from '../lib/dates'

export default function TransactionsPage() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const transactions =
    useLiveQuery(() => db.transactions.orderBy('date').reverse().limit(300).toArray(), []) ?? []

  const [kind, setKind] = useState<TxKind>('expense')
  const [amount, setAmount] = useState<number | null>(null)
  const [payee, setPayee] = useState('')
  const [date, setDate] = useState(todayIso())
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [accountId, setAccountId] = useState<number | ''>('')
  const [toAccountId, setToAccountId] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('')

  const effectiveAccount = accountId || accounts[0]?.id || ''

  async function addTransaction() {
    if (!amount || !effectiveAccount) return
    if (kind === 'transfer') {
      if (!toAccountId || toAccountId === effectiveAccount) return
      const abs = Math.abs(amount)
      const created = nowIso()
      await db.transaction('rw', db.transactions, async () => {
        const fromId = await db.transactions.add({
          accountId: Number(effectiveAccount),
          kind: 'transfer',
          amount: -abs,
          date,
          payee: 'Átvezetés',
          normalizedPayee: 'atvezetes',
          note: note || undefined,
          source: 'manual',
          createdAt: created,
        })
        const toId = await db.transactions.add({
          accountId: Number(toAccountId),
          kind: 'transfer',
          amount: abs,
          date,
          payee: 'Átvezetés',
          normalizedPayee: 'atvezetes',
          note: note || undefined,
          transferPairId: fromId,
          source: 'manual',
          createdAt: created,
        })
        await db.transactions.update(fromId, { transferPairId: toId })
      })
    } else {
      if (!payee.trim()) return
      const signed = kind === 'expense' ? -Math.abs(amount) : Math.abs(amount)
      const now = new Date()
      await db.transactions.add({
        accountId: Number(effectiveAccount),
        kind,
        amount: signed,
        date,
        timeOfDay: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        payee: payee.trim(),
        normalizedPayee: normalizePayee(payee),
        categoryId: categoryId === '' ? undefined : Number(categoryId),
        note: note || undefined,
        source: 'manual',
        createdAt: nowIso(),
      })
      // Új adat után frissítjük az előfizetés-detektort.
      syncRecurringSeries(await db.transactions.toArray()).catch(() => {})
    }
    setAmount(null)
    setPayee('')
    setNote('')
  }

  const visible = filter
    ? transactions.filter((t) =>
        (t.payee + ' ' + (t.note ?? '')).toLowerCase().includes(filter.toLowerCase()),
      )
    : transactions

  const catName = (id?: number) => categories.find((c) => c.id === id)?.name
  const accName = (id: number) => accounts.find((a) => a.id === id)?.name ?? '?'

  return (
    <div>
      <h1 className="page-title">Tranzakciók</h1>
      <p className="page-sub">Kézi rögzítés és a teljes költéstörténet.</p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Új tétel</div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="tx-kind">Típus</label>
            <select id="tx-kind" value={kind} onChange={(e) => setKind(e.target.value as TxKind)}>
              <option value="expense">Kiadás</option>
              <option value="income">Bevétel</option>
              <option value="transfer">Átvezetés</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="tx-amount">Összeg (Ft)</label>
            <MoneyInput id="tx-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="field">
            <label htmlFor="tx-date">Dátum</label>
            <input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="tx-account">{kind === 'transfer' ? 'Honnan' : 'Számla'}</label>
            <select
              id="tx-account"
              value={effectiveAccount}
              onChange={(e) => setAccountId(Number(e.target.value))}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          {kind === 'transfer' ? (
            <div className="field">
              <label htmlFor="tx-to">Hová</label>
              <select
                id="tx-to"
                value={toAccountId}
                onChange={(e) => setToAccountId(Number(e.target.value))}
              >
                <option value="">Válassz…</option>
                {accounts
                  .filter((a) => a.id !== Number(effectiveAccount))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <>
              <div className="field" style={{ minWidth: 200 }}>
                <label htmlFor="tx-payee">Partner / bolt</label>
                <input
                  id="tx-payee"
                  value={payee}
                  placeholder="pl. Lidl, Spotify, munkabér"
                  onChange={(e) => setPayee(e.target.value)}
                />
              </div>
              {kind === 'expense' && (
                <div className="field">
                  <label htmlFor="tx-category">Kategória</label>
                  <select
                    id="tx-category"
                    value={categoryId}
                    onChange={(e) =>
                      setCategoryId(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  >
                    <option value="">Besorolatlan</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          <div className="field" style={{ minWidth: 160 }}>
            <label htmlFor="tx-note">Megjegyzés</label>
            <input id="tx-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <button className="btn primary" onClick={addTransaction} data-testid="add-tx">
          Rögzítés
        </button>
      </div>

      <div className="card">
        <div className="card-title">Előzmények</div>
        <div className="field" style={{ maxWidth: 300 }}>
          <input
            placeholder="Keresés partner vagy megjegyzés szerint…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {visible.length === 0 ? (
          <EmptyState>Még nincs tranzakció.</EmptyState>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Dátum</th>
                <th>Partner</th>
                <th>Kategória</th>
                <th>Számla</th>
                <th style={{ textAlign: 'right' }}>Összeg</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id}>
                  <td>{formatDateHu(t.date)}</td>
                  <td>
                    {t.payee}
                    {t.note && (
                      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-ink-faint)' }}>
                        {t.note}
                      </div>
                    )}
                  </td>
                  <td>
                    {t.kind === 'transfer' ? (
                      <span className="badge">átvezetés</span>
                    ) : (
                      (catName(t.categoryId) ?? <span className="badge">besorolatlan</span>)
                    )}
                  </td>
                  <td>{accName(t.accountId)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Amount value={t.amount} />
                  </td>
                  <td>
                    <button
                      className="btn small danger"
                      aria-label="Törlés"
                      onClick={async () => {
                        await db.transactions.delete(t.id!)
                        if (t.transferPairId) await db.transactions.delete(t.transferPairId)
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
