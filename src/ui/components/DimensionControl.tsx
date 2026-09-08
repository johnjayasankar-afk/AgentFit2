import { useId, useState } from 'react'
import clsx from 'clsx'
import type { DimensionMeta } from '../../domain/dimensions'
import type { Polarity, Score } from '../../domain/types'

const POLARITY: Record<Polarity, { glyph: string; label: string; title: string }> = {
  raises: {
    glyph: '↑',
    label: 'raises',
    title: 'A higher value raises autonomy readiness.',
  },
  lowers: {
    glyph: '↓',
    label: 'lowers',
    title: 'A higher value lowers autonomy readiness.',
  },
  tension: {
    glyph: '△',
    label: 'tension',
    title:
      'A higher value raises the pressure for autonomy without conferring any of the readiness that would justify it.',
  },
}

export function DimensionControl({
  dimension,
  value,
  onChange,
  touched,
  baseline,
  compact,
}: {
  dimension: DimensionMeta
  value: Score
  onChange: (v: Score) => void
  touched?: boolean
  /** When set, the baseline value is marked on the track for comparison. */
  baseline?: Score
  compact?: boolean
}) {
  const id = useId()
  const [why, setWhy] = useState(false)
  const polarity = POLARITY[dimension.polarity]
  const anchor = dimension.anchors[value - 1]
  const changed = baseline !== undefined && baseline !== value

  return (
    <div
      id={`dim-${dimension.key}`}
      className={clsx('af-revealable', compact ? 'py-3.5' : 'py-4')}
    >
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[13.5px] leading-tight font-medium">
          {dimension.label}
        </label>
        <div className="flex shrink-0 items-baseline gap-3">
          <span className="mono-sm text-faint" title={polarity.title} aria-hidden="true">
            {polarity.glyph} {polarity.label}
          </span>
          <span
            className={clsx(
              'num w-[42px] text-right text-[15px] leading-none font-medium tabular-nums',
              changed && 'text-signal',
            )}
          >
            {changed && (
              <span className="text-faint mr-1 text-[11px] font-normal">{baseline}→</span>
            )}
            {value}
          </span>
        </div>
      </div>

      {!compact && (
        <p id={`${id}-def`} className="text-muted mt-1.5 text-[12px] leading-[1.5]">
          {dimension.definition}
        </p>
      )}

      <div className="relative mt-3">
        <div className="af-ticks" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} data-on={n <= value} />
          ))}
        </div>
        <input
          id={id}
          type="range"
          className="af-range relative"
          min={1}
          max={5}
          step={1}
          value={value}
          aria-describedby={compact ? undefined : `${id}-def`}
          aria-valuetext={`${value} of 5 — ${anchor}`}
          onChange={(e) => onChange(Number(e.target.value) as Score)}
        />
      </div>

      {/* Anchor, review state and the rationale trigger share one line, so the
          explanation costs no vertical rhythm until it is asked for. */}
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <span className="text-soft min-w-0 text-[12px] leading-tight">{anchor}</span>
        <span className="flex shrink-0 items-baseline gap-3">
          {!touched && (
            <span className="mono-sm text-faint" title="Still at the value the preset supplied">
              unreviewed
            </span>
          )}
          {!compact && (
            <button
              type="button"
              aria-expanded={why}
              aria-controls={`${id}-why`}
              onClick={() => setWhy((v) => !v)}
              className="mono-sm text-faint hover:text-soft transition-colors"
            >
              {why ? '− why' : '+ why'}
            </button>
          )}
        </span>
      </div>

      {why && !compact && (
        <p
          id={`${id}-why`}
          className="text-muted af-enter mt-2.5 max-w-[58ch] text-[12.5px] leading-[1.6]"
        >
          {dimension.why}
        </p>
      )}
    </div>
  )
}
