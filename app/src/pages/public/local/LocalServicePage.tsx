import { NavLink } from "react-router-dom";
import { COMPANY_PROFILE } from "@/config/businessRules";
import { PUBLIC_SCOPE_NOTICE } from "@/config/publicServices";
import { useSeo } from "@/hooks/useSeo";

export interface LocalServiceContent {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  audience: string[];
  cases: Array<{ title: string; text: string }>;
  regionText: string;
  boundaryText: string;
}

export function LocalServicePage({ content }: { content: LocalServiceContent }) {
  useSeo({ title: content.title, description: content.description, canonicalPath: content.path });

  return (
    <div className="local-service-page page-enter page-stack-large">
      <nav className="local-breadcrumbs" aria-label="Brotkrümelnavigation">
        <NavLink to="/">Startseite</NavLink><span aria-hidden="true">/</span><span aria-current="page">{content.eyebrow}</span>
      </nav>

      <header className="premium-card premium-card-strong page-card-hero">
        <p className="local-service-eyebrow">{content.eyebrow}</p>
        <h1 className="public-page-title mt-2 text-white">{content.h1}</h1>
        <p className="public-page-lead mt-3 max-w-4xl">{content.lead}</p>
        <div className="local-service-hero-actions">
          <NavLink to="/objektcheck" className="btn-primary-premium">Kostenlosen ObjektCheck starten</NavLink>
          <NavLink to="/objektbetreuung-anfrage" className="btn-secondary-premium">Objektbetreuung unverbindlich anfragen</NavLink>
        </div>
      </header>

      <section className="premium-card page-card">
        <p className="local-service-eyebrow">Passende Zielgruppen</p>
        <h2>Unterstützung für Bestandsobjekte im laufenden Betrieb</h2>
        <div className="local-audience-grid">
          {content.audience.map((item) => <div key={item}>{item}</div>)}
        </div>
      </section>

      <section>
        <div className="local-section-heading">
          <p className="local-service-eyebrow">Typische Einsatzfälle</p>
          <h2>Was KusiPrimeTec organisatorisch und praktisch unterstützt</h2>
        </div>
        <div className="local-case-grid">
          {content.cases.map((item) => (
            <article key={item.title} className="premium-card page-card">
              <h3>{item.title}</h3><p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="premium-card page-card">
          <p className="local-service-eyebrow">Einsatzgebiet</p>
          <h2>Regional und direkt erreichbar</h2>
          <p>{content.regionText}</p>
          <p className="local-contact-line">{COMPANY_PROFILE.addressLine} · Telefon 0177 6364393 · info@kusiprimetec.de</p>
        </article>
        <article className="premium-card page-card">
          <p className="local-service-eyebrow">Leistungsgrenzen</p>
          <h2>Klare Abgrenzung zu Facharbeiten</h2>
          <p>{content.boundaryText}</p>
          <p>{PUBLIC_SCOPE_NOTICE}</p>
        </article>
      </section>

      <section className="premium-card page-card local-links-panel">
        <h2>Weitere Informationen und nächster Schritt</h2>
        <div>
          <NavLink to="/leistungen">Leistungen im Überblick</NavLink>
          <NavLink to="/preise">Preise für den Objektservice ansehen</NavLink>
          <NavLink to="/objektcheck">Kostenlosen ObjektCheck starten</NavLink>
          <NavLink to="/objektbetreuung-anfrage">Monatliche Objektbetreuung anfragen</NavLink>
        </div>
      </section>
    </div>
  );
}
