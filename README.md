# KusiPrimeTec – Technischer Immobilienservice & Projektkoordination

Produktionsreifes Monorepo für Website, Ticket-System, Admin-Backoffice, Dokumente (PDF), Outlook-Integration und Analytics.

## Architektur

```text
Kunde (Browser)
  -> app (React + TypeScript + Tailwind)
  -> Supabase Edge Functions (api/functions)
  -> PostgreSQL + Storage (Supabase)

Admin (Browser)
  -> app/admin (Auth + Dashboard)
  -> Edge Functions (Admin-Endpoints, Dokumente, Graph)
  -> PostgreSQL (RLS, Audit, KPI, Analytics)
  -> Microsoft Graph API (Mail + Kalender)
```

## Projektstruktur

```text
/app        Frontend (React + TypeScript + Tailwind)
/api        Supabase Edge Functions
/migrations SQL Schema, RLS, RPC
/tests      Unit- und Smoke-Tests
/config     Environment-Vorlagen + Deploy-Konfig
```

## Setup

### 1) Voraussetzungen

1. Node.js 20+
2. Supabase CLI
3. Ein Supabase-Projekt
4. (Optional) Azure App für Microsoft Graph

### 2) Installation

```bash
npm install
```

### 3) Environment

1. `config/env.app.example` nach `app/.env` kopieren
2. `config/env.api.example` in Supabase Functions Secrets eintragen

Beispiel:

```bash
supabase secrets set \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  GRAPH_CLIENT_ID=... \
  GRAPH_CLIENT_SECRET=... \
  GRAPH_TENANT_ID=... \
  GRAPH_REDIRECT_URI=... \
  GRAPH_TOKEN_SECRET=...
```

### 4) Datenbank + Funktionen deployen

```bash
supabase db push
supabase functions deploy create-ticket
supabase functions deploy admin-whoami
supabase functions deploy admin-dashboard
supabase functions deploy admin-tickets
supabase functions deploy admin-ticket-detail
supabase functions deploy admin-ticket-update
supabase functions deploy documents-create
supabase functions deploy admin-analytics
supabase functions deploy graph-connect
supabase functions deploy graph-oauth-callback
supabase functions deploy graph-disconnect
supabase functions deploy graph-send-mail
supabase functions deploy graph-sync-calendar
supabase functions deploy inbound-mail-webhook
```

### 5) Frontend lokal starten

```bash
npm run dev
```

## Qualitätssicherung

```bash
npm run typecheck
npm run build
npm run test
npm run smoke
```

## Datenmodellübersicht

### Kernobjekte

1. `tickets`
2. `ticket_events`
3. `ticket_messages`
4. `ticket_documents`
5. `ticket_attachments`
6. `admin_users`
7. `analytics_events`
8. `graph_tokens` (verschlüsselt)
9. `audit_log`

### Nummernlogik

1. Ticketnummern über `next_ticket_number()` im Format `KPT-YYYY-XXXX`
2. Dokumentnummern über `next_document_number(prefix)`:
   1. `ANG-YYYY-XXXX`
   2. `RAP-YYYY-XXXX`
   3. `RE-YYYY-XXXX`

### RLS-Konzept

1. `is_admin_email()` prüft JWT-E-Mail gegen `admin_users`
2. Alle Admin-Tabellen sind nur für bestätigte Admins freigegeben
3. Öffentliche Ticketerstellung erfolgt ausschließlich über Edge Function
4. Storage-Bucket `documents` ist nicht öffentlich

## Öffentliche Website

Seiten:

1. Startseite
2. Leistungen
3. Preise
4. Ablauf
5. Einsatz buchen (Wizard)
6. Impressum
7. Datenschutz
8. AGB
9. Haftung Koordination

Preislogik:

1. 79 € technischer Störungsservice pro Arbeitsstunde
2. 39 € Einsatzpauschale
3. +20 % Mo-Fr nach 17:00 Uhr
4. +35 % Samstag
5. +100 % Sonntag/Feiertag
6. Projektkoordination 15 %, komplex bis 20 %

## Admin-Bereich

1. KPI Dashboard
2. Ticketliste mit Suche, Debounce, Pagination
3. Ticket-Detail mit Statuswechsel, Termin, Notizen
4. Dokumenterstellung (Angebot/Rapport/Rechnung) als PDF
5. Analytics (Besucher, Funnel, Kategorien, PLZ)
6. Outlook-Verbindung (OAuth, Token verschlüsselt, Trennfunktion)

## Outlook Integration

1. OAuth Start: `graph-connect`
2. Callback: `graph-oauth-callback`
3. Versand: `graph-send-mail`
4. Kalender: `graph-sync-calendar`
5. Eingangszuordnung: `inbound-mail-webhook`

## Wartung

1. Migrations strikt versionieren (`/migrations`)
2. Edge Functions mit Versionskontrolle deployen
3. `admin_users` aktuell halten
4. Graph Tokens bei Benutzerwechsel trennen

## Backup

### Datenbank Dump

```bash
supabase db dump --file backup.sql
```

### Storage Export

Bucket `documents` regelmäßig versioniert sichern.

## CI/CD Empfehlung

1. Pull Request: `typecheck`, `build`, `test`, `smoke`
2. Merge in `main`: Deploy Frontend + Supabase Functions + Migrations


