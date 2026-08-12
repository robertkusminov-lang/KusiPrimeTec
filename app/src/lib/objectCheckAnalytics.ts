import { getAnalyticsConsent } from "@/lib/consent";
import { trackGoogleEvent } from "@/lib/googleTag";

export type ObjectCheckEventName =
  | "object_check_view"
  | "object_check_start"
  | "object_check_step"
  | "object_check_complete"
  | "object_check_result_category"
  | "object_check_cta_click"
  | "object_check_lead_handoff";

type ObjectCheckEventPayload = {
  step_number?: number;
  question_count?: number;
  result_category?: string;
  cta_type?: "print" | "object_care" | "no_contact";
};

export function trackObjectCheckEvent(name: ObjectCheckEventName, payload: ObjectCheckEventPayload = {}): void {
  if (getAnalyticsConsent() !== "granted") return;
  trackGoogleEvent(name, payload);
}
