import type { ReactNode } from "react";
import { Component } from "react";

interface State {
  message: string | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      message: error instanceof Error ? error.message : "Something went wrong.",
    };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="sheet sheet-sm">
          <p className="sys">AgentFit</p>
          <h1 className="fit-heading page-title">
            The instrument failed to render
          </h1>
          <p className="lede page-lede">
            Assessments on this device were not modified. Reload, or export a backup from another session if you
            have one.
          </p>
          <p className="hint mt-3">
            {this.state.message}
          </p>
          <div className="toolbar">
            <button type="button" className="ink-btn" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
