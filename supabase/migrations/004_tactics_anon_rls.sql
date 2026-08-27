-- Stellt sicher, dass anon/authenticated die Tabelle public.tactics
-- lesen, schreiben, aktualisieren und löschen dürfen (Gast-Bibliothek).
-- Im Supabase SQL Editor ausführen.

ALTER TABLE public.tactics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read tactics" ON public.tactics;
CREATE POLICY "Public can read tactics"
  ON public.tactics
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public can insert tactics" ON public.tactics;
CREATE POLICY "Public can insert tactics"
  ON public.tactics
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update tactics" ON public.tactics;
CREATE POLICY "Public can update tactics"
  ON public.tactics
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete tactics" ON public.tactics;
CREATE POLICY "Public can delete tactics"
  ON public.tactics
  FOR DELETE
  TO anon, authenticated
  USING (true);
