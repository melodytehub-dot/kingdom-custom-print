/**
 * Cutout model lab (measurement harness, not a pass/fail test).
 *
 * Runs real background-removal models in a real browser against real photos and
 * reports, per model:
 *   - cold load time (download + session build) and inference time (cold + warm)
 *   - mask metrics (background cleared, subject kept, soft-edge share)
 *   - a PNG of the cutout and a PNG of the raw alpha mask, for eyeballing
 *
 * It serves the browser build of @huggingface/transformers straight from
 * node_modules, so it never touches the app. Run it whenever the cutout model
 * needs revisiting:
 *
 *   node scripts/qa-cutout-lab.mjs
 *   CUTOUT_LAB_IMAGES=./photos CUTOUT_LAB_OUT=./out node scripts/qa-cutout-lab.mjs
 *   CUTOUT_LAB_CPU=4 node scripts/qa-cutout-lab.mjs          # slower-CPU emulation
 *   CUTOUT_LAB_PHOTOS=p1005.jpg CUTOUT_LAB_MODELS=modnet-q8 node scripts/qa-cutout-lab.mjs
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import ts from "typescript";

/** Serves the app's own TypeScript modules to the browser, untranspiled-free. */
async function loadTsModule(file) {
  const output = ts.transpileModule(await readFile(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    fileName: file,
  }).outputText;
  return output;
}

const DIST = path.resolve("node_modules/@huggingface/transformers/dist");
const ORT = path.resolve("node_modules/onnxruntime-web/dist");
const ORT_COMMON = path.resolve("node_modules/onnxruntime-common/dist");
const IMAGES = path.resolve(
  process.env.CUTOUT_LAB_IMAGES ?? path.join(os.tmpdir(), "opencode", "cutout"),
);
const OUT = path.resolve(process.env.CUTOUT_LAB_OUT ?? path.join(IMAGES, "lab"));
const CPU = Number(process.env.CUTOUT_LAB_CPU ?? 0);
const BROWSER = process.env.QA_BROWSER ?? "chrome";

/**
 * Everything worth comparing. `AutoModel` is used directly (what production
 * does) because the v4 `background-removal` pipeline does not map every
 * checkpoint family. `runs` keeps the giant models to a single pass.
 */
const ALL_MODELS = [
  { label: "modnet-q8", model: "Xenova/modnet", dtype: "q8", runs: 2 },
  { label: "modnet-q8-384", model: "Xenova/modnet", dtype: "q8", shortestEdge: 384, runs: 2 },
  { label: "modnet-fp32", model: "Xenova/modnet", dtype: "fp32", runs: 2 },
  { label: "rmbg14-q8", model: "briaai/RMBG-1.4", dtype: "q8", runs: 2 },
  { label: "rmbg14-q8-512", model: "briaai/RMBG-1.4", dtype: "q8", sizeCall: { width: 512, height: 512 }, runs: 2 },
  { label: "rmbg14-fp32", model: "briaai/RMBG-1.4", dtype: "fp32", runs: 1 },
  { label: "birefnet-lite-512", model: "studioludens/birefnet-lite-512", dtype: "fp32", runs: 1 },
  { label: "modnet-q8-webgpu", model: "Xenova/modnet", dtype: "fp16", device: "webgpu", runs: 2 },
];

const only = (process.env.CUTOUT_LAB_MODELS ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const MODELS = only.length ? ALL_MODELS.filter((entry) => only.includes(entry.label)) : ALL_MODELS;

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>cutout lab</title>
<script type="importmap">
{"imports":{
  "onnxruntime-web/webgpu":"/ort/ort.webgpu.bundle.min.mjs",
  "onnxruntime-common":"/ortc/esm/index.js",
  "@/lib/":"/app/",
  "@/components/customizer/":"/app/"
}}
</script>
</head>
<body style="margin:0;font:14px system-ui;white-space:pre" id="log"></body>
<script type="module">
import * as T from "/dist/transformers.web.js";
window.T = T;
window.__webgpu = Boolean(navigator.gpu);
window.__labReady = true;
</script>
</html>`;

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGE);
      return;
    }
    if (url.pathname.startsWith("/dist/")) {
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      res.end(await readFile(path.join(DIST, path.basename(url.pathname))));
      return;
    }
    if (url.pathname.startsWith("/ort/") || url.pathname.startsWith("/ortc/")) {
      const base = url.pathname.startsWith("/ort/") ? ORT : ORT_COMMON;
      const file = path.resolve(base, url.pathname.replace(/^\/ortc?\/?/, ""));
      if (!file.startsWith(base)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      res.end(await readFile(file));
      return;
    }
    if (url.pathname.startsWith("/app/")) {
      // Any app module, transpiled on the fly, so the lab measures the real
      // `artworkProfile` / `quickBackgroundRemoval` / `analyseMask` code
      // rather than a copy of it that can drift.
      const name = path.basename(url.pathname, ".js");
      if (!/^[\w.-]+$/.test(name)) {
        res.writeHead(400).end("bad module name");
        return;
      }
      for (const dir of ["lib", path.join("components", "customizer")]) {
        for (const extension of [".ts", ".tsx"]) {
          const file = path.join(dir, `${name}${extension}`);
          if (existsSync(file)) {
            res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
            res.end(await loadTsModule(file));
            return;
          }
        }
      }
      res.writeHead(404).end(`no module ${name}`);
      return;
    }
    if (url.pathname.startsWith("/img/")) {
      const file = path.join(IMAGES, path.basename(url.pathname));
      res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
      res.end(await readFile(file));
      return;
    }
    res.writeHead(404).end("not found");
  } catch (error) {
    res.writeHead(500).end(String(error?.message ?? error));
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const photos = (process.env.CUTOUT_LAB_PHOTOS ?? "p1005.jpg,p91.jpg,p30.jpg")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

/** Flat artwork drawn in the page, so the "is it artwork or a photo?" gate is measurable. */
const SYNTHETIC = [
  {
    label: "logo-on-white",
    draw: `x.fillStyle="#ffffff";x.fillRect(0,0,420,420);x.fillStyle="#c0392b";x.beginPath();x.arc(210,210,130,0,7);x.fill();`,
  },
  {
    label: "logo-on-gradient",
    draw: `const g=x.createLinearGradient(0,0,420,420);g.addColorStop(0,"#ffffff");g.addColorStop(1,"#c8ccd2");x.fillStyle=g;x.fillRect(0,0,420,420);x.fillStyle="#1b2a4a";x.beginPath();x.arc(210,210,130,0,7);x.fill();`,
  },
  {
    label: "wordmark",
    draw: `x.fillStyle="#ffffff";x.fillRect(0,0,420,420);x.fillStyle="#101820";x.font="bold 58px sans-serif";x.textAlign="center";x.fillText("KINGDOM",210,170);x.font="bold 40px sans-serif";x.fillText("CUSTOM PRINT",210,240);x.fillRect(90,270,240,8);`,
  },
  {
    label: "sticker-shaded",
    draw: `x.fillStyle="#fdfdfd";x.fillRect(0,0,420,420);const g=x.createRadialGradient(170,160,10,210,210,160);g.addColorStop(0,"#ffd479");g.addColorStop(1,"#e0762a");x.fillStyle=g;x.beginPath();x.arc(210,210,130,0,7);x.fill();x.strokeStyle="#2b1a0d";x.lineWidth=7;x.beginPath();x.arc(210,210,130,0,7);x.stroke();`,
  },
];

const PHASE = process.env.CUTOUT_LAB_PHASE ?? "models";

/** Measures one photo with the instant, download-free cut-out. */
async function measureInstant(context, item, synthetic) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(ORIGIN, { waitUntil: "load" });
  await page.waitForFunction(() => window.__labReady === true);
  const src = synthetic
    ? await page.evaluate((draw) => {
        const canvas = document.createElement("canvas");
        canvas.width = 420;
        canvas.height = 420;
        // eslint-disable-next-line no-new-func
        new Function("x", draw)(canvas.getContext("2d"));
        return canvas.toDataURL("image/png");
      }, item.draw)
    : item.src;
  let result;
  try {
    result = await page.evaluate(runInstantInPage, { src });
  } catch (error) {
    result = { error: String(error?.message ?? error) };
  }
  await page.close();
  const name = `instant__${item.label}`;
  if (result.error) {
    console.log(`FAIL ${name} — ${result.error}${errors.length ? ` [${errors.join(" | ")}]` : ""}`);
    return;
  }
  if (result.cutout) {
    await writeFile(path.join(OUT, `${name}.png`), Buffer.from(result.cutout.split(",")[1], "base64"));
    await writeFile(path.join(OUT, `${name}.mask.png`), Buffer.from(result.mask.split(",")[1], "base64"));
  }
  rows.push({ name, ...result, cutout: undefined, mask: undefined });
  console.log(
    `PASS ${name.padEnd(30)} texture ${String(result.texture).padStart(5)}` +
      ` flat ${String(result.flatShare).padStart(5)} edges ${String(result.edges).padStart(5)}` +
      ` => ${result.flat ? "artwork" : "photo  "} (${result.limits})` +
      ` ${String(result.elapsed).padStart(5)}ms confident ${String(result.confident).padEnd(5)}` +
      (result.cutout
        ? ` border ${String(result.borderClear).padStart(5)}` +
          ` cleared ${String(result.cleared).padStart(5)}% holes ${String(result.holes).padStart(4)}%` +
          ` rows ${result.topRow}/${result.middleRow}/${result.bottomRow} => ${result.verdict}`
        : ""),
  );
}

/** Runs one model against one photo inside the page. Mirrors production. */
async function runInPage(config) {
  const T = window.T;
  const started = performance.now();
  let model;
  try {
    model = await T.AutoModel.from_pretrained(config.model, {
      device: config.device ?? "wasm",
      dtype: config.dtype,
    });
  } catch (error) {
    return { error: `load: ${String(error?.message ?? error)}` };
  }
  const processor = await T.AutoProcessor.from_pretrained(config.model);
  if (config.shortestEdge && processor.image_processor?.size) {
    processor.image_processor.size = { shortest_edge: config.shortestEdge };
  }
  if (config.size && processor.image_processor?.size) {
    processor.image_processor.size = { ...config.size };
  }
  const loaded = Math.round(performance.now() - started);

  const source = await T.RawImage.read(config.src);
  const session = model.sessions?.model ?? Object.values(model.sessions ?? {})[0];
  const inputNames = session?.inputNames ?? [];
  const outputNames = session?.outputNames ?? [];

  const run = async () => {
    const image = config.maxEdge && Math.max(source.width, source.height) > config.maxEdge
      ? await source.resize(
          Math.max(1, Math.round(source.width * (config.maxEdge / Math.max(source.width, source.height)))),
          Math.max(1, Math.round(source.height * (config.maxEdge / Math.max(source.width, source.height)))),
          { resample: "bilinear" },
        )
      : source;
    const inputs = await processor(image, config.sizeCall ? { size: config.sizeCall } : undefined);
    const feed = {};
    for (const name of inputNames) {
      feed[name] = inputs[name] ?? inputs.pixel_values ?? Object.values(inputs)[0];
    }
    const tensorDims = (inputs.pixel_values ?? Object.values(inputs)[0])?.dims ?? null;
    const output = await model(feed);
    const key = outputNames[0] ?? Object.keys(output)[0];
    let logits = output[key];
    if (!logits) throw new Error(`no output (${Object.keys(output).join(",")})`);
    if (!logits.dims) logits = logits.output_image ?? logits.output;
    const flat = logits.data;
    let needsSigmoid = false;
    for (let i = 0; i < flat.length; i += 97) {
      if (flat[i] < -0.00001 || flat[i] > 1.00001) {
        needsSigmoid = true;
        break;
      }
    }
    if (needsSigmoid) logits = logits.sigmoid();
    const mask = await T.RawImage.fromTensor(logits[0].mul(255).to("uint8")).resize(image.width, image.height, {
      resample: "bilinear",
    });
    const rgba = image.clone();
    rgba.putAlpha(mask);
    return { rgba, info: { inputNames, outputNames, sigmoid: needsSigmoid, inW: image.width, inH: image.height, tensorDims } };
  };

  const timings = [];
  let result;
  for (let i = 0; i < config.runs; i += 1) {
    const t1 = performance.now();
    result = await run();
    timings.push(Math.round(performance.now() - t1));
  }

  const toPng = (image, alphaOnly) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    const rgba = new Uint8ClampedArray(image.data);
    if (alphaOnly) {
      for (let i = 0; i < rgba.length; i += 4) {
        const a = rgba[i + 3];
        rgba[i] = a;
        rgba[i + 1] = a;
        rgba[i + 2] = a;
        rgba[i + 3] = 255;
      }
    }
    context.putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
    return canvas.toDataURL("image/png");
  };

  const rgba = new Uint8ClampedArray(result.rgba.data);
  const w = result.rgba.width;
  const h = result.rgba.height;
  const alpha = (x, y) => rgba[(y * w + x) * 4 + 3];

  // The exact analyser production uses to decide whether a mask is trustworthy.
  const { analyseMask, maskIsUsable } = await import("/app/cutoutMask.js");
  const alphaOnly = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) alphaOnly[p] = rgba[p * 4 + 3];
  const report = analyseMask(alphaOnly, w, h, new Uint8Array(rgba.buffer.slice(0)));

  let clear = 0;
  let solid = 0;
  let soft = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    const a = rgba[i];
    if (a <= 8) clear += 1;
    else if (a >= 247) solid += 1;
    else soft += 1;
  }
  let border = 0;
  let borderClear = 0;
  const tally = (x, y) => {
    border += 1;
    if (alpha(x, y) <= 8) borderClear += 1;
  };
  for (let x = 0; x < w; x += 1) {
    tally(x, 0);
    tally(x, 1);
    tally(x, h - 2);
    tally(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    tally(0, y);
    tally(1, y);
    tally(w - 2, y);
    tally(w - 1, y);
  }

  return {
    loaded,
    infer: timings[0],
    inferWarm: timings[timings.length - 1],
    width: w,
    height: h,
    input: result.info,
    verdict: maskIsUsable(report) ? "accept" : `reject:${report.reject}`,
    holes: +(100 * report.holes).toFixed(1),
    cleared: +((100 * clear) / (w * h)).toFixed(1),
    solid: +((100 * solid) / (w * h)).toFixed(1),
    soft: +((100 * soft) / (w * h)).toFixed(1),
    borderClear: +(borderClear / border).toFixed(3),
    center: alpha(Math.floor(w / 2), Math.floor(h / 2)),
    corners: [alpha(2, 2), alpha(w - 3, 2), alpha(2, h - 3), alpha(w - 3, h - 3)],
    cutout: toPng(result.rgba, false),
    mask: toPng(result.rgba, true),
  };
}

/**
 * Measures the instant, download-free cut-out (lib/imageFx.ts) on the same
 * photo: how busy the picture is, whether the colour-keying pass believes
 * itself, and — through the production mask analyser — whether it actually cut
 * the subject out or took the subject with the backdrop.
 */
async function runInstantInPage({ src }) {
  const [{ quickBackgroundRemoval, artworkProfile, isFlatArtwork, FLAT_ARTWORK_MIN_FLAT, FLAT_ARTWORK_MAX_EDGES }, { analyseMask, maskIsUsable }] =
    await Promise.all([import("/app/imageFx"), import("/app/cutoutMask")]);
  const started = performance.now();
  const profile = await artworkProfile(src);
  const flat = isFlatArtwork(profile);
  const withProfile = (extra) => ({
    texture: +profile.texture.toFixed(2),
    flatShare: +profile.flat.toFixed(3),
    edges: +profile.edges.toFixed(3),
    limits: `flat>=${FLAT_ARTWORK_MIN_FLAT} edges<=${FLAT_ARTWORK_MAX_EDGES}`,
    flat,
    ...extra,
  });
  let quick = null;
  try {
    quick = await quickBackgroundRemoval(src);
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
  const elapsed = Math.round(performance.now() - started);
  if (!quick) {
    return withProfile({ elapsed, verdict: "no cutout", confident: false });
  }

  // The instant pass encodes a PNG; measure its alpha with the same analyser the
  // worker uses, so "did it take the subject with it?" is an apples-to-apples
  // number rather than an eyeball.
  const image = new Image();
  image.src = quick.dataUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const alpha = new Uint8Array(canvas.width * canvas.height);
  for (let p = 0; p < alpha.length; p++) alpha[p] = rgba[p * 4 + 3];
  const report = analyseMask(alpha, canvas.width, canvas.height);
  const width = canvas.width;
  const height = canvas.height;
  const row = (y) => {
    let kept = 0;
    for (let x = 0; x < width; x++) if (alpha[y * width + x] > 128) kept += 1;
    return +(100 * kept / width).toFixed(1);
  };
  const toPng = (alphaOnly) => {
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = out.getContext("2d");
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
    if (alphaOnly) {
      const data = ctx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        data[i] = a;
        data[i + 1] = a;
        data[i + 2] = a;
        data[i + 3] = 255;
      }
      ctx.putImageData(new ImageData(data, width, height), 0, 0);
    }
    return out.toDataURL("image/png");
  };
  return withProfile({
    elapsed,
    confident: quick.confident,
    borderClear: +quick.borderClear.toFixed(3),
    cleared: +(100 * (1 - report.coverage)).toFixed(1),
    verdict: maskIsUsable(report) ? "accept" : `reject:${report.reject}`,
    holes: +(100 * report.holes).toFixed(1),
    topRow: row(2),
    middleRow: row(Math.floor(height / 2)),
    bottomRow: row(height - 3),
    cutout: toPng(false),
    mask: toPng(true),
  });
}

const browser = await chromium.launch({ channel: BROWSER, headless: true });
const rows = [];
let webgpu = null;
const loadedModels = new Map();

try {
  // One context for every run: the model download happens once per model and
  // later runs report a warm (cached) load, which is what repeat use feels like.
  const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
  // The instant phase measures the download-free pass only, so the model loop
  // below has nothing to run.
  const photosForModels = PHASE === "instant" ? [] : photos;
  if (PHASE === "instant") {
    for (const photo of photos) {
      await measureInstant(context, { label: path.basename(photo, path.extname(photo)), src: `/img/${photo}` }, false);
    }
    for (const artwork of SYNTHETIC) {
      await measureInstant(context, artwork, true);
    }
    await context.close();
  }
  for (const photo of photosForModels) {
    for (const config of MODELS) {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
      });
      if (CPU > 0) {
        const session = await context.newCDPSession(page);
        await session.send("Emulation.setCPUThrottlingRate", { rate: CPU });
      }
      await page.goto(ORIGIN, { waitUntil: "load" });
      await page.waitForFunction(() => window.__labReady === true).catch((error) => {
        console.log(`could not start the page: ${error.message}\n${errors.join("\n")}`);
        throw error;
      });
      webgpu = await page.evaluate(() => window.__webgpu);
      let result;
      try {
        result = await page.evaluate(runInPage, {
          model: config.model,
          dtype: config.dtype,
          device: config.device,
          shortestEdge: config.shortestEdge,
          size: config.size,
          sizeCall: config.sizeCall,
          maxEdge: config.maxEdge,
          runs: config.runs,
          src: `/img/${photo}`,
        });
      } catch (error) {
        result = { error: String(error?.message ?? error) };
      }
      const cache = loadedModels.has(config.model) ? "cached" : "cold";
      loadedModels.set(config.model, true);
      await page.close();
      const name = `${config.label}__${path.basename(photo, path.extname(photo))}`;
      if (result.error || result.loaded === undefined) {
        console.log(`FAIL ${name} — ${result.error ?? "no result"}${errors.length ? ` [${errors.join(" | ")}]` : ""}`);
      } else {
        await writeFile(path.join(OUT, `${name}.png`), Buffer.from(result.cutout.split(",")[1], "base64"));
        await writeFile(path.join(OUT, `${name}.mask.png`), Buffer.from(result.mask.split(",")[1], "base64"));
        rows.push({ name, ...result, cutout: undefined, mask: undefined });
        console.log(
          `PASS ${name.padEnd(38)} load ${String(result.loaded).padStart(6)}ms ${cache.padEnd(6)}` +
            ` infer ${String(result.infer).padStart(6)}ms` +
            ` warm ${String(result.inferWarm).padStart(6)}ms` +
            ` in ${result.input.inW}x${result.input.inH}@${result.input.sigmoid ? "logit" : "prob"}` +
            ` tensor [${(result.input.tensorDims ?? []).join(",")}]` +
            ` cleared ${String(result.cleared).padStart(5)}%` +
            ` soft ${String(result.soft).padStart(5)}%` +
            ` holes ${String(result.holes).padStart(5)}%` +
            ` center ${String(result.center).padStart(3)}` +
            ` => ${result.verdict}`,
        );
      }
    }
  }
  await context.close();
} finally {
  await browser.close();
  server.close();
}

await writeFile(path.join(OUT, "report.json"), JSON.stringify({ cpu: CPU, webgpu, rows }, null, 2));
console.log(`\nwebgpu in browser: ${webgpu}`);
console.log(`wrote ${rows.length} result(s) to ${OUT}`);
console.log("Open the *.png files: <name>.png is the cutout, <name>.mask.png is the raw alpha mask.");
