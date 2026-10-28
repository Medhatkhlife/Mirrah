"use server";

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db";
import { addCompetitor, removeCompetitor } from "@/lib/engine/schedule";

const clean = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

/** Resolve the organization from the secret link token. Throws when the token is unknown. */
async function orgFor(token: string) {
  const org = await getStore().getOrganizationByToken(token);
  if (!org) throw new Error("رابط غير صالح.");
  return org;
}

export async function ownerAddCompetitor(token: string, form: FormData) {
  const org = await orgFor(token);
  await addCompetitor(getStore(), org.id, {
    name: String(form.get("name") ?? ""),
    website: clean(form.get("website")),
    whatsapp: clean(form.get("whatsapp")),
    email: clean(form.get("email")),
  });
  revalidatePath(`/app/${token}`);
}

export async function ownerRemoveCompetitor(token: string, form: FormData) {
  const org = await orgFor(token);
  await removeCompetitor(getStore(), org.id, String(form.get("competitorId")));
  revalidatePath(`/app/${token}`);
}
