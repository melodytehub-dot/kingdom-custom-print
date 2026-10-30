import { OAuth2Client } from "google-auth-library";

export const GOOGLE_STATE_COOKIE = "kcp_google_state";
export const GOOGLE_NONCE_COOKIE = "kcp_google_nonce";
export const GOOGLE_VERIFIER_COOKIE = "kcp_google_verifier";

export function googleRedirectUri(requestUrl: string): string {
  return process.env.GOOGLE_REDIRECT_URI || new URL(
    "/api/account/google/callback",
    process.env.NEXT_PUBLIC_SITE_URL || requestUrl,
  ).toString();
}

export function googleClient(requestUrl: string): OAuth2Client | null {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) return null;
  return new OAuth2Client(id, secret, googleRedirectUri(requestUrl));
}

export function transientCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/account/google",
    maxAge: 600,
  };
}
