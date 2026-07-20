import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await requireAdmin(req);
    const clientId = Deno.env.get("GRAPH_CLIENT_ID") || "";
    const tenant = Deno.env.get("GRAPH_TENANT_ID") || "common";
    const redirect = Deno.env.get("GRAPH_REDIRECT_URI") || "";
    if (!clientId || !redirect) return json({ error: "Graph-Konfiguration fehlt." }, 500);

    const state = crypto.randomUUID();
    const supabase = serviceClient();
    await supabase.from("graph_oauth_states").insert({
      state,
      admin_email: admin.email,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    const qs = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirect,
      response_mode: "query",
      scope: "offline_access Mail.Send Calendars.ReadWrite",
      state,
    });

    return json({ auth_url: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${qs.toString()}` });
  } catch (err) {
    return json({ error: (err as Error).message }, 401);
  }
});


