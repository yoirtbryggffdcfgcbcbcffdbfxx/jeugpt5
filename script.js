// script.js : boucle, caméra centrée, plein écran (conteneur), gameplay, HUD + FOV + mode dev checkpoints

// DOM
const gameRoot = document.getElementById("gameRoot");
const canvas   = document.getElementById("gameCanvas");
const ctx      = canvas.getContext("2d");

// Entrées et état global
const keys = {};
const Game = {
  level: "map1",
  paused: false,
  muted: false,
  levelComplete: false,
  stats: { coins: 0, keysTotal: 0, keysByColor: { r:0, b:0, g:0, y:0 }, deaths: 0, time: 0 },
  checkpoint: null,
  activeCPId: null,
  activeCPName: null
};

// Joueur
const player = {
  x: 0, y: 0, width: 40, height: 40, color: "#ff3b30",
  vx: 0, vy: 0,
  accel: 0.5, friction: 0.86, maxSpeed: 5.2,
  gravity: 0.6, jumpPower: -12.5,
  grounded: false,
  prevX: 0, prevY: 0,
  hitHazard: false,
  skin: "maskCape"
};

// Caméra
const camera = { x: 0, y: 0, width: 1200, height: 600 };
const CameraCfg = {
  lerp: 0.12,
  baselineRatio: 0.86,
  verticalFollow: 0.0,
  startCenterOnPlayer: true,
  followYOnPlayer: true
};

// Monde
const world = { width: 0, height: 0, floorY: 0 };

let lastTime = 0;
let devMode = false;

/* Entrées clavier + UI DOM */
window.addEventListener("keydown", e => {
  const block = ["Space","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","KeyA","KeyD","KeyW"];
  if (block.includes(e.code)) e.preventDefault();
  keys[e.code] = true;

  if (e.code === "KeyF") toggleFullscreen();
  if (e.code === "KeyP" || e.code === "Escape") togglePause();
  if (e.code === "KeyM") { AudioSys.mute(); UI.updateHUD(Game); }
  if (e.code === "KeyR") restartLevel();
  if (e.code === "KeyN") nextLevel();
  if (e.code === "KeyS") toggleSkinMenu(); // ouvrir/fermer menu skins
  if (e.code === "KeyD") toggleDevMode();

  // Raccourcis 1..9 en mode dev
  if (devMode && e.code.startsWith("Digit")) {
    const n = parseInt(e.code.slice(5), 10);
    if (!isNaN(n) && n >= 1) {
      gotoCheckpoint(n - 1);
    }
  }
}, { passive: false });

window.addEventListener("keyup", e => { keys[e.code] = false; });

// UI DOM
UI.init();
document.getElementById("btnFullscreen").addEventListener("click", toggleFullscreen);
document.getElementById("btnMute").addEventListener("click", () => { AudioSys.mute(); UI.updateHUD(Game); });
document.getElementById("btnPause").addEventListener("click", togglePause);
document.getElementById("btnResume").addEventListener("click", () => togglePause(false));
document.getElementById("btnRestart").addEventListener("click", restartLevel);
document.getElementById("btnClose").addEventListener("click", () => UI.hidePanel());
document.getElementById("btnNext").addEventListener("click", nextLevel);

/* Plein écran (conteneur) + resize */
function isFullscreen(){ return document.fullscreenElement === gameRoot; }
function enterFullscreen(){ if (gameRoot.requestFullscreen) gameRoot.requestFullscreen(); }
function exitFullscreen(){ if (document.exitFullscreen) document.exitFullscreen(); }
function toggleFullscreen(){ isFullscreen() ? exitFullscreen() : enterFullscreen(); }

function resizeCanvasToCSS(){
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width | 0), h = Math.max(1, rect.height | 0);
  canvas.width = w; canvas.height = h;
  camera.width = w; camera.height = h;
}
window.addEventListener("resize", () => { resizeCanvasToCSS(); snapCameraToPlayerCenter(); });
document.addEventListener("fullscreenchange", () => { resizeCanvasToCSS(); snapCameraToPlayerCenter(); });

/* Monde + Caméra */
function computeWorldMetrics() {
  world.width  = (levelCols || 0) * TILE_SIZE;
  world.height = (levelRows || 0) * TILE_SIZE;
  world.floorY = 0;
  for (const o of objects) {
    if ((o.type === "ground" || o.type === "block") && o.y > world.floorY) {
      world.floorY = o.y;
    }
  }
}
function cameraYBounds(){
  const avail = world.height - camera.height;
  return { minY: Math.min(0, avail), maxY: Math.max(0, avail) };
}
function cameraTargetY(){
  if (CameraCfg.followYOnPlayer) {
    return player.y + player.height / 2 - camera.height / 2;
  }
  return world.floorY - camera.height * CameraCfg.baselineRatio
       + (player.y - world.floorY) * CameraCfg.verticalFollow;
}
function updateCamera(){
  const targetX = player.x + player.width/2 - camera.width/2;
  camera.x += (targetX - camera.x) * CameraCfg.lerp;

  const { minY, maxY } = cameraYBounds();
  const targetY = cameraTargetY();
  camera.y += (targetY - camera.y) * CameraCfg.lerp;

  camera.x = Math.max(0, Math.min(Math.max(0, world.width - camera.width), camera.x));
  camera.y = Math.max(minY, Math.min(maxY, camera.y));
}
function snapCameraToPlayerCenter(){
  const { minY, maxY } = cameraYBounds();
  camera.x = Math.round(player.x + player.width / 2 - camera.width / 2);
  camera.y = Math.round(cameraTargetY());
  camera.x = Math.max(0, Math.min(Math.max(0, world.width - camera.width), camera.x));
  camera.y = Math.max(minY, Math.min(maxY, camera.y));
}

/* Gameplay helpers */
function die(){
  Game.stats.deaths++; UI.updateHUD(Game);
  AudioSys.death?.();
  const resp = Game.checkpoint || playerSpawn;
  player.x = resp.x; player.y = resp.y;
  player.vx = 0; player.vy = 0; player.hitHazard = false;
  snapCameraToPlayerCenter();
}
function restartLevel(){ loadAndStart(Game.level); }
function nextLevel(){
  const order = ["map1","map2","map3"];
  const idx = order.indexOf(Game.level);
  const next = order[(idx+1) % order.length];
  loadAndStart(next);
}
function togglePause(force){
  Game.paused = (typeof force === "boolean") ? force : !Game.paused;
  if (Game.paused) UI.showPanel("Pause", "Le jeu est en pause"); else UI.hidePanel();
}

/* Mode développeur: checkpoints */
function toggleDevMode(){
  devMode = !devMode;
  if (devMode) {
    const list = EntitiesAPI.getCheckpoints();
    UI.showDevCPPicker(list, (id) => { gotoCheckpoint(id); });
  } else {
    UI.hidePanel();
  }
}
function gotoCheckpoint(id){
  if (EntitiesAPI.activateCheckpoint(id, Game, { teleport: true })) {
    snapCameraToPlayerCenter();
    UI.updateHUD(Game);
  }
}

const SKINS = [
  { id: "maskCape", label: "Masque errant + cape" },
  { id: "classic",  label: "Classique (cube)" },
  { id: "wisp",     label: "Feu follet" },
  { id: "crystal",  label: "Cristal" },
  { id: "lantern",  label: "Lanterne" },
  { id: "slime",    label: "Slime" }
];

function setSkin(id) {
  player.skin = id;
  UI.hidePanel();
  UI.updateHUD(Game);
}

function toggleSkinMenu() {
  // si le panel affiche déjà Skins → fermer
  const title = UI.el?.panelTitle?.textContent || "";
  if (!UI.el.panel.classList.contains("hidden") && title.includes("Skins")) {
    UI.hidePanel();
    return;
  }
  UI.showSkinPicker(SKINS, player.skin, (id) => setSkin(id));
}
/* Boucle de jeu */
function gameLoop(ts=0){
  const dt = Math.min(0.033, (ts - lastTime) / 1000);
  lastTime = ts;
  Render.time = ts / 1000;

  if (!Game.paused) {
    if (!Game.levelComplete) {
      player.hitHazard = false;
      applyPhysics(player);
      collectablesAndCheckpoints(player, Game);
      if (player.hitHazard) die();
      Game.stats.time += dt;
    }
  }

  FOV.update(player);
  updateCamera();
  Particles.update?.(dt);

  renderBackground(ctx, camera, Render.time, player);
  renderObjects(ctx, camera, Render.time);
  renderPlayer(ctx, camera, player);
  Particles.render?.(ctx, camera);
  renderFog(ctx, camera, player);

  // MAJ coordonnées joueur (pixels + tuiles) à chaque frame
  UI.updatePlayerPos(player.x, player.y, player.width, player.height, TILE_SIZE);

  UI.updateHUD(Game);

  if (Game.levelComplete) {
    UI.showPanel("Bravo 🎉", "Niveau terminé !", { showNext: true });
    AudioSys.goal?.();
    Game.levelComplete = false;
  }

  requestAnimationFrame(gameLoop);
}

/* Chargement niveau + démarrage */
function loadAndStart(levelName="map1"){
  Game.level = levelName;
  Game.paused = false;
  Game.levelComplete = false;
  Game.stats = { coins: 0, keysTotal: 0, keysByColor: { r:0, b:0, g:0, y:0 }, deaths: Game.stats.deaths || 0, time: 0 };
  Game.checkpoint = null;
  Game.activeCPId = null;
  Game.activeCPName = null;
  UI.updateHUD(Game);

  loadLevel(levelName).then(() => {
    computeWorldMetrics();
    resizeCanvasToCSS();
    initRenderer({ tileSize: TILE_SIZE, cols: levelCols, rows: levelRows });

    // Init FOV (rayon + couronne)
    FOV.init({ tileSize: TILE_SIZE, cols: levelCols, rows: levelRows, radius: 6, nearAlways: 1 });

    // Spawn joueur
    player.x = playerSpawn.x;
    player.y = playerSpawn.y;
    player.vx = 0; player.vy = 0;

    if (CameraCfg.startCenterOnPlayer) snapCameraToPlayerCenter();

    // MAJ coordonnées tout de suite après spawn
    UI.updatePlayerPos(player.x, player.y, player.width, player.height, TILE_SIZE);
    UI.updateHUD(Game);

    const lvlEl = document.getElementById("hudLevel");
    if (lvlEl) lvlEl.textContent = levelName;
  });
}

// Lancer
loadAndStart("map1");
requestAnimationFrame(gameLoop);