import type { AssessmentInput, CapacityAssumptions } from '../../../domain/types'
import type { AssessmentResult } from '../../../engine/assess'
import { derivedCoverage, derivedExceptionMinutes, DEFAULT_REVIEW_RATE, DEFAULT_TIME_REDUCTION } from '../../../engine/economics'
import { INVESTMENT_VERDICT_LABEL } from '../../../engine/investment'
import { Bar, SectionHead } from '../../components/primitives'

interface AssumptionSpec {
  key: keyof CapacityAssumptions
  label: string
  unit: string
  min: number
  max: number
  step: number
  note: string
}

const SPECS: AssumptionSpec[] = [
  { key: 'coveragePct', label: 'Coverage', unit: '% of cases', min: 0, max: 100, step: 1, note: 'Share the system completes without handing back.' },
  { key: 'timeReductionPct', label: 'Time reduction', unit: '% of hands-on time', min: 0, max: 100, step: 1, note: 'Execution time removed on covered cases.' },
  { key: 'reviewRatePct', label: 'Review rate', unit: '% of covered cases', min: 0, max: 100, step: 1, note: 'Share carrying an explicit oversight touch.' },
  { key: 'reviewMinutes', label: 'Review time', unit: 'min per reviewed case', min: 0, max: 600, step: 1, note: 'Oversight effort that did not exist before.' },
  { key: 'exceptionMinutes', label: 'Hand-back triage', unit: 'min per case', min: 0, max: 600, step: 1, note: 'Cost of picking up a case the system returned.' },
]

const fmtWeeks = (n: number): string => (n < 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n)))
const fmtMoney = (n: number): string => Math.round(n).toLocaleString('en-US')

/**
 * What the build costs, and whether the capacity repays it. Sits directly under
 * the capacity arithmetic because the two figures are only meaningful together.
 */
function InvestmentSection({ result }: { result: AssessmentResult }) {
  const inv = result.investment
  const total = inv.drivers.reduce((sum, d) => sum + d.weeks, 0) || 1

  return (
    <div className="border-hair-strong mt-16 border-t pt-8">
      <SectionHead
        index="10"
        label="Cost to build"
        title={inv.verdict === 'no-build' ? 'Nothing to fund.' : 'What it takes, and whether it repays.'}
        blurb="Effort is estimated from the recommended pattern and the gaps this assessment already measured — the same gaps that hold autonomy down are the ones that cost engineering weeks to close."
      />

      {inv.verdict === 'no-build' ? (
        <p className="text-soft border-hair mt-6 max-w-[70ch] border-t pt-5 text-[13px] leading-[1.65]">
          {inv.note}
        </p>
      ) : (
        <div className="mt-8 grid gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="mono-sm text-faint mb-1">Effort drivers</div>
            {inv.drivers.map((d) => (
              <div key={d.label} className="border-hair border-t py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[13px]">{d.label}</span>
                  <span className="num text-soft shrink-0 text-[13px] tabular-nums">
                    {fmtWeeks(d.weeks)} <span className="text-faint">wk</span>
                  </span>
                </div>
                <Bar ratio={d.weeks / total} className="mt-2" />
                <p className="text-muted mt-1.5 text-[11.5px] leading-[1.5]">{d.because}</p>
              </div>
            ))}
            <div className="border-hair-strong flex items-baseline justify-between gap-4 border-t pt-4">
              <span className="text-[14px] font-medium">Estimated effort</span>
              <span className="readout text-signal shrink-0 text-[22px]">
                {fmtWeeks(inv.effortWeeks.low)}–{fmtWeeks(inv.effortWeeks.high)}
                <span className="text-faint ml-1.5 text-[12px]">engineer-weeks</span>
              </span>
            </div>
            <p className="text-faint mt-2 text-[11px] leading-[1.5]">
              Central estimate {fmtWeeks(inv.effortWeeks.mid)} weeks. The range is skewed right
              because effort estimates are — a point value here would be a fiction.
            </p>
          </div>

          <div>
            <div className="mono-sm text-faint mb-1">Return</div>
            <div className="border-hair grid grid-cols-2 gap-x-6 gap-y-6 border-t pt-4">
              <div>
                <div className="mono-sm text-muted">Payback</div>
                <div className="readout mt-2 text-[26px]">
                  {inv.paybackMonths !== null ? (
                    <>
                      {Math.round(inv.paybackMonths)}
                      <span className="text-faint ml-1 text-[13px]">months</span>
                    </>
                  ) : inv.repaysFromCapacity ? (
                    <span className="text-faint text-[13px]">needs both cost figures</span>
                  ) : (
                    <span className="text-signal text-[15px]">never</span>
                  )}
                </div>
              </div>
              <div>
                <div className="mono-sm text-muted">Per week invested</div>
                <div className="readout mt-2 text-[26px]">
                  {inv.returnRatio !== null ? (
                    <>
                      {Math.round(inv.returnRatio)}
                      <span className="text-faint ml-1 text-[13px]">h / yr</span>
                    </>
                  ) : (
                    <span className="text-faint text-[13px]">—</span>
                  )}
                </div>
              </div>
              <div>
                <div className="mono-sm text-muted">Build cost</div>
                <div className="readout mt-2 text-[20px]">
                  {inv.buildCost !== null ? (
                    fmtMoney(inv.buildCost)
                  ) : (
                    <span className="text-faint text-[13px]">no engineering cost set</span>
                  )}
                </div>
              </div>
              <div>
                <div className="mono-sm text-muted">Annual upkeep</div>
                <div className="readout mt-2 text-[20px]">
                  {fmtWeeks(inv.maintenanceWeeksPerYear)}
                  <span className="text-faint ml-1 text-[13px]">wk / yr</span>
                </div>
              </div>
            </div>

            <div className="border-hair-strong mt-7 border-t pt-4">
              <div className="mono-sm text-faint">Verdict</div>
              <div className="display-sm text-signal mt-2 text-[20px]">
                {INVESTMENT_VERDICT_LABEL[inv.verdict]}
              </div>
              <p className="text-soft mt-3 max-w-[56ch] text-[12.5px] leading-[1.6]">{inv.note}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function CapacityPanel({
  input,
  result,
  onAssumptions,
}: {
  input: AssessmentInput
  result: AssessmentResult
  onAssumptions: (a: CapacityAssumptions) => void
}) {
  const { capacity, autonomy } = result
  const a = capacity.assumptions

  const derivedFor = (key: keyof CapacityAssumptions): number => {
    switch (key) {
      case 'coveragePct':
        return autonomy.zeroVariant === 'human-led' ? 0 : derivedCoverage(input)
      case 'timeReductionPct':
        return autonomy.zeroVariant === 'human-led' ? 0 : DEFAULT_TIME_REDUCTION[autonomy.level]
      case 'reviewRatePct':
        return DEFAULT_REVIEW_RATE[autonomy.level]
      case 'reviewMinutes':
        return a.reviewMinutes
      case 'exceptionMinutes':
        return derivedExceptionMinutes(input)
    }
  }

  const set = (key: keyof CapacityAssumptions, value: number | null) =>
    onAssumptions({ ...input.assumptions, [key]: value })

  const anyOverridden = Object.values(a.overridden).some(Boolean)

  return (
    <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr]">
      <div>
        <SectionHead
          index="08"
          label="Capacity model"
          title="Show the arithmetic."
          blurb="Four lines, all of them visible. This is potential capacity returned — freed hours become a cost saving only if the organisation removes the cost, which is a decision this tool does not model."
        />

        <div className="mt-8">
          {capacity.steps.map((s, i) => {
            const last = i === capacity.steps.length - 1
            return (
              <div
                key={s.label}
                className={
                  last
                    ? 'border-hair-strong grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-t pt-4'
                    : 'border-hair grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-t py-3'
                }
              >
                <div className="min-w-0">
                  <div className={last ? 'text-[14px] font-medium' : 'text-[13px]'}>{s.label}</div>
                  <div className="mono-plain text-faint mt-1 text-[10.5px] break-words">
                    {s.expression}
                  </div>
                </div>
                <div
                  className={
                    last
                      ? 'readout text-signal shrink-0 text-[26px]'
                      : 'num text-soft shrink-0 text-[14px] tabular-nums'
                  }
                >
                  {s.value}
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-hair mt-6 grid grid-cols-2 gap-6 border-t pt-5">
          <div>
            <div className="mono-sm text-muted">Annual capacity</div>
            <div className="readout mt-2 text-[22px]">
              {Math.round(capacity.annual.netCapacityHours).toLocaleString('en-US')}
              <span className="text-faint text-[13px]"> h</span>
            </div>
          </div>
          <div>
            <div className="mono-sm text-muted">Potential annual value</div>
            <div className="readout mt-2 text-[22px]">
              {capacity.annual.capacityValue === null ? (
                <span className="text-faint text-[14px]">no hourly cost supplied</span>
              ) : (
                Math.round(capacity.annual.capacityValue).toLocaleString('en-US')
              )}
            </div>
            {capacity.annual.capacityValue !== null && (
              <div className="text-faint mt-1.5 text-[11px]">
                {Math.round(capacity.annual.netCapacityHours).toLocaleString('en-US')} h ×{' '}
                {input.economics.loadedHourlyCost} per hour, in your own currency
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <SectionHead
          index="09"
          label="Assumptions"
          title="Everything you can argue with."
          blurb="Defaults are derived from the assessment and the recommended autonomy level. Override any of them; the model recalculates and marks what you changed."
          action={
            anyOverridden ? (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() =>
                  onAssumptions({
                    coveragePct: null,
                    timeReductionPct: null,
                    reviewRatePct: null,
                    reviewMinutes: null,
                    exceptionMinutes: null,
                  })
                }
              >
                Reset to derived
              </button>
            ) : undefined
          }
        />

        <div className="mt-8">
          {SPECS.map((spec) => {
            const value = a[spec.key] as number
            const overridden = a.overridden[spec.key]
            const derived = derivedFor(spec.key)
            return (
              <div key={spec.key} className="border-hair border-t py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <label className="text-[13px] font-medium" htmlFor={`asm-${spec.key}`}>
                    {spec.label}
                  </label>
                  <div className="flex shrink-0 items-baseline gap-3">
                    {overridden && (
                      <button
                        type="button"
                        className="mono-sm text-signal hover:underline"
                        onClick={() => set(spec.key, null)}
                        title={`Derived value: ${derived}`}
                      >
                        overridden · reset
                      </button>
                    )}
                    <input
                      id={`asm-${spec.key}`}
                      type="number"
                      className="field field-num w-[74px]"
                      min={spec.min}
                      max={spec.max}
                      step={spec.step}
                      value={value}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (Number.isNaN(n)) return
                        set(spec.key, Math.min(spec.max, Math.max(spec.min, n)))
                      }}
                    />
                  </div>
                </div>
                <div className="text-muted mt-1.5 flex items-baseline justify-between gap-4 text-[11.5px] leading-[1.5]">
                  <span>{spec.note}</span>
                  <span className="mono-sm text-faint shrink-0">{spec.unit}</span>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-faint border-hair mt-6 border-t pt-4 text-[11.5px] leading-[1.55]">
          Time-reduction defaults move with the autonomy level — assist returns less than bounded
          execution, because the person is still doing most of the work. They are starting
          assumptions, not measurements.
        </p>
      </div>
    </div>
  )
}

export function EconomicsPanel({
  input,
  result,
  onAssumptions,
}: {
  input: AssessmentInput
  result: AssessmentResult
  onAssumptions: (a: CapacityAssumptions) => void
}) {
  return (
    <>
      <CapacityPanel input={input} result={result} onAssumptions={onAssumptions} />
      <InvestmentSection result={result} />
    </>
  )
}
