import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../_guard";
import { limitedJson } from "@/lib/limited-form-data";
import { PAGE_LIMITS, parseCustomPage } from "@/lib/custom-pages";
import { readCustomPages, writeCustomPages } from "@/lib/custom-pages-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json({ pages: await readCustomPages() });
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let input: { action?: unknown; page?: unknown; id?: unknown };
  try {
    input = await limitedJson(req, 262144) as typeof input;
  } catch (error) {
    return NextResponse.json({ error: "The request could not be read." }, { status: error instanceof RangeError ? 413 : 400 });
  }
  if (!input || (input.action !== "save" && input.action !== "delete")) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const pages = await readCustomPages();

  if (input.action === "delete") {
    if (typeof input.id !== "string") return NextResponse.json({ error: "Choose a page to delete." }, { status: 422 });
    const remaining = pages.filter(page => page.id !== input.id);
    if (remaining.length === pages.length) return NextResponse.json({ error: "That page no longer exists." }, { status: 409 });
    await writeCustomPages(remaining);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, pages: remaining });
  }

  const page = parseCustomPage(input.page);
  if (!page) return NextResponse.json({ error: "Check the page title, address and content. Page addresses use lowercase letters, numbers and dashes." }, { status: 422 });
  if (pages.some(item => item.slug === page.slug && item.id !== page.id)) {
    return NextResponse.json({ error: "Another page already uses that address." }, { status: 409 });
  }
  const existing = pages.find(item => item.id === page.id);
  if (existing && existing.slug !== page.slug && existing.published) {
    revalidatePath(`/${existing.slug}`);
  }
  const next = existing
    ? pages.map(item => item.id === page.id ? page : item)
    : pages.length >= PAGE_LIMITS.pages
      ? null
      : [page, ...pages];
  if (!next) return NextResponse.json({ error: `You can create up to ${PAGE_LIMITS.pages} pages.` }, { status: 422 });
  await writeCustomPages(next);
  revalidatePath("/", "layout");
  revalidatePath(`/${page.slug}`);
  return NextResponse.json({ ok: true, pages: next });
}
