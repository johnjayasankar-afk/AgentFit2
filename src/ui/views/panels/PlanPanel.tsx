import type { Assessment, PilotEdit } from '../../../domain/types'
import type { AssessmentResult } from '../../../engine/assess'
import { ArchitectureFlow } from '../../components/ArchitectureFlow'
import { SectionHead } from '../../components/primitives'
import { AutoTextarea } from '../../components/AutoTextarea'

function EditableRow({
  label,
  value,
  generated,
  onChange,
  rows = 2,
}: {
  label: string
  value: string
  generated: string
  onChange: (v: string | null) => void
  rows?: number
}) {
  const edited = value !== generated
  return (
    <div className="border-hair grid gap-x-6 border-t py-3.5 sm:grid-cols-[170px_1fr]">
      <div className="mono-sm text-muted flex items-baseline justify-between gap-2 sm:block">
        <span>{label}</span>
        {edited && (
          <button
            type="button"
            className="mono-sm text-signal mt-1 block hover:underline"
            onClick={() => onChange(null)}
          >
            edited · reset
          </button>
        )}
      </div>
      <AutoTextarea
        className="field mt-1 !border-b-0 py-0 text-[12.5px] leading-[1.55] sm:mt-0"
        minRows={rows}
        value={value}
        aria-label={label}
        onChange={onChange}
      />
    </div>
  )
}

function ListBlock({ label, items, marker = '·' }: { label: string; items: string[]; marker?: string }) {
  return (
    <div>
      <div className="mono-sm text-faint">{label}</div>
      <ul className="mt-2 space-y-1.5">
        {items.map((i) => (
          <li key={i} className="text-soft flex gap-2.5 text-[12.5px] leading-[1.5]">
            <span className={marker === '·' ? 'text-faint select-none' : 'text-signal select-none'}>
              {marker}
            </span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PlanPanel({
  result,
  assessment,
  onPilotEdit,
  onExperimentEdit,
}: {
  result: AssessmentResult
  assessment: Assessment
  onPilotEdit: (key: keyof PilotEdit, value: string | null) => void
  onExperimentEdit: (patch: { title?: string | null; criteria?: string[] | null }) => void
}) {
  const { experiment, pilot, evaluation, architecture, pattern } = result
  const title = assessment.experimentEdits.title ?? experiment.title
  const criteria = assessment.experimentEdits.criteria ?? experiment.criteria

  const pilotValue = (key: keyof PilotEdit, generated: string): string =>
    assessment.pilotEdits[key] ?? generated

  return (
    <div className="space-y-16">
      {/* --- next experiment ---------------------------------------- */}
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <div>
          <SectionHead
            index="15"
            label="Recommended next experiment"
            blurb="The cheapest action that would resolve the binding uncertainty — not the first step of the eventual build."
          />
          <div className="border-hair-strong mt-6 border-t pt-5">
            <input
              className="field !border-b-0 py-0 text-[22px] leading-tight font-medium tracking-[-0.03em]"
              value={title}
              aria-label="Next experiment"
              onChange={(e) => onExperimentEdit({ title: e.target.value })}
            />
            {title !== experiment.title && (
              <button
                type="button"
                className="mono-sm text-signal mt-2 hover:underline"
                onClick={() => onExperimentEdit({ title: null })}
              >
                edited · reset
              </button>
            )}
            <p className="text-soft mt-4 max-w-[58ch] text-[13px] leading-[1.6]">
              {experiment.rationale}
            </p>
          </div>

          <div className="mt-7">
            <div className="mono-sm text-faint mb-1">Success criteria</div>
            {criteria.map((c, i) => (
              <div key={`${i}-${c}`} className="border-hair flex items-baseline gap-3 border-t py-2.5">
                <span className="mono-sm text-faint w-[24px] shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <input
                  className="field !border-b-0 py-0 text-[12.5px]"
                  value={c}
                  aria-label={`Success criterion ${i + 1}`}
                  onChange={(e) => {
                    const next = [...criteria]
                    next[i] = e.target.value
                    onExperimentEdit({ criteria: next })
                  }}
                />
                <button
                  type="button"
                  className="mono-sm text-faint hover:text-signal shrink-0"
                  aria-label={`Remove criterion ${i + 1}`}
                  onClick={() =>
                    onExperimentEdit({ criteria: criteria.filter((_, j) => j !== i) })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => onExperimentEdit({ criteria: [...criteria, ''] })}
              >
                + Add criterion
              </button>
              {assessment.experimentEdits.criteria && (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => onExperimentEdit({ criteria: null })}
                >
                  Reset to generated
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <SectionHead
            index="16"
            label="Architecture"
            title={pattern.pattern.name}
            blurb="The reference shape for the recommended pattern. Human steps are marked; the position of the boundary is the point of the drawing."
          />
          <div className="mt-6">
            <ArchitectureFlow nodes={architecture} />
          </div>
        </div>
      </div>

      {/* --- pilot design -------------------------------------------- */}
      <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <SectionHead
            index="17"
            label="Pilot design"
            title="Enough to start, not a programme plan."
            blurb="Generated from the assessment. Every field is editable and saved with the record."
          />
          <div className="mt-7">
            <EditableRow label="Objective" generated={pilot.objective} value={pilotValue('objective', pilot.objective)} onChange={(v) => onPilotEdit('objective', v)} />
            <EditableRow label="Scope" generated={pilot.scope} value={pilotValue('scope', pilot.scope)} onChange={(v) => onPilotEdit('scope', v)} />
            <EditableRow label="Users" generated={pilot.users} value={pilotValue('users', pilot.users)} onChange={(v) => onPilotEdit('users', v)} />
            <EditableRow label="Approval boundary" generated={pilot.approvalBoundary} value={pilotValue('approvalBoundary', pilot.approvalBoundary)} onChange={(v) => onPilotEdit('approvalBoundary', v)} />
            <EditableRow label="Fallback" generated={pilot.fallback} value={pilotValue('fallback', pilot.fallback)} onChange={(v) => onPilotEdit('fallback', v)} />
            <EditableRow label="Logging" generated={pilot.logging} value={pilotValue('logging', pilot.logging)} onChange={(v) => onPilotEdit('logging', v)} />
            <EditableRow label="Duration" generated={pilot.duration} value={pilotValue('duration', pilot.duration)} onChange={(v) => onPilotEdit('duration', v)} rows={1} />
          </div>

          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <ListBlock label="Allowed in the pilot" items={pilot.allowed} />
            <ListBlock label="Not allowed" items={pilot.disallowed} marker="×" />
          </div>

          <div className="mt-8">
            <ListBlock label="Exit criteria" items={pilot.exitCriteria} />
          </div>
        </div>

        <div>
          <SectionHead
            index="18"
            label="Evaluation plan"
            title="Selected, not enumerated."
            blurb="A workflow that cannot escalate does not need a false-escalation rate. These are the metrics this assessment actually implies."
          />
          <div className="mt-7">
            {evaluation.map((m) => (
              <div key={m.name} className="border-hair grid gap-x-6 border-t py-3.5 sm:grid-cols-[170px_1fr]">
                <div className="text-[13px] leading-tight font-medium">{m.name}</div>
                <div className="text-muted mt-1 text-[12px] leading-[1.55] sm:mt-0">{m.why}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
