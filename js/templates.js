/* ============================================================
   templates.js — postcard backdrops drawn on a canvas
   (no image assets needed). Templates draw ONLY the scene;
   the editable "Greetings from ___" headline is painted by
   app.js so the destination text can be customised.
   ============================================================ */

function lerpGrad(ctx, w, h, stops, vertical = true) {
  const g = vertical ? ctx.createLinearGradient(0, 0, 0, h)
                     : ctx.createLinearGradient(0, 0, w, 0);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Seeded RNG so scene details stay put across re-renders (no flicker while typing).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seaside = (ctx, w, h) => {
  const rnd = rng(7);
  lerpGrad(ctx, w, h, [[0, "#9fe3df"], [0.45, "#3fb6ae"], [0.46, "#0c8b8a"], [1, "#075f63"]]);
  ctx.fillStyle = "#e9a83b";
  ctx.beginPath(); ctx.arc(w * 0.8, h * 0.26, w * 0.075, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(233,168,59,.25)";
  ctx.beginPath(); ctx.arc(w * 0.8, h * 0.26, w * 0.12, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.28)";
  for (let i = 0; i < 7; i++) {
    const y = h * (0.55 + i * 0.06);
    ctx.fillRect(w * (0.1 + rnd() * 0.7), y, w * (0.06 + rnd() * 0.18), 3);
  }
};

const sunset = (ctx, w, h) => {
  lerpGrad(ctx, w, h, [[0, "#f6c14b"], [0.4, "#ef7a3c"], [0.75, "#e8503a"], [1, "#7c2d4a"]]);
  ctx.fillStyle = "rgba(255,240,200,.95)";
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.62, w * 0.16, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(60,20,50,.55)";
  ctx.fillRect(0, h * 0.74, w, h * 0.26);
  ctx.strokeStyle = "#2b1326"; ctx.fillStyle = "#2b1326"; ctx.lineWidth = w * 0.012;
  [0.12, 0.9].forEach((px) => {
    const x = w * px, base = h * 0.78;
    ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + w * 0.01, h * 0.5, x - w * 0.01, h * 0.4); ctx.stroke();
    for (let a = -2; a <= 2; a++) {
      ctx.beginPath(); ctx.moveTo(x - w * 0.01, h * 0.4);
      ctx.quadraticCurveTo(x + a * w * 0.04, h * 0.34, x + a * w * 0.075, h * 0.4 + Math.abs(a) * h * 0.02); ctx.lineWidth = w * 0.018; ctx.stroke();
    }
  });
};

const alpine = (ctx, w, h) => {
  lerpGrad(ctx, w, h, [[0, "#dff1f5"], [0.5, "#8fc1d4"], [1, "#3f6f86"]]);
  ctx.fillStyle = "#6f99ad";
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * 0.25, h * 0.45); ctx.lineTo(w * 0.5, h * 0.78); ctx.lineTo(w * 0.78, h * 0.4); ctx.lineTo(w, h * 0.72); ctx.lineTo(w, h); ctx.fill();
  ctx.fillStyle = "#41687d";
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * 0.4, h * 0.55); ctx.lineTo(w * 0.62, h * 0.82); ctx.lineTo(w, h * 0.5); ctx.lineTo(w, h); ctx.fill();
  ctx.fillStyle = "#fbf5e6";
  ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.55); ctx.lineTo(w * 0.34, h * 0.64); ctx.lineTo(w * 0.46, h * 0.64); ctx.fill();
};

const city = (ctx, w, h) => {
  const rnd = rng(42);
  lerpGrad(ctx, w, h, [[0, "#1b2a52"], [0.55, "#33305f"], [1, "#5a2c52"]]);
  ctx.fillStyle = "#f4ead2";
  ctx.beginPath(); ctx.arc(w * 0.82, h * 0.22, w * 0.06, 0, 7); ctx.fill();
  let x = 0;
  while (x < w) {
    const bw = w * (0.05 + rnd() * 0.05);
    const bh = h * (0.2 + rnd() * 0.42);
    ctx.fillStyle = "#16203f";
    ctx.fillRect(x, h - bh, bw, bh);
    ctx.fillStyle = "rgba(233,168,59,.85)";
    for (let wy = h - bh + 12; wy < h - 12; wy += 22)
      for (let wx = x + 8; wx < x + bw - 8; wx += 18)
        if (rnd() > 0.45) ctx.fillRect(wx, wy, 7, 10);
    x += bw + w * 0.008;
  }
};

export const TEMPLATES = [
  { id: "seaside", name: "海边 COAST",  defaultHeadline: "THE COAST", sub: "海边 · SEASIDE",      draw: seaside },
  { id: "sunset",  name: "黄昏 SUNSET", defaultHeadline: "SUNSET",    sub: "黄昏 · GOLDEN HOUR",  draw: sunset },
  { id: "alpine",  name: "雪山 ALPS",   defaultHeadline: "THE ALPS",  sub: "山间 · ALPINE",       draw: alpine },
  { id: "city",    name: "都市 CITY",   defaultHeadline: "THE CITY",  sub: "都市 · CITY LIGHTS",  draw: city },
];
