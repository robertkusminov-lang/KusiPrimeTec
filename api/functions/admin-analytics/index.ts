import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";

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
    return json({ error: (err as Error).message }, 401);
  }
});


