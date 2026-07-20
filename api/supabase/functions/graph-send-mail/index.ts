import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { getValidGraphAccessToken } from "../_shared/graph.ts";
import { sendSmtpMail, smtpConfigured } from "../_shared/smtp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await requireAdmin(req);
    const body = await req.json();
    const to = String(body.to || "").trim();
    const subject = String(body.subject || "").trim();
    const content = String(body.content || "").trim();
    if (!to || !subject || !content) return json({ error: "to, subject und content sind erforderlich." }, 400);

    if (smtpConfigured()) {
      await sendSmtpMail({
        to,
        subject,
        text: content,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#0f172a;">${content
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replace(/\r?\n/g, "<br />")}</div>`,
      });
      return json({ ok: true });
    }

    const token = await getValidGraphAccessToken(admin.email);
    const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: "Text",
            content,
          },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      const details = errText || "Leerer Fehlertext von Microsoft Graph.";
      return json(
        {
          error: `Graph sendMail fehlgeschlagen (HTTP ${res.status}): ${details}`,
          status: res.status,
        },
        500
      );
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 401);
  }
});


