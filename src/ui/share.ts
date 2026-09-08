import type { Assessment } from '../domain/types'
import type { Store } from './store-context'

/**
 * Copy a share link, and say what happened.
 *
 * Used where a full share sheet would be too much furniture — a row action in
 * the library, a command in the palette. The confirmation reports the length
 * because a link that carries a whole assessment is long enough to surprise
 * someone about to paste it somewhere, and because it is the honest signal that
 * the assessment really did travel rather than an address to it.
 */
export async function copyShareLink(store: Store, assessment: Assessment): Promise<void> {
  const name = assessment.input.definition.name || 'Untitled workflow'
  let url: string
  try {
    url = await store.shareLink(assessment)
  } catch {
    store.notify('Could not build a link for that assessment.')
    return
  }

  try {
    await navigator.clipboard.writeText(url)
    store.notify(
      `Link to “${name}” copied — ${url.length.toLocaleString('en-US')} characters carrying the whole assessment.`,
    )
  } catch {
    // Clipboard permission can be refused. Saying so beats a silent no-op.
    store.notify('Clipboard is blocked in this browser — open Share on the assessment to copy it by hand.')
  }
}
