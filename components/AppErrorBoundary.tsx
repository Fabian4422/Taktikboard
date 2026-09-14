"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Fängt Render-Fehler ab — ohne automatischen Reload.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleDismiss = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || "Unbekannter Fehler";

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-slate-100">
        <h1 className="text-xl font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="max-w-lg break-words text-sm text-slate-300">{message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={this.handleDismiss}
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            Weiter versuchen
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }
}
