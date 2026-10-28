import { Inngest } from "inngest";
import { getStore } from "../db";
import { closeWithoutReply, launchProbe } from "./scan";
import { runRecurringCycle } from "./schedule";
import type { Store } from "../db/types";
import type { Probe, Scan } from "../types";
import { config } from "../config";

export const inngest = new Inngest({ id: "mirrah" });

/** Inngest is used when configured; otherwise demo mode launches probes immediately. */
export const inngestEnabled = () =>
  Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV);

export const EVENTS = {
  scanStarted: "mirrah/scan.started", // { scanId }
  probeSent: "mirrah/probe.sent", // { probeId, round }
  probeReplied: "mirrah/probe.replied", // { probeId, round }
} as const;

/** Send an event when Inngest is configured; a no-op in demo mode. */
export async function emit(name: string, data: Record<string, unknown>) {
  if (!inngestEnabled()) return;
  await inngest.send({ name, data });
}

/**
 * Hand a newly created scan to the scheduler. With Inngest, probes wake at their scheduled time;
 * in demo mode every opening message is drafted right away for the operator.
 */
export async function kickOff(store: Store, scan: Scan, probes: Probe[]) {
  if (inngestEnabled()) await emit(EVENTS.scanStarted, { scanId: scan.id });
  else for (const p of probes) await launchProbe(store, p.id);
}

/** Wake each probe at its scheduled time and draft its opening message. */
export const scheduleProbes = inngest.createFunction(
  { id: "schedule-probes", triggers: [{ event: EVENTS.scanStarted }] },
  async ({ event, step }) => {
    const scanId = String(event.data.scanId);
    const probes = await step.run("list-probes", () => getStore().listProbes(scanId));
    for (const p of probes) {
      await step.sleepUntil(`wait-${p.id}`, p.scheduledAt);
      await step.run(`launch-${p.id}`, async () => {
        await launchProbe(getStore(), p.id);
      });
    }
  },
);

/**
 * After each customer message is sent, wait for the business to reply. If nothing arrives within
 * the window, close the probe. A reply (from /ops or a channel webhook) emits probeReplied.
 */
export const watchProbe = inngest.createFunction(
  { id: "watch-probe", triggers: [{ event: EVENTS.probeSent }] },
  async ({ event, step }) => {
    const probeId = String(event.data.probeId);
    const round = Number(event.data.round);
    const reply = await step.waitForEvent("wait-for-reply", {
      event: EVENTS.probeReplied,
      timeout: `${config.replyWaitHours}h`,
      if: `async.data.probeId == "${probeId}" && async.data.round == ${round}`,
    });
    if (!reply) {
      await step.run("close-without-reply", async () => {
        const p = await getStore().getProbe(probeId);
        if (p && p.status === "awaiting_reply" && p.round === round) {
          await closeWithoutReply(getStore(), probeId);
        }
      });
    }
  },
);

/** Daily pass that starts due weekly scans and monthly competitor inquiries. */
export const recurringScans = inngest.createFunction(
  { id: "recurring-scans", triggers: [{ cron: "TZ=Asia/Hebron 0 9 * * *" }] },
  async ({ step }) => {
    const result = await step.run("run-cycle", async () => {
      const { started, failures } = await runRecurringCycle(getStore(), new Date());
      for (const s of started) await emit(EVENTS.scanStarted, { scanId: s.scan.id });
      return { started: started.length, failures };
    });
    return result;
  },
);

export const functions = [scheduleProbes, watchProbe, recurringScans];
