/**
 * The hosted cut-out request, for the /cutout-compare evaluation page.
 *
 * These are the exact parameters the rushordertees.com studio sends to imgix
 * when a customer flips "Remove Background": `bg-remove=true` with
 * `trim=colorUnlessAlpha` to also snip a leftover border, `fm=png` for
 * transparency, and `cs=strip` to drop the colour profile. Their payload is
 * readable in their studio bundle (`configuration {bgRemove: true, trim:
 * 'colorUnlessAlpha'}`), and this module mirrors it so the comparison is
 * apples-to-apples.
 */

export const IMGIX_CUTOUT_PARAMS: Record<string, string> = {
  "bg-remove": "true",
  trim: "colorUnlessAlpha",
  fm: "png",
  cs: "strip",
};

/** Which AI model does the removal; the default is Bria, which is theirs. */
export const IMGIX_MODELS = [
  { value: "", label: "Default (Bria — matches rushordertees)" },
  { value: "1", label: "Remove.bg" },
  { value: "3", label: "fal · Ideogram" },
  { value: "4", label: "fal · Pixelcut" },
] as const;

/** Accepts a pasted dashboard URL or bare host and returns the host. */
export function cleanImgixDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

/** Builds `https://<domain>/<path>?bg-remove=…` for a sample or bridge path. */
export function imgixCutoutUrl(domain: string, path: string, model = ""): string {
  const clean = cleanImgixDomain(domain);
  if (!clean) throw new Error("Enter the imgix domain first.");
  const url = new URL(`https://${clean}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(IMGIX_CUTOUT_PARAMS)) {
    url.searchParams.set(key, value);
  }
  if (model) url.searchParams.set("bg-remove-model", model);
  return url.toString();
}
