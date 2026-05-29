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
  c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#2b2620"; c.fillStyle = "#2b2620";
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
  const s = 118 * u, x = W - s - 50 * u, y = 50 * u;
  ctx.save();
  ctx.strokeStyle = "rgba(158,52,42,.7)"; ctx.lineWidth = 2.4 * u;
  roundRect(ctx, x, y, s, s, 10 * u); ctx.stroke();
  ctx.lineWidth = 1.4 * u;
  roundRect(ctx, x + 6 * u, y + 6 * u, s - 12 * u, s - 12 * u, 7 * u); ctx.stroke();
  // 祥云 curls in the corners
  ctx.lineWidth = 1.6 * u;
  const curl = (cx, cy) => { ctx.beginPath(); ctx.arc(cx, cy, 7 * u, 0, Math.PI * 1.5); ctx.stroke(); };
  curl(x + 17 * u, y + 17 * u); curl(x + s - 17 * u, y + 17 * u);
  curl(x + 17 * u, y + s - 17 * u); curl(x + s - 17 * u, y + s - 17 * u);
  // center character — 寄 (to send)
  ctx.fillStyle = "rgba(158,52,42,.72)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `${40 * u}px "Ma Shan Zheng", "Kaiti SC", serif`;
  ctx.fillText("寄", x + s / 2, y + s / 2 + 3 * u);
  ctx.restore();
}

function drawSignature(ctx, W, H) {
  const u = W / 1000;
  const sig = state.signatureCanvas;
  const x0 = W * 0.6, y0 = H * 0.74, lineW = W * 0.32;
  ctx.save();
  ctx.strokeStyle = "rgba(60,55,48,.3)"; ctx.lineWidth = 1.5 * u;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + lineW, y0); ctx.stroke();
  ctx.fillStyle = "rgba(120,110,95,.85)"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = `${22 * u}px "Kaiti SC", "STKaiti", serif`;
  ctx.fillText("落款", x0, y0 + 30 * u);
  if (sig) {
    const maxW = lineW * 0.78, maxH = H * 0.17;
    const s = Math.min(maxW / sig.width, maxH / sig.height);
    ctx.drawImage(sig, x0 + 14 * u, y0 - sig.height * s - 6 * u, sig.width * s, sig.height * s);
  }
  ctx.restore();
}

function drawSeal(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = "#9e342a";
  roundRect(ctx, x, y, size, size, size * 0.18); ctx.fill();
  ctx.fillStyle = "#f7f1e3"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `${size * 0.64}px "Ma Shan Zheng", "Kaiti SC", serif`;
  ctx.fillText("印", x + size / 2, y + size / 2 + size * 0.04);
  ctx.restore();
}

// vertical brush calligraphy, columns read right-to-left
function drawPoem(ctx, W, H, lines) {
  const u = W / 1000;
  ctx.save();
  ctx.fillStyle = "#2b2620"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  const fs = 96 * u;
  ctx.font = `${fs}px "Ma Shan Zheng", "Kaiti SC", serif`;
  const colGap = fs * 1.18;
  const startX = W * 0.72, topY = H * 0.1;
  lines.forEach((line, ci) => {
    const x = startX - ci * colGap;
    [...line].forEach((ch, ri) => ctx.fillText(ch, x, topY + ri * fs * 1.02));
    if (ci === lines.length - 1) {
      const sy = topY + line.length * fs * 1.02 + 10 * u;
      drawSeal(ctx, x - fs * 0.2, sy, fs * 0.42);
    }
  });
  ctx.restore();
}

function composePostcard(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
  const tpl = TEMPLATES.find((t) => t.id === state.templateId) || TEMPLATES[0];
  tpl.draw(ctx, W, H);

  // cut-out figure, anchored bottom-left like a figure in the landscape
  const cut = state.cutoutCanvas;
  if (cut) {
    const targetH = H * 0.72;
    const s = targetH / cut.height;
    const pw = cut.width * s, ph = cut.height * s;
    const cx = W * 0.25;
    const px = cx - pw / 2, py = H - ph - H * 0.02;
    ctx.save();
    ctx.fillStyle = "rgba(40,40,38,.16)";
    ctx.beginPath(); ctx.ellipse(cx, H * 0.965, pw * 0.34, H * 0.018, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.drawImage(cut, px, py, pw, ph);
  }

  drawPoem(ctx, W, H, tpl.poem);
  drawStamp(ctx, W, H);
  drawSignature(ctx, W, H);

  // 国风 frame: gold outer line + fine ink inner line
  const m = Math.round(W * 0.016);
  ctx.strokeStyle = "#b08d57"; ctx.lineWidth = Math.max(3, W * 0.006);
  ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
  ctx.strokeStyle = "rgba(43,38,32,.75)"; ctx.lineWidth = Math.max(1, W * 0.0015);
  const m2 = m + Math.round(W * 0.01);
  ctx.strokeRect(m2, m2, W - 2 * m2, H - 2 * m2);
}

function buildFinal() {
  state.signatureCanvas = makeTrimmedSignature();
  finalCanvas.width = 1500; finalCanvas.height = 1000;
  composePostcard(finalCanvas.getContext("2d"), 1500, 1000);
}

async function save() {
  const blob = await new Promise((res) => finalCanvas.toBlob(res, "image/png"));
  if (!blob) return;
  const file = new File([blob], `postcard-${Date.now()}.png`, { type: "image/png" });

  // Native share sheet (AirDrop / 存到相册 / 微信 …) — all local, nothing uploaded.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "我的明信片", text: "Greetings from ✦" });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return; // user dismissed the sheet
      // any other error: fall through to download
    }
  }

  // Fallback: download to this device.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
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
      document.fonts.load('96px "Ma Shan Zheng"'),
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
