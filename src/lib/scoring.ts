import type { CriterionKey, CriterionScore } from "./types";

/** Single source of truth for the evaluation rubric. Weights sum to 100. */
export const CRITERIA: { key: CriterionKey; label: string; weight: number }[] = [
  { key: "speed", label: "سرعة أول رد", weight: 30 },
  { key: "answered_question", label: "إجابة السؤال الفعلي", weight: 25 },
  { key: "closing_attempt", label: "محاولة إتمام البيع", weight: 20 },
  { key: "follow_up", label: "المتابعة بعد الصمت", weight: 15 },
  { key: "courtesy", label: "اللباقة والوضوح", weight: 10 },
];

export const criterionLabel = (k: CriterionKey) =>
  CRITERIA.find((c) => c.key === k)?.label ?? k;

/** Speed is measured, never judged by the model. null = no reply at all. */
export function speedScore(firstResponseMinutes: number | null): number {
  if (firstResponseMinutes === null) return 0;
  if (firstResponseMinutes <= 5) return 5;
  if (firstResponseMinutes <= 30) return 4;
  if (firstResponseMinutes <= 120) return 3;
  if (firstResponseMinutes <= 480) return 2;
  if (firstResponseMinutes <= 1440) return 1;
  return 0;
}

/** Weighted 0..100 score from 0..5 criterion scores. Missing criteria count as 0. */
export function weightedScore(criteria: CriterionScore[]): number {
  let total = 0;
  for (const c of CRITERIA) {
    const s = criteria.find((x) => x.key === c.key)?.score ?? 0;
    total += (c.weight * Math.max(0, Math.min(5, s))) / 5;
  }
  return Math.round(total);
}

/** Scan score = mean of probe scores, rounded. */
export function scanScore(probeScores: number[]): number | null {
  if (probeScores.length === 0) return null;
  return Math.round(probeScores.reduce((a, b) => a + b, 0) / probeScores.length);
}

export function formatMinutes(min: number | null): string {
  if (min === null) return "لم يُرد";
  if (min < 1) return "أقل من دقيقة";
  if (min < 60) return `${Math.round(min)} دقيقة`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} س ${m} د` : `${h} ساعة`;
}
