/* ============================================================
   app.js — kiosk flow: welcome → capture → cut-out →
   template → sign → result. Vanilla, no framework.
   ============================================================ */

import { cutout, preload } from "./segmenter.js";
import { TEMPLATES } from "./templates.js";

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- elements ---------- */
const video      = $("#video");
const viewfinder = $("#viewfinder");
const flash      = $("#flash");
const countdown  = $("#countdown");
const camError   = $("#camError");
const shootBtn   = $("#shootBtn");
const fileInput  = $("#fileInput");
const cutoutPrev = $("#cutoutPreview");
const shimmer    = $("#shimmer");
const procTitle  = $("#procTitle");
const procHint   = $("#procHint");
const reshootBtn = $("#reshootBtn");
const toTplBtn   = $("#toTemplateBtn");
const tplGrid    = $("#templateGrid");
const livePrev   = $("#livePreview");
const signPad    = $("#signPad");
const finalCanvas= $("#finalCanvas");
const postDate   = $("#postDate");

/* ---------- state ---------- */
const photoCanvas = document.createElement("canvas");
const state = {
  stream: null,
  facing: "user",
  cutoutCanvas: null,
  templateId: TEMPLATES[0].id,
  signatureCanvas: null,
  sigHasInk: false,
  sigBounds: null,
  sigDpr: 1,
};
const YEAR = new Date().getFullYear();
postDate.textContent = YEAR;

/* ---------- navigation ---------- */
const STEPS = ["capture", "processing", "template", "sign", "result"];
function setStep(s) {
  document.body.dataset.step = s;
  const idx = STEPS.indexOf(s);
  document.querySelectorAll(".progress__dot").forEach((d) => {
    const i = STEPS.indexOf(d.dataset.for);
    d.classList.toggle("is-active", i === idx);
    d.classList.toggle("is-done", idx > -1 && i < idx);
  });
  if (s === "capture") startCamera(); else stopCamera();
  if (s === "sign") requestAnimationFrame(sizeSignPad);
  if (s === "template") updateLivePreview();
  if (s === "result") buildFinal();
}

/* ---------- camera ---------- */
async function startCamera() {
  stopCamera();
  camError.hidden = true; shootBtn.disabled = false;
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: state.facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    });
    video.srcObject = state.stream;
    viewfinder.classList.toggle("is-back", state.facing !== "user");
    await video.play().catch(() => {});
  } catch (e) {
    camError.hidden = false; shootBtn.disabled = true;
  }
}
function stopCamera() {
  if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
  video.srcObject = null;
}

function captureFrame() {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return false;
  photoCanvas.width = vw; photoCanvas.height = vh;
  const c = photoCanvas.getContext("2d");
  if (state.facing === "user") { c.save(); c.translate(vw, 0); c.scale(-1, 1); c.drawImage(video, 0, 0, vw, vh); c.restore(); }
  else c.drawImage(video, 0, 0, vw, vh);
  return true;
}

async function shoot() {
  if (shootBtn.disabled) return;
  shootBtn.disabled = true;
  for (const n of [3, 2, 1]) {
    countdown.textContent = n;
    countdown.classList.remove("is-on"); void countdown.offsetWidth; countdown.classList.add("is-on");
    await wait(620);
  }
  countdown.classList.remove("is-on"); countdown.textContent = "";
  flash.classList.remove("is-firing"); void flash.offsetWidth; flash.classList.add("is-firing");
  const ok = captureFrame();
  await wait(160);
  shootBtn.disabled = false;
  if (ok) { setStep("processing"); runCutout(); }
}

/* ---------- background removal ---------- */
function showProc(stateName, degraded) {
  const working = stateName === "working";
  shimmer.classList.toggle("is-on", working);
  reshootBtn.hidden = working;
  toTplBtn.hidden = working;
  procTitle.textContent = working ? "正在把你抠出来…" : (degraded ? "先用原图继续" : "抠好啦！");
  procHint.textContent  = working ? "本机 AI 处理中，请稍候"
                                  : (degraded ? "没加载到抠图模型，已用整张照片，可联网后重试" : "背景已去掉，确认一下");
}
function drawCutoutPreview(canvas) {
  cutoutPrev.width = canvas.width; cutoutPrev.height = canvas.height;
  cutoutPrev.getContext("2d").drawImage(canvas, 0, 0);
}
async function runCutout() {
  showProc("working");
  try {
    state.cutoutCanvas = await cutout(photoCanvas, photoCanvas.width, photoCanvas.height);
    drawCutoutPreview(state.cutoutCanvas);
    showProc("done", false);
  } catch (e) {
    console.warn("cutout failed, falling back to full photo:", e);
    state.cutoutCanvas = photoCanvas;
    drawCutoutPreview(photoCanvas);
    showProc("done", true);
  }
}

/* ---------- templates ---------- */
function buildThumbs() {
  tplGrid.innerHTML = "";
  TEMPLATES.forEach((t) => {
    const el = document.createElement("div");
    el.className = "tpl-thumb"; el.dataset.id = t.id;
    const c = document.createElement("canvas"); c.width = 360; c.height = 240;
    t.draw(c.getContext("2d"), c.width, c.height);
    const name = document.createElement("span");
    name.className = "tpl-thumb__name"; name.textContent = t.name;
    el.append(c, name);
    el.addEventListener("click", () => selectTemplate(t.id));
    tplGrid.appendChild(el);
  });
}
function selectTemplate(id) {
  state.templateId = id;
  document.querySelectorAll(".tpl-thumb").forEach((e) => e.classList.toggle("is-sel", e.dataset.id === id));
  updateLivePreview();
}
function updateLivePreview() {
  livePrev.width = 660; livePrev.height = 440;
  composePostcard(livePrev.getContext("2d"), livePrev.width, livePrev.height);
}

/* ---------- signature pad ---------- */
function sizeSignPad() {
  const r = signPad.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  signPad.width = Math.max(1, Math.round(r.width * dpr));
  signPad.height = Math.max(1, Math.round(r.height * dpr));
  const c = signPad.getContext("2d");
  c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#23323a"; c.fillStyle = "#23323a";
  c.lineWidth = 5 * dpr;
  state.sigDpr = dpr;
  clearSign();
}
function clearSign() {
  signPad.getContext("2d").clearRect(0, 0, signPad.width, signPad.height);
  state.sigHasInk = false;
  state.sigBounds = { minX: 1e9, minY: 1e9, maxX: -1e9, maxY: -1e9 };
}
function sigPos(e) {
  const r = signPad.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (signPad.width / r.width), y: (e.clientY - r.top) * (signPad.height / r.height) };
}
function sigMark(p) {
  state.sigHasInk = true;
  const b = state.sigBounds;
  b.minX = Math.min(b.minX, p.x); b.minY = Math.min(b.minY, p.y);
  b.maxX = Math.max(b.maxX, p.x); b.maxY = Math.max(b.maxY, p.y);
}
function initSignPad() {
  let drawing = false, last = null;
  const c = () => signPad.getContext("2d");
  signPad.addEventListener("pointerdown", (e) => {
    drawing = true; last = sigPos(e); signPad.setPointerCapture(e.pointerId);
    const ctx = c(); ctx.beginPath(); ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, 7); ctx.fill(); sigMark(last);
  });
  signPad.addEventListener("pointermove", (e) => {
    if (!drawing) return; const p = sigPos(e); const ctx = c();
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); sigMark(p); last = p;
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
    signPad.addEventListener(ev, () => { drawing = false; }));
}
function makeTrimmedSignature() {
  if (!state.sigHasInk) return null;
  const { minX, minY, maxX, maxY } = state.sigBounds;
  const pad = 14 * state.sigDpr;
  const x = Math.max(0, minX - pad), y = Math.max(0, minY - pad);
  const w = Math.min(signPad.width, maxX + pad) - x;
  const h = Math.min(signPad.height, maxY + pad) - y;
  if (w <= 0 || h <= 0) return null;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(signPad, x, y, w, h, 0, 0, w, h);
  return c;
}

/* ---------- postcard compositor ---------- */
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawStamp(ctx, W, H) {
  const u = W / 1000;
  const sw = 116 * u, sh = 144 * u, x = W - sw - 40 * u, y = 40 * u;
  ctx.save();
  ctx.fillStyle = "#fbf5e6"; ctx.fillRect(x, y, sw, sh);
  ctx.fillStyle = "#0c8b8a"; ctx.fillRect(x + 8 * u, y + 8 * u, sw - 16 * u, sh - 16 * u);
  ctx.fillStyle = "#fbf5e6"; ctx.textAlign = "center";
  ctx.font = `${30 * u}px "Alfa Slab One", serif`; ctx.fillText("¥8", x + sw / 2, y + sh / 2 + 4 * u);
  ctx.font = `700 ${11 * u}px "Space Mono", monospace`; ctx.fillText("POSTCARD", x + sw / 2, y + sh - 16 * u);
  // postmark
  ctx.translate(x - 6 * u, y + sh * 0.5); ctx.rotate(-0.16);
  ctx.strokeStyle = "rgba(35,50,58,.55)"; ctx.lineWidth = 3 * u;
  ctx.beginPath(); ctx.arc(0, 0, 46 * u, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 38 * u, 0, 7); ctx.stroke();
  ctx.fillStyle = "rgba(35,50,58,.55)"; ctx.font = `700 ${15 * u}px "Space Mono", monospace`;
  ctx.fillText(String(YEAR), 0, 5 * u);
  ctx.restore();
}

function drawSignature(ctx, W, H) {
  const u = W / 1000;
  const lw = 330 * u, lh = 124 * u, x = 44 * u, y = H - lh - 44 * u;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-0.03);
  ctx.fillStyle = "rgba(251,245,230,.93)"; ctx.strokeStyle = "#23323a"; ctx.lineWidth = 3 * u;
  roundRect(ctx, 0, 0, lw, lh, 12 * u); ctx.fill(); ctx.stroke();
  ctx.textAlign = "left"; ctx.fillStyle = "#4a5a5f";
  ctx.font = `${26 * u}px "Yellowtail", cursive`;
  ctx.fillText("Wish you were here —", 20 * u, 38 * u);
  const sig = state.signatureCanvas;
  if (sig) {
    const aw = lw - 40 * u, ah = lh - 56 * u;
    const s = Math.min(aw / sig.width, ah / sig.height);
    ctx.drawImage(sig, 20 * u, 48 * u, sig.width * s, sig.height * s);
  } else {
    ctx.fillStyle = "#23323a"; ctx.font = `${46 * u}px "Yellowtail", cursive`;
    ctx.fillText("你的名字", 24 * u, 104 * u);
  }
  ctx.restore();
}

function composePostcard(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
  const tpl = TEMPLATES.find((t) => t.id === state.templateId) || TEMPLATES[0];
  tpl.draw(ctx, W, H);

  const cut = state.cutoutCanvas;
  if (cut) {
    const targetH = H * 0.82;
    const s = targetH / cut.height;
    const pw = cut.width * s, ph = cut.height * s;
    const px = W * 0.5 - pw / 2, py = H - ph - H * 0.015;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.965, pw * 0.3, H * 0.02, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.drawImage(cut, px, py, pw, ph);
  }

  // baked frame
  const b = Math.round(W * 0.02);
  ctx.lineWidth = b; ctx.strokeStyle = "#fbf5e6"; ctx.strokeRect(b / 2, b / 2, W - b, H - b);
  ctx.lineWidth = Math.max(2, W * 0.003); ctx.strokeStyle = "#23323a"; ctx.strokeRect(b, b, W - 2 * b, H - 2 * b);

  drawStamp(ctx, W, H);
  drawSignature(ctx, W, H);
}

function buildFinal() {
  state.signatureCanvas = makeTrimmedSignature();
  finalCanvas.width = 1500; finalCanvas.height = 1000;
  composePostcard(finalCanvas.getContext("2d"), 1500, 1000);
}

function save() {
  finalCanvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `postcard-${Date.now()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, "image/png");
}

function restart() {
  state.cutoutCanvas = null;
  state.signatureCanvas = null;
  if (signPad.width) clearSign();
  selectTemplate(TEMPLATES[0].id);
  setStep("welcome");
}

/* ---------- file fallback ---------- */
fileInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    photoCanvas.width = img.naturalWidth; photoCanvas.height = img.naturalHeight;
    photoCanvas.getContext("2d").drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);
    setStep("processing"); runCutout();
  };
  img.src = URL.createObjectURL(file);
  fileInput.value = "";
});

/* ---------- action wiring ---------- */
const handlers = {
  start: () => setStep("capture"),
  flip: () => { state.facing = state.facing === "user" ? "environment" : "user"; startCamera(); },
  shoot,
  reshoot: () => setStep("capture"),
  toTemplate: () => setStep("template"),
  toSign: () => setStep("sign"),
  clearSign,
  toResult: () => setStep("result"),
  save,
  restart,
};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const fn = handlers[el.dataset.action];
  if (fn) fn();
});

/* ---------- init ---------- */
async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('112px "Alfa Slab One"'),
      document.fonts.load('64px "Yellowtail"'),
      document.fonts.load('700 16px "Space Mono"'),
    ]);
    await document.fonts.ready;
  } catch (_) {}
}
(async function init() {
  await loadFonts();
  buildThumbs();
  selectTemplate(TEMPLATES[0].id);
  initSignPad();
  setStep("welcome");
  preload(); // warm up the segmentation model in the background
})();
