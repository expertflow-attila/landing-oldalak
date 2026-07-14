import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'
import { gatherFacts, type PurchaseFacts } from '../lib/advisor/facts'
import { renderAdviceHu } from '../lib/advisor/templates'
import { searchLinks, staticTips } from '../lib/alternatives'
import { nowIso, todayIso } from '../lib/dates'
import { normalizePayee } from '../lib/normalize'
import { MoneyInput, RealPriceBadge } from '../components/common'
import { formatHuf } from '../lib/money'

const WAIT_HOURS = 72

export default function SecondOpinionPage() {
  const settings = useSettings()
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []

  const [name, setName] = useState('')
  const [price, setPrice] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [facts, setFacts] = useState<PurchaseFacts | null>(null)
  const [llmText, setLlmText] = useState('')
  const [llmBusy, setLlmBusy] = useState(false)
  const [done, setDone] = useState<'wishlist' | 'bought' | null>(null)

  async function analyse() {
    if (!name.trim() || !price) return
    const [transactions, wishlistItems, budgetEntries, accounts, recurringSeries] =
      await Promise.all([
        db.transactions.toArray(),
        db.wishlistItems.toArray(),
        db.budgetEntries.toArray(),
        db.accounts.toArray(),
        db.recurringSeries.toArray(),
      ])
    setFacts(
      gatherFacts(
        { name: name.trim(), price, categoryId: categoryId === '' ? undefined : Number(categoryId) },
        { transactions, wishlistItems, categories, budgetEntries, accounts, recurringSeries, settings },
      ),
    )
    setLlmText('')
    setDone(null)
  }

  async function addToWishlist() {
    if (!facts) return
    const created = nowIso()
    const decideAfter = new Date(Date.now() + WAIT_HOURS * 3600_000).toISOString()
    await db.wishlistItems.add({
      name: facts.purchase.name,
      normalizedName: normalizePayee(facts.purchase.name),
      categoryId: facts.purchase.categoryId,
      price: facts.purchase.price,
      createdAt: created,
      decideAfter,
      status: 'waiting',
    })
    setDone('wishlist')
  }

  async function buyNow() {
    if (!facts) return
    const accounts = await db.accounts.toArray()
    if (accounts.length === 0) return
    const now = new Date()
    await db.transactions.add({
      accountId: accounts[0].id!,
      kind: 'expense',
      amount: -Math.abs(facts.purchase.price),
      date: todayIso(),
      timeOfDay: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      payee: facts.purchase.name,
      normalizedPayee: normalizePayee(facts.purchase.name),
      categoryId: facts.purchase.categoryId,
      note: 'Megvegyem? flow-ból rögzítve',
      source: 'manual',
      createdAt: nowIso(),
    })
    setDone('bought')
  }

  async function askLlm() {
    if (!facts || !settings.anthropicApiKey) return
    setLlmBusy(true)
    try {
      const { generateAdvice } = await import('../lib/advisor/llm')
      setLlmText(await generateAdvice(facts, settings.anthropicApiKey, settings.llmModel))
    } catch {
      // Hibánál csendben maradunk — a szabályalapú szöveg már látszik.
    } finally {
      setLlmBusy(false)
    }
  }

  const advice = facts ? renderAdviceHu(facts) : []

  return (
    <div>
      <h1 className="page-title">Megvegyem?</h1>
      <p className="page-sub">
        Vásárlás előtti második vélemény a saját adataidból. Nem tiltunk — tükröt tartunk.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-row">
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="so-name">Mit vennél meg?</label>
            <input
              id="so-name"
              value={name}
              placeholder="pl. Nike futócipő"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="so-price">Ár (Ft)</label>
            <MoneyInput id="so-price" value={price} onChange={setPrice} />
          </div>
          <div className="field">
            <label htmlFor="so-category">Kategória</label>
            <select
              id="so-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">nem tudom</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn primary" onClick={analyse} data-testid="analyse">
          Kérek egy második véleményt
        </button>
      </div>

      {facts && (
        <>
          <div className="card">
            <div className="card-title">
              Amit az adataid mondanak — {facts.purchase.name}, {formatHuf(facts.purchase.price)}{' '}
              <RealPriceBadge price={facts.purchase.price} settings={settings} />
            </div>
            {(llmText ? llmText.split('\n').filter(Boolean) : advice).map((line, i) => (
              <div className="mirror-line" key={i}>
                {line}
              </div>
            ))}
            {settings.anthropicApiKey && !llmText && (
              <button className="btn small" onClick={askLlm} disabled={llmBusy}>
                {llmBusy ? 'Gondolkodom…' : 'Részletesebb vélemény (AI)'}
              </button>
            )}
          </div>

          <div className="card">
            <div className="card-title">Kell-e egyáltalán újonnan?</div>
            {staticTips(facts.categoryName).map((tip) => (
              <p key={tip} style={{ fontSize: 'var(--text-body-sm)', marginBottom: 8 }}>
                · {tip}
              </p>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {searchLinks(facts.purchase.name).map((l) => (
                <a
                  key={l.url}
                  className="btn"
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l.label} ↗
                </a>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Hogyan tovább?</div>
            {done === 'wishlist' ? (
              <p data-testid="so-done">
                A kívánságlistára került {WAIT_HOURS} órás várakozással — az impulzus jellemzően
                24–48 óra alatt elmúlik. <Link to="/kivansaglista">Megnézem a listát →</Link>
              </p>
            ) : done === 'bought' ? (
              <p data-testid="so-done">
                Rögzítettük kiadásként. <Link to="/tranzakciok">Tranzakciók →</Link>
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={addToWishlist} data-testid="to-wishlist">
                  Kívánságlistára ({WAIT_HOURS} óra gondolkodás)
                </button>
                <button className="btn" onClick={buyNow}>
                  Megveszem most
                </button>
                <button className="btn" onClick={() => setFacts(null)}>
                  Mégsem
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
