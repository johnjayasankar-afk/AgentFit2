import { DIMENSIONS, GROUP_META } from '../../domain/dimensions'
import type { GroupId } from '../../domain/types'
import { FIT_COMPONENT_LABEL, FIT_WEIGHTS, ECONOMIC_CASES_RANGE, ECONOMIC_HOURS_RANGE } from '../../engine/fit'
import { AUTONOMY_LADDER, GATES } from '../../engine/autonomy'
import { READINESS_DISCLAIMER, READINESS_LEVELS } from '../../engine/readiness'
import { DEFAULT_REVIEW_RATE, DEFAULT_TIME_REDUCTION } from '../../engine/economics'
import { INVESTMENT_VERDICT_LABEL } from '../../engine/investment'
import { ARCHETYPES, archetypeInput } from '../../domain/archetypes'
import { assess } from '../../engine/assess'
import { Bar } from '../components/primitives'
import { MODEL_VERSION, MODEL_VERSION_LABEL } from '../../engine/version'
import { DIMENSION_BY_KEY } from '../../domain/dimensions'
import { SectionHead } from '../components/primitives'

const POLARITY_LABEL = {
  raises: '↑ raises',
  lowers: '↓ lowers',
  tension: '△ tension',
} as const

function Block({
  index,
  label,
  title,
  blurb,
  children,
}: {
  index: string
  label: string
  title: string
  blurb?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-hair-strong border-t pt-8 pb-14">
      <SectionHead index={index} label={label} title={title} {...(blurb ? { blurb } : {})} />
      <div className="mt-8">{children}</div>
    </section>
  )
}

/**
 * The model's own behaviour across the sixteen reference workflows. Recomputed
 * live rather than transcribed, so it cannot drift away from the engine.
 */
function Calibration() {
  const rows = ARCHETYPES.filter((a) => a.id !== 'custom').map((a) => ({
    label: a.label,
    r: assess(archetypeInput(a.id)),
  }))

  const byLevel = new Map<number, number>()
  for (const row of rows) byLevel.set(row.r.autonomy.level, (byLevel.get(row.r.autonomy.level) ?? 0) + 1)

  const byClass = new Map<string, number>()
  for (const row of rows) {
    byClass.set(row.r.classification.label, (byClass.get(row.r.classification.label) ?? 0) + 1)
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.25fr]">
      <div>
        <div className="mono-sm text-faint mb-1">Autonomy recommended</div>
        {AUTONOMY_LADDER.map((rung) => {
          const n = byLevel.get(rung.level) ?? 0
          return (
            <div key={rung.level} className="border-hair border-t py-2.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[12.5px]">
                  <span className="mono-sm text-faint mr-2 tabular-nums">{rung.level}</span>
                  {rung.short}
                </span>
                <span className="num text-faint shrink-0 text-[12px] tabular-nums">
                  {n} / {rows.length}
                </span>
              </div>
              <Bar ratio={n / rows.length} className="mt-2" />
            </div>
          )
        })}
        <p className="text-faint mt-4 text-[11.5px] leading-[1.6]">
          No reference workflow reaches full autonomy, and two are recommended no generative model
          at all. A model that never says no is not making a decision.
        </p>

        <div className="mono-sm text-faint mt-8 mb-1">Planning classification</div>
        {[...byClass.entries()].toSorted((a, b) => b[1] - a[1]).map(([label, n]) => (
          <div key={label} className="border-hair border-t py-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[12.5px]">{label}</span>
              <span className="num text-faint shrink-0 text-[12px] tabular-nums">{n}</span>
            </div>
            <Bar ratio={n / rows.length} className="mt-2" />
          </div>
        ))}
      </div>

      <div className="thin-scroll overflow-x-auto">
        <div className="mono-sm text-faint mb-1">Every reference workflow</div>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Model output across the reference archetypes</caption>
          <thead>
            <tr>
              {['Workflow', 'Fit', 'Autonomy', 'Readiness', 'Effort', 'Verdict'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="mono-sm text-faint border-hair-strong border-b pb-2 pr-4 text-left font-normal"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="border-hair border-b py-2 pr-4 text-left text-[12px] font-normal">
                  {row.label}
                </th>
                <td className="border-hair num border-b py-2 pr-4 text-[12.5px] tabular-nums">
                  {row.r.fit.score}
                </td>
                <td className="border-hair text-soft border-b py-2 pr-4 text-[12px]">
                  {row.r.autonomy.displayShort}
                </td>
                <td className="border-hair text-soft border-b py-2 pr-4 text-[12px]">
                  {row.r.readiness.meta.label}
                </td>
                <td className="border-hair num border-b py-2 pr-4 text-[12px] tabular-nums">
                  {row.r.investment.effortWeeks.mid > 0
                    ? `${row.r.investment.effortWeeks.low}–${row.r.investment.effortWeeks.high}`
                    : '—'}
                </td>
                <td className="border-hair text-soft border-b py-2 pr-4 text-[12px]">
                  {INVESTMENT_VERDICT_LABEL[row.r.investment.verdict]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Methodology() {
  const totalWeight = Object.values(FIT_WEIGHTS).reduce((a, b) => a + b, 0)

  return (
    <div className="shell py-12">
      <div className="max-w-[70ch]">
        <div className="mono text-muted">Methodology · {MODEL_VERSION_LABEL}</div>
        <h1 className="display mt-6">Four questions, kept apart.</h1>
        <p className="text-soft mt-6 text-[15px] leading-[1.65]">
          AgentFit answers four questions that are routinely collapsed into one. Whether a workflow
          is worth automating is a different question from how independently the system should act,
          which is different again from whether the environment is ready to build it, and different
          from what any of it is worth. Every number below is deterministic: the same inputs always
          produce the same output, and the model version that produced a result is stored with it.
        </p>
      </div>

      <div className="mt-16">
        <Block
          index="01"
          label="Agent fit"
          title="Whether this workflow is a compelling candidate."
          blurb="A 0–100 weighted score across six components. It measures opportunity and suitability. It is explicitly not an autonomy score — a workflow can score in the eighties and still warrant nothing beyond supervised execution."
        >
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
            <div>
              <div className="mono-sm text-faint mb-1">Component weights</div>
              {(Object.keys(FIT_WEIGHTS) as (keyof typeof FIT_WEIGHTS)[]).map((id) => (
                <div key={id} className="border-hair grid grid-cols-[1fr_auto] items-baseline gap-4 border-t py-2.5">
                  <span className="text-[13px]">{FIT_COMPONENT_LABEL[id]}</span>
                  <span className="num text-[13.5px] tabular-nums">{FIT_WEIGHTS[id]}</span>
                </div>
              ))}
              <div className="border-hair-strong grid grid-cols-[1fr_auto] items-baseline gap-4 border-t py-2.5">
                <span className="mono-sm text-muted">Total</span>
                <span className="num text-[13.5px] font-medium tabular-nums">{totalWeight}</span>
              </div>
            </div>

            <div className="text-soft space-y-4 text-[13px] leading-[1.65]">
              <p>
                <b className="font-medium">Economic normalisation.</b> Volume-like inputs span four
                orders of magnitude, so a linear scale would let one extreme value dominate. Annual
                manual hours are mapped through a bounded logarithmic ramp from{' '}
                {ECONOMIC_HOURS_RANGE[0]} to {ECONOMIC_HOURS_RANGE[1]} hours, and annual case count
                from {ECONOMIC_CASES_RANGE[0].toLocaleString('en-US')} to{' '}
                {ECONOMIC_CASES_RANGE[1].toLocaleString('en-US')}. Both saturate: a hundred thousand
                cases a week cannot buy more than the twenty points the category is worth.
              </p>
              <p>
                <b className="font-medium">Repetition counts separately from hours.</b> A thousand
                three-minute cases and ten five-hour cases consume the same time, but only the first
                is repetitive enough for a system to learn and amortise against.
              </p>
              <p>
                <b className="font-medium">Judgment is an inverted U.</b> Mechanical work scores
                below the peak because it rarely needs a model at all. Structured professional
                judgment scores highest. Where expert judgment is the deliverable, the component
                collapses — automating around it removes the thing of value.
              </p>
              <p>
                <b className="font-medium">Context breadth is a demand, not a defect.</b> It costs
                points only where system access cannot meet it, which is why breadth and access are
                read together rather than separately.
              </p>
            </div>
          </div>
        </Block>

        <Block
          index="02"
          label="Autonomy"
          title="How independently the system should act."
          blurb="Computed by a separate function from a separate set of gates. Each gate names a condition under which independent action is not yet defensible, and the level it permits until that condition is met. The recommendation is the minimum of every active cap and the readiness-derived ceiling."
        >
          <div className="mb-12">
            <div className="mono-sm text-faint mb-1">The ladder</div>
            {AUTONOMY_LADDER.map((r) => (
              <div key={r.level} className="border-hair grid gap-x-6 border-t py-3.5 sm:grid-cols-[26px_190px_1fr]">
                <span className="mono-sm text-faint tabular-nums">{r.level}</span>
                <span className="text-[13px] font-medium">{r.name}</span>
                <span className="text-muted mt-1 text-[12.5px] leading-[1.55] sm:mt-0">
                  {r.definition} <span className="text-faint">Human role: {r.humanRole.toLowerCase()}</span>
                </span>
              </div>
            ))}
          </div>

          <p className="text-soft mb-8 max-w-[70ch] text-[13px] leading-[1.65]">
            A single unmet gate is enough to hold autonomy down regardless of how strong every other
            signal is. That asymmetry is deliberate: autonomy is earned by workflow characteristics
            and controls, not granted by model capability. Reaching the top rung requires every one
            of the level-four gates to clear simultaneously, which in ordinary enterprise work
            almost never happens — and a product that rarely recommends full autonomy is more
            trustworthy than one that frequently does.
          </p>

          <div className="mono-sm text-faint mb-1">All {GATES.length} gates</div>
          <div className="border-hair-strong hidden grid-cols-[54px_1fr_1.1fr] gap-x-6 border-b pb-2 lg:grid">
            <span className="mono-sm text-faint">Caps at</span>
            <span className="mono-sm text-faint">Condition</span>
            <span className="mono-sm text-faint">Cleared by</span>
          </div>
          {GATES.map((g) => (
            <div key={g.id} className="border-hair grid gap-x-6 gap-y-1 border-b py-3 lg:grid-cols-[54px_1fr_1.1fr]">
              <span className="mono-sm text-signal tabular-nums">L{g.cap}</span>
              <div>
                <div className="text-[12.5px] leading-tight font-medium">{g.title}</div>
                <div className="text-muted mt-1 text-[11.5px] leading-[1.5]">{g.detail}</div>
              </div>
              <div className="mono-sm text-soft flex flex-wrap gap-x-4 gap-y-1">
                {g.requirements.map((r) => (
                  <span key={`${g.id}-${r.key}-${r.value}`}>
                    {DIMENSION_BY_KEY[r.key].label} {r.op} {r.value}
                  </span>
                ))}
                {g.when && <span className="text-faint">· conditional</span>}
              </div>
            </div>
          ))}
        </Block>

        <Block
          index="03"
          label="Readiness"
          title="Whether the environment is prepared."
          blurb="A separate track from autonomy. A workflow can be perfectly suited to a supervised agent and still be Not Ready because nothing is instrumented."
        >
          {Object.values(READINESS_LEVELS).map((l) => (
            <div key={l.id} className="border-hair grid gap-x-6 border-t py-3.5 sm:grid-cols-[26px_190px_1fr]">
              <span className="mono-sm text-faint tabular-nums">{l.index}</span>
              <span className="text-[13px] font-medium">{l.label}</span>
              <span className="text-muted mt-1 text-[12.5px] leading-[1.55] sm:mt-0">{l.meaning}</span>
            </div>
          ))}
          <p className="text-soft border-hair-strong mt-6 max-w-[70ch] border-t pt-5 text-[13px] leading-[1.65]">
            The highest state is called <i>production candidate</i>, not production ready.{' '}
            {READINESS_DISCLAIMER}
          </p>
        </Block>

        <Block
          index="04"
          label="Capacity"
          title="What it might be worth."
          blurb="Four lines of arithmetic, all of them shown in the assessment. Defaults are derived; every one of them is editable."
        >
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
            <div>
              <pre className="mono-plain text-soft sunk overflow-x-auto p-5 text-[11.5px] leading-[1.9]">
{`automated  = covered cases × hours per case × time reduction
review     = covered cases × review rate × review minutes
exceptions = handed-back cases × triage minutes
net        = automated − review − exceptions`}
              </pre>
              <p className="text-soft mt-5 text-[13px] leading-[1.65]">
                The result is <b className="font-medium">potential capacity returned</b>. It is not a
                cost saving. Freed hours become savings only if the organisation actually removes
                the cost, and that is a decision this tool does not model — which is why the word
                does not appear anywhere in the output.
              </p>
            </div>

            <div>
              <div className="mono-sm text-faint mb-1">Default time reduction by autonomy level</div>
              {AUTONOMY_LADDER.map((r) => (
                <div key={r.level} className="border-hair grid grid-cols-[26px_1fr_auto_auto] items-baseline gap-4 border-t py-2.5">
                  <span className="mono-sm text-faint tabular-nums">{r.level}</span>
                  <span className="text-[12.5px]">{r.short}</span>
                  <span className="num text-faint text-[12px] tabular-nums">
                    {DEFAULT_REVIEW_RATE[r.level]}% reviewed
                  </span>
                  <span className="num w-[46px] text-right text-[13px] tabular-nums">
                    {DEFAULT_TIME_REDUCTION[r.level]}%
                  </span>
                </div>
              ))}
              <p className="text-faint mt-4 text-[11.5px] leading-[1.6]">
                Starting assumptions, not measurements. A team should replace them with their own
                numbers after a pilot — which is what the pilot is for.
              </p>
            </div>
          </div>
        </Block>

        <Block
          index="05"
          label="Capability and constraint"
          title="What you can change, and what you must accept."
          blurb="Twenty dimensions describe a workflow, but they are not the same kind of thing. Some describe what you have built; others describe the work itself. Only the first kind can be improved, and a tool that confuses them gives advice nobody can take."
        >
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
            <div className="text-soft space-y-4 text-[13px] leading-[1.65]">
              <p>
                <b className="font-medium">Capabilities</b> are things an organisation can decide to
                build: reachable context, typed tools, a per-case trace, a correctness check, a
                rollback path, an escalation rota, written rules. They appear in the sensitivity
                ranking, in the path to greater autonomy, and in the portfolio view, because each
                one is a thing a team could put on a roadmap.
              </p>
              <p>
                <b className="font-medium">Constraints</b> are properties of the work and the world:
                how much judgment a decision genuinely needs, what a mistake costs, how far it
                travels, whether a regulator requires a signature. They are never offered as
                improvements. Where one sets the ceiling the product says so plainly, because the
                honest response is to change the scope of the workflow — or to accept the ceiling.
              </p>
              <p>
                This is the difference between &ldquo;invest in verification and three workflows
                move&rdquo; and &ldquo;make your payments less consequential&rdquo;. The second is
                not advice, and printing it next to the first would devalue both.
              </p>
            </div>

            <div>
              <div className="mono-sm text-faint mb-1">The split</div>
              <div className="grid grid-cols-2 gap-x-6">
                {(['capability', 'constraint'] as const).map((nature) => (
                  <div key={nature}>
                    <div className="border-hair-strong mono-sm text-muted border-b pb-2 capitalize">
                      {nature}
                    </div>
                    {DIMENSIONS.filter((d) => d.nature === nature).map((d) => (
                      <div key={d.key} className="border-hair border-b py-2 text-[12px] leading-tight">
                        {d.label}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-faint mt-4 text-[11.5px] leading-[1.6]">
                Exception rate and review cost sit on the capability side because both are reducible
                by work — fixing the upstream process, or building a review surface worth reviewing.
                Blast radius sits on the constraint side because narrowing it means re-scoping the
                workflow, which produces a different assessment rather than a better one.
              </p>
            </div>
          </div>
        </Block>

        <Block
          index="06"
          label="Cost to build"
          title="What the work costs, and whether it repays."
          blurb="A recommendation to build is not a recommendation until it names a price. Effort is estimated from the recommended pattern plus the gaps the assessment already measured — the same gaps that hold autonomy down are the ones that cost engineering weeks to close."
        >
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
            <div className="text-soft space-y-4 text-[13px] leading-[1.65]">
              <p>
                <b className="font-medium">Always a range.</b> The estimate is reported low to high,
                skewed right, because effort estimates are. A point value would imply a precision
                this model does not have and cannot get.
              </p>
              <p>
                <b className="font-medium">It prices the recommendation, not a fixed target.</b> A
                workflow with no system access is cheaper to build for, because what the model
                recommends building is far smaller. The integration debt is still itemised, so
                nobody reads the smaller number as free.
              </p>
              <p>
                <b className="font-medium">Controls are counted once.</b> Each pattern&rsquo;s
                baseline already includes the controls it normally carries; only the controls this
                workflow&rsquo;s own risk profile added cost extra.
              </p>
              <p>
                <b className="font-medium">Upkeep is subtracted before payback.</b> Roughly an
                eighth of the build per year. Where upkeep alone outruns the capacity returned, the
                answer is &ldquo;never repaid&rdquo; rather than a large number — those are
                different findings.
              </p>
              <p>
                <b className="font-medium">Only returned hours are priced.</b> Latency, consistency,
                auditability and coverage the current process cannot reach are all real reasons to
                build, and none of them appear here. Where the case rests on one of those, the
                verdict below is the wrong figure to argue from.
              </p>
            </div>

            <div>
              <div className="mono-sm text-faint mb-1">Verdict thresholds</div>
              {[
                ['strong', 'Repays within 9 months, or returns 120+ hours a year per week invested'],
                ['plausible', 'Within 18 months, or 50+ hours per week invested'],
                ['marginal', 'Within 36 months, or 20+ hours per week invested'],
                ['unfavourable', 'Beyond that, or never repaid from capacity at all'],
              ].map(([k, v]) => (
                <div key={k} className="border-hair grid gap-x-5 border-t py-2.5 sm:grid-cols-[150px_1fr]">
                  <span className="text-[13px] font-medium">
                    {INVESTMENT_VERDICT_LABEL[k as keyof typeof INVESTMENT_VERDICT_LABEL]}
                  </span>
                  <span className="text-muted text-[12px] leading-[1.5]">{v}</span>
                </div>
              ))}
              <p className="text-faint mt-4 text-[11.5px] leading-[1.6]">
                Where an engineering cost is supplied it settles the question; the currency-free
                ratio is a fallback for the majority of assessments that carry no cost figures, and
                never overrules a figure the user entered.
              </p>
            </div>
          </div>
        </Block>

        <Block
          index="07"
          label="Uncertainty"
          title="What the score does not know."
          blurb="A preset is a defensible median, not a measurement. Every dimension left untouched carries about a step of plausible error, and the score is reported with the band that implies."
        >
          <div className="text-soft max-w-[74ch] space-y-4 text-[13px] leading-[1.65]">
            <p>
              Each unreviewed dimension is moved one step in both directions and the larger fit
              swing is kept. The swings are combined in quadrature rather than summed — they are
              independent judgements, and summing them would produce a band so wide it would say
              nothing.
            </p>
            <p>
              The more useful output is the second one. A score that moves four points is noise; a{' '}
              <i>recommendation</i> that flips between supervised and bounded depending on a value
              nobody has looked at is a reason to go and look. Where that happens the product says
              so next to the recommendation, and names the dimensions responsible.
            </p>
            <p>
              This is also why the model reports how many dimensions have been reviewed rather than
              treating every assessment as equally trustworthy. An untouched preset assessment is a
              starting hypothesis, and is labelled as one.
            </p>
          </div>
        </Block>

        <Block
          index="08"
          label="Grounding"
          title="What the result rests on."
          blurb="A separate question from confidence. Confidence asks how complete and internally consistent an assessment is; grounding asks whether a person has looked at the specific values this particular recommendation depends on."
        >
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
            <div className="text-soft space-y-4 text-[13px] leading-[1.65]">
              <p>
                Every dimension ships with a defensible preset, so a blank assessment produces a
                complete result. That is deliberate — the instrument should respond from the first
                moment. But presenting an unreviewed result in the same voice as a reviewed one
                would be a claim it cannot support. <i>Pilot ready: instrumentation and an exception
                path exist</i> is a statement about an organisation, and at zero reviewed values it
                is a statement about nothing.
              </p>
              <p>
                So the model identifies the values this recommendation actually depends on and
                reports how many have been confirmed. It is a provenance measure, not a confidence
                one: a preset can be right and still be unconfirmed.
              </p>
              <p>
                Until it is grounded, the recommendation is rendered without the accent colour, the
                readiness claim is qualified, and the decision brief, the assessment library and
                the portfolio comparison all say so. The one thing the product will not do is
                present a preset in the voice of a finding.
              </p>
            </div>

            <div>
              <div className="mono-sm text-faint mb-1">What counts as load-bearing</div>
              {[
                ['Economics', 'Volume and time per case, which set the capacity estimate and most of the economic score.'],
                ['Binding gates', 'Every dimension named by a gate currently holding the autonomy level down.'],
                ['The next rung', 'Dimensions named by a gate that would bind one level up.'],
                ['Readiness inputs', 'The five values the readiness state reads.'],
                ['Volatile values', 'Anything whose plausible range spans more than one recommendation.'],
              ].map(([k, v]) => (
                <div key={k} className="border-hair grid gap-x-5 border-t py-2.5 sm:grid-cols-[130px_1fr]">
                  <span className="text-[13px] font-medium">{k}</span>
                  <span className="text-muted text-[12px] leading-[1.5]">{v}</span>
                </div>
              ))}
              <p className="text-faint mt-4 text-[11.5px] leading-[1.6]">
                The set runs to roughly eight to sixteen values depending on the workflow, so
                &ldquo;grounded&rdquo; cannot be claimed by touching two sliders. It is a model of
                what matters rather than a proof: a value outside the set can still change the
                answer once others move, because the dependency set itself shifts.
              </p>
            </div>
          </div>
        </Block>

        <Block
          index="09"
          label="Calibration"
          title="How the model behaves across the reference set."
          blurb="Published so the distribution can be checked rather than taken on trust. A model that recommended agents for everything, or autonomy for everything, would be visible here immediately."
        >
          <Calibration />
        </Block>

        <Block
          index="10"
          label="Dimensions"
          title="Every input, with its anchors."
          blurb="Twenty ordinal dimensions, each with published anchors at all five positions. Directionality is stated against autonomy readiness."
        >
          {(Object.keys(GROUP_META) as GroupId[]).map((g) => (
            <div key={g} className="mb-10">
              <div className="mono text-muted mb-3 flex items-baseline gap-3">
                <span className="text-faint">{GROUP_META[g].index}</span>
                <span>{GROUP_META[g].label}</span>
              </div>
              {DIMENSIONS.filter((d) => d.group === g).map((d) => (
                <div key={d.key} className="border-hair border-t py-3.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[13px] font-medium">{d.label}</span>
                    <span className="mono-sm text-faint shrink-0">{POLARITY_LABEL[d.polarity]}</span>
                  </div>
                  <p className="text-muted mt-1 text-[12px] leading-[1.5]">{d.definition}</p>
                  <ol className="mt-2.5 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-5">
                    {d.anchors.map((anchor, i) => (
                      <li key={anchor} className="flex gap-2 text-[11.5px] leading-[1.45]">
                        <span className="mono-sm text-faint shrink-0 tabular-nums">{i + 1}</span>
                        <span className="text-soft">{anchor}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          ))}
        </Block>

        <section className="border-hair-strong border-t pt-8">
          <div className="mono text-muted">Where the data lives</div>
          <p className="text-soft mt-4 max-w-[70ch] text-[13px] leading-[1.65]">
            Assessments are stored in this browser, on this device. There is no account, no server
            to hold them, and no request carrying their contents anywhere — which is deliberate,
            because an assessment is a candid statement about how an organisation actually works.
            The cost of that choice is that clearing site data deletes them; export anything you
            need to keep.
          </p>
          <p className="text-soft mt-4 max-w-[70ch] text-[13px] leading-[1.65]">
            A share link carries the assessment itself, compressed into the part of the URL after
            the <code className="mono-plain">#</code>. Browsers never transmit that fragment to a
            server, so sharing needs no infrastructure and no third party ever sees the contents.
            The other side of the same property is the limit worth stating plainly:{' '}
            <b className="font-medium">the link is the data</b>. Anyone holding it can read the
            assessment, it cannot be revoked, and every place it is pasted keeps a copy.
          </p>
        </section>

        <section className="border-hair-strong mt-12 border-t pt-8">
          <div className="mono text-muted">Model version</div>
          <p className="text-soft mt-4 max-w-[70ch] text-[13px] leading-[1.65]">
            Every assessment stores the version of the scoring methodology that produced it —
            currently <code className="mono-plain">{MODEL_VERSION}</code>. Derived results are never
            persisted as the source of truth; they are recomputed from the stored inputs on every
            load. If the weights or gates change, historical records stay interpretable because the
            version they were scored under travels with them.
          </p>
        </section>
      </div>
    </div>
  )
}
