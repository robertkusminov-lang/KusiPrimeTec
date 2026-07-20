import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    await requireAdmin(req);
    const supabase = serviceClient();

    const [visitors, funnel, categories, plz] = await Promise.all([
      supabase.rpc("analytics_visitors_per_day"),
      supabase.rpc("analytics_funnel"),
      supabase.rpc("analytics_categories"),
      supabase.rpc("analytics_plz"),
    ]);

    return json({
      besucher_pro_tag: visitors.data || [],
      funnel: funnel.data || [],
      kategorien: categories.data || [],
      plz: plz.data || [],
    });
  } catch (err) {
    const message = String((err as Error)?.message || "Unbekannter Fehler");
    if (isAdminAccessErrorMessage(message)) return json({ error: message }, 403);
    if (isAuthErrorMessage(message)) return json({ error: message }, 401);
    return json({ error: message }, 500);
  }
});


