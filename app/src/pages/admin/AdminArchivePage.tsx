import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
import { Ticket } from "@/types/domain";

export default function AdminArchivePage() {
  const outlet = useOutletContext<{ token?: string } | undefined>();
  const token = outlet?.token ?? "";
  const navigate = useNavigate();

  const [q, setQ] = React.useState("");
  const debounced = useDebouncedValue(q, 250);
  const [status, setStatus] = React.useState("");
  const [sort, setSort] = React.useState("created_desc");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<{ items: Ticket[]; total: number; page_count: number } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [toast, setToast] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busyDelete, setBusyDelete] = React.useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = React.useState<Ticket | null>(null);
  const [deleteError, setDeleteError] = React.useState("");

  React.useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

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
      bucket: "archive",
      status,
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
        setError(toUserMessage(err, "Archiv konnte nicht geladen werden."));
        setLoading(false);
      });

    return () => {
      stop = true;
    };
  }, [debounced, page, sort, status, token]);

  async function removeTicket(row: Ticket) {
    setBusyDelete((prev) => ({ ...prev, [row.id]: true }));
    setError("");
    setDeleteError("");

    try {
      await deleteTicket(token, row.id);
      setData((prev) => {
        if (!prev) return prev;
        const items = prev.items.filter((item) => item.id !== row.id);
        const total = Math.max(0, prev.total - 1);
        const pageCount = Math.max(1, Math.ceil(total / 20));
        return { items, total, page_count: pageCount };
      });
      setToast({ kind: "ok", text: `Ticket ${formatTicketNumber(row.ticket_nummer)} gel\u00f6scht.` });
      setPendingDelete(null);
    } catch (err) {
      const message = toUserMessage(err, "Ticket konnte nicht gel\u00f6scht werden.");
      setError(message);
      setDeleteError(message);
      setToast({ kind: "error", text: message });
    } finally {
      setBusyDelete((prev) => ({ ...prev, [row.id]: false }));
    }
  }

  return (
    <div className="page-enter space-y-4">
      <SectionTitle title="Archiv" subtitle={"Abgeschlossene und stornierte Tickets mit schneller \u00dcbersicht"} />
      {toast ? <Toast kind={toast.kind} text={toast.text} /> : null}

      <div className="admin-filter-bar flex flex-wrap gap-2">
        <input
          placeholder="Suche Ticket, Kunde, E-Mail"
          className="premium-input w-full px-3 py-2 text-sm sm:w-72"
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
          <option value="">Alle Archiv-Status</option>
          <option value="Rapport_erstellt">{labelStatus("Rapport_erstellt")}</option>
          <option value="Storniert">Storniert</option>
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
        </select>
        <div className="rounded-xl border border-[var(--line)] bg-slate-950/35 px-3 py-2 text-xs text-[var(--text-soft)]">
          {loading ? "Lade Archiv..." : `${data?.total || 0} Archiv-Tickets`}
        </div>
      </div>

      {error ? <Toast kind="error" text={error} /> : null}

      {loading ? (
        <LoadingSpinner label="Archiv wird geladen..." className="py-1" />
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
              title: "Art / Abschluss",
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
                      : "Ohne Termin"}
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
                      setDeleteError("");
                      setPendingDelete(row);
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
        <EmptyState text="Keine archivierten Tickets vorhanden." />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        subject={pendingDelete ? `Ticket ${formatTicketNumber(pendingDelete.ticket_nummer)}` : undefined}
        error={deleteError}
        busy={Boolean(pendingDelete && busyDelete[pendingDelete.id])}
        onClose={() => {
          setDeleteError("");
          setPendingDelete(null);
        }}
        onConfirm={() => {
          if (pendingDelete) void removeTicket(pendingDelete);
        }}
      />

      <div className="flex flex-col gap-2 text-sm text-[var(--text-soft)] sm:flex-row sm:items-center sm:justify-between">
        <p>Archiv l\u00e4dt direkt aus dem Archiv-Bucket und bleibt dadurch schnell und sauber.</p>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <Button variant="secondary" className="px-3 py-1 sm:min-w-[112px]" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
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
