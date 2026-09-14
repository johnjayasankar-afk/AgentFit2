import { EXAMPLE_ARCHETYPE_IDS, ARCHETYPE_BY_ID } from '../../domain/archetypes'
import { useStore } from '../store-context'

const PRINCIPLES: [string, string][] = [
  ['Autonomy is earned', 'Not granted by model capability. A more capable model does not make an irreversible action safe.'],
  ['Fit is not autonomy', 'A workflow can score in the eighties and still warrant nothing beyond human-approved execution.'],
  ['Sometimes the answer is no', 'Deterministic automation and human-led process are outcomes this model will recommend.'],
  ['Nothing leaves the device', 'Assessments live in this browser. No account, no telemetry, no network calls.'],
]

/** One restrained screen. No carousel, no tour. */
export function FirstRun() {
  const store = useStore()
  const example = store.assessments.find((a) => a.example) ?? store.assessments[0]

  return (
    <div className="shell flex min-h-screen flex-col justify-center py-16">
      <div className="mono text-muted flex items-center gap-3">
        <span className="bg-[var(--signal)] inline-block h-[5px] w-[5px]" aria-hidden="true" />
        <span>AgentFit</span>
        <span className="bg-[var(--hair-strong)] inline-block h-px w-10" aria-hidden="true" />
        <span className="text-faint">Local-first decision instrument</span>
      </div>

      <div className="mt-12 grid items-end gap-x-20 gap-y-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <h1 className="display max-w-[15ch]">When should a workflow get an agent?</h1>

        <div className="lg:pb-3">
          <p className="text-soft max-w-[46ch] text-[16px] leading-[1.6]">
            AgentFit scores economic opportunity, technical readiness, controllability, and risk
            before anyone writes an orchestration graph.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <button className="btn btn-primary h-[40px] px-6" onClick={() => store.create('custom')}>
              Start assessment
            </button>
            {example && (
              <button
                className="btn h-[40px] px-6"
                onClick={() => {
                  // Only leave the first-run screen if there is somewhere to go.
                  if (store.open(example.id)) store.dismissFirstRun()
                }}
              >
                Explore example
              </button>
            )}
            <button
              className="btn btn-quiet h-[40px]"
              onClick={() => {
                store.dismissFirstRun()
                store.setView('method')
              }}
            >
              Methodology
            </button>
          </div>
        </div>
      </div>

      <div className="border-hair-strong mt-24 grid gap-x-14 gap-y-8 border-t pt-8 sm:grid-cols-2 lg:grid-cols-4">
        {PRINCIPLES.map(([title, body], i) => (
          <div key={title}>
            <div className="mono-sm text-faint tabular-nums">{String(i + 1).padStart(2, '0')}</div>
            <div className="mt-3 text-[14px] leading-tight font-medium">{title}</div>
            <p className="text-muted mt-2 max-w-[34ch] text-[12.5px] leading-[1.55]">{body}</p>
          </div>
        ))}
      </div>

      {store.assessments.length > 0 && (
        <div className="border-hair mt-16 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t pt-6">
          <span className="mono-sm text-faint">Worked examples, showing the model’s range</span>
          {EXAMPLE_ARCHETYPE_IDS.map((id) => {
            const found = store.assessments.find((x) => x.input.definition.archetype === id)
            const label = ARCHETYPE_BY_ID[id]?.label ?? id
            return found ? (
              <button
                key={id}
                className="link-action"
                onClick={() => {
                  if (store.open(found.id)) store.dismissFirstRun()
                }}
              >
                {label}
              </button>
            ) : null
          })}
        </div>
      )}

      <p className="text-faint footer-labs mt-16 text-[11px]">
        An independent product by <a href="https://johnjayasankar.com">John Jayasankar</a>, part of{' '}
        <a href="https://labs.johnjayasankar.com">Labs</a>.
      </p>
    </div>
  )
}
