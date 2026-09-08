import { useEffect, useRef, useState } from 'react'
import type { Assessment } from '../../domain/types'
import { shareSummary } from '../../persistence/link'
import { DEEP_TABS, DEFAULT_TAB } from '../router'
import { useStore } from '../store-context'

/**
 * The share sheet.
 *
 * Copying a link is a one-click action, so this could have been a button and a
 * toast. It is a panel instead because of what the link *is*: not an address
 * that points at a document, but the document itself, written into a URL. A
 * user is entitled to see the thing before they paste it into a channel, know
 * how much of their assessment travelled with it, and read the one sentence
 * that describes who can subsequently read it. None of that fits in a toast.
 *
 * The claim made here is narrow and true: a fragment is not transmitted to the
 * server that hosts the page. It is not a claim that the link is private — the
 * sheet says the opposite in the same breath, because whoever holds the link
 * holds the assessment.
 */
export function ShareSheet({
  assessment,
  onClose,
}: {
  assessment: Assessment
  onClose: () => void
}) {
  const store = useStore()
  // Depend on the builder, not the whole store: the store's identity changes on
  // every unrelated update, and rebuilding the link on each of them would
  // recompress the assessment for nothing.
  const { shareLink, tab } = store
  const opensOn = DEEP_TABS.find((t) => t.id === tab)
  const [url, setUrl] = useState<string | null>(null)
  // What was copied, not whether — so the confirmation retires by itself when
  // the assessment changes underneath it rather than needing an effect to
  // chase it.
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const copied = url !== null && copiedUrl === url
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void shareLink(assessment)
      .then((link) => {
        if (!cancelled) setUrl(link)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [shareLink, assessment])

  // Escape closes it, like every other transient surface in the product.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
    } catch {
      // Clipboard access can be refused outright. Selecting the text is a
      // working answer, and better than a dead button.
      field.current?.select()
      store.notify('Clipboard blocked — the link is selected, copy it with ⌘C.')
    }
  }

  const name = assessment.input.definition.name || 'Untitled workflow'

  return (
    <div className="af-enter panel mb-8 p-5" role="group" aria-label={`Share ${name}`}>
      <div className="mono-sm text-muted flex items-baseline justify-between gap-4">
        <span>Share link</span>
        <div className="flex items-baseline gap-4">
          {url && (
            <span className="text-faint tabular-nums">
              {url.length.toLocaleString('en-US')} characters
            </span>
          )}
          <button className="text-faint hover:text-soft" onClick={onClose}>
            close
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={field}
          // Wraps to its own line rather than shrinking to a keyhole: a link
          // nobody can read is not a link anyone will trust enough to paste.
          className="field min-w-[230px] flex-1 font-[family-name:var(--font-mono)] text-[11.5px]"
          readOnly
          value={url ?? (failed ? 'Could not build a link for this assessment.' : 'Building…')}
          aria-label="Share link"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button className="btn btn-primary shrink-0" onClick={() => void copy()} disabled={!url}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <span role="status" aria-live="polite" className="sr-only">
          {copied ? 'Link copied to the clipboard.' : ''}
        </span>
      </div>

      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <dt className="mono-sm text-faint">Carries</dt>
          <dd className="text-muted m-0 mt-1 text-[12px] leading-[1.5]">
            {shareSummary(assessment)}.
            {/* The link opens where the sender is standing, so say so — an
                invisible behaviour that surprises the sender is not a feature. */}
            {tab !== DEFAULT_TAB && opensOn && (
              <> Opens on <span className="text-soft">{opensOn.label}</span>.</>
            )}
          </dd>
        </div>
        <div>
          <dt className="mono-sm text-faint">Where it lives</dt>
          <dd className="text-muted m-0 mt-1 text-[12px] leading-[1.5]">
            In the link itself, after the <code className="text-soft">#</code> — the part browsers
            never send to a server. Nothing is uploaded, and anyone holding the link can read the
            assessment.
          </dd>
        </div>
      </dl>
    </div>
  )
}
