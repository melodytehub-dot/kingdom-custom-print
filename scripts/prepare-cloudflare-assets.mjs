import { appendFile, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const assetsDir = path.resolve(
  ".cloudflare/output/v0/workers/default/assets",
);
const ignoreFile = path.join(assetsDir, ".assetsignore");
const ignoredWasm = "**/ort-wasm-simd-threaded.asyncify*.wasm";

let existing = "";
try {
  existing = await readFile(ignoreFile, "utf8");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

if (!existing.split(/\r?\n/).includes(ignoredWasm)) {
  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await appendFile(ignoreFile, `${separator}${ignoredWasm}\n`);
}

// Fail the build if the ONNX asset name or output structure changes and the
// generated worker payload would still contain an over-limit static WASM file.
const matches = (await readdir(assetsDir, { recursive: true }))
  .filter((entry) =>
    /(?:^|[\\/])ort-wasm-simd-threaded\.asyncify[^\\/]*\.wasm$/.test(entry),
  )
  .map((entry) => path.join(assetsDir, entry));

if (matches.length === 0) {
  throw new Error(
    "Expected the bundled ONNX asyncify WASM in Cloudflare assets; review the asset ignore rule before deploying.",
  );
}

const detail = await Promise.all(
  matches.map(async (file) => ({ file, size: (await stat(file)).size })),
);
for (const asset of detail) {
  if (asset.size <= 25 * 1024 * 1024) {
    throw new Error(
      `Expected ${asset.file} to exceed Cloudflare's asset limit; remove or revisit the ignore rule if the bundle changed.`,
    );
  }
}
console.log(
  `Cloudflare asset ignore configured for ${matches.length} ONNX asyncify WASM asset(s).`,
);
