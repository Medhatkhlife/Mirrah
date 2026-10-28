import { afterEach, describe, expect, it, vi } from "vitest";

const ENV = {
  POSTMARK_SERVER_TOKEN: "test-token",
  MAIL_FROM: "Mirrah <reports@example.com>",
  MAIL_PROBE_FROM: "Ahmad <ahmad@example.net>",
  POSTMARK_INBOUND_ADDRESS: "hash@inbound.postmarkapp.com",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load() {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.resetModules();
  const sent: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return new Response("{}", { status: 200 });
    }),
  );
  const { MemoryStore } = await import("../src/lib/db/memory-store");
  const scan = await import("../src/lib/engine/scan");
  const dispatch = await import("../src/lib/engine/dispatch");
  const email = await import("../src/lib/email");
  return { MemoryStore, scan, dispatch, email, sent };
}

describe("email channel", () => {
  it("builds plus addresses for reply routing", async () => {
    const { email } = await load();
    expect(email.plusAddress("abc@inbound.postmarkapp.com", "p1")).toBe("abc+p1@inbound.postmarkapp.com");
  });

  it("auto-sends email probes with the probe id in Reply-To, and emails the owner when done", async () => {
    const { MemoryStore, scan, dispatch, sent } = await load();
    const store = new MemoryStore();
    const { probes } = await scan.startFreeScan(
      store,
      {
        name: "شركة",
        sector: "clinics",
        city: "",
        website: null,
        whatsapp: null,
        email: "front@clinic.example",
        ownerEmail: "owner@clinic.example",
        consent: true,
      },
      { siteText: "" },
    );
    const probe = probes[0];
    expect(probe.channel).toBe("email");

    await dispatch.launchAndDispatch(store, probe.id);
    const after = await store.getProbe(probe.id);
    expect(after?.status).toBe("awaiting_reply");
    expect(sent[0]).toMatchObject({
      From: ENV.MAIL_PROBE_FROM,
      To: "front@clinic.example",
      ReplyTo: `hash+${probe.id}@inbound.postmarkapp.com`,
    });

    // No reply: the probe closes, the scan completes, and the owner gets the report email.
    await scan.closeWithoutReply(store, probe.id);
    const ownerMail = sent.find((m) => m.To === "owner@clinic.example");
    expect(ownerMail?.Subject).toMatch(/تقريرك جاهز/);
  });

  it("leaves WhatsApp probes for the operator", async () => {
    const { MemoryStore, scan, dispatch, sent } = await load();
    const store = new MemoryStore();
    const { probes } = await scan.startFreeScan(
      store,
      { name: "ش", sector: "other", city: "", website: null, whatsapp: "+970590000000", email: null, ownerEmail: "o@x.example", consent: true },
      { siteText: "" },
    );
    await dispatch.launchAndDispatch(store, probes[0].id);
    expect((await store.getProbe(probes[0].id))?.status).toBe("awaiting_send");
    expect(sent).toHaveLength(0);
  });
});
