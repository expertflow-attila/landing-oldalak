import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import type { ColumnMapping } from '../db/schema'
import { decodeBankCsv, SUPPORTED_ENCODINGS } from '../lib/importer/encoding'
import { parseCsvText } from '../lib/importer/parseCsv'
import { detectPreset, guessDelimiter } from '../lib/importer/detect'
import { transformRows } from '../lib/importer/transform'
import { markDuplicates } from '../lib/importer/dedup'
import { commitBatch, type CommitResult } from '../lib/importer/commit'
import { syncRecurringSeries } from '../lib/recurrence'
import type { ParsedRow } from '../lib/importer/types'
import { Amount } from '../components/common'
import { fnv1a } from '../lib/importer/dedup'

type Role = 'skip' | 'date' | 'amount' | 'debit' | 'credit' | 'payee' | 'note' | 'currency'

const ROLE_LABELS: Record<Role, string> = {
  skip: '— kihagy —',
  date: 'Dátum',
  amount: 'Összeg (előjeles)',
  debit: 'Terhelés (kiadás)',
  credit: 'Jóváírás (bevétel)',
  payee: 'Partner',
  note: 'Megjegyzés',
  currency: 'Pénznem',
}

function mappingToRoles(mapping: ColumnMapping, colCount: number): Role[] {
  const roles: Role[] = Array(colCount).fill('skip')
  const set = (idx: number | undefined, role: Role) => {
    if (idx !== undefined && idx >= 0 && idx < colCount) roles[idx] = role
  }
  set(mapping.date, 'date')
  set(mapping.amount, 'amount')
  set(mapping.debit, 'debit')
  set(mapping.credit, 'credit')
  for (const p of mapping.payee) set(p, 'payee')
  set(mapping.note, 'note')
  set(mapping.currency, 'currency')
  return roles
}

function rolesToMapping(roles: Role[], hasHeader: boolean): ColumnMapping | string {
  const find = (role: Role) => roles.findIndex((r) => r === role)
  const date = find('date')
  if (date === -1) return 'Jelöld meg, melyik oszlop a dátum.'
  const amount = find('amount')
  const debit = find('debit')
  const credit = find('credit')
  if (amount === -1 && debit === -1 && credit === -1) {
    return 'Jelöld meg az összeg-oszlopot (vagy a terhelés/jóváírás oszlopokat).'
  }
  const payee = roles.map((r, i) => (r === 'payee' ? i : -1)).filter((i) => i !== -1)
  if (payee.length === 0) return 'Jelöld meg a partner-oszlopot.'
  const note = find('note')
  const currency = find('currency')
  return {
    date,
    amount: amount === -1 ? undefined : amount,
    debit: debit === -1 ? undefined : debit,
    credit: credit === -1 ? undefined : credit,
    payee,
    note: note === -1 ? undefined : note,
    currency: currency === -1 ? undefined : currency,
    hasHeader,
  }
}

export default function ImportPage() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const savedPresets = useLiveQuery(() => db.importPresets.toArray(), []) ?? []

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [buf, setBuf] = useState<ArrayBuffer | null>(null)
  const [fileName, setFileName] = useState('')
  const [encoding, setEncoding] = useState('')
  const [delimiter, setDelimiter] = useState(';')
  const [hasHeader, setHasHeader] = useState(true)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [detectedBank, setDetectedBank] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<number | ''>('')
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [mappingError, setMappingError] = useState('')
  const [result, setResult] = useState<CommitResult | null>(null)
  const [presetName, setPresetName] = useState('')

  function reparse(
    buffer: ArrayBuffer,
    forcedEncoding?: string,
    forcedDelimiter?: string,
    header = hasHeader,
  ) {
    const decoded = decodeBankCsv(buffer, forcedEncoding)
    const delim = forcedDelimiter ?? guessDelimiter(decoded.text)
    const { headers: hs, rows } = parseCsvText(decoded.text, delim, header)
    setEncoding(decoded.encoding)
    setDelimiter(delim)
    setHeaders(hs)
    setRawRows(rows)

    // Mentett preset fejléc-ujjlenyomat alapján, különben beépített detektálás.
    const fingerprint = fnv1a(hs.join('|').toLowerCase())
    const saved = savedPresets.find((p) => p.headerFingerprint === fingerprint)
    if (saved) {
      setRoles(mappingToRoles(saved.mapping, Math.max(hs.length, rows[0]?.length ?? 0)))
      setDetectedBank(`mentett sablon: ${saved.name}`)
    } else {
      const detection = detectPreset(hs, rows.slice(0, 8))
      setRoles(mappingToRoles(detection.mapping, Math.max(hs.length, rows[0]?.length ?? 0)))
      setDetectedBank(detection.preset ? detection.preset.name : null)
    }
  }

  async function onFile(file: File) {
    const buffer = await file.arrayBuffer()
    setBuf(buffer)
    setFileName(file.name)
    reparse(buffer)
    setStep(2)
  }

  async function buildPreview() {
    const mapping = rolesToMapping(roles, hasHeader)
    if (typeof mapping === 'string') {
      setMappingError(mapping)
      return
    }
    if (!accountId) {
      setMappingError('Válaszd ki, melyik számlára importálsz.')
      return
    }
    setMappingError('')
    const rows = transformRows(rawRows, mapping)
    await markDuplicates(rows, Number(accountId))
    setPreview(rows)
    setStep(3)
  }

  async function doCommit() {
    if (!accountId) return
    const mapping = rolesToMapping(roles, hasHeader)
    if (typeof mapping === 'string') return
    const res = await commitBatch(preview, Number(accountId))
    setResult(res)
    if (presetName.trim()) {
      await db.importPresets.add({
        name: presetName.trim(),
        bankId: 'custom',
        headerFingerprint: fnv1a(headers.join('|').toLowerCase()),
        mapping,
        encoding,
        delimiter,
      })
    }
    syncRecurringSeries(await db.transactions.toArray()).catch(() => {})
  }

  const colCount = Math.max(headers.length, rawRows[0]?.length ?? 0)
  const okCount = preview.filter((r) => !r.error && (!r.duplicate || r.forceImport)).length
  const dupCount = preview.filter((r) => r.duplicate && !r.forceImport).length
  const errCount = preview.filter((r) => r.error).length

  return (
    <div>
      <h1 className="page-title">Banki kivonat import</h1>
      <p className="page-sub">
        CSV-export a netbankodból (OTP, K&H, Erste, Revolut, Wise vagy bármi más) — a
        kódolást és az oszlopokat automatikusan felismerjük, de bármit átállíthatsz.
      </p>

      {step === 1 && (
        <div className="card">
          <div className="card-title">1. lépés — fájl kiválasztása</div>
          <input
            type="file"
            accept=".csv,.txt"
            data-testid="csv-file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
          />
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-ink-faint)', marginTop: 12 }}>
            A fájl nem kerül fel sehova — minden feldolgozás a böngésződben történik.
          </p>
        </div>
      )}

      {step === 2 && (
        <>
          <div className="card">
            <div className="card-title">
              2. lépés — oszlopok hozzárendelése ({fileName})
            </div>
            {detectedBank && (
              <div className="banner info">Felismert formátum: {detectedBank}</div>
            )}
            <div className="form-row">
              <div className="field">
                <label htmlFor="imp-account">Cél-számla</label>
                <select
                  id="imp-account"
                  value={accountId}
                  data-testid="import-account"
                  onChange={(e) => setAccountId(Number(e.target.value))}
                >
                  <option value="">Válassz…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="imp-encoding">Kódolás</label>
                <select
                  id="imp-encoding"
                  value={encoding}
                  onChange={(e) => buf && reparse(buf, e.target.value, delimiter)}
                >
                  {SUPPORTED_ENCODINGS.map((enc) => (
                    <option key={enc} value={enc}>
                      {enc}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="imp-delim">Elválasztó</label>
                <select
                  id="imp-delim"
                  value={delimiter}
                  onChange={(e) => buf && reparse(buf, encoding, e.target.value)}
                >
                  <option value=";">pontosvessző (;)</option>
                  <option value=",">vessző (,)</option>
                  <option value={'\t'}>tabulátor</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="imp-header">Első sor fejléc?</label>
                <select
                  id="imp-header"
                  value={hasHeader ? '1' : '0'}
                  onChange={(e) => {
                    const h = e.target.value === '1'
                    setHasHeader(h)
                    if (buf) reparse(buf, encoding, delimiter, h)
                  }}
                >
                  <option value="1">igen</option>
                  <option value="0">nem</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data">
                <thead>
                  <tr>
                    {Array.from({ length: colCount }, (_, c) => (
                      <th key={c}>
                        <select
                          value={roles[c] ?? 'skip'}
                          data-testid={`role-${c}`}
                          onChange={(e) => {
                            const next = [...roles]
                            next[c] = e.target.value as Role
                            setRoles(next)
                          }}
                        >
                          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        {hasHeader && (
                          <div style={{ fontWeight: 400, marginTop: 4 }}>{headers[c]}</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {Array.from({ length: colCount }, (_, c) => (
                        <td key={c}>{row[c]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mappingError && <div className="banner warning">{mappingError}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" onClick={() => setStep(1)}>
                ← Vissza
              </button>
              <button className="btn primary" onClick={buildPreview} data-testid="to-preview">
                Előnézet →
              </button>
            </div>
          </div>
        </>
      )}

      {step === 3 && !result && (
        <div className="card">
          <div className="card-title">3. lépés — ellenőrzés és import</div>
          <p style={{ fontSize: 'var(--text-body-sm)', marginBottom: 12 }}>
            {okCount} tétel importálható
            {dupCount > 0 && <> · {dupCount} kihagyva (valószínű duplikátum)</>}
            {errCount > 0 && <> · {errCount} hibás sor</>}
          </p>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Dátum</th>
                  <th>Partner</th>
                  <th style={{ textAlign: 'right' }}>Összeg</th>
                  <th>Állapot</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} style={r.error ? { opacity: 0.5 } : undefined}>
                    <td>{r.date ?? '—'}</td>
                    <td>{r.payee ?? r.cells.join(' | ').slice(0, 60)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {r.amount !== undefined ? <Amount value={r.amount} /> : '—'}
                    </td>
                    <td>
                      {r.error ? (
                        <span className="badge danger">{r.error}</span>
                      ) : r.duplicate && !r.forceImport ? (
                        <>
                          <span className="badge warning">duplikátum</span>{' '}
                          <button
                            className="btn small"
                            onClick={() => {
                              const next = [...preview]
                              next[i] = { ...r, forceImport: true }
                              setPreview(next)
                            }}
                          >
                            mégis importáld
                          </button>
                        </>
                      ) : (
                        <span className="badge positive">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="field" style={{ maxWidth: 320, marginTop: 12 }}>
            <label htmlFor="preset-name">Sablon mentése későbbre (opcionális név)</label>
            <input
              id="preset-name"
              value={presetName}
              placeholder="pl. OTP export"
              onChange={(e) => setPresetName(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setStep(2)}>
              ← Vissza
            </button>
            <button className="btn primary" onClick={doCommit} data-testid="do-import">
              {okCount} tétel importálása
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="card-title">Kész!</div>
          <p data-testid="import-result">
            {result.imported} tétel importálva
            {result.skippedDuplicates > 0 && <>, {result.skippedDuplicates} duplikátum kihagyva</>}
            {result.skippedErrors > 0 && <>, {result.skippedErrors} hibás sor kihagyva</>}.
          </p>
          <p style={{ fontSize: 'var(--text-body-sm)', color: 'var(--color-ink-soft)', margin: '8px 0 12px' }}>
            A besorolatlan tételeket a Tranzakciók oldalon kategorizálhatod.
          </p>
          <button
            className="btn"
            onClick={() => {
              setStep(1)
              setResult(null)
              setBuf(null)
              setPreview([])
            }}
          >
            Új import
          </button>
        </div>
      )}
    </div>
  )
}
