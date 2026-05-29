/* ============================================================
   templates.js — postcard backdrops drawn on a canvas
   (no image assets needed). Each template fills the whole
   scene + paints the "GREETINGS FROM ___" headline.
   ============================================================ */

function lerpGrad(ctx, w, h, stops, vertical = true) {
  const g = vertical ? ctx.createLinearGradient(0, 0, 0, h)
                     : ctx.createLinearGradient(0, 0, w, 0);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function headline(ctx, w, h, big, sub) {
  const u = w / 1000; // scale unit
  ctx.save();
  ctx.textAlign = "center";

  // "Greetings from" script
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.font = `${64 * u}px "Yellowtail", cursive`;
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 12 * u;
  ctx.fillText("Greetings from", w / 2, 86 * u);

  // big slab headline
  ctx.font = `${112 * u}px "Alfa Slab One", serif`;
  ctx.shadowBlur = 18 * u;
  ctx.shadowOffsetY = 4 * u;
  ctx.fillText(big, w / 2, 196 * u);

  if (sub) {
    ctx.shadowBlur = 6 * u;
    ctx.font = `700 ${24 * u}px "Space Mono", monospace`;
    ctx.fillText(sub, w / 2, 236 * u);
  }
  ctx.restore();
}

const seaside = (ctx, w, h) => {
  lerpGrad(ctx, w, h, [[0, "#9fe3df"], [0.45, "#3fb6ae"], [0.46, "#0c8b8a"], [1, "#075f63"]]);
  // sun
  ctx.fillStyle = "#e9a83b";
  ctx.beginPath(); ctx.arc(w * 0.8, h * 0.26, w * 0.075, 0, 7); ctx.fill();
  // sun glow
  ctx.fillStyle = "rgba(233,168,59,.25)";
  ctx.beginPath(); ctx.arc(w * 0.8, h * 0.26, w * 0.12, 0, 7); ctx.fill();
  // glints on water
  ctx.fillStyle = "rgba(255,255,255,.28)";
  for (let i = 0; i < 7; i++) {
    const y = h * (0.55 + i * 0.06);
    ctx.fillRect(w * (0.1 + Math.random() * 0.7), y, w * (0.06 + Math.random() * 0.18), 3);
  }
  headline(ctx, w, h, "THE COAST", "海边 · 17°C · 晴");
};

const sunset = (ctx, w, h) => {
  lerpGrad(ctx, w, h, [[0, "#f6c14b"], [0.4, "#ef7a3c"], [0.75, "#e8503a"], [1, "#7c2d4a"]]);
  // big low sun
  ctx.fillStyle = "rgba(255,240,200,.95)";
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.62, w * 0.16, 0, 7); ctx.fill();
  // sea band
  ctx.fillStyle = "rgba(60,20,50,.55)";
  ctx.fillRect(0, h * 0.74, w, h * 0.26);
  // palm silhouettes
  ctx.strokeStyle = "#2b1326"; ctx.fillStyle = "#2b1326"; ctx.lineWidth = w * 0.012;
  [0.12, 0.9].forEach((px) => {
    const x = w * px, base = h * 0.78;
    ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + w * 0.01, h * 0.5, x - w * 0.01, h * 0.4); ctx.stroke();
    for (let a = -2; a <= 2; a++) {
      ctx.beginPath(); ctx.moveTo(x - w * 0.01, h * 0.4);
      ctx.quadraticCurveTo(x + a * w * 0.04, h * 0.34, x + a * w * 0.075, h * 0.4 + Math.abs(a) * h * 0.02); ctx.lineWidth = w * 0.018; ctx.stroke();
    }
  });
  headline(ctx, w, h, "SUNSET", "黄昏 · 慢下来");
};

const alpine = (ctx, w, h) => {
  lerpGrad(ctx, w, h, [[0, "#dff1f5"], [0.5, "#8fc1d4"], [1, "#3f6f86"]]);
  // far range
  ctx.fillStyle = "#6f99ad";
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * 0.25, h * 0.45); ctx.lineTo(w * 0.5, h * 0.78); ctx.lineTo(w * 0.78, h * 0.4); ctx.lineTo(w, h * 0.72); ctx.lineTo(w, h); ctx.fill();
  // near peaks
  ctx.fillStyle = "#41687d";
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * 0.4, h * 0.55); ctx.lineTo(w * 0.62, h * 0.82); ctx.lineTo(w, h * 0.5); ctx.lineTo(w, h); ctx.fill();
  // snow caps
  ctx.fillStyle = "#fbf5e6";
  ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.55); ctx.lineTo(w * 0.34, h * 0.64); ctx.lineTo(w * 0.46, h * 0.64); ctx.fill();
  headline(ctx, w, h, "THE ALPS", "山间 · 海拔 2400m");
};

const city = (ctx, w, h) => {
  lerpGrad(ctx, w, h, [[0, "#1b2a52"], [0.55, "#33305f"], [1, "#5a2c52"]]);
  // moon
  ctx.fillStyle = "#f4ead2";
  ctx.beginPath(); ctx.arc(w * 0.82, h * 0.22, w * 0.06, 0, 7); ctx.fill();
  // skyline
  let x = 0;
  while (x < w) {
    const bw = w * (0.05 + Math.random() * 0.05);
    const bh = h * (0.2 + Math.random() * 0.42);
    ctx.fillStyle = "#16203f";
    ctx.fillRect(x, h - bh, bw, bh);
    // windows
    ctx.fillStyle = "rgba(233,168,59,.85)";
    for (let wy = h - bh + 12; wy < h - 12; wy += 22)
      for (let wx = x + 8; wx < x + bw - 8; wx += 18)
        if (Math.random() > 0.45) ctx.fillRect(wx, wy, 7, 10);
    x += bw + w * 0.008;
  }
  headline(ctx, w, h, "THE CITY", "都市 · 不夜");
};

export const TEMPLATES = [
  { id: "seaside", name: "海边 COAST", draw: seaside },
  { id: "sunset",  name: "黄昏 SUNSET", draw: sunset },
  { id: "alpine",  name: "雪山 ALPS",   draw: alpine },
  { id: "city",    name: "都市 CITY",   draw: city },
];
