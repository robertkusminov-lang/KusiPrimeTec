import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";
import { bucketForStatus, normalizeStatus } from "../_shared/status.ts";
import { getValidGraphAccessToken } from "../_shared/graph.ts";
import { ensureTicketObjectAssignment } from "../_shared/object-assignment.ts";

type Priority = "niedrig" | "mittel" | "hoch" | "kritisch";
type RiskLevel = "low" | "medium" | "high";
type Intent = "new_request" | "status_update" | "change_request" | "report_submitted" | "other";

interface CatalogItem {
  code: string;
  name: string;
  unit: string;
  unit_price: number;
  tax_rate: number;
}

interface PositionInput {
  code?: string;
  qty?: number;
  notes?: string;
}

interface CustomerContext {
  customer_type: "privat" | "firma";
  name: string;
  company_name: string;
  invoice_recipient_name: string;
  contact_person: string;
  email: string;
  phone: string;
}

interface SiteContext {
  address: string;
  plz: string;
  city: string;
}

interface LearningHints {
  category?: string;
  priority?: Priority;
  request_type?: "direct" | "offer";
}

type LeadQuality = "ok" | "incomplete" | "spam";

function isMissingTable(message: string, table: string): boolean {
  const msg = String(message || "").toLowerCase();
  return (
    msg.includes(`could not find the table 'public.${table.toLowerCase()}'`) ||
    msg.includes(`relation "public.${table.toLowerCase()}" does not exist`) ||
    msg.includes(`relation "${table.toLowerCase()}" does not exist`)
  );
}

function isMissingRpcFunction(message: string, fnName: string): boolean {
  const msg = String(message || "").toLowerCase();
  return msg.includes(`could not find the function public.${fnName.toLowerCase()}`) || (msg.includes("schema cache") && msg.includes(fnName.toLowerCase()));
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

function cleanText(value: unknown, maxLen = 400): string {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function cleanMultiline(value: unknown, maxLen = 5000): string {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
}

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value: unknown): string {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function normalizePlz(value: unknown): string {
  return String(value || "").replace(/[^\d]/g, "").slice(0, 5);
}

function pickText(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = cleanText(value, 220);
    if (cleaned) return cleaned;
  }
  return "";
}

function pickEmail(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = normalizeEmail(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function pickPhone(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = normalizePhone(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function pickPlz(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = normalizePlz(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function normalizeCustomerType(value: unknown): "privat" | "firma" {
  const raw = String(value || "").trim().toLowerCase();
  if (["firma", "gewerbe", "gewerblich", "unternehmen", "business", "company", "b2b"].includes(raw)) return "firma";
  return "privat";
}

function normalizeIntent(value: unknown): Intent | null {
  const raw = String(value || "").trim().toLowerCase();
  if (["new_request", "status_update", "change_request", "report_submitted", "other"].includes(raw)) {
    return raw as Intent;
  }
  return null;
}

function detectIntent(payload: Record<string, unknown>, text: string): Intent {
  const forced = normalizeIntent(payload.intent);
  if (forced) return forced;
  const lower = text.toLowerCase();
  if (payload.rapport || lower.includes("rapport")) return "report_submitted";
  if (payload.ticket_id && (lower.includes("status") || payload.status)) return "status_update";
  if (payload.ticket_id) return "change_request";
  return "new_request";
}

function detectCategory(explicit: unknown, text: string): string {
  const e = cleanText(explicit, 80);
  if (e) return e;
  const lower = text.toLowerCase();
  if (lower.includes("elektro") || lower.includes("steckdose") || lower.includes("licht")) return "Elektro";
  if (lower.includes("heizung")) return "Heizung";
  if (lower.includes("sanit") || lower.includes("wasser") || lower.includes("wc")) return "Sanitär";
  if (lower.includes("koordination") || lower.includes("projekt")) return "Koordination";
  if (lower.includes("objekttechnik") || lower.includes("gebäude") || lower.includes("gebaeude")) return "Objekttechnik";
  return "Sonstiges";
}

function detectPriority(explicit: unknown, text: string): Priority {
  const raw = String(explicit || "").trim().toLowerCase();
  if (raw === "kritisch" || raw === "hoch" || raw === "mittel" || raw === "niedrig") return raw;
  const lower = text.toLowerCase();
  if (lower.includes("gefahr") || lower.includes("totalausfall") || lower.includes("wassereintritt") || lower.includes("stromschlag")) return "kritisch";
  if (lower.includes("ausfall") || lower.includes("dringend") || lower.includes("notfall")) return "hoch";
  if (lower.includes("wunsch") || lower.includes("komfort")) return "niedrig";
  return "mittel";
}

function parseBoolean(value: unknown): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "ja" || raw === "y" || raw === "on";
}

function toNameCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

function guessNameFromEmail(email: string): string {
  const local = String(email || "").split("@")[0] || "";
  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return toNameCase(cleaned);
}

function classifyLeadQuality(input: {
  text: string;
  title: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  plz: string;
  city: string;
}): { quality: LeadQuality; reasons: string[] } {
  const text = `${input.title}\n${input.text}`.toLowerCase();
  const reasons: string[] = [];

  const spamPatterns = [
    "casino",
    "bitcoin",
    "crypto",
    "seo",
    "backlink",
    "porn",
    "viagra",
    "loan",
    "telegram",
    "whatsapp group",
    "test test",
    "asdf",
    "lorem ipsum",
  ];
  if (spamPatterns.some((pattern) => text.includes(pattern))) {
    reasons.push("Spam-Muster in Anfrage erkannt.");
  }

  const hasContact = Boolean(input.email || input.phone);
  const hasSite = Boolean(input.address || (input.plz && input.city));
  const hasProblem = cleanText(input.text, 500).length >= 12;

  if (!hasContact) reasons.push("Kein Kontakt (E-Mail oder Telefon) vorhanden.");
  if (!hasSite) reasons.push("Objektadresse unvollständig.");
  if (!hasProblem) reasons.push("Problembeschreibung zu kurz oder leer.");

  if (reasons.some((r) => r.toLowerCase().includes("spam"))) {
    return { quality: "spam", reasons };
  }
  if (!hasContact || !hasSite || !hasProblem) {
    return { quality: "incomplete", reasons };
  }
  return { quality: "ok", reasons: [] };
}

function suggestPositionsFromDescription(
  text: string,
  catalog: Map<string, CatalogItem> | null
): PositionInput[] {
  if (!catalog) return [];
  const lower = text.toLowerCase();
  const out: PositionInput[] = [];

  const pushCode = (code: string, notes: string) => {
    if (!catalog.has(code)) return;
    if (out.some((item) => String(item.code) === code)) return;
    out.push({ code, qty: 1, notes });
  };

  pushCode("SERVICE_CALL_FLAT_39", "Einsatzpauschale");
  pushCode("LABOR_HOURLY_80", "Voraussichtlicher Erst-Einsatz");

  const semanticBuckets: Array<{ keywords: string[]; notes: string }> = [
    { keywords: ["steckdose", "schalter", "sicherung", "licht", "elektro"], notes: "Elektro-Störung" },
    { keywords: ["heizung", "therme", "warmwasser"], notes: "Heizung/Warmwasser" },
    { keywords: ["wasser", "leck", "rohr", "wc", "sanit"], notes: "Sanitärstörung" },
  ];

  const matchingKeywords = new Set<string>();
  for (const bucket of semanticBuckets) {
    if (bucket.keywords.some((k) => lower.includes(k))) {
      for (const k of bucket.keywords) matchingKeywords.add(k);
    }
  }

  if (matchingKeywords.size > 0) {
    for (const [code, item] of catalog.entries()) {
      if (out.length >= 4) break;
      const hay = `${code} ${item.name}`.toLowerCase();
      if ([...matchingKeywords].some((k) => hay.includes(k))) {
        pushCode(code, "Automatisch aus Beschreibung erkannt");
      }
    }
  }

  return out;
}

function addBusinessDays(start: Date, days: number): Date {
  const out = new Date(start.getTime());
  let remaining = days;
  while (remaining > 0) {
    out.setDate(out.getDate() + 1);
    const wd = out.getDay();
    if (wd >= 1 && wd <= 5) remaining -= 1;
  }
  return out;
}

function computeSlaDueAt(priority: Priority): string {
  const now = new Date();
  if (priority === "kritisch") return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  if (priority === "hoch") return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
  if (priority === "mittel") return addBusinessDays(now, 3).toISOString();
  return addBusinessDays(now, 7).toISOString();
}

function chooseAssignee(category: string, priority: Priority): string {
  const c = category.toLowerCase();
  if (priority === "kritisch") return "Notdienst";
  if (c.includes("elektro")) return "Elektro-Team";
  if (c.includes("heizung") || c.includes("sanit")) return "SHK-Partner";
  if (c.includes("koordination")) return "Projektkoordination";
  return "Backoffice";
}

function chooseStatus(intent: Intent, priority: Priority): string {
  if (intent === "report_submitted") return "Rapport_erstellt";
  if (intent === "status_update" || intent === "change_request") return priority === "kritisch" ? "In_Arbeit" : "Geprueft";
  return "Neu";
}

function inferRequestType(value: unknown, text: string): "direct" | "offer" {
  const raw = `${String(value || "").trim()} ${String(text || "").trim()}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (raw.includes("angebot") || raw.includes("offer")) return "offer";
  return "direct";
}

function requestTypeToAnfrageart(value: "direct" | "offer"): "direkt_einsatz" | "angebot_anfordern" {
  return value === "offer" ? "angebot_anfordern" : "direkt_einsatz";
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function insertAdaptive(
  supabase: ReturnType<typeof serviceClient>,
  table: string,
  payload: Record<string, unknown>,
  returning: string[] = ["id"]
): Promise<Record<string, unknown> | null> {
  let body: Record<string, unknown> = { ...payload };
  let cols = [...returning];

  for (let i = 0; i < 80; i += 1) {
    const sel = [...new Set(cols)].join(",") || "id";
    const { data, error } = await supabase.from(table).insert(body).select(sel).limit(1);
    if (!error) return Array.isArray(data) ? ((data[0] as Record<string, unknown>) || null) : null;

    if (isMissingTable(error.message || "", table)) throw new Error(`Tabelle fehlt: ${table}`);

    const missing = extractMissingColumn(error.message || "", table);
    if (missing) {
      let changed = false;
      if (Object.prototype.hasOwnProperty.call(body, missing)) {
        delete body[missing];
        changed = true;
      }
      const nextCols = cols.filter((c) => c !== missing);
      if (nextCols.length !== cols.length) {
        cols = nextCols;
        changed = true;
      }
      if (changed) continue;
    }
    throw new Error(error.message || `Insert fehlgeschlagen (${table}).`);
  }
  throw new Error(`Insert fehlgeschlagen (${table}): zu viele Inkompatibilitäten.`);
}

async function updateTicketAdaptive(
  supabase: ReturnType<typeof serviceClient>,
  ticketId: string,
  payload: Record<string, unknown>
): Promise<void> {
  let body = { ...payload };
  for (let i = 0; i < 80; i += 1) {
    if (Object.keys(body).length === 0) return;
    const { error } = await supabase.from("tickets").update(body).eq("id", ticketId);
    if (!error) return;
    const missing = extractMissingColumn(error.message || "", "tickets");
    if (missing && Object.prototype.hasOwnProperty.call(body, missing)) {
      delete body[missing];
      continue;
    }
    throw new Error(error.message || "Ticket-Update fehlgeschlagen.");
  }
}

async function getTicketAdaptive(
  supabase: ReturnType<typeof serviceClient>,
  ticketId: string
): Promise<Record<string, unknown> | null> {
  let cols = [
    "id",
    "ticket_nummer",
    "ticket_number",
    "status",
    "bucket",
    "customer_id",
    "created_at",
    "updated_at",
    "request_type",
    "anfrageart",
    "kategorie",
    "category",
    "dringlichkeit",
    "priority",
    "customer_type",
    "kunde_name",
    "kunde_firma",
    "invoice_recipient_name",
    "ansprechpartner",
    "contact_person",
    "kunde_email",
    "kunde_telefon",
    "objekt_adresse",
    "object_address",
    "objekt_plz",
    "plz",
    "objekt_ort",
    "ort",
    "beschreibung",
    "description",
    "titel",
    "title",
  ];
  for (let i = 0; i < 30; i += 1) {
    const { data, error } = await supabase.from("tickets").select(cols.join(",")).eq("id", ticketId).limit(2);
    if (!error) return Array.isArray(data) ? ((data[0] as Record<string, unknown>) || null) : null;
    const missing = extractMissingColumn(error.message || "", "tickets");
    if (missing) {
      const next = cols.filter((c) => c !== missing);
      if (next.length !== cols.length) {
        cols = next;
        continue;
      }
    }
    throw new Error(error.message || "Ticket konnte nicht geladen werden.");
  }
  return null;
}

async function getCustomerAdaptive(
  supabase: ReturnType<typeof serviceClient>,
  customerId: string
): Promise<Record<string, unknown> | null> {
  if (!customerId) return null;
  let cols = ["id", "customer_type", "name", "company", "company_name", "invoice_recipient_name", "contact_person", "email", "phone"];
  for (let i = 0; i < 24; i += 1) {
    const { data, error } = await supabase.from("customers").select(cols.join(",")).eq("id", customerId).limit(2);
    if (!error) return Array.isArray(data) ? ((data[0] as Record<string, unknown>) || null) : null;
    if (isMissingTable(error.message || "", "customers")) return null;
    const missing = extractMissingColumn(error.message || "", "customers");
    if (missing) {
      const next = cols.filter((c) => c !== missing);
      if (next.length !== cols.length) {
        cols = next;
        continue;
      }
    }
    throw new Error(error.message || "Kunde konnte nicht geladen werden.");
  }
  return null;
}

async function loadCustomerLearningHints(
  supabase: ReturnType<typeof serviceClient>,
  customerId: string
): Promise<LearningHints> {
  if (!customerId) return {};
  let cols = ["id", "customer_id", "kategorie", "category", "dringlichkeit", "priority", "request_type", "anfrageart", "created_at"];
  for (let i = 0; i < 24; i += 1) {
    const { data, error } = await supabase
      .from("tickets")
      .select(cols.join(","))
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!error) {
      const rows = (data || []) as Record<string, unknown>[];
      const previous = rows.find((row) => String(row.id || "").trim() !== "");
      if (!previous) return {};
      const hintedCategory = pickText(previous.kategorie, previous.category);
      const priorityRaw = pickText(previous.dringlichkeit, previous.priority).toLowerCase();
      const hintedPriority = (["niedrig", "mittel", "hoch", "kritisch"].includes(priorityRaw) ? priorityRaw : "") as Priority | "";
      const hintedRequest = inferRequestType(previous.request_type || previous.anfrageart, "");
      return {
        category: hintedCategory || undefined,
        priority: hintedPriority || undefined,
        request_type: hintedRequest || undefined,
      };
    }
    const missing = extractMissingColumn(error.message || "", "tickets");
    if (missing) {
      const next = cols.filter((c) => c !== missing);
      if (next.length !== cols.length) {
        cols = next;
        continue;
      }
    }
    return {};
  }
  return {};
}

async function nextTicketNumber(supabase: ReturnType<typeof serviceClient>): Promise<string> {
  for (const fn of ["next_ticket_number_v2", "next_ticket_number"]) {
    const { data, error } = await supabase.rpc(fn);
    if (!error && data) return String(data);
    if (error && !isMissingRpcFunction(error.message || "", fn)) throw new Error(error.message);
  }
  throw new Error("Ticketnummer konnte nicht erzeugt werden.");
}

async function nextDocumentNumber(supabase: ReturnType<typeof serviceClient>, prefix: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_document_number", { p_prefix: prefix });
  if (!error && data) return String(data);
  if (error && !isMissingRpcFunction(error.message || "", "next_document_number")) throw new Error(error.message);
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

async function findCustomerByEmail(supabase: ReturnType<typeof serviceClient>, email: string): Promise<Record<string, unknown> | null> {
  if (!email) return null;
  let cols = ["id", "email", "phone", "name", "company_name", "invoice_recipient_name", "customer_type", "contact_person"];
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await supabase.from("customers").select(cols.join(",")).ilike("email", email).limit(2);
    if (!error) return Array.isArray(data) ? ((data[0] as Record<string, unknown>) || null) : null;
    if (isMissingTable(error.message || "", "customers")) return null;
    const missing = extractMissingColumn(error.message || "", "customers");
    if (missing) {
      const next = cols.filter((c) => c !== missing);
      if (next.length !== cols.length) {
        cols = next;
        continue;
      }
    }
    throw new Error(error.message || "Kunde konnte nicht geladen werden.");
  }
  return null;
}

async function findCustomerByPhone(supabase: ReturnType<typeof serviceClient>, phone: string): Promise<Record<string, unknown> | null> {
  if (!phone) return null;
  let cols = ["id", "email", "phone", "name", "company_name", "invoice_recipient_name", "customer_type", "contact_person"];
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await supabase.from("customers").select(cols.join(",")).eq("phone", phone).limit(2);
    if (!error) return Array.isArray(data) ? ((data[0] as Record<string, unknown>) || null) : null;
    if (isMissingTable(error.message || "", "customers")) return null;
    const missing = extractMissingColumn(error.message || "", "customers");
    if (missing) {
      const next = cols.filter((c) => c !== missing);
      if (next.length !== cols.length) {
        cols = next;
        continue;
      }
    }
    throw new Error(error.message || "Kunde konnte nicht geladen werden.");
  }
  return null;
}

async function upsertCustomer(
  supabase: ReturnType<typeof serviceClient>,
  input: {
    customer_type: "privat" | "firma";
    invoice_recipient_name: string;
    name: string;
    company_name: string;
    email: string;
    phone: string;
    contact_person: string;
  }
): Promise<string | null> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) return null;

  const found = (await findCustomerByEmail(supabase, email)) || (await findCustomerByPhone(supabase, phone));
  if (found?.id) return String(found.id);

  const name = cleanText(input.name || input.invoice_recipient_name || "", 160) || "Unbekannt";
  const company = cleanText(input.company_name || "", 160) || null;
  const contact = cleanText(input.contact_person || "", 160) || name;

  const customerTypeCandidates =
    input.customer_type === "firma"
      ? ["firma", "gewerblich", null]
      : ["privat", null];

  for (const customerTypeCandidate of customerTypeCandidates) {
    const payload: Record<string, unknown> = {
      name,
      company,
      email: email || null,
      phone: phone || null,
      contact_person: contact,
      source: "ops_agent",
    };
    if (customerTypeCandidate) payload.customer_type = customerTypeCandidate;

    try {
      const row = await insertAdaptive(supabase, "customers", payload, ["id"]);
      const id = String(row?.id || "").trim();
      if (id) return id;
    } catch {
      // try next candidate and final fallback lookup
    }
  }

  const fallback = (await findCustomerByEmail(supabase, email)) || (await findCustomerByPhone(supabase, phone));
  return fallback?.id ? String(fallback.id) : null;
}

async function logTimeline(
  supabase: ReturnType<typeof serviceClient>,
  ticketId: string,
  eventType: string,
  detail: string,
  actor: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await insertAdaptive(supabase, "timeline_events", {
      ticket_id: ticketId,
      event_type: eventType,
      detail,
      actor,
      metadata,
    });
  } catch (err) {
    const msg = String((err as Error).message || "");
    if (!msg.toLowerCase().includes("timeline_events")) throw err;
    await insertAdaptive(supabase, "ticket_events", {
      ticket_id: ticketId,
      event_typ: eventType,
      detail,
      actor,
      metadata,
    });
  }
}

async function logAudit(
  supabase: ReturnType<typeof serviceClient>,
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await insertAdaptive(supabase, "audit_log", {
      actor,
      action,
      entity_type: entityType,
      entity_id: entityId,
      payload,
    });
  } catch {
    // optional
  }
}

async function loadCatalog(supabase: ReturnType<typeof serviceClient>): Promise<Map<string, CatalogItem> | null> {
  let cols = ["code", "name", "unit", "unit_price", "tax_rate", "active"];
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await supabase.from("price_catalog_items").select(cols.join(",")).eq("active", true);
    if (!error) {
      const out = new Map<string, CatalogItem>();
      for (const row of (data || []) as Record<string, unknown>[]) {
        const code = String(row.code || "").trim();
        if (!code) continue;
        out.set(code, {
          code,
          name: String(row.name || code),
          unit: String(row.unit || "stk"),
          unit_price: Number(row.unit_price || 0),
          tax_rate: Number(row.tax_rate || 0),
        });
      }
      return out;
    }
    if (isMissingTable(error.message || "", "price_catalog_items")) return null;
    const missing = extractMissingColumn(error.message || "", "price_catalog_items");
    if (missing) {
      const next = cols.filter((c) => c !== missing);
      if (next.length !== cols.length) {
        cols = next;
        continue;
      }
    }
    throw new Error(error.message || "Preiskatalog konnte nicht geladen werden.");
  }
  return null;
}

function buildDraft(
  positionsInput: PositionInput[],
  catalog: Map<string, CatalogItem> | null,
  questions: string[]
): { positions: Record<string, unknown>[]; subtotal: number; tax: number; total: number; hasGaps: boolean } {
  const positions: Record<string, unknown>[] = [];
  let subtotal = 0;
  let tax = 0;
  let hasGaps = false;

  for (const input of positionsInput) {
    const code = String(input.code || "").trim();
    const qty = Number(input.qty || 0);
    if (!code || !Number.isFinite(qty) || qty <= 0) continue;

    const item = catalog?.get(code);
    if (!item) {
      hasGaps = true;
      questions.push(`Katalogposition fehlt: ${code}.`);
      continue;
    }

    const lineTotal = Number((qty * item.unit_price).toFixed(2));
    const lineTax = Number((lineTotal * (item.tax_rate / 100)).toFixed(2));
    subtotal += lineTotal;
    tax += lineTax;

    positions.push({
      code,
      name: item.name,
      qty,
      unit: item.unit,
      unit_price: item.unit_price,
      line_total: lineTotal,
      notes: cleanText(input.notes || "", 200),
    });
  }

  subtotal = Number(subtotal.toFixed(2));
  tax = Number(tax.toFixed(2));
  return { positions, subtotal, tax, total: Number((subtotal + tax).toFixed(2)), hasGaps };
}

function evaluateRisk(amount: number, hasGaps: boolean, critical: boolean): { risk_level: RiskLevel; requires_approval: boolean } {
  if (critical || hasGaps || amount > 1000) return { risk_level: "high", requires_approval: true };
  if (amount >= 250) return { risk_level: "medium", requires_approval: true };
  return { risk_level: "low", requires_approval: false };
}

function dedupe(items: string[], maxCount: number): string[] {
  const out: string[] = [];
  for (const item of items) {
    const value = cleanText(item, 220);
    if (!value) continue;
    if (!out.includes(value)) out.push(value);
    if (out.length >= maxCount) break;
  }
  return out;
}

async function persistReportDraft(
  supabase: ReturnType<typeof serviceClient>,
  ticketId: string,
  draft: Record<string, unknown>,
  actor: string
): Promise<string | null> {
  if (!ticketId) return null;
  const number = await nextDocumentNumber(supabase, "RAP");
  const checksum = await sha256Hex(JSON.stringify(draft));

  await insertAdaptive(supabase, "reports", {
    ticket_id: ticketId,
    document_number: number,
    status: "draft",
    data: {
      ...draft,
      created_by: actor,
      version_timestamp: new Date().toISOString(),
      checksum_sha256: checksum,
    },
  });

  await logTimeline(
    supabase,
    ticketId,
    "dokument_erstellt",
    `Rapportentwurf erstellt (${number})`,
    actor,
    { document_type: "reports", document_number: number, checksum_sha256: checksum }
  );

  return number;
}

async function loadLatestDocumentNumber(
  supabase: ReturnType<typeof serviceClient>,
  table: "reports",
  ticketId: string
): Promise<string | null> {
  let cols = ["id", "ticket_id", "document_number", "created_at"];
  let orderByCreated = true;
  for (let i = 0; i < 20 && cols.length; i += 1) {
    let query = supabase.from(table).select(cols.join(",")).eq("ticket_id", ticketId).limit(1);
    if (orderByCreated && cols.includes("created_at")) {
      query = query.order("created_at", { ascending: false });
    }
    const { data, error } = await query;
    if (!error) {
      const row = Array.isArray(data) ? ((data[0] as Record<string, unknown>) || null) : null;
      const number = cleanText(row?.document_number || "", 80);
      return number || null;
    }
    if (isMissingTable(error.message || "", table)) return null;
    const missing = extractMissingColumn(error.message || "", table);
    if (missing) {
      cols = cols.filter((c) => c !== missing);
      if (missing === "created_at") orderByCreated = false;
      continue;
    }
    return null;
  }
  return null;
}

async function sendCustomerInfoMail(
  adminEmail: string,
  to: string,
  subject: string,
  content: string
): Promise<boolean> {
  const recipient = normalizeEmail(to);
  if (!recipient) return false;
  try {
    const token = await getValidGraphAccessToken(adminEmail);
    const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: "Text",
            content,
          },
          toRecipients: [{ emailAddress: { address: recipient } }],
        },
        saveToSentItems: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const startedAt = Date.now();
  let outputPayload: Record<string, unknown> = {};
  let runTicketId: string | null = null;

  try {
    const admin = await requireAdmin(req);
    const body = (await req.json()) as Record<string, unknown>;
    const supabase = serviceClient();

    const text = [
      cleanMultiline(body.text || ""),
      cleanMultiline((body.email as Record<string, unknown> | undefined)?.subject || ""),
      cleanMultiline((body.email as Record<string, unknown> | undefined)?.content || ""),
      cleanMultiline(body.problem || ""),
      cleanMultiline(body.description || body.beschreibung || ""),
    ].filter(Boolean).join("\n");

    const intent = detectIntent(body, text);
    const explicitCategoryInput = pickText(body.category, body.kategorie);
    const explicitPriorityInput = pickText(body.priority, body.dringlichkeit, body.urgency);
    const explicitRequestTypeInput = pickText(body.request_type, body.anfrageart);
    const hasExplicitCategory = Boolean(explicitCategoryInput);
    const hasExplicitPriority = Boolean(explicitPriorityInput);
    const hasExplicitRequestType = Boolean(explicitRequestTypeInput);

    let ticketId = cleanText(body.ticket_id, 80);
    const customer = (body.customer as Record<string, unknown> | undefined) || {};
    const site = (body.site as Record<string, unknown> | undefined) || {};
    const existingTicket = ticketId ? await getTicketAdaptive(supabase, ticketId) : null;
    if (ticketId && !existingTicket) return json({ error: "Ticket nicht gefunden." }, 404);
    let ticketNumber = pickText(existingTicket?.ticket_number, existingTicket?.ticket_nummer);

    const existingCustomerId = cleanText(existingTicket?.customer_id, 80);
    const existingCustomer = existingCustomerId ? await getCustomerAdaptive(supabase, existingCustomerId) : null;

    const customerType = normalizeCustomerType(
      customer.type ||
        body.customer_type ||
        existingTicket?.customer_type ||
        existingCustomer?.customer_type
    );
    const customerContext: CustomerContext = {
      customer_type: customerType,
      name: pickText(customer.name, body.kunde_name, body.customer_name, existingTicket?.kunde_name, existingCustomer?.name),
      company_name: pickText(
        customer.company_name,
        body.kunde_firma,
        body.company_name,
        existingTicket?.kunde_firma,
        existingCustomer?.company_name,
        existingCustomer?.company
      ),
      invoice_recipient_name: pickText(
        customer.invoice_recipient_name,
        body.invoice_recipient_name,
        existingTicket?.invoice_recipient_name,
        existingCustomer?.invoice_recipient_name
      ),
      contact_person: pickText(customer.contact_person, body.ansprechpartner, body.contact_person, existingTicket?.ansprechpartner, existingCustomer?.contact_person),
      email: pickEmail(customer.email, body.kunde_email, body.email, existingTicket?.kunde_email, existingCustomer?.email),
      phone: pickPhone(customer.phone, body.kunde_telefon, body.phone, existingTicket?.kunde_telefon, existingCustomer?.phone),
    };

    if (!customerContext.invoice_recipient_name) {
      customerContext.invoice_recipient_name = customerType === "firma"
        ? pickText(customerContext.company_name, customerContext.name)
        : pickText(customerContext.name, customerContext.company_name);
    }
    if (!customerContext.name) {
      customerContext.name = customerType === "firma"
        ? pickText(customerContext.company_name, customerContext.invoice_recipient_name)
        : pickText(customerContext.invoice_recipient_name, customerContext.company_name);
    }
    if (!customerContext.name && customerContext.email) {
      customerContext.name = guessNameFromEmail(customerContext.email);
    }
    if (!customerContext.contact_person) {
      customerContext.contact_person = customerContext.name;
    }
    if (customerContext.customer_type === "firma" && !customerContext.company_name) {
      customerContext.company_name = pickText(customerContext.invoice_recipient_name, customerContext.name);
    }
    if (!customerContext.invoice_recipient_name) {
      customerContext.invoice_recipient_name = customerContext.customer_type === "firma"
        ? pickText(customerContext.company_name, customerContext.name)
        : pickText(customerContext.name, customerContext.company_name);
    }

    const siteContext: SiteContext = {
      address: pickText(site.address, body.objekt_adresse, body.address, existingTicket?.objekt_adresse, existingTicket?.object_address),
      plz: pickPlz(site.plz, body.objekt_plz, body.plz, existingTicket?.objekt_plz, existingTicket?.plz),
      city: pickText(site.city, body.objekt_ort, body.ort, body.city, existingTicket?.objekt_ort, existingTicket?.ort),
    };

    const problem = cleanMultiline(
      body.problem ||
        body.description ||
        body.beschreibung ||
        existingTicket?.beschreibung ||
        existingTicket?.description ||
        text,
      5000
    );
    const title = cleanText(body.title || body.titel || existingTicket?.titel || existingTicket?.title || problem.split("\n")[0] || "Neue Anfrage", 120);
    const dryRun = parseBoolean(body.dry_run) || parseBoolean(body.simulate_only);
    const autoProcessInbox = parseBoolean(body.auto_process_inbox) || parseBoolean(body.inbox_review) || cleanText(body.mode, 40).toLowerCase() === "inbox";
    const allowDeleteInvalid = parseBoolean(body.allow_delete) || parseBoolean(body.allow_delete_spam) || parseBoolean(body.delete_incomplete);

    const leadQuality = classifyLeadQuality({
      text: problem,
      title,
      customerName: customerContext.name || customerContext.invoice_recipient_name,
      email: customerContext.email,
      phone: customerContext.phone,
      address: siteContext.address,
      plz: siteContext.plz,
      city: siteContext.city,
    });

    let category = detectCategory(explicitCategoryInput, text);
    if (!hasExplicitCategory) {
      const existingCategory = pickText(existingTicket?.kategorie, existingTicket?.category);
      if (existingCategory) category = existingCategory;
    }
    let priority = detectPriority(explicitPriorityInput, text);
    if (!hasExplicitPriority) {
      const existingPriority = pickText(existingTicket?.dringlichkeit, existingTicket?.priority).toLowerCase();
      if (["niedrig", "mittel", "hoch", "kritisch"].includes(existingPriority)) {
        priority = existingPriority as Priority;
      }
    }
    let requestType = inferRequestType(
      explicitRequestTypeInput ||
        existingTicket?.request_type ||
        existingTicket?.anfrageart,
      text
    );

    let customerId: string | null = existingCustomerId || null;
    if (customerContext.email || customerContext.phone) {
      if (!dryRun) {
        customerId = await upsertCustomer(supabase, {
          customer_type: customerContext.customer_type,
          invoice_recipient_name: customerContext.invoice_recipient_name || customerContext.name,
          name: customerContext.name || customerContext.invoice_recipient_name || "Kunde",
          company_name: customerContext.company_name,
          email: customerContext.email,
          phone: customerContext.phone,
          contact_person: customerContext.contact_person,
        });
      } else {
        const found =
          (await findCustomerByEmail(supabase, customerContext.email)) ||
          (await findCustomerByPhone(supabase, customerContext.phone));
        customerId = found?.id ? String(found.id) : customerId;
      }
    }

    let learningApplied = false;
    if (customerId) {
      const hints = await loadCustomerLearningHints(supabase, customerId);
      if (!hasExplicitCategory && category === "Sonstiges" && hints.category) {
        category = hints.category;
        learningApplied = true;
      }
      if (!hasExplicitPriority && hints.priority) {
        priority = hints.priority;
        learningApplied = true;
      }
      if (!hasExplicitRequestType && hints.request_type) {
        requestType = hints.request_type;
        learningApplied = true;
      }
    }
    const anfrageart = requestTypeToAnfrageart(requestType);
    const statusSuggestion = chooseStatus(intent, priority);
    const assigneeSuggestion = chooseAssignee(category, priority);
    const slaDueAt = computeSlaDueAt(priority);

    const questions: string[] = [];
    const nextActions: string[] = [];
    const hasMandatoryGaps =
      (!customerContext.email && !customerContext.phone) ||
      (customerContext.customer_type === "firma" && !customerContext.company_name) ||
      !customerContext.invoice_recipient_name ||
      (!siteContext.address && !(siteContext.plz && siteContext.city)) ||
      !problem;

    if (!customerContext.email && !customerContext.phone) questions.push("Bitte mindestens E-Mail oder Telefon angeben.");
    if (customerContext.customer_type === "firma" && !customerContext.company_name) questions.push("Bei Firmenkunde fehlt der Firmenname.");
    if (!customerContext.invoice_recipient_name) questions.push("Kundenname fehlt.");
    if (!siteContext.address && !(siteContext.plz && siteContext.city)) questions.push("Objektadresse ist unvollständig.");
    if (!problem) questions.push("Problembeschreibung fehlt.");
    if (leadQuality.quality === "incomplete") {
      for (const reason of leadQuality.reasons) questions.push(reason);
    }
    if (leadQuality.quality === "spam") {
      questions.push("Anfrage als Spam markiert.");
    }

    const catalog = await loadCatalog(supabase);
    if (!catalog) questions.push("Preiskatalog fehlt (price_catalog_items). Bitte Quelle hinterlegen.");

    let reportMaterials = Array.isArray((body.rapport as Record<string, unknown> | undefined)?.materials)
      ? (((body.rapport as Record<string, unknown>).materials as PositionInput[]) || [])
      : [];
    if (reportMaterials.length === 0 && intent === "report_submitted" && catalog) {
      reportMaterials = suggestPositionsFromDescription(problem || text, catalog);
    }

    const rapport = (body.rapport as Record<string, unknown> | undefined) || {};
    const reportHours = Number(rapport.hours || 0);
    if (reportMaterials.length === 0) {
      reportMaterials = Array.isArray(rapport.materials) ? (rapport.materials as PositionInput[]) : [];
    }
    const reportHasSignature = Boolean(rapport.has_signature);
    const reportHasPhotos = Boolean(rapport.has_photos);
    const reportConfirmed = Boolean(rapport.confirmed || rapport.is_confirmed || body.rapport_confirmed || body.report_confirmed);

    let reportPlausible = true;
    const reportIssues: string[] = [];
    if (intent === "report_submitted") {
      if (!Number.isFinite(reportHours) || reportHours <= 0) {
        reportPlausible = false;
        reportIssues.push("Arbeitszeit fehlt oder ist ungültig.");
      }
      if (!reportHasSignature) {
        reportPlausible = false;
        reportIssues.push("Unterschrift/Bestätigung fehlt.");
      }
      if (!reportHasPhotos) reportIssues.push("Fotos fehlen (falls vorgesehen).");
      if (!reportConfirmed && intent === "report_submitted") {
        reportPlausible = false;
        reportIssues.push("Rapport ist noch nicht bestätigt.");
      }
    }

    let reportEstimateSubtotal = 0;
    let reportEstimateTax = 0;

    if (reportHours > 0) {
      const labor = catalog?.get("LABOR_HOURLY_80");
      if (labor) {
        const lineTotal = Number((reportHours * labor.unit_price).toFixed(2));
        const lineTax = Number((lineTotal * (labor.tax_rate / 100)).toFixed(2));
        reportEstimateSubtotal += lineTotal;
        reportEstimateTax += lineTax;
      } else {
        reportPlausible = false;
        reportIssues.push("Stundensatz nicht im Katalog gefunden (LABOR_HOURLY_80).");
      }
    }

    const materialDraft = buildDraft(reportMaterials, catalog, reportIssues);
    reportEstimateSubtotal = Number((reportEstimateSubtotal + materialDraft.subtotal).toFixed(2));
    reportEstimateTax = Number((reportEstimateTax + materialDraft.tax).toFixed(2));
    const reportEstimateTotal = Number((reportEstimateSubtotal + reportEstimateTax).toFixed(2));

    const riskEval = evaluateRisk(
      reportEstimateTotal,
      dedupe([...questions, ...reportIssues], 20).length > 0,
      priority === "kritisch" || Boolean(body.legal_critical) || Boolean(body.safety_critical)
    );

    let requiresApproval = riskEval.requires_approval;
    if (intent === "report_submitted" && !reportPlausible) requiresApproval = true;
    const isSpam = leadQuality.quality === "spam";
    const isIncompleteLead = leadQuality.quality === "incomplete";
    const inboxAutoAccept = autoProcessInbox &&
      !isSpam &&
      !isIncompleteLead &&
      !hasMandatoryGaps &&
      !requiresApproval;
    const keepInInboxForReview = autoProcessInbox && !inboxAutoAccept;
    let persistState = "none";
    let ticketRemoved = false;
    let processingDecision = dryRun ? "would_update" : "updated";

    if (ticketId) {
      const defaultStatus = normalizeStatus(body.status || statusSuggestion);
      let targetStatus = defaultStatus;
      let targetBucket = bucketForStatus(body.status || statusSuggestion);

      if (autoProcessInbox) {
        if (inboxAutoAccept) {
          targetStatus = "Geprueft";
          targetBucket = "active";
          processingDecision = dryRun ? "would_auto_accept" : "auto_accepted";
          nextActions.push("Inbox-Ticket automatisch angenommen (Status Geprüft).");
        } else if (keepInInboxForReview) {
          targetStatus = "Neu";
          targetBucket = "inbox";
          processingDecision = dryRun ? "would_leave_in_inbox" : "left_in_inbox";
          nextActions.push("Ticket bleibt in Inbox zur manuellen Prüfung.");
        }
      }

      if ((isSpam || isIncompleteLead) && autoProcessInbox && !allowDeleteInvalid) {
        targetStatus = "Storniert";
        targetBucket = "archive";
        processingDecision = dryRun ? "would_archive" : "archived";
        nextActions.push(isSpam ? "Ticket als Spam archiviert." : "Unvollständiges Ticket archiviert.");
      }

      if ((isSpam || isIncompleteLead) && autoProcessInbox && allowDeleteInvalid && dryRun) {
        processingDecision = "would_delete";
      }

      const updateData: Record<string, unknown> = {
        status: targetStatus,
        bucket: targetBucket,
        anfrageart,
        request_type: requestType,
        kategorie: category,
        category,
        dringlichkeit: priority,
        priority,
        titel: title,
        title,
        beschreibung: problem,
        description: problem,
        customer_type: customerContext.customer_type,
        invoice_recipient_name: customerContext.invoice_recipient_name || null,
        customer_display_name: customerContext.customer_type === "firma"
          ? customerContext.company_name || customerContext.invoice_recipient_name
          : customerContext.invoice_recipient_name || customerContext.name,
        ansprechpartner: customerContext.contact_person || null,
        contact_person: customerContext.contact_person || null,
        kunde_name: customerContext.invoice_recipient_name || customerContext.name,
        kunde_firma: customerContext.company_name || null,
        kunde_email: customerContext.email || "",
        kunde_telefon: customerContext.phone || "",
        objekt_adresse: siteContext.address || [siteContext.plz, siteContext.city].filter(Boolean).join(" "),
        object_address: siteContext.address || [siteContext.plz, siteContext.city].filter(Boolean).join(" "),
        objekt_plz: siteContext.plz || null,
        objekt_ort: siteContext.city || null,
        plz: siteContext.plz || null,
        ort: siteContext.city || null,
        internal_note: leadQuality.reasons.length > 0
          ? `Ops-Agent Hinweis: ${leadQuality.reasons.join(" | ")}`
          : null,
      };
      if (customerId) updateData.customer_id = customerId;

      const shouldAssignObjectOnAcceptance =
        autoProcessInbox &&
        targetBucket === "active";

      if (shouldAssignObjectOnAcceptance) {
        const objectPatch = await ensureTicketObjectAssignment(supabase, {
          objectId: existingTicket?.object_id,
          customerId: customerId || existingTicket?.customer_id,
          customerDisplayName:
            customerContext.company_name ||
            customerContext.invoice_recipient_name ||
            customerContext.name ||
            existingTicket?.customer_display_name ||
            existingTicket?.invoice_recipient_name,
          objectAddress: updateData.objekt_adresse || existingTicket?.objekt_adresse || existingTicket?.object_address,
          objectStreet: existingTicket?.objekt_strasse,
          objectZip: updateData.objekt_plz || existingTicket?.objekt_plz || existingTicket?.plz,
          objectCity: updateData.objekt_ort || existingTicket?.objekt_ort || existingTicket?.city || existingTicket?.ort,
        });
        if (objectPatch) Object.assign(updateData, objectPatch);
      }

      if (!dryRun) {
        await updateTicketAdaptive(supabase, ticketId, updateData);
        persistState = "ticket_updated";
      } else {
        persistState = "ticket_dry_run";
      }

      if ((isSpam || isIncompleteLead) && autoProcessInbox && allowDeleteInvalid && !dryRun) {
        const recipient = customerContext.email;
        if (recipient) {
          const subject = isSpam
            ? "Ihre Anfrage wurde nicht weiterverarbeitet"
            : "Ihre Anfrage ist unvollständig";
          const content = isSpam
            ? "Guten Tag,\n\nIhre Anfrage wurde als Spam eingestuft und daher nicht weiterbearbeitet.\nWenn dies ein Fehler ist, antworten Sie bitte mit den vollständigen Angaben.\n\nViele Grüße\nKusiPrimeTec"
            : "Guten Tag,\n\nIhre Anfrage konnte nicht bearbeitet werden, weil wichtige Angaben fehlen. Bitte senden Sie Name, Kontakt und Objektadresse erneut.\n\nViele Grüße\nKusiPrimeTec";
          const mailSent = await sendCustomerInfoMail(admin.email, recipient, subject, content);
          nextActions.push(mailSent
            ? `Info-E-Mail an ${recipient} versendet.`
            : `Info-E-Mail an ${recipient} konnte nicht versendet werden.`);
        }
        const { error: delErr } = await supabase.from("tickets").delete().eq("id", ticketId);
        if (!delErr) {
          persistState = "ticket_deleted";
          ticketRemoved = true;
          processingDecision = "deleted";
          nextActions.push(`Ticket ${ticketNumber || ticketId} gelöscht.`);
        } else {
          processingDecision = "archived";
          nextActions.push("Ticket konnte nicht gelöscht werden, bleibt archiviert.");
        }
      }

      if (!ticketRemoved && !dryRun) {
        await logTimeline(supabase, ticketId, "ops_agent_updated", `Ops-Agent hat Ticket aktualisiert (${intent}).`, admin.email, {
          intent,
          category,
          priority,
          risk_level: riskEval.risk_level,
          requires_approval: requiresApproval,
          auto_process_inbox: autoProcessInbox,
          lead_quality: leadQuality.quality,
        });
      }
      if (!dryRun) {
        await logAudit(supabase, admin.email, "ops_agent_ticket_update", "ticket", ticketId, {
          intent,
          category,
          priority,
          risk_level: riskEval.risk_level,
          requires_approval: requiresApproval,
          auto_process_inbox: autoProcessInbox,
          lead_quality: leadQuality.quality,
          ticket_removed: ticketRemoved,
        });
      }
    } else if (intent === "new_request" && !hasMandatoryGaps && leadQuality.quality === "ok") {
      processingDecision = dryRun ? "would_create_ticket" : "created_ticket";
      if (!dryRun) ticketNumber = await nextTicketNumber(supabase);
      else ticketNumber = ticketNumber || "KPT-DRYRUN";

      const createData: Record<string, unknown> = {
        ticket_nummer: ticketNumber,
        ticket_number: ticketNumber,
        status: "Neu",
        bucket: "inbox",
        anfrageart,
        request_type: requestType,
        kategorie: category,
        category,
        dringlichkeit: priority,
        priority,
        titel: title,
        title,
        beschreibung: problem,
        description: problem,
        customer_type: customerContext.customer_type,
        invoice_recipient_name: customerContext.invoice_recipient_name || null,
        customer_display_name: customerContext.customer_type === "firma"
          ? customerContext.company_name || customerContext.invoice_recipient_name
          : customerContext.invoice_recipient_name || customerContext.name,
        ansprechpartner: customerContext.contact_person || null,
        contact_person: customerContext.contact_person || null,
        kunde_name: customerContext.invoice_recipient_name || customerContext.name,
        kunde_firma: customerContext.company_name || null,
        kunde_email: customerContext.email || "",
        kunde_telefon: customerContext.phone || "",
        objekt_adresse: siteContext.address || [siteContext.plz, siteContext.city].filter(Boolean).join(" "),
        object_address: siteContext.address || [siteContext.plz, siteContext.city].filter(Boolean).join(" "),
        objekt_plz: siteContext.plz || null,
        objekt_ort: siteContext.city || null,
        plz: siteContext.plz || null,
        ort: siteContext.city || null,
      };
      if (customerId) createData.customer_id = customerId;

      if (!dryRun) {
        const created = await insertAdaptive(supabase, "tickets", createData, ["id", "ticket_nummer", "ticket_number"]);
        ticketId = String(created?.id || "");
        ticketNumber = String(created?.ticket_number || created?.ticket_nummer || ticketNumber);
        runTicketId = ticketId || null;
        persistState = "ticket_created";
      } else {
        persistState = "ticket_create_dry_run";
      }

      if (ticketId && !dryRun) {
        await logTimeline(supabase, ticketId, "inbox_created", "Ticket durch Ops-Agent angelegt.", admin.email, {
          intent,
          category,
          priority,
        });
        await logAudit(supabase, admin.email, "ops_agent_ticket_create", "ticket", ticketId, {
          ticket_number: ticketNumber,
          intent,
          category,
          priority,
        });
      }
    } else if (!ticketId && intent === "new_request") {
      processingDecision = "skipped";
      if (leadQuality.quality === "spam") {
        nextActions.push("Neue Anfrage als Spam erkannt, Ticket wurde nicht angelegt.");
      } else {
        nextActions.push("Ticket nicht angelegt: Pflichtdaten ergänzen und Vorgang erneut ausführen.");
      }
    }

    let reportDoc: string | null = null;
    let existingReportDoc: string | null = null;
    if (ticketId) {
      existingReportDoc = await loadLatestDocumentNumber(supabase, "reports", ticketId);
    }

    const canCreateDocs = ticketId && !ticketRemoved && !isSpam && !dryRun;
    if (canCreateDocs && !existingReportDoc && intent === "report_submitted") {
      reportDoc = await persistReportDraft(
        supabase,
        ticketId,
        {
          title,
          problem,
          customer: customerContext,
          site: siteContext,
          rapport: {
            hours: Number.isFinite(reportHours) ? reportHours : 0,
            materials: reportMaterials,
            has_signature: reportHasSignature,
            has_photos: reportHasPhotos,
            confirmed: reportConfirmed,
          },
        },
        admin.email
      );
      if (reportDoc) nextActions.push(`Rapportentwurf ${reportDoc} gespeichert.`);
    } else if (existingReportDoc) {
      reportDoc = existingReportDoc;
    }

    if (requiresApproval) {
      nextActions.push("Freigabe erforderlich, bevor der Vorgang finalisiert wird.");
    } else {
      nextActions.push("Automatische Weiterverarbeitung ist zulässig.");
    }
    if (dryRun) nextActions.push("Dry-Run aktiv: keine Daten wurden gespeichert.");
    if (ticketId && !ticketRemoved) nextActions.push(`Ticket ${ticketNumber || ticketId} im Admin prüfen.`);
    if (intent === "new_request") nextActions.push("Kundenantwort-Entwurf versenden (Eingangsbestätigung + SLA).");

    const structuredData = {
      intent,
      category,
      priority,
      customer: {
        name: customerContext.customer_type === "firma"
          ? customerContext.company_name || customerContext.invoice_recipient_name
          : customerContext.invoice_recipient_name || customerContext.name,
        email: customerContext.email,
        phone: customerContext.phone,
      },
      site: {
        address: siteContext.address || [siteContext.plz, siteContext.city].filter(Boolean).join(" "),
        plz: siteContext.plz,
      },
      ticket: {
        status_suggestion: statusSuggestion,
        assignee_suggestion: assigneeSuggestion,
        sla_due_at: slaDueAt,
      },
      rapport_check: {
        plausible: reportPlausible,
        issues: dedupe(reportIssues, 20),
      },
      risk_level: riskEval.risk_level,
      requires_approval: requiresApproval,
      reasoning_short: requiresApproval
        ? "Datenlücken, Plausibilitätsrisiken oder Betrag erfordern Freigabe."
        : "Niedriges Risiko und vollständige Daten, automatische Verarbeitung möglich.",
      learning_applied: learningApplied,
      lead_quality: leadQuality.quality,
      lead_quality_reasons: dedupe(leadQuality.reasons, 5),
      processing_decision: processingDecision,
    };

    const shortAssessment = [
      `Intent ${intent} erkannt, Kategorie ${category}, Priorität ${priority}.`,
      ticketRemoved
        ? `Ticket ${ticketNumber || ticketId || ""} wurde gemäß Regelwerk entfernt.`
        : ticketId
        ? `Ticket ${ticketNumber || ticketId} wurde ${persistState === "ticket_created" ? "angelegt" : "aktualisiert"}.`
        : "Kein Ticket persistiert, da Pflichtdaten fehlen oder nur Entwurf möglich war.",
      `Risiko ${riskEval.risk_level}${requiresApproval ? " mit Freigabepflicht." : " ohne Freigabepflicht."}`,
    ].join(" ");

    const openQuestions = dedupe(questions, 3);
    const actions = dedupe(nextActions, 5);

    outputPayload = {
      short_assessment: shortAssessment,
      structured_data: structuredData,
      next_actions: actions,
      open_questions: openQuestions,
      meta: {
        dry_run: dryRun,
        ticket_id: ticketId || null,
        ticket_number: ticketNumber || null,
        customer_id: customerId,
        report_document_number: reportDoc,
        elapsed_ms: Date.now() - startedAt,
      },
    };

    runTicketId = ticketId || runTicketId;

    if (!dryRun) {
      try {
        await insertAdaptive(supabase, "ops_agent_runs", {
          ticket_id: runTicketId,
          intent,
          risk_level: riskEval.risk_level,
          requires_approval: requiresApproval,
          actor: admin.email,
          input_payload: body,
          output_payload: outputPayload,
        });
      } catch {
        // optional table
      }
    }

    return json(outputPayload);
  } catch (err) {
    const message = String((err as Error).message || "Unbekannter Fehler");
    const status = message.toLowerCase().includes("nicht autorisiert") || message.toLowerCase().includes("ungueltige session") ? 401 : 500;
    return json({ error: message, output_payload: outputPayload, ticket_id: runTicketId }, status);
  }
});
