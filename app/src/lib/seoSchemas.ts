import { PRICING_FAQ } from "@/config/publicServices";
import { SITE, absoluteSiteUrl } from "@/config/site";

const BREADCRUMB_LABELS: Record<string, string> = {
  "/leistungen": "Leistungen",
  "/hausmeisterservice": "Hausmeisterservice",
  "/objektbetreuung": "Objektbetreuung",
  "/objektcheck": "ObjektCheck",
  "/hausmeisterservice-schorndorf": "Hausmeisterservice Schorndorf",
  "/objektbetreuung-remstal": "Objektbetreuung Remstal",
  "/technischer-stoerungsservice-schorndorf": "Technischer Störungsservice Schorndorf",
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
  "/hausmeisterservice-schorndorf": {
    name: "Objekt- und Hausmeisterservice in Schorndorf",
    description: "Objektkontrollen, Mängeldokumentation, zulässige Kleinreparaturen und organisatorische Unterstützung für Bestandsobjekte.",
  },
  "/objektbetreuung-remstal": {
    name: "Technische Objektbetreuung im Remstal",
    description: "Planbare Objektkontrollen, Mängelnachverfolgung, Vertretungsunterstützung und organisatorische Fachfirmenkoordination.",
  },
  "/technischer-stoerungsservice-schorndorf": {
    name: "Technischer Störungsservice in Schorndorf",
    description: "Strukturierte Störungsaufnahme, Dokumentation, zulässige Kleinmaßnahmen und Koordination erforderlicher Fachunternehmen.",
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

  if (path === "/objektcheck") {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        ["Ist das Ergebnis eine technische PrÃ¼fung?", "Nein. Es ist ausschlieÃŸlich eine organisatorische ErsteinschÃ¤tzung anhand Ihrer Angaben."],
        ["Muss ich Kontaktdaten angeben?", "Nein. Der vollstÃ¤ndige Check und das Ergebnis funktionieren ohne Anmeldung und ohne Kontaktdaten."],
        ["Werden meine Antworten gespeichert?", "Nein. Die Antworten werden nur fÃ¼r den aktuellen Durchlauf im Arbeitsspeicher des Browsers gehalten."],
        ["Kann ich das Ergebnis aufbewahren?", "Ja. Nutzen Sie nach dem Check die Druckfunktion Ihres Browsers und wÃ¤hlen Sie dort bei Bedarf Als PDF speichern."],
      ].map(([name, text]) => ({
        "@type": "Question",
        name,
        acceptedAnswer: { "@type": "Answer", text },
      })),
    });
  }

  return schemas;
}
