import { BUSINESS_RULES, COMPANY_PROFILE } from "@/config/businessRules";

export const ORGANIZATION_SCHEMA = {
  "@type": "LocalBusiness",
  name: COMPANY_PROFILE.name,
  description:
    "Personlicher technischer Immobilienservice fur Gewerbeobjekte und Bestandsimmobilien mit ObjektBetreuung, ObjektCheck, Einzelauftragen und digitaler Dokumentation.",
  areaServed: `${BUSINESS_RULES.serviceArea.centerCity} und ${BUSINESS_RULES.serviceArea.radiusKm} km Umgebung`,
  telephone: COMPANY_PROFILE.phoneDisplay,
  email: COMPANY_PROFILE.email,
  url: COMPANY_PROFILE.websiteUrl,
  address: {
    "@type": "PostalAddress",
    streetAddress: COMPANY_PROFILE.addressStreet,
    postalCode: BUSINESS_RULES.serviceArea.centerZip,
    addressLocality: BUSINESS_RULES.serviceArea.centerCity,
    addressCountry: "DE",
  },
};

export const PROVIDER_SCHEMA = {
  "@type": "Organization",
  name: COMPANY_PROFILE.name,
  url: COMPANY_PROFILE.websiteUrl,
  telephone: COMPANY_PROFILE.phoneDisplay,
  email: COMPANY_PROFILE.email,
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
    description: input.description,
    provider: PROVIDER_SCHEMA,
    areaServed: `${BUSINESS_RULES.serviceArea.centerCity} und ${BUSINESS_RULES.serviceArea.radiusKm} km Umgebung`,
    url: `${COMPANY_PROFILE.websiteUrl}${input.urlPath}`,
    offers: input.offers?.map((offer) => ({
      "@type": "Offer",
      name: offer.name,
      description: offer.description,
      ...(offer.price
        ? {
            price: offer.price,
            priceCurrency: offer.priceCurrency || "EUR",
          }
        : {}),
    })),
  };
}
