/* ============================================================
   segmenter.js — in-browser person cut-out (no upload)
   Wraps MediaPipe Selfie Segmentation (loaded as a global
   <script> in index.html) into a simple async function.
   ============================================================ */

// Self-hosted MediaPipe assets, resolved absolutely so it works under any
// base path (e.g. GitHub Pages project subpath /repo/).
const CDN = new URL("js/mediapipe/", document.baseURI).href;
const MAX_DIM = 1080; // cap working resolution for speed

let seg = null;
let pending = null; // resolver for the in-flight send()

function getSeg() {
  if (seg) return seg;
  const SS = window.SelfieSegmentation;
  if (!SS) throw new Error("segmentation-model-unavailable");
  seg = new SS({ locateFile: (f) => CDN + f });
  seg.setOptions({ modelSelection: 1, selfieMode: false });
  seg.onResults((results) => {
    if (pending) { const r = pending; pending = null; r(results); }
  });
  return seg;
}

function fitDims(w, h) {
  const s = Math.min(1, MAX_DIM / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

/**
 * Returns a canvas containing only the person on a transparent
 * background. `source` is an HTMLCanvasElement / HTMLImageElement.
 */
export async function cutout(source, srcW, srcH) {
  const s = getSeg();
  const { w, h } = fitDims(srcW, srcH);

  // run the model
  const results = await new Promise((resolve, reject) => {
    pending = resolve;
    Promise.resolve(s.send({ image: source })).catch((e) => {
      pending = null;
      reject(e);
    });
  });

  // mask → red channel holds person probability (0..255)
  const maskC = document.createElement("canvas");
  maskC.width = w; maskC.height = h;
  const mctx = maskC.getContext("2d");
  mctx.drawImage(results.segmentationMask, 0, 0, w, h);
  const mask = mctx.getImageData(0, 0, w, h).data;

  // original pixels at working size
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const octx = out.getContext("2d");
  octx.drawImage(source, 0, 0, w, h);
  const img = octx.getImageData(0, 0, w, h);
  const d = img.data;

  // build alpha from mask with a soft threshold (reduces halo)
  for (let i = 0; i < w * h; i++) {
    const m = mask[i * 4];
    let a;
    if (m < 90) a = 0;
    else if (m > 165) a = 255;
    else a = ((m - 90) / 75) * 255;
    d[i * 4 + 3] = a;
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/** Warm up the model in the background so first capture feels instant.
    Uses initialize() (not send) so it can't race a real cut-out request. */
export function preload() {
  try {
    const s = getSeg();
    if (typeof s.initialize === "function") s.initialize().catch(() => {});
  } catch (_) { /* offline / blocked — handled at call time */ }
}
