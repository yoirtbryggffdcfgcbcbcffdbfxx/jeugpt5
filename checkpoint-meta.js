// checkpoint-meta.js
// Associe un nom + une position de respawn à chaque checkpoint (par col,row).
// dx,dy sont en pixels et s’appliquent depuis le coin haut-gauche de la tuile "C".
// Avec TILE_SIZE = 40 et player.height = 40, dy: -40 place le joueur sur la tuile.

window.CHECKPOINT_META = [
  { col: 53, row:  4, name: "Balcon nord",    respawn: { dx: 0,  dy: -40 } },
  { col: 14, row:  8, name: "Terrasse ouest", respawn: { dx: 0,  dy: -40 } },
  { col: 46, row: 14, name: "Pont central",   respawn: { dx: 0,  dy: -40 } },
  { col: 62, row: 30, name: "Salle basse",    respawn: { dx: 0,  dy: -40 } },
  { col: 53, row: 33, name: "Cavité sud",     respawn: { dx: 0,  dy: -40 } }
];