import { getStore } from "../db";
import type { Store } from "../db/types";
import { config } from "../config";
import type { Probe, Scan } from "../types";
import { launchAndDispatch } from "./dispatch";
import { EVENTS, emit, inngest, inngestEnabled } from "./events";
import { closeWithoutReply } from "./scan";
import { runRecurringCycle } from "./schedule";

export { EVENTS, emit, inngest, inngestEnabled } from "./events";

/**
 * Hand a newly created scan to the scheduler. With Inngest, probes wake at their scheduled time;
 * in demo mode every opening message is drafted (and auto-sent where allowed) right away.
 */
export async function kickOff(store: Store, scan: Scan, probes: Probe[]) {
  if (inngestEnabled()) await emit(EVENTS.scanStarted, { scanId: scan.id });
  else for (const p of probes) await launchAndDispatch(store, p.id);
}

/** Wake each probe at its scheduled time, draft its opening message, auto-send where allowed. */
export const scheduleProbes = inngest.createFunction(
  { id: "schedule-probes", triggers: [{ event: EVENTS.scanStarted }] },
  async ({ event, step }) => {
    const scanId = String(event.data.scanId);
    const probes = await step.run("list-probes", () => getStore().listProbes(scanId));
    for (const p of probes) {
      await step.sleepUntil(`wait-${p.id}`, p.scheduledAt);
      await step.run(`launch-${p.id}`, async () => {
        await launchAndDispatch(getStore(), p.id);
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
    return step.run("run-cycle", async () => {
      const { started, failures } = await runRecurringCycle(getStore(), new Date());
      for (const s of started) await emit(EVENTS.scanStarted, { scanId: s.scan.id });
      return { started: started.length, failures };
    });
  },
);

export const functions = [scheduleProbes, watchProbe, recurringScans];
