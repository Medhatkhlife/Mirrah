/**
 * Email through Postmark (https://postmarkapp.com). Without POSTMARK_SERVER_TOKEN every send is
 * logged and skipped, so the app works in demo mode.
 */
export const emailConfig = {
  token: process.env.POSTMARK_SERVER_TOKEN ?? "",
  /** Sender for system mail to owners, e.g. "مِرآة <reports@yourdomain.com>". */
  from: process.env.MAIL_FROM ?? "",
  /** Sender used by the mystery customer. Must be a verified sender that does not reveal Mirrah. */
  probeFrom: process.env.MAIL_PROBE_FROM ?? "",
  /** Postmark inbound address, e.g. "abc123@inbound.postmarkapp.com". Replies come back via webhook. */
  inbound: process.env.POSTMARK_INBOUND_ADDRESS ?? "",
};

export const emailEnabled = () => Boolean(emailConfig.token && emailConfig.from);
export const probeEmailEnabled = () =>
  Boolean(emailConfig.token && emailConfig.probeFrom && emailConfig.inbound);

/** "abc@inbound.postmarkapp.com" + "tag" -> "abc+tag@inbound.postmarkapp.com" */
export function plusAddress(address: string, tag: string) {
  const at = address.indexOf("@");
  if (at < 0) throw new Error("invalid inbound address");
  return `${address.slice(0, at)}+${tag}${address.slice(at)}`;
}

export interface OutgoingEmail {
  from?: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export async function sendEmail(mail: OutgoingEmail): Promise<{ sent: boolean; error?: string }> {
  const from = mail.from ?? emailConfig.from;
  if (!emailConfig.token || !from) {
    console.info(`[email skipped: not configured] to=${mail.to} subject=${mail.subject}`);
    return { sent: false, error: "not configured" };
  }
  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": emailConfig.token,
      },
      body: JSON.stringify({
        From: from,
        To: mail.to,
        Subject: mail.subject,
        TextBody: mail.text,
        ReplyTo: mail.replyTo,
        MessageStream: "outbound",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const error = `${res.status} ${await res.text()}`;
      console.error("[email failed]", error);
      return { sent: false, error };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email failed]", e);
    return { sent: false, error: String(e) };
  }
}
