import { CHARACTER_PRESETS, OUTFIT_SWATCHES } from './data/characters.js';
import {
  ESTATE_BOUNDS,
  ROOMS,
  WALL_SEGMENTS,
  DOORS,
  JEWELS,
  DIAMOND_HIDING_SPOTS,
  SECRET_PASSAGES,
  HIDING_SPOTS,
  CCTV_CAMERAS,
  CCTV_STATION,
  SABOTAGE_REPAIR_POINTS,
  EMERGENCY_BUTTON,
  TASKS,
  getRoomAt,
} from './data/villaLayout.js';
import {
  createRealisticHumanoid,
  updateHumanoidAnimation,
  renderCharacterPortrait,
} from './graphics/humanoid.js';
import { VillaSceneManager } from './graphics/villaScene.js';
import { GameSimulation } from './engine/gameSimulation.js';
import { NetworkClient } from './engine/networkClient.js';
import { soundEngine } from './audio/soundEngine.js';

// =========================================================
// APPLICATION STATE
// =========================================================
const canvas = document.getElementById('game-canvas');
const villaScene = new VillaSceneManager(canvas);

let selectedPreset = CHARACTER_PRESETS[0];
let customAppearance = { ...selectedPreset };

let playMode = null; // 'offline' | 'online'
let localSim = null;
let netState = null;
let currentLobby = null;
let localPlayerId = 'local_human';

// 3D Avatar Meshes keyed by playerId
const avatarMeshes = new Map();

// Input & Interaction State
const keysDown = new Set();
let clickMoveTarget = null;
let activeChannel = null; // { label, elapsed, duration, onComplete }
let cctvOpen = false;
let activeCctvCamId = CCTV_CAMERAS[0].id;
let lastCctvTelemetry = null;
let blueprintOpen = false;
let tasksCollapsed = false;
let lastKnownPhase = null;
let lastRenderedMsgCount = 0;
let lastRenderedVoteCount = -1;
let lastRenderedEvCount = -1;
let lastMeetingSubPhase = null;

// =========================================================
// TOAST HELPER
// =========================================================
function showToast(text, danger = false) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast-item${danger ? ' danger' : ''}`;
  el.textContent = text;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

// =========================================================
// NETWORK CLIENT SETUP (ONLINE MATCHMAKING & PRIVATE ROOMS)
// =========================================================
const netClient = new NetworkClient({
  onMessage: (data) => {
    if (data.type === 'error_msg') {
      showToast(data.message, true);
      return;
    }
    if (data.type === 'joined_room' || data.type === 'lobby_update') {
      currentLobby = data.lobby;
      renderWaitingRoomUI();
      return;
    }
    if (data.type === 'sim_state') {
      const prevPhase = netState?.phase;
      netState = data.state;
      if (playMode === 'online') {
        handlePhaseTransitions(prevPhase, netState.phase, netState);
      }
      return;
    }
    if (data.type === 'sim_event') {
      handleSimEvent(data.event);
    }
  },
  onVoiceActivity: (v) => {
    showToast(`🎙️ ${v.senderName} sta parlando in riunione...`);
  },
  onDisconnect: () => {
    if (playMode === 'online') {
      showToast('Connessione con la stanza online interrotta.', true);
      exitToMainMenu();
    }
  },
});

function getSimState() {
  return playMode === 'offline' ? localSim?.state : netState;
}

function getLocalPlayer() {
  const st = getSimState();
  if (!st) return null;
  return st.players.find((p) => p.id === localPlayerId) || null;
}

// =========================================================
// LOBBY & CHARACTER CUSTOMIZATION UI
// =========================================================
const nameInput = document.getElementById('player-name-input');
const lobbyPortraitImg = document.getElementById('lobby-portrait-img');
const roleTitleEl = document.getElementById('selected-char-role-title');
const presetGridEl = document.getElementById('preset-grid');
const swatchGridEl = document.getElementById('swatch-grid');

function refreshProfilePreview() {
  const playerName = nameInput.value.trim() || selectedPreset.name;
  customAppearance.name = playerName;
  roleTitleEl.textContent = selectedPreset.roleTitle;
  lobbyPortraitImg.src = renderCharacterPortrait(customAppearance);

  if (netClient.connected) {
    netClient.send({
      type: 'set_profile',
      name: playerName,
      presetId: selectedPreset.id,
      appearance: customAppearance,
    });
  }
}

function buildLobbyCustomizer() {
  nameInput.value = selectedPreset.name;

  presetGridEl.innerHTML = '';
  CHARACTER_PRESETS.forEach((preset, idx) => {
    const btn = document.createElement('button');
    btn.className = `preset-btn${idx === 0 ? ' active' : ''}`;
    const thumb = renderCharacterPortrait(preset);
    btn.innerHTML = `<img src="${thumb}" alt="${preset.name}" /><span>${preset.name.split(' ')[0]}</span>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const userEditedName =
        nameInput.value.trim() &&
        !CHARACTER_PRESETS.some((c) => c.name === nameInput.value.trim());
      selectedPreset = preset;
      customAppearance = { ...preset };
      if (!userEditedName) nameInput.value = preset.name;
      refreshProfilePreview();
    });
    presetGridEl.appendChild(btn);
  });

  swatchGridEl.innerHTML = '';
  OUTFIT_SWATCHES.forEach((sw, idx) => {
    const btn = document.createElement('button');
    btn.className = `swatch-btn${idx === 0 ? ' active' : ''}`;
    btn.innerHTML = `<span class="swatch-dot" style="background:${sw.jacket}"></span><span>${sw.label}</span>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.swatch-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      customAppearance = {
        ...customAppearance,
        jacketColor: sw.jacket,
        trouserColor: sw.trouser,
        accentColor: sw.accent,
        badgeHex: sw.badge,
      };
      refreshProfilePreview();
    });
    swatchGridEl.appendChild(btn);
  });

  nameInput.addEventListener('input', refreshProfilePreview);
  refreshProfilePreview();
}

function renderWaitingRoomUI() {
  if (!currentLobby) return;
  document.getElementById('mode-select-view').classList.add('hidden');
  document.getElementById('room-waiting-view').classList.remove('hidden');

  document.getElementById('room-type-badge').textContent = currentLobby.isPublic
    ? 'MATCHMAKING PUBBLICO'
    : 'STANZA PRIVATA';
  document.getElementById('room-code-display').textContent = `CODICE: ${currentLobby.code}`;

  const listEl = document.getElementById('room-players-list');
  listEl.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const p = currentLobby.players[i];
    const row = document.createElement('div');
    row.className = 'room-slot-card';
    if (p) {
      const isHost = p.id === currentLobby.hostId;
      row.innerHTML = `
        <span class="room-slot-dot" style="background:${p.appearance?.badgeHex || '#d4af37'}"></span>
        <strong>${p.name}</strong>
        <span style="margin-left:auto;font-size:0.7rem;color:#94a3b8">${isHost ? '👑 Host' : 'Online'}</span>
      `;
    } else {
      row.innerHTML = `
        <span class="room-slot-dot" style="background:#334155"></span>
        <span style="color:#64748b">${currentLobby.fillWithBots ? 'Ospite IA (Auto)' : 'Slot Libero'}</span>
      `;
    }
    listEl.appendChild(row);
  }

  const isHost = currentLobby.hostId === netClient.playerId;
  const chkBots = document.getElementById('chk-fill-bots');
  chkBots.checked = currentLobby.fillWithBots;
  chkBots.disabled = !isHost;

  document.getElementById('btn-start-online-match').classList.toggle('hidden', !isHost);
  document.getElementById('waiting-host-msg').classList.toggle('hidden', isHost);
}

// =========================================================
// MATCH LAUNCHERS (OFFLINE & ONLINE)
// =========================================================
function clearAvatarMeshes() {
  for (const mesh of avatarMeshes.values()) {
    villaScene.scene.remove(mesh);
  }
  avatarMeshes.clear();
}

function syncAvatarMeshes(simState, dt, time) {
  const activeIds = new Set();
  for (const p of simState.players) {
    activeIds.add(p.id);
    let mesh = avatarMeshes.get(p.id);
    if (!mesh) {
      mesh = createRealisticHumanoid({ ...p.appearance, name: p.name }, true);
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = p.rotY || 0;
      villaScene.scene.add(mesh);
      avatarMeshes.set(p.id, mesh);
    }

    if (playMode === 'online' && p.id !== localPlayerId) {
      // Smooth network interpolation
      mesh.position.x += (p.x - mesh.position.x) * Math.min(1, dt * 12);
      mesh.position.z += (p.z - mesh.position.z) * Math.min(1, dt * 12);
    } else {
      mesh.position.x = p.x;
      mesh.position.z = p.z;
    }

    // Smooth yaw turn
    let diff = (p.rotY || 0) - mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    mesh.rotation.y += diff * Math.min(1, dt * 14);

    updateHumanoidAnimation(mesh, p, dt, time, p.id === localPlayerId);
  }

  for (const [id, mesh] of avatarMeshes.entries()) {
    if (!activeIds.has(id)) {
      villaScene.scene.remove(mesh);
      avatarMeshes.delete(id);
    }
  }
}

function startOfflineMatch() {
  playMode = 'offline';
  localPlayerId = 'local_human';
  clearAvatarMeshes();

  const playerName = nameInput.value.trim() || selectedPreset.name;
  localSim = new GameSimulation({
    mode: 'offline',
    onEvent: handleSimEvent,
  });

  localSim.initMatch(
    [
      {
        id: localPlayerId,
        name: playerName,
        presetId: selectedPreset.id,
        isBot: false,
        appearance: { ...customAppearance, name: playerName },
      },
    ]
  );

  lastKnownPhase = null;
  enterMatchGameplay(localSim.state);
}

async function ensureOnlineConnected() {
  await netClient.connect();
  localPlayerId = netClient.playerId;
  refreshProfilePreview();
}

function enterMatchGameplay(state) {
  document.getElementById('lobby-screen').classList.remove('active');
  document.getElementById('lobby-screen').classList.add('hidden');
  document.getElementById('gameover-modal').classList.add('hidden');
  document.getElementById('hud-overlay').classList.remove('hidden');

  const me = state.players.find((p) => p.id === localPlayerId);
  if (me) {
    document.getElementById('hud-avatar-img').src = renderCharacterPortrait(me.appearance);
    document.getElementById('hud-player-name').textContent = me.name;
    showRoleRevealBanner(me);
  }
  handlePhaseTransitions(null, state.phase, state);
}

function showRoleRevealBanner(me) {
  const overlay = document.getElementById('role-reveal-overlay');
  const card = document.getElementById('role-reveal-card');
  const title = document.getElementById('reveal-role-title');
  const desc = document.getElementById('reveal-role-desc');
  const objs = document.getElementById('reveal-objectives');

  const isThief = me.role === 'thief';
  card.classList.toggle('thief', isThief);

  if (isThief) {
    title.textContent = '🕵️ SEI IL LADRO DELLA VILLA';
    title.style.color = '#f87171';
    desc.textContent =
      'Hai già rubato "La Stella di Venezia" dalla teca centrale! Mimetizzati tra gli ospiti, proteggi o nascondi il Diamante Principale e trafuga altri 8 gioielli minori.';
    objs.innerHTML = `
      <div>💎 <strong>Colpo:</strong> Ruba 8 gioielli sparsi senza farti riprendere dalle 6 telecamere CCTV.</div>
      <div>🕳️ <strong>Passaggi Segreti [Q]:</strong> Usa Armadio, Libreria, Cantina e Gazebo per spostarti all'istante.</div>
      <div>⚡ <strong>Sabotaggi [1-2-3]:</strong> Oscura i monitor CCTV, spegni le luci o blocca le porte delle ali.</div>
    `;
  } else {
    title.textContent = '🛡️ SEI UN CIVILE / INQUILINO';
    title.style.color = '#38bdf8';
    desc.textContent =
      'La teca nell’Atrio è stata infranta! Uno dei 10 presenti è il Ladro. Collabora, controlla le telecamere di sicurezza e smascheralo in Riunione Plenaria.';
    objs.innerHTML = `
      <div>📹 <strong>Sorveglianza [C]:</strong> Osserva le telecamere CCTV e clicca <em>Salva Prova Fotografica</em> se cogli un furto!</div>
      <div>🔍 <strong>Indagine [E]:</strong> Completa gli incarichi di sicurezza fino al 100% e ispeziona i possibili nascondigli del Diamante.</div>
      <div>🚨 <strong>Riunione [E / R]:</strong> Segnala teche scassinate o premi il Pulsante d’Emergenza nell’Atrio per votare!</div>
    `;
  }

  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 4000);
}

function exitToMainMenu() {
  if (playMode === 'online') {
    netClient.send({ type: 'leave_room' });
  }
  if (localSim) localSim.clearTimers();
  playMode = null;
  localSim = null;
  netState = null;
  currentLobby = null;
  cctvOpen = false;
  blueprintOpen = false;
  activeChannel = null;
  clearAvatarMeshes();

  document.getElementById('hud-overlay').classList.add('hidden');
  document.getElementById('cctv-modal').classList.add('hidden');
  document.getElementById('blueprint-modal').classList.add('hidden');
  document.getElementById('meeting-modal').classList.add('hidden');
  document.getElementById('gameover-modal').classList.add('hidden');
  document.getElementById('mode-select-view').classList.remove('hidden');
  document.getElementById('room-waiting-view').classList.add('hidden');
  document.getElementById('lobby-screen').classList.remove('hidden');
}

// =========================================================
// EVENT & PHASE HANDLERS
// =========================================================
function handleSimEvent(ev) {
  if (!ev) return;
  switch (ev.type) {
    case 'jewel_stolen':
      if (ev.playerId === localPlayerId) {
        soundEngine.playJewelStolen();
        showToast(`💎 Gioiello trafugato! (${ev.count}/8 completati)`);
      }
      break;
    case 'task_complete':
      if (ev.playerId === localPlayerId) {
        soundEngine.playTaskComplete();
        showToast('🛡️ Protocollo di sicurezza completato (+20% Batteria CCTV)');
      }
      break;
    case 'diamond_stashed':
      showToast('💠 Hai nascosto "La Stella di Venezia" nel nascondiglio segreto!');
      break;
    case 'diamond_retrieved':
      showToast('💠 Hai ripreso con te "La Stella di Venezia"!');
      break;
    case 'diamond_recovered':
      soundEngine.playTaskComplete();
      showToast(`🚨 ${ev.playerName} ha scoperto il nascondiglio della Stella di Venezia!`, false);
      break;
    case 'secret_passage':
      if (ev.playerId === localPlayerId) {
        soundEngine.playSecretPassage();
        showToast('🕳️ Passaggio segreto attraversato!');
      }
      break;
    case 'sabotage':
      soundEngine.playSabotage();
      if (ev.kind === 'cctv') showToast('📡 SABOTAGGIO: Segnale telecamere CCTV manomesso!', true);
      if (ev.kind === 'blackout') showToast('🌑 BLACKOUT: Luci della Villa disattivate!', true);
      if (ev.kind === 'doors') showToast(`🔒 SABOTAGGIO: Porte dell'ala bloccate per 12s!`, true);
      break;
    case 'sabotage_repaired':
      soundEngine.playTaskComplete();
      showToast('🔧 Centralina riparata: Luci e Telecamere CCTV ripristinate!');
      break;
    case 'meeting_started':
      soundEngine.playEmergencyAlarm();
      break;
    case 'vote_cast':
      soundEngine.playVoteClick();
      break;
    case 'gameover': {
      const me = getLocalPlayer();
      const won =
        (ev.winner === 'thief' && me?.role === 'thief') ||
        (ev.winner === 'civilians' && me?.role === 'civilian');
      soundEngine.playVictory(won);
      break;
    }
  }
}

function handlePhaseTransitions(prevPhase, nextPhase, state) {
  if (playMode === 'online' && !prevPhase && nextPhase === 'playing') {
    enterMatchGameplay(state);
  }
  if (prevPhase === nextPhase && lastKnownPhase === nextPhase) return;
  lastKnownPhase = nextPhase;

  if (nextPhase === 'meeting') {
    activeChannel = null;
    closeCctvModal();
    document.getElementById('blueprint-modal').classList.add('hidden');
    blueprintOpen = false;
    lastRenderedMsgCount = 0;
    lastRenderedVoteCount = -1;
    lastRenderedEvCount = -1;
    lastMeetingSubPhase = null;
    document.getElementById('meeting-modal').classList.remove('hidden');
    renderMeetingModal(state, true);
  } else if (nextPhase === 'playing') {
    document.getElementById('meeting-modal').classList.add('hidden');
  } else if (nextPhase === 'gameover') {
    document.getElementById('meeting-modal').classList.add('hidden');
    closeCctvModal();
    renderGameoverModal(state);
  }
}

// =========================================================
// CONTEXTUAL INTERACTIONS IN THE VILLA
// =========================================================
function getProximityInteraction(me, state) {
  if (!me || me.eliminated) return null;

  // If currently hidden inside a spot, pressing E exits concealment!
  if (me.hidden) {
    return {
      type: 'toggle_hide',
      spotId: me.hidingSpotId,
      label: 'Esci dal Nascondiglio',
      instant: true,
    };
  }

  const candidates = [];
  const pushIfNear = (x, z, maxDist, item) => {
    const d = Math.hypot(me.x - x, me.z - z);
    if (d <= maxDist) candidates.push({ dist: d, ...item });
  };

  // 1. Sabotage Repair Panels (high priority when blackout or CCTV glitch is active!)
  if (state.sabotage.blackoutRemaining > 0 || state.sabotage.cctvGlitchRemaining > 0) {
    for (const rp of SABOTAGE_REPAIR_POINTS) {
      pushIfNear(rp.x, rp.z, 2.4, {
        type: 'repair',
        label: `Ripara ${rp.name}`,
        duration: 1.8,
      });
    }
  }

  // 2. Surveillance CCTV Console in Security Room
  pushIfNear(CCTV_STATION.x, CCTV_STATION.z, CCTV_STATION.radius, {
    type: 'open_cctv_desk',
    label: 'Apri Console Monitor CCTV',
    instant: true,
  });

  // 3. Emergency Plenary Button in Grand Foyer
  pushIfNear(EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.z, EMERGENCY_BUTTON.radius, {
    type: 'emergency_button',
    label:
      state.emergencyCooldown > 0
        ? `Emergenza (${ Math.ceil(state.emergencyCooldown)}s)`
        : me.emergencyCallsLeft > 0
        ? 'Chiama Riunione d’Emergenza!'
        : 'Chiamate Emergenza Esaurite',
    disabled: state.emergencyCooldown > 0 || me.emergencyCallsLeft <= 0,
    instant: true,
  });

  // 4. Role-Specific Actions
  if (me.role === 'thief') {
    // Steal Minor Jewels
    for (const j of JEWELS) {
      if (!state.jewels[j.id]?.stolen) {
        pushIfNear(j.x, j.z, 2.2, {
          type: 'steal_jewel',
          jewelId: j.id,
          label: `Ruba ${j.name}`,
          duration: 2.0,
          crime: 'FURTO GIOIELLO',
        });
      }
    }

    // Stash or Retrieve Main Diamond ("La Stella di Venezia")
    for (const ds of DIAMOND_HIDING_SPOTS) {
      if (state.mainDiamond.carrierId === me.id) {
        pushIfNear(ds.x, ds.z, 2.3, {
          type: 'diamond_stash',
          spotId: ds.id,
          label: `Nascondi Stella di Venezia (${ds.name})`,
          duration: 1.5,
          crime: 'OCCULTAMENTO DIAMANTE',
        });
      } else if (state.mainDiamond.stashedAt === ds.id || state.mainDiamond.recoveredByCivilians) {
        pushIfNear(ds.x, ds.z, 2.3, {
          type: 'diamond_stash',
          spotId: ds.id,
          label: `Recupera Stella di Venezia`,
          duration: 1.5,
          crime: 'TRAFUGAMENTO DIAMANTE',
        });
      }
    }

    // Fake Tasks to blend in with Civilians!
    for (const t of TASKS) {
      pushIfNear(t.x, t.z, 2.2, {
        type: 'fake_task',
        taskId: t.id,
        label: `Fingi: ${t.name}`,
        duration: 2.4,
      });
    }
  } else {
    // Civilian Security Tasks
    for (const assigned of me.assignedTasks) {
      if (assigned.done) continue;
      const t = TASKS.find((x) => x.id === assigned.id);
      if (t) {
        pushIfNear(t.x, t.z, 2.3, {
          type: 'civilian_task',
          taskId: t.id,
          label: t.name,
          duration: t.duration || 2.8,
        });
      }
    }

    // Inspect Potential Diamond Hiding Spots!
    for (const ds of DIAMOND_HIDING_SPOTS) {
      pushIfNear(ds.x, ds.z, 2.2, {
        type: 'inspect_diamond',
        spotId: ds.id,
        label: `Ispeziona ${ds.name}`,
        duration: 2.0,
      });
    }
  }

  // 5. Hiding Spots (Wardrobes, Screens, Hedges)
  for (const hs of HIDING_SPOTS) {
    pushIfNear(hs.x, hs.z, 2.0, {
      type: 'toggle_hide',
      spotId: hs.id,
      label: `Nasconditi (${hs.name})`,
      instant: true,
    });
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0] || null;
}

function getNearbySecretPassage(me) {
  if (!me || me.role !== 'thief' || me.eliminated) return null;
  for (const sp of SECRET_PASSAGES) {
    if (Math.hypot(me.x - sp.x, me.z - sp.z) <= 2.5) {
      return sp;
    }
  }
  return null;
}

function getNearbyCrimeClue(me, state) {
  if (!me || me.eliminated) return null;
  for (const j of JEWELS) {
    const js = state.jewels[j.id];
    if (js?.stolen && js.clueRemaining > 0 && Math.hypot(me.x - j.x, me.z - j.z) <= 2.9) {
      return j;
    }
  }
  return null;
}

function triggerPrimaryInteraction() {
  const state = getSimState();
  const me = getLocalPlayer();
  if (!state || state.phase !== 'playing' || !me || activeChannel) return;

  const act = getProximityInteraction(me, state);
  if (!act || act.disabled) return;

  if (act.instant) {
    executeCompletedAction(act);
    return;
  }

  // Start smooth channeling bar
  if (playMode === 'offline') {
    me.interacting = true;
    if (act.crime) {
      me.activeCrime = act.crime;
      me.crimeTimer = act.duration + 1.2;
    }
  } else {
    netClient.send({
      type: 'player_action',
      action: 'set_interacting',
      interacting: true,
      crime: act.crime || null,
    });
  }

  activeChannel = {
    label: act.label,
    elapsed: 0,
    duration: act.duration || 2.2,
    onComplete: () => executeCompletedAction(act),
  };
}

function executeCompletedAction(act) {
  const me = getLocalPlayer();
  if (!me) return;

  if (playMode === 'offline') {
    me.interacting = false;
    switch (act.type) {
      case 'open_cctv_desk':
        openCctvModal();
        break;
      case 'emergency_button':
        if (me.emergencyCallsLeft > 0 && localSim.state.emergencyCooldown <= 0) {
          me.emergencyCallsLeft--;
          localSim.startMeeting(me.id, 'Pulsante d’Emergenza attivato nell’Atrio!');
          handlePhaseTransitions('playing', 'meeting', localSim.state);
        }
        break;
      case 'toggle_hide':
        localSim.toggleHide(me.id, act.spotId);
        break;
      case 'repair':
        localSim.repairSabotage(me.id);
        break;
      case 'steal_jewel':
        localSim.completeJewelSteal(me.id, act.jewelId);
        break;
      case 'diamond_stash':
        localSim.toggleMainDiamondStash(me.id, act.spotId);
        break;
      case 'fake_task':
        soundEngine.playTaskComplete();
        showToast('🎭 Compito fittizio completato con disinvoltura.');
        break;
      case 'civilian_task':
        localSim.completeCivilianTask(me.id, act.taskId);
        break;
      case 'inspect_diamond': {
        const res = localSim.inspectDiamondSpot(me.id, act.spotId);
        if (!res.found) {
          showToast('🔍 Nessun diamante nascosto in questo punto.');
        }
        break;
      }
    }
    if (localSim?.state?.phase === 'gameover') {
      handlePhaseTransitions('playing', 'gameover', localSim.state);
    }
  } else {
    netClient.send({ type: 'player_action', action: 'set_interacting', interacting: false });
    switch (act.type) {
      case 'open_cctv_desk':
        openCctvModal();
        break;
      case 'emergency_button':
        netClient.send({ type: 'player_action', action: 'call_meeting', isClueReport: false });
        break;
      case 'toggle_hide':
        netClient.send({ type: 'player_action', action: 'toggle_hide', spotId: act.spotId });
        break;
      case 'repair':
        netClient.send({ type: 'player_action', action: 'repair' });
        break;
      case 'steal_jewel':
        netClient.send({ type: 'player_action', action: 'steal_jewel', jewelId: act.jewelId });
        break;
      case 'diamond_stash':
        netClient.send({ type: 'player_action', action: 'diamond_stash', spotId: act.spotId });
        break;
      case 'fake_task':
        soundEngine.playTaskComplete();
        showToast('🎭 Compito fittizio completato.');
        break;
      case 'civilian_task':
        netClient.send({ type: 'player_action', action: 'complete_task', taskId: act.taskId });
        break;
      case 'inspect_diamond':
        netClient.send({ type: 'player_action', action: 'inspect_diamond', spotId: act.spotId });
        showToast('🔍 Ispezione nascondiglio completata.');
        break;
    }
  }
}

// =========================================================
// CCTV MONITOR & PHOTOGRAPHIC EVIDENCE CAPTURE
// =========================================================
function buildCctvTabs() {
  const tabsEl = document.getElementById('cctv-cam-tabs');
  tabsEl.innerHTML = '';
  CCTV_CAMERAS.forEach((cam) => {
    const btn = document.createElement('button');
    btn.className = `cam-tab-btn${cam.id === activeCctvCamId ? ' active' : ''}`;
    btn.textContent = `${cam.code} · ${cam.name}`;
    btn.addEventListener('click', () => {
      activeCctvCamId = cam.id;
      document.querySelectorAll('.cam-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    tabsEl.appendChild(btn);
  });
}

function openCctvModal() {
  const me = getLocalPlayer();
  const state = getSimState();
  if (!me || !state || state.phase !== 'playing' || me.eliminated) return;
  if (me.currentRoom !== 'security' && (me.cctvBattery || 0) < 5) {
    showToast('🔋 Batteria Tablet CCTV scarica! Ricarica in Sala di Controllo o completando compiti.', true);
    return;
  }

  cctvOpen = true;
  document.getElementById('cctv-modal').classList.remove('hidden');
  if (playMode === 'offline') {
    me.usingCctv = true;
  } else {
    netClient.send({ type: 'player_action', action: 'set_cctv_open', open: true });
  }
  renderSavedEvidenceSidebar();
}

function closeCctvModal() {
  cctvOpen = false;
  document.getElementById('cctv-modal').classList.add('hidden');
  const me = getLocalPlayer();
  if (me) {
    if (playMode === 'offline') {
      me.usingCctv = false;
    } else if (netClient.connected) {
      netClient.send({ type: 'player_action', action: 'set_cctv_open', open: false });
    }
  }
}

function captureCctvEvidenceSnapshot() {
  const state = getSimState();
  const me = getLocalPlayer();
  if (!state || !me || !cctvOpen) return;
  if (state.sabotage.cctvGlitchRemaining > 0) {
    showToast('Impossibile salvare foto: segnale CCTV disturbato da sabotaggio!', true);
    return;
  }

  const feedCanvas = document.getElementById('cctv-feed-canvas');
  const imageUrl = feedCanvas.toDataURL('image/jpeg', 0.82);
  const camDef = CCTV_CAMERAS.find((c) => c.id === activeCctvCamId) || CCTV_CAMERAS[0];

  const telem = lastCctvTelemetry || {};
  const visibleNames = (telem.visiblePlayers || []).map((p) => p.name);
  const crimeInfo = telem.suspiciousActivity;

  const evidenceItem = {
    id: `ev_${Date.now()}`,
    camCode: camDef.code,
    camName: camDef.name,
    timestamp: new Date().toLocaleTimeString('it-IT'),
    imageUrl,
    summary: crimeInfo
      ? `🔴 ${crimeInfo.suspectName}: ${crimeInfo.crimeLabel}`
      : visibleNames.length > 0
      ? `Soggetti: ${visibleNames.join(', ')}`
      : 'Nessun ospite inquadrato',
    incriminatingSuspectId: crimeInfo ? crimeInfo.suspectId : null,
    crimeLabel: crimeInfo ? crimeInfo.crimeLabel : null,
  };

  soundEngine.playShutterClick();
  if (playMode === 'offline') {
    localSim.saveCctvEvidence(me.id, evidenceItem);
  } else {
    me.savedEvidence = me.savedEvidence || [];
    me.savedEvidence.unshift(evidenceItem);
    if (me.savedEvidence.length > 6) me.savedEvidence.pop();
    netClient.send({ type: 'player_action', action: 'save_evidence', evidence: evidenceItem });
  }

  renderSavedEvidenceSidebar();
  showToast(`📸 Prova salvata da ${camDef.code} (${evidenceItem.summary})`);
}

function renderSavedEvidenceSidebar() {
  const me = getLocalPlayer();
  const state = getSimState();
  if (!me || !state) return;

  const evs = me.savedEvidence || [];
  document.getElementById('saved-ev-count').textContent = String(evs.length);
  const listEl = document.getElementById('cctv-evidence-list');
  listEl.innerHTML = '';

  if (evs.length === 0) {
    listEl.innerHTML = '<div class="muted-xs">Nessuno scatto salvato. Osserva le stanze sospette!</div>';
  } else {
    for (const ev of evs) {
      const item = document.createElement('div');
      item.className = 'ev-thumb-item';
      item.innerHTML = `
        <img src="${ev.imageUrl}" alt="${ev.camCode}" />
        <div class="ev-thumb-meta">
          <strong>${ev.camCode} · ${ev.timestamp}</strong>
          <div>${ev.summary}</div>
        </div>
      `;
      listEl.appendChild(item);
    }
  }

  // Sensor logs
  const logsEl = document.getElementById('cctv-sensor-logs');
  logsEl.innerHTML = '';
  const logs = state.recentCctvLogs || [];
  if (logs.length === 0) {
    logsEl.innerHTML = '<div class="muted-xs">Nessuna infrazione registrata dai sensori automatici.</div>';
  } else {
    for (const l of logs.slice(0, 5)) {
      const row = document.createElement('div');
      row.className = 'sensor-log-row';
      row.textContent = `${l.camName}: Movimento anomalo (${l.crime})`;
      logsEl.appendChild(row);
    }
  }
}

// =========================================================
// ARCHITECTURAL BLUEPRINT MAP RENDERER (MINIMAP & FULL [M])
// =========================================================
function drawBlueprint(targetCanvas, state, me, detailed = false) {
  const ctx = targetCanvas.getContext('2d');
  const w = targetCanvas.width;
  const h = targetCanvas.height;

  ctx.fillStyle = '#070d19';
  ctx.fillRect(0, 0, w, h);

  const worldW = 70; // -35..+35
  const worldD = 56; // -28..+28
  const scale = Math.min((w - 16) / worldW, (h - 16) / worldD);
  const cx = w / 2;
  const cy = h / 2;

  const toScreen = (wx, wz) => [cx + wx * scale, cy + wz * scale];

  // Draw Rooms & Outdoor Zones
  for (const room of ROOMS) {
    const [x1, y1] = toScreen(room.bounds.minX, room.bounds.minZ);
    const [x2, y2] = toScreen(room.bounds.maxX, room.bounds.maxZ);
    ctx.fillStyle = room.indoor ? 'rgba(30, 41, 59, 0.85)' : 'rgba(20, 52, 34, 0.55)';
    if (room.id === 'pool_area') ctx.fillStyle = 'rgba(8, 145, 178, 0.32)';
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

    if (detailed) {
      const [lx, ly] = toScreen(room.labelPos.x, room.labelPos.z);
      ctx.fillStyle = room.indoor ? 'rgba(248, 250, 252, 0.78)' : 'rgba(167, 243, 208, 0.75)';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.shortName, lx, ly);
    }
  }

  // Draw Walls
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.78)';
  ctx.lineWidth = detailed ? 2.4 : 1.4;
  for (const seg of WALL_SEGMENTS) {
    const [sx1, sy1] = toScreen(seg.x1, seg.z1);
    const [sx2, sy2] = toScreen(seg.x2, seg.z2);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  }

  // Draw Locked Doors in red
  for (const d of DOORS) {
    if (state.sabotage.lockedWings[d.wing] > 0) {
      const [dx, dy] = toScreen(d.x, d.z);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(dx - 4, dy - 4, 8, 8);
    }
  }

  // Draw Jewels
  for (const j of JEWELS) {
    if (state.jewels[j.id]?.stolen) continue;
    const [jx, jy] = toScreen(j.x, j.z);
    ctx.fillStyle = me?.role === 'thief' ? '#fb7185' : 'rgba(56, 189, 248, 0.55)';
    ctx.beginPath();
    ctx.arc(jx, jy, detailed ? 4.2 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Civilian Tasks
  if (me && me.role === 'civilian') {
    for (const at of me.assignedTasks) {
      if (at.done) continue;
      const t = TASKS.find((x) => x.id === at.id);
      if (!t) continue;
      const [tx, ty] = toScreen(t.x, t.z);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(tx, ty, detailed ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw Thief Secret Passages & Stash Spots
  if (me && me.role === 'thief') {
    for (const sp of SECRET_PASSAGES) {
      const [px, py] = toScreen(sp.x, sp.z);
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(px - 4, py - 4, 8, 8);
    }
    for (const ds of DIAMOND_HIDING_SPOTS) {
      const [dx, dy] = toScreen(ds.x, ds.z);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(dx - 5, dy - 5, 10, 10);
    }
  }

  // Emergency Button in Foyer
  {
    const [ex, ey] = toScreen(EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.z);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(ex, ey, detailed ? 5.5 : 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // CCTV Cameras on Detailed Blueprint
  if (detailed) {
    for (const cam of CCTV_CAMERAS) {
      const [cxPos, cyPos] = toScreen(cam.pos.x, cam.pos.z);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(cxPos - 3.5, cyPos - 3.5, 7, 7);
    }
  }

  // Local Player Position Pulse
  if (me) {
    const [mx, my] = toScreen(me.x, me.z);
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(mx, my, detailed ? 6.5 : 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// =========================================================
// PLENARY MEETING, EVIDENCE SHARING & VOTING UI
// =========================================================
function openPhotoLightbox(imgUrl, caption) {
  document.getElementById('lightbox-img').src = imgUrl;
  document.getElementById('lightbox-caption').textContent = caption;
  document.getElementById('photo-lightbox').classList.remove('hidden');
}

function renderMeetingModal(state, forceFull = false) {
  const m = state.meeting;
  const me = getLocalPlayer();
  if (!m || !me) return;

  document.getElementById('meeting-reason-banner').textContent = `🚨 ${m.reason.toUpperCase()}`;
  document.getElementById('meeting-timer-val').textContent = `${Math.max(0, Math.ceil(m.timer))}s`;

  const phaseTitle = document.getElementById('meeting-phase-title');
  if (m.subPhase === 'discussion') {
    phaseTitle.textContent = 'FASE 1: DIBATTITO & PRESENTAZIONE PROVE CCTV';
  } else if (m.subPhase === 'voting') {
    phaseTitle.textContent = 'FASE 2: VOTAZIONE FINALE — CHI È IL LADRO?';
  } else {
    phaseTitle.textContent = 'VERDETTO DELLA RIUNIONE PLENARIA';
  }

  // Skip to Vote button visibility
  const canSkipDisc =
    m.subPhase === 'discussion' &&
    (playMode === 'offline' || currentLobby?.hostId === localPlayerId);
  document.getElementById('btn-skip-to-vote').classList.toggle('hidden', !canSkipDisc);

  // Verdict box
  const verdictBox = document.getElementById('meeting-verdict-box');
  if (m.subPhase === 'result' && m.resultSummary) {
    verdictBox.classList.remove('hidden');
    verdictBox.textContent = m.resultSummary.headline;
  } else {
    verdictBox.classList.add('hidden');
  }

  const voteCount = Object.keys(m.votes || {}).length;
  const evCount = (m.sharedEvidence || []).length;

  // Rebuild Suspect Grid when subPhase or votes change
  if (forceFull || lastMeetingSubPhase !== m.subPhase || lastRenderedVoteCount !== voteCount) {
    lastMeetingSubPhase = m.subPhase;
    lastRenderedVoteCount = voteCount;

    const myVote = m.votes?.[me.id];
    const canVote = m.subPhase === 'voting' && !me.eliminated && !myVote;

    const skipBtn = document.getElementById('btn-vote-skip');
    skipBtn.disabled = !canVote;
    document.getElementById('vote-status-hint').textContent = me.eliminated
      ? 'Sei stato espulso: puoi seguire l’esito della riunione.'
      : myVote
      ? '✔ Il tuo voto è stato registrato. In attesa degli altri ospiti...'
      : m.subPhase === 'voting'
      ? 'Seleziona un sospettato da espellere oppure clicca Astensione!'
      : 'Discuti in chat e condividi le tue foto CCTV prima del voto.';

    const gridEl = document.getElementById('meeting-suspects-grid');
    gridEl.innerHTML = '';

    for (const p of state.players) {
      const card = document.createElement('div');
      const isMyTarget = myVote === p.id;
      card.className = `suspect-card${p.eliminated ? ' eliminated' : ''}${isMyTarget ? ' voted-target' : ''}`;

      const portrait = renderCharacterPortrait(p.appearance);
      const hasVotedBadge = m.votes?.[p.id] ? '🗳️ Ha votato' : '';
      const receivedVotes =
        m.subPhase === 'result' && m.resultSummary?.counts?.[p.id]
          ? ` · 🔴 ${m.resultSummary.counts[p.id]} voti`
          : '';

      card.innerHTML = `
        <div class="suspect-info">
          <img src="${portrait}" alt="${p.name}" />
          <div>
            <div class="suspect-name">${p.name} ${p.id === me.id ? '(Tu)' : ''}</div>
            <div class="suspect-sub">
              ${p.eliminated ? 'Espulso dalla Villa' : `${hasVotedBadge || 'In Villa'}${receivedVotes}`}
            </div>
          </div>
        </div>
        <div class="suspect-actions"></div>
      `;

      const actWrap = card.querySelector('.suspect-actions');
      if (!p.eliminated && p.id !== me.id && !me.eliminated) {
        const accuseBtn = document.createElement('button');
        accuseBtn.className = 'btn-accuse-sm';
        accuseBtn.textContent = 'Chiedi Alibi';
        accuseBtn.addEventListener('click', () => {
          sendMeetingChat(`${p.name}, dove ti trovavi negli ultimi 30 secondi?`);
        });
        actWrap.appendChild(accuseBtn);

        if (m.subPhase === 'voting') {
          const voteBtn = document.createElement('button');
          voteBtn.className = 'btn-vote-suspect';
          voteBtn.textContent = 'Vota';
          voteBtn.disabled = !canVote;
          voteBtn.addEventListener('click', () => submitVote(p.id));
          actWrap.appendChild(voteBtn);
        }
      }

      gridEl.appendChild(card);
    }
  }

  // Personal Evidence Share Buttons + Shared Gallery
  if (forceFull || lastRenderedEvCount !== evCount) {
    lastRenderedEvCount = evCount;

    const myStrip = document.getElementById('my-evidence-share-strip');
    myStrip.innerHTML = '';
    const myEvs = me.savedEvidence || [];
    myEvs.forEach((ev, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn-share-ev';
      btn.textContent = `📤 Condividi ${ev.camCode} (${idx + 1})`;
      btn.addEventListener('click', () => {
        sendMeetingChat(`Guardate questa prova salvata da ${ev.camCode} (${ev.camName}): ${ev.summary}`, ev);
      });
      myStrip.appendChild(btn);
    });

    const galEl = document.getElementById('shared-evidence-gallery');
    const shared = m.sharedEvidence || [];
    if (shared.length === 0) {
      galEl.innerHTML = '<div class="empty-ev-msg">Nessuna foto CCTV ancora condivisa in questa riunione.</div>';
    } else {
      galEl.innerHTML = '';
      for (const sev of shared) {
        const c = document.createElement('div');
        c.className = 'shared-ev-card';
        c.innerHTML = `
          <img src="${sev.imageUrl}" alt="${sev.camCode}" />
          <div><strong>${sev.camCode}</strong> · da ${sev.sharedBy}</div>
          <div>${sev.summary}</div>
        `;
        c.addEventListener('click', () =>
          openPhotoLightbox(sev.imageUrl, `${sev.camCode} (${sev.camName}) — ${sev.summary}`)
        );
        galEl.appendChild(c);
      }
    }
  }

  // Chat Messages
  if (forceFull || m.messages.length !== lastRenderedMsgCount) {
    lastRenderedMsgCount = m.messages.length;
    const chatLog = document.getElementById('meeting-chat-log');
    chatLog.innerHTML = '';

    for (const msg of m.messages) {
      const div = document.createElement('div');
      div.className = `chat-msg${msg.isSystem ? ' system' : ''}`;
      if (msg.isSystem) {
        div.textContent = msg.text;
      } else {
        div.innerHTML = `
          <span class="chat-sender" style="color:${msg.badgeHex || '#facc15'}">${msg.senderName}:</span>
          <span></span>
        `;
        div.querySelectorAll('span')[1].textContent = msg.text;
        if (msg.evidence?.imageUrl) {
          const img = document.createElement('img');
          img.className = 'chat-ev-img';
          img.src = msg.evidence.imageUrl;
          img.alt = 'Prova CCTV';
          img.addEventListener('click', () =>
            openPhotoLightbox(msg.evidence.imageUrl, `${msg.evidence.camCode} — ${msg.evidence.summary}`)
          );
          div.appendChild(img);
        }
      }
      chatLog.appendChild(div);
    }
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}

function sendMeetingChat(text, evidence = null) {
  if (!text.trim()) return;
  if (playMode === 'offline') {
    localSim.postChatMessage(localPlayerId, text, evidence);
  } else {
    netClient.send({ type: 'player_action', action: 'chat', text, evidence });
  }
}

function submitVote(targetId) {
  if (playMode === 'offline') {
    localSim.castVote(localPlayerId, targetId);
  } else {
    netClient.send({ type: 'player_action', action: 'vote', targetId });
  }
}

let activeGameoverClipIdx = 0;

function renderGameoverModal(state) {
  const modal = document.getElementById('gameover-modal');
  modal.classList.remove('hidden');

  const kicker = document.getElementById('gameover-kicker');
  const title = document.getElementById('gameover-title');
  const showcase = document.getElementById('gameover-cctv-showcase');
  const clipTabs = document.getElementById('gameover-clip-tabs');
  const metaLabel = document.getElementById('gameover-cctv-meta');

  activeGameoverClipIdx = 0;

  if (state.winner === 'thief') {
    kicker.textContent = 'COLPO RIUSCITO · IL LADRO È FUGGITO';
    title.textContent = '💎 VITTORIA DEL LADRO';
    title.style.color = '#fb7185';
    showcase.classList.add('hidden');
  } else {
    kicker.textContent = 'COLPEVOLE SMASCHERATO · PROVA TELECAMERE ACQUISITA';
    title.textContent = '🛡️ COLPEVOLE INCASTRATO!';
    title.style.color = '#38bdf8';

    const moments = state.thiefCaughtMoments || [];
    if (moments.length > 0) {
      showcase.classList.remove('hidden');
      const updateClipMeta = (idx) => {
        activeGameoverClipIdx = idx;
        const m = moments[idx] || moments[0];
        metaLabel.textContent = `${m.camCode} · ${m.roomName.toUpperCase()}`;
        Array.from(clipTabs.children).forEach((btn, bIdx) => {
          btn.classList.toggle('active', bIdx === idx);
        });
      };

      clipTabs.innerHTML = '';
      if (moments.length > 1) {
        moments.forEach((m, idx) => {
          const pill = document.createElement('button');
          pill.className = `clip-tab-pill${idx === 0 ? ' active' : ''}`;
          const mins = String(Math.floor((m.time || 0) / 60)).padStart(2, '0');
          const secs = String(Math.floor((m.time || 0) % 60)).padStart(2, '0');
          pill.textContent = `📹 Ripresa ${idx + 1} · ${m.roomName} (${mins}:${secs})`;
          pill.addEventListener('click', () => updateClipMeta(idx));
          clipTabs.appendChild(pill);
        });
      }
      updateClipMeta(0);
    } else {
      showcase.classList.add('hidden');
    }
  }

  document.getElementById('gameover-reason').textContent = state.winReason;

  const rosterEl = document.getElementById('gameover-roster-reveal');
  rosterEl.innerHTML = '';
  // Sort so the Thief appears prominently first
  const sortedPlayers = [...state.players].sort((a, b) => (b.role === 'thief') - (a.role === 'thief'));
  for (const p of sortedPlayers) {
    const row = document.createElement('div');
    const isThief = p.role === 'thief';
    row.className = `room-slot-card${isThief ? ' culprit-highlight' : ''}`;
    row.innerHTML = `
      <span class="room-slot-dot" style="background:${isThief ? '#f43f5e' : '#38bdf8'};color:${isThief ? '#f43f5e' : '#38bdf8'}"></span>
      <strong>${p.name}</strong>
      <span style="margin-left:auto;font-weight:700;font-size:0.78rem;color:${isThief ? '#fda4af' : '#7dd3fc'}">
        ${isThief ? (state.winner === 'civilians' ? '🕵️ LADRO (SGAMATO)' : '🕵️ LADRO') : 'Civile'}
      </span>
    `;
    rosterEl.appendChild(row);
  }
}

// =========================================================
// HUD UPDATER
// =========================================================
function updateHud(state, me) {
  if (!me) return;

  const isThief = me.role === 'thief';
  const roleBadge = document.getElementById('hud-role-badge');
  roleBadge.textContent = isThief ? 'LADRO' : 'CIVILE';
  roleBadge.className = `role-pill ${isThief ? 'thief' : 'civilian'}`;

  const roomObj = ROOMS.find((r) => r.id === me.currentRoom);
  document.getElementById('hud-room-label').textContent = `📍 ${roomObj ? roomObj.name : 'Giardino della Villa'}`;

  // Meters
  document.getElementById('hud-sec-pct').textContent = `${state.securityProgress}%`;
  document.getElementById('hud-sec-bar').style.width = `${state.securityProgress}%`;

  const jewelPct = Math.min(100, (state.stolenJewelsCount / state.jewelQuota) * 100);
  document.getElementById('hud-jewel-count').textContent = `${state.stolenJewelsCount} / ${state.jewelQuota}`;
  document.getElementById('hud-jewel-bar').style.width = `${jewelPct}%`;

  // Main Diamond Status
  const dStateEl = document.getElementById('hud-diamond-state');
  if (state.mainDiamond.recoveredByCivilians) {
    dStateEl.textContent = 'RECUPERATA DAI CIVILI! (Ladro deve riprenderla)';
    dStateEl.style.color = '#38bdf8';
  } else if (isThief) {
    if (state.mainDiamond.carrierId === me.id) {
      dStateEl.textContent = 'Con te (Nascondila in uno dei 4 nascondigli!)';
    } else {
      const spot = DIAMOND_HIDING_SPOTS.find((s) => s.id === state.mainDiamond.stashedAt);
      dStateEl.textContent = `Nascosta in: ${spot ? spot.name : 'Cassaforte'}`;
    }
    dStateEl.style.color = '#fde047';
  } else {
    dStateEl.textContent = 'Trafugata — Cerca nei nascondigli sospetti!';
    dStateEl.style.color = '#fca5a5';
  }

  // Sabotage Alert Banner
  const sabBanner = document.getElementById('sabotage-alert-banner');
  if (state.sabotage.blackoutRemaining > 0) {
    sabBanner.classList.remove('hidden');
    sabBanner.textContent = `🌑 BLACKOUT ELETTRICO IN CORSO (${Math.ceil(state.sabotage.blackoutRemaining)}s) — Ripara Centralina!`;
  } else if (state.sabotage.cctvGlitchRemaining > 0) {
    sabBanner.classList.remove('hidden');
    sabBanner.textContent = `📡 TELECAMERE CCTV MANOMESSE (${Math.ceil(state.sabotage.cctvGlitchRemaining)}s) — Ripara Centralina!`;
  } else {
    sabBanner.classList.add('hidden');
  }

  // Tasks / Objectives List
  const tasksList = document.getElementById('hud-tasks-list');
  tasksList.classList.toggle('hidden', tasksCollapsed);
  if (!tasksCollapsed) {
    tasksList.innerHTML = '';
    if (isThief) {
      document.getElementById('hud-tasks-title').textContent = '🕵️ Piano del Colpo (Ladro)';
      const items = [
        {
          done: state.stolenJewelsCount >= state.jewelQuota,
          txt: `Ruba ${state.jewelQuota} gioielli sparsi (${state.stolenJewelsCount}/${state.jewelQuota})`,
        },
        {
          done: Boolean(state.mainDiamond.stashedAt),
          txt: 'Nascondi la Stella di Venezia in un punto sicuro',
        },
        { done: false, txt: 'Usa i Passaggi Segreti [Q] lontano dai testimoni' },
      ];
      for (const it of items) {
        const li = document.createElement('li');
        if (it.done) li.className = 'done';
        li.textContent = `${it.done ? '✔' : '◈'} ${it.txt}`;
        tasksList.appendChild(li);
      }
    } else {
      document.getElementById('hud-tasks-title').textContent = '📋 Incarichi di Sicurezza';
      for (const at of me.assignedTasks) {
        const t = TASKS.find((x) => x.id === at.id);
        if (!t) continue;
        const rName = ROOMS.find((r) => r.id === t.room)?.shortName || 'Villa';
        const li = document.createElement('li');
        if (at.done) li.className = 'done';
        li.textContent = `${at.done ? '✔' : '○'} ${t.name} (${rName})`;
        tasksList.appendChild(li);
      }
    }
  }

  // Alive count
  const alive = state.players.filter((p) => !p.eliminated).length;
  document.getElementById('alive-counter').textContent = `${alive}/10 in Villa`;

  // Contextual Action Buttons
  const prox = getProximityInteraction(me, state);
  const primBtn = document.getElementById('btn-primary-action');
  const primTxt = document.getElementById('primary-action-text');
  if (prox) {
    primBtn.disabled = Boolean(prox.disabled);
    primTxt.textContent = prox.label;
  } else {
    primBtn.disabled = true;
    primTxt.textContent = 'Esplora la Villa';
  }

  // Secret Passage button (Thief)
  const sp = getNearbySecretPassage(me);
  const spBtn = document.getElementById('btn-secret-passage');
  spBtn.classList.toggle('hidden', !sp);
  if (!sp) {
    document.getElementById('passage-picker').classList.add('hidden');
  }

  // Report Clue button
  const clue = getNearbyCrimeClue(me, state);
  document.getElementById('btn-report-clue').classList.toggle('hidden', !clue);

  // CCTV Battery button
  const bat = Math.round(me.cctvBattery ?? 100);
  document.getElementById('cctv-btn-label').textContent =
    me.currentRoom === 'security' ? 'Console CCTV (Diretta)' : `Tablet CCTV (${bat}%)`;
  document.getElementById('cctv-battery-pill').textContent =
    me.currentRoom === 'security' ? 'Alimentazione Rete Sala CCTV' : `Batteria Tablet: ${bat}%`;

  // Thief Sabotage Bar
  const sabBar = document.getElementById('thief-sabotage-bar');
  sabBar.classList.toggle('hidden', !isThief || me.eliminated);
  if (isThief) {
    const sab = state.sabotage;
    const btnCctv = document.getElementById('btn-sab-cctv');
    const btnLights = document.getElementById('btn-sab-lights');
    const btnDoors = document.getElementById('btn-sab-doors');

    btnCctv.disabled = sab.cctvCooldown > 0;
    document.getElementById('cd-sab-cctv').textContent =
      sab.cctvCooldown > 0 ? `Attesa ${Math.ceil(sab.cctvCooldown)}s` : '[1] Pronto';

    btnLights.disabled = sab.blackoutCooldown > 0;
    document.getElementById('cd-sab-lights').textContent =
      sab.blackoutCooldown > 0 ? `Attesa ${Math.ceil(sab.blackoutCooldown)}s` : '[2] Pronto';

    btnDoors.disabled = sab.doorsCooldown > 0;
    document.getElementById('cd-sab-doors').textContent =
      sab.doorsCooldown > 0 ? `Attesa ${Math.ceil(sab.doorsCooldown)}s` : '[3] Pronto';
  }

  document.getElementById('legend-thief-only').classList.toggle('hidden', !isThief);
}

// =========================================================
// INPUT BINDINGS & UI CONTROLS
// =========================================================
function setupEventListeners() {
  // Play Offline
  document.getElementById('btn-play-offline').addEventListener('click', () => {
    startOfflineMatch();
  });

  // Quick Matchmaking Online
  document.getElementById('btn-quick-match').addEventListener('click', async () => {
    try {
      playMode = 'online';
      await ensureOnlineConnected();
      netClient.send({ type: 'quick_matchmaking' });
    } catch (err) {
      showToast(err.message || 'Errore connessione server.', true);
    }
  });

  // Create Private Room
  document.getElementById('btn-create-private').addEventListener('click', async () => {
    try {
      playMode = 'online';
      await ensureOnlineConnected();
      netClient.send({ type: 'create_private_room' });
    } catch (err) {
      showToast(err.message || 'Errore creazione stanza.', true);
    }
  });

  // Join Private Room by Code
  document.getElementById('btn-join-code').addEventListener('click', async () => {
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (!code) {
      showToast('Inserisci un codice stanza valido (es. VL-4829).', true);
      return;
    }
    try {
      playMode = 'online';
      await ensureOnlineConnected();
      netClient.send({ type: 'join_room_code', code });
    } catch (err) {
      showToast(err.message || 'Errore accesso stanza.', true);
    }
  });

  // Waiting Room Controls
  document.getElementById('btn-copy-invite').addEventListener('click', () => {
    if (!currentLobby) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${currentLobby.code}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    showToast(`🔗 Link invito copiato! Codice: ${currentLobby.code}`);
  });

  document.getElementById('btn-leave-room').addEventListener('click', () => {
    exitToMainMenu();
  });

  document.getElementById('chk-fill-bots').addEventListener('change', (e) => {
    netClient.send({ type: 'toggle_bots', fillWithBots: e.target.checked });
  });

  document.getElementById('btn-start-online-match').addEventListener('click', () => {
    netClient.send({ type: 'start_match' });
  });

  // Rules Modal
  document.getElementById('btn-open-rules').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.remove('hidden');
  });
  document.getElementById('btn-hud-rules').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.remove('hidden');
  });
  document.getElementById('btn-close-rules').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.add('hidden');
  });

  // HUD Quick Tools
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    villaScene.cameraZoom = Math.max(10.5, villaScene.cameraZoom - 2.5);
  });
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    villaScene.cameraZoom = Math.min(30.0, villaScene.cameraZoom + 2.5);
  });
  document.getElementById('btn-mute-audio').addEventListener('click', (e) => {
    const muted = soundEngine.toggleMute();
    e.currentTarget.textContent = muted ? '🔇' : '🔊';
  });
  document.getElementById('btn-exit-match').addEventListener('click', exitToMainMenu);
  document.getElementById('btn-toggle-tasks').addEventListener('click', () => {
    tasksCollapsed = !tasksCollapsed;
  });

  // Mouse wheel zoom
  canvas.addEventListener('wheel', (e) => {
    villaScene.cameraZoom = Math.max(10.0, Math.min(31.0, villaScene.cameraZoom + e.deltaY * 0.012));
  });

  // Right-click or Click on ground to walk smoothly!
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    const st = getSimState();
    if (!st || st.phase !== 'playing' || cctvOpen || blueprintOpen) return;
    const worldPt = villaScene.screenToWorldOnGround(e.clientX, e.clientY);
    if (worldPt) {
      clickMoveTarget = worldPt;
    }
  });

  // Bottom HUD Action Buttons
  document.getElementById('btn-primary-action').addEventListener('click', triggerPrimaryInteraction);

  document.getElementById('btn-secret-passage').addEventListener('click', toggleSecretPassagePicker);

  document.getElementById('btn-report-clue').addEventListener('click', triggerClueReport);

  document.getElementById('btn-open-cctv').addEventListener('click', () => {
    if (cctvOpen) closeCctvModal();
    else openCctvModal();
  });
  document.getElementById('btn-close-cctv').addEventListener('click', closeCctvModal);
  document.getElementById('btn-snap-evidence').addEventListener('click', captureCctvEvidenceSnapshot);

  // Blueprint Map Modal
  const toggleBlueprint = () => {
    blueprintOpen = !blueprintOpen;
    document.getElementById('blueprint-modal').classList.toggle('hidden', !blueprintOpen);
  };
  document.getElementById('btn-expand-map').addEventListener('click', toggleBlueprint);
  document.getElementById('btn-open-blueprint').addEventListener('click', toggleBlueprint);
  document.getElementById('btn-close-blueprint').addEventListener('click', () => {
    blueprintOpen = false;
    document.getElementById('blueprint-modal').classList.add('hidden');
  });

  // Sabotage Buttons
  const triggerSab = (kind) => {
    if (playMode === 'offline') {
      localSim?.triggerSabotage(localPlayerId, kind);
    } else {
      netClient.send({ type: 'player_action', action: 'sabotage', kind });
    }
  };
  document.getElementById('btn-sab-cctv').addEventListener('click', () => triggerSab('cctv'));
  document.getElementById('btn-sab-lights').addEventListener('click', () => triggerSab('blackout'));
  document.getElementById('btn-sab-doors').addEventListener('click', () => triggerSab('doors'));

  // Meeting Controls
  document.getElementById('btn-skip-to-vote').addEventListener('click', () => {
    if (playMode === 'offline') localSim?.advanceToVoting();
    else netClient.send({ type: 'player_action', action: 'skip_discussion' });
  });

  document.getElementById('btn-vote-skip').addEventListener('click', () => submitVote('skip'));

  document.getElementById('meeting-chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('meeting-chat-input');
    if (input.value.trim()) {
      sendMeetingChat(input.value);
      input.value = '';
    }
  });

  document.querySelectorAll('#quick-chat-chips button').forEach((chip) => {
    chip.addEventListener('click', () => sendMeetingChat(chip.dataset.msg));
  });

  // Push-to-Talk Voice Button
  const pttBtn = document.getElementById('btn-ptt-voice');
  const startVoice = async () => {
    if (playMode !== 'online') {
      showToast('🎤 In modalità Offline i sospetti IA leggono e rispondono istantaneamente via chat testuale!');
      return;
    }
    try {
      await netClient.startPushToTalk();
      pttBtn.classList.add('recording');
      pttBtn.textContent = '🔴 Registrazione Voce...';
    } catch {
      showToast('Permesso microfono non disponibile sul browser.', true);
    }
  };
  const stopVoice = () => {
    if (pttBtn.classList.contains('recording')) {
      netClient.stopPushToTalk();
      pttBtn.classList.remove('recording');
      pttBtn.textContent = '🎤 Tieni premuto Voce';
    }
  };
  pttBtn.addEventListener('pointerdown', startVoice);
  window.addEventListener('pointerup', stopVoice);

  // Lightbox & Gameover Buttons
  document.getElementById('btn-close-lightbox').addEventListener('click', () => {
    document.getElementById('photo-lightbox').classList.add('hidden');
  });

  document.getElementById('btn-play-again').addEventListener('click', () => {
    if (playMode === 'offline') {
      startOfflineMatch();
    } else {
      document.getElementById('gameover-modal').classList.add('hidden');
      document.getElementById('hud-overlay').classList.add('hidden');
      document.getElementById('lobby-screen').classList.remove('hidden');
      renderWaitingRoomUI();
    }
  });
  document.getElementById('btn-back-lobby').addEventListener('click', exitToMainMenu);

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const k = e.key.toLowerCase();
    keysDown.add(k);

    if (k === 'escape') {
      if (cctvOpen) closeCctvModal();
      if (blueprintOpen) {
        blueprintOpen = false;
        document.getElementById('blueprint-modal').classList.add('hidden');
      }
      document.getElementById('rules-modal').classList.add('hidden');
      document.getElementById('photo-lightbox').classList.add('hidden');
      return;
    }

    const st = getSimState();
    if (!st || st.phase !== 'playing') return;

    if (k === 'e') triggerPrimaryInteraction();
    else if (k === 'c') {
      if (cctvOpen) closeCctvModal();
      else openCctvModal();
    } else if (k === 'm') {
      blueprintOpen = !blueprintOpen;
      document.getElementById('blueprint-modal').classList.toggle('hidden', !blueprintOpen);
    } else if (k === 'q') {
      toggleSecretPassagePicker();
    } else if (k === 'r') {
      triggerClueReport();
    } else if (k === '1') {
      triggerSab('cctv');
    } else if (k === '2') {
      triggerSab('blackout');
    } else if (k === '3') {
      triggerSab('doors');
    }
  });

  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.key.toLowerCase());
  });
}

function toggleSecretPassagePicker() {
  const me = getLocalPlayer();
  const sp = getNearbySecretPassage(me);
  const picker = document.getElementById('passage-picker');
  if (!sp) {
    picker.classList.add('hidden');
    return;
  }

  const wrap = document.getElementById('passage-buttons');
  wrap.innerHTML = '';
  for (const destId of sp.targets) {
    const dest = SECRET_PASSAGES.find((x) => x.id === destId);
    if (!dest) continue;
    const btn = document.createElement('button');
    btn.className = 'passage-dest-btn';
    btn.textContent = `➔ ${dest.name}`;
    btn.addEventListener('click', () => {
      picker.classList.add('hidden');
      if (playMode === 'offline') {
        localSim.useSecretPassage(localPlayerId, sp.id, dest.id);
      } else {
        netClient.send({
          type: 'player_action',
          action: 'secret_passage',
          fromSpId: sp.id,
          toSpId: dest.id,
        });
      }
    });
    wrap.appendChild(btn);
  }
  picker.classList.toggle('hidden');
}

function triggerClueReport() {
  const state = getSimState();
  const me = getLocalPlayer();
  const clue = getNearbyCrimeClue(me, state);
  if (!clue) return;

  if (playMode === 'offline') {
    localSim.state.jewels[clue.id].clueRemaining = 0;
    localSim.startMeeting(me.id, `Teca scassinata ritrovata (${clue.name})!`);
    handlePhaseTransitions('playing', 'meeting', localSim.state);
  } else {
    netClient.send({
      type: 'player_action',
      action: 'call_meeting',
      isClueReport: true,
      jewelId: clue.id,
      reason: `Teca scassinata ritrovata (${clue.name})!`,
    });
  }
}

// =========================================================
// MAIN 60 FPS GAME & RENDER LOOP
// =========================================================
let lastFrameTime = performance.now();
let footstepAccum = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.08, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  const elapsedSec = now / 1000;

  const state = getSimState();

  if (!state) {
    // Cinematic slow pan across Villa Bellavista while in the Main Lobby!
    const orbitX = Math.sin(elapsedSec * 0.16) * 14;
    const orbitZ = 4 + Math.cos(elapsedSec * 0.14) * 8;
    villaScene.cameraZoom = 22;
    villaScene.syncWorldState(null, null, elapsedSec);
    villaScene.updateCameraFollow(orbitX, orbitZ, dt);
    villaScene.renderMain();
    return;
  }

  const me = getLocalPlayer();

  // Movement Input Handling during 'playing'
  if (state.phase === 'playing' && me && !me.eliminated && !cctvOpen) {
    let dx = 0;
    let dz = 0;
    if (keysDown.has('w') || keysDown.has('arrowup')) dz -= 1;
    if (keysDown.has('s') || keysDown.has('arrowdown')) dz += 1;
    if (keysDown.has('a') || keysDown.has('arrowleft')) dx -= 1;
    if (keysDown.has('d') || keysDown.has('arrowright')) dx += 1;

    if (dx !== 0 || dz !== 0) {
      // Align keyboard directions with the isometric screen, while click-to-move stays world-based.
      const yaw = villaScene.cameraYaw;
      [dx, dz] = [dx * Math.cos(yaw) + dz * Math.sin(yaw),
                  -dx * Math.sin(yaw) + dz * Math.cos(yaw)];
      clickMoveTarget = null; // Manual keyboard overrides click-to-move
    } else if (clickMoveTarget) {
      const cdx = clickMoveTarget.x - me.x;
      const cdz = clickMoveTarget.z - me.z;
      if (Math.hypot(cdx, cdz) > 0.35) {
        dx = cdx;
        dz = cdz;
      } else {
        clickMoveTarget = null;
      }
    }

    // Cancel active channel if player walks away
    if ((dx !== 0 || dz !== 0) && activeChannel) {
      activeChannel = null;
      document.getElementById('channel-box').classList.add('hidden');
      if (playMode === 'offline') me.interacting = false;
      else netClient.send({ type: 'player_action', action: 'set_interacting', interacting: false });
    }

    if (playMode === 'offline') {
      localSim.movePlayer(me, dx, dz, dt, me.role === 'thief' ? 4.75 : 4.5);
    } else {
      netClient.send({ type: 'move_input', dx, dz });
    }

    // Footstep sound feedback
    if (me.speed > 0.5 && !me.hidden) {
      footstepAccum += dt;
      if (footstepAccum > 0.34) {
        footstepAccum = 0;
        const r = getRoomAt(me.x, me.z);
        soundEngine.playFootstep(Boolean(r.indoor));
      }
    }
  } else if (playMode === 'online') {
    netClient.send({ type: 'move_input', dx: 0, dz: 0 });
  }

  // Channeling Progress Bar Update
  const chanBox = document.getElementById('channel-box');
  if (activeChannel) {
    chanBox.classList.remove('hidden');
    activeChannel.elapsed += dt;
    const pct = Math.min(100, (activeChannel.elapsed / activeChannel.duration) * 100);
    document.getElementById('channel-label').textContent = activeChannel.label;
    document.getElementById('channel-fill').style.width = `${pct}%`;
    if (activeChannel.elapsed >= activeChannel.duration) {
      const doneCb = activeChannel.onComplete;
      activeChannel = null;
      chanBox.classList.add('hidden');
      doneCb();
    }
  } else {
    chanBox.classList.add('hidden');
  }

  // Step Local Simulation in Offline Mode
  if (playMode === 'offline' && localSim) {
    const prevPhase = localSim.state.phase;
    localSim.update(dt);
    if (localSim.state.phase !== prevPhase) {
      handlePhaseTransitions(prevPhase, localSim.state.phase, localSim.state);
    }
  }

  // Sync 3D Avatars & Villa World Props
  syncAvatarMeshes(state, dt, elapsedSec);
  villaScene.syncWorldState(state, me, elapsedSec);

  if (me) {
    villaScene.updateCameraFollow(me.x, me.z, dt);
  }
  villaScene.renderMain();

  // Update HUD, Minimap, Blueprint, CCTV Feed, or Meeting UI
  if (state.phase === 'playing') {
    updateHud(state, me);
    drawBlueprint(document.getElementById('minimap-canvas'), state, me, false);
    if (blueprintOpen) {
      drawBlueprint(document.getElementById('blueprint-full-canvas'), state, me, true);
    }
    if (cctvOpen) {
      if (me && me.currentRoom !== 'security' && (me.cctvBattery || 0) <= 0.5) {
        closeCctvModal();
        showToast('🔋 Batteria Tablet CCTV esaurita!', true);
      } else {
        lastCctvTelemetry = villaScene.renderCctvFeedToCanvas(
          activeCctvCamId,
          document.getElementById('cctv-feed-canvas'),
          state,
          elapsedSec
        );
      }
    }
  } else if (state.phase === 'meeting') {
    renderMeetingModal(state, false);
  } else if (state.phase === 'gameover' && state.winner === 'civilians') {
    const thief = state.players.find((p) => p.role === 'thief');
    const moments = state.thiefCaughtMoments || [];
    const clip = moments[activeGameoverClipIdx] || moments[0];
    if (thief && clip) {
      villaScene.renderCaughtReplayToCanvas(
        document.getElementById('gameover-replay-canvas'),
        clip,
        thief,
        elapsedSec,
        avatarMeshes
      );
    }
  }
}

// =========================================================
// BOOTSTRAP
// =========================================================
buildLobbyCustomizer();
buildCctvTabs();
setupEventListeners();

// Auto-join room if URL has ?room=VL-XXXX
const urlRoom = new URLSearchParams(window.location.search).get('room');
if (urlRoom) {
  document.getElementById('room-code-input').value = urlRoom.toUpperCase();
  ensureOnlineConnected()
    .then(() => {
      playMode = 'online';
      netClient.send({ type: 'join_room_code', code: urlRoom.toUpperCase() });
    })
    .catch(() => {});
}

requestAnimationFrame(animate);
