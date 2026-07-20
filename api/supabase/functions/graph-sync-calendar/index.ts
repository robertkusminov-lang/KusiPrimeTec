import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { getValidGraphAccessToken } from "../_shared/graph.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await requireAdmin(req);
    const body = await req.json();
    const subject = String(body.subject || "Einsatztermin");
    const startIso = String(body.start_iso || "");
    const endIso = String(body.end_iso || "");

    if (!startIso || !endIso) return json({ error: "start_iso und end_iso sind erforderlich." }, 400);

    const token = await getValidGraphAccessToken(admin.email);
    const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        subject,
        start: { dateTime: startIso, timeZone: "Europe/Berlin" },
        end: { dateTime: endIso, timeZone: "Europe/Berlin" },
      }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: out?.error?.message || "Kalendersync fehlgeschlagen." }, 500);

    return json({ ok: true, event_id: out.id });
  } catch (err) {
    return json({ error: (err as Error).message }, 401);
  }
});


