import { useId } from 'react'
import type { AssessmentInput, DimensionKey, GroupId, Period, Score } from '../../../domain/types'
import { PERIOD_LABEL } from '../../../domain/types'
import { DIMENSIONS_BY_GROUP, GROUP_META, readDimension, writeDimension } from '../../../domain/dimensions'
import { ARCHETYPES, ARCHETYPE_BY_ID, archetypeInput } from '../../../domain/archetypes'
import { deriveVolume } from '../../../engine/normalize'
import { ECONOMICS_KEYS } from '../../../engine/grounding'
import { DimensionControl } from '../../components/DimensionControl'
import { Segmented } from '../../components/primitives'
import { AutoTextarea } from '../../components/AutoTextarea'

function NumField({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
  suffix,
  optional,
  placeholder,
  fieldId,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  optional?: boolean
  placeholder?: string
  /** Stable id so the grounding notice can scroll to and focus this field. */
  fieldId?: string
}) {
  const id = useId()
  return (
    <div {...(fieldId ? { id: fieldId } : {})} className="af-revealable">
      <label htmlFor={id} className="mono-sm text-muted flex items-baseline justify-between gap-2">
        <span>{label}</span>
        {optional && <span className="text-faint normal-case">optional</span>}
      </label>
      <div className="mt-1 flex items-baseline gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="field field-num"
          min={min}
          max={max}
          step={step}
          value={value === null ? '' : value}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') {
              onChange(optional ? null : 0)
              return
            }
            const n = Number(raw)
            if (Number.isNaN(n)) return
            onChange(Math.min(max, Math.max(min, n)))
          }}
        />
        {suffix && <span className="mono-sm text-faint shrink-0">{suffix}</span>}
      </div>
    </div>
  )
}

function GroupBlock({
  group,
  input,
  touched,
  onDimension,
  baseline,
  focus,
  children,
}: {
  group: GroupId
  input: AssessmentInput
  touched: string[]
  onDimension: (key: DimensionKey, value: Score) => void
  baseline?: AssessmentInput | null
  focus?: FocusState
  children?: React.ReactNode
}) {
  const meta = GROUP_META[group]
  const all = DIMENSIONS_BY_GROUP[group]
  const expanded = focus?.expanded.has(group) ?? false
  const shown =
    focus?.active && !expanded ? all.filter((d) => focus.keys.has(d.key)) : all
  const hidden = all.length - shown.length
  // A group with nothing to show should not cost a heading, a blurb and a link.
  // Collapsed to one line, it still marks its place in the sequence.
  const collapsed = focus?.active && shown.length === 0 && !children

  if (collapsed) {
    return (
      <section className="pt-6" aria-labelledby={`group-${group}`} data-group={group}>
        <button
          type="button"
          onClick={() => focus.onToggleGroup(group)}
          className="border-hair-strong text-faint hover:text-soft group flex w-full items-baseline gap-3 border-t pt-3 pb-1 text-left transition-colors"
        >
          <span className="mono tabular-nums">{meta.index}</span>
          <span id={`group-${group}`} className="mono scroll-mt-[112px]">
            {meta.label}
          </span>
          <span className="border-hair mx-1 hidden h-px flex-1 self-center border-t sm:block" aria-hidden="true" />
          <span className="text-[11.5px] whitespace-nowrap">
            {all.length} values, none carrying this recommendation
          </span>
          <span className="mono-sm group-hover:text-[var(--ink)]" aria-hidden="true">
            + show
          </span>
        </button>
      </section>
    )
  }

  return (
    <section className="pt-9" aria-labelledby={`group-${group}`} data-group={group}>
      <div className="border-hair-strong flex items-baseline gap-3 border-t pt-3">
        <span className="mono text-faint tabular-nums">{meta.index}</span>
        <h3 id={`group-${group}`} className="mono scroll-mt-[112px] text-[var(--ink)]">
          {meta.label}
        </h3>
      </div>
      <p className="text-muted mt-2 text-[12.5px] leading-[1.55]">{meta.blurb}</p>
      {children}
      <div className="mt-2">
        {shown.map((d) => (
          <div key={d.key} className="border-hair border-t">
            <DimensionControl
              dimension={d}
              value={readDimension(input, d.key)}
              touched={touched.includes(d.key)}
              {...(baseline ? { baseline: readDimension(baseline, d.key) } : {})}
              onChange={(v) => onDimension(d.key, v)}
            />
          </div>
        ))}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => focus?.onToggleGroup(group)}
            className="border-hair text-faint hover:text-soft flex w-full items-baseline gap-2.5 border-t py-2.5 text-left transition-colors"
          >
            <span aria-hidden="true">+</span>
            <span className="text-[12px] leading-[1.5]">
              {hidden} more in {meta.label.toLowerCase()} — not carrying this recommendation
            </span>
          </button>
        )}

        {focus?.active && expanded && (
          <button
            type="button"
            onClick={() => focus.onToggleGroup(group)}
            className="border-hair text-faint hover:text-soft flex w-full items-baseline gap-2.5 border-t py-2.5 text-left transition-colors"
          >
            <span aria-hidden="true">−</span>
            <span className="text-[12px] leading-[1.5]">Collapse to what matters here</span>
          </button>
        )}
      </div>
    </section>
  )
}

/** Which dimensions the focused pass is showing, and how to widen it. */
export interface FocusState {
  active: boolean
  /** Dimension keys currently carrying the recommendation. */
  keys: Set<string>
  /** Groups the user has expanded in full. */
  expanded: Set<GroupId>
  onToggleGroup: (group: GroupId) => void
}

export function DefinePanel({
  input,
  touched,
  notes,
  onInput,
  onDimension,
  baseline,
  onArchetype,
  onNotes,
  focus,
}: {
  input: AssessmentInput
  touched: string[]
  notes: string
  onInput: (input: AssessmentInput, touchedKey?: string) => void
  onDimension: (key: DimensionKey, value: Score) => void
  baseline?: AssessmentInput | null
  onArchetype: (id: string) => void
  onNotes: (v: string) => void
  focus?: FocusState
}) {
  const nameId = useId()
  const descId = useId()
  const archetypeId = useId()
  const vol = deriveVolume(input.economics)
  const archetype = ARCHETYPE_BY_ID[input.definition.archetype]

  const setEconomics = (patch: Partial<AssessmentInput['economics']>, touchedKey?: string) =>
    onInput({ ...input, economics: { ...input.economics, ...patch } }, touchedKey)

  return (
    <div>
      {/* --- definition ------------------------------------------- */}
      <section aria-labelledby="group-define" data-group="define">
        <div className="border-hair-strong flex items-baseline gap-3 border-t pt-3">
          <span className="mono text-faint tabular-nums">00</span>
          <h3 id="group-define" className="mono scroll-mt-[112px] text-[var(--ink)]">
            Define the work
          </h3>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <label htmlFor={nameId} className="mono-sm text-muted">
              Workflow name
            </label>
            <input
              id={nameId}
              className="field mt-1 text-[15px]"
              value={input.definition.name}
              maxLength={120}
              placeholder="Payment exception investigation"
              onChange={(e) =>
                onInput({
                  ...input,
                  definition: { ...input.definition, name: e.target.value },
                })
              }
            />
          </div>

          <div>
            <label htmlFor={descId} className="mono-sm text-muted flex items-baseline justify-between">
              <span>Description</span>
              <span className="text-faint normal-case">optional</span>
            </label>
            <textarea
              id={descId}
              className="field thin-scroll mt-1 resize-y leading-[1.5]"
              rows={3}
              maxLength={600}
              value={input.definition.description}
              placeholder="What happens in one case, from trigger to done."
              onChange={(e) =>
                onInput({
                  ...input,
                  definition: { ...input.definition, description: e.target.value },
                })
              }
            />
          </div>

          <div>
            <label htmlFor={archetypeId} className="mono-sm text-muted">
              Archetype
            </label>
            <select
              id={archetypeId}
              className="field mt-1 cursor-pointer"
              value={input.definition.archetype}
              onChange={(e) => onArchetype(e.target.value)}
            >
              {ARCHETYPES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            {archetype && (
              <p className="text-faint mt-2 text-[11.5px] leading-[1.5]">
                {archetype.note}{' '}
                <span className="text-muted">
                  Presets seed starting assumptions — every value stays editable, and untouched
                  dimensions are counted as unreviewed.
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* --- economics -------------------------------------------- */}
      <GroupBlock
        group="economics"
        input={input}
        touched={touched}
        onDimension={onDimension}
        baseline={baseline ?? null}
        {...(focus ? { focus } : {})}
      >
        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <NumField
            label="Volume"
            value={input.economics.volume}
            min={0}
            max={1000000}
            fieldId={`field-${ECONOMICS_KEYS.volume}`}
            onChange={(v) => setEconomics({ volume: v ?? 0 }, ECONOMICS_KEYS.volume)}
            suffix="cases"
          />
          <div>
            <span className="mono-sm text-muted block">Period</span>
            <div className="mt-1.5">
              <Segmented<Period>
                label="Volume period"
                size="sm"
                value={input.economics.period}
                onChange={(period) => setEconomics({ period })}
                options={[
                  { value: 'day', label: 'Day' },
                  { value: 'week', label: 'Week' },
                  { value: 'month', label: 'Month' },
                ]}
              />
            </div>
          </div>
          <NumField
            label="Time per case"
            value={input.economics.minutesPerCase}
            min={0}
            max={10000}
            fieldId={`field-${ECONOMICS_KEYS.minutesPerCase}`}
            onChange={(v) => setEconomics({ minutesPerCase: v ?? 0 }, ECONOMICS_KEYS.minutesPerCase)}
            suffix="min"
          />
          <NumField
            label="People per case"
            value={input.economics.peopleInvolved}
            min={1}
            max={200}
            optional
            placeholder="1"
            onChange={(v) => setEconomics({ peopleInvolved: v })}
          />
          <NumField
            label="Loaded hourly cost"
            value={input.economics.loadedHourlyCost}
            min={0}
            max={10000}
            optional
            placeholder="—"
            onChange={(v) => setEconomics({ loadedHourlyCost: v })}
            suffix="/ hr"
          />
          <NumField
            label="Engineering cost"
            value={input.economics.engineeringWeeklyCost}
            min={0}
            max={1000000}
            step={100}
            optional
            placeholder="—"
            onChange={(v) => setEconomics({ engineeringWeeklyCost: v })}
            suffix="/ wk"
          />
        </div>

        {/* Derived, not entered — kept visually apart from the inputs above. */}
        <div className="border-hair mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t pt-3">
          <span className="mono-sm text-muted">Manual effort today</span>
          <span className="num text-[15px] tabular-nums">
            {vol.manualHoursPerWeek < 1000
              ? vol.manualHoursPerWeek.toFixed(1)
              : Math.round(vol.manualHoursPerWeek).toLocaleString('en-US')}
            <span className="text-faint"> h / wk</span>
          </span>
        </div>
        <p className="text-faint mt-2 text-[11.5px] leading-[1.5]">
          {input.economics.volume.toLocaleString('en-US')} cases {PERIOD_LABEL[input.economics.period]} ·{' '}
          {Math.round(vol.casesPerYear).toLocaleString('en-US')} a year ·{' '}
          {Math.round(vol.manualHoursPerYear).toLocaleString('en-US')} hours a year.
          {input.economics.loadedHourlyCost === null && ' Capacity value needs an hourly cost.'}
          {input.economics.engineeringWeeklyCost === null && ' Payback needs an engineering cost.'}
        </p>
      </GroupBlock>

      {(['structure', 'systems', 'risk', 'oversight'] as GroupId[]).map((g) => (
        <GroupBlock
          key={g}
          group={g}
          input={input}
          touched={touched}
          onDimension={onDimension}
          baseline={baseline ?? null}
          {...(focus ? { focus } : {})}
        />
      ))}

      {/* --- notes ------------------------------------------------ */}
      <section className="pt-9" aria-labelledby="group-notes" data-group="notes">
        <div className="border-hair-strong flex items-baseline gap-3 border-t pt-3">
          <span className="mono text-faint tabular-nums">06</span>
          <h3 id="group-notes" className="mono scroll-mt-[112px] text-[var(--ink)]">
            Notes
          </h3>
        </div>
        <p className="text-muted mt-2 text-[12.5px] leading-[1.55]">
          Context the dimensions cannot carry — who you spoke to, what is contested, what you
          assumed. Saved with the assessment and printed on the decision brief.
        </p>
        <AutoTextarea
          className="field mt-4 leading-[1.6]"
          minRows={5}
          maxLength={4000}
          value={notes}
          aria-label="Assessment notes"
          placeholder="The 30-minute figure came from the ops lead and covers investigation only, not the write-up."
          onChange={onNotes}
        />
        <div className="text-faint mt-1.5 text-right text-[11px] tabular-nums">
          {notes.length} / 4000
        </div>
      </section>
    </div>
  )
}

/** Replace the whole input from an archetype, preserving any name the user typed. */
export function applyArchetype(current: AssessmentInput, id: string): AssessmentInput {
  const next = archetypeInput(id)
  const keepName = current.definition.name.trim() !== '' && id === 'custom'
  return {
    ...next,
    definition: {
      ...next.definition,
      name: keepName ? current.definition.name : next.definition.name,
      description: keepName ? current.definition.description : next.definition.description,
    },
  }
}

export { writeDimension }
