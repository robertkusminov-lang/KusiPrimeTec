import React from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RequestTypeBadge } from "@/components/ui/RequestTypeBadge";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusChip } from "@/components/ui/StatusChip";
import { Toast } from "@/components/ui/Toast";
import {
  adminTicketDetail,
  deleteTicket,
  getOrCreateTicketDocument,
  type UpdateTicketPayload,
  updateTicket,
} from "@/features/apiClient";
import { normalizeCustomerType, resolveCustomerDisplayName } from "@/lib/customer";
import { SESSION_EXPIRED_MESSAGE, toUserMessage } from "@/lib/errors";
import { dateTime, formatTicketNumber, formatTimeRange, labelStatus } from "@/lib/format";
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from "@/lib/localDraft";
import { TicketDetailResponse, TicketDocument, TicketStatus, TICKET_STATUSES } from "@/types/domain";

const STATUS_VALUES: TicketStatus[] = [...TICKET_STATUSES];
const TICKET_DRAFT_PREFIX = "kpt:ticket-detail:";

type AutosaveState = "idle" | "dirty" | "saving" | "saved" | "invalid" | "error";

type TicketFormState = {
  titel: string;
  kategorie: string;
  subkategorie: string;
  dringlichkeit: "niedrig" | "mittel" | "hoch" | "kritisch";
  customer_type: "" | "privat" | "firma" | "gewerblich";
  kunde_name: string;
  kunde_firma: string;
  ansprechpartner: string;
  kunde_telefon: string;
  kunde_email: string;
  objekt_strasse: string;
  objekt_plz: string;
  objekt_ort: string;
  access_notes: string;
  beschreibung: string;
};

type TicketActionState = {
  status: TicketStatus;
  termin: string;
  terminVon: string;
  terminBis: string;
  internalNote: string;
};

type TicketDetailDraft = {
  form: TicketFormState;
  actions: TicketActionState;
  baseUpdatedAt: string;
  savedAt: string;
};

function urgencyChip(value: string) {
  const v = String(value || "").toLowerCase();
  if (v === "kritisch" || v === "notfall") return "border-rose-300/55 bg-rose-400/15 text-rose-100";
  if (v === "hoch") return "border-amber-300/55 bg-amber-400/15 text-amber-100";
  return "border-slate-600/65 bg-slate-700/45 text-slate-200";
}

function cleanDescription(text: string): string {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim().toLowerCase();
      if (!trimmed) return true;
      if (trimmed.startsWith("meta:")) return false;
      if (trimmed.includes("session_id=")) return false;
      if (trimmed.includes("outside_service_request=")) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function splitAddress(full: string): { street: string; zip: string; city: string } {
  const raw = String(full || "").trim();
  const zipMatch = raw.match(/(\d{5})\s+([\p{L}\- ]+)$/u);
  if (!zipMatch) return { street: raw, zip: "", city: "" };
  return {
    street: raw.slice(0, zipMatch.index).replace(/,\s*$/, "").trim(),
    zip: zipMatch[1],
    city: zipMatch[2].trim(),
  };
}

function customerDisplayName(name: string, company: string): string {
  return resolveCustomerDisplayName({ kundeName: name, kundeFirma: company }) || "-";
}

function isQuarterHour(value: string): boolean {
  const raw = String(value || "").trim();
  if (!raw) return true;
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return false;
  return min % 30 === 0;
}

function consentLabel(value: boolean | null | undefined): string {
  if (value === true) return "Ja";
  if (value === false) return "Nein";
  return "Nicht erfasst";
}

function joinAddress(street: string, zip: string, city: string, fallback = ""): string {
  const line2 = [zip.trim(), city.trim()].filter(Boolean).join(" ");
  const composed = [street.trim(), line2].filter(Boolean).join(", ");
  return composed || fallback.trim();
}

function ticketToForm(ticket: TicketDetailResponse["ticket"]): TicketFormState {
  const split = splitAddress(ticket.objekt_adresse);
  return {
    titel: ticket.titel || "",
    kategorie: ticket.kategorie || "",
    subkategorie: ticket.subkategorie || "",
    dringlichkeit: (ticket.dringlichkeit || "mittel") as TicketFormState["dringlichkeit"],
    customer_type: (normalizeCustomerType(ticket.customer_type) || "") as TicketFormState["customer_type"],
    kunde_name: ticket.kunde_name || "",
    kunde_firma: ticket.kunde_firma || "",
    ansprechpartner: ticket.ansprechpartner || "",
    kunde_telefon: ticket.kunde_telefon || "",
    kunde_email: ticket.kunde_email || "",
    objekt_strasse: ticket.objekt_strasse || split.street || "",
    objekt_plz: ticket.objekt_plz || split.zip || ticket.plz || "",
    objekt_ort: ticket.objekt_ort || split.city || ticket.ort || "",
    access_notes: ticket.access_notes || "",
    beschreibung: cleanDescription(ticket.beschreibung || ""),
  };
}

function ticketToActionState(ticket: TicketDetailResponse["ticket"]): TicketActionState {
  return {
    status: ticket.status,
    termin: ticket.terminwunsch || "",
    terminVon: ticket.zeitfenster_von || "",
    terminBis: ticket.zeitfenster_bis || "",
    internalNote: ticket.internal_note || "",
  };
}

function findDocument(documents: TicketDocument[], typ: "rapport") {
  return documents.find((doc) => doc.dokument_typ === typ) || null;
}

function buildActionPatch(ticket: TicketDetailResponse["ticket"], actionState: TicketActionState): UpdateTicketPayload {
  const patch: UpdateTicketPayload = {};
  if (actionState.status !== ticket.status) patch.status = actionState.status;
  if ((actionState.termin || null) !== (ticket.terminwunsch || null)) patch.terminwunsch = actionState.termin || null;
  if ((actionState.terminVon || null) !== (ticket.zeitfenster_von || null)) patch.zeitfenster_von = actionState.terminVon || null;
  if ((actionState.terminBis || null) !== (ticket.zeitfenster_bis || null)) patch.zeitfenster_bis = actionState.terminBis || null;
  if ((actionState.internalNote || "") !== (ticket.internal_note || "")) patch.internal_note = actionState.internalNote || "";
  if (patch.status === "Rapport_erstellt") patch.bucket = "archive";
  return patch;
}

function buildFormPatch(ticket: TicketDetailResponse["ticket"], form: TicketFormState): UpdateTicketPayload {
  const cleanPhone = String(form.kunde_telefon || "").trim();
  const cleanEmail = String(form.kunde_email || "").trim().toLowerCase();
  const normalizedType = normalizeCustomerType(form.customer_type);
  const normalizedAddress = joinAddress(form.objekt_strasse, form.objekt_plz, form.objekt_ort, ticket.objekt_adresse || "");
  const patch: UpdateTicketPayload = {};

  if (form.titel !== (ticket.titel || "")) patch.titel = form.titel;
  if (form.kategorie !== (ticket.kategorie || "")) patch.kategorie = form.kategorie;
  if ((form.subkategorie || null) !== (ticket.subkategorie || null)) patch.subkategorie = form.subkategorie || null;
  if (form.dringlichkeit !== (ticket.dringlichkeit || "mittel")) patch.dringlichkeit = form.dringlichkeit;
  if ((normalizedType || null) !== (normalizeCustomerType(ticket.customer_type) || null)) patch.customer_type = normalizedType || null;
  if (form.kunde_name !== (ticket.kunde_name || "")) patch.kunde_name = form.kunde_name;
  if (form.kunde_firma !== (ticket.kunde_firma || "")) patch.kunde_firma = form.kunde_firma;
  if ((form.ansprechpartner || null) !== (ticket.ansprechpartner || null)) patch.ansprechpartner = form.ansprechpartner || null;
  if (cleanPhone !== (ticket.kunde_telefon || "")) patch.kunde_telefon = cleanPhone;
  if (cleanEmail !== String(ticket.kunde_email || "").trim().toLowerCase()) patch.kunde_email = cleanEmail;
  if ((form.objekt_strasse || null) !== (ticket.objekt_strasse || null)) patch.objekt_strasse = form.objekt_strasse || null;
  if ((form.objekt_plz || null) !== (ticket.objekt_plz || null)) patch.objekt_plz = form.objekt_plz || null;
  if ((form.objekt_ort || null) !== (ticket.objekt_ort || null)) patch.objekt_ort = form.objekt_ort || null;
  if (normalizedAddress !== (ticket.objekt_adresse || "")) patch.objekt_adresse = normalizedAddress;
  if ((form.access_notes || null) !== (ticket.access_notes || null)) patch.access_notes = form.access_notes || null;
  if (form.beschreibung !== cleanDescription(ticket.beschreibung || "")) patch.beschreibung = form.beschreibung;

  return patch;
}

function validateActionState(actionState: TicketActionState): string | null {
  if ((actionState.terminVon && !actionState.terminBis) || (!actionState.terminVon && actionState.terminBis)) {
    return "Bitte beide Uhrzeiten setzen (von und bis).";
  }
  if (actionState.terminVon && actionState.terminBis && actionState.terminVon >= actionState.terminBis) {
    return "Bitte ein gültiges Zeitfenster wählen (von < bis).";
  }
  if ((actionState.terminVon || actionState.terminBis) && !actionState.termin) {
    return "Bitte zuerst ein Datum setzen.";
  }
  if (!isQuarterHour(actionState.terminVon) || !isQuarterHour(actionState.terminBis)) {
    return "Uhrzeiten sind nur in 30-Minuten-Schritten erlaubt.";
  }
  return null;
}

function validateTicketForm(form: TicketFormState): string | null {
  const cleanPhone = String(form.kunde_telefon || "").trim();
  const cleanEmail = String(form.kunde_email || "").trim().toLowerCase();
  const normalizedType = normalizeCustomerType(form.customer_type);
  if (!cleanPhone && !cleanEmail) return "Mindestens E-Mail oder Telefon ist erforderlich.";
  if (normalizedType === "firma" && !String(form.kunde_firma || "").trim()) {
    return "Bei Kundentyp Firma ist die Firma ein Pflichtfeld.";
  }
  return null;
}

function autosaveTone(state: AutosaveState): string {
  if (state === "error") return "border-rose-400/35 bg-rose-500/10 text-rose-100";
  if (state === "invalid") return "border-amber-300/35 bg-amber-400/10 text-amber-100";
  if (state === "saving" || state === "dirty") return "border-sky-300/35 bg-sky-400/10 text-sky-100";
  return "border-emerald-300/35 bg-emerald-400/10 text-emerald-100";
}

export default function AdminTicketDetailPage() {
  const outlet = useOutletContext<{ token?: string } | undefined>();
  const token = outlet?.token ?? "";
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const draftKey = React.useMemo(() => `${TICKET_DRAFT_PREFIX}${id}`, [id]);

  const [detail, setDetail] = React.useState<TicketDetailResponse | null>(null);
  const [status, setStatus] = React.useState<TicketStatus>("Neu");
  const [termin, setTermin] = React.useState("");
  const [terminVon, setTerminVon] = React.useState("");
  const [terminBis, setTerminBis] = React.useState("");
  const [internalNote, setInternalNote] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [dataEditing, setDataEditing] = React.useState(false);
  const [dataSaving, setDataSaving] = React.useState(false);
  const [autosaveSaving, setAutosaveSaving] = React.useState(false);
  const [autosaveState, setAutosaveState] = React.useState<AutosaveState>("idle");
  const [autosaveMessage, setAutosaveMessage] = React.useState("Automatisches Speichern aktiv.");
  const [deleting, setDeleting] = React.useState(false);
  const [docBusy, setDocBusy] = React.useState<null | "rapport">(null);
  const [form, setForm] = React.useState<TicketFormState | null>(null);
  const saveLockRef = React.useRef(false);

  const reload = React.useCallback(async () => {
    if (!token || !id) return;
    setDetail(null);
    setForm(null);
    setInfo("");
    setError("");
    setLoading(true);
    try {
      const res = await adminTicketDetail(token, id);
      const draft = readLocalDraft<TicketDetailDraft>(draftKey);
      const serverForm = ticketToForm(res.ticket);
      const serverActions = ticketToActionState(res.ticket);
      const canRestoreDraft = Boolean(draft && draft.baseUpdatedAt === res.ticket.updated_at);

      setDetail(res);
      setStatus(canRestoreDraft ? draft!.actions.status : serverActions.status);
      setTermin(canRestoreDraft ? draft!.actions.termin : serverActions.termin);
      setTerminVon(canRestoreDraft ? draft!.actions.terminVon : serverActions.terminVon);
      setTerminBis(canRestoreDraft ? draft!.actions.terminBis : serverActions.terminBis);
      setInternalNote(canRestoreDraft ? draft!.actions.internalNote : serverActions.internalNote);
      setForm(canRestoreDraft ? draft!.form : serverForm);
      setAutosaveState(canRestoreDraft ? "dirty" : "saved");
      setAutosaveMessage(
        canRestoreDraft
          ? "Lokaler Entwurf wiederhergestellt. Änderungen werden automatisch übernommen."
          : "Alle Änderungen gespeichert."
      );
    } catch (err) {
      setError(toUserMessage(err, "Ticket konnte nicht geladen werden."));
      setAutosaveState("error");
      setAutosaveMessage("Ticket konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [draftKey, id, token]);

  React.useEffect(() => {
    if (!token) {
      setError(SESSION_EXPIRED_MESSAGE);
      setLoading(false);
      return;
    }
    void reload();
  }, [reload, token]);

  const ticketForView = detail?.ticket ?? null;
  const currentActionState = React.useMemo<TicketActionState>(
    () => ({ status, termin, terminVon, terminBis, internalNote }),
    [internalNote, status, termin, terminBis, terminVon]
  );

  const cleanText = React.useMemo(
    () => cleanDescription(ticketForView?.beschreibung || ""),
    [ticketForView?.beschreibung]
  );
  const split = React.useMemo(
    () => splitAddress(ticketForView?.objekt_adresse || ""),
    [ticketForView?.objekt_adresse]
  );
  const reportDoc = React.useMemo(
    () => (detail ? findDocument(detail.documents, "rapport") : null),
    [detail]
  );
  const customerSubtitle = React.useMemo(
    () =>
      ticketForView
        ? resolveCustomerDisplayName({
            customerType: ticketForView.customer_type,
            invoiceRecipientName: ticketForView.invoice_recipient_name,
            kundeName: ticketForView.kunde_name,
            kundeFirma: ticketForView.kunde_firma,
          }) || customerDisplayName(ticketForView.kunde_name, ticketForView.kunde_firma)
        : "-",
    [ticketForView]
  );

  const actionPatch = React.useMemo(
    () => (detail ? buildActionPatch(detail.ticket, currentActionState) : ({} as UpdateTicketPayload)),
    [currentActionState, detail]
  );
  const formPatch = React.useMemo(
    () => (detail && form ? buildFormPatch(detail.ticket, form) : ({} as UpdateTicketPayload)),
    [detail, form]
  );
  const actionDirty = React.useMemo(() => Object.keys(actionPatch).length > 0, [actionPatch]);
  const formDirty = React.useMemo(() => Object.keys(formPatch).length > 0, [formPatch]);
  const actionValidation = React.useMemo(
    () => (actionDirty ? validateActionState(currentActionState) : null),
    [actionDirty, currentActionState]
  );
  const formValidation = React.useMemo(
    () => (formDirty && form ? validateTicketForm(form) : null),
    [form, formDirty]
  );
  const autosavePatch = React.useMemo(() => {
    const patch: UpdateTicketPayload = {};
    if (actionDirty && !actionValidation) Object.assign(patch, actionPatch);
    if (formDirty && !formValidation) Object.assign(patch, formPatch);
    if (patch.status === "Rapport_erstellt") patch.bucket = "archive";
    return patch;
  }, [actionDirty, actionPatch, actionValidation, formDirty, formPatch, formValidation]);
  const autosavePatchSignature = React.useMemo(() => JSON.stringify(autosavePatch), [autosavePatch]);

  function patchForm<K extends keyof TicketFormState>(key: K, value: TicketFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const applyPatchToDetail = React.useCallback((patch: UpdateTicketPayload) => {
    setDetail((prev) => {
      if (!prev) return prev;
      const updatedAt = new Date().toISOString();
      const nextTicket = {
        ...prev.ticket,
        ...patch,
        bucket:
          patch.bucket !== undefined
            ? patch.bucket
            : patch.status === "Rapport_erstellt" || patch.status === "Storniert"
              ? "archive"
              : prev.ticket.bucket,
        updated_at: updatedAt,
      };
      return { ...prev, ticket: nextTicket };
    });
  }, []);

  const persistPatch = React.useCallback(
    async (
      patch: UpdateTicketPayload,
      options: {
        kind: "actions" | "form" | "autosave";
        emptyMessage?: string;
        successMessage?: string;
        errorMessage: string;
      }
    ): Promise<boolean> => {
      if (!detail) return false;
      if (Object.keys(patch).length === 0) {
        if (options.emptyMessage) setInfo(options.emptyMessage);
        return true;
      }
      if (saveLockRef.current) return false;

      saveLockRef.current = true;
      if (options.kind === "actions") setSaving(true);
      if (options.kind === "form") setDataSaving(true);
      if (options.kind === "autosave") {
        setAutosaveSaving(true);
        setAutosaveState("saving");
        setAutosaveMessage("Änderungen werden gespeichert...");
      }

      setError("");
      if (options.kind !== "autosave") setInfo("");

      try {
        await updateTicket(token, detail.ticket.id, patch);
        applyPatchToDetail(patch);
        setAutosaveState("saved");
        setAutosaveMessage("Alle Änderungen gespeichert.");
        if (options.successMessage) setInfo(options.successMessage);
        return true;
      } catch (err) {
        const message = toUserMessage(err, options.errorMessage);
        setError(message);
        if (options.kind === "autosave") {
          setAutosaveState("error");
          setAutosaveMessage(message);
        }
        return false;
      } finally {
        saveLockRef.current = false;
        if (options.kind === "actions") setSaving(false);
        if (options.kind === "form") setDataSaving(false);
        if (options.kind === "autosave") setAutosaveSaving(false);
      }
    },
    [applyPatchToDetail, detail, token]
  );

  React.useEffect(() => {
    if (!detail || !form) return;
    if (!actionDirty && !formDirty) {
      removeLocalDraft(draftKey);
      return;
    }
    const ok = writeLocalDraft(draftKey, {
      form,
      actions: currentActionState,
      baseUpdatedAt: detail.ticket.updated_at,
      savedAt: new Date().toISOString(),
    } satisfies TicketDetailDraft);
    if (!ok) {
      setAutosaveState("error");
      setAutosaveMessage("Lokaler Entwurf konnte nicht gesichert werden.");
    }
  }, [actionDirty, currentActionState, detail, draftKey, form, formDirty]);

  React.useEffect(() => {
    if (!detail || !form || !token) return;
    if (!actionDirty && !formDirty) {
      if (!autosaveSaving) {
        setAutosaveState("saved");
        setAutosaveMessage("Alle Änderungen gespeichert.");
      }
      return;
    }

    if (Object.keys(autosavePatch).length === 0) {
      setAutosaveState("invalid");
      setAutosaveMessage(actionValidation || formValidation || "Autosave wartet auf gültige Eingaben.");
      return;
    }

    setAutosaveState("dirty");
    setAutosaveMessage("Änderungen werden automatisch gespeichert...");
    const timer = window.setTimeout(() => {
      void persistPatch(autosavePatch, {
        kind: "autosave",
        errorMessage: "Automatisches Speichern fehlgeschlagen.",
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    actionDirty,
    actionValidation,
    autosavePatch,
    autosavePatchSignature,
    autosaveSaving,
    detail,
    form,
    formDirty,
    formValidation,
    persistPatch,
    token,
  ]);

  React.useEffect(() => {
    if (!actionDirty && !formDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [actionDirty, formDirty]);

  async function saveActions() {
    const validation = validateActionState(currentActionState);
    if (validation) {
      setError(validation);
      return;
    }

    const saved = await persistPatch(actionPatch, {
      kind: "actions",
      emptyMessage: "Keine Änderungen zu speichern.",
      successMessage: "Ticket gespeichert.",
      errorMessage: "Speichern fehlgeschlagen.",
    });

    if (saved) removeLocalDraft(draftKey);
    if (saved && actionPatch.status === "Rapport_erstellt") {
      navigate("/admin/archive");
    }
  }

  async function saveTicketData() {
    if (!form) return;
    const validation = validateTicketForm(form);
    if (validation) {
      setError(validation);
      return;
    }

    const saved = await persistPatch(formPatch, {
      kind: "form",
      emptyMessage: "Keine Änderungen in Ticketdaten.",
      successMessage: "Ticketdaten gespeichert.",
      errorMessage: "Ticketdaten konnten nicht gespeichert werden.",
    });

    if (saved) {
      removeLocalDraft(draftKey);
      setDataEditing(false);
    }
  }

  async function closeTicketDirectly() {
    if (!detail) return;
    if (detail.ticket.status === "Rapport_erstellt") {
      setInfo("Ticket ist bereits abgeschlossen.");
      return;
    }

    const saved = await persistPatch(
      {
        status: "Rapport_erstellt",
        bucket: "archive",
      },
      {
        kind: "actions",
        successMessage: "Ticket abgeschlossen.",
        errorMessage: "Ticket konnte nicht abgeschlossen werden.",
      }
    );

    if (saved) {
      setStatus("Rapport_erstellt");
      navigate("/admin/archive");
    }
  }

  async function openDocument(typ: "rapport") {
    if (!detail) return;
    setDocBusy(typ);
    setError("");
    try {
      const doc = await getOrCreateTicketDocument(token, detail.ticket.id, typ);
      navigate(`/admin/docs/report/${doc.id}`);
      setInfo(`Dokument ${doc.dokument_nummer} bereit.`);
    } catch (err) {
      setError(toUserMessage(err, "Dokument konnte nicht erstellt/geöffnet werden."));
    } finally {
      setDocBusy(null);
    }
  }

  async function removeCurrentTicket() {
    if (!detail) return;
    const ok = window.confirm(`Ticket ${formatTicketNumber(detail.ticket.ticket_nummer)} wirklich löschen?`);
    if (!ok) return;

    setDeleting(true);
    setError("");
    setInfo("");
    try {
      await deleteTicket(token, detail.ticket.id);
      removeLocalDraft(draftKey);
      navigate("/admin/tickets", { replace: true });
    } catch (err) {
      setError(toUserMessage(err, "Ticket konnte nicht gelöscht werden."));
    } finally {
      setDeleting(false);
    }
  }

  if (loading || !detail) {
    return (
      <div className="page-enter">
        <SectionTitle title="Ticket" subtitle="Lädt..." />
        <LoadingSpinner label="Ticket wird geladen..." className="py-1" />
        {error ? <Toast kind="error" text={error} /> : null}
        {error === SESSION_EXPIRED_MESSAGE ? (
          <Button variant="secondary" className="mt-2 px-3 py-1 text-sm" onClick={() => navigate("/admin/login")}>
            Erneut anmelden
          </Button>
        ) : null}
      </div>
    );
  }

  const { ticket, audit, attachments } = detail;
  const isBusy = saving || dataSaving || autosaveSaving || deleting;

  return (
    <div className="page-enter space-y-4">
      <SectionTitle
        title={`Ticket ${formatTicketNumber(ticket.ticket_nummer)}`}
        subtitle={`${customerSubtitle} · ${ticket.objekt_adresse}`}
      />
      {info ? <Toast kind="ok" text={info} /> : null}
      {error ? <Toast kind="error" text={error} /> : null}
      {error === SESSION_EXPIRED_MESSAGE ? (
        <div className="pt-1">
          <Button variant="secondary" className="px-3 py-1 text-sm" onClick={() => navigate("/admin/login")}>
            Erneut anmelden
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <GlassCard className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-white">Ticketdaten</h2>
            <div className="admin-ticket-heading-actions flex items-center gap-2">
              {dataEditing ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDataEditing(false);
                      setForm(ticketToForm(ticket));
                    }}
                    disabled={dataSaving || autosaveSaving}
                  >
                    Abbrechen
                  </Button>
                  <Button onClick={() => void saveTicketData()} disabled={dataSaving || autosaveSaving}>
                    {dataSaving ? "Speichert..." : "Jetzt speichern"}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setDataEditing(true)} disabled={autosaveSaving}>
                  Bearbeiten
                </Button>
              )}
              <StatusChip status={ticket.status} />
              <span className={`rounded-full border px-2.5 py-1 text-xs ${urgencyChip(ticket.dringlichkeit)}`}>
                {ticket.dringlichkeit}
              </span>
            </div>
          </div>

          <div className="grid gap-3 text-sm">
            <section className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-3">
              <h3 className="mb-1 font-semibold text-white">Kunde</h3>
              {dataEditing && form ? (
                <div className="grid gap-2">
                  <label className="grid gap-1">
                    <span className="text-[var(--text-soft)]">Typ</span>
                    <select
                      className="premium-input px-3 py-2"
                      value={form.customer_type}
                      onChange={(e) => patchForm("customer_type", e.target.value as TicketFormState["customer_type"])}
                    >
                      <option value="">nicht gesetzt</option>
                      <option value="privat">privat</option>
                      <option value="firma">firma</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[var(--text-soft)]">Name</span>
                    <input className="premium-input px-3 py-2" value={form.kunde_name} onChange={(e) => patchForm("kunde_name", e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[var(--text-soft)]">Firma</span>
                    <input className="premium-input px-3 py-2" value={form.kunde_firma} onChange={(e) => patchForm("kunde_firma", e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[var(--text-soft)]">Ansprechpartner</span>
                    <input className="premium-input px-3 py-2" value={form.ansprechpartner} onChange={(e) => patchForm("ansprechpartner", e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[var(--text-soft)]">Telefon</span>
                    <input className="premium-input px-3 py-2" value={form.kunde_telefon} onChange={(e) => patchForm("kunde_telefon", e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[var(--text-soft)]">E-Mail</span>
                    <input className="premium-input px-3 py-2" value={form.kunde_email} onChange={(e) => patchForm("kunde_email", e.target.value)} />
                  </label>
                </div>
              ) : (
                <>
                  <p><span className="text-[var(--text-soft)]">Typ:</span> {normalizeCustomerType(ticket.customer_type) || "nicht gesetzt"}</p>
                  <p><span className="text-[var(--text-soft)]">Ansprechpartner:</span> {ticket.ansprechpartner || "nicht angegeben"}</p>
                  <p><span className="text-[var(--text-soft)]">Telefon:</span> {ticket.kunde_telefon}</p>
                  <p><span className="text-[var(--text-soft)]">E-Mail:</span> {ticket.kunde_email}</p>
                </>
              )}
            </section>

            <section className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-3">
              <h3 className="mb-1 font-semibold text-white">Objekt</h3>
              {dataEditing && form ? (
                <div className="grid gap-2">
                  <label className="grid gap-1">
                    <span className="text-[var(--text-soft)]">Straße</span>
                    <input className="premium-input px-3 py-2" value={form.objekt_strasse} onChange={(e) => patchForm("objekt_strasse", e.target.value)} />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-[var(--text-soft)]">PLZ</span>
                      <input className="premium-input px-3 py-2" value={form.objekt_plz} onChange={(e) => patchForm("objekt_plz", e.target.value)} />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[var(--text-soft)]">Ort</span>
                      <input className="premium-input px-3 py-2" value={form.objekt_ort} onChange={(e) => patchForm("objekt_ort", e.target.value)} />
                    </label>
                  </div>
                  <label className="grid gap-1">
                    <span className="text-[var(--text-soft)]">Zugangshinweise</span>
                    <input className="premium-input px-3 py-2" value={form.access_notes} onChange={(e) => patchForm("access_notes", e.target.value)} />
                  </label>
                  <p><span className="text-[var(--text-soft)]">Distanz:</span> {ticket.distanz_km ?? "-"} km</p>
                  <p><span className="text-[var(--text-soft)]">Einsatzgebiet:</span> {ticket.plz || "-"} {ticket.ort || "-"}</p>
                </div>
              ) : (
                <>
                  <p><span className="text-[var(--text-soft)]">Straße:</span> {ticket.objekt_strasse || split.street || "-"}</p>
                  <p><span className="text-[var(--text-soft)]">PLZ:</span> {ticket.objekt_plz || split.zip || ticket.plz || "-"}</p>
                  <p><span className="text-[var(--text-soft)]">Ort:</span> {ticket.objekt_ort || split.city || ticket.ort || "-"}</p>
                  <p><span className="text-[var(--text-soft)]">Zugangshinweise:</span> {ticket.access_notes || "-"}</p>
                  <p><span className="text-[var(--text-soft)]">Distanz:</span> {ticket.distanz_km ?? "-"} km</p>
                  <p><span className="text-[var(--text-soft)]">Einsatzgebiet:</span> {ticket.plz || "-"} {ticket.ort || "-"}</p>
                </>
              )}
            </section>

            <section className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-3">
              <h3 className="mb-1 font-semibold text-white">Anfrage</h3>
              {dataEditing && form ? (
                <div className="grid gap-2">
                  <label className="grid gap-1">
                    <span className="text-[var(--text-soft)]">Titel</span>
                    <input className="premium-input px-3 py-2" value={form.titel} onChange={(e) => patchForm("titel", e.target.value)} />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-[var(--text-soft)]">Dringlichkeit</span>
                      <select
                        className="premium-input px-3 py-2"
                        value={form.dringlichkeit}
                        onChange={(e) => patchForm("dringlichkeit", e.target.value as TicketFormState["dringlichkeit"])}
                      >
                        <option value="niedrig">niedrig</option>
                        <option value="mittel">mittel</option>
                        <option value="hoch">hoch</option>
                        <option value="kritisch">kritisch</option>
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-1">
                    <span className="text-[var(--text-soft)]">Kategorie</span>
                    <input className="premium-input px-3 py-2" value={form.kategorie} onChange={(e) => patchForm("kategorie", e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[var(--text-soft)]">Leistungsbereich (Subkategorie)</span>
                    <input className="premium-input px-3 py-2" value={form.subkategorie} onChange={(e) => patchForm("subkategorie", e.target.value)} />
                  </label>
                  <p><span className="text-[var(--text-soft)]">Wunschdatum:</span> {ticket.terminwunsch || "-"}</p>
                  <p><span className="text-[var(--text-soft)]">Zeitfenster:</span> {formatTimeRange(ticket.zeitfenster_von, ticket.zeitfenster_bis)}</p>
                </div>
              ) : (
                <>
                  <p><span className="text-[var(--text-soft)]">Titel:</span> {ticket.titel || "-"}</p>
                  <p><span className="text-[var(--text-soft)]">Einsatzart:</span> <RequestTypeBadge value={ticket.request_type || ticket.anfrageart} /></p>
                  <p><span className="text-[var(--text-soft)]">Kategorie:</span> {ticket.kategorie}</p>
                  <p><span className="text-[var(--text-soft)]">Leistungsbereich:</span> {ticket.subkategorie || "-"}</p>
                  <p><span className="text-[var(--text-soft)]">Wunschdatum:</span> {ticket.terminwunsch || "-"}</p>
                  <p><span className="text-[var(--text-soft)]">Zeitfenster:</span> {formatTimeRange(ticket.zeitfenster_von, ticket.zeitfenster_bis)}</p>
                </>
              )}
            </section>

            <section className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-3">
              <h3 className="mb-1 font-semibold text-white">Einsatzgebiet & Freigaben</h3>
              <div className="grid gap-1">
                <p><span className="text-[var(--text-soft)]">Einsatzgebiet (PLZ/Ort):</span> {ticket.plz || "-"} {ticket.ort || "-"}</p>
                <p><span className="text-[var(--text-soft)]">Service-Radius:</span> {ticket.radius_km ?? "-"} km</p>
                <p><span className="text-[var(--text-soft)]">Außerhalb Einsatzgebiet:</span> {ticket.outside_service_area ? "Ja" : "Nein"}</p>
                <p><span className="text-[var(--text-soft)]">Datenschutz akzeptiert:</span> {consentLabel(ticket.datenschutz_akzeptiert)}</p>
                <p><span className="text-[var(--text-soft)]">AGB akzeptiert:</span> {consentLabel(ticket.agb_akzeptiert)}</p>
                <p><span className="text-[var(--text-soft)]">Haftung Koordination akzeptiert:</span> {consentLabel(ticket.haftung_koordination_akzeptiert)}</p>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-3">
              <h3 className="mb-1 font-semibold text-white">Beschreibung</h3>
              {dataEditing && form ? (
                <textarea className="premium-input min-h-28 w-full px-3 py-2" value={form.beschreibung} onChange={(e) => patchForm("beschreibung", e.target.value)} />
              ) : (
                <p className="whitespace-pre-wrap text-[var(--text-main)]">{cleanText || "-"}</p>
              )}
            </section>

            <section className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-3">
              <h3 className="mb-1 font-semibold text-white">Anhänge</h3>
              {attachments.length ? (
                <ul className="grid gap-1">
                  {attachments.map((file) => (
                    <li key={file.id} className="flex items-center justify-between gap-2">
                      <span>{file.file_name}</span>
                      {file.storage_url ? (
                        <a className="text-electric-300 hover:text-electric-200" href={file.storage_url} target="_blank" rel="noreferrer">
                          Öffnen
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--text-soft)]">keine URL</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[var(--text-soft)]">Keine Anhänge vorhanden.</p>
              )}
            </section>

            <section className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-3">
              <h3 className="mb-1 font-semibold text-white">Historie</h3>
              {audit.length ? (
                <ul className="grid gap-1">
                  {audit.slice(0, 15).map((event) => (
                    <li key={event.id} className="text-xs text-[var(--text-soft)]">
                      {dateTime(event.created_at)} · {event.actor} · {event.detail}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[var(--text-soft)]">Keine Historie vorhanden.</p>
              )}
            </section>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <h2 className="font-semibold text-white">Aktionen</h2>
          <div className="mt-3 grid gap-2 text-sm">
            <div className={`rounded-xl border p-3 ${autosaveTone(autosaveState)}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">Autosave</p>
              <p className="mt-1 text-sm text-white">{autosaveMessage}</p>
              <p className="mt-1 text-xs text-[var(--text-soft)]">
                Änderungen werden lokal zwischengespeichert und bei gültigen Eingaben automatisch an den Server gesendet.
              </p>
              <p className="mt-2 text-xs text-[var(--text-soft)]">Letzte Server-Version: {dateTime(ticket.updated_at)}</p>
            </div>

            <label className="grid gap-1">
              <span>Status</span>
              <select className="premium-input px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
                {STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {labelStatus(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span>Termin setzen</span>
              <input type="date" className="premium-input px-3 py-2" value={termin} onChange={(e) => setTermin(e.target.value)} />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <span>Zeit von</span>
                <input
                  type="time"
                  step={1800}
                  className="premium-input px-3 py-2"
                  value={terminVon}
                  onChange={(e) => setTerminVon(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span>Zeit bis</span>
                <input
                  type="time"
                  step={1800}
                  className="premium-input px-3 py-2"
                  value={terminBis}
                  onChange={(e) => setTerminBis(e.target.value)}
                />
              </label>
            </div>
            <p className="text-xs text-[var(--text-soft)]">
              Uhrzeiten in 30-Minuten-Schritten. Bei Speichern wird der Termin in Outlook synchronisiert.
            </p>

            <label className="grid gap-1">
              <span>Interne Notiz</span>
              <textarea className="premium-input min-h-24 px-3 py-2" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
            </label>

            <Button onClick={() => void saveActions()} disabled={saving || autosaveSaving}>
              {saving ? "Speichert..." : "Ticket speichern"}
            </Button>

            <Button
              variant="secondary"
              onClick={() => void closeTicketDirectly()}
              disabled={isBusy}
            >
              Ticket abschließen
            </Button>

            <Button
              variant="danger"
              className="px-4 py-2 text-xs"
              disabled={isBusy}
              onClick={() => void removeCurrentTicket()}
            >
              {deleting ? "Löscht..." : "Ticket löschen"}
            </Button>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <Button variant="secondary" onClick={() => void openDocument("rapport")} disabled={docBusy !== null || autosaveSaving}>
                {reportDoc ? "Rapport öffnen" : "Rapport erstellen"}
              </Button>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-2 text-xs text-[var(--text-soft)]">
              <p>Rapport: {reportDoc ? reportDoc.dokument_nummer : "nicht vorhanden"}</p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
