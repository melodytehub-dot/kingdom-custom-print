/**
 * Unit checks for the words around background removal (lib/cutoutActions.ts).
 *
 * This module is the visible half of the feature: what is happening while it
 * works and whether it worked. The copy stays outcome-focused and
 * customer-facing (client-ready-ux: no model, provider or implementation
 * talk), so every string is pinned here, and the checks also fail if
 * implementation language creeps back in.
 *
 * No browser, no network, no models.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, dependencies, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, ...globals, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } }, { filename: file });
  return exports;
}

const models = load("lib/cutoutModels.ts", {});
const cutoutActions = load("lib/cutoutActions.ts", {
  "@/lib/cutoutModels": models,
});
const { canAutoRunDetailedModel, cutoutNotice, cutoutStatus, hostedCutoutStatus } = cutoutActions;

let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

/* ---- 1. Who is allowed to run the 42 MB model on its own --------------- */

{
  const desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
  const ipad = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
  const caseFor = (userAgent) => {
    const scope = load("lib/cutoutActions.ts", { "@/lib/cutoutModels": models }, { navigator: { userAgent } });
    return scope.canAutoRunDetailedModel();
  };
  check("desktop browsers may run the detailed model", caseFor(desktop) === true);
  check("Macs may run the detailed model", caseFor(mac) === true);
  check("Android phones may not", caseFor(android) === false);
  check("iPhones may not", caseFor(iphone) === false);
  check("iPads may not", caseFor(ipad) === false);
  check("a server render (no navigator) may not", canAutoRunDetailedModel() === false);
}

/* ---- 2. Progress copy --------------------------------------------------- */

{
  const { PORTRAIT_MODEL, GENERAL_MODEL } = models;
  const portrait = cutoutStatus({ phase: "download", percent: 42, attempt: 1, model: PORTRAIT_MODEL });
  check(
    "a download says it is a one-time step, not which model it is",
    portrait === "Preparing background removal… 42% (downloads once).",
    portrait,
  );
  const general = cutoutStatus({ phase: "download", percent: 7, attempt: 2, model: GENERAL_MODEL });
  check(
    "the slower download warns that it takes longer",
    general === "Preparing background removal… 7% (downloads once). This one takes longer.",
    general,
  );
  const working = cutoutStatus({ phase: "processing", attempt: 1, model: PORTRAIT_MODEL });
  check("while it works it just says what is happening", working === "Removing background…", working);

  const sending = hostedCutoutStatus("upload");
  check("the off-device trip starts by preparing the photo", sending === "Preparing your photo…", sending);
  const cutting = hostedCutoutStatus("cutting");
  check("then says the background is being removed", cutting === "Removing background…", cutting);
  const waiting = hostedCutoutStatus("waiting");
  check(
    "a slow render says a large photo can take a minute",
    /large photo can take up to a minute/i.test(waiting),
    waiting,
  );

  // The customer never sees how the sausage is made.
  const all = [portrait, general, working, sending, cutting, waiting];
  check(
    "no progress line leaks implementation",
    all.every((line) => !/\bAI\b|\bmodel\b|\bhosted\b|imgix|endpoint|wasm|webassembly/i.test(line)),
    all.join(" | "),
  );
}

/* ---- 3. What the customer is told -------------------------------------- */

{
  const notice = (failure, hasCutout, removeBg = true) => cutoutNotice({ removeBg, failure, hasCutout });
  const says = (result, pattern) => result.tone === "warn" && pattern.test(result.text);

  const off = notice(null, false, false);
  check("turning it off says the background is back", off.tone === "ok" && /original background restored/i.test(off.text));
  const clean = notice(null, true);
  check("a clean cut-out says so", clean.tone === "ok" && /^background removed\.$/i.test(clean.text), clean.text);
  check(
    "nothing to remove suggests a plainer photo",
    says(notice(null, false), /could not detect a background/i) && /plainer background/i.test(notice(null, false).text),
    notice(null, false).text,
  );
  check(
    "a rejected mask with a fallback stays honest about the edges",
    says(notice("no-subject", true), /could not make out a clear subject/i) &&
      /check the edges/i.test(notice("no-subject", true).text),
    notice("no-subject", true).text,
  );
  check(
    "no subject at all suggests a plainer photo",
    says(notice("no-subject", false), /could not find a subject/i) &&
      /plainer background/i.test(notice("no-subject", false).text),
    notice("no-subject", false).text,
  );
  check(
    "an unreachable tool says the connection matters",
    says(notice("unavailable", false), /could not load/i) && /connection/i.test(notice("unavailable", false).text),
    notice("unavailable", false).text,
  );
  check(
    "an unreachable tool with a fallback says the cut-out is simpler",
    says(notice("unavailable", true), /simpler cut-out/i) && /connection/i.test(notice("unavailable", true).text),
    notice("unavailable", true).text,
  );

  // A warning must never be dressed as an error: errors are for exceptions.
  const tones = [off, clean, notice(null, false), notice("no-subject", true), notice("no-subject", false), notice("unavailable", true), notice("unavailable", false)];
  check("no outcome is reported as an error", tones.every((entry) => entry.tone === "ok" || entry.tone === "warn"), tones.map((entry) => entry.tone).join(","));
  check("every message is a finished sentence", tones.every((entry) => entry.text.endsWith(".")), tones.map((entry) => entry.text).join(" | "));
  check(
    "no outcome leaks implementation or provider names",
    tones.every((entry) => !/\bAI\b|\bmodel\b|\bhosted\b|imgix|endpoint|select object|detailed/i.test(entry.text)),
    tones.map((entry) => entry.text).join(" | "),
  );
}

/* ---- 4. One control only ------------------------------------------------ */

{
  // The editor offers exactly one background-removal control: the switch in
  // editors.tsx. The old "Select Object" tab and the model-upgrade offer
  // buttons are gone for good — this module must not grow them back.
  check(
    "no offer-button helper exists any more",
    cutoutActions.cutoutActionFor === undefined,
    typeof cutoutActions.cutoutActionFor,
  );
}

if (failures > 0) {
  console.log(`${failures} cut-out action check(s) failed`);
  process.exit(1);
}
console.log("ALL CUT-OUT ACTION CHECKS PASSED");
