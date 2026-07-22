import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";
import { isTicketObjectConsistent } from "../_shared/customer-object-access.ts";

function asText(value: unknown, max = 180): string {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function splitAddress(address: string): { street: string | null; zip: string | null; city: string | null } {
  const raw = asText(address, 220);
  if (!raw) return { street: null, zip: null, city: null };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const street = parts[0] || null;
  const tail = parts[1] || "";
  const match = tail.match(/^(\d{4,5})\s+(.+)$/);
  if (match) return { street, zip: match[1], city: match[2] };
  return { street, zip: null, city: tail || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    await requireAdmin(req);
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim().toLowerCase();
    const supabase = serviceClient();

    if (action === "ensure_object") {
      const currentObjectId = asText(body.object_id, 80);
      if (currentObjectId) return json({ ok: true, object_id: currentObjectId });

      const name = asText(body.name || "Objekt");
      const address = asText(body.address, 220);
      const { street, zip, city } = splitAddress(address);
      const payload = {
        name: name || "Objekt",
        street,
        zip,
        city,
        is_active: true,
      };
      const { data, error } = await supabase.from("objects").insert(payload).select("id").single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, object_id: String(data?.id || "") });
    }

    if (action === "get_object_names") {
      const rawIds = Array.isArray(body.object_ids) ? body.object_ids : [];
      const ids = [...new Set(rawIds.map((v) => asText(v, 80)).filter(Boolean))];
      if (!ids.length) return json({ ok: true, items: [] });
      const { data, error } = await supabase.from("objects").select("id,name").in("id", ids);
      if (error) return json({ error: error.message }, 500);
      const items = (data || []).map((row) => ({
        id: asText((row as Record<string, unknown>).id, 80),
        name: asText((row as Record<string, unknown>).name, 180),
      }));
      return json({ ok: true, items });
    }

    if (action === "rename_object") {
      const objectId = asText(body.object_id, 80);
      const name = asText(body.name);
      if (!objectId || !name) return json({ error: "object_id oder name fehlt." }, 400);
      const { error } = await supabase.from("objects").update({ name, updated_at: new Date().toISOString() }).eq("id", objectId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "assign_ticket") {
      const ticketId = asText(body.ticket_id, 80);
      const objectId = asText(body.object_id, 80);
      if (!ticketId || !objectId) return json({ error: "ticket_id oder object_id fehlt." }, 400);

      const { data: obj, error: objErr } = await supabase
        .from("objects")
        .select("id,name,street,zip,city,customer_id,requester_user_id,is_active")
        .eq("id", objectId)
        .maybeSingle();
      if (objErr || !obj) return json({ error: objErr?.message || "Objekt nicht gefunden." }, 404);

      const { data: ticket, error: ticketErr } = await supabase
        .from("tickets")
        .select("id,customer_id,requester_user_id")
        .eq("id", ticketId)
        .maybeSingle();
      if (ticketErr || !ticket) return json({ error: ticketErr?.message || "Ticket nicht gefunden." }, 404);
      const customerId = asText((ticket as Record<string, unknown>).customer_id, 80);
      if (!customerId) return json({ error: "Ticket besitzt keine eindeutige Kundenzuordnung." }, 409);
      const { data: customer, error: customerErr } = await supabase
        .from("customers")
        .select("id,auth_user_id")
        .eq("id", customerId)
        .maybeSingle();
      if (customerErr || !customer) return json({ error: customerErr?.message || "Ticketkunde nicht gefunden." }, 409);

      const customerAuthUserId = asText((customer as Record<string, unknown>).auth_user_id, 80);
      const objectRequesterUserId = asText((obj as Record<string, unknown>).requester_user_id, 80);
      if (
        !isTicketObjectConsistent(ticket, obj) ||
        (customerAuthUserId ? objectRequesterUserId !== customerAuthUserId : Boolean(objectRequesterUserId))
      ) {
        return json({ error: "Ticket und Objekt gehören nicht zum selben aktiven Kundenkonto." }, 409);
      }

      const street = asText((obj as Record<string, unknown>).street, 160) || null;
      const zip = asText((obj as Record<string, unknown>).zip, 20) || null;
      const city = asText((obj as Record<string, unknown>).city, 120) || null;
      const address = [street, [zip, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

      const patch: Record<string, unknown> = {
        object_id: objectId,
        objekt_strasse: street,
        objekt_plz: zip,
        objekt_ort: city,
        objekt_adresse: address || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("tickets").update(patch).eq("id", ticketId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "delete_object") {
      const objectId = asText(body.object_id, 80);
      if (!objectId) return json({ error: "object_id fehlt." }, 400);

      const { error: detachErr } = await supabase.from("tickets").update({ object_id: null }).eq("object_id", objectId);
      if (detachErr) return json({ error: detachErr.message }, 500);

      const { error: deleteErr } = await supabase.from("objects").delete().eq("id", objectId);
      if (!deleteErr) return json({ ok: true });

      const { error: softErr } = await supabase
        .from("objects")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", objectId);
      if (softErr) return json({ error: deleteErr.message }, 500);
      return json({ ok: true, soft_deleted: true });
    }

    return json({ error: "Unbekannte Aktion." }, 400);
  } catch (err) {
    const message = (err as Error).message || "Unbekannter Fehler.";
    const lower = message.toLowerCase();
    if (lower.includes("nicht autorisiert") || lower.includes("ungueltige session") || lower.includes("ungültige session")) {
      return json({ error: message }, 401);
    }
    if (lower.includes("kein admin-zugriff")) {
      return json({ error: message }, 403);
    }
    return json({ error: message }, 500);
  }
});
