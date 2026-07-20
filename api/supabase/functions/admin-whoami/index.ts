import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

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
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await requireAdmin(req);
    return json({ ok: true, email: admin.email });
  } catch (err) {
    const message = String((err as Error)?.message || "Unbekannter Fehler");
    if (isAdminAccessErrorMessage(message)) return json({ error: message }, 403);
    if (isAuthErrorMessage(message)) return json({ error: message }, 401);
    return json({ error: message }, 500);
  }
});
