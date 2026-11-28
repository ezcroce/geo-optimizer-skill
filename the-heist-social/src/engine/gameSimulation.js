import { hasLineOfSight, sightObstacles, cameraSees } from './vision.js';
import {
  ESTATE_BOUNDS,
  ROOMS,
  WALL_SEGMENTS,
  DOORS,
  FURNITURE,
  JEWELS,
  JEWEL_QUOTA_TO_WIN,
  DIAMOND_HIDING_SPOTS,
  SECRET_PASSAGES,
  HIDING_SPOTS,
  CCTV_CAMERAS,
  CCTV_STATION,
  SABOTAGE_REPAIR_POINTS,
  EMERGENCY_BUTTON,
  TASKS,
  NAV_NODES,
  NAV_EDGES,
  getRoomAt,
} from '../data/villaLayout.js';
import { CHARACTER_PRESETS } from '../data/characters.js';

// Precompute adjacency list for AI pathfinding
const ADJ = new Map();
for (const key of Object.keys(NAV_NODES)) ADJ.set(key, []);
for (const [a, b] of NAV_EDGES) {
  if (NAV_NODES[a] && NAV_NODES[b]) {
    const dist = Math.hypot(NAV_NODES[a].x - NAV_NODES[b].x, NAV_NODES[a].z - NAV_NODES[b].z);
    ADJ.get(a).push({ to: b, cost: dist });
    ADJ.get(b).push({ to: a, cost: dist });
  }
}

function nearestNavNode(x, z) {
  let bestKey = 'r_foyer_north';
  let bestDist = Infinity;
  for (const [k, pt] of Object.entries(NAV_NODES)) {
    const d = Math.hypot(pt.x - x, pt.z - z);
    if (d < bestDist) {
      bestDist = d;
      bestKey = k;
    }
  }
  return bestKey;
}

export function findWaypointPath(startX, startZ, targetX, targetZ) {
  const startKey = nearestNavNode(startX, startZ);
  const endKey = nearestNavNode(targetX, targetZ);
  if (startKey === endKey) return [{ x: targetX, z: targetZ }];

  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  for (const k of ADJ.keys()) dist.set(k, Infinity);
  dist.set(startKey, 0);

  while (visited.size < ADJ.size) {
    let u = null;
    let best = Infinity;
    for (const [k, d] of dist.entries()) {
      if (!visited.has(k) && d < best) {
        best = d;
        u = k;
      }
    }
    if (!u || u === endKey) break;
    visited.add(u);
    for (const edge of ADJ.get(u)) {
      if (visited.has(edge.to)) continue;
      const alt = best + edge.cost;
      if (alt < dist.get(edge.to)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, u);
      }
    }
  }

  const keys = [];
  let cur = endKey;
  while (cur && cur !== startKey) {
    keys.unshift(cur);
    cur = prev.get(cur);
  }
  const pts = keys.map((k) => ({ x: NAV_NODES[k].x, z: NAV_NODES[k].z }));
  pts.push({ x: targetX, z: targetZ });
  return pts;
}

// Circle vs Axis-Aligned Box collision check
function circleIntersectsAABB(cx, cz, radius, minX, maxX, minZ, maxZ) {
  const closestX = Math.max(minX, Math.min(cx, maxX));
  const closestZ = Math.max(minZ, Math.min(cz, maxZ));
  const dx = cx - closestX;
  const dz = cz - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

export class GameSimulation {
  constructor(options = {}) {
    this.mode = options.mode || 'offline'; // 'offline' | 'online_host'
    this.onEvent = options.onEvent || (() => {});
    this.state = null;
    this.aiControllers = new Map();
    this.scheduledChatTimers = [];
  }

  clearTimers() {
    for (const t of this.scheduledChatTimers) clearTimeout(t);
    this.scheduledChatTimers = [];
  }

  initMatch(rosterConfigs) {
    this.clearTimers();

    // Ensure exactly up to 10 players (fill remaining with distinct AI presets if needed)
    const usedIds = new Set(rosterConfigs.map((r) => r.presetId));
    const fullRoster = [...rosterConfigs];
    for (const preset of CHARACTER_PRESETS) {
      if (fullRoster.length >= 10) break;
      if (!usedIds.has(preset.id)) {
        fullRoster.push({
          id: `bot_${preset.id}`,
          name: preset.name,
          presetId: preset.id,
          isBot: true,
          appearance: { ...preset },
        });
        usedIds.add(preset.id);
      }
    }

    // Every participant has the same chance of being the thief in every mode.
    const thiefIndex = Math.floor(Math.random() * Math.min(fullRoster.length, 10));

    // Spawn circle around the Grand Foyer & Gallery
    const spawnCoords = [
      { x: -9.5, z: 8.8 },
      { x: -4.5, z: 8.8 },
      { x: -9.8, z: 5.5 },
      { x: -4.2, z: 5.5 },
      { x: -7.0, z: 3.4 },
      { x: -7.0, z: 10.4 },
      { x: -3.2, z: 7.2 },
      { x: -10.5, z: 7.2 },
      { x: -5.2, z: 3.5 },
      { x: -8.8, z: 10.2 },
    ];

    const players = fullRoster.slice(0, 10).map((entry, idx) => {
      const spawn = spawnCoords[idx % spawnCoords.length];
      const role = idx === thiefIndex ? 'thief' : 'civilian';
      // Assign 5 distinct tasks to each player
      const shuffledTasks = [...TASKS].sort(() => Math.random() - 0.5).slice(0, 5);

      return {
        id: entry.id,
        name: entry.name,
        isBot: Boolean(entry.isBot),
        role,
        appearance: entry.appearance,
        x: spawn.x,
        z: spawn.z,
        rotY: Math.atan2(-7 - spawn.x, 6.8 - spawn.z),
        speed: 0,
        eliminated: false,
        hidden: false,
        hidingSpotId: null,
        usingCctv: false,
        interacting: false,
        interactionLabel: '',
        interactionProgress: 0,
        activeCrime: null,
        crimeTimer: 0,
        currentRoom: getRoomAt(spawn.x, spawn.z).id,
        emergencyCallsLeft: 1,
        cctvBattery: 100,
        assignedTasks: shuffledTasks.map((t) => ({ id: t.id, done: false })),
        savedEvidence: [],
      };
    });

    const jewelsState = {};
    for (const j of JEWELS) {
      jewelsState[j.id] = {
        id: j.id,
        stolen: false,
        stolenBy: null,
        clueRemaining: 0,
      };
    }

    const thiefPlayer = players[thiefIndex];

    this.state = {
      phase: 'playing', // 'playing' | 'meeting' | 'gameover'
      matchTime: 0,
      emergencyCooldown: 18, // 18s initial grace before emergency button
      jewels: jewelsState,
      stolenJewelsCount: 0,
      jewelQuota: JEWEL_QUOTA_TO_WIN,
      mainDiamond: {
        name: 'La Stella di Venezia',
        carrierId: thiefPlayer.id, // Starts in Thief's possession!
        stashedAt: null, // or one of DIAMOND_HIDING_SPOTS.id
        recoveredByCivilians: false,
      },
      securityProgress: 0, // 0..100% Civilian security task bar
      sabotage: {
        cctvGlitchRemaining: 0,
        cctvCooldown: 0,
        blackoutRemaining: 0,
        blackoutCooldown: 0,
        doorsCooldown: 0,
        lockedWings: { west: 0, east: 0, north: 0, south: 0, center: 0 },
      },
      players,
      recentCctvLogs: [],
      thiefCaughtMoments: [],
      meeting: null,
      winner: null, // 'thief' | 'civilians'
      winReason: '',
    };

    // Initialize AI controllers
    this.aiControllers.clear();
    for (const p of players) {
      if (p.isBot) {
        this.aiControllers.set(p.id, {
          path: [],
          targetType: null,
          targetObj: null,
          waitTimer: 0.6 + Math.random() * 1.8,
          channelTimer: 0,
          channelDuration: 0,
          onChannelDone: null,
          sightings: [], // { suspectId, suspectName, roomName, time, suspicious, detail }
          suspicionMap: new Map(), // suspectId -> score
        });
      }
    }

    return this.state;
  }

  isBlocked(nx, nz, radius = 0.34) {
    if (
      nx < ESTATE_BOUNDS.minX + radius ||
      nx > ESTATE_BOUNDS.maxX - radius ||
      nz < ESTATE_BOUNDS.minZ + radius ||
      nz > ESTATE_BOUNDS.maxZ - radius
    ) {
      return true;
    }

    // Wall segments
    for (const seg of WALL_SEGMENTS) {
      const isH = Math.abs(seg.z1 - seg.z2) < 0.01;
      const halfT = seg.thickness / 2;
      const minX = Math.min(seg.x1, seg.x2) - (isH ? 0 : halfT);
      const maxX = Math.max(seg.x1, seg.x2) + (isH ? 0 : halfT);
      const minZ = Math.min(seg.z1, seg.z2) - (isH ? halfT : 0);
      const maxZ = Math.max(seg.z1, seg.z2) + (isH ? halfT : 0);
      if (circleIntersectsAABB(nx, nz, radius, minX, maxX, minZ, maxZ)) {
        return true;
      }
    }

    // Locked Doors
    for (const door of DOORS) {
      if (this.state.sabotage.lockedWings[door.wing] > 0) {
        const isH = door.orientation === 'h';
        const minX = door.x - (isH ? door.width / 2 : 0.22);
        const maxX = door.x + (isH ? door.width / 2 : 0.22);
        const minZ = door.z - (isH ? 0.22 : door.width / 2);
        const maxZ = door.z + (isH ? 0.22 : door.width / 2);
        if (circleIntersectsAABB(nx, nz, radius, minX, maxX, minZ, maxZ)) {
          return true;
        }
      }
    }

    // Solid Furniture
    for (const f of FURNITURE) {
      if (!f.solid || f.type === 'hedge') continue;
      const rotQuarter = Math.abs(Math.sin(f.rot || 0)) > 0.7;
      const hw = (rotQuarter ? f.d : f.w) / 2;
      const hd = (rotQuarter ? f.w : f.d) / 2;
      if (circleIntersectsAABB(nx, nz, radius, f.x - hw, f.x + hw, f.z - hd, f.z + hd)) {
        return true;
      }
    }

    return false;
  }

  movePlayer(player, dx, dz, dt, maxSpeed = 4.5) {
    if (!this.state || this.state.phase !== 'playing' || player.eliminated || player.hidden || !Number.isFinite(dx) || !Number.isFinite(dz) || !Number.isFinite(dt) || dt <= 0) {
      player.speed = 0;
      return;
    }
    const len = Math.hypot(dx, dz);
    if (len < 0.001) {
      player.speed = 0;
      return;
    }
    const ux = dx / len;
    const uz = dz / len;
    const step = maxSpeed * dt;

    let movedX = false;
    let movedZ = false;
    // Subdivide long frames so movement stays time-based without tunnelling through walls.
    const steps = Math.max(1, Math.ceil(step / 0.2));
    const substep = step / steps;
    for (let i = 0; i < steps; i++) {
      if (Math.abs(ux) > 0.0001 && !this.isBlocked(player.x + ux * substep, player.z)) {
        player.x += ux * substep;
        movedX = true;
      }
      if (Math.abs(uz) > 0.0001 && !this.isBlocked(player.x, player.z + uz * substep)) {
        player.z += uz * substep;
        movedZ = true;
      }
    }

    if (movedX || movedZ) {
      player.speed = maxSpeed;
      player.rotY = Math.atan2(ux, uz);
      player.currentRoom = getRoomAt(player.x, player.z).id;
    } else {
      player.speed = 0;
    }
  }

  update(dt) {
    if (!this.state || this.state.phase === 'gameover') return;

    if (this.state.phase === 'meeting') {
      this._updateMeeting(dt);
      return;
    }

    this.state.matchTime += dt;
    if (this.state.emergencyCooldown > 0) {
      this.state.emergencyCooldown = Math.max(0, this.state.emergencyCooldown - dt);
    }

    // Sabotage timers & cooldowns
    const sab = this.state.sabotage;
    if (sab.cctvGlitchRemaining > 0) sab.cctvGlitchRemaining = Math.max(0, sab.cctvGlitchRemaining - dt);
    if (sab.cctvCooldown > 0) sab.cctvCooldown = Math.max(0, sab.cctvCooldown - dt);
    if (sab.blackoutRemaining > 0) sab.blackoutRemaining = Math.max(0, sab.blackoutRemaining - dt);
    if (sab.blackoutCooldown > 0) sab.blackoutCooldown = Math.max(0, sab.blackoutCooldown - dt);
    if (sab.doorsCooldown > 0) sab.doorsCooldown = Math.max(0, sab.doorsCooldown - dt);

    for (const wing of Object.keys(sab.lockedWings)) {
      if (sab.lockedWings[wing] > 0) {
        sab.lockedWings[wing] = Math.max(0, sab.lockedWings[wing] - dt);
      }
    }

    // Jewel forensic clue decay
    for (const jState of Object.values(this.state.jewels)) {
      if (jState.clueRemaining > 0) {
        jState.clueRemaining = Math.max(0, jState.clueRemaining - dt);
      }
    }

    // Player crime timers & CCTV battery recharge
    for (const p of this.state.players) {
      if (p.crimeTimer > 0) {
        p.crimeTimer = Math.max(0, p.crimeTimer - dt);
        if (p.crimeTimer === 0) p.activeCrime = null;
      }
      if (p.usingCctv && p.currentRoom !== 'security') {
        p.cctvBattery = Math.max(0, p.cctvBattery - dt * 4.5);
        if (p.cctvBattery <= 0) p.usingCctv = false;
      } else {
        const rechargeRate = p.currentRoom === 'security' ? 22 : 3.2;
        p.cctvBattery = Math.min(100, p.cctvBattery + dt * rechargeRate);
      }
    }

    // Automatic CCTV Sensor Log when cameras are online
    if (sab.cctvGlitchRemaining <= 0) {
      const cameraObstacles = sightObstacles(sab);
      for (const cam of CCTV_CAMERAS) {
        for (const p of this.state.players) {
          if (p.eliminated || p.hidden) continue;
          if (cameraSees(cam, p, cameraObstacles)) {
            if (!p.activeCrime) continue;
            const recentSame = this.state.recentCctvLogs.find(
              (l) => l.suspectId === p.id && l.camId === cam.id && this.state.matchTime - l.time < 8
            );
            if (!recentSame) {
              this.state.recentCctvLogs.unshift({
                id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                camId: cam.id,
                camName: `${cam.code} - ${cam.name}`,
                suspectId: p.id,
                suspectName: p.name,
                crime: p.activeCrime,
                time: this.state.matchTime,
              });
              if (this.state.recentCctvLogs.length > 10) this.state.recentCctvLogs.pop();
            }
          }
        }
      }
    }

    // Update AI Suspects
    this._updateAIBots(dt);

    // Check Realtime Win Conditions
    this._checkRealtimeVictory();
  }

  _updateAIBots(dt) {
    const blackout = this.state.sabotage.blackoutRemaining > 0;
    const obstacles = sightObstacles(this.state.sabotage);

    for (const bot of this.state.players) {
      if (!bot.isBot || bot.eliminated) continue;
      const ai = this.aiControllers.get(bot.id);
      if (!ai) continue;

      // 1. Eyewitness Perception Check
      if (bot.role === 'civilian') {
        for (const other of this.state.players) {
          if (other.id === bot.id || other.eliminated || other.hidden) continue;
          const dist = Math.hypot(other.x - bot.x, other.z - bot.z);
          const sightRange = blackout ? 0 : 9.5;
          if (dist < sightRange && hasLineOfSight(bot, other, sightRange, obstacles)) {
            if (other.activeCrime) {
              ai.suspicionMap.set(other.id, (ai.suspicionMap.get(other.id) || 0) + 75);
              ai.sightings.unshift({
                suspectId: other.id,
                suspectName: other.name,
                roomName: ROOMS.find((r) => r.id === other.currentRoom)?.name || 'Villa',
                time: this.state.matchTime,
                suspicious: true,
                detail: other.activeCrime,
              });
              // Witness rushes to report crime!
              if (this.state.emergencyCooldown <= 0 && Math.random() < 0.45) {
                this.startMeeting(bot.id, `Ha colto ${other.name} in flagrante (${other.activeCrime})!`);
                return;
              }
            } else if (Math.random() < dt * 0.4) {
              ai.sightings.unshift({
                suspectId: other.id,
                suspectName: other.name,
                roomName: ROOMS.find((r) => r.id === other.currentRoom)?.name || 'Villa',
                time: this.state.matchTime,
                suspicious: false,
                detail: 'visto nella stanza',
              });
              if (ai.sightings.length > 12) ai.sightings.pop();
            }
          }
        }

        // Spot fresh forensic clue on a stolen jewel case
        for (const j of JEWELS) {
          const js = this.state.jewels[j.id];
          if (js.stolen && js.clueRemaining > 4 && Math.hypot(bot.x - j.x, bot.z - j.z) < 2.8) {
            if (this.state.emergencyCooldown <= 0 && Math.random() < dt * 1.4) {
              js.clueRemaining = 0;
              this.startMeeting(bot.id, `Teca scassinata scoperta: ${j.name}!`);
              return;
            }
          }
        }
      }

      // 2. Active Channeling (performing task / stealing / repairing)
      if (ai.channelTimer > 0) {
        bot.speed = 0;
        bot.interacting = true;
        ai.channelTimer -= dt;
        if (ai.channelTimer <= 0) {
          bot.interacting = false;
          if (ai.onChannelDone) {
            const cb = ai.onChannelDone;
            ai.onChannelDone = null;
            cb();
            if (this.state.phase !== 'playing') return;
          }
          ai.waitTimer = 0.8 + Math.random() * 1.5;
        }
        continue;
      }

      // 3. Pause / Look around
      if (ai.waitTimer > 0) {
        bot.speed = 0;
        ai.waitTimer -= dt;
        continue;
      }

      // 4. Choose next destination if path finished
      if (!ai.path || ai.path.length === 0) {
        this._pickNextAIGoal(bot, ai);
      }

      // 5. Follow Waypoint Path
      if (ai.path && ai.path.length > 0) {
        const wp = ai.path[0];
        const dx = wp.x - bot.x;
        const dz = wp.z - bot.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.55) {
          ai.path.shift();
          if (ai.path.length === 0) {
            this._onAIReachedGoal(bot, ai);
          }
        } else {
          const prevX = bot.x;
          const prevZ = bot.z;
          this.movePlayer(bot, dx, dz, dt, bot.role === 'thief' ? 4.45 : 4.15);
          // Unstick check if blocked by temporary locked door
          if (Math.hypot(bot.x - prevX, bot.z - prevZ) < 0.002) {
            ai.path = [];
            ai.waitTimer = 1.0;
          }
        }
      }
    }
  }

  _pickNextAIGoal(bot, ai) {
    if (bot.role === 'thief') {
      // AI Thief Strategy:
      // 1) Stash Main Diamond if still carrying after 16s
      if (this.state.mainDiamond.carrierId === bot.id && this.state.matchTime > 16 && Math.random() < 0.55) {
        const spot = DIAMOND_HIDING_SPOTS[Math.floor(Math.random() * DIAMOND_HIDING_SPOTS.length)];
        ai.targetType = 'stash_diamond';
        ai.targetObj = spot;
        ai.path = findWaypointPath(bot.x, bot.z, spot.x, spot.z);
        return;
      }

      // 2) Pick an unstolen jewel in a low-traffic room
      const unstolen = JEWELS.filter((j) => !this.state.jewels[j.id].stolen);
      if (unstolen.length > 0 && Math.random() < 0.72) {
        // Prefer jewels with no Civilians currently in that room
        const scored = unstolen.map((j) => {
          const witnesses = this.state.players.filter(
            (p) => p.id !== bot.id && !p.eliminated && p.currentRoom === j.room
          ).length;
          const dist = Math.hypot(j.x - bot.x, j.z - bot.z);
          return { j, score: witnesses * 30 + dist * 0.4 };
        });
        scored.sort((a, b) => a.score - b.score);
        const chosen = scored[0].j;
        ai.targetType = 'steal_jewel';
        ai.targetObj = chosen;
        ai.path = findWaypointPath(bot.x, bot.z, chosen.x, chosen.z);
        return;
      }

      // 3) Otherwise blend in at a Fake Task!
      const fakeTask = TASKS[Math.floor(Math.random() * TASKS.length)];
      ai.targetType = 'fake_task';
      ai.targetObj = fakeTask;
      ai.path = findWaypointPath(bot.x, bot.z, fakeTask.x, fakeTask.z);
      return;
    }

    // AI Civilian Strategy:
    // 1) If sabotage is active, 40% chance to head to repair panel
    if (
      (this.state.sabotage.blackoutRemaining > 2 || this.state.sabotage.cctvGlitchRemaining > 2) &&
      Math.random() < 0.42
    ) {
      const panel = SABOTAGE_REPAIR_POINTS[Math.floor(Math.random() * SABOTAGE_REPAIR_POINTS.length)];
      ai.targetType = 'repair';
      ai.targetObj = panel;
      ai.path = findWaypointPath(bot.x, bot.z, panel.x, panel.z);
      return;
    }

    // 2) 18% chance to check Sala di Controllo CCTV or inspect a Diamond Hiding Spot
    const roll = Math.random();
    if (roll < 0.16) {
      ai.targetType = 'watch_cctv';
      ai.targetObj = CCTV_STATION;
      ai.path = findWaypointPath(bot.x, bot.z, CCTV_STATION.x, CCTV_STATION.z);
      return;
    }
    if (roll < 0.28) {
      const ds = DIAMOND_HIDING_SPOTS[Math.floor(Math.random() * DIAMOND_HIDING_SPOTS.length)];
      ai.targetType = 'inspect_stash';
      ai.targetObj = ds;
      ai.path = findWaypointPath(bot.x, bot.z, ds.x, ds.z);
      return;
    }

    // 3) Perform an incomplete Civilian Security Task (or patrol random station)
    const pending = bot.assignedTasks.find((t) => !t.done);
    const taskDef = pending
      ? TASKS.find((t) => t.id === pending.id)
      : TASKS[Math.floor(Math.random() * TASKS.length)];

    ai.targetType = 'civilian_task';
    ai.targetObj = taskDef;
    ai.path = findWaypointPath(bot.x, bot.z, taskDef.x, taskDef.z);
  }

  _onAIReachedGoal(bot, ai) {
    const type = ai.targetType;
    const obj = ai.targetObj;
    if (!obj) return;

    if (type === 'steal_jewel' && bot.role === 'thief') {
      const js = this.state.jewels[obj.id];
      if (!js || js.stolen) return;

      // Check if an awake Civilian is right next to us!
      const witnessNear = this.state.players.some(
        (p) =>
          p.id !== bot.id &&
          !p.eliminated &&
          !p.hidden &&
          (p.currentRoom === bot.currentRoom || Math.hypot(p.x - bot.x, p.z - bot.z) < 6.5)
      );
      if (witnessNear) {
        // Trigger blackout or abort & pretend to inspect!
        if (this.state.sabotage.blackoutCooldown <= 0) {
          this.triggerSabotage(bot.id, 'blackout');
        } else {
          ai.waitTimer = 1.5;
          return;
        }
      } else if (this.state.sabotage.cctvCooldown <= 0 && Math.random() < 0.55) {
        this.triggerSabotage(bot.id, 'cctv');
      }

      bot.activeCrime = 'FURTO GIOIELLO';
      bot.crimeTimer = 3.2;
      ai.channelTimer = 2.0;
      ai.onChannelDone = () => {
        this.completeJewelSteal(bot.id, obj.id);
        // Optional getaway via nearby Secret Passage!
        const nearSp = SECRET_PASSAGES.find((sp) => sp.room === bot.currentRoom);
        if (nearSp && Math.random() < 0.65) {
          const destId = nearSp.targets[Math.floor(Math.random() * nearSp.targets.length)];
          this.useSecretPassage(bot.id, nearSp.id, destId);
        }
      };
    } else if (type === 'stash_diamond' && bot.role === 'thief') {
      ai.channelTimer = 1.6;
      ai.onChannelDone = () => {
        this.toggleMainDiamondStash(bot.id, obj.id);
      };
    } else if (type === 'repair') {
      ai.channelTimer = 2.0;
      ai.onChannelDone = () => {
        this.repairSabotage(bot.id);
      };
    } else if (type === 'watch_cctv') {
      bot.usingCctv = true;
      ai.channelTimer = 4.2;
      ai.onChannelDone = () => {
        bot.usingCctv = false;
        // Check if a recent CCTV sensor log caught someone!
        if (this.state.sabotage.cctvGlitchRemaining <= 0 && this.state.recentCctvLogs.length > 0) {
          const latest = this.state.recentCctvLogs[0];
          if (this.state.matchTime - latest.time < 22) {
            ai.suspicionMap.set(latest.suspectId, (ai.suspicionMap.get(latest.suspectId) || 0) + 80);
            ai.sightings.unshift({
              suspectId: latest.suspectId,
              suspectName: latest.suspectName,
              roomName: latest.camName,
              time: latest.time,
              suspicious: true,
              detail: `ripreso su ${latest.camName} (${latest.crime})`,
            });
          }
        }
      };
    } else if (type === 'inspect_stash') {
      ai.channelTimer = 2.2;
      ai.onChannelDone = () => {
        this.inspectDiamondSpot(bot.id, obj.id);
      };
    } else {
      // Civilian or Fake task
      ai.channelTimer = obj.duration || 2.8;
      ai.onChannelDone = () => {
        if (bot.role === 'civilian') {
          this.completeCivilianTask(bot.id, obj.id);
        }
      };
    }
  }

  // Actions callable by Human or Network Players
  completeCivilianTask(playerId, taskId) {
    const p = this.state.players.find((x) => x.id === playerId);
    if (!p || p.role !== 'civilian') return false;
    const entry = p.assignedTasks.find((t) => t.id === taskId);
    if (entry && !entry.done) {
      entry.done = true;
    }
    // Recompute global Civilian Security Bar
    const civs = this.state.players.filter((x) => x.role === 'civilian');
    const totalTasks = civs.reduce((acc, c) => acc + c.assignedTasks.length, 0) || 1;
    const doneTasks = civs.reduce((acc, c) => acc + c.assignedTasks.filter((t) => t.done).length, 0);
    this.state.securityProgress = Math.min(100, Math.round((doneTasks / totalTasks) * 100));
    p.cctvBattery = Math.min(100, p.cctvBattery + 20);
    this.onEvent({ type: 'task_complete', playerId, taskId });
    this._checkRealtimeVictory();
    return true;
  }

  _recordThiefMoment(thiefPlayer, crimeTitle, detailLabel, extraPos = null) {
    if (!this.state || !thiefPlayer) return;
    const tx = extraPos?.x ?? thiefPlayer.x;
    const tz = extraPos?.z ?? thiefPlayer.z;
    const roomObj = getRoomAt(tx, tz);
    // Find exact room camera if present, else closest CCTV camera
    let cam = CCTV_CAMERAS.find((c) => c.room === roomObj.id);
    let isRoomCam = Boolean(cam);
    if (!cam) {
      let bestD = Infinity;
      for (const c of CCTV_CAMERAS) {
        const d = Math.hypot(c.lookAt.x - tx, c.lookAt.z - tz);
        if (d < bestD) {
          bestD = d;
          cam = c;
        }
      }
    }

    const moment = {
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time: this.state.matchTime,
      roomId: roomObj.id,
      roomName: roomObj.name,
      roomBounds: roomObj.bounds
        ? { x1: roomObj.bounds.minX, z1: roomObj.bounds.minZ, x2: roomObj.bounds.maxX, z2: roomObj.bounds.maxZ }
        : null,
      camId: cam?.id || 'cam_foyer',
      camCode: isRoomCam ? cam.code : `CAM-AUX (${roomObj.name.slice(0, 12).toUpperCase()})`,
      camName: isRoomCam ? cam.name : roomObj.name,
      useRoomDirectCam: !isRoomCam,
      suspectId: thiefPlayer.id,
      suspectName: thiefPlayer.name,
      crimeTitle,
      detailLabel,
      x: tx,
      z: tz,
      rotY: thiefPlayer.rotY,
    };

    // Prioritize real crimes at the front of the list (replace passive transit clip if needed)
    if (crimeTitle !== 'TRANSITO SOSPETTO SU TELECAMERA') {
      this.state.thiefCaughtMoments = this.state.thiefCaughtMoments.filter(
        (m) => m.crimeTitle !== 'TRANSITO SOSPETTO SU TELECAMERA'
      );
      this.state.thiefCaughtMoments.unshift(moment);
    } else {
      this.state.thiefCaughtMoments.push(moment);
    }

    if (this.state.thiefCaughtMoments.length > 6) {
      this.state.thiefCaughtMoments.length = 6;
    }
  }

  completeJewelSteal(playerId, jewelId) {
    const p = this.state.players.find((x) => x.id === playerId);
    const js = this.state.jewels[jewelId];
    if (!p || p.role !== 'thief' || !js || js.stolen) return false;

    const jewelDef = JEWELS.find((j) => j.id === jewelId);
    js.stolen = true;
    js.stolenBy = playerId;
    js.clueRemaining = 28; // Leaves forensic trace for 28s!
    this.state.stolenJewelsCount = Object.values(this.state.jewels).filter((j) => j.stolen).length;
    p.activeCrime = 'FURTO GIOIELLO';
    p.crimeTimer = 2.4;

    this._recordThiefMoment(
      p,
      'FURTO RIPRESO IN FLAGRANTE',
      jewelDef ? `Trafugamento di "${jewelDef.name}"` : 'Trafugamento gioiello in teca',
      jewelDef ? { x: jewelDef.x, z: jewelDef.z + 0.55 } : null
    );

    this.onEvent({ type: 'jewel_stolen', playerId, jewelId, count: this.state.stolenJewelsCount });
    this._checkRealtimeVictory();
    return true;
  }

  toggleMainDiamondStash(playerId, spotId) {
    const p = this.state.players.find((x) => x.id === playerId);
    if (!p || p.role !== 'thief') return false;
    const md = this.state.mainDiamond;
    const spotDef = DIAMOND_HIDING_SPOTS.find((s) => s.id === spotId);

    if (md.carrierId === playerId) {
      md.carrierId = null;
      md.stashedAt = spotId;
      md.recoveredByCivilians = false;
      p.activeCrime = 'OCCULTAMENTO DIAMANTE';
      p.crimeTimer = 2.0;
      this._recordThiefMoment(
        p,
        'OCCULTAMENTO STELLA DI VENEZIA',
        spotDef ? `Diamante nascosto in: ${spotDef.name}` : 'Diamante occultato nella stanza'
      );
      this.onEvent({ type: 'diamond_stashed', spotId });
      return true;
    } else if (md.stashedAt === spotId || md.recoveredByCivilians) {
      md.carrierId = playerId;
      md.stashedAt = null;
      md.recoveredByCivilians = false;
      p.activeCrime = 'TRAFUGAMENTO DIAMANTE';
      p.crimeTimer = 2.5;
      this._recordThiefMoment(
        p,
        'RECUPERO FURTIVO STELLA DI VENEZIA',
        spotDef ? `Diamante ripreso da: ${spotDef.name}` : 'Diamante recuperato dal nascondiglio'
      );
      this.onEvent({ type: 'diamond_retrieved', spotId });
      return true;
    }
    return false;
  }

  inspectDiamondSpot(playerId, spotId) {
    const p = this.state.players.find((x) => x.id === playerId);
    if (!p || p.role !== 'civilian') return { found: false };
    const md = this.state.mainDiamond;
    if (md.stashedAt === spotId) {
      md.stashedAt = null;
      md.recoveredByCivilians = true;
      this.onEvent({ type: 'diamond_recovered', playerId, playerName: p.name, spotId });
      this._checkRealtimeVictory();
      return { found: true };
    }
    return { found: false };
  }

  useSecretPassage(playerId, fromSpId, toSpId) {
    const p = this.state.players.find((x) => x.id === playerId);
    if (!p || p.role !== 'thief' || p.eliminated) return false;
    const source = SECRET_PASSAGES.find((s) => s.id === fromSpId);
    const dest = SECRET_PASSAGES.find((s) => s.id === toSpId);
    if (this.state.phase !== 'playing' || !source || !dest || !source.targets.includes(dest.id) || Math.hypot(p.x - source.x, p.z - source.z) > 2.5) return false;

    p.hidden = false;
    p.x = dest.x;
    p.z = dest.z;
    p.currentRoom = dest.room;
    p.activeCrime = 'USO PASSAGGIO SEGRETO';
    p.crimeTimer = 2.6;
    this._recordThiefMoment(
      p,
      'PASSAGGIO SEGRETO FILMATO',
      `Uscita furtiva rilevata presso: ${dest.name}`
    );
    this.onEvent({ type: 'secret_passage', playerId, fromSpId, toSpId });
    return true;
  }

  toggleHide(playerId, spotId) {
    const p = this.state.players.find((x) => x.id === playerId);
    if (!p || p.eliminated) return false;
    if (p.hidden) {
      p.hidden = false;
      p.hidingSpotId = null;
    } else {
      const spot = HIDING_SPOTS.find((h) => h.id === spotId);
      if (!spot) return false;
      p.hidden = true;
      p.hidingSpotId = spotId;
      p.speed = 0;
    }
    return p.hidden;
  }

  triggerSabotage(playerId, kind, wing = null) {
    const p = this.state.players.find((x) => x.id === playerId);
    if (!p || p.role !== 'thief' || p.eliminated) return false;
    const sab = this.state.sabotage;

    if (kind === 'cctv' && sab.cctvCooldown <= 0) {
      sab.cctvGlitchRemaining = 18;
      sab.cctvCooldown = 32;
      this.onEvent({ type: 'sabotage', kind: 'cctv' });
      return true;
    }
    if (kind === 'blackout' && sab.blackoutCooldown <= 0) {
      sab.blackoutRemaining = 12;
      sab.blackoutCooldown = 36;
      this.onEvent({ type: 'sabotage', kind: 'blackout' });
      return true;
    }
    if (kind === 'doors' && sab.doorsCooldown <= 0) {
      const targetWing = wing || ROOMS.find((r) => r.id === p.currentRoom)?.wing || 'center';
      const validWing = ['west', 'east', 'north', 'south', 'center'].includes(targetWing)
        ? targetWing
        : 'center';
      sab.lockedWings[validWing] = 12;
      sab.doorsCooldown = 26;
      this.onEvent({ type: 'sabotage', kind: 'doors', wing: validWing });
      return true;
    }
    return false;
  }

  repairSabotage(playerId) {
    const sab = this.state.sabotage;
    sab.cctvGlitchRemaining = 0;
    sab.blackoutRemaining = 0;
    this.onEvent({ type: 'sabotage_repaired', playerId });
  }

  saveCctvEvidence(playerId, evidenceItem) {
    const p = this.state.players.find((x) => x.id === playerId);
    if (!p) return;
    p.savedEvidence.unshift(evidenceItem);
    if (p.savedEvidence.length > 6) p.savedEvidence.pop();
  }

  // Plenary Meeting System
  startMeeting(callerId, reasonText) {
    if (this.state.phase !== 'playing') return false;
    const caller = this.state.players.find((p) => p.id === callerId);
    if (!caller || caller.eliminated) return false;

    this.clearTimers();
    this.state.phase = 'meeting';
    // Reset temporary states
    for (const p of this.state.players) {
      p.hidden = false;
      p.usingCctv = false;
      p.interacting = false;
      p.speed = 0;
    }

    this.state.meeting = {
      callerId,
      callerName: caller.name,
      reason: reasonText || 'Riunione Plenaria d’Emergenza convocata nell’Atrio',
      subPhase: 'discussion', // 'discussion' | 'voting' | 'result'
      timer: 42,
      messages: [
        {
          id: `sys_${Date.now()}`,
          senderId: 'system',
          senderName: 'SISTEMA VILLA',
          text: `${caller.name} ha convocato la Riunione Plenaria: "${reasonText}"`,
          isSystem: true,
        },
      ],
      sharedEvidence: [],
      votes: {}, // voterId -> targetId | 'skip'
      resultSummary: null,
    };

    this.onEvent({ type: 'meeting_started', meeting: this.state.meeting });
    this._scheduleAIDiscussion();
    return true;
  }

  _scheduleAIDiscussion() {
    const aliveBots = this.state.players.filter((p) => p.isBot && !p.eliminated);

    aliveBots.forEach((bot, idx) => {
      const delay = 2200 + idx * 2900 + Math.random() * 1400;
      const timer = setTimeout(() => {
        if (!this.state.meeting || this.state.meeting.subPhase === 'result') return;
        const line = this._composeAIMeetingLine(bot);
        if (line) {
          this.postChatMessage(bot.id, line);
        }
      }, delay);
      this.scheduledChatTimers.push(timer);
    });
  }

  _composeAIMeetingLine(bot) {
    const ai = this.aiControllers.get(bot.id);
    const roomName = ROOMS.find((r) => r.id === bot.currentRoom)?.name || 'Galleria Centrale';

    if (bot.role === 'thief') {
      // Strategic Thief AI alibis & misdirection
      const fakeRooms = ['Salone delle Feste', 'Cucina & Sala da Pranzo', 'Giardino Frontale', 'Galleria Centrale'];
      const chosenRoom = fakeRooms[Math.floor(Math.random() * fakeRooms.length)];
      const innocents = this.state.players.filter((p) => p.id !== bot.id && !p.eliminated);
      const scapegoat = innocents[Math.floor(Math.random() * innocents.length)];
      const templates = [
        `Io stavo controllando i sensori vicino a ${chosenRoom}. Nessun movimento sospetto dal mio lato.`,
        `Calma tutti: prima di votare a caso, qualcuno ha una foto delle telecamere CCTV?`,
        scapegoat
          ? `Io ero a ${roomName}, ma ho visto ${scapegoat.name} muoversi molto di fretta poco fa... dove andavi?`
          : `Ero a ${roomName} a svolgere i controlli di sicurezza.`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    // Civilian AI uses actual memory!
    if (ai && ai.sightings.length > 0) {
      const crimeSighting = ai.sightings.find(
        (s) => s.suspicious && !this.state.players.find((p) => p.id === s.suspectId)?.eliminated
      );
      if (crimeSighting) {
        return `ATTENZIONE! Ho visto chiaramente ${crimeSighting.suspectName} a ${crimeSighting.roomName}: ${crimeSighting.detail}! Dobbiamo votare ${crimeSighting.suspectName}!`;
      }
      const recentAlibi = ai.sightings[0];
      if (recentAlibi && this.state.matchTime - recentAlibi.time < 45) {
        return `Io mi trovavo in ${roomName}. Poco fa ho incrociato ${recentAlibi.suspectName} presso ${recentAlibi.roomName}.`;
      }
    }

    const neutralLines = [
      `Io ero in ${roomName} per i controlli di sicurezza. Qualcuno era in Sala CCTV?`,
      `Se qualcuno ha salvato uno scatto dalle telecamere, condividetelo adesso nella lavagna prove!`,
      `Non buttiamo fuori un innocente senza prove: ero a ${roomName} fino a pochi secondi fa.`,
    ];
    return neutralLines[Math.floor(Math.random() * neutralLines.length)];
  }

  postChatMessage(senderId, text, evidenceAttachment = null) {
    if (!this.state?.meeting || typeof text !== 'string' || !text.trim()) return false;
    const sender = this.state.players.find((p) => p.id === senderId);
    if (!sender) return false;

    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId,
      senderName: sender.name,
      badgeHex: sender.appearance.badgeHex,
      eliminated: sender.eliminated,
      text: text.trim().slice(0, 260),
      evidence: evidenceAttachment || null,
    };
    this.state.meeting.messages.push(msg);

    if (evidenceAttachment) {
      this.state.meeting.sharedEvidence.push({
        ...evidenceAttachment,
        sharedBy: sender.name,
      });

      // If shared CCTV evidence genuinely captured a suspect committing a crime, AI Civilians react!
      if (evidenceAttachment.incriminatingSuspectId) {
        const suspect = this.state.players.find((p) => p.id === evidenceAttachment.incriminatingSuspectId);
        if (suspect && !suspect.eliminated) {
          for (const bot of this.state.players) {
            if (bot.isBot && bot.role === 'civilian' && !bot.eliminated) {
              const ai = this.aiControllers.get(bot.id);
              if (ai) {
                ai.suspicionMap.set(suspect.id, (ai.suspicionMap.get(suspect.id) || 0) + 120);
              }
            }
          }
          const reactor = this.state.players.find(
            (p) => p.isBot && p.role === 'civilian' && !p.eliminated && p.id !== senderId
          );
          if (reactor) {
            const t = setTimeout(() => {
              if (this.state.meeting && this.state.meeting.subPhase !== 'result') {
                this.postChatMessage(
                  reactor.id,
                  `Questa prova CCTV di ${sender.name} è schiacciante! Si vede ${suspect.name} (${evidenceAttachment.crimeLabel}). Voto ${suspect.name}!`
                );
              }
            }, 1400);
            this.scheduledChatTimers.push(t);
          }
        }
      }
    }

    // If a human accuses a specific AI suspect by name in chat, let that AI respond!
    if (!sender.isBot && !evidenceAttachment) {
      const lower = text.toLowerCase();
      const mentionedBot = this.state.players.find(
        (p) => p.isBot && !p.eliminated && lower.includes(p.name.split(' ')[0].toLowerCase())
      );
      if (mentionedBot) {
        const replyDelay = setTimeout(() => {
          if (!this.state.meeting || this.state.meeting.subPhase === 'result') return;
          const rName = ROOMS.find((r) => r.id === mentionedBot.currentRoom)?.name || 'Galleria';
          const reply =
            mentionedBot.role === 'thief'
              ? `${sender.name}, ti stai sbagliando di grosso! Ero vicino a ${rName}, chiedi pure in giro. Stai cercando di depistarci?`
              : `Ehi ${sender.name}, sono un civile come te! Stavo completando il mio incarico a ${rName}. Controllate le telecamere!`;
          this.postChatMessage(mentionedBot.id, reply);
        }, 1600);
        this.scheduledChatTimers.push(replyDelay);
      }
    }

    this.onEvent({ type: 'chat_message', message: msg });
    return true;
  }

  advanceToVoting() {
    if (!this.state?.meeting || this.state.meeting.subPhase !== 'discussion') return;
    this.state.meeting.subPhase = 'voting';
    this.state.meeting.timer = 22;
    this.onEvent({ type: 'voting_started' });

    // Schedule AI votes
    const aliveBots = this.state.players.filter((p) => p.isBot && !p.eliminated);
    aliveBots.forEach((bot, i) => {
      const t = setTimeout(() => {
        if (!this.state.meeting || this.state.meeting.subPhase !== 'voting') return;
        const choice = this._decideAIVote(bot);
        this.castVote(bot.id, choice);
      }, 1200 + i * 750);
      this.scheduledChatTimers.push(t);
    });
  }

  _decideAIVote(bot) {
    const aliveOthers = this.state.players.filter((p) => p.id !== bot.id && !p.eliminated);
    if (aliveOthers.length === 0) return 'skip';

    if (bot.role === 'thief') {
      // Thief votes for whoever already has votes (if not self) or a random civilian
      const tally = {};
      for (const target of Object.values(this.state.meeting.votes)) {
        if (target !== 'skip' && target !== bot.id) {
          tally[target] = (tally[target] || 0) + 1;
        }
      }
      const leading = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      if (leading && leading[1] >= 1) return leading[0];
      return aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id;
    }

    // Civilian AI checks suspicion map
    const ai = this.aiControllers.get(bot.id);
    if (ai) {
      let topSuspect = null;
      let topScore = 0;
      for (const [sId, score] of ai.suspicionMap.entries()) {
        const p = this.state.players.find((x) => x.id === sId);
        if (p && !p.eliminated && score > topScore) {
          topScore = score;
          topSuspect = sId;
        }
      }
      if (topSuspect && topScore >= 60) {
        return topSuspect;
      }
    }

    // Otherwise check if humans/others are rallying around a suspect, or skip carefully!
    const tally = {};
    for (const target of Object.values(this.state.meeting.votes)) {
      if (target && target !== 'skip' && target !== bot.id) {
        tally[target] = (tally[target] || 0) + 1;
      }
    }
    const leading = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    if (leading && leading[1] >= 2 && Math.random() < 0.55) {
      return leading[0];
    }

    return 'skip';
  }

  castVote(voterId, targetId) {
    const m = this.state?.meeting;
    if (!m || m.subPhase !== 'voting') return false;
    const voter = this.state.players.find((p) => p.id === voterId);
    if (!voter || voter.eliminated || m.votes[voterId]) return false;
    if (targetId && targetId !== 'skip' && !this.state.players.some(p => p.id === targetId && !p.eliminated)) return false;

    m.votes[voterId] = targetId || 'skip';
    this.onEvent({ type: 'vote_cast', voterId });

    // Check if all alive players have voted
    const aliveCount = this.state.players.filter((p) => !p.eliminated).length;
    if (Object.keys(m.votes).length >= aliveCount) {
      this._tallyVotes();
    }
    return true;
  }

  _updateMeeting(dt) {
    const m = this.state.meeting;
    if (!m) return;
    m.timer -= dt;

    if (m.subPhase === 'discussion' && m.timer <= 0) {
      this.advanceToVoting();
    } else if (m.subPhase === 'voting' && m.timer <= 0) {
      this._tallyVotes();
    } else if (m.subPhase === 'result' && m.timer <= 0) {
      this._endMeetingAndResume();
    }
  }

  _tallyVotes() {
    const m = this.state.meeting;
    if (!m || m.subPhase === 'result') return;
    m.subPhase = 'result';
    m.timer = 6.0;

    const counts = { skip: 0 };
    for (const target of Object.values(m.votes)) {
      counts[target] = (counts[target] || 0) + 1;
    }

    let highestId = 'skip';
    let highestVotes = counts.skip || 0;
    let tie = false;

    for (const [id, c] of Object.entries(counts)) {
      if (id === 'skip') continue;
      if (c > highestVotes) {
        highestVotes = c;
        highestId = id;
        tie = false;
      } else if (c === highestVotes && highestVotes > 0) {
        tie = true;
      }
    }

    const majority = Math.floor(this.state.players.filter(p => !p.eliminated).length / 2) + 1;
    if (highestId === 'skip' || tie || highestVotes < majority) {
      m.resultSummary = {
        expelledPlayer: null,
        wasThief: false,
        counts,
        headline: tie
          ? 'PAREGGIO NELLA VOTAZIONE — Nessun ospite è stato espulso dalla Villa.'
          : 'NESSUNA MAGGIORANZA — Nessun sospettato espulso.',
      };
    } else {
      const expelled = this.state.players.find((p) => p.id === highestId);
      if (expelled) {
        expelled.eliminated = true;
        const wasThief = expelled.role === 'thief';
        m.resultSummary = {
          expelledPlayer: { id: expelled.id, name: expelled.name, role: expelled.role },
          wasThief,
          counts,
          headline: wasThief
            ? `COLPEVOLE INCASTRATO! ${expelled.name} era IL LADRO della Villa!`
            : `ERRORE GIUDIZIARIO! ${expelled.name} era un CIVILE INNOCENTE. Il Ladro guadagna terreno!`,
        };
      }
    }

    this.onEvent({ type: 'voting_result', summary: m.resultSummary });
  }

  _endMeetingAndResume() {
    const summary = this.state.meeting?.resultSummary;
    this.clearTimers();

    // Did we expel the Thief?
    const thief = this.state.players.find((p) => p.role === 'thief');
    if (!thief || thief.eliminated) {
      this._finishMatch('civilians', `I Civili hanno smascherato ed espulso il Ladro (${thief?.name})!`);
      return;
    }

    // Did Thief reduce alive players to <= 2?
    const alivePlayers = this.state.players.filter((p) => !p.eliminated);
    if (alivePlayers.length <= 2) {
      this._finishMatch(
        'thief',
        `Gli innocenti sono stati espulsi uno dopo l'altro: ${thief.name} ha preso il controllo della Villa!`
      );
      return;
    }

    // Reposition surviving players neatly around the Foyer for the next round
    const spawns = [
      { x: -9.5, z: 8.8 }, { x: -4.5, z: 8.8 }, { x: -9.8, z: 5.5 }, { x: -4.2, z: 5.5 },
      { x: -7.0, z: 3.4 }, { x: -7.0, z: 10.4 }, { x: -3.2, z: 7.2 }, { x: -10.5, z: 7.2 },
      { x: -5.2, z: 3.5 }, { x: -8.8, z: 10.2 },
    ];
    alivePlayers.forEach((p, idx) => {
      p.x = spawns[idx % spawns.length].x;
      p.z = spawns[idx % spawns.length].z;
      p.currentRoom = 'foyer';
      if (p.isBot) {
        const ai = this.aiControllers.get(p.id);
        if (ai) {
          ai.path = [];
          ai.waitTimer = 1.2;
        }
      }
    });

    this.state.meeting = null;
    this.state.phase = 'playing';
    this.state.emergencyCooldown = 20;
    this.onEvent({ type: 'meeting_ended', previousSummary: summary });
  }

  _checkRealtimeVictory() {
    if (this.state.phase === 'gameover') return;
    const thief = this.state.players.find((p) => p.role === 'thief');

    // Thief wins by stealing quota of minor jewels while Main Diamond isn't confiscated by Civilians
    if (
      this.state.stolenJewelsCount >= this.state.jewelQuota &&
      !this.state.mainDiamond.recoveredByCivilians
    ) {
      this._finishMatch(
        'thief',
        `Colpo Perfetto! ${thief?.name} ha trafugato ${this.state.stolenJewelsCount}/${this.state.jewelQuota} gioielli ed è fuggito con La Stella di Venezia!`
      );
      return;
    }

    // Civilians win by completing 100% Security Lockout (if Main Diamond is also recovered or security reaches 100%)
    if (this.state.securityProgress >= 100) {
      this._finishMatch(
        'civilians',
        'Protocollo Blindatura completato al 100%! Tutte le uscite della Villa sono bloccate e la refurtiva è salva.'
      );
    }
  }

  _finishMatch(winner, reason) {
    this.clearTimers();
    const thief = this.state.players.find((p) => p.role === 'thief');
    if (thief && this.state.thiefCaughtMoments.length === 0) {
      this._recordThiefMoment(
        thief,
        'EFFRAZIONE TECA CENTRALE',
        'Ripresa di sicurezza: furto iniziale de La Stella di Venezia nell’Atrio d’Onore',
        { x: -7.0, z: 6.1 }
      );
    }
    this.state.phase = 'gameover';
    this.state.winner = winner;
    this.state.winReason = reason;
    this.onEvent({ type: 'gameover', winner, reason, state: this.state });
  }
}
