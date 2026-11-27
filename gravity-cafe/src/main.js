import "./style.css";
import {
  createIcons,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  ArrowLeft,
  ArrowRight,
  Orbit,
  Users,
  Coffee,
  Milk,
  Star,
  X,
  RotateCcw,
  Home,
  Gamepad2,
  CircleHelp,
  Wind,
} from "lucide";
import { alienAvatar } from "./avatars.js";
import {
  createState,
  advanceState,
  advanceOrders,
  serveDrink,
  formatTime,
  LEVELS,
} from "./game-state.js";
import { createWorld } from "./world.js";
import { createAudioFeedback } from "./audio.js";
import { createRecords } from "./records.js";
import { MELT_LEVEL, getMapEnvironment } from "./map-mechanics.js";
import {
  DRINK_NAMES,
  STAR_TARGETS,
  preparationFor,
  advancePreparation,
  starsFor,
  nextObjective,
  makeOrder,
  pendingDrinks,
  orderPenalty,
} from "./gameplay.js";

const icons = {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  ArrowLeft,
  ArrowRight,
  Orbit,
  Users,
  Coffee,
  Milk,
  Star,
  X,
  RotateCcw,
  Home,
  Gamepad2,
  CircleHelp,
  Wind,
};
const icon = (name) => `<i data-lucide="${name}"></i>`;
const $ = (selector) => document.querySelector(selector);
const audio = createAudioFeedback(),
  records = createRecords();
let reactorBeepKey = "";
let level = 0,
  coop = false,
  sound = true,
  practice = false,
  state = createState(),
  screen = "menu",
  orders = [],
  serial = 0;
let jobs = [null, null],
  countdown = 0,
  lastCount = 0,
  lastGravity = "",
  previous = performance.now(),
  accumulator = 0,
  uiClock = 0;
let modalPaused = false,
  toastUntil = 0,
  announcementUntil = 0;
const cupArt = (type = "empty") =>
  `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><ellipse cx="30" cy="53" rx="23" ry="4" fill="currentColor" opacity=".12"/><path d="M46 23H51C63 23 60 40 47 40" stroke="currentColor" stroke-width="4"/><path d="M12 21H48L44 45Q42 52 30 52Q18 52 16 45L12 21Z" fill="${type === "empty" ? "#eee9d4" : ["espresso", "doppio"].includes(type) ? "#e5ceb0" : "#f0e7d0"}" stroke="currentColor" stroke-width="2.5"/><ellipse cx="30" cy="22" rx="18" ry="5" fill="${type === "empty" ? "#bec9ba" : ["espresso", "doppio"].includes(type) ? "#694b36" : type === "latte" ? "#bd9369" : "#fbf0cf"}" stroke="currentColor" stroke-width="2"/>${type === "cappuccino" ? '<path d="M19 21Q25 15 30 21Q35 27 41 20" stroke="#be9872" stroke-width="2"/>' : ""}${type !== "empty" ? '<path d="M23 13Q18 8 24 4M34 13Q40 8 34 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".5"/>' : ""}</svg>`;

document.body.dataset.screen = "menu";
$("#app").innerHTML =
  `<main id="viewport" class="game-stage"><canvas id="scene" tabindex="0" aria-label="Gravity Cafe. Gioco 3D: WASD muove, E interagisce, Spazio lancia, Shift frena."></canvas><div class="vignette"></div>
<div class="world-label label-coffee">${icon("coffee")} CAFFÈ</div><div class="world-label label-milk">${icon("milk")} LATTE</div><div class="world-label label-service">${icon("star")} CONSEGNA</div><div class="player-tag">P1<span>▼</span></div><div class="player-tag player-tag-2" hidden>P2<span>▼</span></div>
<section class="title-screen" id="menu" aria-label="Menu principale"><div class="menu-shade"></div><div class="menu-content"><div class="edition"><span></span> IN PRIMA PERSONA. ANCHE A TESTA IN GIÙ.</div><h1>GRAVITY<span>CAFÉ<span class="logo-orbit">✳</span></span></h1><p class="title-tagline">Il caffè è caldo.<br>La gravità è <em>opinabile.</em></p><div class="station-select"><div class="station-caption"><span>LA TUA PROSSIMA ORBITA</span><span id="station-number">01 / 08</span></div><div class="station-selector"><button id="prev-level" aria-label="Stazione precedente">${icon("arrow-left")}</button><div><strong id="station-title">Orbita tranquilla</strong><span id="station-desc">Il tuo primo turno tra le stelle</span></div><button id="next-level" aria-label="Stazione successiva">${icon("arrow-right")}</button></div><div class="station-dots">${LEVELS.map((_, i) => `<button data-level="${i}" aria-label="Stazione ${i + 1}: ${LEVELS[i].name}" class="${i === 0 ? "active" : ""}"></button>`).join("")}</div></div><div class="crew-select"><button id="solo" class="selected">${icon("coffee")} UN BARISTA</button><button id="coop">${icon("users")} DUE BARISTI <span>LOCALE</span></button></div><button class="play-button" id="start">${icon("play")} APRI IL BAR <span>↵</span></button><div class="menu-secondary"><button id="how">${icon("gamepad-2")} Come si gioca</button><label><input type="checkbox" id="practice"> Allenamento</label></div><div class="menu-record"><span>RECORD STAZIONE</span><b id="menu-best">0</b><span class="menu-stars" id="menu-stars">☆ ☆ ☆</span></div><p class="rotate-note">Su telefono, prova anche in orizzontale.</p></div><div class="menu-mission"><span class="mission-pin">${icon("orbit")}</span><div><span>DESTINAZIONE 01</span><strong id="mission-name">Orbita tranquilla</strong><p id="mission-brief">Prepara il caffè. Servilo. Prova a non lanciarlo nello spazio.</p></div></div></section>
<section class="hud" id="hud" hidden aria-label="Stato del turno"><div class="hud-top"><div class="score-hud"><span class="hud-eyebrow" id="hud-station">01 · ORBITA TRANQUILLA</span><div class="score-row"><b id="score">0</b><span>PT</span><div id="hud-stars" class="hud-stars">☆ ☆ ☆</div></div><div class="score-track"><span id="score-progress"></span><i></i><i></i></div><p><strong id="served">0</strong> serviti <span>·</span> <span id="target-copy">450 PT PER LA PRIMA STELLA</span></p></div><div class="tickets" id="orders" aria-label="Ordini da preparare"></div><div class="hud-right"><div class="timer"><span>TEMPO TURNO</span><strong id="time">03:00</strong></div><button class="round-button" id="pause" aria-label="Pausa">${icon("pause")}</button></div></div><div class="hud-bottom"><div class="inventory"><div class="inventory-art" id="inventory-art">${cupArt()}</div><div><span>IN MANO</span><strong id="inventory-name">Niente, per ora.</strong><p id="inventory-tip">E prende · Spazio lancia</p></div></div><div class="context"><div class="preparation" id="preparation" hidden><span id="prep-label">Estrazione espresso</span><div><i id="prep-fill"></i></div></div><div class="context-prompt" id="context-prompt"><kbd>E</kbd><span>Prendi una tazza</span></div><p id="context-detail">Alla macchina del caffè, poi di nuovo E per estrarre.</p></div><div class="gravity-meter"><div class="gravity-icon" id="gravity-icon">↓</div><div><strong id="gravity-label">GRAVITÀ NORMALE</strong><span>Cambio tra <b id="gravity-count">25s</b></span></div><span class="gravity-unit" id="gravity-unit">1G</span><div class="gravity-track"><i id="gravity-progress"></i></div></div></div><div class="keyboard-legend"><span><kbd>WASD</kbd> Muoviti · Mouse guarda</span><span><kbd>E</kbd> Interagisci</span><span><kbd>SPAZIO</kbd> Lancia / scatta</span><span><kbd>SHIFT</kbd> Frena</span><span id="deck-legend" hidden><kbd>R/F · Z/C</kbd> Quota / rollio</span><span class="missed-label">CLIENTI PERSI <b id="missed">0 / 5</b></span></div></section>
<div class="countdown-screen" id="countdown" hidden><span>ALLACCIA IL GREMBIULE</span><strong id="countdown-number">3</strong><p>Il caffè non si prepara da solo.</p></div><div class="announcement" id="announcement" role="status"><strong></strong><span></span></div><div class="toast" id="toast" role="status"></div>
<section class="results-screen" id="results" hidden><div class="results-content"><span class="result-eyebrow" id="result-eyebrow">TURNO COMPLETATO</span><h2 id="result-title">Un turno stellare.</h2><div class="result-stars" id="result-stars"></div><div class="result-score"><b id="result-score">0</b><span>PUNTI GALATTICI</span></div><p id="result-summary"></p><p class="result-record" id="result-record"></p><button class="play-button" id="retry">${icon("rotate-ccw")} UN ALTRO GIRO</button><button class="text-button" id="back-menu">${icon("home")} Torna alla base</button></div></section><div id="fatal" hidden></div><div class="corner-controls"><button id="audio" class="round-button" aria-label="Disattiva audio">${icon("volume-2")}</button><button id="fullscreen" class="round-button" aria-label="Schermo intero">${icon("maximize")}</button></div></main><dialog id="modal"><button class="modal-close" aria-label="Chiudi">${icon("x")}</button><div id="modal-body"></div></dialog>`;
function refreshIcons() {
  createIcons({ icons, attrs: { "stroke-width": 1.8 } });
}
function beep(f = 660) {
  if (sound) void audio.beep(f);
}
document.addEventListener(
  "pointerdown",
  () => {
    if (sound) void audio.unlock();
  },
  { capture: true, passive: true },
);
document.addEventListener(
  "keydown",
  () => {
    if (sound) void audio.unlock();
  },
  { capture: true },
);
function resetClock() {
  previous = performance.now();
  accumulator = 0;
}
function setScreen(value) {
  screen = value;
  if (["menu", "results"].includes(value)) world.releasePointer();
  document.body.dataset.screen = value;
  $("#menu").hidden = value !== "menu";
  $("#hud").hidden = !["playing", "countdown"].includes(value);
  $("#countdown").hidden = value !== "countdown";
  $("#results").hidden = value !== "results";
}
function toast(text) {
  $("#toast").textContent = text;
  toastUntil = performance.now() + 2400;
  $("#toast").classList.add("visible");
}
function announce(title, subtitle) {
  $("#announcement strong").textContent = title;
  $("#announcement span").textContent = subtitle;
  announcementUntil = performance.now() + 1700;
  $("#announcement").classList.add("visible");
}
function cancelJobs() {
  jobs = [null, null];
  world.setPreparation(0, null);
  world.setPreparation(1, null);
}
function openModal(html) {
  modalPaused = state.paused;
  state.paused = true;
  world.releasePointer();
  resetClock();
  $("#modal-body").innerHTML = html;
  $("#modal").showModal();
  refreshIcons();
}
function closeModal() {
  $("#modal").close();
  state.paused = modalPaused;
  resetClock();
}
$(".modal-close").onclick = closeModal;
$("#modal").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeModal();
});
function help() {
  openModal(
    `<span class="modal-kicker">MANUALE DEL BARISTA SPAZIALE</span><h2>Caffè sì.<br>Panico, anche.</h2><div class="help-recipe"><div>${cupArt("empty")}<span>PRENDI</span><b>E</b></div><i>→</i><div>${cupArt("espresso")}<span>ESTRAI</span><b>E</b></div><i>→</i><div>${icon("milk")}<span>LATTE?</span><b>E</b></div><i>→</i><div>${icon("star")}<span>SERVI</span><b>E</b></div></div><p>Alla macchina del caffè, <b>E</b> prende una tazza vuota. Un altro <b>E</b> avvia l’estrazione: resta vicino fino alla fine. Per caffellatte o cappuccino aggiungi latte o schiuma al distributore.</p><p>Porta la ricetta richiesta al bancone dorato e premi <b>E</b>. In 0G hai inerzia: <b>Shift</b> frena. <b>Spazio</b> lancia la tazza, o ti dà uno scatto a mani vuote. Puoi recuperare una tazza lanciata con E, ma un urto forte rovescia il caffè!</p><p>Dopo 45s possono arrivare VIP: pazienza ridotta, punti e penalità doppi. Dopo 75s compare il <b>Doppio espresso</b> (E con un espresso alla macchina); dopo 90s alcuni scontrini richiedono <b>due bevande</b>. Consegnale allo stesso cliente: la prima resta registrata, i punti arrivano completando la coppia.</p><div class="help-note">${coop ? "Due visuali indipendenti: sinistra P1, destra P2 (sopra/sotto in verticale). " : ""}Prima persona: clicca la scena per catturare il mouse, oppure trascina per guardarti attorno. E agisce soltanto sul bersaglio nel mirino. In 0G: R/F trasla lungo l’alto locale, Z/C ruota il corpo; Shift frena su tutti e tre gli assi. Controller: stick sinistro muove, destro guarda, A interagisce, X lancia, B frena, Y/LT quota, LB/RB rollio. Co-op split-screen: P2 usa frecce, IJKL per lo sguardo, U/O rollio, PagSu/PagGiù quota, Invio interagisce e 0 lancia.</div>${LEVELS[level].brief ? `<p class="map-instructions">${LEVELS[level].brief}</p>` : ""}<button class="play-button compact" id="got-it">CI SONO ${icon("arrow-right")}</button>`,
  );
  $("#got-it").onclick = closeModal;
}
$("#how").onclick = help;
function pause() {
  if (!["playing", "countdown"].includes(screen)) return;
  if ($("#modal").open) {
    closeModal();
    return;
  }
  openModal(
    `<span class="modal-kicker">UN MOMENTO DI CALMA NEL CAOS</span><h2 class="pause-title">PAUSA.</h2><p>Respira. Il caffè può aspettare, per una volta.</p><button class="play-button" id="resume">${icon("play")} RIPRENDI</button><div class="pause-options"><button id="pause-help">${icon("gamepad-2")} Comandi</button><button id="restart">${icon("rotate-ccw")} Ricomincia</button><button id="leave">${icon("home")} Menu principale</button></div>`,
  );
  $("#resume").onclick = closeModal;
  $("#restart").onclick = () => {
    closeModal();
    start();
  };
  $("#leave").onclick = () => {
    closeModal();
    goMenu();
  };
  $("#pause-help").onclick = () => {
    closeModal();
    help();
  };
}
$("#pause").onclick = pause;
function selectLevel(index) {
  if (screen !== "menu") return;
  level = (index + LEVELS.length) % LEVELS.length;
  state = createState(level, { practice });
  reactorBeepKey = "";
  world.setLevel(level);
  world.setMenuMode(true);
  const item = LEVELS[level];
  $("#station-title").textContent = item.name;
  $("#station-desc").textContent = item.subtitle;
  $("#mission-name").textContent = item.name;
  $(".menu-mission>div>span").textContent = `DESTINAZIONE 0${level + 1}`;
  $("#mission-brief").textContent =
    item.brief ??
    [
      "Prepara il caffè. Servilo. Prova a non lanciarlo nello spazio.",
      "La cucina gira. Tu prova a non perdere la testa.",
      "Ancora le tue intenzioni. Qui anche il caffè viene attratto dal vuoto.",
    ][level];
  $("#station-number").textContent =
    `${String(level + 1).padStart(2, "0")} / ${String(LEVELS.length).padStart(2, "0")}`;
  document.querySelectorAll("[data-level]").forEach((button, i) => {
    button.classList.toggle("active", i === level);
    button.setAttribute("aria-pressed", String(i === level));
  });
  const best = records.read(item.tag);
  $("#menu-best").textContent = best;
  $("#menu-stars").textContent =
    "★".repeat(starsFor(best)) + "☆".repeat(3 - starsFor(best));
  $("#deck-legend").hidden = false;
  resetClock();
}
$("#prev-level").onclick = () => {
  selectLevel(level - 1);
  beep(330);
};
$("#next-level").onclick = () => {
  selectLevel(level + 1);
  beep(440);
};
document
  .querySelectorAll("[data-level]")
  .forEach(
    (button) =>
      (button.onclick = () => selectLevel(Number(button.dataset.level))),
  );
function setCoop(value) {
  coop = value;
  world.setCoop(value);
  $("#solo").classList.toggle("selected", !value);
  $("#coop").classList.toggle("selected", value);
  $(".player-tag-2").hidden = !value;
  beep(value ? 660 : 440);
}
$("#solo").onclick = () => setCoop(false);
$("#coop").onclick = () => setCoop(true);
$("#practice").onchange = (event) => {
  practice = event.target.checked;
};
$("#audio").onclick = () => {
  sound = !sound;
  $("#audio").innerHTML = icon(sound ? "volume-2" : "volume-x");
  $("#audio").setAttribute(
    "aria-label",
    sound ? "Disattiva audio" : "Attiva audio",
  );
  refreshIcons();
  if (sound) beep();
};
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("Usa la modalità a schermo intero del browser.");
  }
};
function renderOrders() {
  $("#orders").innerHTML = orders
    .map((order) => {
      const items = order.items ?? [{ type: order.type, delivered: false }];
      return `<div class="ticket ${order.variant ?? "regular"}" data-ticket="${order.id}"><span class="ticket-number">#${String(order.id).padStart(2, "0")}</span><span class="ticket-alien">${alienAvatar(order.customer ?? 0)}</span><div class="ticket-cup">${cupArt(order.type)}</div><strong>${items.map((item) => `<span class="${item.delivered ? "delivered" : ""}">${item.delivered ? "✓ " : ""}${DRINK_NAMES[item.type]}</span>`).join(" + ")}</strong><div class="ticket-kind">${order.variant === "vip" ? "VIP · ×2 PUNTI / −50" : order.variant === "double" ? "2 BEVANDE · CONSEGNE SEPARATE" : "UN CLIENTE · UN CAFFÈ"}</div><div class="ticket-time"><span><i style="width:${(order.time / order.total) * 100}%"></i></span><b>${Math.ceil(order.time)}s</b></div></div>`;
    })
    .join("");
}

function start() {
  if ($("#modal").open) closeModal();
  state = createState(level, { practice });
  reactorBeepKey = "";
  serial = 0;
  orders = [0, 1, 2].map(() => makeOrder(serial++));
  cancelJobs();
  world.setLevel(level);
  world.setCoop(coop);
  world.setMenuMode(false);
  countdown = 3;
  lastGravity = "";
  $("#toast").classList.remove("visible");
  lastCount = 3;
  setScreen("countdown");
  $("#scene").focus({ preventScroll: true });
  $("#countdown-number").textContent = "3";
  $("#hud-station").textContent =
    `0${level + 1} · ${LEVELS[level].name.toUpperCase()}`;
  $(".player-tag-2").hidden = !coop;
  renderOrders();
  renderHUD();
  resetClock();
  beep(440);
}
function goMenu() {
  cancelJobs();
  state.running = false;
  state.paused = false;
  world.setMenuMode(true);
  world.clearInput();
  setScreen("menu");
  selectLevel(level);
  $("#toast").classList.remove("visible");
  $("#announcement").classList.remove("visible");
  resetClock();
}
$("#start").onclick = start;
$("#retry").onclick = start;
$("#back-menu").onclick = goMenu;
function floatScore(value) {
  const element = document.createElement("div");
  element.className = "score-float";
  element.textContent = `+${value}`;
  element.style.left = "50%";
  element.style.top = "46%";
  $("#viewport").append(element);
  setTimeout(() => element.remove(), 1200);
}
function interact(player) {
  if (screen !== "playing" || !state.running || state.paused) return;
  if (jobs[player]) return;
  const drink = world.getDrink(player),
    station = world.getStation(player);
  if (!drink && world.pickup(player)) {
    beep(520);
    return;
  }
  if (!station && world.interactEnvironment(player)) return;
  if (station === "coffee" && !drink) {
    if (world.takeCup(player)) {
      beep(520);
      world.feedback("brew", player);
    } else toast("Tazze in riordino… un secondo!");
    return;
  }
  const preparation = preparationFor(station, drink);
  if (preparation) {
    const p = world.getPosition(player);
    jobs[player] = { ...preparation, anchor: { x: p.x, y: p.y, z: p.z } };
    world.setPreparation(player, station);
    beep(220);
    return;
  }
  if (station === "service" && drink) {
    const before = state.score;
    const target = world.getTarget(player),
      orderId = target?.kind === "customer" ? target.orderId : undefined;
    const matching = orders.find(
      (order) =>
        (orderId === undefined || order.id === orderId) &&
        pendingDrinks(order).includes(drink) &&
        (state.practice || order.time > 0),
    );
    if (serveDrink(state, drink, orders, orderId)) {
      const complete = !orders.includes(matching);
      world.customerServed(matching.id, complete);
      world.holdDrink(player, null);
      world.feedback("serve", player);
      if (complete)
        orders.push(
          makeOrder(serial++, Math.random, { elapsed: state.elapsed }),
        );
      else toast("Prima bevanda ricevuta! Completa lo stesso scontrino.");
      renderOrders();
      if (state.score > before) floatScore(state.score - before);
      beep(784);
      setTimeout(() => beep(1046), 90);
      $("#score").animate(
        [{ transform: "scale(1.3)" }, { transform: "scale(1)" }],
        { duration: 230 },
      );
    } else {
      toast(
        drink === "empty"
          ? "Prima estrai il caffè: la tazza è vuota!"
          : "Questa ricetta non è richiesta. Guarda gli ordini in alto.",
      );
      beep(180);
    }
    return;
  }
  if (!drink) toast("Punta il mirino sulla macchina del caffè, poi premi E.");
  else if (drink === "empty")
    toast("Tazza vuota! Torna alla macchina e premi E per estrarre.");
  else
    toast(
      "Per il latte vai al distributore. Per servire, raggiungi il bancone dorato.",
    );
}
let world;
try {
  world = createWorld($("#scene"), {
    getState: () => state,
    getOrders: () => orders,
    interact,
    notify: toast,
    onPause: pause,
    throwDrink: () => beep(310),
    onSpill: () => {
      if (state.running) {
        state.spills++;
        state.combo = 0;
        toast("Caffè rovesciato! La tazza si può ancora recuperare.");
        beep(140);
      }
    },
  });
} catch (error) {
  $("#fatal").hidden = false;
  $("#fatal").textContent =
    "Non riesco ad avviare il motore 3D. Serve un browser con WebGL 2 e accelerazione grafica attiva.";
  $("#start").disabled = true;
  throw error;
}
function updateJobs(dt) {
  for (let player = 0; player < (coop ? 2 : 1); player++) {
    const job = jobs[player];
    if (!job) continue;
    const p = world.getPosition(player);
    const moved =
      Math.hypot(p.x - job.anchor.x, p.y - job.anchor.y, p.z - job.anchor.z) >
      0.8;
    const result = advancePreparation(job, dt, {
      running: state.running,
      paused: state.paused,
      station: moved
        ? null
        : world.getNearbyStation(player) === job.station
          ? job.station
          : null,
      drink: world.getDrink(player),
    });
    if (result === "complete") {
      world.holdDrink(player, job.result);
      world.setPreparation(player, null);
      world.feedback("brew", player);
      jobs[player] = null;
      beep(job.result === "espresso" ? 600 : 800);
    } else if (result === "cancelled") {
      jobs[player] = null;
      world.setPreparation(player, null);
      toast("Preparazione interrotta. Resta vicino e premi E per riprovare.");
    }
  }
}
function context() {
  const drink = world.getDrink(0),
    station = world.getStation(0);
  if (jobs[0])
    return [
      "",
      "Resta vicino…",
      !state.gravity
        ? "Frena con Shift per non andare alla deriva."
        : "Se ti allontani, la preparazione si interrompe.",
    ];
  if (!drink && world.hasPickup(0))
    return [
      "E",
      "Recupera la tazza",
      "Anche al volo. Nessuna tazza resta indietro.",
    ];
  if (station === "coffee" && !drink)
    return [
      "E",
      "Prendi una tazza",
      "Poi premi di nuovo E per estrarre il caffè.",
    ];
  if (station === "coffee" && drink === "empty")
    return [
      "E",
      "Estrai un espresso",
      "Resta vicino alla macchina per completarlo.",
    ];
  if (station === "coffee" && drink === "espresso")
    return [
      "E",
      "Estrai un doppio espresso",
      "Seconda estrazione. Fallo solo se richiesto sullo scontrino.",
    ];
  if (station === "milk" && drink === "espresso")
    return [
      "E",
      "Aggiungi il latte",
      "Per il cappuccino, ripeti per montare la schiuma.",
    ];
  if (station === "milk" && drink === "latte")
    return ["E", "Monta la schiuma", "Ultimo tocco per un cappuccino cosmico."];
  if (station === "service" && drink && drink !== "empty") {
    const target = world.getTarget(0),
      order = orders.find((order) => order.id === target?.orderId);
    if (order && !pendingDrinks(order).includes(drink))
      return [
        "",
        `Cliente #${order.id}: ${pendingDrinks(order)
          .map((type) => DRINK_NAMES[type])
          .join(" + ")}`,
        "Questa bevanda è per un altro cliente. Punta quello giusto o il vassoio.",
      ];
    return [
      "E",
      order ? `Servi il cliente #${order.id}` : "Servi l’ordine",
      "Una tazza alla volta. I doppi pagano al completamento.",
    ];
  }
  const target = world.getTarget(0);
  if (target?.kind === "lift")
    return [
      "E",
      "Usa l’ascensore",
      "Guarda il pannello. Il prossimo piano ti aspetta.",
    ];
  if (target?.kind === "vine")
    return ["E", "Afferra la liana", "Uno slancio nella serra orbitale."];
  if (level === MELT_LEVEL)
    return [
      "E",
      `Piano ${world.getDeck(0)} · Ascensori ai lati`,
      !state.gravity
        ? "R sale · F scende · Il pavimento è rovente!"
        : "Caffè al piano 1 · Latte al piano 2 · Servi al piano 0",
    ];
  if (!drink)
    return [
      navigator.maxTouchPoints > 0 ? "PAD" : "WASD",
      "Raggiungi la macchina del caffè",
      "Segui CAFFÈ, punta la macchina con il mirino e premi E.",
    ];
  return [
    navigator.maxTouchPoints > 0 ? "PAD" : "WASD",
    nextObjective(drink, orders) === "service"
      ? "Porta il caffè al bancone dorato"
      : drink === "empty" || nextObjective(drink, orders) === "coffee"
        ? "Torna alla macchina del caffè"
        : "Raggiungi il distributore del latte",
    "Spazio lancia · Q lascia · Shift frena in 0G",
  ];
}
function renderHUD() {
  const drink = world.getDrink(0);
  $("#time").textContent = formatTime(state.remaining);
  $(".timer").classList.toggle("urgent", state.remaining < 30);
  $("#score").textContent = state.score;
  $("#served").textContent = state.served;
  $("#missed").textContent = `${state.missed ?? 0} / 5`;
  const stars = starsFor(state.score);
  $("#hud-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("#score-progress").style.width =
    `${Math.min(100, (state.score / STAR_TARGETS[2]) * 100)}%`;
  $("#target-copy").textContent =
    stars === 3
      ? "TRE STELLE. ORA ESAGERA."
      : `${STAR_TARGETS[stars]} PT PER ${stars ? "LA PROSSIMA" : "LA PRIMA"} STELLA`;
  const oldType = $("#inventory-art").dataset.type;
  if (oldType !== (drink ?? "")) {
    $("#inventory-art").innerHTML = cupArt(drink ?? "empty");
    $("#inventory-art").dataset.type = drink ?? "";
  }
  $(".inventory").classList.toggle("holding", !!drink);
  $("#inventory-name").textContent = drink ? DRINK_NAMES[drink] : "Mani libere";
  $("#inventory-tip").textContent = drink
    ? "Spazio lancia · Q lascia"
    : "Spazio per uno scatto";
  const env = getMapEnvironment(level, state.elapsed);
  $("#gravity-label").textContent =
    env?.label.toUpperCase() ??
    (state.gravity ? "GRAVITÀ NORMALE" : "GRAVITÀ ZERO");
  $("#gravity-count").textContent = `${Math.ceil(state.gravityClock)}s`;
  $("#gravity-unit").textContent = state.gravity ? "1G" : "0G";
  $("#gravity-icon").textContent = state.gravity ? "↓" : "↟";
  $(".gravity-meter").classList.toggle("zero", !state.gravity);
  $(".gravity-meter").classList.toggle("warning", state.gravityClock < 5);
  $("#gravity-progress").style.width =
    `${(state.gravityClock / LEVELS[level].gravityInterval) * 100}%`;
  const [key, title, detail] = context();
  $("#context-prompt").innerHTML =
    `${key ? `<kbd>${key}</kbd>` : ""}<span>${title}</span>`;
  $("#context-detail").textContent = detail;
  $("#preparation").hidden = !jobs[0];
  if (jobs[0]) {
    $("#prep-label").textContent = jobs[0].label;
    $("#prep-fill").style.width =
      `${(jobs[0].elapsed / jobs[0].duration) * 100}%`;
  }
  world.setObjective(nextObjective(drink, orders));
  orders.forEach((order) => {
    const ticket = $(`[data-ticket="${order.id}"]`);
    if (ticket) {
      ticket.classList.toggle("urgent", order.time / order.total < 0.25);
      ticket.querySelector(".ticket-time b").textContent =
        `${Math.ceil(order.time)}s`;
      ticket.querySelector(".ticket-time i").style.width =
        `${(order.time / order.total) * 100}%`;
    }
  });
}
function finish() {
  state.running = false;
  cancelJobs();
  world.clearInput();
  setScreen("results");
  const stars = starsFor(state.score),
    best = records.save(LEVELS[level].tag, state.score, {
      eligible: !state.practiceUsed,
    });
  $("#result-eyebrow").textContent =
    state.missed >= 5 ? "TROPPI CLIENTI PERSI" : "FINE DEL TURNO";
  $("#result-title").textContent =
    stars === 3
      ? "Sei una forza cosmica."
      : stars
        ? "Un turno stellare."
        : "Il caos ha vinto. Per ora.";
  $("#result-stars").innerHTML = [0, 1, 2]
    .map(
      (i) =>
        `<span class="${i < stars ? "earned" : ""}" style="--delay:${i * 0.18}s">★</span>`,
    )
    .join("");
  $("#result-score").textContent = state.score;
  $("#result-summary").textContent =
    `${state.served} ordini serviti · ${state.spills} caffè rovesciati · ${state.missed ?? 0} clienti persi`;
  $("#result-record").textContent = state.practiceUsed
    ? "Allenamento: record non aggiornato."
    : `Record di ${LEVELS[level].name}: ${best} punti`;
  beep(stars ? 880 : 180);
}
window.addEventListener("keydown", (event) => {
  if ($("#modal").open) return;
  if (event.code === "Escape" && !event.repeat) {
    if (screen === "results") goMenu();
    else pause();
    return;
  }
  if (screen === "menu") {
    if (event.code === "Enter" && !event.repeat) start();
    if (event.code === "ArrowLeft") selectLevel(level - 1);
    if (event.code === "ArrowRight") selectLevel(level + 1);
    return;
  }
  if (screen === "playing" && !event.repeat) {
    if (event.code === "KeyE") interact(0);
    if (coop && event.code === "Enter") interact(1);
  }
});
window.addEventListener("blur", () => {
  if (screen === "playing" && state.running && !state.paused) pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "playing" && !state.paused) pause();
});
function frame(now) {
  const raw = Math.max(0, (now - previous) / 1000);
  previous = now;
  const dt = Math.min(raw, 0.25);
  let activeElapsed = raw;
  if (screen === "countdown" && !$("#modal").open) {
    countdown -= raw;
    const count = Math.ceil(countdown);
    if (count !== lastCount && count > 0) {
      lastCount = count;
      $("#countdown-number").textContent = count;
      beep(440 + (3 - count) * 110);
    }
    if (countdown <= 0) {
      activeElapsed = -countdown;
      setScreen("playing");
      state.running = true;
      world.clearInput();
      announce("SI APRE!", "Un espresso alla volta. O quasi.");
      beep(1046);
    }
  }
  if (screen === "playing" && !state.paused) {
    const expired = advanceOrders(state, orders, activeElapsed);
    const wasRunning = state.running;
    advanceState(state, activeElapsed);
    if (expired) {
      const lost = orders.filter((order) => order.time <= 0),
        count = lost.length,
        penalty = lost.reduce((sum, order) => sum + orderPenalty(order), 0);
      state.missed = (state.missed ?? 0) + count;
      state.score = Math.max(0, state.score - penalty);
      orders = orders.map((order) =>
        order.time <= 0
          ? makeOrder(serial++, Math.random, { elapsed: state.elapsed })
          : order,
      );
      renderOrders();
      toast(`Clienti persi: ${count} · −${penalty} punti · ${state.missed}/5`);
      beep(160);
    }
    updateJobs(activeElapsed);
    const env = getMapEnvironment(level, state.elapsed);
    if (LEVELS[level].tag === "REACTOR" && env?.countdown) {
      const key = `${Math.floor(state.elapsed / 16)}:${env.countdown}`;
      if (key !== reactorBeepKey) {
        beep(940 + (3 - env.countdown) * 180);
        reactorBeepKey = key;
        announce(
          `IMPULSO TRA ${env.countdown}`,
          "Riparati dietro banconi e paratie.",
        );
      }
    }
    const gravityKey = env?.phase ?? state.gravity;
    if (lastGravity !== gravityKey) {
      if (lastGravity !== "" && !env?.countdown) {
        announce(
          env?.label ??
            (state.gravity ? "GRAVITÀ RIPRISTINATA" : "GRAVITÀ ZERO!"),
          state.gravity
            ? "Piedi a terra. Caffè al bancone."
            : "Spingi per muoverti. Shift per frenare.",
        );
        beep(state.gravity ? 440 : 820);
      }
      lastGravity = gravityKey;
    }
    if (wasRunning && (!state.running || state.missed >= 5)) finish();
  }
  accumulator = Math.min(accumulator + dt, 0.25);
  while (accumulator >= 1 / 60) {
    world.update(1 / 60, now / 1000, false);
    accumulator -= 1 / 60;
  }
  world.adaptQuality(raw);
  world.render();
  uiClock += dt;
  if (uiClock > 0.075) {
    uiClock = 0;
    if (screen === "playing" || screen === "countdown") renderHUD();
  }
  if (now > toastUntil) $("#toast").classList.remove("visible");
  if (now > announcementUntil) $("#announcement").classList.remove("visible");
  requestAnimationFrame(frame);
}
refreshIcons();
selectLevel(0);
world.setMenuMode(true);
requestAnimationFrame(frame);
