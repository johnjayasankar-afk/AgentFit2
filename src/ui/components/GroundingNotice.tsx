import clsx from 'clsx'
import type { Grounding, LoadBearingValue } from '../../engine/grounding'

/** Scroll a load-bearing value into view and mark it, briefly. */
function reveal(key: string): void {
  const id = key.startsWith('economics.') && !key.includes('variability') ? `field-${key}` : `dim-${key}`
  const el = document.getElementById(id) ?? document.getElementById(`dim-${key}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.setAttribute('data-revealed', 'true')
  window.setTimeout(() => el.removeAttribute('data-revealed'), 1600)
  // Focus the control itself so keyboard users land somewhere useful.
  el.querySelector<HTMLElement>('input, textarea, select')?.focus({ preventScroll: true })
}

/**
 * States what the recommendation rests on, and how much of it the user has
 * actually confirmed.
 *
 * Shown above the result rather than beneath it: a reader who takes the number
 * and leaves should have passed this first. Once every load-bearing value is
 * reviewed it collapses to a single quiet line, because at that point it is
 * reassurance rather than a caveat.
 */
export function GroundingNotice({
  grounding,
  onReview,
}: {
  grounding: Grounding
  /** Start the guided pass. Absent where a review would make no sense. */
  onReview?: () => void
}) {
  const { state, loadBearing, reviewedCount, nextToReview } = grounding

  if (state === 'grounded') {
    return (
      <div className="border-hair flex items-baseline gap-3 border-t pt-3">
        <span className="mono-sm text-muted shrink-0">Grounded</span>
        <span className="text-faint text-[11.5px] leading-[1.5]">
          All {loadBearing.length} values this recommendation depends on have been reviewed.
        </span>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'border-l-2 py-1 pl-4',
        state === 'provisional' ? 'border-l-[var(--signal)]' : 'border-l-[var(--hair-strong)]',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span
          className={clsx('mono-sm', state === 'provisional' ? 'text-signal' : 'text-muted')}
        >
          {grounding.headline}
        </span>
        <span className="mono-sm text-faint tabular-nums">
          {reviewedCount} / {loadBearing.length} confirmed
        </span>
      </div>

      <p className="text-soft mt-2 max-w-[54ch] text-[12.5px] leading-[1.55]">{grounding.detail}</p>

      {nextToReview.length > 0 && onReview && (
        <button className="btn btn-primary mt-3.5" onClick={onReview}>
          Review {nextToReview.length} {nextToReview.length === 1 ? 'value' : 'values'}
        </button>
      )}

      {nextToReview.length > 0 && (
        <div className="mt-3.5">
          <div className="mono-sm text-faint mb-1.5">
            {onReview ? 'Or jump straight to one' : state === 'provisional' ? 'Start here' : 'Still to confirm'}
          </div>
          <ul className="m-0 list-none p-0">
            {nextToReview.slice(0, 4).map((v) => (
              <ReviewLink key={v.key} value={v} />
            ))}
          </ul>
          {nextToReview.length > 4 && (
            <p className="text-faint mt-2 text-[11px]">
              and {nextToReview.length - 4} more in the assessment.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ReviewLink({ value }: { value: LoadBearingValue }) {
  return (
    <li className="border-hair border-t first:border-t-0">
      <button
        type="button"
        onClick={() => reveal(value.key)}
        className="group flex w-full items-baseline gap-3 py-2 text-left transition-colors"
      >
        <span className="text-faint group-hover:text-signal shrink-0 transition-colors" aria-hidden="true">
          ↳
        </span>
        <span className="min-w-0">
          <span className="text-soft group-hover:text-[var(--ink)] block text-[12.5px] leading-tight font-medium transition-colors">
            {value.label}
          </span>
          <span className="text-faint mt-0.5 block text-[11px] leading-[1.45]">{value.reason}</span>
        </span>
      </button>
    </li>
  )
}
