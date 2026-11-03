import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

for (const resource of ['products', 'categories']) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(`app/api/admin/${resource}/route.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const deps = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    'next/cache': { revalidatePath: () => { throw new Error('Unexpected revalidation'); } },
    '../_guard': { requireAdmin: async () => null },
    '@/lib/catalog': {},
  };
  vm.runInNewContext(source, { exports, require: name => deps[name], URL });
  for (const method of resource === 'products' ? ['POST', 'PUT', 'PATCH'] : ['POST', 'PUT']) {
    for (const body of ['null', '[]', '"text"', '42']) {
      const request = new Request(`https://example.test/api/admin/${resource}`, { method, headers: { 'content-type': 'application/json' }, body });
      const result = await exports[method](request);
      assert.equal(result.status, 400, `${resource} ${method} ${body}`);
    }
  }
  if (resource === 'products') {
    const valid = { name: 'Fixture', kind: 'tee', basePrice: 10, colors: [{ slug: 'black', name: 'Black', hex: '#000000' }], sizes: [{ label: 'M' }] };
    for (const invalid of [{ colors: [{ slug: 'black', name: 1, hex: '#000000' }] }, { sizes: {} }, { priceBreaks: {} }]) {
      const result = await exports.POST(new Request('https://example.test/api/admin/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...valid, ...invalid }) }));
      assert.equal(result.status, 422);
    }
  }
}
console.log('PASS: malformed product and category requests are rejected without modifying data');
