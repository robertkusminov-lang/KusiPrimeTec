import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await requireAdmin(req);
    const supabase = serviceClient();
    const { data, error } = await supabase
      .from("graph_tokens")
      .select("expires_at")
      .eq("admin_email", admin.email)
      .limit(2);
    const tokenRow = Array.isArray(data) ? data[0] : null;

    if (error) return json({ error: error.message }, 500);
    const expiresAt = String(tokenRow?.expires_at || "").trim() || null;
    return json({
      connected: Boolean(tokenRow),
      expires_at: expiresAt,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 401);
  }
});
