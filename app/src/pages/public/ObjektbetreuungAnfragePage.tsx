import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSeo } from "@/hooks/useSeo";
import { apiPost } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { SUPPORT_OPTIONS, resolveDesiredSupport } from "@/lib/publicInquiry";
import { ORGANIZATION_SCHEMA } from "@/lib/seoData";

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

function createInitialState(desiredSupport = ""): InquiryState {
  return {
    company_name: "",
    contact_name: "",
    phone: "",
    email: "",
    address_line: "",
    industry: "",
    property_type: "",
    property_size: "",
    desired_support: desiredSupport,
    message: "",
  };
}

export default function ObjektbetreuungAnfragePage() {
  const [searchParams] = useSearchParams();
  const presetSupport = useMemo(
    () => resolveDesiredSupport(searchParams.get("anliegen")),
    [searchParams],
  );

  const [form, setForm] = useState<InquiryState>(() => createInitialState(presetSupport));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ inquiry_number: string } | null>(null);

  useEffect(() => {
    setForm((prev) => (prev.desired_support ? prev : { ...prev, desired_support: presetSupport }));
  }, [presetSupport]);

  useSeo({
    title: "ObjektBetreuung oder ObjektCheck anfragen | KusiPrimeTec",
    description:
      "Öffentliche Anfrage für ObjektBetreuung, ObjektCheck Gewerbe, individuelle Betreuungskonzepte oder eine unverbindliche Erstabstimmung. Dieser Weg bleibt ein separater Interessentenprozess.",
    canonicalPath: "/objektbetreuung-anfrage",
    structuredData: [ORGANIZATION_SCHEMA],
  });

  function patch<K extends keyof InquiryState>(key: K, value: InquiryState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
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
      setForm(createInitialState(presetSupport));
    } catch (err) {
      setError(toUserMessage(err, "Anfrage konnte nicht gesendet werden."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            Getrennter Interessentenprozess
          </p>
          <h1 className="hero-display text-white">ObjektBetreuung, ObjektCheck oder Erstabstimmung anfragen.</h1>
          <p className="hero-support text-electric-100">
            Diese Anfrage wird weiterhin separat als Interessenten- und Beratungsprozess gespeichert und nicht als operatives Einsatz-Ticket angelegt.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="premium-card page-card">
          <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Wann dieser Weg passt</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-[var(--line)] bg-slate-950/35 px-4 py-4 text-sm text-[var(--text-main)]">
              ObjektBetreuung für laufende technische Themen mit fester Betreuung und klaren Abläufen
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-slate-950/35 px-4 py-4 text-sm text-[var(--text-main)]">
              ObjektCheck Gewerbe als kostenpflichtiger Einstieg zur strukturierten Bestandsaufnahme
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-slate-950/35 px-4 py-4 text-sm text-[var(--text-main)]">
              Individuelle Konzepte für mehrere Standorte oder erweiterten Koordinationsbedarf
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-slate-950/35 px-4 py-4 text-sm text-[var(--text-main)]">
              Unverbindliche Erstabstimmung, wenn zunächst nur das passende Vorgehen geklärt werden soll
            </div>
          </div>
        </article>

        <section className="premium-card page-card">
          <h2 className="text-xl font-semibold text-white">Was wir für den Einstieg brauchen</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">
            Ein paar Eckdaten zum Objekt, zur Ansprechperson und zum gewünschten Anliegen. Das Feld <strong className="text-white">desired_support</strong> bleibt technisch bestehen und wird nur benutzerfreundlicher geführt.
          </p>

          <form onSubmit={onSubmit} className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span>Unternehmen *</span>
              <input required className="premium-input rounded-xl px-3 py-2" value={form.company_name} onChange={(e) => patch("company_name", e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Ansprechpartner *</span>
              <input required className="premium-input rounded-xl px-3 py-2" value={form.contact_name} onChange={(e) => patch("contact_name", e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Telefon</span>
              <input className="premium-input rounded-xl px-3 py-2" value={form.phone} onChange={(e) => patch("phone", e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>E-Mail *</span>
              <input required type="email" className="premium-input rounded-xl px-3 py-2" value={form.email} onChange={(e) => patch("email", e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span>Adresse / Standort</span>
              <input className="premium-input rounded-xl px-3 py-2" value={form.address_line} onChange={(e) => patch("address_line", e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Branche</span>
              <input className="premium-input rounded-xl px-3 py-2" value={form.industry} onChange={(e) => patch("industry", e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Objektart</span>
              <input className="premium-input rounded-xl px-3 py-2" value={form.property_type} onChange={(e) => patch("property_type", e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Objektgröße</span>
              <input className="premium-input rounded-xl px-3 py-2" value={form.property_size} onChange={(e) => patch("property_size", e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Anliegen / gewünschte Betreuung</span>
              <select
                className="premium-input rounded-xl px-3 py-2"
                value={form.desired_support}
                onChange={(e) => patch("desired_support", e.target.value)}
              >
                <option value="">Bitte auswählen</option>
                {SUPPORT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span>Nachricht *</span>
              <textarea
                required
                className="premium-input min-h-36 rounded-xl px-3 py-2"
                value={form.message}
                onChange={(e) => patch("message", e.target.value)}
              />
            </label>

            {error ? <p className="text-sm text-rose-300 md:col-span-2">{error}</p> : null}
            {success ? (
              <p className="text-sm text-emerald-300 md:col-span-2">
                Anfrage gespeichert. Referenz: {success.inquiry_number}
              </p>
            ) : null}

            <div className="md:col-span-2">
              <button disabled={saving} className="btn-primary-premium inline-flex min-h-[54px] items-center justify-center rounded-full px-5 py-3 text-sm font-semibold">
                {saving ? "Wird gesendet..." : "Anfrage senden"}
              </button>
            </div>
          </form>
        </section>
      </section>
    </div>
  );
}
