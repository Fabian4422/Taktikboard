"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/chunkLoadRecovery";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  recovering: boolean;
}

/**
 * Fängt Render-Fehler ab. Bei veralteten Chunks: stiller Reload, kein Red-Screen.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    if (isChunkLoadError(error)) {
      return { error, recovering: true };
    }
    return { error, recovering: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info);
    if (isChunkLoadError(error)) {
      recoverFromChunkLoadError(error);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    if (this.state.recovering || isChunkLoadError(this.state.error)) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-slate-200">
          <p className="text-sm">App-Update erkannt — Seite wird neu geladen…</p>
        </div>
      );
    }

    const message = this.state.error.message || "Unbekannter Fehler";

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-slate-100">
        <h1 className="text-xl font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="max-w-lg break-words text-xs text-slate-500">{message}</p>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Seite neu laden
        </button>
      </div>
    );
  }
}
