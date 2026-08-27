-- Erlaubt das Aktualisieren bestehender Übungen (für erneutes Speichern)

DROP POLICY IF EXISTS "Public can update tactics" ON public.tactics;
CREATE POLICY "Public can update tactics"
  ON public.tactics
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
