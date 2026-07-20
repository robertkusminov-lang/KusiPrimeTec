import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";

type TicketBucket = "inbox" | "active" | "archive" | "all";

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

function isAuthErrorMessage(message: string): boolean {
  const msg = String(message || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return msg.includes("nicht autorisiert") || msg.includes("ungueltige session") || msg.includes("ungultige session");
}

function isAdminAccessErrorMessage(message: string): boolean {
  const msg = String(message || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return msg.includes("kein admin-zugriff") || msg.includes("kein admin zugriff");
}

function normalizeBucket(value: string | null, archiveFlag: boolean): TicketBucket {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "all") return "all";
  if (raw === "inbox") return "inbox";
  if (raw === "archive" || raw === "archiv") return "archive";
  if (raw === "active" || raw === "aktiv") return "active";
  return archiveFlag ? "archive" : "active";
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

function normalizeCustomerType(value: unknown): "privat" | "firma" | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "privat" || raw === "private") return "privat";
  if (["firma", "gewerblich", "gewerbe", "unternehmen", "business", "company", "b2b"].includes(raw)) return "firma";
  return null;
}

function resolveInvoiceRecipientName(input: {
  customerType?: unknown;
  invoiceRecipientName?: unknown;
  kundeName?: unknown;
  companyName?: unknown;
}): string {
  const type = normalizeCustomerType(input.customerType);
  const explicit = sanitizeCustomerText(input.invoiceRecipientName);
  const person = sanitizeCustomerText(input.kundeName);
  const company = sanitizeCustomerText(input.companyName);
  if (type === "firma") return explicit || company || person;
  return explicit || person || company;
}

function resolveCustomerDisplayName(input: {
  customerType?: unknown;
  invoiceRecipientName?: unknown;
  kundeName?: unknown;
  companyName?: unknown;
}): string {
  const type = normalizeCustomerType(input.customerType);
  const invoice = resolveInvoiceRecipientName(input);
  const person = sanitizeCustomerText(input.kundeName);
  const company = sanitizeCustomerText(input.companyName);
  if (type === "firma") return invoice || company || person;
  return invoice || person || company;
}

function normalizeRequestType(value: unknown): "direct" | "offer" {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!raw) return "direct";
  if (raw.includes("angebot") || raw.includes("offer")) return "offer";
  return "direct";
}

function requestTypeToAnfrageart(value: "direct" | "offer"): "direkt_einsatz" | "angebot_anfordern" {
  return value === "offer" ? "angebot_anfordern" : "direkt_einsatz";
}

async function hydrateCustomerFields(
  supabase: ReturnType<typeof serviceClient>,
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const customerIds = [...new Set(rows.map((row) => String(row.customer_id || "").trim()).filter(Boolean))];
  if (!customerIds.length) return rows;

  let customerCols = [
    "id",
    "name",
    "company",
    "company_name",
    "invoice_recipient_name",
    "email",
    "phone",
    "contact_person",
    "customer_type",
  ];
  let customerResult = await supabase.from("customers").select(customerCols.join(",")).in("id", customerIds);
  for (let i = 0; i < 16 && customerResult.error; i += 1) {
    const missing = extractMissingColumn(customerResult.error.message || "", "customers");
    if (!missing) break;
    const next = customerCols.filter((col) => col !== missing);
    if (next.length === customerCols.length || next.length === 0) break;
    customerCols = next;
    customerResult = await supabase.from("customers").select(customerCols.join(",")).in("id", customerIds);
  }

  if (customerResult.error || !Array.isArray(customerResult.data)) {
    return rows.map((row) => {
      const requestType = normalizeRequestType(row.request_type || row.anfrageart || row.source);
      return {
        ...row,
        request_type: requestType,
        anfrageart: requestTypeToAnfrageart(requestType),
      };
    });
  }

  const customerMap = new Map<string, Record<string, unknown>>();
  for (const row of customerResult.data as Record<string, unknown>[]) {
    const id = String(row.id || "").trim();
    if (id) customerMap.set(id, row);
  }

  return rows.map((row) => {
    const customer = customerMap.get(String(row.customer_id || "").trim());
    const requestType = normalizeRequestType(row.request_type || row.anfrageart || row.source);
    if (!customer) {
      return {
        ...row,
        request_type: requestType,
        anfrageart: requestTypeToAnfrageart(requestType),
      };
    }

    const type = normalizeCustomerType(customer.customer_type);
    const company = sanitizeCustomerText(customer.company_name || customer.company || "");
    const contact = sanitizeCustomerText(customer.contact_person || "");
    const invoiceRecipientName = resolveInvoiceRecipientName({
      customerType: type,
      invoiceRecipientName: customer.invoice_recipient_name,
      kundeName: customer.name,
      companyName: company,
    });
    const customerName = sanitizeCustomerText(customer.name || contact || invoiceRecipientName || company);
    const email = String(customer.email || "").trim().toLowerCase();
    const phone = String(customer.phone || "").replace(/[^\d+]/g, "").trim();
    const ticketType = normalizeCustomerType(row.customer_type || row.kunde_typ || type);
    const ticketCompany = sanitizeCustomerText(row.kunde_firma || row.company_name || row.customer_company || row.firma || company);
    const ticketName = sanitizeCustomerText(row.kunde_name || row.customer_name || row.contact_name || row.contact_person || customerName);
    const resolvedInvoiceRecipientName = resolveInvoiceRecipientName({
      customerType: ticketType || type,
      invoiceRecipientName: row.invoice_recipient_name || invoiceRecipientName,
      kundeName: ticketName,
      companyName: ticketCompany,
    });
    const displayName = resolveCustomerDisplayName({
      customerType: ticketType || type,
      invoiceRecipientName: resolvedInvoiceRecipientName,
      kundeName: ticketName,
      companyName: ticketCompany,
    });

    return {
      ...row,
      request_type: requestType,
      anfrageart: requestTypeToAnfrageart(requestType),
      customer_type: ticketType || type || null,
      invoice_recipient_name: resolvedInvoiceRecipientName || null,
      customer_display_name: displayName || null,
      kunde_name: ticketName || customerName,
      kunde_firma: ticketCompany || company,
      kunde_email: String(row.kunde_email || row.customer_email || row.email || "").trim().toLowerCase() || email,
      kunde_telefon: String(row.kunde_telefon || row.customer_phone || row.telefon || row.phone || "").replace(/[^\d+]/g, "").trim() || phone,
      ansprechpartner: sanitizeCustomerText(row.ansprechpartner || row.contact_person || row.contact_name || "") || contact || null,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const status = String(url.searchParams.get("status") || "").trim();
    const requestTypeFilter = String(url.searchParams.get("request_type") || "").trim().toLowerCase();
    const urgency = String(url.searchParams.get("urgency") || "").trim().toLowerCase();
    const category = String(url.searchParams.get("category") || "").trim();
    const withoutSchedule = String(url.searchParams.get("without_schedule") || "0") === "1";
    const dueToday = String(url.searchParams.get("due_today") || "0") === "1";
    const archive = String(url.searchParams.get("archive") || "0") === "1";
    const includeCount = String(url.searchParams.get("include_count") || "1") !== "0";
    const hydrateCustomers = String(url.searchParams.get("hydrate_customers") || "1") !== "0";
    const sort = String(url.searchParams.get("sort") || "created_desc").trim();
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(250, Math.max(10, Number(url.searchParams.get("page_size") || 20)));
    const bucket = normalizeBucket(url.searchParams.get("bucket"), archive);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);

    const supabase = serviceClient();
    const baseColumns = [
      "id",
      "customer_id",
      "ticket_nummer",
      "ticket_number",
      "bucket",
      "status",
      "anfrageart",
      "request_type",
      "source",
      "kategorie",
      "category",
      "subkategorie",
      "dringlichkeit",
      "titel",
      "title",
      "beschreibung",
      "description",
      "customer_type",
      "invoice_recipient_name",
      "customer_display_name",
      "ansprechpartner",
      "contact_person",
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
      "objekt_plz",
      "objekt_ort",
      "city",
      "access_notes",
      "distanz_km",
      "distance_km",
      "outside_service_area",
      "radius_km",
      "datenschutz_akzeptiert",
      "agb_akzeptiert",
      "haftung_koordination_akzeptiert",
      "privacy_accepted",
      "terms_accepted",
      "liability_coordination_accepted",
      "plz",
      "ort",
      "terminwunsch",
      "zeitfenster_von",
      "zeitfenster_bis",
      "accepted_at",
      "rejected_at",
      "created_at",
      "updated_at",
    ];

    const runQuery = async (columns: string[], includeBucketColumn: boolean, includeRequestTypeColumn: boolean) => {
      const selectedColumns = columns.filter((col) => {
        if (!includeBucketColumn && col === "bucket") return false;
        if (!includeRequestTypeColumn && col === "request_type") return false;
        return true;
      });

      let query = supabase
        .from("tickets")
        .select(selectedColumns.join(","), includeCount ? { count: "exact" } : undefined)
        .order(sort === "due_asc" ? "terminwunsch" : "created_at", { ascending: sort === "created_asc" || sort === "due_asc" });

      if (q) {
        query = query.or([
          `ticket_nummer.ilike.%${q}%`,
          `ticket_number.ilike.%${q}%`,
          `title.ilike.%${q}%`,
          `kunde_name.ilike.%${q}%`,
          `kunde_firma.ilike.%${q}%`,
          `invoice_recipient_name.ilike.%${q}%`,
          `customer_display_name.ilike.%${q}%`,
          `kunde_email.ilike.%${q}%`,
          `kunde_telefon.ilike.%${q}%`,
          `company_name.ilike.%${q}%`,
          `contact_person.ilike.%${q}%`,
          `email.ilike.%${q}%`,
          `phone.ilike.%${q}%`,
          `ansprechpartner.ilike.%${q}%`,
          `subkategorie.ilike.%${q}%`,
          `source.ilike.%${q}%`,
          `objekt_adresse.ilike.%${q}%`,
          `object_address.ilike.%${q}%`,
          `objekt_strasse.ilike.%${q}%`,
          `objekt_ort.ilike.%${q}%`,
          `city.ilike.%${q}%`,
          `ort.ilike.%${q}%`,
          `plz.ilike.%${q}%`,
        ].join(","));
      }

      if (bucket === "archive") {
        query = query.in("status", ["Rapport_erstellt", "Storniert"]);
      } else if (bucket === "inbox") {
        query = query.eq("status", "Neu");
      } else if (bucket === "active") {
        query = query.not("status", "in", "(Rapport_erstellt,Storniert,Neu)");
      }

      if (status) {
        const statuses = status.split(",").map((x) => x.trim()).filter(Boolean);
        if (statuses.length > 1) {
          query = query.in("status", statuses);
        } else {
          query = query.eq("status", statuses[0] || status);
        }
      }

      if (requestTypeFilter) {
        const normalizedRequestTypeFilter = normalizeRequestType(requestTypeFilter);
        if (includeRequestTypeColumn) {
          query = query.eq("request_type", normalizedRequestTypeFilter);
        } else {
          query = query.eq("anfrageart", requestTypeToAnfrageart(normalizedRequestTypeFilter));
        }
      }

      if (urgency) {
        if (urgency === "hoch_notfall") {
          query = query.in("dringlichkeit", ["hoch", "kritisch", "notfall"]);
        } else {
          query = query.eq("dringlichkeit", urgency);
        }
      }

      if (category) {
        query = query.eq("kategorie", category);
      }

      if (withoutSchedule) {
        query = query.is("terminwunsch", null);
      }

      if (dueToday) {
        query = query.eq("terminwunsch", startOfToday);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      return await query.range(from, to);
    };

    let includeBucketColumn = true;
    let includeRequestTypeColumn = true;
    let workingColumns = [...baseColumns];
    let result = await runQuery(workingColumns, includeBucketColumn, includeRequestTypeColumn);
    for (let i = 0; i < 24 && result.error; i += 1) {
      const missing = extractMissingColumn(result.error.message || "", "tickets");
      if (!missing) break;
      if (missing === "bucket") includeBucketColumn = false;
      if (missing === "request_type") includeRequestTypeColumn = false;
      const nextColumns = workingColumns.filter((col) => col !== missing);
      if (nextColumns.length === workingColumns.length) break;
      workingColumns = nextColumns;
      result = await runQuery(workingColumns, includeBucketColumn, includeRequestTypeColumn);
    }

    if (result.error) return json({ error: result.error.message }, 500);

    const rawRows = (result.data || []) as Record<string, unknown>[];
    const rows = hydrateCustomers ? await hydrateCustomerFields(supabase, rawRows) : rawRows;
    const total = includeCount ? Number(result.count || 0) : (page - 1) * pageSize + rows.length;
    const pageCount = includeCount
      ? Math.max(1, Math.ceil(total / pageSize))
      : Math.max(1, page + (rows.length >= pageSize ? 1 : 0));
    return json({
      items: rows,
      total,
      page,
      page_count: pageCount,
    });
  } catch (err) {
    const message = String((err as Error)?.message || "Unbekannter Fehler");
    if (isAdminAccessErrorMessage(message)) return json({ error: message }, 403);
    if (isAuthErrorMessage(message)) return json({ error: message }, 401);
    return json({ error: message }, 500);
  }
});
