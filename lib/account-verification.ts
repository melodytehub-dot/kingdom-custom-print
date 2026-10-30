import { createHash, randomBytes } from "node:crypto";
import { sql } from "./db";
import { sendEmail } from "./email";
import { publicSiteUrl } from "./site-url";

export const verificationHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function sendAccountVerification(account: { id: number; email: string; name: string }) {
  const token = randomBytes(32).toString("hex");
  const hash = verificationHash(token);
  await sql`INSERT INTO customer_email_verifications (token_hash, account_id, expires_at) VALUES (${hash}, ${account.id}, now() + interval '24 hours')`;
  const url = `${publicSiteUrl()}/account/verify?token=${token}`;
  try {
    await sendEmail({ to: account.email, subject: "Confirm your email address", text: `Hi ${account.name},\n\nConfirm your email address to activate your Kingdom Custom Print account. This link expires in 24 hours.\n\n${url}\n\nIf you did not create this account, you can ignore this message.`, action: { label: "Confirm email", url } });
    await sql`DELETE FROM customer_email_verifications WHERE account_id = ${account.id} AND token_hash <> ${hash}`;
  } catch (error) {
    await sql`DELETE FROM customer_email_verifications WHERE token_hash = ${hash}`;
    throw error;
  }
}
