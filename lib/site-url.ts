/** Public origin used for canonical links and checkout redirects. */
export function publicSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return process.env.NODE_ENV === "production"
    ? "https://kingdomcustomprint.com"
    : "http://localhost:3000";
}
