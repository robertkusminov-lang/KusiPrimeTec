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

function asEmail(value: unknown): string {
  return asText(value, 254).toLowerCase();
}

function asPhone(value: unknown): string {
  return asText(value, 80).replace(/[^\d+]/g, "");
}

function isMissingRelation(message: string): boolean {
  const lower = String(message || "").toLowerCase();
  return lower.includes("does not exist") || lower.includes("schema cache");
}

async function countReferences(
  supabase: ReturnType<typeof serviceClient>,
  table: string,
  column: string,
  id: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, id);
  if (error) {
    if (isMissingRelation(error.message)) return 0;
    throw new Error(error.message);
  }
  return Number(count || 0);
}

function hasDependencies(counts: Record<string, number>): boolean {
  return Object.values(counts).some((value) => value > 0);
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

      const dependencyCounts = {
        tickets: await countReferences(supabase, "tickets", "object_id", objectId),
        notes: await countReferences(supabase, "object_notes", "object_id", objectId),
      };
      if (hasDependencies(dependencyCounts)) {
        return json({
          error: "Dieses Objekt kann nicht gelöscht werden, da noch Tickets oder Notizen zugeordnet sind. Bitte deaktiviere das Objekt stattdessen.",
          dependency_counts: dependencyCounts,
        }, 409);
      }

      const { error: deleteErr, count } = await supabase
        .from("objects")
        .delete({ count: "exact" })
        .eq("id", objectId);
      if (deleteErr) return json({ error: deleteErr.message }, 500);
      if (!count) return json({ error: "Objekt wurde nicht gefunden oder bereits gelöscht." }, 404);
      return json({ ok: true, deleted: true });
    }

    if (action === "archive_object" || action === "restore_object") {
      const objectId = asText(body.object_id, 80);
      if (!objectId) return json({ error: "object_id fehlt." }, 400);
      const isActive = action === "restore_object";
      const { error, count } = await supabase
        .from("objects")
        .update({ is_active: isActive, updated_at: new Date().toISOString() }, { count: "exact" })
        .eq("id", objectId);
      if (error) return json({ error: error.message }, 500);
      if (!count) return json({ error: "Objekt wurde nicht gefunden." }, 404);
      return json({ ok: true, archived: !isActive });
    }

    if (action === "delete_ticket") {
      const ticketId = asText(body.ticket_id, 80);
      if (!ticketId) return json({ error: "ticket_id fehlt." }, 400);

      const dependencyCounts = {
        documents: await countReferences(supabase, "ticket_documents", "ticket_id", ticketId),
        reports: await countReferences(supabase, "reports", "ticket_id", ticketId),
        offers: await countReferences(supabase, "offers", "ticket_id", ticketId),
        invoices: await countReferences(supabase, "invoices", "ticket_id", ticketId),
        attachments: await countReferences(supabase, "ticket_attachments", "ticket_id", ticketId),
        messages: await countReferences(supabase, "ticket_messages", "ticket_id", ticketId),
      };
      if (hasDependencies(dependencyCounts)) {
        return json({
          error: "Dieses Ticket kann nicht gelöscht werden, da noch Dokumente, Rapporte, Anhänge oder Nachrichten zugeordnet sind. Bitte archiviere das Ticket stattdessen.",
          dependency_counts: dependencyCounts,
        }, 409);
      }

      const { error, count } = await supabase
        .from("tickets")
        .delete({ count: "exact" })
        .eq("id", ticketId);
      if (error) return json({ error: error.message }, 500);
      if (!count) return json({ error: "Ticket wurde nicht gefunden oder bereits gelöscht." }, 404);
      return json({ ok: true, deleted: true });
    }

    if (action === "delete_customer") {
      const customerId = asText(body.customer_id, 80);
      if (!customerId) return json({ error: "customer_id fehlt." }, 400);

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id,auth_user_id")
        .eq("id", customerId)
        .maybeSingle();
      if (customerError) return json({ error: customerError.message }, 500);
      if (!customer) return json({ error: "Kunde wurde nicht gefunden oder bereits gelöscht." }, 404);

      const dependencyCounts = {
        tickets: await countReferences(supabase, "tickets", "customer_id", customerId),
        objects: await countReferences(supabase, "objects", "customer_id", customerId),
        customer_account: asText((customer as Record<string, unknown>).auth_user_id, 80) ? 1 : 0,
      };
      if (hasDependencies(dependencyCounts)) {
        return json({
          error: "Dieser Kunde kann nicht gelöscht werden, da noch Tickets, Objekte oder ein Kundenkonto zugeordnet sind. Bitte archiviere den Kunden stattdessen.",
          dependency_counts: dependencyCounts,
        }, 409);
      }

      const { error, count } = await supabase
        .from("customers")
        .delete({ count: "exact" })
        .eq("id", customerId);
      if (error) return json({ error: error.message }, 500);
      if (!count) return json({ error: "Kunde wurde nicht gefunden oder bereits gelöscht." }, 404);
      return json({ ok: true, deleted: true });
    }

    if (action === "archive_customer" || action === "restore_customer") {
      const customerId = asText(body.customer_id, 80);
      if (!customerId) return json({ error: "customer_id fehlt." }, 400);
      const archive = action === "archive_customer";
      const { error, count } = await supabase
        .from("customers")
        .update({
          status: archive ? "archived" : "active",
          archived_at: archive ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { count: "exact" })
        .eq("id", customerId);
      if (error) return json({ error: error.message }, 500);
      if (!count) return json({ error: "Kunde wurde nicht gefunden." }, 404);
      return json({ ok: true, archived: archive });
    }

    if (action === "update_customer") {
      const customerId = asText(body.customer_id, 80);
      const values = body.values && typeof body.values === "object"
        ? body.values as Record<string, unknown>
        : {};
      if (!customerId) return json({ error: "customer_id fehlt." }, 400);

      const customerType = asText(values.customer_type, 20).toLowerCase();
      const name = asText(values.name, 180);
      const company = asText(values.company_name, 180);
      const contactPerson = asText(values.contact_person, 180);
      const email = asEmail(values.email);
      const phone = asPhone(values.phone);
      const street = asText(values.street, 180);
      const zip = asText(values.zip, 20);
      const city = asText(values.city, 120);

      if (customerType !== "privat" && customerType !== "firma") {
        return json({ error: "Bitte einen gültigen Kundentyp auswählen." }, 400);
      }
      if (!name && !company) return json({ error: "Bitte Name oder Firmenname angeben." }, 400);
      if (customerType === "firma" && !company) return json({ error: "Bei Kundentyp Firma ist der Firmenname erforderlich." }, 400);
      if (!email && !phone) return json({ error: "Bitte mindestens E-Mail oder Telefon angeben." }, 400);

      const invoiceRecipientName = customerType === "firma" ? company : name;
      const update = {
        customer_type: customerType,
        name: name || company,
        company: company || null,
        company_name: company || null,
        invoice_recipient_name: invoiceRecipientName,
        contact_person: contactPerson || null,
        email: email || null,
        phone: phone || null,
        billing_address_street: street || null,
        billing_address_zip: zip || null,
        billing_address_city: city || null,
        zip: zip || null,
        city: city || null,
        updated_at: new Date().toISOString(),
      };
      const { error, count } = await supabase
        .from("customers")
        .update(update, { count: "exact" })
        .eq("id", customerId);
      if (error) {
        if (String(error.code || "") === "23505") {
          return json({ error: "E-Mail-Adresse oder Telefonnummer wird bereits von einem anderen Kunden verwendet." }, 409);
        }
        return json({ error: error.message }, 500);
      }
      if (!count) return json({ error: "Kunde wurde nicht gefunden." }, 404);
      return json({ ok: true });
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
