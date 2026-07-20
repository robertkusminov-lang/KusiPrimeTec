DO $$
DECLARE
  has_tickets boolean;
  has_kategorie boolean;
  has_category boolean;
  r record;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) INTO has_tickets;

  IF NOT has_tickets THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'kategorie'
  ) INTO has_kategorie;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'category'
  ) INTO has_category;

  -- Alte Kategorie-Checks entfernen (inkonsistente Legacy-Varianten)
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tickets'
      AND c.contype = 'c'
      AND (
        c.conname IN ('tickets_category_check', 'check_category', 'tickets_kategorie_check')
        OR pg_get_constraintdef(c.oid) ILIKE '%kategorie%'
        OR pg_get_constraintdef(c.oid) ILIKE '%category%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  IF has_kategorie THEN
    UPDATE public.tickets
    SET kategorie = CASE
      WHEN kategorie IS NULL OR btrim(kategorie) = '' THEN 'Sonstiges'
      WHEN lower(replace(replace(replace(replace(replace(btrim(kategorie), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), ' ', '_')) IN ('elektro') THEN 'Elektro'
      WHEN lower(replace(replace(replace(replace(replace(btrim(kategorie), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), ' ', '_')) IN ('heizung') THEN 'Heizung'
      WHEN lower(replace(replace(replace(replace(replace(btrim(kategorie), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), ' ', '_')) IN ('sanitaer', 'sanitar') THEN 'Sanitaer'
      WHEN lower(replace(replace(replace(replace(replace(btrim(kategorie), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), ' ', '_')) IN ('objekttechnik', 'gebaeudetechnik') THEN 'Objekttechnik'
      WHEN lower(replace(replace(replace(replace(replace(btrim(kategorie), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), ' ', '_')) IN ('koordination', 'projektkoordination') THEN 'Koordination'
      ELSE 'Sonstiges'
    END;
  END IF;

  IF has_category AND has_kategorie THEN
    UPDATE public.tickets
    SET category = kategorie;
  ELSIF has_category THEN
    UPDATE public.tickets
    SET category = CASE
      WHEN category IS NULL OR btrim(category) = '' THEN 'Sonstiges'
      WHEN lower(replace(replace(replace(replace(replace(btrim(category), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), ' ', '_')) IN ('elektro') THEN 'Elektro'
      WHEN lower(replace(replace(replace(replace(replace(btrim(category), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), ' ', '_')) IN ('heizung') THEN 'Heizung'
      WHEN lower(replace(replace(replace(replace(replace(btrim(category), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), ' ', '_')) IN ('sanitaer', 'sanitar') THEN 'Sanitaer'
      WHEN lower(replace(replace(replace(replace(replace(btrim(category), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), ' ', '_')) IN ('objekttechnik', 'gebaeudetechnik') THEN 'Objekttechnik'
      WHEN lower(replace(replace(replace(replace(replace(btrim(category), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), ' ', '_')) IN ('koordination', 'projektkoordination') THEN 'Koordination'
      ELSE 'Sonstiges'
    END;
  END IF;

  IF has_kategorie THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_category_check
      CHECK (kategorie IN ('Elektro', 'Heizung', 'Sanitaer', 'Sanitär', 'Objekttechnik', 'Koordination', 'Sonstiges'));
  ELSIF has_category THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_category_check
      CHECK (category IN ('Elektro', 'Heizung', 'Sanitaer', 'Sanitär', 'Objekttechnik', 'Koordination', 'Sonstiges'));
  END IF;
END
$$;

