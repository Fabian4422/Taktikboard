import { TacticsBoard } from "@/components/TacticsBoard";
// Eager: Supabase-Client + Board-Module sofort im initialen Bundle (kein lazy Chunk)
import { supabase } from "@/lib/supabase";
import { ExerciseLibraryModal } from "@/components/tactics-board/ExerciseLibraryModal";
import { FieldCanvas } from "@/components/tactics-board/FieldCanvas";

void supabase;
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
