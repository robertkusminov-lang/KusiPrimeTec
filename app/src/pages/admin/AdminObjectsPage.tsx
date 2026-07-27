import React from "react";
import clsx from "clsx";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RequestTypeBadge } from "@/components/ui/RequestTypeBadge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusChip } from "@/components/ui/StatusChip";
import { Toast } from "@/components/ui/Toast";
import { adminRecordAction, adminTickets, updateTicket, type UpdateTicketPayload } from "@/features/apiClient";
import { SESSION_EXPIRED_MESSAGE, toUserMessage } from "@/lib/errors";
import { dateTime, formatTicketNumber } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { type Ticket, type TicketStatus } from "@/types/domain";

type BucketKey = "inbox" | "active" | "archive";
type MoveTarget = BucketKey;

type ObjectGroup = {
  key: string;
  objectId: string | null;
  customerId: string | null;
  requesterUserId: string | null;
  title: string;
  address: string;
  street: string | null;
  zip: string | null;
  city: string | null;
  isActive: boolean;
  inbox: Ticket[];
  active: Ticket[];
  archive: Ticket[];
  latestAt: string;
};

type CustomerAccessOption = {
  id: string;
  label: string;
  authUserId: string | null;
};

type ObjectMeta = {
  name: string;
  customerId: string | null;
  requesterUserId: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  isActive: boolean;
};

type AddressParts = {
  street: string;
  zip: string;
  city: string;
  fallback: string;
};

const DISPLAY_TICKET_LIMIT = 6;

const BUCKET_LABELS: Record<BucketKey, string> = {
  inbox: "Inbox",
  active: "Offen",
  archive: "Archiv",
};

const STATUS_BY_BUCKET: Record<MoveTarget, TicketStatus> = {
  inbox: "Neu",
  active: "Geprueft",
  archive: "Rapport_erstellt",
};

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeLookupToken(text: string): string {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function ticketActivityAt(ticket: Ticket): string {
  return String(ticket.updated_at || ticket.created_at || "");
}

function ticketActivityTime(ticket: Ticket): number {
  const time = new Date(ticketActivityAt(ticket)).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getAddressParts(ticket: Ticket): AddressParts {
  return {
    street: String(ticket.objekt_strasse || "").trim(),
    zip: String(ticket.objekt_plz || ticket.plz || "").trim(),
    city: String(ticket.objekt_ort || ticket.ort || "").trim(),
    fallback: String(ticket.objekt_adresse || "").trim(),
  };
}

function composeAddress(parts: AddressParts | { street: string | null | undefined; zip: string | null | undefined; city: string | null | undefined }, fallback = ""): string {
  const street = String(parts.street || "").trim();
  const zip = String(parts.zip || "").trim();
  const city = String(parts.city || "").trim();
  const line2 = [zip, city].filter(Boolean).join(" ");
  return [street, line2].filter(Boolean).join(", ") || String(fallback || "").trim() || "Adresse nicht angegeben";
}

function addressKeyForParts(parts: AddressParts): string | null {
  const base = composeAddress(parts, parts.fallback);
  const key = normalizeText(base);
  return key && key !== normalizeText("Adresse nicht angegeben") ? key : null;
}

function getObjectTitle(ticket: Ticket): string {
  const { street, city, fallback } = getAddressParts(ticket);
  if (street && city) return `Objekt ${street}, ${city}`;
  if (street) return `Objekt ${street}`;
  if (city) return `Objekt ${city}`;
  if (fallback) return `Objekt ${fallback}`;
  return "Objekt ohne Adresse";
}

function resolveBucket(ticket: Ticket): BucketKey {
  if (ticket.status === "Rapport_erstellt" || ticket.status === "Storniert") return "archive";
  if (ticket.status === "Neu") return "inbox";

  const raw = String(ticket.bucket || "").trim().toLowerCase();
  if (raw === "archive" || raw === "archiv") return "archive";
  if (raw === "inbox") return "inbox";
  return "active";
}

function moveStatusForTarget(ticket: Ticket, target: MoveTarget): TicketStatus {
  if (target === "inbox") return STATUS_BY_BUCKET.inbox;
  if (target === "archive") return ticket.status === "Storniert" ? "Storniert" : STATUS_BY_BUCKET.archive;
  if (ticket.status === "Rapport_erstellt" || ticket.status === "Storniert" || ticket.status === "Neu") return STATUS_BY_BUCKET.active;
  return ticket.status;
}

function ticketRecipient(ticket: Ticket): string {
  return ticket.customer_display_name || ticket.invoice_recipient_name || ticket.kunde_firma || ticket.kunde_name || "nicht angegeben";
}

function describeCustomerOption(row: Record<string, unknown>): string {
  const company = String(row.company_name || "").trim();
  const name = String(row.name || "").trim();
  const email = String(row.email || "").trim();
  const main = company || name || email || "Kunde";
  const secondary = [name && name !== main ? name : "", email].filter(Boolean).join(" \u00b7 ");
  return secondary ? `${main} \u00b7 ${secondary}` : main;
}

function buildSearchText(group: ObjectGroup): string {
  const tickets = [...group.inbox, ...group.active, ...group.archive];
  const ticketText = tickets
    .map((ticket) =>
      [
        formatTicketNumber(ticket.ticket_nummer),
        ticket.ticket_nummer,
        ticket.titel,
        ticket.kategorie,
        ticket.subkategorie || "",
        ticketRecipient(ticket),
        ticket.kunde_email || "",
        ticket.kunde_telefon || "",
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ");

  return normalizeText(
    [
      group.title,
      group.address,
      group.street || "",
      group.zip || "",
      group.city || "",
      ticketText,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function formatAddressForTicket(group: ObjectGroup): {
  objekt_adresse: string;
  objekt_strasse: string | null;
  objekt_plz: string | null;
  objekt_ort: string | null;
} {
  return {
    objekt_adresse: group.address,
    objekt_strasse: group.street,
    objekt_plz: group.zip,
    objekt_ort: group.city,
  };
}

function mergeAddress(current: ObjectGroup, next: AddressParts): ObjectGroup {
  const street = current.street || next.street || null;
  const zip = current.zip || next.zip || null;
  const city = current.city || next.city || null;
  return {
    ...current,
    street,
    zip,
    city,
    address: composeAddress({ street, zip, city }, next.fallback || current.address),
  };
}

function toGroups(rows: Ticket[]): ObjectGroup[] {
  const ordered = [...rows].sort((a, b) => {
    const idWeight = Number(Boolean(String(b.object_id || "").trim())) - Number(Boolean(String(a.object_id || "").trim()));
    if (idWeight !== 0) return idWeight;
    return ticketActivityTime(b) - ticketActivityTime(a);
  });

  const map = new Map<string, ObjectGroup>();
  const storedObjectByAddress = new Map<string, string>();

  for (const ticket of ordered) {
    const objectId = String(ticket.object_id || "").trim();
    const parts = getAddressParts(ticket);
    const address = composeAddress(parts, parts.fallback);
    const addressKey = addressKeyForParts(parts);
    const bucket = resolveBucket(ticket);

    let key = objectId ? `id:${objectId}` : "";
    if (!key) {
      if (addressKey && storedObjectByAddress.has(addressKey)) {
        key = String(storedObjectByAddress.get(addressKey) || "");
      } else if (addressKey) {
        key = `adr:${addressKey}`;
      } else {
        key = `ticket:${ticket.id}`;
      }
    }

    let group = map.get(key);
    if (!group) {
      group = {
        key,
        objectId: objectId || null,
        customerId: null,
        requesterUserId: null,
        title: getObjectTitle(ticket),
        address,
        street: parts.street || null,
        zip: parts.zip || null,
        city: parts.city || null,
        isActive: true,
        inbox: [],
        active: [],
        archive: [],
        latestAt: ticketActivityAt(ticket) || ticket.created_at,
      };
      map.set(key, group);
    } else {
      group = mergeAddress(group, parts);
      if (!group.objectId && objectId) group.objectId = objectId;
      if (ticketActivityTime(ticket) > new Date(group.latestAt).getTime()) {
        group.latestAt = ticketActivityAt(ticket) || ticket.created_at;
      }
      map.set(key, group);
    }

    group[bucket].push(ticket);

    if (group.objectId && addressKey && !storedObjectByAddress.has(addressKey)) {
      storedObjectByAddress.set(addressKey, key);
    }
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      inbox: [...group.inbox].sort((a, b) => ticketActivityTime(b) - ticketActivityTime(a)),
      active: [...group.active].sort((a, b) => ticketActivityTime(b) - ticketActivityTime(a)),
      archive: [...group.archive].sort((a, b) => ticketActivityTime(b) - ticketActivityTime(a)),
    }))
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}

async function loadBucketTickets(token: string, bucket: BucketKey): Promise<Ticket[]> {
  const params = {
    bucket,
    hydrate_customers: "0" as const,
    sort: "created_desc",
    page_size: "200",
  };

  const first = await adminTickets(token, { ...params, page: "1" });
  const totalPages = Math.max(1, Number(first.page_count || 1));
  if (totalPages <= 1) return first.items;

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      adminTickets(token, { ...params, page: String(index + 2) })
    )
  );

  return [first, ...remaining].flatMap((page) => page.items);
}

async function loadCustomerAccessOptions(): Promise<CustomerAccessOption[]> {
  const customerRes = await supabase
    .from("customers")
    .select("id,name,company_name,email,auth_user_id")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (customerRes.error) throw customerRes.error;

  return ((customerRes.data || []) as Record<string, unknown>[])
    .map((row) => ({
      id: String(row.id || "").trim(),
      label: describeCustomerOption(row),
      authUserId: String(row.auth_user_id || "").trim() || null,
    }))
    .filter((row) => Boolean(row.id))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}

async function loadObjectMeta(objectIds: string[]): Promise<Map<string, ObjectMeta>> {
  const ids = [...new Set(objectIds.map((value) => String(value || "").trim()).filter(Boolean))];
  const metaMap = new Map<string, ObjectMeta>();
  if (!ids.length) return metaMap;

  try {
    const direct = await supabase.from("objects").select("id,name,customer_id,requester_user_id,street,zip,city,is_active").in("id", ids);
    if (direct.error) throw direct.error;
    for (const row of direct.data || []) {
      const typed = row as {
        id?: string;
        name?: string | null;
        customer_id?: string | null;
        requester_user_id?: string | null;
        street?: string | null;
        zip?: string | null;
        city?: string | null;
        is_active?: boolean | null;
      };
      const id = String(typed.id || "").trim();
      if (!id) continue;
      metaMap.set(id, {
        name: String(typed.name || "").trim(),
        customerId: String(typed.customer_id || "").trim() || null,
        requesterUserId: String(typed.requester_user_id || "").trim() || null,
        street: String(typed.street || "").trim() || null,
        zip: String(typed.zip || "").trim() || null,
        city: String(typed.city || "").trim() || null,
        isActive: typed.is_active !== false,
      });
    }
    return metaMap;
  } catch {
    try {
      const namesRes = await supabase.functions.invoke("admin-object-actions", {
        body: { action: "get_object_names", object_ids: ids },
      });
      if (namesRes.error) throw namesRes.error;
      const namesData = namesRes.data as { error?: string; items?: Array<{ id?: string; name?: string }> } | null;
      if (namesData?.error) throw new Error(namesData.error);
      for (const row of namesData?.items || []) {
        const id = String(row?.id || "").trim();
        if (!id) continue;
        metaMap.set(id, {
          name: String(row?.name || "").trim(),
          customerId: null,
          requesterUserId: null,
          street: null,
          zip: null,
          city: null,
          isActive: true,
        });
      }
    } catch {
      return metaMap;
    }
  }

  return metaMap;
}

function KpiCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "inbox" | "active" | "archive" }) {
  return (
    <article
      className={clsx(
        "rounded-xl border px-3 py-2 text-center",
        tone === "inbox" && "border-electric-300/30",
        tone === "active" && "border-amber-300/30",
        tone === "archive" && "border-emerald-300/30",
        tone === "default" && "border-[var(--line)]"
      )}
    >
      <p className="text-[11px] text-[var(--text-soft)]">{label}</p>
      <p
        className={clsx(
          "text-lg font-bold",
          tone === "inbox" && "text-electric-200",
          tone === "active" && "text-amber-200",
          tone === "archive" && "text-emerald-200",
          tone === "default" && "text-white"
        )}
      >
        {value}
      </p>
    </article>
  );
}

function TicketBucketCard({
  bucket,
  rows,
  moveBusy,
  onOpen,
  onMove,
}: {
  bucket: BucketKey;
  rows: Ticket[];
  moveBusy: Record<string, boolean>;
  onOpen: (id: string) => void;
  onMove: (ticket: Ticket, target: MoveTarget) => void;
}) {
  const title = BUCKET_LABELS[bucket];
  const visibleRows = rows.slice(0, DISPLAY_TICKET_LIMIT);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-slate-900/35 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-electric-200">
          {title} ({rows.length})
        </p>
        {rows.length > DISPLAY_TICKET_LIMIT ? (
          <span className="text-[11px] text-[var(--text-soft)]">+{rows.length - DISPLAY_TICKET_LIMIT} weitere</span>
        ) : null}
      </div>

      {!rows.length ? (
        <p className="mt-3 text-sm text-[var(--text-soft)]">Keine Eintr\u00e4ge.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {visibleRows.map((ticket) => (
            <article key={ticket.id} className="rounded-xl border border-[var(--line)]/80 bg-slate-950/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{formatTicketNumber(ticket.ticket_nummer)}</p>
                  <p className="text-xs text-[var(--text-soft)] break-words">{ticket.titel || ticket.subkategorie || ticket.kategorie || "-"}</p>
                </div>
                <RequestTypeBadge value={ticket.request_type || ticket.anfrageart} />
              </div>

              <p className="mt-2 text-xs text-[var(--text-soft)] break-words">
                {ticketRecipient(ticket)}
                {ticket.kunde_email ? ` \u00b7 ${ticket.kunde_email}` : ""}
              </p>
              <p className="mt-1 text-xs text-[var(--text-soft)]">
                {ticket.kategorie}
                {ticket.subkategorie ? ` \u00b7 ${ticket.subkategorie}` : ""}
                {ticket.dringlichkeit ? ` \u00b7 ${ticket.dringlichkeit}` : ""}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusChip status={ticket.status} />
                <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--text-soft)]">
                  {dateTime(ticketActivityAt(ticket))}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="w-full px-3 py-2 text-sm sm:w-auto"
                  onClick={() => onOpen(ticket.id)}
                >
                  \u00d6ffnen
                </Button>
                {(Object.keys(BUCKET_LABELS) as BucketKey[])
                  .filter((target) => target !== bucket)
                  .map((target) => (
                    <button
                      key={target}
                      type="button"
                      disabled={moveBusy[ticket.id]}
                      onClick={() => onMove(ticket, target)}
                      className="w-full rounded-full border border-amber-300/35 px-3 py-2 text-xs font-semibold text-amber-200 transition-colors hover:text-white disabled:opacity-50 sm:w-auto"
                    >
                      {BUCKET_LABELS[target]}
                    </button>
                  ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminObjectsPage() {
  const outlet = useOutletContext<{ token?: string } | undefined>();
  const token = outlet?.token ?? "";
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [toast, setToast] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [query, setQuery] = React.useState("");
  const [allTickets, setAllTickets] = React.useState<Ticket[]>([]);
  const [groups, setGroups] = React.useState<ObjectGroup[]>([]);
  const [moveBusy, setMoveBusy] = React.useState<Record<string, boolean>>({});
  const [renameBusy, setRenameBusy] = React.useState<Record<string, boolean>>({});
  const [assignBusy, setAssignBusy] = React.useState<Record<string, boolean>>({});
  const [deleteBusy, setDeleteBusy] = React.useState<Record<string, boolean>>({});
  const [pendingObjectAction, setPendingObjectAction] = React.useState<{
    group: ObjectGroup;
    action: "delete" | "archive" | "restore";
  } | null>(null);
  const [objectActionError, setObjectActionError] = React.useState("");
  const [renameDraft, setRenameDraft] = React.useState<Record<string, string>>({});
  const [assignDraft, setAssignDraft] = React.useState<Record<string, string>>({});
  const [customerOptions, setCustomerOptions] = React.useState<CustomerAccessOption[]>([]);
  const [customerDraft, setCustomerDraft] = React.useState<Record<string, string>>({});
  const [customerBusy, setCustomerBusy] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const load = React.useCallback(async () => {
    if (!token) {
      setError(SESSION_EXPIRED_MESSAGE);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [inboxRows, activeRows, archiveRows, nextCustomerOptions] = await Promise.all([
        loadBucketTickets(token, "inbox"),
        loadBucketTickets(token, "active"),
        loadBucketTickets(token, "archive"),
        loadCustomerAccessOptions().catch(() => []),
      ]);

      const unique = new Map<string, Ticket>();
      for (const ticket of [...inboxRows, ...activeRows, ...archiveRows]) {
        unique.set(ticket.id, ticket);
      }

      const rows = [...unique.values()];
      const objectIds = rows.map((ticket) => String(ticket.object_id || "").trim()).filter(Boolean);
      const objectMetaMap = await loadObjectMeta(objectIds);

      const grouped = toGroups(rows).map((group) => {
        const meta = group.objectId ? objectMetaMap.get(group.objectId) : null;
        const street = meta?.street || group.street;
        const zip = meta?.zip || group.zip;
        const city = meta?.city || group.city;

        return {
          ...group,
          title: meta?.name || group.title,
          customerId: meta?.customerId || null,
          requesterUserId: meta?.requesterUserId || null,
          street,
          zip,
          city,
          isActive: meta?.isActive ?? group.isActive,
          address: composeAddress({ street, zip, city }, group.address),
        };
      });

      setAllTickets(rows);
      setGroups(grouped);
      setCustomerOptions(nextCustomerOptions);
      setRenameDraft(Object.fromEntries(grouped.map((group) => [group.key, group.title])));
      setAssignDraft((prev) => Object.fromEntries(grouped.map((group) => [group.key, prev[group.key] || ""])));
      setCustomerDraft(Object.fromEntries(grouped.map((group) => [group.key, group.customerId || ""])));
    } catch (err) {
      setError(toUserMessage(err, "Objekt\u00fcbersicht konnte nicht geladen werden."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function moveTicket(ticket: Ticket, target: MoveTarget) {
    if (!token) return;

    setMoveBusy((prev) => ({ ...prev, [ticket.id]: true }));
    try {
      const payload: UpdateTicketPayload = {
        bucket: target,
        status: moveStatusForTarget(ticket, target),
      };
      await updateTicket(token, ticket.id, payload);
      setToast({ kind: "ok", text: `${formatTicketNumber(ticket.ticket_nummer)} verschoben nach ${BUCKET_LABELS[target]}.` });
      await load();
    } catch (err) {
      setToast({ kind: "error", text: toUserMessage(err, "Ticket konnte nicht verschoben werden.") });
    } finally {
      setMoveBusy((prev) => ({ ...prev, [ticket.id]: false }));
    }
  }

  async function ensureObjectForGroup(group: ObjectGroup, preferredName?: string): Promise<string> {
    if (group.objectId) return group.objectId;

    const ensure = await supabase.functions.invoke("admin-object-actions", {
      body: {
        action: "ensure_object",
        object_id: null,
        name: String(preferredName || renameDraft[group.key] || group.title || "Objekt").trim(),
        address: group.address,
      },
    });
    if (ensure.error) throw ensure.error;

    const ensureData = ensure.data as { error?: string; object_id?: string } | null;
    if (ensureData?.error) throw new Error(ensureData.error);

    const objectId = String(ensureData?.object_id || "").trim();
    if (!objectId) throw new Error("Objekt konnte nicht angelegt werden.");

    const groupTickets = [...group.inbox, ...group.active, ...group.archive];
    for (const ticket of groupTickets) {
      const assigned = await supabase.functions.invoke("admin-object-actions", {
        body: { action: "assign_ticket", ticket_id: ticket.id, object_id: objectId },
      });
      if (assigned.error) throw assigned.error;
      const assignedData = assigned.data as { error?: string } | null;
      if (assignedData?.error) throw new Error(assignedData.error);
    }

    return objectId;
  }

  async function renameObject(group: ObjectGroup) {
    const nextName = String(renameDraft[group.key] || "").trim();
    if (!nextName) {
      setToast({ kind: "error", text: "Bitte einen Namen f\u00fcr das Objekt eingeben." });
      return;
    }

    setRenameBusy((prev) => ({ ...prev, [group.key]: true }));
    try {
      const objectId = await ensureObjectForGroup(group, nextName);
      try {
        const invoked = await supabase.functions.invoke("admin-object-actions", {
          body: { action: "rename_object", object_id: objectId, name: nextName },
        });
        if (invoked.error) throw invoked.error;
        const invokedData = invoked.data as { error?: string } | null;
        if (invokedData?.error) throw new Error(invokedData.error);
      } catch {
        const fallback = await supabase.from("objects").update({ name: nextName, updated_at: new Date().toISOString() }).eq("id", objectId);
        if (fallback.error) throw fallback.error;
      }

      setToast({ kind: "ok", text: "Objektname gespeichert." });
      await load();
    } catch (err) {
      setToast({ kind: "error", text: toUserMessage(err, "Objekt konnte nicht umbenannt werden.") });
    } finally {
      setRenameBusy((prev) => ({ ...prev, [group.key]: false }));
    }
  }

  async function assignTicketToObject(group: ObjectGroup) {
    const rawLookup = String(assignDraft[group.key] || "").trim();
    if (!rawLookup) {
      setToast({ kind: "error", text: "Bitte Ticketnummer oder Ticket-ID eingeben." });
      return;
    }

    const normalizedLookup = normalizeLookupToken(rawLookup);
    const targetTicket =
      allTickets.find((ticket) => normalizeLookupToken(formatTicketNumber(ticket.ticket_nummer)) === normalizedLookup) ||
      allTickets.find((ticket) => normalizeLookupToken(ticket.ticket_nummer) === normalizedLookup) ||
      allTickets.find((ticket) => normalizeLookupToken(ticket.id) === normalizedLookup);

    if (!targetTicket) {
      setToast({ kind: "error", text: "Ticket wurde nicht gefunden." });
      return;
    }

    setAssignBusy((prev) => ({ ...prev, [group.key]: true }));
    try {
      const objectId = await ensureObjectForGroup(group);
      try {
        const assigned = await supabase.functions.invoke("admin-object-actions", {
          body: { action: "assign_ticket", ticket_id: targetTicket.id, object_id: objectId },
        });
        if (assigned.error) throw assigned.error;
        const assignedData = assigned.data as { error?: string } | null;
        if (assignedData?.error) throw new Error(assignedData.error);
      } catch {
        const fallback = await supabase.from("tickets").update({ object_id: objectId, ...formatAddressForTicket(group) }).eq("id", targetTicket.id);
        if (fallback.error) throw fallback.error;
      }

      await updateTicket(token, targetTicket.id, formatAddressForTicket(group));
      setAssignDraft((prev) => ({ ...prev, [group.key]: "" }));
      setToast({ kind: "ok", text: `${formatTicketNumber(targetTicket.ticket_nummer)} wurde dem Objekt zugeordnet.` });
      await load();
    } catch (err) {
      setToast({ kind: "error", text: toUserMessage(err, "Ticket konnte nicht zugeordnet werden.") });
    } finally {
      setAssignBusy((prev) => ({ ...prev, [group.key]: false }));
    }
  }

  async function assignCustomerToObject(group: ObjectGroup) {
    const selectedCustomerId = String(customerDraft[group.key] || "").trim();
    const selectedCustomer = customerOptions.find((item) => item.id === selectedCustomerId) || null;

    setCustomerBusy((prev) => ({ ...prev, [group.key]: true }));
    try {
      const objectId = await ensureObjectForGroup(group);
      const updateRes = await supabase
        .from("objects")
        .update({
          customer_id: selectedCustomerId || null,
          requester_user_id: selectedCustomer?.authUserId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", objectId);

      if (updateRes.error) throw updateRes.error;

      setToast({
        kind: "ok",
        text: selectedCustomerId
          ? selectedCustomer?.authUserId
            ? "Kunde und Kundenlogin wurden dem Objekt zugewiesen."
            : "Kunde zugewiesen. Das Login ist noch nicht mit einem Benutzerkonto verkn\u00fcpft."
          : "Kundenzuweisung vom Objekt entfernt.",
      });
      await load();
    } catch (err) {
      setToast({ kind: "error", text: toUserMessage(err, "Kundenzuweisung konnte nicht gespeichert werden.") });
    } finally {
      setCustomerBusy((prev) => ({ ...prev, [group.key]: false }));
    }
  }

  async function runObjectLifecycleAction(group: ObjectGroup, action: "delete" | "archive" | "restore") {
    if (!group.objectId) {
      setToast({ kind: "error", text: "Dieses Objekt kann nicht gel\u00f6scht werden, weil noch keine Objekt-ID existiert." });
      return;
    }

    setDeleteBusy((prev) => ({ ...prev, [group.key]: true }));
    setObjectActionError("");
    try {
      await adminRecordAction(token, {
        action: action === "delete" ? "delete_object" : action === "archive" ? "archive_object" : "restore_object",
        object_id: group.objectId,
      });

      const successText = action === "delete"
        ? "Objekt endgültig gelöscht."
        : action === "archive"
          ? "Objekt deaktiviert."
          : "Objekt wieder aktiviert.";
      setToast({ kind: "ok", text: successText });
      setPendingObjectAction(null);
      await load();
    } catch (err) {
      const fallback = action === "delete"
        ? "Objekt konnte nicht gelöscht werden."
        : "Objektstatus konnte nicht geändert werden.";
      const message = toUserMessage(err, fallback);
      setObjectActionError(message);
      setToast({ kind: "error", text: message });
    } finally {
      setDeleteBusy((prev) => ({ ...prev, [group.key]: false }));
    }
  }

  const visibleGroups = React.useMemo(() => {
    const q = normalizeText(query);
    if (!q) return groups;
    return groups.filter((group) => buildSearchText(group).includes(q));
  }, [groups, query]);

  const kpis = React.useMemo(
    () =>
      visibleGroups.reduce(
        (acc, group) => {
          acc.objects += 1;
          acc.inbox += group.inbox.length;
          acc.active += group.active.length;
          acc.archive += group.archive.length;
          return acc;
        },
        { objects: 0, inbox: 0, active: 0, archive: 0 }
      ),
    [visibleGroups]
  );

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Objekt-Leitstand"
        subtitle="Objekte, Ticket-Zuordnung und Kundenfreigaben sauber verwalten."
      />

      <section className="glass rounded-xl2 border border-[var(--line)] p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_repeat(4,96px)] xl:items-end">
          <label className="grid gap-1 text-xs text-[var(--text-soft)]">
            Objekt suchen
            <input
              className="rounded-xl border border-[var(--line)] bg-slate-900/55 px-3 py-2 text-sm text-white"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, Stra\u00dfe, Ort, Kunde oder Ticket ..."
            />
          </label>
          <KpiCard label="Objekte" value={kpis.objects} />
          <KpiCard label="Inbox" value={kpis.inbox} tone="inbox" />
          <KpiCard label="Offen" value={kpis.active} tone="active" />
          <KpiCard label="Archiv" value={kpis.archive} tone="archive" />
        </div>
      </section>

      <section className="glass rounded-xl2 border border-[var(--line)] p-4">
        {loading ? <LoadingSpinner label="Objektstruktur wird geladen..." /> : null}
        {error ? <p className="rounded-xl border border-rose-300/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
        {error === SESSION_EXPIRED_MESSAGE ? (
          <div className="pt-2">
            <Button variant="secondary" className="px-3 py-1 text-sm" onClick={() => navigate("/admin/login")}>
              Erneut anmelden
            </Button>
          </div>
        ) : null}
        {!loading && !error && !visibleGroups.length ? <EmptyState text="Keine passenden Objekte gefunden." /> : null}

        {!loading && !error ? (
          <div className="grid gap-4">
            {visibleGroups.map((group) => {
              const selectedCustomerId = String(customerDraft[group.key] || group.customerId || "").trim();
              const selectedCustomer = customerOptions.find((option) => option.id === selectedCustomerId) || null;
              const loginLinked = Boolean(selectedCustomer?.authUserId || group.requesterUserId);
              const isPersisted = Boolean(group.objectId);

              return (
                <article key={group.key} className="render-panel rounded-xl border border-[var(--line)] bg-slate-950/35 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">{group.title}</h2>
                        <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--text-soft)]">
                          {isPersisted ? "Objekt gespeichert" : "Nur aus Ticketdaten erkannt"}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-soft)]">{group.address}</p>
                      <p className="text-xs text-[var(--text-soft)]">Letzte Aktivit\u00e4t: {dateTime(group.latestAt)}</p>
                      <div className="flex flex-wrap gap-2 pt-1 text-xs">
                        <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[var(--text-soft)]">
                          Kundenfreigabe: {selectedCustomer ? selectedCustomer.label : "nicht zugewiesen"}
                        </span>
                        <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[var(--text-soft)]">
                          {loginLinked ? "Login verkn\u00fcpft" : "ohne Login-Zuordnung"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-electric-300/40 px-2.5 py-1 text-electric-200">Inbox: {group.inbox.length}</span>
                      <span className="rounded-full border border-amber-300/40 px-2.5 py-1 text-amber-200">Offen: {group.active.length}</span>
                      <span className="rounded-full border border-emerald-300/40 px-2.5 py-1 text-emerald-200">Archiv: {group.archive.length}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                    <section className="rounded-xl border border-[var(--line)] bg-slate-900/35 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-electric-200">Objektdaten</p>
                      <label className="mt-3 grid gap-1 text-xs text-[var(--text-soft)]">
                        Objektname
                        <input
                          className="rounded-xl border border-[var(--line)] bg-slate-900/55 px-3 py-2 text-sm text-white disabled:opacity-50"
                          value={renameDraft[group.key] || ""}
                          onChange={(event) => setRenameDraft((prev) => ({ ...prev, [group.key]: event.target.value }))}
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          className="w-full px-3 py-2 text-sm sm:w-auto"
                          disabled={Boolean(renameBusy[group.key])}
                          onClick={() => void renameObject(group)}
                        >
                          {renameBusy[group.key] ? "Speichert..." : "Speichern"}
                        </Button>
                        <Button
                          variant="secondary"
                          className="w-full px-3 py-2 text-sm sm:w-auto"
                          disabled={!group.objectId || Boolean(deleteBusy[group.key])}
                          onClick={() => {
                            setObjectActionError("");
                            setPendingObjectAction({ group, action: group.isActive ? "archive" : "restore" });
                          }}
                        >
                          {group.isActive ? "Deaktivieren" : "Aktivieren"}
                        </Button>
                        <Button
                          variant="danger"
                          className="w-full px-3 py-2 text-sm sm:w-auto"
                          disabled={!group.objectId || Boolean(deleteBusy[group.key])}
                          onClick={() => {
                            setObjectActionError("");
                            setPendingObjectAction({ group, action: "delete" });
                          }}
                        >
                          {deleteBusy[group.key] ? "L\u00f6scht..." : "L\u00f6schen"}
                        </Button>
                      </div>
                      <p className="mt-3 text-[11px] text-[var(--text-soft)]">
                        {isPersisted
                          ? "Das Objekt ist gespeichert und kann direkt weiter gepflegt werden."
                          : "Dieses Objekt wird aktuell aus vorhandenen Ticketdaten gebildet und bei der ersten Speicherung dauerhaft angelegt."}
                      </p>
                    </section>

                    <section className="rounded-xl border border-[var(--line)] bg-slate-900/35 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-electric-200">Kundenfreigabe</p>
                      <label className="mt-3 grid gap-1 text-xs text-[var(--text-soft)]">
                        Kunde / Kundenkonto
                        <select
                          className="rounded-xl border border-[var(--line)] bg-slate-900/55 px-3 py-2 text-sm text-white disabled:opacity-50"
                          value={selectedCustomerId}
                          onChange={(event) => setCustomerDraft((prev) => ({ ...prev, [group.key]: event.target.value }))}
                        >
                          <option value="">Nicht zugewiesen</option>
                          {customerOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          className="w-full px-3 py-2 text-sm sm:w-auto"
                          disabled={Boolean(customerBusy[group.key])}
                          onClick={() => void assignCustomerToObject(group)}
                        >
                          {customerBusy[group.key] ? "Speichert..." : "Freigabe speichern"}
                        </Button>
                      </div>
                      <p className="mt-3 text-[11px] text-[var(--text-soft)]">
                        Nur zugewiesene Kundenkonten sehen dieses Objekt im Kundenlogin.
                      </p>
                      {!customerOptions.length ? (
                        <p className="mt-2 text-[11px] text-amber-200">Aktuell wurden keine Kundenkonten geladen.</p>
                      ) : null}
                    </section>

                    <section className="rounded-xl border border-[var(--line)] bg-slate-900/35 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-electric-200">Ticket zuordnen</p>
                      <label className="mt-3 grid gap-1 text-xs text-[var(--text-soft)]">
                        Ticketnummer oder Ticket-ID
                        <input
                          className="rounded-xl border border-[var(--line)] bg-slate-900/55 px-3 py-2 text-sm text-white disabled:opacity-50"
                          value={assignDraft[group.key] || ""}
                          onChange={(event) => setAssignDraft((prev) => ({ ...prev, [group.key]: event.target.value }))}
                          placeholder="z. B. KPT-20260626-0002"
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          className="w-full px-3 py-2 text-sm sm:w-auto"
                          disabled={Boolean(assignBusy[group.key])}
                          onClick={() => void assignTicketToObject(group)}
                        >
                          {assignBusy[group.key] ? "Ordnet zu..." : "Ticket hinzuf\u00fcgen"}
                        </Button>
                      </div>
                      <p className="mt-3 text-[11px] text-[var(--text-soft)]">
                        Sowohl formatierte Ticketnummern als auch interne Ticket-IDs werden erkannt.
                      </p>
                    </section>
                  </div>

                  <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                    <TicketBucketCard bucket="inbox" rows={group.inbox} moveBusy={moveBusy} onOpen={(id) => navigate(`/admin/tickets/${id}`)} onMove={moveTicket} />
                    <TicketBucketCard bucket="active" rows={group.active} moveBusy={moveBusy} onOpen={(id) => navigate(`/admin/tickets/${id}`)} onMove={moveTicket} />
                    <TicketBucketCard bucket="archive" rows={group.archive} moveBusy={moveBusy} onOpen={(id) => navigate(`/admin/tickets/${id}`)} onMove={moveTicket} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      {toast ? <Toast kind={toast.kind} text={toast.text} /> : null}

      <ConfirmDialog
        open={Boolean(pendingObjectAction)}
        title={
          pendingObjectAction?.action === "delete"
            ? "Eintrag endgültig löschen?"
            : pendingObjectAction?.action === "archive"
              ? "Objekt deaktivieren?"
              : "Objekt wieder aktivieren?"
        }
        description={
          pendingObjectAction?.action === "delete"
            ? "Diese Aktion kann nicht rückgängig gemacht werden. Zugeordnete Tickets oder Notizen verhindern die Löschung."
            : pendingObjectAction?.action === "archive"
              ? "Das Objekt bleibt mit allen Zuordnungen erhalten und kann später wieder aktiviert werden."
              : "Das Objekt wird wieder für die laufende Verwaltung aktiviert."
        }
        subject={pendingObjectAction?.group.title}
        error={objectActionError}
        confirmLabel={
          pendingObjectAction?.action === "delete"
            ? "Endgültig löschen"
            : pendingObjectAction?.action === "archive"
              ? "Objekt deaktivieren"
              : "Objekt aktivieren"
        }
        busy={Boolean(pendingObjectAction && deleteBusy[pendingObjectAction.group.key])}
        onClose={() => {
          setObjectActionError("");
          setPendingObjectAction(null);
        }}
        onConfirm={() => {
          if (pendingObjectAction) {
            void runObjectLifecycleAction(pendingObjectAction.group, pendingObjectAction.action);
          }
        }}
      />
    </div>
  );
}
