export type Anfrageart = "direkt_einsatz" | "angebot_anfordern";
export type RequestType = "direct" | "offer";
export const TICKET_BUCKETS = ["inbox", "active", "archive"] as const;
export type TicketBucket = (typeof TICKET_BUCKETS)[number];
export type CustomerType = "privat" | "firma" | "gewerblich";

export const TICKET_STATUSES = [
  "Neu",
  "Geprueft",
  "Rueckfrage_Kunde",
  "Termin_geplant",
  "In_Arbeit",
  "Rapport_erstellt",
  "Storniert",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type Dringlichkeit = "niedrig" | "mittel" | "hoch" | "kritisch";

export interface TicketWizardPayload {
  object_id?: string;
  plz: string;
  ort: string;
  radius_km: number;
  anfrageart: Anfrageart;
  request_type: RequestType;
  subkategorie?: string;
  customer_type?: CustomerType;
  ansprechpartner?: string;
  kategorie: string;
  dringlichkeit: Dringlichkeit;
  terminwunsch: string;
  zeitfenster_von: string;
  zeitfenster_bis: string;
  kunde_name: string;
  kunde_firma: string;
  kunde_email: string;
  kunde_telefon: string;
  objekt_adresse: string;
  objekt_strasse?: string;
  objekt_plz?: string;
  objekt_ort?: string;
  access_notes?: string;
  distanz_km?: number;
  outside_service_area?: boolean;
  beschreibung: string;
  datenschutz_akzeptiert: boolean;
  agb_akzeptiert: boolean;
  haftung_koordination_akzeptiert: boolean;
  attachments: AttachmentInput[];
}

export interface AttachmentInput {
  name: string;
  type: string;
  base64: string;
  size: number;
}

export interface Ticket {
  id: string;
  object_id?: string | null;
  customer_id?: string | null;
  ticket_nummer: string;
  status: TicketStatus;
  bucket?: TicketBucket;
  kategorie: string;
  subkategorie?: string | null;
  dringlichkeit: Dringlichkeit;
  titel: string;
  beschreibung: string;
  anfrageart?: Anfrageart;
  request_type?: RequestType;
  internal_note?: string | null;
  customer_type?: CustomerType | null;
  invoice_recipient_name?: string | null;
  customer_display_name?: string | null;
  ansprechpartner?: string | null;
  kunde_name: string;
  kunde_firma: string;
  kunde_email: string;
  kunde_telefon: string;
  objekt_adresse: string;
  objekt_strasse?: string | null;
  objekt_plz?: string | null;
  objekt_ort?: string | null;
  access_notes?: string | null;
  distanz_km?: number | null;
  outside_service_area?: boolean | null;
  radius_km?: number | null;
  datenschutz_akzeptiert?: boolean | null;
  agb_akzeptiert?: boolean | null;
  haftung_koordination_akzeptiert?: boolean | null;
  ort: string;
  plz: string;
  terminwunsch: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  rejected_reason?: string | null;
  zeitfenster_von: string | null;
  zeitfenster_bis: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardKpis {
  neue_tickets: number;
  offene_tickets: number;
  termine_7_tage: number;
  avg_bestaetigung_stunden: number;
  avg_termin_stunden: number;
  inbox_neu: number;
  hoch_notfall: number;
  ohne_termin: number;
  heute_faellig: number;
  objektbetreuung_anfragen: number;
}

export interface KpiTrend {
  delta_percent: number;
  compare_value: number;
}

export interface DashboardTrends {
  neue_tickets: KpiTrend;
  offene_tickets: KpiTrend;
  termine_7_tage: KpiTrend;
}

export interface DashboardActivity {
  id: string;
  type: string;
  message: string;
  created_at: string;
  actor: string;
}

export interface DashboardAgentMessage {
  id: string;
  ticket_id: string | null;
  message: string;
  created_at: string;
  intent: string;
  risk_level: "low" | "medium" | "high";
  requires_approval: boolean;
}

export interface DashboardResponse {
  kpis: DashboardKpis;
  trends: DashboardTrends;
  tickets: Ticket[];
  activities: DashboardActivity[];
  agent_messages: DashboardAgentMessage[];
  tickets_pro_tag_30: AnalyticsSeries[];
  funnel_preview: AnalyticsSeries[];
  inquiry_summary: DashboardInquirySummary;
}

export interface DashboardInquirySummary {
  total_open: number;
  follow_up_due: number;
  latest_requested_at: string | null;
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  page_count: number;
}

export interface AuditEvent {
  id: string;
  ticket_id: string;
  event: string;
  detail: string;
  actor: string;
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  file_name: string;
  storage_url: string | null;
  mime_type: string | null;
  created_at: string | null;
}

export type DocumentType = "rapport";
export type DocumentRouteType = "report";
export type DocumentStatus = "entwurf" | "gesendet" | "akzeptiert" | "abgelehnt";

export interface DocumentPosition {
  id: string;
  nr: number;
  bezeichnung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
}

export interface DocumentMaterialPosition {
  id: string;
  beschreibung: string;
  menge: number;
  einheit: string;
}

export interface DocumentArbeitstag {
  id: string;
  datum: string;
  beginn: string;
  ende: string;
  stunden?: number | null;
  notiz?: string;
}

export interface DocumentData {
  ticket_nummer: string;
  dokument_datum?: string;
  referenz?: string;
  kunde: string;
  kunde_name?: string;
  ansprechpartner?: string;
  betreut_durch?: string;
  kunde_firma?: string;
  kunde_email: string;
  kunde_telefon: string;
  objekt_adresse: string;
  objekt_strasse?: string;
  objekt_plz?: string;
  objekt_ort?: string;
  leistungsbeschreibung: string;
  gueltig_bis?: string | null;
  zahlungsziel_tage?: number | null;
  zahlungshinweis?: string | null;
  zeiten?: {
    ankunft?: string | null;
    beginn?: string | null;
    ende?: string | null;
    gesamtstunden?: number | null;
  };
  arbeitstage?: DocumentArbeitstag[];
  materialliste?: DocumentMaterialPosition[];
  fotodokumentation?: string[];
  hinweise?: string;
  leistungszeitraum?: string | null;
  bankverbindung?: string | null;
  positionen?: DocumentPosition[];
  signatur_kunde_label?: string;
  signatur_kusi_label?: string;
  signatur_kunde_image?: string | null;
  signatur_kusi_image?: string | null;
  ergebnis?: string | null;
  offene_punkte?: string | null;
  empfehlungen?: string | null;
  naechste_schritte?: string | null;
  rapport_art?: string | null;
  stundenkonto_verwendet?: number | null;
  stundenkonto_verbleibend?: number | null;
  zusatzstunden?: number | null;
  signatur_kunde_name?: string | null;
  signatur_kunde_funktion?: string | null;
  signatur_kunde_bestaetigt_at?: string | null;
  signatur_kunde_status?: string | null;
  signatur_kunde_ersetzt_am?: string | null;
  signatur_kunde_ersetzt_grund?: string | null;
  rechtlicher_hinweis?: string | null;
}

export interface TicketDocument {
  id: string;
  ticket_id: string;
  dokument_typ: DocumentType;
  dokument_nummer: string;
  status: DocumentStatus;
  data: DocumentData;
  created_at: string;
  updated_at: string;
}

export interface CustomerReportPhoto {
  src: string;
  caption?: string;
  area?: string;
  beforeAfter?: string;
}

export interface CustomerReportData {
  ticket_nummer: string;
  dokument_datum: string | null;
  referenz: string | null;
  kunde: string;
  kunde_name: string;
  ansprechpartner: string;
  betreut_durch: string;
  kunde_firma: string;
  kunde_email: string;
  kunde_telefon: string;
  objekt_name: string;
  objekt_adresse: string;
  objekt_strasse: string;
  objekt_plz: string;
  objekt_ort: string;
  leistungsbeschreibung: string;
  ergebnis: string | number | null;
  hinweise: string;
  offene_punkte: string | number | null;
  empfehlungen: string | number | null;
  naechste_schritte: string | number | null;
  rapport_art: string | number | null;
  leistungszeitraum: string | number | null;
  zeiten: {
    ankunft: string | null;
    beginn: string | null;
    ende: string | null;
    gesamtstunden: number | null;
  };
  arbeitstage: Array<{
    id: string;
    datum: string;
    beginn: string;
    ende: string;
    stunden: number | null;
    notiz?: string;
  }>;
  materialliste: Array<{
    id: string;
    beschreibung: string;
    menge: number | null;
    einheit: string;
    bemerkung?: string;
  }>;
  fotodokumentation_kunden: CustomerReportPhoto[];
  stundenkonto_verwendet: string | number | null;
  stundenkonto_verbleibend: string | number | null;
  zusatzstunden: string | number | null;
  signatur_kunde_label: string;
  signatur_kunde_image: string | null;
  signatur_kunde_name: string | null;
  signatur_kunde_funktion: string | null;
  signatur_kunde_bestaetigt_at: string | null;
  signatur_kunde_status: string | null;
  signatur_kusi_label: string | null;
  signatur_kusi_image: string | null;
  rechtlicher_hinweis: string | number | null;
}

export interface CustomerReportSummary {
  id: string;
  ticket_id: string;
  ticket_nummer: string;
  dokument_nummer: string;
  dokument_status: string;
  created_at: string;
  updated_at: string;
  released: boolean;
  signable: boolean;
  has_signature: boolean;
  signature_status: string;
  kunde: string;
  objekt: string;
  objekt_adresse: string;
  rapport_art: string | null;
  einsatzdatum: string | null;
  kategorie: string;
  ticket_status: string;
}

export interface CustomerReportDetailResponse {
  id: string;
  ticket_id: string;
  dokument_nummer: string;
  dokument_status: string;
  created_at: string;
  updated_at: string;
  released: boolean;
  signable: boolean;
  replaceable: boolean;
  ticket: {
    id: string;
    ticket_nummer: string;
    status: string;
    kategorie: string;
    dringlichkeit: string;
    created_at: string;
    terminwunsch: string | null;
    zeitfenster_von: string | null;
    zeitfenster_bis: string | null;
  };
  object: {
    id: string | null;
    name: string;
    street: string;
    zip: string;
    city: string;
    address: string;
  };
  customer: {
    display_name: string;
    company: string;
    contact_person: string;
    email: string;
    phone: string;
  };
  report: CustomerReportData;
}

export interface CustomerReportSignaturePayload {
  id: string;
  signer_name: string;
  signer_role?: string | null;
  signature_data_url: string;
  replace_confirmed?: boolean;
  replace_reason?: string | null;
}

export interface TicketDetailResponse {
  ticket: Ticket;
  audit: AuditEvent[];
  attachments: TicketAttachment[];
  documents: TicketDocument[];
}

export interface AnalyticsSeries {
  label: string;
  value: number;
}

export const OBJEKTBETREUUNG_INQUIRY_STATUSES = [
  "neue ObjektBetreuungs-Anfrage",
  "Rückruf erforderlich",
  "Beratungsgespräch geplant",
  "ObjektCheck vorgeschlagen",
  "ObjektCheck geplant",
  "Angebot in Vorbereitung",
  "Angebot versendet",
  "gewonnen",
  "abgelehnt / nicht passend",
  "später erneut kontaktieren",
] as const;

export type ObjektbetreuungInquiryStatus = (typeof OBJEKTBETREUUNG_INQUIRY_STATUSES)[number];

export interface ObjektbetreuungInquiry {
  id: string;
  inquiry_number: string;
  company_name: string;
  contact_name: string;
  phone: string | null;
  email: string;
  address_line: string | null;
  industry: string | null;
  property_type: string | null;
  property_size: string | null;
  desired_support: string | null;
  message: string;
  source: string;
  status: ObjektbetreuungInquiryStatus;
  follow_up_at: string | null;
  notes: string | null;
  assigned_to: string | null;
  requested_at: string;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsPayload {
  besucher_pro_tag: AnalyticsSeries[];
  funnel: AnalyticsSeries[];
  kategorien: AnalyticsSeries[];
  plz: AnalyticsSeries[];
}


