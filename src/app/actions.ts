"use server";

import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import { kickOff } from "@/lib/engine/inngest";
import { startFreeScan, validateScanRequest, type ScanRequest } from "@/lib/engine/scan";
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
    const { organization, scan, probes } = await startFreeScan(store, req);
    token = organization.accessToken;
    await kickOff(store, scan, probes);
  } catch (e) {
    console.error(e);
    return { error: "حدث خطأ أثناء بدء الفحص. حاول مرة أخرى." };
  }
  // The owner lands on their private dashboard; the report link inside it is the shareable one.
  redirect(`/app/${token}?new=1`);
}
