import type { Assessment, Decision, DecisionStatus } from '../../../domain/types'
import type { AssessmentResult } from '../../../engine/assess'
import { AUTONOMY_LADDER, type AutonomyLevel } from '../../../engine/autonomy'
import { DECISION_STATUS_LABEL, reviewDecision } from '../../../engine/decision'
import { SectionHead, Segmented } from '../../components/primitives'
import { AutoTextarea } from '../../components/AutoTextarea'

const STATUSES: DecisionStatus[] = ['undecided', 'proceeding', 'deferred', 'declined']

function fmtDate(at: number | null): string {
  return at === null ? '' : new Date(at).toISOString().slice(0, 10)
}

/**
 * The fifth layer: decide.
 *
 * AgentFit produces a recommendation and stops there. This is where a team says
 * what it actually chose — which is frequently not the same thing, and the
 * reason is exactly what a design review needs six months later. Where the
 * choice is more autonomous than the model permits, the unmet conditions are
 * listed so the divergence lands on the record as an accepted risk.
 */
export function DecisionPanel({
  assessment,
  result,
  onChange,
}: {
  assessment: Assessment
  result: AssessmentResult
  onChange: (patch: Partial<Decision>) => void
}) {
  const decision = assessment.decision
  const review = reviewDecision(assessment, result)
  const decided = decision.status !== 'undecided'

  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
      <div>
        <SectionHead
          index="19"
          label="Decision"
          title={review.headline}
          blurb="A recommendation is not a decision. This is where the team records what it chose, who is accountable, and why — so the assessment becomes a record rather than a calculation."
        />

        <div className="mt-8">
          <span className="mono-sm text-muted mb-2 block">Status</span>
          <Segmented<DecisionStatus>
            label="Decision status"
            value={decision.status}
            onChange={(status) =>
              onChange({
                status,
                // Stamp the date on the first real decision, clear it on reset.
                decidedAt: status === 'undecided' ? null : (decision.decidedAt ?? Date.now()),
              })
            }
            options={STATUSES.map((s) => ({ value: s, label: DECISION_STATUS_LABEL[s] }))}
          />
        </div>

        <p className="text-soft mt-5 max-w-[58ch] text-[13px] leading-[1.6]">{review.note}</p>

        {decided && (
          <>
            {decision.status === 'proceeding' && (
              <div className="border-hair mt-8 border-t pt-5">
                <div className="mono-sm text-muted mb-2 flex items-baseline justify-between gap-3">
                  <span>Autonomy chosen</span>
                  <span className="text-faint normal-case">
                    Recommended: {result.autonomy.displayName}
                  </span>
                </div>
                <div className="thin-scroll -mx-1 overflow-x-auto px-1">
                  <Segmented<string>
                    label="Autonomy level chosen"
                    size="sm"
                    value={String(decision.chosenLevel ?? review.recommendedLevel)}
                    onChange={(v) => onChange({ chosenLevel: Number(v) as AutonomyLevel })}
                    options={AUTONOMY_LADDER.map((r) => ({
                      value: String(r.level),
                      label: `${r.level} ${r.short}`,
                      title:
                        r.level === review.recommendedLevel
                          ? `${r.name} — recommended`
                          : r.name,
                    }))}
                  />
                </div>
              </div>
            )}

            <div className="border-hair mt-8 grid gap-x-6 gap-y-5 border-t pt-5 sm:grid-cols-2">
              <label className="block">
                <span className="mono-sm text-muted">Accountable owner</span>
                <input
                  className="field mt-1"
                  value={decision.owner}
                  maxLength={120}
                  placeholder="Who owns this decision"
                  onChange={(e) => onChange({ owner: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mono-sm text-muted">Decided on</span>
                <input
                  type="date"
                  className="field mt-1"
                  value={fmtDate(decision.decidedAt)}
                  onChange={(e) => {
                    const t = e.target.valueAsNumber
                    onChange({ decidedAt: Number.isNaN(t) ? null : t })
                  }}
                />
              </label>
            </div>

            <label className="mt-6 block">
              <span className="mono-sm text-muted">
                Reasoning
                {review.divergence !== 'none' && (
                  <span className="text-signal ml-2 normal-case">
                    — this differs from the recommendation, so say why
                  </span>
                )}
              </span>
              <AutoTextarea
                className="field mt-1.5 leading-[1.6]"
                minRows={4}
                maxLength={2000}
                value={decision.rationale}
                placeholder="What tipped it, what was traded off, and what the team is watching."
                onChange={(v) => onChange({ rationale: v })}
              />
            </label>

            <label className="mt-6 block">
              <span className="mono-sm text-muted">Revisit when</span>
              <input
                className="field mt-1"
                value={decision.revisit}
                maxLength={200}
                placeholder="After the pilot, or if volume doubles"
                onChange={(e) => onChange({ revisit: e.target.value })}
              />
            </label>

            {review.missing.length > 0 && (
              <p className="text-faint border-hair mt-6 border-t pt-4 text-[11.5px] leading-[1.55]">
                Still missing {review.missing.join(' and ')}. A decision without either is a
                preference.
              </p>
            )}
          </>
        )}
      </div>

      <div>
        {review.accepted.length > 0 ? (
          <>
            <SectionHead
              index="20"
              label="Accepted conditions"
              title="What this decision proceeds without."
              blurb="These gates are unmet at the chosen level. The model does not object — it is not an approver — but a divergence is only defensible if it is deliberate, and that means writing down what is being accepted."
            />
            <ol className="m-0 mt-7 list-none p-0">
              {review.accepted.map((c, i) => (
                <li key={c.gateId} className="border-hair border-t py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="mono-sm text-signal w-[26px] shrink-0 tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13.5px] leading-tight font-medium">{c.title}</div>
                      <p className="text-muted mt-1.5 text-[12px] leading-[1.5]">{c.detail}</p>
                      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                        {c.unmet.map((u) => (
                          <li key={u.label} className="mono-sm text-soft tabular-nums">
                            {u.label} <span className="text-faint">{u.from}</span>
                            <span className="text-faint mx-1" aria-hidden="true">
                              →
                            </span>
                            <span className="text-signal">{u.to}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <SectionHead
              index="20"
              label="Record"
              title="What this becomes."
              blurb="A saved decision travels with the assessment: it prints on the decision brief, shows in the library, and appears alongside the recommendation whenever this workflow is compared against others."
            />
            <dl className="m-0 mt-7">
              {[
                ['Recommended', result.autonomy.displayName],
                ['Decided', decided ? AUTONOMY_LADDER[review.effectiveLevel]!.name : '—'],
                ['Status', DECISION_STATUS_LABEL[review.status]],
                ['Owner', decision.owner || '—'],
                ['Revisit', decision.revisit || '—'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="border-hair grid grid-cols-[150px_1fr] items-baseline gap-x-6 border-t py-3"
                >
                  <dt className="mono-sm text-muted">{k}</dt>
                  <dd className="text-soft m-0 text-[13px]">{v}</dd>
                </div>
              ))}
            </dl>
            {!decided && (
              <p className="text-faint mt-5 text-[11.5px] leading-[1.55]">
                Nothing here is required. An assessment with no decision is still a useful
                artefact — it just does not yet say what anyone did about it.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
