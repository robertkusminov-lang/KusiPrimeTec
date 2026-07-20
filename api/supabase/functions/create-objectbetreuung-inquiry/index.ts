import { json, options } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/client.ts";

function cleanText(value: unknown, max = 240): string {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanMultiline(value: unknown, max = 4000): string {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function normalizeEmail(value: unknown): string {
  return cleanText(value, 180).toLowerCase();
}

function normalizeSource(value: unknown): string {
  const raw = cleanText(value, 80).toLowerCase();
  if (raw.includes("telefon")) return "Telefon";
  if (raw.includes("empfehl")) return "Empfehlung";
  if (raw.includes("mail")) return "E-Mail";
  if (raw.includes("website") || !raw) return "Website";
  if (raw.includes("sonst")) return "Sonstiges";
  return cleanText(value, 80) || "Website";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();

    const payload = {
      company_name: cleanText(body.company_name || body.company || body.unternehmen, 180),
      contact_name: cleanText(body.contact_name || body.contact || body.ansprechpartner, 180),
      phone: cleanText(body.phone || body.telefon, 60) || null,
      email: normalizeEmail(body.email || body.mail || body.kunde_email),
      address_line: cleanText(body.address_line || body.address || body.standort || body.adresse, 260) || null,
      industry: cleanText(body.industry || body.branche, 120) || null,
      property_type: cleanText(body.property_type || body.objektart, 120) || null,
      property_size: cleanText(body.property_size || body.objektgroesse, 120) || null,
      desired_support: cleanText(body.desired_support || body.betreuung || body.gewuenschte_betreuung, 240) || null,
      message: cleanMultiline(body.message || body.nachricht, 4000),
      source: normalizeSource(body.source || body.quelle),
      assigned_to: "Robert Kusminov",
      status: "neue ObjektBetreuungs-Anfrage",
      requested_at: new Date().toISOString(),
    };

    if (!payload.company_name) return json({ error: "Unternehmen ist erforderlich." }, 400);
    if (!payload.contact_name) return json({ error: "Ansprechpartner ist erforderlich." }, 400);
    if (!payload.email || !payload.email.includes("@")) return json({ error: "E-Mail ist erforderlich." }, 400);
    if (!payload.message) return json({ error: "Bitte eine Nachricht eingeben." }, 400);

    const supabase = serviceClient();
    const { data, error } = await supabase
      .from("objectbetreuung_inquiries")
      .insert(payload)
      .select("id,inquiry_number,status")
      .single();

    if (error) return json({ error: error.message }, 500);

    try {
      await supabase.from("analytics_events").insert({
        event_name: "objectbetreuung_inquiry_submit",
        step: "submit",
        page_path: "/objektbetreuung-anfrage",
        metadata: {
          inquiry_id: data?.id || null,
          inquiry_number: data?.inquiry_number || null,
          source: payload.source,
          property_type: payload.property_type,
        },
      });
    } catch {
      // Optional analytics insert.
    }

    return json({
      ok: true,
      inquiry_id: String(data?.id || ""),
      inquiry_number: String(data?.inquiry_number || ""),
      status: String(data?.status || "neue ObjektBetreuungs-Anfrage"),
    });
  } catch (err) {
    return json({ error: (err as Error).message || "Anfrage konnte nicht gespeichert werden." }, 500);
  }
});
