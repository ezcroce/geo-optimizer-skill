// ─────────────────────────────────────────────────────────────
//  Configurazione di gioco: rarità, armi, consumabili, skin, tempesta
// ─────────────────────────────────────────────────────────────

export const RARITIES = [
  { id: 0, name: 'Comune', color: '#b4b4b4', mult: 1.0 },
  { id: 1, name: 'Non comune', color: '#4fd63a', mult: 1.08 },
  { id: 2, name: 'Raro', color: '#3a96ff', mult: 1.16 },
  { id: 3, name: 'Epico', color: '#c04dff', mult: 1.26 },
  { id: 4, name: 'Leggendario', color: '#ffb020', mult: 1.38 },
];

export const AMMO_TYPES = {
  light: { name: 'Munizioni leggere', short: 'Leggere', color: '#9fd4ff', pickup: 30, max: 999 },
  medium: { name: 'Munizioni medie', short: 'Medie', color: '#8fe08a', pickup: 30, max: 999 },
  heavy: { name: 'Munizioni pesanti', short: 'Pesanti', color: '#ff8a6a', pickup: 8, max: 999 },
  shells: { name: 'Cartucce', short: 'Cartucce', color: '#ffd36a', pickup: 10, max: 999 },
  rockets: { name: 'Razzi', short: 'Razzi', color: '#ff5050', pickup: 3, max: 99 },
};

// parts: [larghezza, altezza, profondità, x, y, z, coloreChiave]
//   m = metallo scuro, b = corpo, r = colore rarità, w = legno
export const WEAPONS = {
  pistol: {
    name: 'Pistola', speed: 260, drop: 1.15,  dmg: 25, pellets: 1, rate: 0.22, mag: 12, reload: 1.2,
    spread: 0.016, range: 140, ammo: 'light', auto: false, zoom: 1.25,
    botRange: 35, sound: 'pistol', recoil: 0.012, muzzle: 0.28, role: 'pistol', cross: 'dot', sight: 'iron',
    desc: 'Precisa e leggera, buona per finire chi scappa.',
    parts: [[0.08, 0.1, 0.34, 0, 0, 0.1, 'm'], [0.07, 0.18, 0.09, 0, -0.11, -0.02, 'b'], [0.086, 0.03, 0.22, 0, 0.055, 0.12, 'r']],
  },
  smg: {
    name: 'Mitraglietta', speed: 280, drop: 1.2,  dmg: 15, pellets: 1, rate: 0.075, mag: 30, reload: 1.9,
    spread: 0.042, range: 90, ammo: 'light', auto: true, zoom: 1.25,
    botRange: 28, sound: 'smg', recoil: 0.006, muzzle: 0.57, role: 'smg', cross: 'tri', sight: 'holo',
    desc: 'Cadenza alta e mira stabile: domina la corta-media distanza.',
    parts: [[0.09, 0.12, 0.5, 0, 0, 0.13, 'm'], [0.06, 0.22, 0.07, 0, -0.15, 0.2, 'b'], [0.07, 0.14, 0.07, 0, -0.1, -0.02, 'b'], [0.05, 0.08, 0.2, 0, 0, -0.2, 'r'], [0.095, 0.025, 0.3, 0, 0.07, 0.15, 'r']],
  },
  ar: {
    name: "Fucile d'assalto", speed: 380, drop: 1.0,  dmg: 30, pellets: 1, rate: 0.13, mag: 30, reload: 2.1,
    spread: 0.02, range: 220, ammo: 'medium', auto: true, zoom: 1.6,
    botRange: 60, sound: 'ar', recoil: 0.009, muzzle: 0.96, role: 'ar', cross: 'cross', sight: 'reddot',
    desc: "L'arma tuttofare: affidabile a ogni distanza.",
    parts: [[0.1, 0.14, 0.72, 0, 0, 0.18, 'b'], [0.05, 0.05, 0.32, 0, 0.02, 0.7, 'm'], [0.07, 0.24, 0.1, 0, -0.17, 0.25, 'm'], [0.07, 0.15, 0.08, 0, -0.12, -0.02, 'm'], [0.09, 0.16, 0.3, 0, -0.02, -0.3, 'b'], [0.06, 0.07, 0.22, 0, 0.11, 0.18, 'r']],
  },
  shotgun: {
    name: 'Fucile a pompa', speed: 230, drop: 1.3,  dmg: 12, pellets: 9, rate: 0.95, mag: 5, reload: 2.5,
    spread: 0.1, range: 45, ammo: 'shells', auto: false, zoom: 1.2,
    botRange: 14, sound: 'shotgun', recoil: 0.05, muzzle: 0.88, role: 'shotgun', cross: 'pump', sight: 'bead',
    desc: 'Pochi colpi devastanti da vicino.',
    parts: [[0.1, 0.12, 0.5, 0, 0, 0.08, 'm'], [0.07, 0.07, 0.55, 0, 0.02, 0.58, 'm'], [0.11, 0.08, 0.26, 0, -0.07, 0.52, 'w'], [0.09, 0.15, 0.35, 0, -0.05, -0.3, 'w'], [0.105, 0.03, 0.3, 0, 0.065, 0.08, 'r']],
  },
  sniper: {
    name: 'Cecchino', speed: 520, drop: 1.0,  dmg: 105, pellets: 1, rate: 1.45, mag: 5, reload: 2.8,
    spread: 0.05, adsSpread: 0.0, range: 600, ammo: 'heavy', auto: false, zoom: 4.5, scope: true,
    botRange: 120, sound: 'sniper', recoil: 0.06, muzzle: 1.18, role: 'sniper', cross: 'snipe', sight: 'scope',
    desc: 'Ottica 4,5×: un colpo alla testa e la partita cambia.',
    parts: [[0.09, 0.12, 0.7, 0, 0, 0.15, 'b'], [0.04, 0.04, 0.6, 0, 0.02, 0.8, 'm'], [0.08, 0.08, 0.38, 0, 0.13, 0.15, 'm'], [0.085, 0.03, 0.06, 0, 0.13, 0.32, 'r'], [0.085, 0.03, 0.06, 0, 0.13, -0.02, 'r'], [0.09, 0.17, 0.32, 0, -0.04, -0.33, 'b'], [0.07, 0.14, 0.08, 0, -0.12, -0.04, 'm']],
  },
  rocket: {
    name: 'Lanciarazzi', speed: 55, drop: 0.18,  dmg: 100, pellets: 1, rate: 1.3, mag: 1, reload: 2.8,
    spread: 0.01, range: 300, ammo: 'rockets', auto: false, zoom: 1.4, projectile: true, splash: 6,
    botRange: 45, sound: 'rocket', recoil: 0.06, muzzle: 0.92, role: 'rocket', cross: 'rocket', sight: 'rocket',
    desc: 'Esplosione ad area: distrugge muri e gruppi.',
    parts: [[0.2, 0.2, 1.2, 0, 0.06, 0.2, 'b'], [0.22, 0.22, 0.08, 0, 0.06, 0.78, 'r'], [0.22, 0.22, 0.08, 0, 0.06, -0.38, 'r'], [0.07, 0.16, 0.08, 0, -0.12, 0.05, 'm'], [0.07, 0.16, 0.08, 0, -0.12, 0.35, 'm']],
  },
  // ── varianti ──
  revolver: {
    name: 'Revolver', speed: 300, drop: 1.1, dmg: 48, pellets: 1, rate: 0.62, mag: 6, reload: 2.3,
    spread: 0.012, range: 170, ammo: 'medium', auto: false, zoom: 1.4,
    botRange: 40, sound: 'revolver', recoil: 0.03, muzzle: 0.36, role: 'pistol', cross: 'dot', sight: 'notch',
    desc: 'Sei colpi pesanti: lento ma ogni proiettile conta.',
  },
  compact: {
    name: 'Mitraglietta compatta', speed: 260, drop: 1.25, dmg: 11, pellets: 1, rate: 0.055, mag: 35, reload: 1.7,
    spread: 0.056, range: 70, ammo: 'light', auto: true, zoom: 1.2,
    botRange: 22, sound: 'compact', recoil: 0.005, muzzle: 0.34, role: 'smg', cross: 'tri', sight: 'holo',
    desc: 'Danni bassi ma una raffica continua: perfetta da vicinissimo.',
  },
  burst: {
    name: 'Fucile a raffica', speed: 390, drop: 1.0, dmg: 27, pellets: 1, rate: 0.42, burst: 3, burstGap: 0.07, mag: 24, reload: 2.2,
    spread: 0.016, range: 230, ammo: 'medium', auto: false, zoom: 1.7,
    botRange: 60, sound: 'burst', recoil: 0.007, muzzle: 0.5, role: 'ar', cross: 'chev', sight: 'reddot',
    desc: 'Tre colpi per pressione del grilletto, molto preciso.',
  },
  heavyar: {
    name: "Fucile d'assalto pesante", speed: 400, drop: 1.0, dmg: 38, pellets: 1, rate: 0.19, mag: 25, reload: 2.5,
    spread: 0.024, range: 240, ammo: 'medium', auto: true, zoom: 1.6,
    botRange: 60, sound: 'heavyar', recoil: 0.016, muzzle: 0.86, role: 'ar', cross: 'cross', sight: 'tri',
    desc: 'Più danni ma rinculo forte: spara a brevi raffiche.',
  },
  dmr: {
    name: 'Fucile tattico DMR', speed: 460, drop: 0.9, dmg: 46, pellets: 1, rate: 0.36, mag: 10, reload: 2.4,
    spread: 0.03, adsSpread: 0.004, range: 380, ammo: 'medium', auto: false, zoom: 2.6, scope: true,
    botRange: 90, sound: 'dmr', recoil: 0.02, muzzle: 1.17, role: 'sniper', cross: 'square', sight: 'acog',
    desc: 'Semiautomatico con ottica 2,6×: il ponte fra fucile e cecchino.',
  },
  tactical: {
    name: 'Fucile a pompa tattico', speed: 230, drop: 1.3, dmg: 8, pellets: 8, rate: 0.38, mag: 8, reload: 3.2,
    spread: 0.085, range: 40, ammo: 'shells', auto: false, zoom: 1.2,
    botRange: 14, sound: 'tactical', recoil: 0.035, muzzle: 0.78, role: 'shotgun', cross: 'tactical', sight: 'bead',
    desc: 'Meno danni del pompa, ma semiautomatico e con 8 colpi.',
  },
  drum: {
    name: 'Fucile a tamburo', speed: 220, drop: 1.35, dmg: 6, pellets: 7, rate: 0.22, mag: 16, reload: 3.8,
    spread: 0.11, range: 30, ammo: 'shells', auto: true, zoom: 1.15,
    botRange: 12, sound: 'drum', recoil: 0.028, muzzle: 0.665, role: 'shotgun', cross: 'drum', sight: 'holo',
    desc: 'Automatico con caricatore a tamburo: tanti pallini, poca gittata.',
  },
  hunting: {
    name: 'Fucile da caccia', speed: 480, drop: 1.1, dmg: 90, pellets: 1, rate: 1.05, mag: 4, reload: 2.6,
    spread: 0.03, adsSpread: 0.0, range: 420, ammo: 'heavy', auto: false, zoom: 2.4, scope: true,
    botRange: 100, sound: 'hunting', recoil: 0.05, muzzle: 1.13, role: 'sniper', cross: 'hunt', sight: 'vintage',
    desc: 'Noce e ottone, ottica d\'epoca 2,4×: più comune del cecchino e preciso anche senza mirare.',
  },
  minigun: {
    name: 'Minigun', speed: 340, drop: 1.1, dmg: 12, pellets: 1, rate: 0.05, spin: 0.55, mag: 120, reload: 4.5,
    spread: 0.06, range: 160, ammo: 'medium', auto: true, zoom: 1.15,
    botRange: 35, moveMult: 0.82, sound: 'minigun', recoil: 0.004, muzzle: 0.955, role: 'smg', cross: 'square4', sight: 'none',
    desc: 'Le canne devono girare prima di sparare, poi è una pioggia di piombo.',
  },
  // ── v29: armi nuove ──
  lmg: {
    name: 'Mitragliatrice leggera', speed: 390, drop: 1.0, dmg: 23, pellets: 1, rate: 0.1, mag: 60, reload: 4.2,
    spread: 0.045, adsSpread: 0.022, range: 220, ammo: 'medium', auto: true, zoom: 1.5,
    botRange: 55, moveMult: 0.9, sound: 'lmg', recoil: 0.008, muzzle: 1.02, role: 'ar', cross: 'cross', sight: 'reddot',
    desc: 'Nastro da 60 colpi e bipiede: tiene giù la testa a una squadra intera, ma ricaricare è lento.',
  },
  doublebarrel: {
    name: 'Doppietta', speed: 220, drop: 1.35, dmg: 11, pellets: 11, rate: 0.26, mag: 2, reload: 2.4,
    spread: 0.12, range: 32, ammo: 'shells', auto: false, zoom: 1.15,
    botRange: 11, sound: 'doublebarrel', recoil: 0.06, muzzle: 0.87, role: 'shotgun', cross: 'double', sight: 'bead',
    desc: 'Due colpi uno dietro l\'altro: da vicinissimo non perdona, poi devi ricaricare.',
  },
  handcannon: {
    name: 'Pistola pesante', speed: 320, drop: 1.1, dmg: 54, pellets: 1, rate: 0.5, mag: 7, reload: 1.9,
    spread: 0.015, range: 160, ammo: 'medium', auto: false, zoom: 1.35,
    botRange: 40, sound: 'handcannon', recoil: 0.034, muzzle: 0.29, role: 'pistol', cross: 'dot', sight: 'iron',
    desc: 'Calibro enorme in una pistola: due colpi e lo scudo è andato.',
  },
  crossbow: {
    name: 'Balestra', speed: 115, drop: 2.2, dmg: 92, pellets: 1, rate: 1.0, mag: 1, reload: 1.6,
    spread: 0.03, adsSpread: 0.0, range: 260, ammo: 'heavy', auto: false, zoom: 2.0,
    botRange: 70, sound: 'crossbow', recoil: 0.02, muzzle: 0.57, role: 'sniper', cross: 'hunt', sight: 'tri',
    desc: 'Silenziosa e letale, ma il dardo è lento e cade: mira un po\' più in alto.',
  },
  grenade: {
    name: 'Lanciagranate', speed: 36, drop: 1.0, dmg: 70, pellets: 1, rate: 0.75, mag: 6, reload: 3.6,
    spread: 0.012, range: 160, ammo: 'rockets', auto: false, zoom: 1.3, projectile: true, splash: 4.5, grenade: true,
    botRange: 35, sound: 'grenade', recoil: 0.04, muzzle: 0.67, role: 'rocket', cross: 'rocket', sight: 'rocket',
    desc: 'Sei granate a parabola: scavalcano i muri e sfondano le coperture.',
  },
  silenced: {
    name: 'Mitraglietta silenziata', speed: 250, drop: 1.25, dmg: 16, pellets: 1, rate: 0.085, mag: 30, reload: 2.0,
    spread: 0.036, range: 85, ammo: 'light', auto: true, zoom: 1.3,
    botRange: 26, sound: 'silenced', recoil: 0.005, muzzle: 0.64, role: 'smg', cross: 'tri', sight: 'holo',
    desc: 'Quasi non si sente: perfetta per chi gioca d\'astuzia.',
  },
};
// le varianti usano la sagoma semplificata dell'arma di base (icona di riserva senza WebGL)
for (const [id, base] of [['revolver', 'pistol'], ['compact', 'smg'], ['burst', 'ar'], ['heavyar', 'ar'], ['dmr', 'sniper'], ['tactical', 'shotgun'], ['drum', 'shotgun'], ['hunting', 'sniper'], ['minigun', 'rocket'], ['lmg', 'ar'], ['doublebarrel', 'shotgun'], ['handcannon', 'pistol'], ['crossbow', 'sniper'], ['grenade', 'rocket'], ['silenced', 'smg']]) WEAPONS[id].parts = WEAPONS[base].parts;

// speed = velocità del proiettile (m/s), drop = quanto la gravità lo fa cadere (1 = normale)
// Rarità tipiche per arma (probabilità per livello)
export const WEAPON_POOL = [
  // v21: epiche e leggendarie molto più rare (a terra ~5% epiche, ~1% leggendarie)
  { id: 'pistol', w: 18, rar: [48, 36, 14, 2, 0] },
  { id: 'smg', w: 18, rar: [42, 36, 18, 3.5, 0.5] },
  { id: 'ar', w: 22, rar: [40, 35, 21, 3.5, 0.8] },
  { id: 'shotgun', w: 20, rar: [40, 35, 21, 3.5, 0.8] },
  { id: 'sniper', w: 6, rar: [0, 10, 70, 17, 3] },
  { id: 'rocket', w: 2, rar: [0, 0, 45, 48, 7] },
  { id: 'revolver', w: 9, rar: [32, 38, 25, 3.5, 0.8] },
  { id: 'compact', w: 10, rar: [42, 36, 18, 3.5, 0.5] },
  { id: 'burst', w: 11, rar: [36, 35, 25, 3.5, 0.8] },
  { id: 'heavyar', w: 9, rar: [20, 38, 36, 5, 1] },
  { id: 'dmr', w: 7, rar: [0, 38, 53, 7, 1.5] },
  { id: 'tactical', w: 11, rar: [40, 35, 21, 3.5, 0.8] },
  { id: 'drum', w: 6, rar: [0, 34, 54, 10, 2] },
  { id: 'hunting', w: 7, rar: [20, 40, 34, 5, 1] },
  { id: 'minigun', w: 2, rar: [0, 0, 60, 34, 6] },
  // v29
  { id: 'lmg', w: 4, rar: [0, 30, 55, 12, 3] },
  { id: 'doublebarrel', w: 9, rar: [40, 36, 20, 3.5, 0.5] },
  { id: 'handcannon', w: 7, rar: [20, 40, 33, 6, 1] },
  { id: 'crossbow', w: 5, rar: [0, 35, 52, 11, 2] },
  { id: 'grenade', w: 2, rar: [0, 0, 55, 38, 7] },
  { id: 'silenced', w: 8, rar: [30, 40, 25, 4, 1] },
];

export const CONSUMABLES = {
  bandage: { name: 'Bende', icon: '🩹', time: 2.2, hp: 15, maxHp: 75, stack: 15, rarity: 0, count: 5 },
  medkit: { name: 'Medikit', icon: '🧰', time: 5, hp: 100, maxHp: 100, stack: 3, rarity: 1, count: 1 },
  minishield: { name: 'Mini scudo', icon: '💧', time: 1.5, shield: 25, maxShield: 50, stack: 6, rarity: 2, count: 3 },
  shield: { name: 'Pozione scudo', icon: '🧪', time: 4, shield: 50, maxShield: 100, stack: 3, rarity: 3, count: 1 },
};

export const SKINS = [
  { id: 'recluta', name: 'Recluta', rarity: 0, shirt: '#4f7f3d', pants: '#3a4628', skin: '#e2b58c', shoes: '#262626', acc: 'cap', accColor: '#2f5a26', hair: '#4a2e1a' },
  { id: 'esploratrice', name: 'Esploratrice', rarity: 1, shirt: '#d0763a', pants: '#3a4a5a', skin: '#e8c0a0', shoes: '#5a3a22', acc: 'ponytail', accColor: '#2e8a7a', hair: '#6a3a1e', scarf: '#2e8a7a', backpack: '#7a5a2a', boots: true },
  { id: 'zombie', name: 'Zombie Errante', rarity: 1, shirt: '#5c6b7a', pants: '#3a3f4a', skin: '#86ab70', shoes: '#2b2b2b', acc: 'none', hair: '#2c3a22', torn: true },
  { id: 'agente', name: 'Agente Segreto', rarity: 1, shirt: '#1d1d22', pants: '#1d1d22', skin: '#d9a882', shoes: '#0d0d0d', acc: 'shades', tie: '#c41a1a', hair: '#1b1b1b' },
  { id: 'ninja', name: 'Ninja Ombra', rarity: 2, shirt: '#1b1b24', pants: '#15151b', skin: '#c99a74', shoes: '#101010', acc: 'ninja', accColor: '#d0242e' },
  { id: 'tattico', name: 'Soldato Tattico', rarity: 2, shirt: '#5b6447', pants: '#4a4f3a', skin: '#c99872', shoes: '#2a2620', acc: 'helmet', accColor: '#4f573d', vest: '#3a3f2e', pouch: '#2e3324', kneepads: '#25281e', boots: true },
  { id: 'pirata', name: 'Capitan Pirata', rarity: 2, shirt: '#efe4cc', pants: '#5a3a20', skin: '#d8a47a', shoes: '#3a2210', acc: 'pirate', accColor: '#1e1e1e', belt: '#b8862b', hair: '#2a1a0e' },
  { id: 'meccanico', name: 'Meccanico', rarity: 3, shirt: '#c94a3a', pants: '#2d5d9a', skin: '#b07a52', shoes: '#2a2a2a', acc: 'capback', accColor: '#e0a020', beard: '#3a2a1a', hair: '#3a2a1a', overalls: '#2d5d9a', toolbelt: true, boots: true },
  { id: 'cyber', name: 'Cyber Neon', rarity: 3, shirt: '#151530', pants: '#0d0d1f', skin: '#c8a080', shoes: '#0a0a14', acc: 'visor', accColor: '#ff2bd6', glow: '#00f0ff' },
  { id: 'astro', name: 'Astronauta', rarity: 3, shirt: '#e9e9f0', pants: '#cfd0d8', skin: '#f0c9a0', shoes: '#9a9aa4', acc: 'astro', accColor: '#ff7b00', backpack: '#c8c8d2' },
  { id: 'banana', name: 'Agente Banana', rarity: 3, shirt: '#ffe03a', pants: '#ffe03a', skin: '#ffe03a', shoes: '#6b4a12', acc: 'banana', accColor: '#6b4a12', banana: true },
  { id: 'cavaliere', name: "Cavaliere d'Oro", rarity: 4, shirt: '#d8aa30', pants: '#8c6c1c', skin: '#e0b48a', shoes: '#6b5212', acc: 'knight', accColor: '#ffd24a', cape: '#a3122a', metal: true },
  { id: 'drago', name: 'Drago Rosso', rarity: 4, shirt: '#a3121a', pants: '#5e0a0f', skin: '#c2281f', shoes: '#2a0304', acc: 'horns', accColor: '#f2d28a', cape: '#2a0303', glow: '#ff6a00' },
  // ── eroi anime originali (dal set Blender "Original Anime Heroes"): disponibili da subito ──
  { id: 'leo', name: 'Leo l\'Esploratore', rarity: 3, hero: 'leo', shirt: '#6f7d48', pants: '#8f7352', skin: '#f2cdb0', shoes: '#b07a55', acc: 'glasses', accColor: '#7a5238', hair: '#8e6240', eyes: '#3fae6c', hat: 'bucket', hairStyle: 'curly', short: true, shorts: true, boots: true },
  { id: 'tamsin', name: 'Tamsin la Monaca', rarity: 3, hero: 'tamsin', shirt: '#ad2738', pants: '#3a3a44', skin: '#e6c0a2', shoes: '#3a3a42', acc: 'none', hair: '#8a4038', eyes: '#eeb440', sleeveless: true, short: true, wide: true, hairStyle: 'braid', lashes: true, flats: true, gold: '#f2c85a' },
  { id: 'oren', name: 'Oren l\'Ombra', rarity: 4, hero: 'oren', shirt: '#3c3c48', pants: '#3c3c48', skin: '#f4dfd0', shoes: '#56565e', acc: 'none', hair: '#cdd3e0', eyes: '#9a8ef0', faceMask: '#3d4356', gloves: '#4c4c55', belt: '#8d6e50', kneepads: '#a9b2bd', tabi: true, hairStyle: 'swept', browTilt: 1, gold: '#f0d080' },
  // ── sbloccabili: pass battaglia e negozio ──
  { id: 'cowboy', name: 'Cowboy Polveroso', rarity: 2, shirt: '#b0643a', pants: '#3b4a6b', skin: '#d9a478', shoes: '#4a2c14', acc: 'none', hair: '#5a3418', scarf: '#c0302a', belt: '#5a3a1a', boots: true, hat: 'cowboy', lock: 'pass' },
  { id: 'scienziata', name: 'Scienziata Pazza', rarity: 2, shirt: '#f2f2f0', pants: '#3a3a5a', skin: '#f0c8a8', shoes: '#2a2a3a', acc: 'ponytail', accColor: '#7a4ad0', hair: '#c0602a', coat: true, lock: 'pass' },
  { id: 'vichingo', name: 'Vichingo del Nord', rarity: 3, shirt: '#6b4a2a', pants: '#4a3a2a', skin: '#e8b890', shoes: '#3a2414', acc: 'none', hair: '#d08a3a', beard: '#d08a3a', fur: '#d8c8a8', belt: '#3a2a1a', boots: true, hat: 'viking', lock: 'pass' },
  { id: 'samurai', name: 'Samurai Cremisi', rarity: 4, shirt: '#8a1a22', pants: '#1a1a22', skin: '#e0b088', shoes: '#141414', acc: 'ninja', accColor: '#f2c84a', vest: '#2a2a32', pouch: '#8a1a22', cape: '#5a0a12', lock: 'pass' },
  { id: 'robot', name: 'Robot X-9', rarity: 3, shirt: '#8a96a8', pants: '#5a6474', skin: '#8a96a8', shoes: '#3a4250', acc: 'visor', accColor: '#3affd0', glow: '#3affd0', metal: true, lock: 'shop' },
  { id: 'spettro', name: 'Spettro Gelido', rarity: 4, shirt: '#dce8f8', pants: '#b8c8e0', skin: '#c8d8f0', shoes: '#8aa0c0', acc: 'none', hair: '#f0f8ff', glow: '#7fd0ff', torn: true, cape: '#a8c0e8', lock: 'shop' },
  { id: 'giardiniera', name: 'Giardiniera', rarity: 1, shirt: '#e8d06a', pants: '#5a8a3a', skin: '#c48a62', shoes: '#4a3a2a', acc: 'none', hair: '#2a1a12', overalls: '#5a8a3a', boots: true, hat: 'straw', lock: 'shop' },
  { id: 'rapper', name: 'MC Rima', rarity: 2, shirt: '#2a2a2a', pants: '#3a5a9a', skin: '#8a5a3a', shoes: '#f2f2f2', acc: 'shades', hair: '#141414', chain: '#ffd24a', hat: 'beanie', lock: 'shop' },
];

/** Cappelli (si mettono su qualsiasi skin che non abbia già un casco) */
export const HATS = [
  { id: 'none', name: 'Nessuno', rarity: 0 },
  { id: 'cap', name: 'Berretto sportivo', rarity: 0, color: '#2a5ad0' },
  { id: 'beanie', name: 'Cuffia di lana', rarity: 1, color: '#d0402a', lock: 'pass' },
  { id: 'cowboy', name: 'Cappello da cowboy', rarity: 2, color: '#7a4a24', lock: 'pass' },
  { id: 'headphones', name: 'Cuffie da gamer', rarity: 2, color: '#1a1a1a', accent: '#00e0ff', lock: 'shop' },
  { id: 'straw', name: 'Cappello di paglia', rarity: 1, color: '#e0c070', lock: 'shop' },
  { id: 'tophat', name: 'Cilindro elegante', rarity: 3, color: '#151515', accent: '#a01a2a', lock: 'shop' },
  { id: 'viking', name: 'Elmo vichingo', rarity: 3, color: '#8a8a90', accent: '#f0e8d0', lock: 'pass' },
  { id: 'wizard', name: 'Cappello da mago', rarity: 3, color: '#3a2a8a', accent: '#ffd24a', lock: 'pass' },
  { id: 'crown', name: 'Corona reale', rarity: 4, color: '#ffc830', accent: '#e0203a', lock: 'pass' },
  { id: 'halo', name: 'Aureola', rarity: 4, color: '#fff2a0', lock: 'shop' },
  { id: 'bucket', name: 'Cappello da esploratore', rarity: 2, color: '#e3b84c', accent: '#8a6440', lock: 'shop' },
  { id: 'beret', name: 'Basco', rarity: 1, color: '#2a3a6a', accent: '#d0a040', lock: 'pass' },
  { id: 'tactical', name: 'Elmetto tattico con visore', rarity: 2, color: '#5a6248', accent: '#2ae07a', lock: 'pass' },
  { id: 'santa', name: 'Cappello di Natale', rarity: 2, color: '#c8202a', accent: '#f6f2ea', lock: 'shop' },
  { id: 'foxears', name: 'Orecchie da volpe', rarity: 3, color: '#e0702a', accent: '#fff0e0', lock: 'shop' },
  { id: 'samurai', name: 'Kabuto da samurai', rarity: 4, color: '#1a1a22', accent: '#e8b830', lock: 'shop' },
];

/** Zaini e oggetti sulla schiena */
export const BACKPACKS = [
  { id: 'none', name: 'Nessuno', rarity: 0 },
  { id: 'school', name: 'Zainetto', rarity: 0, color: '#3a7ad0', accent: '#f2c230' },
  { id: 'hiker', name: 'Zaino da trekking', rarity: 1, color: '#4a6a3a', accent: '#c06030', lock: 'pass' },
  { id: 'guitar', name: 'Chitarra', rarity: 2, color: '#b0602a', accent: '#2a1a12', lock: 'shop' },
  { id: 'sword', name: 'Spada leggendaria', rarity: 3, color: '#c8d0e0', accent: '#ffd24a', lock: 'pass' },
  { id: 'jetpack', name: 'Jetpack', rarity: 3, color: '#a0a8b8', accent: '#ff6a1a', lock: 'shop' },
  { id: 'wings', name: "Ali d'angelo", rarity: 4, color: '#f8f8ff', accent: '#ffe8a0', lock: 'pass' },
  { id: 'dragonwings', name: 'Ali di drago', rarity: 4, color: '#7a0a12', accent: '#ff8a1a', lock: 'shop' },
  { id: 'tactical', name: 'Zaino tattico con radio', rarity: 1, color: '#4e5640', accent: '#2a2c26', lock: 'pass' },
  { id: 'quiver', name: 'Faretra', rarity: 2, color: '#6a3e1e', accent: '#e04a3a', lock: 'shop' },
  { id: 'surf', name: 'Tavola da surf', rarity: 2, color: '#f2f0e6', accent: '#1aa0d8', lock: 'shop' },
  { id: 'shield', name: 'Scudo del guerriero', rarity: 3, color: '#8a5a30', accent: '#c8ccd4', lock: 'pass' },
];

/** Modalità di gioco */
export const MODES = [
  { id: 'br', name: 'Battle Royale', icon: '👑', desc: "La classica isola con 18 località: l'ultimo sopravvissuto vince." },
  { id: 'random', name: 'Random Map', icon: '🎲', desc: 'Ogni partita un\'isola nuova: città, montagne e laghi generati a caso.' },
];

/** Dimensione delle squadre (v23) */
export const TEAM_MODES = [
  { id: 'solo', name: 'Singolo', size: 1, icon: '1', desc: 'Tutti contro tutti: vince l\'ultimo sopravvissuto.' },
  { id: 'duo', name: 'Duo', size: 2, icon: '2', desc: 'Squadre da 2: vince l\'ultima coppia in piedi.' },
  { id: 'trio', name: 'Trio', size: 3, icon: '3', desc: 'Squadre da 3: coordinatevi e coprite i compagni.' },
  { id: 'squad', name: 'Squad', size: 4, icon: '4', desc: 'Squadre da 4: la modalità più tattica.' },
];
export const teamSize = (id) => (TEAM_MODES.find(t => t.id === id) || TEAM_MODES[0]).size;
/** colori dei compagni di squadra (HUD, minimappa, targhette) */
export const MATE_COLORS = ['#ffd23a', '#3ad6ff', '#7dff5a', '#ff7ad6'];

export const GLIDERS = [
  { id: 'classico', name: 'Classico', color: '#3a8dff', accent: '#ffffff' },
  { id: 'fiamma', name: 'Fiamma', color: '#ff4a1a', accent: '#ffd23a' },
  { id: 'notte', name: 'Notte', color: '#2a1a4a', accent: '#c04dff' },
  { id: 'smeraldo', name: 'Smeraldo', color: '#18a058', accent: '#e8ffe8' },
  { id: 'arcobaleno', name: 'Arcobaleno', color: '#ff4ab0', accent: '#4affe0', rarity: 2, lock: 'pass' },
  { id: 'oro', name: 'Ala Dorata', color: '#ffc830', accent: '#fff4c0', rarity: 4, lock: 'pass' },
  { id: 'tigre', name: 'Tigre', color: '#ff8a1a', accent: '#1a1a1a', rarity: 3, lock: 'shop' },
];

export const DIFFICULTY = {
  facile: { name: 'Facile', aimError: 0.11, reaction: 0.9, dmgMult: 0.6, lead: 0.5 },
  normale: { name: 'Normale', aimError: 0.07, reaction: 0.55, dmgMult: 0.75, lead: 0.8 },
  difficile: { name: 'Difficile', aimError: 0.035, reaction: 0.3, dmgMult: 1.0, lead: 0.95 },
};

// v34: la difficoltà cresce con la modalità a squadre (in squadra hai compagni, rianimazioni e più potenza di fuoco)
// e online (gli amici veri coordinano meglio dei bot). Livello: singolo 0 · duo 1 · trio 2 · squad 3, +1 online con altri.
export const TEAM_DIFF_LEVEL = { solo: 0, duo: 1, trio: 2, squad: 3 };
export function scaledDifficulty(key, team = 'solo', humans = 1) {
  const b = DIFFICULTY[key] || DIFFICULTY.normale;
  const lv = (TEAM_DIFF_LEVEL[team] || 0) + (humans > 1 ? 1 : 0) + (humans > 4 ? 0.5 : 0);
  return {
    ...b, key: key in DIFFICULTY ? key : 'normale', level: lv,
    aimError: b.aimError * Math.pow(0.86, lv),          // mira più precisa
    reaction: b.reaction * Math.pow(0.84, lv),          // reagiscono prima
    dmgMult: b.dmgMult * (1 + 0.09 * lv),               // colpiscono più forte
    lead: Math.min(1, b.lead + 0.04 * lv),              // anticipano meglio chi si muove
    sight: 1 + 0.1 * lv,                                // vedono più lontano
    aggro: Math.min(0.9, 0.15 + 0.06 * lv),             // cercano bersagli più spesso
    burst: 1 + 0.12 * lv,                               // raffiche più lunghe
  };
}
/** etichetta breve per menu/HUD: "Normale +2" */
export const diffLabel = (key, team, humans = 1) => { const d = scaledDifficulty(key, team, humans); return d.name + (d.level ? ` +${d.level}` : ''); };

// Fasi della tempesta: attesa, durata restringimento, raggio finale, danno/sec
// Tempesta: raggi per la mappa grande (1200 m) e tempi più lunghi (partita di circa 21 minuti)
export const STORM_PHASES = [
  // v21: partite più lunghe (circa 21 minuti), una fase in più
  { wait: 210, shrink: 120, radius: 460, dps: 1 },
  { wait: 150, shrink: 100, radius: 300, dps: 1 },
  { wait: 120, shrink: 85, radius: 180, dps: 2 },
  { wait: 95, shrink: 70, radius: 95, dps: 3 },
  { wait: 75, shrink: 55, radius: 40, dps: 5 },
  { wait: 55, shrink: 50, radius: 12, dps: 8 },
  { wait: 40, shrink: 45, radius: 0, dps: 10 },
];

export const BOT_NAMES = [
  'xX_Sniper_Xx', 'PizzaLover99', 'Luigi_Pro', 'GiulyGamer', 'TurboNonna', 'IlPrincipe',
  'NoScopeMarco', 'Sbrisolona', 'CaptainFrico', 'Ghost_Venezia', 'FrancyFPS', 'Spritz_Master',
  'Dottor_Tilt', 'BombaLatte', 'Ale_Zeta', 'ViperaNera', 'MisterTiramisù', 'BotPadovano',
  'Fulmine27', 'LaVolpe', 'Cecco_Bello', 'KillerKiwi', 'Nonno_Camper', 'SaraStrike',
  'Pandoro_OP', 'RagùRage', 'Tortellino', 'Mozzarella_X', 'Giorgione', 'BuildGod_IT',
];
