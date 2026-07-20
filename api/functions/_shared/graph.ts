import { serviceClient } from "./client.ts";
import { decryptText, encryptText } from "./crypto.ts";

export async function saveGraphTokens(email: string, accessToken: string, refreshToken: string, expiresIn: number) {
  const secret = Deno.env.get("GRAPH_TOKEN_SECRET") || "";
  if (!secret) throw new Error("GRAPH_TOKEN_SECRET fehlt.");
  const access = await encryptText(accessToken, secret);
  const refresh = await encryptText(refreshToken, secret);

  const supabase = serviceClient();
  const { error } = await supabase.from("graph_tokens").upsert({
    admin_email: email,
    access_cipher: access.cipher,
    access_iv: access.iv,
    refresh_cipher: refresh.cipher,
    refresh_iv: refresh.iv,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function decryptRow(row: Record<string, string>) {
  const secret = Deno.env.get("GRAPH_TOKEN_SECRET") || "";
  if (!secret) throw new Error("GRAPH_TOKEN_SECRET fehlt.");
  return {
    access: await decryptText(row.access_cipher, row.access_iv, secret),
    refresh: await decryptText(row.refresh_cipher, row.refresh_iv, secret),
  };
}

export async function getValidGraphAccessToken(email: string): Promise<string> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("graph_tokens")
    .select("admin_email,access_cipher,access_iv,refresh_cipher,refresh_iv,expires_at")
    .eq("admin_email", email)
    .maybeSingle();
  if (error || !data) throw new Error("Outlook nicht verbunden.");

  const tokens = await decryptRow(data as Record<string, string>);
  const expMs = new Date(String(data.expires_at || "")).getTime();
  if (Number.isFinite(expMs) && expMs > Date.now() + 60 * 1000) {
    return tokens.access;
  }

  const tenant = Deno.env.get("GRAPH_TENANT_ID") || "common";
  const clientId = Deno.env.get("GRAPH_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GRAPH_CLIENT_SECRET") || "";
  if (!clientId || !clientSecret) throw new Error("Graph Client-Konfiguration fehlt.");

  const form = new URLSearchParams();
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("grant_type", "refresh_token");
  form.set("refresh_token", tokens.refresh);
  form.set("scope", "offline_access Mail.Send Calendars.ReadWrite");

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const out = await res.json();
  if (!res.ok || !out?.access_token) throw new Error(out?.error_description || "Token Refresh fehlgeschlagen.");

  await saveGraphTokens(email, out.access_token, out.refresh_token || tokens.refresh, Number(out.expires_in || 3600));
  return out.access_token;
}


