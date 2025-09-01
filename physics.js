/**
 * physics.js
 * - Déplacement (accel/friction/clamp)
 * - Gravité
 * - Collisions solides (min-penetration, anti-collage, directionnelles)
 * - Hazards: lava, spikes (^) et spikesDown (v) → déclenchent player.hitHazard = true
 */

function applyPhysics(player) {
  // ----- INPUT H -----
  if (keys["ArrowLeft"] || keys["KeyA"]) player.vx -= player.accel;
  if (keys["ArrowRight"] || keys["KeyD"]) player.vx += player.accel;

  // Friction si pas d'input
  if (!keys["ArrowLeft"] && !keys["ArrowRight"] && !keys["KeyA"] && !keys["KeyD"]) {
    player.vx *= player.friction;
    if (Math.abs(player.vx) < 0.05) player.vx = 0;
  }

  // Clamp
  player.vx = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, player.vx));

  // Gravité
  player.vy += player.gravity;

  const wasGrounded = player.grounded;
  player.prevX = player.x; player.prevY = player.y;

  // Appliquer déplacement
  player.x += player.vx;
  player.y += player.vy;
  player.grounded = false;
  player.hitHazard = false;

  const epsilon   = 0.5;  // marge anti-collage (solides)
  const hazardPad = 1.0;  // padding AABB pour déclencher les hazards

  for (const obj of objects) {
    // AABB grossier
    const aabb =
      player.x < obj.x + obj.width  &&
      player.x + player.width  > obj.x &&
      player.y < obj.y + obj.height &&
      player.y + player.height > obj.y;

    // ---------- HAZARDS (ne poussent pas, juste hitHazard) ----------
    if (aabb) {
      if (obj.type === "lava") {
        player.hitHazard = true;
        continue;
      }
      if (obj.type === "spikes") {
        // Un peu de pad pour ne pas rater d'un pixel
        if (aabbPad(player, obj, hazardPad) && hitSpikeTriangle(player, obj)) {
          player.hitHazard = true;
        }
        continue;
      }
      if (obj.type === "spikesDown") {
        if (aabbPad(player, obj, hazardPad) && hitSpikeDownTriangle(player, obj)) {
          player.hitHazard = true;
        }
        continue;
      }
    }

    // ---------- SOLIDES ----------
    if (!isSolidForPhysics(obj)) continue;

    if (aabbEps(player, obj, epsilon)) {
      // Résolution min-penetration
      const overlapX = (player.x + player.width/2) - (obj.x + obj.width/2);
      const overlapY = (player.y + player.height/2) - (obj.y + obj.height/2);
      const halfW = player.width/2 + obj.width/2;
      const halfH = player.height/2 + obj.height/2;

      if (Math.abs(overlapX) < halfW && Math.abs(overlapY) < halfH) {
        const dx = halfW - Math.abs(overlapX);
        const dy = halfH - Math.abs(overlapY);

        if (dx < dy) {
          // Collision horizontale: ne bloque que si on allait vers le mur
          if (overlapX > 0 && player.vx < 0) { player.x += dx; player.vx = 0; }
          else if (overlapX < 0 && player.vx > 0) { player.x -= dx; player.vx = 0; }
        } else {
          // Collision verticale
          if (overlapY > 0 && player.vy < 0) { // plafond
            player.y += dy; player.vy = 0;
          } else if (overlapY < 0 && player.vy > 0) { // sol
            player.y -= dy; player.vy = 0; player.grounded = true;
          }
        }
      }
    }
  }

  // ----- SAUT -----
  if ((keys["Space"] || keys["ArrowUp"] || keys["KeyW"]) && player.grounded) {
    player.vy = player.jumpPower;
    player.grounded = false;
    AudioSys.jump?.();
    Particles.spawnDust?.(player.x + player.width/2, player.y + player.height, Math.sign(player.vx));
  }

  // Poussière à l'atterrissage
  if (player.grounded && !wasGrounded) {
    Particles.spawnDust?.(player.x + player.width/2, player.y + player.height, Math.sign(player.vx));
  }
}

/* ---------------- Helpers AABB ---------------- */
function aabbEps(a, b, eps=0.5){
  return (
    a.x < b.x + b.width - eps &&
    a.x + a.width > b.x + eps &&
    a.y < b.y + b.height - eps &&
    a.y + a.height > b.y + eps
  );
}
function aabbPad(a, b, pad=1){
  return (
    a.x < b.x + b.width + pad &&
    a.x + a.width > b.x - pad &&
    a.y < b.y + b.height + pad &&
    a.y + a.height > b.y - pad
  );
}

/* --------------- Hazards triangles --------------- */
// Spikes (^) → on teste le bas du joueur (et une ligne juste au-dessus)
function hitSpikeTriangle(player, obj) {
  const apex = { 
    x: obj.x + obj.width * 0.5, 
    y: obj.y + Math.max(4, obj.height * 0.12)
  };
  const baseMarginX = Math.max(4, obj.width * 0.12);
  const baseLeft  = { x: obj.x + baseMarginX,             y: obj.y + obj.height - 1 };
  const baseRight = { x: obj.x + obj.width - baseMarginX, y: obj.y + obj.height - 1 };

  const xs = [
    player.x + 2,
    player.x + player.width * 0.25,
    player.x + player.width * 0.5,
    player.x + player.width * 0.75,
    player.x + player.width - 2
  ];
  const ys = [
    player.y + player.height - 1, // bas
    player.y + player.height - 6  // un peu au-dessus
  ];

  for (const y of ys) for (const x of xs) {
    if (pointInTriangle({x, y}, apex, baseLeft, baseRight)) return true;
  }
  return false;
}

// Spikes vers le bas (v) → on teste le haut du joueur (et une ligne un peu plus bas)
function hitSpikeDownTriangle(player, obj) {
  const baseMarginX = Math.max(4, obj.width * 0.12);
  const baseY   = obj.y + 1;
  const baseLeft  = { x: obj.x + baseMarginX,            y: baseY };
  const baseRight = { x: obj.x + obj.width - baseMarginX,y: baseY };
  const apex    = { x: obj.x + obj.width / 2,            y: obj.y + obj.height - Math.max(4, obj.height * 0.12) };

  const xs = [
    player.x + 2,
    player.x + player.width * 0.25,
    player.x + player.width * 0.5,
    player.x + player.width * 0.75,
    player.x + player.width - 2
  ];
  const ys = [
    player.y + 1, // haut
    player.y + 6  // un peu plus bas (racle)
  ];

  for (const y of ys) for (const x of xs) {
    if (pointInTriangle({x, y}, apex, baseLeft, baseRight)) return true;
  }
  return false;
}

function pointInTriangle(p, a, b, c) {
  const s = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const b1 = s(p, a, b) < 0;
  const b2 = s(p, b, c) < 0;
  const b3 = s(p, c, a) < 0;
  return (b1 === b2) && (b2 === b3);
}