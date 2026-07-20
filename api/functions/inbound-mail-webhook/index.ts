import { json, options } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const subject = String(body.subject || "");
    const sender = String(body.sender || "");
    const content = String(body.content || "");

    const match = subject.match(/KPT-\d{4}-\d{4}/i);
    if (!match) return json({ ok: true, matched: false });

    const ticketNummer = match[0].toUpperCase();
    const supabase = serviceClient();
    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select("id")
      .eq("ticket_nummer", ticketNummer)
      .maybeSingle();

    if (tErr || !ticket) return json({ ok: true, matched: false });

    await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      richtung: "eingang",
      kanal: "outlook",
      betreff: subject,
      sender,
      inhalt: content,
    });

    await supabase.from("ticket_events").insert({
      ticket_id: ticket.id,
      event_typ: "mail_eingang",
      detail: `Eingangs-Mail von ${sender}`,
      actor: "system",
      metadata: { channel: "outlook" },
    });

    return json({ ok: true, matched: true, ticket_nummer: ticketNummer });
  } catch (err) {
    return json({ error: (err as Error).message || "Webhook Fehler" }, 500);
  }
});


