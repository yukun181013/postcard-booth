/* ============================================================
   segmenter.js — in-browser person cut-out (no upload)
   Wraps MediaPipe Selfie Segmentation (loaded as a global
   <script> in index.html) into a simple async function.

   Edge quality: the raw mask is only ~256px and noisy, so we
   (1) keep just the largest connected region (kills floating
   speckles), (2) map probability to alpha with a smooth ramp
   biased slightly inward (kills the bright background halo),
   and (3) feather the alpha with a small blur (anti-aliases
   the edge). Result is a much cleaner, softer cut-out.
   ============================================================ */

const CDN = new URL("js/mediapipe/", document.baseURI).href;
const MAX_DIM = 1280; // cap working resolution for speed / detail

let seg = null;
let pending = null; // resolver for the in-flight send()

function getSeg() {
  if (seg) return seg;
  const SS = window.SelfieSegmentation;
  if (!SS) throw new Error("segmentation-model-unavailable");
  seg = new SS({ locateFile: (f) => CDN + f });
  // model 0 = general (256×256) — better for upper-body portraits than the
  // landscape model (1, 256×144).
  seg.setOptions({ modelSelection: 0, selfieMode: false });
  seg.onResults((results) => {
    if (pending) { const r = pending; pending = null; r(results); }
  });
  return seg;
}

function fitDims(w, h) {
  const s = Math.min(1, MAX_DIM / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

const newCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const smoothstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// largest 4-connected component of a binary mask (removes floating speckles)
function largestComponent(bin, w, h) {
  const N = w * h;
  const label = new Int32Array(N);
  const stack = new Int32Array(N);
  let cur = 0, best = 0, bestSize = 0;
  for (let s = 0; s < N; s++) {
    if (!bin[s] || label[s]) continue;
    cur++; let sp = 0, size = 0; stack[sp++] = s; label[s] = cur;
    while (sp) {
      const p = stack[--sp]; size++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0     && bin[p - 1] && !label[p - 1]) { label[p - 1] = cur; stack[sp++] = p - 1; }
      if (x < w - 1 && bin[p + 1] && !label[p + 1]) { label[p + 1] = cur; stack[sp++] = p + 1; }
      if (y > 0     && bin[p - w] && !label[p - w]) { label[p - w] = cur; stack[sp++] = p - w; }
      if (y < h - 1 && bin[p + w] && !label[p + w]) { label[p + w] = cur; stack[sp++] = p + w; }
    }
    if (size > bestSize) { bestSize = size; best = cur; }
  }
  return { label, best, bestSize };
}

/**
 * Returns a canvas containing only the person on a transparent
 * background. `source` is an HTMLCanvasElement / HTMLImageElement.
 */
export async function cutout(source, srcW, srcH) {
  const s = getSeg();
  const { w, h } = fitDims(srcW, srcH);

  const results = await new Promise((resolve, reject) => {
    pending = resolve;
    Promise.resolve(s.send({ image: source })).catch((e) => { pending = null; reject(e); });
  });

  // probability map: red channel = person probability (smoothly upscaled)
  const pc = newCanvas(w, h);
  const px = pc.getContext("2d");
  px.imageSmoothingEnabled = true; px.imageSmoothingQuality = "high";
  px.drawImage(results.segmentationMask, 0, 0, w, h);
  const prob = px.getImageData(0, 0, w, h).data;

  const N = w * h;
  // binary mask @ 0.5, then keep only the largest region (drop speckles)
  const bin = new Uint8Array(N);
  for (let i = 0; i < N; i++) bin[i] = prob[i * 4] > 128 ? 1 : 0;
  const { label, best, bestSize } = largestComponent(bin, w, h);
  const gate = bestSize > N * 0.002; // only trust component-gating if it's a real blob

  // build a feathered alpha matte (white rgb, alpha = soft person mask)
  const aC = newCanvas(w, h);
  const ax = aC.getContext("2d");
  const aimg = ax.createImageData(w, h);
  const ad = aimg.data;
  for (let i = 0; i < N; i++) {
    let a = 0;
    if (!gate || label[i] === best) {
      // ramp biased inward (0.46→0.74) so the edge sits inside the halo
      a = smoothstep(0.46, 0.74, prob[i * 4] / 255);
    }
    ad[i * 4] = 255; ad[i * 4 + 1] = 255; ad[i * 4 + 2] = 255;
    ad[i * 4 + 3] = (a * 255) | 0;
  }
  ax.putImageData(aimg, 0, 0);

  // feather: blur the matte to anti-alias the edge
  const fC = newCanvas(w, h);
  const fx = fC.getContext("2d");
  fx.filter = `blur(${Math.max(1, Math.round(w / 600))}px)`;
  fx.drawImage(aC, 0, 0);

  // compose: source pixels kept only where the matte is opaque
  const out = newCanvas(w, h);
  const octx = out.getContext("2d");
  octx.drawImage(source, 0, 0, w, h);
  octx.globalCompositeOperation = "destination-in";
  octx.drawImage(fC, 0, 0);
  octx.globalCompositeOperation = "source-over";
  return out;
}

/** Warm up the model in the background so first capture feels instant. */
export function preload() {
  try {
    const s = getSeg();
    if (typeof s.initialize === "function") s.initialize().catch(() => {});
  } catch (_) { /* offline / blocked — handled at call time */ }
}
