/** Emails sent to business owners. All are no-ops when email is not configured. */
import { config } from "./config";
import { sendEmail } from "./email";
import type { Organization, Scan } from "./types";

const url = (path: string) => `${config.appUrl.replace(/\/$/, "")}${path}`;

export function sendOwnerWelcome(org: Organization) {
  return sendEmail({
    to: org.ownerEmail,
    subject: `بدأ فحص ${org.name} — مِرآة`,
    text: [
      `أهلاً،`,
      ``,
      `بدأ الزبون السري فحص ${org.name}. سيتواصل مع شركتك خلال الساعات القادمة، والنتائج تظهر في لوحتك الخاصة:`,
      url(`/app/${org.accessToken}`),
      ``,
      `هذا الرابط مفتاح لوحتك، فلا تشاركه. داخل اللوحة رابط تقرير يمكنك مشاركته.`,
      ``,
      `فريق مِرآة`,
    ].join("\n"),
  });
}

export function sendReportReady(org: Organization, scan: Scan) {
  return sendEmail({
    to: org.ownerEmail,
    subject: `تقريرك جاهز: ${scan.score ?? "—"} من 100 — مِرآة`,
    text: [
      `أهلاً،`,
      ``,
      `اكتمل فحص ${org.name}. درجة الاستجابة: ${scan.score ?? "—"} من 100.`,
      ``,
      `التقرير (يمكنك مشاركته): ${url(`/r/${scan.reportToken}`)}`,
      `لوحتك الخاصة: ${url(`/app/${org.accessToken}`)}`,
      ``,
      `فريق مِرآة`,
    ].join("\n"),
  });
}

export function sendHandoff(org: Organization, customer: string, summary: string) {
  return sendEmail({
    to: org.ownerEmail,
    subject: `زبون يحتاج متابعة من فريقك — مِرآة`,
    text: [
      `وكيل الرد حوّل محادثة تحتاج موظفاً.`,
      ``,
      `الزبون: ${customer}`,
      `الملخص: ${summary}`,
      ``,
      `المحادثات كاملة في لوحتك: ${url(`/app/${org.accessToken}`)}`,
    ].join("\n"),
  });
}
