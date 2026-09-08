import type { AssessmentInput } from '../../../domain/types'
import type { AssessmentResult } from '../../../engine/assess'
import type { ConfidenceResult } from '../../../engine/confidence'
import { CONFIDENCE_MEANING } from '../../../engine/confidence'
import type { Uncertainty } from '../../../engine/uncertainty'
import type { Grounding } from '../../../engine/grounding'
import { GroundingNotice } from '../../components/GroundingNotice'
import { READINESS_DISCLAIMER } from '../../../engine/readiness'
import { AutonomyField } from '../../components/AutonomyField'
import { AutonomyLadder } from '../../components/AutonomyLadder'
import { FitBreakdown } from '../../components/FitBreakdown'
import { AnimatedNumber, Disclosure, Metric } from '../../components/primitives'
import { INVESTMENT_VERDICT_LABEL } from '../../../engine/investment'

function hours(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const v = Math.abs(n) < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US')
  return v
}

function money(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')}`
}

export function RecommendationPanel({
  input,
  result,
  confidence,
  uncertainty,
  grounding,
  onReview,
  scenario,
  scenarioResult,
}: {
  input: AssessmentInput
  result: AssessmentResult
  confidence: ConfidenceResult
  uncertainty: Uncertainty
  grounding: Grounding
  onReview?: () => void
  scenario?: AssessmentInput | null
  scenarioResult?: AssessmentResult | null
}) {
  const { fit, autonomy, pattern, controls, readiness, capacity, explanation } = result
  const scoreDelta = scenarioResult ? scenarioResult.fit.score - fit.score : 0
  const provisional = grounding.state === 'provisional'

  return (
    <div>
      {/* --- headline readout ------------------------------------- */}
      <div className="border-hair-strong border-t pt-4">
        <div className="mono text-muted flex items-baseline justify-between">
          <span>Recommendation</span>
          <span className="mono-sm text-faint">{result.modelVersion}</span>
        </div>

        {/* What this rests on, before what it says. */}
        <div className="mt-5">
          <GroundingNotice grounding={grounding} {...(onReview ? { onReview } : {})} />
        </div>

        <div className="mt-6 flex items-start justify-between gap-6">
          <div>
            <div className="mono-sm text-muted">Agent fit</div>
            <div className="readout mt-2 flex items-baseline gap-2 text-[64px]">
              <AnimatedNumber value={fit.score} />
              <span className="text-faint text-[20px]">/ 100</span>
              {scoreDelta !== 0 && (
                <span className="text-signal ml-1 text-[20px] tabular-nums">
                  {scoreDelta > 0 ? '+' : ''}
                  {scoreDelta}
                </span>
              )}
            </div>
            {uncertainty.band > 0 && (
              <div
                className="text-faint mt-2 text-[11.5px] tabular-nums"
                title={uncertainty.summary}
              >
                ± {uncertainty.band} from {uncertainty.unreviewedCount} unreviewed dimension
                {uncertainty.unreviewedCount === 1 ? '' : 's'} · {uncertainty.low}–{uncertainty.high}
              </div>
            )}
          </div>
          <div className="pt-1 text-right">
            <div className="mono-sm text-muted">Confidence</div>
            <div className="mt-2 text-[15px] leading-none font-medium capitalize">
              {confidence.level}
            </div>
            <div className="text-faint mt-1.5 text-[11px] tabular-nums">
              {confidence.reviewedCount}/{confidence.totalDimensions} reviewed
            </div>
          </div>
        </div>

        <div className="mt-7">
          <div className="mono-sm text-muted">Recommended autonomy</div>
          {/* The accent is earned. An unconfirmed result does not get it. */}
          <div
            className={
              provisional ? 'display-sm text-soft mt-2' : 'display-sm text-signal mt-2'
            }
          >
            {autonomy.displayName}
          </div>
          <p className="text-soft mt-2.5 max-w-[52ch] text-[13px] leading-[1.55]">
            {autonomy.zeroVariant ? pattern.pattern.purpose : autonomy.meta.definition}
          </p>
          {!uncertainty.recommendationStable && (
            <p className="border-hair text-muted mt-4 border-l-2 border-l-[var(--signal)] py-1 pl-3 text-[12px] leading-[1.55]">
              Not settled. {uncertainty.volatile.length} unreviewed dimension
              {uncertainty.volatile.length === 1 ? '' : 's'} could move this —{' '}
              {uncertainty.volatile.slice(0, 3).map((v) => v.label.toLowerCase()).join(', ')}.
            </p>
          )}
        </div>
      </div>

      {/* --- key figures ------------------------------------------ */}
      <div className="border-hair mt-7 grid grid-cols-2 gap-x-6 gap-y-6 border-t pt-6">
        <Metric
          label="System pattern"
          value={pattern.pattern.name}
          sub={pattern.pattern.shape}
          size="sm"
          wrap
        />
        <Metric
          label="Control posture"
          value={controls.headline}
          sub={`${controls.required.length} controls required now`}
          size="sm"
          wrap
        />
        <Metric
          label="Capacity returned"
          value={
            <>
              {hours(capacity.netCapacityHours)}
              <span className="text-faint text-[15px]"> h / wk</span>
            </>
          }
          sub={
            capacity.annual.capacityValue !== null
              ? `${Math.round(capacity.annual.netCapacityHours).toLocaleString('en-US')} h a year · ≈${money(capacity.annual.capacityValue)} at ${input.economics.loadedHourlyCost} an hour — potential capacity, not a cost saving`
              : `${Math.round(capacity.annual.netCapacityHours).toLocaleString('en-US')} hours a year — potential capacity, not a cost saving`
          }
          size="md"
        />
        <Metric
          label="Readiness"
          value={readiness.meta.label}
          sub={provisional ? `${readiness.meta.meaning} Asserted from presets — confirm the values above.` : readiness.meta.meaning}
          size="sm"
          wrap
        />
      </div>

      {/* --- the central distinction ------------------------------ */}
      <div className="mt-8">
        <div className="mono text-muted">Autonomy field</div>
        <div className="mt-4 max-w-[460px]">
          <AutonomyField
            input={input}
            level={autonomy.level}
            zeroVariant={autonomy.zeroVariant}
            scenario={scenario ?? null}
            {...(scenarioResult ? { scenarioLevel: scenarioResult.autonomy.level } : {})}
          />
        </div>
      </div>

      <div className="mt-8">
        <div className="mono text-muted mb-1">Ladder</div>
        <AutonomyLadder
          level={autonomy.level}
          activeName={autonomy.displayName}
          ceiling={autonomy.ceiling}
          {...(scenarioResult ? { scenarioLevel: scenarioResult.autonomy.level } : {})}
        />
      </div>

      {/* --- explanation ------------------------------------------ */}
      <div className="mt-9">
        <div className="mono text-muted">Why this recommendation</div>

        {explanation.strong.length > 0 && (
          <div className="mt-4">
            <div className="mono-sm text-faint">Strong signals</div>
            <ul className="mt-2 space-y-1.5">
              {explanation.strong.map((s) => (
                <li key={s} className="text-soft flex gap-2.5 text-[12.5px] leading-[1.5]">
                  <span className="text-faint select-none">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {explanation.limiting.length > 0 && (
          <div className="mt-5">
            <div className="mono-sm text-faint">Limiting factors</div>
            <ul className="mt-2 space-y-1.5">
              {explanation.limiting.map((s) => (
                <li key={s} className="text-soft flex gap-2.5 text-[12.5px] leading-[1.5]">
                  <span className="text-faint select-none">−</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-hair mt-6 border-t pt-4">
          <div className="mono-sm text-faint">Therefore</div>
          <p className="text-[13px] leading-[1.62] mt-2">{explanation.therefore}</p>
        </div>
      </div>

      {/* --- score breakdown -------------------------------------- */}
      <div className="mt-9">
        <div className="mono text-muted mb-1">Score components</div>
        <FitBreakdown fit={fit} {...(scenarioResult ? { delta: scenarioResult.fit } : {})} />
        <p className="text-faint mt-3 text-[11.5px] leading-[1.5]">
          Agent fit measures whether this workflow is a compelling candidate. It is not an autonomy
          score — a high fit workflow can and often should stay supervised.
        </p>
      </div>

      {/* --- what the build costs --------------------------------- */}
      {result.investment.verdict !== 'no-build' && (
        <div className="border-hair mt-9 border-t pt-4">
          <div className="mono text-muted">Cost to build</div>
          <div className="mt-3 text-[14px] leading-[1.5] font-medium">
            {result.investment.headline}
          </div>
          <p className="text-muted mt-2 max-w-[54ch] text-[12px] leading-[1.55]">
            {INVESTMENT_VERDICT_LABEL[result.investment.verdict]}. See Economics for the breakdown.
          </p>
        </div>
      )}

      {/* --- confidence detail ------------------------------------ */}
      {(confidence.missingContext.length > 0 || confidence.flags.length > 0) && (
        <div className="border-hair mt-8 border-t pt-4">
          <Disclosure summary={`Confidence: ${confidence.level} — what would raise it`}>
            {CONFIDENCE_MEANING[confidence.level]} {uncertainty.summary}
          </Disclosure>
          {confidence.flags.length > 0 && (
            <ul className="mt-3 space-y-2">
              {confidence.flags.map((f) => (
                <li key={f.id} className="text-muted flex gap-2.5 text-[12px] leading-[1.5]">
                  <span className="text-faint select-none">!</span>
                  <span>{f.message}</span>
                </li>
              ))}
            </ul>
          )}
          {confidence.missingContext.length > 0 && (
            <ul className="mt-3 space-y-1">
              {confidence.missingContext.map((m) => (
                <li key={m} className="text-faint flex gap-2.5 text-[11.5px] leading-[1.5]">
                  <span className="select-none">·</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-faint border-hair mt-8 border-t pt-4 text-[11px] leading-[1.55]">
        {READINESS_DISCLAIMER}
      </p>
    </div>
  )
}
