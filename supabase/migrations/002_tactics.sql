-- Tabelle und Storage für gespeicherte Taktik-Übungen
-- Im Supabase SQL Editor ausführen, falls noch nicht angelegt.

CREATE TABLE IF NOT EXISTS public.tactics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  board_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tactics_created_at ON public.tactics (created_at DESC);

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

INSERT INTO storage.buckets (id, name, public)
VALUES ('tactics-videos', 'tactics-videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can read tactic videos" ON storage.objects;
CREATE POLICY "Public can read tactic videos"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'tactics-videos');

DROP POLICY IF EXISTS "Public can upload tactic videos" ON storage.objects;
CREATE POLICY "Public can upload tactic videos"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'tactics-videos');
