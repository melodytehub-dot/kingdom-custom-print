"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { removeBackgroundLocally } from "@/lib/backgroundRemoval";
import { canAutoRunDetailedModel, cutoutStatus } from "@/lib/cutoutActions";
import {
  CUTOUT_MAX_EDGE,
  DETAILED_PLAN,
  cutoutPlan,
  type CutoutModelKind,
} from "@/lib/cutoutModels";
import { IMGIX_MODELS, imgixCutoutUrl } from "@/lib/imgixCutout";

interface Sample {
  path: string;
  title: string;
  note: string;
}

/** Non-sensitive stand-ins for customer photos, served from our own site. */
const SAMPLES: Sample[] = [
  { path: "cutout-samples/street-backpack.jpg", title: "Backpack", note: "busy street" },
  { path: "cutout-samples/portrait-flowers.jpg", title: "Flowers", note: "hair wisps" },
  { path: "cutout-samples/portrait-scarf.jpg", title: "Scarf", note: "soft sky" },
  { path: "cutout-samples/torso-camera.jpg", title: "Camera", note: "dark knit" },
  { path: "cutout-samples/mug.jpg", title: "Mug", note: "product shot" },
];

interface Subject {
  kind: "sample" | "upload";
  /** Path on our site that imgix should fetch. */
  path: string;
  /** Local source for the original pane and the on-device models. */
  src: string;
  label: string;
}

type DevicePlan = "auto" | "portrait" | "detailed";

interface ImgixState {
  status: "idle" | "running" | "done" | "error";
  /** Seconds the current run has taken, one decimal. */
  elapsed: number;
  /** Bumped to re-request the same URL (cached re-run). */
  nonce: number;
}

interface DeviceState {
  status: "idle" | "running" | "done" | "error";
  message?: string;
  dataUrl?: string;
  elapsed?: number;
  model?: string;
  bestEffort?: boolean;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file could not be read as an image."));
    image.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("This browser could not prepare the photo.")),
      type,
      quality,
    );
  });
}

/** Shrinks an upload to something sane to throw at both engines. */
async function prepareUpload(file: File): Promise<{ dataUrl: string; blob: Blob }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const maxEdge = 2048;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the photo.");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    if (file.type === "image/png") {
      const png = await toBlob(canvas, "image/png");
      if (png.size <= 3_400_000) return { dataUrl: canvas.toDataURL("image/png"), blob: png };
    }
    let quality = 0.92;
    let jpeg = await toBlob(canvas, "image/jpeg", quality);
    while (jpeg.size > 3_400_000 && quality > 0.55) {
      quality -= 0.1;
      jpeg = await toBlob(canvas, "image/jpeg", quality);
    }
    return { dataUrl: canvas.toDataURL("image/jpeg", quality), blob: jpeg };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatSeconds(value: number): string {
  if (value < 0.2) return "instant (cached)";
  if (value < 10) return `${value.toFixed(1)}s`;
  return `${Math.round(value)}s`;
}

function download(href: string, name: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
}

export default function CutoutCompare() {
  const [domain, setDomain] = useState(() => process.env.NEXT_PUBLIC_IMGIX_SOURCE ?? "");
  const [model, setModel] = useState("");
  const [devicePlan, setDevicePlan] = useState<DevicePlan>("auto");
  const [subject, setSubject] = useState<Subject>(() => ({
    kind: "sample",
    path: SAMPLES[0].path,
    src: `/${SAMPLES[0].path}`,
    label: SAMPLES[0].title,
  }));
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [imgix, setImgix] = useState<ImgixState>({ status: "idle", elapsed: 0, nonce: 0 });
  const [firstRenders, setFirstRenders] = useState<Record<string, number>>({});
  const [device, setDevice] = useState<DeviceState>({ status: "idle" });
  const fileInput = useRef<HTMLInputElement>(null);
  const imgixStart = useRef<number | null>(null);

  const imgixUrl = useMemo(() => {
    if (!domain.trim()) return "";
    try {
      return imgixCutoutUrl(domain, subject.path, model);
    } catch {
      return "";
    }
  }, [domain, model, subject.path]);

  const firstFor = imgixUrl ? firstRenders[imgixUrl] : undefined;

  const safeName = useMemo(() => {
    const base = subject.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return (base || "photo").slice(0, 40);
  }, [subject.label]);

  /* Start the clock each time a new hosted render is requested. */
  useEffect(() => {
    if (!imgixUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImgix((state) =>
        state.status === "idle" ? state : { ...state, status: "idle", elapsed: 0 },
      );
      return;
    }
    imgixStart.current = performance.now();
    setImgix((state) => ({ ...state, status: "running", elapsed: 0 }));
    const timer = window.setInterval(() => {
      if (imgixStart.current === null) return;
      setImgix((state) =>
        state.status === "running"
          ? {
              ...state,
              elapsed: Math.round((performance.now() - (imgixStart.current ?? 0)) / 100) / 10,
            }
          : state,
      );
    }, 200);
    return () => window.clearInterval(timer);
  }, [imgixUrl, imgix.nonce]);

  function onImgixLoad() {
    const started = imgixStart.current;
    const seconds = started === null ? 0 : (performance.now() - started) / 1000;
    if (imgixUrl) {
      setFirstRenders((map) =>
        map[imgixUrl] !== undefined ? map : { ...map, [imgixUrl]: seconds },
      );
    }
    setImgix((state) => ({ ...state, status: "done", elapsed: Math.round(seconds * 10) / 10 }));
  }

  function onImgixError() {
    setImgix((state) => ({ ...state, status: "error" }));
  }

  function selectSubject(next: Subject) {
    setSubject(next);
    setDevice({ status: "idle" });
    setNotice(null);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPreparing(true);
    setNotice(null);
    try {
      const prepared = await prepareUpload(file);
      const form = new FormData();
      form.append("image", prepared.blob, file.name || "photo.jpg");
      const response = await fetch("/api/cutout-bridge", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as
        | { path?: string; error?: string }
        | null;
      if (!response.ok || !payload?.path) {
        throw new Error(payload?.error ?? "The photo could not be parked for the hosted test.");
      }
      selectSubject({
        kind: "upload",
        path: payload.path,
        src: prepared.dataUrl,
        label: file.name || "Your photo",
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That photo could not be prepared.");
    } finally {
      setPreparing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function runOnDevice() {
    setDevice({ status: "running", message: "Preparing the on-device cut-out…" });
    const started = performance.now();
    const plan: CutoutModelKind[] =
      devicePlan === "detailed"
        ? DETAILED_PLAN
        : devicePlan === "portrait"
          ? ["portrait"]
          : cutoutPlan(canAutoRunDetailedModel());
    try {
      const result = await removeBackgroundLocally(subject.src, {
        plan,
        maxEdge: CUTOUT_MAX_EDGE,
        onProgress: (progress) => setDevice({ status: "running", message: cutoutStatus(progress) }),
      });
      setDevice({
        status: "done",
        dataUrl: result.dataUrl,
        elapsed: Math.round((performance.now() - started) / 100) / 10,
        model: result.source === "general" ? "detailed model" : "portrait model",
        bestEffort: Boolean(result.report.reject),
      });
    } catch (error) {
      setDevice({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The cut-out model could not run on this device.",
      });
    }
  }

  async function downloadImgix() {
    if (!imgixUrl) return;
    try {
      const response = await fetch(imgixUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      download(href, `cutout-imgix-${safeName}.png`);
      window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
    } catch {
      window.open(imgixUrl, "_blank", "noopener");
    }
  }

  function downloadDevice() {
    if (device.status !== "done" || !device.dataUrl) return;
    download(device.dataUrl, `cutout-device-${safeName}.png`);
  }

  return (
    <div className="cc-page">
      <header className="cc-head">
        <p className="cc-eyebrow">Evaluation · not linked from the store</p>
        <h1>Background cut-out, side by side</h1>
        <p className="cc-intro">
          Both panes cut the same photo out of its background. <strong>imgix</strong> is the
          paid hosted service — the exact machinery rushordertees runs behind their “Remove
          Background” switch. <strong>On this device</strong> is our engine today: the AI
          models that run inside the browser. Pick a test photo or upload your own; a photo
          from your phone is the most useful test of all.
        </p>
      </header>

      <section className="cc-samples" aria-label="Test photos">
        {SAMPLES.map((sample) => {
          const active = subject.kind === "sample" && subject.path === sample.path;
          return (
            <button
              key={sample.path}
              type="button"
              className={`cc-sample${active ? " is-active" : ""}`}
              onClick={() =>
                selectSubject({
                  kind: "sample",
                  path: sample.path,
                  src: `/${sample.path}`,
                  label: sample.title,
                })
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/${sample.path}`} alt="" />
              <span className="cc-sample-title">{sample.title}</span>
              <span className="cc-sample-note">{sample.note}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`cc-sample cc-sample-upload${subject.kind === "upload" ? " is-active" : ""}`}
          onClick={() => fileInput.current?.click()}
          disabled={preparing}
        >
          <span className="cc-upload-plus" aria-hidden="true">
            +
          </span>
          <span className="cc-sample-title">
            {preparing ? "Preparing…" : subject.kind === "upload" ? subject.label : "Your photo"}
          </span>
          <span className="cc-sample-note">{preparing ? "shrinking it" : "from this device"}</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
      </section>

      <p className="cc-current">
        Testing <strong>{subject.label}</strong>
        {subject.kind === "upload"
          ? " — parked on our own server so imgix can fetch it; deleted within a day."
          : " — a stock photo hosted on our own site."}
      </p>

      <section className="cc-controls" aria-label="Settings">
        <label className="cc-field">
          <span>imgix domain</span>
          <input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="e.g. kingdom-cutout.imgix.net"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label className="cc-field">
          <span>imgix model</span>
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            {IMGIX_MODELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="cc-field">
          <span>On-device model run</span>
          <select
            value={devicePlan}
            onChange={(event) => setDevicePlan(event.target.value as DevicePlan)}
          >
            <option value="auto">Auto — what the editor does</option>
            <option value="portrait">Portrait model only</option>
            <option value="detailed">Detailed model only</option>
          </select>
        </label>
      </section>

      {notice ? (
        <p className="cc-notice" role="alert">
          {notice}
        </p>
      ) : null}

      <section className="cc-grid">
        <article className="cc-pane">
          <h2>Original</h2>
          <div className="cc-body">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={subject.src} alt="The photo, untouched" />
          </div>
          <footer className="cc-meta">
            <span className="cc-badge">untouched</span>
          </footer>
        </article>

        <article className="cc-pane">
          <h2>
            imgix <span className="cc-pane-sub">hosted · what rushordertees uses</span>
          </h2>
          <div className="cc-body cc-checker">
            {!domain.trim() ? (
              <p className="cc-empty">Paste the imgix domain above to switch this pane on.</p>
            ) : imgix.status === "error" ? (
              <p className="cc-empty">
                imgix could not render this one. Check the domain, and that the source&apos;s
                Base URL points at this site.
              </p>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={`${imgixUrl}#${imgix.nonce}`}
                  src={imgixUrl}
                  alt="Background removal rendered by imgix"
                  onLoad={onImgixLoad}
                  onError={onImgixError}
                />
                {imgix.status === "running" ? (
                  <div className="cc-running" role="status">
                    <span className="cc-spinner" />
                    <p>imgix is cutting the subject out…</p>
                  </div>
                ) : null}
              </>
            )}
          </div>
          <footer className="cc-meta">
            <span className="cc-badge">
              {imgix.status === "running"
                ? `rendering… ${imgix.elapsed.toFixed(1)}s`
                : imgix.status === "done"
                  ? formatSeconds(imgix.elapsed)
                  : imgix.status === "error"
                    ? "no answer"
                    : "waiting"}
            </span>
            {imgix.status === "done" && firstFor !== undefined && firstFor - imgix.elapsed > 0.25 ? (
              <span className="cc-note">first render was {formatSeconds(firstFor)}</span>
            ) : null}
            {imgix.status === "running" && imgix.elapsed > 4 ? (
              <span className="cc-hint">
                the first render of a new photo can take up to a minute
              </span>
            ) : null}
            {imgix.status === "done" || imgix.status === "error" ? (
              <span className="cc-actions">
                <button
                  type="button"
                  className="cc-btn ghost"
                  onClick={() => setImgix((state) => ({ ...state, nonce: state.nonce + 1 }))}
                >
                  Run again
                </button>
                {imgix.status === "done" ? (
                  <button type="button" className="cc-btn" onClick={() => void downloadImgix()}>
                    PNG
                  </button>
                ) : null}
              </span>
            ) : null}
          </footer>
        </article>

        <article className="cc-pane">
          <h2>
            On this device <span className="cc-pane-sub">our engine today</span>
          </h2>
          <div className="cc-body cc-checker">
            {device.status === "done" && device.dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={device.dataUrl} alt="Background removal produced on this device" />
            ) : device.status === "running" || device.status === "error" ? (
              <p className="cc-empty">{device.message}</p>
            ) : (
              <p className="cc-empty">
                The models run inside this browser — the photo never leaves this device. Press
                the button to compare (the auto run downloads 6 MB; the detailed model 42 MB).
              </p>
            )}
          </div>
          <footer className="cc-meta">
            {device.status === "done" ? (
              <>
                <span className="cc-badge ok">
                  {device.model} · {formatSeconds(device.elapsed ?? 0)}
                </span>
                {device.bestEffort ? <span className="cc-badge warn">best effort</span> : null}
                <span className="cc-actions">
                  <button type="button" className="cc-btn ghost" onClick={downloadDevice}>
                    PNG
                  </button>
                </span>
              </>
            ) : null}
            <button
              type="button"
              className={`cc-btn${device.status === "done" ? " ghost" : ""}`}
              onClick={() => void runOnDevice()}
              disabled={device.status === "running"}
            >
              {device.status === "running"
                ? "Working…"
                : device.status === "done"
                  ? "Run again"
                  : "Run on this device"}
            </button>
          </footer>
        </article>
      </section>

      <details className="cc-notes">
        <summary>How to read this test</summary>
        <ul>
          <li>
            <strong>Middle pane — imgix.</strong> imgix fetches the photo from our own site,
            cuts the subject out on their servers with the model you picked (the default is
            Bria, the same one rushordertees gets), and this page shows the PNG that comes
            back. The first render of a new photo can take up to a minute; after that it is
            cached and quick.
          </li>
          <li>
            <strong>Right pane — on this device.</strong> Our engine today. It downloads the
            model once (6 MB portrait, 42 MB detailed) and never uploads the photo. The
            editor&apos;s “Remove Background” runs this exact path, so this pane is what a
            customer sees now.
          </li>
          <li>
            <strong>When imgix fails.</strong> If imgix cannot separate the subject it quietly
            returns the original photo — that is their default. A middle pane that looks
            unchanged is a failed removal, not a bug in the test.
          </li>
          <li>
            <strong>Uploaded photos.</strong> Only the middle pane sends your photo anywhere.
            It is parked on our server under a random address so imgix can fetch it, and
            deleted within a day. The right pane never uploads anything.
          </li>
        </ul>
      </details>
    </div>
  );
}
