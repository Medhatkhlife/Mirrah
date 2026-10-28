/**
 * Seeds the local demo store (.data/db.json) with one completed scan and one in progress,
 * so the report, dashboard and operator pages have something to show.
 * Usage: npm run demo
 */
import path from "path";
import { MemoryStore } from "../src/lib/db/memory-store";
import {
  closeWithoutReply,
  launchProbe,
  markDraftSent,
  recordBusinessReply,
  startFreeScan,
} from "../src/lib/engine/scan";

const store = new MemoryStore(path.join(process.cwd(), ".data", "db.json"));
const t = (h: number) => new Date(Date.now() - h * 3600_000);

async function main() {
  const { scan, probes } = await startFreeScan(
    store,
    {
      name: "مكتب الأفق العقاري (تجريبي)",
      sector: "real_estate",
      city: "رام الله",
      website: null,
      whatsapp: "+970590000000",
      email: "info@example.com",
      ownerEmail: "owner@example.com",
      consent: true,
    },
    { siteText: "", clock: () => t(48) },
  );

  const [wa, em] = probes;
  await launchProbe(store, wa.id, () => t(47));
  await markDraftSent(store, wa.id, () => t(47));
  await recordBusinessReply(store, wa.id, "أهلاً، الأسعار تختلف حسب الطابق والمساحة", t(34));
  await markDraftSent(store, wa.id, () => t(33.9));
  await recordBusinessReply(store, wa.id, "الدفعة الأولى 20 ألف دولار والقسط 600 شهرياً، بتحب نحجزلك موعد زيارة؟", t(33.5));

  await launchProbe(store, em.id, () => t(46));
  await markDraftSent(store, em.id, () => t(46));
  await closeWithoutReply(store, em.id, () => t(1));

  // A second business with a scan still running, so /ops has work to show.
  const second = await startFreeScan(
    store,
    {
      name: "مطعم الياسمين (تجريبي)",
      sector: "restaurants",
      city: "نابلس",
      website: null,
      whatsapp: "+970599999999",
      email: null,
      ownerEmail: "owner2@example.com",
      consent: true,
    },
    { siteText: "" },
  );
  await launchProbe(store, second.probes[0].id);

  const done = await store.getScan(scan.id);
  console.log(`Demo ready. Completed scan score: ${done?.score}`);
  console.log(`Report: /r/${scan.reportToken}`);
  console.log(`Running scan report: /r/${second.scan.reportToken}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
