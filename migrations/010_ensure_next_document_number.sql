DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'document_counters'
  ) THEN
    CREATE TABLE public.document_counters (
      prefix text PRIMARY KEY,
      year integer NOT NULL,
      next_value integer NOT NULL DEFAULT 1,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  ELSE
    ALTER TABLE public.document_counters ADD COLUMN IF NOT EXISTS prefix text;
    ALTER TABLE public.document_counters ADD COLUMN IF NOT EXISTS year integer;
    ALTER TABLE public.document_counters ADD COLUMN IF NOT EXISTS next_value integer NOT NULL DEFAULT 1;
    ALTER TABLE public.document_counters ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_counters' AND column_name = 'prefix'
  ) THEN
    BEGIN
      ALTER TABLE public.document_counters ADD PRIMARY KEY (prefix);
    EXCEPTION
      WHEN duplicate_table THEN NULL;
      WHEN duplicate_object THEN NULL;
      WHEN invalid_table_definition THEN NULL;
    END;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.next_document_number(p_prefix text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  y integer := extract(year from now())::integer;
  k text := upper(coalesce(trim(p_prefix), 'DOC'));
  v integer;
BEGIN
  INSERT INTO public.document_counters (prefix, year, next_value)
  VALUES (k, y, 1)
  ON CONFLICT (prefix) DO UPDATE
    SET year = excluded.year,
        next_value = CASE
          WHEN document_counters.year = excluded.year THEN document_counters.next_value
          ELSE 1
        END,
        updated_at = now();

  UPDATE public.document_counters
  SET next_value = next_value + 1,
      updated_at = now()
  WHERE prefix = k
  RETURNING next_value - 1 INTO v;

  RETURN format('%s-%s-%s', k, y, lpad(v::text, 4, '0'));
END;
$$;
