import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";
import { getValidGraphAccessToken } from "../_shared/graph.ts";
import { ensureTicketObjectAssignment } from "../_shared/object-assignment.ts";
import {
  STATUS,
  bucketForStatus,
  canTransitionStatus,
  normalizeBucket,
  normalizeStatus,
  type TicketBucket,
} from "../_shared/status.ts";
import { BUSINESS_RULES, isWithinOpeningWindow } from "../_shared/business-rules.ts";

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

function isStatusConstraintError(message: string): boolean {
  const msg = String(message || "").toLowerCase();
  return (
    (msg.includes("violates check constraint") && msg.includes("status")) ||
    msg.includes("check_status") ||
    msg.includes("tickets_status_check")
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

function isUniqueViolation(err: { code?: string; message?: string } | null | undefined): boolean {
  const msg = String(err?.message || "").toLowerCase();
  return String(err?.code || "") === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint");
}

function statusCandidates(input: string): string[] {
  const canonical = normalizeStatus(input);
  const byCanonical: Record<(typeof STATUS)[number], string[]> = {
    Neu: ["Neu", "neu", "NEW", "new"],
    Geprueft: ["Geprueft", "Gepruft", "Geprueft", "In_Bearbeitung", "In Bearbeitung"],
    Rueckfrage_Kunde: ["Rueckfrage_Kunde", "Rueckfrage Kunde", "Wartet_auf_Kunde", "Wartet auf Kunde"],
    Termin_geplant: ["Termin_geplant", "Termin geplant", "Geplant"],
    In_Arbeit: ["In_Arbeit", "In Arbeit", "In_Bearbeitung", "In Bearbeitung"],
    Rapport_erstellt: ["Rapport_erstellt", "Rapport erstellt"],
    Storniert: ["Storniert", "Abgebrochen", "Cancelled", "cancelled"],
  };
  return [...new Set([String(input || "").trim(), ...byCanonical[canonical]].filter(Boolean))];
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asNullableText(value: unknown): string | null {
  const s = asText(value);
  return s ? s : null;
}

function normalizeDate(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) return m[1];
  return null;
}

function normalizeHm(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function isWeekdayDate(value: unknown): boolean {
  const raw = String(value || "").trim();
  if (!raw) return true;
  const dt = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return false;
  const day = dt.getDay();
  return day >= 1 && day <= 5;
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

function toIsoLocal(date: string, hm: string): string {
  return `${date}T${hm}:00`;
}

function isQuarterHour(value: string | null): boolean {
  if (!value) return true;
  const m = value.match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  return Number(m[2]) % 30 === 0;
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
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

function isAuthErrorMessage(message: unknown): boolean {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("nicht autorisiert") ||
    text.includes("ungueltige session") ||
    text.includes("ungültige session") ||
    text.includes("invalid jwt") ||
    text.includes("jwt expired") ||
    text.includes("auth session missing")
  );
}

function isAdminAccessErrorMessage(message: unknown): boolean {
  const text = String(message || "").toLowerCase();
  return text.includes("kein admin-zugriff");
}

function normalizeRequestType(value: unknown): "direct" | "offer" | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!raw) return null;
  if (raw === "offer" || raw === "angebot_anfordern" || raw === "angebot") return "offer";
  if (raw === "direct" || raw === "direkt_einsatz" || raw === "direkt" || raw === "direct_einsatz") return "direct";
  if (raw.includes("angebot") || raw.includes("offer")) return "offer";
  if (raw.includes("direkt") || raw.includes("einsatz") || raw.includes("direct")) return "direct";
  return "direct";
}

function requestTypeToAnfrageart(value: "direct" | "offer"): "direkt_einsatz" | "angebot_anfordern" {
  return value === "offer" ? "angebot_anfordern" : "direkt_einsatz";
}

async function findOrCreateCustomerAdaptive(
  supabase: ReturnType<typeof serviceClient>,
  input: Record<string, unknown>
): Promise<string | null> {
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

  if (!email && !phone) return null;
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
  if (existingByEmail) return existingByEmail;
  const existingByPhone = await findByPhone();
  if (existingByPhone) return existingByPhone;

  const customerTypeCandidates = customerTypeWriteCandidates(customerType);
  let customerTypeIndex = 0;

  let body: Record<string, unknown> = {
    name: name || "Unbekannt",
    company,
    email,
    phone,
    contact_person: contactPerson,
    source: "admin_ticket_update",
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
      if (id) return id;
      return await findByEmail() || (await findByPhone());
    }
    if (!error) return await findByEmail() || (await findByPhone());

    if (isMissingTable(error.message || "", "customers")) return null;

    if (isUniqueViolation(error)) {
      const existing = (await findByEmail()) || (await findByPhone());
      if (existing) return existing;
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
      return null;
    }
    throw new Error(error.message);
  }

  return await findByEmail() || (await findByPhone());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await requireAdmin(req);
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) return json({ error: "Ticket-ID fehlt." }, 400);

    const supabase = serviceClient();
    const { data: currentRows, error: currentErr } = await supabase.from("tickets").select("*").eq("id", id).limit(2);
    const current = Array.isArray(currentRows) ? currentRows[0] : null;
    if (currentErr || !current) return json({ error: currentErr?.message || "Ticket nicht gefunden." }, 404);

    const action = String(body.action || "").trim().toLowerCase();
    const update: Record<string, unknown> = {};
    const currentStatus = normalizeStatus(current.status);
    const currentBucket = normalizeBucket(current.bucket) || bucketForStatus(currentStatus);

    if (action === "accept") {
      if (currentBucket !== "inbox" && currentStatus !== "Neu") {
        return json({ error: "Nur Inbox-Tickets koennen angenommen werden." }, 409);
      }
      update.bucket = "active";
      update.accepted_at = new Date().toISOString();
      update.rejected_at = null;
      update.rejected_reason = null;
      if (currentStatus === "Neu") update.status = "Geprueft";
    }

    if (action === "reject") {
      if (currentBucket !== "inbox" && currentStatus !== "Neu") {
        return json({ error: "Nur Inbox-Tickets koennen abgelehnt werden." }, 409);
      }
      const reason = String(body.rejected_reason || body.cancel_reason || "").trim();
      update.bucket = "archive";
      update.status = "Storniert";
      update.rejected_at = new Date().toISOString();
      update.accepted_at = null;
      update.rejected_reason = reason || null;
    }

    if (body.bucket !== undefined) {
      const bucket = normalizeBucket(body.bucket);
      if (!bucket) return json({ error: "Ungueltiger Bucket." }, 400);
      update.bucket = bucket;
    }

    if (body.status !== undefined) {
      const canonical = normalizeStatus(body.status);
      if (!STATUS.includes(canonical)) return json({ error: "Ungueltiger Status." }, 400);
      update.status = canonical;
      if (canonical === "Geprueft") update.bestaetigt_at = new Date().toISOString();
      if (canonical === "Termin_geplant") update.termin_geplant_at = new Date().toISOString();
      update.bucket = bucketForStatus(canonical);
    }

    const nextStatusForValidation = normalizeStatus(update.status ?? currentStatus);
    const nextBucketForValidation = (normalizeBucket(update.bucket) || currentBucket) as TicketBucket;

    if (update.status !== undefined && action !== "reject" && !canTransitionStatus(currentStatus, nextStatusForValidation)) {
      return json({ error: `Statuswechsel nicht erlaubt: ${currentStatus} -> ${nextStatusForValidation}.` }, 409);
    }

    if (nextStatusForValidation === "Neu" && nextBucketForValidation !== "inbox") {
      return json({ error: "Status Neu darf nur im Bucket inbox liegen." }, 409);
    }
    if ((nextStatusForValidation === "Rapport_erstellt" || nextStatusForValidation === "Storniert") && nextBucketForValidation !== "archive") {
      return json({ error: "Status Rapport_erstellt/Storniert muss im Bucket archive liegen." }, 409);
    }
    if (nextStatusForValidation !== "Neu" && nextBucketForValidation === "inbox") {
      return json({ error: "Nur Status Neu ist im Bucket inbox erlaubt." }, 409);
    }

    if (body.terminwunsch !== undefined) {
      if (body.terminwunsch && !isWeekdayDate(body.terminwunsch)) {
        return json({ error: "Wunschdatum ist nur Montag bis Freitag verfuegbar." }, 400);
      }
      const termin = body.terminwunsch || null;
      update.terminwunsch = termin;
      update.desired_date = termin;
      update.requested_date = termin;
      update.scheduled_date = termin;
      update.scheduled_at = termin;
    }
    if (body.beschreibung !== undefined) update.beschreibung = String(body.beschreibung || "");
    if (body.internal_note !== undefined) update.internal_note = String(body.internal_note || "");
    if (body.rejected_reason !== undefined && action !== "reject") {
      update.rejected_reason = String(body.rejected_reason || "").trim() || null;
    }

    if (body.titel !== undefined) {
      update.titel = asText(body.titel);
      update.title = asText(body.titel);
    }
    if (body.kategorie !== undefined) {
      update.kategorie = asText(body.kategorie);
      update.category = asText(body.kategorie);
    }
    if (body.subkategorie !== undefined) update.subkategorie = asNullableText(body.subkategorie);
    if (body.dringlichkeit !== undefined) {
      update.dringlichkeit = asText(body.dringlichkeit);
      update.priority = asText(body.dringlichkeit);
    }
    if (body.anfrageart !== undefined || body.request_type !== undefined) {
      const requestType = normalizeRequestType(body.request_type ?? body.anfrageart);
      if (!requestType) return json({ error: "Ungueltiger request_type (direct/offer)." }, 400);
      const anfrageart = requestTypeToAnfrageart(requestType);
      update.request_type = requestType;
      update.anfrageart = anfrageart;
      update.source = anfrageart;
    }
    if (body.customer_type !== undefined) update.customer_type = normalizeCustomerType(body.customer_type);
    if (body.ansprechpartner !== undefined) {
      const contact = sanitizeCustomerText(body.ansprechpartner) || null;
      update.ansprechpartner = contact;
      update.contact_person = contact;
    }
    if (body.kunde_name !== undefined) update.kunde_name = sanitizeCustomerText(body.kunde_name);
    if (body.kunde_firma !== undefined) {
      const company = sanitizeCustomerText(body.kunde_firma);
      update.kunde_firma = company;
      update.company_name = company;
    }
    if (body.kunde_email !== undefined) {
      const email = normalizeEmail(body.kunde_email) || "";
      update.kunde_email = email;
      update.email = email;
    }
    if (body.kunde_telefon !== undefined) {
      const phone = normalizePhone(body.kunde_telefon) || "";
      update.kunde_telefon = phone;
      update.phone = phone;
    }
    if (body.objekt_strasse !== undefined) update.objekt_strasse = asNullableText(body.objekt_strasse);
    if (body.objekt_plz !== undefined) update.objekt_plz = asNullableText(body.objekt_plz);
    if (body.objekt_ort !== undefined) {
      update.objekt_ort = asNullableText(body.objekt_ort);
      update.city = asNullableText(body.objekt_ort);
    }
    if (body.objekt_adresse !== undefined) {
      update.objekt_adresse = asText(body.objekt_adresse);
      update.object_address = asText(body.objekt_adresse);
    }
    if (body.access_notes !== undefined) update.access_notes = asNullableText(body.access_notes);
    if (body.zeitfenster_von !== undefined) {
      const raw = asText(body.zeitfenster_von);
      const v = raw ? normalizeHm(raw) : null;
      if (raw && !v) return json({ error: "Ungueltiges Zeitformat fuer Zeit von (HH:MM)." }, 400);
      if (!isQuarterHour(v)) return json({ error: "Zeit von ist nur in 30-Minuten-Schritten erlaubt." }, 400);
      update.zeitfenster_von = v;
      update.time_from = v;
      update.window_from = v;
    }
    if (body.zeitfenster_bis !== undefined) {
      const raw = asText(body.zeitfenster_bis);
      const v = raw ? normalizeHm(raw) : null;
      if (raw && !v) return json({ error: "Ungueltiges Zeitformat fuer Zeit bis (HH:MM)." }, 400);
      if (!isQuarterHour(v)) return json({ error: "Zeit bis ist nur in 30-Minuten-Schritten erlaubt." }, 400);
      update.zeitfenster_bis = v;
      update.time_to = v;
      update.window_to = v;
    }
    if (body.zeitfenster_von !== undefined || body.zeitfenster_bis !== undefined) {
      const from = normalizeHm(body.zeitfenster_von ?? current.zeitfenster_von ?? current.time_from ?? current.window_from);
      const to = normalizeHm(body.zeitfenster_bis ?? current.zeitfenster_bis ?? current.time_to ?? current.window_to);
      if ((from && !to) || (!from && to)) return json({ error: "Bitte beide Uhrzeiten setzen (von und bis)." }, 400);
      if (from && to && from >= to) return json({ error: "Bitte ein gueltiges Zeitfenster waehlen (von < bis)." }, 400);
      if (from && to && !isWithinOpeningWindow(from, to)) {
        return json(
          { error: `Zeitfenster muss innerhalb ${BUSINESS_RULES.opening_hours.start}-${BUSINESS_RULES.opening_hours.end} Uhr liegen.` },
          400
        );
      }
      update.desired_time_window = from && to ? `${from}-${to}` : null;
      update.zeitfenster = from && to ? `${from} - ${to}` : null;
      update.window = from && to ? `${from}-${to}` : null;
      update.requested_time = from || null;
      update.preferred_time_window = from && to ? `${from} - ${to}` : null;
    }

    const hasStreet = body.objekt_strasse !== undefined;
    const hasZip = body.objekt_plz !== undefined;
    const hasCity = body.objekt_ort !== undefined;
    const hasAddress = body.objekt_adresse !== undefined;
    if (!hasAddress && (hasStreet || hasZip || hasCity)) {
      const street = asText(hasStreet ? body.objekt_strasse : current.objekt_strasse);
      const zip = asText(hasZip ? body.objekt_plz : current.objekt_plz);
      const city = asText(hasCity ? body.objekt_ort : current.objekt_ort);
      const line2 = [zip, city].filter(Boolean).join(" ");
      const composed = [street, line2].filter(Boolean).join(", ");
      if (composed) {
        update.objekt_adresse = composed;
        update.object_address = composed;
      }
    }

    const customerFieldsTouched =
      body.kunde_name !== undefined ||
      body.kunde_firma !== undefined ||
      body.kunde_email !== undefined ||
      body.kunde_telefon !== undefined ||
      body.customer_type !== undefined ||
      body.ansprechpartner !== undefined ||
      body.invoice_recipient_name !== undefined;

    if (customerFieldsTouched) {
      const nextType = normalizeCustomerType(update.customer_type ?? current.customer_type);
      const requiredEmail = normalizeEmail(update.kunde_email ?? current.kunde_email) || "";
      const requiredPhone = normalizePhone(update.kunde_telefon ?? current.kunde_telefon) || "";
      const nextCompany = sanitizeCustomerText(update.kunde_firma ?? current.kunde_firma);
      const nextName = sanitizeCustomerText(update.kunde_name ?? current.kunde_name);
      const nextContact = sanitizeCustomerText(update.ansprechpartner ?? current.ansprechpartner);
      const invoiceRecipientName = resolveInvoiceRecipientName({
        customerType: nextType,
        kundeName: nextName,
        companyName: nextCompany,
        invoiceRecipientName: update.invoice_recipient_name ?? current.invoice_recipient_name,
      });
      const customerDisplayName = resolveCustomerDisplayName({
        customerType: nextType,
        kundeName: nextName,
        companyName: nextCompany,
        invoiceRecipientName,
      });

      if (!requiredEmail && !requiredPhone) {
        return json({ error: "Mindestens E-Mail oder Telefon ist erforderlich." }, 400);
      }
      if (nextType === "firma" && !nextCompany) {
        return json({ error: "Bei Kundentyp Firma ist die Firma erforderlich." }, 400);
      }
      if (!invoiceRecipientName) {
        return json({ error: "Name ist erforderlich." }, 400);
      }

      update.customer_type = nextType;
      update.kunde_name = invoiceRecipientName || nextName;
      update.kunde_firma = nextCompany;
      update.ansprechpartner = nextContact || null;
      update.contact_person = nextContact || null;
      update.kunde_email = requiredEmail;
      update.kunde_telefon = requiredPhone;
      update.invoice_recipient_name = invoiceRecipientName;
      update.customer_display_name = customerDisplayName || null;

      const customerId = await findOrCreateCustomerAdaptive(supabase, {
        kunde_name: nextName,
        kunde_firma: nextCompany,
        invoice_recipient_name: invoiceRecipientName,
        kunde_email: requiredEmail,
        kunde_telefon: requiredPhone,
        customer_type: nextType,
        ansprechpartner: nextContact,
      });
      if (customerId) update.customer_id = customerId;
    }

    const shouldAssignObjectOnAcceptance =
      currentBucket === "inbox" &&
      nextBucketForValidation === "active";

    if (shouldAssignObjectOnAcceptance) {
      try {
        const objectPatch = await ensureTicketObjectAssignment(supabase, {
          objectId: current.object_id,
          customerId: update.customer_id ?? current.customer_id,
          customerDisplayName:
            update.customer_display_name ??
            current.customer_display_name ??
            update.invoice_recipient_name ??
            current.invoice_recipient_name ??
            update.kunde_firma ??
            current.kunde_firma ??
            update.kunde_name ??
            current.kunde_name,
          objectAddress: update.objekt_adresse ?? current.objekt_adresse ?? current.object_address,
          objectStreet: update.objekt_strasse ?? current.objekt_strasse,
          objectZip: update.objekt_plz ?? current.objekt_plz ?? current.plz,
          objectCity: update.objekt_ort ?? current.objekt_ort ?? current.city ?? current.ort,
        });
        Object.assign(update, objectPatch);
      } catch (err) {
        return json({ error: String((err as Error).message || "Objektzuordnung fehlgeschlagen.") }, 409);
      }
    }

    if (Object.keys(update).length === 0) return json({ error: "Keine Aenderungen uebergeben." }, 400);

    let updateBody: Record<string, unknown> = { ...update };
    const originalKeys = Object.keys(updateBody);
    const statusTry = updateBody.status !== undefined ? statusCandidates(String(updateBody.status)) : [];
    const customerTypeTry = updateBody.customer_type !== undefined
      ? customerTypeWriteCandidates(normalizeCustomerType(updateBody.customer_type))
      : [];
    let statusIdx = 0;
    let customerTypeIdx = 0;
    let updated = false;
    let appliedStatus: string | null = updateBody.status !== undefined ? String(updateBody.status) : null;
    let droppedIncompatibleStatus = false;

    for (let i = 0; i < 40; i += 1) {
      if (Object.keys(updateBody).length === 0) break;
      if (updateBody.status !== undefined && statusTry.length > 0) {
        updateBody.status = statusTry[statusIdx];
      }
      if (updateBody.customer_type !== undefined && customerTypeTry.length > 0) {
        updateBody.customer_type = customerTypeTry[customerTypeIdx];
      }

      const { error: updateErr } = await supabase.from("tickets").update(updateBody).eq("id", id);
      if (!updateErr) {
        updated = true;
        appliedStatus = updateBody.status !== undefined ? normalizeStatus(updateBody.status) : null;
        break;
      }

      if (updateBody.status !== undefined && isStatusConstraintError(updateErr.message)) {
        if (statusIdx < statusTry.length - 1) {
          statusIdx += 1;
          continue;
        }

        delete updateBody.status;
        droppedIncompatibleStatus = true;
        if (Object.keys(updateBody).length === 0) {
          return json(
            {
              error:
                "Status kann mit aktueller DB-Constraint nicht gespeichert werden. Bitte Status-Constraint Migration ausfuehren.",
            },
            409
          );
        }
        continue;
      }
      if (updateBody.customer_type !== undefined && isCustomerTypeConstraintError(updateErr.message)) {
        if (customerTypeIdx < customerTypeTry.length - 1) {
          customerTypeIdx += 1;
          continue;
        }
      }
      if (isTimeRangeTypeError(updateErr.message)) {
        if (stripUnsafeRangeWindowFields(updateBody)) continue;
      }

      const missing = extractMissingColumn(updateErr.message, "tickets");
      if (!missing) return json({ error: updateErr.message }, 500);
      delete updateBody[missing];
    }

    if (!updated) return json({ error: "Keine kompatiblen Felder zum Speichern gefunden." }, 500);

    const eventRows: Array<Record<string, unknown>> = [];
    const actor = admin.email;

    const newBucket = String(updateBody.bucket ?? current.bucket ?? "");
    const oldBucket = String(current.bucket || currentBucket);
    const newStatus = normalizeStatus(appliedStatus ?? current.status ?? "Neu");
    const oldStatus = normalizeStatus(current.status || "Neu");
    const nextDate = normalizeDate(updateBody.terminwunsch ?? current.terminwunsch);
    const nextFrom = normalizeHm(updateBody.zeitfenster_von ?? updateBody.time_from ?? updateBody.window_from ?? current.zeitfenster_von ?? current.time_from ?? current.window_from);
    const nextTo = normalizeHm(updateBody.zeitfenster_bis ?? updateBody.time_to ?? updateBody.window_to ?? current.zeitfenster_bis ?? current.time_to ?? current.window_to);
    const prevDate = normalizeDate(current.terminwunsch);
    const prevFrom = normalizeHm(current.zeitfenster_von ?? current.time_from ?? current.window_from);
    const prevTo = normalizeHm(current.zeitfenster_bis ?? current.time_to ?? current.window_to);
    const scheduleTouched =
      updateBody.terminwunsch !== undefined || updateBody.zeitfenster_von !== undefined || updateBody.zeitfenster_bis !== undefined;
    const scheduleChanged = nextDate !== prevDate || nextFrom !== prevFrom || nextTo !== prevTo;
    let calendarWarning: string | null = null;
    let calendarEventId: string | null = null;

    if (scheduleTouched && scheduleChanged && nextDate && nextFrom && nextTo) {
      try {
        const accessToken = await getValidGraphAccessToken(admin.email);
        const ticketNummer = String(current.ticket_nummer || id).trim();
        const ticketTitel = String(updateBody.titel ?? current.titel ?? "Einsatztermin").trim();
        const kundeName = String(updateBody.kunde_name ?? current.kunde_name ?? "").trim();
        const kundeEmail = String(updateBody.kunde_email ?? current.kunde_email ?? "").trim();
        const objektAdresse = String(
          updateBody.objekt_adresse ?? current.objekt_adresse ?? [current.objekt_strasse, current.objekt_plz, current.objekt_ort].filter(Boolean).join(" ")
        ).trim();

        const eventPayload: Record<string, unknown> = {
          subject: `Ticket ${ticketNummer}: ${ticketTitel || "Einsatztermin"}`,
          start: { dateTime: toIsoLocal(nextDate, nextFrom), timeZone: "Europe/Berlin" },
          end: { dateTime: toIsoLocal(nextDate, nextTo), timeZone: "Europe/Berlin" },
          body: {
            contentType: "Text",
            content: [
              `Ticket: ${ticketNummer}`,
              `Kunde: ${kundeName || "-"}`,
              `Ort: ${objektAdresse || "-"}`,
              `Zeit: ${nextDate} ${nextFrom}-${nextTo}`,
            ].join("\n"),
          },
        };

        if (objektAdresse) {
          eventPayload.location = { displayName: objektAdresse };
        }
        if (kundeEmail) {
          eventPayload.attendees = [
            {
              emailAddress: { address: kundeEmail, name: kundeName || kundeEmail },
              type: "required",
            },
          ];
        }

        let existingEventId: string | null = null;
        try {
          const { data: latestTimeline } = await supabase
            .from("timeline_events")
            .select("metadata")
            .eq("ticket_id", id)
            .eq("event_type", "calendar_synced")
            .order("created_at", { ascending: false })
            .limit(2);
          const latestTimelineEvent = Array.isArray(latestTimeline) ? latestTimeline[0] : null;
          const latestTimelineMeta = (latestTimelineEvent as Record<string, unknown> | null)?.metadata;
          const latestTimelineMetaObj =
            latestTimelineMeta && typeof latestTimelineMeta === "object"
              ? (latestTimelineMeta as Record<string, unknown>)
              : null;
          const timelineCandidate = String(latestTimelineMetaObj?.event_id || "").trim();
          if (timelineCandidate) existingEventId = timelineCandidate;

          if (!existingEventId) {
            const { data: latestEvents } = await supabase
              .from("ticket_events")
              .select("metadata")
              .eq("ticket_id", id)
              .eq("event_typ", "calendar_synced")
              .order("created_at", { ascending: false })
              .limit(2);
            const latestEvent = Array.isArray(latestEvents) ? latestEvents[0] : null;
            const latestMeta = (latestEvent as Record<string, unknown> | null)?.metadata;
            const latestMetaObj = latestMeta && typeof latestMeta === "object" ? (latestMeta as Record<string, unknown>) : null;
            const candidate = String(latestMetaObj?.event_id || "").trim();
            if (candidate) existingEventId = candidate;
          }
        } catch {
          existingEventId = null;
        }

        const graphUrl = existingEventId
          ? `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(existingEventId)}`
          : "https://graph.microsoft.com/v1.0/me/events";
        let graphRes = await fetch(graphUrl, {
          method: existingEventId ? "PATCH" : "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(eventPayload),
        });
        let graphBody = await graphRes.json().catch(() => ({}));

        if (!graphRes.ok && existingEventId && graphRes.status === 404) {
          graphRes = await fetch("https://graph.microsoft.com/v1.0/me/events", {
            method: "POST",
            headers: {
              authorization: `Bearer ${accessToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify(eventPayload),
          });
          graphBody = await graphRes.json().catch(() => ({}));
        }

        if (!graphRes.ok) {
          throw new Error(String(graphBody?.error?.message || "Outlook Kalendersync fehlgeschlagen."));
        }
        calendarEventId = String(graphBody?.id || existingEventId || "").trim() || null;
      } catch (err) {
        calendarWarning = `Outlook Kalendersync fehlgeschlagen: ${String((err as Error).message || "Unbekannter Fehler")}`;
      }
    }

    if (action === "accept") {
      eventRows.push({
        ticket_id: id,
        event_typ: "accepted",
        detail: "Ticket aus Inbox angenommen",
        actor,
        metadata: { old_bucket: oldBucket, new_bucket: newBucket, old_status: oldStatus, new_status: newStatus },
      });
    }

    if (action === "reject") {
      eventRows.push({
        ticket_id: id,
        event_typ: "rejected",
        detail: updateBody.rejected_reason ? `Ticket abgelehnt: ${String(updateBody.rejected_reason)}` : "Ticket abgelehnt",
        actor,
        metadata: { old_bucket: oldBucket, new_bucket: newBucket, old_status: oldStatus, new_status: newStatus },
      });
    }

    if (newStatus !== oldStatus) {
      eventRows.push({
        ticket_id: id,
        event_typ: "status_changed",
        detail: `Status: ${oldStatus || "-"} -> ${newStatus || "-"}`,
        actor,
        metadata: { old_value: oldStatus, new_value: newStatus },
      });
    }

    if (newBucket && newBucket !== oldBucket) {
      eventRows.push({
        ticket_id: id,
        event_typ: "bucket_changed",
        detail: `Bucket: ${oldBucket || "-"} -> ${newBucket}`,
        actor,
        metadata: { old_value: oldBucket, new_value: newBucket },
      });
    }

    if (updateBody.terminwunsch !== undefined && String(current.terminwunsch || "") !== String(updateBody.terminwunsch || "")) {
      eventRows.push({
        ticket_id: id,
        event_typ: "scheduled_set",
        detail: `Termin: ${String(current.terminwunsch || "-")} -> ${String(updateBody.terminwunsch || "-")}`,
        actor,
        metadata: { old_value: current.terminwunsch, new_value: updateBody.terminwunsch },
      });
    }

    if (calendarEventId) {
      eventRows.push({
        ticket_id: id,
        event_typ: "calendar_synced",
        detail: `Outlook Termin erstellt: ${nextDate} ${nextFrom}-${nextTo}`,
        actor,
        metadata: { event_id: calendarEventId, date: nextDate, from: nextFrom, to: nextTo },
      });
    } else if (calendarWarning) {
      eventRows.push({
        ticket_id: id,
        event_typ: "calendar_sync_failed",
        detail: calendarWarning,
        actor,
      });
    }

    if (updateBody.internal_note !== undefined && String(current.internal_note || "") !== String(updateBody.internal_note || "")) {
      eventRows.push({
        ticket_id: id,
        event_typ: "internal_note_updated",
        detail: "Interne Notiz aktualisiert",
        actor,
      });
    }

    const dataKeys = [
      "titel",
      "kategorie",
      "subkategorie",
      "dringlichkeit",
      "anfrageart",
      "request_type",
      "customer_type",
      "ansprechpartner",
      "kunde_name",
      "kunde_firma",
      "invoice_recipient_name",
      "customer_display_name",
      "kunde_email",
      "kunde_telefon",
      "customer_id",
      "objekt_adresse",
      "objekt_strasse",
      "objekt_plz",
      "objekt_ort",
      "access_notes",
      "zeitfenster_von",
      "zeitfenster_bis",
      "beschreibung",
    ];
    const dataChanged = dataKeys.some((key) => updateBody[key] !== undefined && String(current[key] ?? "") !== String(updateBody[key] ?? ""));
    if (dataChanged) {
      eventRows.push({
        ticket_id: id,
        event_typ: "ticket_data_updated",
        detail: "Ticketdaten bearbeitet",
        actor,
      });
    }

    if (newStatus !== oldStatus) {
      const statusHistoryRows = [
        {
          ticket_id: id,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by: actor,
          metadata: { old_bucket: oldBucket, new_bucket: newBucket },
        },
      ];
      const { error: historyErr } = await supabase.from("status_history").insert(statusHistoryRows);
      if (historyErr && !isMissingTable(historyErr.message, "status_history")) {
        return json({ error: historyErr.message }, 500);
      }
    }

    if (eventRows.length > 0) {
      const timelineRows = eventRows.map((row) => ({
        ticket_id: row.ticket_id,
        event_type: row.event_typ,
        detail: row.detail,
        actor: row.actor,
        metadata: row.metadata ?? {},
      }));

      const { error: timelineErr } = await supabase.from("timeline_events").insert(timelineRows);
      if (timelineErr) {
        if (!isMissingTable(timelineErr.message, "timeline_events")) {
          return json({ error: timelineErr.message }, 500);
        }
        const { error: eventErr } = await supabase.from("ticket_events").insert(eventRows);
        if (eventErr && !isMissingTable(eventErr.message, "ticket_events")) return json({ error: eventErr.message }, 500);
      }
    }

    const warnings: string[] = [];
    if (droppedIncompatibleStatus) warnings.push("Status wurde wegen inkompatibler DB-Constraint nicht uebernommen.");
    if (calendarWarning) warnings.push(calendarWarning);

    return json({
      ok: true,
      warning: warnings.length > 0 ? warnings.join(" | ") : undefined,
      applied_status: appliedStatus,
      attempted_keys: originalKeys,
      customer_id: updateBody.customer_id || current.customer_id || null,
    });
  } catch (err) {
    const message = (err as Error).message || "Unbekannter Fehler";
    if (isAuthErrorMessage(message)) return json({ error: message }, 401);
    if (isAdminAccessErrorMessage(message)) return json({ error: message }, 403);
    return json({ error: message }, 500);
  }
});
