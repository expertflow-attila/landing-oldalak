import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { exportAll, importAll } from '../db/exportImport'
import { setSetting, useSettings } from '../hooks/useSettings'
import { hourlyWage } from '../lib/realPrice'
import { formatHuf, parseHufInput } from '../lib/money'
import { nowIso, todayIso } from '../lib/dates'
import { MoneyInput } from '../components/common'

function NumberField({
  label,
  value,
  onCommit,
  suffix,
  id,
}: {
  label: string
  value: number | undefined
  onCommit: (v: number | undefined) => void
  suffix?: string
  id: string
}) {
  const [text, setText] = useState(value !== undefined ? String(value) : '')
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {suffix ? ` (${suffix})` : ''}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const parsed = parseHufInput(text)
          onCommit(parsed === null ? undefined : parsed)
        }}
      />
    </div>
  )
}

export default function SettingsPage() {
  const settings = useSettings()
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const [apiKey, setApiKey] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState<number | null>(null)
  const [importError, setImportError] = useState('')

  const wage = hourlyWage(settings)

  async function downloadExport() {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `keret-mentes-${todayIso()}.json`
    a.click()
    URL.revokeObjectURL(url)
    await setSetting('lastExportAt', nowIso())
  }

  async function onImportFile(file: File) {
    setImportError('')
    try {
      const data = JSON.parse(await file.text())
      await importAll(data)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Nem sikerült beolvasni a fájlt.')
    }
  }

  return (
    <div>
      <h1 className="page-title">Beállítások</h1>
      <p className="page-sub">
        Minden adat kizárólag ezen az eszközön, a böngésződben tárolódik.
      </p>

      <div className="card">
        <div className="card-title">„Igazi ár" kalkulátor — a te számaid</div>
        <div className="form-row">
          <NumberField
            id="set-income"
            label="Nettó havi jövedelem"
            suffix="Ft"
            value={settings.netMonthlyIncome}
            onCommit={(v) => setSetting('netMonthlyIncome', v)}
          />
          <NumberField
            id="set-hours"
            label="Heti munkaóra"
            value={settings.weeklyWorkHours}
            onCommit={(v) => setSetting('weeklyWorkHours', v)}
          />
          <NumberField
            id="set-payday"
            label="Fizetésnap (hónap napja)"
            value={settings.paydayDayOfMonth}
            onCommit={(v) =>
              setSetting('paydayDayOfMonth', v && v >= 1 && v <= 28 ? v : undefined)
            }
          />
        </div>
        {wage && (
          <p style={{ fontSize: 'var(--text-body-sm)', color: 'var(--color-ink-soft)' }}>
            Ezek alapján egy munkaórád nettó {formatHuf(wage)} — az árakat ehhez mérjük.
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-title">Megtakarítási cél</div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="set-goal-name">Cél neve</label>
            <input
              id="set-goal-name"
              defaultValue={settings.savingsGoalName ?? ''}
              placeholder="pl. lakás-önerő"
              onBlur={(e) => setSetting('savingsGoalName', e.target.value || undefined)}
            />
          </div>
          <NumberField
            id="set-goal-amount"
            label="Célösszeg"
            suffix="Ft"
            value={settings.savingsGoalAmount}
            onCommit={(v) => setSetting('savingsGoalAmount', v)}
          />
          <NumberField
            id="set-goal-saved"
            label="Eddig megvan"
            suffix="Ft"
            value={settings.savingsGoalSaved}
            onCommit={(v) => setSetting('savingsGoalSaved', v)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Számlák</div>
        <table className="data" style={{ marginBottom: 12 }}>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>
                  <span className="badge">
                    {a.type === 'bank' ? 'bankszámla' : a.type === 'cash' ? 'készpénz' : 'megtakarítás'}
                  </span>
                </td>
                <td>
                  <span className="amount">nyitó: {formatHuf(a.startingBalance)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="form-row">
          <div className="field">
            <label htmlFor="new-acc-name">Új számla neve</label>
            <input
              id="new-acc-name"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="new-acc-balance">Nyitóegyenleg (Ft)</label>
            <MoneyInput id="new-acc-balance" value={newAccountBalance} onChange={setNewAccountBalance} />
          </div>
        </div>
        <button
          className="btn"
          onClick={async () => {
            if (!newAccountName.trim()) return
            await db.accounts.add({
              name: newAccountName.trim(),
              type: 'bank',
              startingBalance: newAccountBalance ?? 0,
              createdAt: todayIso(),
            })
            setNewAccountName('')
            setNewAccountBalance(null)
          }}
        >
          Számla hozzáadása
        </button>
      </div>

      <div className="card">
        <div className="card-title">Mentés és visszaállítás</div>
        <p style={{ fontSize: 'var(--text-body-sm)', marginBottom: 12 }}>
          A böngésző tárhelye elveszhet (gépcsere, törlés) — exportálj rendszeresen.
          {settings.lastExportAt && (
            <> Utolsó mentés: {settings.lastExportAt.slice(0, 10)}.</>
          )}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={downloadExport}>
            Adatok exportálása (JSON)
          </button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            Visszaállítás mentésből…
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImportFile(f)
              }}
            />
          </label>
        </div>
        {importError && <div className="banner warning" style={{ marginTop: 12 }}>{importError}</div>}
      </div>

      <div className="card">
        <div className="card-title">AI-vélemény (opcionális)</div>
        <p style={{ fontSize: 'var(--text-body-sm)', marginBottom: 12 }}>
          Saját Anthropic API-kulccsal a „Megvegyem?" oldal személyre szabottabb szöveget ír.
          A kulcs csak ezen az eszközön tárolódik, és sosem kerül bele az export-fájlba.
          Kulcs nélkül is minden működik, szabályalapú szövegekkel.
        </p>
        <div className="form-row">
          <div className="field" style={{ minWidth: 280 }}>
            <label htmlFor="set-api-key">
              Anthropic API-kulcs {settings.anthropicApiKey ? '(beállítva ✓)' : ''}
            </label>
            <input
              id="set-api-key"
              type="password"
              value={apiKey}
              placeholder="sk-ant-…"
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={() => {
              if (apiKey.trim()) {
                setSetting('anthropicApiKey', apiKey.trim())
                setApiKey('')
              }
            }}
          >
            Kulcs mentése
          </button>
          {settings.anthropicApiKey && (
            <button className="btn danger" onClick={() => setSetting('anthropicApiKey', undefined)}>
              Kulcs törlése
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
