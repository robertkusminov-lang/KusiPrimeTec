# KusiPrimeTec Ticket System - Copilot Instructions

## Big Picture
- Stack: React 19 + Vite frontend, Netlify Functions backend, Supabase Postgres/Auth (`src/`, `netlify/functions/`).
- Routing is intentionally minimal: `src/App.jsx` switches by `window.location.pathname` (`/admin` -> `Admin`, everything else -> public ticket form). Do not introduce React Router unless requested.
- `src/Admin.jsx` is the operational center (auth, ticket board, CRM, document editor, print flow). Prefer extending existing helpers/state there instead of creating parallel admin components.
- Public ticket creation posts to `/.netlify/functions/createTicket`; admin UI calls only Netlify functions with bearer tokens.

## Data and Service Boundaries
- Supabase tables used across app/functions: `tickets`, `customers`, `ticket_documents`, `allowed_admins` (see queries in `netlify/functions/*.js`).
- `createTicket` inserts ticket and best-effort upserts customer by email (`netlify/functions/createTicket.js`).
- `adminUpdateTicket` can auto-link customer when status becomes `angenommen` (`netlify/functions/adminUpdateTicket.js`).
- Document lifecycle: `adminDocGet` ensures row exists, `adminDocSave` upserts by `(ticket_id, doc_type)`, `adminDocRender` returns HTML for print preview.
- `adminDocRender` fully renders only `report`; `offer`/`invoice` currently return placeholder HTML.

## Backend Conventions (Important)
- Each function is self-contained and repeats `json()` + `requireAdmin()` patterns; keep this style when adding endpoints.
- Admin endpoints require `Authorization: Bearer <access_token>` and validate against `allowed_admins`.
- Function responses are explicit `{ ok: true, ... }` or `{ error: "..." }` with HTTP status codes; frontend expects this contract.
- Use `event.queryStringParameters` for GET filters and `JSON.parse(event.body || "{}")` for POST bodies.
- Preserve CORS headers in every function (`access-control-allow-origin`, `...headers`, `...methods`).

## Frontend Patterns
- Keep effect dependencies complete (example: ticket reload depends on `[session, tab, q]` in `src/Admin.jsx`).
- Network calls in admin follow: fetch -> `res.json().catch(() => ({}))` -> manual `res.ok` checks -> user-facing message state.
- Null-safe handling is expected for document state (`doc` starts `null`; use guards/optional chaining before accessing positions/signatures).
- Tab switches in admin should reset dependent state (`selected`, `docType`, `doc`) to avoid stale UI.
- Keep constants synced with DB constraints: category (`Störung|Wartung|Beratung|Sonstiges`), priority (`niedrig|mittel|hoch|dringend`), status values used in `adminListTickets`.

## Build/Test/Debug Workflow
- `npm run dev` and `npm run build` both run `build-logos.js` first; this generates `netlify/functions/.logos.json` consumed by `adminDocRender`.
- Local scripts: `npm run dev`, `npm run build`, `npm test` (Vitest), `npm run lint`.
- `netlify.toml` maps frontend dev server (`5173`) and functions (`9999`) via Netlify dev (`8888` external port).
- Required env vars:
  - Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Functions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Existing test (`tests/adminUpdateTicket.test.js`) mocks `@supabase/supabase-js` and asserts the "status=angenommen" customer upsert flow; follow this mocking pattern for new function tests.

## Guardrails for AI Edits
- Do not edit `src/Admin.OLD.jsx` unless explicitly asked; active admin implementation is `src/Admin.jsx`.
- Keep German domain/status text unchanged unless the task is localization/content updates.
- When adding new admin fetches, include bearer auth and consistent error messaging (`msg` / `custMsg`) so failures stay visible in UI.

