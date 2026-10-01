// Confirms the checkout API ignores client-supplied money and uses catalogue pricing.
const BASE = process.env.QA_BASE ?? "http://localhost:3000";

const post = async (body) => {
  const r = await fetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json() };
};

const contact = {
  email: "qa-price@example.com",
  name: "QA Price Check",
  addressLine1: "1 Test Street",
  city: "Austin",
  region: "TX",
  postal: "78701",
  country: "US",
};

const cartItem = (overrides) => ({
  productId: 1,
  productName: "TOTALLY FAKE NAME",
  productKind: "tee",
  colorName: "Not A Real Colour",
  colorHex: "#00ff00",
  unitPrice: 0.01,
  total: 0.01,
  quantity: 1,
  lines: [{ label: "S", qty: 1 }],
  design: { front: [{ type: "text", text: "QA", x: 50, y: 50, scale: 1, rotation: 0 }], back: [] },
  ...overrides,
});

// 1. Honest order, single small size, front-only design.
const honest = await post({ ...contact, items: [cartItem({})] });
console.log("honest single  ->", honest.status, honest.json);

// 2. Tampered: 1-cent total, fake product name, invalid colour and size.
const tampered = await post({
  ...contact,
  items: [
    cartItem({
      unitPrice: 0.01,
      total: 0.01,
      lines: [{ label: "XXXL", qty: 1 }],
      colorName: "Neon Lava",
    }),
  ],
});
console.log("tampered size  ->", tampered.status, tampered.json);

// 3. Quantity mismatch between lines and the quantity field.
const mismatch = await post({
  ...contact,
  items: [cartItem({ quantity: 999, lines: [{ label: "M", qty: 2 }] })],
});
console.log("qty mismatch   ->", mismatch.status, mismatch.json);

console.log("\nreferences:", [honest, tampered, mismatch].map((r) => r.json?.reference).filter(Boolean));
