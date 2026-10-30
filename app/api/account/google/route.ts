import { randomBytes } from "node:crypto";
import { CodeChallengeMethod } from "google-auth-library";
import { NextResponse } from "next/server";
import { googleClient, transientCookieOptions, GOOGLE_NONCE_COOKIE, GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE } from "@/lib/google-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const client = googleClient(request.url);
  if (!client) return NextResponse.redirect(new URL("/account?google=unavailable", request.url));

  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const url = client.generateAuthUrl({
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
    access_type: "online",
    prompt: "select_account",
  });
  const response = NextResponse.redirect(url);
  const options = transientCookieOptions();
  response.cookies.set(GOOGLE_STATE_COOKIE, state, options);
  response.cookies.set(GOOGLE_NONCE_COOKIE, nonce, options);
  response.cookies.set(GOOGLE_VERIFIER_COOKIE, codeVerifier, options);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
