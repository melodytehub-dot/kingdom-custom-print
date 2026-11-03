/** Read request input with a hard cap, including when Content-Length is absent. */
async function limitedBody(request: Request, limit: number): Promise<Blob> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > limit) throw new RangeError("Request too large");
  if (!request.body) throw new Error("Missing request body");
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new RangeError("Request too large"); }
      chunks.push(new Uint8Array(value));
    }
  } finally { reader.releaseLock(); }
  return new Blob(chunks);
}

export async function limitedJson(request: Request, limit: number): Promise<unknown> {
  return JSON.parse(await (await limitedBody(request, limit)).text());
}

/** Preserve the raw UTF-8 text used for webhook signature verification. */
export async function limitedText(request: Request, limit: number): Promise<string> {
  return (await limitedBody(request, limit)).text();
}

export async function limitedFormData(request: Request, limit: number): Promise<FormData> {
  const body = await limitedBody(request, limit);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return new Request(request.url, { method: "POST", headers, body }).formData();
}
