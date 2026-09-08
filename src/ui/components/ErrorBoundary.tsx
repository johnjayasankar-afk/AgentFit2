import { Component, type ErrorInfo, type ReactNode } from 'react'
import { download } from '../../persistence/io'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: string | null
  detailsOpen: boolean
}

const DRAFT_KEY = 'agentfit.draft.v1'

/**
 * The last line of defence.
 *
 * A crash in a local-first tool is worse than a crash in a hosted one, because
 * the only copy of the user's work is in the tab that just broke. So the
 * fallback does two things before anything else: it offers the in-progress
 * draft as a download, and it offers to clear the draft — which is the usual
 * cause when a malformed record puts the app into a crash loop.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: null, detailsOpen: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry: this goes to the console the user can read, and nowhere else.
    console.error('AgentFit crashed:', error, info.componentStack)
    this.setState({ info: info.componentStack ?? null })
  }

  private rescueDraft = (): void => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      download(`agentfit-recovered-${new Date().toISOString().slice(0, 10)}.json`, raw)
    } catch {
      /* nothing recoverable */
    }
  }

  private clearDraftAndReload = (): void => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* storage unavailable */
    }
    window.location.reload()
  }

  private hasDraft(): boolean {
    try {
      return localStorage.getItem(DRAFT_KEY) !== null
    } catch {
      return false
    }
  }

  override render(): ReactNode {
    const { error, info, detailsOpen } = this.state
    if (!error) return this.props.children

    return (
      <div className="shell flex min-h-screen flex-col justify-center py-20">
        <div className="max-w-[62ch]">
          <div className="mono text-signal">Unrecoverable error</div>
          <h1 className="display-sm mt-6">AgentFit stopped.</h1>
          <p className="text-soft mt-5 text-[14px] leading-[1.65]">
            Something in the interface threw an exception it could not recover from. Your saved
            assessments are untouched — they live in this browser&rsquo;s database, not in the part
            that failed.
          </p>
          <p className="text-muted mt-4 text-[13px] leading-[1.65]">
            The assessment you were editing is held separately as a draft. Download it before
            reloading if it contains work you have not saved.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <button className="btn btn-primary h-[38px] px-5" onClick={() => window.location.reload()}>
              Reload
            </button>
            {this.hasDraft() && (
              <>
                <button className="btn h-[38px] px-5" onClick={this.rescueDraft}>
                  Download the draft
                </button>
                <button
                  className="btn h-[38px] px-5"
                  onClick={this.clearDraftAndReload}
                  title="Use this if reloading brings you straight back here"
                >
                  Discard the draft and reload
                </button>
              </>
            )}
          </div>

          <div className="border-hair mt-12 border-t pt-5">
            <button
              type="button"
              aria-expanded={detailsOpen}
              className="mono-sm text-faint hover:text-soft transition-colors"
              onClick={() => this.setState({ detailsOpen: !detailsOpen })}
            >
              {detailsOpen ? '− technical detail' : '+ technical detail'}
            </button>
            {detailsOpen && (
              <pre className="mono-plain text-muted sunk thin-scroll mt-4 max-h-[36vh] overflow-auto p-4 text-[11px] leading-[1.6] whitespace-pre-wrap">
                {error.name}: {error.message}
                {error.stack ? `\n\n${error.stack}` : ''}
                {info ? `\n\nComponent stack:${info}` : ''}
              </pre>
            )}
          </div>
        </div>
      </div>
    )
  }
}
