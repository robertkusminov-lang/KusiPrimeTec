import { LazySection } from "@/components/ui/LazySection";
import { ABLAUF } from "@/data/content";
import { useSeo } from "@/hooks/useSeo";

export default function AblaufPage() {
  useSeo({
    title: "Ablauf - Objektprozesse für FM-nahe Betreuung | KusiPrimeTec",
    description:
      "Standardisierter Objektablauf für Unternehmen: Ticket, Priorisierung, Einsatzplanung, Durchführung und Nachweis.",
  });

  return (
    <div className="page-enter page-stack">
      <header className="premium-card page-card-lg">
        <p className="text-xs uppercase tracking-[0.12em] text-electric-300">Ablauf</p>
        <h1 className="public-page-title mt-2 text-white">Strukturierte Objektprozesse in klaren Schritten</h1>
        <p className="public-page-lead mt-3 max-w-3xl">
          FM-orientierte Abläufe für schnellere Entscheidungen, saubere Koordination und belastbare Leistungsnachweise.
        </p>
      </header>

      <LazySection className="grid gap-3" minHeight={300} delayMs={50}>
        {ABLAUF.map((item, idx) => (
          <article key={item} className="premium-card flex items-start gap-4 p-4">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-electric-300/60 bg-electric-400/10 text-sm font-semibold text-electric-300">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <p className="pt-1 text-sm text-[var(--text-main)]">{item}</p>
          </article>
        ))}
      </LazySection>
    </div>
  );
}

