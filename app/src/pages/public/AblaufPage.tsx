import { LazySection } from "@/components/ui/LazySection";
import { ABLAUF } from "@/data/content";
import { useSeo } from "@/hooks/useSeo";
import { ORGANIZATION_SCHEMA } from "@/lib/seoData";

export default function AblaufPage() {
  useSeo({
    title: "Ablauf für ObjektBetreuung, ObjektCheck und Einzelaufträge | KusiPrimeTec",
    description:
      "So arbeitet KusiPrimeTec im Bestand: Anliegen aufnehmen, Situation prüfen, Maßnahmen priorisieren, bearbeiten oder koordinieren, dokumentieren und offene Punkte nachverfolgen.",
    canonicalPath: "/ablauf",
    structuredData: [ORGANIZATION_SCHEMA],
  });

  return (
    <div className="page-enter page-stack-large">
      <section className="premium-card premium-card-strong page-card-hero">
        <div className="max-w-4xl space-y-5">
          <p className="inline-flex rounded-full border border-electric-300/40 bg-slate-900/60 px-3 py-1 text-xs uppercase tracking-[0.14em] text-electric-300">
            Strukturierter Ablauf
          </p>
          <h1 className="hero-display text-white">Klare Schritte schaffen Ruhe im laufenden Betrieb.</h1>
          <p className="hero-support text-electric-100">
            KusiPrimeTec bündelt technische Themen nicht nur praktisch, sondern auch organisatorisch – vom ersten Hinweis bis zum dokumentierten Ergebnis.
          </p>
        </div>
      </section>

      <LazySection className="grid gap-3" minHeight={320} delayMs={35}>
        {ABLAUF.map((item, idx) => (
          <article key={item} className="premium-card flex items-start gap-4 p-5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-electric-300/60 bg-electric-400/10 text-sm font-semibold text-electric-300">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">{item}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">
                {idx === 0 && "Objekt, Ansprechpartner und technisches Anliegen werden sauber erfasst, damit die Bearbeitung direkt strukturiert startet."}
                {idx === 1 && "Sichtbare Auffälligkeiten, Dringlichkeit und Rahmenbedingungen werden eingeordnet, bevor Maßnahmen ausgelöst werden."}
                {idx === 2 && "Offene Punkte werden nach Dringlichkeit, Nutzen und notwendiger Fachbeteiligung geordnet."}
                {idx === 3 && "Soweit möglich übernimmt KusiPrimeTec direkt. Wenn Facharbeiten nötig sind, wird die nächste Abstimmung vorbereitet oder koordiniert."}
                {idx === 4 && "Arbeitszeit, Material, Fotos und Ergebnis werden nachvollziehbar festgehalten."}
                {idx === 5 && "Übrig gebliebene Punkte bleiben sichtbar und können in Betreuung, Folgetermin oder Fachfirmenprozess übernommen werden."}
              </p>
            </div>
          </article>
        ))}
      </LazySection>
    </div>
  );
}
