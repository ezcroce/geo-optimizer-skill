// Complete Architectural Blueprint of "VILLA BELLAVISTA"
// World units in meters: Estate spans X [-34, +34], Z [-27, +27]
// Main Villa building spans X [-24, +24], Z [-15, +13]

export const ESTATE_BOUNDS = {
  minX: -33.5,
  maxX: 33.5,
  minZ: -26.5,
  maxZ: 26.5,
};

export const VILLA_FOOTPRINT = {
  minX: -24,
  maxX: 24,
  minZ: -15,
  maxZ: 13,
};

export const ROOMS = [
  // North Wing (Z: -15 to -5)
  {
    id: 'master_bedroom',
    name: 'Camera Padronale',
    shortName: 'Cam. Padronale',
    indoor: true,
    bounds: { minX: -24, maxX: -12, minZ: -15, maxZ: -5 },
    floorType: 'parquet_dark',
    labelPos: { x: -18, z: -10 },
    wing: 'west',
  },
  {
    id: 'bathroom',
    name: 'Bagno di Lusso',
    shortName: 'Bagno Spa',
    indoor: true,
    bounds: { minX: -12, maxX: -3, minZ: -15, maxZ: -5 },
    floorType: 'marble_white',
    labelPos: { x: -7.5, z: -10 },
    wing: 'west',
  },
  {
    id: 'study',
    name: 'Studio Privato',
    shortName: 'Studio',
    indoor: true,
    bounds: { minX: -3, maxX: 11, minZ: -15, maxZ: -5 },
    floorType: 'parquet_warm',
    labelPos: { x: 4, z: -10 },
    wing: 'north',
  },
  {
    id: 'security',
    name: 'Sala di Controllo CCTV',
    shortName: 'Sala CCTV',
    indoor: true,
    bounds: { minX: 11, maxX: 24, minZ: -15, maxZ: -5 },
    floorType: 'slate_tech',
    labelPos: { x: 17.5, z: -10 },
    wing: 'east',
  },

  // Central Gallery Corridors (Z: -5 to +1)
  {
    id: 'corridor_west',
    name: 'Galleria Ovest',
    shortName: 'Corr. Ovest',
    indoor: true,
    bounds: { minX: -24, maxX: -8, minZ: -5, maxZ: 1 },
    floorType: 'marble_checker',
    labelPos: { x: -16, z: -2 },
    wing: 'west',
  },
  {
    id: 'corridor_center',
    name: 'Galleria Centrale',
    shortName: 'Galleria',
    indoor: true,
    bounds: { minX: -8, maxX: 8, minZ: -5, maxZ: 1 },
    floorType: 'marble_checker',
    labelPos: { x: 0, z: -2 },
    wing: 'center',
  },
  {
    id: 'corridor_east',
    name: 'Galleria Est',
    shortName: 'Corr. Est',
    indoor: true,
    bounds: { minX: 8, maxX: 24, minZ: -5, maxZ: 1 },
    floorType: 'marble_checker',
    labelPos: { x: 16, z: -2 },
    wing: 'east',
  },

  // South Wing (Z: +1 to +13)
  {
    id: 'guest_bedroom',
    name: 'Camera degli Ospiti',
    shortName: 'Cam. Ospiti',
    indoor: true,
    bounds: { minX: -24, maxX: -13, minZ: 1, maxZ: 13 },
    floorType: 'parquet_warm',
    labelPos: { x: -18.5, z: 7 },
    wing: 'west',
  },
  {
    id: 'foyer',
    name: 'Atrio d’Ingresso',
    shortName: 'Atrio',
    indoor: true,
    bounds: { minX: -13, maxX: -1, minZ: 1, maxZ: 13 },
    floorType: 'marble_checker',
    labelPos: { x: -7, z: 7 },
    wing: 'center',
  },
  {
    id: 'salon',
    name: 'Salone delle Feste',
    shortName: 'Salone',
    indoor: true,
    bounds: { minX: -1, maxX: 12, minZ: 1, maxZ: 13 },
    floorType: 'parquet_herringbone',
    labelPos: { x: 5.5, z: 7 },
    wing: 'south',
  },
  {
    id: 'kitchen',
    name: 'Cucina & Sala da Pranzo',
    shortName: 'Cucina',
    indoor: true,
    bounds: { minX: 12, maxX: 24, minZ: 1, maxZ: 13 },
    floorType: 'marble_white',
    labelPos: { x: 18, z: 7 },
    wing: 'east',
  },

  // Outdoor Zones surrounding the Villa
  {
    id: 'pool_area',
    name: 'Area Piscina & Solarium',
    shortName: 'Piscina',
    indoor: false,
    bounds: { minX: -34, maxX: -24, minZ: -16, maxZ: 16 },
    floorType: 'travertine',
    labelPos: { x: -29, z: -1 },
    wing: 'outdoor',
  },
  {
    id: 'backyard',
    name: 'Retro-Villa & Gazebo',
    shortName: 'Retro-Villa',
    indoor: false,
    bounds: { minX: -34, maxX: 34, minZ: -27, maxZ: -15 },
    floorType: 'grass',
    labelPos: { x: -4, z: -21 },
    wing: 'outdoor',
  },
  {
    id: 'front_garden',
    name: 'Giardino Frontale & Fontana',
    shortName: 'Giardino Sud',
    indoor: false,
    bounds: { minX: -34, maxX: 34, minZ: 13, maxZ: 27 },
    floorType: 'grass',
    labelPos: { x: -7, z: 20 },
    wing: 'outdoor',
  },
  {
    id: 'east_garden',
    name: 'Vialetto Orientale & Roseto',
    shortName: 'Vialetto Est',
    indoor: false,
    bounds: { minX: 24, maxX: 34, minZ: -16, maxZ: 16 },
    floorType: 'grass',
    labelPos: { x: 29, z: 0 },
    wing: 'outdoor',
  },
];

// Doors connecting rooms & exterior. orientation: 'h' (along X axis on a constant Z wall) or 'v' (along Z axis on a constant X wall)
export const DOORS = [
  // Exterior doors
  { id: 'd_back_terrace', name: 'Porta Terrazza Nord', x: 4, z: -15, width: 2.4, orientation: 'h', wing: 'north', exterior: true },
  { id: 'd_main_foyer', name: 'Portone Principale', x: -7, z: 13, width: 2.8, orientation: 'h', wing: 'center', exterior: true },
  { id: 'd_salon_garden', name: 'Portafinestra Salone', x: 5.5, z: 13, width: 2.4, orientation: 'h', wing: 'south', exterior: true },
  { id: 'd_west_pool', name: 'Uscita Piscina', x: -24, z: -2, width: 2.4, orientation: 'v', wing: 'west', exterior: true },
  { id: 'd_east_path', name: 'Uscita Vialetto Est', x: 24, z: -2, width: 2.4, orientation: 'v', wing: 'east', exterior: true },

  // North Wing interior doors (Z = -5)
  { id: 'd_master', name: 'Porta Camera Padronale', x: -18, z: -5, width: 2.2, orientation: 'h', wing: 'west' },
  { id: 'd_bath', name: 'Porta Bagno di Lusso', x: -7.5, z: -5, width: 2.1, orientation: 'h', wing: 'west' },
  { id: 'd_study', name: 'Porta Studio Privato', x: 4, z: -5, width: 2.2, orientation: 'h', wing: 'north' },
  { id: 'd_security', name: 'Porta Blindata CCTV', x: 17.5, z: -5, width: 2.2, orientation: 'h', wing: 'east' },

  // North Wing side doors
  { id: 'd_master_bath', name: 'Porta Suite Bagno', x: -12, z: -10, width: 2.0, orientation: 'v', wing: 'west' },
  { id: 'd_study_sec', name: 'Accesso Tecnico Studio', x: 11, z: -10, width: 2.0, orientation: 'v', wing: 'east' },

  // South Wing interior doors (Z = +1)
  { id: 'd_guest', name: 'Porta Camera Ospiti', x: -18.5, z: 1, width: 2.2, orientation: 'h', wing: 'west' },
  { id: 'd_foyer_arch', name: 'Arcata Atrio Centrale', x: -7, z: 1, width: 3.6, orientation: 'h', wing: 'center', arch: true },
  { id: 'd_salon', name: 'Porta Salone delle Feste', x: 5.5, z: 1, width: 2.4, orientation: 'h', wing: 'south' },
  { id: 'd_kitchen', name: 'Porta Cucina', x: 18, z: 1, width: 2.2, orientation: 'h', wing: 'east' },

  // South Wing cross-doors
  { id: 'd_foyer_salon', name: 'Doppie Porte Salone', x: -1, z: 7, width: 2.4, orientation: 'v', wing: 'south' },
  { id: 'd_salon_kitchen', name: 'Passaggio Sala Pranzo', x: 12, z: 7, width: 2.2, orientation: 'v', wing: 'east' },
];

// Raw architectural wall lines before automatic doorway carving
const RAW_WALLS = [
  // Villa Exterior Perimeter
  { x1: -24, z1: -15, x2: 24, z2: -15, exterior: true, thickness: 0.42 },
  { x1: -24, z1: 13, x2: 24, z2: 13, exterior: true, thickness: 0.42 },
  { x1: -24, z1: -15, x2: -24, z2: 13, exterior: true, thickness: 0.42 },
  { x1: 24, z1: -15, x2: 24, z2: 13, exterior: true, thickness: 0.42 },

  // Main Corridor Horizontal Walls
  { x1: -24, z1: -5, x2: 24, z2: -5, exterior: false, thickness: 0.30 },
  { x1: -24, z1: 1, x2: 24, z2: 1, exterior: false, thickness: 0.30 },

  // North Wing Partitions (Z: -15 to -5)
  { x1: -12, z1: -15, x2: -12, z2: -5, exterior: false, thickness: 0.28 },
  { x1: -3, z1: -15, x2: -3, z2: -5, exterior: false, thickness: 0.28 },
  { x1: 11, z1: -15, x2: 11, z2: -5, exterior: false, thickness: 0.28 },

  // South Wing Partitions (Z: +1 to +13)
  { x1: -13, z1: 1, x2: -13, z2: 13, exterior: false, thickness: 0.28 },
  { x1: -1, z1: 1, x2: -1, z2: 13, exterior: false, thickness: 0.28 },
  { x1: 12, z1: 1, x2: 12, z2: 13, exterior: false, thickness: 0.28 },
];

export function buildWallSegments() {
  const segments = [];
  for (const w of RAW_WALLS) {
    const isH = Math.abs(w.z1 - w.z2) < 0.001;
    if (isH) {
      const z = w.z1;
      const minX = Math.min(w.x1, w.x2);
      const maxX = Math.max(w.x1, w.x2);
      const matchingDoors = DOORS.filter(
        (d) => d.orientation === 'h' && Math.abs(d.z - z) < 0.05 && d.x > minX && d.x < maxX
      ).sort((a, b) => a.x - b.x);

      let cursor = minX;
      for (const d of matchingDoors) {
        const dStart = d.x - d.width / 2;
        const dEnd = d.x + d.width / 2;
        if (dStart > cursor + 0.05) {
          segments.push({ x1: cursor, z1: z, x2: dStart, z2: z, exterior: w.exterior, thickness: w.thickness });
        }
        cursor = dEnd;
      }
      if (maxX > cursor + 0.05) {
        segments.push({ x1: cursor, z1: z, x2: maxX, z2: z, exterior: w.exterior, thickness: w.thickness });
      }
    } else {
      const x = w.x1;
      const minZ = Math.min(w.z1, w.z2);
      const maxZ = Math.max(w.z1, w.z2);
      const matchingDoors = DOORS.filter(
        (d) => d.orientation === 'v' && Math.abs(d.x - x) < 0.05 && d.z > minZ && d.z < maxZ
      ).sort((a, b) => a.z - b.z);

      let cursor = minZ;
      for (const d of matchingDoors) {
        const dStart = d.z - d.width / 2;
        const dEnd = d.z + d.width / 2;
        if (dStart > cursor + 0.05) {
          segments.push({ x1: x, z1: cursor, x2: x, z2: dStart, exterior: w.exterior, thickness: w.thickness });
        }
        cursor = dEnd;
      }
      if (maxZ > cursor + 0.05) {
        segments.push({ x1: x, z1: cursor, x2: x, z2: maxZ, exterior: w.exterior, thickness: w.thickness });
      }
    }
  }
  return segments;
}

export const WALL_SEGMENTS = buildWallSegments();

// Furniture items with 3D model type, dimensions, rotation, and collision box (solid: true blocks movement)
export const FURNITURE = [
  // Camera Padronale (X: -24..-12, Z: -15..-5)
  { id: 'f_master_bed', type: 'king_bed', x: -20.5, z: -12.2, w: 3.4, d: 3.6, rot: 0, solid: true, color: '#6b1d2f' },
  { id: 'f_master_ns1', type: 'nightstand', x: -22.8, z: -13.5, w: 0.9, d: 0.9, rot: 0, solid: true },
  { id: 'f_master_ns2', type: 'nightstand', x: -18.2, z: -13.5, w: 0.9, d: 0.9, rot: 0, solid: true },
  { id: 'f_master_wardrobe', type: 'wardrobe', x: -14.2, z: -13.8, w: 2.6, d: 1.2, rot: 0, solid: true, secretGlow: true },
  { id: 'f_master_vanity', type: 'vanity', x: -22.8, z: -7.5, w: 1.2, d: 2.2, rot: Math.PI / 2, solid: true },
  { id: 'f_master_rug', type: 'rug', x: -18.5, z: -9.8, w: 5.5, d: 4.2, rot: 0, solid: false, color: '#7c2d36' },

  // Bagno di Lusso (X: -12..-3, Z: -15..-5)
  { id: 'f_bath_tub', type: 'bathtub', x: -7.5, z: -13.2, w: 2.6, d: 1.4, rot: 0, solid: true },
  { id: 'f_bath_vanity', type: 'sink_vanity', x: -4.2, z: -10.0, w: 1.1, d: 2.8, rot: -Math.PI / 2, solid: true },
  { id: 'f_bath_linen', type: 'cabinet', x: -10.8, z: -6.5, w: 1.3, d: 1.3, rot: 0, solid: true },

  // Studio Privato (X: -3..11, Z: -15..-5)
  { id: 'f_study_desk', type: 'exec_desk', x: 3.5, z: -10.5, w: 3.0, d: 1.5, rot: 0, solid: true },
  { id: 'f_study_books1', type: 'bookshelf', x: -1.8, z: -11.5, w: 1.1, d: 4.5, rot: Math.PI / 2, solid: true, secretGlow: true },
  { id: 'f_study_books2', type: 'bookshelf', x: 8.5, z: -14.1, w: 3.2, d: 1.0, rot: 0, solid: true },
  { id: 'f_study_sofa', type: 'sofa', x: 8.2, z: -7.5, w: 2.8, d: 1.3, rot: -Math.PI / 2, solid: true, color: '#3e2723' },
  { id: 'f_study_rug', type: 'rug', x: 3.5, z: -10.2, w: 6.2, d: 4.8, rot: 0, solid: false, color: '#1e3a3a' },

  // Sala di Controllo CCTV (X: 11..24, Z: -15..-5)
  { id: 'f_sec_console', type: 'cctv_desk', x: 17.5, z: -13.3, w: 4.8, d: 1.5, rot: 0, solid: true },
  { id: 'f_sec_server1', type: 'server_rack', x: 22.6, z: -12.0, w: 1.2, d: 2.4, rot: 0, solid: true },
  { id: 'f_sec_power', type: 'power_panel', x: 22.6, z: -7.5, w: 1.1, d: 1.8, rot: 0, solid: true },
  { id: 'f_sec_locker', type: 'cabinet', x: 12.6, z: -13.5, w: 1.8, d: 1.1, rot: 0, solid: true },

  // Galleria / Corridoi (Z: -5..+1)
  { id: 'f_corr_runner', type: 'rug', x: 0, z: -2, w: 42, d: 2.2, rot: 0, solid: false, color: '#881337' },
  { id: 'f_corr_ped1', type: 'pedestal', x: -12.5, z: -4.1, w: 0.8, d: 0.8, rot: 0, solid: true },
  { id: 'f_corr_ped2', type: 'pedestal', x: 11.5, z: -4.1, w: 0.8, d: 0.8, rot: 0, solid: true },

  // Camera degli Ospiti (X: -24..-13, Z: +1..+13)
  { id: 'f_guest_bed', type: 'king_bed', x: -20.8, z: 8.8, w: 3.0, d: 3.2, rot: Math.PI / 2, solid: true, color: '#1e3a5f' },
  { id: 'f_guest_trunk', type: 'antique_trunk', x: -15.0, z: 11.4, w: 2.0, d: 1.1, rot: 0, solid: true },
  { id: 'f_guest_wardrobe', type: 'wardrobe', x: -22.6, z: 3.5, w: 1.2, d: 2.4, rot: Math.PI / 2, solid: true },
  { id: 'f_guest_rug', type: 'rug', x: -18.2, z: 7.5, w: 5.0, d: 4.5, rot: 0, solid: false, color: '#283c56' },

  // Atrio d'Ingresso (X: -13..-1, Z: +1..+13)
  { id: 'f_foyer_table', type: 'emergency_pedestal', x: -7.0, z: 6.8, w: 2.4, d: 2.4, rot: 0, solid: true },
  { id: 'f_foyer_diamond_case', type: 'broken_diamond_case', x: -10.8, z: 4.2, w: 1.2, d: 1.2, rot: 0, solid: true },
  { id: 'f_foyer_screen', type: 'folding_screen', x: -2.6, z: 3.2, w: 1.6, d: 0.8, rot: -0.4, solid: true },
  { id: 'f_foyer_carpet', type: 'rug', x: -7.0, z: 7.0, w: 6.2, d: 8.5, rot: 0, solid: false, color: '#7f1d1d' },

  // Salone delle Feste (X: -1..12, Z: +1..+13)
  { id: 'f_salon_piano', type: 'grand_piano', x: 9.0, z: 10.0, w: 2.6, d: 2.4, rot: -0.5, solid: true },
  { id: 'f_salon_sofa1', type: 'sofa', x: 3.5, z: 5.2, w: 3.2, d: 1.3, rot: 0, solid: true, color: '#7c2d12' },
  { id: 'f_salon_sofa2', type: 'sofa', x: 3.5, z: 8.8, w: 3.2, d: 1.3, rot: Math.PI, solid: true, color: '#7c2d12' },
  { id: 'f_salon_table', type: 'coffee_table', x: 3.5, z: 7.0, w: 2.0, d: 1.1, rot: 0, solid: true },
  { id: 'f_salon_screen', type: 'folding_screen', x: 10.2, z: 3.2, w: 1.8, d: 0.9, rot: 0.4, solid: true },
  { id: 'f_salon_rug', type: 'rug', x: 4.2, z: 7.0, w: 6.8, d: 6.2, rot: 0, solid: false, color: '#581c2c' },

  // Cucina & Sala da Pranzo (X: 12..24, Z: +1..+13)
  { id: 'f_kit_island', type: 'kitchen_island', x: 20.2, z: 4.8, w: 3.2, d: 1.6, rot: 0, solid: true },
  { id: 'f_kit_counters', type: 'kitchen_counter', x: 22.8, z: 6.5, w: 1.2, d: 6.8, rot: 0, solid: true },
  { id: 'f_kit_dining', type: 'dining_table', x: 15.6, z: 9.6, w: 3.8, d: 2.0, rot: 0, solid: true },
  { id: 'f_kit_pantry', type: 'cabinet', x: 14.0, z: 2.4, w: 1.8, d: 1.1, rot: 0, solid: true },

  // Outdoor: Area Piscina (X: -34..-24)
  { id: 'f_pool_water', type: 'swimming_pool', x: -29.2, z: 1.5, w: 5.0, d: 12.0, rot: 0, solid: true },
  { id: 'f_pool_lounger1', type: 'lounger', x: -25.6, z: 9.8, w: 1.1, d: 2.1, rot: 0, solid: true },
  { id: 'f_pool_lounger2', type: 'lounger', x: -28.0, z: 9.8, w: 1.1, d: 2.1, rot: 0, solid: true },
  { id: 'f_pool_filter', type: 'pool_filter', x: -31.5, z: -11.5, w: 1.8, d: 1.5, rot: 0, solid: true },

  // Outdoor: Retro-Villa & Gazebo (Z: -27..-15)
  { id: 'f_back_gazebo', type: 'gazebo', x: -15.5, z: -21.5, w: 4.4, d: 4.4, rot: 0, solid: false },
  { id: 'f_back_hedge1', type: 'hedge', x: -4.5, z: -21.5, w: 5.0, d: 1.4, rot: 0, solid: true },
  { id: 'f_back_hedge2', type: 'hedge', x: 13.5, z: -20.5, w: 5.2, d: 1.4, rot: 0, solid: true },

  // Outdoor: Giardino Frontale & Fontana (Z: +13..+27)
  { id: 'f_front_fountain', type: 'fountain', x: -7.0, z: 19.8, w: 4.2, d: 4.2, rot: 0, solid: true },
  { id: 'f_front_statue', type: 'garden_statue', x: 10.5, z: 19.5, w: 1.6, d: 1.6, rot: 0, solid: true },
  { id: 'f_front_hedge1', type: 'hedge', x: -18.5, z: 18.5, w: 4.8, d: 1.4, rot: 0, solid: true },
  { id: 'f_front_hedge2', type: 'hedge', x: 2.5, z: 21.5, w: 4.8, d: 1.4, rot: 0, solid: true },

  // Outdoor: Vialetto Orientale (X: +24..+34)
  { id: 'f_east_power', type: 'power_panel', x: 25.0, z: 5.5, w: 1.0, d: 1.6, rot: 0, solid: true },
  { id: 'f_east_hedge', type: 'hedge', x: 30.2, z: -6.5, w: 1.5, d: 5.0, rot: 0, solid: true },
];

// Emergency Meeting Button in Atrio d'Ingresso
export const EMERGENCY_BUTTON = {
  x: -7.0,
  z: 6.8,
  radius: 2.6,
  room: 'foyer',
  label: 'Pulsante d’Emergenza (Riunione Plenaria)',
};

// Broken Main Diamond Case ("La Stella di Venezia") in Atrio
export const BROKEN_DIAMOND_CASE = {
  x: -10.8,
  z: 4.2,
  room: 'foyer',
  name: 'Teca Infranta: "Stella di Venezia"',
};

// 12 Minor Jewels scattered around the Villa & Grounds (Thief wins at 8 stolen!)
export const JEWEL_QUOTA_TO_WIN = 8;

export const JEWELS = [
  { id: 'j_tiara', name: 'Tiara di Rubini', value: 45000, x: -22.2, z: -7.5, room: 'master_bedroom' },
  { id: 'j_pearl', name: 'Collana di Perle Nere', value: 38000, x: -4.8, z: -10.0, room: 'bathroom' },
  { id: 'j_watch', name: 'Cronografo Imperiale', value: 52000, x: 3.5, z: -9.2, room: 'study' },
  { id: 'j_brooch', name: 'Spilla di Smeraldo', value: 34000, x: -12.5, z: -3.2, room: 'corridor_west' },
  { id: 'j_ring', name: 'Anello Zaffiro Reale', value: 49000, x: -18.5, z: 10.8, room: 'guest_bedroom' },
  { id: 'j_earrings', name: 'Pendenti di Diamanti', value: 41000, x: 8.2, z: 9.0, room: 'salon' },
  { id: 'j_goblet', name: 'Calice d’Oro Rinascimentale', value: 60000, x: 15.6, z: 8.2, room: 'kitchen' },
  { id: 'j_bracelet', name: 'Bracciale Tennis Platino', value: 37000, x: -26.2, z: 9.8, room: 'pool_area' },
  { id: 'j_locket', name: 'Medaglione Antico', value: 33000, x: -15.5, z: -19.5, room: 'backyard' },
  { id: 'j_cufflinks', name: 'Gemelli Fabergé', value: 44000, x: 11.5, z: -3.2, room: 'corridor_east' },
  { id: 'j_crown_pin', name: 'Fermaglio della Contessa', value: 39000, x: 8.8, z: 19.5, room: 'front_garden' },
  { id: 'j_anklet', name: 'Catena d’Oro Veneziana', value: 36000, x: 28.5, z: 2.0, room: 'east_garden' },
];

// 4 Dead-Drops where the Thief can hide/move the Main Diamond ("La Stella di Venezia")
export const DIAMOND_HIDING_SPOTS = [
  { id: 'ds_study_safe', name: 'Cassaforte Segreta Studio', x: 8.5, z: -13.2, room: 'study' },
  { id: 'ds_guest_trunk', name: 'Doppiofondo Baule Ospiti', x: -15.0, z: 10.3, room: 'guest_bedroom' },
  { id: 'ds_pool_filter', name: 'Vano Tecnico Piscina', x: -30.2, z: -11.5, room: 'pool_area' },
  { id: 'ds_garden_statue', name: 'Piedistallo Statua Giardino', x: 10.5, z: 18.0, room: 'front_garden' },
];

// 4 Interconnected Secret Passages exclusive to the Thief
export const SECRET_PASSAGES = [
  {
    id: 'sp_master',
    name: 'Armadio a Doppiofondo (Cam. Padronale)',
    x: -14.2,
    z: -12.6,
    room: 'master_bedroom',
    targets: ['sp_study', 'sp_gazebo', 'sp_kitchen'],
  },
  {
    id: 'sp_study',
    name: 'Libreria Girevole (Studio)',
    x: -0.8,
    z: -11.5,
    room: 'study',
    targets: ['sp_master', 'sp_kitchen', 'sp_gazebo'],
  },
  {
    id: 'sp_kitchen',
    name: 'Botola Cantina Vini (Cucina)',
    x: 21.2,
    z: 11.4,
    room: 'kitchen',
    targets: ['sp_study', 'sp_master', 'sp_gazebo'],
  },
  {
    id: 'sp_gazebo',
    name: 'Botola Antica sotto il Gazebo (Retro-Villa)',
    x: -15.5,
    z: -21.5,
    room: 'backyard',
    targets: ['sp_master', 'sp_study', 'sp_kitchen'],
  },
];

// Hiding Spots (Zone di Occultamento) usable by both Civilians & Thief
export const HIDING_SPOTS = [
  { id: 'hide_master_wardrobe', name: 'Armadio Mogano', x: -14.2, z: -12.7, room: 'master_bedroom' },
  { id: 'hide_bath_cabinet', name: 'Armadietto Spa', x: -10.0, z: -6.5, room: 'bathroom' },
  { id: 'hide_guest_wardrobe', name: 'Guardaroba Ospiti', x: -21.5, z: 3.5, room: 'guest_bedroom' },
  { id: 'hide_foyer_screen', name: 'Paravento di Seta Atrio', x: -3.2, z: 3.6, room: 'foyer' },
  { id: 'hide_salon_screen', name: 'Paravento Dorato Salone', x: 9.6, z: 3.6, room: 'salon' },
  { id: 'hide_kitchen_pantry', name: 'Dispensa Cucina', x: 14.0, z: 3.4, room: 'kitchen' },
  { id: 'hide_back_hedge', name: 'Siepe Folta Retro-Villa', x: -4.5, z: -19.8, room: 'backyard' },
  { id: 'hide_front_hedge', name: 'Siepe Monumentale Sud', x: -18.5, z: 16.9, room: 'front_garden' },
];

// 6 Live CCTV Security Cameras + Surveillance Control Station
export const CCTV_STATION = {
  x: 17.5,
  z: -11.4,
  radius: 2.5,
  room: 'security',
  label: 'Console Monitor CCTV',
};

export const SABOTAGE_REPAIR_POINTS = [
  { id: 'rep_sec_panel', name: 'Centralina Sicurezza & CCTV', x: 21.5, z: -7.5, room: 'security' },
  { id: 'rep_east_panel', name: 'Quadro Elettrico Esterno', x: 26.2, z: 5.5, room: 'east_garden' },
];

export const CCTV_CAMERAS = [
  {
    id: 'cam_foyer',
    code: 'CAM 01',
    name: 'Atrio & Teca Centrale',
    room: 'foyer',
    pos: { x: -12.2, y: 4.3, z: 12.2 },
    lookAt: { x: -6.5, y: 1.0, z: 5.0 },
    fov: 58,
    detectRadius: 9.5,
  },
  {
    id: 'cam_salon',
    code: 'CAM 02',
    name: 'Salone delle Feste',
    room: 'salon',
    pos: { x: 0.0, y: 4.3, z: 1.8 },
    lookAt: { x: 6.5, y: 1.0, z: 8.5 },
    fov: 58,
    detectRadius: 10.0,
  },
  {
    id: 'cam_study',
    code: 'CAM 03',
    name: 'Studio Privato',
    room: 'study',
    pos: { x: 10.2, y: 4.3, z: -5.8 },
    lookAt: { x: 2.5, y: 1.0, z: -11.2 },
    fov: 58,
    detectRadius: 9.5,
  },
  {
    id: 'cam_corridor',
    code: 'CAM 04',
    name: 'Galleria Ovest & Camere',
    room: 'corridor_west',
    pos: { x: -7.5, y: 4.2, z: -4.4 },
    lookAt: { x: -18.5, y: 1.0, z: -1.8 },
    fov: 60,
    detectRadius: 11.5,
  },
  {
    id: 'cam_kitchen',
    code: 'CAM 05',
    name: 'Cucina & Cantina',
    room: 'kitchen',
    pos: { x: 12.8, y: 4.3, z: 1.8 },
    lookAt: { x: 19.2, y: 1.0, z: 8.8 },
    fov: 58,
    detectRadius: 9.5,
  },
  {
    id: 'cam_pool_back',
    code: 'CAM 06',
    name: 'Piscina & Retro-Villa Ovest',
    room: 'backyard',
    pos: { x: -23.5, y: 4.6, z: -14.8 },
    lookAt: { x: -17.5, y: 1.0, z: -20.5 },
    fov: 62,
    detectRadius: 11.5,
  },
];

// Civilian Security Tasks (also available as Fake Tasks for the Thief to blend in!)
export const TASKS = [
  { id: 't_guestbook', name: 'Verifica Registro Ospiti', x: 3.5, z: -8.6, room: 'study', duration: 3.0 },
  { id: 't_foyer_case', name: 'Analizza Impronte Teca Infranta', x: -9.5, z: 4.2, room: 'foyer', duration: 3.2 },
  { id: 't_piano_check', name: 'Controlla Cofanetto Pianoforte', x: 7.4, z: 9.8, room: 'salon', duration: 2.8 },
  { id: 't_wine_inv', name: 'Inventario Cantina Pregiata', x: 18.6, z: 4.8, room: 'kitchen', duration: 3.0 },
  { id: 't_master_safe', name: 'Ispeziona Serratura Suite', x: -18.2, z: -11.5, room: 'master_bedroom', duration: 3.0 },
  { id: 't_bath_vent', name: 'Controlla Grata Aerazione Spa', x: -7.5, z: -11.2, room: 'bathroom', duration: 2.6 },
  { id: 't_guest_luggage', name: 'Verifica Bagagli Camera Ospiti', x: -16.8, z: 8.5, room: 'guest_bedroom', duration: 2.8 },
  { id: 't_cctv_calib', name: 'Sincronizza Frequenze CCTV', x: 15.5, z: -11.4, room: 'security', duration: 3.2 },
  { id: 't_pool_lights', name: 'Attiva Fari Subacquei Piscina', x: -25.8, z: 4.0, room: 'pool_area', duration: 2.8 },
  { id: 't_gate_lock', name: 'Blindatura Cancello Principale', x: -7.0, z: 24.5, room: 'front_garden', duration: 3.2 },
  { id: 't_gazebo_scan', name: 'Ispeziona Pavimento Gazebo', x: -13.5, z: -19.5, room: 'backyard', duration: 3.0 },
  { id: 't_east_sensors', name: 'Calibra Sensori Infrarossi Est', x: 26.5, z: -2.0, room: 'east_garden', duration: 2.8 },
];

// Waypoint Navigation Graph so AI Suspects move cleanly through doorways & around furniture
export const NAV_NODES = {
  // Corridors
  cw_west: { x: -21.5, z: -2.0 },
  cw_mid: { x: -18.0, z: -2.0 },
  cw_bath: { x: -7.5, z: -2.0 },
  cc_mid: { x: -1.0, z: -2.0 },
  cc_study: { x: 4.0, z: -2.0 },
  ce_mid: { x: 12.0, z: -2.0 },
  ce_east: { x: 17.5, z: -2.0 },
  ce_door: { x: 21.8, z: -2.0 },

  // Rooms
  r_master_entry: { x: -18.0, z: -7.2 },
  r_master_deep: { x: -16.0, z: -11.0 },
  r_bath_center: { x: -7.5, z: -8.5 },
  r_study_entry: { x: 4.0, z: -7.2 },
  r_study_east: { x: 6.6, z: -10.2 },
  r_study_north: { x: 4.0, z: -13.0 },
  r_sec_entry: { x: 17.5, z: -7.5 },
  r_sec_desk: { x: 17.5, z: -11.2 },

  r_guest_entry: { x: -18.5, z: 3.5 },
  r_guest_deep: { x: -17.0, z: 6.8 },
  r_foyer_north: { x: -7.0, z: 3.2 },
  r_foyer_south: { x: -7.0, z: 10.5 },
  r_foyer_east: { x: -3.2, z: 7.0 },
  r_salon_west: { x: 0.8, z: 7.0 },
  r_salon_north: { x: 5.5, z: 2.8 },
  r_salon_east: { x: 6.8, z: 6.8 },
  r_salon_south: { x: 5.5, z: 11.3 },
  r_kitchen_north: { x: 17.2, z: 3.2 },
  r_kitchen_mid: { x: 16.5, z: 6.8 },
  r_kitchen_south: { x: 20.2, z: 11.2 },

  // Outdoor Ring
  out_pool_door: { x: -25.8, z: -2.0 },
  out_pool_south: { x: -25.8, z: 11.5 },
  out_pool_north: { x: -26.5, z: -15.5 },
  out_back_west: { x: -15.5, z: -18.2 },
  out_back_mid: { x: 4.0, z: -17.5 },
  out_back_east: { x: 22.0, z: -17.5 },
  out_east_north: { x: 27.5, z: -11.0 },
  out_east_door: { x: 26.5, z: -2.0 },
  out_east_south: { x: 27.5, z: 11.5 },
  out_front_east: { x: 14.0, z: 16.5 },
  out_front_salon: { x: 5.5, z: 15.8 },
  out_front_foyer: { x: -7.0, z: 15.8 },
  out_front_gate: { x: -7.0, z: 24.2 },
  out_front_west: { x: -21.0, z: 16.2 },
};

export const NAV_EDGES = [
  ['cw_west', 'cw_mid'],
  ['cw_mid', 'cw_bath'],
  ['cw_bath', 'cc_mid'],
  ['cc_mid', 'cc_study'],
  ['cc_study', 'ce_mid'],
  ['ce_mid', 'ce_east'],
  ['ce_east', 'ce_door'],

  // Master & Bath
  ['cw_mid', 'r_master_entry'],
  ['r_master_entry', 'r_master_deep'],
  ['cw_bath', 'r_bath_center'],
  ['r_master_deep', 'r_bath_center'],

  // Study & Security
  ['cc_study', 'r_study_entry'],
  ['r_study_entry', 'r_study_east'],
  ['r_study_east', 'r_study_north'],
  ['ce_east', 'r_sec_entry'],
  ['r_sec_entry', 'r_sec_desk'],
  ['r_study_east', 'r_sec_desk'],

  // South rooms
  ['cw_mid', 'r_guest_entry'],
  ['r_guest_entry', 'r_guest_deep'],
  ['cw_bath', 'r_foyer_north'],
  ['cc_mid', 'r_foyer_north'],
  ['r_foyer_north', 'r_foyer_east'],
  ['r_foyer_east', 'r_foyer_south'],
  ['r_foyer_east', 'r_salon_west'],
  ['cc_study', 'r_salon_north'],
  ['r_salon_north', 'r_salon_east'],
  ['r_salon_west', 'r_salon_north'],
  ['r_salon_east', 'r_salon_south'],
  ['ce_east', 'r_kitchen_north'],
  ['r_kitchen_north', 'r_kitchen_mid'],
  ['r_kitchen_mid', 'r_kitchen_south'],
  ['r_salon_east', 'r_kitchen_mid'],

  // Indoor <-> Outdoor Doors
  ['cw_west', 'out_pool_door'],
  ['r_study_north', 'out_back_mid'],
  ['ce_door', 'out_east_door'],
  ['r_foyer_south', 'out_front_foyer'],
  ['r_salon_south', 'out_front_salon'],

  // Outdoor Perimeter Loop
  ['out_pool_door', 'out_pool_north'],
  ['out_pool_door', 'out_pool_south'],
  ['out_pool_north', 'out_back_west'],
  ['out_back_west', 'out_back_mid'],
  ['out_back_mid', 'out_back_east'],
  ['out_back_east', 'out_east_north'],
  ['out_east_north', 'out_east_door'],
  ['out_east_door', 'out_east_south'],
  ['out_east_south', 'out_front_east'],
  ['out_front_east', 'out_front_salon'],
  ['out_front_salon', 'out_front_foyer'],
  ['out_front_foyer', 'out_front_gate'],
  ['out_front_foyer', 'out_front_west'],
  ['out_front_west', 'out_pool_south'],
];

export function getRoomAt(x, z) {
  for (const room of ROOMS) {
    const b = room.bounds;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
      return room;
    }
  }
  return { id: 'grounds', name: 'Giardino della Villa', shortName: 'Esterno', indoor: false, wing: 'outdoor' };
}
