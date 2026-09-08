import type { AssessmentResult } from '../../../engine/assess'
import { AUTONOMY_BY_LEVEL } from '../../../engine/autonomy'
import { SectionHead } from '../../components/primitives'

function ControlList({
  items,
}: {
  items: { control: { id: string; label: string; detail: string }; because: string }[]
}) {
  return (
    <ul className="m-0 list-none p-0">
      {items.map((r) => (
        <li key={r.control.id} className="border-hair grid gap-x-6 border-t py-3.5 sm:grid-cols-[190px_1fr]">
          <div className="text-[13px] leading-tight font-medium">{r.control.label}</div>
          <div className="mt-1.5 sm:mt-0">
            <div className="text-soft text-[12.5px] leading-[1.5]">{r.control.detail}</div>
            <div className="text-muted mt-1 text-[11.5px] leading-[1.5]">{r.because}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ControlsPanel({ result }: { result: AssessmentResult }) {
  const { controls, pattern, autonomy } = result
  const next = controls.nextLevel !== null ? AUTONOMY_BY_LEVEL[controls.nextLevel] : null

  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
      <div>
        <SectionHead
          index="06"
          label="Control posture"
          title={controls.headline}
          blurb="Controls are what make an autonomy level defensible. These are derived from this workflow's own risk, verification, and permission characteristics — not from a generic checklist."
        />
        <div className="mt-8">
          <div className="mono-sm text-faint mb-1">Required now · {autonomy.displayName}</div>
          <ControlList items={controls.required} />
        </div>

        {next && controls.beforeMoreAutonomy.length > 0 && (
          <div className="mt-10">
            <div className="mono-sm text-faint mb-1">
              {autonomy.zeroVariant
                ? 'If a model is later added to the residual cases'
                : `Additionally required before ${next.name.toLowerCase()}`}
            </div>
            <ControlList items={controls.beforeMoreAutonomy} />
          </div>
        )}
      </div>

      <div>
        <SectionHead index="07" label="System pattern" title={pattern.pattern.name} blurb={pattern.pattern.purpose} />

        <dl className="mt-8 m-0">
          {[
            ['Shape', pattern.pattern.shape],
            ['System boundary', pattern.pattern.boundary],
            ['Human role', pattern.pattern.humanRole],
            ['When not to use it', pattern.pattern.whenNotToUse],
          ].map(([k, v]) => (
            <div key={k} className="border-hair grid gap-x-6 border-t py-3.5 sm:grid-cols-[150px_1fr]">
              <dt className="mono-sm text-muted">{k}</dt>
              <dd className="text-soft m-0 mt-1.5 text-[12.5px] leading-[1.55] sm:mt-0">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <div className="mono-sm text-faint">The agent may</div>
            <ul className="mt-2 space-y-1.5">
              {pattern.pattern.allowed.map((a) => (
                <li key={a} className="text-soft flex gap-2.5 text-[12.5px] leading-[1.5]">
                  <span className="text-faint select-none">·</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mono-sm text-faint">A human must approve</div>
            {pattern.pattern.requiresApproval.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {pattern.pattern.requiresApproval.map((a) => (
                  <li key={a} className="text-soft flex gap-2.5 text-[12.5px] leading-[1.5]">
                    <span className="text-signal select-none">·</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mt-2 text-[12.5px] leading-[1.5]">
                Nothing synchronously. Anything outside the stated envelope escalates instead.
              </p>
            )}
          </div>
        </div>

        {pattern.decompositionNote && (
          <div className="border-hair mt-8 border-t pt-4">
            <div className="mono-sm text-faint">On decomposition</div>
            <p className="text-soft mt-2 max-w-[62ch] text-[12.5px] leading-[1.55]">
              {pattern.decompositionNote}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
