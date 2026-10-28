import { z } from "zod/v4";

export const ScenarioSchema = z.object({
  dialect: z.string().describe("Arabic dialect the customer writes in, e.g. Palestinian"),
  persona: z.string().describe("Who the customer is, one sentence, Arabic"),
  goal: z.string().describe("What the customer wants to achieve, Arabic"),
  questions: z.array(z.string()).describe("Exactly 3 realistic questions, Arabic"),
  objections: z.array(z.string()).describe("Exactly 2 natural objections, Arabic"),
  budget: z.string().describe("Customer budget or constraint, Arabic"),
  openingMessage: z.string().describe("First message the customer sends, Arabic, in dialect"),
});
export type ScenarioOut = z.infer<typeof ScenarioSchema>;

export const CustomerTurnSchema = z.object({
  done: z.boolean().describe("true when the conversation should end now"),
  reason: z.string().describe("Why it ends, or empty"),
  message: z.string().describe("Next customer message in dialect, empty when done"),
});
export type CustomerTurnOut = z.infer<typeof CustomerTurnSchema>;

const Judged = z.object({
  score: z.number().int().min(0).max(5),
  evidence: z.string().describe("Exact quote from the conversation, or 'لا يوجد دليل'"),
});

export const EvaluationSchema = z.object({
  answered_question: Judged,
  closing_attempt: Judged,
  follow_up: Judged,
  courtesy: Judged,
  suggestion: z.string().describe("One concrete improvement, Arabic, one or two sentences"),
});
export type EvaluationOut = z.infer<typeof EvaluationSchema>;

export const CoachSchema = z.object({
  recurringMistakes: z.array(z.string()).describe("Up to 3 recurring mistakes, Arabic"),
  drill: z.string().describe("A short role-play drill with a difficult customer, Arabic"),
});
export type CoachOut = z.infer<typeof CoachSchema>;

export const ReplyAgentSchema = z.object({
  action: z.enum(["reply", "handoff"]),
  message: z.string().describe("Reply to the customer in their dialect, Arabic"),
  handoffSummary: z.string().describe("Summary for the human employee, empty when replying"),
});
export type ReplyAgentOut = z.infer<typeof ReplyAgentSchema>;
