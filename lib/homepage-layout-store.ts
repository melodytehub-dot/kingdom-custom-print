import "server-only";
import { sql } from "@/lib/db";
import { defaultHomepageLayout, parseHomepageLayout, type HomepageLayout } from "@/lib/homepage-builder";

export const HOMEPAGE_DRAFT_KEY = "homepage_layout_draft_v1";
export const HOMEPAGE_DRAFT_REVISION_KEY = "homepage_layout_draft_revision_v1";
export const HOMEPAGE_PUBLISHED_KEY = "homepage_layout_published_v1";
export const HOMEPAGE_PREVIOUS_KEY = "homepage_layout_previous_v1";

export async function readHomepageLayout(key: string): Promise<HomepageLayout | null> {
  const rows = await sql<{ value: unknown }[]>`SELECT value FROM site_settings WHERE key = ${key}`;
  if (!rows.length) return null;
  const layout = parseHomepageLayout(rows[0].value);
  if (!layout) throw new Error("Invalid stored homepage layout");
  return layout;
}

export async function publishedHomepageLayout(): Promise<HomepageLayout> {
  return await readHomepageLayout(HOMEPAGE_PUBLISHED_KEY) ?? defaultHomepageLayout();
}
