/**
 * Unit checks for the words and buttons around background removal
 * (lib/cutoutActions.ts).
 *
 * This module is the visible half of the feature: which model ran, whether it
 * worked, and what the customer is offered next. The matrix is small but it is
 * exactly where "it just cropped out all the picture" was reported, so every
 * case is pinned here — including the one that used to be a dead end (a photo
 * where nothing was cut out at all left the customer with no way to retry).
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
const { canAutoRunDetailedModel, cutoutActionFor, cutoutNotice, cutoutStatus, hostedCutoutStatus } = load("lib/cutoutActions.ts", {
  "@/lib/cutoutModels": models,
});

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
  check("a portrait download names the model, its size and that it is once", portrait === "Downloading the portrait model… 42% (6.3 MB, downloads once).", portrait);
  const general = cutoutStatus({ phase: "download", percent: 7, attempt: 2, model: GENERAL_MODEL });
  check("the detailed download warns that it is slower", general === "Downloading the detailed model… 7% (42 MB, downloads once). This one is slower.", general);
  const working = cutoutStatus({ phase: "processing", attempt: 1, model: PORTRAIT_MODEL });
  check("while it works it says which model is working", working === "Cutting out the subject with the portrait model…", working);

  const sending = hostedCutoutStatus("upload");
  check("the hosted trip says the photo is being sent", sending === "Sending the photo to the hosted AI…", sending);
  const cutting = hostedCutoutStatus("cutting");
  check("then that the hosted AI is working", cutting === "The hosted AI is cutting out the subject…", cutting);
  const waiting = hostedCutoutStatus("waiting");
  check(
    "a slow hosted render says a new photo can take a minute",
    /still working/i.test(waiting) && /minute/i.test(waiting),
    waiting,
  );
}

/* ---- 3. What the customer is told -------------------------------------- */

{
  const notice = (failure, hasCutout, removeBg = true) => cutoutNotice({ removeBg, failure, hasCutout });
  const says = (result, pattern) => result.tone === "warn" && pattern.test(result.text);

  check("turning it off says the background is back", notice(null, false, false).tone === "ok" && /original background restored/i.test(notice(null, false, false).text));
  check("a clean cut-out says so", notice(null, true).tone === "ok" && /^background removed\.$/i.test(notice(null, true).text));
  check(
    "nothing to remove points at Select Object",
    says(notice(null, false), /could not detect a background/i) && /select object/i.test(notice(null, false).text),
    notice(null, false).text,
  );
  check(
    "a rejected mask with a fallback keeps the fast cut-out and says so",
    says(notice("no-subject", true), /fast cut-out is applied/i),
    notice("no-subject", true).text,
  );
  check(
    "no subject at all points at Select Object by name",
    says(notice("no-subject", false), /could not find a subject/i) && /select object/i.test(notice("no-subject", false).text),
    notice("no-subject", false).text,
  );
  check(
    "an unreachable model says the connection matters",
    says(notice("unavailable", false), /model could not load/i) && /connection/i.test(notice("unavailable", false).text),
    notice("unavailable", false).text,
  );
  check(
    "an unreachable model with a fallback says which cut-out was used",
    says(notice("unavailable", true), /fast cut-out/i),
    notice("unavailable", true).text,
  );

  // The hosted remover's two honest endings: it did the work, or the on-device
  // fallback did — and the customer is told which.
  const hostedUsed = cutoutNotice({ removeBg: true, failure: null, hasCutout: true, hosted: "used" });
  check(
    "a hosted cut-out says the hosted AI did it",
    hostedUsed.tone === "ok" && /hosted ai/i.test(hostedUsed.text),
    hostedUsed.text,
  );
  const hostedFallback = cutoutNotice({ removeBg: true, failure: null, hasCutout: true, hosted: "fell-back" });
  check(
    "a hosted failure that fell back to the device says so",
    hostedFallback.tone === "warn" && /on this device/i.test(hostedFallback.text) && /hosted ai did not answer/i.test(hostedFallback.text),
    hostedFallback.text,
  );
  check(
    "a hopeless photo keeps the more useful failure message",
    /could not find a subject/i.test(
      cutoutNotice({ removeBg: true, failure: "no-subject", hasCutout: false, hosted: "fell-back" }).text,
    ),
  );

  // A warning must never be dressed as an error: errors are for exceptions.
  const tones = [notice(null, true), notice(null, false), notice("no-subject", true), notice("no-subject", false), notice("unavailable", true), notice("unavailable", false), hostedUsed, hostedFallback];
  check("no outcome is reported as an error", tones.every((entry) => entry.tone === "ok" || entry.tone === "warn"), tones.map((entry) => entry.tone).join(","));
  check("every message is a finished sentence", tones.every((entry) => entry.text.endsWith(".")), tones.map((entry) => entry.text).join(" | "));
}

/* ---- 4. The button offered in the artwork editor ------------------------ */

{
  const ran = [];
  const onRun = (layer) => ran.push(layer);
  const actionFor = (fields) => cutoutActionFor({ fx: { removeBg: true, ...fields.fx }, cutoutSource: fields.cutoutSource }, onRun);

  const fresh = cutoutActionFor({ id: "fresh" }, onRun);
  check("a plain image offers the AI cut-out", fresh?.label === "Remove Background with AI", fresh?.label ?? "none");
  const quick = actionFor({ cutoutSource: "quick" });
  check("a fast cut-out offers the AI upgrade", quick?.label === "Improve Cut-out with AI", quick?.label ?? "none");
  const manual = actionFor({ cutoutSource: "manual" });
  check("a hand-made selection offers the AI too", manual?.label === "Improve Cut-out with AI", manual?.label ?? "none");
  const portrait = actionFor({ cutoutSource: "portrait" });
  check("after the portrait model, the detailed model is offered", portrait?.label === "Try the Detailed Model", portrait?.label ?? "none");
  const general = actionFor({ cutoutSource: "general" });
  check("after the detailed model there is nothing better to offer", general === undefined, general?.label ?? "nothing");
  const hosted = actionFor({ cutoutSource: "hosted" });
  check("after the hosted remover there is nothing better to offer", hosted === undefined, hosted?.label ?? "nothing");
  const failed = actionFor({});
  check("removal on but nothing cut out still offers a retry", failed?.label === "Try the AI Cut-out Again", failed?.label ?? "none");
  const off = actionFor({ fx: { removeBg: false } });
  check("with removal off, it offers to start", off?.label === "Remove Background with AI", off?.label ?? "none");

  const offered = [fresh, quick, manual, portrait, failed, off];
  check("every button has a label and a reason", offered.every((entry) => entry.label.length > 3 && entry.hint.length > 10));
  check(
    "no button promises something the models cannot do",
    offered.every((entry) => !/instant|perfect|always/i.test(`${entry.label} ${entry.hint}`)),
    offered.map((entry) => entry.label).join(" | "),
  );

  const layer = { id: "layer-1", fx: { removeBg: true }, cutoutSource: "quick" };
  const wired = cutoutActionFor(layer, onRun);
  wired.onRun();
  check("the callback receives that exact layer", ran.length === 1 && ran[0] === layer, `ran ${ran.length}`);
}

if (failures > 0) {
  console.log(`${failures} cut-out action check(s) failed`);
  process.exit(1);
}
console.log("ALL CUT-OUT ACTION CHECKS PASSED");
