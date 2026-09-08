import { useMemo } from 'react'
import type { AssessmentInput, DimensionKey, Score } from '../../../domain/types'
import { DIMENSION_BY_KEY, DIMENSIONS, readDimension, writeDimension } from '../../../domain/dimensions'
import { AUTONOMY_BY_LEVEL } from '../../../engine/autonomy'
import type { AssessmentResult } from '../../../engine/assess'
import { computeSensitivity } from '../../../engine/sensitivity'
import { findFlipPoints } from '../../../engine/flip'
import { DimensionControl } from '../../components/DimensionControl'
import { EmptyState, SectionHead } from '../../components/primitives'

function Delta({
  label,
  from,
  to,
  changed,
}: {
  label: string
  from: string
  to: string
  changed: boolean
}) {
  return (
    <div className="border-hair grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-t py-3">
      <span className="mono-sm text-muted">{label}</span>
      <span className="shrink-0 text-right text-[13.5px] tabular-nums">
        <span className="text-faint">{from}</span>
        <span className="text-faint mx-2" aria-hidden="true">
          →
        </span>
        <span className={changed ? 'text-signal font-medium' : 'text-soft'}>{to}</span>
      </span>
    </div>
  )
}

function hours(n: number): string {
  return Math.abs(n) < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US')
}

export function StressPanel({
  input,
  result,
  scenario,
  scenarioResult,
  onStart,
  onEnd,
  onScenario,
  onApply,
}: {
  input: AssessmentInput
  result: AssessmentResult
  scenario: AssessmentInput | null
  scenarioResult: AssessmentResult | null
  onStart: () => void
  onEnd: () => void
  onScenario: (i: AssessmentInput) => void
  onApply: () => void
}) {
  const sensitivity = useMemo(() => computeSensitivity(input), [input])
  const flip = useMemo(() => findFlipPoints(input), [input])
  // A workflow the model has told you not to agentify is not climbing a ladder,
  // so "path to greater autonomy" answers a question nobody asked. The useful
  // inverse is what would have to become true for the answer to change.
  const noLadder = result.autonomy.level === 0
  // True when no listed improvement unlocks a level, clears a gate, or returns
  // capacity worth naming.
  const shownFlips = flip.points.slice(0, 6)
  const singleOutcome =
    shownFlips.length > 1 && new Set(shownFlips.map((p) => p.becomes)).size === 1
      ? shownFlips[0]!.becomes
      : null
  const largestMove = Math.max(0, ...sensitivity.highest.map((e) => Math.abs(e.fitUpside)))
  const allMarginal =
    sensitivity.highest.length > 0 &&
    sensitivity.highest.every(
      (e) =>
        e.unlock === null &&
        e.blocksLevel === null &&
        e.capacityUpside < 0.5 &&
        Math.abs(e.fitUpside) <= 2,
    )

  const changedKeys = useMemo(() => {
    if (!scenario) return []
    return DIMENSIONS.map((d) => d.key).filter(
      (k) => readDimension(scenario, k) !== readDimension(input, k),
    )
  }, [scenario, input])

  return (
    <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr]">
      {/* --- scenario lab -------------------------------------------- */}
      <div>
        <SectionHead
          index="11"
          label="Scenario lab"
          title="What would have to change?"
          blurb="Vary the assessment without touching the baseline. The comparison shows which of your changes actually moved the recommendation — and which only moved the score."
          action={
            scenario ? (
              <div className="flex gap-2">
                <button type="button" className="btn" onClick={onApply}>
                  Apply to assessment
                </button>
                <button type="button" className="btn btn-quiet" onClick={onEnd}>
                  Discard
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-primary" onClick={onStart}>
                Start a scenario
              </button>
            )
          }
        />

        {!scenario ? (
          <div className="mt-8">
            <EmptyState
              label="No scenario running"
              title="Test an assumption before you fund it."
              action={
                <button type="button" className="btn btn-primary" onClick={onStart}>
                  Start a scenario
                </button>
              }
            >
              A scenario clones the current assessment. Change verification, reversibility, or system
              access and see whether the autonomy recommendation actually moves.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="mt-8">
              <div className="mono-sm text-faint mb-1">Effect</div>
              {changedKeys.length === 0 ? (
                <p className="text-muted border-hair border-t pt-3 text-[12.5px] leading-[1.55]">
                  Nothing changed yet. Move a value below and this fills in with what it did to the
                  score, the recommendation, readiness and capacity.
                </p>
              ) : (
                <>
              <Delta
                label="Agent fit"
                from={String(result.fit.score)}
                to={String(scenarioResult?.fit.score ?? result.fit.score)}
                changed={scenarioResult?.fit.score !== result.fit.score}
              />
              <Delta
                label="Autonomy"
                from={result.autonomy.displayName}
                to={scenarioResult?.autonomy.displayName ?? result.autonomy.displayName}
                changed={scenarioResult?.autonomy.level !== result.autonomy.level}
              />
              <Delta
                label="Readiness"
                from={result.readiness.meta.label}
                to={scenarioResult?.readiness.meta.label ?? result.readiness.meta.label}
                changed={scenarioResult?.readiness.level !== result.readiness.level}
              />
              <Delta
                label="Capacity h / wk"
                from={hours(result.capacity.netCapacityHours)}
                to={hours(scenarioResult?.capacity.netCapacityHours ?? 0)}
                changed={
                  Math.abs(
                    (scenarioResult?.capacity.netCapacityHours ?? 0) -
                      result.capacity.netCapacityHours,
                  ) > 0.05
                }
              />
              <Delta
                label="Controls required"
                from={String(result.controls.required.length)}
                to={String(scenarioResult?.controls.required.length ?? 0)}
                changed={scenarioResult?.controls.required.length !== result.controls.required.length}
              />
                </>
              )}
            </div>

            {changedKeys.length > 0 && (
              <p className="text-muted mt-5 text-[12.5px] leading-[1.55]">
                Changed:{' '}
                {changedKeys
                  .map(
                    (k) =>
                      `${DIMENSION_BY_KEY[k].label} ${readDimension(input, k)}→${readDimension(scenario, k)}`,
                  )
                  .join(' · ')}
              </p>
            )}

            <div className="mt-9">
              <div className="mono-sm text-faint mb-1">Scenario inputs</div>
              <div className="thin-scroll max-h-[560px] overflow-y-auto pr-3">
                {DIMENSIONS.map((d) => (
                  <div key={d.key} className="border-hair border-t">
                    <DimensionControl
                      compact
                      dimension={d}
                      value={readDimension(scenario, d.key)}
                      baseline={readDimension(input, d.key)}
                      touched
                      onChange={(v: Score) => onScenario(writeDimension(scenario, d.key, v))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- path + sensitivity ---------------------------------------- */}
      <div>
        <SectionHead
          index="12"
          label={noLadder ? 'Where the answer changes' : 'Path to greater autonomy'}
          title={
            noLadder
              ? result.autonomy.zeroVariant === 'human-led'
                ? 'What would let this leave a person’s hands'
                : 'What would make this need a model'
              : result.path.structural
                ? 'There is no path by investment'
                : result.path.targetMeta
                  ? `To reach ${result.path.targetMeta.name.toLowerCase()}`
                  : 'Already at the top of the ladder'
          }
          blurb={
            noLadder
              ? 'This workflow is not climbing a ladder, so the useful question is the inverse: what would have to become true before the recommendation changed. These are boundaries rather than goals — crossing one is usually something that happens to a workflow, not something anyone does on purpose.'
              : result.path.structural
                ? 'Everything the gates still ask for is a property of the work rather than something to build. Raising autonomy here means changing the scope of the workflow, or accepting the ceiling.'
                : 'Derived from the gates that are currently unmet, so this is a consequence of the model rather than a written-down list of good practice.'
          }
        />

        {noLadder ? (
          <div className="mt-6">
            <p className="text-soft border-hair border-t pt-4 text-[13px] leading-[1.6]">
              {flip.summary}
            </p>
            {flip.points.length > 0 && (
              <>
                {/* When every boundary leads to the same answer, saying it five
                    times is noise. Say it once and let the list be the list. */}
                {singleOutcome && (
                  <p className="mono-sm text-signal mt-5">
                    Every one of these leads to: {singleOutcome}
                  </p>
                )}
                <ul className="m-0 mt-3 list-none p-0">
                  {flip.points.slice(0, 6).map((p) => (
                    <li
                      key={p.key}
                      className="border-hair grid grid-cols-[1fr_auto] items-baseline gap-x-5 border-t py-3"
                    >
                      <div className="min-w-0">
                        <span className="text-[13px] font-medium">{p.label}</span>
                        <span className="mono-sm text-faint ml-2 tabular-nums">
                          {p.from}
                          <span className="mx-1" aria-hidden="true">
                            →
                          </span>
                          {p.to}
                        </span>
                        <p className="text-muted mt-1 text-[11.5px] leading-[1.5]">
                          {p.distance === 1 ? 'One step away' : `${p.distance} steps away`}
                          {p.nature === 'constraint'
                            ? ' · a property of the work'
                            : ' · something you build'}
                        </p>
                      </div>
                      {!singleOutcome && (
                        <span className="mono-sm text-signal shrink-0 text-right">{p.becomes}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : result.path.steps.length === 0 ? (
          <p className="text-muted border-hair mt-6 border-t pt-4 text-[13px] leading-[1.6]">
            {result.path.reachable
              ? 'No gate is holding this workflow back. The recommendation reflects the overall state of structure, access and controls rather than a single hard constraint.'
              : 'This workflow already sits at the highest rung the model will recommend.'}
          </p>
        ) : (
          <ol className="m-0 mt-6 list-none p-0">
            {result.path.steps.map((step, i) => (
              <li key={step.gateId} className="border-hair border-t py-4">
                <div className="flex items-baseline gap-3">
                  <span className="mono-sm text-faint w-[26px] shrink-0 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] leading-tight font-medium">{step.title}</div>
                    <p className="text-muted mt-1.5 text-[12px] leading-[1.5]">{step.detail}</p>
                    <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                      {step.requirements.map((r) => (
                        <li
                          key={r.key}
                          className="mono-sm text-soft tabular-nums"
                          title={
                            r.nature === 'constraint'
                              ? 'A property of the work — not something to build'
                              : 'A capability you could invest in'
                          }
                        >
                          {r.label} <span className="text-faint">{r.from}</span>
                          <span className="text-faint mx-1" aria-hidden="true">
                            →
                          </span>
                          <span className={r.nature === 'constraint' ? 'text-faint' : 'text-signal'}>
                            {r.to}
                          </span>
                          {r.nature === 'constraint' && (
                            <span className="text-faint ml-1.5 normal-case">· fixed</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {!noLadder && !flip.stable && (
          <p className="text-faint border-hair mt-4 border-t pt-3 text-[11.5px] leading-[1.55]">
            <span className="text-muted">Nearest boundary:</span> {flip.summary}
          </p>
        )}

        {result.path.readinessShortfall && result.path.steps.length > 0 && (
          <p className="text-faint mt-4 text-[11.5px] leading-[1.55]">
            Clearing these gates is necessary but not sufficient — overall structure, access and
            control readiness also have to rise before the ceiling moves.
          </p>
        )}

        <div className="mt-12">
          <SectionHead
            index="13"
            label="Sensitivity"
            title="What matters most."
            blurb="Each dimension is walked step by step through the model. Only capabilities are ranked as improvements — the things an organisation can decide to build. What the work is, and what a mistake costs, are reported separately."
          />

          {sensitivity.combined && (
            <div className="border-hair-strong mt-6 border-t pt-4">
              <div className="mono-sm text-faint">
                {sensitivity.combined.reachable ? 'Cheapest way through' : 'Why investment alone will not do it'}
              </div>
              {sensitivity.combined.reachable ? (
                <p className="text-soft mt-2 max-w-[58ch] text-[12.5px] leading-[1.6]">
                  No single dimension unlocks{' '}
                  {AUTONOMY_BY_LEVEL[sensitivity.combined.level].short.toLowerCase()} on its own,
                  because more than one gate caps at the same level. Together, these{' '}
                  {sensitivity.combined.moves.length} moves do — {sensitivity.combined.steps} steps
                  in total.
                </p>
              ) : (
                <p className="text-soft mt-2 max-w-[58ch] text-[12.5px] leading-[1.6]">
                  Building every capability the gates ask for still would not raise the level. The
                  ceiling here is structural, set by what the work is rather than by what has been
                  built — which makes this a scoping question, not a roadmap item.
                </p>
              )}
              {sensitivity.combined.moves.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                  {sensitivity.combined.moves.map((m) => (
                    <li key={m.key} className="mono-sm text-soft tabular-nums">
                      {m.label} <span className="text-faint">{m.from}</span>
                      <span className="text-faint mx-1" aria-hidden="true">
                        →
                      </span>
                      <span className="text-signal">{m.to}</span>
                    </li>
                  ))}
                </ul>
              )}
              {sensitivity.combined.blockedBy.length > 0 && (
                <p className="text-faint mt-3 text-[11.5px] leading-[1.55]">
                  Also required, and not fundable:{' '}
                  {sensitivity.combined.blockedBy
                    .map((b) => `${b.label.toLowerCase()} ${b.from} → ${b.to}`)
                    .join(' · ')}
                </p>
              )}
            </div>
          )}

          <div className="mt-6">
            <div className="mono-sm text-faint mb-1">Highest leverage — capabilities you can build</div>
            {sensitivity.highest.length === 0 ? (
              <p className="text-muted border-hair border-t pt-3 text-[12.5px] leading-[1.55]">
                Every capability dimension is already at its most favourable value. What remains is
                the shape of the work.
              </p>
            ) : allMarginal ? (
              // Seven rows that each say "moves the score without changing the
              // recommendation" is a ranking of nothing. Saying so is shorter
              // and more honest than making the reader discover it.
              <p className="text-muted border-hair border-t pt-3 text-[12.5px] leading-[1.55]">
                Nothing here has real leverage: no single capability unlocks a level or returns
                meaningful capacity, and the largest move is worth{' '}
                {largestMove} point{largestMove === 1 ? '' : 's'} of fit. Whatever should happen to
                this workflow next, it is not a capability investment.
              </p>
            ) : null}
            {sensitivity.highest.length > 0 && !allMarginal &&
              sensitivity.highest.map((e) => <SensitivityRow key={e.key} entry={e} />)}
          </div>

          {sensitivity.constraints.length > 0 && (
            <div className="mt-8">
              <div className="mono-sm text-faint mb-1">Load-bearing constraints — not improvements</div>
              <p className="text-muted mb-1 max-w-[58ch] text-[11.5px] leading-[1.55]">
                These dominate the outcome and cannot be invested in. They are listed so the ceiling
                is explicable — changing them means changing the workflow, not building something.
              </p>
              {sensitivity.constraints.map((e) => (
                <SensitivityRow key={e.key} entry={e} constraint />
              ))}
            </div>
          )}

          {sensitivity.lowest.length > 0 && !allMarginal && (
            <div className="mt-8">
              <div className="mono-sm text-faint mb-1">Lower leverage</div>
              {sensitivity.lowest.map((e) => (
                <SensitivityRow key={e.key} entry={e} quiet />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SensitivityRow({
  entry,
  quiet,
  constraint,
}: {
  entry: ReturnType<typeof computeSensitivity>['entries'][number]
  quiet?: boolean
  /** Render as something to design around rather than something to do. */
  constraint?: boolean
}) {
  const meta = DIMENSION_BY_KEY[entry.key]

  const detail = constraint
    ? entry.blocksLevel !== null
      ? `Caps autonomy at ${AUTONOMY_BY_LEVEL[entry.blocksLevel].short.toLowerCase()}. Changing it means changing the workflow.`
      : 'Dominates the score, and is a property of the work rather than of what you have built.'
    : entry.unlock
      ? `${entry.unlock.steps} step${entry.unlock.steps > 1 ? 's' : ''} to ${entry.current}→${entry.unlock.to} unlocks ${AUTONOMY_BY_LEVEL[entry.unlock.level].short.toLowerCase()}`
      : entry.blocksLevel !== null
        ? `Holds autonomy at ${AUTONOMY_BY_LEVEL[entry.blocksLevel].short.toLowerCase()} — needed, but not sufficient alone`
        : entry.capacityUpside > 0.05
          ? entry.fitUpside < 0
            ? `Returns about ${entry.capacityUpside.toFixed(1)} more hours a week. Fit falls slightly because the work becomes less model-dependent.`
            : `Returns about ${entry.capacityUpside.toFixed(1)} more hours a week without changing the recommendation`
          : entry.fitUpside > 0
            ? 'Moves the score without changing the recommendation'
            : 'No effect on this assessment'

  return (
    <div className="border-hair grid grid-cols-[1fr_auto] items-baseline gap-x-5 border-t py-3">
      <div className="min-w-0">
        <div className={quiet || constraint ? 'text-muted text-[13px]' : 'text-[13px] font-medium'}>
          {meta.label}
        </div>
        <div className="text-faint mt-1 text-[11.5px] leading-[1.5]">{detail}</div>
      </div>
      <div className="shrink-0 text-right">
        {/* Lead with whichever number is the actual benefit. */}
        {entry.fitUpside <= 0 && entry.capacityUpside > 0.05 ? (
          <div className="num text-[13.5px] tabular-nums">
            +{entry.capacityUpside.toFixed(1)}
            <span className="text-faint text-[11px]"> h/wk</span>
          </div>
        ) : (
          <div className="num text-[13.5px] tabular-nums">
            {entry.fitUpside > 0 ? '+' : ''}
            {entry.fitUpside}
            <span className="text-faint text-[11px]"> fit</span>
          </div>
        )}
        {constraint ? (
          <div className="mono-sm text-faint mt-1">fixed</div>
        ) : entry.unlock ? (
          <div className="mono-sm text-signal mt-1">→ L{entry.unlock.level}</div>
        ) : entry.blocksLevel !== null ? (
          <div className="mono-sm text-signal mt-1">gate</div>
        ) : null}
      </div>
    </div>
  )
}

export type { DimensionKey }
