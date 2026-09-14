import { TacticsBoard } from "@/components/TacticsBoard";
// Statisch mit der Seite bundlen — kein lazy/dynamic Nachladen zur Laufzeit
import { ExerciseLibraryModal } from "@/components/tactics-board/ExerciseLibraryModal";
import { FieldCanvas } from "@/components/tactics-board/FieldCanvas";

void ExerciseLibraryModal;
void FieldCanvas;

interface PageProps {
  searchParams: Promise<{ exerciseId?: string; name?: string }>;
}

export default async function TacticsBoardPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <TacticsBoard
      exerciseId={params.exerciseId}
      initialName={params.name}
    />
  );
}
