import { useMemo, useState } from 'react'
import { PERIOD_LABEL } from '../../domain/types'
import { assess } from '../../engine/assess'
import { computeConfidence } from '../../engine/confidence'
import { computeGrounding } from '../../engine/grounding'
import { DECISION_STATUS_LABEL, reviewDecision } from '../../engine/decision'
import { AUTONOMY_LADDER } from '../../engine/autonomy'
import { deriveVolume } from '../../engine/normalize'
import { READINESS_DISCLAIMER } from '../../engine/readiness'
import { MODEL_VERSION_LABEL } from '../../engine/version'
import { buildExport, download, slug } from '../../persistence/io'
import { ArchitectureFlow } from '../components/ArchitectureFlow'
import { useStore } from '../store-context'

function hours(n: number): string {
  return Math.abs(n) < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US')
}

/**
 * A labelled list that disappears when empty. A heading with nothing under it
 * reads as a rendering failure, and on a document meant to be shared that is
 * worse than the omission.
 */
function SignalList({
  label,
  marker,
  items,
}: {
  label: string
  marker: string
  items: string[]
}) {
  if (items.length === 0) return null
  return (
    <>
      <div className="mono-sm text-faint">{label}</div>
      <ul className="mt-2 space-y-1.5">
        {items.map((s) => (
          <li key={s} className="text-soft flex gap-2.5 text-[12.5px] leading-[1.5]">
            <span className="text-faint select-none">{marker}</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-hair print-block grid gap-x-6 border-t py-3 sm:grid-cols-[152px_1fr]">
      <div className="mono-sm text-muted">{label}</div>
      <div className="text-soft mt-1 text-[12.5px] leading-[1.6] sm:mt-0">{children}</div>
    </div>
  )
}

/** The exportable one-page summary. Designed for print first. */
export function Brief() {
  const store = useStore()
  const a = store.current
  const [copied, setCopied] = useState(false)

  const r = useMemo(() => assess(a.input), [a.input])
  const confidence = useMemo(() => computeConfidence(a), [a])
  const grounding = useMemo(() => computeGrounding(a, r), [a, r])
  const decision = useMemo(() => reviewDecision(a, r), [a, r])
  const vol = deriveVolume(a.input.economics)

  const name = a.input.definition.name || 'Untitled workflow'
  const experimentTitle = a.experimentEdits.title ?? r.experiment.title
  const criteria = a.experimentEdits.criteria ?? r.experiment.criteria

  const plainText = useMemo(() => {
    const lines = [
      `AGENTFIT DECISION BRIEF — ${name}`,
      decision.status !== 'undecided'
        ? `\nDECISION         ${DECISION_STATUS_LABEL[decision.status]}${decision.status === 'proceeding' ? ` at ${AUTONOMY_LADDER[decision.effectiveLevel]!.name.toLowerCase()}` : ''}${a.decision.owner ? ` · ${a.decision.owner}` : ''}${a.decision.decidedAt ? ` · ${new Date(a.decision.decidedAt).toISOString().slice(0, 10)}` : ''}` +
          (decision.divergence === 'above'
            ? `\n   Diverges above the recommendation. Conditions accepted: ${decision.accepted
                .map((c) =>
                  c.unmet.length > 0
                    ? `${c.title} (${c.unmet.map((u) => `${u.label} ${u.from} -> ${u.to}`).join(', ')})`
                    : c.title,
                )
                .join('; ')}`
            : decision.divergence === 'below'
              ? '\n   More conservative than the recommendation.'
              : '') +
          (a.decision.rationale ? `\n   ${a.decision.rationale}` : '')
        : '',
      grounding.state !== 'grounded'
        ? `\n!! ${grounding.state === 'provisional' ? 'PROVISIONAL' : 'PARTLY GROUNDED'} — ${grounding.reviewedCount} of ${grounding.loadBearing.length} load-bearing values reviewed.\n   ${grounding.detail}`
        : '',
      a.input.definition.description ? `\n${a.input.definition.description}` : '',
      `\nAGENT FIT        ${r.fit.score} / 100  (confidence: ${confidence.level})`,
      `AUTONOMY         ${r.autonomy.displayName}`,
      `SYSTEM PATTERN   ${r.pattern.pattern.name} — ${r.pattern.pattern.shape}`,
      `CONTROL POSTURE  ${r.controls.headline}`,
      `READINESS        ${r.readiness.meta.label}`,
      `CAPACITY         ${hours(r.capacity.netCapacityHours)} h/wk · ${Math.round(r.capacity.annual.netCapacityHours).toLocaleString('en-US')} h/yr potential capacity returned`,
      r.investment.verdict !== 'no-build'
        ? `BUILD COST       ${r.investment.effortWeeks.low}-${r.investment.effortWeeks.high} engineer-weeks · ${r.investment.paybackMonths !== null ? `payback ~${Math.round(r.investment.paybackMonths)} months` : r.investment.repaysFromCapacity ? 'payback not modelled' : 'never repaid from capacity'}`
        : '',
      `\nWHY`,
      ...r.explanation.strong.map((s) => `  + ${s}`),
      ...r.explanation.limiting.map((s) => `  - ${s}`),
      `\n${r.explanation.therefore}`,
      `\nCONTROLS REQUIRED NOW`,
      ...r.controls.required.map((c) => `  · ${c.control.label} — ${c.control.detail}`),
      r.controls.beforeMoreAutonomy.length > 0 ? `\nBEFORE INCREASING AUTONOMY` : '',
      ...r.controls.beforeMoreAutonomy.map((c) => `  · ${c.control.label}`),
      r.risks.length > 0 ? `\nTOP RISKS` : '',
      ...r.risks.slice(0, 4).map((x) => `  · [${x.severity}] ${x.risk} — ${x.mitigation}`),
      r.path.steps.length > 0 && r.path.targetMeta ? `\nBLOCKING ${r.path.targetMeta.name.toUpperCase()}` : '',
      r.path.structural
        ? '  (structural — every remaining requirement is a property of the work, not something to build)'
        : '',
      ...r.path.steps.flatMap((s) =>
        s.requirements.map(
          (q) => `  · ${q.label} ${q.from} -> ${q.to}${q.nature === 'constraint' ? '  [fixed]' : ''}`,
        ),
      ),
      `\nNEXT EXPERIMENT\n  ${experimentTitle}`,
      `  ${r.experiment.rationale}`,
      `\nSUCCESS CRITERIA`,
      ...criteria.map((c) => `  · ${c}`),
      `\n${READINESS_DISCLAIMER}`,
      `Scored under ${MODEL_VERSION_LABEL}.`,
    ]
    return lines.filter((l) => l !== '').join('\n')
  }, [a, r, confidence, grounding, decision, name, experimentTitle, criteria])

  return (
    <div className="shell py-10">
      {/* --- actions ------------------------------------------- */}
      <div className="no-print border-hair mb-10 flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div className="mono text-muted">Decision brief</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => store.setView('workspace')}>
            Back to assessment
          </button>
          <button
            className="btn"
            onClick={() => {
              void navigator.clipboard?.writeText(plainText).then(
                () => {
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2500)
                },
                () => store.notify('Clipboard unavailable in this browser.'),
              )
            }}
          >
            {copied ? 'Copied' : 'Copy summary'}
          </button>
          <button
            className="btn"
            onClick={() =>
              download(`agentfit-${slug(name)}.json`, JSON.stringify(buildExport([a]), null, 2))
            }
          >
            Export JSON
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-[86ch]">
        {/* --- masthead ---------------------------------------- */}
        <header className="print-block">
          <div className="mono text-muted flex flex-wrap items-baseline justify-between gap-3">
            <span>AgentFit · Decision brief</span>
            <span className="text-faint">
              {new Date(a.updatedAt).toLocaleDateString()} · {MODEL_VERSION_LABEL}
            </span>
          </div>
          <h1 className="display mt-6 text-[clamp(30px,4vw,46px)]">{name}</h1>
          {a.input.definition.description && (
            <p className="text-soft mt-4 max-w-[64ch] text-[14px] leading-[1.6]">
              {a.input.definition.description}
            </p>
          )}
          {grounding.state !== 'grounded' && (
            <p
              className={
                grounding.state === 'provisional'
                  ? 'text-signal border-l-2 border-l-[var(--signal)] mt-5 max-w-[70ch] py-1 pl-4 text-[12.5px] leading-[1.6]'
                  : 'text-soft border-l-2 border-l-[var(--hair-strong)] mt-5 max-w-[70ch] py-1 pl-4 text-[12.5px] leading-[1.6]'
              }
            >
              <b className="font-medium">
                {grounding.state === 'provisional' ? 'Provisional.' : 'Partly grounded.'}
              </b>{' '}
              {grounding.reviewedCount} of the {grounding.loadBearing.length} values this
              recommendation depends on have been reviewed
              {grounding.state === 'provisional'
                ? '. Every figure below comes from preset values, so treat this as a starting position rather than an answer.'
                : '. The rest are still at their presets.'}
            </p>
          )}
          <p className="text-muted mt-4 text-[12.5px] leading-[1.6]">
            {a.input.economics.volume.toLocaleString('en-US')} cases{' '}
            {PERIOD_LABEL[a.input.economics.period]} · {a.input.economics.minutesPerCase} minutes per
            case · {Math.round(vol.manualHoursPerYear).toLocaleString('en-US')} hours a year of
            manual effort today.
          </p>
        </header>

        {/* --- headline figures -------------------------------- */}
        <div className="border-hair-strong print-block mt-9 grid grid-cols-2 gap-x-8 gap-y-7 border-t pt-6 sm:grid-cols-4">
          <div>
            <div className="mono-sm text-muted">Agent fit</div>
            <div className="readout mt-2 text-[38px]">{r.fit.score}</div>
            <div className="text-faint mt-1 text-[11px]">confidence: {confidence.level}</div>
          </div>
          <div>
            <div className="mono-sm text-muted">Autonomy</div>
            <div className="readout mt-2 text-[19px] leading-[1.1]">{r.autonomy.displayName}</div>
          </div>
          <div>
            <div className="mono-sm text-muted">Readiness</div>
            <div className="readout mt-2 text-[19px] leading-[1.1]">{r.readiness.meta.label}</div>
          </div>
          <div>
            <div className="mono-sm text-muted">Capacity</div>
            <div className="readout mt-2 text-[19px] leading-[1.1]">
              {hours(r.capacity.netCapacityHours)} h/wk
            </div>
            <div className="text-faint mt-1 text-[11px]">
              {Math.round(r.capacity.annual.netCapacityHours).toLocaleString('en-US')} h a year
              {r.capacity.annual.capacityValue !== null &&
                ` · ${Math.round(r.capacity.annual.capacityValue).toLocaleString('en-US')} value`}
            </div>
          </div>
        </div>

        {/* --- decision ---------------------------------------- */}
        {decision.status !== 'undecided' && (
          <section className="print-block border-hair-strong mt-10 border-t pt-6">
            <div className="mono text-muted">Decision</div>
            <p className="display-sm mt-3 text-[22px]">{decision.headline}</p>
            <div className="text-muted mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
              {a.decision.owner && <span>Owner: {a.decision.owner}</span>}
              {a.decision.decidedAt !== null && (
                <span>Decided {new Date(a.decision.decidedAt).toLocaleDateString()}</span>
              )}
              {a.decision.revisit && <span>Revisit: {a.decision.revisit}</span>}
            </div>
            {a.decision.rationale && (
              <p className="text-soft mt-4 max-w-[70ch] text-[13px] leading-[1.6] whitespace-pre-wrap">
                {a.decision.rationale}
              </p>
            )}
            {decision.accepted.length > 0 && (
              <>
                <div className="mono-sm text-faint mt-5 mb-2">Conditions accepted</div>
                <ul className="space-y-1.5">
                  {decision.accepted.map((c) => (
                    <li key={c.gateId} className="text-soft flex gap-2.5 text-[12.5px] leading-[1.5]">
                      <span className="text-signal select-none">·</span>
                      <span>
                        <b className="font-medium">{c.title}</b>
                        {c.unmet.length > 0 && (
                          <> — {c.unmet.map((u) => `${u.label} ${u.from} → ${u.to}`).join(', ')}</>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {/* --- recommendation ---------------------------------- */}
        <section className="print-block mt-10">
          <div className="mono text-muted">Recommendation</div>
          <p className="display-sm mt-3 text-[22px]">
            {r.pattern.pattern.name} · {r.controls.headline}
          </p>
          <p className="text-soft mt-4 text-[13.5px] leading-[1.65]">{r.explanation.therefore}</p>
        </section>

        {/* --- why --------------------------------------------- */}
        <section className="print-block mt-9 grid gap-8 sm:grid-cols-2">
          <div>
            <SignalList label="Strong signals" marker="+" items={r.explanation.strong} />
          </div>
          <div>
            <SignalList label="Limiting factors" marker="−" items={r.explanation.limiting} />
          </div>
        </section>

        {/* --- economics --------------------------------------- */}
        <section className="print-block mt-10">
          <div className="mono text-muted mb-3">Economics</div>
          {r.capacity.steps.map((s) => (
            <div
              key={s.label}
              className="border-hair grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-t py-2.5"
            >
              <div>
                <div className="text-[12.5px]">{s.label}</div>
                <div className="mono-plain text-faint mt-0.5 text-[10px]">{s.expression}</div>
              </div>
              <div className="num shrink-0 text-[13px] tabular-nums">{s.value}</div>
            </div>
          ))}
          <p className="text-faint mt-3 text-[11px] leading-[1.55]">
            Potential capacity returned under the stated assumptions. Not a cost saving.
          </p>
        </section>

        {/* --- investment -------------------------------------- */}
        {r.investment.verdict !== 'no-build' && (
          <section className="print-block mt-10">
            <div className="mono text-muted mb-3">Cost to build</div>
            <div className="border-hair grid gap-x-8 gap-y-4 border-t pt-4 sm:grid-cols-3">
              <div>
                <div className="mono-sm text-muted">Effort</div>
                <div className="readout mt-2 text-[19px]">
                  {r.investment.effortWeeks.low}–{r.investment.effortWeeks.high}
                  <span className="text-faint ml-1 text-[12px]">engineer-weeks</span>
                </div>
              </div>
              <div>
                <div className="mono-sm text-muted">Payback</div>
                <div className="readout mt-2 text-[19px]">
                  {r.investment.paybackMonths !== null
                    ? `${Math.round(r.investment.paybackMonths)} months`
                    : r.investment.repaysFromCapacity
                      ? '—'
                      : 'never'}
                </div>
              </div>
              <div>
                <div className="mono-sm text-muted">Annual upkeep</div>
                <div className="readout mt-2 text-[19px]">
                  {r.investment.maintenanceWeeksPerYear}
                  <span className="text-faint ml-1 text-[12px]">engineer-weeks</span>
                </div>
              </div>
            </div>
            <p className="text-soft mt-4 max-w-[70ch] text-[12.5px] leading-[1.6]">
              {r.investment.note}
            </p>
          </section>
        )}

        {/* --- controls ---------------------------------------- */}
        <section className="print-block mt-10">
          <div className="mono text-muted mb-3">Controls required now</div>
          <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {r.controls.required.map((c) => (
              <li key={c.control.id} className="text-soft flex gap-2.5 text-[12.5px] leading-[1.5]">
                <span className="text-faint select-none">·</span>
                <span>
                  <b className="font-medium">{c.control.label}</b> — {c.control.detail}
                </span>
              </li>
            ))}
          </ul>
          {r.controls.beforeMoreAutonomy.length > 0 && (
            <>
              <div className="mono-sm text-faint mt-6 mb-2">
                {r.autonomy.zeroVariant
                  ? 'If a model is later added to the residual cases'
                  : 'Before increasing autonomy'}
              </div>
              <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                {r.controls.beforeMoreAutonomy.map((c) => (
                  <li key={c.control.id} className="text-soft flex gap-2.5 text-[12.5px] leading-[1.5]">
                    <span className="text-signal select-none">·</span>
                    <span>{c.control.label}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* --- architecture ------------------------------------ */}
        <section className="print-block mt-10">
          <div className="mono text-muted mb-3">Architecture</div>
          <ArchitectureFlow nodes={r.architecture} />
        </section>

        {/* --- risks ------------------------------------------- */}
        {r.risks.length > 0 && (
          <section className="print-block mt-10">
            <div className="mono text-muted mb-3">Top risks</div>
            {r.risks.slice(0, 5).map((x) => (
              <div key={x.id} className="border-hair grid gap-x-6 border-t py-3 sm:grid-cols-[160px_auto_1fr]">
                <div className="text-[12.5px] font-medium">{x.risk}</div>
                <div className="mono-sm text-muted">{x.severity}</div>
                <div className="text-soft mt-1 text-[12px] leading-[1.5] sm:mt-0">
                  {a.riskEdits[x.id]?.mitigation ?? x.mitigation}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* --- blockers ---------------------------------------- */}
        {r.path.steps.length > 0 && r.path.targetMeta && (
          <section className="print-block mt-10">
            <div className="mono text-muted mb-3">
              What blocks {r.path.targetMeta.name.toLowerCase()}
            </div>
            {r.path.structural && (
              <p className="text-soft mb-3 max-w-[70ch] text-[12.5px] leading-[1.6]">
                Every remaining requirement is a property of the work rather than something to
                build. Raising autonomy means changing the scope of the workflow, or accepting the
                ceiling.
              </p>
            )}
            {r.path.steps.map((s) => (
              <Field key={s.gateId} label={s.title}>
                {s.requirements
                  .map(
                    (q) =>
                      `${q.label} ${q.from} → ${q.to}${q.nature === 'constraint' ? ' (fixed)' : ''}`,
                  )
                  .join(' · ')}
              </Field>
            ))}
          </section>
        )}

        {/* --- next experiment --------------------------------- */}
        <section className="print-block mt-10">
          <div className="mono text-muted mb-3">Next experiment</div>
          <p className="display-sm text-[20px]">{experimentTitle}</p>
          <p className="text-soft mt-3 text-[13px] leading-[1.6]">{r.experiment.rationale}</p>
          <div className="mono-sm text-faint mt-5 mb-2">Success criteria</div>
          <ul className="space-y-1.5">
            {criteria.filter(Boolean).map((c, i) => (
              <li key={`${i}-${c}`} className="text-soft flex gap-3 text-[12.5px] leading-[1.5]">
                <span className="mono-sm text-faint shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        {a.notes.trim() && (
          <section className="print-block mt-10">
            <div className="mono text-muted mb-3">Notes</div>
            <p className="text-soft text-[12.5px] leading-[1.6] whitespace-pre-wrap">{a.notes}</p>
          </section>
        )}

        <footer className="border-hair-strong print-block text-faint mt-12 border-t pt-5 text-[11px] leading-[1.6]">
          <p>{READINESS_DISCLAIMER}</p>
          <p className="mt-1.5">
            Scored under {MODEL_VERSION_LABEL}. Confidence {confidence.level} —{' '}
            {confidence.reviewedCount} of {confidence.totalDimensions} dimensions reviewed. Generated
            locally; no data left this device.
          </p>
        </footer>
      </article>
    </div>
  )
}
