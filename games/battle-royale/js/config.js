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
    name: 'Pistola', dmg: 25, pellets: 1, rate: 0.22, mag: 12, reload: 1.2,
    spread: 0.016, range: 140, ammo: 'light', auto: false, zoom: 1.25,
    botRange: 35, sound: 'pistol', recoil: 0.012, muzzle: 0.3,
    parts: [[0.08, 0.1, 0.34, 0, 0, 0.1, 'm'], [0.07, 0.18, 0.09, 0, -0.11, -0.02, 'b'], [0.086, 0.03, 0.22, 0, 0.055, 0.12, 'r']],
  },
  smg: {
    name: 'Mitraglietta', dmg: 15, pellets: 1, rate: 0.075, mag: 30, reload: 1.9,
    spread: 0.042, range: 90, ammo: 'light', auto: true, zoom: 1.25,
    botRange: 28, sound: 'smg', recoil: 0.006, muzzle: 0.45,
    parts: [[0.09, 0.12, 0.5, 0, 0, 0.13, 'm'], [0.06, 0.22, 0.07, 0, -0.15, 0.2, 'b'], [0.07, 0.14, 0.07, 0, -0.1, -0.02, 'b'], [0.05, 0.08, 0.2, 0, 0, -0.2, 'r'], [0.095, 0.025, 0.3, 0, 0.07, 0.15, 'r']],
  },
  ar: {
    name: "Fucile d'assalto", dmg: 30, pellets: 1, rate: 0.13, mag: 30, reload: 2.1,
    spread: 0.02, range: 220, ammo: 'medium', auto: true, zoom: 1.6,
    botRange: 60, sound: 'ar', recoil: 0.009, muzzle: 0.9,
    parts: [[0.1, 0.14, 0.72, 0, 0, 0.18, 'b'], [0.05, 0.05, 0.32, 0, 0.02, 0.7, 'm'], [0.07, 0.24, 0.1, 0, -0.17, 0.25, 'm'], [0.07, 0.15, 0.08, 0, -0.12, -0.02, 'm'], [0.09, 0.16, 0.3, 0, -0.02, -0.3, 'b'], [0.06, 0.07, 0.22, 0, 0.11, 0.18, 'r']],
  },
  shotgun: {
    name: 'Fucile a pompa', dmg: 12, pellets: 9, rate: 0.95, mag: 5, reload: 2.5,
    spread: 0.1, range: 45, ammo: 'shells', auto: false, zoom: 1.2,
    botRange: 14, sound: 'shotgun', recoil: 0.05, muzzle: 0.9,
    parts: [[0.1, 0.12, 0.5, 0, 0, 0.08, 'm'], [0.07, 0.07, 0.55, 0, 0.02, 0.58, 'm'], [0.11, 0.08, 0.26, 0, -0.07, 0.52, 'w'], [0.09, 0.15, 0.35, 0, -0.05, -0.3, 'w'], [0.105, 0.03, 0.3, 0, 0.065, 0.08, 'r']],
  },
  sniper: {
    name: 'Cecchino', dmg: 105, pellets: 1, rate: 1.45, mag: 5, reload: 2.8,
    spread: 0.05, adsSpread: 0.0, range: 600, ammo: 'heavy', auto: false, zoom: 4.5, scope: true,
    botRange: 120, sound: 'sniper', recoil: 0.06, muzzle: 1.2,
    parts: [[0.09, 0.12, 0.7, 0, 0, 0.15, 'b'], [0.04, 0.04, 0.6, 0, 0.02, 0.8, 'm'], [0.08, 0.08, 0.38, 0, 0.13, 0.15, 'm'], [0.085, 0.03, 0.06, 0, 0.13, 0.32, 'r'], [0.085, 0.03, 0.06, 0, 0.13, -0.02, 'r'], [0.09, 0.17, 0.32, 0, -0.04, -0.33, 'b'], [0.07, 0.14, 0.08, 0, -0.12, -0.04, 'm']],
  },
  rocket: {
    name: 'Lanciarazzi', dmg: 100, pellets: 1, rate: 1.3, mag: 1, reload: 2.8,
    spread: 0.01, range: 300, ammo: 'rockets', auto: false, zoom: 1.4, projectile: true, splash: 6,
    botRange: 45, sound: 'rocket', recoil: 0.06, muzzle: 0.85,
    parts: [[0.2, 0.2, 1.2, 0, 0.06, 0.2, 'b'], [0.22, 0.22, 0.08, 0, 0.06, 0.78, 'r'], [0.22, 0.22, 0.08, 0, 0.06, -0.38, 'r'], [0.07, 0.16, 0.08, 0, -0.12, 0.05, 'm'], [0.07, 0.16, 0.08, 0, -0.12, 0.35, 'm']],
  },
};

// Rarità tipiche per arma (probabilità per livello)
export const WEAPON_POOL = [
  { id: 'pistol', w: 18, rar: [40, 35, 20, 5, 0] },
  { id: 'smg', w: 18, rar: [30, 35, 25, 8, 2] },
  { id: 'ar', w: 22, rar: [30, 30, 25, 10, 5] },
  { id: 'shotgun', w: 20, rar: [25, 35, 25, 10, 5] },
  { id: 'sniper', w: 8, rar: [0, 0, 50, 35, 15] },
  { id: 'rocket', w: 5, rar: [0, 0, 0, 60, 40] },
];

export const CONSUMABLES = {
  bandage: { name: 'Bende', icon: '🩹', time: 2.2, hp: 15, maxHp: 75, stack: 15, rarity: 0, count: 5 },
  medkit: { name: 'Medikit', icon: '🧰', time: 5, hp: 100, maxHp: 100, stack: 3, rarity: 1, count: 1 },
  minishield: { name: 'Mini scudo', icon: '💧', time: 1.5, shield: 25, maxShield: 50, stack: 6, rarity: 2, count: 3 },
  shield: { name: 'Pozione scudo', icon: '🧪', time: 4, shield: 50, maxShield: 100, stack: 3, rarity: 3, count: 1 },
};

export const SKINS = [
  { id: 'recluta', name: 'Recluta', rarity: 0, shirt: '#4f7f3d', pants: '#3a4628', skin: '#e2b58c', shoes: '#262626', acc: 'cap', accColor: '#2f5a26', hair: '#4a2e1a' },
  { id: 'zombie', name: 'Zombie Errante', rarity: 1, shirt: '#5c6b7a', pants: '#3a3f4a', skin: '#86ab70', shoes: '#2b2b2b', acc: 'none', hair: '#2c3a22', torn: true },
  { id: 'agente', name: 'Agente Segreto', rarity: 1, shirt: '#1d1d22', pants: '#1d1d22', skin: '#d9a882', shoes: '#0d0d0d', acc: 'shades', tie: '#c41a1a', hair: '#1b1b1b' },
  { id: 'ninja', name: 'Ninja Ombra', rarity: 2, shirt: '#1b1b24', pants: '#15151b', skin: '#c99a74', shoes: '#101010', acc: 'ninja', accColor: '#d0242e' },
  { id: 'pirata', name: 'Capitan Pirata', rarity: 2, shirt: '#efe4cc', pants: '#5a3a20', skin: '#d8a47a', shoes: '#3a2210', acc: 'pirate', accColor: '#1e1e1e', belt: '#b8862b', hair: '#2a1a0e' },
  { id: 'cyber', name: 'Cyber Neon', rarity: 3, shirt: '#151530', pants: '#0d0d1f', skin: '#c8a080', shoes: '#0a0a14', acc: 'visor', accColor: '#ff2bd6', glow: '#00f0ff' },
  { id: 'astro', name: 'Astronauta', rarity: 3, shirt: '#e9e9f0', pants: '#cfd0d8', skin: '#f0c9a0', shoes: '#9a9aa4', acc: 'astro', accColor: '#ff7b00', backpack: '#c8c8d2' },
  { id: 'banana', name: 'Agente Banana', rarity: 3, shirt: '#ffe03a', pants: '#ffe03a', skin: '#ffe03a', shoes: '#6b4a12', acc: 'banana', accColor: '#6b4a12', banana: true },
  { id: 'cavaliere', name: "Cavaliere d'Oro", rarity: 4, shirt: '#d8aa30', pants: '#8c6c1c', skin: '#e0b48a', shoes: '#6b5212', acc: 'knight', accColor: '#ffd24a', cape: '#a3122a', metal: true },
  { id: 'drago', name: 'Drago Rosso', rarity: 4, shirt: '#a3121a', pants: '#5e0a0f', skin: '#c2281f', shoes: '#2a0304', acc: 'horns', accColor: '#f2d28a', cape: '#2a0303', glow: '#ff6a00' },
];

export const GLIDERS = [
  { id: 'classico', name: 'Classico', color: '#3a8dff', accent: '#ffffff' },
  { id: 'fiamma', name: 'Fiamma', color: '#ff4a1a', accent: '#ffd23a' },
  { id: 'notte', name: 'Notte', color: '#2a1a4a', accent: '#c04dff' },
  { id: 'smeraldo', name: 'Smeraldo', color: '#18a058', accent: '#e8ffe8' },
];

export const DIFFICULTY = {
  facile: { name: 'Facile', aimError: 0.11, reaction: 0.9, dmgMult: 0.6, bots: 19 },
  normale: { name: 'Normale', aimError: 0.07, reaction: 0.55, dmgMult: 0.75, bots: 24 },
  difficile: { name: 'Difficile', aimError: 0.035, reaction: 0.3, dmgMult: 1.0, bots: 29 },
};

// Fasi della tempesta: attesa, durata restringimento, raggio finale, danno/sec
// Tempesta: raggi per la mappa grande (1200 m) e tempi più lunghi (partita di circa 15 minuti)
export const STORM_PHASES = [
  { wait: 150, shrink: 90, radius: 450, dps: 1 },
  { wait: 100, shrink: 75, radius: 270, dps: 1 },
  { wait: 80, shrink: 60, radius: 150, dps: 2 },
  { wait: 65, shrink: 50, radius: 75, dps: 4 },
  { wait: 50, shrink: 40, radius: 30, dps: 6 },
  { wait: 40, shrink: 45, radius: 0, dps: 10 },
];

export const BOT_NAMES = [
  'xX_Sniper_Xx', 'PizzaLover99', 'Luigi_Pro', 'GiulyGamer', 'TurboNonna', 'IlPrincipe',
  'NoScopeMarco', 'Sbrisolona', 'CaptainFrico', 'Ghost_Venezia', 'FrancyFPS', 'Spritz_Master',
  'Dottor_Tilt', 'BombaLatte', 'Ale_Zeta', 'ViperaNera', 'MisterTiramisù', 'BotPadovano',
  'Fulmine27', 'LaVolpe', 'Cecco_Bello', 'KillerKiwi', 'Nonno_Camper', 'SaraStrike',
  'Pandoro_OP', 'RagùRage', 'Tortellino', 'Mozzarella_X', 'Giorgione', 'BuildGod_IT',
];
