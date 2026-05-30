/* ============================================================
   segmenter.js — in-browser person cut-out (no upload)

   Primary: MODNet portrait matting via onnxruntime-web
            (self-hosted) → clean, hair-level edges.
   Fallback: MediaPipe Selfie Segmentation (if ORT/model can't
            load) → lighter, coarser, with edge clean-up.
   Everything runs locally; the photo is never uploaded.
   ============================================================ */

const MODEL_URL = new URL("models/modnet.onnx", document.baseURI).href;
const ORT_PATH  = new URL("js/vendor/ort/", document.baseURI).href;
const MP_CDN    = new URL("js/mediapipe/", document.baseURI).href;
const REF = 512;       // MODNet working size (longer side ≈ 512, multiple of 32)
const MAX_DIM = 1280;  // output resolution cap

const newCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
function fitDims(w, h) { const s = Math.min(1, MAX_DIM / Math.max(w, h)); return { w: Math.round(w * s), h: Math.round(h * s) }; }

// high-quality downscale by repeated halving (a single big drawImage aliases
// badly; step-down gives a clean area-averaged result the matting model likes)
function drawScaled(source, srcW, srcH, w, h) {
  let cur = source, cw = srcW, ch = srcH;
  while (cw > w * 2 && ch > h * 2) {
    const nw = Math.max(w, cw >> 1), nh = Math.max(h, ch >> 1);
    const t = newCanvas(nw, nh), tx = t.getContext("2d");
    tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = "high";
    tx.drawImage(cur, 0, 0, nw, nh);
    cur = t; cw = nw; ch = nh;
  }
  const out = newCanvas(w, h), ox = out.getContext("2d");
  ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = "high";
  ox.drawImage(cur, 0, 0, w, h);
  return out;
}

/* ---------------- MODNet (onnxruntime-web) ---------------- */
let ortReady = null, ortSession = null;
function loadORT() {
  if (ortReady) return ortReady;
  ortReady = (async () => {
    const ort = window.ort;
    if (!ort) throw new Error("ort-unavailable");
    ort.env.wasm.wasmPaths = ORT_PATH;
    ort.env.wasm.numThreads = 1;          // single-thread: no SharedArrayBuffer / COOP-COEP needed
    ortSession = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
    return ortSession;
  })().catch((e) => { ortReady = null; throw e; });
  return ortReady;
}

async function modnetCutout(source, srcW, srcH) {
  const ort = window.ort;
  const sess = await loadORT();

  // preprocess: resize to multiple of 32 (~512 longer side), normalize to [-1,1], NCHW
  const scale = REF / Math.max(srcW, srcH);
  const w = Math.max(32, Math.round(srcW * scale / 32) * 32);
  const h = Math.max(32, Math.round(srcH * scale / 32) * 32);
  const pc = drawScaled(source, srcW, srcH, w, h);
  const px = pc.getContext("2d");
  const rgba = px.getImageData(0, 0, w, h).data;
  const plane = w * h;
  const f = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    f[i]             = (rgba[i * 4]     / 255 - 0.5) / 0.5;
    f[plane + i]     = (rgba[i * 4 + 1] / 255 - 0.5) / 0.5;
    f[2 * plane + i] = (rgba[i * 4 + 2] / 255 - 0.5) / 0.5;
  }
  const input = new ort.Tensor("float32", f, [1, 3, h, w]);
  const results = await sess.run({ [sess.inputNames[0]]: input });
  const outT = results[sess.outputNames[0]];
  const matte = outT.data; // Float32Array, length w*h, 0..1

  // matte → alpha canvas
  const mC = newCanvas(w, h);
  const mx = mC.getContext("2d");
  const mImg = mx.createImageData(w, h);
  for (let i = 0; i < plane; i++) {
    mImg.data[i * 4] = 255; mImg.data[i * 4 + 1] = 255; mImg.data[i * 4 + 2] = 255;
    mImg.data[i * 4 + 3] = Math.max(0, Math.min(1, matte[i])) * 255;
  }
  mx.putImageData(mImg, 0, 0);

  // compose at capped output resolution (matte upscaled smoothly → clean AA edges)
  const { w: ow, h: oh } = fitDims(srcW, srcH);
  const out = newCanvas(ow, oh);
  const octx = out.getContext("2d");
  octx.drawImage(source, 0, 0, ow, oh);
  octx.globalCompositeOperation = "destination-in";
  octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = "high";
  octx.drawImage(mC, 0, 0, ow, oh);
  octx.globalCompositeOperation = "source-over";
  return out;
}

/* ---------------- MediaPipe fallback ---------------- */
let seg = null, pending = null;
function getSeg() {
  if (seg) return seg;
  const SS = window.SelfieSegmentation;
  if (!SS) throw new Error("segmentation-model-unavailable");
  seg = new SS({ locateFile: (f) => MP_CDN + f });
  seg.setOptions({ modelSelection: 0, selfieMode: false });
  seg.onResults((r) => { if (pending) { const p = pending; pending = null; p(r); } });
  return seg;
}
const smoothstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function largestComponent(bin, w, h) {
  const N = w * h, label = new Int32Array(N), stack = new Int32Array(N);
  let cur = 0, best = 0, bestSize = 0;
  for (let s = 0; s < N; s++) {
    if (!bin[s] || label[s]) continue;
    cur++; let sp = 0, size = 0; stack[sp++] = s; label[s] = cur;
    while (sp) {
      const p = stack[--sp]; size++; const x = p % w, y = (p / w) | 0;
      if (x > 0     && bin[p - 1] && !label[p - 1]) { label[p - 1] = cur; stack[sp++] = p - 1; }
      if (x < w - 1 && bin[p + 1] && !label[p + 1]) { label[p + 1] = cur; stack[sp++] = p + 1; }
      if (y > 0     && bin[p - w] && !label[p - w]) { label[p - w] = cur; stack[sp++] = p - w; }
      if (y < h - 1 && bin[p + w] && !label[p + w]) { label[p + w] = cur; stack[sp++] = p + w; }
    }
    if (size > bestSize) { bestSize = size; best = cur; }
  }
  return { label, best, bestSize };
}
async function mediapipeCutout(source, srcW, srcH) {
  const s = getSeg();
  const { w, h } = fitDims(srcW, srcH);
  const results = await new Promise((resolve, reject) => {
    pending = resolve;
    Promise.resolve(s.send({ image: source })).catch((e) => { pending = null; reject(e); });
  });
  const pc = newCanvas(w, h), px = pc.getContext("2d");
  px.imageSmoothingEnabled = true; px.imageSmoothingQuality = "high";
  px.drawImage(results.segmentationMask, 0, 0, w, h);
  const prob = px.getImageData(0, 0, w, h).data;
  const N = w * h, bin = new Uint8Array(N);
  for (let i = 0; i < N; i++) bin[i] = prob[i * 4] > 128 ? 1 : 0;
  const { label, best, bestSize } = largestComponent(bin, w, h);
  const gate = bestSize > N * 0.002;
  const aC = newCanvas(w, h), ax = aC.getContext("2d");
  const aimg = ax.createImageData(w, h), ad = aimg.data;
  for (let i = 0; i < N; i++) {
    let a = 0;
    if (!gate || label[i] === best) a = smoothstep(0.46, 0.57, prob[i * 4] / 255);
    ad[i * 4] = 255; ad[i * 4 + 1] = 255; ad[i * 4 + 2] = 255; ad[i * 4 + 3] = (a * 255) | 0;
  }
  ax.putImageData(aimg, 0, 0);
  const fC = newCanvas(w, h), fx = fC.getContext("2d");
  fx.filter = `blur(${Math.max(0.6, w / 1500)}px)`;
  fx.drawImage(aC, 0, 0);
  const out = newCanvas(w, h), octx = out.getContext("2d");
  octx.drawImage(source, 0, 0, w, h);
  octx.globalCompositeOperation = "destination-in";
  octx.drawImage(fC, 0, 0);
  octx.globalCompositeOperation = "source-over";
  return out;
}

/* ---------------- public API ---------------- */
export async function cutout(source, srcW, srcH) {
  try {
    return await modnetCutout(source, srcW, srcH);
  } catch (e) {
    console.warn("MODNet unavailable, falling back to MediaPipe:", e);
    return await mediapipeCutout(source, srcW, srcH);
  }
}

/** Warm up the matting model in the background (downloads ~35MB once, cached). */
export function preload() {
  loadORT().catch(() => { /* fallback handled at call time */ });
}
