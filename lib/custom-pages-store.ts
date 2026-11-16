import "server-only";
import { sql } from "@/lib/db";
import { PAGE_LIMITS, parseCustomPages, type CustomPage } from "@/lib/custom-pages";

export const CUSTOM_PAGES_KEY = "custom_pages_v1";

export async function readCustomPages(): Promise<CustomPage[]> {
  const rows = await sql<{ value: unknown }[]>`SELECT value FROM site_settings WHERE key = ${CUSTOM_PAGES_KEY}`;
  return parseCustomPages(rows[0]?.value);
}

export async function writeCustomPages(pages: CustomPage[]): Promise<void> {
  if (pages.length > PAGE_LIMITS.pages) throw new RangeError("Too many pages");
  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (${CUSTOM_PAGES_KEY}, ${sql.json(pages as never)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

/** The published page for a slug, or null when it is unknown or unpublished. */
export async function publishedCustomPage(slug: string): Promise<CustomPage | null> {
  const pages = await readCustomPages();
  return pages.find(page => page.slug === slug && page.published) ?? null;
}
