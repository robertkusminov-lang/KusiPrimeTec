import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusChip } from "@/components/ui/StatusChip";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import {
  ackAgentMessage,
  adminDashboard,
  adminTickets,
  UpdateTicketPayload,
  updateTicket,
} from "@/features/apiClient";
import { DashboardResponse, Ticket, TicketStatus, TICKET_STATUSES } from "@/types/domain";
import { SESSION_EXPIRED_MESSAGE, toUserMessage } from "@/lib/errors";
import { dateTime, formatTicketNumber, formatTimeRange } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const STATUS_VALUES: TicketStatus[] = [...TICKET_STATUSES];

const EMPTY_DASHBOARD: DashboardResponse = {
  kpis: {
    neue_tickets: 0,
    offene_tickets: 0,
    termine_7_tage: 0,
    avg_bestaetigung_stunden: 0,
    avg_termin_stunden: 0,
    inbox_neu: 0,
    hoch_notfall: 0,
    ohne_termin: 0,
    heute_faellig: 0,
    objektbetreuung_anfragen: 0,
  },
  trends: {
    neue_tickets: { delta_percent: 0, compare_value: 0 },
    offene_tickets: { delta_percent: 0, compare_value: 0 },
    termine_7_tage: { delta_percent: 0, compare_value: 0 },
  },
  tickets: [],
  activities: [],
  agent_messages: [],
  tickets_pro_tag_30: [],
  funnel_preview: [],
  inquiry_summary: {
    total_open: 0,
    follow_up_due: 0,
    latest_requested_at: null,
  },
};

function urgencyTone(ticket: Ticket): string {
  const urgency = String(ticket.dringlichkeit || "").toLowerCase();
  if (urgency === "kritisch" || urgency === "notfall") return "border-rose-300/55 bg-rose-400/15 text-rose-100";
  if (urgency === "hoch") return "border-amber-300/55 bg-amber-400/15 text-amber-100";
  return "border-slate-600/65 bg-slate-700/45 text-slate-200";
}

function isUrgent(ticket: Ticket): boolean {
  const urgency = String(ticket.dringlichkeit || "").toLowerCase();
  return urgency === "hoch" || urgency === "kritisch" || urgency === "notfall";
}

function eur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value || 0);
}

function formatCompare(value: number, isMoney = false): string {
  return isMoney ? `Vorperiode ${eur(value)}` : `Vorperiode ${value}`;
}

function isQuarterHour(value: string): boolean {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return false;
  return mm % 30 === 0;
}

function appointmentText(ticket: Ticket): string {
  const date = ticket.terminwunsch || "-";
  const timeRange = formatTimeRange(ticket.zeitfenster_von, ticket.zeitfenster_bis);
  if (timeRange !== "-") return `${date} ${timeRange}`;
  return date;
}

export default function AdminDashboardPage() {
  const outlet = useOutletContext<{ token?: string } | undefined>();
  const token = outlet?.token ?? "";
  const navigate = useNavigate();

  const [dashboard, setDashboard] = React.useState<DashboardResponse>(EMPTY_DASHBOARD);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [activeTickets, setActiveTickets] = React.useState<{ items: Ticket[]; total: number; page_count: number } | null>(null);
  const [activeLoading, setActiveLoading] = React.useState(true);
  const [activeError, setActiveError] = React.useState("");
  const [ticketQ, setTicketQ] = React.useState("");
  const debouncedTicketQ = useDebouncedValue(ticketQ, 360);
  const [ticketPage, setTicketPage] = React.useState(1);
  const [ticketSort, setTicketSort] = React.useState("due_asc");

  const [pendingMap, setPendingMap] = React.useState<Record<string, boolean>>({});
  const [toast, setToast] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  React.useEffect(() => {
    if (!token) {
      setError(SESSION_EXPIRED_MESSAGE);
      setLoading(false);
      setActiveLoading(false);
      return;
    }

    let stop = false;
    setLoading(true);
    adminDashboard(token)
      .then((res) => {
        if (stop) return;
        setDashboard(res);
        setLoading(false);
      })
      .catch((err) => {
        if (stop) return;
        setError(toUserMessage(err, "Dashboard konnte nicht geladen werden."));
        setLoading(false);
      });

    return () => {
      stop = true;
    };
  }, [token]);

  React.useEffect(() => {
    if (!token) return;
    let stop = false;
    setActiveLoading(true);
    adminTickets(token, {
      q: debouncedTicketQ,
      bucket: "active",
      sort: ticketSort,
      page: String(ticketPage),
      page_size: "10",
      hydrate_customers: "0",
    })
      .then((res) => {
        if (stop) return;
        setActiveTickets({ items: res.items, total: res.total, page_count: res.page_count });
        setActiveLoading(false);
      })
      .catch((err) => {
        if (stop) return;
        setActiveError(toUserMessage(err, "Aktive Tickets konnten nicht geladen werden."));
        setActiveLoading(false);
      });
    return () => {
      stop = true;
    };
  }, [token, debouncedTicketQ, ticketSort, ticketPage]);

  const openTickets = dashboard.tickets.filter((ticket) => ticket.status !== "Rapport_erstellt" && ticket.status !== "Storniert");
  const dueToday = openTickets.filter((ticket) => {
    if (!ticket.terminwunsch) return false;
    const due = new Date(ticket.terminwunsch);
    const now = new Date();
    return (
      due.getFullYear() === now.getFullYear() &&
      due.getMonth() === now.getMonth() &&
      due.getDate() === now.getDate()
    );
  });

  const upcoming = [...openTickets]
    .filter((ticket) => Boolean(ticket.terminwunsch))
    .sort((a, b) => new Date(a.terminwunsch || "").getTime() - new Date(b.terminwunsch || "").getTime())
    .slice(0, 4);

  function goTickets(params: Record<string, string>, route: "tickets" | "inbox" = "tickets") {
    const query = new URLSearchParams(params).toString();
    navigate(`/admin/${route}${query ? `?${query}` : ""}`);
  }

  function patchLocalTicket(ticketId: string, patch: Partial<Ticket>) {
    setActiveTickets((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((ticket) => (ticket.id === ticketId ? { ...ticket, ...patch } : ticket)),
      };
    });
    setDashboard((prev) => ({
      ...prev,
      tickets: prev.tickets.map((ticket) => (ticket.id === ticketId ? { ...ticket, ...patch } : ticket)),
    }));
  }

  async function quickSave(ticket: Ticket, patch: UpdateTicketPayload, success: string) {
    const rollback = { ...ticket };
    patchLocalTicket(ticket.id, patch);
    setPendingMap((prev) => ({ ...prev, [ticket.id]: true }));
    try {
      await updateTicket(token, ticket.id, patch);
      setToast({ kind: "ok", text: success });
    } catch (err) {
      patchLocalTicket(ticket.id, rollback);
      setToast({ kind: "error", text: toUserMessage(err, "Speichern fehlgeschlagen.") });
    } finally {
      setPendingMap((prev) => ({ ...prev, [ticket.id]: false }));
    }
  }

  async function handleQuickStatus(ticket: Ticket) {
    const input = window.prompt(
      "Neuen Status eingeben:\n" + STATUS_VALUES.join(", "),
      ticket.status
    );
    if (!input) return;
    if (!STATUS_VALUES.includes(input as TicketStatus)) {
      setToast({ kind: "error", text: "Ungültiger Statuswert." });
      return;
    }
    await quickSave(ticket, { status: input as TicketStatus }, "Status aktualisiert.");
  }

  async function handleQuickDate(ticket: Ticket) {
    const dateInput = window.prompt("Termin-Datum im Format JJJJ-MM-TT eingeben:", ticket.terminwunsch || "");
    if (!dateInput) return;
    const date = dateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setToast({ kind: "error", text: "Terminformat ungültig." });
      return;
    }

    const fromInput = window.prompt("Zeit von (HH:MM, 30-Minuten-Schritte):", String(ticket.zeitfenster_von || "09:00"));
    if (fromInput === null) return;
    const from = fromInput.trim();

    const toInput = window.prompt("Zeit bis (HH:MM, 30-Minuten-Schritte):", String(ticket.zeitfenster_bis || "10:00"));
    if (toInput === null) return;
    const to = toInput.trim();

    if (!isQuarterHour(from) || !isQuarterHour(to)) {
      setToast({ kind: "error", text: "Uhrzeiten müssen in 30-Minuten-Schritten sein." });
      return;
    }
    if (from >= to) {
      setToast({ kind: "error", text: "Bitte ein gültiges Zeitfenster wählen (von < bis)." });
      return;
    }

    await quickSave(ticket, { terminwunsch: date, zeitfenster_von: from, zeitfenster_bis: to }, "Termin gesetzt.");
  }

  async function handleAgentMessageOk(messageId: string) {
    const runId = String(messageId || "").trim();
    if (!runId) return;
    try {
      await ackAgentMessage(token, runId);
      setDashboard((prev) => ({
        ...prev,
        agent_messages: prev.agent_messages.filter((msg) => msg.id !== runId),
      }));
      setToast({ kind: "ok", text: "Agent-Nachricht bestätigt." });
    } catch (err) {
      setToast({ kind: "error", text: toUserMessage(err, "Nachricht konnte nicht bestätigt werden.") });
    }
  }

  return (
    <div className="page-enter space-y-4">
      <SectionTitle title="Dashboard" subtitle="Operatives Leitstand-Panel" />

      {toast ? <Toast kind={toast.kind} text={toast.text} /> : null}

      {error ? <Toast kind="error" text={error} /> : null}
      {error === SESSION_EXPIRED_MESSAGE ? (
        <div className="pt-1">
          <Button variant="secondary" className="px-3 py-1 text-sm" onClick={() => navigate("/admin/login")}>
            Erneut anmelden
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          <LoadingSpinner label="Dashboard wird geladen..." className="py-1" />
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <KpiCard
              label="Neue Tickets (7 Tage)"
              value={String(dashboard.kpis.neue_tickets)}
              trendPercent={dashboard.trends.neue_tickets.delta_percent}
              compareText={formatCompare(dashboard.trends.neue_tickets.compare_value)}
              hint="inkl. neue Eingänge"
              bright
              onClick={() => goTickets({}, "inbox")}
            />
            <KpiCard
              label="Offene Tickets"
              value={String(dashboard.kpis.offene_tickets)}
              trendPercent={dashboard.trends.offene_tickets.delta_percent}
              compareText={formatCompare(dashboard.trends.offene_tickets.compare_value)}
              hint="alle aktiven Vorgänge"
              bright
              onClick={() => goTickets({})}
            />
            <KpiCard
              label="Termine (7 Tage)"
              value={String(dashboard.kpis.termine_7_tage)}
              trendPercent={dashboard.trends.termine_7_tage.delta_percent}
              compareText={formatCompare(dashboard.trends.termine_7_tage.compare_value)}
              hint="anstehende Einsätze"
              bright
              onClick={() => goTickets({ sort: "due_asc" })}
            />
            <KpiCard
              label="ObjektBetreuung-Anfragen"
              value={String(dashboard.kpis.objektbetreuung_anfragen)}
              hint="offene Interessentenfälle"
              bright
              onClick={() => navigate("/admin/interessenten")}
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
            <GlassCard className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">ObjektBetreuung-Anfragen</h2>
                  <p className="text-xs text-[var(--text-soft)]">Interessenten, Wiedervorlagen und letzte Anfrage</p>
                </div>
                <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => navigate("/admin/interessenten")}>
                  Öffnen
                </Button>
              </div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                <div className="rounded-xl border border-[var(--line)] bg-slate-950/35 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Offen</p>
                  <p className="mt-2 text-2xl font-bold text-white">{dashboard.inquiry_summary.total_open}</p>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-slate-950/35 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Wiedervorlage fällig</p>
                  <p className="mt-2 text-2xl font-bold text-white">{dashboard.inquiry_summary.follow_up_due}</p>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-slate-950/35 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Letzte Anfrage</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {dashboard.inquiry_summary.latest_requested_at ? dateTime(dashboard.inquiry_summary.latest_requested_at) : "-"}
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Agent-Nachrichten</h2>
                <span className="text-xs text-[var(--text-soft)]">Neue Hinweise aus der Verarbeitung</span>
              </div>
              <div className="space-y-2">
                {dashboard.agent_messages.slice(0, 12).map((msg) => (
                  <div key={msg.id} className="rounded-xl border border-[var(--line)] bg-slate-950/35 px-3 py-2">
                    <p className="text-sm text-white">{msg.message}</p>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-soft)]">
                      <span>
                        {msg.intent} · Risiko {msg.risk_level} · {dateTime(msg.created_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        {msg.ticket_id ? (
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-[11px]"
                            onClick={() => navigate(`/admin/tickets/${msg.ticket_id}`)}
                          >
                            Ticket
                          </Button>
                        ) : null}
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-[11px]"
                          onClick={() => {
                            void handleAgentMessageOk(msg.id);
                          }}
                        >
                          OK
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {!dashboard.agent_messages.length ? (
                  <p className="text-sm text-[var(--text-soft)]">Keine neuen Agent-Nachrichten vorhanden.</p>
                ) : null}
              </div>
            </GlassCard>
          </div>

        </>
      )}

      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-white">Aktive Tickets</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="premium-input w-full px-3 py-2 text-sm sm:w-64"
              placeholder="Suche Ticket, Kunde, Ort"
              value={ticketQ}
              onChange={(event) => {
                setTicketQ(event.target.value);
                setTicketPage(1);
              }}
            />
            <select
              className="premium-input px-3 py-2 text-sm"
              value={ticketSort}
              onChange={(event) => {
                setTicketSort(event.target.value);
                setTicketPage(1);
              }}
            >
              <option value="due_asc">Termin als nächstes</option>
              <option value="created_desc">Neueste zuerst</option>
              <option value="priority_desc">Dringlichkeit zuerst</option>
            </select>
          </div>
        </div>

        {activeError ? <Toast kind="error" text={activeError} className="mt-2" /> : null}

        {activeLoading ? (
          <div className="mt-3 space-y-2">
            <LoadingSpinner label="Aktive Tickets werden geladen..." />
            <div className="grid gap-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {(activeTickets?.items || []).map((ticket) => (
              <div
                key={ticket.id}
                role="button"
                tabIndex={0}
                className="group w-full rounded-xl border border-[var(--line)] bg-slate-950/35 px-3 py-3 text-left transition-all duration-180 hover:-translate-y-[1px] hover:border-electric-300/45 hover:bg-slate-900/55"
                onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/admin/tickets/${ticket.id}`);
                  }
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{formatTicketNumber(ticket.ticket_nummer)}</p>
                      <StatusChip status={ticket.status} />
                      {isUrgent(ticket) ? (
                        <span className={`rounded-full border px-2 py-1 text-[11px] ${urgencyTone(ticket)}`}>
                          {ticket.dringlichkeit}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-[var(--text-soft)]">
                      {ticket.kategorie} · {ticket.plz} {ticket.ort}
                    </p>
                    <p className="text-xs text-[var(--text-soft)]">
                      Erstellt: {dateTime(ticket.created_at)} · Termin: {appointmentText(ticket)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 opacity-100 transition-opacity duration-180 md:opacity-0 md:group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      disabled={Boolean(pendingMap[ticket.id])}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleQuickStatus(ticket);
                      }}
                    >
                      Status ändern
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      disabled={Boolean(pendingMap[ticket.id])}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleQuickDate(ticket);
                      }}
                    >
                      Termin setzen
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/admin/tickets/${ticket.id}`);
                      }}
                    >
                      Öffnen
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        window.location.href = `mailto:${ticket.kunde_email}?subject=${encodeURIComponent(`Ticket ${formatTicketNumber(ticket.ticket_nummer)}`)}`;
                      }}
                    >
                      Mail senden
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!activeTickets?.items.length ? (
              <p className="rounded-xl border border-[var(--line)] bg-slate-950/35 px-3 py-4 text-sm text-[var(--text-soft)]">
                Keine aktiven Tickets für diese Filter gefunden.
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-sm text-[var(--text-soft)]">
          <p>Gesamt aktiv: {activeTickets?.total || 0}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary-premium rounded-full px-3 py-1"
              disabled={ticketPage <= 1}
              onClick={() => setTicketPage((value) => value - 1)}
            >
              Zurück
            </button>
            <span>Seite {ticketPage} / {activeTickets?.page_count || 1}</span>
            <button
              type="button"
              className="btn-secondary-premium rounded-full px-3 py-1"
              disabled={ticketPage >= (activeTickets?.page_count || 1)}
              onClick={() => setTicketPage((value) => value + 1)}
            >
              Weiter
            </button>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <h2 className="text-base font-semibold text-white">Heute / Nächste Termine</h2>
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-soft)]">Heute fällig</p>
            <div className="mt-2 space-y-2">
              {dueToday.slice(0, 3).map((ticket) => (
                <button
                  key={`due-${ticket.id}`}
                  type="button"
                  className="w-full rounded-xl border border-[var(--line)] bg-slate-950/35 px-3 py-2 text-left transition-all duration-180 hover:border-electric-300/45 hover:bg-slate-900/55"
                  onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                >
                  <p className="text-sm font-semibold text-white">{formatTicketNumber(ticket.ticket_nummer)}</p>
                  <p className="text-xs text-[var(--text-soft)]">
                    {ticket.customer_display_name || ticket.invoice_recipient_name || ticket.kunde_firma || ticket.kunde_name || "nicht angegeben"}
                  </p>
                </button>
              ))}
              {!dueToday.length ? <p className="text-xs text-[var(--text-soft)]">Keine Tickets heute fällig.</p> : null}
            </div>
          </div>
          <div className="border-t border-[var(--line)] pt-3">
            <p className="text-xs uppercase tracking-wide text-[var(--text-soft)]">Nächste Termine</p>
            <div className="mt-2 space-y-2">
              {upcoming.map((ticket) => (
                <button
                  key={`upcoming-${ticket.id}`}
                  type="button"
                  className="w-full rounded-xl border border-[var(--line)] bg-slate-950/35 px-3 py-2 text-left transition-all duration-180 hover:border-electric-300/45 hover:bg-slate-900/55"
                  onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                >
                  <p className="text-sm font-semibold text-white">{formatTicketNumber(ticket.ticket_nummer)}</p>
                  <p className="text-xs text-[var(--text-soft)]">{appointmentText(ticket)}</p>
                </button>
              ))}
              {!upcoming.length ? <p className="text-xs text-[var(--text-soft)]">Keine geplanten Termine vorhanden.</p> : null}
            </div>
          </div>
        </div>
      </GlassCard>

    </div>
  );
}
