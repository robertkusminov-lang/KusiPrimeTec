import React from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RequestTypeBadge } from "@/components/ui/RequestTypeBadge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusChip } from "@/components/ui/StatusChip";
import { Toast } from "@/components/ui/Toast";
import { adminTickets, deleteTicket } from "@/features/apiClient";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SESSION_EXPIRED_MESSAGE, toUserMessage } from "@/lib/errors";
import { dateTime, formatTicketNumber, formatTimeRange, labelStatus } from "@/lib/format";
import { Ticket, TICKET_STATUSES } from "@/types/domain";

function boolFromQuery(value: string | null): boolean {
  return value === "1";
}

export default function AdminTicketsPage() {
  const outlet = useOutletContext<{ token?: string } | undefined>();
  const token = outlet?.token ?? "";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = React.useState(searchParams.get("q") || "");
  const [status, setStatus] = React.useState(searchParams.get("status") || "");
  const [requestType, setRequestType] = React.useState(searchParams.get("request_type") || "");
  const [urgency, setUrgency] = React.useState(searchParams.get("urgency") || "");
  const [withoutSchedule, setWithoutSchedule] = React.useState(boolFromQuery(searchParams.get("without_schedule")));
  const [dueToday, setDueToday] = React.useState(boolFromQuery(searchParams.get("due_today")));
  const [sort, setSort] = React.useState(searchParams.get("sort") || "created_desc");
  const [page, setPage] = React.useState(Math.max(Number(searchParams.get("page") || 1), 1));
  const debounced = useDebouncedValue(q, 360);

  const [data, setData] = React.useState<{ items: Ticket[]; total: number; page_count: number } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [toast, setToast] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busyDelete, setBusyDelete] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  React.useEffect(() => {
    setQ(searchParams.get("q") || "");
    setStatus(searchParams.get("status") || "");
    setRequestType(searchParams.get("request_type") || "");
    setUrgency(searchParams.get("urgency") || "");
    setWithoutSchedule(boolFromQuery(searchParams.get("without_schedule")));
    setDueToday(boolFromQuery(searchParams.get("due_today")));
    setSort(searchParams.get("sort") || "created_desc");
    setPage(Math.max(Number(searchParams.get("page") || 1), 1));
  }, [searchParams]);

  React.useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (status) next.set("status", status);
    if (requestType) next.set("request_type", requestType);
    if (urgency) next.set("urgency", urgency);
    if (withoutSchedule) next.set("without_schedule", "1");
    if (dueToday) next.set("due_today", "1");
    if (sort !== "created_desc") next.set("sort", sort);
    if (page > 1) next.set("page", String(page));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [dueToday, page, q, requestType, searchParams, setSearchParams, sort, status, urgency, withoutSchedule]);

  React.useEffect(() => {
    if (!token) {
      setError(SESSION_EXPIRED_MESSAGE);
      setLoading(false);
      return;
    }

    let stop = false;
    setLoading(true);
    setError("");

    adminTickets(token, {
      q: debounced,
      status,
      request_type: requestType,
      urgency,
      without_schedule: withoutSchedule ? "1" : "0",
      due_today: dueToday ? "1" : "0",
      bucket: "active",
      hydrate_customers: "0",
      sort,
      page: String(page),
      page_size: "20",
    })
      .then((res) => {
        if (stop) return;
        setData({
          items: res.items,
          total: res.total,
          page_count: Math.max(1, res.page_count || 1),
        });
        setLoading(false);
      })
      .catch((err) => {
        if (stop) return;
        setError(toUserMessage(err, "Ticketliste konnte nicht geladen werden."));
        setLoading(false);
      });

    return () => {
      stop = true;
    };
  }, [debounced, dueToday, page, requestType, sort, status, token, urgency, withoutSchedule]);

  async function removeTicket(row: Ticket) {
    const ok = window.confirm(`Ticket ${formatTicketNumber(row.ticket_nummer)} wirklich l\u00f6schen?`);
    if (!ok) return;

    setBusyDelete((prev) => ({ ...prev, [row.id]: true }));
    setError("");

    try {
      await deleteTicket(token, row.id);
      setData((prev) => {
        if (!prev) return prev;
        const items = prev.items.filter((item) => item.id !== row.id);
        const total = Math.max(0, prev.total - 1);
        const pageCount = Math.max(1, Math.ceil(total / 20));
        return { items, total, page_count: pageCount };
      });

      if ((data?.items.length || 0) <= 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      }

      setToast({ kind: "ok", text: `Ticket ${formatTicketNumber(row.ticket_nummer)} gel\u00f6scht.` });
    } catch (err) {
      const message = toUserMessage(err, "Ticket konnte nicht gel\u00f6scht werden.");
      setError(message);
      setToast({ kind: "error", text: message });
    } finally {
      setBusyDelete((prev) => ({ ...prev, [row.id]: false }));
    }
  }

  return (
    <div className="page-enter space-y-4">
      <SectionTitle title="Tickets" subtitle={"Aktive Eins\u00e4tze, saubere Filterung und klare Verwaltung"} />
      {toast ? <Toast kind={toast.kind} text={toast.text} /> : null}

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1.55fr)_repeat(4,minmax(160px,0.8fr))]">
        <input
          placeholder="Suche Ticket, Name, Ort, Telefon, E-Mail"
          className="premium-input w-full px-3 py-2 text-sm md:col-span-2 xl:col-span-1"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="premium-input px-3 py-2 text-sm"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Alle Status</option>
          {TICKET_STATUSES.map((value) => (
            <option key={value} value={value}>
              {labelStatus(value)}
            </option>
          ))}
        </select>
        <select
          className="premium-input px-3 py-2 text-sm"
          value={requestType}
          onChange={(event) => {
            setRequestType(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Alle Einsatzarten</option>
          <option value="direct">Direkt Einsatz</option>
          <option value="offer">Angebot anfordern</option>
        </select>
        <select
          className="premium-input px-3 py-2 text-sm"
          value={urgency}
          onChange={(event) => {
            setUrgency(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Alle Dringlichkeiten</option>
          <option value="hoch_notfall">Hoch + Notfall</option>
          <option value="kritisch">Notfall</option>
          <option value="hoch">Hoch</option>
          <option value="mittel">Mittel</option>
          <option value="niedrig">Niedrig</option>
        </select>
        <select
          className="premium-input px-3 py-2 text-sm"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
        >
          <option value="created_desc">Neueste zuerst</option>
          <option value="created_asc">{"\u00c4lteste zuerst"}</option>
          <option value="due_asc">{"Termin als n\u00e4chstes"}</option>
          <option value="priority_desc">Dringlichkeit zuerst</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="premium-input inline-flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-soft)]">
          <input
            type="checkbox"
            checked={withoutSchedule}
            onChange={(event) => {
              setWithoutSchedule(event.target.checked);
              if (event.target.checked) setDueToday(false);
              setPage(1);
            }}
          />
          Ohne Termin
        </label>
        <label className="premium-input inline-flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-soft)]">
          <input
            type="checkbox"
            checked={dueToday}
            onChange={(event) => {
              setDueToday(event.target.checked);
              if (event.target.checked) setWithoutSchedule(false);
              setPage(1);
            }}
          />
          {"Heute f\u00e4llig"}
        </label>
        <div className="rounded-xl border border-[var(--line)] bg-slate-950/35 px-3 py-2 text-xs text-[var(--text-soft)]">
          {loading ? "Lade \u00dcbersicht..." : `${data?.total || 0} Treffer \u00b7 Seite ${page} von ${data?.page_count || 1}`}
        </div>
      </div>

      {error ? <Toast kind="error" text={error} /> : null}
      {error === SESSION_EXPIRED_MESSAGE ? (
        <div className="pt-1">
          <Button variant="secondary" className="px-3 py-1 text-sm" onClick={() => navigate("/admin/login")}>
            Erneut anmelden
          </Button>
        </div>
      ) : null}

      {loading ? (
        <LoadingSpinner label="Tickets werden geladen..." className="py-1" />
      ) : (data?.items || []).length ? (
        <DataTable
          columns={[
            {
              key: "ticket",
              title: "Ticket",
              render: (row) => (
                <div className="min-w-[180px] max-w-[220px]">
                  <p className="font-semibold text-white">{formatTicketNumber(row.ticket_nummer)}</p>
                  <p className="text-xs text-[var(--text-soft)]">{row.titel || row.subkategorie || row.kategorie || "-"}</p>
                  <p className="mt-2 text-xs text-[var(--text-soft)]">Erstellt: {dateTime(row.created_at)}</p>
                </div>
              ),
            },
            {
              key: "target",
              title: "F\u00fcr wen / Objekt",
              render: (row) => (
                <div className="min-w-[250px] max-w-[340px]">
                  <p>{row.customer_display_name || row.invoice_recipient_name || row.kunde_firma || row.kunde_name || "nicht angegeben"}</p>
                  <p className="text-xs text-[var(--text-soft)] break-all">{row.kunde_email || row.kunde_telefon || "-"}</p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">{row.objekt_strasse || row.objekt_adresse || "-"}</p>
                  <p className="text-xs text-[var(--text-soft)]">
                    {[row.objekt_plz || row.plz || "", row.objekt_ort || row.ort || ""].filter(Boolean).join(" ") || "-"}
                  </p>
                </div>
              ),
            },
            {
              key: "type",
              title: "Art / Termin",
              render: (row) => (
                <div className="min-w-[220px] max-w-[280px] space-y-1">
                  <RequestTypeBadge value={row.request_type || row.anfrageart} />
                  <p className="text-xs text-[var(--text-soft)]">
                    {row.kategorie}
                    {row.subkategorie ? ` \u00b7 ${row.subkategorie}` : ""}
                    {row.dringlichkeit ? ` \u00b7 ${row.dringlichkeit}` : ""}
                  </p>
                  <p className="text-xs text-[var(--text-soft)]">
                    {row.terminwunsch
                      ? `${row.terminwunsch} \u00b7 ${formatTimeRange(row.zeitfenster_von, row.zeitfenster_bis)}`
                      : "Noch kein Termin"}
                  </p>
                </div>
              ),
            },
            {
              key: "actions",
              title: "Status / Aktion",
              render: (row) => (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <StatusChip status={row.status} />
                    <p className="text-xs text-[var(--text-soft)]">Aktualisiert: {dateTime(row.updated_at)}</p>
                  </div>
                  <Button
                    variant="danger"
                    className="w-full px-3 py-1.5 text-xs"
                    disabled={Boolean(busyDelete[row.id])}
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeTicket(row);
                    }}
                  >
                    {busyDelete[row.id] ? "L\u00f6scht..." : "L\u00f6schen"}
                  </Button>
                </div>
              ),
            },
          ]}
          rows={data?.items || []}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/admin/tickets/${row.id}`)}
        />
      ) : (
        <EmptyState text="Keine aktiven Tickets vorhanden." />
      )}

      <div className="flex flex-col gap-2 text-sm text-[var(--text-soft)] sm:flex-row sm:items-center sm:justify-between">
        <p>Serverseitige Filterung aktiv. Dadurch bleiben Seitenzahlen und Ladezeiten stabil.</p>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <Button
            variant="secondary"
            className="px-3 py-1 sm:min-w-[112px]"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            {"Zur\u00fcck"}
          </Button>
          <span>
            Seite {page} / {data?.page_count || 1}
          </span>
          <Button
            variant="secondary"
            className="px-3 py-1 sm:min-w-[112px]"
            disabled={page >= (data?.page_count || 1)}
            onClick={() => setPage((current) => current + 1)}
          >
            Weiter
          </Button>
        </div>
      </div>
    </div>
  );
}
