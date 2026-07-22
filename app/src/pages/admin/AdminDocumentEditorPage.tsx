import React from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { Toast } from "@/components/ui/Toast";
import { BUSINESS_RULES, COMPANY_PROFILE } from "@/config/businessRules";
import { loadTicketDocument, saveTicketDocument, sendTicketDocumentEmail } from "@/features/apiClient";
import { hasNewerLocalSnapshot } from "@/features/documents/autosaveIntegrity";
import { toUserMessage } from "@/lib/errors";
import { dateTime } from "@/lib/format";
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from "@/lib/localDraft";
import { DocumentArbeitstag, DocumentData, DocumentMaterialPosition, DocumentPosition, DocumentStatus, TicketDocument } from "@/types/domain";

const EINHEITEN = ["Stk", "Std", "m", "pauschal", "Material"];
const MATERIAL_EINHEITEN = ["Stk", "m", "kg", "l", "Satz", "Pauschal", "Sonstiges"];
const DOCUMENT_DRAFT_PREFIX = "kpt:document-draft:";
const MAX_DOCUMENT_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

type DocumentAutosaveState = "idle" | "dirty" | "saving" | "saved" | "invalid" | "error";

type DocumentEditorSnapshot = {
  data: DocumentData;
  status: DocumentStatus;
  mailTo: string;
  mailSubject: string;
  mailMessage: string;
};

type DocumentEditorDraft = DocumentEditorSnapshot & {
  baseUpdatedAt: string;
  savedAt: string;
};

function rapportConfig() {
  return { docType: "rapport" as const, title: "RAPPORT", hasPrices: false, customerSignature: true };
}

function plainDocLabel(): string {
  return "Rapport";
}

function defaultMailMessage(recipientName: string, docNumber: string, ticketNumber: string): string {
  const label = plainDocLabel();
  const greeting = recipientName ? `Guten Tag ${recipientName},` : "Guten Tag,";
  return [
    greeting,
    "",
    `anbei erhalten Sie Ihr ${label} ${docNumber} zu Ticket ${ticketNumber} im Anhang.`,
    "Bei Rückfragen oder Änderungswünschen stehen wir Ihnen gerne zur Verfügung.",
  ].join("\n");
}

function lineTotal(row: DocumentPosition): number {
  return Number((row.menge * row.einzelpreis).toFixed(2));
}

function documentTotal(rows: DocumentPosition[]): number {
  return Number(rows.reduce((sum, row) => sum + lineTotal(row), 0).toFixed(2));
}

function fmtEur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function firstLine(value: string): string {
  return String(value || "").split("\n")[0].slice(0, 90);
}

function formatDateTagMonatJahr(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "-";

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;

  const isoDateTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
  if (isoDateTime) return `${isoDateTime[3]}.${isoDateTime[2]}.${isoDateTime[1]}`;

  const de = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (de) {
    const day = de[1].padStart(2, "0");
    const month = de[2].padStart(2, "0");
    const year = de[3].length === 2 ? `20${de[3]}` : de[3];
    return `${day}.${month}.${year}`;
  }

  const ts = Date.parse(raw);
  if (!Number.isNaN(ts)) {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear());
    return `${day}.${month}.${year}`;
  }

  return raw;
}

function normalizeSingleLine(value: string | null | undefined): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts.length < 2) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutesToHours(start: string | null | undefined, end: string | null | undefined): number | null {
  const from = parseTimeToMinutes(start);
  const to = parseTimeToMinutes(end);
  if (from == null || to == null) return null;
  const diff = to - from;
  if (diff <= 0) return 0;
  return Number((diff / 60).toFixed(2));
}

function toArbeitstageFromZeiten(data: DocumentData): DocumentArbeitstag[] {
  const stunden = minutesToHours(data.zeiten?.beginn, data.zeiten?.ende) ?? Number(data.zeiten?.gesamtstunden || 0);
  return [
    {
      id: `tag-${Date.now()}`,
      datum: data.dokument_datum || new Date().toISOString().slice(0, 10),
      beginn: String(data.zeiten?.beginn || ""),
      ende: String(data.zeiten?.ende || ""),
      stunden,
      notiz: "",
    },
  ];
}

function resolveRecipientAddress(data: DocumentData): { street: string; zipCity: string; extras: string[] } {
  const streetField = normalizeSingleLine(data.objekt_strasse);
  const zipField = normalizeSingleLine(data.objekt_plz);
  const cityField = normalizeSingleLine(data.objekt_ort);
  if (streetField || zipField || cityField) {
    return {
      street: streetField || "-",
      zipCity: [zipField, cityField].filter(Boolean).join(" ") || "-",
      extras: [],
    };
  }

  const parts = String(data.objekt_adresse || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return { street: "-", zipCity: "-", extras: [] };

  const zipIndex = parts.findIndex((part) => /\b\d{4,5}\b/.test(part));
  if (zipIndex >= 0) {
    return {
      street: parts.slice(0, zipIndex).join(", ").trim() || "-",
      zipCity: parts[zipIndex] || "-",
      extras: parts.slice(zipIndex + 1),
    };
  }

  return {
    street: parts.length > 1 ? parts.slice(0, -1).join(", ").trim() || "-" : parts[0] || "-",
    zipCity: parts.length > 1 ? parts[parts.length - 1] || "-" : "-",
    extras: [],
  };
}

function getDefaultPricePositions(): DocumentPosition[] {
  return [
    { id: "p1", nr: 1, bezeichnung: "Arbeitsstunden", menge: 1, einheit: "Std", einzelpreis: BUSINESS_RULES.pricing.hourlyRateEur },
    { id: "p2", nr: 2, bezeichnung: "Einsatzpauschale", menge: 1, einheit: "pauschal", einzelpreis: BUSINESS_RULES.pricing.serviceCallFlatEur },
  ];
}

function withDefaults(data: DocumentData, withPriceDefaults = false): DocumentData {
  const currentRows = data.positionen || [];
  const positionen = withPriceDefaults && currentRows.length === 0 ? getDefaultPricePositions() : currentRows;
  const arbeitstage =
    (data.arbeitstage || []).length > 0
      ? (data.arbeitstage || []).map((entry) => ({
          ...entry,
          notiz: entry.notiz || "",
        }))
      : data.zeiten?.beginn && data.zeiten?.ende
      ? toArbeitstageFromZeiten(data)
      : [];

  return {
    ...data,
    dokument_datum: data.dokument_datum || new Date().toISOString().slice(0, 10),
    referenz: data.referenz || data.ticket_nummer,
    zeiten: data.zeiten || { ankunft: null, beginn: null, ende: null, gesamtstunden: 0 },
    arbeitstage,
    materialliste: data.materialliste || [],
    fotodokumentation: data.fotodokumentation || [],
    hinweise: data.hinweise || "",
    positionen,
    zahlungsziel_tage: data.zahlungsziel_tage || 7,
    zahlungshinweis: data.zahlungshinweis || "Zahlbar innerhalb 7 Tage ohne Abzug.",
    signatur_kunde_image: data.signatur_kunde_image || null,
    signatur_kusi_image: data.signatur_kusi_image || null,
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function SignatureBox({
  label,
  image,
}: {
  label: string;
  image?: string | null;
}) {
  return (
    <div className="document-signature-box">
      <div className="document-signature-image-wrap">{image ? <img src={image} alt={label} className="document-signature-image" /> : null}</div>
      <div className="document-signature-line" />
      <p>{label}</p>
    </div>
  );
}

function serializeEditorSnapshot(snapshot: DocumentEditorSnapshot): string {
  return JSON.stringify(snapshot);
}

function stripHeavyDraftData(data: DocumentData): DocumentData {
  return {
    ...data,
    fotodokumentation: [],
  };
}

function autosaveTone(state: DocumentAutosaveState): string {
  if (state === "error") return "border-rose-400/35 bg-rose-500/10 text-rose-100";
  if (state === "invalid") return "border-amber-300/35 bg-amber-400/10 text-amber-100";
  if (state === "saving" || state === "dirty") return "border-sky-300/35 bg-sky-400/10 text-sky-100";
  return "border-emerald-300/35 bg-emerald-400/10 text-emerald-100";
}

export function AdminDocumentEditorPage() {
  const outlet = useOutletContext<{ token?: string } | undefined>();
  const token = outlet?.token ?? "";
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const cfg = rapportConfig();
  const draftKey = React.useMemo(() => `${DOCUMENT_DRAFT_PREFIX}${id}`, [id]);

  const [doc, setDoc] = React.useState<TicketDocument | null>(null);
  const [data, setData] = React.useState<DocumentData | null>(null);
  const [status, setStatus] = React.useState<DocumentStatus>("entwurf");
  const [saving, setSaving] = React.useState(false);
  const [autosaveSaving, setAutosaveSaving] = React.useState(false);
  const [autosaveState, setAutosaveState] = React.useState<DocumentAutosaveState>("idle");
  const [autosaveMessage, setAutosaveMessage] = React.useState("Automatisches Speichern aktiv.");
  const [sendingMail, setSendingMail] = React.useState(false);
  const [info, setInfo] = React.useState("");
  const [error, setError] = React.useState("");
  const [signatureModal, setSignatureModal] = React.useState<"kunde" | "kusi" | null>(null);
  const [mailTo, setMailTo] = React.useState("");
  const [mailSubject, setMailSubject] = React.useState("");
  const [mailMessage, setMailMessage] = React.useState("");
  const [baseSnapshot, setBaseSnapshot] = React.useState("");
  const [baseUpdatedAt, setBaseUpdatedAt] = React.useState("");
  const saveLockRef = React.useRef(false);
  const latestSnapshotSignatureRef = React.useRef("");
  const photoGalleryInputRef = React.useRef<HTMLInputElement | null>(null);
  const photoCameraInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!token || !id) return;
    let stop = false;
    setDoc(null);
    setData(null);
    setInfo("");
    setError("");
    setSignatureModal(null);
    setAutosaveState("idle");
    setAutosaveMessage("Rapport wird geladen...");
    loadTicketDocument(token, id)
      .then((loaded) => {
        if (stop) return;
        const initData = withDefaults(loaded.data, cfg.hasPrices);
        const recipientName = String(initData.kunde || "").trim();
        const serverSnapshot: DocumentEditorSnapshot = {
          data: initData,
          status: loaded.status,
          mailTo: String(initData.kunde_email || "").trim(),
          mailSubject: `KusiPrimeTec | ${plainDocLabel()} ${loaded.dokument_nummer} | Ticket ${initData.ticket_nummer}`,
          mailMessage: defaultMailMessage(recipientName, loaded.dokument_nummer, initData.ticket_nummer),
        };
        const draft = readLocalDraft<DocumentEditorDraft>(draftKey);
        const canRestoreDraft = Boolean(draft && draft.baseUpdatedAt === loaded.updated_at);
        const restoredSnapshot: DocumentEditorSnapshot = canRestoreDraft
          ? {
              data: withDefaults(draft!.data, cfg.hasPrices),
              status: draft!.status,
              mailTo: draft!.mailTo,
              mailSubject: draft!.mailSubject,
              mailMessage: draft!.mailMessage,
            }
          : serverSnapshot;

        setDoc(loaded);
        setData(restoredSnapshot.data);
        setStatus(restoredSnapshot.status);
        setMailTo(restoredSnapshot.mailTo);
        setMailSubject(restoredSnapshot.mailSubject);
        setMailMessage(restoredSnapshot.mailMessage);
        setBaseSnapshot(serializeEditorSnapshot(serverSnapshot));
        setBaseUpdatedAt(loaded.updated_at);
        setAutosaveState(canRestoreDraft ? "dirty" : "saved");
        setAutosaveMessage(
          canRestoreDraft
            ? "Lokaler Rapport-Entwurf wiederhergestellt. Änderungen werden automatisch übernommen."
            : "Alle Änderungen gespeichert."
        );
      })
      .catch((err) => {
        if (stop) return;
        setError(toUserMessage(err, "Dokument konnte nicht geladen werden."));
        setAutosaveState("error");
        setAutosaveMessage("Dokument konnte nicht geladen werden.");
      });
    return () => {
      stop = true;
    };
  }, [cfg.hasPrices, draftKey, id, token]);

  function patchData<K extends keyof DocumentData>(key: K, value: DocumentData[K]) {
    setData((prev) => ({ ...(prev || ({} as DocumentData)), [key]: value }));
  }

  const computedHours = React.useMemo(() => minutesToHours(data?.zeiten?.beginn, data?.zeiten?.ende), [data?.zeiten?.beginn, data?.zeiten?.ende]);

  const dayEntries = React.useMemo(() => data?.arbeitstage || [], [data?.arbeitstage]);

  const computedDayEntries = React.useMemo(
    () =>
      dayEntries.map((entry) => ({
        ...entry,
        stunden: minutesToHours(entry.beginn, entry.ende) ?? Number(entry.stunden || 0),
      })),
    [dayEntries]
  );

  const computedTotalHours = React.useMemo(() => {
    if (computedDayEntries.length > 0) {
      return Number(computedDayEntries.reduce((sum, item) => sum + Number(item.stunden || 0), 0).toFixed(2));
    }
    if (computedHours != null) return computedHours;
    return Number(data?.zeiten?.gesamtstunden || 0);
  }, [computedDayEntries, computedHours, data?.zeiten?.gesamtstunden]);

  React.useEffect(() => {
    if (!data) return;
    if (computedHours == null) return;
    const current = Number(data.zeiten?.gesamtstunden || 0);
    if (Math.abs(current - computedTotalHours) < 0.01) return;
    patchData("zeiten", { ...data.zeiten, gesamtstunden: computedTotalHours });
  }, [computedHours, computedTotalHours, data]);

  const preparedDocument = React.useMemo(() => {
    if (!data) return { payloadData: null as DocumentData | null, validationError: null as string | null };

    const cleanPositions = (data.positionen || [])
      .map((row, idx) => ({
        ...row,
        id: String(row.id || `p-${idx + 1}`),
        nr: Number(row.nr || idx + 1),
        bezeichnung: String(row.bezeichnung || "").trim(),
        menge: Number(row.menge || 0),
        einheit: String(row.einheit || "").trim(),
        einzelpreis: Number(row.einzelpreis || 0),
      }))
      .filter((row) => row.bezeichnung || row.menge || row.einheit || row.einzelpreis);

    if (cfg.hasPrices && cleanPositions.length === 0) {
      return { payloadData: null, validationError: "Bitte mindestens eine Position eintragen." };
    }

    if (cfg.hasPrices) {
      const invalidPosition = cleanPositions.findIndex((row) => !row.bezeichnung || row.menge <= 0 || !row.einheit);
      if (invalidPosition >= 0) {
        return {
          payloadData: null,
          validationError: `Position ${invalidPosition + 1}: Beschreibung, Menge und Einheit sind Pflicht.`,
        };
      }
    }

    const cleanMaterial = (data.materialliste || [])
      .map((item, idx) => ({
        id: String(item.id || `m-${idx + 1}`),
        beschreibung: String(item.beschreibung || "").trim(),
        menge: Number(item.menge || 0),
        einheit: String(item.einheit || "").trim(),
      }))
      .filter((item) => item.beschreibung || item.menge || item.einheit);

    if (cfg.docType === "rapport") {
      const invalidIndex = cleanMaterial.findIndex((item) => !item.beschreibung || item.menge <= 0 || !item.einheit);
      if (invalidIndex >= 0) {
        return {
          payloadData: null,
          validationError: `Materialposition ${invalidIndex + 1}: Beschreibung, Menge und Einheit sind Pflicht.`,
        };
      }
    }

    const payloadData: DocumentData = {
      ...data,
      zeiten: {
        ...(data.zeiten || {}),
        gesamtstunden: computedTotalHours,
      },
      arbeitstage: computedDayEntries,
      positionen: cfg.hasPrices ? cleanPositions : data.positionen,
      materialliste: cfg.docType === "rapport" ? cleanMaterial : data.materialliste,
    };

    return { payloadData, validationError: null as string | null };
  }, [cfg.docType, cfg.hasPrices, computedDayEntries, computedTotalHours, data]);

  const currentSnapshot = React.useMemo<DocumentEditorSnapshot | null>(() => {
    if (!data) return null;
    return {
      data: preparedDocument.payloadData || withDefaults(data, cfg.hasPrices),
      status,
      mailTo,
      mailSubject,
      mailMessage,
    };
  }, [cfg.hasPrices, data, mailMessage, mailSubject, mailTo, preparedDocument.payloadData, status]);
  const currentSnapshotSignature = React.useMemo(
    () => (currentSnapshot ? serializeEditorSnapshot(currentSnapshot) : ""),
    [currentSnapshot]
  );
  latestSnapshotSignatureRef.current = currentSnapshotSignature;
  const isDirty = Boolean(currentSnapshot && currentSnapshotSignature !== baseSnapshot);

  function patchPosition(index: number, patch: Partial<DocumentPosition>) {
    setData((prev) => {
      if (!prev) return prev;
      const rows = [...(prev.positionen || [])];
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, positionen: rows };
    });
  }

  function addPosition() {
    setData((prev) => {
      if (!prev) return prev;
      const rows = [...(prev.positionen || [])];
      rows.push({
        id: `p-${Date.now()}`,
        nr: rows.length + 1,
        bezeichnung: "",
        menge: 1,
        einheit: "Stk",
        einzelpreis: 0,
      });
      return { ...prev, positionen: rows };
    });
  }

  function removePosition(index: number) {
    setData((prev) => {
      if (!prev) return prev;
      const rows = [...(prev.positionen || [])].filter((_, idx) => idx !== index).map((row, idx) => ({ ...row, nr: idx + 1 }));
      return { ...prev, positionen: rows };
    });
  }

  function patchMaterial(index: number, patch: Partial<DocumentMaterialPosition>) {
    setData((prev) => {
      if (!prev) return prev;
      const rows = [...(prev.materialliste || [])];
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, materialliste: rows };
    });
  }

  function patchArbeitstag(index: number, patch: Partial<DocumentArbeitstag>) {
    setData((prev) => {
      if (!prev) return prev;
      const rows = [...(prev.arbeitstage || [])];
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, arbeitstage: rows };
    });
  }

  function addArbeitstag() {
    setData((prev) => {
      if (!prev) return prev;
      const rows = [...(prev.arbeitstage || [])];
      rows.push({
        id: `tag-${Date.now()}-${rows.length + 1}`,
        datum: prev.dokument_datum || new Date().toISOString().slice(0, 10),
        beginn: "",
        ende: "",
        stunden: 0,
        notiz: "",
      });
      return { ...prev, arbeitstage: rows };
    });
  }

  function removeArbeitstag(index: number) {
    setData((prev) => {
      if (!prev) return prev;
      const rows = [...(prev.arbeitstage || [])];
      rows.splice(index, 1);
      return { ...prev, arbeitstage: rows };
    });
  }

  function addMaterial() {
    setData((prev) => {
      if (!prev) return prev;
      const rows = [...(prev.materialliste || [])];
      rows.push({
        id: `m-${Date.now()}`,
        beschreibung: "",
        menge: 1,
        einheit: "Stk",
      });
      return { ...prev, materialliste: rows };
    });
  }

  function removeMaterial(index: number) {
    setData((prev) => {
      if (!prev) return prev;
      const rows = [...(prev.materialliste || [])];
      if (rows.length <= 1) {
        return {
          ...prev,
          materialliste: [
            {
              id: `m-${Date.now()}`,
              beschreibung: "",
              menge: 1,
              einheit: "Stk",
            },
          ],
        };
      }
      rows.splice(index, 1);
      return { ...prev, materialliste: rows };
    });
  }

  async function handleSignatureUpload(kind: "kunde" | "kusi", file: File | null) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      if (kind === "kunde") patchData("signatur_kunde_image", dataUrl);
      else patchData("signatur_kusi_image", dataUrl);
    } catch (err) {
      setError(toUserMessage(err, "Signatur konnte nicht verarbeitet werden."));
    }
  }

  async function addPhoto(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    try {
      setError("");
      const files = Array.from(fileList).slice(0, 6);
      const acceptedFiles = files.filter((file) => file.size <= MAX_DOCUMENT_PHOTO_SIZE_BYTES);
      if (acceptedFiles.length === 0) {
        setError("Das Foto ist größer als erlaubt (max. 10 MB).");
        return;
      }
      if (acceptedFiles.length < files.length) {
        setError("Mindestens ein Foto war größer als erlaubt (max. 10 MB) und wurde übersprungen.");
      }
      const urls = await Promise.all(acceptedFiles.map((file) => fileToDataUrl(file)));
      setData((prev) => {
        if (!prev) return prev;
        return { ...prev, fotodokumentation: [...(prev.fotodokumentation || []), ...urls].slice(0, 10) };
      });
    } catch (err) {
      setError(toUserMessage(err, "Fotos konnten nicht verarbeitet werden."));
    }
  }

  function openPhotoPicker(kind: "gallery" | "camera") {
    if (kind === "camera") {
      photoCameraInputRef.current?.click();
      return;
    }
    photoGalleryInputRef.current?.click();
  }

  React.useEffect(() => {
    if (!currentSnapshot) return;
    if (!isDirty) {
      removeLocalDraft(draftKey);
      return;
    }

    const fullDraft: DocumentEditorDraft = {
      ...currentSnapshot,
      baseUpdatedAt,
      savedAt: new Date().toISOString(),
    };
    if (writeLocalDraft(draftKey, fullDraft)) return;

    const compactDraft: DocumentEditorDraft = {
      ...fullDraft,
      data: stripHeavyDraftData(currentSnapshot.data),
    };
    if (!writeLocalDraft(draftKey, compactDraft)) {
      setAutosaveState("error");
      setAutosaveMessage("Lokaler Entwurf konnte nicht gesichert werden.");
    }
  }, [baseUpdatedAt, currentSnapshot, draftKey, isDirty]);

  const saveDocument = React.useCallback(
    async (options?: { nextStatus?: DocumentStatus; silent?: boolean; successMessage?: string }): Promise<boolean> => {
      if (!doc || !currentSnapshot || !preparedDocument.payloadData) {
        if (preparedDocument.validationError) {
          if (options?.silent) {
            setAutosaveState("invalid");
            setAutosaveMessage(preparedDocument.validationError);
          } else {
            setError(preparedDocument.validationError);
          }
        }
        return false;
      }
      if (saveLockRef.current) return false;

      saveLockRef.current = true;
      if (options?.silent) {
        setAutosaveSaving(true);
        setAutosaveState("saving");
        setAutosaveMessage("Rapport wird gespeichert...");
      } else {
        setSaving(true);
        setInfo("");
      }
      setError("");

      try {
        const effectiveStatus = options?.nextStatus || status;
        const payloadData = preparedDocument.payloadData;
        const requestSnapshotSignature = currentSnapshotSignature;
        const requestMailTo = mailTo;
        const requestStatus = status;
        const previousNumber = String(doc.dokument_nummer || "").trim();
        let nextMailSubject = mailSubject;
        let nextMailMessage = mailMessage;
        const saveResult = await saveTicketDocument(token, doc.id, { data: payloadData, status: effectiveStatus });
        const nextNumber = String(saveResult.dokument_nummer || "").trim();
        if (nextNumber && nextNumber !== previousNumber) {
          if (previousNumber) {
            nextMailSubject = mailSubject.replace(previousNumber, nextNumber);
            nextMailMessage = mailMessage.replace(previousNumber, nextNumber);
          }
          setMailSubject((current) => (current === mailSubject ? nextMailSubject : current));
          setMailMessage((current) => (current === mailMessage ? nextMailMessage : current));
        }

        const now = new Date().toISOString();
        const hasNewerChanges = hasNewerLocalSnapshot(requestSnapshotSignature, latestSnapshotSignatureRef.current);
        setDoc((prev) =>
          prev
            ? {
                ...prev,
                dokument_nummer: nextNumber || prev.dokument_nummer,
                status: hasNewerChanges ? prev.status : effectiveStatus,
                data: hasNewerChanges ? prev.data : payloadData,
                updated_at: now,
              }
            : prev
        );
        if (!hasNewerChanges) setData(payloadData);
        setStatus((current) => (current === requestStatus ? effectiveStatus : current));
        const nextSnapshot: DocumentEditorSnapshot = {
          data: payloadData,
          status: effectiveStatus,
          mailTo: requestMailTo,
          mailSubject: nextMailSubject,
          mailMessage: nextMailMessage,
        };
        setBaseSnapshot(serializeEditorSnapshot(nextSnapshot));
        setBaseUpdatedAt(now);
        if (hasNewerChanges) {
          setAutosaveState("dirty");
          setAutosaveMessage("Neuere Änderungen werden als Nächstes gespeichert...");
          return false;
        }
        removeLocalDraft(draftKey);
        setAutosaveState("saved");
        setAutosaveMessage("Alle Änderungen gespeichert.");
        if (!options?.silent) setInfo(options?.successMessage || "Dokument gespeichert.");
        return true;
      } catch (err) {
        const message = toUserMessage(err, "Dokument konnte nicht gespeichert werden.");
        setError(message);
        if (options?.silent) {
          setAutosaveState("error");
          setAutosaveMessage(message);
        }
        return false;
      } finally {
        saveLockRef.current = false;
        if (options?.silent) setAutosaveSaving(false);
        else setSaving(false);
      }
    },
    [currentSnapshot, currentSnapshotSignature, doc, draftKey, mailMessage, mailSubject, mailTo, preparedDocument, status, token]
  );

  React.useEffect(() => {
    if (!currentSnapshot) return;
    if (!isDirty) {
      if (!autosaveSaving) {
        setAutosaveState("saved");
        setAutosaveMessage("Alle Änderungen gespeichert.");
      }
      return;
    }
    if (preparedDocument.validationError) {
      setAutosaveState("invalid");
      setAutosaveMessage(preparedDocument.validationError);
      return;
    }

    setAutosaveState("dirty");
    setAutosaveMessage("Änderungen werden automatisch gespeichert...");
    const timer = window.setTimeout(() => {
      void saveDocument({ silent: true });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [autosaveSaving, currentSnapshot, currentSnapshotSignature, isDirty, preparedDocument.validationError, saveDocument]);

  React.useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  async function finishDocument() {
    if (!doc || !data) return;
    const summary = [
      `Kunde: ${String(data.kunde || "-").trim() || "-"}`,
      `Objekt: ${String(data.objekt_adresse || "-").trim() || "-"}`,
      `Datum: ${String(data.dokument_datum || "-").trim() || "-"}`,
      `Arbeitszeit: ${String(data.zeiten?.beginn || "-")} - ${String(data.zeiten?.ende || "-")}`,
      `Berechnete Stunden: ${computedTotalHours.toFixed(2)} h`,
      `Fotos: ${data.fotodokumentation?.length || 0}`,
    ].join("\n");
    const confirmed = window.confirm(
      `Rapport prüfen und verbindlich abschließen?\n\n${summary}\n\nDer Rapport wird als abgeschlossen gespeichert.`
    );
    if (!confirmed) return;
    await saveDocument({ nextStatus: "akzeptiert", successMessage: "Rapport verbindlich abgeschlossen." });
  }

  async function sendMail() {
    if (!doc || !data) return;
    const to = String(mailTo || "").trim();
    if (!to) {
      setError("Bitte Empfänger-E-Mail eintragen.");
      return;
    }

    const saved = await saveDocument();
    if (!saved) return;

    setSendingMail(true);
    setError("");
    setInfo("");
    try {
      const result = await sendTicketDocumentEmail(token, {
        document_id: doc.id,
        to,
        subject: mailSubject,
        message: mailMessage,
      });
      setStatus("gesendet");
      const providerText = result.provider ? ` (${result.provider.toUpperCase()})` : "";
      const bccText = result.bcc_count ? ` · BCC: ${result.bcc_count}` : "";
      setInfo(
        result.attached
          ? `E-Mail mit Dokumentanhang an ${result.to} versendet${providerText}${bccText}.`
          : `E-Mail an ${result.to} versendet${providerText}${bccText}.`
      );
    } catch (err) {
      setError(toUserMessage(err, "E-Mail konnte nicht versendet werden."));
    } finally {
      setSendingMail(false);
    }
  }

  async function printPdf() {
    if (isDirty && !preparedDocument.validationError) {
      await saveDocument({ silent: true });
    }
    const originalTitle = document.title;
    const filenameBase = String(doc?.dokument_nummer || data?.ticket_nummer || "dokument")
      .trim()
      .replace(/[^\w.-]+/g, "_");
    document.title = `${filenameBase || "dokument"}.pdf`;
    window.print();
    window.setTimeout(() => {
      document.title = originalTitle;
    }, 400);
  }

  if (!doc || !data) {
    return (
      <div className="page-enter">
        <SectionTitle title={`${cfg.title} Editor`} subtitle="Lade Dokument..." />
        <LoadingSpinner label="Dokument wird geladen..." className="py-1" />
        {error ? <Toast kind="error" text={error} /> : null}
      </div>
    );
  }

  const rows = data.positionen || [];
  const summe = documentTotal(rows);
  const materialRows =
    (data.materialliste || []).length > 0
      ? (data.materialliste || [])
      : [
          {
            id: "m-1",
            beschreibung: "",
            menge: 1,
            einheit: "Stk",
          },
        ];
  const customerSignatureLabel = data.signatur_kunde_label || "Unterschrift Kunde (Arbeitsbestätigung)";
  const kusiSignatureLabel = data.signatur_kusi_label || "Unterschrift KusiPrimeTec";
  const recipientName = String(data.kunde || "").trim();
  const recipientAddress = resolveRecipientAddress(data);
  const recipientStreet = recipientAddress.street;
  const recipientZipCity = recipientAddress.zipCity;
  const recipientExtraLines = recipientAddress.extras;
  const senderCompactLine = `KusiPrimeTec · ${COMPANY_PROFILE.addressStreet} · ${COMPANY_PROFILE.addressZipCity}`;
  const documentDateDisplay = formatDateTagMonatJahr(data.dokument_datum);
  const serviceDateDisplay = formatDateTagMonatJahr(data.dokument_datum);
  const objectLabel =
    [String(data.objekt_strasse || "").trim(), [String(data.objekt_plz || "").trim(), String(data.objekt_ort || "").trim()].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ") ||
    String(data.objekt_adresse || "").trim() ||
    "-";
  const compactTaskLabel = firstLine(data.leistungsbeschreibung || "") || "-";

  return (
    <div className="page-enter space-y-4 document-editor-shell">
      <div className="no-print">
        <div className="mb-2">
          <Button variant="secondary" className="px-3 py-1 text-sm" onClick={() => navigate(`/admin/tickets/${doc.ticket_id}`)}>
            Zurück zum Ticket
          </Button>
        </div>
        <SectionTitle title={`${cfg.title} ${doc.dokument_nummer}`} subtitle={`Ticket ${data.ticket_nummer}`} />
      </div>

      {info ? <Toast kind="ok" text={info} className="no-print" /> : null}
      {error ? <Toast kind="error" text={error} className="no-print" /> : null}

      <div className="grid gap-3 no-print 2xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <GlassCard className="p-4 sm:p-5">
          <div className="grid gap-3 text-sm">
            <section className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-electric-200">Einsatzbasis</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--line)]/80 bg-slate-900/35 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-soft)]">Kunde</p>
                  <p className="mt-1 break-words font-semibold text-white">{recipientName || "-"}</p>
                </div>
                <div className="rounded-xl border border-[var(--line)]/80 bg-slate-900/35 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-soft)]">Objekt</p>
                  <p className="mt-1 break-words font-semibold text-white">{objectLabel}</p>
                </div>
                <div className="rounded-xl border border-[var(--line)]/80 bg-slate-900/35 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-soft)]">Ticket</p>
                  <p className="mt-1 font-semibold text-white">{data.ticket_nummer}</p>
                  <p className="mt-1 break-words text-xs text-[var(--text-soft)]">{compactTaskLabel}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">Rapportinhalt</h2>
                <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--text-soft)]">
                  Mobile-first optimiert
                </span>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span>Dokumentdatum</span>
                    <input type="date" className="premium-input px-3 py-2" value={data.dokument_datum || ""} onChange={(e) => patchData("dokument_datum", e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span>Referenz</span>
                    <input className="premium-input px-3 py-2" value={data.referenz || ""} onChange={(e) => patchData("referenz", e.target.value)} />
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span>Ansprechpartner Kunde</span>
                    <input className="premium-input px-3 py-2" value={data.ansprechpartner || ""} onChange={(e) => patchData("ansprechpartner", e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span>Betreut durch</span>
                    <input className="premium-input px-3 py-2" value={data.betreut_durch || ""} onChange={(e) => patchData("betreut_durch", e.target.value)} />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span>Ausgeführte Arbeiten</span>
                  <textarea
                    className="premium-input min-h-32 px-3 py-2"
                    value={data.leistungsbeschreibung || ""}
                    placeholder="Durchgeführte Arbeiten und Maßnahmen eintragen"
                    onChange={(e) => patchData("leistungsbeschreibung", e.target.value)}
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="grid gap-1">
                    <span>Ankunft</span>
                    <input type="time" step={900} className="premium-input px-3 py-2" value={data.zeiten?.ankunft || ""} onChange={(e) => patchData("zeiten", { ...data.zeiten, ankunft: e.target.value || null })} />
                  </label>
                  <label className="grid gap-1">
                    <span>Beginn</span>
                    <input type="time" step={900} className="premium-input px-3 py-2" value={data.zeiten?.beginn || ""} onChange={(e) => patchData("zeiten", { ...data.zeiten, beginn: e.target.value || null })} />
                  </label>
                  <label className="grid gap-1">
                    <span>Ende</span>
                    <input type="time" step={900} className="premium-input px-3 py-2" value={data.zeiten?.ende || ""} onChange={(e) => patchData("zeiten", { ...data.zeiten, ende: e.target.value || null })} />
                  </label>
                  <label className="grid gap-1">
                    <span>Berechnete Zeit (Std)</span>
                    <input type="number" step="0.01" className="premium-input px-3 py-2" value={computedTotalHours} readOnly />
                  </label>
                </div>
                <p className="text-xs text-[var(--text-soft)]">
                  Arbeitsstunden werden automatisch aus Beginn und Ende berechnet. Ungespeicherte Änderungen bleiben lokal erhalten.
                </p>

                <div className="rounded-xl border border-[var(--line)] bg-slate-900/35 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">Arbeitstage</p>
                    <Button type="button" variant="secondary" className="w-full px-3 py-2 text-sm sm:w-auto" onClick={addArbeitstag}>
                      Tag hinzufügen
                    </Button>
                  </div>
                  {computedDayEntries.length === 0 ? (
                    <p className="text-xs text-[var(--text-soft)]">Noch keine Arbeitstage erfasst. Für mehrtägige Einsätze bitte Tage hinzufügen.</p>
                  ) : (
                    <div className="space-y-2">
                      {computedDayEntries.map((item, idx) => (
                        <div key={item.id || `tag-${idx}`} className="grid gap-2 rounded-xl border border-[var(--line)] bg-slate-950/40 p-3 sm:grid-cols-2 xl:grid-cols-[140px_120px_120px_110px_minmax(0,1fr)_140px]">
                          <label className="grid gap-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Datum</span>
                            <input type="date" className="premium-input px-3 py-2 text-sm" value={item.datum || ""} onChange={(e) => patchArbeitstag(idx, { datum: e.target.value })} />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Beginn</span>
                            <input type="time" step={900} className="premium-input px-3 py-2 text-sm" value={item.beginn || ""} onChange={(e) => patchArbeitstag(idx, { beginn: e.target.value })} />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Ende</span>
                            <input type="time" step={900} className="premium-input px-3 py-2 text-sm" value={item.ende || ""} onChange={(e) => patchArbeitstag(idx, { ende: e.target.value })} />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Stunden</span>
                            <input type="number" step="0.01" className="premium-input px-3 py-2 text-sm" value={Number(item.stunden || 0)} readOnly />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Notiz optional</span>
                            <input className="premium-input px-3 py-2 text-sm" value={item.notiz || ""} placeholder="Zusätzliche Hinweise optional eintragen" onChange={(e) => patchArbeitstag(idx, { notiz: e.target.value })} />
                          </label>
                          <div className="grid gap-1 xl:self-end">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Aktion</span>
                            <Button type="button" variant="secondary" className="px-3 py-2 text-sm" onClick={() => removeArbeitstag(idx)}>
                              Entfernen
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-[var(--text-soft)]">
                    Gesamtstunden über alle Arbeitstage: <span className="font-semibold text-white">{computedTotalHours.toFixed(2)} h</span>
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--line)] bg-slate-900/35 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">Materialliste</p>
                    <Button type="button" variant="secondary" className="w-full px-3 py-2 text-sm sm:w-auto" onClick={addMaterial}>
                      Material hinzufügen
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {materialRows.map((item, idx) => (
                      <div key={item.id || `material-${idx}`} className="grid gap-2 rounded-xl border border-[var(--line)] bg-slate-950/40 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_120px_160px_140px]">
                        <label className="grid gap-1 sm:col-span-2 xl:col-span-1">
                          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Material</span>
                          <input className="premium-input px-3 py-2 text-sm" value={item.beschreibung || ""} placeholder="Beschreibung" onChange={(e) => patchMaterial(idx, { beschreibung: e.target.value })} />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Menge</span>
                          <input type="number" min="0.01" step="0.01" className="premium-input px-3 py-2 text-sm" value={item.menge ?? 1} onChange={(e) => patchMaterial(idx, { menge: Number(e.target.value || 0) })} />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Einheit</span>
                          <select className="premium-input px-3 py-2 text-sm" value={item.einheit || "Stk"} onChange={(e) => patchMaterial(idx, { einheit: e.target.value })}>
                            {MATERIAL_EINHEITEN.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid gap-1 xl:self-end">
                          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">Aktion</span>
                          <Button type="button" variant="secondary" className="px-3 py-2 text-sm" onClick={() => removeMaterial(idx)} title="Position entfernen">
                            Entfernen
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="grid gap-1">
                  <span>Ergebnis / Hinweise / Empfehlungen</span>
                  <textarea
                    className="premium-input min-h-28 px-3 py-2"
                    value={data.hinweise || ""}
                    placeholder="Ergebnis der durchgeführten Arbeiten eintragen"
                    onChange={(e) => patchData("hinweise", e.target.value)}
                  />
                </label>

                <div className="rounded-xl border border-[var(--line)] bg-slate-900/35 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">Fotodokumentation</p>
                      <p className="text-xs text-[var(--text-soft)]">Direkt vor Ort per Kamera oder Galerie hinzufügen.</p>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                      <Button type="button" variant="secondary" className="flex-1 px-3 py-2 text-sm sm:flex-none" onClick={() => openPhotoPicker("camera")}>
                        Foto aufnehmen
                      </Button>
                      <Button type="button" variant="secondary" className="flex-1 px-3 py-2 text-sm sm:flex-none" onClick={() => openPhotoPicker("gallery")}>
                        Aus Galerie wählen
                      </Button>
                    </div>
                  </div>
                  <input
                    ref={photoCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      void addPhoto(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                  <input
                    ref={photoGalleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void addPhoto(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                  {(data.fotodokumentation || []).length > 0 ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {(data.fotodokumentation || []).map((src, idx) => (
                        <div key={`${src.slice(0, 16)}-${idx}`} className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-slate-950/45">
                          <img src={src} alt={`Foto ${idx + 1}`} loading="lazy" className="h-28 w-full object-cover" />
                          <button
                            type="button"
                            className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white"
                            onClick={() => patchData("fotodokumentation", (data.fotodokumentation || []).filter((_, i) => i !== idx))}
                          >
                            Entfernen
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-[var(--text-soft)]">Noch keine Fotos hinzugefügt.</p>
                  )}
                </div>

                {cfg.hasPrices ? (
                  <div className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-semibold text-white">Positionen</p>
                      <Button type="button" variant="secondary" className="px-3 py-2 text-sm" onClick={addPosition}>
                        Position hinzufügen
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {rows.map((row, idx) => (
                        <div key={row.id} className="grid gap-2 rounded-lg border border-[var(--line)] bg-slate-900/45 p-2 xl:grid-cols-[52px_minmax(0,1fr)_80px_110px_110px_140px]">
                          <input className="premium-input px-2 py-1.5 text-xs" value={row.nr} onChange={(e) => patchPosition(idx, { nr: Number(e.target.value || 0) })} />
                          <input className="premium-input px-2 py-1.5 text-xs" value={row.bezeichnung} onChange={(e) => patchPosition(idx, { bezeichnung: e.target.value })} />
                          <input className="premium-input px-2 py-1.5 text-xs" type="number" step="0.01" value={row.menge} onChange={(e) => patchPosition(idx, { menge: Number(e.target.value || 0) })} />
                          <select className="premium-input px-2 py-1.5 text-xs" value={row.einheit} onChange={(e) => patchPosition(idx, { einheit: e.target.value })}>
                            {EINHEITEN.map((unit) => (
                              <option key={unit}>{unit}</option>
                            ))}
                          </select>
                          <input className="premium-input px-2 py-1.5 text-xs" type="number" step="0.01" value={row.einzelpreis} onChange={(e) => patchPosition(idx, { einzelpreis: Number(e.target.value || 0) })} />
                          <Button type="button" variant="secondary" className="px-3 py-2 text-sm" onClick={() => removePosition(idx)}>
                            Entfernen
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 border-t border-[var(--line)] pt-2 text-sm">
                      <p className="flex justify-between text-[var(--text-soft)]"><span>Zwischensumme</span><span>{fmtEur(summe)}</span></p>
                      <p className="flex justify-between text-[var(--text-soft)]"><span>USt (0,00 EUR gemäß § 19 UStG)</span><span>{fmtEur(0)}</span></p>
                      <p className="flex justify-between font-semibold text-white"><span>Gesamt</span><span>{fmtEur(summe)}</span></p>
                    </div>
                  </div>
                ) : null}

                {cfg.customerSignature ? (
                  <div className="rounded-xl border border-[var(--line)] bg-slate-900/35 p-3">
                    <p className="font-semibold text-white">Signaturen</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-xs text-[var(--text-soft)]">Signatur Kunde</span>
                        <input className="premium-input px-3 py-2 text-sm" value={customerSignatureLabel} onChange={(e) => patchData("signatur_kunde_label", e.target.value)} />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs text-[var(--text-soft)]">Signatur KusiPrimeTec</span>
                        <input className="premium-input px-3 py-2 text-sm" value={kusiSignatureLabel} onChange={(e) => patchData("signatur_kusi_label", e.target.value)} />
                      </label>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-[var(--line)] bg-slate-950/35 p-3">
                        <p className="mb-2 text-xs text-[var(--text-soft)]">Signatur Kunde</p>
                        {data.signatur_kunde_image ? (
                          <img src={data.signatur_kunde_image} alt="Signatur Kunde" loading="lazy" className="mb-2 h-14 max-w-full rounded border border-[var(--line)] bg-white object-contain p-1" />
                        ) : (
                          <p className="mb-2 text-xs text-[var(--text-soft)]">Noch keine Signatur vorhanden.</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="secondary" className="w-full px-3 py-2 text-sm sm:w-auto" onClick={() => setSignatureModal("kunde")}>
                            Signatur hinzufügen
                          </Button>
                          <Button type="button" variant="secondary" className="w-full px-3 py-2 text-sm sm:w-auto" onClick={() => patchData("signatur_kunde_image", null)}>
                            Signatur löschen
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-lg border border-[var(--line)] bg-slate-950/35 p-3">
                        <p className="mb-2 text-xs text-[var(--text-soft)]">Signatur KusiPrimeTec</p>
                        {data.signatur_kusi_image ? (
                          <img src={data.signatur_kusi_image} alt="Signatur KusiPrimeTec" loading="lazy" className="mb-2 h-14 max-w-full rounded border border-[var(--line)] bg-white object-contain p-1" />
                        ) : (
                          <p className="mb-2 text-xs text-[var(--text-soft)]">Noch keine Signatur vorhanden.</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="secondary" className="w-full px-3 py-2 text-sm sm:w-auto" onClick={() => setSignatureModal("kusi")}>
                            Signatur hinzufügen
                          </Button>
                          <Button type="button" variant="secondary" className="w-full px-3 py-2 text-sm sm:w-auto" onClick={() => patchData("signatur_kusi_image", null)}>
                            Signatur löschen
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-xs text-[var(--text-soft)]">Alternativ Bild Kunde hochladen</span>
                        <input type="file" accept="image/*" className="premium-input px-3 py-2 text-sm" onChange={(e) => void handleSignatureUpload("kunde", e.target.files?.[0] || null)} />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs text-[var(--text-soft)]">Alternativ Bild KusiPrimeTec hochladen</span>
                        <input type="file" accept="image/*" className="premium-input px-3 py-2 text-sm" onChange={(e) => void handleSignatureUpload("kusi", e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-5">
          <h3 className="font-semibold text-white">Meta & Aktionen</h3>
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 rounded-xl border border-[var(--line)] bg-slate-950/35 p-3 text-sm text-[var(--text-soft)]">
              <p><span className="text-white">Dokument:</span> {doc.dokument_nummer}</p>
              <p><span className="text-white">Status:</span> {status}</p>
              <p><span className="text-white">Ticket:</span> {data.ticket_nummer}</p>
              <p><span className="text-white">Kunde:</span> {data.kunde}</p>
              <p><span className="text-white">Aktualisiert:</span> {dateTime(doc.updated_at)}</p>
            </div>

            <div className={`rounded-xl border p-3 ${autosaveTone(autosaveState)}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">Autosave</p>
              <p className="mt-1 text-sm text-white">{autosaveMessage}</p>
              <p className="mt-1 text-xs text-[var(--text-soft)]">
                Signaturen, Texte und Status werden lokal gepuffert und bei gültigen Eingaben automatisch gespeichert.
              </p>
            </div>

            <div className="grid gap-2">
              <label className="grid gap-1">
                <span className="text-xs text-[var(--text-soft)]">Dokumentstatus</span>
                <select className="premium-input px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as DocumentStatus)}>
                  <option value="entwurf">entwurf</option>
                  <option value="gesendet">gesendet</option>
                  <option value="akzeptiert">akzeptiert</option>
                  <option value="abgelehnt">abgelehnt</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[var(--text-soft)]">Empfänger E-Mail</span>
                <input type="email" className="premium-input px-3 py-2 text-sm" value={mailTo} onChange={(e) => setMailTo(e.target.value)} placeholder="kunde@example.com" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[var(--text-soft)]">E-Mail Betreff</span>
                <input className="premium-input px-3 py-2 text-sm" value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[var(--text-soft)]">E-Mail Text</span>
                <textarea className="premium-input min-h-28 px-3 py-2 text-sm" value={mailMessage} onChange={(e) => setMailMessage(e.target.value)} />
              </label>
            </div>

            <div className="grid gap-2">
              <Button className="hidden px-4 py-2 lg:inline-flex" onClick={() => void saveDocument()} disabled={saving || autosaveSaving}>
                {saving ? "Speichert..." : "Entwurf speichern"}
              </Button>
              <Button variant="primary" className="hidden px-4 py-2 lg:inline-flex" onClick={() => void finishDocument()} disabled={saving || autosaveSaving}>
                Rapport abschließen
              </Button>
              <Button variant="secondary" onClick={() => void printPdf()} disabled={autosaveSaving}>
                Als PDF drucken
              </Button>
              <Button variant="secondary" onClick={() => void saveDocument({ nextStatus: "gesendet", successMessage: "Dokument als versendet markiert." })} disabled={saving || autosaveSaving}>
                Als versendet markieren
              </Button>
              <Button variant="secondary" onClick={() => void sendMail()} disabled={sendingMail || autosaveSaving || !mailTo.trim()}>
                {sendingMail ? "Versendet..." : "Per E-Mail versenden"}
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>

      {signatureModal ? (
        <div className="no-print fixed inset-0 z-[90] grid place-items-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--line-strong)] bg-[rgba(10,16,30,0.96)] p-4 shadow-[0_30px_80px_rgba(2,8,20,0.7)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white">
                {signatureModal === "kunde" ? "Unterschrift Kunde" : "Unterschrift KusiPrimeTec"}
              </h3>
              <Button type="button" variant="secondary" className="px-3 py-1 text-xs" onClick={() => setSignatureModal(null)}>
                Schließen
              </Button>
            </div>
            <SignaturePad
              title="Bitte im weißen Feld unterschreiben"
              value={signatureModal === "kunde" ? data.signatur_kunde_image : data.signatur_kusi_image}
              onApply={(dataUrl) => {
                if (signatureModal === "kunde") patchData("signatur_kunde_image", dataUrl);
                if (signatureModal === "kusi") patchData("signatur_kusi_image", dataUrl);
              }}
              onClear={() => {
                if (signatureModal === "kunde") patchData("signatur_kunde_image", null);
                if (signatureModal === "kusi") patchData("signatur_kusi_image", null);
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[rgba(6,11,20,0.94)] backdrop-blur lg:hidden">
        <div className="admin-frame grid grid-cols-2 gap-2 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <Button type="button" variant="secondary" className="px-3 py-2 text-sm" onClick={() => openPhotoPicker("camera")}>
            Foto
          </Button>
          <Button type="button" variant="secondary" className="px-3 py-2 text-sm" onClick={() => void saveDocument()} disabled={saving || autosaveSaving}>
            {saving ? "Speichert..." : "Entwurf"}
          </Button>
          <Button type="button" className="col-span-2 px-4 py-2 text-sm" onClick={() => void finishDocument()} disabled={saving || autosaveSaving}>
            Rapport abschließen
          </Button>
        </div>
      </div>

      <section className="document-sheet" aria-label="Druckansicht Dokument">
        <header className="document-head">
          <div className="document-recipient">
            <p className="document-sender-line">{senderCompactLine}</p>
            <p className="document-label">Empfänger</p>
            <p className="document-recipient-name">{recipientName || "-"}</p>
            <p>{recipientStreet}</p>
            <p>{recipientZipCity}</p>
            {recipientExtraLines.length > 0 ? recipientExtraLines.map((line) => <p key={line}>{line}</p>) : null}
          </div>
          <div className="document-sender">
            <img src="/publickpt-wordmark.png" alt="KusiPrimeTec" className="document-logo" />
            <p className="document-company">KusiPrimeTec</p>
            <p>Robert Kusminov</p>
            <p>{COMPANY_PROFILE.addressStreet}</p>
            <p>{COMPANY_PROFILE.addressZipCity}</p>
            <p>Telefon: 01776364393</p>
            <p>E-Mail: info@kusiprimetec.de</p>
            <p>Web: KusiPrimeTec.de</p>
          </div>
        </header>

        <div className="document-meta-row">
          <p><strong>Dokumentnummer:</strong> {doc.dokument_nummer}</p>
          <p><strong>Datum:</strong> {documentDateDisplay}</p>
          <p><strong>Ticketnummer:</strong> {data.ticket_nummer}</p>
          <p><strong>Referenz:</strong> {data.referenz || data.ticket_nummer}</p>
          <p><strong>Ansprechpartner:</strong> {data.ansprechpartner || "-"}</p>
          <p><strong>Betreut durch:</strong> {data.betreut_durch || "-"}</p>
        </div>

        <h1 className="document-title">{cfg.title}</h1>
        <p className="document-subject">Einsatzdatum: {serviceDateDisplay}</p>

        <section className="document-section">
          <h2>Leistungsbeschreibung</h2>
          <p>{data.leistungsbeschreibung || "-"}</p>
          <p><strong>Ansprechpartner Kunde:</strong> {data.ansprechpartner || "-"}</p>
          <p><strong>Betreut durch:</strong> {data.betreut_durch || "-"}</p>
        </section>

        {cfg.hasPrices ? (
          <section className="document-section">
            <table className="document-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Beschreibung</th>
                  <th>Menge</th>
                  <th>Einheit</th>
                  <th>Einzelpreis (EUR)</th>
                  <th>Gesamt (EUR)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.nr}</td>
                    <td>{row.bezeichnung}</td>
                    <td>{row.menge}</td>
                    <td>{row.einheit}</td>
                    <td className="right">{row.einzelpreis.toFixed(2)}</td>
                    <td className="right">{lineTotal(row).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="document-totals">
              <p><span>Zwischensumme:</span><strong>{fmtEur(summe)}</strong></p>
              <p><span>Umsatzsteuer (0,00 EUR gemäß § 19 UStG):</span><strong>{fmtEur(0)}</strong></p>
              <p className="document-total-final"><span>Gesamtbetrag:</span><strong>{fmtEur(summe)}</strong></p>
            </div>

            <p className="document-note">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>
            <p className="document-note">{data.zahlungshinweis || `Zahlbar innerhalb ${data.zahlungsziel_tage || 7} Tage ohne Abzug.`}</p>
          </section>
        ) : (
          <section className="document-section">
            <h2>Arbeitszeiten</h2>
            <table className="document-table document-times">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Beginn</th>
                  <th>Ende</th>
                  <th>Gesamtzeit (Stunden)</th>
                  <th>Notiz</th>
                </tr>
              </thead>
              <tbody>
                {computedDayEntries.length > 0 ? (
                  computedDayEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTagMonatJahr(entry.datum)}</td>
                      <td>{entry.beginn || "-"}</td>
                      <td>{entry.ende || "-"}</td>
                      <td>{Number(entry.stunden || 0).toFixed(2)}</td>
                      <td>{entry.notiz || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td>{formatDateTagMonatJahr(data.dokument_datum)}</td>
                    <td>{data.zeiten?.beginn || "-"}</td>
                    <td>{data.zeiten?.ende || "-"}</td>
                    <td>{Number(data.zeiten?.gesamtstunden || 0).toFixed(2)}</td>
                    <td>-</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="document-note">Gesamtstunden: {computedTotalHours.toFixed(2)} h</p>

            <h2>Materialliste (ohne Preise)</h2>
            {(data.materialliste || []).length ? (
              <table className="document-table">
                <thead>
                  <tr>
                    <th>Beschreibung</th>
                    <th>Menge</th>
                    <th>Einheit</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.materialliste || []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.beschreibung || "-"}</td>
                      <td>{Number(item.menge || 0).toFixed(2)}</td>
                      <td>{item.einheit || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <ul className="document-list">
                <li>Keine Materialangaben.</li>
              </ul>
            )}

            {data.hinweise ? (
              <>
                <h2>Ergebnis / Hinweise</h2>
                <p>{data.hinweise}</p>
              </>
            ) : null}

            {(data.fotodokumentation || []).length > 0 ? (
              <>
                <h2>Fotodokumentation</h2>
                <div className="document-photo-grid">
                  {(data.fotodokumentation || []).map((src, idx) => (
                    <img key={`${src.slice(0, 12)}-${idx}`} src={src} alt={`Dokumentation ${idx + 1}`} className="document-photo" />
                  ))}
                </div>
              </>
            ) : null}

            <p className="document-note">Die oben aufgeführten Arbeiten wurden ordnungsgemäß ausgeführt.</p>
          </section>
        )}

        {cfg.customerSignature ? (
          <section className="document-signatures">
            <SignatureBox label={customerSignatureLabel} image={data.signatur_kunde_image} />
            <SignatureBox label={kusiSignatureLabel} image={data.signatur_kusi_image} />
          </section>
        ) : null}

        <footer className="document-footer document-footer-sevdesk">
          <p><strong>KusiPrimeTec</strong> · Robert Kusminov · {COMPANY_PROFILE.addressStreet} · {COMPANY_PROFILE.addressZipCity}</p>
          <p>Telefon: 0177 6364393 · E-Mail: info@kusiprimetec.de · Web: www.kusiprimetec.de</p>
          <p>Technischer Immobilienservice & Projektkoordination · Rapport / Leistungsnachweis</p>
          <p>Hinweis: Dieser Rapport enthält bewusst keine Preisangaben und dient der technischen Leistungsdokumentation.</p>
        </footer>
      </section>
    </div>
  );
}

export function AdminReportDocumentPage() {
  return <AdminDocumentEditorPage />;
}



