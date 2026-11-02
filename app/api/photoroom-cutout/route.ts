import { NextResponse } from "next/server";
import { authAttemptAllowed, sameOrigin } from "@/lib/customer-auth";
import { limitedFormData } from "@/lib/limited-form-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pass-through for the Photoroom comparison engine.
 *
 * The API key must never reach the browser, so the editor posts the prepared
 * photo here and this route calls the service with the key from the server
 * environment. Only reachable at all when `PHOTOROOM_API_KEY` is configured
 * (evaluation builds); production keeps imgix untouched.
 *
 * `PHOTOROOM_API_URL` overrides the service base for hermetic tests.
 */
const MAX_BYTES = 4_000_000;
const CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const UPSTREAM_TIMEOUT_MS = 55_000;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  const key = (process.env.PHOTOROOM_API_KEY ?? "").trim();
  if (!key) {
    return NextResponse.json(
      { error: "Background removal is not configured." },
      { status: 503 },
    );
  }

  try {
    if (!(await authAttemptAllowed(request, "__photoroom_cutout__", 30))) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  } catch { return NextResponse.json({ error: "Background removal is temporarily unavailable." }, { status: 503 }); }

  let form: FormData;
  try {
    form = await limitedFormData(request, MAX_BYTES + 65_536);
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: "That photo is too large." }, { status: 413 });
    return NextResponse.json({ error: "Send the photo as form data." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo was sent." }, { status: 400 });
  }
  const contentType = file.type || "image/jpeg";
  if (!CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: "That file type cannot be cut out." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too large." }, { status: 413 });
  }

  const base = (process.env.PHOTOROOM_API_URL ?? "https://sdk.photoroom.com").replace(/\/+$/, "");
  const upstream = new FormData();
  upstream.append("image_file", file, file.name || "photo.jpg");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${base}/v1/segment`, {
      method: "POST",
      headers: { "x-api-key": key },
      body: upstream,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "The remover could not be reached." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // The upstream body can carry account details; keep it out of the
    // response and leave a one-line trace for the server log instead.
    console.error(`photoroom-cutout: upstream answered ${response.status}`);
    return NextResponse.json(
      { error: `The remover answered with ${response.status}.` },
      { status: 502 },
    );
  }

  const bytes = await response.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "content-type": response.headers.get("content-type") ?? "image/png",
      "cache-control": "no-store",
    },
  });
}
