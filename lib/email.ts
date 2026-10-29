type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
};

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
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  const body = await response.json() as { id?: unknown };
  if (typeof body.id !== "string") throw new Error("Email provider returned no message ID");
  return body.id;
}
