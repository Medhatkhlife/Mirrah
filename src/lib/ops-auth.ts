import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { config, dbMode } from "./config";

const COOKIE = "mirrah_ops";
const digest = (s: string) => createHash("sha256").update(`mirrah-ops:${s}`).digest("hex");

/** Operator access: password-protected; open only in local demo mode without a password. */
export async function isOperator(): Promise<boolean> {
  if (!config.opsPassword) return dbMode() === "demo";
  const v = (await cookies()).get(COOKIE)?.value ?? "";
  const want = digest(config.opsPassword);
  return v.length === want.length && timingSafeEqual(Buffer.from(v), Buffer.from(want));
}

export async function loginOperator(password: string): Promise<boolean> {
  if (!config.opsPassword || password !== config.opsPassword) return false;
  (await cookies()).set(COOKIE, digest(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return true;
}
