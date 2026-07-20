import { FormEvent, useState } from "react";
import { useSeo } from "@/hooks/useSeo";
import { apiPost } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";

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

export default function ObjektbetreuungAnfragePage() {
  const [form, setForm] = useState<InquiryState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ inquiry_number: string } | null>(null);

  useSeo({
    title: "ObjektBetreuung anfragen | KusiPrimeTec",
    description:
      "Anfrage für technische ObjektBetreuung, ObjektCheck und strukturierte Bestandsbetreuung für Gewerbeobjekte und Bestandsimmobilien.",
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
        }
      );
      setSuccess({ inquiry_number: String(result.inquiry_number || "") });
      setForm(INITIAL_STATE);
    } catch (err) {
      setError(toUserMessage(err, "Anfrage konnte nicht gesendet werden."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-enter page-stack">
      <header className="premium-card premium-card-strong page-card-lg">
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">ObjektBetreuung</p>
        <h1 className="public-page-title mt-2 text-white">ObjektBetreuung anfragen</h1>
        <p className="public-page-lead mt-3 max-w-3xl">
          Für laufende technische Betreuung, ObjektCheck, Maßnahmenlisten und strukturierte Betreuungspakete im Bestand.
          Diese Anfrage läuft separat als Interessenten- und Beratungsprozess und nicht als normales Einsatz-Ticket.
        </p>
      </header>

      <section className="premium-card page-card">
        <h2 className="text-lg font-semibold text-white">Was wir für den Einstieg brauchen</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Ein paar Eckdaten zum Objekt, zum gewünschten Betreuungsumfang und zu Ihrer Ansprechperson.
        </p>

        <form onSubmit={onSubmit} className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Unternehmen *</span>
            <input className="premium-input rounded-xl px-3 py-2" value={form.company_name} onChange={(e) => patch("company_name", e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Ansprechpartner *</span>
            <input className="premium-input rounded-xl px-3 py-2" value={form.contact_name} onChange={(e) => patch("contact_name", e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Telefon</span>
            <input className="premium-input rounded-xl px-3 py-2" value={form.phone} onChange={(e) => patch("phone", e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>E-Mail *</span>
            <input type="email" className="premium-input rounded-xl px-3 py-2" value={form.email} onChange={(e) => patch("email", e.target.value)} />
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
            <span>Gewünschte Betreuung</span>
            <input
              className="premium-input rounded-xl px-3 py-2"
              placeholder="z. B. ObjektCheck, Pilotphase, laufende Betreuung oder individuelles Konzept"
              value={form.desired_support}
              onChange={(e) => patch("desired_support", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            <span>Nachricht *</span>
            <textarea
              className="premium-input min-h-32 rounded-xl px-3 py-2"
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
            <button disabled={saving} className="btn-primary-premium rounded-full px-5 py-3 text-sm font-semibold">
              {saving ? "Wird gesendet..." : "ObjektBetreuung anfragen"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
