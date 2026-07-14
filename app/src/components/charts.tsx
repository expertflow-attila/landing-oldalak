import { formatHuf } from '../lib/money'

// Kézzel írt, könnyű SVG-chartok — nincs külső függőség.

export interface BarDatum {
  /** Stabil, egyedi kulcs — címke-ütközésnél (pl. betöltés közben) is muszáj. */
  key: string | number
  label: string
  value: number
}

export function BarListChart({ data }: { data: BarDatum[] }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d.value))
  return (
    <div>
      {data.map((d) => (
        <div key={d.key} style={{ marginBottom: 8 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'var(--text-caption)',
              marginBottom: 2,
            }}
          >
            <span>{d.label}</span>
            <span className="amount">{formatHuf(d.value)}</span>
          </div>
          <svg width="100%" height="8" role="img" aria-label={`${d.label}: ${formatHuf(d.value)}`}>
            <rect width="100%" height="8" rx="4" fill="var(--color-surface-2)" />
            <rect
              width={`${max > 0 ? (d.value / max) * 100 : 0}%`}
              height="8"
              rx="4"
              fill="var(--color-accent)"
            />
          </svg>
        </div>
      ))}
    </div>
  )
}

export interface TrendDatum {
  label: string
  spent: number
  income: number
}

export function TrendChart({ data }: { data: TrendDatum[] }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => Math.max(d.spent, d.income)), 1)
  const barW = 100 / data.length
  const H = 120
  return (
    <div>
      <svg width="100%" height={H + 20} role="img" aria-label="Havi bevétel és kiadás trend">
        {data.map((d, i) => {
          const spentH = (d.spent / max) * H
          const incomeH = (d.income / max) * H
          const x = i * barW
          return (
            <g key={d.label}>
              <rect
                x={`${x + barW * 0.15}%`}
                y={H - incomeH}
                width={`${barW * 0.3}%`}
                height={incomeH}
                fill="var(--color-positive)"
                rx="2"
              >
                <title>{`${d.label} bevétel: ${formatHuf(d.income)}`}</title>
              </rect>
              <rect
                x={`${x + barW * 0.55}%`}
                y={H - spentH}
                width={`${barW * 0.3}%`}
                height={spentH}
                fill="var(--color-accent)"
                rx="2"
              >
                <title>{`${d.label} kiadás: ${formatHuf(d.spent)}`}</title>
              </rect>
              <text
                x={`${x + barW / 2}%`}
                y={H + 14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-ink-faint)"
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, fontSize: 'var(--text-caption)' }}>
        <span>
          <span style={{ color: 'var(--color-positive)' }}>■</span> bevétel
        </span>
        <span>
          <span style={{ color: 'var(--color-accent)' }}>■</span> kiadás
        </span>
      </div>
    </div>
  )
}
