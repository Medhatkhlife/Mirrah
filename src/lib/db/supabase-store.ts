import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { New, Store } from "./types";
import type {
  Competitor,
  Evaluation,
  Message,
  Organization,
  Probe,
  ProbeStatus,
  Scan,
  Scenario,
} from "../types";

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function toRow(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[snake(k)] = v;
  return out;
}

function fromRow<T>(row: Record<string, unknown> | null): T | null {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[camel(k)] = typeof v === "string" && /^\d+(\.\d+)?$/.test(v) && (k === "score" || k === "first_response_minutes") ? Number(v) : v;
  return out as T;
}

/** Server-only store backed by Supabase with the service role key. */
export class SupabaseStore implements Store {
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  private async one<T>(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
    const { data, error } = await q;
    if (error) throw new Error(JSON.stringify(error));
    return fromRow<T>(data as Record<string, unknown>)!;
  }

  private async maybe<T>(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<T | null> {
    const { data, error } = await q;
    if (error) throw new Error(JSON.stringify(error));
    return fromRow<T>(data as Record<string, unknown> | null);
  }

  private async many<T>(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
    const { data, error } = await q;
    if (error) throw new Error(JSON.stringify(error));
    return ((data as Record<string, unknown>[]) ?? []).map((r) => fromRow<T>(r)!);
  }

  private ins<T>(table: string, row: object) {
    return this.one<T>(this.db.from(table).insert(toRow(row)).select().single());
  }
  private upd<T>(table: string, id: string, patch: object) {
    return this.one<T>(this.db.from(table).update(toRow(patch)).eq("id", id).select().single());
  }
  private byId<T>(table: string, id: string) {
    return this.maybe<T>(this.db.from(table).select().eq("id", id).maybeSingle());
  }

  createOrganization = (o: New<Organization>) => this.ins<Organization>("organizations", o);
  getOrganization = (id: string) => this.byId<Organization>("organizations", id);
  getOrganizationByToken = (token: string) =>
    this.maybe<Organization>(this.db.from("organizations").select().eq("access_token", token).maybeSingle());
  updateOrganization = (id: string, p: Partial<Organization>) => this.upd<Organization>("organizations", id, p);
  listOrganizations = () =>
    this.many<Organization>(
      this.db.from("organizations").select().order("created_at", { ascending: false }),
    );

  createCompetitor = (c: Omit<Competitor, "id">) => this.ins<Competitor>("competitors", c);
  listCompetitors = (organizationId: string) =>
    this.many<Competitor>(this.db.from("competitors").select().eq("organization_id", organizationId));
  getCompetitor = (id: string) => this.byId<Competitor>("competitors", id);
  deleteCompetitor = async (id: string) => {
    const { error } = await this.db.from("competitors").delete().eq("id", id);
    if (error) throw new Error(JSON.stringify(error));
  };

  createScenario = (s: New<Scenario>) => this.ins<Scenario>("scenarios", s);
  getScenario = (id: string) => this.byId<Scenario>("scenarios", id);

  createScan = (s: New<Scan>) => this.ins<Scan>("scans", s);
  getScan = (id: string) => this.byId<Scan>("scans", id);
  getScanByToken = (token: string) =>
    this.maybe<Scan>(this.db.from("scans").select().eq("report_token", token).maybeSingle());
  updateScan = (id: string, p: Partial<Scan>) => this.upd<Scan>("scans", id, p);
  listScans = (organizationId: string) =>
    this.many<Scan>(
      this.db
        .from("scans")
        .select()
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
    );

  createProbe = (p: New<Probe>) => this.ins<Probe>("probes", p);
  getProbe = (id: string) => this.byId<Probe>("probes", id);
  updateProbe = (id: string, p: Partial<Probe>) => this.upd<Probe>("probes", id, p);
  listProbes = (scanId: string) =>
    this.many<Probe>(
      this.db.from("probes").select().eq("scan_id", scanId).order("scheduled_at"),
    );
  listProbesByStatus = (statuses: ProbeStatus[]) =>
    this.many<Probe>(this.db.from("probes").select().in("status", statuses).order("scheduled_at"));

  addMessage = (m: Omit<Message, "id">) => this.ins<Message>("messages", m);
  updateMessage = (id: string, p: Partial<Message>) => this.upd<Message>("messages", id, p);
  listMessages = (probeId: string) =>
    this.many<Message>(this.db.from("messages").select().eq("probe_id", probeId).order("sent_at"));

  saveEvaluation = (e: New<Evaluation>) => this.ins<Evaluation>("evaluations", e);
  getEvaluation = (probeId: string) =>
    this.maybe<Evaluation>(this.db.from("evaluations").select().eq("probe_id", probeId).maybeSingle());
}
