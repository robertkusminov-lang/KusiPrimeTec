import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";

const docMap: Record<string, { prefix: string; title: string }> = {
  rapport: { prefix: "RAP", title: "Rapport" },
};

function toLegacyDocType(typ: string): string {
  if (typ === "rapport") return "report";
  return "report";
}

function isMissingTable(message: string, table: string): boolean {
  const msg = String(message || "").toLowerCase();
  return msg.includes(`could not find the table 'public.${table.toLowerCase()}'`) || (msg.includes("schema cache") && msg.includes(table.toLowerCase()));
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

function formatDocumentNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(Math.max(1, sequence)).padStart(4, "0")}`;
}

function extractSequence(value: string): number {
  const m = String(value || "").match(/-(\d{1,8})$/);
  return m?.[1] ? Number(m[1]) : 0;
}

async function nextDocumentNumber(supabase: ReturnType<typeof serviceClient>, prefix: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_document_number", { p_prefix: prefix });
  if (!error && data) return String(data);
  if (error && !isMissingRpcFunction(error.message, "next_document_number")) {
    throw new Error(error.message);
  }

  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data: rows, error: rowErr } = await supabase
      .from("document_counters")
      .select("prefix,year,next_value")
      .eq("prefix", prefix)
      .limit(2);

    if (rowErr) {
      if (!isMissingTable(rowErr.message, "document_counters")) continue;
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
      if (isMissingTable(insertErr.message, "document_counters")) break;
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
      if (resetErr && isMissingTable(resetErr.message, "document_counters")) break;
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
    if (updateErr && isMissingTable(updateErr.message, "document_counters")) break;
  }

  const pattern = `${prefix}-${year}-%`;
  const { data: docs, error: docErr } = await supabase
    .from("ticket_documents")
    .select("dokument_nummer")
    .ilike("dokument_nummer", pattern)
    .limit(5000);
  if (docErr && !isMissingTable(docErr.message, "ticket_documents")) throw new Error(docErr.message);

  const max = (docs || []).reduce((acc, row) => {
    const nummer = String((row as { dokument_nummer?: string }).dokument_nummer || "");
    return Math.max(acc, extractSequence(nummer));
  }, 0);
  return formatDocumentNumber(prefix, year, max + 1);
}

async function createPdf(payload: {
  typ: string;
  dokumentNummer: string;
  ticketNummer: string;
  kunde: string;
  adresse: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText("KusiPrimeTec", { x: 40, y: 790, size: 18, font: bold, color: rgb(0.08, 0.16, 0.32) });
  page.drawText("Technischer Immobilienservice & Projektkoordination", { x: 40, y: 772, size: 10, font });

  page.drawText(docMap[payload.typ].title, { x: 40, y: 730, size: 20, font: bold });
  page.drawText(`Dokument-Nr.: ${payload.dokumentNummer}`, { x: 40, y: 705, size: 11, font });
  page.drawText(`Ticket-Nr.: ${payload.ticketNummer}`, { x: 40, y: 688, size: 11, font });
  page.drawText(`Kunde: ${payload.kunde}`, { x: 40, y: 671, size: 11, font });
  page.drawText(`Objekt: ${payload.adresse}`, { x: 40, y: 654, size: 11, font });

  page.drawText("Kleinunternehmerregelung: Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.", {
    x: 40,
    y: 112,
    size: 9,
    font,
  });
  page.drawText("Kundensignatur: ____________________", { x: 40, y: 80, size: 10, font });
  page.drawText("Unterschrift KusiPrimeTec: ____________________", { x: 320, y: 80, size: 10, font });
  page.drawLine({
    start: { x: 40, y: 46 },
    end: { x: 555, y: 46 },
    thickness: 0.8,
    color: rgb(0.72, 0.78, 0.86),
  });
  page.drawText("KusiPrimeTec · Robert Kusminov · Epplerinweg 31 · 73614 Schorndorf", { x: 40, y: 32, size: 8.5, font });
  page.drawText("Telefon: 01776364393 · E-Mail: info@kusiprimetec.de · Web: KusiPrimeTec.de", { x: 40, y: 20, size: 8.5, font });

  page.drawText("Technischer Immobilienservice & Projektkoordination", { x: 40, y: 8, size: 8.5, font });
  return await pdf.save();
}

async function loadTicketAdaptive(
  supabase: ReturnType<typeof serviceClient>,
  ticketId: string
): Promise<Record<string, unknown> | null> {
  let cols = [
    "id",
    "ticket_nummer",
    "ticket_number",
    "kunde_name",
    "kunde_firma",
    "company_name",
    "contact_person",
    "invoice_recipient_name",
    "objekt_adresse",
    "object_address",
    "objekt_strasse",
    "objekt_plz",
    "objekt_ort",
  ];

  for (let i = 0; i < 24 && cols.length; i += 1) {
    const { data, error } = await supabase.from("tickets").select(cols.join(",")).eq("id", ticketId).limit(2);
    if (!error) return Array.isArray(data) ? ((data[0] as Record<string, unknown>) || null) : null;
    const missing = extractMissingColumn(error.message || "", "tickets");
    if (!missing) throw new Error(error.message || "Ticket nicht gefunden");
    const nextCols = cols.filter((col) => col !== missing);
    if (nextCols.length === cols.length) throw new Error(error.message || "Ticket nicht gefunden");
    cols = nextCols;
  }
  return null;
}

async function insertTicketDocumentAdaptive(
  supabase: ReturnType<typeof serviceClient>,
  payload: Record<string, unknown>
): Promise<void> {
  let body: Record<string, unknown> = { ...payload };
  for (let i = 0; i < 24 && Object.keys(body).length; i += 1) {
    const { error } = await supabase.from("ticket_documents").insert(body);
    if (!error) return;
    const missing = extractMissingColumn(error.message || "", "ticket_documents");
    if (!missing) throw new Error(error.message || "Dokument konnte nicht gespeichert werden");
    if (Object.prototype.hasOwnProperty.call(body, missing)) {
      delete body[missing];
      continue;
    }
    throw new Error(error.message || "Dokument konnte nicht gespeichert werden");
  }
  throw new Error("Dokument konnte nicht gespeichert werden");
}

async function uploadPdfWithBucketRetry(
  supabase: ReturnType<typeof serviceClient>,
  path: string,
  pdfBytes: Uint8Array
): Promise<void> {
  let upload = await supabase.storage.from("documents").upload(path, pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (!upload.error) return;

  const message = String(upload.error.message || "").toLowerCase();
  if (message.includes("bucket not found")) {
    const { error: createErr } = await supabase.storage.createBucket("documents", { public: false });
    if (createErr) {
      const createMsg = String(createErr.message || "").toLowerCase();
      if (!createMsg.includes("already exists") && !createMsg.includes("duplicate")) {
        throw new Error(createErr.message);
      }
    }

    upload = await supabase.storage.from("documents").upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (!upload.error) return;
  }

  throw new Error(upload.error.message || "PDF Upload fehlgeschlagen");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await requireAdmin(req);
    const body = await req.json();
    const ticketId = String(body.ticket_id || "").trim();
    const typ = String(body.typ || "").trim();

    if (!ticketId) return json({ error: "ticket_id fehlt" }, 400);
    if (!docMap[typ] || typ !== "rapport") return json({ error: "Ungültiger Dokumenttyp" }, 400);

    const supabase = serviceClient();
    const ticket = await loadTicketAdaptive(supabase, ticketId);
    if (!ticket) return json({ error: "Ticket nicht gefunden" }, 404);

    const ticketNummer = String(ticket.ticket_nummer || ticket.ticket_number || ticket.id || "").trim();
    const kunde =
      String(
        ticket.kunde_firma ||
          ticket.company_name ||
          ticket.kunde_name ||
          ticket.contact_person ||
          ticket.invoice_recipient_name ||
          "Kunde"
      ).trim() || "Kunde";
    const adresse =
      String(ticket.objekt_adresse || ticket.object_address || "").trim() ||
      [
        String(ticket.objekt_strasse || "").trim(),
        [String(ticket.objekt_plz || "").trim(), String(ticket.objekt_ort || "").trim()].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ");

    const nummer = await nextDocumentNumber(supabase, docMap[typ].prefix);

    const pdfBytes = await createPdf({
      typ,
      dokumentNummer: nummer,
      ticketNummer: ticketNummer,
      kunde,
      adresse: adresse || "-",
    });

    const path = `${ticket.id}/${nummer}.pdf`;
    await uploadPdfWithBucketRetry(supabase, path, pdfBytes);

    const { data: signed, error: signedErr } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 30);
    if (signedErr || !signed) return json({ error: signedErr?.message || "Signierte URL fehlgeschlagen" }, 500);

    const insertPayload: Record<string, unknown> = {
      ticket_id: ticket.id,
      dokument_typ: typ,
      doc_type: toLegacyDocType(typ),
      document_type: toLegacyDocType(typ),
      type: typ,
      typ,
      dokument_nummer: nummer,
      storage_path: path,
      created_by: admin.email,
    };

    await insertTicketDocumentAdaptive(supabase, insertPayload);

    await supabase.from("ticket_events").insert({
      ticket_id: ticket.id,
      event_typ: "dokument_erstellt",
      detail: `${docMap[typ].title} ${nummer} erstellt`,
      actor: admin.email,
      metadata: { typ, nummer },
    });

    return json({ pdf_url: signed.signedUrl, dokument_nummer: nummer });
  } catch (err) {
    return json({ error: (err as Error).message }, 401);
  }
});



