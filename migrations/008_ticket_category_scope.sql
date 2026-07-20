DO $$
DECLARE
  has_objekt_adresse boolean;
  has_object_address boolean;
  has_object_zip boolean;
  has_object_city boolean;
  source_address_col text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS subkategorie text NULL;
  ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS objekt_strasse text NULL;
  ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS objekt_plz text NULL;
  ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS objekt_ort text NULL;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'objekt_adresse'
  ) INTO has_objekt_adresse;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'object_address'
  ) INTO has_object_address;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'object_zip'
  ) INTO has_object_zip;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'object_city'
  ) INTO has_object_city;

  IF has_objekt_adresse THEN
    source_address_col := 'objekt_adresse';
  ELSIF has_object_address THEN
    source_address_col := 'object_address';
  ELSE
    source_address_col := NULL;
  END IF;

  IF source_address_col IS NOT NULL THEN
    EXECUTE format(
      $sql$
      UPDATE public.tickets
      SET objekt_strasse = COALESCE(objekt_strasse, NULLIF(split_part(%1$I, ',', 1), ''))
      WHERE COALESCE(objekt_strasse, '') = ''
        AND COALESCE(%1$I, '') <> ''
      $sql$,
      source_address_col
    );

    EXECUTE format(
      $sql$
      UPDATE public.tickets
      SET objekt_plz = COALESCE(objekt_plz, substring(%1$I from '([0-9]{5})'))
      WHERE COALESCE(objekt_plz, '') = ''
        AND COALESCE(%1$I, '') <> ''
      $sql$,
      source_address_col
    );

    EXECUTE format(
      $sql$
      UPDATE public.tickets
      SET objekt_ort = COALESCE(objekt_ort, NULLIF(regexp_replace(%1$I, '.*[0-9]{5}[[:space:]]*', ''), ''))
      WHERE COALESCE(objekt_ort, '') = ''
        AND COALESCE(%1$I, '') <> ''
      $sql$,
      source_address_col
    );
  END IF;

  IF has_object_zip THEN
    UPDATE public.tickets
    SET objekt_plz = COALESCE(objekt_plz, NULLIF(object_zip, ''))
    WHERE COALESCE(objekt_plz, '') = '';
  END IF;

  IF has_object_city THEN
    UPDATE public.tickets
    SET objekt_ort = COALESCE(objekt_ort, NULLIF(object_city, ''))
    WHERE COALESCE(objekt_ort, '') = '';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'kategorie'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tickets_kategorie_subkategorie ON public.tickets(kategorie, subkategorie)';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'category'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tickets_category_subkategorie ON public.tickets(category, subkategorie)';
  END IF;
END
$$;
