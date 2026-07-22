import { json, options } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/client.ts";
import { bucketForStatus } from "../_shared/status.ts";
import { BUSINESS_RULES, isWithinOpeningWindow } from "../_shared/business-rules.ts";
import {
  normalizeIdempotencyKey,
  ticketPayloadHash,
  validateTicketAttachments,
} from "../_shared/ticket-creation-integrity.ts";

interface AttachmentInput {
  name: string;
  type: string;
  base64: string;
  size: number;
}

const BOOKING_MIN_DATE = "2026-04-01";
const MAX_ATTACHMENTS = 5;

type IdempotencyClaim =
  | { kind: "claimed"; processingToken: string }
  | { kind: "completed"; ticketId: string; ticketNumber: string }
  | { kind: "conflict" }
  | { kind: "pending" };

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function claimTicketCreation(
  supabase: ReturnType<typeof serviceClient>,
  idempotencyKey: string,
  payloadHash: string,
): Promise<IdempotencyClaim> {
  const processingToken = crypto.randomUUID();
  const { error: insertError } = await supabase.from("ticket_creation_requests").insert({
    idempotency_key: idempotencyKey,
    payload_hash: payloadHash,
    status: "pending",
    processing_token: processingToken,
  });
  if (!insertError) return { kind: "claimed", processingToken };
  if (!isUniqueViolation(insertError)) throw new Error("Ticketvorgang konnte nicht reserviert werden.");

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data, error } = await supabase
      .from("ticket_creation_requests")
      .select("payload_hash,status,ticket_id,ticket_number,processing_token,updated_at")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (error || !data) throw new Error("Ticketvorgang konnte nicht geprüft werden.");

    const row = data as Record<string, unknown>;
    if (String(row.payload_hash || "") !== payloadHash) return { kind: "conflict" };
    if (row.status === "completed") {
      return {
        kind: "completed",
        ticketId: String(row.ticket_id || ""),
        ticketNumber: String(row.ticket_number || ""),
      };
    }

    const updatedAt = Date.parse(String(row.updated_at || ""));
    const canTakeOver = row.status === "failed" || (Number.isFinite(updatedAt) && updatedAt < Date.now() - 5 * 60_000);
    if (canTakeOver) {
      const nextToken = crypto.randomUUID();
      const { data: claimed, error: claimError } = await supabase
        .from("ticket_creation_requests")
        .update({ status: "pending", processing_token: nextToken, error_code: null, updated_at: new Date().toISOString() })
        .eq("idempotency_key", idempotencyKey)
        .eq("processing_token", String(row.processing_token || ""))
        .select("idempotency_key")
        .maybeSingle();
      if (claimError) throw new Error("Ticketvorgang konnte nicht erneut reserviert werden.");
      if (claimed) return { kind: "claimed", processingToken: nextToken };
    }

    await delay(100);
  }
  return { kind: "pending" };
}

async function finishTicketCreation(
  supabase: ReturnType<typeof serviceClient>,
  idempotencyKey: string,
  processingToken: string,
  ticket: { id: string; ticket_nummer: string },
): Promise<void> {
  const { data, error } = await supabase
    .from("ticket_creation_requests")
    .update({
      status: "completed",
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_nummer,
      error_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("idempotency_key", idempotencyKey)
    .eq("processing_token", processingToken)
    .select("idempotency_key")
    .maybeSingle();
  if (error || !data) throw new Error("Ticketvorgang konnte nicht abgeschlossen werden.");
}

async function failTicketCreation(
  supabase: ReturnType<typeof serviceClient>,
  idempotencyKey: string,
  processingToken: string,
): Promise<void> {
  await supabase
    .from("ticket_creation_requests")
    .update({ status: "failed", error_code: "creation_failed", updated_at: new Date().toISOString() })
    .eq("idempotency_key", idempotencyKey)
    .eq("processing_token", processingToken);
}

function sanitizeDescription(raw: unknown): string {
  return String(raw || "")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^(meta:|session_id\s*=|outside_service_request\s*=)/i.test(trimmed)) return false;
      if (/^(adresse|straße|strasse|plz|ort)\s*:/i.test(trimmed)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function isMissingTable(message: string, table: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes(`could not find the table 'public.${table.toLowerCase()}'`) || (msg.includes("schema cache") && msg.includes(table.toLowerCase()));
}

function extractMissingColumn(message: string, table: string): string | null {
  const patterns = [
    new RegExp(`column\\s+${table}\\.(\\w+)\\s+does not exist`, "i"),
    new RegExp(`could not find the '([\\w_]+)' column of '${table}' in the schema cache`, "i"),
  ];
  for (const re of patterns) {
    const match = re.exec(message || "");
    if (match?.[1]) return match[1];
  }
  return null;
}

function isUniqueViolation(err: { code?: string; message?: string } | null | undefined): boolean {
  const msg = String(err?.message || "").toLowerCase();
  return String(err?.code || "") === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint");
}

function isCategoryConstraintError(message: string): boolean {
  const msg = String(message || "").toLowerCase();
  return (
    msg.includes("tickets_category_check") ||
    msg.includes("ticket_category_check") ||
    msg.includes("check_category") ||
    (msg.includes("violates check constraint") && (msg.includes("kategorie") || msg.includes("category")))
  );
}

function isTimeRangeTypeError(message: string): boolean {
  const msg = String(message || "").toLowerCase();
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

function asConsent(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const raw = String(value || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "ja" || raw === "on";
}

function firstDefined(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
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
  if (key.includes("objekttechnik") || key.includes("gebaudetechnik")) return "objekttechnik";
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

function parseHm(value: unknown): string | null {
  const s = String(value || "").trim();
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!m) return null;
  const hh = m[1].padStart(2, "0");
  const mm = m[2];
  if (Number(hh) > 23 || Number(mm) > 59) return null;
  return `${hh}:${mm}`;
}

function isHalfHour(value: string | null): boolean {
  if (!value) return true;
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return false;
  return Number(m[2]) % BUSINESS_RULES.opening_hours.slot_minutes === 0;
}

function parseWindow(value: unknown): { from: string | null; to: string | null } {
  const raw = String(value || "").trim();
  if (!raw) return { from: null, to: null };
  const matches = raw.match(/\d{1,2}:\d{2}(?::\d{2})?/g);
  if (matches && matches.length >= 2) {
    return { from: parseHm(matches[0]), to: parseHm(matches[1]) };
  }
  const parts = raw.split(/\s*(?:-|â€“|â€”|bis|to)\s*/i).filter(Boolean);
  if (parts.length >= 2) {
    return { from: parseHm(parts[0]), to: parseHm(parts[1]) };
  }
  return { from: null, to: null };
}

function isWeekdayDate(value: string | null): boolean {
  if (!value) return true;
  const raw = String(value || "").trim();
  if (!raw) return true;
  const dt = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return false;
  const day = dt.getDay();
  return day >= 1 && day <= 5;
}

function isActiveBookingStatus(value: unknown): boolean {
  const status = String(value || "").trim().toLowerCase();
  return status !== "storniert" && status !== "cancelled";
}

function toMinutes(value: string): number {
  const parsed = parseHm(value);
  if (!parsed) return NaN;
  const m = /^(\d{2}):(\d{2})$/.exec(parsed);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function overlapsRange(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  const aStart = toMinutes(aFrom);
  const aEnd = toMinutes(aTo);
  const bStart = toMinutes(bFrom);
  const bEnd = toMinutes(bTo);
  if (!Number.isFinite(aStart) || !Number.isFinite(aEnd) || !Number.isFinite(bStart) || !Number.isFinite(bEnd)) return false;
  return aStart < bEnd && aEnd > bStart;
}

function normalizeDate(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function resolveTicketWindow(row: Record<string, unknown>): { from: string; to: string } | null {
  const parsedWindowA = parseWindow(row.desired_time_window);
  const parsedWindowB = parseWindow(row.zeitfenster);
  const parsedWindowC = parseWindow(row.window);
  const from =
    parseHm(row.zeitfenster_von) ||
    parseHm(row.time_from) ||
    parseHm(row.window_from) ||
    parsedWindowA.from ||
    parsedWindowB.from ||
    parsedWindowC.from;
  const to =
    parseHm(row.zeitfenster_bis) ||
    parseHm(row.time_to) ||
    parseHm(row.window_to) ||
    parsedWindowA.to ||
    parsedWindowB.to ||
    parsedWindowC.to;
  if (!from || !to || from >= to) return null;
  return { from, to };
}

function resolveTicketDate(row: Record<string, unknown>): string | null {
  const candidates = [row.terminwunsch, row.desired_date, row.appointment_date, row.scheduled_date, row.scheduled_at];
  for (const candidate of candidates) {
    const normalized = normalizeDate(candidate);
    if (normalized) return normalized;
  }
  return null;
}

async function loadBookingsForDate(
  supabase: ReturnType<typeof serviceClient>,
  dateValue: string
): Promise<Record<string, unknown>[]> {
  const dateColumns = ["terminwunsch", "desired_date", "appointment_date", "scheduled_date"];
  const baseColumns = [
    "id",
    "status",
    "terminwunsch",
    "desired_date",
    "appointment_date",
    "scheduled_date",
    "scheduled_at",
    "zeitfenster_von",
    "zeitfenster_bis",
    "time_from",
    "time_to",
    "window_from",
    "window_to",
    "desired_time_window",
    "zeitfenster",
    "window",
  ];

  const rowsById = new Map<string, Record<string, unknown>>();
  for (const column of dateColumns) {
    let cols = [...baseColumns];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const { data, error } = await supabase.from("tickets").select(cols.join(",")).eq(column, dateValue).limit(500);
      if (!error) {
        const rows = (data || []) as unknown as Record<string, unknown>[];
        for (const row of rows) {
          if (!isActiveBookingStatus(row.status)) continue;
          const key = String(row.id || `${resolveTicketDate(row)}-${row.zeitfenster_von || ""}-${row.zeitfenster_bis || ""}`);
          rowsById.set(key, row);
        }
        break;
      }
      if (isMissingTable(error.message || "", "tickets")) return [];
      const missing = extractMissingColumn(error.message || "", "tickets");
      if (!missing) throw new Error(error.message);
      cols = cols.filter((col) => col !== missing);
      if (!cols.includes(column)) break;
    }
  }

  const fromIso = `${dateValue}T00:00:00.000Z`;
  const toDate = new Date(`${dateValue}T00:00:00.000Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 1);
  const toIso = toDate.toISOString();
  let cols = [...baseColumns];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from("tickets")
      .select(cols.join(","))
      .gte("scheduled_at", fromIso)
      .lt("scheduled_at", toIso)
      .limit(500);
    if (!error) {
      const rows = (data || []) as unknown as Record<string, unknown>[];
      for (const row of rows) {
        if (!isActiveBookingStatus(row.status)) continue;
        const key = String(row.id || `${resolveTicketDate(row)}-${row.zeitfenster_von || ""}-${row.zeitfenster_bis || ""}`);
        rowsById.set(key, row);
      }
      break;
    }
    if (isMissingTable(error.message || "", "tickets")) break;
    const missing = extractMissingColumn(error.message || "", "tickets");
    if (!missing) throw new Error(error.message);
    cols = cols.filter((col) => col !== missing);
    if (!cols.includes("scheduled_at")) break;
  }

  return [...rowsById.values()];
}

async function hasExistingBookingOnDate(
  supabase: ReturnType<typeof serviceClient>,
  dateValue: string,
  from: string,
  to: string
): Promise<boolean> {
  const rows = await loadBookingsForDate(supabase, dateValue);
  for (const row of rows) {
    if (resolveTicketDate(row) !== dateValue) continue;
    const range = resolveTicketWindow(row);
    if (!range) continue;
    if (overlapsRange(from, to, range.from, range.to)) return true;
  }
  return false;
}

function sanitizeCustomerText(value: unknown): string {
  const cleaned = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  const normalized = cleaned.replace(/\b(?:undefined|null)\b/gi, " ").replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  if (lower === "undefined" || lower === "null") return "";
  return normalized;
}

function normalizeCustomerType(value: unknown): "privat" | "firma" {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "privat";
  if (raw === "privat" || raw === "private") return "privat";
  if (["firma", "gewerblich", "gewerbe", "unternehmen", "business", "company", "b2b"].includes(raw)) return "firma";
  return "privat";
}

function customerTypeWriteCandidates(value: "privat" | "firma" | null | undefined): string[] {
  if (value === "firma") return ["firma", "gewerblich", ""];
  if (value === "privat") return ["privat", ""];
  return [];
}

function isCustomerTypeConstraintError(message: string): boolean {
  const msg = String(message || "").toLowerCase();
  return (
    msg.includes("customers_customer_type_check") ||
    msg.includes("tickets_customer_type_check") ||
    (msg.includes("violates check constraint") && msg.includes("customer_type"))
  );
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
}

function normalizeTicketSource(value: unknown, authUserId: string | null): string {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (raw.includes("kundenkonto")) return "Kundenkonto";
  if (raw.includes("telefon")) return "Telefon";
  if (raw.includes("whatsapp")) return "WhatsApp";
  if (raw.includes("mail")) return "E-Mail";
  if (raw.includes("intern") && raw.includes("mitarbeiter")) return "intern durch Mitarbeiter erstellt";
  if (raw.includes("intern") || raw.includes("robert")) return "intern durch Robert erstellt";
  if (authUserId) return "Kundenkonto";
  return "öffentlicher Website-Kontakt";
}

function normalizePhone(value: unknown): string | null {
  const phone = String(value || "").replace(/[^\d+]/g, "").trim();
  if (phone.length < 6 || phone.length > 20) return null;
  if ((phone.match(/\d/g) || []).length < 6) return null;
  return phone || null;
}

function resolveInvoiceRecipientName(input: {
  customerType: "privat" | "firma";
  kundeName?: unknown;
  companyName?: unknown;
  invoiceRecipientName?: unknown;
}): string {
  const explicit = sanitizeCustomerText(input.invoiceRecipientName);
  const person = sanitizeCustomerText(input.kundeName);
  const company = sanitizeCustomerText(input.companyName);
  if (input.customerType === "firma") return explicit || company || person;
  return explicit || person || company;
}

function resolveCustomerDisplayName(input: {
  customerType: "privat" | "firma";
  kundeName?: unknown;
  companyName?: unknown;
  invoiceRecipientName?: unknown;
}): string {
  const invoice = resolveInvoiceRecipientName(input);
  const person = sanitizeCustomerText(input.kundeName);
  const company = sanitizeCustomerText(input.companyName);
  if (input.customerType === "firma") return invoice || company || person;
  return invoice || person || company;
}

function normalizeRequestType(value: unknown): "direct" | "offer" | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!raw) return "direct";
  if (raw === "direct" || raw === "direkt_einsatz" || raw === "direkt" || raw === "direct_einsatz") return "direct";
  if (raw === "offer" || raw === "angebot_anfordern" || raw === "angebot_fordern") return "offer";
  if (raw.includes("direkt") || raw.includes("einsatz") || raw.includes("direct")) return "direct";
  if (raw.includes("angebot") || raw.includes("offer")) return "offer";
  return "direct";
}

function requestTypeToAnfrageart(value: "direct" | "offer"): "direkt_einsatz" | "angebot_anfordern" {
  return value === "offer" ? "angebot_anfordern" : "direkt_einsatz";
}

function normalizePriorityKey(value: unknown): "niedrig" | "mittel" | "hoch" | "kritisch" {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

function isPriorityConstraintError(message: string): boolean {
  const msg = String(message || "").toLowerCase();
  return (
    msg.includes("tickets_dringlichkeit_check") ||
    msg.includes("tickets_priority_check") ||
    (msg.includes("violates check constraint") && (msg.includes("dringlichkeit") || msg.includes("priority"))) ||
    (msg.includes("invalid input value for enum") && (msg.includes("dringlichkeit") || msg.includes("priority") || msg.includes("notfall"))) ||
    (msg.includes("invalid input syntax") && msg.includes("enum") && (msg.includes("dringlichkeit") || msg.includes("priority")))
  );
}

type EntityResolution = { id: string | null; created: boolean };

async function findOrCreateCustomerAdaptive(
  supabase: ReturnType<typeof serviceClient>,
  input: Record<string, unknown>
): Promise<EntityResolution> {
  const email = normalizeEmail(input.kunde_email);
  const phone = normalizePhone(input.kunde_telefon);
  const customerType = normalizeCustomerType(input.customer_type);
  const company = sanitizeCustomerText(input.kunde_firma) || null;
  const rawName = sanitizeCustomerText(input.kunde_name);
  const invoiceRecipientName = resolveInvoiceRecipientName({
    customerType,
    kundeName: rawName,
    companyName: company,
    invoiceRecipientName: input.invoice_recipient_name,
  });
  const name = resolveCustomerDisplayName({
    customerType,
    kundeName: rawName,
    companyName: company,
    invoiceRecipientName,
  });
  const contactPerson = sanitizeCustomerText(input.ansprechpartner) || rawName || company || "Kontakt";

  if (!email && !phone) return { id: null, created: false };
  if (customerType === "firma" && !company) {
    throw new Error("Bei Kundentyp Firma ist ein Firmenname erforderlich.");
  }
  if (!invoiceRecipientName) {
    throw new Error("Name fehlt.");
  }

  const findByEmail = async (): Promise<string | null> => {
    if (!email) return null;
    const pickByNormalizedEmail = (rows: Record<string, unknown>[]): string | null => {
      for (const row of rows) {
        const rowId = String(row.id || "").trim();
        const rowEmail = normalizeEmail(row.email);
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
        if (isMissingTable(looseError.message || "", "customers")) return null;
        if (extractMissingColumn(looseError.message || "", "customers")) return null;
        throw new Error(looseError.message);
      }
      return null;
    }
    if (!error) return null;
    if (isMissingTable(error.message || "", "customers")) return null;
    if (extractMissingColumn(error.message || "", "customers")) return null;
    throw new Error(error.message);
  };

  const findByPhone = async (): Promise<string | null> => {
    if (!phone) return null;
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", phone)
      .limit(2);
    if (!error && Array.isArray(data) && data.length > 0) {
      return String((data[0] as Record<string, unknown>).id || "").trim() || null;
    }
    if (!error) return null;
    if (isMissingTable(error.message || "", "customers")) return null;
    if (extractMissingColumn(error.message || "", "customers")) return null;
    throw new Error(error.message);
  };

  const existingByEmail = await findByEmail();
  if (existingByEmail) return { id: existingByEmail, created: false };

  const existingByPhone = await findByPhone();
  if (existingByPhone) return { id: existingByPhone, created: false };

  const customerTypeCandidates = customerTypeWriteCandidates(customerType);
  let customerTypeIndex = 0;

  let body: Record<string, unknown> = {
    name: name || "Unbekannt",
    company,
    email,
    phone,
    contact_person: contactPerson,
    source: "ticket_wizard",
  };

  for (let i = 0; i < 24; i += 1) {
    if (customerTypeCandidates.length > 0) {
      const candidate = customerTypeCandidates[customerTypeIndex];
      if (candidate) {
        body.customer_type = candidate;
      } else {
        delete body.customer_type;
      }
    }
    const { data, error } = await supabase.from("customers").insert(body).select("id").limit(1);
    if (!error && Array.isArray(data) && data.length > 0) {
      const id = String((data[0] as Record<string, unknown>).id || "").trim();
      if (id) return { id, created: true };
      return { id: await findByEmail() || (await findByPhone()), created: false };
    }
    if (!error) return { id: await findByEmail() || (await findByPhone()), created: false };

    if (isMissingTable(error.message || "", "customers")) return { id: null, created: false };

    if (isUniqueViolation(error)) {
      const existing = (await findByEmail()) || (await findByPhone());
      if (existing) return { id: existing, created: false };
    }

    if (isCustomerTypeConstraintError(error.message || "") && customerTypeIndex < customerTypeCandidates.length - 1) {
      customerTypeIndex += 1;
      continue;
    }

    const missing = extractMissingColumn(error.message || "", "customers");
    if (missing) {
      if (Object.prototype.hasOwnProperty.call(body, missing)) {
        delete body[missing];
        continue;
      }
      return { id: null, created: false };
    }

    throw new Error(error.message);
  }

  return { id: await findByEmail() || (await findByPhone()), created: false };
}

async function linkCustomerToAuthUserIfPossible(
  supabase: ReturnType<typeof serviceClient>,
  customerId: string,
  authUserId: string,
  authEmail: string
): Promise<boolean> {
  if (!customerId || !authUserId) return false;
  const normalizedEmail = normalizeEmail(authEmail);
  const payload: Record<string, unknown> = { auth_user_id: authUserId };
  if (normalizedEmail) payload.email = normalizedEmail;
  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", customerId)
    .is("auth_user_id", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Kundenkonto konnte nicht verknüpft werden.");
  return Boolean(data);
}

async function insertTicketAdaptive(
  supabase: ReturnType<typeof serviceClient>,
  payload: Record<string, unknown>
): Promise<{ id: string; ticket_nummer: string }> {
  const body: Record<string, unknown> = { ...payload };
  const categoryCandidates = body.kategorie !== undefined ? categoryWriteCandidates(body.kategorie) : [];
  const customerTypeCandidates = customerTypeWriteCandidates(
    normalizeCustomerType(body.customer_type)
  );
  const priorityCandidates =
    body.dringlichkeit !== undefined || body.priority !== undefined
      ? priorityWriteCandidates(firstDefined(body.dringlichkeit, body.priority))
      : [];
  let customerTypeIndex = 0;
  let categoryIndex = 0;
  let priorityIndex = 0;
  let returningColumns = ["id", "ticket_nummer", "ticket_number", "ticket_nr", "nummer"];

  for (let i = 0; i < 120; i += 1) {
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

    const selectCols = [...new Set(returningColumns)].join(",") || "id";
    const { data, error } = await supabase.from("tickets").insert(body).select(selectCols).limit(1);
    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0] as unknown as Record<string, unknown>;
      const id = String(row.id || row.ticket_id || "").trim();
      const ticketNummer = String(
        row.ticket_nummer || row.ticket_number || row.ticket_nr || row.nummer || body.ticket_nummer || payload.ticket_nummer || ""
      ).trim();
      if (!id) throw new Error("Ticket wurde gespeichert, aber ID konnte nicht gelesen werden.");
      return { id, ticket_nummer: ticketNummer || String(body.ticket_nummer || payload.ticket_nummer || "").trim() };
    }
    if (!error) throw new Error("Ticket konnte nicht gespeichert werden.");

    if (body.kategorie !== undefined && isCategoryConstraintError(error.message)) {
      if (categoryIndex < categoryCandidates.length - 1) {
        categoryIndex += 1;
        continue;
      }
    }
    if (isTimeRangeTypeError(error.message)) {
      if (stripUnsafeRangeWindowFields(body)) continue;
    }
    if (body.customer_type !== undefined && isCustomerTypeConstraintError(error.message)) {
      if (customerTypeIndex < customerTypeCandidates.length - 1) {
        customerTypeIndex += 1;
        continue;
      }
    }
    if ((body.dringlichkeit !== undefined || body.priority !== undefined) && isPriorityConstraintError(error.message)) {
      if (priorityIndex < priorityCandidates.length - 1) {
        priorityIndex += 1;
        continue;
      }
    }

    const missing = extractMissingColumn(error.message, "tickets");
    if (missing) {
      let changed = false;
      if (Object.prototype.hasOwnProperty.call(body, missing)) {
        delete body[missing];
        changed = true;
      }
      const nextReturning = returningColumns.filter((col) => col !== missing);
      if (nextReturning.length !== returningColumns.length) {
        returningColumns = nextReturning;
        changed = true;
      }
      if (changed) continue;
    }

    throw new Error(error.message);
  }

  throw new Error("Tickets-Schema ist nicht kompatibel (zu viele unbekannte Spalten).");
}

async function resolveOrCreateObjectId(
  supabase: ReturnType<typeof serviceClient>,
  input: {
    requesterUserId: string | null;
    customerId: string | null;
    explicitObjectId?: string | null;
    street: string;
    zip: string;
    city: string;
  }
): Promise<EntityResolution> {
  const requesterUserId = String(input.requesterUserId || "").trim();
  if (!requesterUserId) return { id: null, created: false };

  const explicitObjectId = String(input.explicitObjectId || "").trim();
  if (explicitObjectId) {
    const { data, error } = await supabase
      .from("objects")
      .select("id,requester_user_id,customer_id,is_active")
      .eq("id", explicitObjectId)
      .limit(1);
    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0] as Record<string, unknown>;
      if (
        row.is_active === true &&
        String(row.requester_user_id || "").trim() === requesterUserId &&
        String(row.customer_id || "").trim() === String(input.customerId || "").trim()
      ) return { id: explicitObjectId, created: false };
    }
    throw new Error("Das ausgewählte Objekt gehört nicht zum Kundenkonto oder ist deaktiviert.");
  }

  const street = String(input.street || "").trim();
  const zip = String(input.zip || "").trim();
  const city = String(input.city || "").trim();
  if (!street || !zip || !city) return { id: null, created: false };

  const { data: found, error: findError } = await supabase
    .from("objects")
    .select("id")
    .eq("requester_user_id", requesterUserId)
    .eq("customer_id", input.customerId)
    .eq("street", street)
    .eq("zip", zip)
    .eq("city", city)
    .eq("is_active", true)
    .limit(1);
  if (!findError && Array.isArray(found) && found.length > 0) {
    return { id: String((found[0] as Record<string, unknown>).id || "").trim() || null, created: false };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("objects")
    .insert({
      requester_user_id: requesterUserId,
      customer_id: input.customerId,
      name: `${street}, ${zip} ${city}`,
      street,
      zip,
      city,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError) throw new Error("Kundenobjekt konnte nicht angelegt werden.");
  return { id: String(inserted?.id || "").trim() || null, created: true };
}

async function rollbackTicketCreation(
  supabase: ReturnType<typeof serviceClient>,
  input: {
    ticketId: string | null;
    objectId: string | null;
    customerId: string | null;
    linkedCustomerId: string | null;
    authUserId: string | null;
  },
): Promise<void> {
  const failures: string[] = [];
  if (input.ticketId) {
    const { error } = await supabase.from("tickets").delete().eq("id", input.ticketId);
    if (error) failures.push("ticket");
  }
  if (input.objectId) {
    const { error } = await supabase.from("objects").delete().eq("id", input.objectId);
    if (error) failures.push("object");
  }
  if (input.linkedCustomerId && input.authUserId) {
    const { error } = await supabase
      .from("customers")
      .update({ auth_user_id: null })
      .eq("id", input.linkedCustomerId)
      .eq("auth_user_id", input.authUserId);
    if (error) failures.push("customer_link");
  }
  if (input.customerId) {
    const { error } = await supabase.from("customers").delete().eq("id", input.customerId);
    if (error) failures.push("customer");
  }
  if (failures.length) throw new Error(`Rollback fehlgeschlagen: ${failures.join(", ")}.`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const authHeader = String(req.headers.get("authorization") || "");
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

    const plz = String(body.plz || "").trim();
    const datenschutz = asConsent(
      firstDefined(body.datenschutz_akzeptiert, body.privacy_accepted, body.datenschutz, body.privacyAccepted)
    );
    const agb = asConsent(firstDefined(body.agb_akzeptiert, body.terms_accepted, body.agb, body.termsAccepted));
    const haftung = asConsent(
      firstDefined(
        body.haftung_koordination_akzeptiert,
        body.liability_coordination_accepted,
        body.liability_accepted,
        body.koordination_haftung_akzeptiert,
        body.haftung_akzeptiert,
      )
    );

    if (!/^\d{5}$/.test(plz)) return json({ error: "Ungültige PLZ." }, 400);
    if (!datenschutz || !agb || !haftung) return json({ error: "Rechtliche Zustimmungen fehlen." }, 400);

    const attachments = Array.isArray(body.attachments) ? (body.attachments as AttachmentInput[]) : [];
    const attachmentError = validateTicketAttachments(attachments);
    if (attachmentError) return json({ error: attachmentError }, 400);
    const idempotencyKey = normalizeIdempotencyKey(body.idempotency_key);
    if (!idempotencyKey) return json({ error: "Gültiger Idempotency-Key fehlt." }, 400);

    const supabase = serviceClient();
    let authUserId: string | null = null;
    let authenticatedEmail = "";
    if (token) {
      const { data: authData } = await supabase.auth.getUser(token);
      if (authData.user) {
        authUserId = String(authData.user.id || "").trim() || null;
        authenticatedEmail = normalizeEmail(authData.user.email || "") || "";
        if (authData.user.email_confirmed_at === null) {
          return json({ error: "Bitte E-Mail-Adresse zuerst bestätigen." }, 403);
        }
      }
    }

    const payloadHash = await ticketPayloadHash({ ...body, authenticated_user_id: authUserId });
    const claim = await claimTicketCreation(supabase, idempotencyKey, payloadHash);
    if (claim.kind === "conflict") return json({ error: "Idempotency-Key wurde mit anderen Daten verwendet." }, 409);
    if (claim.kind === "pending") return json({ error: "Ticketvorgang wird bereits verarbeitet." }, 409);
    if (claim.kind === "completed") {
      return json({ ticket_id: claim.ticketId, ticket_nummer: claim.ticketNumber, idempotent_replay: true });
    }

    let createdTicketId: string | null = null;
    let createdObjectId: string | null = null;
    let createdCustomerId: string | null = null;
    let linkedCustomerId: string | null = null;

    try {

    const { data: nummer, error: nummerErr } = await supabase.rpc("next_ticket_number");
    if (nummerErr || !nummer) return json({ error: "Ticketnummer konnte nicht erzeugt werden." }, 500);

    const cleanedDescription = sanitizeDescription(body.beschreibung || body.description || "");

    const titel =
      String(body.titel || body.title || cleanedDescription || "")
        .split("\n")[0]
        .trim()
        .slice(0, 120) || `Anfrage ${nummer}`;

    const objektStrasse = String(body.objekt_strasse || body.object_street || body.objekt_adresse || "").trim();
    const objektPlz = String(body.objekt_plz || body.object_zip || body.plz || "").trim();
    const objektOrt = String(body.objekt_ort || body.object_city || body.ort || "").trim();
    const objektAdresse =
      String(body.objekt_adresse || "").trim() ||
      [objektStrasse, [objektPlz, objektOrt].filter(Boolean).join(" ")].filter(Boolean).join(", ");

    const termin = String(body.terminwunsch || body.desired_date || body.appointment_date || "").trim() || null;
    const parsedWindow = parseWindow(body.desired_time_window || body.zeitfenster || body.window || "");
    const zeitVon =
      parseHm(body.zeitfenster_von) ||
      parseHm(body.time_from) ||
      parseHm(body.window_from) ||
      parsedWindow.from;
    const zeitBis =
      parseHm(body.zeitfenster_bis) ||
      parseHm(body.time_to) ||
      parseHm(body.window_to) ||
      parsedWindow.to;

    if ((zeitVon && !zeitBis) || (!zeitVon && zeitBis)) {
      return json({ error: "Bitte beide Uhrzeiten angeben (von und bis)." }, 400);
    }
    if (!isWeekdayDate(termin)) {
      return json({ error: "Wunschdatum ist nur Montag bis Freitag verfügbar." }, 400);
    }
    if (termin && termin < BOOKING_MIN_DATE) {
      return json({ error: "Wunschdatum ist erst ab 2026-04-01 verfügbar." }, 400);
    }
    if (!isHalfHour(zeitVon) || !isHalfHour(zeitBis)) {
      return json({ error: "Uhrzeiten sind nur in 30-Minuten-Schritten erlaubt." }, 400);
    }
    if (zeitVon && zeitBis && zeitVon >= zeitBis) {
      return json({ error: "Bitte ein gültiges Zeitfenster wählen (von < bis)." }, 400);
    }

    if (zeitVon && zeitBis && !isWithinOpeningWindow(zeitVon, zeitBis)) {
      return json(
        { error: `Zeitfenster muss innerhalb ${BUSINESS_RULES.opening_hours.start}-${BUSINESS_RULES.opening_hours.end} Uhr liegen.` },
        400
      );
    }
    if (termin && zeitVon && zeitBis && (await hasExistingBookingOnDate(supabase, termin, zeitVon, zeitBis))) {
      return json({ error: "Dieses Zeitfenster ist bereits vergeben. Bitte andere Uhrzeit wählen." }, 409);
    }

    const desiredWindow = zeitVon && zeitBis ? `${zeitVon}-${zeitBis}` : null;
    const displayWindow = zeitVon && zeitBis ? `${zeitVon} - ${zeitBis}` : null;
    const customerType = normalizeCustomerType(body.customer_type);
    const customerName = sanitizeCustomerText(body.kunde_name);
    const customerCompany = sanitizeCustomerText(body.kunde_firma) || null;
    const customerEmail = authenticatedEmail || normalizeEmail(body.kunde_email || body.email || "") || "";
    const customerPhone = normalizePhone(body.kunde_telefon) || "";
    const customerContact = sanitizeCustomerText(body.ansprechpartner) || null;
    const invoiceRecipientName = resolveInvoiceRecipientName({
      customerType,
      kundeName: customerName,
      companyName: customerCompany,
      invoiceRecipientName: body.invoice_recipient_name,
    });
    const customerDisplayName = resolveCustomerDisplayName({
      customerType,
      kundeName: customerName,
      companyName: customerCompany,
      invoiceRecipientName,
    });
    const city = objektOrt || String(body.ort || "").trim();
    const category = String(body.kategorie || "Sonstiges");
    const priority = normalizePriorityKey(firstDefined(body.dringlichkeit, body.priority));
    const requestType =
      normalizeRequestType(
        firstDefined(body.request_type, body.requestType, body.anfrageart, body.source, body.request_type_label)
      ) || "direct";
    const anfrageart = requestTypeToAnfrageart(requestType);
    const requestTime = zeitVon && zeitBis ? `${zeitVon}-${zeitBis}` : null;
    const ticketSource = normalizeTicketSource(firstDefined(body.source, body.ticket_source), authUserId);

    const payload: Record<string, unknown> = {
      ticket_number: nummer,
      ticket_nummer: nummer,
      bucket: bucketForStatus("Neu"),
      status: "Neu",
      anfrageart,
      request_type: requestType,
      source: ticketSource,
      subkategorie: String(body.subkategorie || body.subcategory || "").trim() || null,
      subcategory: String(body.subkategorie || body.subcategory || "").trim() || null,
      customer_type: customerType,
      invoice_recipient_name: invoiceRecipientName || null,
      customer_display_name: customerDisplayName || null,
      ansprechpartner: customerContact,
      kategorie: category,
      category,
      dringlichkeit: priority,
      priority,
      titel,
      title: titel,
      kunde_name: invoiceRecipientName || customerName,
      kunde_firma: customerCompany,
      kunde_email: customerEmail,
      kunde_telefon: customerPhone,
      company_name: customerCompany,
      contact_person: customerContact,
      email: customerEmail,
      phone: customerPhone,
      objekt_adresse: objektAdresse,
      object_address: objektAdresse,
      objekt_strasse: objektStrasse || null,
      objekt_plz: objektPlz || null,
      objekt_ort: objektOrt || null,
      access_notes: String(body.access_notes || "").trim() || null,
      distanz_km: Number(body.distanz_km || body.radius_km || 0) || null,
      distance_km: Number(body.distanz_km || body.radius_km || 0) || null,
      outside_service_area: !!body.outside_service_area,
      ort: city,
      city,
      plz: objektPlz || plz,
      terminwunsch: termin,
      desired_date: termin,
      requested_date: termin,
      appointment_date: termin,
      scheduled_at: termin,
      scheduled_date: termin,
      zeitfenster_von: zeitVon,
      zeitfenster_bis: zeitBis,
      requested_time: zeitVon,
      preferred_time_window: displayWindow || requestTime,
      time_from: zeitVon,
      time_to: zeitBis,
      window_from: zeitVon,
      window_to: zeitBis,
      desired_time_window: desiredWindow,
      zeitfenster: displayWindow,
      window: desiredWindow,
      beschreibung: cleanedDescription,
      description: cleanedDescription,
      radius_km: Number(body.radius_km || 30),
      datenschutz_akzeptiert: datenschutz,
      agb_akzeptiert: agb,
      haftung_koordination_akzeptiert: haftung,
      privacy_accepted: datenschutz,
      terms_accepted: agb,
      liability_coordination_accepted: haftung,
      requester_user_id: authUserId,
    };

    if (!invoiceRecipientName || !objektStrasse || !objektPlz || !city || !cleanedDescription) {
      return json({ error: "Pflichtfelder fehlen." }, 400);
    }
    if (customerType === "firma" && !customerCompany) {
      return json({ error: "Bei Kundentyp Firma ist die Firma erforderlich." }, 400);
    }
    if (!customerEmail && !customerPhone) {
      return json({ error: "Mindestens E-Mail oder Telefon ist erforderlich." }, 400);
    }

    const customerResolution = await findOrCreateCustomerAdaptive(supabase, payload);
    const customerId = customerResolution.id;
    if (!customerId) throw new Error("Kunde konnte nicht eindeutig angelegt oder zugeordnet werden.");
    if (customerResolution.created) createdCustomerId = customerId;
    if (customerId) {
      payload.customer_id = customerId;
      if (authUserId) {
        const linked = await linkCustomerToAuthUserIfPossible(supabase, customerId, authUserId, authenticatedEmail);
        if (linked && !customerResolution.created) linkedCustomerId = customerId;
      }
    }
    const objectResolution = await resolveOrCreateObjectId(supabase, {
      requesterUserId: authUserId,
      customerId,
      explicitObjectId: String(body.object_id || "").trim() || null,
      street: objektStrasse,
      zip: objektPlz,
      city: objektOrt || city,
    });
    const objectId = objectResolution.id;
    if (objectResolution.created) createdObjectId = objectId;
    if (objectId) payload.object_id = objectId;

    const ticket = await insertTicketAdaptive(supabase, payload);
    createdTicketId = ticket.id;

    if (attachments.length > 0) {
      const rows = attachments.slice(0, MAX_ATTACHMENTS).map((att) => ({
        ticket_id: ticket.id,
        file_name: String(att.name || "datei"),
        mime_type: String(att.type || "application/octet-stream"),
        size_bytes: Number(att.size || 0),
        base64_content: String(att.base64 || ""),
      }));
      const { error } = await supabase.from("ticket_attachments").insert(rows);
      if (error) throw new Error("Anhänge konnten nicht gespeichert werden.");
    }

    const { error: eventError } = await supabase.from("ticket_events").insert({
      ticket_id: ticket.id,
      event_typ: "inbox_created",
      detail: "Ticket über öffentlichen Wizard in Inbox erstellt",
      actor: "kunde",
      metadata: customerId ? { customer_id: customerId } : {},
    });
    if (eventError) throw new Error("Ticketverlauf konnte nicht gespeichert werden.");

    const { error: analyticsError } = await supabase.from("analytics_events").insert({
      event_name: "wizard_submit",
      step: "submit",
      page_path: String(body.source_page || body.page_path || "/einzelauftrag"),
      ticket_id: ticket.id,
      metadata: {
        plz,
        anfrageart: payload.anfrageart,
        kategorie: payload.kategorie,
        source: ticketSource,
      },
    });
    if (analyticsError) throw new Error("Ticketabschluss konnte nicht protokolliert werden.");

    await finishTicketCreation(supabase, idempotencyKey, claim.processingToken, ticket);

    return json({ ticket_id: ticket.id, ticket_nummer: ticket.ticket_nummer });
    } catch (creationError) {
      try {
        await rollbackTicketCreation(supabase, {
          ticketId: createdTicketId,
          objectId: createdObjectId,
          customerId: createdCustomerId,
          linkedCustomerId,
          authUserId,
        });
      } finally {
        await failTicketCreation(supabase, idempotencyKey, claim.processingToken);
      }
      throw creationError;
    }
  } catch (err) {
    return json({ error: (err as Error).message || "Unbekannter Fehler" }, 500);
  }
});
