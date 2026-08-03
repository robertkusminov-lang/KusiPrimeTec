import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  INQUIRY_SELECTION_LABELS,
  INQUIRY_SELECTIONS,
  isInquirySelection,
  type InquirySelection,
} from "@/config/publicServices";
import { useSeo } from "@/hooks/useSeo";
import { apiPost } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { trackGoogleEvent } from "@/lib/googleTag";

type InquiryState = {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  address_line: string;
  industry: string;
  property_type: string;
  property_size: string;
  desired_support: string;
  message: string;
};

const SELECTION_STORAGE_KEY = "kpt-public-inquiry-selection";

const INITIAL_STATE: InquiryState = {
  company_name: "",
  contact_name: "",
  phone: "",
  email: "",
  address_line: "",
  industry: "",
  property_type: "",
  property_size: "",
  desired_support: "",
  message: "",
};

function readStoredSelection(): InquirySelection | "" {
  try {
    const value = window.localStorage.getItem(SELECTION_STORAGE_KEY);
    return isInquirySelection(value) ? value : "";
  } catch {
    return "";
  }
}

export default function ObjektbetreuungAnfragePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const querySelection = searchParams.get("auswahl");
  const [selection, setSelection] = useState<InquirySelection | "">(() =>
    isInquirySelection(querySelection) ? querySelection : readStoredSelection(),
  );
  const [form, setForm] = useState<InquiryState>(() => ({
    ...INITIAL_STATE,
    desired_support: isInquirySelection(querySelection)
      ? INQUIRY_SELECTION_LABELS[querySelection]
      : INQUIRY_SELECTION_LABELS[readStoredSelection() as InquirySelection] || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ inquiry_number: string } | null>(null);

  useSeo({
    title: "Objektbetreuung & Service anfragen | KusiPrimeTec",
    description:
      "Unverbindliche Anfrage für Objekt- und Hausmeisterservice, technischen Störungsservice oder monatliche Objektbetreuung im Raum Schorndorf.",
    canonicalPath: "/objektbetreuung-anfrage",
  });

  useEffect(() => {
    if (!isInquirySelection(querySelection)) return;
    setSelection(querySelection);
    setForm((previous) => ({
      ...previous,
      desired_support: INQUIRY_SELECTION_LABELS[querySelection],
    }));
    try {
      window.localStorage.setItem(SELECTION_STORAGE_KEY, querySelection);
    } catch {
      // Die URL-Auswahl bleibt auch ohne verfügbaren Browser-Speicher erhalten.
    }
  }, [querySelection]);

  function patch<K extends keyof InquiryState>(key: K, value: InquiryState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError("");
  }

  function updateSelection(value: string) {
    const nextSelection = isInquirySelection(value) ? value : "";
    setSelection(nextSelection);
    patch("desired_support", nextSelection ? INQUIRY_SELECTION_LABELS[nextSelection] : "");

    const nextParams = new URLSearchParams(searchParams);
    if (nextSelection) {
      nextParams.set("auswahl", nextSelection);
      try {
        window.localStorage.setItem(SELECTION_STORAGE_KEY, nextSelection);
      } catch {
        // Die Formularauswahl funktioniert weiterhin über den URL-Parameter.
      }
    } else {
      nextParams.delete("auswahl");
      try {
        window.localStorage.removeItem(SELECTION_STORAGE_KEY);
      } catch {
        // Kein weiterer Schritt erforderlich.
      }
    }
    setSearchParams(nextParams, { replace: true });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await apiPost<InquiryState & { source: string }, { inquiry_number: string }>(
        "create-objectbetreuung-inquiry",
        {
          ...form,
          source: "Website",
        },
      );
      setSuccess({ inquiry_number: String(result.inquiry_number || "") });
      trackGoogleEvent("lead_form_submit", {
        form_type: "object_care_inquiry",
        selection_id: selection || "not_selected",
      });
      setForm({
        ...INITIAL_STATE,
        desired_support: selection ? INQUIRY_SELECTION_LABELS[selection] : "",
      });
    } catch (err) {
      setError(toUserMessage(err, "Anfrage konnte nicht gesendet werden."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-enter page-stack">
      <header className="premium-card premium-card-strong page-card-lg">
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Unverbindliche Anfrage</p>
        <h1 className="public-page-title mt-2 text-white">Service oder Objektbetreuung anfragen</h1>
        <p className="public-page-lead mt-3 max-w-3xl">
          Die ausgewählte Leistung wird automatisch übernommen. Ergänzen Sie die Eckdaten zu Objekt, Standort und
          gewünschtem Umfang; wir melden uns mit einer klaren Ersteinschätzung.
        </p>
      </header>

      <section className="premium-card page-card">
        <h2 className="text-lg font-semibold text-white">Eckdaten für die Ersteinschätzung</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Die Anfrage ist unverbindlich und wird als Interessenten- und Beratungsprozess erfasst.
        </p>

        <form onSubmit={onSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm md:col-span-2">
            <span>Ausgewählte Leistung oder Paket</span>
            <select
              className="premium-input min-h-12 rounded-xl px-3 py-2"
              value={selection}
              onChange={(event) => updateSelection(event.target.value)}
            >
              <option value="">Bitte auswählen</option>
              {INQUIRY_SELECTIONS.map((value) => (
                <option key={value} value={value}>{INQUIRY_SELECTION_LABELS[value]}</option>
              ))}
            </select>
            {selection ? (
              <span className="rounded-xl border border-electric-300/30 bg-electric-400/10 px-3 py-2 text-sm text-electric-100">
                Übernommen: {INQUIRY_SELECTION_LABELS[selection]}
              </span>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm">
            <span>Unternehmen *</span>
            <input required className="premium-input min-h-12 rounded-xl px-3 py-2" value={form.company_name} onChange={(event) => patch("company_name", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Ansprechpartner *</span>
            <input required className="premium-input min-h-12 rounded-xl px-3 py-2" value={form.contact_name} onChange={(event) => patch("contact_name", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Telefon</span>
            <input type="tel" className="premium-input min-h-12 rounded-xl px-3 py-2" value={form.phone} onChange={(event) => patch("phone", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            <span>E-Mail *</span>
            <input required type="email" className="premium-input min-h-12 rounded-xl px-3 py-2" value={form.email} onChange={(event) => patch("email", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            <span>Adresse / Standort</span>
            <input className="premium-input min-h-12 rounded-xl px-3 py-2" value={form.address_line} onChange={(event) => patch("address_line", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Branche</span>
            <input className="premium-input min-h-12 rounded-xl px-3 py-2" value={form.industry} onChange={(event) => patch("industry", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Objektart</span>
            <input className="premium-input min-h-12 rounded-xl px-3 py-2" value={form.property_type} onChange={(event) => patch("property_type", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Objektgröße</span>
            <input className="premium-input min-h-12 rounded-xl px-3 py-2" value={form.property_size} onChange={(event) => patch("property_size", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Gewünschte Betreuung</span>
            <input
              className="premium-input min-h-12 rounded-xl px-3 py-2"
              placeholder="Gewünschter Umfang oder besondere Anforderungen"
              value={form.desired_support}
              onChange={(event) => patch("desired_support", event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            <span>Nachricht *</span>
            <textarea
              required
              className="premium-input min-h-36 rounded-xl px-3 py-3"
              value={form.message}
              onChange={(event) => patch("message", event.target.value)}
            />
          </label>

          {error ? <p role="alert" className="text-sm text-rose-300 md:col-span-2">{error}</p> : null}
          {success ? (
            <p role="status" className="text-sm text-emerald-300 md:col-span-2">
              Anfrage gespeichert. Referenz: {success.inquiry_number}
            </p>
          ) : null}

          <div className="md:col-span-2">
            <button disabled={saving} className="btn-primary-premium min-h-12 w-full rounded-full px-5 py-3 text-sm font-semibold sm:w-auto">
              {saving ? "Wird gesendet..." : "Unverbindliche Anfrage senden"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
