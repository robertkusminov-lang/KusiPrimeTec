import { serviceClient } from "./client.ts";

function isMissingTable(message: string, table: string): boolean {
  const msg = String(message || "").toLowerCase();
  const name = table.toLowerCase();
  return (
    msg.includes(`could not find the table 'public.${name}'`) ||
    (msg.includes("schema cache") && msg.includes(name))
  );
}

function isMissingColumn(message: string, table: string, column: string): boolean {
  const msg = String(message || "").toLowerCase();
  const tableName = table.toLowerCase();
  const columnName = column.toLowerCase();
  return (
    msg.includes(`column ${tableName}.${columnName} does not exist`) ||
    msg.includes(`could not find the '${columnName}' column of '${tableName}' in the schema cache`)
  );
}

async function isAdminByTable(
  email: string,
  tableName: "admin_users" | "allowed_admins"
): Promise<boolean> {
  const supabase = serviceClient();
  let withIsActive = true;

  for (let i = 0; i < 3; i += 1) {
    let query = supabase.from(tableName).select(withIsActive ? "email,is_active" : "email").eq("email", email).limit(2);
    if (withIsActive) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      if (!rows.length) return false;
      if (!withIsActive) return true;
      return rows.some((row) => (row as Record<string, unknown>).is_active !== false);
    }

    const message = String(error.message || "");
    if (isMissingTable(message, tableName)) return false;
    if (withIsActive && isMissingColumn(message, tableName, "is_active")) {
      withIsActive = false;
      continue;
    }
    throw new Error(message || "Admin-Pruefung fehlgeschlagen.");
  }

  return false;
}

export async function requireAdmin(req: Request): Promise<{ email: string; userId: string; token: string }> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Nicht autorisiert.");

  const supabase = serviceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) {
    throw new Error("Ungueltige Session.");
  }

  const email = String(data.user.email || "").trim().toLowerCase();
  const isAdminUsers = await isAdminByTable(email, "admin_users");
  const isAllowedAdmins = await isAdminByTable(email, "allowed_admins");
  if (!isAdminUsers && !isAllowedAdmins) {
    throw new Error("Kein Admin-Zugriff.");
  }

  return { email, userId: data.user.id, token };
}

export async function requireCustomer(req: Request): Promise<{ email: string; userId: string; token: string }> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Nicht autorisiert.");

  const supabase = serviceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw new Error("Ungueltige Session.");
  }

  return {
    email: String(data.user.email || "").trim().toLowerCase(),
    userId: data.user.id,
    token,
  };
}
