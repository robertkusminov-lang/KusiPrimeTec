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

function parseHm(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseWindow(value: unknown): { from: string | null; to: string | null } {
  const raw = String(value || "").trim();
  if (!raw) return { from: null, to: null };
  const matches = raw.match(/\d{1,2}:\d{2}(?::\d{2})?/g);
  if (matches && matches.length >= 2) {
    return { from: parseHm(matches[0]), to: parseHm(matches[1]) };
  }
  const parts = raw.split(/\s*(?:-|–|—|bis|to)\s*/i).filter(Boolean);
  if (parts.length >= 2) {
    return { from: parseHm(parts[0]), to: parseHm(parts[1]) };
  }
  return { from: null, to: null };
}

function resolveRange(row: Record<string, unknown>): { from: string; to: string } | null {
  const parsed1 = parseWindow(row.desired_time_window);
  const parsed2 = parseWindow(row.zeitfenster);
  const parsed3 = parseWindow(row.window);
  const from =
    parseHm(row.zeitfenster_von) ||
    parseHm(row.time_from) ||
    parseHm(row.window_from) ||
    parsed1.from ||
    parsed2.from ||
    parsed3.from;
  const to =
    parseHm(row.zeitfenster_bis) ||
    parseHm(row.time_to) ||
    parseHm(row.window_to) ||
    parsed1.to ||
    parsed2.to ||
    parsed3.to;
  if (!from || !to || from >= to) return null;
  return { from, to };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = serviceClient();
    let columns = [
      "id",
      "terminwunsch",
      "desired_date",
      "appointment_date",
      "scheduled_date",
      "scheduled_at",
      "zeitfenster_von",
      "zeitfenster_bis",
      "time_from",
      "time_to",
      "window_from",
      "window_to",
      "desired_time_window",
      "zeitfenster",
      "window",
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
        return json({ min_date: BOOKING_MIN_DATE, unavailable_dates: [], booked_ranges: [] });
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
    const booked = new Set<string>();
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

      let date: string | null = null;
      for (const candidate of candidates) {
        const normalized = normalizeDate(candidate);
        if (!normalized) continue;
        if (normalized < BOOKING_MIN_DATE) continue;
        date = normalized;
        break;
      }
      if (!date) continue;

      const range = resolveRange(row);
      if (!range) continue;
      booked.add(`${date}|${range.from}|${range.to}`);
    }

    const bookedRanges = [...booked]
      .map((value) => {
        const [date, from, to] = value.split("|");
        return { date, from, to };
      })
      .sort((a, b) =>
        a.date.localeCompare(b.date) ||
        a.from.localeCompare(b.from) ||
        a.to.localeCompare(b.to)
      );

    return json({
      min_date: BOOKING_MIN_DATE,
      unavailable_dates: [],
      booked_ranges: bookedRanges,
    });
  } catch (err) {
    return json({ error: String((err as Error)?.message || "Unbekannter Fehler") }, 500);
  }
});
