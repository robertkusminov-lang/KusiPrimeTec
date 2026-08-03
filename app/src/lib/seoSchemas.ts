import { PRICING_FAQ } from "@/config/publicServices";
import { SITE, absoluteSiteUrl } from "@/config/site";

const BREADCRUMB_LABELS: Record<string, string> = {
  "/leistungen": "Leistungen",
  "/hausmeisterservice": "Hausmeisterservice",
  "/objektbetreuung": "Objektbetreuung",
  "/preise": "Preise",
  "/ablauf": "Ablauf",
  "/buchen": "Anfrage",
};

const SERVICE_SCHEMAS: Record<string, { name: string; description: string }> = {
  "/leistungen": {
    name: "Technischer Immobilienservice",
    description:
      "Technische Objektbetreuung, Störungsaufnahme, Sichtkontrollen, geeignete Kleinreparaturen und Koordination externer Fachfirmen.",
  },
  "/hausmeisterservice": {
    name: "Objekt- und Hausmeisterservice",
    description:
      "Laufende Objektkontrollen, Sicht- und Funktionskontrollen, geeignete Kleinreparaturen und nachvollziehbare Dokumentation.",
  },
  "/objektbetreuung": {
    name: "Monatliche technische Objektbetreuung",
    description:
      "Planbare technische Betreuung von Bestandsobjekten mit Stundenkontingent, digitalen Einsatzrapporten und klarer Leistungsabgrenzung.",
  },
};

export function getRouteSchemas(pathname: string): Record<string, unknown>[] {
  const path = pathname === "/" ? "/" : `/${pathname.replace(/^\/+|\/+$/g, "")}`;
  const schemas: Record<string, unknown>[] = [];
  const breadcrumbLabel = BREADCRUMB_LABELS[path];

  if (breadcrumbLabel) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Startseite",
          item: absoluteSiteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: breadcrumbLabel,
          item: absoluteSiteUrl(path),
        },
      ],
    });
  }

  const service = SERVICE_SCHEMAS[path];
  if (service) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Service",
      name: service.name,
      description: service.description,
      provider: { "@id": `${SITE.url}/#business` },
      areaServed: SITE.serviceArea,
      url: absoluteSiteUrl(path),
    });
  }

  if (path === "/leistungen" || path === "/preise") {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: PRICING_FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return schemas;
}
