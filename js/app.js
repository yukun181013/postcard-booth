/* ============================================================
   app.js — kiosk flow: welcome → capture → cut-out →
   template → sign → result. Vanilla, no framework.
   ============================================================ */

import { cutout, preload } from "./segmenter.js";
import { TEMPLATES, loadTemplateImages, drawBackdrop } from "./templates.js";

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

/* white 莆田学院 logo, baked onto the postcard + shown on welcome */
const logoImg = new Image();
let logoReady = false;
logoImg.onload = () => { logoReady = true; };
logoImg.src = new URL("img/logo.png", document.baseURI).href;

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
    drawBackdrop(c.getContext("2d"), c.width, c.height, t);
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

function drawStar(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 5, a2 = a + Math.PI / 5;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a2) * r * 0.4, cy + Math.sin(a2) * r * 0.4);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}

function drawStamp(ctx, W, H) {
  const u = W / 1000;
  const s = 116 * u, x = W - s - 50 * u, y = 50 * u;
  ctx.save();
  ctx.strokeStyle = "rgba(232,200,106,.9)"; ctx.lineWidth = 2.4 * u;
  roundRect(ctx, x, y, s, s, 8 * u); ctx.stroke();
  ctx.lineWidth = 1.2 * u;
  roundRect(ctx, x + 6 * u, y + 6 * u, s - 12 * u, s - 12 * u, 5 * u); ctx.stroke();
  drawStar(ctx, x + s / 2, y + s / 2, s * 0.3, "rgba(232,200,106,.95)");
  ctx.restore();
}

function drawSignature(ctx, W, H) {
  const u = W / 1000;
  const sig = state.signatureCanvas;
  const pw = W * 0.3, ph = H * 0.14, x = W - pw - W * 0.05, y = H - ph - H * 0.04;
  ctx.save();
  ctx.fillStyle = "rgba(247,241,227,.93)"; ctx.strokeStyle = "rgba(232,200,106,.8)"; ctx.lineWidth = 2 * u;
  roundRect(ctx, x, y, pw, ph, 10 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#9e1419"; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.font = `${19 * u}px "Kaiti SC", "STKaiti", serif`;
  ctx.fillText("落款", x + 16 * u, y + 11 * u);
  if (sig) {
    const aw = pw - 30 * u, ah = ph - 42 * u;
    const s = Math.min(aw / sig.width, ah / sig.height);
    ctx.drawImage(sig, x + 16 * u, y + 38 * u, sig.width * s, sig.height * s);
  }
  ctx.restore();
}

function drawSeal(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = "#d8b24a";
  roundRect(ctx, x, y, size, size, size * 0.16); ctx.fill();
  ctx.strokeStyle = "rgba(120,18,22,.55)"; ctx.lineWidth = size * 0.05;
  roundRect(ctx, x, y, size, size, size * 0.16); ctx.stroke();
  ctx.fillStyle = "#8e1419"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `${size * 0.6}px "Ma Shan Zheng", "Kaiti SC", serif`;
  ctx.fillText("印", x + size / 2, y + size / 2 + size * 0.03);
  ctx.restore();
}

// vertical brush calligraphy (cream/gold on red), columns read right-to-left
function drawPoem(ctx, W, H, lines) {
  const u = W / 1000;
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  const maxLen = Math.max(...lines.map((l) => [...l].length));
  const fs = Math.min(96 * u, (H * 0.66) / (maxLen * 1.04));
  ctx.font = `${fs}px "Ma Shan Zheng", "Kaiti SC", serif`;
  const colGap = fs * 1.2, startX = W * 0.72, topY = H * 0.09;
  ctx.fillStyle = "#f7efd6";
  ctx.shadowColor = "rgba(60,8,10,.55)"; ctx.shadowBlur = 10 * u; ctx.shadowOffsetX = 2 * u; ctx.shadowOffsetY = 3 * u;
  lines.forEach((line, ci) => {
    const x = startX - ci * colGap;
    [...line].forEach((ch, ri) => ctx.fillText(ch, x, topY + ri * fs * 1.04));
  });
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  const lastLen = [...lines[lines.length - 1]].length;
  const sx = startX - (lines.length - 1) * colGap;
  drawSeal(ctx, sx - fs * 0.22, topY + lastLen * fs * 1.04 + 12 * u, fs * 0.44);
  ctx.restore();
}

function composePostcard(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
  const tpl = TEMPLATES.find((t) => t.id === state.templateId) || TEMPLATES[0];
  drawBackdrop(ctx, W, H, tpl);

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

  // school logo + event caption, top-left
  const bu = W / 1000;
  ctx.save();
  let capY = 54 * bu;
  if (logoReady && logoImg.width) {
    const lw = 220 * bu, lh = lw * (logoImg.height / logoImg.width);
    ctx.shadowColor = "rgba(40,4,6,.5)"; ctx.shadowBlur = 12 * bu; ctx.shadowOffsetY = 2 * bu;
    ctx.drawImage(logoImg, 54 * bu, 46 * bu, lw, lh);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    capY = 46 * bu + lh + 18 * bu;
  }
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(247,236,200,.96)";
  ctx.shadowColor = "rgba(40,4,6,.55)"; ctx.shadowBlur = 8 * bu; ctx.shadowOffsetY = 2 * bu;
  ctx.font = `${30 * bu}px "Kaiti SC", "STKaiti", serif`;
  ctx.fillText("庆祝建党105周年", 56 * bu, capY);
  ctx.fillStyle = "rgba(247,236,200,.85)";
  ctx.font = `${17 * bu}px "Kaiti SC", "STKaiti", serif`;
  ctx.fillText("1921 — 2026", 58 * bu, capY + 38 * bu);
  ctx.restore();

  // gold double frame
  const m = Math.round(W * 0.016);
  ctx.strokeStyle = "rgba(232,200,106,.9)"; ctx.lineWidth = Math.max(3, W * 0.006);
  ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
  ctx.strokeStyle = "rgba(245,225,160,.5)"; ctx.lineWidth = Math.max(1, W * 0.0014);
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
  await Promise.all([loadFonts(), loadTemplateImages()]);
  buildThumbs();
  selectTemplate(TEMPLATES[0].id);
  initSignPad();
  setStep("welcome");
  preload(); // warm up the segmentation model in the background
})();
