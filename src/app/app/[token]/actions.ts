"use server";

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db";
import {
  doAddCompetitor,
  doCoach,
  doRemoveCompetitor,
  doSaveAgent,
  doTryAgent,
  type CoachState,
  type PlaygroundState,
} from "@/lib/dashboard-actions";

/** Resolve the organization from the secret link token. Throws when the token is unknown. */
async function orgFor(token: string) {
  const org = await getStore().getOrganizationByToken(token);
  if (!org) throw new Error("رابط غير صالح.");
  return org;
}

export async function ownerAddCompetitor(token: string, form: FormData) {
  await doAddCompetitor(await orgFor(token), form);
  revalidatePath(`/app/${token}`);
}

export async function ownerRemoveCompetitor(token: string, form: FormData) {
  await doRemoveCompetitor(await orgFor(token), form);
  revalidatePath(`/app/${token}`);
}

export async function ownerSaveAgent(token: string, form: FormData) {
  await doSaveAgent(await orgFor(token), form);
  revalidatePath(`/app/${token}`);
}

export async function ownerTryAgent(token: string, _: PlaygroundState, form: FormData): Promise<PlaygroundState> {
  return doTryAgent(await orgFor(token), form);
}

export async function ownerCoach(token: string, _: CoachState): Promise<CoachState> {
  return doCoach(await orgFor(token));
}
