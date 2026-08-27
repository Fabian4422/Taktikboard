-- Supabase-Migration für Taktikboard-Layouts
-- Ausführen im Supabase SQL Editor oder via CLI

CREATE TABLE IF NOT EXISTS tactics_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Unbenanntes Taktikboard',
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  layout JSONB NOT NULL DEFAULT '{"keyframes":[],"fieldWidth":1050,"fieldHeight":680}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tactics_boards_exercise_id ON tactics_boards(exercise_id);

ALTER TABLE tactics_boards ENABLE ROW LEVEL SECURITY;

-- Beispiel-Policy: authentifizierte Nutzer dürfen lesen/schreiben
-- Passe die Policies an dein Auth-Setup an!
CREATE POLICY "Authenticated users can manage tactics boards"
  ON tactics_boards
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
