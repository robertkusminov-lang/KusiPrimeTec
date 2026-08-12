import { COMPANY_PROFILE } from "@/config/businessRules";

export const SITE = {
  name: "KusiPrimeTec",
  legalName: "KusiPrimeTec",
  url: "https://kusiprimetec.de",
  locale: "de_DE",
  language: "de-DE",
  email: "info@kusiprimetec.de",
  phoneDisplay: "0177 6364393",
  phoneInternational: "+491776364393",
  logoPath: "/kpt-logo.png",
  socialImagePath: "/kpt-logo.png",
  ownerName: "Robert Kusminov",
  address: {
    street: COMPANY_PROFILE.addressStreet,
    postalCode: "73614",
    locality: "Schorndorf",
    country: "DE",
  },
  serviceArea: "Schorndorf und 30 km Umgebung",
  openingHours: {
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "17:00",
  },
} as const;

export type RouteSeo = {
  title: string;
  description: string;
  canonicalPath: string;
  index: boolean;
  follow?: boolean;
};

export const INDEXABLE_PUBLIC_PATHS = [
  "/",
  "/leistungen",
  "/hausmeisterservice",
  "/objektbetreuung",
  "/objektcheck",
  "/hausmeisterservice-schorndorf",
  "/objektbetreuung-remstal",
  "/technischer-stoerungsservice-schorndorf",
  "/preise",
  "/ablauf",
  "/buchen",
  "/einzelauftrag",
  "/objektbetreuung-anfrage",
] as const;

const ROUTE_SEO: Record<string, RouteSeo> = {
  "/": {
    title: "Technischer Immobilienservice & Objektbetreuung in Schorndorf | KusiPrimeTec",
    description:
      "Technischer Immobilienservice und planbare Objektbetreuung für Bestandsobjekte in Schorndorf und 30 km Umgebung. Direkt und unverbindlich anfragen.",
    canonicalPath: "/",
    index: true,
  },
  "/leistungen": {
    title: "Technische Objektbetreuung und Kleinreparaturen | KusiPrimeTec",
    description:
      "Technische Objektbetreuung, Störungsaufnahme, Sichtkontrollen, geeignete Kleinreparaturen und Fachfirmenkoordination im Raum Schorndorf.",
    canonicalPath: "/leistungen",
    index: true,
  },
  "/hausmeisterservice": {
    title: "Objekt- & Hausmeisterservice in Schorndorf | KusiPrimeTec",
    description:
      "Objektkontrollen, geeignete Kleinreparaturen und dokumentierter Hausmeisterservice für Wohn- und Gewerbeobjekte in Schorndorf und Umgebung.",
    canonicalPath: "/hausmeisterservice",
    index: true,
  },
  "/objektbetreuung": {
    title: "Objektbetreuung mit monatlichem Stundenkontingent | KusiPrimeTec",
    description:
      "Planbare technische Objektbetreuung mit monatlichem Stundenkontingent, digitalen Rapporten und klarer Leistungsabgrenzung im Raum Schorndorf.",
    canonicalPath: "/objektbetreuung",
    index: true,
  },
  "/objektcheck": {
    title: "Kostenloser ObjektCheck für Gewerbeimmobilien im Remstal | KusiPrimeTec",
    description:
      "In 2 Minuten erkennen, wie gut Kontrolle, Mängelmanagement, Vertretung und technische Objektbetreuung organisiert sind. Sofortergebnis ohne Anmeldung.",
    canonicalPath: "/objektcheck",
    index: true,
  },
  "/hausmeisterservice-schorndorf": {
    title: "Hausmeisterservice in Schorndorf für Bestandsobjekte | KusiPrimeTec",
    description:
      "Objektkontrollen, Mängeldokumentation und zulässige Kleinreparaturen für Gewerbe-, Wohn- und Mischobjekte in Schorndorf und Umgebung.",
    canonicalPath: "/hausmeisterservice-schorndorf",
    index: true,
  },
  "/objektbetreuung-remstal": {
    title: "Technische Objektbetreuung im Remstal | KusiPrimeTec",
    description:
      "Planbare Objektkontrollen, Mängelmanagement, Vertretung und Fachfirmenkoordination für Unternehmen, Verwaltungen und Eigentümer im Remstal.",
    canonicalPath: "/objektbetreuung-remstal",
    index: true,
  },
  "/technischer-stoerungsservice-schorndorf": {
    title: "Technischer Störungsservice in Schorndorf | KusiPrimeTec",
    description:
      "Strukturierte Störungsaufnahme, Dokumentation, zulässige Kleinreparaturen und Fachfirmenkoordination für Bestandsobjekte im Raum Schorndorf.",
    canonicalPath: "/technischer-stoerungsservice-schorndorf",
    index: true,
  },
  "/preise": {
    title: "Preise für Objektbetreuung & technischen Service | KusiPrimeTec",
    description:
      "Transparente Preise für technischen Immobilienservice, Objekt- und Hausmeisterservice sowie monatliche Objektbetreuung bei KusiPrimeTec.",
    canonicalPath: "/preise",
    index: true,
  },
  "/ablauf": {
    title: "Ablauf, Tickets und digitale Einsatzrapporte | KusiPrimeTec",
    description:
      "Vom Erstkontakt über Ticket und Termin bis zum digitalen Einsatzrapport: So läuft die technische Betreuung bei KusiPrimeTec nachvollziehbar ab.",
    canonicalPath: "/ablauf",
    index: true,
  },
  "/buchen": {
    title: "Technischen Immobilienservice anfragen | KusiPrimeTec",
    description:
      "Technischen Immobilienservice, Einzelauftrag oder laufende Objektbetreuung in Schorndorf unverbindlich bei KusiPrimeTec anfragen.",
    canonicalPath: "/buchen",
    index: true,
  },
  "/einzelauftrag": {
    title: "Einzelauftrag anfragen | KusiPrimeTec",
    description: "Anfrageformular für einen technischen Einzelauftrag bei KusiPrimeTec.",
    canonicalPath: "/einzelauftrag",
    index: true,
  },
  "/objektbetreuung-anfrage": {
    title: "Objektbetreuung anfragen | KusiPrimeTec",
    description: "Anfrageformular für Objektbetreuung und technischen Service bei KusiPrimeTec.",
    canonicalPath: "/objektbetreuung-anfrage",
    index: true,
  },
  "/impressum": {
    title: "Impressum | KusiPrimeTec",
    description: "Impressum und Anbieterinformationen von KusiPrimeTec.",
    canonicalPath: "/impressum",
    index: false,
  },
  "/datenschutz": {
    title: "Datenschutz | KusiPrimeTec",
    description: "Datenschutzhinweise von KusiPrimeTec.",
    canonicalPath: "/datenschutz",
    index: false,
  },
  "/agb": {
    title: "Allgemeine Geschäftsbedingungen | KusiPrimeTec",
    description: "Allgemeine Geschäftsbedingungen von KusiPrimeTec.",
    canonicalPath: "/agb",
    index: false,
  },
  "/widerruf": {
    title: "Widerruf | KusiPrimeTec",
    description: "Informationen zum Widerruf bei KusiPrimeTec.",
    canonicalPath: "/widerruf",
    index: false,
  },
  "/haftung-koordination": {
    title: "Haftung und Koordination | KusiPrimeTec",
    description: "Hinweise zu Haftung, Leistungsgrenzen und Fachfirmenkoordination bei KusiPrimeTec.",
    canonicalPath: "/haftung-koordination",
    index: false,
  },
};

function normalizePath(pathname: string): string {
  const path = `/${pathname.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "")}`;
  return path === "/" ? path : path.replace(/\/$/, "");
}

export function getRouteSeo(pathname: string, fallback?: Partial<RouteSeo>): RouteSeo {
  const path = normalizePath(pathname);
  const configured = ROUTE_SEO[path];
  if (configured) return configured;

  if (path === "/konto" || path.startsWith("/konto/")) {
    return {
      title: fallback?.title || "Kundenbereich | KusiPrimeTec",
      description: fallback?.description || "Geschützter Kundenbereich von KusiPrimeTec.",
      canonicalPath: path,
      index: false,
      follow: false,
    };
  }

  if (path === "/admin" || path.startsWith("/admin/")) {
    return {
      title: "Administration | KusiPrimeTec",
      description: "Geschützter Administrationsbereich von KusiPrimeTec.",
      canonicalPath: path,
      index: false,
      follow: false,
    };
  }

  return {
    title: fallback?.title || "Seite nicht gefunden | KusiPrimeTec",
    description: fallback?.description || "Die angeforderte Seite wurde nicht gefunden.",
    canonicalPath: path,
    index: false,
    follow: false,
  };
}

export function absoluteSiteUrl(path: string): string {
  return `${SITE.url}${path === "/" ? "/" : `/${path.replace(/^\/+|\/+$/g, "")}`}`;
}
