import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";
import { getValidGraphAccessToken } from "../_shared/graph.ts";
import { sendSmtpMail, smtpConfigured } from "../_shared/smtp.ts";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const DOC_LABELS: Record<string, string> = {
  rapport: "Rapport",
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function extractMissingColumn(message: string, table: string): string | null {
  const patterns = [
    new RegExp(`column\\s+${table}\\.(\\w+)\\s+does not exist`, "i"),
    new RegExp(`could not find the '([\\w_]+)' column of '${table}' in the schema cache`, "i"),
  ];
  for (const re of patterns) {
    const m = re.exec(message);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function loadSingleAdaptive(
  supabase: ReturnType<typeof serviceClient>,
  table: string,
  id: string,
  columns: string[]
): Promise<Record<string, unknown> | null> {
  const cols = [...columns];
  for (let i = 0; i < 12; i += 1) {
    if (!cols.length) break;
    const { data, error } = await supabase.from(table).select(cols.join(",")).eq("id", id).limit(2);
    if (!error) {
      const row = Array.isArray(data) ? data[0] : null;
      return (row || null) as Record<string, unknown> | null;
    }
    const missing = extractMissingColumn(String(error.message || ""), table);
    if (!missing) throw new Error(error.message);
    const idx = cols.indexOf(missing);
    if (idx >= 0) cols.splice(idx, 1);
  }
  return null;
}

function pickString(row: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return fallback;
}

function normalizeDocType(raw: string): "rapport" {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (["rapport", "report", "rap"].includes(value)) {
    return "rapport";
  }
  return "rapport";
}

function parseAddressList(raw: string): string[] {
  return String(raw || "")
    .split(/[;,]/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeRecipientEmail(value: string): string {
  const email = String(value || "").trim();
  if (!email) return email;
  return email.replace(/@kusiprimetec\.com$/i, "@kusiprimetec.de");
}

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function toSafeText(value: unknown, fallback = "-"): string {
  const txt = String(value ?? "").trim();
  return txt || fallback;
}

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function lineTotal(position: Record<string, unknown>): number {
  return numberValue(position.menge) * numberValue(position.einzelpreis);
}

function formatMoney(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

async function buildFallbackPdf(payload: {
  docLabel: string;
  documentNumber: string;
  ticketNumber: string;
  recipientName: string;
  documentDate: string;
  description: string;
  data: Record<string, unknown>;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const left = 40;

  const draw = (text: string, size = 11, isBold = false) => {
    page.drawText(text, {
      x: left,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.1, 0.14, 0.22),
    });
    y -= size + 6;
  };

  draw("KusiPrimeTec", 18, true);
  draw("Technischer Immobilienservice & Projektkoordination", 10, false);
  y -= 8;
  draw(payload.docLabel.toUpperCase(), 17, true);
  draw(`Dokumentnummer: ${payload.documentNumber}`, 11, false);
  draw(`Ticketnummer: ${payload.ticketNumber}`, 11, false);
  draw(`Datum: ${payload.documentDate}`, 11, false);
  draw(`Empfänger: ${payload.recipientName}`, 11, false);
  y -= 8;
  draw("Leistungsbeschreibung:", 11, true);

  const descriptionLines = toSafeText(payload.description, "-")
    .split(/\r?\n/g)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [""];
      const chunks: string[] = [];
      for (let i = 0; i < trimmed.length; i += 96) chunks.push(trimmed.slice(i, i + 96));
      return chunks;
    })
    .slice(0, 10);
  for (const line of descriptionLines) {
    draw(line || " ", 10.5, false);
  }

  y -= 8;
  const positions = Array.isArray(payload.data.positionen)
    ? (payload.data.positionen as Record<string, unknown>[])
    : [];
  if (positions.length > 0) {
    draw("Positionen:", 11, true);
    draw("Pos  Beschreibung                           Menge  Einheit  Einzelpreis  Gesamt", 9.5, true);
    let sum = 0;
    for (const row of positions.slice(0, 14)) {
      const nr = toSafeText(row.nr, "");
      const name = toSafeText(row.bezeichnung, "").slice(0, 34).padEnd(34, " ");
      const qty = toSafeText(row.menge, "").padStart(5, " ");
      const unit = toSafeText(row.einheit, "").slice(0, 8).padEnd(8, " ");
      const price = formatMoney(numberValue(row.einzelpreis)).padStart(10, " ");
      const total = formatMoney(lineTotal(row)).padStart(8, " ");
      draw(`${nr.padEnd(4, " ")} ${name} ${qty}  ${unit}  ${price} EUR  ${total} EUR`, 9.2, false);
      sum += lineTotal(row);
    }
    y -= 4;
    draw(`Zwischensumme: ${formatMoney(sum)} EUR`, 10.5, false);
    draw("Umsatzsteuer: 0,00 EUR (gemäß § 19 UStG)", 10.5, false);
    draw(`Gesamtbetrag: ${formatMoney(sum)} EUR`, 11, true);
  }

  y -= 14;
  draw("gemäß § 19 UStG wird keine Umsatzsteuer berechnet.", 9.5, false);
  draw("Telefon: 01776364393 · E-Mail: info@kusiprimetec.de · Web: KusiPrimeTec.de", 9.5, false);

  return await pdf.save();
}

function buildDefaultBody(payload: {
  recipientName: string;
  docLabel: string;
  documentNumber: string;
  ticketNumber: string;
  message: string;
  logoUrl: string;
  signedUrl: string;
}): string {
  const {
    recipientName,
    docLabel,
    documentNumber,
    ticketNumber,
    message,
    logoUrl,
    signedUrl,
  } = payload;

  const greeting = recipientName ? `Guten Tag ${escapeHtml(recipientName)},` : "Guten Tag,";
  const custom = message
    ? `<p style="margin:0 0 14px 0;">${toHtmlMultiline(message)}</p>`
    : `<p style="margin:0 0 14px 0;">anbei erhalten Sie Ihr ${escapeHtml(docLabel)} <strong>${escapeHtml(documentNumber)}</strong> zu Ticket <strong>${escapeHtml(ticketNumber)}</strong>.</p>`;

  const linkBlock = signedUrl
    ? `<p style="margin:0 0 14px 0;">Falls Ihr E-Mail-Programm den Anhang blockiert, können Sie das Dokument auch über diesen Link öffnen: <a href="${escapeHtml(signedUrl)}">${escapeHtml(signedUrl)}</a></p>`
    : "";

  const logoBlock = logoUrl
    ? `<p style="margin:0 0 14px 0;"><img src="${escapeHtml(logoUrl)}" alt="KusiPrimeTec Logo" style="max-width:240px;height:auto;display:block;" /></p>`
    : "";

  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#0f172a;">`,
    logoBlock,
    `<p style="margin:0 0 14px 0;">${greeting}</p>`,
    custom,
    linkBlock,
    `<p style="margin:0 0 14px 0;">Mit freundlichen Grüßen</p>`,
    `<p style="margin:0;">Robert Kusminov<br />KusiPrimeTec<br />Technischer Immobilienservice &amp; Projektkoordination</p>`,
    `<p style="margin:14px 0 0 0;">Telefon: 01776364393<br />E-Mail: info@kusiprimetec.de<br />Web: KusiPrimeTec.de</p>`,
    `</div>`,
  ].join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let debugDocumentId = "";
  let debugTicketId = "";
  let debugTo = "";
  let debugActor = "system";

  try {
    const admin = await requireAdmin(req);
    debugActor = admin.email || "system";
    const body = await req.json();

    const documentId = String(body.document_id || "").trim();
    debugDocumentId = documentId;
    const toOverride = String(body.to || "").trim();
    const subjectOverride = String(body.subject || "").trim();
    const messageOverride = String(body.message || "").trim();

    if (!documentId) return json({ error: "document_id fehlt." }, 400);

    const supabase = serviceClient();
    const docRow = await loadSingleAdaptive(supabase, "ticket_documents", documentId, [
      "id",
      "ticket_id",
      "dokument_typ",
      "doc_type",
      "document_type",
      "type",
      "typ",
      "dokument_nummer",
      "storage_path",
      "data",
      "status",
      "updated_at",
    ]);
    if (!docRow) return json({ error: "Dokument nicht gefunden." }, 404);

    const ticketId = pickString(docRow, ["ticket_id"], "");
    debugTicketId = ticketId;
    if (!ticketId) return json({ error: "ticket_id im Dokument fehlt." }, 400);

    const ticketRow = await loadSingleAdaptive(supabase, "tickets", ticketId, [
      "id",
      "ticket_nummer",
      "ticket_number",
      "kunde_name",
      "kunde_firma",
      "kunde_email",
      "customer_email",
      "email",
    ]);
    if (!ticketRow) return json({ error: "Ticket zum Dokument nicht gefunden." }, 404);

    const rawDocType = pickString(docRow, ["dokument_typ", "doc_type", "document_type", "type", "typ"], "rapport");
    const docType = normalizeDocType(rawDocType);
    const docLabel = DOC_LABELS[docType];
    const documentNumber = pickString(docRow, ["dokument_nummer"], "OHNE-NUMMER");
    const ticketNumber = pickString(ticketRow, ["ticket_nummer", "ticket_number"], "OHNE-TICKETNUMMER");

    const dataField = docRow.data;
    const data = (typeof dataField === "object" && dataField !== null
      ? (dataField as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    const recipientName = pickString(
      data,
      ["kunde", "recipient_name", "empfaenger_name"],
      pickString(ticketRow, ["kunde_firma", "kunde_name"], "")
    );
    const toRaw = toOverride || pickString(data, ["kunde_email", "recipient_email"], pickString(ticketRow, ["kunde_email", "customer_email", "email"], ""));
    const to = normalizeRecipientEmail(toRaw);
    debugTo = to;
    if (!to) return json({ error: "Keine Empfänger-E-Mail gefunden." }, 400);

    const subject = subjectOverride || `${docLabel} ${documentNumber} | Ticket ${ticketNumber}`;
    const storagePath = pickString(docRow, ["storage_path"], "");
    const logoUrl = String(Deno.env.get("MAIL_LOGO_URL") || "https://kusiprimetec.de/publickpt-wordmark.png").trim();

    let signedUrl = "";
    if (storagePath) {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      signedUrl = String(signed?.signedUrl || "");
    }

    const html = buildDefaultBody({
      recipientName,
      docLabel,
      documentNumber,
      ticketNumber,
      message: messageOverride,
      logoUrl,
      signedUrl,
    });
    const bccRecipients = parseAddressList(String(Deno.env.get("MAIL_BCC") || ""));

    const graphAttachments: Array<Record<string, unknown>> = [];
    const smtpAttachments: Array<{ filename: string; contentType: string; contentBytes: Uint8Array }> = [];
    let attachmentBytes: Uint8Array | null = null;
    if (storagePath) {
      const { data: file } = await supabase.storage.from("documents").download(storagePath);
      if (file) {
        attachmentBytes = new Uint8Array(await file.arrayBuffer());
      }
    }
    if (!attachmentBytes) {
      const fallbackPdf = await buildFallbackPdf({
        docLabel,
        documentNumber,
        ticketNumber,
        recipientName,
        documentDate: toSafeText(data.dokument_datum, new Date().toISOString().slice(0, 10)),
        description: toSafeText(data.leistungsbeschreibung, ""),
        data,
      });
      attachmentBytes = fallbackPdf;
    }
    if (attachmentBytes) {
      const filename = `${documentNumber}.pdf`;
      graphAttachments.push({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: filename,
        contentType: "application/pdf",
        contentBytes: toBase64(attachmentBytes),
      });
      smtpAttachments.push({
        filename,
        contentType: "application/pdf",
        contentBytes: attachmentBytes,
      });
    }

    let sentVia: "smtp" | "graph" = "graph";
    if (smtpConfigured()) {
      await sendSmtpMail({
        to,
        bcc: bccRecipients,
        subject,
        text: messageOverride || `Ihr ${docLabel} ${documentNumber} zu Ticket ${ticketNumber}.`,
        html,
        attachments: smtpAttachments,
      });
      sentVia = "smtp";
    } else {
      const token = await getValidGraphAccessToken(admin.email);
      const payload: Record<string, unknown> = {
        message: {
          subject,
          body: {
            contentType: "HTML",
            content: html,
          },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      };
      if (bccRecipients.length > 0) {
        (payload.message as Record<string, unknown>).bccRecipients = bccRecipients.map((address) => ({
          emailAddress: { address },
        }));
      }
      if (graphAttachments.length > 0) {
        (payload.message as Record<string, unknown>).attachments = graphAttachments;
      }

      const mailRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(payload),
      });
      if (!mailRes.ok) {
        const errText = await mailRes.text();
        const details = errText || "Leerer Fehlertext von Microsoft Graph.";
        return json(
          {
            error: `Graph sendMail fehlgeschlagen (HTTP ${mailRes.status}): ${details}`,
            status: mailRes.status,
          },
          500
        );
      }
    }

    try {
      await supabase.from("ticket_documents").update({ status: "gesendet", updated_at: new Date().toISOString() }).eq("id", documentId);
    } catch {
      // Status-Update ist optional.
    }

    try {
      await supabase.from("ticket_events").insert({
        ticket_id: ticketId,
        event_typ: "dokument_versendet",
        detail: `${docLabel} ${documentNumber} per E-Mail an ${to} versendet`,
        actor: admin.email,
        metadata: {
          document_id: documentId,
          dokument_typ: docType,
          dokument_nummer: documentNumber,
          email_to: to,
          email_bcc: bccRecipients,
          has_attachment: smtpAttachments.length > 0,
          mail_provider: sentVia,
        },
      });
    } catch {
      // Timeline-Event optional.
    }

    return json({
      ok: true,
      to,
      subject,
      attached: smtpAttachments.length > 0,
      provider: sentVia,
      bcc_count: bccRecipients.length,
    });
  } catch (err) {
    const message = String((err as Error).message || "Mailversand fehlgeschlagen.");
    const lower = message.toLowerCase();
    const isAuthError =
      lower.includes("nicht autorisiert") ||
      lower.includes("ungueltige session") ||
      lower.includes("kein admin-zugriff");
    try {
      const supabase = serviceClient();
      let ticketId = debugTicketId;
      if (!ticketId && debugDocumentId) {
        const doc = await loadSingleAdaptive(supabase, "ticket_documents", debugDocumentId, ["id", "ticket_id"]);
        ticketId = pickString(doc || {}, ["ticket_id"], "");
      }
      if (ticketId) {
        await supabase.from("ticket_events").insert({
          ticket_id: ticketId,
          event_typ: "dokument_versand_fehler",
          detail: `Mailversand fehlgeschlagen: ${message.slice(0, 260)}`,
          actor: debugActor,
          metadata: {
            document_id: debugDocumentId || null,
            email_to: debugTo || null,
            error: message,
          },
        });
      }
    } catch {
      // Fehlerprotokoll ist optional.
    }
    const status = isAuthError ? 401 : 500;
    return json({ error: message }, status);
  }
});


