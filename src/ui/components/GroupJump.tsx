import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { DIMENSIONS_BY_GROUP, GROUP_META } from '../../domain/dimensions'
import { DIMENSION_GROUPS, type GroupId } from '../../domain/types'
import { ECONOMICS_KEYS } from '../../engine/grounding'

/**
 * Values a section contains beyond its 1–5 dimensions. Economics is mostly
 * numeric inputs, so counting only its single slider would tell the reader the
 * section was complete when volume and duration had never been touched.
 */
const EXTRA_TRACKED: Partial<Record<GroupId, readonly string[]>> = {
  economics: [ECONOMICS_KEYS.volume, ECONOMICS_KEYS.minutesPerCase],
}

export type SectionId = GroupId | 'define' | 'notes'

/** Short forms for the strip. The sections keep their full names in place. */
const SHORT_LABEL: Record<GroupId, string> = {
  economics: 'Economics',
  structure: 'Structure',
  systems: 'Systems',
  risk: 'Risk',
  oversight: 'Oversight',
}

const SECTIONS: { id: SectionId; index: string; label: string }[] = [
  { id: 'define', index: '00', label: 'Define' },
  ...DIMENSION_GROUPS.map((g) => ({
    id: g as SectionId,
    index: GROUP_META[g].index,
    label: SHORT_LABEL[g],
  })),
  { id: 'notes', index: '06', label: 'Notes' },
]

export function anchorFor(id: SectionId): string {
  return id === 'define' ? 'group-define' : id === 'notes' ? 'group-notes' : `group-${id}`
}

/** Where the strip sits, in pixels from the top of the viewport. */
export const STRIP_OFFSET = 132

/**
 * Which section the reader is in, given each heading's distance from the top of
 * the viewport. The last heading to have passed under the strip wins; before any
 * has, the first section does.
 *
 * Pure so it can be tested without a scroll position, a layout, or a browser.
 */
export function activeSection(
  headings: readonly { id: string; top: number }[],
  offset = STRIP_OFFSET,
): SectionId {
  let current: SectionId = 'define'
  for (const heading of headings) {
    if (heading.top > offset) break
    const found = SECTIONS.find((s) => anchorFor(s.id) === heading.id)
    if (found) current = found.id
  }
  return current
}

/**
 * A jump strip for the assessment column.
 *
 * The form runs to four thousand pixels, which is the right amount of space for
 * twenty dimensions that each deserve a definition and an anchor — but it left
 * no way to answer "where am I" or "what have I not looked at". Each section
 * carries its own review count, so the gaps in an assessment are visible without
 * scrolling through it.
 */
export function GroupJump({ touched }: { touched: string[] }) {
  const [active, setActive] = useState<SectionId>('define')

  useEffect(() => {
    const targets = SECTIONS.map((s) => document.getElementById(anchorFor(s.id))).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (targets.length === 0) return

    // The last heading to have passed under the strip is the section the reader
    // is in. Seven rect reads per scroll event is cheap enough not to need
    // throttling, and doing it directly keeps the highlight correct in tabs
    // where animation frames are throttled or never delivered.
    const update = () => {
      const current = activeSection(
        targets.map((el) => ({ id: el.id, top: el.getBoundingClientRect().top })),
      )
      setActive((previous) => (previous === current ? previous : current))
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const reviewed = (id: SectionId): { done: number; total: number } | null => {
    if (id === 'define' || id === 'notes') return null
    const keys = [
      ...DIMENSIONS_BY_GROUP[id].map((d) => d.key as string),
      ...(EXTRA_TRACKED[id] ?? []),
    ]
    return { done: keys.filter((k) => touched.includes(k)).length, total: keys.length }
  }

  return (
    <nav
      aria-label="Assessment sections"
      className="thin-scroll -mx-1 flex gap-0 overflow-x-auto px-1"
    >
      {SECTIONS.map((s) => {
        const count = reviewed(s.id)
        const complete = count !== null && count.done === count.total
        const isActive = active === s.id
        return (
          <button
            key={s.id}
            type="button"
            aria-current={isActive ? 'true' : undefined}
            onClick={() => {
              document
                .getElementById(anchorFor(s.id))
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className={clsx(
              'group relative shrink-0 py-2 pr-5 text-left transition-colors',
              isActive ? 'text-[var(--ink)]' : 'text-faint hover:text-soft',
            )}
          >
            <span className="mono-sm block tabular-nums">
              {s.index}
              <span className="ml-1.5">{s.label}</span>
            </span>
            <span className="mt-1.5 flex items-center gap-[3px]" aria-hidden="true">
              {count === null ? (
                <span
                  className={clsx(
                    'block h-px w-full min-w-[26px]',
                    isActive ? 'bg-[var(--ink)]' : 'bg-[var(--hair-strong)]',
                  )}
                />
              ) : (
                Array.from({ length: count.total }, (_, i) => (
                  <span
                    key={i}
                    className={clsx(
                      'block h-[3px] w-[7px]',
                      i < count.done
                        ? complete
                          ? 'bg-[var(--ink)]'
                          : 'bg-[var(--signal)]'
                        : 'bg-[var(--hair-strong)]',
                    )}
                  />
                ))
              )}
            </span>
            {count !== null && (
              <span className="sr-only">
                {count.done} of {count.total} values reviewed
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
