import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../_guard";
import { limitedJson } from "@/lib/limited-form-data";
import { isPageSlug } from "@/lib/custom-pages";
import { readCustomPages } from "@/lib/custom-pages-store";
import { BUILDER_LIMITS, parseBuilderLayout } from "@/lib/builder/schema";
import {
  deleteBuilderPage,
  listBuilderPages,
  publishBuilderPage,
  readBuilderDraft,
  saveBuilderDraft,
  unpublishBuilderPage,
  type SaveInput,
} from "@/lib/builder/store";

export const dynamic = "force-dynamic";

type Body = {
  action?: unknown;
  slug?: unknown;
  title?: unknown;
  description?: unknown;
  showTitle?: unknown;
  layout?: unknown;
  expectedRevision?: unknown;
};

function text(value: unknown, max: number, { empty = true } = {}): string | null {
  if (typeof value !== "string" || value.length > max) return null;
  if (!empty && !value.trim()) return null;
  return value;
}

/** Validates a save/publish payload. Returns a message instead of throwing. */
async function readInput(body: Body): Promise<{ input: SaveInput } | { error: string; status: number }> {
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!isPageSlug(slug)) {
    return {
      error: "Page addresses use lowercase letters, numbers and dashes, and cannot reuse a store page.",
      status: 422,
    };
  }
  const title = text(body.title, BUILDER_LIMITS.title, { empty: false });
  const description = text(body.description ?? "", BUILDER_LIMITS.description);
  if (title === null || description === null) {
    return { error: "Give the page a title and keep the description short.", status: 422 };
  }

  const layout = parseBuilderLayout(body.layout);
  if (!layout) {
    return { error: "The page layout could not be saved. Check the styling values and try again.", status: 422 };
  }

  const expectedRevision = body.expectedRevision === 0 ? 0 : Number(body.expectedRevision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return { error: "The page changed. Reload it and try again.", status: 409 };
  }

  // A custom page and a builder page cannot share an address.
  const customPages = await readCustomPages();
  if (customPages.some((page) => page.slug === slug)) {
    return { error: "A page created in the older page editor already uses that address.", status: 409 };
  }

  return {
    input: {
      slug,
      title,
      description,
      showTitle: body.showTitle !== false,
      layout,
      expectedRevision,
    },
  };
}

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ pages: await listBuilderPages() });

  const draft = await readBuilderDraft(slug);
  if (!draft) return NextResponse.json({ error: "That page no longer exists." }, { status: 404 });
  return NextResponse.json({
    page: draft.page,
    revision: draft.revision,
    published: draft.published,
    publishedAt: draft.publishedAt,
  });
}

export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: Body;
  try {
    body = (await limitedJson(req, 524_288)) as Body;
  } catch (error) {
    return NextResponse.json(
      { error: "The page could not be read." },
      { status: error instanceof RangeError ? 413 : 400 }
    );
  }

  const parsed = await readInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const result = await saveBuilderDraft(parsed.input);
  if (!result.ok) {
    if (result.reason === "limit") {
      return NextResponse.json({ error: "You have reached the page limit. Delete a page you no longer need." }, { status: 422 });
    }
    return NextResponse.json(
      {
        error:
          result.reason === "not-found"
            ? "That page no longer exists. Reload the page list."
            : "This page was changed in another session. Reload it before saving.",
      },
      { status: 409 }
    );
  }

  revalidatePath("/", "layout");
  revalidatePath(`/${parsed.input.slug}`);
  return NextResponse.json({ ok: true, revision: result.revision });
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: Body;
  try {
    body = (await limitedJson(req, 524_288)) as Body;
  } catch (error) {
    return NextResponse.json(
      { error: "The request could not be read." },
      { status: error instanceof RangeError ? 413 : 400 }
    );
  }

  if (body.action === "delete" || body.action === "unpublish") {
    const slug = typeof body.slug === "string" ? body.slug : "";
    if (!isPageSlug(slug)) return NextResponse.json({ error: "Choose a page first." }, { status: 422 });
    const expectedRevision = Number(body.expectedRevision);

    if (body.action === "delete") {
      const removed = await deleteBuilderPage(slug);
      if (!removed) return NextResponse.json({ error: "That page no longer exists." }, { status: 404 });
      revalidatePath("/", "layout");
      revalidatePath(`/${slug}`);
      return NextResponse.json({ ok: true });
    }

    if (!Number.isInteger(expectedRevision)) {
      return NextResponse.json({ error: "The page changed. Reload it and try again." }, { status: 409 });
    }
    const result = await unpublishBuilderPage(slug, expectedRevision);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason === "not-found" ? "That page no longer exists." : "This page changed in another session. Reload it." },
        { status: 409 }
      );
    }
    revalidatePath("/", "layout");
    revalidatePath(`/${slug}`);
    return NextResponse.json({ ok: true, revision: result.revision });
  }

  if (body.action !== "publish") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const parsed = await readInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  // Publishing an empty page would leave a blank address, so require content.
  const hasContent = parsed.input.layout.sections.some((section) =>
    section.columns.some((column) => column.widgets.some((widget) => {
      if (widget.kind === "image") return widget.src !== "";
      if (widget.kind === "faq") return widget.items.length > 0;
      if (widget.kind === "spacer" || widget.kind === "divider") return true;
      return widget.text.trim() !== "";
    }))
  );
  if (!hasContent) {
    return NextResponse.json({ error: "Add some content before publishing this page." }, { status: 422 });
  }

  const result = await publishBuilderPage(parsed.input);
  if (!result.ok) {
    if (result.reason === "limit") {
      return NextResponse.json({ error: "You have reached the page limit." }, { status: 422 });
    }
    return NextResponse.json(
      { error: result.reason === "not-found" ? "Save the page before publishing it." : "This page changed in another session. Reload it." },
      { status: 409 }
    );
  }

  revalidatePath("/", "layout");
  revalidatePath(`/${parsed.input.slug}`);
  return NextResponse.json({ ok: true, revision: result.revision, published: true });
}
