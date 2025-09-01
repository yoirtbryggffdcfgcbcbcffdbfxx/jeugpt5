// level.js : parse maps/*.txt en objets + entités (portes hautes, clefs colorées, checkpoints nommés)

let objects = []; // solides/dangers (ground, block, door, lava, spikes, goal)
let entities = { coins: [], keys: [], checkpoints: [] };
let playerSpawn = { x: 50, y: 50 };
let goal = null;

const TILE_SIZE = 40;
const DOOR_HEIGHT_TILES = 4; // portes hautes = 4 tuiles
let levelCols = 0, levelRows = 0;
let CURRENT_LEVEL = "map1";

function resetLevelState() {
  objects = [];
  entities = { coins: [], keys: [], checkpoints: [] };
  goal = null;
  playerSpawn = { x: 50, y: 50 };
}

function addDoor(x, y, color = null, tiles = DOOR_HEIGHT_TILES) {
  const topY = y - (tiles - 1) * TILE_SIZE;
  objects.push({
    x,
    y: topY,
    width: TILE_SIZE,
    height: tiles * TILE_SIZE,
    type: "door",
    open: false,
    color
  });
}

// Applique les noms/respawn depuis window.CHECKPOINT_META
function applyCheckpointMeta() {
  const metas = (window.CHECKPOINT_META || []);
  if (!metas.length) {
    console.warn("[CP META] CHECKPOINT_META vide ou non chargé.");
    return;
  }

  // Index par "col,row"
  const map = new Map();
  for (const m of metas) {
    const col = Number(m.col), row = Number(m.row);
    if (Number.isFinite(col) && Number.isFinite(row)) {
      map.set(`${col},${row}`, m);
    }
  }

  for (const cp of entities.checkpoints) {
    const key = `${cp.col},${cp.row}`;
    const m = map.get(key);
    if (m) {
      // Nom
      if (m.name) cp.name = m.name;

      // Respawn (par défaut au-dessus si non fourni)
      const dx = m.respawn?.dx ?? 0;
      const dy = m.respawn?.dy ?? -TILE_SIZE;
      cp.respawn = { x: cp.x + dx, y: cp.y + dy };
      // Log utile pour vérifier
      // console.info("[CP META] ok", key, "->", cp.name, cp.respawn);
    } else {
      // console.warn("[CP META] pas de meta pour", key, "(nom conservé:", cp.name, ")");
    }
  }
}

// Expose pour re-appliquer depuis la console si besoin
if (typeof window !== "undefined") window.applyCheckpointMeta = applyCheckpointMeta;

function loadLevel(name = "map1") {
  CURRENT_LEVEL = name;
  resetLevelState();

  return fetch(`maps/${name}.txt`)
    .then(r => r.text())
    .then(text => {
      const lines = text.replace(/\r/g, "").split("\n");
      levelRows = lines.length;
      levelCols = Math.max(...lines.map(l => l.length));

      lines.forEach((line, row) => {
        [...line].forEach((ch, c) => {
          const x = c * TILE_SIZE;
          const y = row * TILE_SIZE;

          switch (ch) {
            case "#": objects.push({ x, y, width:TILE_SIZE, height:TILE_SIZE, type:"block" }); break;
            case "=": objects.push({ x, y, width:TILE_SIZE, height:TILE_SIZE, type:"ground" }); break;
            case "~": objects.push({ x, y, width:TILE_SIZE, height:TILE_SIZE, type:"lava" }); break;
            case "^": objects.push({ x, y, width:TILE_SIZE, height:TILE_SIZE, type:"spikes" }); break;
            // NOUVEAU: pics vers le bas (v)
            case "v": objects.push({ x, y, width:TILE_SIZE, height:TILE_SIZE, type:"spikesDown" }); break;

            // Portes 4-haut colorées
            case "Y": addDoor(x, y, "y"); break;
            case "B": addDoor(x, y, "b"); break;
            case "R": addDoor(x, y, "r"); break;
            case "G": addDoor(x, y, "g"); break;
            case "D": addDoor(x, y, null); break; // porte neutre 4-haut

            // Petite porte 1-haut
            case "d": objects.push({ x, y, width:TILE_SIZE, height:TILE_SIZE, type:"door", open:false, color:null }); break;

            // Clefs colorées
            case "y": entities.keys.push({ x:x+10, y:y+10, width:20, height:20, picked:false, color:"y" }); break;
            case "b": entities.keys.push({ x:x+10, y:y+10, width:20, height:20, picked:false, color:"b" }); break;
            case "r": entities.keys.push({ x:x+10, y:y+10, width:20, height:20, picked:false, color:"r" }); break;
            case "g": entities.keys.push({ x:x+10, y:y+10, width:20, height:20, picked:false, color:"g" }); break;

            // Pièces
            case "o": entities.coins.push({ x:x+8, y:y+8, width:24, height:24, collected:false }); break;

            // Checkpoints nommés
            case "C": {
              const id = entities.checkpoints.length;
              entities.checkpoints.push({
                id,
                x, y, width: TILE_SIZE, height: TILE_SIZE,
                col: c, row,
                name: `Checkpoint ${id+1}`,          // nom par défaut
                respawn: { x: x, y: y - TILE_SIZE }, // respawn par défaut au-dessus
                active: false
              });
              break;
            }

            case "A": goal = { x, y, width:TILE_SIZE, height:TILE_SIZE, type:"goal" }; objects.push(goal); break;
            case "P": playerSpawn = { x, y: y - TILE_SIZE }; break;
            default: break; // '.' vide
          }
        });
      });

      // IMPORTANT: appliquer les métadonnées après avoir rempli la liste
      applyCheckpointMeta();
    });
}