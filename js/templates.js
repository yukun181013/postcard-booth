/* ============================================================
   templates.js — 红色 / 建党105周年 postcard backdrops, drawn
   on a canvas (red + gold). Each carries a 红色经典 couplet
   that app.js paints as vertical brush calligraphy.
   ============================================================ */

const GOLD = "#e8c86a";

function redBg(ctx, w, h, fx = 0.5, fy = 0.34) {
  const g = ctx.createRadialGradient(w * fx, h * fy, h * 0.05, w * 0.5, h * 0.62, h * 1.15);
  g.addColorStop(0, "#c8302f");
  g.addColorStop(0.55, "#b81c22");
  g.addColorStop(1, "#7c1216");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// radiating sunburst behind the focal symbol
function rays(ctx, w, h, cx, cy) {
  ctx.save(); ctx.translate(cx, cy);
  const n = 24, R = Math.hypot(w, h);
  for (let i = 0; i < n; i++) {
    ctx.rotate((Math.PI * 2) / n);
    ctx.fillStyle = i % 2 ? "rgba(255,232,175,.05)" : "rgba(232,200,106,.10)";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, -R * 0.055); ctx.lineTo(R, R * 0.055); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function star(ctx, cx, cy, r, fill, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = rot + i * 2 * Math.PI / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a2) * r * 0.4, cy + Math.sin(a2) * r * 0.4);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}

function bottomShade(ctx, w, h) {
  const g = ctx.createLinearGradient(0, h * 0.6, 0, h);
  g.addColorStop(0, "rgba(70,12,16,0)"); g.addColorStop(1, "rgba(70,12,16,.5)");
  ctx.fillStyle = g; ctx.fillRect(0, h * 0.6, w, h * 0.4);
}

/* 1 · 星辉 — big gold star + small stars (flag motif) */
const bdStar = (ctx, w, h) => {
  redBg(ctx, w, h, 0.52, 0.32);
  rays(ctx, w, h, w * 0.52, h * 0.34);
  star(ctx, w * 0.52, h * 0.34, w * 0.12, GOLD);
  // four small stars arcing around, each rotated to face the big one
  const big = { x: w * 0.52, y: h * 0.34 };
  [[0.66, 0.16], [0.72, 0.3], [0.7, 0.46], [0.6, 0.56]].forEach(([px, py]) => {
    const x = w * px, y = h * py;
    star(ctx, x, y, w * 0.028, GOLD, Math.atan2(big.y - y, big.x - x) - Math.PI / 2 + Math.PI / 2);
  });
  bottomShade(ctx, w, h);
};

/* 2 · 天安门 — gate silhouette + 华表 + rays */
const bdGate = (ctx, w, h) => {
  redBg(ctx, w, h, 0.5, 0.28);
  rays(ctx, w, h, w * 0.5, h * 0.3);
  const dark = "#6e1014", base = h * 0.82;
  // 华表 columns
  ctx.fillStyle = "rgba(232,200,106,.55)";
  [0.2, 0.8].forEach((px) => { ctx.fillRect(w * px - w * 0.006, h * 0.5, w * 0.012, base - h * 0.5); });
  // 城台
  ctx.fillStyle = dark;
  ctx.fillRect(w * 0.3, base, w * 0.4, h - base);
  ctx.fillRect(w * 0.32, base - h * 0.04, w * 0.36, h * 0.04);
  // arch doorways
  ctx.fillStyle = "rgba(40,6,8,.6)";
  for (let i = -2; i <= 2; i++) {
    const cx = w * 0.5 + i * w * 0.066, aw = i === 0 ? w * 0.03 : w * 0.022;
    ctx.fillRect(cx - aw / 2, base + h * 0.05, aw, h - base - h * 0.05);
  }
  // 城楼 building + double-eave roof
  ctx.fillStyle = dark;
  ctx.fillRect(w * 0.37, base - h * 0.2, w * 0.26, h * 0.16);
  const roof = (yTop, half, drop) => { ctx.beginPath(); ctx.moveTo(w * 0.5 - half, yTop + drop); ctx.lineTo(w * 0.5, yTop); ctx.lineTo(w * 0.5 + half, yTop + drop); ctx.lineTo(w * 0.5 + half * 0.86, yTop + drop); ctx.lineTo(w * 0.5 - half * 0.86, yTop + drop); ctx.closePath(); ctx.fill(); };
  ctx.fillStyle = GOLD;
  roof(base - h * 0.24, w * 0.2, h * 0.05);
  roof(base - h * 0.32, w * 0.15, h * 0.045);
  bottomShade(ctx, w, h);
};

/* 3 · 长城 — Great Wall over ridges */
const bdWall = (ctx, w, h) => {
  redBg(ctx, w, h, 0.5, 0.3);
  rays(ctx, w, h, w * 0.5, h * 0.26);
  // distant hills
  ctx.fillStyle = "rgba(70,12,16,.45)";
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * 0.62); ctx.quadraticCurveTo(w * 0.3, h * 0.5, w * 0.6, h * 0.62); ctx.quadraticCurveTo(w * 0.85, h * 0.7, w, h * 0.58); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  // wall along a ridge
  const dark = "#641013";
  ctx.strokeStyle = dark; ctx.fillStyle = dark; ctx.lineWidth = h * 0.05;
  ctx.lineJoin = "round";
  const ry = (x) => h * (0.66 - 0.12 * Math.sin(x * Math.PI * 1.2) - 0.04 * x);
  ctx.beginPath(); ctx.moveTo(0, ry(0));
  for (let t = 0; t <= 1.001; t += 0.05) ctx.lineTo(w * t, ry(t));
  ctx.stroke();
  // crenellations + towers
  for (let t = 0; t <= 1.0; t += 0.06) {
    const x = w * t, y = ry(t);
    ctx.fillRect(x - w * 0.008, y - h * 0.06, w * 0.016, h * 0.03);
    if (Math.abs((t * 100) % 24) < 2) ctx.fillRect(x - w * 0.02, y - h * 0.11, w * 0.04, h * 0.1);
  }
  bottomShade(ctx, w, h);
};

/* 4 · 红旗 — flying flags + stars */
const bdFlags = (ctx, w, h) => {
  redBg(ctx, w, h, 0.4, 0.34);
  rays(ctx, w, h, w * 0.45, h * 0.36);
  const flag = (x, y, sw, sh, col) => {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + sw * 0.33, y - sh * 0.18, x + sw * 0.66, y + sh * 0.2, x + sw, y - sh * 0.05);
    ctx.lineTo(x + sw, y + sh * 0.9);
    ctx.bezierCurveTo(x + sw * 0.66, y + sh * 1.1, x + sw * 0.33, y + sh * 0.72, x, y + sh * 0.9);
    ctx.closePath(); ctx.fill();
  };
  flag(w * 0.16, h * 0.2, w * 0.5, h * 0.34, "rgba(150,16,20,.85)");
  flag(w * 0.26, h * 0.16, w * 0.52, h * 0.34, "#9e1418");
  flag(w * 0.36, h * 0.12, w * 0.5, h * 0.34, "#c8302f");
  // gold stars on the front flag
  star(ctx, w * 0.5, h * 0.27, w * 0.05, GOLD);
  [[0.6, 0.2], [0.64, 0.27], [0.62, 0.35], [0.55, 0.39]].forEach(([px, py]) => star(ctx, w * px, h * py, w * 0.016, GOLD));
  // flagpole
  ctx.strokeStyle = "rgba(232,200,106,.6)"; ctx.lineWidth = w * 0.006;
  ctx.beginPath(); ctx.moveTo(w * 0.16, h * 0.16); ctx.lineTo(w * 0.16, h * 0.95); ctx.stroke();
  bottomShade(ctx, w, h);
};

export const TEMPLATES = [
  { id: "star",  name: "星辉",   poem: ["为有牺牲多壮志", "敢教日月换新天"], draw: bdStar },
  { id: "gate",  name: "天安门", poem: ["数风流人物", "还看今朝"],         draw: bdGate },
  { id: "wall",  name: "长城",   poem: ["红军不怕远征难", "万水千山只等闲"], draw: bdWall },
  { id: "flags", name: "红旗",   poem: ["雄关漫道真如铁", "而今迈步从头越"], draw: bdFlags },
];
