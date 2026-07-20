import { BUSINESS_RULES, COMPANY_PROFILE } from "@/config/businessRules";

const SITE_URL = COMPANY_PROFILE.websiteUrl;
const LOGO_URL = `${SITE_URL}/kpt-logo.png`;
const SERVICE_AREA_NAME = `${BUSINESS_RULES.serviceArea.centerCity} und ${BUSINESS_RULES.serviceArea.radiusKm} km Umgebung`;
const OWNER_PERSON = {
  "@type": "Person",
  name: COMPANY_PROFILE.ownerName,
};

export const ORGANIZATION_SCHEMA = {
  "@type": "LocalBusiness",
  name: COMPANY_PROFILE.name,
  description:
    "Persönlicher technischer Immobilienservice für Gewerbeobjekte und Bestandsimmobilien mit ObjektBetreuung, ObjektCheck, Einzelaufträgen und digitaler Dokumentation.",
  telephone: COMPANY_PROFILE.phoneDisplay,
  email: COMPANY_PROFILE.email,
  url: SITE_URL,
  logo: LOGO_URL,
  image: LOGO_URL,
  priceRange: "€€-",
  founder: OWNER_PERSON,
  owner: OWNER_PERSON,
  address: {
    "@type": "PostalAddress",
    streetAddress: COMPANY_PROFILE.addressStreet,
    postalCode: BUSINESS_RULES.serviceArea.centerZip,
    addressLocality: BUSINESS_RULES.serviceArea.centerCity,
    addressCountry: "DE",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: BUSINESS_RULES.openingHours.start,
      closes: BUSINESS_RULES.openingHours.end,
    },
  ],
  areaServed: {
    "@type": "AdministrativeArea",
    name: SERVICE_AREA_NAME,
  },
};

export const PROVIDER_SCHEMA = {
  "@type": "Organization",
  name: COMPANY_PROFILE.name,
  url: SITE_URL,
  telephone: COMPANY_PROFILE.phoneDisplay,
  email: COMPANY_PROFILE.email,
  logo: LOGO_URL,
};

export function buildServiceSchema(input: {
  name: string;
  description: string;
  urlPath: string;
  offers?: Array<{
    name: string;
    description: string;
    price?: number;
    priceCurrency?: string;
  }>;
}) {
  return {
    "@type": "Service",
    name: input.name,
    serviceType: input.name,
    description: input.description,
    provider: PROVIDER_SCHEMA,
    areaServed: {
      "@type": "AdministrativeArea",
      name: SERVICE_AREA_NAME,
    },
    url: `${SITE_URL}${input.urlPath}`,
    offers: input.offers?.map((offer) => ({
      "@type": "Offer",
      name: offer.name,
      description: offer.description,
      url: `${SITE_URL}${input.urlPath}`,
      ...(offer.price
        ? {
            price: offer.price,
            priceCurrency: offer.priceCurrency || "EUR",
          }
        : {}),
    })),
  };
}
