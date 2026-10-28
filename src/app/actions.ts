"use server";

import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import { EVENTS, emit, inngestEnabled } from "@/lib/engine/inngest";
import { launchProbe, startFreeScan, validateScanRequest, type ScanRequest } from "@/lib/engine/scan";
import type { Sector } from "@/lib/types";
import { SECTOR_LABELS } from "@/lib/types";

export interface ScanFormState {
  error: string | null;
}

const clean = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

export async function requestFreeScan(_: ScanFormState, form: FormData): Promise<ScanFormState> {
  const sector = String(form.get("sector") ?? "other");
  const req: ScanRequest = {
    name: String(form.get("name") ?? ""),
    sector: (sector in SECTOR_LABELS ? sector : "other") as Sector,
    city: String(form.get("city") ?? ""),
    website: clean(form.get("website")),
    whatsapp: clean(form.get("whatsapp")),
    email: clean(form.get("email")),
    ownerEmail: String(form.get("ownerEmail") ?? ""),
    consent: form.get("consent") === "on",
  };
  const err = validateScanRequest(req);
  if (err) return { error: err };

  const store = getStore();
  let token: string;
  try {
    const { scan, probes } = await startFreeScan(store, req);
    token = scan.reportToken;
    if (inngestEnabled()) {
      await emit(EVENTS.scanStarted, { scanId: scan.id });
    } else {
      // Demo mode: no scheduler, so draft every opening message right away for the operator.
      for (const p of probes) await launchProbe(store, p.id);
    }
  } catch (e) {
    console.error(e);
    return { error: "حدث خطأ أثناء بدء الفحص. حاول مرة أخرى." };
  }
  redirect(`/r/${token}?new=1`);
}
