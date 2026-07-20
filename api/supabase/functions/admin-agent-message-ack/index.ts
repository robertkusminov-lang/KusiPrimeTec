import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";

function isMissingTable(message: string, table: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes(`could not find the table 'public.${table.toLowerCase()}'`) || (msg.includes("schema cache") && msg.includes(table.toLowerCase()));
}

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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const runId = String((body as { run_id?: unknown }).run_id || "").trim();
    if (!runId) return json({ error: "run_id fehlt." }, 400);

    const supabase = serviceClient();
    const { error } = await supabase
      .from("ops_agent_message_acks")
      .upsert(
        {
          run_id: runId,
          admin_email: admin.email,
          acknowledged_at: new Date().toISOString(),
        },
        { onConflict: "run_id,admin_email" }
      );

    if (error) {
      if (isMissingTable(error.message || "", "ops_agent_message_acks")) {
        return json({ error: "Nachrichten-Ack-Tabelle fehlt. Bitte Migration ausfuehren." }, 500);
      }
      return json({ error: error.message }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    const message = String((err as Error)?.message || "Unbekannter Fehler");
    if (isAdminAccessErrorMessage(message)) return json({ error: message }, 403);
    if (isAuthErrorMessage(message)) return json({ error: message }, 401);
    return json({ error: message }, 500);
  }
});
