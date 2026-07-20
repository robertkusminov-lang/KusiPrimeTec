import { json, options } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/client.ts";

const BOOKING_MIN_DATE = "2026-04-01";

function extractMissingColumn(message: string, table: string): string | null {
  const patterns = [
    new RegExp(`column\\s+${table}\\.(\\w+)\\s+does not exist`, "i"),
    new RegExp(`could not find the '([\\w_]+)' column of '${table}' in the schema cache`, "i"),
  ];
  for (const re of patterns) {
    const match = re.exec(message || "");
    if (match?.[1]) return match[1];
  }
  return null;
}

function isMissingTable(message: string, table: string): boolean {
  const msg = String(message || "").toLowerCase();
  const name = table.toLowerCase();
  return msg.includes(`could not find the table 'public.${name}'`) || (msg.includes("schema cache") && msg.includes(name));
}

function normalizeDate(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = serviceClient();
    let columns = [
      "terminwunsch",
      "desired_date",
      "appointment_date",
      "scheduled_date",
      "scheduled_at",
      "status",
      "created_at",
    ];
    let canOrderByCreated = true;

    let query = supabase.from("tickets").select(columns.join(",")).limit(10000);
    if (canOrderByCreated && columns.includes("created_at")) {
      query = query.order("created_at", { ascending: false });
    }
    let result = await query;

    for (let i = 0; i < 24 && result.error; i += 1) {
      const message = result.error.message || "";
      if (isMissingTable(message, "tickets")) {
        return json({ min_date: BOOKING_MIN_DATE, unavailable_dates: [] });
      }

      const missing = extractMissingColumn(message, "tickets");
      if (!missing) break;
      const nextColumns = columns.filter((col) => col !== missing);
      if (!nextColumns.length || nextColumns.length === columns.length) break;
      columns = nextColumns;
      if (missing === "created_at") canOrderByCreated = false;

      let nextQuery = supabase.from("tickets").select(columns.join(",")).limit(10000);
      if (canOrderByCreated && columns.includes("created_at")) {
        nextQuery = nextQuery.order("created_at", { ascending: false });
      }
      result = await nextQuery;
    }

    if (result.error) return json({ error: result.error.message }, 500);

    const rows = (result.data || []) as Record<string, unknown>[];
    const blocked = new Set<string>();
    for (const row of rows) {
      const status = String(row.status || "").trim().toLowerCase();
      if (status === "storniert" || status === "cancelled") continue;

      const candidates = [
        row.terminwunsch,
        row.desired_date,
        row.appointment_date,
        row.scheduled_date,
        row.scheduled_at,
      ];

      for (const candidate of candidates) {
        const normalized = normalizeDate(candidate);
        if (!normalized) continue;
        if (normalized < BOOKING_MIN_DATE) continue;
        blocked.add(normalized);
        break;
      }
    }

    return json({
      min_date: BOOKING_MIN_DATE,
      unavailable_dates: [...blocked].sort((a, b) => a.localeCompare(b)),
    });
  } catch (err) {
    return json({ error: String((err as Error)?.message || "Unbekannter Fehler") }, 500);
  }
});

