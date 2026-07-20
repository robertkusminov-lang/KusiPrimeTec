import { options } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/client.ts";
import { saveGraphTokens } from "../_shared/graph.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  try {
    const url = new URL(req.url);
    const code = String(url.searchParams.get("code") || "");
    const state = String(url.searchParams.get("state") || "");
    if (!code || !state) return new Response("Ungültiger OAuth Callback", { status: 400 });

    const supabase = serviceClient();
    const { data: stateRow, error: stateErr } = await supabase
      .from("graph_oauth_states")
      .select("state,admin_email,expires_at")
      .eq("state", state)
      .maybeSingle();

    if (stateErr || !stateRow) return new Response("State ungültig", { status: 400 });
    if (new Date(String(stateRow.expires_at)).getTime() < Date.now()) return new Response("State abgelaufen", { status: 400 });

    const tenant = Deno.env.get("GRAPH_TENANT_ID") || "common";
    const clientId = Deno.env.get("GRAPH_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("GRAPH_CLIENT_SECRET") || "";
    const redirect = Deno.env.get("GRAPH_REDIRECT_URI") || "";

    const form = new URLSearchParams();
    form.set("client_id", clientId);
    form.set("client_secret", clientSecret);
    form.set("grant_type", "authorization_code");
    form.set("code", code);
    form.set("redirect_uri", redirect);

    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const out = await res.json();
    if (!res.ok || !out?.access_token || !out?.refresh_token) {
      return new Response(`Tokenaustausch fehlgeschlagen: ${out?.error_description || "unbekannt"}`, { status: 500 });
    }

    await saveGraphTokens(String(stateRow.admin_email), out.access_token, out.refresh_token, Number(out.expires_in || 3600));
    await supabase.from("graph_oauth_states").delete().eq("state", state);

    return new Response("Outlook erfolgreich verbunden. Dieses Fenster kann geschlossen werden.", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    return new Response(String((err as Error).message || "Callback Fehler"), { status: 500 });
  }
});


