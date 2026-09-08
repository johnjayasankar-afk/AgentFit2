import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import type { Assessment, Revision } from '../../domain/types'
import { DIMENSION_BY_KEY, ALL_DIMENSION_KEYS, readDimension } from '../../domain/dimensions'
import { assess } from '../../engine/assess'
import { MODEL_VERSION } from '../../engine/version'

interface Change {
  label: string
  from: string
  to: string
}

/**
 * What changed between two versions, in the user's own vocabulary.
 * Dimensions first, then the economic inputs that move the arithmetic.
 */
function diff(older: Revision['input'], newer: Revision['input']): Change[] {
  const out: Change[] = []

  for (const key of ALL_DIMENSION_KEYS) {
    const a = readDimension(older, key)
    const b = readDimension(newer, key)
    if (a !== b) out.push({ label: DIMENSION_BY_KEY[key].label, from: String(a), to: String(b) })
  }

  const economics: [string, keyof Revision['input']['economics']][] = [
    ['Volume', 'volume'],
    ['Period', 'period'],
    ['Time per case', 'minutesPerCase'],
    ['People per case', 'peopleInvolved'],
    ['Loaded hourly cost', 'loadedHourlyCost'],
    ['Engineering weekly cost', 'engineeringWeeklyCost'],
  ]
  for (const [label, field] of economics) {
    const a = older.economics[field]
    const b = newer.economics[field]
    if (a !== b) out.push({ label, from: a === null ? '—' : String(a), to: b === null ? '—' : String(b) })
  }

  if (older.definition.name !== newer.definition.name) {
    out.push({ label: 'Name', from: older.definition.name || '—', to: newer.definition.name || '—' })
  }

  return out
}

function when(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RevisionHistory({
  assessment,
  onRestore,
  onClose,
}: {
  assessment: Assessment
  onRestore: (at: number) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<number | null>(assessment.revisions[0]?.at ?? null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dialog) onClose()
    }
    dialog.addEventListener('click', onBackdrop)
    return () => {
      dialog.removeEventListener('click', onBackdrop)
      if (dialog.open) dialog.close()
    }
  }, [onClose])

  const rows = useMemo(
    () =>
      assessment.revisions.map((rev, i) => {
        const result = assess(rev.input)
        const previous = assessment.revisions[i + 1]
        return {
          rev,
          fit: result.fit.score,
          autonomy: result.autonomy.displayShort,
          changes: previous ? diff(previous.input, rev.input) : [],
          isOldest: !previous,
        }
      }),
    [assessment.revisions],
  )

  const active = rows.find((r) => r.rev.at === selected) ?? rows[0]

  return (
    <dialog
      ref={dialogRef}
      aria-label="Revision history"
      onClose={onClose}
      onCancel={onClose}
      className="panel af-enter m-0 w-full max-w-[840px] p-0 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop:bg-[color-mix(in_srgb,var(--paper)_65%,transparent)] backdrop:backdrop-blur-[2px]"
      style={{ marginInline: 'auto', marginTop: '8vh' }}
    >
      <div className="border-hair flex items-baseline justify-between gap-6 border-b px-6 py-4">
        <div>
          <div className="mono text-muted">Revision history</div>
          <p className="text-faint mt-1.5 text-[11.5px]">
            Written on every save. Restoring loads a version into the editor as an unsaved change —
            nothing is overwritten until you save again.
          </p>
        </div>
        <button className="btn btn-quiet shrink-0" onClick={onClose}>
          Close
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted px-6 py-12 text-center text-[13px]">
          No revisions yet. The first save creates one.
        </p>
      ) : (
        <div className="grid sm:grid-cols-[260px_1fr]">
          <ol className="border-hair thin-scroll m-0 max-h-[52vh] list-none overflow-y-auto p-0 sm:border-r">
            {rows.map((row, i) => (
              <li key={row.rev.at}>
                <button
                  type="button"
                  onClick={() => setSelected(row.rev.at)}
                  aria-current={row.rev.at === active?.rev.at}
                  className={clsx(
                    'border-hair w-full border-b px-5 py-3 text-left transition-colors',
                    row.rev.at === active?.rev.at
                      ? 'bg-[var(--paper-sunk)]'
                      : 'hover:bg-[var(--paper-sunk)]',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="mono-sm text-faint tabular-nums">
                      {i === 0 ? 'LATEST' : `−${i}`}
                    </span>
                    <span className="num text-[13px] tabular-nums">{row.fit}</span>
                  </div>
                  <div className="text-soft mt-1 text-[12px]">{when(row.rev.at)}</div>
                  <div className="text-faint mt-0.5 text-[11px]">
                    {row.autonomy}
                    {row.rev.modelVersion !== MODEL_VERSION && ' · older model'}
                  </div>
                </button>
              </li>
            ))}
          </ol>

          <div className="thin-scroll max-h-[52vh] overflow-y-auto px-6 py-5">
            {active && (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <div className="mono-sm text-faint">Saved {when(active.rev.at)}</div>
                    <div className="mt-2 text-[15px] font-medium">
                      Fit {active.fit} · {active.autonomy}
                    </div>
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      onRestore(active.rev.at)
                      onClose()
                    }}
                  >
                    Restore this version
                  </button>
                </div>

                {active.rev.modelVersion !== MODEL_VERSION && (
                  <p className="text-muted border-hair mt-4 border-l-2 border-l-[var(--signal)] py-1 pl-3 text-[12px] leading-[1.55]">
                    Saved under {active.rev.modelVersion}. The figures above are recomputed under{' '}
                    {MODEL_VERSION}, so they may differ from what was shown at the time.
                  </p>
                )}

                <div className="mt-7">
                  <div className="mono-sm text-faint mb-1">
                    {active.isOldest ? 'First saved version' : 'Changed from the version before'}
                  </div>
                  {active.isOldest ? (
                    <p className="text-muted border-hair border-t pt-3 text-[12.5px] leading-[1.55]">
                      Nothing to compare against — this is where the record begins.
                    </p>
                  ) : active.changes.length === 0 ? (
                    <p className="text-muted border-hair border-t pt-3 text-[12.5px] leading-[1.55]">
                      Only notes or generated content changed.
                    </p>
                  ) : (
                    <ul className="m-0 list-none p-0">
                      {active.changes.map((c) => (
                        <li
                          key={c.label}
                          className="border-hair grid grid-cols-[1fr_auto] items-baseline gap-4 border-t py-2"
                        >
                          <span className="text-[12.5px]">{c.label}</span>
                          <span className="num shrink-0 text-[12.5px] tabular-nums">
                            <span className="text-faint">{c.from}</span>
                            <span className="text-faint mx-2" aria-hidden="true">
                              →
                            </span>
                            <span className="text-signal">{c.to}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {active.rev.notes.trim() && (
                  <div className="mt-7">
                    <div className="mono-sm text-faint mb-2">Notes at the time</div>
                    <p className="text-soft border-hair border-t pt-3 text-[12.5px] leading-[1.6] whitespace-pre-wrap">
                      {active.rev.notes}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
