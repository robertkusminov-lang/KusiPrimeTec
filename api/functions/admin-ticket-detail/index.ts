import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";

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

function normalizeDocumentStatus(value: unknown): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "entwurf";
  if (raw === "draft" || raw === "entwurf") return "entwurf";
  if (raw === "sent" || raw === "gesendet") return "gesendet";
  if (raw === "accepted" || raw === "akzeptiert") return "akzeptiert";
  if (raw === "rejected" || raw === "abgelehnt") return "abgelehnt";
  return "entwurf";
}

async function loadSourceDocuments(
  supabase: ReturnType<typeof serviceClient>,
  ticketId: string
): Promise<Record<string, unknown>[]> {
  const sources: Array<{
    table: "reports";
    typ: "rapport";
    docType: "report";
  }> = [
    { table: "reports", typ: "rapport", docType: "report" },
  ];

  const out: Record<string, unknown>[] = [];
  for (const source of sources) {
    let cols = ["id", "ticket_id", "document_number", "status", "data", "created_at", "updated_at"];
    let orderByCreated = true;
    for (let i = 0; i < 24 && cols.length; i += 1) {
      let query = supabase.from(source.table).select(cols.join(",")).eq("ticket_id", ticketId);
      if (orderByCreated && cols.includes("created_at")) {
        query = query.order("created_at", { ascending: false });
      }
      const { data, error } = await query;
      if (!error) {
        const rows = (data || []) as Record<string, unknown>[];
        for (const row of rows) {
          const documentNumber = String(row.document_number || "").trim();
          if (!documentNumber) continue;
          out.push({
            id: `src-${source.table}-${String(row.id || "").trim() || crypto.randomUUID()}`,
            ticket_id: row.ticket_id || ticketId,
            dokument_typ: source.typ,
            doc_type: source.docType,
            document_type: source.docType,
            type: source.typ,
            typ: source.typ,
            dokument_nummer: documentNumber,
            status: normalizeDocumentStatus(row.status),
            data: row.data && typeof row.data === "object" ? row.data : {},
            created_at: row.created_at || new Date(0).toISOString(),
            updated_at: row.updated_at || row.created_at || new Date(0).toISOString(),
            source_table: source.table,
            source_id: row.id || null,
          });
        }
        break;
      }
      if (isMissingTable(error.message, source.table)) break;
      const missing = extractMissingColumn(error.message, source.table);
      if (!missing) throw new Error(error.message);
      cols = cols.filter((col) => col !== missing);
      if (missing === "created_at") orderByCreated = false;
    }
  }
  return out;
}

async function loadCustomerAdaptive(
  supabase: ReturnType<typeof serviceClient>,
  customerId: string
): Promise<Record<string, unknown> | null> {
  let cols = [
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
  for (let i = 0; i < 16 && cols.length; i += 1) {
    const { data, error } = await supabase.from("customers").select(cols.join(",")).eq("id", customerId).limit(2);
    if (!error) return Array.isArray(data) ? ((data[0] as Record<string, unknown>) || null) : null;
    if (isMissingTable(error.message || "", "customers")) return null;
    const missing = extractMissingColumn(error.message || "", "customers");
    if (!missing) throw new Error(error.message);
    cols = cols.filter((col) => col !== missing);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) return json({ error: "id fehlt" }, 400);

    const supabase = serviceClient();
    const { data: ticketRows, error: tErr } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", id)
      .limit(2);
    const rawTicket = Array.isArray(ticketRows) ? ((ticketRows[0] as Record<string, unknown>) || null) : null;
    if (tErr || !rawTicket) return json({ error: tErr?.message || "Ticket nicht gefunden" }, 404);

    let ticket: Record<string, unknown> = { ...rawTicket };
    const customerId = String(rawTicket.customer_id || "").trim();
    if (customerId) {
      const customer = await loadCustomerAdaptive(supabase, customerId);
      if (customer) {
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

        const ticketType = normalizeCustomerType(ticket.customer_type || ticket.kunde_typ || type);
        const ticketCompany = sanitizeCustomerText(ticket.kunde_firma || ticket.company_name || ticket.customer_company || ticket.firma || company);
        const ticketName = sanitizeCustomerText(ticket.kunde_name || ticket.customer_name || ticket.contact_name || ticket.contact_person || customerName);
        const resolvedInvoiceRecipientName = resolveInvoiceRecipientName({
          customerType: ticketType || type,
          invoiceRecipientName: ticket.invoice_recipient_name || invoiceRecipientName,
          kundeName: ticketName,
          companyName: ticketCompany,
        });
        const displayName = resolveCustomerDisplayName({
          customerType: ticketType || type,
          invoiceRecipientName: resolvedInvoiceRecipientName,
          kundeName: ticketName,
          companyName: ticketCompany,
        });

        ticket = {
          ...ticket,
          customer_type: ticketType || type || null,
          invoice_recipient_name: resolvedInvoiceRecipientName || null,
          customer_display_name: displayName || null,
          kunde_name: ticketName || customerName,
          kunde_firma: ticketCompany || company,
          kunde_email: String(ticket.kunde_email || ticket.customer_email || ticket.email || "").trim().toLowerCase() || email,
          kunde_telefon: String(ticket.kunde_telefon || ticket.customer_phone || ticket.phone || ticket.telefon || "").replace(/[^\d+]/g, "").trim() || phone,
          ansprechpartner: sanitizeCustomerText(ticket.ansprechpartner || ticket.contact_person || ticket.contact_name || "") || contact || null,
        };
      }
    }

    let audit: Record<string, unknown>[] = [];
    {
      let cols = ["id", "ticket_id", "event_type", "detail", "actor", "metadata", "created_at"];
      let orderByCreated = true;
      for (let i = 0; i < 24 && cols.length; i += 1) {
        let query = supabase.from("timeline_events").select(cols.join(",")).eq("ticket_id", id).limit(100);
        if (orderByCreated && cols.includes("created_at")) {
          query = query.order("created_at", { ascending: false });
        }
        const { data, error } = await query;
        if (!error) {
          audit = (data || []) as Record<string, unknown>[];
          break;
        }
        if (isMissingTable(error.message, "timeline_events")) break;
        const missing = extractMissingColumn(error.message, "timeline_events");
        if (!missing) return json({ error: error.message }, 500);
        cols = cols.filter((col) => col !== missing);
        if (missing === "created_at") orderByCreated = false;
      }
    }

    if (audit.length === 0) {
      let cols = ["id", "ticket_id", "event_typ", "detail", "actor", "created_at"];
      let orderByCreated = true;
      for (let i = 0; i < 24 && cols.length; i += 1) {
        let query = supabase.from("ticket_events").select(cols.join(",")).eq("ticket_id", id).limit(100);
        if (orderByCreated && cols.includes("created_at")) {
          query = query.order("created_at", { ascending: false });
        }
        const { data, error } = await query;
        if (!error) {
          audit = (data || []) as Record<string, unknown>[];
          break;
        }
        if (isMissingTable(error.message, "ticket_events")) break;
        const missing = extractMissingColumn(error.message, "ticket_events");
        if (!missing) return json({ error: error.message }, 500);
        cols = cols.filter((col) => col !== missing);
        if (missing === "created_at") orderByCreated = false;
      }
    }

    let attachments: Record<string, unknown>[] = [];
    {
      let cols = ["id", "ticket_id", "file_name", "storage_url", "mime_type", "size_bytes", "created_at"];
      let orderByCreated = true;
      for (let i = 0; i < 24 && cols.length; i += 1) {
        let query = supabase.from("ticket_attachments").select(cols.join(",")).eq("ticket_id", id);
        if (orderByCreated && cols.includes("created_at")) {
          query = query.order("created_at", { ascending: false });
        }
        const { data, error } = await query;
        if (!error) {
          attachments = (data || []) as Record<string, unknown>[];
          break;
        }
        if (isMissingTable(error.message, "ticket_attachments")) break;
        const missing = extractMissingColumn(error.message, "ticket_attachments");
        if (!missing) return json({ error: error.message }, 500);
        cols = cols.filter((col) => col !== missing);
        if (missing === "created_at") orderByCreated = false;
      }
    }

    let documents: Record<string, unknown>[] = [];
    {
      let cols = ["id", "ticket_id", "dokument_typ", "dokument_nummer", "status", "data", "created_at", "updated_at"];
      let orderByCreated = true;
      for (let i = 0; i < 24 && cols.length; i += 1) {
        let query = supabase.from("ticket_documents").select(cols.join(",")).eq("ticket_id", id);
        if (orderByCreated && cols.includes("created_at")) {
          query = query.order("created_at", { ascending: false });
        }
        const { data, error } = await query;
        if (!error) {
          documents = (data || []) as Record<string, unknown>[];
          break;
        }
        if (isMissingTable(error.message, "ticket_documents")) break;
        const missing = extractMissingColumn(error.message, "ticket_documents");
        if (!missing) return json({ error: error.message }, 500);
        cols = cols.filter((col) => col !== missing);
        if (missing === "created_at") orderByCreated = false;
      }
    }

    const sourceDocuments = await loadSourceDocuments(supabase, id);
    if (sourceDocuments.length > 0) {
      const seen = new Set(
        documents.map((row) => `${String(row.dokument_typ || "").trim().toLowerCase()}::${String(row.dokument_nummer || "").trim().toLowerCase()}`)
      );
      for (const row of sourceDocuments) {
        const key = `${String(row.dokument_typ || "").trim().toLowerCase()}::${String(row.dokument_nummer || "").trim().toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        documents.push(row);
      }
      documents.sort((a, b) => {
        const ta = new Date(String(a.created_at || "")).getTime();
        const tb = new Date(String(b.created_at || "")).getTime();
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      });
    }

    return json({
      ticket,
      audit: audit.map((row, idx) => ({
        id: row.id || `evt-${idx + 1}`,
        ticket_id: row.ticket_id || id,
        event: row.event_type || row.event_typ || "ticket_update",
        detail: row.detail || "",
        actor: row.actor || "System",
        created_at: row.created_at || new Date(0).toISOString(),
      })),
      attachments,
      documents,
    });
  } catch (err) {
    const message = String((err as Error)?.message || "Unbekannter Fehler");
    if (isAdminAccessErrorMessage(message)) return json({ error: message }, 403);
    if (isAuthErrorMessage(message)) return json({ error: message }, 401);
    return json({ error: message }, 500);
  }
});
