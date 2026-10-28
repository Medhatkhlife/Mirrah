import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
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

interface Tables {
  organizations: Organization[];
  competitors: Competitor[];
  scenarios: Scenario[];
  scans: Scan[];
  probes: Probe[];
  messages: Message[];
  evaluations: Evaluation[];
}

const empty = (): Tables => ({
  organizations: [],
  competitors: [],
  scenarios: [],
  scans: [],
  probes: [],
  messages: [],
  evaluations: [],
});

/**
 * Demo store. Keeps everything in memory and, when a file path is given, persists to JSON so
 * the demo survives dev-server reloads. Not for production.
 */
export class MemoryStore implements Store {
  private data: Tables | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private file: string | null = null) {}

  private async load(): Promise<Tables> {
    if (this.data) return this.data;
    if (this.file) {
      try {
        this.data = { ...empty(), ...JSON.parse(await fs.readFile(this.file, "utf8")) };
      } catch {
        this.data = empty();
      }
    } else {
      this.data = empty();
    }
    return this.data!;
  }

  private async persist() {
    if (!this.file || !this.data) return;
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this.data, null, 1));
  }

  /** Serialize all operations so concurrent writes never interleave. */
  private run<T>(fn: (t: Tables) => T, write = false): Promise<T> {
    const next = this.queue.then(async () => {
      const t = await this.load();
      const out = fn(t);
      if (write) await this.persist();
      return structuredClone(out);
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  private insert<K extends keyof Tables>(table: K, row: Omit<Tables[K][number], "id">) {
    return this.run((t) => {
      const full = { id: randomUUID(), ...row } as Tables[K][number];
      (t[table] as Tables[K][number][]).push(full);
      return full;
    }, true);
  }

  private patch<K extends keyof Tables>(table: K, id: string, p: Partial<Tables[K][number]>) {
    return this.run((t) => {
      const rows = t[table] as Tables[K][number][];
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw new Error(`${String(table)} ${id} not found`);
      rows[i] = { ...rows[i], ...p, id };
      return rows[i];
    }, true);
  }

  private now = () => new Date().toISOString();

  createOrganization = (o: New<Organization>) =>
    this.insert("organizations", { ...o, createdAt: this.now() });
  getOrganization = (id: string) =>
    this.run((t) => t.organizations.find((r) => r.id === id) ?? null);
  listOrganizations = () => this.run((t) => [...t.organizations].reverse());

  createCompetitor = (c: Omit<Competitor, "id">) => this.insert("competitors", c);
  listCompetitors = (organizationId: string) =>
    this.run((t) => t.competitors.filter((r) => r.organizationId === organizationId));

  createScenario = (s: New<Scenario>) =>
    this.insert("scenarios", { ...s, createdAt: this.now() });
  getScenario = (id: string) => this.run((t) => t.scenarios.find((r) => r.id === id) ?? null);

  createScan = (s: New<Scan>) => this.insert("scans", { ...s, createdAt: this.now() });
  getScan = (id: string) => this.run((t) => t.scans.find((r) => r.id === id) ?? null);
  getScanByToken = (token: string) =>
    this.run((t) => t.scans.find((r) => r.reportToken === token) ?? null);
  updateScan = (id: string, p: Partial<Scan>) => this.patch("scans", id, p);
  listScans = (organizationId: string) =>
    this.run((t) =>
      t.scans
        .filter((r) => r.organizationId === organizationId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );

  createProbe = (p: New<Probe>) => this.insert("probes", { ...p, createdAt: this.now() });
  getProbe = (id: string) => this.run((t) => t.probes.find((r) => r.id === id) ?? null);
  updateProbe = (id: string, p: Partial<Probe>) => this.patch("probes", id, p);
  listProbes = (scanId: string) =>
    this.run((t) =>
      t.probes
        .filter((r) => r.scanId === scanId)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    );
  listProbesByStatus = (statuses: ProbeStatus[]) =>
    this.run((t) =>
      t.probes
        .filter((r) => statuses.includes(r.status))
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    );

  addMessage = (m: Omit<Message, "id">) => this.insert("messages", m);
  updateMessage = (id: string, p: Partial<Message>) => this.patch("messages", id, p);
  listMessages = (probeId: string) =>
    this.run((t) =>
      t.messages
        .filter((r) => r.probeId === probeId)
        .sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    );

  saveEvaluation = (e: New<Evaluation>) =>
    this.insert("evaluations", { ...e, createdAt: this.now() });
  getEvaluation = (probeId: string) =>
    this.run((t) => t.evaluations.find((r) => r.probeId === probeId) ?? null);
}
