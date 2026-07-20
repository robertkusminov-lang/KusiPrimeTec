import { json, options } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/client.ts";

type Row = Record<string, unknown>;
type TicketBucket = "inbox" | "active" | "archive";
type CacheEntry = { expiresAt: number; payload: unknown };

const DASHBOARD_CACHE_TTL_MS = 15_000;
const dashboardCache = new Map<string, CacheEntry>();

function getCachedPayload(key: string): unknown | null {
  const cached = dashboardCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    dashboardCache.delete(key);
    return null;
  }
  return cached.payload;
}

function setCachedPayload(key: string, payload: unknown): void {
  dashboardCache.set(key, {
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    payload,
  });
}

function toTs(value: unknown): number {
  const t = new Date(String(value || "")).getTime();
  return Number.isFinite(t) ? t : 0;
}

function hoursDiff(a: unknown, b: unknown): number {
  const da = toTs(a);
  const db = toTs(b);
  if (!da || !db || db < da) return 0;
  return (db - da) / 3600000;
}

function statusOf(value: unknown): string {
  return String(value || "Neu").trim();
}

function isOpenStatus(status: string): boolean {
  return status !== "Rapport_erstellt" && status !== "Storniert";
}

function isClosedInquiryStatus(status: string): boolean {
  const value = String(status || "").trim().toLowerCase();
  return value === "gewonnen" || value === "abgelehnt / nicht passend";
}

function bucketOf(row: Row): TicketBucket {
  const raw = String(row.bucket || "")
    .trim()
    .toLowerCase();
  if (raw === "inbox") return "inbox";
  if (raw === "archive" || raw === "archiv") return "archive";
  if (raw === "active" || raw === "aktiv") return "active";
  if (statusOf(row.status) === "Neu") return "inbox";
  return isOpenStatus(statusOf(row.status)) ? "active" : "archive";
}

function urgencyOf(value: unknown): string {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function trend(current: number, previous: number) {
  if (!current && !previous) return { delta_percent: 0, compare_value: 0 };
  if (!previous) return { delta_percent: 100, compare_value: 0 };
  return {
    delta_percent: Number((((current - previous) / previous) * 100).toFixed(1)),
    compare_value: previous,
  };
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rollingDays(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(dayKey(d.getTime()));
  }
  return out;
}

function series30(rows: Row[]) {
  const keys = rollingDays(30);
  const map = new Map<string, number>(keys.map((key) => [key, 0]));
  for (const row of rows) {
    const ts = toTs(row.created_at);
    if (!ts) continue;
    const key = dayKey(ts);
    if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
  }
  return keys.map((label) => ({ label, value: map.get(label) || 0 }));
}

function isMissingTicketEventsTable(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes("could not find the table 'public.ticket_events'") || (msg.includes("schema cache") && msg.includes("ticket_events"));
}

function isMissingTable(message: string, table: string): boolean {
  const msg = String(message || "").toLowerCase();
  const tableName = table.toLowerCase();
  return (
    msg.includes(`could not find the table 'public.${tableName}'`) ||
    (msg.includes("schema cache") && msg.includes(tableName))
  );
}

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

function asObject(value: unknown): Row {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Row;
  return {};
}

function mapAgentMessage(row: Row, index: number) {
  const id = String(row.id || `run-${index}`);
  const payload = asObject(row.output_payload);
  const intent = String(row.intent || payload.intent || "other");
  const riskRaw = String(row.risk_level || payload.risk_level || "low").toLowerCase();
  const riskLevel: "low" | "medium" | "high" =
    riskRaw === "high" || riskRaw === "medium" ? riskRaw : "low";
  const shortAssessment = String(payload.short_assessment || payload.reasoning_short || "").trim();
  const message =
    shortAssessment ||
    `Ops-Agent hat Vorgang verarbeitet (${intent}, Risiko ${riskLevel}).`;

  return {
    id,
    ticket_id: row.ticket_id ? String(row.ticket_id) : null,
    message,
    created_at: String(row.created_at || new Date(0).toISOString()),
    intent,
    risk_level: riskLevel,
    requires_approval: Boolean(row.requires_approval),
  };
}

function isAuthErrorMessage(message: string): boolean {
  const msg = String(message || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    msg.includes("nicht autorisiert") ||
    msg.includes("ungueltige session") ||
    msg.includes("ungultige session")
  );
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
    const supabase = serviceClient();
    const url = new URL(req.url);
    const view = String(url.searchParams.get("view") || "").trim();
    const cacheBypass = String(url.searchParams.get("no_cache") || "0") === "1";
    const cacheKey = `${admin.email}:${view || "default"}`;
    if (!cacheBypass) {
      const cachedPayload = getCachedPayload(cacheKey);
      if (cachedPayload) return json(cachedPayload);
    }

    const baseColumns = [
      "id",
      "customer_id",
      "ticket_nummer",
      "bucket",
      "status",
      "kategorie",
      "dringlichkeit",
      "titel",
      "kunde_name",
      "kunde_firma",
      "kunde_email",
      "kunde_telefon",
      "objekt_adresse",
      "plz",
      "ort",
      "created_at",
      "updated_at",
      "bestaetigt_at",
      "termin_geplant_at",
      "terminwunsch",
      "zeitfenster_von",
      "zeitfenster_bis",
    ];

    let workingColumns = [...baseColumns];
    let canOrderByCreated = true;
    let ticketResult = await supabase
      .from("tickets")
      .select(workingColumns.join(","))
      .order("created_at", { ascending: false })
      .limit(5000);

    for (let i = 0; i < 40 && ticketResult.error; i += 1) {
      const missing = extractMissingColumn(ticketResult.error.message || "", "tickets");
      if (!missing) break;

      const nextColumns = workingColumns.filter((col) => col !== missing);
      if (!nextColumns.length || nextColumns.length === workingColumns.length) break;
      workingColumns = nextColumns;

      if (missing === "created_at") canOrderByCreated = false;

      let query = supabase.from("tickets").select(workingColumns.join(",")).limit(5000);
      if (canOrderByCreated && workingColumns.includes("created_at")) {
        query = query.order("created_at", { ascending: false });
      } else {
        canOrderByCreated = false;
      }

      ticketResult = await query;
    }

    if (ticketResult.error) return json({ error: ticketResult.error.message }, 500);
    const rows = ((ticketResult.data || []) as Row[]);

    const ticketSeries = series30(rows);
    if (view === "series") {
      const payload = { tickets_pro_tag_30: ticketSeries };
      if (!cacheBypass) setCachedPayload(cacheKey, payload);
      return json(payload);
    }

    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;
    const weekAgo = now - 7 * dayMs;
    const prevWeekAgo = now - 14 * dayMs;
    const weekAhead = now + 7 * dayMs;
    const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();

    const inboxTickets = rows.filter((row) => bucketOf(row) === "inbox");
    const activeTickets = rows.filter((row) => bucketOf(row) === "active");
    const archiveTickets = rows.filter((row) => bucketOf(row) === "archive");
    const offeneTickets = activeTickets.filter((row) => isOpenStatus(statusOf(row.status)));
    const neue = rows.filter((row) => toTs(row.created_at) >= weekAgo).length;
    const neuePrev = rows.filter((row) => {
      const created = toTs(row.created_at);
      return created >= prevWeekAgo && created < weekAgo;
    }).length;
    const offene = offeneTickets.length;
    const offenePrev = activeTickets.filter((row) => {
      const created = toTs(row.created_at);
      return isOpenStatus(statusOf(row.status)) && created >= prevWeekAgo && created < weekAgo;
    }).length;
    const termine7 = activeTickets.filter((row) => {
      const t = toTs(row.terminwunsch);
      return t >= now && t <= weekAhead;
    }).length;
    const terminePrev = activeTickets.filter((row) => {
      const t = toTs(row.terminwunsch);
      return t >= weekAgo && t < now;
    }).length;
    const avgBestaetigung =
      rows.reduce((sum, row) => sum + hoursDiff(row.created_at, row.bestaetigt_at), 0) / Math.max(rows.length, 1);
    const avgTermin =
      rows.reduce((sum, row) => sum + hoursDiff(row.created_at, row.termin_geplant_at), 0) / Math.max(rows.length, 1);

    const inboxNeu = inboxTickets.length;
    const hochNotfall = offeneTickets.filter((row) => {
      const urgency = urgencyOf(row.dringlichkeit);
      return urgency === "hoch" || urgency === "kritisch" || urgency === "notfall";
    }).length;
    const ohneTermin = offeneTickets.filter((row) => !toTs(row.terminwunsch)).length;
    const heuteFaellig = offeneTickets.filter((row) => {
      const due = toTs(row.terminwunsch);
      return due >= todayStart && due < todayStart + dayMs;
    }).length;

    let inquiryRows: Row[] = [];
    const { data: inquiryData, error: inquiryError } = await supabase
      .from("objectbetreuung_inquiries")
      .select("id,status,follow_up_at,requested_at")
      .order("requested_at", { ascending: false })
      .limit(500);
    if (inquiryError && !isMissingTable(inquiryError.message, "objectbetreuung_inquiries")) {
      return json({ error: inquiryError.message }, 500);
    }
    if (!inquiryError && Array.isArray(inquiryData)) {
      inquiryRows = inquiryData as Row[];
    }

    const inquirySummary = {
      total_open: inquiryRows.filter((row) => !isClosedInquiryStatus(String(row.status || ""))).length,
      follow_up_due: inquiryRows.filter((row) => {
        const followUp = toTs(row.follow_up_at);
        return followUp > 0 && followUp <= now;
      }).length,
      latest_requested_at: inquiryRows.reduce<string | null>((latest, row) => {
        const current = String(row.requested_at || "").trim();
        if (!current) return latest;
        if (!latest) return current;
        return toTs(current) > toTs(latest) ? current : latest;
      }, null),
    };

    const { data: events, error: eventError } = await supabase
      .from("ticket_events")
      .select("id,event_typ,detail,actor,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (eventError && !isMissingTicketEventsTable(eventError.message)) {
      return json({ error: eventError.message }, 500);
    }

    const activities = (events || []).map((row, index) => ({
      id: String(row.id || `evt-${index}`),
      type: String(row.event_typ || "ticket_update"),
      message: String(row.detail || "Ticket aktualisiert"),
      actor: String(row.actor || "System"),
      created_at: String(row.created_at || new Date(0).toISOString()),
    }));

    let agentMessages: {
      id: string;
      ticket_id: string | null;
      message: string;
      created_at: string;
      intent: string;
      risk_level: "low" | "medium" | "high";
      requires_approval: boolean;
    }[] = [];

    const { data: runs, error: runsError } = await supabase
      .from("ops_agent_runs")
      .select("id,ticket_id,intent,risk_level,requires_approval,output_payload,created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    if (runsError && !isMissingTable(runsError.message, "ops_agent_runs")) {
      return json({ error: runsError.message }, 500);
    }
    if (!runsError && Array.isArray(runs)) {
      const runIds = runs.map((row) => String((row as Row).id || "")).filter(Boolean);
      const acked = new Set<string>();

      if (runIds.length) {
        const { data: acks, error: ackError } = await supabase
          .from("ops_agent_message_acks")
          .select("run_id")
          .eq("admin_email", admin.email)
          .in("run_id", runIds);

        if (ackError && !isMissingTable(ackError.message, "ops_agent_message_acks")) {
          return json({ error: ackError.message }, 500);
        }
        if (!ackError && Array.isArray(acks)) {
          for (const row of acks) {
            const runId = String((row as Row).run_id || "").trim();
            if (runId) acked.add(runId);
          }
        }
      }

      agentMessages = runs
        .map((row, index) => mapAgentMessage(row as Row, index))
        .filter((msg) => !acked.has(msg.id))
        .slice(0, 20);
    }

    const funnelPreview = [
      { label: "Inbox", value: inboxTickets.length },
      { label: "Aktiv", value: activeTickets.length },
      { label: "Archiv", value: archiveTickets.length },
      { label: "Rapport erstellt", value: rows.filter((row) => statusOf(row.status) === "Rapport_erstellt").length },
    ];

    const payload = {
      kpis: {
        neue_tickets: neue,
        offene_tickets: offene,
        termine_7_tage: termine7,
        avg_bestaetigung_stunden: Number(avgBestaetigung.toFixed(2)),
        avg_termin_stunden: Number(avgTermin.toFixed(2)),
        inbox_neu: inboxNeu,
        hoch_notfall: hochNotfall,
        ohne_termin: ohneTermin,
        heute_faellig: heuteFaellig,
        objektbetreuung_anfragen: inquirySummary.total_open,
      },
      trends: {
        neue_tickets: trend(neue, neuePrev),
        offene_tickets: trend(offene, offenePrev),
        termine_7_tage: trend(termine7, terminePrev),
      },
      tickets: offeneTickets.slice(0, 80),
      activities,
      agent_messages: agentMessages,
      tickets_pro_tag_30: ticketSeries,
      funnel_preview: funnelPreview,
      inquiry_summary: inquirySummary,
    };

    if (!cacheBypass) setCachedPayload(cacheKey, payload);
    return json(payload);
  } catch (err) {
    const message = String((err as Error)?.message || "Unbekannter Fehler");
    const status = isAdminAccessErrorMessage(message) ? 403 : isAuthErrorMessage(message) ? 401 : 500;
    return json({ error: message }, status);
  }
});

