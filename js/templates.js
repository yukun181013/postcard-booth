/* ============================================================
   templates.js — 红色 / 建党105周年 postcard backdrops.
   Real photos (Wikimedia Commons, freely licensed) pre-toned
   to a 红金庆典 wash — see CREDITS.md. Each carries a 红色经典
   couplet that app.js paints as vertical gold brush calligraphy.
   ============================================================ */

export const TEMPLATES = [
  { id: "gate",   name: "天安门",   poem: ["数风流人物", "还看今朝"],            src: "img/gate.jpg" },
  { id: "wall",   name: "长城",     poem: ["红军不怕远征难", "万水千山只等闲"],  src: "img/wall.jpg" },
  { id: "campus", name: "莆田学院", poem: ["恰同学少年", "风华正茂"],            src: "img/campus.jpg" },
  { id: "mazu",   name: "湄洲妈祖", poem: ["海不扬波", "国泰民安"],              src: "img/mazu.jpg" },
];

// preload every backdrop; resolves once all are loaded (errors tolerated)
export function loadTemplateImages() {
  return Promise.all(TEMPLATES.map((t) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { t.img = img; res(); };
    img.onerror = () => { t.img = null; res(); };
    img.src = new URL(t.src, document.baseURI).href;
  })));
}

// draw a template's photo backdrop, cover-fit (images are already 3:2 + toned)
export function drawBackdrop(ctx, w, h, tpl) {
  const img = tpl && tpl.img;
  if (img && img.width) {
    const s = Math.max(w / img.width, h / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    // fallback: solid festive red if the photo failed to load
    const g = ctx.createRadialGradient(w * 0.5, h * 0.34, h * 0.05, w * 0.5, h * 0.62, h * 1.15);
    g.addColorStop(0, "#c8302f"); g.addColorStop(0.55, "#b81c22"); g.addColorStop(1, "#7c1216");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}
