import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RequestTypeBadge } from "@/components/ui/RequestTypeBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Toast } from "@/components/ui/Toast";
import { ackAgentMessage, adminDashboard, adminTickets } from "@/features/apiClient";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SESSION_EXPIRED_MESSAGE, toUserMessage } from "@/lib/errors";
import { dateTime, formatTicketNumber, formatTimeRange } from "@/lib/format";
import { DashboardResponse, Ticket } from "@/types/domain";

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

function customerName(ticket: Ticket): string {
  return (
    ticket.customer_display_name ||
    ticket.invoice_recipient_name ||
    ticket.kunde_firma ||
    ticket.kunde_name ||
    "Nicht angegeben"
  );
}

function objectLabel(ticket: Ticket): string {
  const address = ticket.objekt_adresse || [ticket.plz, ticket.ort].filter(Boolean).join(" ");
  return address || "Noch kein Objekt hinterlegt";
}

function urgencyLabel(ticket: Ticket): string {
  const urgency = String(ticket.dringlichkeit || "mittel").toLowerCase();
  if (urgency === "kritisch" || urgency === "notfall") return "Kritisch";
  if (urgency === "hoch") return "Hoch";
  if (urgency === "niedrig") return "Niedrig";
  return "Mittel";
}

function urgencyClass(ticket: Ticket): string {
  const urgency = String(ticket.dringlichkeit || "").toLowerCase();
  if (urgency === "kritisch" || urgency === "notfall") return "dashboard-urgency-critical";
  if (urgency === "hoch") return "dashboard-urgency-high";
  return "dashboard-urgency-normal";
}

function shortDate(value: string | null): string {
  if (!value) return "Nicht terminiert";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "Nicht terminiert";
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }).format(date);
}

function appointmentText(ticket: Ticket): string {
  if (!ticket.terminwunsch) return "Nicht terminiert";
  const timeRange = formatTimeRange(ticket.zeitfenster_von, ticket.zeitfenster_bis);
  return timeRange === "-" ? shortDate(ticket.terminwunsch) : `${shortDate(ticket.terminwunsch)}, ${timeRange}`;
}

function isOverdue(ticket: Ticket): boolean {
  if (!ticket.terminwunsch) return false;
  const due = new Date(`${ticket.terminwunsch.slice(0, 10)}T23:59:59`);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}

function Trend({ percent, compare }: { percent: number; compare: number }) {
  const direction = percent > 0 ? "↗" : percent < 0 ? "↘" : "→";
  return (
    <p className="dashboard-stat-trend">
      <span>{direction} {Math.abs(percent).toFixed(1)} %</span>
      <span>Vorperiode {compare}</span>
    </p>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  hint: string;
  trend?: { delta_percent: number; compare_value: number };
  accent: "blue" | "cyan" | "green" | "slate";
  onClick: () => void;
}

function SummaryCard({ label, value, hint, trend, accent, onClick }: SummaryCardProps) {
  return (
    <button type="button" className={`dashboard-stat dashboard-stat-${accent}`} onClick={onClick}>
      <span className="dashboard-stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="dashboard-stat-hint">{hint}</span>
      {trend ? <Trend percent={trend.delta_percent} compare={trend.compare_value} /> : null}
      <span className="dashboard-stat-link">Anzeigen <span aria-hidden="true">→</span></span>
    </button>
  );
}

interface FocusItemProps {
  label: string;
  value: number;
  hint: string;
  tone: "danger" | "warning" | "info" | "neutral";
  onClick: () => void;
}

function FocusItem({ label, value, hint, tone, onClick }: FocusItemProps) {
  return (
    <button type="button" className={`dashboard-focus-item dashboard-focus-${tone}`} onClick={onClick}>
      <span className="dashboard-focus-signal" aria-hidden="true" />
      <span className="dashboard-focus-copy">
        <span className="dashboard-focus-label">{label}</span>
        <span className="dashboard-focus-hint">{hint}</span>
      </span>
      <strong>{value}</strong>
      <span className="dashboard-focus-arrow" aria-hidden="true">›</span>
    </button>
  );
}

export default function AdminDashboardPage() {
  const outlet = useOutletContext<{ token?: string } | undefined>();
  const token = outlet?.token ?? "";
  const navigate = useNavigate();

  const [dashboard, setDashboard] = React.useState<DashboardResponse>(EMPTY_DASHBOARD);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [refreshVersion, setRefreshVersion] = React.useState(0);

  const [activeTickets, setActiveTickets] = React.useState<{ items: Ticket[]; total: number; page_count: number } | null>(null);
  const [activeLoading, setActiveLoading] = React.useState(true);
  const [activeError, setActiveError] = React.useState("");
  const [ticketQ, setTicketQ] = React.useState("");
  const debouncedTicketQ = useDebouncedValue(ticketQ, 320);
  const [ticketPage, setTicketPage] = React.useState(1);
  const [ticketSort, setTicketSort] = React.useState("due_asc");
  const [toast, setToast] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);

  React.useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  React.useEffect(() => {
    if (!token) {
      setError(SESSION_EXPIRED_MESSAGE);
      setLoading(false);
      setActiveLoading(false);
      return undefined;
    }

    let stopped = false;
    setError("");
    setLoading(true);
    adminDashboard(token)
      .then((response) => {
        if (stopped) return;
        setDashboard(response);
        setLastUpdated(new Date());
        setLoading(false);
      })
      .catch((reason) => {
        if (stopped) return;
        setError(toUserMessage(reason, "Dashboard konnte nicht geladen werden."));
        setLoading(false);
      });

    return () => {
      stopped = true;
    };
  }, [token, refreshVersion]);

  React.useEffect(() => {
    if (!token) return undefined;
    let stopped = false;
    setActiveError("");
    setActiveLoading(true);
    adminTickets(token, {
      q: debouncedTicketQ,
      bucket: "active",
      sort: ticketSort,
      page: String(ticketPage),
      page_size: "8",
      hydrate_customers: "0",
    })
      .then((response) => {
        if (stopped) return;
        setActiveTickets({ items: response.items, total: response.total, page_count: response.page_count });
        setActiveLoading(false);
      })
      .catch((reason) => {
        if (stopped) return;
        setActiveError(toUserMessage(reason, "Aktive Tickets konnten nicht geladen werden."));
        setActiveLoading(false);
      });

    return () => {
      stopped = true;
    };
  }, [token, debouncedTicketQ, ticketSort, ticketPage, refreshVersion]);

  const openTickets = dashboard.tickets.filter(
    (ticket) => ticket.status !== "Rapport_erstellt" && ticket.status !== "Storniert"
  );
  const dueToday = openTickets.filter((ticket) => {
    if (!ticket.terminwunsch) return false;
    const due = new Date(`${ticket.terminwunsch.slice(0, 10)}T12:00:00`);
    const now = new Date();
    return due.toDateString() === now.toDateString();
  });
  const upcoming = [...openTickets]
    .filter((ticket) => Boolean(ticket.terminwunsch) && !isOverdue(ticket))
    .sort((a, b) => new Date(a.terminwunsch || "").getTime() - new Date(b.terminwunsch || "").getTime())
    .slice(0, 4);

  function goTickets(params: Record<string, string>, route: "tickets" | "inbox" = "tickets") {
    const query = new URLSearchParams(params).toString();
    navigate(`/admin/${route}${query ? `?${query}` : ""}`);
  }

  async function handleAgentMessageOk(messageId: string) {
    const runId = String(messageId || "").trim();
    if (!runId) return;
    try {
      await ackAgentMessage(token, runId);
      setDashboard((current) => ({
        ...current,
        agent_messages: current.agent_messages.filter((message) => message.id !== runId),
      }));
      setToast({ kind: "ok", text: "Hinweis als erledigt markiert." });
    } catch (reason) {
      setToast({ kind: "error", text: toUserMessage(reason, "Hinweis konnte nicht bestätigt werden.") });
    }
  }

  const isRefreshing = loading || activeLoading;
  const pageCount = Math.max(activeTickets?.page_count || 1, 1);

  return (
    <div className="dashboard-page page-enter">
      <header className="dashboard-hero">
        <div>
          <p className="dashboard-eyebrow">Betriebsübersicht</p>
          <h1>Dashboard</h1>
          <p>Tickets, Termine und offene Aufgaben in einer klaren Arbeitsansicht.</p>
        </div>
        <div className="dashboard-refresh">
          <span>{lastUpdated ? `Stand ${lastUpdated.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr` : "Daten werden geladen"}</span>
          <Button
            variant="secondary"
            disabled={isRefreshing}
            onClick={() => setRefreshVersion((version) => version + 1)}
          >
            {isRefreshing ? "Aktualisiert ..." : "Aktualisieren"}
          </Button>
        </div>
      </header>

      {toast ? <Toast kind={toast.kind} text={toast.text} /> : null}
      {error ? <Toast kind="error" text={error} /> : null}
      {error === SESSION_EXPIRED_MESSAGE ? (
        <Button variant="secondary" onClick={() => navigate("/admin/login")}>Erneut anmelden</Button>
      ) : null}

      {loading ? (
        <section className="dashboard-loading" aria-label="Dashboard wird geladen">
          <LoadingSpinner label="Dashboard wird geladen ..." />
          <div className="dashboard-summary-grid">
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-44" />)}
          </div>
        </section>
      ) : (
        <>
          <section aria-labelledby="dashboard-summary-heading">
            <div className="dashboard-section-heading">
              <div>
                <p className="dashboard-section-kicker">Auf einen Blick</p>
                <h2 id="dashboard-summary-heading">Aktuelle Geschäftslage</h2>
              </div>
              <p>Alle Kennzahlen führen direkt zur passenden Arbeitsliste.</p>
            </div>
            <div className="dashboard-summary-grid">
              <SummaryCard
                label="Neue Tickets"
                value={dashboard.kpis.neue_tickets}
                hint="Eingänge der letzten 7 Tage"
                trend={dashboard.trends.neue_tickets}
                accent="blue"
                onClick={() => goTickets({}, "inbox")}
              />
              <SummaryCard
                label="Offene Tickets"
                value={dashboard.kpis.offene_tickets}
                hint="Aktuell in Bearbeitung"
                trend={dashboard.trends.offene_tickets}
                accent="cyan"
                onClick={() => goTickets({})}
              />
              <SummaryCard
                label="Termine"
                value={dashboard.kpis.termine_7_tage}
                hint="Geplant in den nächsten 7 Tagen"
                trend={dashboard.trends.termine_7_tage}
                accent="green"
                onClick={() => goTickets({ sort: "due_asc" })}
              />
              <SummaryCard
                label="ObjektBetreuung"
                value={dashboard.kpis.objektbetreuung_anfragen}
                hint="Offene Interessentenanfragen"
                accent="slate"
                onClick={() => navigate("/admin/interessenten")}
              />
            </div>
          </section>

          <section className="dashboard-focus" aria-labelledby="dashboard-focus-heading">
            <div className="dashboard-focus-head">
              <div>
                <p className="dashboard-section-kicker">Handlungsbedarf</p>
                <h2 id="dashboard-focus-heading">Was jetzt Aufmerksamkeit braucht</h2>
              </div>
              <span>Priorisiert nach Dringlichkeit</span>
            </div>
            <div className="dashboard-focus-grid">
              <FocusItem label="Dringend / Notfall" value={dashboard.kpis.hoch_notfall} hint="Priorisiert bearbeiten" tone="danger" onClick={() => goTickets({ urgency: "hoch_notfall", sort: "priority_desc" })} />
              <FocusItem label="Heute fällig" value={dashboard.kpis.heute_faellig} hint="Termine für heute" tone="warning" onClick={() => goTickets({ due_today: "1", sort: "due_asc" })} />
              <FocusItem label="Ohne Termin" value={dashboard.kpis.ohne_termin} hint="Einsatz noch einplanen" tone="info" onClick={() => goTickets({ without_schedule: "1" })} />
              <FocusItem label="Neue Eingänge" value={dashboard.kpis.inbox_neu} hint="Noch nicht angenommen" tone="neutral" onClick={() => goTickets({}, "inbox")} />
            </div>
          </section>
        </>
      )}

      <div className="dashboard-workspace">
        <GlassCard className="dashboard-ticket-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="dashboard-section-kicker">Arbeitsliste</p>
              <h2>Aktive Tickets</h2>
              <p>{activeTickets?.total || 0} offene Vorgänge, sortiert für die tägliche Bearbeitung.</p>
            </div>
            <Button variant="secondary" onClick={() => navigate("/admin/tickets")}>Alle Tickets</Button>
          </div>

          <div className="dashboard-ticket-tools">
            <label>
              <span className="sr-only">Aktive Tickets durchsuchen</span>
              <input
                className="premium-input"
                type="search"
                placeholder="Ticket, Kunde oder Ort suchen"
                value={ticketQ}
                onChange={(event) => {
                  setTicketQ(event.target.value);
                  setTicketPage(1);
                }}
              />
            </label>
            <label>
              <span className="sr-only">Aktive Tickets sortieren</span>
              <select
                className="premium-input"
                value={ticketSort}
                onChange={(event) => {
                  setTicketSort(event.target.value);
                  setTicketPage(1);
                }}
              >
                <option value="due_asc">Nächster Termin</option>
                <option value="priority_desc">Höchste Dringlichkeit</option>
                <option value="created_desc">Neueste zuerst</option>
              </select>
            </label>
          </div>

          {activeError ? <Toast kind="error" text={activeError} /> : null}
          {activeLoading ? (
            <div className="dashboard-ticket-loading">
              <LoadingSpinner label="Aktive Tickets werden geladen ..." />
              {[0, 1, 2].map((item) => <Skeleton key={item} className="h-28" />)}
            </div>
          ) : (
            <div className="dashboard-ticket-list">
              {(activeTickets?.items || []).map((ticket) => (
                <article key={ticket.id} className="dashboard-ticket-row">
                  <button className="dashboard-ticket-main" type="button" onClick={() => navigate(`/admin/tickets/${ticket.id}`)}>
                    <span className="dashboard-ticket-topline">
                      <strong>{formatTicketNumber(ticket.ticket_nummer)}</strong>
                      <StatusChip status={ticket.status} />
                    </span>
                    <span className="dashboard-ticket-title">{ticket.titel || ticket.beschreibung || ticket.kategorie}</span>
                    <span className="dashboard-ticket-category">
                      <RequestTypeBadge value={ticket.request_type || ticket.anfrageart} />
                      <span>{ticket.kategorie}</span>
                    </span>
                  </button>

                  <div className="dashboard-ticket-detail">
                    <span className="dashboard-ticket-detail-label">Kunde / Objekt</span>
                    <strong>{customerName(ticket)}</strong>
                    <span>{objectLabel(ticket)}</span>
                  </div>

                  <div className="dashboard-ticket-detail">
                    <span className="dashboard-ticket-detail-label">Priorität</span>
                    <span className={`dashboard-urgency ${urgencyClass(ticket)}`}>{urgencyLabel(ticket)}</span>
                    <span>Erstellt {shortDate(ticket.created_at)}</span>
                  </div>

                  <div className="dashboard-ticket-detail">
                    <span className="dashboard-ticket-detail-label">Termin</span>
                    <strong className={isOverdue(ticket) ? "dashboard-overdue" : ""}>{appointmentText(ticket)}</strong>
                    {isOverdue(ticket) ? <span className="dashboard-overdue">Überfällig</span> : <span>{ticket.ort || "Ort offen"}</span>}
                  </div>

                  <Button variant="secondary" className="dashboard-ticket-open" onClick={() => navigate(`/admin/tickets/${ticket.id}`)}>
                    Öffnen
                  </Button>
                </article>
              ))}
              {!activeTickets?.items.length ? (
                <div className="dashboard-empty">
                  <strong>Keine passenden Tickets</strong>
                  <span>Für diese Suche oder Sortierung wurden keine aktiven Vorgänge gefunden.</span>
                </div>
              ) : null}
            </div>
          )}

          <footer className="dashboard-pagination">
            <span>Seite {ticketPage} von {pageCount}</span>
            <div>
              <Button variant="secondary" disabled={ticketPage <= 1} onClick={() => setTicketPage((page) => page - 1)}>Zurück</Button>
              <Button variant="secondary" disabled={ticketPage >= pageCount} onClick={() => setTicketPage((page) => page + 1)}>Weiter</Button>
            </div>
          </footer>
        </GlassCard>

        <aside className="dashboard-side-column" aria-label="Termine und Hinweise">
          <GlassCard className="dashboard-side-card">
            <div className="dashboard-side-head">
              <div>
                <p className="dashboard-section-kicker">Einsatzplanung</p>
                <h2>Heute & als Nächstes</h2>
              </div>
              <button type="button" onClick={() => goTickets({ sort: "due_asc" })}>Alle →</button>
            </div>

            {dueToday.length ? (
              <div className="dashboard-today-block">
                <span>Heute fällig</span>
                {dueToday.slice(0, 2).map((ticket) => (
                  <button key={ticket.id} type="button" onClick={() => navigate(`/admin/tickets/${ticket.id}`)}>
                    <strong>{formatTicketNumber(ticket.ticket_nummer)}</strong>
                    <span>{customerName(ticket)}</span>
                    <small>{appointmentText(ticket)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="dashboard-clear-state"><span aria-hidden="true" /><p>Für heute sind keine Tickets fällig.</p></div>
            )}

            <div className="dashboard-upcoming-list">
              <span className="dashboard-list-label">Nächste Termine</span>
              {upcoming.map((ticket) => (
                <button key={ticket.id} type="button" onClick={() => navigate(`/admin/tickets/${ticket.id}`)}>
                  <time>{shortDate(ticket.terminwunsch)}</time>
                  <span><strong>{customerName(ticket)}</strong><small>{formatTicketNumber(ticket.ticket_nummer)}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
              {!upcoming.length ? <p className="dashboard-muted">Keine geplanten Termine vorhanden.</p> : null}
            </div>
          </GlassCard>

          <GlassCard className="dashboard-side-card">
            <div className="dashboard-side-head">
              <div>
                <p className="dashboard-section-kicker">Vertrieb</p>
                <h2>ObjektBetreuung</h2>
              </div>
              <button type="button" onClick={() => navigate("/admin/interessenten")}>Öffnen →</button>
            </div>
            <div className="dashboard-inquiry-grid">
              <div><strong>{dashboard.inquiry_summary.total_open}</strong><span>Offen</span></div>
              <div className={dashboard.inquiry_summary.follow_up_due > 0 ? "is-due" : ""}><strong>{dashboard.inquiry_summary.follow_up_due}</strong><span>Wiedervorlagen</span></div>
            </div>
            <p className="dashboard-inquiry-last">Letzte Anfrage: {dashboard.inquiry_summary.latest_requested_at ? dateTime(dashboard.inquiry_summary.latest_requested_at) : "Keine Anfrage vorhanden"}</p>
          </GlassCard>

          <GlassCard className="dashboard-side-card">
            <div className="dashboard-side-head">
              <div>
                <p className="dashboard-section-kicker">Verlauf</p>
                <h2>Letzte Aktivitäten</h2>
              </div>
            </div>
            <div className="dashboard-activity-list">
              {dashboard.activities.slice(0, 5).map((activity) => (
                <div key={activity.id}>
                  <span aria-hidden="true" />
                  <p><strong>{activity.message}</strong><small>{activity.actor} · {dateTime(activity.created_at)}</small></p>
                </div>
              ))}
              {!dashboard.activities.length ? <p className="dashboard-muted">Noch keine Aktivitäten vorhanden.</p> : null}
            </div>
          </GlassCard>
        </aside>
      </div>

      {dashboard.agent_messages.length ? (
        <GlassCard className="dashboard-agent-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="dashboard-section-kicker">Systemhinweise</p>
              <h2>Zu prüfende Hinweise</h2>
              <p>Automatisch erkannte Vorgänge, die eine kurze Kontrolle benötigen.</p>
            </div>
            <span className="dashboard-count-badge">{dashboard.agent_messages.length}</span>
          </div>
          <div className="dashboard-agent-grid">
            {dashboard.agent_messages.slice(0, 6).map((message) => (
              <article key={message.id}>
                <div>
                  <span className={`dashboard-risk dashboard-risk-${message.risk_level}`}>Risiko {message.risk_level}</span>
                  <small>{dateTime(message.created_at)}</small>
                </div>
                <p>{message.message}</p>
                <footer>
                  {message.ticket_id ? <Button variant="secondary" onClick={() => navigate(`/admin/tickets/${message.ticket_id}`)}>Ticket öffnen</Button> : <span />}
                  <Button variant="secondary" onClick={() => void handleAgentMessageOk(message.id)}>Erledigt</Button>
                </footer>
              </article>
            ))}
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
