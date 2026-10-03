import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { createCategory, deleteCategory, updateCategory, type CategoryInput } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function validate(raw: Record<string, unknown>): { value?: CategoryInput; error?: string } {
  const name = String(raw.name ?? "").trim().slice(0, 80);
  if (name.length < 2) return { error: "Give the category a name." };
  const slug = slugify(String(raw.slug || name));
  if (!slug || !SLUG_RE.test(slug)) return { error: "The category slug is not valid." };
  const sortOrder = Math.max(0, Math.min(9999, Math.floor(Number(raw.sortOrder) || 0)));
  return {
    value: {
      name,
      slug,
      description: String(raw.description ?? "").trim().slice(0, 240),
      sortOrder,
    },
  };
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let raw: Record<string, unknown>;
  try { raw = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { value, error } = validate(raw);
  if (!value) return NextResponse.json({ error }, { status: 422 });
  try { return NextResponse.json({ ok: true, id: await createCategory(value) }); }
  catch (err) {
    return NextResponse.json({ error: err instanceof Error && err.message.includes("duplicate") ? "That category slug is already used." : "The category could not be saved." }, { status: 409 });
  }
}

export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let raw: Record<string, unknown>;
  try { raw = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = Number(raw.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Missing category id." }, { status: 422 });
  const { value, error } = validate(raw);
  if (!value) return NextResponse.json({ error }, { status: 422 });
  try {
    const ok = await updateCategory(id, value);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Category not found." }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error && err.message.includes("duplicate") ? "That category slug is already used." : "The category could not be saved." }, { status: 409 });
  }
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Missing category id." }, { status: 422 });
  const ok = await deleteCategory(id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Category not found." }, { status: 404 });
}
