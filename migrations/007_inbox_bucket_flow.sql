DO $$
DECLARE
  has_bucket_column boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'bucket'
  ) INTO has_bucket_column;

  IF NOT has_bucket_column THEN
    ALTER TABLE public.tickets ADD COLUMN bucket text;
    UPDATE public.tickets SET bucket = 'active' WHERE bucket IS NULL OR btrim(bucket) = '';
  END IF;

  ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS accepted_at timestamptz NULL;
  ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS rejected_at timestamptz NULL;
  ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS rejected_reason text NULL;

  UPDATE public.tickets
  SET bucket = COALESCE(NULLIF(bucket, ''), 'active');

  UPDATE public.tickets
  SET bucket = CASE
    WHEN lower(btrim(bucket)) IN ('inbox', 'neu', 'new') THEN 'inbox'
    WHEN lower(btrim(bucket)) IN ('active', 'aktiv', 'open', 'offen') THEN 'active'
    WHEN lower(btrim(bucket)) IN ('archive', 'archiv', 'closed', 'done') THEN 'archive'
    ELSE 'active'
  END;

  UPDATE public.tickets
  SET bucket = 'inbox'
  WHERE status = 'Neu';

  UPDATE public.tickets
  SET bucket = 'archive'
  WHERE status IN ('Bezahlt', 'Storniert')
    AND bucket <> 'archive';

  UPDATE public.tickets
  SET bucket = 'active'
  WHERE bucket = 'inbox'
    AND status <> 'Neu';

  ALTER TABLE public.tickets ALTER COLUMN bucket SET DEFAULT 'inbox';
  ALTER TABLE public.tickets ALTER COLUMN bucket SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tickets'
      AND c.conname = 'tickets_bucket_check'
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_bucket_check
      CHECK (bucket IN ('inbox', 'active', 'archive'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tickets_bucket_created_desc ON public.tickets(bucket, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_bucket_status ON public.tickets(bucket, status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'scheduled_at'
  ) THEN
    EXECUTE 'create index if not exists idx_tickets_bucket_scheduled_at on public.tickets(bucket, scheduled_at)';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'terminwunsch'
  ) THEN
    EXECUTE 'create index if not exists idx_tickets_bucket_terminwunsch on public.tickets(bucket, terminwunsch)';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'tickets'
        AND policyname = 'tickets_public_insert_inbox'
    ) THEN
      CREATE POLICY tickets_public_insert_inbox
      ON public.tickets
      FOR INSERT
      TO anon
      WITH CHECK (
        bucket = 'inbox'
        AND status = 'Neu'
      );
    END IF;
  END IF;
END
$$;
