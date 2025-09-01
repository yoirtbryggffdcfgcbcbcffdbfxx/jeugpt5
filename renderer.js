// renderer.js : fond roche parallax (visible uniquement dans la lumière),
// map + objets clippés au FOV, joueur "citrouille cubique" (unique skin),
// helpers bruit/roche/cracks, FOG offscreen (optionnel si tu l'appelles encore)

const Render = {
  tileSize: 40,
  worldWidth: 2000,
  worldHeight: 800,
  time: 0,

  // Couleurs diveres (garde pour d’autres objets)
  palette: {
    block: "#8a4f2d", dirt: "#7a3e22",
    grass: "#2e7d32", grassLight: "#43a047",
    lavaTop: "#ffb703", lavaBottom: "#fb5607",
    goal: "#ffd166", outline: "rgba(0,0,0,0.15)"
  },
  doorColor: { y:"#f2c94c", b:"#64b5f6", r:"#ef5350", g:"#66bb6a", default:"#5d4037" },
  keyColor:  { y:"#f2c94c", b:"#64b5f6", r:"#ef5350", g:"#66bb6a", default:"#ffd166" },

  // Caches offscreen
  _fog:      { canvas: null, ctx: null, W: 0, H: 0 },
  _rockTile: { canvas: null, pattern: null, size: 512 }
};

// -------------------- Init --------------------
function initRenderer({ tileSize, cols, rows }) {
  Render.tileSize   = tileSize;
  Render.worldWidth = cols * tileSize;
  Render.worldHeight= rows * tileSize;
}

// -------------------- Background (noir hors lumière + mur parallax dans la lumière) --------------------
function renderBackground(ctx, camera, now, player) {
  // noir total
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // mur roche parallax dans la lumière uniquement
  drawWallParallaxLit(ctx, camera, player, { vignetteInside: true });
}

// parallax roche + halo intérieur, clippés au FOV
function drawWallParallaxLit(ctx, camera, player, opt = {}) {
  const { vignetteInside = false } = opt;
  const visiblePath = buildVisiblePath(camera);
  if (!visiblePath) return;

  ctx.save();
  ctx.clip(visiblePath);

  const tile = getRockPattern(512);
  drawRockLayer(ctx, camera, tile, 0.08, 0.55);
  drawRockLayer(ctx, camera, tile, 0.13, 0.70);
  drawRockLayer(ctx, camera, tile, 0.18, 0.85);

  if (player) {
    const cx = (player.x + player.width/2) - camera.x;
    const cy = (player.y + player.height/2) - camera.y;
    const r0 = Render.tileSize * (Math.max(1, (FOV.radius||4) - 0.6));
    const r1 = r0 * 1.35;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r1);
    g.addColorStop(0.0, "rgba(0,0,0,0.0)");
    g.addColorStop(1.0, "rgba(0,0,0,0.80)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  if (vignetteInside) {
    const cxv = ctx.canvas.width / 2, cyv = ctx.canvas.height / 2;
    const vg = ctx.createRadialGradient(
      cxv, cyv, Math.min(ctx.canvas.width, ctx.canvas.height) * 0.35,
      cxv, cyv, Math.max(ctx.canvas.width, ctx.canvas.height) * 0.85
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  ctx.restore();
}

// tile roche procédurale répétable
function getRockPattern(size = 512) {
  const R = Render._rockTile;
  if (!R.canvas || R.size !== size) buildRockTile(size);
  return Render._rockTile;
}
function buildRockTile(S) {
  const cnv = document.createElement("canvas");
  cnv.width = cnv.height = S;
  const c = cnv.getContext("2d");

  const g = c.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, "#1a1d22");
  g.addColorStop(1, "#0f1216");
  c.fillStyle = g; c.fillRect(0, 0, S, S);

  const H = new Float32Array(S * S);
  const oct = 4, lac=2, gain=0.5, baseScale=110;
  for (let y=0;y<S;y++) for (let x=0;x<S;x++){
    let amp=1, freq=1, h=0, norm=0;
    for (let o=0;o<oct;o++){
      h += amp * valueNoise2D(x/(baseScale/freq), y/(baseScale/freq), 777+o*97);
      norm += amp; amp*=gain; freq*=lac;
    }
    h/=norm;
    const rid=1-Math.abs(2*h-1);
    H[y*S+x]= clamp01(0.6*h + 0.4*Math.pow(rid,1.5));
  }

  const img = c.createImageData(S,S);
  const light = normalize3([-0.6,-0.8,1]);
  const k = 2.0;
  for (let y=0;y<S;y++) for (let x=0;x<S;x++){
    const i = y*S+x;
    const hx = H[y*S+((x+1)%S)]-H[i];
    const hy = H[((y+1)%S)*S+x]-H[i];
    const n = normalize3([-hx*k, -hy*k, 1]);
    const diff = Math.max(0.15, dot3(n, light));
    const col = rampRock(H[i]);
    const r = Math.round(clamp01(col[0]*diff)*255);
    const g2= Math.round(clamp01(col[1]*diff)*255);
    const b = Math.round(clamp01(col[2]*diff)*255);
    const p = i*4; img.data[p]=r; img.data[p+1]=g2; img.data[p+2]=b; img.data[p+3]=255;
  }
  c.putImageData(img,0,0);

  c.globalAlpha=0.05;
  const patNoise = createNoisePattern(128,128,18);
  c.fillStyle = patNoise; c.fillRect(0,0,S,S);
  c.globalAlpha=1;

  Render._rockTile.canvas = cnv;
  Render._rockTile.pattern = c.createPattern(cnv, "repeat");
  Render._rockTile.size = S;
}
function drawRockLayer(ctx, camera, tile, parallax, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const dx = -((camera.x * parallax) % tile.size) - tile.size;
  const dy = -((camera.y * parallax) % tile.size) - tile.size;
  ctx.translate(dx, dy);
  ctx.fillStyle = tile.pattern;
  ctx.fillRect(0, 0, ctx.canvas.width + tile.size*2, ctx.canvas.height + tile.size*2);
  ctx.restore();
}

// path FOV des tuiles visibles
function buildVisiblePath(camera) {
  const path = new Path2D();
  const ts = Render.tileSize;
  const list = (typeof FOV !== "undefined" && FOV.visibleList) ? FOV.visibleList : [];
  for (const v of list) {
    const x = Math.floor(v.c * ts - camera.x);
    const y = Math.floor(v.r * ts - camera.y);
    path.rect(x, y, ts, ts);
  }
  return path;
}

// -------------------- Rendu MAP (clippée au FOV) --------------------
function renderObjects(ctx, camera, now) {
  const margin = 80;
  const clipPath = buildVisiblePath(camera);

  // 1) tuiles ground/block
  ctx.save();
  if (clipPath) ctx.clip(clipPath);
  for (const obj of objects) {
    if (obj.x + obj.width < camera.x - margin || obj.x > camera.x + camera.width + margin) continue;
    const x = obj.x - camera.x, y = obj.y - camera.y, w = obj.width, h = obj.height;
    if (obj.type === "ground") drawGroundTile(ctx, x, y, w, h, obj.x, obj.y);
    else if (obj.type === "block") drawBlockTile(ctx, x, y, w, h, obj.x, obj.y);
  }
  ctx.restore();

  // 2) objets/entités
  ctx.save();
  if (clipPath) ctx.clip(clipPath);
  for (const obj of objects) {
    if (obj.x + obj.width < camera.x - margin || obj.x > camera.x + camera.width + margin) continue;
    const x = obj.x - camera.x, y = obj.y - camera.y, w = obj.width, h = obj.height;
    switch (obj.type) {
      case "lava":       drawLavaTile(ctx, x, y, w, h, now); break;
      case "spikes":     drawSpikes(ctx, x, y, w, h); break;
      case "spikesDown": drawSpikesDown(ctx, x, y, w, h); break;
      case "door":       drawDoor(ctx, x, y, w, h, obj.open, obj.color); break;
      case "goal":       drawGoalTile(ctx, x, y, w, h); break;
      default: break;
    }
  }
  renderEntities(ctx, camera, now);
  ctx.restore();
}

// ====== Tuiles pierre (stone) ======
function drawGroundTile(ctx, x, y, w, h, wx=0, wy=0) {
  drawStoneTile(ctx, x, y, w, h, wx, wy, { darker: 0.04, crackProb: 0.20 });
}
function drawBlockTile(ctx, x, y, w, h, wx=0, wy=0) {
  drawStoneTile(ctx, x, y, w, h, wx, wy, { darker: 0.00, crackProb: 0.12 });
}
function drawStoneTile(ctx, x, y, w, h, wx, wy, opt={}) {
  const darker     = opt.darker ?? 0.0;
  const crackProb  = opt.crackProb ?? 0.15;

  const s = 60;
  let n=0, amp=1, freq=1, norm=0;
  for (let o=0;o<4;o++){
    n += amp * valueNoise2D(wx/(s/freq), wy/(s/freq), 500+o*17);
    norm += amp; amp*=0.5; freq*=2.0;
  }
  n/=norm; n=Math.pow(n,1.2);
  const base = mixGray(0x2a, 0x74, n);
  const bR = Math.max(0, Math.round(base[0]*(1-darker*0.8)));
  const bG = Math.max(0, Math.round(base[1]*(1-darker*0.8)));
  const bB = Math.max(0, Math.round(base[2]*(1-darker*0.8)));
  ctx.fillStyle = rgb(bR,bG,bB);
  ctx.fillRect(x, y, w, h);

  const cx = x + w*0.5, cy = y + h*0.5;
  const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(w,h));
  rg.addColorStop(0, "rgba(255,255,255,0.04)");
  rg.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = rg; ctx.fillRect(x,y,w,h);

  ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = "rgba(0,0,0,0.18)";       ctx.fillRect(x, y+h-2, w, 2);
  ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = "rgba(0,0,0,0.15)";       ctx.fillRect(x+w-2, y, 2, h);

  if ((((wx * 73856093) ^ (wy * 19349663)) >>> 0) % 100 < crackProb*100) {
    const len = 14 + (wx + wy) % 18;
    const ang = ((wx ^ wy) % 360) * Math.PI / 180;
    drawCrack(ctx, x + 6, y + h*0.5, len, ang, {
      color: "rgba(0,0,0,0.22)",
      light: "rgba(255,255,255,0.04)",
      wiggle: 4, segMin: 5, segMax: 8
    });
  }
}
function mixGray(a,b,t){ const v=Math.round(a+(b-a)*t); return [v,v,v]; }
function rgb(r,g,b){ return `rgb(${r},${g},${b})`; }

// -------------------- OBJETS --------------------
function drawLavaTile(ctx, x, y, w, h, now) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, Render.palette.lavaTop);
  g.addColorStop(1, Render.palette.lavaBottom);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath(); ctx.moveTo(x, y + 6);
  for (let i = 0; i <= w; i++) {
    const sy = Math.sin((i + now * 6) * 0.12) * 3;
    ctx.lineTo(x + i, y + 6 + sy);
  }
  ctx.lineTo(x + w, y); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
}
function drawSpikes(ctx, x, y, w, h) {
  const apexY = y + Math.max(4, h * 0.12);
  const baseMarginX = Math.max(4, w * 0.12);
  const baseY = y + h - 1;
  const leftX = x + baseMarginX, rightX = x + w - baseMarginX, midX = x + w/2;
  const grad = ctx.createLinearGradient(0, apexY, 0, baseY);
  grad.addColorStop(0, "#8fa7ba"); grad.addColorStop(1, "#6e8194");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(midX, apexY); ctx.lineTo(rightX, baseY); ctx.lineTo(leftX, baseY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(midX, apexY); ctx.lineTo(rightX, baseY); ctx.lineTo(leftX, baseY); ctx.closePath(); ctx.stroke();
}
function drawSpikesDown(ctx, x, y, w, h) {
  const baseMarginX = Math.max(4, w * 0.12);
  const baseY = y + 1;
  const leftX  = x + baseMarginX, rightX = x + w - baseMarginX, midX = x + w/2;
  const apexY  = y + h - Math.max(4, h * 0.12);
  const grad = ctx.createLinearGradient(0, baseY, 0, apexY);
  grad.addColorStop(0, "#8fa7ba"); grad.addColorStop(1, "#6e8194");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(midX, apexY); ctx.lineTo(rightX, baseY); ctx.lineTo(leftX, baseY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(midX, apexY); ctx.lineTo(rightX, baseY); ctx.lineTo(leftX, baseY); ctx.closePath(); ctx.stroke();
}
function drawDoor(ctx, x, y, w, h, open=false, color=null){
  if (open) { ctx.strokeStyle="rgba(0,0,0,0.25)"; ctx.lineWidth=2; ctx.strokeRect((x|0)+0.5,(y|0)+0.5,w-1,h-1); return; }
  const col = Render.doorColor[color] || Render.doorColor.default;
  ctx.fillStyle = col; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(x,y,w,(h*0.18)|0);
  ctx.fillStyle = "rgba(0,0,0,0.08)";      ctx.fillRect(x, y + (h*0.18)|0, w, (h*0.82)|0);
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
  ctx.strokeRect((x|0)+0.5,(y|0)+0.5,w-1,h-1);
}
function drawGoalTile(ctx, x, y, w, h) {
  ctx.fillStyle = Render.palette.goal; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#f5e663"; ctx.fillRect(x + w/2 - 3, y - 46, 6, 46);
  ctx.fillStyle = "#e63946";
  ctx.beginPath(); ctx.moveTo(x + w/2 + 3, y - 46); ctx.lineTo(x + w/2 + 36, y - 36); ctx.lineTo(x + w/2 + 3, y - 26);
  ctx.closePath(); ctx.fill();
}

// -------------------- ENTITÉS --------------------
function renderEntities(ctx, camera, now) {
  for (const c of entities.coins){
    if (c.collected) continue;
    const x = c.x - camera.x, y = c.y - camera.y;
    const t = now*4 + (c.x*0.01);
    const bob = Math.sin(t)*2;
    ctx.fillStyle = "#ffd166";
    ctx.beginPath(); ctx.ellipse(x + c.width/2, y + c.height/2 + bob, 10, 14, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(x + c.width/2 + 4, y + c.height/2 - 6 + bob, 2, 6);
  }
  for (const k of entities.keys){
    if (k.picked) continue;
    const x = k.x - camera.x, y = k.y - camera.y;
    const bob = Math.sin(now*3 + k.x*0.02)*2;
    const col = Render.keyColor[k.color] || Render.keyColor.default;
    ctx.fillStyle = col;
    ctx.fillRect(x+4, y+8 + bob, 12, 8);
    ctx.beginPath(); ctx.arc(x+16, y+12 + bob, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(x+8, y+10 + bob, 3, 4);
  }
  for (const cp of entities.checkpoints){
    const x = cp.x - camera.x, y = cp.y - camera.y;
    ctx.fillStyle = cp.active ? "#90caf9" : "#ffe082";
    ctx.fillRect(x + Render.tileSize/2 - 8, y - 40, 6, 40);
    ctx.fillStyle = cp.active ? "#64b5f6" : "#ff7043";
    ctx.beginPath();
    ctx.moveTo(x + Render.tileSize/2 - 2, y - 40);
    ctx.lineTo(x + Render.tileSize/2 + 26, y - 32);
    ctx.lineTo(x + Render.tileSize/2 - 2, y - 24); ctx.closePath(); ctx.fill();
  }
}

// -------------------- JOUEUR (Citrouille cubique) --------------------
function renderPlayer(ctx, camera, player) {
  const x = player.x - camera.x, y = player.y - camera.y;
  const w = player.width, h = player.height;

  // Ombre
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.beginPath(); ctx.ellipse(x + w/2, y + h, w*0.45, 6, 0, 0, Math.PI*2); ctx.fill();

  drawPlayerPumpkin(ctx, x, y, w, h);
}

// Citrouille cubique (tête)
function drawPlayerPumpkin(ctx, x, y, w, h) {
  const r = Math.min(10, w * 0.22);

  // Base orange (dégradé chaud, sans rouge saturé)
  const base = ctx.createLinearGradient(x, y, x, y+h);
  base.addColorStop(0, "#ffa646");  // haut
  base.addColorStop(1, "#b15c06");  // bas
  ctx.fillStyle = base;
  roundRect(ctx, x, y, w, h, r, true);

  // Stries verticales (ridges)
  ctx.save();
  ctx.clip(); // découper dans le cube
  const ridges = 5;
  for (let i = 1; i <= ridges; i++) {
    const fx = x + (i/(ridges+1))*w;
    const grad = ctx.createLinearGradient(fx-6, y, fx+6, y);
    grad.addColorStop(0, "rgba(0,0,0,0.10)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.10)");
    grad.addColorStop(1, "rgba(0,0,0,0.10)");
    ctx.fillStyle = grad;
    ctx.fillRect(fx - 6, y+2, 12, h-4);
  }
  ctx.restore();

  // Tige verte
  const stemW = w * 0.22, stemH = h * 0.18;
  const sx = x + (w - stemW) / 2;
  const sy = y - stemH * 0.15;
  const sg = ctx.createLinearGradient(sx, sy, sx, sy+stemH);
  sg.addColorStop(0, "#6aa84f");
  sg.addColorStop(1, "#325a2c");
  ctx.fillStyle = sg;
  roundRect(ctx, sx, sy, stemW, stemH, 3, true);

  // Contour très discret du cube
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, r, false);

  // Visage (yeux triangles + bouche zigzag)
  ctx.fillStyle = "#0a0c10";
  // yeux
  const eY = y + h*0.35;
  const eW = w*0.16, eH = h*0.14, eGap = w*0.16;
  drawTri(ctx, x + w*0.50 - eGap, eY, eW, eH, -0.08); // gauche
  drawTri(ctx, x + w*0.50 + eGap, eY, eW, eH,  0.08); // droite
  // bouche en dents (zigzag)
  const mX = x + w*0.22, mY = y + h*0.64, mW = w*0.56, mH = h*0.18;
  drawMouthZigzag(ctx, mX, mY, mW, mH);

  // glow interne doux
  const gx = x + w*0.5, gy = y + h*0.58;
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w,h)*0.58);
  g.addColorStop(0, "rgba(255,220,120,0.18)");
  g.addColorStop(1, "rgba(255,220,120,0.00)");
  ctx.fillStyle = g;
  ctx.fillRect(x-8, y-8, w+16, h+16);
}

// petit triangle orienté
function drawTri(ctx, cx, cy, w, h, rot=0) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -h*0.5);
  ctx.lineTo(w*0.5, h*0.5);
  ctx.lineTo(-w*0.5, h*0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function drawMouthZigzag(ctx, x, y, w, h) {
  const teeth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i=0;i<teeth;i++) {
    const t = i/(teeth-1);
    const xx = x + t*w;
    const yy = y + ((i%2===0)? -h*0.5 : h*0.15);
    ctx.lineTo(xx, yy);
  }
  ctx.lineTo(x + w, y + h*0.35);
  ctx.lineTo(x, y + h*0.35);
  ctx.closePath();
  ctx.fill();
}

// -------------------- FOG offscreen (si utilisé) --------------------
const FogCfg = { outsideColor: "#000", useHalo: false, haloEdge: 1.2, haloEdgeAlpha: 0.35 };
function getFogLayer(ctx) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const F = Render._fog;
  if (!F.canvas || F.W !== W || F.H !== H) {
    F.canvas = document.createElement("canvas");
    F.canvas.width = W; F.canvas.height = H;
    F.ctx = F.canvas.getContext("2d");
    F.ctx.imageSmoothingEnabled = false;
    F.W = W; F.H = H;
  }
  return F;
}
function renderFog(ctx, camera, playerRef) {
  if (typeof FOV === "undefined" || !FOV.visibleList || FOV.visibleList.length === 0) return;
  const p = playerRef || (typeof window !== "undefined" ? window.player : null);
  if (!p) return;

  const ts = Render.tileSize;
  const { canvas: fogCanvas, ctx: fctx, W, H } = getFogLayer(ctx);

  fctx.setTransform(1,0,0,1,0,0);
  fctx.clearRect(0,0,W,H);
  fctx.fillStyle = FogCfg.outsideColor; fctx.fillRect(0,0,W,H);

  const path = new Path2D();
  for (const v of FOV.visibleList) {
    const x = Math.floor(v.c*ts - camera.x);
    const y = Math.floor(v.r*ts - camera.y);
    path.rect(x,y,ts,ts);
  }
  fctx.globalCompositeOperation = "destination-out";
  fctx.fill(path);

  if (FogCfg.useHalo) {
    fctx.globalCompositeOperation = "source-over";
    fctx.save(); fctx.clip(path,"nonzero");
    const cx = Math.floor((p.x+p.width/2)-camera.x);
    const cy = Math.floor((p.y+p.height/2)-camera.y);
    const r0 = Math.max(8,(FOV.radius-0.4)*ts);
    const r1 = r0 + ts*FogCfg.haloEdge;
    const g = fctx.createRadialGradient(cx,cy,r0,cx,cy,r1);
    g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,`rgba(0,0,0,${FogCfg.haloEdgeAlpha})`);
    fctx.fillStyle=g; fctx.fillRect(0,0,W,H);
    fctx.restore();
  }

  ctx.drawImage(fogCanvas,0,0);
}

// -------------------- Helpers (bruit/couleur/maths/cracks/roundRect/pattern) --------------------
function smoothstep(t){ return t*t*(3-2*t); }
function lerp(a,b,t){ return a + (b-a)*t; }
function hash2(ix,iy,seed=1){
  let h = (seed|0) ^ 0x27d4eb2d;
  h = Math.imul(h ^ (ix|0), 0x85ebca6b);
  h = Math.imul(h ^ (iy|0), 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2d);
  h ^= h >>> 13;
  return (h>>>0) / 4294967295;
}
function valueNoise2D(x,y,seed=1){
  const xi=Math.floor(x), yi=Math.floor(y);
  const xf=x-xi, yf=y-yi;
  const v00=hash2(xi,yi,seed), v10=hash2(xi+1,yi,seed);
  const v01=hash2(xi,yi+1,seed), v11=hash2(xi+1,yi+1,seed);
  const u=smoothstep(xf), v=smoothstep(yf);
  const x1=lerp(v00,v10,u), x2=lerp(v01,v11,v);
  return lerp(x1,x2,v);
}
function clamp01(v){ return Math.max(0, Math.min(1, v)); }
function dot3(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function normalize3(v){ const l=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/l,v[1]/l,v[2]/l]; }
function rampRock(h){
  const c1=[0x20/255,0x25/255,0x2b/255], c2=[0x38/255,0x3e/255,0x45/255], c3=[0x6a/255,0x72/255,0x7a/255];
  const t1=Math.min(1,h*1.3);
  const mid=[ lerp(c1[0],c2[0],t1), lerp(c1[1],c2[1],t1), lerp(c1[2],c2[2],t1) ];
  const t2=clamp01((h-0.5)*2);
  return [ lerp(mid[0],c3[0],t2), lerp(mid[1],c3[1],t2), lerp(mid[2],c3[2],t2) ];
}
function drawCrack(ctx, sx, sy, length, angle, opt){
  const { color, light, wiggle=8, segMin=8, segMax=18 } = opt||{};
  const segments=Math.max(3,Math.floor(length/((segMin+segMax)*0.5)));
  const pts=[]; let x=sx,y=sy,a=angle;
  for(let i=0;i<segments;i++){
    const seg=segMin+Math.random()*(segMax-segMin);
    const jitter=(Math.random()*wiggle - wiggle/2);
    a += jitter*0.02;
    x += Math.cos(a)*seg; y += Math.sin(a)*seg; pts.push({x,y});
  }
  ctx.strokeStyle=color||"rgba(0,0,0,0.28)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(sx,sy); for(const p of pts) ctx.lineTo(p.x,p.y); ctx.stroke();
  ctx.strokeStyle=light||"rgba(255,255,255,0.05)";
  ctx.beginPath(); ctx.moveTo(sx+0.5,sy+0.5); for(const p of pts) ctx.lineTo(p.x+0.5,p.y+0.5); ctx.stroke();
}
function roundRect(ctx, x, y, w, h, r, fill=true){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill(); else ctx.stroke();
}
// Grain (pattern répétable) pour texturer la roche
function createNoisePattern(w, h, alpha = 16) {
  const cnv = document.createElement("canvas");
  cnv.width = w; cnv.height = h;
  const c = cnv.getContext("2d");
  const img = c.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + ((Math.random() * 60) | 0);
    img.data[i]     = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = alpha;
  }
  c.putImageData(img, 0, 0);
  return c.createPattern(cnv, "repeat");
}

// Expose
if (typeof window !== "undefined") window.Render = Render;