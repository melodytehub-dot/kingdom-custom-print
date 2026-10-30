type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
  action?: { label: string; url: string };
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

/** A plain-text alternative is always sent alongside the styled message. */
export function emailHtml(subject: string, text: string, action?: { label: string; url: string }): string {
  const htmlText = action ? text.split("\n").filter((line) => !line.includes(action.url)).join("\n").replace(/\n{3,}/g, "\n\n") : text;
  const paragraphs = htmlText.trim().split(/\n\s*\n/).map((part) => `<p style="margin:0 0 18px;line-height:1.6;color:#303030;overflow-wrap:anywhere">${escapeHtml(part).replace(/\n/g, "<br>")}</p>`).join("");
  const button = action ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#151515;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:bold">${escapeHtml(action.label)}</a></p>` : "";
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f4f3f1;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f3f1"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff"><tr><td style="background:#ffffff;padding:20px 28px"><a href="https://kingdomcustomprint.com" style="text-decoration:none"><img src="https://kingdomcustomprint.com/brand/kingdom-logo.png" width="160" alt="Kingdom Custom Print" style="display:block;width:160px;max-width:100%;height:auto;border:0"></a></td></tr><tr><td style="height:4px;background:#c8102e"></td></tr><tr><td style="padding:30px 28px;font-size:16px"><h1 style="margin:0 0 24px;font-size:23px;line-height:1.25;color:#151515">${escapeHtml(subject)}</h1>${paragraphs}${button}</td></tr><tr><td style="padding:20px 28px;border-top:1px solid #e2e2e2;color:#626262;font-size:13px;line-height:1.5">Kingdom Custom Print<br><a href="https://kingdomcustomprint.com" style="color:#a40e27">kingdomcustomprint.com</a></td></tr></table></td></tr></table></body></html>`;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Send transactional mail through Resend; never log the API key or message. */
export async function sendEmail(message: EmailMessage): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email service is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Kingdom Custom Print <orders@send.kingdomcustomprint.com>",
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: emailHtml(message.subject, message.text, message.action),
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  const body = await response.json() as { id?: unknown };
  if (typeof body.id !== "string") throw new Error("Email provider returned no message ID");
  return body.id;
}
