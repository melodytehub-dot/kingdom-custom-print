import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sameOrigin } from "@/lib/customer-auth";
import { verificationHash } from "@/lib/account-verification";
import { limitedFormData } from "@/lib/limited-form-data";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new NextResponse("Invalid request.", { status: 403 });
  let data: FormData;
  try { data = await limitedFormData(request, 4096); }
  catch (error) {
    return new NextResponse(error instanceof RangeError ? "Request too large." : "Invalid request.", { status: error instanceof RangeError ? 413 : 400 });
  }
  const token = String(data.get("token") ?? "");
  if (!/^[a-f0-9]{64}$/.test(token)) return NextResponse.redirect(new URL("/account?verification=invalid", request.url), 303);
  try {
    const verified = await sql.begin(async (tx) => {
      const [row] = await tx<{ account_id: number }[]>`DELETE FROM customer_email_verifications WHERE token_hash = ${verificationHash(token)} AND expires_at > now() RETURNING account_id`;
      if (!row) return false;
      await tx`UPDATE customer_accounts SET email_verified = true WHERE id = ${row.account_id}`;
      await tx`DELETE FROM customer_email_verifications WHERE account_id = ${row.account_id}`;
      return true;
    });
    return NextResponse.redirect(new URL(`/account?verification=${verified ? "success" : "invalid"}`, request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/account?verification=unavailable", request.url), 303);
  }
}
