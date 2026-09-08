import { useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import type { Assessment } from '../../domain/types'
import { assess } from '../../engine/assess'
import { computeGrounding } from '../../engine/grounding'
import { DECISION_STATUS_LABEL } from '../../engine/decision'
import { buildCsv, buildExport, download, parseImport, slug } from '../../persistence/io'
import { copyShareLink } from '../share'
import { useStore } from '../store-context'
import { EmptyState, SectionHead, Segmented, Tag } from '../components/primitives'

type Sort = 'updated' | 'fit' | 'capacity' | 'name'
type Filter = 'active' | 'archived'

function hours(n: number): string {
  return Math.abs(n) < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US')
}

export function Library() {
  const store = useStore()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('updated')
  const [filter, setFilter] = useState<Filter>('active')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return store.assessments
      .filter((a) => (filter === 'archived' ? a.archived : !a.archived))
      .filter((a) =>
        q === ''
          ? true
          : `${a.input.definition.name} ${a.input.definition.description} ${a.input.definition.archetype}`
              .toLowerCase()
              .includes(q),
      )
      .map((a) => {
        const r = assess(a.input)
        return { a, r, grounding: computeGrounding(a, r) }
      })
      .toSorted((x, y) => {
        switch (sort) {
          case 'fit':
            return y.r.fit.score - x.r.fit.score
          case 'capacity':
            return y.r.capacity.netCapacityHours - x.r.capacity.netCapacityHours
          case 'name':
            return (x.a.input.definition.name || '').localeCompare(y.a.input.definition.name || '')
          default:
            return y.a.updatedAt - x.a.updatedAt
        }
      })
  }, [store.assessments, query, sort, filter])

  const activeCount = store.assessments.filter((a) => !a.archived).length

  const onImportFile = async (file: File) => {
    const text = await file.text()
    const existing = new Set(store.assessments.map((a) => a.id))
    const outcome = parseImport(text, existing)
    if (!outcome.ok) {
      setImportNote({ ok: false, text: outcome.error ?? 'Import failed.' })
      return
    }
    await store.importAssessments(outcome.assessments)
    const parts = [`Imported ${outcome.assessments.length} assessment${outcome.assessments.length === 1 ? '' : 's'}`]
    if (outcome.renamed > 0) parts.push(`${outcome.renamed} given a new id to avoid overwriting`)
    if (outcome.foreignVersion.length > 0) {
      parts.push(`scored under ${outcome.foreignVersion.join(', ')} — reopen to rescore under the current model`)
    }
    setImportNote({ ok: true, text: `${parts.join('. ')}.` })
  }

  return (
    <div className="shell py-12">
      <SectionHead
        index="—"
        label="Assessments"
        title="Everything on this device."
        blurb="Assessments are stored locally in this browser. Nothing leaves the device unless you export a file or copy a share link — and a share link carries the assessment inside it."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Import
            </button>
            <button
              type="button"
              className="btn"
              disabled={store.assessments.length === 0}
              onClick={() =>
                download(
                  `agentfit-workspace-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(buildExport(store.assessments), null, 2),
                )
              }
            >
              Export all
            </button>
            <button
              type="button"
              className="btn"
              disabled={rows.length === 0}
              onClick={() =>
                download(
                  `agentfit-summary-${new Date().toISOString().slice(0, 10)}.csv`,
                  buildCsv(rows.map((x) => x.a)),
                  'text/csv',
                )
              }
            >
              CSV summary
            </button>
            <button type="button" className="btn btn-primary" onClick={() => store.create('custom')}>
              New assessment
            </button>
          </div>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImportFile(f)
          e.target.value = ''
        }}
      />

      {importNote && (
        <div
          role="status"
          className={clsx(
            'af-enter mt-6 border-l-2 py-2 pl-4 text-[12.5px] leading-[1.55]',
            importNote.ok ? 'border-l-[var(--ink)] text-soft' : 'border-l-[var(--signal)] text-signal',
          )}
        >
          {importNote.text}
          <button
            type="button"
            className="mono-sm text-faint ml-3 hover:underline"
            onClick={() => setImportNote(null)}
          >
            dismiss
          </button>
        </div>
      )}

      {/* --- controls -------------------------------------------- */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-[220px] flex-1 sm:max-w-[320px]">
          <label htmlFor="lib-search" className="mono-sm text-muted">
            Search
          </label>
          <input
            id="lib-search"
            type="search"
            className="field mt-1"
            placeholder="Workflow name or archetype"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <span className="mono-sm text-muted mb-1.5 block">Sort</span>
            <Segmented<Sort>
              label="Sort assessments"
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'updated', label: 'Updated' },
                { value: 'fit', label: 'Fit' },
                { value: 'capacity', label: 'Capacity' },
                { value: 'name', label: 'Name' },
              ]}
            />
          </div>
          <div>
            <span className="mono-sm text-muted mb-1.5 block">Show</span>
            <Segmented<Filter>
              label="Filter assessments"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* --- rows -------------------------------------------------- */}
      {rows.length === 0 ? (
        <div className="mt-10">
          {store.assessments.length === 0 ? (
            <EmptyState
              label="Empty library"
              title="No assessments on this device yet."
              action={
                <button type="button" className="btn btn-primary" onClick={() => store.create('custom')}>
                  Start an assessment
                </button>
              }
            >
              Saved assessments appear here. You can also import a workspace exported from another
              device.
            </EmptyState>
          ) : (
            <EmptyState
              label={filter === 'archived' ? 'Nothing archived' : 'No matches'}
              title={filter === 'archived' ? 'Nothing has been archived.' : 'Nothing matches that search.'}
            >
              {filter === 'archived'
                ? `${activeCount} active assessment${activeCount === 1 ? '' : 's'} available.`
                : 'Try a different term, or clear the search.'}
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="mt-8">
          <div className="mono-sm text-faint border-hair-strong hidden grid-cols-[auto_2.2fr_repeat(4,minmax(0,1fr))_auto] items-baseline gap-x-5 border-b pb-2 lg:grid">
            <span className="w-[22px]" />
            <span>Workflow</span>
            <span className="text-right">Fit</span>
            <span>Autonomy</span>
            <span>Readiness</span>
            <span className="text-right">Capacity h/wk</span>
            <span className="w-[318px]">Actions</span>
          </div>

          {rows.map(({ a, r, grounding }) => {
            const selected = store.compareIds.includes(a.id)
            const open = store.current.id === a.id
            return (
              <div
                key={a.id}
                className={clsx(
                  'border-hair grid items-baseline gap-x-5 gap-y-2 border-b py-4 transition-colors',
                  'lg:grid-cols-[auto_2.2fr_repeat(4,minmax(0,1fr))_auto]',
                  open && 'bg-[var(--paper-raised)]',
                )}
              >
                <div className="lg:w-[22px]">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-[var(--ink)]"
                      checked={selected}
                      disabled={!selected && store.compareIds.length >= 4}
                      onChange={() => store.toggleCompare(a.id)}
                      aria-label={`Compare ${a.input.definition.name || 'Untitled workflow'}`}
                    />
                    <span className="mono-sm text-faint lg:hidden">Compare</span>
                  </label>
                </div>

                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => store.open(a.id)}
                    className="text-left text-[14px] leading-tight font-medium hover:underline"
                  >
                    {a.input.definition.name || 'Untitled workflow'}
                  </button>
                  <div className="text-faint mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="mono-sm">{a.input.definition.archetype}</span>
                    <span>·</span>
                    <span>{new Date(a.updatedAt).toLocaleDateString()}</span>
                    {a.example && <Tag>Example</Tag>}
                    {a.decision.status !== 'undecided' && (
                      <span
                        className="mono-sm text-soft"
                        title={
                          a.decision.owner
                            ? `${DECISION_STATUS_LABEL[a.decision.status]} — ${a.decision.owner}`
                            : DECISION_STATUS_LABEL[a.decision.status]
                        }
                      >
                        {DECISION_STATUS_LABEL[a.decision.status]}
                      </span>
                    )}
                    {grounding.state === 'provisional' && (
                      <span
                        className="mono-sm text-signal"
                        title={`None of the ${grounding.loadBearing.length} values this result depends on have been reviewed`}
                      >
                        Provisional
                      </span>
                    )}
                    {open && <Tag active>Open</Tag>}
                    {a.modelVersion !== r.modelVersion && <Tag>{a.modelVersion}</Tag>}
                  </div>
                </div>

                <div className="num text-[15px] tabular-nums lg:text-right">
                  <span className="mono-sm text-faint mr-2 lg:hidden">Fit</span>
                  {r.fit.score}
                </div>
                <div className="text-soft text-[12.5px]">
                  <span className="mono-sm text-faint mr-2 lg:hidden">Autonomy</span>
                  {r.autonomy.displayShort}
                </div>
                <div className="text-soft text-[12.5px]">
                  <span className="mono-sm text-faint mr-2 lg:hidden">Readiness</span>
                  {r.readiness.meta.label}
                </div>
                <div className="num text-[13px] tabular-nums lg:text-right">
                  <span className="mono-sm text-faint mr-2 lg:hidden">Capacity</span>
                  {hours(r.capacity.netCapacityHours)}
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 lg:w-[318px] lg:justify-end">
                  <button className="mono-sm text-muted hover:text-[var(--ink)]" onClick={() => store.open(a.id)}>
                    Open
                  </button>
                  <button
                    className="mono-sm text-muted hover:text-[var(--ink)]"
                    onClick={() => void copyShareLink(store, a)}
                    title="Copy a link carrying this whole assessment"
                  >
                    Link
                  </button>
                  <button className="mono-sm text-muted hover:text-[var(--ink)]" onClick={() => void store.duplicate(a.id)}>
                    Duplicate
                  </button>
                  <button
                    className="mono-sm text-muted hover:text-[var(--ink)]"
                    onClick={() =>
                      download(
                        `agentfit-${slug(a.input.definition.name)}.json`,
                        JSON.stringify(buildExport([a]), null, 2),
                      )
                    }
                  >
                    Export
                  </button>
                  <button
                    className="mono-sm text-muted hover:text-[var(--ink)]"
                    onClick={() => void store.setArchived(a.id, !a.archived)}
                  >
                    {a.archived ? 'Restore' : 'Archive'}
                  </button>
                  {confirmDelete === a.id ? (
                    <span className="flex gap-3">
                      <button
                        className="mono-sm text-signal"
                        onClick={() => {
                          void store.remove(a.id)
                          setConfirmDelete(null)
                        }}
                      >
                        Confirm
                      </button>
                      <button className="mono-sm text-faint" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      className="mono-sm text-muted hover:text-signal"
                      onClick={() => setConfirmDelete(a.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {store.compareIds.length > 0 && (
        <div className="border-hair-strong af-enter mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-5">
          <span className="mono text-muted">
            {store.compareIds.length} selected {store.compareIds.length >= 4 && '· maximum reached'}
          </span>
          <div className="flex gap-3">
            <button className="btn btn-quiet" onClick={() => store.setCompareIds([])}>
              Clear
            </button>
            <button
              className="btn btn-primary"
              disabled={store.compareIds.length < 2}
              onClick={() => store.setView('compare')}
            >
              Compare {store.compareIds.length < 2 ? '(select 2+)' : ''}
            </button>
          </div>
        </div>
      )}

      <p className="text-faint border-hair mt-12 border-t pt-5 text-[11.5px] leading-[1.6]">
        Your workflow assessments remain on this device unless you export them or copy a share
        link. No account, no telemetry, no network calls — a share link travels in the part of the
        URL browsers never transmit, so even sharing uploads nothing. What it does mean is that
        anyone holding the link holds the assessment.
      </p>
    </div>
  )
}

export type { Assessment }
