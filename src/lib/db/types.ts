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

export type New<T> = Omit<T, "id" | "createdAt">;

export interface Store {
  createOrganization(o: New<Organization>): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | null>;
  getOrganizationByToken(token: string): Promise<Organization | null>;
  updateOrganization(id: string, patch: Partial<Organization>): Promise<Organization>;
  listOrganizations(): Promise<Organization[]>;

  createCompetitor(c: Omit<Competitor, "id">): Promise<Competitor>;
  listCompetitors(organizationId: string): Promise<Competitor[]>;
  getCompetitor(id: string): Promise<Competitor | null>;
  deleteCompetitor(id: string): Promise<void>;

  createScenario(s: New<Scenario>): Promise<Scenario>;
  getScenario(id: string): Promise<Scenario | null>;

  createScan(s: New<Scan>): Promise<Scan>;
  getScan(id: string): Promise<Scan | null>;
  getScanByToken(token: string): Promise<Scan | null>;
  updateScan(id: string, patch: Partial<Scan>): Promise<Scan>;
  listScans(organizationId: string): Promise<Scan[]>; // newest first

  createProbe(p: New<Probe>): Promise<Probe>;
  getProbe(id: string): Promise<Probe | null>;
  updateProbe(id: string, patch: Partial<Probe>): Promise<Probe>;
  listProbes(scanId: string): Promise<Probe[]>;
  listProbesByStatus(statuses: ProbeStatus[]): Promise<Probe[]>;

  addMessage(m: Omit<Message, "id">): Promise<Message>;
  updateMessage(id: string, patch: Partial<Message>): Promise<Message>;
  listMessages(probeId: string): Promise<Message[]>; // oldest first

  saveEvaluation(e: New<Evaluation>): Promise<Evaluation>;
  getEvaluation(probeId: string): Promise<Evaluation | null>;
}
