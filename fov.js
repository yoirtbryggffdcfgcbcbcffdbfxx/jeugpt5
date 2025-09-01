// fov.js : FOV arrondi + occlusion "premier bloc" + couronne nearAlways autour du joueur

const FOV = {
  tileSize: 40,
  cols: 0,
  rows: 0,

  // portée en tuiles (rayon du disque de vision)
  radius: 6,

  // nombre de tuiles autour du joueur toujours visibles (couronne locale)
  nearAlways: 1,

  // liste des tuiles visibles [{c, r}]
  visibleList: [],

  // le sol (=) bloque-t-il la vue ? true = on ne voit pas derrière/au‑dessous
  GROUND_BLOCKS_SIGHT: true,

  init({ tileSize, cols, rows, radius, nearAlways }) {
    this.tileSize = tileSize;
    this.cols = cols;
    this.rows = rows;
    if (radius != null) this.radius = radius;
    if (nearAlways != null) this.nearAlways = nearAlways;
    this.visibleList = [];
  },

  // quels objets de la map bloquent la vue ?
  blocksSightType(obj) {
    if (obj.type === "door")  return !obj.open;                 // porte fermée = opaque
    if (obj.type === "block") return true;                      // mur = opaque
    if (obj.type === "ground") return this.GROUND_BLOCKS_SIGHT; // sol = opaque selon règle
    return false; // lava/spikes/goal/etc. n'obstruent pas
  },

  update(player) {
    // 1) Grille d'opacité à partir des objets
    const opaque = new Array(this.rows);
    for (let r = 0; r < this.rows; r++) opaque[r] = new Uint8Array(this.cols);

    for (const obj of objects) {
      const isOpaqueType =
        (obj.type === "door"  && !obj.open) ||
        (obj.type === "block") ||
        (obj.type === "ground" && this.GROUND_BLOCKS_SIGHT === true);
      if (!isOpaqueType) continue;

      const c0 = Math.floor(obj.x / this.tileSize);
      const r0 = Math.floor(obj.y / this.tileSize);
      const c1 = Math.floor((obj.x + obj.width  - 1) / this.tileSize);
      const r1 = Math.floor((obj.y + obj.height - 1) / this.tileSize);

      for (let rr = r0; rr <= r1; rr++) {
        if (rr < 0 || rr >= this.rows) continue;
        for (let cc = c0; cc <= c1; cc++) {
          if (cc < 0 || cc >= this.cols) continue;
          opaque[rr][cc] = 1;
        }
      }
    }

    const isOpaque = (r, c) =>
      (r >= 0 && r < this.rows && c >= 0 && c < this.cols) && !!opaque[r][c];

    // 2) Coordonnées du joueur en tuiles
    const pc = Math.max(0, Math.min(this.cols - 1,
      Math.floor((player.x + player.width  / 2) / this.tileSize)));
    const pr = Math.max(0, Math.min(this.rows - 1,
      Math.floor((player.y + player.height / 2) / this.tileSize)));

    const R  = this.radius | 0;
    const NA = Math.max(0, this.nearAlways | 0);

    const minC = Math.max(0, pc - R), maxC = Math.min(this.cols - 1, pc + R);
    const minR = Math.max(0, pr - R), maxR = Math.min(this.rows - 1, pr + R);

    const inCircle = (c, r) => {
      const dc = c - pc, dr = r - pr;
      return (dc*dc + dr*dr) <= (R + 0.15) * (R + 0.15); // petite marge
    };

    // 3) Marquage des tuiles visibles
    const visible = Array.from({ length: this.rows }, () => new Uint8Array(this.cols));
    const mark = (c, r) => { if (c>=0 && r>=0 && c<this.cols && r<this.rows) visible[r][c] = 1; };

    // Case du joueur toujours visible
    mark(pc, pr);

    // 3.a) Couronne locale nearAlways (ex: 1 = les 8 cases autour)
    if (NA > 0) {
      for (let dr = -NA; dr <= NA; dr++) {
        for (let dc = -NA; dc <= NA; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) > NA) continue; // couronne de Chebyshev
          const nc = pc + dc, nr = pr + dr;
          if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
          mark(nc, nr); // visible, même si coin/porte/mur à côté
        }
      }
    }

    // 3.b) Ray casting "premier bloc" (Bresenham) dans le disque
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (!inCircle(c, r)) continue;

        let x0 = pc, y0 = pr, x1 = c, y1 = r;
        let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let x = x0, y = y0;
        while (!(x === x1 && y === y1)) {
          const e2 = 2 * err;
          let nx = x, ny = y;
          if (e2 > -dy) { err -= dy; nx += sx; }
          if (e2 <  dx) { err += dx; ny += sy; }

          // Anti-peek diagonal "dur":
          // si on tente un pas diagonal et qu'un des voisins orthogonaux est opaque, on bloque là.
          if (nx !== x && ny !== y) {
            const sideA = isOpaque(y,  nx); // voisin horizontal
            const sideB = isOpaque(ny, x ); // voisin vertical
            if (sideA || sideB) {
              if (sideA) mark(nx, y);
              if (sideB) mark(x,  ny);
              break;
            }
          }

          x = nx; y = ny;
          mark(x, y);
          if (isOpaque(y, x)) break; // premier bloc rencontré → visible mais on ne va pas plus loin
        }
      }
    }

    // 4) Liste finale (inclut la couronne nearAlways)
    const listMinC = Math.max(0, Math.min(minC, pc - NA));
    const listMaxC = Math.min(this.cols - 1, Math.max(maxC, pc + NA));
    const listMinR = Math.max(0, Math.min(minR, pr - NA));
    const listMaxR = Math.min(this.rows - 1, Math.max(maxR, pr + NA));

    const out = [];
    for (let r = listMinR; r <= listMaxR; r++) {
      for (let c = listMinC; c <= listMaxC; c++) {
        if (visible[r][c]) out.push({ c, r });
      }
    }
    this.visibleList = out;
  }
};

// Expose global
if (typeof window !== "undefined") window.FOV = FOV;