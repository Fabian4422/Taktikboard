import { GoToBoardLink } from "@/components/GoToBoardLink";
import { SavedTacticsList } from "@/components/SavedTacticsList";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Taktikboard</h1>
      <p className="max-w-md text-center text-slate-400">
        Visualisiere, animiere und exportiere Fußball-Übungen auf einem interaktiven 2D-Spielfeld.
      </p>
      <GoToBoardLink />
      <SavedTacticsList />
    </main>
  );
}
