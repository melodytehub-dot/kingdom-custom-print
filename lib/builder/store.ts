/**
 * Storage for pages built in the visual editor.
 *
 * Draft and published layouts live in the same row: `layout_json` is the draft
 * an owner is editing, `published_json` is what visitors see. `revision` guards
 * against two admin sessions overwriting each other, the same way the homepage
 * editor does it.
 */
import "server-only";
import { sql } from "@/lib/db";
import {
  parseBuilderPage,
  type BuilderLayout,
  type BuilderPage,
} from "@/lib/builder/schema";

export type BuilderPageSummary = {
  slug: string;
  title: string;
  description: string;
  revision: number;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

export type BuilderDraft = {
  page: BuilderPage;
  revision: number;
  published: boolean;
  publishedAt: string | null;
};

type Row = {
  slug: string;
  title: string;
  description: string;
  show_title: number | bigint;
  layout_json: string;
  revision: number | bigint;
  published_json: string | null;
  published_at: string | null;
  updated_at: string;
};

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function pageFrom(row: Row, json: string): BuilderPage | null {
  return parseBuilderPage({
    slug: row.slug,
    title: row.title,
    description: row.description,
    showTitle: Number(row.show_title) === 1,
    layout: parseJson(json),
    updatedAt: row.updated_at,
  });
}

export async function listBuilderPages(): Promise<BuilderPageSummary[]> {
  const rows = await sql<Row[]>`
    SELECT slug, title, description, show_title, layout_json, revision, published_json, published_at, updated_at
    FROM builder_pages
    ORDER BY updated_at DESC`;
  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    description: row.description,
    revision: Number(row.revision),
    published: row.published_json !== null,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  }));
}

export async function readBuilderDraft(slug: string): Promise<BuilderDraft | null> {
  const [row] = await sql<Row[]>`
    SELECT slug, title, description, show_title, layout_json, revision, published_json, published_at, updated_at
    FROM builder_pages WHERE slug = ${slug}`;
  if (!row) return null;
  const page = pageFrom(row, row.layout_json);
  if (!page) return null;
  return {
    page,
    revision: Number(row.revision),
    published: row.published_json !== null,
    publishedAt: row.published_at,
  };
}

/** The page visitors see. A broken or missing snapshot simply renders nothing. */
export async function readPublishedBuilderPage(slug: string): Promise<BuilderPage | null> {
  const [row] = await sql<Row[]>`
    SELECT slug, title, description, show_title, layout_json, revision, published_json, published_at, updated_at
    FROM builder_pages WHERE slug = ${slug}`;
  if (!row?.published_json) return null;
  return pageFrom(row, row.published_json);
}

export async function builderSlugTaken(slug: string): Promise<boolean> {
  const [row] = await sql`SELECT 1 FROM builder_pages WHERE slug = ${slug} LIMIT 1`;
  return Boolean(row);
}

export type SaveInput = {
  slug: string;
  title: string;
  description: string;
  showTitle: boolean;
  layout: BuilderLayout;
  expectedRevision: number;
};

export type SaveResult =
  | { ok: true; revision: number }
  | { ok: false; reason: "conflict" | "not-found" | "limit" };

const PAGE_LIMIT = 40;

/** Saves the draft. `expectedRevision` of 0 creates the page. */
export async function saveBuilderDraft(input: SaveInput): Promise<SaveResult> {
  const now = new Date().toISOString();
  const layout = JSON.stringify(input.layout);

  if (input.expectedRevision === 0) {
    const [{ n }] = await sql<{ n: number }[]>`SELECT count(*) AS n FROM builder_pages`;
    if (Number(n) >= PAGE_LIMIT) return { ok: false, reason: "limit" };
    const inserted = await sql`
      INSERT INTO builder_pages (slug, title, description, show_title, layout_json, revision, published_json, published_at, updated_at)
      VALUES (${input.slug}, ${input.title}, ${input.description}, ${input.showTitle ? 1 : 0}, ${layout}, 1, NULL, NULL, ${now})
      ON CONFLICT (slug) DO NOTHING`;
    return inserted.count === 1 ? { ok: true, revision: 1 } : { ok: false, reason: "conflict" };
  }

  const updated = await sql`
    UPDATE builder_pages
    SET title = ${input.title},
        description = ${input.description},
        show_title = ${input.showTitle ? 1 : 0},
        layout_json = ${layout},
        revision = revision + 1,
        updated_at = ${now}
    WHERE slug = ${input.slug} AND revision = ${input.expectedRevision}`;
  if (updated.count === 1) return { ok: true, revision: input.expectedRevision + 1 };

  const exists = await builderSlugTaken(input.slug);
  return { ok: false, reason: exists ? "conflict" : "not-found" };
}

/**
 * Publishes the draft and bumps the revision in one statement, so visitors can
 * never see a half-updated page. `expectedRevision` of 0 creates and publishes
 * the page in a single step.
 */
export async function publishBuilderPage(input: SaveInput): Promise<SaveResult> {
  const now = new Date().toISOString();
  const layout = JSON.stringify(input.layout);

  if (input.expectedRevision === 0) {
    const [{ n }] = await sql<{ n: number }[]>`SELECT count(*) AS n FROM builder_pages`;
    if (Number(n) >= PAGE_LIMIT) return { ok: false, reason: "limit" };
    const inserted = await sql`
      INSERT INTO builder_pages (slug, title, description, show_title, layout_json, revision, published_json, published_at, updated_at)
      VALUES (${input.slug}, ${input.title}, ${input.description}, ${input.showTitle ? 1 : 0}, ${layout}, 1, ${layout}, ${now}, ${now})
      ON CONFLICT (slug) DO NOTHING`;
    return inserted.count === 1 ? { ok: true, revision: 1 } : { ok: false, reason: "conflict" };
  }

  const updated = await sql`
    UPDATE builder_pages
    SET title = ${input.title},
        description = ${input.description},
        show_title = ${input.showTitle ? 1 : 0},
        layout_json = ${layout},
        published_json = ${layout},
        published_at = ${now},
        revision = revision + 1,
        updated_at = ${now}
    WHERE slug = ${input.slug} AND revision = ${input.expectedRevision}`;
  if (updated.count === 1) return { ok: true, revision: input.expectedRevision + 1 };
  const exists = await builderSlugTaken(input.slug);
  return { ok: false, reason: exists ? "conflict" : "not-found" };
}

export async function unpublishBuilderPage(slug: string, expectedRevision: number): Promise<SaveResult> {
  const updated = await sql`
    UPDATE builder_pages
    SET published_json = NULL,
        published_at = NULL,
        revision = revision + 1,
        updated_at = ${new Date().toISOString()}
    WHERE slug = ${slug} AND revision = ${expectedRevision}`;
  if (updated.count === 1) return { ok: true, revision: expectedRevision + 1 };
  const exists = await builderSlugTaken(slug);
  return { ok: false, reason: exists ? "conflict" : "not-found" };
}

export async function deleteBuilderPage(slug: string): Promise<boolean> {
  const deleted = await sql`DELETE FROM builder_pages WHERE slug = ${slug}`;
  return deleted.count > 0;
}
