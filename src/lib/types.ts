export type Channel = "whatsapp" | "web_form" | "email";
export type Sector =
  | "real_estate"
  | "restaurants"
  | "clinics"
  | "ecommerce"
  | "education"
  | "other";

export const SECTOR_LABELS: Record<Sector, string> = {
  real_estate: "عقارات",
  restaurants: "مطاعم ومقاهي",
  clinics: "عيادات",
  ecommerce: "متاجر إلكترونية",
  education: "تعليم وتدريب",
  other: "قطاع آخر",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "واتساب",
  web_form: "نموذج الموقع",
  email: "البريد الإلكتروني",
};

export interface Organization {
  id: string;
  name: string;
  sector: Sector;
  city: string;
  website: string | null;
  whatsapp: string | null;
  email: string | null;
  ownerEmail: string;
  plan: "free" | "pulse" | "pulse_coach" | "full";
  createdAt: string;
}

export interface Competitor {
  id: string;
  organizationId: string;
  name: string;
  website: string | null;
  whatsapp: string | null;
  email: string | null;
}

export interface Scenario {
  id: string;
  sector: Sector;
  dialect: string;
  persona: string;
  goal: string;
  questions: string[];
  objections: string[];
  budget: string;
  openingMessage: string;
  createdAt: string;
}

export type ScanKind = "free" | "weekly" | "competitor";
export type ScanStatus = "running" | "completed";

export interface Scan {
  id: string;
  organizationId: string;
  competitorId: string | null;
  kind: ScanKind;
  status: ScanStatus;
  scenarioId: string;
  reportToken: string;
  score: number | null;
  createdAt: string;
  completedAt: string | null;
}

export type ProbeStatus =
  | "scheduled"
  | "awaiting_send" // operator must send the drafted customer message (WhatsApp)
  | "awaiting_reply"
  | "finished";

export interface Probe {
  id: string;
  scanId: string;
  channel: Channel;
  scheduledAt: string;
  status: ProbeStatus;
  round: number; // customer turns sent so far
  firstResponseMinutes: number | null; // null = never replied
  noReply: boolean;
  createdAt: string;
  finishedAt: string | null;
}

export interface Message {
  id: string;
  probeId: string;
  sender: "customer" | "business";
  body: string;
  sentAt: string;
  status: "draft" | "sent";
}

export interface CriterionScore {
  key: CriterionKey;
  score: number; // 0..5
  evidence: string;
}

export type CriterionKey =
  | "speed"
  | "answered_question"
  | "closing_attempt"
  | "follow_up"
  | "courtesy";

export interface Evaluation {
  id: string;
  probeId: string;
  criteria: CriterionScore[];
  suggestion: string;
  score: number; // 0..100 weighted
  model: string;
  createdAt: string;
}
