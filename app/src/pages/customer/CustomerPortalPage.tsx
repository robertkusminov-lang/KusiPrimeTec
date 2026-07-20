import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSeo } from "@/hooks/useSeo";
import { createTicket, listCustomerReports } from "@/features/apiClient";
import { BUSINESS_RULES } from "@/config/businessRules";
import { KATEGORIEN } from "@/data/content";
import { fileToBase64, MAX_UPLOAD_FILES, useUploadState, validateTicketFiles } from "@/features/booking/upload";
import { formatTicketNumber, formatTimeRange, labelCustomerStatus } from "@/lib/format";
import type { CustomerReportSummary } from "@/types/domain";

type CustomerTicket = {
  id: string;
  ticket_nummer: string;
  status: string;
  bucket?: string | null;
  kategorie: string;
  object_id?: string | null;
  created_at: string;
  terminwunsch?: string | null;
  zeitfenster_von?: string | null;
  zeitfenster_bis?: string | null;
};

type CustomerObject = {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  access_notes: string;
  is_active: boolean;
};

type ObjectNote = {
  id: string;
  object_id: string;
  note: string;
  created_at: string;
};

function toReadableError(err: unknown, fallback: string): string {
  const anyErr = err as { message?: unknown; error_description?: unknown; details?: unknown; hint?: unknown };
  for (const part of [anyErr?.message, anyErr?.error_description, anyErr?.details, anyErr?.hint, err]) {
    if (typeof part === "string" && part.trim() && part !== "[object Object]") return part.trim();
    if (part && typeof part === "object") {
      try {
        const text = JSON.stringify(part);
        if (text && text !== "{}") return text;
      } catch {
        // ignore
      }
    }
  }
  return fallback;
}

function getFunctionDataError(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  const errorText = record.error;
  return typeof errorText === "string" && errorText.trim() ? errorText.trim() : "";
}

function resolveBucket(ticket: CustomerTicket): "inbox" | "active" | "archive" {
  const raw = String(ticket.bucket || "").trim().toLowerCase();
  if (raw === "archive") return "archive";
  if (raw === "active") return "active";
  if (raw === "inbox") return "inbox";
  if (ticket.status === "Rapport_erstellt" || ticket.status === "Storniert") return "archive";
  if (ticket.status === "Neu") return "inbox";
  return "active";
}

function TicketRequestForm({
  currentObject,
  accountEmail,
  name,
  company,
  phone,
  contactPerson,
  onCreated,
}: {
  currentObject: CustomerObject | null;
  accountEmail: string;
  name: string;
  company: string;
  phone: string;
  contactPerson: string;
  onCreated: () => Promise<void>;
}) {
  const [category, setCategory] = useState<string>(KATEGORIEN[0] || "Einzelauftrag");
  const [urgency, setUrgency] = useState<"niedrig" | "mittel" | "hoch" | "kritisch">("niedrig");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [contactConfirmed, setContactConfirmed] = useState(false);
  const [dataPrivacyConfirmed, setDataPrivacyConfirmed] = useState(false);
  const [agbConfirmed, setAgbConfirmed] = useState(false);
  const [liabilityConfirmed, setLiabilityConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { files, setFiles, removeFile } = useUploadState();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!currentObject) {
      setError("Bitte zuerst ein zugewiesenes Objekt auswählen.");
      return;
    }
    if (!description.trim()) {
      setError("Bitte eine kurze Beschreibung eingeben.");
      return;
    }
    if (!contactConfirmed) {
      setError("Bitte Kontaktdaten bestätigen.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const attachments = await Promise.all(files.map((file) => fileToBase64(file)));
      const result = await createTicket({
        object_id: currentObject.id,
        plz: currentObject.zip,
        ort: currentObject.city,
        radius_km: BUSINESS_RULES.serviceArea.radiusKm,
        anfrageart: "direkt_einsatz",
        request_type: "direct",
        subkategorie: category,
        customer_type: company.trim() ? "firma" : "privat",
        ansprechpartner: contactPerson.trim() || name.trim(),
        kategorie: category,
        dringlichkeit: urgency,
        terminwunsch: date,
        zeitfenster_von: timeFrom,
        zeitfenster_bis: timeTo,
        kunde_name: name.trim() || contactPerson.trim() || "Bestandskunde",
        kunde_firma: company.trim(),
        kunde_email: accountEmail.trim(),
        kunde_telefon: phone.trim(),
        objekt_adresse: `${currentObject.street}, ${currentObject.zip} ${currentObject.city}`,
        objekt_strasse: currentObject.street,
        objekt_plz: currentObject.zip,
        objekt_ort: currentObject.city,
        access_notes: currentObject.access_notes,
        distanz_km: null as unknown as number,
        outside_service_area: false,
        beschreibung: description.trim(),
        datenschutz_akzeptiert: dataPrivacyConfirmed,
        agb_akzeptiert: agbConfirmed,
        haftung_koordination_akzeptiert: liabilityConfirmed,
        attachments,
      });
      setSuccess(`Ticket ${formatTicketNumber(result.ticket_nummer)} erstellt.`);
      setDescription("");
      setDate("");
      setTimeFrom("");
      setTimeTo("");
      setContactConfirmed(false);
      setDataPrivacyConfirmed(false);
      setAgbConfirmed(false);
      setLiabilityConfirmed(false);
      setFiles([]);
      await onCreated();
    } catch (err) {
      setError(toReadableError(err, "Ticket konnte nicht erstellt werden."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Objekt</span>
          <input className="premium-input rounded-xl px-3 py-2 text-sm" value={currentObject ? `${currentObject.name} · ${currentObject.city}` : "Kein Objekt gewählt"} readOnly />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Kategorie</span>
          <select className="premium-input rounded-xl px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            {KATEGORIEN.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Kunden-Dringlichkeit</span>
          <select className="premium-input rounded-xl px-3 py-2 text-sm" value={urgency} onChange={(e) => setUrgency(e.target.value as typeof urgency)}>
            <option value="niedrig">Normal</option>
            <option value="mittel">Zeitnah</option>
            <option value="hoch">Dringend</option>
            <option value="kritisch">Sicherheitsrelevant / bitte prüfen</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Terminwunsch</span>
          <input type="date" className="premium-input rounded-xl px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Zeit von</span>
          <input type="time" step={1800} className="premium-input rounded-xl px-3 py-2 text-sm" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Zeit bis</span>
          <input type="time" step={1800} className="premium-input rounded-xl px-3 py-2 text-sm" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span>Kurze Beschreibung</span>
        <textarea className="premium-input min-h-32 rounded-xl px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <label className="grid gap-1 text-sm">
        <span>Dateien (JPG, PNG, PDF, max. {MAX_UPLOAD_FILES}, je 10 MB)</span>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          className="premium-input rounded-xl px-3 py-2 text-sm"
          onChange={(e) => {
            const validation = validateTicketFiles(Array.from(e.target.files || []));
            setFiles(validation.files);
            setError(validation.errors[0] || "");
          }}
        />
      </label>

      {files.length ? (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => (
            <button key={file.name} type="button" className="btn-secondary-premium rounded-full px-3 py-1 text-xs" onClick={() => removeFile(file.name)}>
              {file.name} entfernen
            </button>
          ))}
        </div>
      ) : null}

      <label className="inline-flex items-start gap-2 text-sm">
        <input type="checkbox" checked={contactConfirmed} onChange={(e) => setContactConfirmed(e.target.checked)} />
        <span>Ich bestätige meine Kontaktdaten für dieses Ticket.</span>
      </label>
      <label className="inline-flex items-start gap-2 text-sm">
        <input type="checkbox" checked={dataPrivacyConfirmed} onChange={(e) => setDataPrivacyConfirmed(e.target.checked)} />
        <span>Ich akzeptiere die Datenschutzbestimmungen.</span>
      </label>
      <label className="inline-flex items-start gap-2 text-sm">
        <input type="checkbox" checked={agbConfirmed} onChange={(e) => setAgbConfirmed(e.target.checked)} />
        <span>Ich akzeptiere die AGB.</span>
      </label>
      <label className="inline-flex items-start gap-2 text-sm">
        <input type="checkbox" checked={liabilityConfirmed} onChange={(e) => setLiabilityConfirmed(e.target.checked)} />
        <span>Ich akzeptiere die Haftungsregelung für Projektkoordination.</span>
      </label>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

      <button disabled={saving || !currentObject} className="btn-primary-premium rounded-xl px-4 py-2 text-sm font-semibold">
        {saving ? "Wird gesendet..." : "Ticket absenden"}
      </button>
    </form>
  );
}

export default function CustomerPortalPage() {
  const [ready, setReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [authUserId, setAuthUserId] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [tickets, setTickets] = useState<CustomerTicket[]>([]);
  const [reports, setReports] = useState<CustomerReportSummary[]>([]);
  const [objects, setObjects] = useState<CustomerObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [objectNotes, setObjectNotes] = useState<ObjectNote[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useSeo({
    title: "Kundenportal - KusiPrimeTec",
    description: "Objekte, Tickets und Dokumentation für Ihr KusiPrimeTec Kundenkonto.",
  });

  async function loadObjectNotes(objectId: string) {
    if (!objectId) {
      setObjectNotes([]);
      return;
    }
    const { data, error: notesError } = await supabase
      .from("object_notes")
      .select("id,object_id,note,created_at")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (notesError) throw notesError;
    setObjectNotes((data || []) as ObjectNote[]);
  }

  const reloadAll = useCallback(async (userId: string, token = accessToken) => {
    const [profileRes, objectRes] = await Promise.all([
      supabase.from("customers").select("name,company_name,phone,city,zip,contact_person").eq("auth_user_id", userId).maybeSingle(),
      supabase.from("objects").select("id,name,street,zip,city,access_notes,is_active").eq("requester_user_id", userId).eq("is_active", true).order("updated_at", { ascending: false }),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (objectRes.error) throw objectRes.error;

    const profile = profileRes.data;
    if (profile) {
      setName(String(profile.name || ""));
      setCompany(String(profile.company_name || ""));
      setPhone(String(profile.phone || ""));
      setCity(String(profile.city || ""));
      setZip(String(profile.zip || ""));
      setContactPerson(String(profile.contact_person || ""));
    }

    const objectRows = (objectRes.data || []) as CustomerObject[];
    const objectIds = objectRows.map((item) => item.id).filter(Boolean);
    let ticketQuery = supabase
      .from("tickets")
      .select("id,ticket_nummer,status,bucket,kategorie,object_id,created_at,terminwunsch,zeitfenster_von,zeitfenster_bis")
      .order("created_at", { ascending: false })
      .limit(300);

    if (objectIds.length > 0) {
      ticketQuery = ticketQuery.in("object_id", objectIds);
    } else {
      ticketQuery = ticketQuery.eq("requester_user_id", userId);
    }

    const [ticketRes, reportItems] = await Promise.all([
      ticketQuery,
      token
        ? listCustomerReports(token).catch(() => [] as CustomerReportSummary[])
        : Promise.resolve([] as CustomerReportSummary[]),
    ]);
    if (ticketRes.error) throw ticketRes.error;

    setObjects(objectRows);
    setSelectedObjectId((prev) => prev || objectRows[0]?.id || "");
    setTickets((ticketRes.data || []) as CustomerTicket[]);
    setReports(reportItems);
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session?.access_token) {
          setReady(true);
          return;
        }
        setAccessToken(session.access_token);
        setAuthUserId(String(session.user.id || ""));
        setAccountEmail(String(session.user.email || ""));
        await reloadAll(String(session.user.id || ""), session.access_token);
      } catch (err) {
        setError(toReadableError(err, "Kundenportal konnte nicht geladen werden."));
      } finally {
        setReady(true);
      }
    })();
  }, [reloadAll]);

  useEffect(() => {
    void loadObjectNotes(selectedObjectId).catch((err) => setError(toReadableError(err, "Objektnotizen konnten nicht geladen werden.")));
  }, [selectedObjectId]);

  const ticketsInbox = useMemo(() => tickets.filter((ticket) => resolveBucket(ticket) === "inbox"), [tickets]);
  const ticketsActive = useMemo(() => tickets.filter((ticket) => resolveBucket(ticket) === "active"), [tickets]);
  const ticketsArchive = useMemo(() => tickets.filter((ticket) => resolveBucket(ticket) === "archive"), [tickets]);
  const currentObject = useMemo(() => objects.find((item) => item.id === selectedObjectId) || null, [objects, selectedObjectId]);
  const reportsByTicketId = useMemo(() => {
    const map = new Map<string, CustomerReportSummary[]>();
    for (const report of reports) {
      const existing = map.get(report.ticket_id) || [];
      map.set(report.ticket_id, [...existing, report]);
    }
    return map;
  }, [reports]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!authUserId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        name: name.trim() || "Kunde",
        company_name: company.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        zip: zip.trim() || null,
        contact_person: contactPerson.trim() || null,
      };
      const invoked = await supabase.functions.invoke("customer-profile-upsert", { body: payload });
      if (invoked.error || getFunctionDataError(invoked.data)) {
        throw invoked.error || new Error(getFunctionDataError(invoked.data) || "Profil konnte nicht gespeichert werden.");
      }
      await reloadAll(authUserId, accessToken);
      setSuccess(`Profil gespeichert (${new Date().toLocaleString("de-DE")}).`);
    } catch (err) {
      setError(toReadableError(err, "Profil konnte nicht gespeichert werden."));
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate("/konto/anmelden", { replace: true });
  }

  if (!ready) return <div className="page-enter text-sm text-[var(--text-soft)]">Kundenportal wird geladen...</div>;
  if (!accessToken) return <Navigate to="/konto/anmelden" replace state={{ from: "/konto" }} />;

  return (
    <div className="page-enter page-stack customer-portal">
      <section className="premium-card page-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="section-heading text-white">Kundenportal</h1>
            <p className="section-subtitle">Zugewiesene Objekte, Tickets und freigegebene Dokumentation.</p>
          </div>
          <button onClick={logout} className="btn-secondary-premium rounded-xl px-4 py-3 text-base font-semibold sm:px-3 sm:py-2 sm:text-sm">Logout</button>
        </div>
      </section>

      <section className="premium-card page-card">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-[var(--line)] bg-slate-900/35 p-4">
            <p className="text-sm text-[var(--text-soft)]">Freigegebene Rapporte</p>
            <p className="mt-2 text-3xl font-semibold text-white">{reports.length}</p>
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-slate-900/35 p-4">
            <p className="text-sm text-[var(--text-soft)]">Offene Tickets</p>
            <p className="mt-2 text-3xl font-semibold text-white">{ticketsActive.length}</p>
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-slate-900/35 p-4">
            <p className="text-sm text-[var(--text-soft)]">Eingegangen</p>
            <p className="mt-2 text-3xl font-semibold text-white">{ticketsInbox.length}</p>
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-slate-900/35 p-4">
            <p className="text-sm text-[var(--text-soft)]">Archiv</p>
            <p className="mt-2 text-3xl font-semibold text-white">{ticketsArchive.length}</p>
          </article>
        </div>
      </section>

      <section className="premium-card page-card">
        <h2 className="text-lg font-semibold text-white">Profil</h2>
        <form onSubmit={saveProfile} className="mt-3 grid gap-3 md:grid-cols-2">
          <input className="premium-input rounded-xl px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="premium-input rounded-xl px-3 py-2 text-sm" placeholder="Firma" value={company} onChange={(e) => setCompany(e.target.value)} />
          <input className="premium-input rounded-xl px-3 py-2 text-sm" placeholder="Ansprechpartner" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          <input className="premium-input rounded-xl px-3 py-2 text-sm" placeholder="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="premium-input rounded-xl px-3 py-2 text-sm" placeholder="PLZ" value={zip} onChange={(e) => setZip(e.target.value)} />
          <input className="premium-input rounded-xl px-3 py-2 text-sm" placeholder="Ort" value={city} onChange={(e) => setCity(e.target.value)} />
          <input className="premium-input rounded-xl px-3 py-2 text-sm md:col-span-2" placeholder="E-Mail" value={accountEmail} readOnly />
          <button disabled={saving} className="btn-primary-premium rounded-xl px-4 py-3 text-base font-semibold md:col-span-2 sm:py-2 sm:text-sm">
            {saving ? "Speichert..." : "Profil speichern"}
          </button>
        </form>
      </section>

      <section className="premium-card page-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Zugewiesene Objekte</h2>
            <p className="text-sm text-[var(--text-soft)]">Nur durch den Admin freigegebene Objekte sind hier sichtbar.</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {objects.map((obj) => (
            <button
              key={obj.id}
              type="button"
              onClick={() => setSelectedObjectId(obj.id)}
              className={`rounded-xl border p-3 text-left text-sm ${selectedObjectId === obj.id ? "border-electric-300/70 bg-electric-400/10" : "border-[var(--line)] bg-slate-900/35"}`}
            >
              <p className="font-semibold text-white">{obj.name}</p>
              <p className="text-xs text-[var(--text-soft)]">{obj.street}, {obj.zip} {obj.city}</p>
            </button>
          ))}
        </div>
        {!objects.length ? <p className="mt-3 text-sm text-[var(--text-soft)]">Aktuell sind noch keine Objekte für Ihr Kundenkonto zugewiesen.</p> : null}
      </section>

      <section className="premium-card page-card">
        <h2 className="text-lg font-semibold text-white">Objektübersicht</h2>
        {currentObject ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <article className="rounded-xl border border-[var(--line)] bg-slate-900/35 p-4 text-sm">
              <p className="font-semibold text-white">{currentObject.name}</p>
              <p className="mt-2 text-[var(--text-soft)]">{currentObject.street}, {currentObject.zip} {currentObject.city}</p>
              <p className="mt-2 text-[var(--text-soft)]">Zugang & Hinweise: {currentObject.access_notes || "Keine Hinweise hinterlegt."}</p>
            </article>
            <article className="rounded-xl border border-[var(--line)] bg-slate-900/35 p-4 text-sm">
              <p className="font-semibold text-white">Objektbezogene Notizen</p>
              <div className="mt-2 grid gap-2">
                {objectNotes.map((note) => (
                  <div key={note.id} className="rounded-xl border border-[var(--line)]/70 bg-slate-950/35 p-3">
                    <p className="text-[var(--text-main)]">{note.note}</p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">{new Date(note.created_at).toLocaleString("de-DE")}</p>
                  </div>
                ))}
                {!objectNotes.length ? <p className="text-sm text-[var(--text-soft)]">Noch keine freigegebenen Objekt-Notizen vorhanden.</p> : null}
              </div>
            </article>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--text-soft)]">Bitte ein Objekt auswählen.</p>
        )}
      </section>

      <section className="premium-card page-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Freigegebene Rapporte</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              Nur freigegebene Leistungsrapporte sind hier sichtbar und direkt für Druck, PDF und Signatur erreichbar.
            </p>
          </div>
        </div>
        {reports.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {reports.map((report) => (
              <article key={report.id} className="rounded-2xl border border-[var(--line)] bg-slate-900/35 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric-200">Leistungsrapport</p>
                    <h3 className="mt-2 break-words text-xl font-semibold text-white">{report.dokument_nummer}</h3>
                    <p className="mt-2 text-sm text-[var(--text-soft)]">
                      Ticket {formatTicketNumber(report.ticket_nummer)} · {report.objekt}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-electric-300/35 bg-electric-400/10 px-3 py-1 text-xs font-semibold text-electric-100">
                      {report.dokument_status === "akzeptiert" ? "abgeschlossen" : "freigegeben"}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${report.has_signature ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100" : "border-amber-300/35 bg-amber-400/10 text-amber-100"}`}>
                      {report.has_signature ? "signiert" : "Signatur offen"}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[var(--text-main)] sm:grid-cols-2">
                  <p><span className="text-[var(--text-soft)]">Kunde:</span> {report.kunde}</p>
                  <p><span className="text-[var(--text-soft)]">Einsatzdatum:</span> {report.einsatzdatum || "-"}</p>
                  <p><span className="text-[var(--text-soft)]">Kategorie:</span> {report.kategorie || "Rapport"}</p>
                  <p><span className="text-[var(--text-soft)]">Aktualisiert:</span> {new Date(report.updated_at).toLocaleDateString("de-DE")}</p>
                </div>
                <div className="mt-4">
                  <Link
                    to={`/konto/rapport/${report.id}`}
                    className="btn-primary-premium inline-flex min-h-[56px] w-full items-center justify-center rounded-2xl px-5 py-3 text-base font-semibold sm:min-h-0 sm:w-auto sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
                  >
                    Rapport öffnen
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-soft)]">
            Aktuell sind noch keine freigegebenen Rapporte für Ihr Kundenkonto vorhanden.
          </p>
        )}
      </section>

      <section className="premium-card page-card">
        <h2 className="text-lg font-semibold text-white">Neues Ticket für dieses Objekt</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Die Anfrage wird direkt dem ausgewählten Objekt zugeordnet und erscheint anschließend im Admin-Dashboard.
        </p>
        <div className="mt-4">
          <TicketRequestForm
            currentObject={currentObject}
            accountEmail={accountEmail}
            name={name}
            company={company}
            phone={phone}
            contactPerson={contactPerson}
            onCreated={async () => {
              if (authUserId) await reloadAll(authUserId, accessToken);
            }}
          />
        </div>
      </section>

      <section className="premium-card page-card">
        <h2 className="text-lg font-semibold text-white">Tickets nach Status</h2>
        <div className="mt-4 grid gap-5">
          <TicketTable title="Eingegangen" rows={ticketsInbox} objects={objects} reportsByTicketId={reportsByTicketId} />
          <TicketTable title="Offene Tickets" rows={ticketsActive} objects={objects} reportsByTicketId={reportsByTicketId} />
          <TicketTable title="Archiv" rows={ticketsArchive} objects={objects} reportsByTicketId={reportsByTicketId} />
        </div>
      </section>

      {error ? <p className="rounded-xl border border-rose-300/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">{success}</p> : null}
    </div>
  );
}

function TicketTable({
  title,
  rows,
  objects,
  reportsByTicketId,
}: {
  title: string;
  rows: CustomerTicket[];
  objects: CustomerObject[];
  reportsByTicketId: Map<string, CustomerReportSummary[]>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-electric-200">{title}</h3>
      <div className="mt-3 grid gap-3 md:hidden">
        {rows.map((ticket) => {
          const objectName = objects.find((item) => item.id === ticket.object_id)?.name || "zugewiesenes Objekt";
          const linkedReport = (reportsByTicketId.get(ticket.id) || [])[0] || null;
          return (
            <article key={ticket.id} className="rounded-2xl border border-[var(--line)] bg-slate-900/35 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{formatTicketNumber(ticket.ticket_nummer || ticket.id)}</p>
                  <p className="mt-1 text-[var(--text-soft)]">{objectName}</p>
                </div>
                <span className="rounded-full border border-electric-300/35 bg-electric-400/10 px-3 py-1 text-xs font-semibold text-electric-100">
                  {labelCustomerStatus(ticket.status)}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-[var(--text-main)]">
                <p><span className="text-[var(--text-soft)]">Kategorie:</span> {ticket.kategorie}</p>
                <p><span className="text-[var(--text-soft)]">Termin:</span> {ticket.terminwunsch ? `${ticket.terminwunsch} · ${formatTimeRange(ticket.zeitfenster_von, ticket.zeitfenster_bis)}` : "-"}</p>
                <p><span className="text-[var(--text-soft)]">Erstellt:</span> {new Date(ticket.created_at).toLocaleString("de-DE")}</p>
              </div>
              {linkedReport ? (
                <div className="mt-4">
                  <Link
                    to={`/konto/rapport/${linkedReport.id}`}
                    className="btn-secondary-premium inline-flex min-h-[56px] w-full items-center justify-center rounded-2xl px-4 py-3 text-base font-semibold"
                  >
                    Rapport öffnen
                  </Link>
                </div>
              ) : null}
            </article>
          );
        })}
        {!rows.length ? <p className="text-sm text-[var(--text-soft)]">Keine Einträge.</p> : null}
      </div>
      <div className="mt-2 hidden overflow-auto md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--text-soft)]">
              <th className="py-2 pr-4">Ticket</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Kategorie</th>
              <th className="py-2 pr-4">Objekt</th>
              <th className="py-2 pr-4">Termin</th>
              <th className="py-2">Datum</th>
              <th className="py-2 pl-4">Rapport</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ticket) => {
              const objectName = objects.find((item) => item.id === ticket.object_id)?.name || "zugewiesenes Objekt";
              const linkedReport = (reportsByTicketId.get(ticket.id) || [])[0] || null;
              return (
                <tr key={ticket.id} className="border-t border-[var(--line)]/60">
                  <td className="py-2 pr-4">{formatTicketNumber(ticket.ticket_nummer || ticket.id)}</td>
                  <td className="py-2 pr-4">{labelCustomerStatus(ticket.status)}</td>
                  <td className="py-2 pr-4">{ticket.kategorie}</td>
                  <td className="py-2 pr-4">{objectName}</td>
                  <td className="py-2 pr-4">
                    {ticket.terminwunsch ? `${ticket.terminwunsch} · ${formatTimeRange(ticket.zeitfenster_von, ticket.zeitfenster_bis)}` : "-"}
                  </td>
                  <td className="py-2">{new Date(ticket.created_at).toLocaleString("de-DE")}</td>
                  <td className="py-2 pl-4">
                    {linkedReport ? (
                      <Link
                        to={`/konto/rapport/${linkedReport.id}`}
                        className="btn-secondary-premium inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold"
                      >
                        Öffnen
                      </Link>
                    ) : (
                      <span className="text-[var(--text-soft)]">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? <p className="mt-2 text-sm text-[var(--text-soft)]">Keine Einträge.</p> : null}
      </div>
    </div>
  );
}
