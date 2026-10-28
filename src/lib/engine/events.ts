import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "mirrah" });

/** Inngest is used when configured; otherwise demo mode runs everything inline. */
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
