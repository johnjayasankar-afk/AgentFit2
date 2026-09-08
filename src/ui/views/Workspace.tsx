import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { CapacityAssumptions, DimensionKey, GroupId, PilotEdit, Score } from '../../domain/types'
import { ALL_DIMENSION_KEYS, writeDimension } from '../../domain/dimensions'
import { assess } from '../../engine/assess'
import { computeConfidence } from '../../engine/confidence'
import { computeUncertainty } from '../../engine/uncertainty'
import { computeGrounding, focusKeysFor } from '../../engine/grounding'
import { ARCHETYPE_BY_ID } from '../../domain/archetypes'
import { RevisionHistory } from '../components/RevisionHistory'
import { GroupJump } from '../components/GroupJump'
import { useStore } from '../store-context'
import { DefinePanel, applyArchetype, type FocusState } from './panels/DefinePanel'
import { RecommendationPanel } from './panels/RecommendationPanel'
import { ControlsPanel } from './panels/ControlsPanel'
import { EconomicsPanel } from './panels/CapacityPanel'
import { StressPanel } from './panels/StressPanel'
import { RiskPanel } from './panels/RiskPanel'
import { PlanPanel } from './panels/PlanPanel'
import { DecisionPanel } from './panels/DecisionPanel'
import { ReviewComplete, ReviewPanel } from './panels/ReviewPanel'
import { ShareSheet } from '../components/ShareSheet'
import { DEEP_TABS } from '../router'
import {
  buildReviewQueue,
  fullReviewQueue,
  reviewOutcome,
  summariseReview,
  type ReviewStep,
} from '../../engine/review'
import type { AssessmentResult } from '../../engine/assess'

export function Workspace() {
  const store = useStore()
  const { current, scenario, tab, setTab } = store
  const [historyOpen, setHistoryOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [review, setReview] = useState<ReviewSession | null>(null)
  const [focusActive, setFocusActive] = useState(readFocusPreference)
  // Expansion is per-assessment, so it is stored with the id that owns it and
  // falls back to empty when a different assessment is opened. Keying it this
  // way avoids an effect that would only exist to reset state.
  const [expansion, setExpansion] = useState<{ id: string; groups: Set<GroupId> }>(() => ({
    id: current.id,
    groups: new Set(),
  }))
  const expandedGroups = expansion.id === current.id ? expansion.groups : EMPTY_GROUPS

  const result = useMemo(() => assess(current.input), [current.input])
  const confidence = useMemo(() => computeConfidence(current), [current])
  const uncertainty = useMemo(() => computeUncertainty(current), [current])
  const grounding = useMemo(
    () => computeGrounding(current, result, uncertainty),
    [current, result, uncertainty],
  )
  const scenarioResult = useMemo(() => (scenario ? assess(scenario) : null), [scenario])

  useEffect(() => {
    try {
      localStorage.setItem(FOCUS_KEY, focusActive ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
  }, [focusActive])

  const focusKeys = useMemo(
    () => focusKeysFor(current.touched, grounding.loadBearing),
    [grounding.loadBearing, current.touched],
  )

  // Reported as what the toggle hides, which is unambiguous — the load-bearing
  // count includes two economics fields that are not sliders, so showing it
  // here would not match what the reader can see.
  const hiddenDimensions = ALL_DIMENSION_KEYS.filter((k) => !focusKeys.has(k)).length

  const focus: FocusState = {
    active: focusActive,
    keys: focusKeys,
    expanded: expandedGroups,
    onToggleGroup: (group) =>
      setExpansion((prev) => {
        const groups = new Set(prev.id === current.id ? prev.groups : [])
        if (groups.has(group)) groups.delete(group)
        else groups.add(group)
        return { id: current.id, groups }
      }),
  }

  /* --- guided review ------------------------------------------------ */

  /**
   * With values outstanding this walks those. With none outstanding it walks
   * every load-bearing value again, because "show me what this rests on" is a
   * reasonable thing to ask of an assessment somebody else built — and a
   * button that only ever says "nothing to do" is not worth having.
   */
  const startReview = () => {
    const outstanding = buildReviewQueue(grounding)
    const recheck = outstanding.length === 0
    const queue = recheck ? fullReviewQueue(grounding) : outstanding
    if (queue.length === 0) {
      store.notify('This recommendation does not rest on any single value that can be reviewed.')
      return
    }
    setShareOpen(false)
    setReview({
      queue,
      recheck,
      index: 0,
      stepBefore: result,
      stepAnswered: false,
      answered: [],
      entryResult: result,
      done: false,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const step = review && !review.done ? review.queue[review.index] : undefined

  const onReviewAnswer = (value: Score) => {
    if (!step) return
    // Every answer inside a pass is its own undo step: the point of the mode is
    // that each one is a separate judgement, and collapsing a run of them would
    // make backing out of a single answer impossible.
    store.setInput(writeDimension(current.input, step.key as DimensionKey, value), step.key)
    setReview((r) => (r ? { ...r, stepAnswered: true, answered: remember(r.answered, step.key) } : r))
  }

  const onReviewEconomics = (patch: { volume?: number; minutesPerCase?: number }) => {
    if (!step) return
    store.setInput(
      { ...current.input, economics: { ...current.input.economics, ...patch } },
      step.key,
      step.key,
    )
    setReview((r) => (r ? { ...r, stepAnswered: true, answered: remember(r.answered, step.key) } : r))
  }

  const onReviewNext = () => {
    setReview((r) => {
      if (!r) return r
      if (r.index + 1 >= r.queue.length) return { ...r, done: true }
      return { ...r, index: r.index + 1, stepBefore: result, stepAnswered: false }
    })
  }

  const onReviewBack = () => {
    setReview((r) =>
      r && r.index > 0
        ? { ...r, index: r.index - 1, stepBefore: result, stepAnswered: false, done: false }
        : r,
    )
  }

  const exitReview = () => setReview(null)

  const summary = useMemo(
    () =>
      review?.done ? summariseReview(review.answered, review.entryResult, result, grounding) : null,
    [review, result, grounding],
  )

  const continueReview = () => {
    if (!summary || summary.newlyLoadBearing.length === 0) return
    setReview({
      queue: summary.newlyLoadBearing,
      recheck: false,
      index: 0,
      stepBefore: result,
      stepAnswered: false,
      answered: [],
      entryResult: result,
      done: false,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // A request raised from outside the sheet — the command palette. The nonce
  // is the signal; the session it starts is entirely local to this component.
  const requested = store.reviewRequest
  useEffect(() => {
    if (requested > 0) startReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the nonce is the trigger
  }, [requested])

  // Keyboard: the pass should be completable without touching the mouse.
  useEffect(() => {
    if (!review || review.done) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      // A radio is an input but not a text field: typing into it is choosing,
      // so the digit shortcuts must still reach it. Everything else that takes
      // characters keeps them.
      const radio = el instanceof HTMLInputElement && el.type === 'radio'
      const typing =
        !radio &&
        (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable === true)

      if (e.key === 'Escape') {
        e.preventDefault()
        exitReview()
        return
      }
      if (typing) return
      if (/^[1-5]$/.test(e.key) && step?.kind === 'dimension') {
        e.preventDefault()
        onReviewAnswer(Number(e.key) as Score)
        return
      }
      // Inside the anchor group the arrows belong to the group: that is what a
      // radio does, and overriding it to page between questions would make the
      // most standard control in the pass behave unlike every other one.
      if (radio) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onReviewNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onReviewBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onDimension = (key: DimensionKey, value: Score) => {
    // Coalesce on the key so a slider drag costs one undo step, not twenty.
    store.setInput(writeDimension(current.input, key, value), key, key)
  }

  const onAssumptions = (assumptions: CapacityAssumptions) => {
    store.setInput({ ...current.input, assumptions })
  }

  const onArchetype = (id: string) => {
    store.update((a) => ({
      ...a,
      input: applyArchetype(a.input, id),
      // A preset replaces the whole position, so nothing carries over as reviewed.
      touched: [],
    }))
  }

  const onRiskEdit = (id: string, mitigation: string | null) => {
    store.update((a) => {
      const next = { ...a.riskEdits }
      if (mitigation === null) delete next[id]
      else next[id] = { ...next[id], mitigation }
      return { ...a, riskEdits: next }
    })
  }

  const onPilotEdit = (key: keyof PilotEdit, value: string | null) => {
    store.update((a) => {
      const next = { ...a.pilotEdits }
      if (value === null) delete next[key]
      else next[key] = value
      return { ...a, pilotEdits: next }
    })
  }

  const onExperimentEdit = (patch: { title?: string | null; criteria?: string[] | null }) => {
    store.update((a) => {
      const next = { ...a.experimentEdits }
      if ('title' in patch) {
        if (patch.title === null) delete next.title
        else if (patch.title !== undefined) next.title = patch.title
      }
      if ('criteria' in patch) {
        if (patch.criteria === null) delete next.criteria
        else if (patch.criteria !== undefined) next.criteria = patch.criteria
      }
      return { ...a, experimentEdits: next }
    })
  }

  return (
    <>
      {/* --- primary workspace ------------------------------------- */}
      <div className="shell grid gap-x-16 gap-y-14 pt-10 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="min-w-0">
          {review ? (
            review.done && summary ? (
              <ReviewComplete
                summary={summary}
                unsaved={store.dirty || !store.isSaved}
                onContinue={continueReview}
                onSave={() => void store.save()}
                onExit={exitReview}
              />
            ) : (
              step && (
                <ReviewPanel
                  key={step.key}
                  step={step}
                  name={current.input.definition.name || 'Untitled workflow'}
                  recheck={review.recheck}
                  index={review.index}
                  total={review.queue.length}
                  input={current.input}
                  outcome={
                    review.stepAnswered ? reviewOutcome(review.stepBefore, result) : null
                  }
                  // Already-reviewed values do not block the way forward: on a
                  // second pass every step is a confirmation, not a gate.
                  answered={review.stepAnswered || current.touched.includes(step.key)}
                  onAnswer={onReviewAnswer}
                  onEconomics={onReviewEconomics}
                  onNext={onReviewNext}
                  onSkip={onReviewNext}
                  onBack={onReviewBack}
                  onExit={exitReview}
                />
              )
            )
          ) : (
            <>
              <AssessmentToolbar
                onOpenHistory={() => setHistoryOpen(true)}
                shareOpen={shareOpen}
                onToggleShare={() => setShareOpen((v) => !v)}
                focusActive={focusActive}
                hiddenCount={hiddenDimensions}
                onToggleFocus={() => setFocusActive((v) => !v)}
                onStartReview={() => startReview()}
                reviewCount={grounding.nextToReview.length}
              />
              {shareOpen && <ShareSheet assessment={current} onClose={() => setShareOpen(false)} />}
              {/* Sticky needs a tall containing block, so this sits in the column
                  itself rather than inside the toolbar it visually belongs to. */}
              <div className="border-hair sticky top-[57px] z-30 mb-8 border-t border-b bg-[color-mix(in_srgb,var(--paper)_93%,transparent)] backdrop-blur-[8px]">
                <GroupJump touched={current.touched} />
              </div>
              <DefinePanel
                input={current.input}
                touched={current.touched}
                notes={current.notes}
                onInput={(i, touchedKey) => store.setInput(i, touchedKey, touchedKey)}
                onDimension={onDimension}
                onArchetype={onArchetype}
                onNotes={store.setNotes}
                baseline={null}
                focus={focus}
              />
            </>
          )}
        </div>

        <div className="min-w-0">
          <div className="lg:sticky lg:top-[76px]">
            <div className="thin-scroll lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:pr-4">
              <RecommendationPanel
                input={current.input}
                result={result}
                confidence={confidence}
                uncertainty={uncertainty}
                grounding={grounding}
                // No competing entry point while a pass is running: the
                // load-bearing set can grow mid-review, and an invitation to
                // "review 13 values" beside a card reading 01/08 would read as
                // a contradiction rather than as the model responding.
                {...(review ? {} : { onReview: () => startReview() })}
                scenario={scenario}
                scenarioResult={scenarioResult}
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- deep panels -------------------------------------------- */}
      <div className="border-hair-strong border-t">
        <div className="shell">
          <div
            role="tablist"
            aria-label="Assessment detail"
            className="thin-scroll -mb-px flex gap-0 overflow-x-auto"
          >
            {DEEP_TABS.map((t) => {
              const active = t.id === tab
              return (
                <button
                  key={t.id}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={active}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                    e.preventDefault()
                    const i = DEEP_TABS.findIndex((x) => x.id === tab)
                    const d = e.key === 'ArrowRight' ? 1 : -1
                    const next = DEEP_TABS[(i + d + DEEP_TABS.length) % DEEP_TABS.length]!
                    setTab(next.id)
                    document.getElementById(`tab-${next.id}`)?.focus()
                  }}
                  className={clsx(
                    'mono border-b-2 px-4 py-4 whitespace-nowrap transition-colors first:pl-0',
                    active
                      ? 'border-b-[var(--ink)] text-[var(--ink)]'
                      : 'text-faint hover:text-soft border-b-transparent',
                  )}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="shell py-14">
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={-1}
          className="af-enter"
          key={tab}
        >
          {tab === 'controls' && <ControlsPanel result={result} />}
          {tab === 'capacity' && (
            <EconomicsPanel input={current.input} result={result} onAssumptions={onAssumptions} />
          )}
          {tab === 'stress' && (
            <StressPanel
              input={current.input}
              result={result}
              scenario={scenario}
              scenarioResult={scenarioResult}
              onStart={store.startScenario}
              onEnd={store.endScenario}
              onScenario={store.setScenario}
              onApply={store.applyScenario}
            />
          )}
          {tab === 'risk' && (
            <RiskPanel result={result} assessment={current} onEdit={onRiskEdit} />
          )}
          {tab === 'decision' && (
            <DecisionPanel
              assessment={current}
              result={result}
              onChange={store.setDecision}
            />
          )}
          {tab === 'plan' && (
            <PlanPanel
              result={result}
              assessment={current}
              onPilotEdit={onPilotEdit}
              onExperimentEdit={onExperimentEdit}
            />
          )}
        </div>
      </div>

      {historyOpen && (
        <RevisionHistory
          assessment={current}
          onRestore={store.restoreRevision}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  )
}

/**
 * Edit controls for the record itself, placed with the inputs rather than in
 * the header — undo belongs next to the thing being undone.
 */
interface ReviewSession {
  queue: ReviewStep[]
  /** True when nothing was outstanding and this is a deliberate re-check. */
  recheck: boolean
  index: number
  /** The result as it stood when the current step was opened. */
  stepBefore: AssessmentResult
  /** Whether the current step has been answered since it was opened. */
  stepAnswered: boolean
  /** Every key answered in this pass, for the closing summary. */
  answered: string[]
  /** The result as it stood when the pass began. */
  entryResult: AssessmentResult
  done: boolean
}

function remember(answered: string[], key: string): string[] {
  return answered.includes(key) ? answered : [...answered, key]
}

const FOCUS_KEY = 'agentfit.focus.v1'
const EMPTY_GROUPS: Set<GroupId> = new Set()

function readFocusPreference(): boolean {
  try {
    return localStorage.getItem(FOCUS_KEY) === '1'
  } catch {
    return false
  }
}

function AssessmentToolbar({
  onOpenHistory,
  shareOpen,
  onToggleShare,
  focusActive,
  hiddenCount,
  onToggleFocus,
  onStartReview,
  reviewCount,
}: {
  onOpenHistory: () => void
  shareOpen: boolean
  onToggleShare: () => void
  focusActive: boolean
  hiddenCount: number
  onToggleFocus: () => void
  onStartReview: () => void
  reviewCount: number
}) {
  const store = useStore()
  const archetype = ARCHETYPE_BY_ID[store.current.input.definition.archetype]
  // `touched` also carries the economics fields, which are not dimensions —
  // counting them here produced "22/20 reviewed".
  const reviewed = store.current.touched.filter((k) =>
    (ALL_DIMENSION_KEYS as readonly string[]).includes(k),
  ).length

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-3">
      <div className="mono-sm text-faint flex items-center gap-3">
        <span className={store.dirty || !store.isSaved ? 'text-signal' : ''}>
          {!store.isSaved ? 'Unsaved' : store.dirty ? 'Modified' : 'Saved'}
        </span>
        <span className="bg-[var(--hair-strong)] inline-block h-px w-6" aria-hidden="true" />
        <span className="tabular-nums">
          {reviewed}/{ALL_DIMENSION_KEYS.length} reviewed
        </span>
      </div>

      {/* Scrolls rather than wraps below ~420px: the separators group these
          into three distinct kinds of action, and wrapping breaks the grouping
          at whatever point the line happens to end. */}
      <div className="thin-scroll -mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1">
        <button
          className="btn btn-quiet shrink-0"
          onClick={onStartReview}
          title={
            reviewCount > 0
              ? `Walk the ${reviewCount} values this recommendation still rests on`
              : 'Walk the values this recommendation rests on'
          }
        >
          Review{reviewCount > 0 ? ` ${reviewCount}` : ''}
        </button>
        <span className="bg-[var(--hair-strong)] mx-1 inline-block h-3 w-px" aria-hidden="true" />
        <button
          className="btn btn-quiet shrink-0"
          onClick={onToggleFocus}
          aria-pressed={focusActive}
          title={
            focusActive
              ? `Showing only what this recommendation rests on. ${hiddenCount} dimensions hidden.`
              : 'Show only the values this recommendation rests on'
          }
        >
          {focusActive ? `Focused · ${hiddenCount} hidden` : 'Focus'}
        </button>
        <span className="bg-[var(--hair-strong)] mx-1 inline-block h-3 w-px" aria-hidden="true" />
        <button
          className="btn btn-quiet shrink-0"
          onClick={store.undo}
          disabled={!store.canUndo}
          title="Undo (⌘Z)"
        >
          Undo
        </button>
        <button
          className="btn btn-quiet shrink-0"
          onClick={store.redo}
          disabled={!store.canRedo}
          title="Redo (⇧⌘Z)"
        >
          Redo
        </button>
        <button
          className="btn btn-quiet shrink-0"
          onClick={onOpenHistory}
          disabled={store.current.revisions.length === 0}
          title={
            store.current.revisions.length === 0
              ? 'No revisions yet — the first save creates one'
              : 'Revision history'
          }
        >
          History{store.current.revisions.length > 0 ? ` ${store.current.revisions.length}` : ''}
        </button>
        <span className="bg-[var(--hair-strong)] mx-1 inline-block h-3 w-px" aria-hidden="true" />
        <button
          className="btn btn-quiet shrink-0"
          onClick={onToggleShare}
          aria-expanded={shareOpen}
          title="Copy a link that carries this whole assessment"
        >
          Share
        </button>
        {archetype && archetype.id !== 'custom' && (
          <>
            <span
              className="bg-[var(--hair-strong)] mx-1 inline-block h-3 w-px"
              aria-hidden="true"
            />
            <button
              className="btn btn-quiet shrink-0 text-faint hover:text-[var(--ink)]"
              onClick={() => onArchetypeReset(store)}
              title={`Reload the ${archetype.label} preset, discarding your changes`}
            >
              Reset preset
            </button>
          </>
        )}
        </div>
      </div>
    </div>
  )
}

function onArchetypeReset(store: ReturnType<typeof useStore>): void {
  store.update((a) => ({
    ...a,
    input: applyArchetype(a.input, a.input.definition.archetype),
    touched: [],
  }))
  store.notify('Reset to the preset. Undo to go back.')
}
