import path from "path";
import { config, dbMode } from "../config";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store";
import type { Store } from "./types";

const g = globalThis as unknown as { __mirrahStore?: Store };

export function getStore(): Store {
  if (!g.__mirrahStore) {
    g.__mirrahStore =
      dbMode() === "supabase"
        ? new SupabaseStore(config.supabaseUrl, config.supabaseServiceKey)
        : new MemoryStore(path.join(process.cwd(), ".data", "db.json"));
  }
  return g.__mirrahStore;
}

export type { Store } from "./types";
