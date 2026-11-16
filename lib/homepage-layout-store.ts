import "server-only";
import { sql } from "@/lib/db";
import { defaultHomepageLayout, parseHomepageLayout, type HomepageLayout } from "@/lib/homepage-builder";

export const HOMEPAGE_DRAFT_KEY = "homepage_layout_draft_v1";
export const HOMEPAGE_DRAFT_REVISION_KEY = "homepage_layout_draft_revision_v1";
export const HOMEPAGE_PUBLISHED_KEY = "homepage_layout_published_v1";
export const HOMEPAGE_PREVIOUS_KEY = "homepage_layout_previous_v1";
export const HOMEPAGE_HISTORY_KEY = "homepage_layout_history_v1";

/** How many published versions the editor keeps for restoring. */
export const HOMEPAGE_HISTORY_LIMIT = 10;

export type HomepageHistoryEntry = { id: string; savedAt: string; layout: HomepageLayout };
export type HomepageHistorySummary = { id: string; savedAt: string };

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

/** Reads stored versions, dropping entries that no longer validate. */
export function parseHomepageHistory(value: unknown): HomepageHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: HomepageHistoryEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.id)) continue;
    if (typeof entry.savedAt !== "string" || Number.isNaN(Date.parse(entry.savedAt))) continue;
    const layout = parseHomepageLayout(entry.layout);
    if (!layout) continue;
    entries.push({ id: entry.id, savedAt: entry.savedAt, layout });
    if (entries.length === HOMEPAGE_HISTORY_LIMIT) break;
  }
  return entries;
}

export function homepageHistorySummary(entries: HomepageHistoryEntry[]): HomepageHistorySummary[] {
  return entries.map(entry => ({ id: entry.id, savedAt: entry.savedAt }));
}

/** Adds a version to the front of the list and keeps the newest entries. */
export function withHomepageHistoryEntry(entries: HomepageHistoryEntry[], layout: HomepageLayout): HomepageHistoryEntry[] {
  // baseStructure is a large comparison snapshot that is rebuilt when a version
  // is loaded, so it is not stored with each entry.
  const { baseStructure: _baseStructure, ...stored } = layout;
  return [{ id: crypto.randomUUID(), savedAt: new Date().toISOString(), layout: stored }, ...entries].slice(0, HOMEPAGE_HISTORY_LIMIT);
}
