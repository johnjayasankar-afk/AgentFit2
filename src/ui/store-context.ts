import { createContext, useContext } from 'react'
import type { Assessment, AssessmentInput, Decision, DimensionKey } from '../domain/types'
import type { DeepTab } from './router'

export type View = 'workspace' | 'library' | 'compare' | 'method' | 'brief'
export type Theme = 'light' | 'dark'
/** Whether the browser will let us keep anything. */
export type StorageStatus = 'ok' | 'unavailable'

export interface Store {
  ready: boolean
  firstRun: boolean
  dismissFirstRun: () => void

  view: View
  setView: (v: View) => void
  /** The open detail panel on the assessment sheet. Part of the address. */
  tab: DeepTab
  setTab: (t: DeepTab) => void

  /**
   * Ask the assessment sheet to start a guided review.
   *
   * The session itself belongs to the sheet — it is working state, not
   * application state, and it should not survive navigating away. Only the
   * *request* lives here, as a counter, so the command palette can raise one
   * from outside the sheet without the sheet having to publish its internals.
   */
  reviewRequest: number
  requestReview: () => void

  /**
   * A link carrying the whole assessment in its fragment. Defaults to the open
   * one. Asynchronous because the payload is compressed.
   */
  shareLink: (a?: Assessment) => Promise<string>
  /**
   * Set while the open assessment is exactly what a link delivered, and clears
   * on the first edit or save. Null the rest of the time.
   */
  sharedFrom: { foreignModel: boolean; assessedAt: number } | null

  assessments: Assessment[]
  current: Assessment
  dirty: boolean
  isSaved: boolean

  /** Degrades to 'unavailable' in private mode or when quota is refused. */
  storage: StorageStatus
  /** One-off message about migrations or unreadable records, if any. */
  dataNotice: string | null
  dismissDataNotice: () => void

  update: (patch: (a: Assessment) => Assessment, coalesceKey?: string) => void
  /** `touchedKey` accepts a DimensionKey or an economics field key. */
  setInput: (input: AssessmentInput, touchedKey?: DimensionKey | string, coalesceKey?: string) => void
  rename: (name: string) => void
  setNotes: (notes: string) => void
  /** Record what the team decided. Merged into the existing decision. */
  setDecision: (patch: Partial<Decision>) => void

  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  /** Load a saved revision into the editor as an unsaved change. */
  restoreRevision: (at: number) => void

  save: () => Promise<void>
  /** Returns false when the id is no longer present. */
  open: (id: string) => boolean
  create: (archetypeId?: string) => void
  duplicate: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  setArchived: (id: string, archived: boolean) => Promise<void>
  importAssessments: (items: Assessment[]) => Promise<void>

  scenario: AssessmentInput | null
  startScenario: () => void
  endScenario: () => void
  setScenario: (input: AssessmentInput) => void
  applyScenario: () => void

  compareIds: string[]
  toggleCompare: (id: string) => void
  setCompareIds: (ids: string[]) => void

  theme: Theme
  toggleTheme: () => void

  toast: { message: string; id: number } | null
  notify: (message: string) => void
}

export const StoreContext = createContext<Store | null>(null)

/**
 * The context lives in its own module, separate from the provider component.
 * A file that exports both a component and a context loses its identity across
 * a Fast Refresh update, which surfaces as a spurious "must be used inside
 * StoreProvider" during development.
 */
export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
