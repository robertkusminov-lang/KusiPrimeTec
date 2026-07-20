DO $$
DECLARE
  has_tickets boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) INTO has_tickets;

  IF NOT has_tickets THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'bucket'
  ) THEN
    UPDATE public.tickets
    SET bucket = 'inbox'
    WHERE status = 'Neu'
      AND bucket <> 'inbox';

    UPDATE public.tickets
    SET bucket = 'active'
    WHERE status <> 'Neu'
      AND status <> 'Bezahlt'
      AND status <> 'Storniert'
      AND bucket = 'inbox';

    UPDATE public.tickets
    SET bucket = 'archive'
    WHERE status IN ('Bezahlt', 'Storniert')
      AND bucket <> 'archive';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'tickets'
        AND c.conname = 'tickets_neu_inbox_check'
    ) THEN
      ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_neu_inbox_check
      CHECK (
        (status = 'Neu' AND bucket = 'inbox')
        OR (status <> 'Neu' AND bucket <> 'inbox')
      );
    END IF;
  END IF;
END
$$;
