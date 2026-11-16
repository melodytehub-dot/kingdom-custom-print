import Link from "next/link";
import "../account.css";

export const metadata = { title: "Confirm your email", robots: { index: false, follow: false }, referrer: "same-origin" as const };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = /^[a-f0-9]{64}$/.test(token);
  return <section className="account-page minimog-container"><div className="account-access"><h1>Confirm your email</h1>
    {valid ? <><p>Confirm your email address to activate your account.</p><form method="post" action="/api/account/verify"><input type="hidden" name="token" value={token} /><button className="account-submit" type="submit">Confirm email</button></form></> : <p>This link is invalid. <Link href="/account">Sign in</Link> to request a new one.</p>}
  </div></section>;
}
