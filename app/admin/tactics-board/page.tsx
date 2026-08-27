import { TacticsBoard } from "@/components/TacticsBoard";

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
