import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import type { AssessmentInput, Score } from '../../../domain/types'
import { DIMENSION_BY_KEY, GROUP_META } from '../../../domain/dimensions'
import { PERIOD_LABEL } from '../../../domain/types'
import { ECONOMICS_KEYS } from '../../../engine/grounding'
import { deriveVolume } from '../../../engine/normalize'
import {
  isDimensionKey,
  type ReviewOutcome,
  type ReviewStep,
  type ReviewSummary,
} from '../../../engine/review'

/**
 * One question at a time.
 *
 * The assessment sheet is a form: twenty controls, all equally present, all
 * equally silent about which of them is carrying the answer. That is the right
 * shape for editing an assessment you already understand and the wrong shape
 * for building one. This is the other shape — the values that matter, in the
 * order they matter, with the five published anchors presented as what they
 * actually are: five descriptions of a real situation, exactly one of which is
 * yours.
 *
 * The consequence of an answer appears after it is given, never before. See
 * `engine/review.ts` for why that ordering is the whole point.
 */

const OUTCOME_TONE: Record<ReviewOutcome['weight'], string> = {
  recommendation: 'text-signal',
  readiness: 'text-signal',
  score: 'text-soft',
  none: 'text-muted',
}

export function ReviewPanel({
  step,
  name,
  recheck,
  index,
  total,
  input,
  outcome,
  answered,
  onAnswer,
  onEconomics,
  onNext,
  onSkip,
  onBack,
  onExit,
}: {
  step: ReviewStep
  /** The workflow under assessment, so a long pass never loses its subject. */
  name: string
  /** True when every value was already confirmed and this is a second look. */
  recheck: boolean
  /** 0-based position in the queue. */
  index: number
  total: number
  input: AssessmentInput
  /** The result of the answer just given, or null before one is given. */
  outcome: ReviewOutcome | null
  answered: boolean
  onAnswer: (value: Score) => void
  onEconomics: (patch: { volume?: number; minutesPerCase?: number }) => void
  onNext: () => void
  onSkip: () => void
  onBack: () => void
  onExit: () => void
}) {
  const advance = useRef<HTMLButtonElement>(null)

  // Move focus to the way forward the moment an answer lands, so the pass can
  // be completed entirely from the keyboard without hunting for the button.
  // The panel is keyed on the step, so this runs once per value.
  useEffect(() => {
    if (answered) advance.current?.focus()
  }, [answered])

  return (
    <section className="af-enter" aria-label={`Reviewing ${step.label}`}>
      <ReviewHeader
        name={name}
        label={recheck ? 'Second pass' : 'Guided review'}
        index={index}
        total={total}
        onExit={onExit}
      />

      <div className="mt-9">
        <p className="mono text-muted">{contextLabel(step.key)}</p>
        <h2 className="display-sm mt-3">{step.label}</h2>
        <p className="text-muted mt-2 max-w-[54ch] text-[13px] leading-[1.55]">
          {definitionFor(step.key)}
        </p>
        <p className="border-l-2 border-l-[var(--hair-strong)] text-soft mt-5 max-w-[54ch] py-0.5 pl-4 text-[12.5px] leading-[1.55]">
          {step.reason}
        </p>
      </div>

      {step.kind === 'dimension' && isDimensionKey(step.key) ? (
        <AnchorChoice dimensionKey={step.key} input={input} onAnswer={onAnswer} />
      ) : (
        <EconomicsQuestion field={step.key} input={input} onChange={onEconomics} />
      )}

      <div className="border-hair mt-9 border-t pt-5">
        {outcome ? (
          <p
            className={clsx(
              'af-enter max-w-[58ch] text-[13px] leading-[1.6]',
              OUTCOME_TONE[outcome.weight],
            )}
            role="status"
          >
            {outcome.note}
          </p>
        ) : (
          <p className="text-faint max-w-[58ch] text-[12.5px] leading-[1.6]">
            {step.kind === 'dimension'
              ? 'Pick the description that matches how this workflow actually runs today, not how it should run.'
              : 'Use the figure you would defend in a planning meeting rather than the one you wish were true.'}{' '}
            What the answer does to the recommendation is shown once it is given.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            ref={advance}
            className="btn btn-primary"
            onClick={onNext}
            disabled={!answered}
            title={answered ? undefined : 'Answer this one first'}
          >
            {index + 1 === total ? 'Finish review' : 'Next value'}
          </button>
          <button className="btn btn-quiet" onClick={onBack} disabled={index === 0}>
            Back
          </button>
          {/* Forcing a guess would corrupt the one thing the whole product
              rests on. Skipping leaves the value at its preset and unreviewed,
              which is exactly what the grounding notice will go on saying. */}
          {!answered && (
            <button
              className="btn btn-quiet text-faint hover:text-[var(--ink)]"
              onClick={onSkip}
              title="Leave this at its preset and move on — it stays unreviewed"
            >
              Not sure yet
            </button>
          )}
          <span className="mono-sm text-faint ml-auto hidden sm:block">
            1–5 to answer · ⏎ next · esc leave
          </span>
        </div>
      </div>
    </section>
  )
}

function ReviewHeader({
  name,
  label,
  index,
  total,
  onExit,
}: {
  name: string
  label: string
  index: number
  total: number
  onExit: () => void
}) {
  return (
    <div>
      <div className="mono-sm text-muted flex items-baseline justify-between gap-4">
        <span className="flex min-w-0 items-baseline gap-3">
          <span className="text-signal shrink-0">{label}</span>
          <span className="text-faint truncate normal-case">{name}</span>
        </span>
        <span className="flex items-baseline gap-4">
          <span className="text-faint tabular-nums whitespace-nowrap">
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <button className="text-faint hover:text-soft transition-colors" onClick={onExit}>
            leave
          </button>
        </span>
      </div>
      {/* One cell per value, so progress is countable rather than approximate —
          eight questions is a number a reader can hold, unlike 37%. */}
      <div
        className="mt-3 flex gap-[3px]"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label="Review progress"
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={clsx(
              'h-[3px] flex-1 transition-colors duration-300',
              i < index
                ? 'bg-[var(--signal)]'
                : i === index
                  ? 'bg-[var(--ink)]'
                  : 'bg-[var(--hair-strong)]',
            )}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * The five anchors as a choice.
 *
 * A slider asks "how much, from one to five". These are five different
 * descriptions of an organisation, and the honest question is which one is
 * yours — so they are presented as five statements to read, not as positions
 * on a track. The number stays visible because the rest of the product speaks
 * in it.
 */
function AnchorChoice({
  dimensionKey,
  input,
  onAnswer,
}: {
  dimensionKey: keyof typeof DIMENSION_BY_KEY
  input: AssessmentInput
  onAnswer: (value: Score) => void
}) {
  const dimension = DIMENSION_BY_KEY[dimensionKey]
  const [group, field] = dimensionKey.split('.') as [keyof AssessmentInput, string]
  const current = (input[group] as unknown as Record<string, Score>)[field] as Score

  return (
    <fieldset className="mt-8 border-0 p-0">
      <legend className="mono-sm text-faint mb-1">Which describes it today?</legend>
      {/* Real radios rather than buttons with aria-pressed: this is a
          single-choice group, and native inputs announce "3 of 5", move on the
          arrow keys, and carry checked state without any custom ARIA to keep
          in sync. The input itself is hidden; the whole row is its label. */}
      {dimension.anchors.map((anchor, i) => {
        const value = (i + 1) as Score
        const selected = value === current
        return (
          <label
            key={anchor}
            className="af-anchor group flex cursor-pointer items-baseline gap-4 border-t border-t-[var(--hair)] px-1 py-3.5"
          >
            <input
              type="radio"
              name={dimensionKey}
              className="sr-only"
              value={value}
              checked={selected}
              onChange={() => onAnswer(value)}
            />
            <span
              className={clsx(
                'mono-sm grid h-[22px] w-[22px] shrink-0 place-items-center border tabular-nums transition-colors',
                selected
                  ? 'border-[var(--signal)] bg-[var(--signal)] text-[var(--paper)]'
                  : 'text-faint group-hover:border-[var(--ink)] group-hover:text-[var(--ink)] border-[var(--hair-strong)]',
              )}
              aria-hidden="true"
            >
              {value}
            </span>
            <span
              className={clsx(
                'min-w-0 text-[13px] leading-[1.55] transition-colors',
                selected ? 'text-[var(--ink)] font-medium' : 'text-soft',
              )}
            >
              {anchor}
            </span>
          </label>
        )
      })}
      <p className="text-faint mt-3 text-[11.5px] leading-[1.5]">{dimension.why}</p>
    </fieldset>
  )
}

/**
 * Volume and time per case are load-bearing in every assessment and are not
 * ordinals, so the pass asks for them as the numbers they are — with the annual
 * figure derived alongside, because that is the number people actually have an
 * intuition about.
 */
function EconomicsQuestion({
  field,
  input,
  onChange,
}: {
  field: string
  input: AssessmentInput
  onChange: (patch: { volume?: number; minutesPerCase?: number }) => void
}) {
  const { economics } = input
  const isVolume = field === ECONOMICS_KEYS.volume
  const value = isVolume ? economics.volume : economics.minutesPerCase
  // Derived by the engine, never recomputed here. A hand-rolled version of this
  // sum dropped `peopleInvolved` and quietly disagreed with the figure the
  // assessment sheet prints from the same inputs.
  const volume = deriveVolume(economics)

  return (
    <div className="mt-8">
      <label className="block max-w-[320px]">
        <span className="mono-sm text-muted">{isVolume ? 'Cases' : 'Minutes per case'}</span>
        <span className="mt-1 flex items-baseline gap-3">
          <input
            type="number"
            className="field field-num min-w-0 flex-1 text-[20px]"
            min={0}
            max={isVolume ? 1_000_000 : 10_000}
            step={isVolume ? 10 : 1}
            value={value}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!Number.isFinite(n) || n < 0) return
              onChange(isVolume ? { volume: n } : { minutesPerCase: n })
            }}
          />
          <span className="mono-sm text-faint shrink-0">
            {isVolume ? PERIOD_LABEL[economics.period] : 'min'}
          </span>
        </span>
      </label>

      <p className="text-muted mt-4 max-w-[54ch] text-[12.5px] leading-[1.55]">
        {economics.volume.toLocaleString('en-US')} cases {PERIOD_LABEL[economics.period]} at{' '}
        {economics.minutesPerCase} minutes
        {economics.peopleInvolved && economics.peopleInvolved > 1
          ? `, across ${economics.peopleInvolved} people,`
          : ''}{' '}
        is{' '}
        <span className="num text-soft tabular-nums">
          {Math.round(volume.manualHoursPerYear).toLocaleString('en-US')}
        </span>{' '}
        hours of hands-on time a year. Both figures set the capacity estimate and most of the
        economic score, so a rough count you can defend beats a precise one you cannot.
      </p>
    </div>
  )
}

function contextLabel(key: string): string {
  if (!isDimensionKey(key)) return `${GROUP_META.economics.index} ${GROUP_META.economics.label}`
  const meta = GROUP_META[DIMENSION_BY_KEY[key].group]
  return `${meta.index} ${meta.label}`
}

function definitionFor(key: string): string {
  if (isDimensionKey(key)) return DIMENSION_BY_KEY[key].definition
  return key === ECONOMICS_KEYS.volume
    ? 'How many cases the workflow handles in a period.'
    : 'Average hands-on human minutes spent on a single case, across everyone who touches it.'
}

/** The closing card: what the pass changed, and what it uncovered. */
export function ReviewComplete({
  summary,
  unsaved,
  onContinue,
  onSave,
  onExit,
}: {
  summary: ReviewSummary
  /** True when the pass left work that is not yet on the device. */
  unsaved: boolean
  onContinue: () => void
  onSave: () => void
  onExit: () => void
}) {
  // One primary action, chosen by what is actually outstanding: more values to
  // confirm, or a record that has not been written down yet.
  const more = summary.newlyLoadBearing.length > 0
  return (
    <section className="af-enter" aria-label="Review complete">
      <div className="mono-sm text-muted flex items-baseline justify-between gap-4">
        <span className="text-signal">Review complete</span>
        <span className="text-faint tabular-nums">
          {summary.reviewed} {summary.reviewed === 1 ? 'value' : 'values'} confirmed
        </span>
      </div>

      <h2 className="display-sm mt-6">{summary.headline}</h2>
      <p className="text-soft mt-3 max-w-[58ch] text-[13.5px] leading-[1.6]">{summary.detail}</p>

      {summary.moved && (
        <dl className="border-hair mt-7 grid grid-cols-2 gap-x-8 gap-y-4 border-t pt-5 sm:grid-cols-4">
          <Figure label="Fit before" value={String(summary.fitBefore)} />
          <Figure label="Fit now" value={String(summary.fitAfter)} emphasis />
          <Figure label="Was" value={summary.autonomyBefore} small />
          <Figure label="Now" value={summary.autonomyAfter} small emphasis />
        </dl>
      )}

      {summary.newlyLoadBearing.length > 0 && (
        <div className="border-hair mt-8 border-t pt-5">
          <div className="mono-sm text-signal mb-2">
            {summary.newlyLoadBearing.length} more{' '}
            {summary.newlyLoadBearing.length === 1 ? 'value now carries' : 'values now carry'} this
            recommendation
          </div>
          <p className="text-muted max-w-[58ch] text-[12.5px] leading-[1.55]">
            Your answers changed which values the result rests on — that is the model responding,
            not the ground moving. These were not load-bearing when the pass started:
          </p>
          <ul className="mt-3 m-0 list-none p-0">
            {summary.newlyLoadBearing.slice(0, 5).map((v) => (
              <li key={v.key} className="border-hair border-t py-2.5">
                <span className="text-soft text-[12.5px] font-medium">{v.label}</span>
                <span className="text-faint ml-2 text-[11.5px]">{v.reason}</span>
              </li>
            ))}
          </ul>
          {summary.newlyLoadBearing.length > 5 && (
            <p className="text-faint mt-2 text-[11px]">
              and {summary.newlyLoadBearing.length - 5} more.
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {more ? (
          <button className="btn btn-primary" onClick={onContinue}>
            Review {summary.newlyLoadBearing.length} more
          </button>
        ) : unsaved ? (
          <button className="btn btn-primary" onClick={onSave}>
            Save assessment
          </button>
        ) : null}
        <button className={more || unsaved ? 'btn' : 'btn btn-primary'} onClick={onExit}>
          Back to the assessment
        </button>
      </div>
    </section>
  )
}

function Figure({
  label,
  value,
  emphasis,
  small,
}: {
  label: string
  value: string
  emphasis?: boolean
  small?: boolean
}) {
  return (
    <div>
      <dt className="mono-sm text-faint">{label}</dt>
      <dd
        className={clsx(
          'm-0 mt-1.5 leading-tight',
          small ? 'text-[13.5px] font-medium' : 'num text-[26px] tabular-nums',
          emphasis && 'text-signal',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
