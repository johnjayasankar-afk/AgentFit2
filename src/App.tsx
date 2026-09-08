import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { assess } from './engine/assess'
import { computeGrounding } from './engine/grounding'
import { buildExport, download, slug } from './persistence/io'
import { StoreProvider } from './ui/state'
import { useStore, type View } from './ui/store-context'
import { CommandPalette, type Command } from './ui/components/CommandPalette'
import { ErrorBoundary } from './ui/components/ErrorBoundary'
import { copyShareLink } from './ui/share'
import { DEEP_TABS } from './ui/router'
import { Workspace } from './ui/views/Workspace'
import { Library } from './ui/views/Library'
import { FirstRun } from './ui/views/FirstRun'

// Split out of the initial bundle: none of these are on the path to a first
// assessment, and the methodology reference in particular is mostly prose.
const Compare = lazy(() => import('./ui/views/Compare').then((m) => ({ default: m.Compare })))
const Methodology = lazy(() =>
  import('./ui/views/Methodology').then((m) => ({ default: m.Methodology })),
)
const Brief = lazy(() => import('./ui/views/Brief').then((m) => ({ default: m.Brief })))

const NAV: { id: View; label: string }[] = [
  { id: 'workspace', label: 'Assess' },
  { id: 'library', label: 'Assessments' },
  { id: 'compare', label: 'Compare' },
  { id: 'method', label: 'Method' },
]

function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null
  if (!node) return false
  const tag = node.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable
}

function NavItems() {
  const store = useStore()
  return (
    <>
      {NAV.map((n) => {
        const active = store.view === n.id
        const count = n.id === 'compare' ? store.compareIds.length : 0
        return (
          <button
            key={n.id}
            onClick={() => store.setView(n.id)}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'mono-sm relative px-3 py-2.5 whitespace-nowrap transition-colors',
              active ? 'text-[var(--ink)]' : 'text-faint hover:text-soft',
            )}
          >
            {n.label}
            {count > 0 && <span className="text-signal ml-1.5 tabular-nums">{count}</span>}
            {active && (
              <span
                className="absolute inset-x-3 bottom-0 h-[1.5px] bg-[var(--ink)]"
                aria-hidden="true"
              />
            )}
          </button>
        )
      })}
    </>
  )
}

function Header() {
  const store = useStore()
  const result = useMemo(() => assess(store.current.input), [store.current.input])
  const name = store.current.input.definition.name || 'Untitled workflow'

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hair)] bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] backdrop-blur-[10px] no-print">
      <div className="shell flex h-[57px] items-center justify-between gap-4">
        <button
          className="flex shrink-0 items-center gap-3"
          onClick={() => store.setView('workspace')}
          aria-label="AgentFit — go to assessment"
        >
          <span
            className="mono-sm grid h-[24px] w-[24px] shrink-0 place-items-center border border-[var(--ink)] tracking-normal"
            aria-hidden="true"
          >
            AF
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-[13px] leading-none font-medium tracking-[-0.02em]">
              AgentFit
            </span>
            <span className="mono-sm text-faint mt-[3px] block">When should a workflow get an agent?</span>
          </span>
        </button>

        {/* On wide screens the nav sits inline; below md it moves to its own row. */}
        <nav aria-label="Primary" className="hidden min-w-0 items-center gap-1 xl:flex">
          <NavItems />
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="mono-sm text-faint hidden max-w-[210px] truncate 2xl:block"
            title={`${name} — fit ${result.fit.score}, ${result.autonomy.displayName}`}
          >
            {name} · {result.fit.score} · {result.autonomy.displayShort}
            {store.dirty && <span className="text-signal ml-1.5">●</span>}
            {!store.isSaved && <span className="text-faint ml-1.5">unsaved</span>}
          </span>
          <button
            className="btn btn-quiet"
            onClick={store.toggleTheme}
            aria-label={`Switch to ${store.theme === 'light' ? 'dark' : 'light'} theme`}
            title="Toggle theme"
          >
            {store.theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button className="btn" onClick={() => store.setView('brief')}>
            Brief
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void store.save()}
            disabled={store.storage === 'unavailable'}
            title={
              store.storage === 'unavailable'
                ? 'Local storage is blocked in this browser — export instead'
                : 'Save to this device (⌘S)'
            }
          >
            {store.dirty || !store.isSaved ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="border-hair shell -mt-px border-t xl:hidden">
        <nav aria-label="Primary" className="thin-scroll flex items-center gap-1 overflow-x-auto">
          <NavItems />
        </nav>
      </div>
    </header>
  )
}

/**
 * What arrived in a link.
 *
 * Provenance is the obvious half — this did not come from your device, and
 * nothing is saved yet. The half that matters more is how much of it the sender
 * actually reviewed. A recommendation assembled from presets and one reviewed
 * by a team who know the workflow look identical once they are in a URL, and
 * the recipient has no other way to tell them apart. Saying so here costs one
 * clause and is the single most useful thing this banner can carry.
 */
function SharedNotice({ from }: { from: NonNullable<ReturnType<typeof useStore>['sharedFrom']> }) {
  const { current, save } = useStore()
  const grounding = useMemo(() => computeGrounding(current, assess(current.input)), [current])

  const provenance =
    grounding.state === 'provisional'
      ? `none of the ${grounding.loadBearing.length} values this recommendation rests on had been reviewed`
      : grounding.state === 'grounded'
        ? `every value this recommendation rests on had been reviewed`
        : `${grounding.reviewedCount} of the ${grounding.loadBearing.length} values this recommendation rests on had been reviewed`

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 text-[12.5px] leading-[1.55]">
      <span className="mono-sm text-signal shrink-0">Shared with you</span>
      <span className="text-soft max-w-[78ch]">
        This arrived in a link rather than from this device. It was last worked on{' '}
        <span className="tabular-nums">
          {new Date(from.assessedAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
        , and at that point{' '}
        <b className={grounding.state === 'provisional' ? 'text-signal font-medium' : 'font-medium'}>
          {provenance}
        </b>
        . Nothing is saved here until you say so.
        {from.foreignModel && (
          <span className="text-signal">
            {' '}
            It was also scored under different model weights than this build, so the derived figures
            here will not match the sender’s exactly.
          </span>
        )}
      </span>
      <button className="btn btn-quiet ml-auto shrink-0" onClick={() => void save()}>
        Save a copy
      </button>
    </div>
  )
}

/**
 * Conditions the user needs to know about before they lose work: storage the
 * browser will not give us, and records this build could not read.
 */
function Banners() {
  const store = useStore()
  if (store.storage === 'ok' && !store.dataNotice && !store.sharedFrom) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print border-b border-[var(--hair)] bg-[var(--paper-sunk)]"
    >
      <div className="shell py-3">
        {store.sharedFrom && <SharedNotice from={store.sharedFrom} />}
        {store.storage === 'unavailable' && (
          <p className="text-signal flex flex-wrap items-baseline gap-x-3 text-[12.5px] leading-[1.55]">
            <span className="mono-sm shrink-0">Storage unavailable</span>
            <span className="text-soft">
              This browser is blocking local storage, so assessments cannot be saved on this device.
              Everything else works — export any assessment you want to keep.
            </span>
          </p>
        )}
        {store.dataNotice && (
          <p className="text-soft flex flex-wrap items-baseline gap-x-3 text-[12.5px] leading-[1.55]">
            <span className="mono-sm text-faint shrink-0">Library</span>
            <span>{store.dataNotice}</span>
            <button className="mono-sm text-faint hover:text-soft" onClick={store.dismissDataNotice}>
              dismiss
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Holds roughly a screen of height while a lazy view arrives, so the footer
 * does not jump to the top of the window and back on every view change.
 */
function ViewLoading() {
  return (
    <div className="shell flex min-h-[68vh] items-start py-24">
      <span className="mono text-faint" role="status">
        Loading…
      </span>
    </div>
  )
}

function Toast() {
  const store = useStore()
  if (!store.toast) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="af-enter panel no-print fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-5 py-3 text-[12.5px] shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
    >
      {store.toast.message}
    </div>
  )
}

function Shell() {
  const store = useStore()
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Rebuilt per render: the list is short, and memoising it against the whole
  // store defeats the compiler's own memoisation without buying anything.
  const commands = ((): Command[] => {
    const go = (v: View, label: string): Command => ({
      id: `go-${v}`,
      group: 'Go to',
      label,
      run: () => store.setView(v),
    })
    return [
      go('workspace', 'Assessment'),
      go('library', 'Assessments library'),
      go('compare', 'Compare workflows'),
      go('method', 'Methodology'),
      go('brief', 'Decision brief'),
      // The detail panels are addressable, so they belong in the palette too —
      // six tabs behind a horizontal scroller are otherwise hard to reach.
      ...DEEP_TABS.map<Command>((t) => ({
        id: `tab-${t.id}`,
        group: 'Go to',
        label: t.label,
        run: () => {
          store.setView('workspace')
          store.setTab(t.id)
        },
      })),
      { id: 'save', group: 'Action', label: 'Save assessment', hint: '⌘S', run: () => void store.save() },
      { id: 'undo', group: 'Action', label: 'Undo', hint: '⌘Z', run: store.undo },
      { id: 'redo', group: 'Action', label: 'Redo', hint: '⇧⌘Z', run: store.redo },
      { id: 'new', group: 'Action', label: 'New assessment', run: () => store.create('custom') },
      {
        id: 'review',
        group: 'Action',
        label: 'Review the values this recommendation rests on',
        run: store.requestReview,
      },
      {
        id: 'share',
        group: 'Action',
        label: 'Copy a share link for this assessment',
        run: () => void copyShareLink(store, store.current),
      },
      {
        id: 'export',
        group: 'Action',
        label: 'Export this assessment as JSON',
        run: () =>
          download(
            `agentfit-${slug(store.current.input.definition.name)}.json`,
            JSON.stringify(buildExport([store.current]), null, 2),
          ),
      },
      {
        id: 'scenario',
        group: 'Action',
        label: store.scenario ? 'Discard scenario' : 'Start a scenario',
        run: () => {
          store.setView('workspace')
          if (store.scenario) store.endScenario()
          else store.startScenario()
        },
      },
      { id: 'print', group: 'Action', label: 'Print decision brief', run: () => { store.setView('brief'); requestAnimationFrame(() => window.print()) } },
      {
        id: 'theme',
        group: 'Action',
        label: `Switch to ${store.theme === 'light' ? 'dark' : 'light'} theme`,
        run: store.toggleTheme,
      },
      ...store.assessments
        .filter((a) => !a.archived)
        .slice(0, 8)
        .map<Command>((a) => ({
          id: `open-${a.id}`,
          group: 'Open',
          label: a.input.definition.name || 'Untitled workflow',
          hint: a.example ? 'example' : undefined,
          run: () => store.open(a.id),
        })),
    ]
  })()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void store.save()
        return
      }
      if (mod && e.key.toLowerCase() === 'z' && !isTypingTarget(e.target)) {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (e.key === 'Escape' && store.scenario && !isTypingTarget(e.target)) {
        store.endScenario()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store])

  // Warn before losing unsaved work on close.
  useEffect(() => {
    if (!store.dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [store.dirty])

  if (!store.ready) {
    return (
      <div className="shell flex min-h-screen items-center">
        <span className="mono text-faint">Loading local assessments…</span>
      </div>
    )
  }

  if (store.firstRun) {
    return (
      <>
        <FirstRun />
        <Toast />
      </>
    )
  }

  return (
    <>
      <a
        href="#main"
        className="btn no-print sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-[var(--paper)]"
      >
        Skip to content
      </a>
      <Header />
      <Banners />
      <main id="main" tabIndex={-1}>
        {store.view === 'workspace' && <Workspace />}
        {store.view === 'library' && <Library />}
        <Suspense fallback={<ViewLoading />}>
          {store.view === 'compare' && <Compare />}
          {store.view === 'method' && <Methodology />}
          {store.view === 'brief' && <Brief />}
        </Suspense>
      </main>
      <footer className="border-hair no-print border-t">
        <div className="shell text-faint flex flex-wrap items-center justify-between gap-4 py-6 text-[11px]">
          <span className="mono-sm">AgentFit · {assess(store.current.input).modelVersion}</span>
          <span className="max-w-[62ch]">
            Supports workflow discovery and architecture decisions. Does not authorise production
            deployment.
          </span>
          <button className="mono-sm hover:text-soft" onClick={() => setPaletteOpen(true)}>
            ⌘K commands
          </button>
        </div>
      </footer>
      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      <Toast />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </ErrorBoundary>
  )
}
