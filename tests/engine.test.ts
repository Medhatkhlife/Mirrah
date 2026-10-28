import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/lib/db/memory-store";
import {
  closeWithoutReply,
  launchProbe,
  markDraftSent,
  recordBusinessReply,
  startFreeScan,
  validateScanRequest,
  type ScanRequest,
} from "../src/lib/engine/scan";
import { isSafePublicUrl } from "../src/lib/engine/site";
import { scanScore, speedScore, weightedScore } from "../src/lib/scoring";

const req: ScanRequest = {
  name: "مكتب تجريبي",
  sector: "real_estate",
  city: "رام الله",
  website: null,
  whatsapp: "+970590000000",
  email: "info@example.com",
  ownerEmail: "owner@example.com",
  consent: true,
};

const at = (iso: string) => () => new Date(iso);

describe("scoring", () => {
  it("maps response time to speed score", () => {
    expect(speedScore(null)).toBe(0);
    expect(speedScore(3)).toBe(5);
    expect(speedScore(25)).toBe(4);
    expect(speedScore(100)).toBe(3);
    expect(speedScore(300)).toBe(2);
    expect(speedScore(1000)).toBe(1);
    expect(speedScore(2000)).toBe(0);
  });

  it("weights criteria to 0..100", () => {
    const full = ["speed", "answered_question", "closing_attempt", "follow_up", "courtesy"].map(
      (key) => ({ key: key as never, score: 5, evidence: "" }),
    );
    expect(weightedScore(full)).toBe(100);
    expect(weightedScore([])).toBe(0);
    expect(weightedScore([{ key: "speed", score: 5, evidence: "" }])).toBe(30);
    expect(scanScore([80, 60])).toBe(70);
    expect(scanScore([])).toBeNull();
  });
});

describe("validation and safety", () => {
  it("requires consent and a reachable channel", () => {
    expect(validateScanRequest({ ...req, consent: false })).toMatch(/الموافقة/);
    expect(validateScanRequest({ ...req, whatsapp: null, email: null })).toMatch(/واتساب/);
    expect(validateScanRequest(req)).toBeNull();
  });

  it("blocks internal URLs", () => {
    expect(isSafePublicUrl("http://localhost:3000")).toBe(false);
    expect(isSafePublicUrl("http://169.254.169.254/latest")).toBe(false);
    expect(isSafePublicUrl("ftp://example.com")).toBe(false);
    expect(isSafePublicUrl("example.com")).toBe(true);
  });
});

describe("scan engine (mock AI)", () => {
  it("runs a full scan from request to completed report", async () => {
    const store = new MemoryStore();
    const { scan, probes } = await startFreeScan(store, req, {
      clock: at("2026-10-28T18:00:00Z"),
      siteText: "",
    });
    expect(probes.map((p) => p.channel)).toEqual(["whatsapp", "email"]);

    // Probe 1: WhatsApp. Business replies after 13 hours without price, then with price + visit.
    const wa = probes[0].id;
    await launchProbe(store, wa, at("2026-10-28T19:00:00Z"));
    await markDraftSent(store, wa, at("2026-10-28T19:02:00Z"));
    let p = await recordBusinessReply(store, wa, "أهلاً، الأسعار تختلف حسب الطابق", new Date("2026-10-29T08:02:00Z"));
    expect(p.status).toBe("awaiting_send");
    expect(p.firstResponseMinutes).toBe(780);
    await markDraftSent(store, wa, at("2026-10-29T08:10:00Z"));
    p = await recordBusinessReply(
      store,
      wa,
      "الدفعة الأولى 20 ألف والقسط 600 دولار، بتحب نحجزلك موعد زيارة؟",
      new Date("2026-10-29T08:30:00Z"),
    );
    expect(p.status).toBe("finished");

    // Probe 2: email, never answered.
    const em = probes[1].id;
    await launchProbe(store, em);
    await markDraftSent(store, em);
    await closeWithoutReply(store, em, at("2026-10-31T00:00:00Z"));

    const done = await store.getScan(scan.id);
    expect(done?.status).toBe("completed");
    const e1 = await store.getEvaluation(wa);
    const e2 = await store.getEvaluation(em);
    expect(e2?.score).toBe(0);
    expect(e1!.score).toBeGreaterThan(0);
    expect(done?.score).toBe(Math.round((e1!.score + e2!.score) / 2));
    // Unsent drafts never reach the evaluation.
    const msgs = await store.listMessages(wa);
    expect(msgs.filter((m) => m.status === "sent").length).toBe(4);
  });

  it("rejects replies for probes that are not waiting", async () => {
    const store = new MemoryStore();
    const { probes } = await startFreeScan(store, req, { siteText: "" });
    await expect(recordBusinessReply(store, probes[0].id, "مرحبا", new Date())).rejects.toThrow();
  });
});
