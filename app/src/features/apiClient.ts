import { apiGet, apiPost } from "@/lib/api";
import {
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  normalizeCustomerType,
  resolveCustomerDisplayName,
  resolveInvoiceRecipientName,
  sanitizeCustomerText,
} from "@/lib/customer";
import { anfrageartToRequestType, requestTypeToAnfrageart } from "@/lib/requestType";
import { supabase } from "@/lib/supabase";
import {
  Anfrageart,
  AnalyticsPayload,
  CustomerReportDetailResponse,
  CustomerReportSignaturePayload,
  CustomerReportSummary,
  CustomerType,
  DashboardResponse,
  DocumentData,
  DocumentMaterialPosition,
  DocumentPosition,
  DocumentType,
  TicketAttachment,
  TicketBucket,
  TicketDetailResponse,
  TicketDocument,
  Ticket,
  TicketListResponse,
  RequestType,
  TicketStatus,
  TICKET_STATUSES,
  TicketWizardPayload,
} from "@/types/domain";

const STATUS_VALUES: TicketStatus[] = [...TICKET_STATUSES];

function extractErrorSignal(error: unknown): string {
  const err = error as Error & { rawMessage?: string };
  const msg = String(err?.message || "").toLowerCase();
  const raw = String(err?.rawMessage || "").toLowerCase();
  return `${msg}\n${raw}`;
}

function shouldUseFallback(error: unknown): boolean {
  const msg = extractErrorSignal(error);
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("requested function was not found") ||
    msg.includes("unerwartete api-antwort") ||
    msg.includes("does not exist") ||
    msg.includes("is not defined") ||
    msg.includes("referenceerror") ||
    msg.includes("column") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table")
  );
}

async function withFallback<T>(edgeCall: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await edgeCall();
  } catch (err) {
    if (!shouldUseFallback(err)) throw err;
    return fallback();
  }
}

async function withPerfLog<T>(label: string, run: () => Promise<T>): Promise<T> {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    return await run();
  } finally {
    const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const durationMs = Math.max(0, endedAt - startedAt);
    try {
      console.warn(`[perf] ${label}: ${durationMs.toFixed(1)}ms`);
    } catch {
      // Konsole kann in gehärteten Browsern blockiert sein.
    }
  }
}

function extractMissingColumn(error: unknown, table: string): string | null {
  const msg = String((error as { message?: string })?.message || "");
  const patterns = [
    new RegExp(`column\\s+${table}\\.(\\w+)\\s+does not exist`, "i"),
    new RegExp(`could not find the '([\\w_]+)' column of '${table}' in the schema cache`, "i"),
  ];
  for (const re of patterns) {
    const m = re.exec(msg);
    if (m?.[1]) return m[1];
  }
  return null;
}

function isMissingTable(error: unknown, table: string): boolean {
  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    msg.includes(`could not find the table 'public.${table.toLowerCase()}'`) ||
    (msg.includes("schema cache") && msg.includes(table.toLowerCase()))
  );
}

function pickString(row: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return fallback;
}

function pickNullableString(row: Record<string, unknown>, keys: string[]): string | null {
  const value = pickString(row, keys, "");
  return value ? value : null;
}

function parseDateValue(v: unknown): number {
  const t = new Date(String(v || "")).getTime();
  return Number.isFinite(t) ? t : 0;
}

function parseRowDate(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const t = parseDateValue(row[key]);
    if (t > 0) return t;
  }
  return 0;
}

function normalizeStatus(value: unknown): TicketStatus {
  const raw = String(value || "").trim();
  if (!raw) return "Neu";

  if (STATUS_VALUES.includes(raw as TicketStatus)) return raw as TicketStatus;

  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  const map: Record<string, TicketStatus> = {
    neu: "Neu",
    new: "Neu",
    gepruft: "Geprueft",
    geprueft: "Geprueft",
    gepruft_in_bearbeitung: "Geprueft",
    rueckfrage_kunde: "Rueckfrage_Kunde",
    rueckfrage: "Rueckfrage_Kunde",
    wartet_auf_kunde: "Rueckfrage_Kunde",
    wartet_auf_kunden: "Rueckfrage_Kunde",
    termin_geplant: "Termin_geplant",
    geplant: "Termin_geplant",
    in_arbeit: "In_Arbeit",
    in_bearbeitung: "In_Arbeit",
    bearbeitung: "In_Arbeit",
    rapport_erstellt: "Rapport_erstellt",
    abgeschlossen: "Rapport_erstellt",
    erledigt: "Rapport_erstellt",
    storniert: "Storniert",
    abgebrochen: "Storniert",
    cancelled: "Storniert",
    done: "Rapport_erstellt",
  };

  return map[normalized] || "Neu";
}

function isStatusConstraintError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    (msg.includes("violates check constraint") && msg.includes("status")) ||
    msg.includes("check_status") ||
    msg.includes("tickets_status_check")
  );
}

function isCategoryConstraintError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    msg.includes("tickets_category_check") ||
    msg.includes("ticket_category_check") ||
    msg.includes("check_category") ||
    (msg.includes("violates check constraint") && (msg.includes("kategorie") || msg.includes("category")))
  );
}

function isTimeRangeTypeError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    msg.includes("time zone displacement out of range") ||
    (msg.includes("invalid input syntax") && msg.includes("type time")) ||
    (msg.includes("invalid input syntax") && msg.includes("type timetz"))
  );
}

function stripUnsafeRangeWindowFields(body: Record<string, unknown>): boolean {
  const keys = ["requested_time", "desired_time_window", "preferred_time_window", "zeitfenster", "window"];
  let changed = false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const value = String(body[key] ?? "").trim();
    if (value.includes("-")) {
      delete body[key];
      changed = true;
    }
  }
  return changed;
}

function customerTypeWriteCandidates(value: CustomerType | null | undefined): string[] {
  if (value === "firma") return ["firma", "gewerblich"];
  if (value === "privat") return ["privat"];
  return [];
}

function isCustomerTypeConstraintError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    msg.includes("customers_customer_type_check") ||
    msg.includes("tickets_customer_type_check") ||
    (msg.includes("violates check constraint") && msg.includes("customer_type"))
  );
}

function normalizeCategoryKey(value: unknown): string {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function canonicalCategory(
  value: unknown
):
  | "elektro"
  | "heizung"
  | "sanitaer"
  | "objekttechnik"
  | "koordination"
  | "einzelauftrag"
  | "kleinreparatur"
  | "maengelaufnahme"
  | "instandhaltung"
  | "sichtkontrolle"
  | "wartung_bestand"
  | "allround_service"
  | "objektcheck"
  | "objektbetreuung"
  | "fachfirma"
  | "material"
  | "rueckfrage"
  | "terminplanung"
  | "dokumentation"
  | "sonstiges" {
  const key = normalizeCategoryKey(value);
  if (key.includes("einzelauftrag")) return "einzelauftrag";
  if (key.includes("kleinreparatur")) return "kleinreparatur";
  if (key.includes("mangel") || key.includes("maengelaufnahme")) return "maengelaufnahme";
  if (key.includes("instandhaltung")) return "instandhaltung";
  if (key.includes("sichtkontrolle")) return "sichtkontrolle";
  if (key.includes("wartung_im_bestand") || key.includes("wartung_bestand")) return "wartung_bestand";
  if (key.includes("allround") || key.includes("handwerklich_technischer")) return "allround_service";
  if (key.includes("objektcheck")) return "objektcheck";
  if (key.includes("objektbetreuung")) return "objektbetreuung";
  if (key.includes("fachfirma")) return "fachfirma";
  if (key.includes("material")) return "material";
  if (key.includes("rueckfrage")) return "rueckfrage";
  if (key.includes("terminplanung")) return "terminplanung";
  if (key.includes("dokumentation")) return "dokumentation";
  if (key.includes("elektro")) return "elektro";
  if (key.includes("heizung")) return "heizung";
  if (key.includes("sanitar") || key.includes("sanitaer")) return "sanitaer";
  if (key.includes("objekttechnik") || key.includes("gebaudetechnik") || key.includes("gebaudetechnik")) return "objekttechnik";
  if (key.includes("koordination") || key.includes("projektkoordination")) return "koordination";
  return "sonstiges";
}

function categoryWriteCandidates(value: unknown): string[] {
  const raw = String(value || "").trim();
  const canonical = canonicalCategory(raw || "sonstiges");

  const byCanonical: Record<ReturnType<typeof canonicalCategory>, string[]> = {
    einzelauftrag: ["Einzelauftrag"],
    kleinreparatur: ["Kleinreparatur"],
    maengelaufnahme: ["Mängelaufnahme", "Maengelaufnahme"],
    instandhaltung: ["Instandhaltung"],
    sichtkontrolle: ["Sichtkontrolle"],
    wartung_bestand: ["Wartung im Bestand"],
    allround_service: ["Handwerklich-technischer Allround-Service"],
    objektcheck: ["ObjektCheck"],
    objektbetreuung: ["ObjektBetreuung"],
    fachfirma: ["Fachfirma erforderlich"],
    material: ["Material benötigt"],
    rueckfrage: ["Rückfrage Kunde"],
    terminplanung: ["Terminplanung"],
    dokumentation: ["Dokumentation"],
    elektro: ["Elektro", "elektro", "ELEKTRO"],
    heizung: ["Heizung", "heizung", "HEIZUNG"],
    sanitaer: ["Sanitär", "Sanitaer", "Sanitar", "sanitaer", "sanitär"],
    objekttechnik: ["Objekttechnik", "objekttechnik", "Gebäudetechnik", "Gebaeudetechnik"],
    koordination: ["Koordination", "Projektkoordination", "koordination", "projektkoordination"],
    sonstiges: ["Sonstiges", "sonstiges", "Allgemein", "allgemein", "Sonstige"],
  };

  return [...new Set([raw, ...byCanonical[canonical]].filter(Boolean))];
}

function statusWriteCandidates(value: unknown): string[] {
  const raw = String(value || "").trim();
  if (!raw) return [];

  const canonical = STATUS_VALUES.includes(raw as TicketStatus) ? (raw as TicketStatus) : normalizeStatus(raw);
  const byCanonical: Record<TicketStatus, string[]> = {
    Neu: ["Neu", "neu", "NEW", "new"],
    Geprueft: ["Geprueft", "Gepruft", "In_Bearbeitung", "In Bearbeitung"],
    Rueckfrage_Kunde: ["Rueckfrage_Kunde", "Rueckfrage Kunde", "Wartet_auf_Kunde", "Wartet auf Kunde"],
    Termin_geplant: ["Termin_geplant", "Termin geplant", "Geplant"],
    In_Arbeit: ["In_Arbeit", "In Arbeit", "In_Bearbeitung", "In Bearbeitung"],
    Rapport_erstellt: ["Rapport_erstellt", "Rapport erstellt"],
    Storniert: ["Storniert", "Abgebrochen", "Cancelled", "cancelled"],
  };

  return [...new Set([raw, ...byCanonical[canonical]].filter(Boolean))];
}

function normalizeBucket(value: unknown, status: TicketStatus): TicketBucket {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "inbox") return "inbox";
  if (raw === "active" || raw === "aktiv") return "active";
  if (raw === "archive" || raw === "archiv") return "archive";
  if (status === "Neu") return "inbox";
  return status === "Rapport_erstellt" || status === "Storniert" ? "archive" : "active";
}

function isArchivedRow(row: Record<string, unknown>): boolean {
  const status = normalizeStatus(row.status);
  return normalizeBucket(row.bucket, status) === "archive";
}

function isOpenRow(row: Record<string, unknown>): boolean {
  const status = normalizeStatus(row.status);
  return normalizeBucket(row.bucket, status) === "active";
}

function normalizeUrgency(value: unknown): string {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizePriorityKey(value: unknown): "niedrig" | "mittel" | "hoch" | "kritisch" {
  const raw = normalizeUrgency(value);
  if (raw.includes("krit") || raw.includes("notfall")) return "kritisch";
  if (raw.includes("hoch") || raw.includes("high")) return "hoch";
  if (raw.includes("nied") || raw.includes("low")) return "niedrig";
  return "mittel";
}

function priorityWriteCandidates(value: unknown): string[] {
  const key = normalizePriorityKey(value);
  const byKey: Record<ReturnType<typeof normalizePriorityKey>, string[]> = {
    niedrig: ["niedrig", "Niedrig", "low", "LOW"],
    mittel: ["mittel", "Mittel", "medium", "MEDIUM"],
    hoch: ["hoch", "Hoch", "high", "HIGH", "urgent", "URGENT"],
    kritisch: ["kritisch", "Kritisch", "notfall", "Notfall", "critical", "CRITICAL", "hoch_notfall", "HOCH_NOTFALL"],
  };
  const raw = String(value || "").trim();
  return [...new Set([raw, ...byKey[key]].filter(Boolean))];
}

function isPriorityConstraintError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    msg.includes("tickets_dringlichkeit_check") ||
    msg.includes("tickets_priority_check") ||
    (msg.includes("violates check constraint") && (msg.includes("dringlichkeit") || msg.includes("priority"))) ||
    (msg.includes("invalid input value for enum") && (msg.includes("dringlichkeit") || msg.includes("priority") || msg.includes("notfall"))) ||
    (msg.includes("invalid input syntax") && msg.includes("enum") && (msg.includes("dringlichkeit") || msg.includes("priority")))
  );
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const n = Number(row[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickBoolean(row: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1") return true;
    if (value === 0 || value === "0") return false;
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) continue;
    if (["true", "t", "ja", "yes", "y"].includes(raw)) return true;
    if (["false", "f", "nein", "no", "n"].includes(raw)) return false;
  }
  return null;
}

function fallbackTicketNumber(id: string): string {
  const short = (id || "").replace(/-/g, "").slice(0, 8).toUpperCase();
  return `TKT-${short || "UNBEKANNT"}`;
}

function parseDesiredTimeWindow(value: string | null): { from: string | null; to: string | null } {
  if (!value) return { from: null, to: null };
  const raw = String(value || "").trim();
  if (!raw) return { from: null, to: null };

  const toHm = (part: string | null | undefined): string | null => {
    const s = String(part || "").trim();
    const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
    if (!m) return null;
    const hh = m[1].padStart(2, "0");
    const mm = m[2];
    if (Number(hh) > 23 || Number(mm) > 59) return null;
    return `${hh}:${mm}`;
  };

  const matches = raw.match(/\d{1,2}:\d{2}(?::\d{2})?/g);
  if (matches && matches.length >= 2) {
    return { from: toHm(matches[0]), to: toHm(matches[1]) };
  }

  const parts = raw.split(/\s*(?:-|–|—|bis|to)\s*/i).filter(Boolean);
  if (parts.length >= 2) {
    return { from: toHm(parts[0]), to: toHm(parts[1]) };
  }

  return { from: null, to: null };
}

function composeObjectAddress(street: string | null | undefined, zip: string | null | undefined, city: string | null | undefined, fallback = ""): string {
  const s = String(street || "").trim();
  const z = String(zip || "").trim();
  const c = String(city || "").trim();
  const f = String(fallback || "").trim();
  const line2 = [z, c].filter(Boolean).join(" ");
  const composed = [s, line2].filter(Boolean).join(", ");
  return composed || f;
}

function splitAddressParts(raw: string | null | undefined): { street: string; zip: string; city: string } {
  const text = String(raw || "").trim();
  if (!text) return { street: "", zip: "", city: "" };

  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const zipCityCandidate = parts.length >= 2 ? parts[parts.length - 1] : text;
  const zipCityMatch = zipCityCandidate.match(/^(\d{4,5})\s+(.+)$/);

  if (zipCityMatch) {
    const street =
      parts.length >= 2
        ? parts.slice(0, -1).join(", ").trim()
        : text.replace(zipCityCandidate, "").replace(/[,\s]+$/, "").trim();
    return {
      street,
      zip: zipCityMatch[1].trim(),
      city: zipCityMatch[2].trim(),
    };
  }

  return { street: parts[0] || text, zip: "", city: "" };
}

function ticketRecipientName(ticket: Ticket): string {
  return (
    resolveInvoiceRecipientName({
      customerType: ticket.customer_type,
      invoiceRecipientName: ticket.invoice_recipient_name,
      kundeName: ticket.kunde_name,
      kundeFirma: ticket.kunde_firma,
    }) || "-"
  );
}

function ticketObjectAddress(ticket: Ticket): string {
  return composeObjectAddress(ticket.objekt_strasse, ticket.objekt_plz, ticket.objekt_ort, ticket.objekt_adresse || "");
}

function asTicket(row: Record<string, unknown>): Ticket {
  const id = pickString(row, ["id", "ticket_id"], "");
  const status = normalizeStatus(row.status);
  const customerTypeRaw = pickNullableString(row, ["customer_type", "kunde_typ"]);
  const customerType = normalizeCustomerType(customerTypeRaw) || (customerTypeRaw as CustomerType | null);
  const contactPerson = sanitizeCustomerText(
    pickString(row, ["ansprechpartner", "contact_person", "contact_name"], "")
  );
  const kundeName = sanitizeCustomerText(
    pickString(row, ["kunde_name", "customer_name", "contact_name", "contact_person", "ansprechpartner", "name"], "")
  );
  const kundeFirma = sanitizeCustomerText(pickString(row, ["kunde_firma", "customer_company", "company_name", "firma"], ""));
  const invoiceRecipientName = sanitizeCustomerText(
    pickString(row, ["invoice_recipient_name", "rechnungsempfaenger_name", "recipient_name"], "")
  );
  const customerDisplayName = resolveCustomerDisplayName({
    customerType,
    invoiceRecipientName,
    kundeName,
    kundeFirma,
    companyName: pickString(row, ["company_name", "company"], ""),
  });
  const objektStrasse = pickNullableString(row, ["objekt_strasse", "object_street", "street"]);
  const objektPlz = pickNullableString(row, ["objekt_plz", "object_zip", "zip", "postal_code"]);
  const objektOrt = pickNullableString(row, ["objekt_ort", "object_city", "city", "ort"]);
  const objektAdresseRaw = pickString(row, ["objekt_adresse", "object_address", "adresse", "address"], "");
  const objektAdresse = composeObjectAddress(objektStrasse, objektPlz, objektOrt, objektAdresseRaw);
  const parsedWindow = parseDesiredTimeWindow(
    pickNullableString(row, ["desired_time_window", "preferred_time_window", "requested_time", "zeitfenster", "window"]) || null
  );
  const requestType = anfrageartToRequestType(
    pickString(row, ["request_type", "anfrageart", "source", "request_type_label"], "direct")
  );
  const resolvedKundeName = kundeName || contactPerson || invoiceRecipientName || customerDisplayName || "";
  return {
    id,
    customer_id: pickNullableString(row, ["customer_id"]),
    ticket_nummer: pickString(
      row,
      ["ticket_nummer", "ticket_number", "ticket_nr", "nummer", "report_number", "report_nummer"],
      fallbackTicketNumber(id)
    ),
    status,
    bucket: normalizeBucket(row.bucket, status),
    request_type: requestType,
    anfrageart: requestTypeToAnfrageart(requestType),
    kategorie: pickString(row, ["kategorie", "category"], ""),
    subkategorie: pickNullableString(row, ["subkategorie", "subcategory"]),
    dringlichkeit: pickString(row, ["dringlichkeit", "priority"], "mittel") as Ticket["dringlichkeit"],
    titel: pickString(row, ["titel", "title", "subject"], ""),
    beschreibung: pickString(row, ["beschreibung", "description", "details"], ""),
    internal_note: pickNullableString(row, ["internal_note", "interne_notiz", "note"]),
    customer_type: customerType as Ticket["customer_type"],
    invoice_recipient_name: invoiceRecipientName || null,
    customer_display_name: customerDisplayName || null,
    ansprechpartner: contactPerson || null,
    kunde_name: resolvedKundeName,
    kunde_firma: kundeFirma,
    kunde_email: normalizeCustomerEmail(pickString(row, ["kunde_email", "customer_email", "email"], "")),
    kunde_telefon: normalizeCustomerPhone(pickString(row, ["kunde_telefon", "customer_phone", "telefon", "phone"], "")),
    objekt_adresse: objektAdresse,
    objekt_strasse: objektStrasse,
    objekt_plz: objektPlz,
    objekt_ort: objektOrt,
    access_notes: pickNullableString(row, ["access_notes", "zugangshinweise"]),
    distanz_km: pickNumber(row, ["distanz_km", "distance_km", "radius_km"]),
    outside_service_area: pickBoolean(row, ["outside_service_area", "outside_service_request"]),
    radius_km: pickNumber(row, ["radius_km", "service_radius_km"]),
    datenschutz_akzeptiert: pickBoolean(row, ["datenschutz_akzeptiert", "privacy_accepted"]),
    agb_akzeptiert: pickBoolean(row, ["agb_akzeptiert", "terms_accepted"]),
    haftung_koordination_akzeptiert: pickBoolean(row, ["haftung_koordination_akzeptiert", "liability_coordination_accepted"]),
    ort: pickString(row, ["ort", "city"], objektOrt || ""),
    plz: pickString(row, ["plz", "zip", "postal_code"], objektPlz || ""),
    terminwunsch: pickNullableString(row, ["terminwunsch", "desired_date", "requested_date", "appointment_date", "scheduled_date", "scheduled_at"]),
    accepted_at: pickNullableString(row, ["accepted_at"]),
    rejected_at: pickNullableString(row, ["rejected_at"]),
    rejected_reason: pickNullableString(row, ["rejected_reason", "cancel_reason"]),
    zeitfenster_von: pickNullableString(row, ["zeitfenster_von", "time_from", "window_from"]) || parsedWindow.from,
    zeitfenster_bis: pickNullableString(row, ["zeitfenster_bis", "time_to", "window_to"]) || parsedWindow.to,
    created_at: pickString(row, ["created_at", "createdAt"], new Date(0).toISOString()),
    updated_at: pickString(row, ["updated_at", "updatedAt"], new Date(0).toISOString()),
  };
}

async function loadTicketsRaw(): Promise<Record<string, unknown>[]> {
  const baseColumns = [
    "id",
    "customer_id",
    "ticket_nummer",
    "ticket_number",
    "ticket_nr",
    "category",
    "bucket",
    "status",
    "anfrageart",
    "request_type",
    "source",
    "kategorie",
    "subkategorie",
    "dringlichkeit",
    "priority",
    "titel",
    "beschreibung",
    "description",
    "internal_note",
    "internal_notes",
    "customer_type",
    "invoice_recipient_name",
    "ansprechpartner",
    "contact_person",
    "contact_name",
    "kunde_name",
    "kunde_firma",
    "company_name",
    "kunde_email",
    "kunde_telefon",
    "email",
    "phone",
    "objekt_adresse",
    "object_address",
    "objekt_strasse",
    "object_street",
    "objekt_plz",
    "object_zip",
    "objekt_ort",
    "object_city",
    "access_notes",
    "distanz_km",
    "outside_service_area",
    "radius_km",
    "distance_km",
    "datenschutz_akzeptiert",
    "agb_akzeptiert",
    "haftung_koordination_akzeptiert",
    "privacy_accepted",
    "terms_accepted",
    "liability_coordination_accepted",
    "ort",
    "city",
    "plz",
    "terminwunsch",
    "desired_date",
    "requested_date",
    "requested_time",
    "preferred_time_window",
    "scheduled_date",
    "scheduled_at",
    "zeitfenster_von",
    "zeitfenster_bis",
    "accepted_at",
    "rejected_at",
    "rejected_reason",
    "created_at",
    "updated_at",
    "bestaetigt_at",
    "termin_geplant_at",
    "scheduled_at",
  ];

  const cols = [...baseColumns];
  let orderByCreated = true;
  for (let i = 0; i < 80; i += 1) {
    if (!cols.length) break;

    let query = supabase.from("tickets").select(cols.join(","));
    if (orderByCreated && cols.includes("created_at")) {
      query = query.order("created_at", { ascending: false });
    }
    query = query.limit(1200);

    const { data, error } = await query;
    if (!error) return (data || []) as unknown as Record<string, unknown>[];

    const missing = extractMissingColumn(error, "tickets");
    if (missing) {
      const idx = cols.indexOf(missing);
      if (idx >= 0) {
        cols.splice(idx, 1);
        if (missing === "created_at") orderByCreated = false;
        continue;
      }
      if (missing === "created_at") {
        orderByCreated = false;
      }
      continue;
    }

    throw new Error(error.message);
  }

  // Letzter Fallback: versuche minimale Spalten, statt die Liste komplett zu blockieren.
  const minimalSets = [
    ["id", "status", "created_at"],
    ["id", "status"],
  ];
  for (const set of minimalSets) {
    let working = [...set];
    for (let i = 0; i < 10 && working.length; i += 1) {
      const { data, error } = await supabase.from("tickets").select(working.join(",")).limit(1200);
      if (!error) return (data || []) as unknown as Record<string, unknown>[];
      const missing = extractMissingColumn(error, "tickets");
      if (!missing) break;
      working = working.filter((col) => col !== missing);
    }
  }

  return [];
}

function mapListRows(rows: Record<string, unknown>[]): Ticket[] {
  return rows.map((r) => asTicket(r));
}

function hoursDiff(a: string, b: string | null | undefined): number {
  if (!b) return 0;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db) || db < da) return 0;
  return (db - da) / 3600000;
}

function trend(current: number, previous: number): { delta_percent: number; compare_value: number } {
  if (!previous && !current) return { delta_percent: 0, compare_value: 0 };
  if (!previous) return { delta_percent: 100, compare_value: 0 };
  return { delta_percent: Number((((current - previous) / previous) * 100).toFixed(1)), compare_value: previous };
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rollingDays(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(dayKey(d.getTime()));
  }
  return out;
}

async function loadActivityRaw(limit = 20): Promise<Record<string, unknown>[]> {
  const cols = ["id", "event_typ", "detail", "actor", "created_at"];
  for (let i = 0; i < 8; i += 1) {
    const { data, error } = await supabase
      .from("ticket_events")
      .select(cols.join(","))
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error) return (data || []) as unknown as Record<string, unknown>[];
    if (isMissingTable(error, "ticket_events")) return [];
    const missing = extractMissingColumn(error, "ticket_events");
    if (!missing) throw new Error(error.message);
    const idx = cols.indexOf(missing);
    if (idx >= 0) cols.splice(idx, 1);
  }
  return [];
}

function startOfDayTs(value = Date.now()): number {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isToday(ts: number, todayStart: number): boolean {
  return ts >= todayStart && ts < todayStart + 24 * 3600 * 1000;
}

function computeTicketSeries(rows: Record<string, unknown>[], days = 30): { label: string; value: number }[] {
  const keys = rollingDays(days);
  const map = new Map<string, number>(keys.map((key) => [key, 0]));

  for (const row of rows) {
    const ts = parseRowDate(row, ["created_at", "createdAt"]);
    if (!ts) continue;
    const key = dayKey(ts);
    if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
  }

  return keys.map((key) => ({ label: key, value: map.get(key) || 0 }));
}

function mapActivities(rows: Record<string, unknown>[]) {
  return rows.map((row, index) => ({
    id: pickString(row, ["id"], `evt-${index}`),
    type: pickString(row, ["event_typ", "type"], "ticket_update"),
    message: pickString(row, ["detail", "message"], "Ticket aktualisiert"),
    actor: pickString(row, ["actor", "created_by"], "System"),
    created_at: pickString(row, ["created_at"], new Date(0).toISOString()),
  }));
}

function mapAgentMessages(rows: Record<string, unknown>[]) {
  return rows.map((row, index) => {
    const riskRaw = pickString(row, ["risk_level"], "low").toLowerCase();
    const riskLevel = riskRaw === "high" || riskRaw === "medium" ? riskRaw : "low";
    return {
      id: pickString(row, ["id", "run_id"], `run-${index}`),
      ticket_id: pickNullableString(row, ["ticket_id"]),
      message: pickString(row, ["message", "short_assessment"], "Ops-Agent hat den Vorgang verarbeitet."),
      created_at: pickString(row, ["created_at"], new Date(0).toISOString()),
      intent: pickString(row, ["intent"], "other"),
      risk_level: riskLevel as "low" | "medium" | "high",
      requires_approval: Boolean(pickBoolean(row, ["requires_approval"])),
    };
  });
}

function normalizeDashboardResponse(raw: Partial<DashboardResponse>): DashboardResponse {
  return {
    kpis: {
      neue_tickets: Number(raw.kpis?.neue_tickets || 0),
      offene_tickets: Number(raw.kpis?.offene_tickets || 0),
      termine_7_tage: Number(raw.kpis?.termine_7_tage || 0),
      avg_bestaetigung_stunden: Number(raw.kpis?.avg_bestaetigung_stunden || 0),
      avg_termin_stunden: Number(raw.kpis?.avg_termin_stunden || 0),
      inbox_neu: Number(raw.kpis?.inbox_neu || 0),
      hoch_notfall: Number(raw.kpis?.hoch_notfall || 0),
      ohne_termin: Number(raw.kpis?.ohne_termin || 0),
      heute_faellig: Number(raw.kpis?.heute_faellig || 0),
      objektbetreuung_anfragen: Number(raw.kpis?.objektbetreuung_anfragen || 0),
    },
    trends: {
      neue_tickets: {
        delta_percent: Number(raw.trends?.neue_tickets?.delta_percent || 0),
        compare_value: Number(raw.trends?.neue_tickets?.compare_value || 0),
      },
      offene_tickets: {
        delta_percent: Number(raw.trends?.offene_tickets?.delta_percent || 0),
        compare_value: Number(raw.trends?.offene_tickets?.compare_value || 0),
      },
      termine_7_tage: {
        delta_percent: Number(raw.trends?.termine_7_tage?.delta_percent || 0),
        compare_value: Number(raw.trends?.termine_7_tage?.compare_value || 0),
      },
    },
    tickets: Array.isArray(raw.tickets) ? raw.tickets : [],
    activities: Array.isArray(raw.activities) ? raw.activities : [],
    agent_messages: Array.isArray((raw as Record<string, unknown>).agent_messages)
      ? mapAgentMessages((raw as Record<string, unknown>).agent_messages as Record<string, unknown>[])
      : [],
    tickets_pro_tag_30: Array.isArray(raw.tickets_pro_tag_30) ? raw.tickets_pro_tag_30 : [],
    funnel_preview: Array.isArray(raw.funnel_preview) ? raw.funnel_preview : [],
    inquiry_summary: {
      total_open: Number(raw.inquiry_summary?.total_open || 0),
      follow_up_due: Number(raw.inquiry_summary?.follow_up_due || 0),
      latest_requested_at: raw.inquiry_summary?.latest_requested_at || null,
    },
  };
}

function docTypeToPrefix(type: DocumentType): string {
  if (type === "rapport") return "RAP";
  return "RAP";
}

function toLegacyDocType(type: DocumentType): "report" {
  if (type === "rapport") return "report";
  return "report";
}

function normalizeDocumentType(value: unknown): DocumentType {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "rapport" || raw === "report" || raw === "rap") return "rapport";
  return "rapport";
}

function normalizeDocumentStatus(value: unknown): TicketDocument["status"] {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "entwurf";
  if (raw === "draft" || raw === "entwurf") return "entwurf";
  if (raw === "sent" || raw === "gesendet") return "gesendet";
  if (raw === "accepted" || raw === "akzeptiert") return "akzeptiert";
  if (raw === "rejected" || raw === "abgelehnt") return "abgelehnt";
  return "entwurf";
}

function sourceTableForDocumentType(type: DocumentType): "reports" {
  if (type === "rapport") return "reports";
  return "reports";
}

function documentRowMergeKey(row: Record<string, unknown>): string {
  const typ = normalizeDocumentType(pickString(row, ["dokument_typ", "doc_type", "document_type", "type", "typ"], ""));
  const nummer = pickString(row, ["dokument_nummer", "document_number"], "").trim().toLowerCase();
  if (nummer) return `${typ}::${nummer}`;
  const sourceId = pickString(row, ["source_id", "id"], "").trim().toLowerCase();
  if (sourceId) return `${typ}::src:${sourceId}`;
  return `${typ}::fallback`;
}

function mergeDocumentRows(
  baseRows: Record<string, unknown>[],
  additionalRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const merged = [...baseRows];
  const seen = new Set(merged.map((row) => documentRowMergeKey(row)));
  for (const row of additionalRows) {
    const key = documentRowMergeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  merged.sort((a, b) => parseRowDate(b, ["created_at", "updated_at"]) - parseRowDate(a, ["created_at", "updated_at"]));
  return merged;
}

async function loadSourceDocumentsAdaptive(
  ticketId: string,
  onlyType?: DocumentType
): Promise<Record<string, unknown>[]> {
  const sources: Array<{ table: "reports"; typ: DocumentType }> = [
    { table: "reports", typ: "rapport" },
  ];
  const selected = onlyType ? sources.filter((src) => src.typ === onlyType) : sources;
  const out: Record<string, unknown>[] = [];

  for (const source of selected) {
    const cols = ["id", "ticket_id", "document_number", "status", "data", "created_at", "updated_at"];
    let orderByCreated = true;
    for (let i = 0; i < 10 && cols.length; i += 1) {
      let query = supabase.from(source.table).select(cols.join(",")).eq("ticket_id", ticketId);
      if (orderByCreated && cols.includes("created_at")) {
        query = query.order("created_at", { ascending: false });
      }
      const { data, error } = await query;
      if (!error) {
        const rows = Array.isArray(data) ? (data as unknown as Record<string, unknown>[]) : [];
        for (const row of rows) {
          const number = pickString(row, ["document_number"], "").trim();
          if (!number) continue;
          out.push({
            id: `src-${source.table}-${pickString(row, ["id"], "0")}`,
            ticket_id: pickString(row, ["ticket_id"], ticketId),
            dokument_typ: source.typ,
            doc_type: toLegacyDocType(source.typ),
            document_type: toLegacyDocType(source.typ),
            type: source.typ,
            typ: source.typ,
            dokument_nummer: number,
            status: normalizeDocumentStatus(row.status),
            data: row.data && typeof row.data === "object" ? row.data : {},
            created_at: pickString(row, ["created_at"], new Date(0).toISOString()),
            updated_at: pickString(row, ["updated_at", "created_at"], new Date(0).toISOString()),
            source_table: source.table,
            source_id: pickString(row, ["id"], ""),
          });
        }
        break;
      }
      if (isMissingTable(error, source.table)) break;
      const missing = extractMissingColumn(error, source.table);
      if (!missing) throw new Error((error as { message?: string })?.message || "Quelle konnte nicht geladen werden.");
      const idx = cols.indexOf(missing);
      if (idx >= 0) cols.splice(idx, 1);
      if (missing === "created_at") orderByCreated = false;
    }
  }

  out.sort((a, b) => parseRowDate(b, ["created_at", "updated_at"]) - parseRowDate(a, ["created_at", "updated_at"]));
  return out;
}

function parseDocumentData(raw: unknown, ticket: Ticket): DocumentData {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const passthrough = data as Record<string, unknown>;
  const cleanText = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const s = String(value).trim();
    const normalized = s.toLowerCase();
    if (!s || normalized === "null" || normalized === "undefined") return "";
    return s;
  };
  const pickDocText = (...values: unknown[]): string => {
    for (const value of values) {
      const cleaned = cleanText(value);
      if (cleaned) return cleaned;
    }
    return "";
  };
  const toPosition = (item: unknown, index: number): DocumentPosition => {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      id: String(row.id || `p-${index + 1}`),
      nr: Number(row.nr || index + 1),
      bezeichnung: String(row.bezeichnung || ""),
      menge: Number(row.menge || 0),
      einheit: String(row.einheit || "Stk"),
      einzelpreis: Number(row.einzelpreis || 0),
    };
  };

  const toMaterial = (item: unknown, index: number): DocumentMaterialPosition => {
    if (typeof item === "string") {
      return {
        id: `m-${index + 1}`,
        beschreibung: item,
        menge: 1,
        einheit: "Stk",
      };
    }
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      id: String(row.id || `m-${index + 1}`),
      beschreibung: String(row.beschreibung || row.bezeichnung || ""),
      menge: Number(row.menge || 1),
      einheit: String(row.einheit || "Stk"),
    };
  };

  const list = Array.isArray(data.positionen) ? data.positionen.map(toPosition) : [];
  const materialList = Array.isArray(data.materialliste) ? data.materialliste.map(toMaterial) : [];
  const defaultDate = new Date().toISOString().slice(0, 10);
  const fallbackAddress = pickDocText(data.objekt_adresse, data.object_address, ticketObjectAddress(ticket));
  const parsedAddress = splitAddressParts(fallbackAddress);

  const recipientType = normalizeCustomerType(data.customer_type || ticket.customer_type) || ticket.customer_type || null;
  const recipientCompany = sanitizeCustomerText(
    pickDocText(data.kunde_firma, data.recipient_company, data.company_name, ticket.kunde_firma)
  );
  const recipientPerson = sanitizeCustomerText(
    pickDocText(data.kunde_name, data.recipient_name, data.empfaenger_name, ticket.kunde_name)
  );
  const recipientName =
    resolveInvoiceRecipientName({
      customerType: recipientType,
      invoiceRecipientName: pickDocText(data.invoice_recipient_name, data.kunde, ticket.invoice_recipient_name),
      kundeName: recipientPerson,
      kundeFirma: recipientCompany,
    }) ||
    ticketRecipientName(ticket) ||
    "-";

  const recipientStreet = pickDocText(
    data.objekt_strasse,
    data.object_street,
    data.recipient_street,
    parsedAddress.street,
    ticket.objekt_strasse
  );
  const recipientZip = pickDocText(
    data.objekt_plz,
    data.object_zip,
    data.recipient_zip,
    parsedAddress.zip,
    ticket.objekt_plz
  );
  const recipientCity = pickDocText(
    data.objekt_ort,
    data.object_city,
    data.recipient_city,
    parsedAddress.city,
    ticket.objekt_ort
  );
  const recipientAddress = composeObjectAddress(
    recipientStreet,
    recipientZip,
    recipientCity,
    fallbackAddress
  );
  return {
    ...passthrough,
    ticket_nummer: String(data.ticket_nummer || ticket.ticket_nummer),
    dokument_datum: String(data.dokument_datum || defaultDate),
    referenz: String(data.referenz || ticket.ticket_nummer),
    kunde: recipientName,
    kunde_name: recipientPerson || recipientName || "",
    ansprechpartner: pickDocText(data.ansprechpartner, data.contact_person, ticket.ansprechpartner),
    betreut_durch: pickDocText(data.betreut_durch, data.assigned_agent, data.betreuer, "Robert Kusminov"),
    kunde_firma: recipientCompany || "",
    kunde_email: pickDocText(data.kunde_email, data.recipient_email, ticket.kunde_email, ""),
    kunde_telefon: pickDocText(data.kunde_telefon, data.recipient_phone, ticket.kunde_telefon, ""),
    objekt_adresse: recipientAddress,
    objekt_strasse: recipientStreet,
    objekt_plz: recipientZip,
    objekt_ort: recipientCity,
    leistungsbeschreibung: pickDocText(data.leistungsbeschreibung, data.description, ticket.beschreibung, ""),
    gueltig_bis: (data.gueltig_bis as string) || null,
    zahlungsziel_tage: Number(data.zahlungsziel_tage || 7),
    zahlungshinweis: String(data.zahlungshinweis || "Zahlung per Überweisung nach Erhalt."),
    zeiten: {
      ankunft: (data.zeiten as { ankunft?: string })?.ankunft || null,
      beginn: (data.zeiten as { beginn?: string })?.beginn || null,
      ende: (data.zeiten as { ende?: string })?.ende || null,
      gesamtstunden: Number((data.zeiten as { gesamtstunden?: number })?.gesamtstunden || 0),
    },
    materialliste: materialList,
    fotodokumentation: Array.isArray(data.fotodokumentation) ? data.fotodokumentation.map((x) => String(x)) : [],
    hinweise: String(data.hinweise || ""),
    leistungszeitraum: data.leistungszeitraum ? String(data.leistungszeitraum) : null,
    bankverbindung: data.bankverbindung ? String(data.bankverbindung) : null,
    positionen: list,
    signatur_kunde_label: String(data.signatur_kunde_label || ""),
    signatur_kusi_label: String(data.signatur_kusi_label || ""),
    signatur_kunde_image: data.signatur_kunde_image ? String(data.signatur_kunde_image) : null,
    signatur_kusi_image: data.signatur_kusi_image ? String(data.signatur_kusi_image) : null,
  };
}

function mapAttachment(row: Record<string, unknown>, index: number): TicketAttachment {
  return {
    id: String(row.id || `att-${index + 1}`),
    file_name: pickString(row, ["file_name", "name"], "Anhang"),
    storage_url: pickNullableString(row, ["storage_url", "url"]),
    mime_type: pickNullableString(row, ["mime_type", "type"]),
    created_at: pickNullableString(row, ["created_at"]),
  };
}

function mapTicketDocument(row: Record<string, unknown>, ticket: Ticket, index: number): TicketDocument {
  const typ = normalizeDocumentType(pickString(row, ["dokument_typ", "doc_type", "document_type", "type", "typ"], "rapport"));
  return {
    id: pickString(row, ["id"], `doc-${index + 1}`),
    ticket_id: pickString(row, ["ticket_id"], ticket.id),
    dokument_typ: typ,
    dokument_nummer: pickString(row, ["dokument_nummer"], `${docTypeToPrefix(typ)}-${new Date().getFullYear()}-0001`),
    status: normalizeDocumentStatus(pickString(row, ["status"], "entwurf")),
    data: parseDocumentData(row.data, ticket),
    created_at: pickString(row, ["created_at"], new Date(0).toISOString()),
    updated_at: pickString(row, ["updated_at"], pickString(row, ["created_at"], new Date(0).toISOString())),
  };
}

function defaultDocumentData(type: DocumentType, ticket: Ticket): DocumentData {
  return {
    ticket_nummer: ticket.ticket_nummer,
    dokument_datum: new Date().toISOString().slice(0, 10),
    referenz: ticket.ticket_nummer,
    kunde: ticketRecipientName(ticket),
    kunde_name: ticket.kunde_name,
    ansprechpartner: ticket.ansprechpartner || "",
    betreut_durch: "Robert Kusminov",
    kunde_firma: ticket.kunde_firma,
    kunde_email: ticket.kunde_email,
    kunde_telefon: ticket.kunde_telefon,
    objekt_adresse: ticketObjectAddress(ticket),
    objekt_strasse: String(ticket.objekt_strasse || "").trim(),
    objekt_plz: String(ticket.objekt_plz || "").trim(),
    objekt_ort: String(ticket.objekt_ort || "").trim(),
    leistungsbeschreibung: ticket.beschreibung,
    zahlungsziel_tage: 7,
    zahlungshinweis: "Zahlung per Überweisung nach Erhalt.",
    zeiten: { ankunft: null, beginn: null, ende: null, gesamtstunden: 0 },
    materialliste: [],
    fotodokumentation: [],
    hinweise: "",
    leistungszeitraum: ticket.terminwunsch || null,
    bankverbindung: null,
    signatur_kunde_label: "Unterschrift Kunde (Arbeitsbestätigung)",
    signatur_kusi_label: "Unterschrift KusiPrimeTec",
    signatur_kunde_image: null,
    signatur_kusi_image: null,
  };
}

async function insertTicketAdaptive(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = { ...payload };
  const categoryCandidates = body.kategorie !== undefined ? categoryWriteCandidates(body.kategorie) : [];
  const customerTypeCandidates = customerTypeWriteCandidates(
    (normalizeCustomerType(body.customer_type) || null) as CustomerType | null
  );
  const priorityCandidates =
    body.dringlichkeit !== undefined || body.priority !== undefined
      ? priorityWriteCandidates(body.dringlichkeit ?? body.priority)
      : [];
  let categoryIndex = 0;
  let customerTypeIndex = 0;
  let priorityIndex = 0;

  for (let i = 0; i < 80; i += 1) {
    if (body.kategorie !== undefined && categoryCandidates.length > 0) {
      const candidate = categoryCandidates[categoryIndex];
      body.kategorie = candidate;
      if (body.category !== undefined) body.category = candidate;
    }
    if (customerTypeCandidates.length > 0 && body.customer_type !== undefined) {
      body.customer_type = customerTypeCandidates[customerTypeIndex];
    }
    if (priorityCandidates.length > 0) {
      const candidate = priorityCandidates[priorityIndex];
      if (body.dringlichkeit !== undefined) body.dringlichkeit = candidate;
      if (body.priority !== undefined) body.priority = candidate;
    }

    const { data, error } = await supabase.from("tickets").insert(body).select("*").limit(1);
    if (!error && Array.isArray(data) && data.length > 0) return data[0] as Record<string, unknown>;
    if (!error) throw new Error("Ticket konnte nicht gespeichert werden.");

    if (body.kategorie !== undefined && isCategoryConstraintError(error)) {
      if (categoryIndex < categoryCandidates.length - 1) {
        categoryIndex += 1;
        continue;
      }
    }
    if (body.customer_type !== undefined && isCustomerTypeConstraintError(error)) {
      if (customerTypeIndex < customerTypeCandidates.length - 1) {
        customerTypeIndex += 1;
        continue;
      }
    }
    if ((body.dringlichkeit !== undefined || body.priority !== undefined) && isPriorityConstraintError(error)) {
      if (priorityIndex < priorityCandidates.length - 1) {
        priorityIndex += 1;
        continue;
      }
    }
    if (isTimeRangeTypeError(error)) {
      if (stripUnsafeRangeWindowFields(body)) continue;
    }

    const missing = extractMissingColumn(error, "tickets");
    if (missing) {
      delete body[missing];
      continue;
    }

    throw new Error(error.message);
  }

  throw new Error("Tickets-Schema ist nicht kompatibel (zu viele unbekannte Spalten).");
}

async function updateTicketAdaptive(id: string, patch: Record<string, unknown>): Promise<void> {
  const body: Record<string, unknown> = { ...patch };
  const originalKeys = Object.keys(body);
  const statusCandidates = body.status !== undefined ? statusWriteCandidates(body.status) : [];
  let statusIndex = 0;

  while (Object.keys(body).length > 0) {
    if (body.status !== undefined && statusCandidates.length > 0) {
      body.status = statusCandidates[statusIndex];
    }

    const { error } = await supabase.from("tickets").update(body).eq("id", id);
    if (!error) return;

    if (body.status !== undefined && isStatusConstraintError(error)) {
      if (statusIndex < statusCandidates.length - 1) {
        statusIndex += 1;
        continue;
      }

      delete body.status;
      if (Object.keys(body).length === 0) {
        throw new Error(
          "Status kann mit aktueller DB-Constraint nicht gespeichert werden. Bitte Status-Constraint Migration ausführen."
        );
      }
      continue;
    }

    const missing = extractMissingColumn(error, "tickets");
    if (missing) {
      delete body[missing];
      continue;
    }

    throw new Error(error.message);
  }

  if (originalKeys.length > 0 && Object.keys(body).length === 0) {
    return;
  }
}

async function findOrCreateCustomerFallback(payload: TicketWizardPayload): Promise<string | null> {
  const email = normalizeCustomerEmail(payload.kunde_email);
  const phone = normalizeCustomerPhone(payload.kunde_telefon);
  const customerType = normalizeCustomerType(payload.customer_type) || "privat";
  const companyName = sanitizeCustomerText(payload.kunde_firma);
  const contactPerson = sanitizeCustomerText(payload.ansprechpartner);
  const kundeName = sanitizeCustomerText(payload.kunde_name);
  const invoiceRecipientName = resolveInvoiceRecipientName({
    customerType,
    kundeName,
    kundeFirma: companyName,
  });
  const displayName = resolveCustomerDisplayName({
    customerType,
    invoiceRecipientName,
    kundeName,
    kundeFirma: companyName,
  });

  if (!email && !phone) return null;

  const findByEmail = async (): Promise<string | null> => {
    if (!email) return null;
    const pickByNormalizedEmail = (rows: Record<string, unknown>[]): string | null => {
      for (const row of rows) {
        const rowId = String(row.id || "").trim();
        const rowEmail = normalizeCustomerEmail(row.email);
        if (rowId && rowEmail && rowEmail === email) return rowId;
      }
      return null;
    };

    const { data, error } = await supabase.from("customers").select("id,email").ilike("email", email).limit(10);
    if (!error && Array.isArray(data)) {
      const exact = pickByNormalizedEmail(data as Record<string, unknown>[]);
      if (exact) return exact;
      const { data: looseData, error: looseError } = await supabase
        .from("customers")
        .select("id,email")
        .ilike("email", `%${email}%`)
        .limit(40);
      if (!looseError && Array.isArray(looseData)) {
        return pickByNormalizedEmail(looseData as Record<string, unknown>[]);
      }
      if (looseError) {
        if (isMissingTable(looseError, "customers")) return null;
        if (extractMissingColumn(looseError, "customers")) return null;
        throw new Error(looseError.message);
      }
      return null;
    }
    if (!error) return null;
    if (isMissingTable(error, "customers")) return null;
    if (extractMissingColumn(error, "customers")) return null;
    throw new Error(error.message);
  };

  const findByPhone = async (): Promise<string | null> => {
    if (!phone) return null;
    const { data, error } = await supabase.from("customers").select("id").eq("phone", phone).limit(2);
    if (!error && Array.isArray(data) && data.length > 0) {
      return String((data[0] as Record<string, unknown>).id || "").trim() || null;
    }
    if (!error) return null;
    if (isMissingTable(error, "customers")) return null;
    if (extractMissingColumn(error, "customers")) return null;
    throw new Error(error.message);
  };

  const existing = (await findByEmail()) || (await findByPhone());
  if (existing) return existing;

  const customerTypeCandidates = customerTypeWriteCandidates(customerType);
  let customerTypeIndex = 0;

  let insertBody: Record<string, unknown> = {
    customer_type: customerTypeCandidates[customerTypeIndex] ?? customerType,
    invoice_recipient_name: invoiceRecipientName || null,
    company_name: companyName || null,
    name: displayName || invoiceRecipientName || null,
    company: companyName || null,
    email: email || null,
    phone: phone || null,
    contact_person: contactPerson || null,
    source: "frontend_fallback",
  };

  for (let i = 0; i < 20; i += 1) {
    if (customerTypeCandidates.length > 0) {
      insertBody.customer_type = customerTypeCandidates[customerTypeIndex];
    }
    const { data, error } = await supabase.from("customers").insert(insertBody).select("id").limit(1);
    if (!error && Array.isArray(data) && data.length > 0) {
      return String((data[0] as Record<string, unknown>).id || "").trim() || null;
    }
    if (!error) break;

    const message = String(error.message || "").toLowerCase();
    if (message.includes("duplicate key")) {
      const found = (await findByEmail()) || (await findByPhone());
      if (found) return found;
    }
    if (isCustomerTypeConstraintError(error) && customerTypeIndex < customerTypeCandidates.length - 1) {
      customerTypeIndex += 1;
      continue;
    }
    if (isMissingTable(error, "customers")) return null;

    const missing = extractMissingColumn(error, "customers");
    if (missing && Object.prototype.hasOwnProperty.call(insertBody, missing)) {
      delete insertBody[missing];
      continue;
    }
    if (missing) return null;
    throw new Error(error.message);
  }

  return (await findByEmail()) || (await findByPhone());
}

export async function createTicket(
  payload: TicketWizardPayload,
  token?: string
): Promise<{ ticket_id: string; ticket_nummer: string }> {
  const isLikelyAuthMismatch = (error: unknown): boolean => {
    const msg = String((error as { message?: string })?.message || "").toLowerCase();
    return (
      msg.includes("401") ||
      msg.includes("unauthorized") ||
      msg.includes("forbidden") ||
      msg.includes("jwt") ||
      msg.includes("token") ||
      msg.includes("session") ||
      msg.includes("auth")
    );
  };

  const postCreateTicket = async (
    requestPayload: TicketWizardPayload & { priority?: string }
  ): Promise<{ ticket_id: string; ticket_nummer: string }> => {
    try {
      return await apiPost<TicketWizardPayload & { priority?: string }, { ticket_id: string; ticket_nummer: string }>(
        "create-ticket",
        requestPayload,
        token
      );
    } catch (error) {
      if (token && isLikelyAuthMismatch(error)) {
        // Fallback: Edge Function ohne Admin-Token aufrufen (mit anon/apikey Headern).
        return await apiPost<TicketWizardPayload & { priority?: string }, { ticket_id: string; ticket_nummer: string }>(
          "create-ticket",
          requestPayload
        );
      }
      throw error;
    }
  };

  const cleanEmail = normalizeCustomerEmail(payload.kunde_email);
  const cleanPhone = normalizeCustomerPhone(payload.kunde_telefon);
  const normalizedType = normalizeCustomerType(payload.customer_type) || "privat";
  const requestType = anfrageartToRequestType(payload.request_type || payload.anfrageart);
  const anfrageart = requestTypeToAnfrageart(requestType);
  const cleanName = sanitizeCustomerText(payload.kunde_name);
  const cleanCompany = sanitizeCustomerText(payload.kunde_firma);
  const invoiceRecipientName = resolveInvoiceRecipientName({
    customerType: normalizedType,
    kundeName: cleanName,
    kundeFirma: cleanCompany,
  });
  const cleanPayload: TicketWizardPayload = {
    ...payload,
    idempotency_key: payload.idempotency_key || crypto.randomUUID(),
    request_type: requestType,
    anfrageart,
    customer_type: normalizedType,
    kunde_name: cleanName,
    kunde_firma: cleanCompany,
    kunde_email: cleanEmail,
    kunde_telefon: cleanPhone,
  };
  const priorityCandidates = priorityWriteCandidates(
    (cleanPayload as unknown as { dringlichkeit?: unknown; priority?: unknown }).dringlichkeit ??
      (cleanPayload as unknown as { priority?: unknown }).priority
  );
  const withPriorityCandidate = (
    source: TicketWizardPayload,
    candidate: string
  ): TicketWizardPayload & { priority?: string } => {
    const next = { ...(source as TicketWizardPayload & { priority?: string }) };
    next.dringlichkeit = candidate as TicketWizardPayload["dringlichkeit"];
    next.priority = candidate;
    return next;
  };

  if (!invoiceRecipientName) throw new Error("Name ist erforderlich.");
  if (normalizedType === "firma" && !cleanCompany) throw new Error("Bei Kundentyp Firma ist der Firmenname erforderlich.");
  if (!cleanPayload.kunde_email.trim() && !cleanPayload.kunde_telefon.trim()) {
    throw new Error("Mindestens E-Mail oder Telefon ist erforderlich.");
  }
  if (!cleanPayload.datenschutz_akzeptiert || !cleanPayload.agb_akzeptiert || !cleanPayload.haftung_koordination_akzeptiert) {
    throw new Error("Bitte Datenschutz, AGB und Haftung Koordination akzeptieren.");
  }

  return withFallback(
    async () => {
      let lastPriorityError: unknown = null;
      for (let i = 0; i < Math.max(1, priorityCandidates.length); i += 1) {
        const candidate = priorityCandidates[i] || String(cleanPayload.dringlichkeit || "mittel");
        const requestPayload = withPriorityCandidate(cleanPayload, candidate);
        try {
          return await postCreateTicket(requestPayload);
        } catch (error) {
          if (isPriorityConstraintError(error) && i < priorityCandidates.length - 1) {
            lastPriorityError = error;
            continue;
          }
          throw error;
        }
      }
      throw (lastPriorityError as Error) || new Error("Ticket konnte nicht erstellt werden.");
    },
    async () => {
      // Retrying the Edge endpoint is safe because every path reuses the same
      // persistent idempotency key. Direct browser-side database inserts are
      // intentionally no longer reachable for ticket creation.
      if (cleanPayload.idempotency_key) {
        return await postCreateTicket(
          withPriorityCandidate(cleanPayload, priorityCandidates[0] || String(cleanPayload.dringlichkeit || "mittel"))
        );
      }

      try {
        let lastInvokeError: Error | null = null;
        for (let i = 0; i < Math.max(1, priorityCandidates.length); i += 1) {
          const candidate = priorityCandidates[i] || String(cleanPayload.dringlichkeit || "mittel");
          const requestPayload = withPriorityCandidate(cleanPayload, candidate);
          const invoked = await supabase.functions.invoke("create-ticket", { body: requestPayload });
          if (!invoked.error && invoked.data && typeof invoked.data === "object") {
            const row = invoked.data as Record<string, unknown>;
            const ticketId = String(row.ticket_id || "").trim();
            const ticketNummer = String(row.ticket_nummer || "").trim();
            if (ticketId) {
              return { ticket_id: ticketId, ticket_nummer: ticketNummer };
            }
          }
          if (invoked.error) {
            const invokeError = new Error(invoked.error.message || "Ticket-Service aktuell nicht erreichbar.");
            if (isPriorityConstraintError(invokeError) && i < priorityCandidates.length - 1) {
              lastInvokeError = invokeError;
              continue;
            }
            throw invokeError;
          }
        }
        if (lastInvokeError) throw lastInvokeError;
      } catch (invokeError) {
        const { data: sessionProbe } = await supabase.auth.getSession();
        if (!sessionProbe.session) {
          throw invokeError instanceof Error
            ? invokeError
            : new Error("Ticket-Service aktuell nicht erreichbar. Bitte spaeter erneut versuchen.");
        }
      }

      const payload = cleanPayload;
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        throw new Error("Ticket-Service aktuell nicht erreichbar. Bitte spaeter erneut versuchen.");
      }

      let ticketNumber = "";
      try {
        const { data: numberData, error: numberError } = await supabase.rpc("next_ticket_number");
        if (!numberError && numberData) ticketNumber = String(numberData);
      } catch {
        // Fallback unten.
      }
      if (!ticketNumber) {
        const now = new Date();
        const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        const rnd = String(Date.now()).slice(-4);
        ticketNumber = `KPT-${dateKey}-${rnd}`;
      }

      const titel = (payload.beschreibung || "").split("\n")[0].trim().slice(0, 120) || `Anfrage ${payload.kategorie}`;
      const desiredWindow =
        payload.zeitfenster_von && payload.zeitfenster_bis
          ? `${payload.zeitfenster_von}-${payload.zeitfenster_bis}`
          : null;
      const displayWindow =
        payload.zeitfenster_von && payload.zeitfenster_bis
          ? `${payload.zeitfenster_von} - ${payload.zeitfenster_bis}`
          : null;
      const customerType = normalizeCustomerType(payload.customer_type) || "privat";
      const customerName = sanitizeCustomerText(payload.kunde_name);
      const customerCompany = sanitizeCustomerText(payload.kunde_firma) || null;
      const customerEmail = normalizeCustomerEmail(payload.kunde_email);
      const customerPhone = normalizeCustomerPhone(payload.kunde_telefon);
      const customerContact = sanitizeCustomerText(payload.ansprechpartner) || null;
      const recipientName = resolveInvoiceRecipientName({
        customerType,
        kundeName: customerName,
        kundeFirma: customerCompany,
      });
      const city = String(payload.objekt_ort || payload.ort || "").trim();
      const requestType = anfrageartToRequestType(payload.request_type || payload.anfrageart);
      const requestTypeLabel = requestTypeToAnfrageart(requestType);
      const priority = normalizePriorityKey(payload.dringlichkeit || "mittel");
      const category = String(payload.kategorie || "Sonstiges");
      const requestTime = payload.zeitfenster_von && payload.zeitfenster_bis
        ? `${payload.zeitfenster_von}-${payload.zeitfenster_bis}`
        : null;

      const insertBody: Record<string, unknown> = {
        ticket_nummer: ticketNumber,
        ticket_number: ticketNumber,
        bucket: "inbox",
        status: "Neu",
        anfrageart: requestTypeLabel,
        request_type: requestType,
        source: session?.user?.id ? "Kundenkonto" : "öffentlicher Website-Kontakt",
        subkategorie: payload.subkategorie || null,
        subcategory: payload.subkategorie || null,
        customer_type: customerType,
        invoice_recipient_name: recipientName || null,
        ansprechpartner: customerContact,
        kategorie: category,
        category,
        dringlichkeit: priority,
        priority,
        titel,
        title: titel,
        kunde_name: customerName,
        kunde_firma: customerCompany,
        kunde_email: customerEmail,
        kunde_telefon: customerPhone,
        customer_display_name: resolveCustomerDisplayName({
          customerType,
          invoiceRecipientName: recipientName,
          kundeName: customerName,
          kundeFirma: customerCompany,
        }),
        company_name: customerCompany,
        contact_person: customerContact,
        email: customerEmail,
        phone: customerPhone,
        objekt_adresse: payload.objekt_adresse,
        object_address: payload.objekt_adresse,
        objekt_strasse: payload.objekt_strasse || payload.objekt_adresse,
        objekt_plz: payload.objekt_plz || payload.plz,
        objekt_ort: payload.objekt_ort || payload.ort,
        access_notes: payload.access_notes || null,
        distanz_km: payload.distanz_km || payload.radius_km,
        distance_km: payload.distanz_km || payload.radius_km,
        outside_service_area: payload.outside_service_area || false,
        ort: city || payload.ort,
        city: city || payload.ort,
        plz: payload.plz,
        radius_km: payload.radius_km,
        terminwunsch: payload.terminwunsch || null,
        desired_date: payload.terminwunsch || null,
        requested_date: payload.terminwunsch || null,
        appointment_date: payload.terminwunsch || null,
        scheduled_at: payload.terminwunsch || null,
        scheduled_date: payload.terminwunsch || null,
        zeitfenster_von: payload.zeitfenster_von || null,
        zeitfenster_bis: payload.zeitfenster_bis || null,
        requested_time: payload.zeitfenster_von || null,
        preferred_time_window: displayWindow || requestTime,
        time_from: payload.zeitfenster_von || null,
        time_to: payload.zeitfenster_bis || null,
        window_from: payload.zeitfenster_von || null,
        window_to: payload.zeitfenster_bis || null,
        desired_time_window: desiredWindow,
        zeitfenster: displayWindow,
        window: desiredWindow,
        beschreibung: payload.beschreibung,
        description: payload.beschreibung,
        datenschutz_akzeptiert: payload.datenschutz_akzeptiert,
        agb_akzeptiert: payload.agb_akzeptiert,
        haftung_koordination_akzeptiert: payload.haftung_koordination_akzeptiert,
        privacy_accepted: payload.datenschutz_akzeptiert,
        terms_accepted: payload.agb_akzeptiert,
        liability_coordination_accepted: payload.haftung_koordination_akzeptiert,
      };

      try {
        const customerId = await findOrCreateCustomerFallback(payload);
        if (customerId) insertBody.customer_id = customerId;
      } catch {
        // Fallback darf Ticketanlage nicht blockieren.
      }

      const inserted = await insertTicketAdaptive(insertBody);
      const mapped = asTicket(inserted);

      if (payload.attachments?.length) {
        try {
          const attachments = payload.attachments.map((a) => ({
            ticket_id: mapped.id,
            file_name: a.name,
            mime_type: a.type,
            size_bytes: a.size,
            base64_content: a.base64,
          }));
          await supabase.from("ticket_attachments").insert(attachments);
        } catch {
          // Attachments optional im Legacy-Schema.
        }
      }

      return { ticket_id: mapped.id, ticket_nummer: mapped.ticket_nummer };
    }
  );
}

export async function adminDashboard(token: string): Promise<DashboardResponse> {
  return withPerfLog("admin_dashboard_load", async () =>
    withFallback(
      async () => normalizeDashboardResponse(await apiGet<DashboardResponse>("admin-dashboard", token)),
      async () => {
      const rows = await loadTicketsRaw();
      const activityRows = await loadActivityRaw(20);
      const now = Date.now();
      const weekAgo = now - 7 * 24 * 3600 * 1000;
      const prevWeekAgo = now - 14 * 24 * 3600 * 1000;
      const weekAhead = now + 7 * 24 * 3600 * 1000;
      const todayStart = startOfDayTs(now);

      const inboxRows = rows.filter((r) => normalizeBucket(r.bucket, normalizeStatus(r.status)) === "inbox");
      const activeRows = rows.filter((r) => normalizeBucket(r.bucket, normalizeStatus(r.status)) === "active");
      const archiveRows = rows.filter((r) => normalizeBucket(r.bucket, normalizeStatus(r.status)) === "archive");

      const offene = activeRows.filter((r) => normalizeStatus(r.status) !== "Rapport_erstellt" && normalizeStatus(r.status) !== "Storniert").length;

      const neue = rows.filter((r) => parseRowDate(r, ["created_at", "createdAt"]) >= weekAgo).length;
      const neuePrev = rows.filter((r) => {
        const created = parseRowDate(r, ["created_at", "createdAt"]);
        return created >= prevWeekAgo && created < weekAgo;
      }).length;
      const termine7 = activeRows.filter((r) => {
        const t = parseRowDate(r, ["terminwunsch", "desired_date", "appointment_date"]);
        return t >= now && t <= weekAhead;
      }).length;
      const terminePrev7 = activeRows.filter((r) => {
        const t = parseRowDate(r, ["terminwunsch", "desired_date", "appointment_date"]);
        return t >= weekAgo && t < now;
      }).length;

      const avgB =
        rows.reduce((acc, r) => {
          const created = pickString(r, ["created_at", "createdAt"], "");
          const conf = pickNullableString(r, ["bestaetigt_at", "confirmed_at"]);
          return acc + hoursDiff(created, conf);
        }, 0) / Math.max(rows.length, 1);

      const avgT =
        rows.reduce((acc, r) => {
          const created = pickString(r, ["created_at", "createdAt"], "");
          const plan = pickNullableString(r, ["termin_geplant_at", "scheduled_at"]);
          return acc + hoursDiff(created, plan);
        }, 0) / Math.max(rows.length, 1);

      const inboxNeu = inboxRows.length;
      const hochNotfall = activeRows.filter((r) => {
        const urgency = normalizeUrgency(r.dringlichkeit || r.priority);
        return urgency === "hoch" || urgency === "kritisch" || urgency === "notfall";
      }).length;
      const ohneTermin = activeRows.filter((r) => {
        const t = parseRowDate(r, ["terminwunsch", "desired_date", "appointment_date"]);
        return t === 0;
      }).length;
      const heuteFaellig = activeRows.filter((r) => {
        const t = parseRowDate(r, ["terminwunsch", "desired_date", "appointment_date"]);
        return isToday(t, todayStart);
      }).length;

      const openPrev = activeRows.filter((r) => {
        const created = parseRowDate(r, ["created_at", "createdAt"]);
        return created >= prevWeekAgo && created < weekAgo;
      }).length;

      const ticketSeries = computeTicketSeries(rows, 30);
      const funnelPreview = [
        { label: "Inbox", value: inboxRows.length },
        { label: "Aktiv", value: activeRows.length },
        { label: "Archiv", value: archiveRows.length },
        { label: "Rapport erstellt", value: rows.filter((r) => normalizeStatus(r.status) === "Rapport_erstellt").length },
      ];
      const mappedTickets = mapListRows(rows)
        .filter((ticket) => ticket.bucket === "active")
        .slice(0, 80);
      const activities = mapActivities(activityRows).slice(0, 20);

      return {
        kpis: {
          neue_tickets: neue,
          offene_tickets: offene,
          termine_7_tage: termine7,
          avg_bestaetigung_stunden: Number(avgB.toFixed(2)),
          avg_termin_stunden: Number(avgT.toFixed(2)),
          inbox_neu: inboxNeu,
          hoch_notfall: hochNotfall,
          ohne_termin: ohneTermin,
          heute_faellig: heuteFaellig,
          objektbetreuung_anfragen: 0,
        },
        trends: {
          neue_tickets: trend(neue, neuePrev),
          offene_tickets: trend(offene, openPrev),
          termine_7_tage: trend(termine7, terminePrev7),
        },
        tickets: mappedTickets,
        activities,
        agent_messages: [],
        tickets_pro_tag_30: ticketSeries,
        funnel_preview: funnelPreview,
        inquiry_summary: {
          total_open: 0,
          follow_up_due: 0,
          latest_requested_at: null,
        },
      };
      }
    )
  );
}

export async function adminDashboardSeries(token: string): Promise<{ label: string; value: number }[]> {
  return withFallback(
    async () => {
      const data = await apiGet<Partial<DashboardResponse>>("admin-dashboard?view=series", token);
      const normalized = normalizeDashboardResponse(data);
      return normalized.tickets_pro_tag_30;
    },
    async () => {
      const rows = await loadTicketsRaw();
      return computeTicketSeries(rows, 30);
    }
  );
}

export async function adminTickets(token: string, params: Record<string, string>): Promise<TicketListResponse> {
  return withPerfLog("admin_tickets_load", async () =>
    withFallback(
      async () => {
        const query = new URLSearchParams(params).toString();
        const res = await apiGet<TicketListResponse>(`admin-tickets?${query}`, token);
        const items = Array.isArray(res.items)
          ? mapListRows(res.items as unknown as Record<string, unknown>[])
          : [];
        return {
          items,
          total: Number(res.total || items.length || 0),
          page: Number(res.page || 1),
          page_count: Number(res.page_count || 1),
        };
      },
      async () => {
      const q = String(params.q || "").trim().toLowerCase();
      const status = String(params.status || "").trim();
      const requestType = String(params.request_type || "").trim().toLowerCase();
      const urgency = String(params.urgency || "").trim().toLowerCase();
      const category = String(params.category || "").trim();
      const withoutSchedule = String(params.without_schedule || "0") === "1";
      const dueToday = String(params.due_today || "0") === "1";
      const bucketParam = String(params.bucket || "").trim().toLowerCase();
      const archiveMode = String(params.archive || "0") === "1";
      const sort = String(params.sort || "created_desc");
      const page = Math.max(Number(params.page || 1) || 1, 1);
      const pageSize = Math.min(Math.max(Number(params.page_size || 20) || 20, 1), 100);
      const todayStart = startOfDayTs();

      let rows = await loadTicketsRaw();

      const bucket = bucketParam === "inbox" || bucketParam === "active" || bucketParam === "archive" || bucketParam === "all"
        ? bucketParam
        : archiveMode
          ? "archive"
          : "active";

      if (bucket === "archive") rows = rows.filter((r) => isArchivedRow(r));
      if (bucket === "active") rows = rows.filter((r) => isOpenRow(r));
      if (bucket === "inbox") {
        rows = rows.filter((r) => normalizeBucket(r.bucket, normalizeStatus(r.status)) === "inbox");
      }

      if (status) {
        const wanted = status.split(",").map((s) => s.trim()).filter(Boolean);
        rows = rows.filter((r) => wanted.includes(normalizeStatus(r.status)));
      }

      if (requestType) {
        rows = rows.filter((r) => {
          const normalized = anfrageartToRequestType(r.request_type || r.anfrageart || r.source);
          if (requestType === "direkt" || requestType === "direkt_einsatz" || requestType === "direct") return normalized === "direct";
          if (requestType === "angebot" || requestType === "angebot_anfordern" || requestType === "offer") return normalized === "offer";
          return true;
        });
      }

      if (category) {
        rows = rows.filter((r) => String(r.kategorie || r.category || "").trim() === category);
      }

      if (urgency) {
        rows = rows.filter((r) => {
          const u = normalizeUrgency(r.dringlichkeit || r.priority);
          if (urgency === "hoch_notfall") return u === "hoch" || u === "kritisch" || u === "notfall";
          return u === urgency;
        });
      }

      if (withoutSchedule) {
        rows = rows.filter((r) => parseRowDate(r, ["terminwunsch", "desired_date", "appointment_date"]) === 0);
      }

      if (dueToday) {
        rows = rows.filter((r) => {
          const t = parseRowDate(r, ["terminwunsch", "desired_date", "appointment_date"]);
          return isToday(t, todayStart);
        });
      }

      if (q) {
        rows = rows.filter((r) => {
          const hay = [
            r.ticket_nummer,
            r.ticket_number,
            r.ticket_nr,
            r.report_number,
            r.kunde_name,
            r.kunde_firma,
            r.kunde_email,
            r.kunde_telefon,
            r.objekt_adresse,
            r.objekt_strasse,
            r.objekt_ort,
            r.ort,
            r.plz,
            r.customer_name,
            r.customer_email,
          ]
            .map((v) => String(v || "").toLowerCase())
            .join(" ");
          return hay.includes(q);
        });
      }

      rows.sort((a, b) => {
        if (sort === "due_asc") {
          const ad = parseRowDate(a, ["terminwunsch", "desired_date", "appointment_date"]);
          const bd = parseRowDate(b, ["terminwunsch", "desired_date", "appointment_date"]);
          if (!ad && !bd) return 0;
          if (!ad) return 1;
          if (!bd) return -1;
          return ad - bd;
        }

        if (sort === "priority_desc") {
          const rank = (row: Record<string, unknown>) => {
            const u = normalizeUrgency(row.dringlichkeit || row.priority);
            if (u === "notfall" || u === "kritisch") return 3;
            if (u === "hoch") return 2;
            if (u === "mittel") return 1;
            return 0;
          };
          return rank(b) - rank(a);
        }

        const d = parseRowDate(a, ["created_at", "createdAt"]) - parseRowDate(b, ["created_at", "createdAt"]);
        return sort === "created_asc" ? d : -d;
      });

      const total = rows.length;
      const pageCount = Math.max(Math.ceil(total / pageSize), 1);
      const safePage = Math.min(page, pageCount);
      const start = (safePage - 1) * pageSize;
      const end = start + pageSize;

      return {
        items: mapListRows(rows.slice(start, end)),
        total,
        page: safePage,
        page_count: pageCount,
      };
      }
    )
  );
}

export async function adminTicketDetail(token: string, id: string): Promise<TicketDetailResponse> {
  return withPerfLog("admin_ticket_detail_load", async () =>
    withFallback(
      async () => {
      const raw = await apiGet<Partial<TicketDetailResponse> & { ticket: Ticket; audit?: unknown[] }>(
        `admin-ticket-detail?id=${encodeURIComponent(id)}`,
        token
      );

      const ticket = asTicket(raw.ticket as unknown as Record<string, unknown>);
      const audit = Array.isArray(raw.audit) ? (raw.audit as TicketDetailResponse["audit"]) : [];
      const attachments = Array.isArray(raw.attachments)
        ? (raw.attachments as unknown as Record<string, unknown>[]).map((row, idx) => mapAttachment(row, idx))
        : [];
      const documents = Array.isArray(raw.documents)
        ? (raw.documents as unknown as Record<string, unknown>[]).map((row, idx) => mapTicketDocument(row, ticket, idx))
        : [];

      return {
        ticket,
        audit,
        attachments,
        documents,
      };
      },
      async () => {
      const { data: ticketRows, error: ticketError } = await supabase.from("tickets").select("*").eq("id", id).limit(2);
      const ticketRow = Array.isArray(ticketRows) ? ticketRows[0] : null;
      if (ticketError || !ticketRow) throw new Error(ticketError?.message || "Ticket nicht gefunden.");
      const ticket = asTicket(ticketRow as Record<string, unknown>);

      let audit: TicketDetailResponse["audit"] = [];
      try {
        const { data: events, error: eventError } = await supabase
          .from("ticket_events")
          .select("id,ticket_id,event_typ,detail,actor,created_at")
          .eq("ticket_id", id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (!eventError || !isMissingTable(eventError, "ticket_events")) {
          audit = (events || []).map((row, idx) => ({
            id: pickString(row as Record<string, unknown>, ["id"], `evt-${idx + 1}`),
            ticket_id: pickString(row as Record<string, unknown>, ["ticket_id"], id),
            event: pickString(row as Record<string, unknown>, ["event_typ"], "ticket_update"),
            detail: pickString(row as Record<string, unknown>, ["detail"], ""),
            actor: pickString(row as Record<string, unknown>, ["actor"], "System"),
            created_at: pickString(row as Record<string, unknown>, ["created_at"], new Date(0).toISOString()),
          }));
        }
      } catch {
        audit = [];
      }

      let attachments: TicketAttachment[] = [];
      try {
        const { data: rows, error: aErr } = await supabase
          .from("ticket_attachments")
          .select("id,file_name,storage_url,mime_type,created_at")
          .eq("ticket_id", id)
          .order("created_at", { ascending: false });
        if (!aErr) attachments = (rows || []).map((row, idx) => mapAttachment(row as Record<string, unknown>, idx));
      } catch {
        attachments = [];
      }

      let documentRows: Record<string, unknown>[] = [];
      try {
        const { data: rows, error: dErr } = await supabase
          .from("ticket_documents")
          .select("id,ticket_id,dokument_typ,dokument_nummer,status,data,created_at,updated_at")
          .eq("ticket_id", id)
          .order("created_at", { ascending: false });
        if (!dErr) documentRows = (rows || []) as Record<string, unknown>[];
      } catch {
        documentRows = [];
      }

      const sourceRows = await loadSourceDocumentsAdaptive(id);
      const documents = mergeDocumentRows(documentRows, sourceRows).map((row, idx) => mapTicketDocument(row, ticket, idx));

      return { ticket, audit, attachments, documents };
      }
    )
  );
}

export interface UpdateTicketPayload {
  object_id?: string | null;
  customer_id?: string | null;
  status?: TicketStatus;
  bucket?: TicketBucket;
  action?: "accept" | "reject";
  rejected_reason?: string | null;
  terminwunsch?: string | null;
  beschreibung?: string;
  internal_note?: string | null;
  titel?: string;
  kategorie?: string;
  subkategorie?: string | null;
  dringlichkeit?: "niedrig" | "mittel" | "hoch" | "kritisch";
  anfrageart?: Anfrageart;
  request_type?: RequestType;
  customer_type?: CustomerType | null;
  ansprechpartner?: string | null;
  kunde_name?: string;
  kunde_firma?: string;
  kunde_email?: string;
  kunde_telefon?: string;
  objekt_adresse?: string;
  objekt_strasse?: string | null;
  objekt_plz?: string | null;
  objekt_ort?: string | null;
  access_notes?: string | null;
  zeitfenster_von?: string | null;
  zeitfenster_bis?: string | null;
}

export async function updateTicket(token: string, id: string, payload: UpdateTicketPayload): Promise<{ ok: true }> {
  const runLocalFallback = async (): Promise<{ ok: true }> => {
    const patch: Record<string, unknown> = {};
    if (payload.object_id !== undefined) patch.object_id = payload.object_id;
    if (payload.customer_id !== undefined) patch.customer_id = payload.customer_id;
    if (payload.bucket !== undefined) patch.bucket = payload.bucket;
    if (payload.status !== undefined) patch.status = payload.status;
    if (payload.terminwunsch !== undefined) {
      patch.terminwunsch = payload.terminwunsch;
      patch.desired_date = payload.terminwunsch;
      patch.appointment_date = payload.terminwunsch;
    }
    if (payload.beschreibung !== undefined) {
      patch.beschreibung = payload.beschreibung;
      patch.description = payload.beschreibung;
      patch.details = payload.beschreibung;
    }
    if (payload.internal_note !== undefined) patch.internal_note = payload.internal_note;
    if (payload.rejected_reason !== undefined) patch.rejected_reason = payload.rejected_reason;
    if (payload.titel !== undefined) {
      patch.titel = payload.titel;
      patch.title = payload.titel;
      patch.subject = payload.titel;
    }
    if (payload.kategorie !== undefined) {
      patch.kategorie = payload.kategorie;
      patch.category = payload.kategorie;
    }
    if (payload.subkategorie !== undefined) {
      patch.subkategorie = payload.subkategorie;
      patch.subcategory = payload.subkategorie;
    }
    if (payload.dringlichkeit !== undefined) {
      patch.dringlichkeit = payload.dringlichkeit;
      patch.priority = payload.dringlichkeit;
    }
    if (payload.anfrageart !== undefined || payload.request_type !== undefined) {
      const requestType = anfrageartToRequestType(payload.request_type || payload.anfrageart);
      patch.request_type = requestType;
      patch.anfrageart = requestTypeToAnfrageart(requestType);
    }
    const normalizedType = payload.customer_type !== undefined ? normalizeCustomerType(payload.customer_type) : null;
    if (payload.customer_type !== undefined) {
      patch.customer_type = normalizedType || payload.customer_type;
      patch.kunde_typ = normalizedType || payload.customer_type;
    }
    if (payload.ansprechpartner !== undefined) {
      patch.ansprechpartner = payload.ansprechpartner;
      patch.contact_person = payload.ansprechpartner;
      patch.contact_name = payload.ansprechpartner;
    }
    if (payload.kunde_name !== undefined) {
      patch.kunde_name = sanitizeCustomerText(payload.kunde_name);
      patch.customer_name = sanitizeCustomerText(payload.kunde_name);
      patch.contact_name = sanitizeCustomerText(payload.kunde_name);
      patch.contact_person = sanitizeCustomerText(payload.kunde_name);
      patch.name = sanitizeCustomerText(payload.kunde_name);
    }
    if (payload.kunde_firma !== undefined) {
      patch.kunde_firma = sanitizeCustomerText(payload.kunde_firma);
      patch.company_name = sanitizeCustomerText(payload.kunde_firma);
      patch.customer_company = sanitizeCustomerText(payload.kunde_firma);
      patch.firma = sanitizeCustomerText(payload.kunde_firma);
    }
    if (payload.kunde_email !== undefined) {
      patch.kunde_email = normalizeCustomerEmail(payload.kunde_email);
      patch.customer_email = normalizeCustomerEmail(payload.kunde_email);
      patch.email = normalizeCustomerEmail(payload.kunde_email);
    }
    if (payload.kunde_telefon !== undefined) {
      patch.kunde_telefon = normalizeCustomerPhone(payload.kunde_telefon);
      patch.customer_phone = normalizeCustomerPhone(payload.kunde_telefon);
      patch.telefon = normalizeCustomerPhone(payload.kunde_telefon);
      patch.phone = normalizeCustomerPhone(payload.kunde_telefon);
    }
    if (payload.customer_type !== undefined || payload.kunde_name !== undefined || payload.kunde_firma !== undefined) {
      const invoiceRecipientName = resolveInvoiceRecipientName({
        customerType: normalizedType || payload.customer_type,
        kundeName: payload.kunde_name,
        kundeFirma: payload.kunde_firma,
      });
      const customerDisplayName = resolveCustomerDisplayName({
        customerType: normalizedType || payload.customer_type,
        invoiceRecipientName,
        kundeName: payload.kunde_name,
        kundeFirma: payload.kunde_firma,
      });
      patch.invoice_recipient_name = invoiceRecipientName || null;
      patch.customer_display_name = customerDisplayName || null;
    }
    if (payload.objekt_adresse !== undefined) {
      patch.objekt_adresse = payload.objekt_adresse;
      patch.object_address = payload.objekt_adresse;
      patch.address = payload.objekt_adresse;
    }
    if (payload.objekt_strasse !== undefined) {
      patch.objekt_strasse = payload.objekt_strasse;
      patch.object_street = payload.objekt_strasse;
      patch.street = payload.objekt_strasse;
    }
    if (payload.objekt_plz !== undefined) {
      patch.objekt_plz = payload.objekt_plz;
      patch.object_zip = payload.objekt_plz;
      patch.zip = payload.objekt_plz;
      patch.postal_code = payload.objekt_plz;
    }
    if (payload.objekt_ort !== undefined) {
      patch.objekt_ort = payload.objekt_ort;
      patch.object_city = payload.objekt_ort;
      patch.city = payload.objekt_ort;
      patch.ort = payload.objekt_ort;
    }
    if (payload.access_notes !== undefined) {
      patch.access_notes = payload.access_notes;
      patch.zugangshinweise = payload.access_notes;
    }
    if (payload.zeitfenster_von !== undefined) {
      patch.zeitfenster_von = payload.zeitfenster_von;
      patch.time_from = payload.zeitfenster_von;
      patch.window_from = payload.zeitfenster_von;
    }
    if (payload.zeitfenster_bis !== undefined) {
      patch.zeitfenster_bis = payload.zeitfenster_bis;
      patch.time_to = payload.zeitfenster_bis;
      patch.window_to = payload.zeitfenster_bis;
    }

    if (payload.action === "accept") {
      patch.bucket = "active";
      patch.accepted_at = new Date().toISOString();
      patch.rejected_at = null;
    }
    if (payload.action === "reject") {
      patch.bucket = "archive";
      patch.status = "Storniert";
      patch.rejected_at = new Date().toISOString();
    }

    if (payload.status === "Geprueft") patch.bestaetigt_at = new Date().toISOString();
    if (payload.status === "Termin_geplant") patch.termin_geplant_at = new Date().toISOString();
    if (payload.status === "Neu") patch.bucket = "inbox";
    if (payload.status === "Rapport_erstellt" || payload.status === "Storniert") patch.bucket = "archive";

    if (Object.keys(patch).length > 0) await updateTicketAdaptive(id, patch);

    try {
      const eventType = payload.action === "accept" ? "accepted" : payload.action === "reject" ? "rejected" : "ticket_update";
      const detail =
        payload.action === "accept"
          ? "Ticket aus Inbox angenommen"
          : payload.action === "reject"
            ? `Ticket abgelehnt${payload.rejected_reason ? `: ${payload.rejected_reason}` : ""}`
            : "Ticket aktualisiert";
      await supabase.from("ticket_events").insert({
        ticket_id: id,
        event_typ: eventType,
        detail,
        actor: "admin",
        metadata: patch,
      });
    } catch {
      // Optional in Legacy-Schema.
    }

    return { ok: true };
  };

  return withFallback(
    () => apiPost<UpdateTicketPayload & { id: string }, { ok: true }>("admin-ticket-update", { ...payload, id }, token),
    runLocalFallback
  );
}

export interface OpsAgentRunResponse {
  short_assessment?: string;
  structured_data?: Record<string, unknown>;
  next_actions?: string[];
  open_questions?: string[];
  meta?: Record<string, unknown>;
  error?: string;
}

export async function runOpsAgent(token: string, payload: Record<string, unknown>): Promise<OpsAgentRunResponse> {
  return await apiPost<Record<string, unknown>, OpsAgentRunResponse>("ops-agent-run", payload, token);
}

export async function ackAgentMessage(token: string, runId: string): Promise<{ ok: boolean }> {
  const run_id = String(runId || "").trim();
  if (!run_id) throw new Error("run_id fehlt.");
  return await apiPost<{ run_id: string }, { ok: boolean }>("admin-agent-message-ack", { run_id }, token);
}

export async function deleteTicket(_token: string, id: string): Promise<{ ok: true }> {
  const ticketId = String(id || "").trim();
  if (!ticketId) throw new Error("Ticket-ID fehlt.");

  const { error } = await supabase.from("tickets").delete().eq("id", ticketId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteCustomerTickets(_token: string, ticketIds: string[]): Promise<{ ok: true; deleted: number }> {
  const ids = [...new Set((ticketIds || []).map((v) => String(v || "").trim()).filter(Boolean))];
  if (!ids.length) return { ok: true, deleted: 0 };

  const { error, count } = await supabase
    .from("tickets")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) throw new Error(error.message);

  return { ok: true, deleted: Number(count ?? ids.length) };
}

export async function createDocument(
  token: string,
  ticketId: string,
  typ: "rapport"
): Promise<{ pdf_url: string; dokument_nummer: string }> {
  return withFallback(
    () =>
      apiPost<{ ticket_id: string; typ: string }, { pdf_url: string; dokument_nummer: string }>(
        "documents-create",
        { ticket_id: ticketId, typ },
        token
      ),
    async () => {
      throw new Error("Dokument-Service nicht erreichbar. Bitte Edge Functions deployen (documents-create).");
    }
  );
}

async function loadTicketDocumentRows(ticketId: string): Promise<Record<string, unknown>[]> {
  const cols = [
    "id",
    "ticket_id",
    "dokument_typ",
    "doc_type",
    "document_type",
    "type",
    "typ",
    "dokument_nummer",
    "status",
    "data",
    "created_at",
    "updated_at",
  ];
  for (let i = 0; i < 10; i += 1) {
    const { data, error } = await supabase
      .from("ticket_documents")
      .select(cols.join(","))
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });
    if (!error) return (data || []) as unknown as Record<string, unknown>[];
    const missing = extractMissingColumn(error, "ticket_documents");
    if (!missing) throw new Error(error.message);
    const idx = cols.indexOf(missing);
    if (idx >= 0) cols.splice(idx, 1);
  }
  return [];
}

async function loadDocumentRowById(documentId: string): Promise<Record<string, unknown> | null> {
  const cols = [
    "id",
    "ticket_id",
    "dokument_typ",
    "doc_type",
    "document_type",
    "type",
    "typ",
    "dokument_nummer",
    "status",
    "data",
    "created_at",
    "updated_at",
  ];
  for (let i = 0; i < 10; i += 1) {
    const { data, error } = await supabase.from("ticket_documents").select(cols.join(",")).eq("id", documentId).limit(1);
    if (!error) {
      if (Array.isArray(data) && data.length > 0) return (data[0] || null) as unknown as Record<string, unknown> | null;
      return null;
    }
    const missing = extractMissingColumn(error, "ticket_documents");
    if (!missing) throw new Error(error.message);
    const idx = cols.indexOf(missing);
    if (idx >= 0) cols.splice(idx, 1);
  }
  return null;
}

async function loadSourceDocumentBySyntheticId(documentId: string): Promise<Record<string, unknown> | null> {
  const match = /^src-(reports)-(.+)$/i.exec(String(documentId || "").trim());
  if (!match) return null;
  const table = String(match[1] || "").toLowerCase() as "reports";
  const sourceId = String(match[2] || "").trim();
  if (!sourceId) return null;

  let cols = ["id", "ticket_id", "document_number", "status", "data", "created_at", "updated_at"];
  for (let i = 0; i < 10 && cols.length; i += 1) {
    const { data, error } = await supabase.from(table).select(cols.join(",")).eq("id", sourceId).limit(1);
    if (!error) {
      const row = Array.isArray(data) ? (((data[0] as unknown as Record<string, unknown>) || null)) : null;
      if (!row) return null;
      const typ: DocumentType = "rapport";
      const number = pickString(row, ["document_number"], "").trim();
      if (!number) return null;
      return {
        id: `src-${table}-${sourceId}`,
        ticket_id: pickString(row, ["ticket_id"], ""),
        dokument_typ: typ,
        doc_type: toLegacyDocType(typ),
        document_type: toLegacyDocType(typ),
        type: typ,
        typ,
        dokument_nummer: number,
        status: normalizeDocumentStatus(row.status),
        data: row.data && typeof row.data === "object" ? row.data : {},
        created_at: pickString(row, ["created_at"], new Date(0).toISOString()),
        updated_at: pickString(row, ["updated_at", "created_at"], new Date(0).toISOString()),
        source_table: table,
        source_id: sourceId,
      };
    }
    if (isMissingTable(error, table)) return null;
    const missing = extractMissingColumn(error, table);
    if (!missing) throw new Error((error as { message?: string })?.message || "Quelle konnte nicht geladen werden.");
    cols = cols.filter((col) => col !== missing);
  }
  return null;
}

async function insertDocumentAdaptive(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = { ...payload };
  for (let i = 0; i < 10; i += 1) {
    const { data, error } = await supabase.from("ticket_documents").insert(body).select("*").limit(1);
    if (!error && Array.isArray(data) && data.length > 0) return data[0] as Record<string, unknown>;
    if (!error) throw new Error("Dokument konnte nicht erstellt werden.");
    const missing = extractMissingColumn(error, "ticket_documents");
    if (!missing) throw new Error(error.message);
    delete body[missing];
  }
  throw new Error("ticket_documents Schema nicht kompatibel.");
}

async function updateDocumentAdaptive(id: string, patch: Record<string, unknown>): Promise<void> {
  const body: Record<string, unknown> = { ...patch };
  while (Object.keys(body).length > 0) {
    const { error } = await supabase.from("ticket_documents").update(body).eq("id", id);
    if (!error) return;
    const missing = extractMissingColumn(error, "ticket_documents");
    if (!missing) throw new Error(error.message);
    delete body[missing];
  }
}

function isMissingRpcFunction(error: unknown, fnName: string): boolean {
  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    msg.includes(`could not find the function public.${fnName.toLowerCase()}`) ||
    (msg.includes("schema cache") && msg.includes(fnName.toLowerCase()))
  );
}

function formatDocumentNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(Math.max(1, sequence)).padStart(4, "0")}`;
}

function extractSequence(value: string): number {
  const m = String(value || "").match(/-(\d{1,8})$/);
  return m?.[1] ? Number(m[1]) : 0;
}

async function nextDocumentNumberFallback(prefix: string): Promise<string> {
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data: rows, error: rowErr } = await supabase
      .from("document_counters")
      .select("prefix,year,next_value")
      .eq("prefix", prefix)
      .limit(2);

    if (rowErr) {
      if (!isMissingTable(rowErr, "document_counters")) continue;
      break;
    }

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      const { error: insertErr } = await supabase.from("document_counters").insert({
        prefix,
        year,
        next_value: 2,
      });
      if (!insertErr) return formatDocumentNumber(prefix, year, 1);
      if (isMissingTable(insertErr, "document_counters")) break;
      continue;
    }

    const currentYear = Number((row as { year?: number }).year || year);
    const currentNext = Number((row as { next_value?: number }).next_value || 1);
    if (!Number.isFinite(currentNext) || currentNext < 1) continue;

    if (currentYear !== year) {
      const { data: updatedRows, error: resetErr } = await supabase
        .from("document_counters")
        .update({ year, next_value: 2, updated_at: new Date().toISOString() })
        .eq("prefix", prefix)
        .eq("year", currentYear)
        .select("next_value")
        .limit(1);
      const updated = Array.isArray(updatedRows) ? updatedRows[0] : null;
      if (!resetErr && updated) return formatDocumentNumber(prefix, year, 1);
      if (resetErr && isMissingTable(resetErr, "document_counters")) break;
      continue;
    }

    const { data: updatedRows, error: updateErr } = await supabase
      .from("document_counters")
      .update({ next_value: currentNext + 1, updated_at: new Date().toISOString() })
      .eq("prefix", prefix)
      .eq("year", year)
      .eq("next_value", currentNext)
      .select("next_value")
      .limit(1);
    const updated = Array.isArray(updatedRows) ? updatedRows[0] : null;
    if (!updateErr && updated) return formatDocumentNumber(prefix, year, currentNext);
    if (updateErr && isMissingTable(updateErr, "document_counters")) break;
  }

  const pattern = `${prefix}-${year}-%`;
  const { data: docs, error: docErr } = await supabase
    .from("ticket_documents")
    .select("dokument_nummer")
    .ilike("dokument_nummer", pattern)
    .limit(5000);

  if (docErr && !isMissingTable(docErr, "ticket_documents")) {
    throw new Error(docErr.message);
  }

  const max = (docs || []).reduce((acc, row) => {
    const nummer = String((row as { dokument_nummer?: string }).dokument_nummer || "");
    return Math.max(acc, extractSequence(nummer));
  }, 0);
  return formatDocumentNumber(prefix, year, max + 1);
}

async function nextDocumentNumber(prefix: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_document_number", { p_prefix: prefix });
  if (!error && data) return String(data);
  if (!error) return await nextDocumentNumberFallback(prefix);
  if (!isMissingRpcFunction(error, "next_document_number")) throw new Error(error.message);
  return await nextDocumentNumberFallback(prefix);
}

export async function getOrCreateTicketDocument(
  _token: string,
  ticketId: string,
  typ: DocumentType
): Promise<TicketDocument> {
  const { data: ticketRows, error: tErr } = await supabase.from("tickets").select("*").eq("id", ticketId).limit(2);
  const ticketRow = Array.isArray(ticketRows) ? ticketRows[0] : null;
  if (tErr || !ticketRow) throw new Error(tErr?.message || "Ticket nicht gefunden.");
  const ticket = asTicket(ticketRow as Record<string, unknown>);

  const existingRows = await loadTicketDocumentRows(ticketId);
  const existing = existingRows.find(
    (row) => normalizeDocumentType(pickString(row, ["dokument_typ", "doc_type", "document_type", "type", "typ"], "")) === typ
  );
  if (existing) {
    return mapTicketDocument(existing, ticket, 0);
  }

  const sourceRows = await loadSourceDocumentsAdaptive(ticketId, typ);
  if (sourceRows.length > 0) {
    const latest = sourceRows[0];
    const nummer = pickString(latest, ["dokument_nummer", "document_number"], "").trim() || await nextDocumentNumber(docTypeToPrefix(typ));
    const seededData =
      latest.data && typeof latest.data === "object"
        ? (latest.data as Record<string, unknown>)
        : defaultDocumentData(typ, ticket);
    const insertBody: Record<string, unknown> = {
      ticket_id: ticketId,
      dokument_typ: typ,
      doc_type: toLegacyDocType(typ),
      document_type: toLegacyDocType(typ),
      type: typ,
      typ,
      dokument_nummer: nummer,
      status: normalizeDocumentStatus(latest.status),
      data: seededData,
      storage_path: "",
      created_by: "admin",
      source_table: sourceTableForDocumentType(typ),
      source_id: pickString(latest, ["source_id", "id"], ""),
    };
    const inserted = await insertDocumentAdaptive(insertBody);
    return mapTicketDocument(inserted, ticket, 0);
  }

  const nummer = await nextDocumentNumber(docTypeToPrefix(typ));

  const insertBody: Record<string, unknown> = {
    ticket_id: ticketId,
    dokument_typ: typ,
    doc_type: toLegacyDocType(typ),
    document_type: toLegacyDocType(typ),
    type: typ,
    typ,
    dokument_nummer: String(nummer),
    status: "entwurf",
    data: defaultDocumentData(typ, ticket),
    storage_path: "",
    created_by: "admin",
  };
  const inserted = await insertDocumentAdaptive(insertBody);

  try {
    await supabase.from("ticket_events").insert({
      ticket_id: ticketId,
      event_typ: "dokument_erstellt",
      detail: `${typ} ${String(nummer)} erstellt`,
      actor: "admin",
    });
  } catch {
    // Optional in Legacy-Schema.
  }

  return mapTicketDocument(inserted, ticket, 0);
}

export async function loadTicketDocument(_token: string, documentId: string): Promise<TicketDocument> {
  let docRow = await loadDocumentRowById(documentId);
  if (!docRow) {
    const sourceRow = await loadSourceDocumentBySyntheticId(documentId);
    if (!sourceRow) throw new Error("Dokument nicht gefunden.");
    const ticketId = pickString(sourceRow, ["ticket_id"], "");
    if (!ticketId) throw new Error("Ticket zum Dokument nicht gefunden.");
    const { data: ticketRows, error: tErr } = await supabase.from("tickets").select("*").eq("id", ticketId).limit(2);
    const ticketRow = Array.isArray(ticketRows) ? ticketRows[0] : null;
    if (tErr || !ticketRow) throw new Error(tErr?.message || "Ticket zum Dokument nicht gefunden.");
    const ticket = asTicket(ticketRow as Record<string, unknown>);

    const sourceType = normalizeDocumentType(pickString(sourceRow, ["dokument_typ", "doc_type", "document_type", "type", "typ"], "rapport"));
    const sourceNumber = pickString(sourceRow, ["dokument_nummer", "document_number"], "").trim();
    const existingRows = await loadTicketDocumentRows(ticketId);
    const existing = existingRows.find((row) => {
      const sameType = normalizeDocumentType(pickString(row, ["dokument_typ", "doc_type", "document_type", "type", "typ"], "")) === sourceType;
      const sameNumber =
        pickString(row, ["dokument_nummer"], "").trim().toLowerCase() === sourceNumber.toLowerCase();
      return sameType && sameNumber;
    });
    if (existing) return mapTicketDocument(existing, ticket, 0);

    const seeded = await insertDocumentAdaptive({
      ticket_id: ticketId,
      dokument_typ: sourceType,
      doc_type: toLegacyDocType(sourceType),
      document_type: toLegacyDocType(sourceType),
      type: sourceType,
      typ: sourceType,
      dokument_nummer: sourceNumber || (await nextDocumentNumber(docTypeToPrefix(sourceType))),
      status: normalizeDocumentStatus(sourceRow.status),
      data: sourceRow.data && typeof sourceRow.data === "object" ? sourceRow.data : defaultDocumentData(sourceType, ticket),
      storage_path: "",
      created_by: "admin",
      source_table: sourceTableForDocumentType(sourceType),
      source_id: pickString(sourceRow, ["source_id"], ""),
    });
    return mapTicketDocument(seeded, ticket, 0);
  }

  const ticketId = pickString(docRow, ["ticket_id"], "");
  const { data: ticketRows, error: tErr } = await supabase.from("tickets").select("*").eq("id", ticketId).limit(2);
  const ticketRow = Array.isArray(ticketRows) ? ticketRows[0] : null;
  if (tErr || !ticketRow) throw new Error(tErr?.message || "Ticket zum Dokument nicht gefunden.");
  const ticket = asTicket(ticketRow as Record<string, unknown>);
  return mapTicketDocument(docRow, ticket, 0);
}

export async function saveTicketDocument(
  _token: string,
  documentId: string,
  payload: { data: DocumentData; status?: TicketDocument["status"] }
): Promise<{ ok: true; dokument_nummer?: string }> {
  const current = await loadDocumentRowById(documentId);
  const patch: Record<string, unknown> = {
    data: payload.data,
    updated_at: new Date().toISOString(),
  };
  let dokumentNummer = pickString(current || {}, ["dokument_nummer", "document_number"], "").trim();
  if (!dokumentNummer && current) {
    const typ = normalizeDocumentType(pickString(current, ["dokument_typ", "doc_type", "document_type", "type", "typ"], "rapport"));
    dokumentNummer = await nextDocumentNumber(docTypeToPrefix(typ));
    patch.dokument_nummer = dokumentNummer;
  }
  if (payload.status) patch.status = payload.status;
  await updateDocumentAdaptive(documentId, patch);
  return { ok: true, dokument_nummer: dokumentNummer || undefined };
}

export async function sendTicketDocumentEmail(
  token: string,
  payload: { document_id: string; to?: string; subject?: string; message?: string }
): Promise<{ ok: true; to: string; subject: string; attached: boolean; provider?: "smtp" | "graph"; bcc_count?: number }> {
  let authToken = String(token || "").trim();
  try {
    const { data } = await supabase.auth.getSession();
    const liveToken = String(data.session?.access_token || "").trim();
    if (liveToken) {
      authToken = liveToken;
    } else {
      const refreshed = await supabase.auth.refreshSession();
      const refreshedToken = String(refreshed.data.session?.access_token || "").trim();
      if (refreshedToken) authToken = refreshedToken;
    }
  } catch {
    // Fallback auf vorhandenen Token-Parameter.
  }

  return await apiPost<
    { document_id: string; to?: string; subject?: string; message?: string },
    { ok: true; to: string; subject: string; attached: boolean; provider?: "smtp" | "graph"; bcc_count?: number }
  >("documents-send-mail", payload, authToken);
}

export async function listCustomerReports(token: string): Promise<CustomerReportSummary[]> {
  const result = await apiGet<{ items?: CustomerReportSummary[] }>("customer-reports", token);
  return Array.isArray(result.items) ? result.items : [];
}

export async function loadCustomerReport(token: string, reportId: string): Promise<CustomerReportDetailResponse> {
  const id = String(reportId || "").trim();
  if (!id) throw new Error("Rapport-ID fehlt.");
  return await apiGet<CustomerReportDetailResponse>(`customer-reports?id=${encodeURIComponent(id)}`, token);
}

export async function saveCustomerReportSignature(
  token: string,
  payload: CustomerReportSignaturePayload
): Promise<{ ok: true; saved_at: string; report: CustomerReportDetailResponse }> {
  return await apiPost<CustomerReportSignaturePayload, { ok: true; saved_at: string; report: CustomerReportDetailResponse }>(
    "customer-reports",
    payload,
    token
  );
}

async function rpcSeries(name: string): Promise<{ label: string; value: number }[]> {
  const { data, error } = await supabase.rpc(name);
  if (error) throw new Error(error.message);
  const list = Array.isArray(data) ? data : [];
  return list.map((x) => ({ label: String((x as { label?: string }).label || ""), value: Number((x as { value?: number }).value || 0) }));
}

export async function analytics(token: string): Promise<AnalyticsPayload> {
  return withFallback(
    () => apiGet<AnalyticsPayload>("admin-analytics", token),
    async () => {
      try {
        const [besucher, funnel, kategorien, plz] = await Promise.all([
          rpcSeries("analytics_visitors_per_day"),
          rpcSeries("analytics_funnel"),
          rpcSeries("analytics_categories"),
          rpcSeries("analytics_plz"),
        ]);

        return {
          besucher_pro_tag: besucher,
          funnel,
          kategorien,
          plz,
        };
      } catch {
        return {
          besucher_pro_tag: [],
          funnel: [],
          kategorien: [],
          plz: [],
        };
      }
    }
  );
}
