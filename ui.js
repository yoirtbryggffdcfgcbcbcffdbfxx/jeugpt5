// ui.js : HUD + panneaux (pause/victoire/dev) + overlay checkpoint + loot toasts + coordonnées

const UI = {
  el: {
    coins: null, keysTotal: null, keyR: null, keyB: null, keyG: null, keyY: null,
    time: null, deaths: null, level: null, cpName: null, pos: null,
    panel: null, panelTitle: null, panelText: null, btnResume: null, btnRestart: null, btnNext: null, btnClose: null,
    btnFS: null, btnMute: null, btnPause: null,
    disc: null, discName: null,
    lootToasts: null
  },

  _discTimers: { out: null, hide: null },
  _lootMax: 4,
  _lootHoldMs: 3200,

  init() {
    // HUD gauche
    this.el.coins  = document.getElementById("hudCoins");
    this.el.level  = document.getElementById("hudLevel");
    this.el.cpName = document.getElementById("hudCP");
    this.el.pos    = document.getElementById("hudPos");

    // HUD droite
    this.el.keysTotal = document.getElementById("hudKeysTotal");
    this.el.keyR      = document.getElementById("hudKeyR");
    this.el.keyB      = document.getElementById("hudKeyB");
    this.el.keyG      = document.getElementById("hudKeyG");
    this.el.keyY      = document.getElementById("hudKeyY");
    this.el.time      = document.getElementById("hudTime");
    this.el.deaths    = document.getElementById("hudDeaths");

    // Boutons
    this.el.btnFS    = document.getElementById("btnFullscreen");
    this.el.btnMute  = document.getElementById("btnMute");
    this.el.btnPause = document.getElementById("btnPause");

    // Panel principal
    this.el.panel      = document.getElementById("panel");
    this.el.panelTitle = document.getElementById("panelTitle");
    this.el.panelText  = document.getElementById("panelText");
    this.el.btnResume  = document.getElementById("btnResume");
    this.el.btnRestart = document.getElementById("btnRestart");
    this.el.btnNext    = document.getElementById("btnNext");
    this.el.btnClose   = document.getElementById("btnClose");

    // Overlay nom checkpoint
    this.el.disc     = document.getElementById("discovery");
    this.el.discName = document.getElementById("discName");

    // Loot toasts
    this.el.lootToasts = document.getElementById("lootToasts");
  },

  // Mise à jour des coordonnées (tuiles uniquement)
  updatePlayerPos(px, py, pw, ph, tileSize = 40) {
    if (!this.el.pos) return;
    const cx = Math.floor(px + pw / 2);
    const cy = Math.floor(py + ph / 2);
    const tc = Math.floor(cx / tileSize);
    const tr = Math.floor(cy / tileSize);
    this.el.pos.textContent = `[${tc},${tr}]`;
  },

  updateHUD(Game){
    if (!this.el.coins) return;

    // Basiques
    this.el.coins.textContent  = Game.stats.coins;
    this.el.deaths.textContent = Game.stats.deaths;
    this.el.level.textContent  = Game.level;
    this.el.time.textContent   = formatTime(Game.stats.time);

    if (this.el.btnMute) {
      this.el.btnMute.textContent = (typeof AudioSys !== "undefined" && AudioSys.muted) ? "🔇" : "🔈";
    }

    // Clés (ordre: Rouge, Bleu, Vert, Jaune)
    const K = Game.stats.keysByColor || {};
    this.el.keyR.textContent = K.r || 0;
    this.el.keyB.textContent = K.b || 0;
    this.el.keyG.textContent = K.g || 0;
    this.el.keyY.textContent = K.y || 0;

    // Total unique: x / 4
    const colors = ["r","b","g","y"];
    const obtained = colors.reduce((n,c)=> n + ((K[c]||0) > 0 ? 1 : 0), 0);
    this.el.keysTotal.textContent = `${obtained} / ${colors.length}`;

    // Nom du CP actif
    let cpLabel = Game.activeCPName || "—";
    if (cpLabel === "—" && window.entities?.checkpoints) {
      const active = entities.checkpoints.find(cp => cp.active);
      if (active) cpLabel = active.name || `CP-${(active.id|0)+1}`;
    }
    if (this.el.cpName) this.el.cpName.textContent = cpLabel;
  },

  showPanel(title, html, { showNext=false } = {}) {
    this.el.panelTitle.textContent = title;
    this.el.panelText.innerHTML = html || "";
    this.el.btnNext.classList.toggle("hidden", !showNext);
    this.el.panel.classList.remove("hidden");
  },
  hidePanel(){ this.el.panel.classList.add("hidden"); },

  toast(msg){ console.log(msg); },

  // Overlay "Nom": 2s in, 3s hold, 2s out
  showDiscovery(name="", { fadeIn=2000, hold=3000, fadeOut=2000 } = {}) {
    if (!this.el.disc) return;

    if (this._discTimers.out)  { clearTimeout(this._discTimers.out);  this._discTimers.out  = null; }
    if (this._discTimers.hide) { clearTimeout(this._discTimers.hide); this._discTimers.hide = null; }

    this.el.discName.textContent = name || "—";
    this.el.disc.classList.remove("hidden", "discovery-out", "discovery-in");
    void this.el.disc.offsetWidth;
    this.el.disc.classList.add("discovery-in");

    this._discTimers.out = setTimeout(() => {
      this.el.disc.classList.remove("discovery-in");
      this.el.disc.classList.add("discovery-out");
      this._discTimers.hide = setTimeout(() => {
        this.el.disc.classList.add("hidden");
      }, fadeOut + 50);
    }, fadeIn + hold);
  },

  // -------- Loot Toasts --------
  icons: {
    coin() {
      return `
        <svg viewBox="0 0 24 24" width="18" height="18">
          <defs>
            <radialGradient id="coinGradMini" cx="35%" cy="35%" r="75%">
              <stop offset="0%"  stop-color="#fff59d"/>
              <stop offset="45%" stop-color="#f7d354"/>
              <stop offset="100%" stop-color="#d4a017"/>
            </radialGradient>
          </defs>
          <ellipse cx="12" cy="12" rx="10" ry="10" fill="#b07a00"/>
          <circle cx="12" cy="11" r="9" fill="url(#coinGradMini)" />
          <circle cx="12" cy="11" r="9" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>
          <circle cx="12" cy="11" r="6" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
        </svg>
      `;
    },
    key(colorHex = "#ffd166") {
      return `
        <svg viewBox="0 0 24 24" width="18" height="18">
          <circle cx="8" cy="12" r="5" fill="${colorHex}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>
          <rect x="12" y="11" width="8" height="3" fill="${colorHex}" />
          <rect x="18" y="9"  width="2" height="3" fill="${colorHex}" />
          <rect x="18" y="14" width="2" height="3" fill="${colorHex}" />
        </svg>
      `;
    }
  },

  addLootToast({ iconSVG = "", label = "", delta = 1, total = null, accent = "#ffd166" }) {
    if (!this.el.lootToasts) return;
    const box = document.createElement("div");
    box.className = "loot-toast";
    box.style.setProperty("--accent", accent);

    const icon = document.createElement("span");
    icon.className = "icon";
    icon.innerHTML = iconSVG;

    const lbl = document.createElement("span");
    lbl.className = "label";
    lbl.textContent = label;

    const cnt = document.createElement("span");
    cnt.className = "count";
    cnt.textContent = total != null ? `+${delta} (${total})` : `+${delta}`;

    box.appendChild(icon);
    box.appendChild(lbl);
    box.appendChild(cnt);

    // Limite de toasts visibles
    while (this.el.lootToasts.children.length >= this._lootMax) {
      const first = this.el.lootToasts.firstElementChild;
      first?.classList.add("out");
      setTimeout(() => first?.remove(), 260);
      break;
    }

    this.el.lootToasts.appendChild(box);

    // Disparition auto
    setTimeout(() => {
      box.classList.add("out");
      setTimeout(() => box.remove(), 260);
    }, this._lootHoldMs);
  },

  // Panneau Dev: checkpoints
  showDevCPPicker(list, onGoto) {
    const items = list.map(cp => {
      const act  = cp.active ? " (actif)" : "";
      const name = cp.name || `CP-${(cp.id|0)+1}`;
      return `<button class="cp-item" data-id="${cp.id}">${cp.id+1}. ${name}${act} — [${cp.col},${cp.row}]</button>`;
    }).join("<br/>");

    this.showPanel(
      "Mode développeur — Checkpoints",
      `<p>Cliquer pour se téléporter/activer. Raccourci : D pour ouvrir/fermer, 1..9 pour aller au checkpoint n°.</p>${items}`,
      { showNext: false }
    );
  },

  showSkinPicker(list, currentId, onChoose) {
    const items = list.map(s => {
      const act = s.id === currentId ? " (actuel)" : "";
      return `<button class="skin-item" data-id="${s.id}">${s.label}${act}</button>`;
    }).join("<br/>");

  this.showPanel(
    "Skins",
    `<p>Choisis l'apparence du héros. Raccourci : S pour ouvrir/fermer.</p>${items}`,
    { showNext: false }
  );

  this.el.panelText.onclick = (e) => {
    const btn = e.target.closest(".skin-item");
    if (!btn) return;
    const id = btn.dataset.id;
    onChoose?.(id);
    // rafraîchir pour marquer "(actuel)"
    this.showSkinPicker(list, id, onChoose);
  };
},

  showDevCPPicker(list, onGoto) {
    const items = list.map(cp => {
      const act  = cp.active ? " (actif)" : "";
      const name = cp.name || `CP-${(cp.id|0)+1}`;
      return `<button class="cp-item" data-id="${cp.id}">${cp.id+1}. ${name}${act} — [${cp.col},${cp.row}]</button>`;
    }).join("<br/>");

    this.showPanel(
      "Mode développeur — Checkpoints",
      `<p>Cliquer pour se téléporter/activer. Raccourci : D pour ouvrir/fermer, 1..9 pour aller au checkpoint n°.</p>${items}`,
      { showNext: false }
    );

    const handler = (e) => {
      const btn = e.target.closest(".cp-item");
      if (!btn) return;
      const id = parseInt(btn.dataset.id, 10);
      onGoto?.(id);
      this.showDevCPPicker(EntitiesAPI.getCheckpoints(), onGoto);
    };
    this.el.panelText.onclick = handler;
  }
};

// Utilitaires
function formatTime(t){
  const m = Math.floor(t/60); const s = Math.floor(t%60);
  return `${m}:${s.toString().padStart(2,"0")}`;
}

// Expose
if (typeof window !== "undefined") window.UI = UI;