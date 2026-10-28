/**
 * Deterministic stand-ins used when ANTHROPIC_API_KEY is not set, so the whole flow can be
 * exercised offline. They are intentionally simple heuristics, not a model.
 */
import type {
  CoachOut,
  CustomerTurnOut,
  EvaluationOut,
  ReplyAgentOut,
  ScenarioOut,
} from "./schemas";
import type { Sector } from "../types";

const SECTOR_SCENARIOS: Record<Sector, Omit<ScenarioOut, "dialect">> = {
  real_estate: {
    persona: "موظف متزوج يبحث عن أول شقة لعائلته",
    goal: "معرفة أسعار شقق 3 غرف ونظام التقسيط",
    questions: ["عندكم شقق 3 غرف متاحة؟", "كم الدفعة الأولى والقسط الشهري؟", "متى أقدر أشوف الشقة؟"],
    objections: ["السعر أعلى من ميزانيتي شوي", "بدي أقارن مع مشاريع ثانية"],
    budget: "حتى 120 ألف دولار بالتقسيط",
    openingMessage: "مرحبا، عندكم شقق 3 غرف بالتقسيط؟ وكم الدفعة الأولى تقريباً؟",
  },
  restaurants: {
    persona: "شخص ينظم عشاء عائلي لعشرة أشخاص",
    goal: "حجز طاولة ومعرفة الأسعار",
    questions: ["عندكم مكان لعشرة أشخاص يوم الجمعة؟", "كم سعر الشخص تقريباً؟", "في قائمة للأطفال؟"],
    objections: ["المكان بعيد علينا شوي", "بدنا شي أرخص"],
    budget: "حوالي 15 دولار للشخص",
    openingMessage: "مرحبا، بدي أحجز لعشرة أشخاص يوم الجمعة مساءً، في مكان؟",
  },
  clinics: {
    persona: "أم تبحث عن موعد لابنها",
    goal: "معرفة أقرب موعد والتكلفة",
    questions: ["متى أقرب موعد متاح؟", "كم سعر الكشفية؟", "بتقبلوا تأمين؟"],
    objections: ["الموعد متأخر علينا", "السعر عالي"],
    budget: "حسب التأمين",
    openingMessage: "مرحبا، بدي موعد بأقرب وقت، كم سعر الكشفية؟",
  },
  ecommerce: {
    persona: "مشترٍ يريد التأكد قبل الطلب",
    goal: "معرفة التوصيل والإرجاع",
    questions: ["بتوصلوا لنابلس؟ وقديش التوصيل؟", "في إمكانية إرجاع؟", "المنتج متوفر بلون ثاني؟"],
    objections: ["التوصيل غالي", "شفته أرخص بمكان ثاني"],
    budget: "متوسطة",
    openingMessage: "مرحبا، بتوصلوا لنابلس؟ وكم يوم بياخد التوصيل؟",
  },
  education: {
    persona: "طالب جامعي يبحث عن دورة",
    goal: "معرفة مواعيد الدورة وسعرها",
    questions: ["متى بتبلش الدورة الجاية؟", "كم السعر؟ وفي تقسيط؟", "في شهادة بالآخر؟"],
    objections: ["المواعيد بتتعارض مع الجامعة", "السعر عالي على طالب"],
    budget: "محدودة",
    openingMessage: "مرحبا، متى بتبلش الدورة الجاية وكم سعرها؟",
  },
  other: {
    persona: "زبون مهتم بخدمات الشركة",
    goal: "معرفة السعر والخطوة التالية",
    questions: ["شو الخدمات اللي بتقدموها؟", "كم الأسعار تقريباً؟", "كيف بنبلش؟"],
    objections: ["السعر أعلى من المتوقع", "بدي أفكر"],
    budget: "متوسطة",
    openingMessage: "مرحبا، بدي أعرف أسعار خدماتكم وكيف بنبلش؟",
  },
};

export function mockScenario(sector: Sector, dialect: string): ScenarioOut {
  return { dialect, ...SECTOR_SCENARIOS[sector] };
}

export function mockCustomerTurn(
  scenario: ScenarioOut,
  businessReplies: string[],
  round: number,
  maxRounds: number,
): CustomerTurnOut {
  if (round >= maxRounds)
    return { done: true, reason: "انتهت الجولات المسموحة", message: "" };
  const last = businessReplies.at(-1) ?? "";
  const gavePrice = /\d/.test(last);
  const proposedStep = /(موعد|زيارة|نحجز|تتفضل|اتصال|نتصل)/.test(last);
  if (gavePrice && proposedStep)
    return { done: true, reason: "أجابت الشركة واقترحت خطوة تالية", message: "" };
  const next = gavePrice ? scenario.questions[2] : scenario.questions[1];
  return { done: false, reason: "", message: next ?? "طيب، شكراً، بفكر وبرجعلكم" };
}

export function mockEvaluation(businessReplies: string[]): EvaluationOut {
  const all = businessReplies.join("\n");
  if (!all.trim()) {
    const none = { score: 0, evidence: "لا يوجد دليل" };
    return {
      answered_question: none,
      closing_attempt: none,
      follow_up: none,
      courtesy: none,
      suggestion: "الرد على استفسارات الزبائن أولاً؛ هذه المحاولة لم تحصل على أي رد.",
    };
  }
  const find = (re: RegExp) => businessReplies.find((r) => re.test(r));
  const price = find(/\d/);
  const step = find(/(موعد|زيارة|نحجز|تتفضل|اتصال|نتصل)/);
  const polite = find(/(أهلا|أهلاً|مرحبا|شكرا|شكراً|تكرم|يسعدنا)/);
  return {
    answered_question: price ? { score: 4, evidence: price } : { score: 1, evidence: businessReplies[0] },
    closing_attempt: step ? { score: 4, evidence: step } : { score: 0, evidence: "لا يوجد دليل" },
    follow_up: step ? { score: 3, evidence: step } : { score: 0, evidence: "لا يوجد دليل" },
    courtesy: polite ? { score: 4, evidence: polite } : { score: 2, evidence: businessReplies[0] },
    suggestion: !price
      ? "أعطِ الزبون السعر أو نطاقه في أول رد، فهو يقارن بين أكثر من جهة."
      : !step
        ? "اقترح خطوة تالية واضحة مثل موعد زيارة أو اتصال."
        : "حافظ على هذا المستوى وحاول تقليل زمن أول رد.",
  };
}

export function mockCoach(suggestions: string[]): CoachOut {
  return {
    recurringMistakes: [...new Set(suggestions)].slice(0, 3),
    drill: "زبون يقول: \"شفت نفس الشي أرخص عند غيركم\". الرد القوي: يعترف بالمقارنة، يوضح الفرق بالقيمة، ويقترح موعداً محدداً.",
  };
}

export function mockReplyAgent(customerMessage: string): ReplyAgentOut {
  if (/(موظف|إنسان|بدي أحجز|بدي أشتري|شكوى)/.test(customerMessage))
    return {
      action: "handoff",
      message: "أكيد، رح يتواصل معك أحد زملائنا أول ما يبدأ الدوام.",
      handoffSummary: `الزبون كتب: "${customerMessage}" ويحتاج متابعة من موظف.`,
    };
  return {
    action: "reply",
    message: "أهلاً وسهلاً! يسعدنا نساعدك. ممكن تحكيلي أكثر شو اللي بتدور عليه، ونرتبلك موعد يناسبك؟",
    handoffSummary: "",
  };
}
