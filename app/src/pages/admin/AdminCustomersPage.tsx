import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RequestTypeBadge } from "@/components/ui/RequestTypeBadge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusChip } from "@/components/ui/StatusChip";
import { Toast } from "@/components/ui/Toast";
import { adminTickets, createTicket, deleteCustomerTickets, deleteTicket } from "@/features/apiClient";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  normalizeCustomerType,
  resolveCustomerDisplayName,
  resolveInvoiceRecipientName,
  sanitizeCustomerText,
} from "@/lib/customer";
import { SESSION_EXPIRED_MESSAGE, toUserMessage } from "@/lib/errors";
import { dateTime, formatTicketNumber, formatTimeRange } from "@/lib/format";
import { requestTypeToAnfrageart } from "@/lib/requestType";
import { supabase } from "@/lib/supabase";
import { RequestType, Ticket, TicketWizardPayload } from "@/types/domain";

type CustomerTypeFilter = "all" | "privat" | "firma";
type CustomerTab = "tickets" | "contacts" | "notes";
type CustomerType = "privat" | "firma";

type CustomerFormState = {
  customerType: CustomerType;
  displayName: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
};

type TicketFormState = {
  requestType: RequestType;
  category: string;
  subcategory: string;
  urgency: "niedrig" | "mittel" | "hoch" | "kritisch";
  date: string;
  timeFrom: string;
  timeTo: string;
  street: string;
  zip: string;
  city: string;
  accessNotes: string;
  description: string;
};

type CustomerNode = {
  key: string;
  customerId: string | null;
  customerType: "privat" | "firma" | null;
  displayName: string;
  invoiceRecipientName: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  addressLine: string;
  cities: string[];
  tickets: Ticket[];
  ticketsCount: number;
  lastTicketAt: number;
};

type CustomerSeed = {
  id: string;
  customerType: "privat" | "firma" | null;
  displayName: string;
  invoiceRecipientName: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  addressLine: string;
  city: string;
  createdAtTs: number;
};

function createdAtTs(ticket: Ticket): number {
  const t = new Date(ticket.created_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

function ticketCity(ticket: Ticket): string {
  return sanitizeCustomerText(ticket.objekt_ort || ticket.ort || "");
}

function ticketAddressLine(ticket: Ticket): string {
  const street = sanitizeCustomerText(ticket.objekt_strasse || "");
  const zip = sanitizeCustomerText(ticket.objekt_plz || ticket.plz || "");
  const city = sanitizeCustomerText(ticket.objekt_ort || ticket.ort || "");
  const line2 = [zip, city].filter(Boolean).join(" ");
  return [street, line2].filter(Boolean).join(", ");
}

function ticketAppointmentText(ticket: Ticket): string {
  if (!ticket.terminwunsch) return "Kein Termin";
  const timeRange = formatTimeRange(ticket.zeitfenster_von, ticket.zeitfenster_bis);
  return timeRange !== "-" ? `${ticket.terminwunsch} · ${timeRange}` : ticket.terminwunsch;
}

function customerKey(ticket: Ticket): string {
  const customerId = String(ticket.customer_id || "").trim();
  if (customerId) return `customer:${customerId}`;
  const email = normalizeCustomerEmail(ticket.kunde_email);
  if (email) return `mail:${email}`;
  const phone = normalizeCustomerPhone(ticket.kunde_telefon);
  if (phone) return `phone:${phone}`;
  const display = resolveCustomerDisplayName({
    customerType: ticket.customer_type,
    invoiceRecipientName: ticket.invoice_recipient_name,
    kundeName: ticket.kunde_name,
    kundeFirma: ticket.kunde_firma,
  });
  if (display) return `name:${display.toLowerCase()}`;
  return `ticket:${ticket.id}`;
}

function mergeValue(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalized = sanitizeCustomerText(value);
    if (normalized) return normalized;
  }
  return "";
}

function splitAddress(addressLine: string): { street: string; zip: string; city: string } {
  const raw = String(addressLine || "").trim();
  if (!raw) return { street: "", zip: "", city: "" };

  const zipMatch = raw.match(/(\d{5})\s+(.+)$/);
  if (!zipMatch) return { street: raw, zip: "", city: "" };

  const street = raw.slice(0, zipMatch.index).replace(/,\s*$/, "").trim();
  return {
    street,
    zip: zipMatch[1].trim(),
    city: zipMatch[2].trim(),
  };
}

function defaultCustomerForm(): CustomerFormState {
  return {
    customerType: "privat",
    displayName: "",
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    street: "",
    zip: "",
    city: "",
  };
}

function defaultTicketForm(node: CustomerNode): TicketFormState {
  const split = splitAddress(node.addressLine);
  return {
    requestType: "direct",
    category: "Einzelauftrag",
    subcategory: "",
    urgency: "niedrig",
    date: "",
    timeFrom: "",
    timeTo: "",
    street: split.street,
    zip: split.zip,
    city: node.cities[0] || split.city,
    accessNotes: "",
    description: "",
  };
}

function buildCustomerTree(tickets: Ticket[]): CustomerNode[] {
  const map = new Map<string, CustomerNode>();

  for (const ticket of tickets) {
    const key = customerKey(ticket);
    const type = normalizeCustomerType(ticket.customer_type);
    const invoiceRecipientName = resolveInvoiceRecipientName({
      customerType: type,
      invoiceRecipientName: ticket.invoice_recipient_name,
      kundeName: ticket.kunde_name,
      kundeFirma: ticket.kunde_firma,
    });
    const companyName = sanitizeCustomerText(ticket.kunde_firma);
    const contactPerson = mergeValue(ticket.ansprechpartner, type === "firma" ? ticket.kunde_name : "");
    const fallbackTicketNumber = String(ticket.ticket_nummer || "").trim();
    const fallbackDisplayName = fallbackTicketNumber ? `Kunde ${fallbackTicketNumber}` : "Kunde ohne Nummer";
    const displayName =
      mergeValue(
        resolveCustomerDisplayName({
          customerType: type,
          invoiceRecipientName,
          kundeName: ticket.kunde_name,
          kundeFirma: ticket.kunde_firma,
        }),
        invoiceRecipientName,
        ticket.kunde_name,
        ticket.kunde_firma
      ) || fallbackDisplayName;
    const email = normalizeCustomerEmail(ticket.kunde_email);
    const phone = normalizeCustomerPhone(ticket.kunde_telefon);
    const addressLine = ticketAddressLine(ticket);
    const city = ticketCity(ticket);
    const ticketTs = createdAtTs(ticket);
    const current = map.get(key);

    if (!current) {
      map.set(key, {
        key,
        customerId: String(ticket.customer_id || "").trim() || null,
        customerType: type,
        displayName,
        invoiceRecipientName: invoiceRecipientName || displayName,
        companyName,
        contactPerson,
        email,
        phone,
        addressLine,
        cities: city ? [city] : [],
        tickets: [ticket],
        ticketsCount: 1,
        lastTicketAt: ticketTs,
      });
      continue;
    }

    current.customerId = current.customerId || (String(ticket.customer_id || "").trim() || null);
    current.customerType = current.customerType || type;
    current.displayName = mergeValue(current.displayName, displayName) || current.displayName;
    current.invoiceRecipientName =
      mergeValue(current.invoiceRecipientName, invoiceRecipientName, displayName) || current.invoiceRecipientName;
    current.companyName = mergeValue(current.companyName, companyName);
    current.contactPerson = mergeValue(current.contactPerson, contactPerson);
    current.email = mergeValue(current.email, email);
    current.phone = mergeValue(current.phone, phone);
    current.addressLine = mergeValue(current.addressLine, addressLine);
    if (city && !current.cities.includes(city)) current.cities.push(city);
    current.tickets.push(ticket);
    current.ticketsCount += 1;
    current.lastTicketAt = Math.max(current.lastTicketAt, ticketTs);
  }

  const nodes = Array.from(map.values()).map((node) => ({
    ...node,
    cities: [...node.cities].sort((a, b) => a.localeCompare(b, "de")),
    tickets: [...node.tickets].sort((a, b) => createdAtTs(b) - createdAtTs(a)),
  }));
  nodes.sort((a, b) => b.lastTicketAt - a.lastTicketAt);
  return nodes;
}

async function loadAllTickets(token: string): Promise<Ticket[]> {
  const pageSize = 250;
  const baseParams = {
    bucket: "all" as const,
    page_size: String(pageSize),
    hydrate_customers: "0" as const,
    sort: "created_desc" as const,
  };

  const first = await adminTickets(token, { ...baseParams, page: "1" });
  const pageCount = Math.min(Math.max(1, Number(first.page_count || 1)), 80);
  if (pageCount <= 1) return first.items;

  const remaining = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      adminTickets(token, { ...baseParams, page: String(index + 2) })
    )
  );

  return [first, ...remaining].flatMap((page) => page.items);
}

function asCustomerSeed(row: Record<string, unknown>): CustomerSeed {
  const customerType = normalizeCustomerType(String(row.customer_type || row.kunde_typ || "").trim());
  const displayName = mergeValue(
    String(row.display_name || ""),
    String(row.name || ""),
    String(row.invoice_recipient_name || "")
  );
  const companyName = mergeValue(String(row.company_name || ""), String(row.company || ""));
  const invoiceRecipientName = mergeValue(
    String(row.invoice_recipient_name || ""),
    companyName,
    displayName
  );
  const contactPerson = mergeValue(String(row.contact_person || ""), String(row.ansprechpartner || ""));
  const email = normalizeCustomerEmail(String(row.email || ""));
  const phone = normalizeCustomerPhone(String(row.phone || ""));
  const addressLine = mergeValue(
    String(row.address || ""),
    String(row.objekt_adresse || "")
  );
  const city = splitAddress(addressLine).city;
  const createdAtTs = Number.isFinite(new Date(String(row.created_at || "")).getTime())
    ? new Date(String(row.created_at || "")).getTime()
    : 0;

  return {
    id: String(row.id || "").trim(),
    customerType,
    displayName: displayName || invoiceRecipientName || "Kunde",
    invoiceRecipientName: invoiceRecipientName || displayName || "Kunde",
    companyName,
    contactPerson,
    email,
    phone,
    addressLine,
    city,
    createdAtTs,
  };
}

async function loadAllCustomers(): Promise<CustomerSeed[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (
      message.includes("permission denied") ||
      message.includes("not found in the schema cache") ||
      message.includes("does not exist")
    ) {
      return [];
    }
    throw new Error(error.message);
  }

  return ((data || []) as Record<string, unknown>[])
    .map(asCustomerSeed)
    .filter((row) => Boolean(row.id));
}

export default function AdminCustomersPage() {
  const outlet = useOutletContext<{ token?: string } | undefined>();
  const token = outlet?.token ?? "";
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [toast, setToast] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [customers, setCustomers] = React.useState<CustomerSeed[]>([]);
  const [q, setQ] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<CustomerTypeFilter>("all");
  const [cityFilter, setCityFilter] = React.useState("");
  const [activeTabs, setActiveTabs] = React.useState<Record<string, CustomerTab>>({});
  const [expandedCustomers, setExpandedCustomers] = React.useState<Record<string, boolean>>({});
  const [busyTickets, setBusyTickets] = React.useState<Record<string, boolean>>({});
  const [busyCustomers, setBusyCustomers] = React.useState<Record<string, boolean>>({});
  const [customerSaving, setCustomerSaving] = React.useState(false);
  const [customerForm, setCustomerForm] = React.useState<CustomerFormState>(defaultCustomerForm);
  const [ticketDraftByCustomer, setTicketDraftByCustomer] = React.useState<Record<string, TicketFormState>>({});
  const [ticketBusyByCustomer, setTicketBusyByCustomer] = React.useState<Record<string, boolean>>({});
  const qDebounced = useDebouncedValue(q, 350);

  const loadData = React.useCallback(async () => {
    if (!token) {
      setError(SESSION_EXPIRED_MESSAGE);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      const [rows, customerRows] = await Promise.all([loadAllTickets(token), loadAllCustomers()]);
      const dedup = new Map<string, Ticket>();
      for (const row of rows) dedup.set(row.id, row);
      const sorted = Array.from(dedup.values()).sort((a, b) => createdAtTs(b) - createdAtTs(a));
      setTickets(sorted);
      setCustomers(customerRows);
      const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      console.warn(`[perf] admin_customers_load: ${Math.max(0, endedAt - startedAt).toFixed(1)}ms`);
    } catch (err) {
      setError(toUserMessage(err, "Kundenstamm konnte nicht geladen werden."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const allCustomers = React.useMemo(() => {
    const base = buildCustomerTree(tickets);
    const byKey = new Map(base.map((node) => [node.key, node] as const));

    for (const customer of customers) {
      const keyById = `customer:${customer.id}`;
      if (byKey.has(keyById)) continue;

      const keyByMail = customer.email ? `mail:${customer.email}` : "";
      if (keyByMail && byKey.has(keyByMail)) continue;

      const keyByPhone = customer.phone ? `phone:${customer.phone}` : "";
      if (keyByPhone && byKey.has(keyByPhone)) continue;

      const key = keyById || keyByMail || keyByPhone || `seed:${customer.id}`;
      const newNode: CustomerNode = {
        key,
        customerId: customer.id,
        customerType: customer.customerType,
        displayName: customer.displayName,
        invoiceRecipientName: customer.invoiceRecipientName || customer.displayName,
        companyName: customer.companyName,
        contactPerson: customer.contactPerson,
        email: customer.email,
        phone: customer.phone,
        addressLine: customer.addressLine,
        cities: customer.city ? [customer.city] : [],
        tickets: [],
        ticketsCount: 0,
        lastTicketAt: customer.createdAtTs,
      };
      byKey.set(key, newNode);
    }

    return Array.from(byKey.values()).sort((a, b) => b.lastTicketAt - a.lastTicketAt);
  }, [tickets, customers]);
  const cityOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const customer of allCustomers) for (const city of customer.cities) set.add(city);
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "de"));
  }, [allCustomers]);

  const filteredCustomers = React.useMemo(() => {
    const qNorm = qDebounced.trim().toLowerCase();

    return allCustomers.filter((customer) => {
      if (typeFilter !== "all" && customer.customerType !== typeFilter) return false;
      if (cityFilter && !customer.cities.includes(cityFilter)) return false;

      if (!qNorm) return true;
      const haystack = [
        customer.displayName,
        customer.invoiceRecipientName,
        customer.companyName,
        customer.contactPerson,
        customer.email,
        customer.phone,
        customer.addressLine,
        ...customer.cities,
        ...customer.tickets.map((ticket) => ticket.ticket_nummer),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(qNorm);
    });
  }, [allCustomers, qDebounced, typeFilter, cityFilter]);

  const summary = React.useMemo(() => {
    const customers = filteredCustomers.length;
    const companies = filteredCustomers.filter((node) => node.customerType === "firma").length;
    const ticketsCount = filteredCustomers.reduce((sum, node) => sum + node.tickets.length, 0);
    return { customers, companies, tickets: ticketsCount };
  }, [filteredCustomers]);

  const customerTicketIdsByKey = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const node of allCustomers) map.set(node.key, node.tickets.map((ticket) => ticket.id));
    return map;
  }, [allCustomers]);

  async function removeSingleTicket(ticket: Ticket) {
    const ok = window.confirm(`Ticket ${ticket.ticket_nummer} wirklich löschen?`);
    if (!ok) return;

    setBusyTickets((prev) => ({ ...prev, [ticket.id]: true }));
    setError("");
    try {
      await deleteTicket(token, ticket.id);
      setTickets((prev) => prev.filter((row) => row.id !== ticket.id));
      setToast({ kind: "ok", text: `Ticket ${ticket.ticket_nummer} gelöscht.` });
    } catch (err) {
      const msg = toUserMessage(err, "Ticket konnte nicht gelöscht werden.");
      setError(msg);
      setToast({ kind: "error", text: msg });
    } finally {
      setBusyTickets((prev) => ({ ...prev, [ticket.id]: false }));
    }
  }

  async function removeCustomer(customer: CustomerNode) {
    const ticketIds = customerTicketIdsByKey.get(customer.key) || customer.tickets.map((ticket) => ticket.id);
    const toDelete = [...new Set(ticketIds)].filter(Boolean);
    if (!toDelete.length) return;

    const confirmText = window.prompt(
      `${customer.displayName} inkl. ${toDelete.length} Ticket(s) löschen.\nZur Bestätigung LOESCHEN eingeben:`,
      ""
    );
    if (confirmText !== "LOESCHEN") return;

    setBusyCustomers((prev) => ({ ...prev, [customer.key]: true }));
    setError("");
    try {
      const result = await deleteCustomerTickets(token, toDelete);
      const idSet = new Set(toDelete);
      setTickets((prev) => prev.filter((row) => !idSet.has(row.id)));
      setToast({ kind: "ok", text: `Kunde ${customer.displayName} gelöscht (${result.deleted} Ticket(s)).` });
    } catch (err) {
      const msg = toUserMessage(err, "Kunde konnte nicht gelöscht werden.");
      setError(msg);
      setToast({ kind: "error", text: msg });
    } finally {
      setBusyCustomers((prev) => ({ ...prev, [customer.key]: false }));
    }
  }

  function updateCustomerForm<K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) {
    setCustomerForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateTicketDraft(
    customerKey: string,
    patch: Partial<TicketFormState>
  ) {
    setTicketDraftByCustomer((prev) => {
      const currentNode = filteredCustomers.find((node) => node.key === customerKey);
      const base = prev[customerKey] || (currentNode ? defaultTicketForm(currentNode) : null);
      if (!base) return prev;
      return { ...prev, [customerKey]: { ...base, ...patch } };
    });
  }

  async function createCustomerManually() {
    const customerType = normalizeCustomerType(customerForm.customerType) || "privat";
    const displayName = sanitizeCustomerText(customerForm.displayName);
    const companyName = sanitizeCustomerText(customerForm.companyName);
    const contactPerson = sanitizeCustomerText(customerForm.contactPerson);
    const email = normalizeCustomerEmail(customerForm.email);
    const phone = normalizeCustomerPhone(customerForm.phone);

    if (!displayName && !companyName) {
      setToast({ kind: "error", text: "Bitte Name oder Firmenname angeben." });
      return;
    }
    if (!email && !phone) {
      setToast({ kind: "error", text: "Bitte mindestens E-Mail oder Telefon angeben." });
      return;
    }
    if (customerType === "firma" && !companyName) {
      setToast({ kind: "error", text: "Bei Kundentyp Firma ist der Firmenname Pflicht." });
      return;
    }

    const invoiceRecipientName = resolveInvoiceRecipientName({
      customerType,
      kundeName: displayName || contactPerson,
      kundeFirma: companyName,
    });
    const composedAddress = [sanitizeCustomerText(customerForm.street), `${sanitizeCustomerText(customerForm.zip)} ${sanitizeCustomerText(customerForm.city)}`.trim()]
      .filter(Boolean)
      .join(", ");

    const payload: Record<string, unknown> = {
      customer_type: customerType,
      invoice_recipient_name: invoiceRecipientName || null,
      display_name: displayName || invoiceRecipientName || companyName || null,
      company_name: companyName || null,
      name: displayName || contactPerson || invoiceRecipientName || null,
      company: companyName || null,
      email: email || null,
      phone: phone || null,
      contact_person: contactPerson || null,
      address: composedAddress || null,
      source: "admin_manual",
    };

    setCustomerSaving(true);
    try {
      const { error: insertError } = await supabase.from("customers").insert(payload);
      if (insertError) throw insertError;
      setToast({ kind: "ok", text: "Kunde erstellt." });
      setCustomerForm(defaultCustomerForm());
      await loadData();
    } catch (err) {
      setToast({ kind: "error", text: toUserMessage(err, "Kunde konnte nicht erstellt werden.") });
    } finally {
      setCustomerSaving(false);
    }
  }

  async function createTicketForCustomer(customer: CustomerNode) {
    const draft = ticketDraftByCustomer[customer.key] || defaultTicketForm(customer);
    const customerType = customer.customerType || "privat";
    const email = normalizeCustomerEmail(customer.email);
    const phone = normalizeCustomerPhone(customer.phone);
    const customerCompany = customerType === "firma" ? sanitizeCustomerText(customer.companyName || customer.displayName) : "";
    const invoiceName = sanitizeCustomerText(customer.invoiceRecipientName);
    const displayName = sanitizeCustomerText(customer.displayName);
    const contactName = sanitizeCustomerText(customer.contactPerson);
    const customerName =
      customerType === "firma"
        ? sanitizeCustomerText(contactName || invoiceName || customerCompany || displayName)
        : sanitizeCustomerText(displayName || invoiceName || contactName || "Kunde");
    const contactPerson = sanitizeCustomerText(contactName || customerName || invoiceName || customerCompany);
    const street = sanitizeCustomerText(draft.street);
    const zip = sanitizeCustomerText(draft.zip);
    const city = sanitizeCustomerText(draft.city);
    const description = sanitizeCustomerText(draft.description);

    if (!city || !zip) {
      setToast({ kind: "error", text: "Bitte PLZ und Ort für das Ticket angeben." });
      return;
    }
    if (!description) {
      setToast({ kind: "error", text: "Bitte eine kurze Ticket-Beschreibung eintragen." });
      return;
    }
    if (!email && !phone) {
      setToast({ kind: "error", text: "Beim Kunden fehlt E-Mail oder Telefon." });
      return;
    }
    if (!customerName) {
      setToast({ kind: "error", text: "Beim Kunden fehlt ein gültiger Name für das Ticket." });
      return;
    }

    setTicketBusyByCustomer((prev) => ({ ...prev, [customer.key]: true }));
    try {
      const payload: TicketWizardPayload = {
        plz: zip,
        ort: city,
        radius_km: 30,
        anfrageart: requestTypeToAnfrageart(draft.requestType),
        request_type: draft.requestType,
        subkategorie: draft.subcategory || "",
        customer_type: customerType,
        ansprechpartner: contactPerson,
        kategorie: sanitizeCustomerText(draft.category) || "Einzelauftrag",
        dringlichkeit: draft.urgency,
        terminwunsch: draft.date || "",
        zeitfenster_von: draft.timeFrom || "",
        zeitfenster_bis: draft.timeTo || "",
        kunde_name: customerName,
        kunde_firma: customerCompany,
        kunde_email: email,
        kunde_telefon: phone,
        objekt_adresse: [street, `${zip} ${city}`.trim()].filter(Boolean).join(", "),
        objekt_strasse: street,
        objekt_plz: zip,
        objekt_ort: city,
        access_notes: sanitizeCustomerText(draft.accessNotes),
        distanz_km: 0,
        outside_service_area: false,
        beschreibung: description,
        datenschutz_akzeptiert: true,
        agb_akzeptiert: true,
        haftung_koordination_akzeptiert: true,
        attachments: [],
      };

      const created = await createTicket(payload);
      setToast({ kind: "ok", text: `Ticket ${created.ticket_nummer} erstellt.` });
      await loadData();
      navigate(`/admin/tickets/${created.ticket_id}`);
    } catch (err) {
      setToast({ kind: "error", text: toUserMessage(err, "Ticket konnte nicht erstellt werden.") });
    } finally {
      setTicketBusyByCustomer((prev) => ({ ...prev, [customer.key]: false }));
    }
  }

  return (
    <div className="page-enter space-y-4">
      <SectionTitle title="Kundenstamm" subtitle="Stammdaten mit sauberer Ticket-Historie" />

      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <div className="glass rounded-xl2 border border-[var(--line)] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-soft)]">Kunden</p>
          <p className="mt-1 text-xl font-semibold text-white">{summary.customers}</p>
        </div>
        <div className="glass rounded-xl2 border border-[var(--line)] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-soft)]">Firmen</p>
          <p className="mt-1 text-xl font-semibold text-white">{summary.companies}</p>
        </div>
        <div className="glass rounded-xl2 border border-[var(--line)] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-soft)]">Tickets (Filter)</p>
          <p className="mt-1 text-xl font-semibold text-white">{summary.tickets}</p>
        </div>
      </div>

      <div className="admin-filter-bar flex flex-wrap gap-2">
        <input
          className="premium-input min-w-0 w-full flex-1 px-3 py-2 text-sm sm:min-w-[16rem]"
          placeholder="Suche Name, Firma, E-Mail, Telefon, Ticket"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="premium-input px-3 py-2 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as CustomerTypeFilter)}>
          <option value="all">Alle Typen</option>
          <option value="privat">Privat</option>
          <option value="firma">Firma</option>
        </select>
        <select className="premium-input px-3 py-2 text-sm" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
          <option value="">Alle Orte</option>
          {cityOptions.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
        <Button variant="secondary" className="px-4 py-2 text-sm" onClick={() => void loadData()}>
          Neu laden
        </Button>
      </div>

      <div className="glass rounded-xl2 border border-[var(--line)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Kunde erstellen</h3>
          <Button
            className="px-3 py-1 text-xs"
            disabled={customerSaving}
            onClick={() => void createCustomerManually()}
          >
            {customerSaving ? "Speichert..." : "Kunde speichern"}
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1 text-xs text-[var(--text-soft)]">
            Typ
            <select
              className="premium-input px-3 py-2 text-sm"
              value={customerForm.customerType}
              onChange={(e) => updateCustomerForm("customerType", e.target.value as CustomerType)}
            >
              <option value="privat">Privat</option>
              <option value="firma">Firma</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-[var(--text-soft)]">
            Name
            <input
              className="premium-input px-3 py-2 text-sm"
              value={customerForm.displayName}
              onChange={(e) => updateCustomerForm("displayName", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--text-soft)]">
            Firma
            <input
              className="premium-input px-3 py-2 text-sm"
              value={customerForm.companyName}
              onChange={(e) => updateCustomerForm("companyName", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--text-soft)]">
            Ansprechpartner
            <input
              className="premium-input px-3 py-2 text-sm"
              value={customerForm.contactPerson}
              onChange={(e) => updateCustomerForm("contactPerson", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--text-soft)]">
            E-Mail
            <input
              className="premium-input px-3 py-2 text-sm"
              value={customerForm.email}
              onChange={(e) => updateCustomerForm("email", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--text-soft)]">
            Telefon
            <input
              className="premium-input px-3 py-2 text-sm"
              value={customerForm.phone}
              onChange={(e) => updateCustomerForm("phone", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--text-soft)] md:col-span-2">
            Straße
            <input
              className="premium-input px-3 py-2 text-sm"
              value={customerForm.street}
              onChange={(e) => updateCustomerForm("street", e.target.value)}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-[var(--text-soft)]">
              PLZ
              <input
                className="premium-input px-3 py-2 text-sm"
                value={customerForm.zip}
                onChange={(e) => updateCustomerForm("zip", e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-[var(--text-soft)]">
              Ort
              <input
                className="premium-input px-3 py-2 text-sm"
                value={customerForm.city}
                onChange={(e) => updateCustomerForm("city", e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      {toast ? <Toast kind={toast.kind} text={toast.text} /> : null}
      {error ? <Toast kind="error" text={error} /> : null}
      {error === SESSION_EXPIRED_MESSAGE ? (
        <div className="pt-1">
          <Button variant="secondary" className="px-3 py-1 text-sm" onClick={() => navigate("/admin/login")}>
            Erneut anmelden
          </Button>
        </div>
      ) : null}

      {loading ? <LoadingSpinner label="Kundendaten werden geladen..." className="py-1" /> : null}

      {!loading && !filteredCustomers.length ? (
        <EmptyState text={qDebounced || typeFilter !== "all" || cityFilter ? "Keine Kunden für diesen Filter gefunden." : "Noch keine Kunden angelegt"} />
      ) : null}

      {!loading ? (
        <div className="space-y-3">
          {filteredCustomers.map((customer) => {
            const latestTicket = customer.tickets[0];
            const tab = activeTabs[customer.key] || "tickets";
            const isExpanded = Boolean(expandedCustomers[customer.key]);
            return (
              <details
                key={customer.key}
                open={isExpanded}
                onToggle={(event) => {
                  const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                  setExpandedCustomers((prev) => ({ ...prev, [customer.key]: nextOpen }));
                }}
                className="glass render-panel rounded-xl2 border border-[var(--line)] p-3"
              >
                <summary className="list-none cursor-pointer">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-white">{customer.displayName}</p>
                      <p className="text-xs text-[var(--text-soft)]">
                        {customer.customerType === "firma" ? "Firma" : customer.customerType === "privat" ? "Privat" : "nicht angegeben"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-[var(--line)] px-2 py-1 text-[var(--text-soft)]">Tickets: {customer.ticketsCount}</span>
                      <span className="rounded-full border border-[var(--line)] px-2 py-1 text-[var(--text-soft)]">
                        Letztes Ticket: {latestTicket ? dateTime(latestTicket.created_at) : "nicht angegeben"}
                      </span>
                    </div>
                  </div>
                </summary>

                {isExpanded ? (
                <div className="mt-3 space-y-3 border-t border-[var(--line)] pt-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                    <div className="grid gap-1 rounded-xl border border-[var(--line)] bg-slate-900/35 p-3 text-sm">
                      <p><span className="text-[var(--text-soft)]">Kundenname:</span> {customer.invoiceRecipientName || "nicht angegeben"}</p>
                      {customer.customerType === "firma" ? (
                        <p><span className="text-[var(--text-soft)]">Ansprechpartner:</span> {customer.contactPerson || "nicht angegeben"}</p>
                      ) : null}
                      <p><span className="text-[var(--text-soft)]">E-Mail:</span> {customer.email || "nicht angegeben"}</p>
                      <p><span className="text-[var(--text-soft)]">Telefon:</span> {customer.phone || "nicht angegeben"}</p>
                      <p><span className="text-[var(--text-soft)]">Adresse:</span> {customer.addressLine || "nicht angegeben"}</p>
                      <p><span className="text-[var(--text-soft)]">Orte:</span> {customer.cities.length ? customer.cities.join(", ") : "nicht angegeben"}</p>
                    </div>
                    <div className="flex items-start justify-end">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="secondary"
                          className="px-4 py-2 text-xs"
                          onClick={() =>
                            updateTicketDraft(
                              customer.key,
                              ticketDraftByCustomer[customer.key]
                                ? {}
                                : defaultTicketForm(customer)
                            )
                          }
                        >
                          Ticket erstellen
                        </Button>
                        <Button
                          variant="danger"
                          className="px-4 py-2 text-xs"
                          disabled={Boolean(busyCustomers[customer.key])}
                          onClick={() => void removeCustomer(customer)}
                        >
                          {busyCustomers[customer.key] ? "Löscht..." : "Kunde löschen"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {ticketDraftByCustomer[customer.key] ? (
                    <div className="rounded-xl border border-[var(--line)] bg-slate-900/35 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-white">Neues Ticket für {customer.displayName}</h4>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            className="px-3 py-1 text-xs"
                            onClick={() =>
                              setTicketDraftByCustomer((prev) => {
                                const next = { ...prev };
                                delete next[customer.key];
                                return next;
                              })
                            }
                          >
                            Schließen
                          </Button>
                          <Button
                            className="px-3 py-1 text-xs"
                            disabled={Boolean(ticketBusyByCustomer[customer.key])}
                            onClick={() => void createTicketForCustomer(customer)}
                          >
                            {ticketBusyByCustomer[customer.key] ? "Erstellt..." : "Ticket anlegen"}
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        <label className="grid gap-1 text-xs text-[var(--text-soft)]">
                          Einsatzart
                          <select
                            className="premium-input px-3 py-2 text-sm"
                            value={ticketDraftByCustomer[customer.key].requestType}
                            onChange={(e) =>
                              updateTicketDraft(customer.key, { requestType: e.target.value as RequestType })
                            }
                          >
                            <option value="direct">Direkt-Einsatz</option>
                            <option value="offer">Angebot anfordern</option>
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs text-[var(--text-soft)]">
                          Kategorie
                          <input
                            className="premium-input px-3 py-2 text-sm"
                            value={ticketDraftByCustomer[customer.key].category}
                            onChange={(e) => updateTicketDraft(customer.key, { category: e.target.value })}
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-[var(--text-soft)]">
                          Leistungsbereich
                          <input
                            className="premium-input px-3 py-2 text-sm"
                            value={ticketDraftByCustomer[customer.key].subcategory}
                            onChange={(e) => updateTicketDraft(customer.key, { subcategory: e.target.value })}
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-[var(--text-soft)]">
                          Dringlichkeit
                          <select
                            className="premium-input px-3 py-2 text-sm"
                            value={ticketDraftByCustomer[customer.key].urgency}
                            onChange={(e) =>
                              updateTicketDraft(customer.key, {
                                urgency: e.target.value as "niedrig" | "mittel" | "hoch" | "kritisch",
                              })
                            }
                          >
                            <option value="niedrig">niedrig</option>
                            <option value="mittel">mittel</option>
                            <option value="hoch">hoch</option>
                            <option value="kritisch">kritisch</option>
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs text-[var(--text-soft)]">
                          Datum (optional)
                          <input
                            type="date"
                            className="premium-input px-3 py-2 text-sm"
                            value={ticketDraftByCustomer[customer.key].date}
                            onChange={(e) => updateTicketDraft(customer.key, { date: e.target.value })}
                          />
                        </label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1 text-xs text-[var(--text-soft)]">
                            Von
                            <input
                              type="time"
                              className="premium-input px-3 py-2 text-sm"
                              value={ticketDraftByCustomer[customer.key].timeFrom}
                              onChange={(e) => updateTicketDraft(customer.key, { timeFrom: e.target.value })}
                            />
                          </label>
                          <label className="grid gap-1 text-xs text-[var(--text-soft)]">
                            Bis
                            <input
                              type="time"
                              className="premium-input px-3 py-2 text-sm"
                              value={ticketDraftByCustomer[customer.key].timeTo}
                              onChange={(e) => updateTicketDraft(customer.key, { timeTo: e.target.value })}
                            />
                          </label>
                        </div>
                        <label className="grid gap-1 text-xs text-[var(--text-soft)] md:col-span-2">
                          Straße
                          <input
                            className="premium-input px-3 py-2 text-sm"
                            value={ticketDraftByCustomer[customer.key].street}
                            onChange={(e) => updateTicketDraft(customer.key, { street: e.target.value })}
                          />
                        </label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1 text-xs text-[var(--text-soft)]">
                            PLZ
                            <input
                              className="premium-input px-3 py-2 text-sm"
                              value={ticketDraftByCustomer[customer.key].zip}
                              onChange={(e) => updateTicketDraft(customer.key, { zip: e.target.value })}
                            />
                          </label>
                          <label className="grid gap-1 text-xs text-[var(--text-soft)]">
                            Ort
                            <input
                              className="premium-input px-3 py-2 text-sm"
                              value={ticketDraftByCustomer[customer.key].city}
                              onChange={(e) => updateTicketDraft(customer.key, { city: e.target.value })}
                            />
                          </label>
                        </div>
                        <label className="grid gap-1 text-xs text-[var(--text-soft)] md:col-span-2 xl:col-span-3">
                          Zugangshinweis (optional)
                          <input
                            className="premium-input px-3 py-2 text-sm"
                            value={ticketDraftByCustomer[customer.key].accessNotes}
                            onChange={(e) => updateTicketDraft(customer.key, { accessNotes: e.target.value })}
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-[var(--text-soft)] md:col-span-2 xl:col-span-3">
                          Beschreibung
                          <textarea
                            className="premium-input min-h-24 px-3 py-2 text-sm"
                            value={ticketDraftByCustomer[customer.key].description}
                            onChange={(e) => updateTicketDraft(customer.key, { description: e.target.value })}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button variant={tab === "tickets" ? "primary" : "secondary"} className="px-3 py-1 text-xs" onClick={() => setActiveTabs((prev) => ({ ...prev, [customer.key]: "tickets" }))}>
                      Tickets
                    </Button>
                    <Button variant={tab === "contacts" ? "primary" : "secondary"} className="px-3 py-1 text-xs" onClick={() => setActiveTabs((prev) => ({ ...prev, [customer.key]: "contacts" }))}>
                      Kontakte
                    </Button>
                    <Button variant={tab === "notes" ? "primary" : "secondary"} className="px-3 py-1 text-xs" onClick={() => setActiveTabs((prev) => ({ ...prev, [customer.key]: "notes" }))}>
                      Notizen
                    </Button>
                  </div>

                  {tab === "tickets" ? (
                    <DataTable
                      columns={[
                        {
                          key: "ticket",
                          title: "Ticket",
                          render: (ticket) => (
                            <div className="min-w-[170px] max-w-[220px]">
                              <p className="font-semibold text-white">{formatTicketNumber(ticket.ticket_nummer)}</p>
                              <p className="text-xs text-[var(--text-soft)]">{ticket.titel || ticket.subkategorie || ticket.kategorie || "-"}</p>
                              <p className="mt-2 text-xs text-[var(--text-soft)]">Erstellt: {dateTime(ticket.created_at)}</p>
                            </div>
                          ),
                        },
                        {
                          key: "scope",
                          title: "Art / Objekt",
                          render: (ticket) => (
                            <div className="min-w-[210px] max-w-[300px] space-y-1">
                              <RequestTypeBadge value={ticket.request_type || ticket.anfrageart} />
                              <p className="text-xs text-[var(--text-soft)]">
                                {ticket.kategorie}
                                {ticket.subkategorie ? ` · ${ticket.subkategorie}` : ""}
                              </p>
                              <p className="text-xs text-[var(--text-soft)]">{ticket.objekt_adresse || ticket.objekt_ort || ticket.ort || "nicht angegeben"}</p>
                            </div>
                          ),
                        },
                        {
                          key: "status",
                          title: "Status / Termin",
                          render: (ticket) => (
                            <div className="min-w-[180px] max-w-[240px] space-y-1">
                              <StatusChip status={ticket.status} />
                              <p className="text-xs text-[var(--text-soft)]">{ticketAppointmentText(ticket)}</p>
                              <p className="text-xs text-[var(--text-soft)]">{ticket.customer_display_name || ticket.kunde_email || "nicht angegeben"}</p>
                            </div>
                          ),
                        },
                        {
                          key: "actions",
                          title: "Aktionen",
                          render: (ticket) => (
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="secondary"
                                className="w-full px-3 py-1 text-xs"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(`/admin/tickets/${ticket.id}`);
                                }}
                              >
                                Öffnen
                              </Button>
                              <Button
                                variant="danger"
                                className="w-full px-3 py-1 text-xs"
                                disabled={Boolean(busyTickets[ticket.id])}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void removeSingleTicket(ticket);
                                }}
                              >
                                {busyTickets[ticket.id] ? "Löscht..." : "Löschen"}
                              </Button>
                            </div>
                          ),
                        },
                      ]}
                      rows={customer.tickets}
                      rowKey={(ticket) => ticket.id}
                      onRowClick={(ticket) => navigate(`/admin/tickets/${ticket.id}`)}
                    />
                  ) : null}

                  {tab === "contacts" ? (
                    <div className="rounded-xl border border-[var(--line)] bg-slate-900/30 p-3 text-sm">
                      <p><span className="text-[var(--text-soft)]">Ansprechpartner:</span> {customer.contactPerson || "nicht angegeben"}</p>
                      <p><span className="text-[var(--text-soft)]">E-Mail:</span> {customer.email || "nicht angegeben"}</p>
                      <p><span className="text-[var(--text-soft)]">Telefon:</span> {customer.phone || "nicht angegeben"}</p>
                    </div>
                  ) : null}

                  {tab === "notes" ? (
                    <div className="rounded-xl border border-[var(--line)] bg-slate-900/30 p-3 text-sm text-[var(--text-soft)]">
                      Keine internen Notizen hinterlegt.
                    </div>
                  ) : null}
                </div>
                ) : null}
              </details>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}




