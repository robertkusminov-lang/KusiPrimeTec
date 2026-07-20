DO $$
DECLARE
  has_ticket_documents boolean;
  has_doc_type boolean;
  has_document_type boolean;
  has_dokument_typ boolean;
  has_type boolean;
  has_typ boolean;
  doc_type_check_def text;
  doc_type_pref text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ticket_documents'
  ) INTO has_ticket_documents;

  IF NOT has_ticket_documents THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ticket_documents' AND column_name = 'doc_type'
  ) INTO has_doc_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ticket_documents' AND column_name = 'document_type'
  ) INTO has_document_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ticket_documents' AND column_name = 'dokument_typ'
  ) INTO has_dokument_typ;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ticket_documents' AND column_name = 'type'
  ) INTO has_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ticket_documents' AND column_name = 'typ'
  ) INTO has_typ;

  SELECT pg_get_constraintdef(c.oid)
  INTO doc_type_check_def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'ticket_documents'
    AND c.conname = 'ticket_documents_doc_type_check'
  LIMIT 1;

  doc_type_pref := CASE
    WHEN coalesce(doc_type_check_def, '') ilike '%offer%' OR coalesce(doc_type_check_def, '') ilike '%invoice%' THEN 'en'
    WHEN coalesce(doc_type_check_def, '') ilike '%angebot%' OR coalesce(doc_type_check_def, '') ilike '%rechnung%' THEN 'de'
    ELSE 'en'
  END;

  IF has_doc_type THEN
    IF doc_type_pref = 'de' THEN
      EXECUTE $sql$
        update public.ticket_documents td
        set doc_type = case
          when lower(
            coalesce(
              nullif(td.doc_type, ''),
              nullif(to_jsonb(td)->>'dokument_typ', ''),
              nullif(to_jsonb(td)->>'document_type', ''),
              nullif(to_jsonb(td)->>'type', ''),
              nullif(to_jsonb(td)->>'typ', ''),
              case
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'ANG-%' then 'angebot'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RAP-%' then 'rapport'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RE-%' then 'rechnung'
                else ''
              end
            )
          ) in ('angebot', 'offer', 'ang') then 'angebot'
          when lower(
            coalesce(
              nullif(td.doc_type, ''),
              nullif(to_jsonb(td)->>'dokument_typ', ''),
              nullif(to_jsonb(td)->>'document_type', ''),
              nullif(to_jsonb(td)->>'type', ''),
              nullif(to_jsonb(td)->>'typ', ''),
              case
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'ANG-%' then 'angebot'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RAP-%' then 'rapport'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RE-%' then 'rechnung'
                else ''
              end
            )
          ) in ('rapport', 'report', 'rap') then 'rapport'
          when lower(
            coalesce(
              nullif(td.doc_type, ''),
              nullif(to_jsonb(td)->>'dokument_typ', ''),
              nullif(to_jsonb(td)->>'document_type', ''),
              nullif(to_jsonb(td)->>'type', ''),
              nullif(to_jsonb(td)->>'typ', ''),
              case
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'ANG-%' then 'angebot'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RAP-%' then 'rapport'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RE-%' then 'rechnung'
                else ''
              end
            )
          ) in ('rechnung', 'invoice', 'inv', 're') then 'rechnung'
          else 'angebot'
        end
      $sql$;
    ELSE
      EXECUTE $sql$
        update public.ticket_documents td
        set doc_type = case
          when lower(
            coalesce(
              nullif(td.doc_type, ''),
              nullif(to_jsonb(td)->>'dokument_typ', ''),
              nullif(to_jsonb(td)->>'document_type', ''),
              nullif(to_jsonb(td)->>'type', ''),
              nullif(to_jsonb(td)->>'typ', ''),
              case
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'ANG-%' then 'angebot'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RAP-%' then 'rapport'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RE-%' then 'rechnung'
                else ''
              end
            )
          ) in ('angebot', 'offer', 'ang') then 'offer'
          when lower(
            coalesce(
              nullif(td.doc_type, ''),
              nullif(to_jsonb(td)->>'dokument_typ', ''),
              nullif(to_jsonb(td)->>'document_type', ''),
              nullif(to_jsonb(td)->>'type', ''),
              nullif(to_jsonb(td)->>'typ', ''),
              case
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'ANG-%' then 'angebot'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RAP-%' then 'rapport'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RE-%' then 'rechnung'
                else ''
              end
            )
          ) in ('rapport', 'report', 'rap') then 'report'
          when lower(
            coalesce(
              nullif(td.doc_type, ''),
              nullif(to_jsonb(td)->>'dokument_typ', ''),
              nullif(to_jsonb(td)->>'document_type', ''),
              nullif(to_jsonb(td)->>'type', ''),
              nullif(to_jsonb(td)->>'typ', ''),
              case
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'ANG-%' then 'angebot'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RAP-%' then 'rapport'
                when coalesce(to_jsonb(td)->>'dokument_nummer', '') ilike 'RE-%' then 'rechnung'
                else ''
              end
            )
          ) in ('rechnung', 'invoice', 'inv', 're') then 'invoice'
          else 'offer'
        end
      $sql$;
    END IF;
  END IF;

  IF has_dokument_typ THEN
    EXECUTE $sql$
      update public.ticket_documents td
      set dokument_typ = case
        when lower(
          coalesce(
            nullif(td.dokument_typ, ''),
            nullif(to_jsonb(td)->>'doc_type', ''),
            nullif(to_jsonb(td)->>'document_type', ''),
            nullif(to_jsonb(td)->>'type', ''),
            nullif(to_jsonb(td)->>'typ', '')
          )
        ) in ('angebot', 'offer', 'ang') then 'angebot'
        when lower(
          coalesce(
            nullif(td.dokument_typ, ''),
            nullif(to_jsonb(td)->>'doc_type', ''),
            nullif(to_jsonb(td)->>'document_type', ''),
            nullif(to_jsonb(td)->>'type', ''),
            nullif(to_jsonb(td)->>'typ', '')
          )
        ) in ('rapport', 'report', 'rap') then 'rapport'
        when lower(
          coalesce(
            nullif(td.dokument_typ, ''),
            nullif(to_jsonb(td)->>'doc_type', ''),
            nullif(to_jsonb(td)->>'document_type', ''),
            nullif(to_jsonb(td)->>'type', ''),
            nullif(to_jsonb(td)->>'typ', '')
          )
        ) in ('rechnung', 'invoice', 'inv', 're') then 'rechnung'
        else 'angebot'
      end
    $sql$;
  END IF;

  IF has_document_type AND has_doc_type THEN
    EXECUTE 'update public.ticket_documents set document_type = coalesce(document_type, doc_type)';
  END IF;

  IF has_type AND has_dokument_typ THEN
    EXECUTE 'update public.ticket_documents set type = coalesce(type, dokument_typ)';
  END IF;

  IF has_typ AND has_dokument_typ THEN
    EXECUTE 'update public.ticket_documents set typ = coalesce(typ, dokument_typ)';
  END IF;
END
$$;
