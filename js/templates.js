/* ============================================================
   templates.js — 水墨 (ink-wash) postcard backdrops, drawn on
   a canvas. Each carries a classical 诗句 (poem) that app.js
   paints as vertical brush calligraphy.
   ============================================================ */

const PAPER = "#f0e6d2";

function paper(ctx, w, h) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  // faint warm vignette
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, h * 0.1, w * 0.5, h * 0.5, h * 0.9);
  g.addColorStop(0, "rgba(255,250,238,.5)");
  g.addColorStop(1, "rgba(196,180,150,.18)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// smooth mountain ridge through normalised points [[x,y]...] (0..1), filled to bottom
function ridge(ctx, w, h, pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(pts[0][0] * w, pts[0][1] * h);
  for (let i = 1; i < pts.length; i++) {
    const px = pts[i - 1][0] * w, py = pts[i - 1][1] * h;
    const x = pts[i][0] * w, y = pts[i][1] * h;
    ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

// paper-coloured fog band that softens whatever is behind it
function mist(ctx, w, h, y0, y1) {
  const g = ctx.createLinearGradient(0, h * y0, 0, h * y1);
  g.addColorStop(0, "rgba(240,230,210,.9)");
  g.addColorStop(1, "rgba(240,230,210,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, h * y0, w, h * (y1 - y0));
}

const farMountains = (ctx, w, h) => {
  paper(ctx, w, h);
  ridge(ctx, w, h, [[0, .46], [.18, .4], [.34, .46], [.5, .37], [.7, .45], [.86, .39], [1, .46]], "rgba(120,140,142,.30)");
  mist(ctx, w, h, .42, .58);
  ridge(ctx, w, h, [[0, .6], [.2, .5], [.4, .6], [.6, .49], [.8, .58], [1, .52]], "rgba(74,96,100,.42)");
  mist(ctx, w, h, .58, .74);
  ridge(ctx, w, h, [[0, .8], [.25, .66], [.5, .82], [.75, .66], [1, .8]], "rgba(40,54,58,.58)");
  // faint vermilion sun
  ctx.fillStyle = "rgba(158,52,42,.45)";
  ctx.beginPath(); ctx.arc(w * 0.76, h * 0.24, w * 0.045, 0, 7); ctx.fill();
};

const riverBoat = (ctx, w, h) => {
  paper(ctx, w, h);
  ridge(ctx, w, h, [[0, .4], [.3, .34], [.6, .41], [.85, .35], [1, .41]], "rgba(120,140,142,.30)");
  ridge(ctx, w, h, [[0, .5], [.35, .44], [.7, .5], [1, .45]], "rgba(80,100,104,.30)");
  mist(ctx, w, h, .4, .6);
  // water — faint horizontal strokes
  ctx.strokeStyle = "rgba(90,110,114,.16)"; ctx.lineWidth = Math.max(1, w * 0.0016);
  for (const yy of [.64, .7, .75, .82, .9]) {
    ctx.beginPath(); ctx.moveTo(w * 0.08, h * yy); ctx.lineTo(w * 0.62, h * yy); ctx.stroke();
  }
  // lone boat
  ctx.strokeStyle = "rgba(40,40,38,.7)"; ctx.fillStyle = "rgba(40,40,38,.7)";
  ctx.lineWidth = Math.max(1, w * 0.003);
  const bx = w * 0.26, by = h * 0.72, bw = w * 0.1;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + bw / 2, by + h * 0.03, bx + bw, by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + bw * 0.5, by); ctx.lineTo(bx + bw * 0.5, by - h * 0.06); ctx.stroke(); // pole
};

const moonMountain = (ctx, w, h) => {
  paper(ctx, w, h);
  // moon
  ctx.fillStyle = "rgba(247,241,227,1)";
  ctx.beginPath(); ctx.arc(w * 0.7, h * 0.27, w * 0.08, 0, 7); ctx.fill();
  ctx.strokeStyle = "rgba(150,140,120,.3)"; ctx.lineWidth = Math.max(1, w * 0.002);
  ctx.beginPath(); ctx.arc(w * 0.7, h * 0.27, w * 0.08, 0, 7); ctx.stroke();
  mist(ctx, w, h, .34, .5);
  ridge(ctx, w, h, [[0, .68], [.22, .54], [.46, .72], [.72, .5], [1, .66]], "rgba(56,68,72,.5)");
  ridge(ctx, w, h, [[0, .84], [.3, .72], [.6, .86], [1, .74]], "rgba(34,44,48,.62)");
};

const cloudPeak = (ctx, w, h) => {
  paper(ctx, w, h);
  // distant peaks
  ridge(ctx, w, h, [[0, .5], [.2, .4], [.4, .5], [.65, .38], [.85, .47], [1, .42]], "rgba(120,140,142,.28)");
  // tall central peak
  ctx.fillStyle = "rgba(60,74,78,.55)";
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h); ctx.lineTo(w * 0.5, h * 0.18); ctx.lineTo(w * 0.68, h); ctx.closePath(); ctx.fill();
  // snow/light on peak
  ctx.fillStyle = "rgba(247,241,227,.9)";
  ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.18); ctx.lineTo(w * 0.45, h * 0.3); ctx.lineTo(w * 0.55, h * 0.3); ctx.closePath(); ctx.fill();
  // sea of clouds
  ctx.fillStyle = "rgba(247,241,227,.92)";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  for (let x = 0; x <= 1.0001; x += 0.1) ctx.quadraticCurveTo(w * (x + 0.05), h * (0.58 + (x % 0.2 ? 0.04 : -0.02)), w * (x + 0.1), h * 0.62);
  ctx.lineTo(w, h * 0.78); ctx.lineTo(0, h * 0.78); ctx.closePath(); ctx.fill();
  mist(ctx, w, h, .6, .72);
};

export const TEMPLATES = [
  { id: "farmtn", name: "远山", poem: ["采菊东篱下", "悠然见南山"], draw: farMountains },
  { id: "river",  name: "江帆", poem: ["海内存知己", "天涯若比邻"], draw: riverBoat },
  { id: "moon",   name: "明月", poem: ["海上生明月", "天涯共此时"], draw: moonMountain },
  { id: "peak",   name: "云峰", poem: ["会当凌绝顶", "一览众山小"], draw: cloudPeak },
];
