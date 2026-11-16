import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { sql } from "@/lib/db";
import type { SqlFragment } from "@/lib/sqlite";
import { limitedJson } from "@/lib/limited-form-data";
import { HOMEPAGE_CONTENT_FIELDS, defaultHomepageLayout, homepageContentFromSettings, homepageStructure, parseHomepageLayout } from "@/lib/homepage-builder";
import { HOMEPAGE_DRAFT_KEY, HOMEPAGE_DRAFT_REVISION_KEY, HOMEPAGE_HISTORY_KEY, HOMEPAGE_PREVIOUS_KEY, HOMEPAGE_PUBLISHED_KEY, homepageHistorySummary, parseHomepageHistory, publishedHomepageLayout, readHomepageLayout, withHomepageHistoryEntry } from "@/lib/homepage-layout-store";
import { revalidatePath } from "next/cache";
import { DEFAULT_SETTINGS, getSettings, parseSettingValue } from "@/lib/catalog";
import { isGuardFailure } from "@/lib/inventory-reservations";

export const dynamic = "force-dynamic";

function upsertSetting(key: string, value: unknown): SqlFragment {
  return sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (${key}, ${sql.json(value)}, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT (key) DO UPDATE
      SET value = excluded.value, updated_at = excluded.updated_at`;
}

/**
 * Compare-and-set on the draft revision. Only the editor session that read the
 * current revision can write, and the guard aborts the whole batch otherwise.
 *
 * The stored value may be plain text or JSON-encoded depending on when it was
 * written, so the comparison normalises it first.
 */
function claimRevision(revision: string, expected: string | null): SqlFragment[] {
  return [
    sql`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (${HOMEPAGE_DRAFT_REVISION_KEY}, ${revision}, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT (key) DO UPDATE
        SET value = excluded.value, updated_at = excluded.updated_at
        WHERE (CASE WHEN json_valid(site_settings.value)
                    THEN json_extract(site_settings.value, '$')
                    ELSE site_settings.value END) IS ${expected}`,
    sql`INSERT INTO transaction_guards (key, value) SELECT 'homepage-revision', 0 WHERE changes() <> 1`,
  ];
}

const CONFLICT_MESSAGE = "The saved draft changed in another session. Copy any unsaved edits, then reload the editor.";
const conflict = () => NextResponse.json({ error: CONFLICT_MESSAGE }, { status: 409 });

async function settingsValues(): Promise<Map<string, unknown>> {
  const rows = await sql<{ key: string; value: unknown }[]>`SELECT key, value FROM site_settings`;
  return new Map(rows.map((row) => [row.key, parseSettingValue(row.value)]));
}

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const values = await settingsValues();
  const draftStored = values.get(HOMEPAGE_DRAFT_KEY);
  const revisionStored = values.get(HOMEPAGE_DRAFT_REVISION_KEY) ?? null;
  const draft = draftStored === undefined ? null : parseHomepageLayout(draftStored);
  const revisionValid = validRevision(revisionStored);
  if ((draftStored !== undefined && !draft) || (revisionStored !== null && (!revisionValid || draftStored === undefined))) {
    return NextResponse.json({ error: "The saved draft could not be loaded." }, { status: 500 });
  }
  const [published, previous, settings] = await Promise.all([
    publishedHomepageLayout(),
    readHomepageLayout(HOMEPAGE_PREVIOUS_KEY),
    getSettings(),
  ]);
  const current = homepageContentFromSettings(settings);
  const layout = draft?.content
    ? { ...draft, baseStructure: draft.baseStructure ?? homepageStructure(published) }
    : { ...(draft ?? published), content: current, baseContent: current, baseStructure: homepageStructure(published) };
  const history = homepageHistorySummary(parseHomepageHistory(values.get(HOMEPAGE_HISTORY_KEY)));
  return NextResponse.json({
    layout,
    hasDraft: Boolean(draft?.content),
    hasPrevious: Boolean(previous),
    revision: revisionValid ? (revisionStored as string | null) : null,
    history,
  });
}

function validRevision(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value));
}

export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let input: unknown;
  try { input = await limitedJson(req, 524288); }
  catch (error) {
    return NextResponse.json({ error: "The draft could not be read." }, { status: error instanceof RangeError ? 413 : 400 });
  }
  const layout = parseHomepageLayout(input);
  const expectedRevision = input && typeof input === "object" ? (input as { expectedRevision?: unknown }).expectedRevision : undefined;
  if (!layout || !validRevision(expectedRevision)) return NextResponse.json({ error: "The page layout is invalid." }, { status: 422 });
  const revision = crypto.randomUUID();

  const values = await settingsValues();
  const currentRevision = values.get(HOMEPAGE_DRAFT_REVISION_KEY) ?? null;
  if (currentRevision !== expectedRevision) return conflict();

  try {
    await sql.batch([
      ...claimRevision(revision, expectedRevision),
      upsertSetting(HOMEPAGE_DRAFT_KEY, layout),
    ]);
  } catch (error) {
    if (isGuardFailure(error)) return conflict();
    throw error;
  }
  return NextResponse.json({ ok: true, revision });
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let input: { action?: unknown; layout?: unknown; expectedRevision?: unknown; versionId?: unknown };
  try { input = await limitedJson(req, 524288) as typeof input; }
  catch (error) { return NextResponse.json({ error: "The request could not be read." }, { status: error instanceof RangeError ? 413 : 400 }); }
  if (!input || (input.action !== "publish" && input.action !== "restore" && input.action !== "load-version")) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  if (!validRevision(input.expectedRevision)) return NextResponse.json({ error: "The draft version is invalid." }, { status: 422 });
  const expectedRevision = input.expectedRevision;
  const requested = input.action === "publish" ? parseHomepageLayout(input.layout) : null;
  if (input.action === "publish" && !requested) return NextResponse.json({ error: "The page layout is invalid." }, { status: 422 });
  if (input.action === "load-version" && (typeof input.versionId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.versionId))) return NextResponse.json({ error: "That version is not available." }, { status: 422 });

  const values = await settingsValues();
  if ((values.get(HOMEPAGE_DRAFT_REVISION_KEY) ?? null) !== expectedRevision) return conflict();

  const get = (key: string) => values.has(key) ? parseHomepageLayout(values.get(key)) : null;
  const draft = get(HOMEPAGE_DRAFT_KEY);
  const storedPublished = get(HOMEPAGE_PUBLISHED_KEY);
  const previous = get(HOMEPAGE_PREVIOUS_KEY);
  if ((values.has(HOMEPAGE_DRAFT_KEY) && !draft) || (values.has(HOMEPAGE_PUBLISHED_KEY) && !storedPublished) || (values.has(HOMEPAGE_PREVIOUS_KEY) && !previous)) {
    return NextResponse.json({ error: "A saved layout is invalid. No changes were published." }, { status: 500 });
  }
  const defaults = homepageContentFromSettings(DEFAULT_SETTINGS);
  const liveContent = { ...defaults };
  for (const field of HOMEPAGE_CONTENT_FIELDS) liveContent[field.name] = String(values.get(field.dbKey) ?? defaults[field.name]);
  const current = { ...(storedPublished ?? defaultHomepageLayout()), content: liveContent, baseContent: liveContent };
  const history = parseHomepageHistory(values.get(HOMEPAGE_HISTORY_KEY));

  if (input.action === "load-version") {
    const entry = history.find((item) => item.id === input.versionId);
    if (!entry) return NextResponse.json({ error: "That version is no longer available. Reload the editor to see the latest versions." }, { status: 409 });
    const loaded = entry.layout.content
      ? { ...entry.layout, baseContent: liveContent, baseStructure: homepageStructure(current) }
      : { ...current, ...entry.layout, content: liveContent, baseContent: liveContent, baseStructure: homepageStructure(current) };
    const revision = crypto.randomUUID();
    try {
      await sql.batch([
        ...claimRevision(revision, expectedRevision),
        upsertSetting(HOMEPAGE_DRAFT_KEY, loaded),
      ]);
    } catch (error) {
      if (isGuardFailure(error)) return conflict();
      throw error;
    }
    return NextResponse.json({
      ok: true,
      layout: loaded,
      revision,
      hasPrevious: Boolean(previous),
      history: homepageHistorySummary(history),
    });
  }

  if (input.action === "publish" && (!draft || JSON.stringify(draft) !== JSON.stringify(requested))) return NextResponse.json({ error: "The saved draft changed. Reload it before publishing." }, { status: 409 });
  if (input.action === "publish" && draft?.baseContent && JSON.stringify(draft.baseContent) !== JSON.stringify(liveContent)) return NextResponse.json({ error: "Homepage content changed since this draft was started. Discard the draft and start again with the latest content before publishing." }, { status: 409 });
  if (input.action === "publish" && (!draft?.baseStructure || draft.baseStructure !== homepageStructure(current))) return NextResponse.json({ error: "The live homepage layout changed since this draft was started. Discard this draft and start again with the latest layout before publishing." }, { status: 409 });
  if (input.action === "restore" && !previous) return NextResponse.json({ error: "There is no previous version to restore." }, { status: 409 });
  const selected = input.action === "publish" ? draft! : previous!;
  if (selected.heroActions && (!selected.heroActions.primaryText.trim() || !selected.heroActions.secondaryText.trim())) return NextResponse.json({ error: "Add text to both hero buttons before publishing." }, { status: 422 });
  if (selected.questionsContent && (!selected.questionsContent.titleTop.trim() || !selected.questionsContent.items.length || selected.questionsContent.items.some(item => !item.question.trim() || !item.answer.trim() || Boolean(item.linkText.trim()) !== Boolean(item.link.trim())))) return NextResponse.json({ error: "Complete the questions section heading and each question and answer. Complete both link fields or leave both empty." }, { status: 422 });
  if ((selected.customBlocks ?? []).some(block => !block.heading.trim() || (block.type === "faq" ? !block.faqItems?.length || block.faqItems.some(item => !item.question.trim() || !item.answer.trim()) : block.type === "products" ? !block.productIds?.length : Boolean(block.buttonText.trim()) !== Boolean(block.buttonLink.trim())))) return NextResponse.json({ error: "Add a heading to each section, select products, complete each question and answer, and fill both button fields or leave both empty." }, { status: 422 });
  const nextContent = selected.content ?? liveContent;
  if (input.action === "publish") {
    const hidden = new Set(selected.hiddenSections ?? []);
    const shown = new Set(selected.sections.filter(id => !hidden.has(id)));
    const missing: string[] = [];
    if (!nextContent.heroHeadlineTop.trim() || !nextContent.heroHeadlineBottom.trim()) missing.push("hero heading");
    if (shown.has("products") && !nextContent.homeProductsTitle.trim()) missing.push("products heading");
    if (shown.has("contact") && !nextContent.homeContactTitle.trim()) missing.push("contact heading");
    if (shown.has("design-banner") && selected.designBanner) {
      if (!selected.designBanner.heading.trim()) missing.push("design banner heading");
      if (!selected.designBanner.buttonText.trim()) missing.push("design banner button text");
    }
    if (missing.length) return NextResponse.json({ error: `Complete these fields before publishing: ${missing.join(", ")}.` }, { status: 422 });
  }
  for (const block of selected.customBlocks ?? []) {
    if (block.type === "products") {
      for (const id of block.productIds ?? []) {
        const product = await sql<{ id: number }[]>`SELECT id FROM products WHERE id = ${id} AND active = 1`;
        if (!product.length) return NextResponse.json({ error: "A selected product is no longer active. Remove it or choose another before publishing." }, { status: 422 });
      }
    }
    if (block.image?.startsWith("/api/product-media/")) {
      const id = block.image.slice("/api/product-media/".length);
      const media = await sql<{ id: string }[]>`SELECT id FROM catalog_media WHERE id = ${id}`;
      if (!media.length) return NextResponse.json({ error: "An image in a message section is no longer available. Choose another image before publishing." }, { status: 422 });
    }
  }
  for (const key of ["heroImage1", "heroImage2", "heroImage3"] as const) {
    const path = nextContent[key];
    if (path.startsWith("/api/product-media/")) {
      const id = path.slice("/api/product-media/".length);
      const media = await sql<{ id: string }[]>`SELECT id FROM catalog_media WHERE id = ${id}`;
      if (!media.length) return NextResponse.json({ error: "An uploaded hero image is no longer available. Choose another image before publishing." }, { status: 422 });
    }
  }

  const next = { ...selected, content: nextContent, baseContent: nextContent, baseStructure: homepageStructure(selected) };
  let nextHistory = history;
  const statements: SqlFragment[] = [];
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    statements.push(upsertSetting(HOMEPAGE_PREVIOUS_KEY, current));
    nextHistory = withHomepageHistoryEntry(history, current);
    statements.push(upsertSetting(HOMEPAGE_HISTORY_KEY, nextHistory));
  }
  statements.push(upsertSetting(HOMEPAGE_PUBLISHED_KEY, next));
  for (const field of HOMEPAGE_CONTENT_FIELDS) statements.push(upsertSetting(field.dbKey, nextContent[field.name]));
  statements.push(upsertSetting(HOMEPAGE_DRAFT_KEY, next));
  const revision = crypto.randomUUID();

  try {
    await sql.batch([...claimRevision(revision, expectedRevision), ...statements]);
  } catch (error) {
    if (isGuardFailure(error)) return conflict();
    throw error;
  }

  revalidatePath("/", "layout");
  return NextResponse.json({
    ok: true,
    layout: next,
    revision,
    hasPrevious: JSON.stringify(current) !== JSON.stringify(next) || Boolean(previous),
    history: homepageHistorySummary(nextHistory),
  });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let input: { expectedRevision?: unknown };
  try { input = await limitedJson(req, 1024) as typeof input; }
  catch { return NextResponse.json({ error: "The request could not be read." }, { status: 400 }); }
  if (!input || !validRevision(input.expectedRevision)) return NextResponse.json({ error: "The draft version is invalid." }, { status: 422 });

  const values = await settingsValues();
  const currentRevision = values.get(HOMEPAGE_DRAFT_REVISION_KEY) ?? null;
  if (currentRevision !== input.expectedRevision) return conflict();
  if (currentRevision === null) return NextResponse.json({ ok: true });

  try {
    await sql.batch([
      sql`
        DELETE FROM site_settings
        WHERE key = ${HOMEPAGE_DRAFT_REVISION_KEY}
          AND (CASE WHEN json_valid(value) THEN json_extract(value, '$') ELSE value END) IS ${input.expectedRevision}`,
      sql`INSERT INTO transaction_guards (key, value) SELECT 'homepage-revision', 0 WHERE changes() <> 1`,
      sql`DELETE FROM site_settings WHERE key = ${HOMEPAGE_DRAFT_KEY}`,
    ]);
  } catch (error) {
    if (isGuardFailure(error)) return conflict();
    throw error;
  }
  return NextResponse.json({ ok: true });
}


