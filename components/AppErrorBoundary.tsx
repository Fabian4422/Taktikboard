"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/chunkLoadRecovery";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Fängt Render-/Chunk-Fehler ab und bietet Reload statt weißem Crash-Screen.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info);
    if (isChunkLoadError(error)) {
      recoverFromChunkLoadError(error);
    }
  }

  private handleReload = () => {
    if (this.state.error && recoverFromChunkLoadError(this.state.error)) return;
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || "Unbekannter Fehler";
    const chunkHint = isChunkLoadError(this.state.error);

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-slate-100">
        <h1 className="text-xl font-semibold">
          {chunkHint ? "App-Update erkannt" : "Etwas ist schiefgelaufen"}
        </h1>
        <p className="max-w-md text-sm text-slate-300">
          {chunkHint
            ? "Nach einem Deployment fehlen veraltete Dateien. Bitte Seite neu laden."
            : message}
        </p>
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
