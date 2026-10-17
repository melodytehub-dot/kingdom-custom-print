/**
 * The hosted cut-out request.
 *
 * These are the exact parameters the rushordertees.com studio sends to imgix
 * when a customer flips "Remove Background": `bg-remove=true` with
 * `trim=colorUnlessAlpha` to also snip a leftover border, `fm=png` for
 * transparency, and `cs=strip` to drop the colour profile. Their payload is
 * readable in their studio bundle (`configuration {bgRemove: true, trim:
 * 'colorUnlessAlpha'}`), and this module mirrors it.
 *
 * One parameter is deliberately not theirs: `bg-remove-fallback=false`. With
 * imgix's default, a removal that fails is served as the *original photo* with
 * a 200, which the editor would paste onto a shirt as if it had been cut out.
 * A hard failure lets `lib/hostedCutout.ts` retry while imgix reports "still
 * processing" (a 423) and fall back to the on-device models otherwise.
 */

export const IMGIX_CUTOUT_PARAMS: Record<string, string> = {
  "bg-remove": "true",
  trim: "colorUnlessAlpha",
  fm: "png",
  cs: "strip",
  "bg-remove-fallback": "false",
};

/** Accepts a pasted dashboard URL or bare host and returns the host. */
export function cleanImgixDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

/** Builds `https://<domain>/<path>?bg-remove=…` for a parked photo. */
export function imgixCutoutUrl(domain: string, path: string): string {
  const clean = cleanImgixDomain(domain);
  if (!clean) throw new Error("No imgix source is configured.");
  const url = new URL(`https://${clean}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(IMGIX_CUTOUT_PARAMS)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
