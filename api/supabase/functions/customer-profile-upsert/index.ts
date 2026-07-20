import { json, options } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/client.ts";

function asText(value: unknown, max = 160): string {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = String(req.headers.get("authorization") || "");
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return json({ error: "Nicht angemeldet." }, 401);

    const supabase = serviceClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Ungültige Sitzung." }, 401);

    const authUserId = String(userData.user.id || "");
    const authEmail = normalizeEmail(userData.user.email || "");
    if (!authUserId || !authEmail) return json({ error: "Kontodaten unvollständig." }, 400);

    const body = await req.json();
    const payload = {
      auth_user_id: authUserId,
      email: authEmail,
      name: asText(body.name || "Kunde"),
      company_name: asText(body.company_name, 180) || null,
      phone: asText(body.phone, 40) || null,
      city: asText(body.city, 120) || null,
      zip: asText(body.zip, 20) || null,
      contact_person: asText(body.contact_person, 140) || null,
      updated_at: new Date().toISOString(),
    };

    const { data: byAuthRows, error: byAuthError } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", authUserId)
      .limit(1);
    if (byAuthError) return json({ error: byAuthError.message }, 500);
    const existingByAuthId = String(byAuthRows?.[0]?.id || "");

    if (existingByAuthId) {
      const { data: updated, error: updateError } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", existingByAuthId)
        .select("id,name,company_name,phone,city,zip,contact_person")
        .single();
      if (updateError) return json({ error: updateError.message }, 500);
      return json({ ok: true, profile: updated });
    }

    const { data: byMailRows, error: byMailError } = await supabase
      .from("customers")
      .select("id,auth_user_id")
      .ilike("email", authEmail)
      .limit(10);
    if (byMailError) return json({ error: byMailError.message }, 500);

    const claimable = (byMailRows || []).find((row) => !row.auth_user_id);
    if (claimable?.id) {
      const { data: claimed, error: claimError } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", claimable.id)
        .select("id,name,company_name,phone,city,zip,contact_person")
        .single();
      if (claimError) return json({ error: claimError.message }, 500);
      return json({ ok: true, profile: claimed });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("customers")
      .insert({ ...payload, source: "customer_portal" })
      .select("id,name,company_name,phone,city,zip,contact_person")
      .single();
    if (insertError) return json({ error: insertError.message }, 500);
    return json({ ok: true, profile: inserted });
  } catch (err) {
    return json({ error: (err as Error).message || "Speichern fehlgeschlagen." }, 500);
  }
});

