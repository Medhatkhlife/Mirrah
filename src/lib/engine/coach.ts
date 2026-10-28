import * as ai from "../ai";
import type { CoachOut } from "../ai/schemas";
import type { Store } from "../db/types";
import type { Organization } from "../types";

export const coachAllowed = (org: Organization) => org.plan === "pulse_coach" || org.plan === "full";

/** Build coaching from the organization's most recent evaluated conversations (own scans only). */
export async function coachOrganization(store: Store, org: Organization, limit = 6): Promise<CoachOut | null> {
  const scans = (await store.listScans(org.id)).filter((s) => s.kind !== "competitor");
  const items: { suggestion: string; transcript: string }[] = [];
  for (const scan of scans) {
    for (const probe of await store.listProbes(scan.id)) {
      const e = await store.getEvaluation(probe.id);
      if (!e) continue;
      const msgs = (await store.listMessages(probe.id)).filter((m) => m.status === "sent");
      if (!msgs.some((m) => m.sender === "business")) continue; // nothing to coach on a non-reply
      items.push({
        suggestion: e.suggestion,
        transcript: msgs.map((m) => `${m.sender === "customer" ? "الزبون" : "الشركة"}: ${m.body}`).join("\n"),
      });
      if (items.length >= limit) break;
    }
    if (items.length >= limit) break;
  }
  if (items.length === 0) return null;
  return ai.coachTeam({ evaluations: items });
}
