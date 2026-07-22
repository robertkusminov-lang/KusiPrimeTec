import { json, options } from "../_shared/cors.ts";
import { requireCustomer } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";
import { canCustomerAccessTicket } from "../_shared/customer-object-access.ts";

type DbRow = Record<string, unknown>;

type InternalReport = {
  id: string;
  persistedId: string | null;
  syntheticId: string | null;
  ticketId: string;
  documentNumber: string;
  status: "entwurf" | "gesendet" | "akzeptiert" | "abgelehnt";
  data: DbRow;
  createdAt: string;
  updatedAt: string;
  sourceTable: "ticket_documents" | "reports";
  sourceId: string | null;
};

const RELEASED_STATUSES = new Set(["gesendet", "akzeptiert"]);

function isMissingTable(message: string, table: string): boolean {
  const msg = String(message || "").toLowerCase();
  const tableName = table.toLowerCase();
  return (
    msg.includes(`could not find the table 'public.${tableName}'`) ||
    (msg.includes("schema cache") && msg.includes(tableName))
  );
}

function isUniqueViolation(message: string): boolean {
  const msg = String(message || "").toLowerCase();
  return msg.includes("duplicate key") || msg.includes("unique constraint") || msg.includes("23505");
}

function pickString(row: DbRow, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return fallback;
}

function pickNullableString(row: DbRow, keys: string[]): string | null {
  const value = pickString(row, keys, "").trim();
  return value ? value : null;
}

function pickNumber(row: DbRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function pickBoolean(row: DbRow, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1") return true;
    if (value === 0 || value === "0") return false;
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) continue;
    if (["true", "ja", "yes", "y"].includes(raw)) return true;
    if (["false", "nein", "no", "n"].includes(raw)) return false;
  }
  return null;
}

function cleanInline(value: unknown): string {
  const cleaned = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = cleaned.replace(/\b(?:undefined|null)\b/gi, " ").replace(/\s+/g, " ").trim();
  return normalized;
}

function cleanRichText(value: unknown): string {
  const text = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
  const normalized = text.replace(/\b(?:undefined|null)\b/gi, " ").replace(/[ \t]+\n/g, "\n").trim();
  return normalized;
}

function normalizeCustomerType(value: unknown): "privat" | "firma" | null {
  const raw = cleanInline(value).toLowerCase();
  if (!raw) return null;
  if (raw === "privat" || raw === "private") return "privat";
  if (["firma", "gewerblich", "gewerbe", "unternehmen", "business", "company", "b2b"].includes(raw)) return "firma";
  return null;
}

function resolveInvoiceRecipientName(input: {
  customerType?: unknown;
  invoiceRecipientName?: unknown;
  kundeName?: unknown;
  kundeFirma?: unknown;
}): string {
  const type = normalizeCustomerType(input.customerType);
  const explicit = cleanInline(input.invoiceRecipientName);
  const person = cleanInline(input.kundeName);
  const company = cleanInline(input.kundeFirma);
  if (type === "firma") return explicit || company || person;
  return explicit || person || company;
}

function resolveCustomerDisplayName(input: {
  customerType?: unknown;
  invoiceRecipientName?: unknown;
  kundeName?: unknown;
  kundeFirma?: unknown;
}): string {
  const invoice = resolveInvoiceRecipientName(input);
  const person = cleanInline(input.kundeName);
  const company = cleanInline(input.kundeFirma);
  const type = normalizeCustomerType(input.customerType);
  if (type === "firma") return invoice || company || person;
  return invoice || person || company;
}

function normalizeDocumentStatus(value: unknown): "entwurf" | "gesendet" | "akzeptiert" | "abgelehnt" {
  const raw = cleanInline(value).toLowerCase();
  if (!raw) return "entwurf";
  if (raw === "sent" || raw === "gesendet") return "gesendet";
  if (raw === "accepted" || raw === "akzeptiert") return "akzeptiert";
  if (raw === "rejected" || raw === "abgelehnt") return "abgelehnt";
  return "entwurf";
}

function composeObjectAddress(street: string | null, zip: string | null, city: string | null, fallback = ""): string {
  const line2 = [cleanInline(zip), cleanInline(city)].filter(Boolean).join(" ");
  const composed = [cleanInline(street), line2].filter(Boolean).join(", ");
  return composed || cleanInline(fallback);
}

function normalizeDocumentType(row: DbRow): string {
  return cleanInline(
    pickString(row, ["dokument_typ", "doc_type", "document_type", "type", "typ"], "rapport"),
  ).toLowerCase();
}

function normalizePhotoList(data: DbRow): Array<{ src: string; caption?: string; area?: string; beforeAfter?: string }> {
  const raw = Array.isArray(data.fotodokumentation_kunden)
    ? data.fotodokumentation_kunden
    : Array.isArray(data.fotodokumentation)
      ? data.fotodokumentation
      : [];

  const out: Array<{ src: string; caption?: string; area?: string; beforeAfter?: string }> = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const src = String(item || "").trim();
      if (src) out.push({ src });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as DbRow;
    const isVisible = pickBoolean(row, ["customer_visible", "kundenfreigabe", "freigegeben", "is_public", "public_visible"]);
    if (isVisible === false) continue;
    const src = pickString(row, ["src", "url", "image", "image_url", "photo"], "").trim();
    if (!src) continue;
    out.push({
      src,
      caption: pickNullableString(row, ["caption", "beschriftung", "beschreibung", "label"]) || undefined,
      area: pickNullableString(row, ["bereich", "area"]) || undefined,
      beforeAfter: pickNullableString(row, ["before_after", "beforeAfter", "vorher_nachher"]) || undefined,
    });
  }
  return out;
}

function normalizeMaterialList(data: DbRow): Array<{ id: string; beschreibung: string; menge: number | null; einheit: string; bemerkung?: string }> {
  const raw = Array.isArray(data.materialliste) ? data.materialliste : [];
  const out: Array<{ id: string; beschreibung: string; menge: number | null; einheit: string; bemerkung?: string }> = [];
  raw.forEach((item, index) => {
    if (typeof item === "string") {
      const description = cleanInline(item);
      if (!description) return;
      out.push({ id: `m-${index + 1}`, beschreibung: description, menge: 1, einheit: "Stk" });
      return;
    }
    if (!item || typeof item !== "object") return;
    const row = item as DbRow;
    const beschreibung = cleanInline(pickString(row, ["beschreibung", "bezeichnung"], ""));
    if (!beschreibung) return;
    out.push({
      id: pickString(row, ["id"], `m-${index + 1}`),
      beschreibung,
      menge: pickNumber(row, ["menge"]),
      einheit: pickString(row, ["einheit"], "Stk"),
      bemerkung: pickNullableString(row, ["bemerkung", "notiz", "verwendung"]) || undefined,
    });
  });
  return out;
}

function normalizeArbeitstage(data: DbRow): Array<{ id: string; datum: string; beginn: string; ende: string; stunden: number | null; notiz?: string }> {
  const raw = Array.isArray(data.arbeitstage) ? data.arbeitstage : [];
  const out: Array<{ id: string; datum: string; beginn: string; ende: string; stunden: number | null; notiz?: string }> = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as DbRow;
    const datum = cleanInline(row.datum);
    const beginn = cleanInline(row.beginn);
    const ende = cleanInline(row.ende);
    const stunden = pickNumber(row, ["stunden"]);
    const notiz = cleanRichText(row.notiz);
    if (!datum && !beginn && !ende && stunden == null && !notiz) return;
    out.push({
      id: pickString(row, ["id"], `tag-${index + 1}`),
      datum,
      beginn,
      ende,
      stunden,
      notiz: notiz || undefined,
    });
  });
  return out;
}

function coerceSafeField(data: DbRow, aliases: string[], mode: "inline" | "rich" | "number"): string | number | null {
  for (const alias of aliases) {
    const value = data[alias];
    if (value === undefined || value === null) continue;
    if (mode === "number") {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
      continue;
    }
    const cleaned = mode === "inline" ? cleanInline(value) : cleanRichText(value);
    if (cleaned) return cleaned;
  }
  return null;
}

function resolveRecipientFields(ticket: DbRow, customer: DbRow | null): {
  kunde: string;
  kundeName: string;
  kundeFirma: string;
  kundeEmail: string;
  kundeTelefon: string;
  ansprechpartner: string;
} {
  const customerType = normalizeCustomerType(ticket.customer_type || ticket.kunde_typ || customer?.customer_type);
  const kundeFirma =
    cleanInline(ticket.kunde_firma || ticket.company_name || ticket.customer_company || customer?.company_name || customer?.company || "");
  const kundeName =
    cleanInline(ticket.kunde_name || ticket.customer_name || ticket.contact_name || customer?.name || customer?.contact_person || "");
  const invoiceRecipientName = resolveInvoiceRecipientName({
    customerType,
    invoiceRecipientName: ticket.invoice_recipient_name || customer?.invoice_recipient_name,
    kundeName,
    kundeFirma,
  });

  return {
    kunde: resolveCustomerDisplayName({
      customerType,
      invoiceRecipientName,
      kundeName,
      kundeFirma,
    }) || "-",
    kundeName: kundeName || invoiceRecipientName || "",
    kundeFirma,
    kundeEmail: cleanInline(ticket.kunde_email || ticket.customer_email || ticket.email || customer?.email || ""),
    kundeTelefon: cleanInline(ticket.kunde_telefon || ticket.customer_phone || ticket.phone || customer?.phone || ""),
    ansprechpartner:
      cleanInline(ticket.ansprechpartner || ticket.contact_person || customer?.contact_person || customer?.name || "") || "",
  };
}

function sanitizeReportData(data: DbRow, ticket: DbRow, objectRow: DbRow | null, customer: DbRow | null) {
  const recipient = resolveRecipientFields(ticket, customer);
  const objectStreet = cleanInline(data.objekt_strasse || ticket.objekt_strasse || objectRow?.street || "");
  const objectZip = cleanInline(data.objekt_plz || ticket.objekt_plz || objectRow?.zip || "");
  const objectCity = cleanInline(data.objekt_ort || ticket.objekt_ort || objectRow?.city || ticket.ort || ticket.city || "");
  const objectAddress = composeObjectAddress(
    objectStreet || null,
    objectZip || null,
    objectCity || null,
    pickString(data, ["objekt_adresse", "object_address"], pickString(ticket, ["objekt_adresse", "object_address"], "")),
  );
  const zeitenRaw = data.zeiten && typeof data.zeiten === "object" ? (data.zeiten as DbRow) : {};
  const signatureStatus =
    cleanInline(data.signatur_kunde_status || data.signature_status || "") ||
    (cleanInline(data.signatur_kunde_image || "") ? "bestaetigt" : "");

  return {
    ticket_nummer: pickString(data, ["ticket_nummer"], pickString(ticket, ["ticket_nummer", "ticket_number"], "")),
    dokument_datum: pickNullableString(data, ["dokument_datum"]) || null,
    referenz: pickNullableString(data, ["referenz"]) || null,
    kunde: pickString(data, ["kunde"], recipient.kunde),
    kunde_name: pickString(data, ["kunde_name"], recipient.kundeName),
    ansprechpartner: pickString(data, ["ansprechpartner"], recipient.ansprechpartner),
    betreut_durch: pickString(data, ["betreut_durch", "assigned_agent", "zustaendiger_mitarbeiter"], "Robert Kusminov"),
    kunde_firma: pickString(data, ["kunde_firma"], recipient.kundeFirma),
    kunde_email: pickString(data, ["kunde_email"], recipient.kundeEmail),
    kunde_telefon: pickString(data, ["kunde_telefon"], recipient.kundeTelefon),
    objekt_name: pickString(data, ["objekt_name"], pickString(objectRow || {}, ["name"], "")),
    objekt_adresse: objectAddress,
    objekt_strasse: objectStreet,
    objekt_plz: objectZip,
    objekt_ort: objectCity,
    leistungsbeschreibung: cleanRichText(data.leistungsbeschreibung || data.description || ticket.beschreibung || ""),
    ergebnis: coerceSafeField(data, ["ergebnis", "result"], "rich"),
    hinweise: cleanRichText(data.hinweise || data.notes || ""),
    offene_punkte: coerceSafeField(data, ["offene_punkte", "open_points"], "rich"),
    empfehlungen: coerceSafeField(data, ["empfehlungen", "recommendations"], "rich"),
    naechste_schritte: coerceSafeField(data, ["naechste_schritte", "nächste_schritte", "next_steps"], "rich"),
    rapport_art: coerceSafeField(data, ["rapport_art", "report_type", "report_kind"], "inline"),
    leistungszeitraum: coerceSafeField(data, ["leistungszeitraum"], "inline"),
    zeiten: {
      ankunft: pickNullableString(zeitenRaw, ["ankunft"]) || null,
      beginn: pickNullableString(zeitenRaw, ["beginn"]) || null,
      ende: pickNullableString(zeitenRaw, ["ende"]) || null,
      gesamtstunden: pickNumber(zeitenRaw, ["gesamtstunden"]),
    },
    arbeitstage: normalizeArbeitstage(data),
    materialliste: normalizeMaterialList(data),
    fotodokumentation_kunden: normalizePhotoList(data),
    stundenkonto_verwendet: coerceSafeField(data, ["stundenkonto_verwendet", "used_hours", "verwendete_stunden"], "number"),
    stundenkonto_verbleibend: coerceSafeField(data, ["stundenkonto_verbleibend", "remaining_hours", "reststunden"], "number"),
    zusatzstunden: coerceSafeField(data, ["zusatzstunden", "additional_hours"], "number"),
    signatur_kunde_label: pickString(data, ["signatur_kunde_label"], "Unterschrift Kunde / Ansprechpartner"),
    signatur_kunde_image: pickNullableString(data, ["signatur_kunde_image"]) || null,
    signatur_kunde_name: pickNullableString(data, ["signatur_kunde_name"]) || null,
    signatur_kunde_funktion: pickNullableString(data, ["signatur_kunde_funktion"]) || null,
    signatur_kunde_bestaetigt_at: pickNullableString(data, ["signatur_kunde_bestaetigt_at"]) || null,
    signatur_kunde_status: signatureStatus || null,
    signatur_kusi_label: pickNullableString(data, ["signatur_kusi_label"]) || null,
    signatur_kusi_image: pickNullableString(data, ["signatur_kusi_image"]) || null,
    rechtlicher_hinweis:
      coerceSafeField(data, ["rechtlicher_hinweis", "legal_note"], "rich") ||
      "Dieser Rapport dokumentiert die ausgeführten Leistungen und die im Rahmen des Einsatzes sichtbaren Feststellungen. Er stellt keine technische Prüfung, Fachprüfung oder Abnahme dar.",
  };
}

function isReleasedReport(report: InternalReport): boolean {
  return RELEASED_STATUSES.has(report.status);
}

function isCustomerSignable(report: InternalReport): boolean {
  if (!isReleasedReport(report)) return false;
  const locked = pickBoolean(report.data, ["signatur_kunde_locked", "signature_locked", "locked_for_customer"]);
  if (locked === true) return false;
  const signatureStatus = cleanInline(report.data.signatur_kunde_status || report.data.signature_status || "").toLowerCase();
  if (signatureStatus === "gesperrt" || signatureStatus === "locked") return false;
  return true;
}

async function loadCustomerByUserId(supabase: ReturnType<typeof serviceClient>, userId: string): Promise<DbRow | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("auth_user_id", userId)
    .limit(2);
  if (error) {
    if (isMissingTable(error.message || "", "customers")) return null;
    throw new Error(error.message || "Kundenkonto konnte nicht geladen werden.");
  }
  return Array.isArray(data) ? ((data[0] as DbRow) || null) : null;
}

async function loadObjectsByUserId(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  customerId: string | null,
): Promise<DbRow[]> {
  if (!customerId) return [];
  const { data, error } = await supabase
    .from("objects")
    .select("*")
    .eq("requester_user_id", userId)
    .eq("customer_id", customerId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingTable(error.message || "", "objects")) return [];
    throw new Error(error.message || "Objekte konnten nicht geladen werden.");
  }
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function loadTicketsByField(
  supabase: ReturnType<typeof serviceClient>,
  field: "requester_user_id" | "customer_id" | "object_id",
  value: string | string[],
): Promise<DbRow[]> {
  if (Array.isArray(value) && value.length === 0) return [];
  let query = supabase.from("tickets").select("*");
  query = Array.isArray(value) ? query.in(field, value) : query.eq(field, value);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
  if (error) {
    if (isMissingTable(error.message || "", "tickets")) return [];
    throw new Error(error.message || "Tickets konnten nicht geladen werden.");
  }
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function loadAccessibleTickets(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  customerId: string,
  objectsById: Map<string, DbRow>,
): Promise<DbRow[]> {
  const objectIds = [...objectsById.keys()].filter(Boolean);
  if (!objectIds.length) return [];
  const rows = await loadTicketsByField(supabase, "object_id", objectIds);
  return rows.filter((ticket) => {
    const object = objectsById.get(pickString(ticket, ["object_id"], ""));
    return canCustomerAccessTicket(ticket, object, customerId, userId);
  });
}

async function loadTicketDocuments(supabase: ReturnType<typeof serviceClient>, ticketIds: string[]): Promise<DbRow[]> {
  if (!ticketIds.length) return [];
  const { data, error } = await supabase
    .from("ticket_documents")
    .select("*")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error.message || "", "ticket_documents")) return [];
    throw new Error(error.message || "Rapporte konnten nicht geladen werden.");
  }
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function loadSourceReports(supabase: ReturnType<typeof serviceClient>, ticketIds: string[]): Promise<DbRow[]> {
  if (!ticketIds.length) return [];
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error.message || "", "reports")) return [];
    throw new Error(error.message || "Berichtsquelle konnte nicht geladen werden.");
  }
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

function toInternalReports(ticketDocuments: DbRow[], sourceReports: DbRow[]): InternalReport[] {
  const out = new Map<string, InternalReport>();

  for (const row of ticketDocuments) {
    if (normalizeDocumentType(row) !== "rapport") continue;
    const ticketId = pickString(row, ["ticket_id"], "");
    if (!ticketId) continue;
    const documentNumber = pickString(row, ["dokument_nummer", "document_number"], "").trim();
    if (!documentNumber) continue;
    const key = `${ticketId}::${documentNumber.toLowerCase()}`;
    out.set(key, {
      id: pickString(row, ["id"], key),
      persistedId: pickString(row, ["id"], "") || null,
      syntheticId: null,
      ticketId,
      documentNumber,
      status: normalizeDocumentStatus(row.status),
      data: row.data && typeof row.data === "object" ? (row.data as DbRow) : {},
      createdAt: pickString(row, ["created_at"], new Date(0).toISOString()),
      updatedAt: pickString(row, ["updated_at", "created_at"], new Date(0).toISOString()),
      sourceTable: "ticket_documents",
      sourceId: pickString(row, ["id"], "") || null,
    });
  }

  for (const row of sourceReports) {
    const ticketId = pickString(row, ["ticket_id"], "");
    const sourceId = pickString(row, ["id"], "");
    const documentNumber = pickString(row, ["document_number", "dokument_nummer"], "").trim();
    if (!ticketId || !sourceId || !documentNumber) continue;
    const key = `${ticketId}::${documentNumber.toLowerCase()}`;
    if (out.has(key)) continue;
    out.set(key, {
      id: `src-reports-${sourceId}`,
      persistedId: null,
      syntheticId: `src-reports-${sourceId}`,
      ticketId,
      documentNumber,
      status: normalizeDocumentStatus(row.status),
      data: row.data && typeof row.data === "object" ? (row.data as DbRow) : {},
      createdAt: pickString(row, ["created_at"], new Date(0).toISOString()),
      updatedAt: pickString(row, ["updated_at", "created_at"], new Date(0).toISOString()),
      sourceTable: "reports",
      sourceId,
    });
  }

  return [...out.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function buildSummary(report: InternalReport, ticket: DbRow, objectRow: DbRow | null, customer: DbRow | null) {
  const safeData = sanitizeReportData(report.data, ticket, objectRow, customer);
  return {
    id: report.id,
    ticket_id: report.ticketId,
    ticket_nummer: pickString(ticket, ["ticket_nummer", "ticket_number"], safeData.ticket_nummer),
    dokument_nummer: report.documentNumber,
    dokument_status: report.status,
    created_at: report.createdAt,
    updated_at: report.updatedAt,
    released: isReleasedReport(report),
    signable: isCustomerSignable(report),
    has_signature: Boolean(safeData.signatur_kunde_image),
    signature_status: safeData.signatur_kunde_status || (safeData.signatur_kunde_image ? "bestaetigt" : "offen"),
    kunde: safeData.kunde,
    objekt: safeData.objekt_name || pickString(objectRow || {}, ["name"], "Objekt"),
    objekt_adresse: safeData.objekt_adresse,
    rapport_art: safeData.rapport_art || null,
    einsatzdatum: safeData.dokument_datum || pickNullableString(ticket, ["terminwunsch"]) || null,
    kategorie: pickString(ticket, ["kategorie"], ""),
    ticket_status: pickString(ticket, ["status"], ""),
  };
}

function buildDetail(report: InternalReport, ticket: DbRow, objectRow: DbRow | null, customer: DbRow | null) {
  const safeData = sanitizeReportData(report.data, ticket, objectRow, customer);
  return {
    id: report.id,
    ticket_id: report.ticketId,
    dokument_nummer: report.documentNumber,
    dokument_status: report.status,
    created_at: report.createdAt,
    updated_at: report.updatedAt,
    released: isReleasedReport(report),
    signable: isCustomerSignable(report),
    replaceable: isCustomerSignable(report),
    ticket: {
      id: pickString(ticket, ["id"], report.ticketId),
      ticket_nummer: pickString(ticket, ["ticket_nummer", "ticket_number"], safeData.ticket_nummer),
      status: pickString(ticket, ["status"], ""),
      kategorie: pickString(ticket, ["kategorie"], ""),
      dringlichkeit: pickString(ticket, ["dringlichkeit", "priority"], ""),
      created_at: pickString(ticket, ["created_at"], ""),
      terminwunsch: pickNullableString(ticket, ["terminwunsch", "desired_date"]) || null,
      zeitfenster_von: pickNullableString(ticket, ["zeitfenster_von", "time_from"]) || null,
      zeitfenster_bis: pickNullableString(ticket, ["zeitfenster_bis", "time_to"]) || null,
    },
    object: {
      id: pickNullableString(objectRow || {}, ["id"]),
      name: safeData.objekt_name || pickString(objectRow || {}, ["name"], "Objekt"),
      street: safeData.objekt_strasse || "",
      zip: safeData.objekt_plz || "",
      city: safeData.objekt_ort || "",
      address: safeData.objekt_adresse,
    },
    customer: {
      display_name: safeData.kunde,
      company: safeData.kunde_firma || "",
      contact_person: safeData.ansprechpartner || "",
      email: safeData.kunde_email || "",
      phone: safeData.kunde_telefon || "",
    },
    report: safeData,
  };
}

async function findPersistedTicketReport(supabase: ReturnType<typeof serviceClient>, ticketId: string): Promise<DbRow | null> {
  const rows = await loadTicketDocuments(supabase, [ticketId]);
  return rows.find((row) => normalizeDocumentType(row) === "rapport") || null;
}

async function ensurePersistedReportDocument(
  supabase: ReturnType<typeof serviceClient>,
  report: InternalReport,
): Promise<{ id: string; data: DbRow; status: string }> {
  if (report.persistedId) {
    return {
      id: report.persistedId,
      data: report.data,
      status: report.status,
    };
  }

  const existing = await findPersistedTicketReport(supabase, report.ticketId);
  if (existing) {
    return {
      id: pickString(existing, ["id"], ""),
      data: existing.data && typeof existing.data === "object" ? (existing.data as DbRow) : {},
      status: normalizeDocumentStatus(existing.status),
    };
  }

  const body: DbRow = {
    ticket_id: report.ticketId,
    dokument_typ: "rapport",
    doc_type: "report",
    document_type: "report",
    type: "rapport",
    typ: "rapport",
    dokument_nummer: report.documentNumber,
    status: report.status,
    data: report.data,
    storage_path: "",
    created_by: "customer",
    source_table: report.sourceTable === "reports" ? "reports" : null,
    source_id: report.sourceId,
  };

  const { data, error } = await supabase.from("ticket_documents").insert(body).select("*").limit(1);
  if (error) {
    if (isUniqueViolation(error.message || "")) {
      const retry = await findPersistedTicketReport(supabase, report.ticketId);
      if (retry) {
        return {
          id: pickString(retry, ["id"], ""),
          data: retry.data && typeof retry.data === "object" ? (retry.data as DbRow) : {},
          status: normalizeDocumentStatus(retry.status),
        };
      }
    }
    throw new Error(error.message || "Rapport konnte nicht vorbereitet werden.");
  }

  const row = Array.isArray(data) ? ((data[0] as DbRow) || null) : null;
  if (!row) throw new Error("Rapport konnte nicht vorbereitet werden.");
  return {
    id: pickString(row, ["id"], ""),
    data: row.data && typeof row.data === "object" ? (row.data as DbRow) : {},
    status: normalizeDocumentStatus(row.status),
  };
}

async function logSignatureEvent(
  supabase: ReturnType<typeof serviceClient>,
  payload: {
    ticketId: string;
    documentId: string;
    documentNumber: string;
    action: "created" | "replaced";
    signerName: string;
    signerRole: string | null;
    replacedReason: string | null;
  },
) {
  try {
    await supabase.from("ticket_events").insert({
      ticket_id: payload.ticketId,
      event_typ: payload.action === "replaced" ? "kunden_signatur_ersetzt" : "kunden_signatur_gesetzt",
      detail:
        payload.action === "replaced"
          ? `Kundensignatur für Rapport ${payload.documentNumber} ersetzt`
          : `Kundensignatur für Rapport ${payload.documentNumber} gesetzt`,
      actor: "customer",
      metadata: {
        document_id: payload.documentId,
        dokument_nummer: payload.documentNumber,
        signer_name: payload.signerName,
        signer_role: payload.signerRole,
        replace_reason: payload.replacedReason,
      },
    });
  } catch {
    // Audit-Eintrag ist optional und soll die Unterschrift nicht blockieren.
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();

  try {
    const { userId } = await requireCustomer(req);
    const supabase = serviceClient();
    const customer = await loadCustomerByUserId(supabase, userId);
    const customerId = pickNullableString(customer || {}, ["id"]);
    const objects = await loadObjectsByUserId(supabase, userId, customerId);
    const objectsById = new Map(objects.map((row) => [pickString(row, ["id"], ""), row]));
    const tickets = customerId
      ? await loadAccessibleTickets(supabase, userId, customerId, objectsById)
      : [];
    const ticketsById = new Map(tickets.map((row) => [pickString(row, ["id"], ""), row]));
    const ticketIds = tickets.map((row) => pickString(row, ["id"], "")).filter(Boolean);
    const [ticketDocuments, sourceReports] = await Promise.all([
      loadTicketDocuments(supabase, ticketIds),
      loadSourceReports(supabase, ticketIds),
    ]);
    const reports = toInternalReports(ticketDocuments, sourceReports);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const reportId = String(url.searchParams.get("id") || "").trim();

      if (!reportId) {
        const items = reports
          .filter((report) => isReleasedReport(report))
          .map((report) => {
            const ticket = ticketsById.get(report.ticketId);
            if (!ticket) return null;
            const objectRow = objectsById.get(pickString(ticket, ["object_id"], ""));
            return buildSummary(report, ticket, objectRow || null, customer);
          })
          .filter(Boolean);
        return json({ items });
      }

      const report = reports.find((item) => item.id === reportId);
      if (!report || !isReleasedReport(report)) return json({ error: "Rapport nicht gefunden oder nicht freigegeben." }, 404);
      const ticket = ticketsById.get(report.ticketId);
      if (!ticket) return json({ error: "Zugehöriges Ticket nicht verfügbar." }, 404);
      const objectRow = objectsById.get(pickString(ticket, ["object_id"], ""));
      return json(buildDetail(report, ticket, objectRow || null, customer));
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = (await req.json()) as DbRow;
    const reportId = cleanInline(body.id);
    const signerName = cleanInline(body.signer_name);
    const signerRole = cleanInline(body.signer_role) || null;
    const signatureDataUrl = String(body.signature_data_url || "").trim();
    const replaceConfirmed = Boolean(body.replace_confirmed);
    const replaceReason = cleanRichText(body.replace_reason) || null;

    if (!reportId) return json({ error: "Rapport-ID fehlt." }, 400);
    if (!signerName) return json({ error: "Bitte Name des Unterzeichnenden angeben." }, 400);
    if (!/^data:image\/(png|jpeg|jpg);base64,/i.test(signatureDataUrl)) {
      return json({ error: "Ungültiges Signaturformat." }, 400);
    }
    if (signatureDataUrl.length > 2_500_000) {
      return json({ error: "Signatur ist zu groß." }, 400);
    }

    const report = reports.find((item) => item.id === reportId);
    if (!report || !isReleasedReport(report)) {
      return json({ error: "Rapport ist nicht freigegeben oder nicht verfügbar." }, 404);
    }
    if (!isCustomerSignable(report)) {
      return json({ error: "Dieser Rapport ist aktuell nicht signierbar." }, 403);
    }

    const ticket = ticketsById.get(report.ticketId);
    if (!ticket) return json({ error: "Zugehöriges Ticket nicht verfügbar." }, 404);

    const existingSignature = cleanInline(report.data.signatur_kunde_image || "");
    const hadConfirmedSignature = Boolean(existingSignature);
    if (hadConfirmedSignature && !replaceConfirmed) {
      return json({ error: "Es liegt bereits eine bestätigte Signatur vor. Bitte Ersetzen ausdrücklich bestätigen." }, 409);
    }
    if (hadConfirmedSignature && !replaceReason) {
      return json({ error: "Bitte einen Grund für das Ersetzen der Signatur angeben." }, 400);
    }

    const persisted = await ensurePersistedReportDocument(supabase, report);
    const now = new Date().toISOString();
    const nextData: DbRow = {
      ...persisted.data,
      signatur_kunde_image: signatureDataUrl,
      signatur_kunde_name: signerName,
      signatur_kunde_funktion: signerRole,
      signatur_kunde_bestaetigt_at: now,
      signatur_kunde_status: "bestaetigt",
      signatur_kunde_ersetzt_am: hadConfirmedSignature ? now : persisted.data.signatur_kunde_ersetzt_am || null,
      signatur_kunde_ersetzt_grund: hadConfirmedSignature ? replaceReason : persisted.data.signatur_kunde_ersetzt_grund || null,
    };

    const { error } = await supabase
      .from("ticket_documents")
      .update({
        data: nextData,
        updated_at: now,
      })
      .eq("id", persisted.id);
    if (error) {
      throw new Error(error.message || "Signatur konnte nicht gespeichert werden.");
    }

    await logSignatureEvent(supabase, {
      ticketId: report.ticketId,
      documentId: persisted.id,
      documentNumber: report.documentNumber,
      action: hadConfirmedSignature ? "replaced" : "created",
      signerName,
      signerRole,
      replacedReason: replaceReason,
    });

    const objectRow = objectsById.get(pickString(ticket, ["object_id"], ""));
    return json({
      ok: true,
      saved_at: now,
      report: buildDetail(
        {
          ...report,
          id: persisted.id,
          persistedId: persisted.id,
          syntheticId: null,
          data: nextData,
          updatedAt: now,
          sourceTable: "ticket_documents",
          sourceId: persisted.id,
        },
        ticket,
        objectRow || null,
        customer,
      ),
    });
  } catch (err) {
    const message = String((err as Error)?.message || "Unbekannter Fehler");
    if (message === "Nicht autorisiert." || message === "Ungueltige Session.") {
      return json({ error: message }, 401);
    }
    return json({ error: message }, 500);
  }
});
