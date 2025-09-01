// entities.js : interactions (pièces, clés colorées, checkpoints nommés, goal) + API dev

const SolidTypes = new Set(["ground", "block", "door"]);

function isSolidForPhysics(obj) {
  if (obj.type === "door") return !obj.open;
  return SolidTypes.has(obj.type);
}

function aabb(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

const KeyColors = {
  r: { name: "Clé rouge",  color: "#ef5350" },
  b: { name: "Clé bleue",  color: "#64b5f6" },
  g: { name: "Clé verte",  color: "#66bb6a" },
  y: { name: "Clé jaune",  color: "#f2c94c" }
};

function deactivateAllCheckpoints() {
  for (const cp of entities.checkpoints) cp.active = false;
}

function activateCheckpoint(cp, Game, { teleport = false } = {}) {
  deactivateAllCheckpoints();
  cp.active = true;

  Game.checkpoint = { x: cp.respawn.x, y: cp.respawn.y };
  Game.activeCPId = cp.id;
  Game.activeCPName = cp.name || `CP-${(cp.id | 0) + 1}`;

  UI.showDiscovery(Game.activeCPName, { fadeIn: 750, hold: 250, fadeOut: 1750 });
  AudioSys.checkpoint?.();
  Particles.spawnSpark?.(cp.x + TILE_SIZE / 2, cp.y + 10, "#aaf");

  if (teleport) {
    player.x = cp.respawn.x;
    player.y = cp.respawn.y;
    player.vx = 0; player.vy = 0;
  }
}

function collectablesAndCheckpoints(player, Game) {
  // Pièces
  for (const c of entities.coins) {
    if (!c.collected && aabb(player, c)) {
      c.collected = true;
      Game.stats.coins++;
      UI.updateHUD(Game);

      // Toast loot: pièce
      UI.addLootToast({
  iconSVG: UI.icons.coin(),
  label: "Pièce",
  delta: 1,
  total: Game.stats.coins,
  accent: "#f5c542" // or #ffd166
});

      Particles.spawnSpark?.(c.x + c.width / 2, c.y + c.height / 2, "#ffd166");
      AudioSys.coin?.();
    }
  }

  // Clés colorées
  for (const k of entities.keys) {
    if (!k.picked && aabb(player, k)) {
      k.picked = true;
      Game.stats.keysTotal++;
      Game.stats.keysByColor[k.color] = (Game.stats.keysByColor[k.color] || 0) + 1;
      UI.updateHUD(Game);

      // Ouvrir portes de même couleur
      let opened = false;
      for (const o of objects) {
        if (o.type === "door" && !o.open && o.color === k.color) {
          o.open = true; opened = true;
        }
      }

      const meta = KeyColors[k.color] || { name:"Clé", color:"#ffd166" };
UI.addLootToast({
  iconSVG: UI.icons.key(meta.color),
  label: meta.name,
  delta: 1,
  total: Game.stats.keysByColor[k.color],
  accent: meta.color
});

      UI.toast(`${meta.name} obtenue`);
      Particles.spawnSpark?.(k.x + k.width / 2, k.y + k.height / 2, meta.color);
      AudioSys.key?.();
      if (opened) AudioSys.doorOpen?.();
    }
  }

  // Checkpoints
  for (const cp of entities.checkpoints) {
    if (!cp.active && aabb(player, cp)) {
      activateCheckpoint(cp, Game, { teleport: false });
    }
  }

  // Goal
  if (goal && aabb(player, goal)) {
    Game.levelComplete = true;
  }
}

// API dev pour script.js
const EntitiesAPI = {
  getCheckpoints() {
    return entities.checkpoints.map(cp => ({
      id: cp.id,
      name: cp.name || `CP-${(cp.id | 0) + 1}`,
      col: cp.col, row: cp.row,
      active: !!cp.active
    }));
  },
  activateCheckpoint(id, Game, { teleport = true } = {}) {
    const cp = entities.checkpoints.find(c => c.id === id);
    if (!cp) return false;
    activateCheckpoint(cp, Game, { teleport });
    return true;
  }
};

if (typeof window !== "undefined") {
  window.isSolidForPhysics = isSolidForPhysics;
  window.collectablesAndCheckpoints = collectablesAndCheckpoints;
  window.EntitiesAPI = EntitiesAPI;
}