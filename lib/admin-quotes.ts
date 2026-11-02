export type QuoteLine = { description: string; quantity: number; unitCents: number };
export type AdminQuote = { id: string; customer_name: string; customer_email: string; notes: string; lines: QuoteLine[]; shipping_cents: number; status: "quote" | "invoice"; created_at: string; invoiced_at: string | null; payment_state?: string | null; payment_provider?: "stripe" | "paypal" | null };

export function validateQuote(input: unknown): { value?: { name: string; email: string; notes: string; lines: QuoteLine[]; shippingCents: number }; error?: string } {
  if (!input || typeof input !== "object") return { error: "Enter the quote details." };
  const raw = input as Record<string, unknown>;
  const name = String(raw.name ?? "").trim().slice(0, 120);
  const email = String(raw.email ?? "").trim().toLowerCase().slice(0, 254);
  const notes = String(raw.notes ?? "").trim().slice(0, 2000);
  if (!name) return { error: "Enter the customer's name." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!Array.isArray(raw.lines) || !raw.lines.length || raw.lines.length > 50) return { error: "Add between 1 and 50 items." };
  const lines: QuoteLine[] = [];
  for (const entry of raw.lines) {
    if (!entry || typeof entry !== "object") return { error: "Check the items." };
    const row = entry as Record<string, unknown>;
    const description = String(row.description ?? "").trim().slice(0, 200);
    const quantity = row.quantity, unitCents = row.unitCents;
    if (typeof quantity !== "number" || typeof unitCents !== "number") return { error: "Enter a description, quantity, and valid price for each item." };
    if (!description || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000 || !Number.isSafeInteger(unitCents) || unitCents < 0 || unitCents > 10000000) return { error: "Enter a description, quantity, and valid price for each item." };
    lines.push({ description, quantity, unitCents });
  }
  const shippingCents = raw.shippingCents;
  if (typeof shippingCents !== "number" || !Number.isSafeInteger(shippingCents) || shippingCents < 0 || shippingCents > 10000000) return { error: "Enter a valid shipping amount." };
  return { value: { name, email, notes, lines, shippingCents } };
}
