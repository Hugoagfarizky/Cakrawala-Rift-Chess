export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type GameMode = 'RIFT_TACTICS' | 'FOG_OF_WAR' | 'QUANTUM_SHIFT';

export type Difficulty = 'NOVICE' | 'TACTICIAN' | 'GRANDMASTER';

export type OpponentType = 'AI' | 'LOCAL_2P';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

/**
 * Soul Trait absorbed when a piece captures an enemy piece:
 * - KNIGHT_LEAP: Absorbed from a Knight ('n'). Allows the piece to also make Knight L-jumps (non-capturing or capturing).
 * - PHANTOM_STEP: Absorbed from a Bishop ('b') or Pawn ('p'). Allows 1-tile diagonal & orthogonal step in any direction.
 * - EMBER_STRIKE: Absorbed from a Rook ('r') or Queen ('q'). Attacks pierce enemy Armor/Shields instantly!
 */
export type SoulTrait = 'NONE' | 'KNIGHT_LEAP' | 'PHANTOM_STEP' | 'EMBER_STRIKE';

/**
 * Elemental Terrain Tiles on the 8x8 board:
 * - NORMAL: Standard obsidian/slate tile
 * - RIFT_A / RIFT_B: Paired Void Portals. Moving onto one teleports the piece to its twin if unoccupied!
 * - AETHER_WELL: Generates +1 bonus Aether Mana each turn when occupied, and grants +1 Armor on entry (once per piece).
 * - SANCTUARY: Emerald Mist. Pieces on this tile cannot be captured from > 2 tiles away (immune to long-range snipes).
 * - EMBER_FORGE: Crimson Magma. Pieces attacking from this tile deal Piercing Strike (destroys armored pieces in 1 hit).
 */
export type TileTerrain =
  | 'NORMAL'
  | 'RIFT_A'
  | 'RIFT_B'
  | 'AETHER_WELL'
  | 'SANCTUARY'
  | 'EMBER_FORGE';

export type SpellId = 'AETHER_SHIELD' | 'CHRONO_FREEZE' | 'QUANTUM_SWAP' | 'TECTONIC_SHIFT';

export interface Piece {
  id: string;
  type: PieceType;
  color: PieceColor;
  armor: number; // 0 = unarmored (1 hit to capture), 1+ = shielded (absorbs hit and attacker recoils)
  maxArmor: number;
  soulTrait: SoulTrait;
  frozenTurns: number; // > 0 means frozen by Chrono Freeze
  kills: number;
  hasMoved?: boolean;
  wellCharged?: boolean;
}

export interface Coord {
  r: number; // 0..7 (0 is top/black rank 8, 7 is bottom/white rank 1)
  c: number; // 0..7 (0 is file a, 7 is file h)
}

export interface LegalMove {
  from: Coord;
  to: Coord;
  isCapture: boolean;
  isShieldStrike: boolean; // True if target has armor > 0 and attack is not piercing
  isPiercing: boolean; // True if attacker is on EMBER_FORGE or has EMBER_STRIKE
  isRiftTeleport: boolean; // True if landing on a Rift portal teleports to the twin Rift
  teleportDest?: Coord;
  fromSoulTrait?: boolean; // True if move was unlocked by KNIGHT_LEAP or PHANTOM_STEP
  promotion?: PieceType;
}

export interface CombatEvent {
  id: string;
  turnNumber: number;
  color: PieceColor;
  text: string;
  kind: 'MOVE' | 'CAPTURE' | 'SHIELD_BREAK' | 'TELEPORT' | 'SPELL' | 'SHIFT' | 'CHECK';
}

export interface SpellDefinition {
  id: SpellId;
  name: string;
  cost: number;
  hotkey: string;
  shortDesc: string;
  targetRule: 'FRIENDLY_PIECE' | 'ENEMY_NON_KING' | 'TWO_FRIENDLY' | 'INSTANT_BOARD';
}

export const SPELLS: SpellDefinition[] = [
  {
    id: 'AETHER_SHIELD',
    name: 'Perisai Kristal',
    cost: 2,
    hotkey: '1',
    shortDesc: 'Beri +1 Perisai pada bidak kawan (menahan 1x serangan lawan).',
    targetRule: 'FRIENDLY_PIECE',
  },
  {
    id: 'CHRONO_FREEZE',
    name: 'Bekukan Waktu',
    cost: 3,
    hotkey: '2',
    shortDesc: 'Bekukan 1 bidak lawan (selain Raja) selama 1 putaran penuh.',
    targetRule: 'ENEMY_NON_KING',
  },
  {
    id: 'QUANTUM_SWAP',
    name: 'Tukar Kuantum',
    cost: 3,
    hotkey: '3',
    shortDesc: 'Tukar posisi 2 bidak kawan (selain Raja) secara instan tanpa makan giliran.',
    targetRule: 'TWO_FRIENDLY',
  },
  {
    id: 'TECTONIC_SHIFT',
    name: 'Gempa Cakrawala',
    cost: 4,
    hotkey: '4',
    shortDesc: 'Ubah posisi petak elemen di tengah papan & beri +1 Perisai ke Raja Anda.',
    targetRule: 'INSTANT_BOARD',
  },
];

export const PIECE_NAMES_ID: Record<PieceType, string> = {
  p: 'Pion',
  n: 'Kuda',
  b: 'Gajah',
  r: 'Benteng',
  q: 'Menteri',
  k: 'Raja',
};

export const SOUL_TRAIT_INFO: Record<
  SoulTrait,
  { name: string; badge: string; color: string; desc: string }
> = {
  NONE: {
    name: 'Murni',
    badge: '',
    color: '#94A3B8',
    desc: 'Belum menyerap jiwa bidak lawan.',
  },
  KNIGHT_LEAP: {
    name: 'Jiwa Kuda',
    badge: 'L-Leap',
    color: '#38BDF8',
    desc: 'Dapat melompat huruf L seperti Kuda selain gerak aslinya.',
  },
  PHANTOM_STEP: {
    name: 'Langkah Bayangan',
    badge: 'Phantom',
    color: '#A855F7',
    desc: 'Dapat bergeser 1 petak ke segala arah (8 arah sekitar).',
  },
  EMBER_STRIKE: {
    name: 'Tombak Bara',
    badge: 'Pierce',
    color: '#F97316',
    desc: 'Serangan menembus Perisai lawan (langsung mengalahkan bidak berperisai).',
  },
};

export const TERRAIN_INFO: Record<
  TileTerrain,
  { name: string; short: string; color: string; desc: string }
> = {
  NORMAL: {
    name: 'Dataran Obsidian',
    short: 'Normal',
    color: '#334155',
    desc: 'Petak standar tanpa efek elemen khusus.',
  },
  RIFT_A: {
    name: 'Portal Rift Alpha',
    short: 'Rift α',
    color: '#C084FC',
    desc: 'Berhenti di sini langsung memindahkan bidak ke Portal Rift Beta jika kosong.',
  },
  RIFT_B: {
    name: 'Portal Rift Beta',
    short: 'Rift β',
    color: '#C084FC',
    desc: 'Berhenti di sini langsung memindahkan bidak ke Portal Rift Alpha jika kosong.',
  },
  AETHER_WELL: {
    name: 'Sumur Aether',
    short: '+Aether',
    color: '#38BDF8',
    desc: 'Memberi +1 Energi Aether tiap giliran & +1 Perisai saat pertama kali ditempati.',
  },
  SANCTUARY: {
    name: 'Hutan Lindung',
    short: 'Lindung',
    color: '#34D399',
    desc: 'Bidak di petak ini kebal terhadap serangan jarak jauh (> 2 petak).',
  },
  EMBER_FORGE: {
    name: 'Kawah Bara',
    short: 'Penembus',
    color: '#FB7185',
    desc: 'Bidak yang menyerang dari petak ini menembus Perisai lawan dalam 1 serangan.',
  },
};
