import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await requireAdmin(req);
    const supabase = serviceClient();
    const { error } = await supabase.from("graph_tokens").delete().eq("admin_email", admin.email);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 401);
  }
});


