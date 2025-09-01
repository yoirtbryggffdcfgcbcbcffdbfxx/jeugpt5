# Plateformer ASCII – Cavern Edition

Un petit moteur de plateformer 2D en JS/Canvas, ambiance grotte réaliste: mode test
- Carte ASCII (fichiers texte)
- Éclairage local (halo) avec occlusion (murs/portes) et noir total hors lumière
- Mur de roche procédural avec léger parallax (visible uniquement dans la lumière)
- Joueur “citrouille cubique”
- Portes/clefs colorées, checkpoints nommés, lave, piques (haut et bas), pièces
- HUD, toasts de loot, panneau pause, mode développeur (checkpoints)

---

## Aperçu des fonctionnalités

- Lumière et visibilité
  - FOV rond configurable (par tuiles), anneau “near” garanti, occlusion par murs (#) et portes fermées.
  - Mur de roche procédural avec 3 couches de parallax, rendu uniquement à l’intérieur du FOV.
  - La map (tuiles, objets, entités) est également rendue uniquement dans la lumière (noir ailleurs).

- Carte ASCII
  - Facile à créer/éditer, 1 caractère = 1 tuile (40×40 px par défaut).
  - Portes colorées 4‑tuiles de haut, clefs correspondantes, checkpoints nommés.

- Jouabilité
  - Physique inertielle (accélération, friction, gravité), collisions robustes, hazards (lave, piques vers le haut et vers le bas).
  - Checkpoints: un seul actif à la fois, nom affiché (overlay “découverte”), respawn custom.

- UI / UX
  - HUD: pièces, total de clefs “x / 4” (couleurs uniques), clefs R/B/V/J, temps, morts, nom du checkpoint actif, coordonnées du joueur [col,row].
  - Toasts de loot (icône + nom + quantité), icône de pièce vectorielle.
  - Overlay “nom de checkpoint” style Hollow Knight, fade in/out long.
  - Plein écran, pause, mute, restart, niveau suivant.

- Dev
  - Mode développeur: panneau checkpoints (touche D) → téléportation/activation.

---

## Démarrer

Le projet doit être servi via un petit serveur local (fetch de fichiers texte).

- VS Code + Live Server (recommandé): clic‑droit “Open with Live Server”
- Python 3:  
  `python -m http.server 5500` puis http://127.0.0.1:5500
- Node:  
  `npx http-server -p 5500` puis http://127.0.0.1:5500

Ouvre index.html. Par défaut le jeu lance map1.

---

## Structure

```
plateformer-game/
├── index.html
├── style.css
├── script.js          (boucle, caméra, gameplay, HUD, FOV update)
├── physics.js         (physique, collisions, hazards)
├── renderer.js        (fond roche + parallax, clipping FOV, joueur citrouille)
├── level.js           (parser ASCII → objets/entités)
├── entities.js        (pièces/clefs/checkpoints/goal + API dev)
├── fov.js             (FOV rond + occlusion + anneau “nearAlways”)
├── ui.js              (HUD, panneaux, toasts, overlay checkpoint)
├── audio.js           (petits sons WebAudio)
├── particles.js       (poussière/étincelles)
├── checkpoint-meta.js (noms/respawn des checkpoints)
└── maps/
   ├── map1.txt
   ├── map2.txt
   └── map3.txt
```

Important: `checkpoint-meta.js` doit être chargé AVANT `level.js` dans index.html.

---

## Contrôles

- Déplacements: ← → (ou A D)
- Saut: Espace (ou ↑ / W)
- Pause: P ou Échap
- Plein écran: F
- Son ON/OFF: M
- Recommencer: R
- Niveau suivant: N
- Mode développeur (panneau checkpoints): D

---

## Format de la map ASCII

Caractères supportés (1 char = 1 tuile 40×40 px):

- .  vide
- =  sol pierre (ground)
- #  bloc pierre (block)
- ~  lave (hazard)
- ^  piques vers le haut (hazard)
- v  piques vers le bas (hazard, plafond)
- P  spawn du joueur
- A  arrivée (goal)
- o  pièce
- y b r g  clefs (jaune, bleu, rouge, vert)
- Y B R G  portes (jaune, bleu, rouge, vert) — portes HAUTES (4 tuiles): place la lettre sur la tuile du BAS
- C  checkpoint (nom/respawn via checkpoint-meta.js)

Extrait:
```
................P............................
.................#.......................A...
===========######============================
..............~...........^.......v..........
```

---

## Checkpoints nommés

Fichier: `checkpoint-meta.js`

- Associe chaque checkpoint à son nom et à une position de respawn relative, via ses coordonnées [col,row].
- Ces coordonnées sont affichées dans le panneau dev (D) et dans la console si besoin.

Exemple (tel qu’utilisé dans la conversation):
```js
window.CHECKPOINT_META = [
  { col: 53, row:  4, name: "CP 1 — Balcon nord",  respawn: { dx: 0,  dy: -40 } },
  { col: 14, row:  8, name: "CP 2 — Terrasse est", respawn: { dx: 0,  dy: -40 } },
  { col: 46, row: 14, name: "CP 3 — Pont central", respawn: { dx: 0,  dy: -40 } },
  { col: 62, row: 30, name: "CP 4 — Salle basse",  respawn: { dx: 0,  dy: -40 } },
  { col: 53, row: 33, name: "CP 5 — Cavité sud",   respawn: { dx: 0,  dy: -40 } }
];
```

Notes:
- `dx,dy` sont en pixels (origine = coin haut‑gauche de la tuile “C”).  
- default si non fourni: respawn au‑dessus du tile (dy: -40).
- Lorsqu’un checkpoint est activé, l’overlay affiche “Checkpoint activé — {nom}”, le HUD affiche le nom, et l’ancien checkpoint est désactivé.

---

## Réglages rapides

- FOV (fov.js)
  - Rayon (par tuiles): `FOV.init({ radius: 6, nearAlways: 1 })`
  - Option “nearAlways”: garantit la couronne de 1 tuile autour du joueur toujours visible.
  - Le sol `=` peut occulter la vue: `FOV.GROUND_BLOCKS_SIGHT = true` (recommandé).

- Rendu (renderer.js)
  - Parallax du mur: facteurs 0.08 / 0.13 / 0.18 (plus grand = glisse plus vite).
  - Opacité des couches: 0.55 / 0.70 / 0.85 (réduit si tu veux un mur plus discret).
  - Noir total hors lumière: c’est le comportement par défaut (fond noir + clipping FOV).

- Physique (script.js → objet `player`)
  ```
  accel, friction, maxSpeed, gravity, jumpPower
  ```

---

## Développement (mode D)

- Touche D: ouvre/ferme le panneau “Mode développeur — Checkpoints”.
- Clique sur un checkpoint pour t’y téléporter et l’activer.
- Raccourcis: 1..9 pour y aller rapidement (optionnel selon ta version).

---

## Résolution de problèmes

- 404 / “MIME text/html” sur `checkpoint-meta.js`:
  - Le fichier n’est pas trouvé. Place-le à la racine (même dossier que index.html) et charge‑le avant level.js.
  - Teste l’URL directe: http://127.0.0.1:5500/checkpoint-meta.js → doit afficher ton JS.

- Rien ne s’affiche dans la lumière (tout noir):
  - Vérifie que `renderBackground(ctx, camera, time, player)` est bien appelé (avec `player`).
  - Vérifie que `FOV.update(player)` est appelé avant le rendu.
  - Assure‑toi que `renderObjects` et le fond utilisent `buildVisiblePath(camera)` pour clipper.

- “Identifier has already been declared”:
  - Ne déclare pas 2 fois la même fonction utilitaire (ex: createNoisePattern) dans renderer.js.
  - Supprime l’ancienne si nécessaire.

- Le joueur a encore un contour rouge:
  - C’est corrigé: le rendu “citrouille cubique” n’utilise aucune couleur rouge de fond; le contour sombre est “rgba(0,0,0,0.35)”.
  - Si tu vois du rouge, purge le cache (Ctrl+F5) ou vérifie que ton renderer.js est bien remplacé.

---

## Créer un niveau

1) Duplique `maps/map1.txt` en `maps/map4.txt` et édite en ASCII.
2) Ajoute la nouvelle map dans ta rotation (script.js → `nextLevel()`).
3) Recharge (R) en jeu ou relance le serveur.

---

## Licence / Crédit

- Code et styles génératifs fournis pour usage perso/éducatif.  
- Tu peux librement modifier/étendre (ajoute une licence MIT si tu publies).

---

## Roadmap (idées faciles à ajouter)

- “Lampes” (caractère L) qui ajoutent un halo local dans la grotte (uniquement à l’intérieur du FOV, sans tricher derrière les murs).
- Ennemis patrouilleurs (E) avec dégâts au contact.
- Plateformes mobiles et interrupteurs.
- Enregistrement des meilleurs temps / pièces par niveau (localStorage).

---

Bon jeu et bon level design !
Si tu veux une variante de la citrouille (yeux différents, bouche plus “mignonne”, ou une version “citrouille de pierre”), je te prépare ça en une passe.