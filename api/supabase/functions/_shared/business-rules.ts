const SOURCE_RULES = {
  pricing: {
    hourlyRateEur: 80,
    serviceCallFlatEur: 39,
    roundingRuleText: "Jede angefangene Stunde wird als volle Stunde abgerechnet.",
  },
  surcharges: [
    { label: "Mo-Fr nach 17:00 Uhr (Überstunden)", value: "+20 %" },
    { label: "Samstag", value: "+35 %" },
    { label: "Sonntag/Feiertag", value: "+100 %" },
  ],
  response: {
    hours: 24,
    weekdaysOnly: true,
  },
  openingHours: {
    start: "09:00",
    end: "17:00",
    slotMinutes: 30,
    weekdaysOnly: true,
  },
  serviceArea: {
    radiusKm: 30,
    centerZip: "73614",
    centerCity: "Schorndorf",
  },
  projectCoordination: {
    basePercent: 15,
    maxComplexityPercent: 20,
  },
} as const;

function parsePercent(value: string): number {
  const m = String(value || "").match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return 0;
  return Number(String(m[0]).replace(",", ".")) || 0;
}

const surchargeByLabel = {
  weekday_after_17_percent: parsePercent(
    SOURCE_RULES.surcharges.find((x) => String(x.label || "").toLowerCase().includes("mo-fr"))?.value || ""
  ),
  saturday_percent: parsePercent(
    SOURCE_RULES.surcharges.find((x) => String(x.label || "").toLowerCase().includes("samstag"))?.value || ""
  ),
  sunday_holiday_percent: parsePercent(
    SOURCE_RULES.surcharges.find((x) => String(x.label || "").toLowerCase().includes("sonntag"))?.value || ""
  ),
};

export const BUSINESS_RULES = {
  pricing: {
    hourly_rate_eur: SOURCE_RULES.pricing.hourlyRateEur,
    service_call_flat_eur: SOURCE_RULES.pricing.serviceCallFlatEur,
    rounding_rule: SOURCE_RULES.pricing.roundingRuleText,
  },
  surcharges: {
    weekday_after_17_percent: surchargeByLabel.weekday_after_17_percent,
    saturday_percent: surchargeByLabel.saturday_percent,
    sunday_holiday_percent: surchargeByLabel.sunday_holiday_percent,
  },
  response: {
    within_hours: SOURCE_RULES.response.hours,
    weekdays_only: SOURCE_RULES.response.weekdaysOnly,
    window_start: SOURCE_RULES.openingHours.start,
    window_end: SOURCE_RULES.openingHours.end,
  },
  opening_hours: {
    start: SOURCE_RULES.openingHours.start,
    end: SOURCE_RULES.openingHours.end,
    slot_minutes: SOURCE_RULES.openingHours.slotMinutes,
    weekdays_only: SOURCE_RULES.openingHours.weekdaysOnly,
  },
  service_area: {
    radius_km: SOURCE_RULES.serviceArea.radiusKm,
    center_zip: SOURCE_RULES.serviceArea.centerZip,
    center_city: SOURCE_RULES.serviceArea.centerCity,
  },
  project_coordination: {
    base_percent: SOURCE_RULES.projectCoordination.basePercent,
    high_complexity_percent: SOURCE_RULES.projectCoordination.maxComplexityPercent,
  },
} as const;

function parseHmToMinutes(value: string): number {
  const m = String(value || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return NaN;
  return hh * 60 + mm;
}

export function isWithinOpeningWindow(fromHm: string, toHm: string): boolean {
  const from = parseHmToMinutes(fromHm);
  const to = parseHmToMinutes(toHm);
  const start = parseHmToMinutes(BUSINESS_RULES.opening_hours.start);
  const end = parseHmToMinutes(BUSINESS_RULES.opening_hours.end);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (from >= to) return false;
  return from >= start && to <= end;
}
