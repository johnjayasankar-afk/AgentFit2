import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StoreContext, type StorageStatus, type Store, type Theme, type View } from './store-context'
import type { Assessment, AssessmentInput, Decision, DimensionKey, Revision } from '../domain/types'
import { assessmentSchema, MAX_REVISIONS } from '../domain/types'
import { MODEL_VERSION } from '../engine/version'
import { archetypeInput } from '../domain/archetypes'
import {
  absoluteUrl,
  DEFAULT_TAB,
  formatRoute,
  parseRoute,
  routeFor,
  type DeepTab,
  type Route,
} from './router'
import { decodeShare, encodeShare } from '../persistence/link'
import {
  createAssessment,
  deleteAssessment as dbDelete,
  duplicateAssessment,
  listAssessments,
  newId,
  putAssessment,
  putAssessments,
  readAll,
  saveAssessment,
  seedExamplesIfEmpty,
} from '../persistence/db'

/** Steps of history kept in memory. Bounded so a long session cannot grow. */
const HISTORY_LIMIT = 60
/** Edits to the same field inside this window collapse into one undo step. */
const COALESCE_MS = 600

interface Snapshot {
  input: AssessmentInput
  notes: string
  decision: Decision
}

const DRAFT_KEY = 'agentfit.draft.v1'
const THEME_KEY = 'agentfit.theme'
const SEEN_KEY = 'agentfit.seen.v1'

interface Draft {
  assessment: Assessment
  saved: string | null
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { assessment?: unknown; saved?: unknown }
    const assessment = assessmentSchema.parse(parsed.assessment)
    return { assessment, saved: typeof parsed.saved === 'string' ? parsed.saved : null }
  } catch {
    // A corrupt draft must never block startup.
    return null
  }
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Comparable identity of the parts a user can edit. */
function fingerprint(a: Assessment): string {
  return JSON.stringify({
    input: a.input,
    notes: a.notes,
    touched: a.touched.toSorted(),
    riskEdits: a.riskEdits,
    pilotEdits: a.pilotEdits,
    experimentEdits: a.experimentEdits,
    // Without this, recording a decision leaves the record reading "Saved" and
    // the work is lost on the next navigation.
    decision: a.decision,
  })
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // Read once, during the first render, via a lazy state initialiser rather
  // than a ref — a ref written during render is a hazard the linter is right
  // to flag, and this value never changes after mount.
  const [draft] = useState<Draft | null>(readDraft)

  // Captured once: the address the session opened at. Applied after the local
  // library has loaded, because `#/a/<id>` cannot resolve before then.
  const [entryRoute] = useState<Route>(() => parseRoute(window.location.hash))

  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>('workspace')
  const [tab, setTab] = useState<DeepTab>(
    entryRoute.kind === 'workspace' ? entryRoute.tab : DEFAULT_TAB,
  )
  /**
   * Provenance of an assessment that arrived in a link. The fingerprint is what
   * makes it self-expiring: the moment the recipient edits anything the token
   * no longer describes what is on screen, so the banner and the address both
   * stand down without an effect to police them.
   */
  const [shared, setShared] = useState<{
    token: string
    fingerprint: string
    foreignModel: boolean
    /** When the sender last worked on it. Their clock, not this one. */
    assessedAt: number
  } | null>(null)
  const [reviewRequest, setReviewRequest] = useState(0)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [current, setCurrent] = useState<Assessment>(
    () => draft?.assessment ?? createAssessment('custom'),
  )
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(
    () => draft?.saved ?? null,
  )
  const [scenario, setScenarioState] = useState<AssessmentInput | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null)
  const [storage, setStorage] = useState<StorageStatus>('ok')
  const [dataNotice, setDataNotice] = useState<string | null>(null)
  const [history, setHistory] = useState({ past: 0, future: 0 })

  const past = useRef<Snapshot[]>([])
  const future = useRef<Snapshot[]>([])
  const lastEdit = useRef<{ key: string; at: number } | null>(null)
  const [firstRun, setFirstRun] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) !== '1' && readDraft() === null
    } catch {
      return true
    }
  })

  /* --- theme ------------------------------------------------------ */
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])

  /* --- draft persistence ------------------------------------------ */
  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ assessment: current, saved: savedFingerprint }),
      )
    } catch {
      /* storage full or unavailable — the session still works */
    }
  }, [current, savedFingerprint])

  const currentFingerprint = useMemo(() => fingerprint(current), [current])
  const dirty = savedFingerprint !== null && currentFingerprint !== savedFingerprint
  const isSaved = savedFingerprint !== null

  /**
   * True while what is on screen is still exactly what the link delivered. One
   * edit, or one save, and this is an assessment of the recipient's own — which
   * is the honest reading, and also what stops a stale token staying in the
   * address bar.
   */
  const sharedActive = shared !== null && !isSaved && shared.fingerprint === currentFingerprint

  const notify = useCallback((message: string) => {
    setToast({ message, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  const syncHistory = useCallback(() => {
    setHistory({ past: past.current.length, future: future.current.length })
  }, [])

  const resetHistory = useCallback(() => {
    past.current = []
    future.current = []
    lastEdit.current = null
    setHistory({ past: 0, future: 0 })
  }, [])

  /**
   * Put an address into effect.
   *
   * Used for the address the session opened at and for every back and forward
   * after it, so a route behaves the same however it is reached. Anything that
   * cannot be honoured says so: a bookmark to a deleted assessment or a link
   * truncated by a chat client should open the product with an explanation
   * rather than silently landing somewhere else.
   *
   * `available` is passed rather than read from state because the first call
   * happens inside the same tick as the library load, before it has settled.
   */
  const applyRoute = useCallback(
    async (next: Route, available: Assessment[]) => {
      switch (next.kind) {
        case 'workspace': {
          setView('workspace')
          setTab(next.tab)
          if (!next.id) return
          const found = available.find((a) => a.id === next.id)
          if (!found) {
            notify('That assessment is not on this device. Opening what you had last.')
            return
          }
          setCurrent(found)
          setSavedFingerprint(fingerprint(found))
          setScenarioState(null)
          resetHistory()
          return
        }
        case 'compare': {
          const ids = next.ids.filter((id) => available.some((a) => a.id === id))
          if (ids.length < next.ids.length) {
            notify('Some of the assessments in that link are no longer on this device.')
          }
          setCompareIds(ids)
          setView('compare')
          return
        }
        case 'shared': {
          const decoded = await decodeShare(next.token, archetypeInput('custom'))
          if (typeof decoded === 'string') {
            notify(
              decoded === 'unsupported-version'
                ? 'That link was made by a newer version of AgentFit and cannot be read here.'
                : 'That link is incomplete or damaged — ask for it again, unshortened.',
            )
            return
          }
          setCurrent(decoded.assessment)
          setSavedFingerprint(null)
          setScenarioState(null)
          resetHistory()
          setTab(next.tab)
          setShared({
            token: next.token,
            fingerprint: fingerprint(decoded.assessment),
            foreignModel: decoded.foreignModel,
            assessedAt: decoded.assessment.updatedAt,
          })
          setView('workspace')
          return
        }
        default:
          setView(next.kind)
      }
    },
    [notify, resetHistory],
  )

  /* --- boot ------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await seedExamplesIfEmpty()
        const outcome = await readAll()
        if (cancelled) return
        setAssessments(outcome.ok)
        // The sheet is the default, so an address that only names it must not
        // displace the draft the user left open.
        if (entryRoute.kind !== 'workspace' || entryRoute.id !== null) {
          setFirstRun(false)
          await applyRoute(entryRoute, outcome.ok)
        }
        if (cancelled) return
        // Migrations and unreadable records are reported, never silent.
        const notes: string[] = []
        if (outcome.migrated > 0) {
          notes.push(
            `${outcome.migrated} assessment${outcome.migrated === 1 ? '' : 's'} upgraded to the current storage format.`,
          )
        }
        if (outcome.skipped.length > 0) {
          notes.push(
            `${outcome.skipped.length} record${outcome.skipped.length === 1 ? '' : 's'} could not be read and ${outcome.skipped.length === 1 ? 'was' : 'were'} left untouched on disk.`,
          )
        }
        if (notes.length > 0) setDataNotice(notes.join(' '))
      } catch {
        // IndexedDB can be unavailable: private browsing, blocked storage, or a
        // quota refusal. The instrument still works in full; only the library
        // and saving are lost, and the banner says so rather than failing on the
        // user's next click.
        if (!cancelled) {
          setAssessments([])
          setStorage('unavailable')
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyRoute, entryRoute])

  /**
   * Record the pre-edit state, collapsing a run of changes to the same field.
   * Dragging a slider is one intention, so it should cost one undo — but moving
   * to a different slider starts a new one.
   *
   * Called from event handlers, never from inside a state updater: updater
   * functions have to stay pure, and React runs them twice in development.
   */
  const remember = useCallback(
    (snapshot: Snapshot, coalesceKey?: string) => {
      const now = Date.now()
      const last = lastEdit.current
      const sameRun =
        coalesceKey !== undefined && last?.key === coalesceKey && now - last.at < COALESCE_MS
      lastEdit.current = coalesceKey === undefined ? null : { key: coalesceKey, at: now }
      if (sameRun) return
      past.current = [...past.current, snapshot].slice(-HISTORY_LIMIT)
      future.current = []
      syncHistory()
    },
    [syncHistory],
  )

  const snapshot = useCallback(
    (): Snapshot => ({ input: current.input, notes: current.notes, decision: current.decision }),
    [current.input, current.notes, current.decision],
  )

  const update = useCallback(
    (patch: (a: Assessment) => Assessment, coalesceKey?: string) => {
      remember(snapshot(), coalesceKey)
      setCurrent(patch)
    },
    [remember, snapshot],
  )

  const setInput = useCallback(
    (input: AssessmentInput, touchedKey?: DimensionKey | string, coalesceKey?: string) => {
      remember(snapshot(), coalesceKey ?? touchedKey)
      setCurrent((prev) => ({
        ...prev,
        input,
        touched:
          touchedKey && !prev.touched.includes(touchedKey)
            ? [...prev.touched, touchedKey]
            : prev.touched,
      }))
    },
    [remember, snapshot],
  )

  const rename = useCallback(
    (name: string) => {
      remember(snapshot(), 'definition.name')
      setCurrent((prev) => ({
        ...prev,
        input: { ...prev.input, definition: { ...prev.input.definition, name } },
      }))
    },
    [remember, snapshot],
  )

  const setNotes = useCallback(
    (notes: string) => {
      remember(snapshot(), 'notes')
      setCurrent((prev) => ({ ...prev, notes }))
    },
    [remember, snapshot],
  )

  const setDecision = useCallback(
    (patch: Partial<Decision>) => {
      remember(snapshot(), 'decision')
      setCurrent((prev) => ({ ...prev, decision: { ...prev.decision, ...patch } }))
    },
    [remember, snapshot],
  )

  const undo = useCallback(() => {
    const step = past.current.at(-1)
    if (!step) return
    past.current = past.current.slice(0, -1)
    future.current = [...future.current, snapshot()]
    lastEdit.current = null
    syncHistory()
    setCurrent((prev) => ({
      ...prev,
      input: step.input,
      notes: step.notes,
      decision: step.decision,
    }))
  }, [snapshot, syncHistory])

  const redo = useCallback(() => {
    const step = future.current.at(-1)
    if (!step) return
    future.current = future.current.slice(0, -1)
    past.current = [...past.current, snapshot()]
    lastEdit.current = null
    syncHistory()
    setCurrent((prev) => ({
      ...prev,
      input: step.input,
      notes: step.notes,
      decision: step.decision,
    }))
  }, [snapshot, syncHistory])

  const refresh = useCallback(async () => {
    try {
      setAssessments(await listAssessments())
    } catch {
      /* library unavailable */
    }
  }, [])

  const save = useCallback(async () => {
    // A shipped example is never overwritten. Editing one forks a copy and
    // leaves the original in the library for reference.
    if (storage === 'unavailable') {
      notify('Saving is unavailable: this browser is blocking local storage. Export to keep this work.')
      return
    }

    const forking = current.example
    // A save is the natural revision boundary: it is the moment the user says
    // this version is worth keeping. Identical consecutive saves do not stack.
    const newest = current.revisions[0]
    const changed =
      !newest ||
      JSON.stringify(newest.input) !== JSON.stringify(current.input) ||
      newest.notes !== current.notes
    const revision: Revision = {
      at: Date.now(),
      modelVersion: MODEL_VERSION,
      input: structuredClone(current.input),
      notes: current.notes,
    }
    const revisions = changed
      ? [revision, ...current.revisions].slice(0, MAX_REVISIONS)
      : current.revisions

    const record: Assessment = forking
      ? { ...current, id: newId(), revisions: [revision], example: false, createdAt: Date.now(), updatedAt: Date.now() }
      : { ...current, revisions, updatedAt: Date.now() }
    try {
      await saveAssessment(record)
      setCurrent(record)
      setSavedFingerprint(fingerprint(record))
      await refresh()
      const name = record.input.definition.name || 'Untitled workflow'
      notify(
        forking
          ? `Saved “${name}” as a new assessment. The shipped example is unchanged.`
          : `Saved “${name}”`,
      )
    } catch {
      setStorage('unavailable')
      notify('Could not save: this browser is blocking local storage. Export to keep this work.')
    }
  }, [current, refresh, notify, storage])

  const open = useCallback(
    (id: string): boolean => {
      const found = assessments.find((a) => a.id === id)
      if (!found) {
        // Never strand the user on a blank sheet with no explanation.
        notify('That assessment is no longer on this device.')
        return false
      }
      setCurrent(found)
      setSavedFingerprint(fingerprint(found))
      setScenarioState(null)
      resetHistory()
      setView('workspace')
      setFirstRun(false)
      return true
    },
    [assessments, resetHistory, notify],
  )

  const create = useCallback((archetypeId = 'custom') => {
    const next = createAssessment(archetypeId)
    setCurrent(next)
    setSavedFingerprint(null)
    setScenarioState(null)
    resetHistory()
    setView('workspace')
    setFirstRun(false)
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* storage unavailable */
    }
  }, [resetHistory])

  const duplicate = useCallback(
    async (id: string) => {
      const source = assessments.find((a) => a.id === id)
      if (!source) return
      const copy = duplicateAssessment(source)
      await putAssessment(copy)
      await refresh()
      notify(`Duplicated as “${copy.input.definition.name}”`)
    },
    [assessments, refresh, notify],
  )

  const remove = useCallback(
    async (id: string) => {
      await dbDelete(id)
      setCompareIds((ids) => ids.filter((x) => x !== id))
      // Deleting the open assessment leaves the work in the editor as unsaved,
      // rather than discarding what the user was looking at.
      setCurrent((prev) => (prev.id === id ? prev : prev))
      if (current.id === id) setSavedFingerprint(null)
      await refresh()
      notify('Deleted')
    },
    [current.id, refresh, notify],
  )

  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      const found = assessments.find((a) => a.id === id)
      if (!found) return
      await putAssessment({ ...found, archived })
      await refresh()
      notify(archived ? 'Archived' : 'Restored')
    },
    [assessments, refresh, notify],
  )

  const importAssessments = useCallback(
    async (items: Assessment[]) => {
      await putAssessments(items)
      await refresh()
    },
    [refresh],
  )

  const restoreRevision = useCallback(
    (at: number) => {
      const found = current.revisions.find((r) => r.at === at)
      if (!found) return
      remember(snapshot())
      setCurrent((prev) => ({
        ...prev,
        input: structuredClone(found.input),
        notes: found.notes,
      }))
      notify('Restored: save to keep it, or undo to go back.')
    },
    [current.revisions, remember, snapshot, notify],
  )

  /* --- scenario lab ------------------------------------------------ */
  const startScenario = useCallback(() => {
    setScenarioState((prev) => prev ?? structuredClone(current.input))
  }, [current.input])

  const endScenario = useCallback(() => setScenarioState(null), [])
  const setScenario = useCallback((input: AssessmentInput) => setScenarioState(input), [])

  const applyScenario = useCallback(() => {
    if (!scenario) return
    setCurrent((prev) => ({ ...prev, input: structuredClone(scenario) }))
    setScenarioState(null)
    notify('Scenario applied to the assessment')
  }, [scenario, notify])

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 4 ? ids : [...ids, id],
    )
  }, [])

  const dismissFirstRun = useCallback(() => {
    setFirstRun(false)
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* storage unavailable */
    }
  }, [])

  /* --- address ----------------------------------------------------- *
   *
   * State is the source of truth and the URL follows it; back and forward feed
   * the URL back into state. The two directions never fight because the writer
   * compares against what is already in the bar and does nothing when they
   * agree, which is the case on every arrival from a popstate.
   */
  const route = useMemo<Route>(() => {
    if (view === 'workspace' && sharedActive && shared) {
      return { kind: 'shared', token: shared.token, tab }
    }
    return routeFor({ view, currentId: current.id, isSaved, tab, compareIds })
  }, [view, sharedActive, shared, current.id, isSaved, tab, compareIds])

  // Set by the popstate handler and consumed by the writer below, so a state
  // change the URL could not fully honour corrects the bar in place instead of
  // pushing an entry the user never asked for.
  const arrivedAt = useRef<string | null>(null)
  const addressed = useRef(false)

  // Deliberately unconditional. The bar must always end up describing what is
  // on screen, including after an address that could not be honoured — a link
  // truncated in transit leaves state untouched, so keying this to the route
  // would leave the failed address sitting in the bar, reloadable and wrong.
  // The body is a string comparison that writes nothing in the common case.
  useEffect(() => {
    // The opening screen has no address of its own, so leaving it replaces
    // rather than pushes: a back button that returns to a splash the user has
    // already dismissed would look like it did nothing at all.
    if (!ready || firstRun) return
    const target = formatRoute(route)
    const here = window.location.hash || '#/'
    const fromHistory = arrivedAt.current === here
    arrivedAt.current = null
    if (here !== target) {
      if (addressed.current && !fromHistory) window.history.pushState(null, '', target)
      else window.history.replaceState(null, '', target)
    }
    addressed.current = true
  })


  useEffect(() => {
    const onPop = () => {
      arrivedAt.current = window.location.hash || '#/'
      void applyRoute(parseRoute(window.location.hash), assessments)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [applyRoute, assessments])

  /**
   * A link that carries the whole assessment. Defaults to the open one.
   *
   * The link opens on whichever detail panel the sender is looking at. Someone
   * who navigates to the risk register before hitting share almost certainly
   * means "look at this", and making them say so with a second control would be
   * asking for information they have already given.
   */
  const shareLink = useCallback(
    async (a?: Assessment): Promise<string> => {
      const token = await encodeShare(a ?? current)
      return absoluteUrl({ kind: 'shared', token, tab }, window.location)
    },
    [current, tab],
  )

  const value = useMemo<Store>(
    () => ({
      ready, firstRun, dismissFirstRun,
      view, setView, tab, setTab,
      reviewRequest,
      requestReview: () => {
        setView('workspace')
        setReviewRequest((n) => n + 1)
      },
      shareLink,
      sharedFrom:
        sharedActive && shared
          ? { foreignModel: shared.foreignModel, assessedAt: shared.assessedAt }
          : null,
      assessments, current, dirty, isSaved,
      storage, dataNotice, dismissDataNotice: () => setDataNotice(null),
      update, setInput, rename, setNotes, setDecision,
      canUndo: history.past > 0, canRedo: history.future > 0, undo, redo,
      restoreRevision,
      save, open, create, duplicate, remove, setArchived, importAssessments,
      scenario, startScenario, endScenario, setScenario, applyScenario,
      compareIds, toggleCompare, setCompareIds,
      theme, toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
      toast, notify,
    }),
    [
      ready, firstRun, dismissFirstRun, view, tab, reviewRequest, shareLink, sharedActive, shared,
      assessments, current, dirty, isSaved,
      storage, dataNotice, update, setInput, rename, setNotes, setDecision, history, undo, redo,
      restoreRevision, save, open, create, duplicate, remove, setArchived,
      importAssessments, scenario, startScenario, endScenario, setScenario, applyScenario,
      compareIds, toggleCompare, theme, toast, notify,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
