/**
 * Moves probes forward after a customer message is drafted. Channels we may automate (email) are
 * sent right away; WhatsApp and website forms stay with the operator in /ops.
 */
import type { Store } from "../db/types";
import { emailConfig, plusAddress, probeEmailEnabled, sendEmail } from "../email";
import type { Probe, Scan } from "../types";
import { EVENTS, emit } from "./events";
import { launchProbe, markDraftSent } from "./scan";

export const isAutomated = (channel: Probe["channel"]) => channel === "email" && probeEmailEnabled();

const SUBJECTS = ["استفسار", "سؤال بخصوص خدماتكم", "استفسار سريع"];

/** Where this probe's messages go: the organization itself or the competitor being compared. */
async function contactFor(store: Store, scan: Scan) {
  if (scan.competitorId) return store.getCompetitor(scan.competitorId);
  return store.getOrganization(scan.organizationId);
}

/**
 * If the probe has a draft on an automated channel, send it and mark it sent.
 * Returns true when something was sent.
 */
export async function autoSendDraft(store: Store, probeId: string): Promise<boolean> {
  const probe = await store.getProbe(probeId);
  if (!probe || probe.status !== "awaiting_send" || !isAutomated(probe.channel)) return false;
  const scan = await store.getScan(probe.scanId);
  if (!scan) return false;
  const contact = await contactFor(store, scan);
  const to = contact?.email;
  if (!to) return false;
  const draft = (await store.listMessages(probeId)).find((m) => m.status === "draft");
  if (!draft) return false;

  const subject = SUBJECTS[probe.id.charCodeAt(0) % SUBJECTS.length];
  const res = await sendEmail({
    from: emailConfig.probeFrom,
    to,
    subject: probe.round > 0 ? `Re: ${subject}` : subject,
    text: draft.body,
    // Replies route back to /api/inbound/email with the probe id as the mailbox hash.
    replyTo: plusAddress(emailConfig.inbound, probe.id),
  });
  if (!res.sent) return false;
  const sent = await markDraftSent(store, probeId);
  await emit(EVENTS.probeSent, { probeId, round: sent.round });
  return true;
}

/** Draft the opening message, then send it if the channel is automated. */
export async function launchAndDispatch(store: Store, probeId: string) {
  await launchProbe(store, probeId);
  await autoSendDraft(store, probeId);
}
