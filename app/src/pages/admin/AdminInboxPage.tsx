import React from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusChip } from "@/components/ui/StatusChip";
import { Toast } from "@/components/ui/Toast";
import { RequestTypeBadge } from "@/components/ui/RequestTypeBadge";
import { adminTickets, runOpsAgent, UpdateTicketPayload, updateTicket } from "@/features/apiClient";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SESSION_EXPIRED_MESSAGE, toUserMessage } from "@/lib/errors";
import { dateTime, formatTicketNumber, formatTimeRange } from "@/lib/format";
import { KATEGORIEN } from "@/data/content";
import { Ticket } from "@/types/domain";

function boolFromQuery(value: string | null): boolean {
  return value === "1";
}

export default function AdminInboxPage() {
  const outlet = useOutletContext<{ token?: string } | undefined>();
  const token = outlet?.token ?? "";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = React.useState(searchParams.get("q") || "");
  const [urgency, setUrgency] = React.useState(searchParams.get("urgency") || "");
  const [category, setCategory] = React.useState(searchParams.get("category") || "");
  const [withoutSchedule, setWithoutSchedule] = React.useState(boolFromQuery(searchParams.get("without_schedule")));
  const [sort, setSort] = React.useState(searchParams.get("sort") || "created_desc");
  const [page, setPage] = React.useState(Math.max(Number(searchParams.get("page") || 1), 1));
  const debounced = useDebouncedValue(q, 360);

  const [data, setData] = React.useState<{ items: Ticket[]; total: number; page_count: number } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busyMap, setBusyMap] = React.useState<Record<string, boolean>>({});
  const [batchBusy, setBatchBusy] = React.useState<"dry_run" | "execute" | null>(null);
  const [toast, setToast] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  React.useEffect(() => {
    setQ(searchParams.get("q") || "");
    setUrgency(searchParams.get("urgency") || "");
    setCategory(searchParams.get("category") || "");
    setWithoutSchedule(boolFromQuery(searchParams.get("without_schedule")));
    setSort(searchParams.get("sort") || "created_desc");
    setPage(Math.max(Number(searchParams.get("page") || 1), 1));
  }, [searchParams]);

  React.useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (urgency) next.set("urgency", urgency);
    if (category) next.set("category", category);
    if (withoutSchedule) next.set("without_schedule", "1");
    if (sort !== "created_desc") next.set("sort", sort);
    if (page > 1) next.set("page", String(page));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [q, urgency, category, withoutSchedule, sort, page, setSearchParams, searchParams]);

  const load = React.useCallback(() => {
    if (!token) {
      setError(SESSION_EXPIRED_MESSAGE);
      setLoading(false);
      return;
    }

    let stop = false;
    setLoading(true);
    adminTickets(token, {
      q: debounced,
      urgency,
      category,
      without_schedule: withoutSchedule ? "1" : "0",
      sort,
      page: String(page),
      page_size: "20",
      bucket: "inbox",
      hydrate_customers: "0",
    })
      .then((res) => {
        if (stop) return;
        setData({ items: res.items, total: res.total, page_count: res.page_count });
        setLoading(false);
      })
      .catch((err) => {
        if (stop) return;
        setError(toUserMessage(err, "Inbox konnte nicht geladen werden."));
        setLoading(false);
      });

    return () => {
      stop = true;
    };
  }, [token, debounced, urgency, category, withoutSchedule, sort, page]);

  React.useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  function removeFromList(ticketId: string) {
    setData((prev) => {
      if (!prev) return prev;
      const items = prev.items.filter((item) => item.id !== ticketId);
      const total = Math.max(0, prev.total - 1);
      const pageCount = Math.max(1, Math.ceil(total / 20));
      return { items, total, page_count: pageCount };
    });
  }

  async function runAction(ticket: Ticket, payload: UpdateTicketPayload, successText: string) {
    setBusyMap((prev) => ({ ...prev, [ticket.id]: true }));
    setError("");
    try {
      await updateTicket(token, ticket.id, payload);
      removeFromList(ticket.id);
      setToast({ kind: "ok", text: successText });
    } catch (err) {
      setToast({ kind: "error", text: toUserMessage(err, "Aktion fehlgeschlagen.") });
    } finally {
      setBusyMap((prev) => ({ ...prev, [ticket.id]: false }));
    }
  }

  async function accept(ticket: Ticket) {
    await runAction(
      ticket,
      { action: "accept", bucket: "active", status: ticket.status === "Neu" ? "Geprueft" : ticket.status },
      `${formatTicketNumber(ticket.ticket_nummer)} wurde übernommen und dem Objekt zugeordnet.`
    );
  }

  async function reject(ticket: Ticket) {
    const reason = window.prompt("Ablehnungsgrund (optional):", "") || "";
    await runAction(
      ticket,
      { action: "reject", bucket: "archive", status: "Storniert", rejected_reason: reason.trim() || null },
      `${ticket.ticket_nummer} wurde abgelehnt und archiviert.`
    );
  }

  async function agentReview(ticket: Ticket) {
    setBusyMap((prev) => ({ ...prev, [ticket.id]: true }));
    setError("");
    try {
      const result = await runOpsAgent(token, {
        ticket_id: ticket.id,
        auto_process_inbox: true,
        inbox_review: true,
        allow_delete: false,
      });
      const decision = String((result.structured_data as { processing_decision?: string } | undefined)?.processing_decision || "");
      if (decision !== "left_in_inbox") {
        removeFromList(ticket.id);
      }
      setToast({
        kind: "ok",
        text: result.short_assessment || `${ticket.ticket_nummer} wurde durch den Agent geprüft.`,
      });
    } catch (err) {
      setToast({ kind: "error", text: toUserMessage(err, "Agent-Pruefung fehlgeschlagen.") });
    } finally {
      setBusyMap((prev) => ({ ...prev, [ticket.id]: false }));
    }
  }

  async function runAgentBatch(mode: "dry_run" | "execute") {
    if (!token) {
      setError(SESSION_EXPIRED_MESSAGE);
      return;
    }

    const rows = data?.items || [];
    if (!rows.length) {
      setToast({ kind: "error", text: "Keine Inbox-Tickets für den Batch vorhanden." });
      return;
    }

    const stats = {
      total: rows.length,
      ok: 0,
      errors: 0,
      autoAccepted: 0,
      leftInInbox: 0,
      archived: 0,
      deleted: 0,
      updated: 0,
    };

    setBatchBusy(mode);
    setError("");
    try {
      for (const ticket of rows) {
        setBusyMap((prev) => ({ ...prev, [ticket.id]: true }));
        try {
          const result = await runOpsAgent(token, {
            ticket_id: ticket.id,
            auto_process_inbox: true,
            inbox_review: true,
            allow_delete: false,
            dry_run: mode === "dry_run",
          });
          const decision = String((result.structured_data as { processing_decision?: string } | undefined)?.processing_decision || "");
          stats.ok += 1;
          if (decision.includes("auto_accept")) stats.autoAccepted += 1;
          else if (decision.includes("leave_in_inbox")) stats.leftInInbox += 1;
          else if (decision.includes("archive")) stats.archived += 1;
          else if (decision.includes("delete")) stats.deleted += 1;
          else stats.updated += 1;
        } catch {
          stats.errors += 1;
        } finally {
          setBusyMap((prev) => ({ ...prev, [ticket.id]: false }));
        }
      }

      if (mode === "execute") {
        load();
      }

      const label = mode === "dry_run" ? "Dry-Run" : "Ausführung";
      setToast({
        kind: stats.errors ? "error" : "ok",
        text: `${label}: ${stats.ok}/${stats.total} geprüft, auto=${stats.autoAccepted}, inbox=${stats.leftInInbox}, archiviert=${stats.archived}, gelöscht=${stats.deleted}, updated=${stats.updated}, fehler=${stats.errors}.`,
      });
    } finally {
      setBatchBusy(null);
    }
  }

  return (
    <div className="page-enter space-y-4">
      <SectionTitle title="Inbox" subtitle="Neue Tickets mit direkter Sicht auf Art, Kunde, Objekt und Status" />

      {toast ? <Toast kind={toast.kind} text={toast.text} /> : null}

      <div className="admin-filter-bar flex flex-wrap gap-2">
        <input
          placeholder="Suche Ticket, Name, Ort, Telefon, E-Mail"
          className="premium-input w-full px-3 py-2 text-sm sm:w-[23rem]"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="premium-input px-3 py-2 text-sm"
          value={urgency}
          onChange={(e) => {
            setUrgency(e.target.value);
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
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Alle Kategorien</option>
          {KATEGORIEN.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className="premium-input px-3 py-2 text-sm"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="created_desc">Neueste zuerst</option>
          <option value="created_asc">Älteste zuerst</option>
          <option value="priority_desc">Dringlichkeit zuerst</option>
        </select>
        <label className="premium-input inline-flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-soft)]">
          <input
            type="checkbox"
            checked={withoutSchedule}
            onChange={(e) => {
              setWithoutSchedule(e.target.checked);
              setPage(1);
            }}
          />
          Ohne Terminwunsch
        </label>
        <Button
          variant="secondary"
          className="px-3 py-2 text-xs whitespace-nowrap"
          disabled={Boolean(batchBusy) || loading}
          onClick={() => {
            void runAgentBatch("dry_run");
          }}
        >
          {batchBusy === "dry_run" ? "Dry-Run läuft..." : "Agent Batch Dry-Run"}
        </Button>
        <Button
          variant="primary"
          className="px-3 py-2 text-xs whitespace-nowrap"
          disabled={Boolean(batchBusy) || loading}
          onClick={() => {
            void runAgentBatch("execute");
          }}
        >
          {batchBusy === "execute" ? "Batch läuft..." : "Agent Batch ausführen"}
        </Button>
        <div className="rounded-xl border border-[var(--line)] bg-slate-950/35 px-3 py-2 text-xs text-[var(--text-soft)]">
          {loading ? "Lade Übersicht..." : `${data?.total || 0} neue Tickets`}
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
        <LoadingSpinner label="Inbox wird geladen..." className="py-1" />
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
                </div>
              ),
            },
            {
              key: "wer",
              title: "Für wen / Objekt",
              render: (row) => (
                <div className="min-w-[240px] max-w-[340px]">
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
              key: "art",
              title: "Art / Termin",
              render: (row) => (
                <div className="min-w-[210px] max-w-[280px] space-y-1">
                  <RequestTypeBadge value={row.request_type || row.anfrageart} />
                  <p className="text-xs text-[var(--text-soft)]">
                    {row.kategorie}
                    {row.subkategorie ? ` · ${row.subkategorie}` : ""}
                    {row.dringlichkeit ? ` · ${row.dringlichkeit}` : ""}
                  </p>
                  <p className="text-xs text-[var(--text-soft)]">
                    {row.terminwunsch ? `${row.terminwunsch} · ${formatTimeRange(row.zeitfenster_von, row.zeitfenster_bis)}` : "Noch kein Termin"}
                  </p>
                  <p className="text-xs text-[var(--text-soft)]">Eingang: {dateTime(row.created_at)}</p>
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
                    <p className="text-xs text-[var(--text-soft)]">
                      {row.object_id ? "Objekt vorhanden" : "Objekt wird bei Annahme angelegt"}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Button
                      variant="secondary"
                      className="w-full px-3 py-1 text-xs whitespace-nowrap"
                      disabled={Boolean(busyMap[row.id]) || Boolean(batchBusy)}
                      onClick={(event) => {
                        event.stopPropagation();
                        void agentReview(row);
                      }}
                    >
                      Agent prüfen
                    </Button>
                    <Button
                      variant="primary"
                      className="w-full px-3 py-1 text-xs whitespace-nowrap"
                      disabled={Boolean(busyMap[row.id]) || Boolean(batchBusy)}
                      onClick={(event) => {
                        event.stopPropagation();
                        void accept(row);
                      }}
                    >
                      Annehmen
                    </Button>
                    <Button
                      variant="danger"
                      className="w-full px-3 py-1 text-xs whitespace-nowrap"
                      disabled={Boolean(busyMap[row.id]) || Boolean(batchBusy)}
                      onClick={(event) => {
                        event.stopPropagation();
                        void reject(row);
                      }}
                    >
                      Ablehnen
                    </Button>
                  </div>
                </div>
              ),
            },
          ]}
          rows={data?.items || []}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/admin/tickets/${row.id}`)}
        />
      ) : (
        <EmptyState text="Keine neuen Tickets vorhanden." />
      )}

      <div className="flex flex-col gap-2 text-sm text-[var(--text-soft)] sm:flex-row sm:items-center sm:justify-between">
        <p>Gesamt in Inbox: {data?.total || 0}</p>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <Button
            variant="secondary"
            className="px-3 py-1 sm:min-w-[112px]"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Zurück
          </Button>
          <span>
            Seite {page} / {data?.page_count || 1}
          </span>
          <Button
            variant="secondary"
            className="px-3 py-1 sm:min-w-[112px]"
            disabled={page >= (data?.page_count || 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            Weiter
          </Button>
        </div>
      </div>
    </div>
  );
}
