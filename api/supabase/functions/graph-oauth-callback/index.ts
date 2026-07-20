import { options } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/client.ts";
import { saveGraphTokens } from "../_shared/graph.ts";

function textResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "GET") return textResponse("Method not allowed", 405);

  try {
    const url = new URL(req.url);
    const code = String(url.searchParams.get("code") || "");
    const state = String(url.searchParams.get("state") || "");
    if (!code || !state) return textResponse("Ungültiger OAuth Callback", 400);

    const supabase = serviceClient();
    const { data: stateRows, error: stateErr } = await supabase
      .from("graph_oauth_states")
      .select("state,admin_email,expires_at")
      .eq("state", state)
      .limit(2);
    const stateRow = Array.isArray(stateRows) ? stateRows[0] : null;

    if (stateErr || !stateRow) return textResponse("State ungültig", 400);
    if (new Date(String(stateRow.expires_at)).getTime() < Date.now()) return textResponse("State abgelaufen", 400);

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
      return textResponse(`Tokenaustausch fehlgeschlagen: ${out?.error_description || "unbekannt"}`, 500);
    }

    await saveGraphTokens(String(stateRow.admin_email), out.access_token, out.refresh_token, Number(out.expires_in || 3600));
    await supabase.from("graph_oauth_states").delete().eq("state", state);

    return textResponse("Outlook erfolgreich verbunden. Dieses Fenster kann geschlossen werden.", 200);
  } catch (err) {
    return textResponse(String((err as Error).message || "Callback Fehler"), 500);
  }
});


