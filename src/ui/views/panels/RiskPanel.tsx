import type { Assessment } from '../../../domain/types'
import type { AssessmentResult } from '../../../engine/assess'
import type { Severity } from '../../../engine/risks'
import { EmptyState, SectionHead } from '../../components/primitives'
import { AutoTextarea } from '../../components/AutoTextarea'

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
}

/** Severity is shown by rule weight and a mark, not by colour. */
function SeverityMark({ severity }: { severity: Severity }) {
  const marks: Record<Severity, string> = {
    critical: '▮▮▮',
    high: '▮▮▯',
    moderate: '▮▯▯',
    low: '▯▯▯',
  }
  return (
    <span className="flex shrink-0 items-baseline gap-2">
      <span
        className={
          severity === 'critical' || severity === 'high'
            ? 'text-signal font-mono text-[9px] tracking-[0.1em]'
            : 'text-faint font-mono text-[9px] tracking-[0.1em]'
        }
        aria-hidden="true"
      >
        {marks[severity]}
      </span>
      <span className="mono-sm text-muted">{SEVERITY_LABEL[severity]}</span>
    </span>
  )
}

export function RiskPanel({
  result,
  assessment,
  onEdit,
}: {
  result: AssessmentResult
  assessment: Assessment
  onEdit: (id: string, mitigation: string | null) => void
}) {
  const risks = result.risks

  return (
    <div>
      <SectionHead
        index="14"
        label="Risk register"
        title="Generated from what you entered."
        blurb="Each entry names the input that created it, so a reader can check the reasoning rather than take the severity on trust. Mitigations are editable and stored with the assessment."
      />

      {risks.length === 0 ? (
        <div className="mt-8">
          <EmptyState label="No register entries" title="Nothing in this assessment raises a flag.">
            At the current inputs and autonomy level, no risk rule fires. Raising consequence,
            widening the blast radius, or weakening verification will populate this list.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8">
          <div className="mono-sm text-faint border-hair hidden grid-cols-[1.1fr_1.5fr_auto_1.6fr] gap-x-6 border-b pb-2 lg:grid">
            <span>Risk</span>
            <span>Why it exists here</span>
            <span>Severity</span>
            <span>Required mitigation</span>
          </div>
          {risks.map((r) => {
            const edited = assessment.riskEdits[r.id]?.mitigation
            const value = edited ?? r.mitigation
            return (
              <div
                key={r.id}
                className="border-hair grid gap-x-6 gap-y-2 border-b py-4 lg:grid-cols-[1.1fr_1.5fr_auto_1.6fr]"
              >
                <div className="text-[13.5px] leading-tight font-medium">{r.risk}</div>
                <div className="text-muted text-[12px] leading-[1.5]">{r.because}</div>
                <div className="lg:pt-0.5">
                  <SeverityMark severity={r.severity} />
                </div>
                <div>
                  <AutoTextarea
                    className="field !border-b-0 py-0 text-[12.5px] leading-[1.5]"
                    minRows={3}
                    value={value}
                    aria-label={`Mitigation for ${r.risk}`}
                    onChange={(v) => onEdit(r.id, v)}
                  />
                  {edited !== undefined && edited !== r.mitigation && (
                    <button
                      type="button"
                      className="mono-sm text-signal mt-1 hover:underline"
                      onClick={() => onEdit(r.id, null)}
                    >
                      edited · reset
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
