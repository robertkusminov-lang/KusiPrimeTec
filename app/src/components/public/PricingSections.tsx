import { NavLink } from "react-router-dom";
import {
  CARE_PACKAGES,
  PRICING_FAQ,
  PUBLIC_PRICING,
  PUBLIC_SERVICES,
  type CarePackage,
} from "@/config/publicServices";
import { eur } from "@/lib/format";
import { trackGoogleEvent } from "@/lib/googleTag";

const comparisonRows: Array<{
  label: string;
  value: (pkg: CarePackage) => string;
}> = [
  { label: "Monatspreis", value: (pkg) => `${eur(pkg.priceEur)} / Monat` },
  { label: "Stundenkontingent", value: (pkg) => `${pkg.hours} Stunden / Monat` },
  { label: "Betreute Objekte", value: (pkg) => pkg.objects },
  { label: "Planmäßige Termine", value: (pkg) => pkg.visits },
  { label: "Reaktionsreserve", value: (pkg) => pkg.reactionReserve },
  { label: "Priorisierter Kurzfristtermin", value: (pkg) => pkg.shortNoticeVisit },
  { label: "Digitale Rapporte", value: (pkg) => pkg.reports },
  { label: "Monatsübersicht", value: (pkg) => pkg.monthlyOverview },
  { label: "Standort- und Leistungskonto", value: (pkg) => pkg.account },
  { label: "Offene Punkte", value: (pkg) => pkg.followUp },
  { label: "Stundenübertragung", value: (pkg) => pkg.transfer },
  { label: "Fachfirmenkoordination", value: (pkg) => pkg.coordination },
  { label: "Enthaltene Anfahrten", value: (pkg) => pkg.travel },
];

function inquiryHref(id: CarePackage["id"] | (typeof PUBLIC_SERVICES)[number]["id"]) {
  return `/objektbetreuung-anfrage?auswahl=${id}`;
}

export function ServicePricingCards({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {PUBLIC_SERVICES.map((service) => (
        <article key={service.id} className="premium-card flex h-full min-w-0 flex-col p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-electric-300">Einzelleistung</p>
          <h3 className="mt-2 text-xl font-bold text-white md:text-2xl">{service.name}</h3>
          <p className="mt-3 text-3xl font-extrabold text-white">
            {eur(service.priceEur)}
            <span className="ml-1 text-base font-semibold text-electric-100">/ Arbeitsstunde</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-soft)]">{service.description}</p>
          {!compact ? (
            <ul className="mt-4 grid gap-2 text-sm text-[var(--text-main)]">
              {service.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span aria-hidden="true" className="text-electric-300">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <NavLink
            to={inquiryHref(service.id)}
            onClick={() => trackGoogleEvent("service_inquiry_click", { service_id: service.id })}
            className="btn-primary-premium mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 py-3 text-center text-sm font-semibold sm:w-fit"
          >
            {service.cta}
          </NavLink>
        </article>
      ))}
    </div>
  );
}

function PackageCard({ pkg, compact }: { pkg: CarePackage; compact: boolean }) {
  const highlighted = pkg.id === "pro";
  return (
    <article
      className={`public-package-card public-package-${pkg.id} premium-card relative flex h-full min-w-0 flex-col p-5 ${
        highlighted
          ? "border-electric-300/70 bg-electric-400/10 shadow-[0_24px_64px_rgba(56,189,248,0.16)] lg:-translate-y-2"
          : "border-[var(--line)]"
      }`}
    >
      {pkg.badge ? (
        <span className={`mb-3 inline-flex min-h-7 w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
          highlighted
            ? "border-electric-200/50 bg-electric-400/15 text-electric-100"
            : "border-amber-200/35 bg-amber-400/10 text-amber-100"
        }`}>
          {pkg.badge}
        </span>
      ) : (
        <span className="mb-3 min-h-7" aria-hidden="true" />
      )}
      <h3 className="text-xl font-bold text-white">{pkg.name}</h3>
      <p className="mt-3 break-words text-3xl font-extrabold text-white">
        {eur(pkg.priceEur)}
        <span className="ml-1 text-sm font-semibold text-electric-100">/ Monat</span>
      </p>
      <p className="mt-1 text-sm font-semibold text-electric-100">{pkg.hours} Stunden Betreuungskontingent</p>
      <p className="mt-4 text-sm leading-relaxed text-[var(--text-soft)]">{pkg.audience}</p>
      <ul className="mt-4 grid flex-1 gap-2 text-sm text-[var(--text-main)]">
        {(compact ? pkg.features.slice(0, 6) : pkg.features).map((feature) => (
          <li key={feature} className="flex gap-2">
            <span aria-hidden="true" className="text-electric-300">✓</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{feature}</span>
          </li>
        ))}
      </ul>
      <NavLink
        to={inquiryHref(pkg.id)}
        onClick={() => trackGoogleEvent("care_package_click", { package_id: pkg.id })}
        className={`${highlighted ? "btn-primary-premium" : "btn-secondary-premium"} mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full px-4 py-3 text-center text-sm font-semibold`}
      >
        {pkg.cta}
      </NavLink>
    </article>
  );
}

export function PackageGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div className="public-package-grid grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
      {CARE_PACKAGES.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} compact={compact} />)}
    </div>
  );
}

export function PackageComparison() {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-[var(--line)] xl:block">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead className="bg-slate-950/65">
            <tr>
              <th className="p-4 text-electric-200">Vergleich</th>
              {CARE_PACKAGES.map((pkg) => <th key={pkg.id} className="p-4 text-white">{pkg.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row) => (
              <tr key={row.label} className="border-t border-[var(--line)] align-top">
                <th className="p-4 font-semibold text-[var(--text-main)]">{row.label}</th>
                {CARE_PACKAGES.map((pkg) => (
                  <td key={pkg.id} className={`p-4 text-[var(--text-soft)] ${pkg.id === "pro" ? "bg-electric-400/5" : ""}`}>
                    {row.value(pkg)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 xl:hidden">
        {CARE_PACKAGES.map((pkg) => (
          <details key={pkg.id} className={`pricing-details rounded-2xl border bg-slate-950/40 ${pkg.id === "pro" ? "border-electric-300/55" : "border-[var(--line)]"}`}>
            <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-3 font-semibold text-white">
              <span>{pkg.name}</span>
              <span className="text-electric-200">{eur(pkg.priceEur)} / Monat</span>
            </summary>
            <dl className="grid gap-0 border-t border-[var(--line)] px-4 py-2 text-sm">
              {comparisonRows.slice(1).map((row) => (
                <div key={row.label} className="grid gap-1 border-b border-[var(--line-soft)] py-3 last:border-0 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  <dt className="font-semibold text-[var(--text-main)]">{row.label}</dt>
                  <dd className="min-w-0 text-[var(--text-soft)]">{row.value(pkg)}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
    </>
  );
}

export function PricingFaq() {
  return (
    <div className="grid gap-3">
      {PRICING_FAQ.map((item) => (
        <details key={item.question} className="pricing-details rounded-2xl border border-[var(--line)] bg-slate-950/35">
          <summary className="flex min-h-14 cursor-pointer items-center px-4 py-3 font-semibold text-white">
            {item.question}
          </summary>
          <p className="border-t border-[var(--line)] px-4 py-4 text-sm leading-relaxed text-[var(--text-soft)] md:text-base">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}

export function PublicPriceNotes() {
  return (
    <div className="grid gap-2 text-sm leading-relaxed text-[var(--text-soft)]">
      <p>{PUBLIC_PRICING.taxNotice}</p>
      <p>{PUBLIC_PRICING.excludedCosts}</p>
      <p>{PUBLIC_PRICING.travelNotice}</p>
    </div>
  );
}
