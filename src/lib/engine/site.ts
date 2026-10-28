import { isIP } from "net";

/** Rejects URLs that could reach internal infrastructure (basic SSRF guard). */
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (isIP(host)) return false; // require a real domain name
  if (!host.includes(".")) return false;
  return true;
}

/** Fetch a website and return readable text, at most ~8k chars. Never throws. */
export async function fetchSiteText(raw: string): Promise<string> {
  if (!isSafePublicUrl(raw)) return "";
  const url = raw.startsWith("http") ? raw : `https://${raw}`;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "MirrahBot/0.1 (+site summary for consented scans)" },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return "";
    const html = (await res.text()).slice(0, 500_000);
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  } catch {
    return "";
  }
}
