import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { useMonth } from '../hooks/useMonth'
import { useSettings } from '../hooks/useSettings'
import { monthlyTotals, spendingByCategory } from '../lib/budgetMath'
import { addMonths, monthLabel } from '../lib/dates'
import { buildImpulseProfile, insightsFrom } from '../lib/impulse'
import { inferPayday } from '../lib/payday'
import { monthlyEquivalent } from '../lib/recurrence'
import { formatHuf } from '../lib/money'
import { EmptyState, MonthNav } from '../components/common'
import { BarListChart, TrendChart } from '../components/charts'

export default function DashboardPage() {
  const [month, , shift] = useMonth()
  const settings = useSettings()
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const series = useLiveQuery(() => db.recurringSeries.toArray(), []) ?? []
  const wishes = useLiveQuery(() => db.wishlistItems.toArray(), []) ?? []

  const catName = (id: number) =>
    id === -1 ? 'Besorolatlan' : (categories.find((c) => c.id === id)?.name ?? 'Besorolatlan')

  const byCategory = spendingByCategory(month, transactions)
  const totalSpent = byCategory.reduce((s, c) => s + c.spent, 0)

  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5))
  const trend = monthlyTotals(months, transactions).map((t) => ({
    label: t.month.slice(5),
    spent: t.spent,
    income: t.income,
  }))

  const payday = inferPayday(transactions, settings)
  const insights = insightsFrom(
    buildImpulseProfile(transactions, categories, payday?.dayOfMonth ?? null),
  )

  const activeSubs = series.filter((s) => s.status !== 'cancelled' && s.dismissed !== 1)
  const subsMonthly = activeSubs.reduce((s, x) => s + monthlyEquivalent(x), 0)
  const droppedSavings = wishes
    .filter((w) => w.status === 'decided_drop')
    .reduce((s, w) => s + w.price, 0)
  const cancelledSavings = series
    .filter((s) => s.status === 'cancelled')
    .reduce((s, x) => s + monthlyEquivalent(x), 0)

  return (
    <div>
      <h1 className="page-title">Áttekintés</h1>
      <p className="page-sub">
        Láthatóvá tesszük, mire megy a pénzed — aki kategorizáltan látja a költését, átlagosan
        kevesebbet költ.
      </p>
      <MonthNav month={month} onShift={shift} />

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat">
            <span className="value">{formatHuf(totalSpent)}</span>
            <span className="label">Ennyit költöttél — {monthLabel(month)}</span>
          </div>
        </div>
        <div className="card">
          <div className="stat">
            <span className="value">{formatHuf(subsMonthly)}</span>
            <span className="label">Aktív előfizetéseid havi költsége</span>
          </div>
        </div>
        {droppedSavings + cancelledSavings > 0 && (
          <div className="card">
            <div className="stat">
              <span className="value" style={{ color: 'var(--color-positive)' }}>
                {formatHuf(droppedSavings + cancelledSavings)}
              </span>
              <span className="label">
                „Meggondoltam magam" megtakarítás (kívánságlista + lemondott előfizetés/hó)
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Költés kategóriánként</div>
          {byCategory.length === 0 ? (
            <EmptyState>
              Ebben a hónapban még nincs kiadás. <Link to="/tranzakciok">Rögzíts egyet</Link> vagy{' '}
              <Link to="/import">importálj banki kivonatot</Link>.
            </EmptyState>
          ) : (
            <BarListChart
              data={byCategory.slice(0, 10).map((c) => ({
                key: c.categoryId,
                label: catName(c.categoryId),
                value: c.spent,
              }))}
            />
          )}
        </div>
        <div className="card">
          <div className="card-title">6 havi trend</div>
          <TrendChart data={trend} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Mintázatok az adataidból</div>
        {insights.length === 0 ? (
          <EmptyState>
            Még nincs elég adat a mintázatokhoz — pár hét költés (vagy egy banki kivonat
            importja) után itt jelennek meg a megfigyelések.
          </EmptyState>
        ) : (
          insights.map((i) => (
            <div className="mirror-line" key={i.id}>
              {i.textHu}
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="card-title">Vásárlás előtt állsz?</div>
        <p style={{ fontSize: 'var(--text-body-sm)', marginBottom: 12 }}>
          Kérj adatalapú második véleményt, mielőtt fizetsz — nem tiltunk, csak tükröt tartunk.
        </p>
        <Link className="btn primary" to="/megvegyem">
          Megvegyem? →
        </Link>
      </div>
    </div>
  )
}
