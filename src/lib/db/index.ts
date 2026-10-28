import os from "os";
import path from "path";
import { config, dbMode } from "../config";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store";
import type { Store } from "./types";

const g = globalThis as unknown as { __mirrahStore?: Store };

/**
 * Demo data file. On serverless hosts (Vercel) only the temp directory is writable, so the demo
 * works there too, but its data is temporary and per-instance. Use Supabase for anything real.
 */
function demoFile() {
  if (process.env.VERCEL) return path.join(os.tmpdir(), "mirrah-db.json");
  return path.join(process.cwd(), ".data", "db.json");
}

export function getStore(): Store {
  if (!g.__mirrahStore) {
    g.__mirrahStore =
      dbMode() === "supabase"
        ? new SupabaseStore(config.supabaseUrl, config.supabaseServiceKey)
        : new MemoryStore(demoFile());
  }
  return g.__mirrahStore;
}

export type { Store } from "./types";
