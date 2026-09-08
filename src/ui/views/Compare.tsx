import { useId, useMemo } from 'react'
import { assess, type AssessmentResult } from '../../engine/assess'
import { sequence, STAGE_LABEL } from '../../engine/portfolio'
import { analyseProgram } from '../../engine/program'
import { computeGrounding } from '../../engine/grounding'
import { DECISION_STATUS_LABEL, reviewDecision } from '../../engine/decision'
import { AUTONOMY_LADDER } from '../../engine/autonomy'
import { Bar } from '../components/primitives'
import type { Assessment } from '../../domain/types'
import { useStore } from '../store-context'
import { EmptyState, SectionHead } from '../components/primitives'

interface Row {
  a: Assessment
  r: AssessmentResult
}

const W = 420
const H = 300
const PAD = { l: 44, r: 24, t: 20, b: 42 }
const PW = W - PAD.l - PAD.r
const PH = H - PAD.t - PAD.b

const READINESS_X: Record<string, number> = {
  'not-ready': 0.1,
  discovery: 0.37,
  pilot: 0.64,
  'production-candidate': 0.9,
}

/**
 * Portfolio matrix. Economic opportunity against implementation readiness, with
 * autonomy shown by marker weight. Deliberately unadorned: the point is
 * relative position, and anything else would imply precision the model does not
 * have.
 */
function PortfolioMatrix({ rows }: { rows: Row[] }) {
  const titleId = useId()
  const px = (x: number) => PAD.l + x * PW
  const py = (y: number) => PAD.t + (1 - y) * PH

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          Portfolio matrix plotting economic opportunity against implementation readiness for{' '}
          {rows.length} workflows.
        </title>

        <rect x={PAD.l} y={PAD.t} width={PW} height={PH} fill="none" stroke="var(--hair)" />
        {[0.25, 0.5, 0.75].map((t) => (
          <g key={t} stroke="var(--hair-faint)">
            <line x1={px(t)} y1={PAD.t} x2={px(t)} y2={PAD.t + PH} />
            <line x1={PAD.l} y1={py(t)} x2={PAD.l + PW} y2={py(t)} />
          </g>
        ))}

        {rows.map(({ a, r }, i) => {
          const x = px(READINESS_X[r.readiness.level] ?? 0.5)
          const y = py(r.fit.components.find((c) => c.id === 'economic')!.ratio)
          // Marker weight encodes autonomy: hollow for advisory, filled for executing.
          const executes = r.autonomy.level >= 3
          return (
            <g key={a.id}>
              <circle
                cx={x}
                cy={y}
                r={6}
                fill={executes ? 'var(--signal)' : 'var(--paper)'}
                stroke={executes ? 'var(--signal)' : 'var(--ink)'}
                strokeWidth="1.25"
              />
              <text
                x={x}
                y={y + 2.6}
                textAnchor="middle"
                className="pm-index"
                fill={executes ? 'var(--paper)' : 'var(--ink)'}
              >
                {i + 1}
              </text>
            </g>
          )
        })}

        <text x={PAD.l} y={H - 22} className="pm-axis" fill="var(--muted)">
          IMPLEMENTATION READINESS →
        </text>
        <text x={PAD.l} y={H - 8} className="pm-tick" fill="var(--muted-soft)">
          NOT READY · DISCOVERY · PILOT · PRODUCTION CANDIDATE
        </text>
        <text
          x={-(PAD.t + PH)}
          y={12}
          transform="rotate(-90)"
          className="pm-axis"
          fill="var(--muted)"
        >
          ECONOMIC OPPORTUNITY →
        </text>

        <style>{`
          .pm-axis { font-family: var(--font-mono); font-size: 7px; letter-spacing: 0.14em; }
          .pm-tick { font-family: var(--font-mono); font-size: 6px; letter-spacing: 0.1em; }
          .pm-index { font-family: var(--font-mono); font-size: 7.5px; font-weight: 600; }
        `}</style>
      </svg>
      <figcaption className="text-faint mt-3 text-[11.5px] leading-[1.55]">
        Filled markers execute through tools (supervised or above); hollow markers advise only.
        Position is a planning aid, not a ranking.
      </figcaption>
    </figure>
  )
}

function hours(n: number): string {
  return Math.abs(n) < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US')
}

/**
 * What is actually holding this workflow back. For the two level-zero outcomes
 * the gates are not the reason, so reporting one would be misleading.
 */
function topBlocker({ r }: Row): string {
  if (r.autonomy.zeroVariant === 'conventional') {
    return 'Nothing — the work is specified well enough that a model adds nothing'
  }
  if (r.autonomy.zeroVariant === 'human-led') return 'Expert judgment is the deliverable'
  return r.autonomy.bindingGates[0]?.title ?? r.readiness.blockers[0]?.label ?? 'No gate binding'
}

export function Compare() {
  const store = useStore()

  const rows = useMemo<Row[]>(
    () =>
      store.compareIds
        .map((id) => store.assessments.find((a) => a.id === id))
        .filter((a): a is Assessment => Boolean(a))
        .map((a) => ({ a, r: assess(a.input) })),
    [store.compareIds, store.assessments],
  )

  if (rows.length < 2) {
    return (
      <div className="shell py-12">
        <SectionHead index="—" label="Compare" title="Portfolio comparison." />
        <div className="mt-8">
          <EmptyState
            label={`${rows.length} selected`}
            title="Select two to four assessments."
            action={
              <button className="btn btn-primary" onClick={() => store.setView('library')}>
                Go to assessments
              </button>
            }
          >
            Comparison is for sequencing work across a portfolio — which workflow to fund first, and
            what has to be true before the next one is fundable.
          </EmptyState>
        </div>
      </div>
    )
  }

  const ordered = sequence(rows.map((r) => ({ item: r.a, result: r.r })))
  // A portfolio recommendation assembled from unreviewed assessments is the
  // most confident-sounding output in the product and the least supported.
  const provisional = rows
    .map((r) => ({ row: r, g: computeGrounding(r.a, r.r) }))
    .filter((x) => x.g.state === 'provisional')
  const program = analyseProgram(
    rows.map((r) => ({
      id: r.a.id,
      name: r.a.input.definition.name || 'Untitled workflow',
      input: r.a.input,
    })),
  )
  const unlocking = program.candidates.filter((c) => c.unlocked.length > 0).slice(0, 5)
  const throughputOnly = program.candidates.filter((c) => c.unlocked.length === 0).slice(0, 4)

  const metrics: { label: string; get: (r: Row) => string; wide?: boolean }[] = [
    { label: 'Agent fit', get: ({ r }) => String(r.fit.score) },
    { label: 'Economic opportunity', get: ({ r }) => `${Math.round(r.fit.components.find((c) => c.id === 'economic')!.ratio * 100)} / 100` },
    { label: 'Technical readiness', get: ({ r }) => `${Math.round(r.fit.components.find((c) => c.id === 'technical')!.ratio * 100)} / 100` },
    { label: 'Risk suitability', get: ({ r }) => `${Math.round(r.fit.components.find((c) => c.id === 'riskSuitability')!.ratio * 100)} / 100` },
    { label: 'Autonomy', get: ({ r }) => r.autonomy.displayName, wide: true },
    {
      label: 'Decision',
      wide: true,
      get: ({ a, r }) => {
        const d = reviewDecision(a, r)
        if (d.status === 'undecided') return 'Not decided'
        if (d.status !== 'proceeding') return DECISION_STATUS_LABEL[d.status]
        const level = AUTONOMY_LADDER[d.effectiveLevel]!.short
        return d.divergence === 'none'
          ? `Proceeding · ${level}`
          : `Proceeding · ${level} (${d.divergence} recommendation)`
      },
    },
    { label: 'System pattern', get: ({ r }) => r.pattern.pattern.name, wide: true },
    { label: 'Readiness', get: ({ r }) => r.readiness.meta.label, wide: true },
    { label: 'Capacity h / wk', get: ({ r }) => hours(r.capacity.netCapacityHours) },
    { label: 'Annual capacity h', get: ({ r }) => Math.round(r.capacity.annual.netCapacityHours).toLocaleString('en-US') },
    {
      label: 'Build effort',
      get: ({ r }) =>
        r.investment.effortWeeks.mid > 0
          ? `${r.investment.effortWeeks.low}–${r.investment.effortWeeks.high} wk`
          : '—',
    },
    {
      label: 'Payback',
      get: ({ r }) =>
        r.investment.paybackMonths !== null
          ? `${Math.round(r.investment.paybackMonths)} mo`
          : r.investment.repaysFromCapacity
            ? '—'
            : 'never',
    },
    { label: 'Top blocker', get: topBlocker, wide: true },
    { label: 'Next experiment', get: ({ r }) => r.experiment.title, wide: true },
  ]

  return (
    <div className="shell py-12">
      <SectionHead
        index="—"
        label="Compare"
        title="Which one first?"
        blurb="A planning recommendation for sequencing, not an objective ranking. The classification reads economics, autonomy ceiling and readiness together, because each outcome is caused by a different one of them."
        action={
          <button className="btn btn-quiet" onClick={() => store.setCompareIds([])}>
            Clear selection
          </button>
        }
      />

      {/* --- classification ------------------------------------- */}
      <div
        className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2"
        style={
          {
            '--compare-cols': String(rows.length),
          } as React.CSSProperties
        }
      >
        {rows.map(({ a, r }, i) => (
          <div key={a.id} className="border-hair-strong compare-card border-t pt-4">
            <div className="mono-sm text-faint flex items-baseline gap-2 tabular-nums">
              <span>{String(i + 1).padStart(2, '0')}</span>
            </div>
            <button
              className="mt-2 block text-left text-[15px] leading-tight font-medium hover:underline"
              onClick={() => store.open(a.id)}
            >
              {a.input.definition.name || 'Untitled workflow'}
            </button>
            <div className="display-sm text-signal mt-4 text-[22px]">{r.classification.label}</div>
            <p className="text-muted mt-2 text-[12px] leading-[1.5]">{r.classification.meaning}</p>
          </div>
        ))}
      </div>

      {provisional.length > 0 && (
        <p className="text-soft border-l-2 border-l-[var(--signal)] mt-8 max-w-[76ch] py-1 pl-4 text-[12.5px] leading-[1.6]">
          <b className="text-signal font-medium">
            {provisional.length} of these {rows.length} {provisional.length === 1 ? 'is' : 'are'}{' '}
            provisional.
          </b>{' '}
          {provisional.map((x) => x.row.a.input.definition.name || 'Untitled workflow').join(', ')}{' '}
          {provisional.length === 1 ? 'has' : 'have'} none of{' '}
          {provisional.length === 1 ? 'its' : 'their'} load-bearing values reviewed, so everything
          below — the ordering, the matrix, and what to build once — is comparing a considered
          assessment against a preset.
        </p>
      )}

      {/* --- recommended order ----------------------------------- */}
      <div className="mt-16">
        <div className="mono text-muted">Recommended order</div>
        <p className="text-muted mt-2 max-w-[72ch] text-[12.5px] leading-[1.55]">
          Sequencing is a different question from classification. This orders by what can be started
          now and how fast it pays for itself — which is why a cheap deterministic automation can
          rank above a more impressive agent.
        </p>
        <ol className="m-0 mt-6 list-none p-0">
          {ordered.map((entry) => (
            <li
              key={entry.item.id}
              className="border-hair grid items-baseline gap-x-5 gap-y-1 border-t py-3.5 sm:grid-cols-[28px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.6fr)]"
            >
              <span className="mono-sm text-faint tabular-nums">
                {String(entry.position).padStart(2, '0')}
              </span>
              <button
                className="text-left text-[13.5px] leading-tight font-medium hover:underline"
                onClick={() => store.open(entry.item.id)}
              >
                {entry.item.input.definition.name || 'Untitled workflow'}
              </button>
              <span
                className={
                  entry.stage === 'now'
                    ? 'mono-sm text-signal'
                    : 'mono-sm text-faint'
                }
              >
                {STAGE_LABEL[entry.stage]}
              </span>
              <span className="text-muted text-[12px] leading-[1.5]">{entry.reason}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* --- what to build once ---------------------------------- */}
      <section className="mt-16" aria-labelledby="program-head">
        <div className="mono text-muted" id="program-head">
          What to build once
        </div>
        <p className="text-muted mt-2 max-w-[76ch] text-[12.5px] leading-[1.55]">
          A single assessment answers what would have to change for one workflow. Across a portfolio
          the more useful question is the inverse: which one capability, built once, moves the most
          workflows at the same time. Only things an organisation can actually fund appear here.
        </p>

        {unlocking[0] && (
          <p className="text-soft border-hair-strong mt-6 max-w-[76ch] border-t pt-5 text-[15px] leading-[1.55]">
            <b className="font-medium">{unlocking[0].label}</b> is the highest-leverage investment
            across these {rows.length} workflows. Raising it to {unlocking[0].to} would move{' '}
            {unlocking[0].unlocked.length} of {rows.length} to a higher autonomy level
            {unlocking[0].capacityGain >= 0.5 && (
              <>
                {' '}and return about{' '}
                {unlocking[0].capacityGain < 10
                  ? unlocking[0].capacityGain.toFixed(1)
                  : Math.round(unlocking[0].capacityGain)}{' '}
                more hours a week
              </>
            )}
            .
            {program.sharedConstraints[0] && (
              <>
                {' '}
                <span className="text-muted">
                  {program.sharedConstraints[0].label} caps{' '}
                  {program.sharedConstraints[0].affects.length} of them regardless, and is not
                  something to build.
                </span>
              </>
            )}
          </p>
        )}

        {program.candidates.length === 0 ? (
          <p className="text-muted border-hair mt-6 border-t pt-4 text-[12.5px] leading-[1.55]">
            No shared capability investment would move any of these workflows. Either they are
            already capable, or what holds them is structural.
          </p>
        ) : (
          <div className="mt-6 grid gap-x-14 gap-y-10 lg:grid-cols-[1.35fr_1fr]">
            <div>
              <div className="mono-sm text-faint border-hair-strong hidden grid-cols-[1.5fr_auto_auto_auto] gap-x-5 border-b pb-2 sm:grid">
                <span>Capability</span>
                <span className="text-right">Unlocks</span>
                <span className="text-right">Capacity / wk</span>
                <span className="text-right">Lift</span>
              </div>
              {unlocking.map((c) => (
                <div key={c.key} className="border-hair border-b py-3.5">
                  <div className="grid grid-cols-[1.5fr_auto_auto_auto] items-baseline gap-x-5">
                    <div className="min-w-0">
                      <span className="text-[13.5px] font-medium">{c.label}</span>
                      <span className="text-faint ml-2 text-[12px] tabular-nums">to {c.to}</span>
                    </div>
                    <span
                      title={`Raises the autonomy level of ${c.unlocked.length} of ${rows.length} workflows`}
                      className={
                        c.unlocked.length > 0
                          ? 'num text-signal text-right text-[14px] tabular-nums'
                          : 'num text-faint text-right text-[14px] tabular-nums'
                      }
                    >
                      {c.unlocked.length}
                      <span className="sr-only"> of {rows.length} workflows unlocked</span>
                    </span>
                    <span className="num text-soft text-right text-[13px] tabular-nums">
                      +{c.capacityGain < 10 ? c.capacityGain.toFixed(1) : Math.round(c.capacityGain)}
                      <span className="text-faint"> h</span>
                    </span>
                    <span className="num text-faint text-right text-[12px] tabular-nums">
                      {c.totalSteps} step{c.totalSteps === 1 ? '' : 's'}
                    </span>
                  </div>
                  <Bar ratio={c.unlocked.length / rows.length} className="mt-2.5" />
                  <p className="text-muted mt-1.5 text-[11.5px] leading-[1.5]">
                    Raises autonomy for {c.unlocked.map((u) => u.name).join(', ')}
                    {c.liftedOnly > 0 && `; lifts ${c.liftedOnly} more without changing their level`}
                    {c.alreadyMet > 0 && `; ${c.alreadyMet} already there`}.
                  </p>
                </div>
              ))}
              {unlocking.length === 0 && (
                <p className="text-muted border-hair border-t pt-3 text-[12.5px] leading-[1.55]">
                  No single capability raises the autonomy level of any workflow here. What follows
                  would add throughput without changing a recommendation.
                </p>
              )}

              {throughputOnly.length > 0 && (
                <div className="mt-8">
                  <div className="mono-sm text-faint mb-1">Adds throughput only</div>
                  <p className="text-muted mb-1 text-[11.5px] leading-[1.55]">
                    Worth doing, but none of these change what any workflow is allowed to do.
                  </p>
                  {throughputOnly.map((c) => (
                    <div
                      key={c.key}
                      className="border-hair grid grid-cols-[1.5fr_auto_auto] items-baseline gap-x-5 border-t py-2.5"
                    >
                      <span className="text-muted min-w-0 text-[12.5px]">
                        {c.label}
                        <span className="text-faint ml-2 tabular-nums">to {c.to}</span>
                      </span>
                      <span className="num text-soft text-right text-[12.5px] tabular-nums">
                        +{c.capacityGain < 10 ? c.capacityGain.toFixed(1) : Math.round(c.capacityGain)}
                        <span className="text-faint"> h</span>
                      </span>
                      <span className="num text-faint text-right text-[11.5px] tabular-nums">
                        {c.totalSteps} step{c.totalSteps === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-faint mt-4 text-[11px] leading-[1.55]">
                Lift is the total ordinal distance across every workflow that needs it — a rough
                proxy for how much work the capability represents, not an estimate of it.
              </p>
            </div>

            <div>
              {program.sharedConstraints.length > 0 && (
                <div>
                  <div className="mono-sm text-faint mb-1">Shared constraints</div>
                  <p className="text-muted mb-2 text-[11.5px] leading-[1.55]">
                    Holding down more than one workflow, and not fundable. These are the shape of
                    the portfolio.
                  </p>
                  {program.sharedConstraints.map((sc) => (
                    <div key={sc.key} className="border-hair border-t py-3">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[13px] font-medium">{sc.label}</span>
                        <span className="mono-sm text-faint shrink-0 tabular-nums">
                          caps {sc.affects.length}
                        </span>
                      </div>
                      <p className="text-muted mt-1 text-[11.5px] leading-[1.5]">
                        {sc.affects.map((a) => a.name).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {program.unmoved.length > 0 && (
                <div className={program.sharedConstraints.length > 0 ? 'mt-8' : ''}>
                  <div className="mono-sm text-faint mb-1">Not moved by any single investment</div>
                  {program.unmoved.map((u) => (
                    <div key={u.id} className="border-hair border-t py-3">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[13px]">{u.name}</span>
                        <span className="mono-sm text-faint shrink-0">
                          {u.structural ? 'structural' : 'sequencing'}
                        </span>
                      </div>
                      <p className="text-muted mt-1 text-[11.5px] leading-[1.5]">{u.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* --- matrix --------------------------------------------- */}
      <div className="mt-14 grid gap-14 lg:grid-cols-[1fr_1.25fr]">
        <div>
          <div className="mono text-muted mb-4">Portfolio matrix</div>
          <PortfolioMatrix rows={rows} />
          <ol className="mt-5 m-0 list-none p-0">
            {rows.map(({ a, r }, i) => (
              <li
                key={a.id}
                className="border-hair grid grid-cols-[22px_1fr_auto] items-baseline gap-x-3 border-t py-2"
              >
                <span className="mono-sm text-faint tabular-nums">{i + 1}</span>
                <span className="truncate text-[12.5px]">{a.input.definition.name || 'Untitled'}</span>
                <span className="mono-sm text-muted shrink-0">{r.autonomy.displayShort}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* --- table ------------------------------------------- */}
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Assessment comparison</caption>
            <thead>
              <tr>
                <th scope="col" className="mono-sm text-faint border-hair-strong w-[150px] border-b pb-2 text-left font-normal">
                  Measure
                </th>
                {rows.map(({ a }, i) => (
                  <th
                    key={a.id}
                    scope="col"
                    className="mono-sm text-faint border-hair-strong min-w-[130px] border-b pr-4 pb-2 text-left leading-[1.5] font-normal"
                  >
                    {String(i + 1).padStart(2, '0')} · {a.input.definition.name || 'Untitled'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.label}>
                  <th scope="row" className="border-hair text-muted border-b py-3 pr-4 align-baseline text-[12px] font-normal">
                    {m.label}
                  </th>
                  {rows.map((row) => (
                    <td
                      key={row.a.id}
                      className={
                        m.wide
                          ? 'border-hair text-soft border-b py-3 pr-4 align-baseline text-[12px] leading-[1.45]'
                          : 'border-hair num border-b py-3 pr-4 align-baseline text-[13.5px] tabular-nums'
                      }
                    >
                      {m.get(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
