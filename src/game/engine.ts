import {
  Coord,
  Difficulty,
  GameMode,
  LegalMove,
  Piece,
  PieceColor,
  PieceType,
  SoulTrait,
  SpellId,
  TileTerrain,
} from './types';

export interface BoardState {
  grid: (Piece | null)[][];
  terrain: TileTerrain[][];
  turn: PieceColor;
  turnNumber: number;
  aether: Record<PieceColor, number>;
  maxAether: number;
  capturedBy: Record<PieceColor, Piece[]>;
  winner: PieceColor | 'DRAW' | null;
  winReason: string | null;
  inCheck: Record<PieceColor, boolean>;
}

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

export function createInitialTerrain(mode: GameMode): TileTerrain[][] {
  const t: TileTerrain[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => 'NORMAL' as TileTerrain)
  );

  // Symmetric tactical terrain in middle ranks (rows 2..5)
  // Rift portals on flanks/diagonals
  t[3][1] = 'RIFT_A';
  t[4][6] = 'RIFT_B';

  // Aether Wells in central contested zones
  t[3][3] = 'AETHER_WELL';
  t[4][4] = 'AETHER_WELL';

  // Sanctuary tiles (immune to long-range snipes > 2 tiles)
  t[2][4] = 'SANCTUARY';
  t[5][3] = 'SANCTUARY';

  // Ember Forges (piercing attacks)
  t[3][5] = 'EMBER_FORGE';
  t[4][2] = 'EMBER_FORGE';

  if (mode === 'QUANTUM_SHIFT') {
    t[2][2] = 'AETHER_WELL';
    t[5][5] = 'AETHER_WELL';
  }

  return t;
}

export function createInitialBoard(mode: GameMode): BoardState {
  const grid: (Piece | null)[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null)
  );

  const backRank: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  const makePiece = (type: PieceType, color: PieceColor, r: number, c: number): Piece => {
    const isHeavy = type === 'r' || type === 'q' || type === 'k';
    return {
      id: `${color}-${type}-${r}-${c}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      color,
      armor: isHeavy ? 1 : 0,
      maxArmor: isHeavy ? 2 : 1,
      soulTrait: 'NONE',
      frozenTurns: 0,
      kills: 0,
      hasMoved: false,
      wellCharged: false,
    };
  };

  for (let c = 0; c < 8; c++) {
    grid[0][c] = makePiece(backRank[c], 'b', 0, c);
    grid[1][c] = makePiece('p', 'b', 1, c);
    grid[6][c] = makePiece('p', 'w', 6, c);
    grid[7][c] = makePiece(backRank[c], 'w', 7, c);
  }

  return {
    grid,
    terrain: createInitialTerrain(mode),
    turn: 'w',
    turnNumber: 1,
    aether: { w: 2, b: 2 },
    maxAether: 10,
    capturedBy: { w: [], b: [] },
    winner: null,
    winReason: null,
    inCheck: { w: false, b: false },
  };
}

export function cloneBoard(state: BoardState): BoardState {
  return {
    grid: state.grid.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    terrain: state.terrain.map((row) => [...row]),
    turn: state.turn,
    turnNumber: state.turnNumber,
    aether: { ...state.aether },
    maxAether: state.maxAether,
    capturedBy: {
      w: state.capturedBy.w.map((p) => ({ ...p })),
      b: state.capturedBy.b.map((p) => ({ ...p })),
    },
    winner: state.winner,
    winReason: state.winReason,
    inCheck: { ...state.inCheck },
  };
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function chebyshevDist(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
}

export function findTerrainCoord(terrain: TileTerrain[][], kind: TileTerrain): Coord | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (terrain[r][c] === kind) return { r, c };
    }
  }
  return null;
}

export function getSoulFromVictim(victimType: PieceType): SoulTrait {
  if (victimType === 'n') return 'KNIGHT_LEAP';
  if (victimType === 'b' || victimType === 'p') return 'PHANTOM_STEP';
  if (victimType === 'r' || victimType === 'q') return 'EMBER_STRIKE';
  return 'EMBER_STRIKE';
}

export function getLegalMovesForPiece(
  state: BoardState,
  from: Coord
): LegalMove[] {
  const piece = state.grid[from.r][from.c];
  if (!piece || piece.frozenTurns > 0) return [];

  const moves: LegalMove[] = [];
  const addedKeys = new Set<string>();

  const attackerOnEmber = state.terrain[from.r][from.c] === 'EMBER_FORGE';
  const isPiercing = attackerOnEmber || piece.soulTrait === 'EMBER_STRIKE';

  const tryAddMove = (
    toR: number,
    toC: number,
    options: { canMoveEmpty?: boolean; canCapture?: boolean; fromSoulTrait?: boolean } = {}
  ): boolean => {
    const { canMoveEmpty = true, canCapture = true, fromSoulTrait = false } = options;
    if (!inBounds(toR, toC)) return false;

    const key = `${toR},${toC}`;
    const target = state.grid[toR][toC];
    const destTerrain = state.terrain[toR][toC];

    if (!target) {
      if (canMoveEmpty && !addedKeys.has(key)) {
        addedKeys.add(key);
        let isRiftTeleport = false;
        let teleportDest: Coord | undefined;

        if (destTerrain === 'RIFT_A' || destTerrain === 'RIFT_B') {
          const twinKind = destTerrain === 'RIFT_A' ? 'RIFT_B' : 'RIFT_A';
          const twinCoord = findTerrainCoord(state.terrain, twinKind);
          if (twinCoord && !state.grid[twinCoord.r][twinCoord.c]) {
            isRiftTeleport = true;
            teleportDest = twinCoord;
          }
        }

        const finalRow = isRiftTeleport && teleportDest ? teleportDest.r : toR;
        const promotion =
          piece.type === 'p' && ((piece.color === 'w' && finalRow === 0) || (piece.color === 'b' && finalRow === 7))
            ? 'q'
            : undefined;

        moves.push({
          from,
          to: { r: toR, c: toC },
          isCapture: false,
          isShieldStrike: false,
          isPiercing,
          isRiftTeleport,
          teleportDest,
          fromSoulTrait,
          promotion,
        });
      }
      return true; // Path continues for sliding pieces
    }

    // Occupied square
    if (target.color !== piece.color && canCapture) {
      // Check Sanctuary protection: immune if Chebyshev distance > 2
      const dist = chebyshevDist(from, { r: toR, c: toC });
      if (destTerrain === 'SANCTUARY' && dist > 2) {
        return false; // Blocked by Sanctuary mist!
      }

      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        const isShieldStrike = target.armor > 0 && !isPiercing;
        const promotion =
          !isShieldStrike &&
          piece.type === 'p' &&
          ((piece.color === 'w' && toR === 0) || (piece.color === 'b' && toR === 7))
            ? 'q'
            : undefined;

        moves.push({
          from,
          to: { r: toR, c: toC },
          isCapture: true,
          isShieldStrike,
          isPiercing,
          isRiftTeleport: false,
          fromSoulTrait,
          promotion,
        });
      }
    }

    return false; // Sliding stops at any piece
  };

  const slideDirs = (dirs: [number, number][]) => {
    for (const [dr, dc] of dirs) {
      let r = from.r + dr;
      let c = from.c + dc;
      while (inBounds(r, c)) {
        const cont = tryAddMove(r, c);
        if (!cont) break;
        r += dr;
        c += dc;
      }
    }
  };

  const stepDirs = (dirs: [number, number][], fromSoul = false) => {
    for (const [dr, dc] of dirs) {
      tryAddMove(from.r + dr, from.c + dc, { fromSoulTrait: fromSoul });
    }
  };

  // Standard Piece Movement
  switch (piece.type) {
    case 'p': {
      const dir = piece.color === 'w' ? -1 : 1;
      const startRank = piece.color === 'w' ? 6 : 1;
      // 1 step forward
      if (inBounds(from.r + dir, from.c) && !state.grid[from.r + dir][from.c]) {
        tryAddMove(from.r + dir, from.c, { canMoveEmpty: true, canCapture: false });
        // 2 steps from start
        if (from.r === startRank && inBounds(from.r + dir * 2, from.c) && !state.grid[from.r + dir * 2][from.c]) {
          tryAddMove(from.r + dir * 2, from.c, { canMoveEmpty: true, canCapture: false });
        }
      }
      // Diagonal captures
      tryAddMove(from.r + dir, from.c - 1, { canMoveEmpty: false, canCapture: true });
      tryAddMove(from.r + dir, from.c + 1, { canMoveEmpty: false, canCapture: true });
      break;
    }
    case 'n': {
      stepDirs([
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ]);
      break;
    }
    case 'b': {
      slideDirs([
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]);
      break;
    }
    case 'r': {
      slideDirs([
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]);
      break;
    }
    case 'q': {
      slideDirs([
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]);
      break;
    }
    case 'k': {
      stepDirs([
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]);
      break;
    }
  }

  // Soul Trait Bonus Movements!
  if (piece.soulTrait === 'KNIGHT_LEAP' && piece.type !== 'n') {
    stepDirs(
      [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ],
      true
    );
  } else if (piece.soulTrait === 'PHANTOM_STEP' && piece.type !== 'k') {
    stepDirs(
      [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ],
      true
    );
  }

  return moves;
}

export function getAllLegalMoves(state: BoardState, color: PieceColor): LegalMove[] {
  const all: LegalMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.grid[r][c];
      if (p && p.color === color) {
        all.push(...getLegalMovesForPiece(state, { r, c }));
      }
    }
  }
  return all;
}

export function isKingThreatened(state: BoardState, kingColor: PieceColor): boolean {
  let kingPos: Coord | null = null;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.grid[r][c];
      if (p && p.color === kingColor && p.type === 'k') {
        kingPos = { r, c };
        break;
      }
    }
  }
  if (!kingPos) return true;

  const enemyColor: PieceColor = kingColor === 'w' ? 'b' : 'w';
  const enemyMoves = getAllLegalMoves(state, enemyColor);
  return enemyMoves.some((m) => m.to.r === kingPos!.r && m.to.c === kingPos!.c);
}

export interface MoveExecutionResult {
  nextState: BoardState;
  logText: string;
  logKind: 'MOVE' | 'CAPTURE' | 'SHIELD_BREAK' | 'TELEPORT' | 'SHIFT' | 'CHECK';
  impactCoord: Coord;
  recoilCoord?: Coord;
  absorbedSoul?: SoulTrait;
  triggeredShift?: boolean;
}

const FILE_CHARS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export function coordToAlgebraic(c: Coord): string {
  return `${FILE_CHARS[c.c]}${8 - c.r}`;
}

export function executeMove(
  currentState: BoardState,
  move: LegalMove,
  mode: GameMode
): MoveExecutionResult {
  const next = cloneBoard(currentState);
  const attacker = next.grid[move.from.r][move.from.c]!;
  const target = next.grid[move.to.r][move.to.c];

  attacker.hasMoved = true;

  let logText = '';
  let logKind: MoveExecutionResult['logKind'] = 'MOVE';
  let impactCoord: Coord = move.to;
  let recoilCoord: Coord | undefined;
  let absorbedSoul: SoulTrait | undefined;

  if (move.isCapture && target) {
    if (move.isShieldStrike) {
      // Target has Armor > 0 and attack is not piercing!
      // Strip 1 armor; attacker recoils back to its origin (or adjacent square along ray)
      target.armor = Math.max(0, target.armor - 1);
      logKind = 'SHIELD_BREAK';
      recoilCoord = move.from;
      next.aether[attacker.color] = Math.min(next.maxAether, next.aether[attacker.color] + 1);
      logText = `Perisai Hancur! ${coordToAlgebraic(move.from)} menghantam perisai di ${coordToAlgebraic(move.to)}.`;
    } else {
      // Lethal capture!
      next.capturedBy[attacker.color].push({ ...target });
      attacker.kills += 1;

      const newSoul = getSoulFromVictim(target.type);
      if (attacker.soulTrait === 'NONE' && attacker.type !== 'k') {
        attacker.soulTrait = newSoul;
        absorbedSoul = newSoul;
      }

      // Move attacker to target square
      next.grid[move.from.r][move.from.c] = null;
      if (move.promotion) {
        attacker.type = move.promotion;
        attacker.armor = Math.min(attacker.maxArmor + 1, attacker.armor + 1);
        attacker.maxArmor = Math.max(attacker.maxArmor, 2);
      }
      next.grid[move.to.r][move.to.c] = attacker;

      next.aether[attacker.color] = Math.min(next.maxAether, next.aether[attacker.color] + 2);
      logKind = 'CAPTURE';
      logText = `Tumbang! ${coordToAlgebraic(move.from)}×${coordToAlgebraic(move.to)}${
        absorbedSoul ? ' · Serap Jiwa!' : ''
      }`;

      if (target.type === 'k') {
        next.winner = attacker.color;
        next.winReason =
          attacker.color === 'w'
            ? 'Raja Hitam telah ditaklukkan di medan Cakrawala!'
            : 'Raja Putih telah gugur dalam pertempuran!';
      }
    }
  } else {
    // Non-capture movement
    next.grid[move.from.r][move.from.c] = null;
    const dest = move.isRiftTeleport && move.teleportDest ? move.teleportDest : move.to;
    impactCoord = dest;

    if (move.promotion) {
      attacker.type = move.promotion;
      attacker.maxArmor = 2;
      attacker.armor = 1;
    }

    next.grid[dest.r][dest.c] = attacker;

    if (move.isRiftTeleport && move.teleportDest) {
      logKind = 'TELEPORT';
      logText = `Lompatan Rift! ${coordToAlgebraic(move.from)} → ${coordToAlgebraic(move.to)} ⇢ ${coordToAlgebraic(dest)}`;
    } else {
      logKind = 'MOVE';
      logText = `${coordToAlgebraic(move.from)} → ${coordToAlgebraic(dest)}`;
    }
  }

  // Check if attacker landed on an Aether Well for the first time
  const finalPiece = next.grid[impactCoord.r][impactCoord.c];
  if (
    finalPiece &&
    finalPiece.id === attacker.id &&
    next.terrain[impactCoord.r][impactCoord.c] === 'AETHER_WELL' &&
    !finalPiece.wellCharged
  ) {
    finalPiece.wellCharged = true;
    finalPiece.armor = Math.min(finalPiece.maxArmor, finalPiece.armor + 1);
    next.aether[attacker.color] = Math.min(next.maxAether, next.aether[attacker.color] + 1);
  }

  // Advance turn & tick status effects
  const nextTurn: PieceColor = currentState.turn === 'w' ? 'b' : 'w';
  next.turn = nextTurn;
  if (nextTurn === 'w') {
    next.turnNumber += 1;
  }

  // Decrement freeze timers for the player who just finished their turn's opponent
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = next.grid[r][c];
      if (p && p.color === currentState.turn && p.frozenTurns > 0) {
        p.frozenTurns = Math.max(0, p.frozenTurns - 1);
      }
    }
  }

  // Grant turn-start Aether to nextTurn (+1 base, +1 per Aether Well occupied)
  let wellCount = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = next.grid[r][c];
      if (p && p.color === nextTurn && next.terrain[r][c] === 'AETHER_WELL') {
        wellCount++;
      }
    }
  }
  next.aether[nextTurn] = Math.min(next.maxAether, next.aether[nextTurn] + 1 + wellCount);

  // Quantum Shift Mode: every 4 turns on White's turn, shift middle terrain tiles
  let triggeredShift = false;
  if (mode === 'QUANTUM_SHIFT' && nextTurn === 'w' && next.turnNumber > 1 && (next.turnNumber - 1) % 4 === 0) {
    shiftMiddleTerrain(next.terrain);
    triggeredShift = true;
  }

  // Update Check status
  next.inCheck.w = isKingThreatened(next, 'w');
  next.inCheck.b = isKingThreatened(next, 'b');

  if (!next.winner) {
    const nextLegal = getAllLegalMoves(next, nextTurn);
    if (nextLegal.length === 0) {
      next.winner = currentState.turn;
      next.winReason = 'Lawan kehabisan langkah legal (Dominasi Taktis)!';
    }
  }

  return {
    nextState: next,
    logText,
    logKind,
    impactCoord,
    recoilCoord,
    absorbedSoul,
    triggeredShift,
  };
}

export function shiftMiddleTerrain(terrain: TileTerrain[][]): void {
  // Rotate rows 2..5 horizontally by 1 or 2 steps to create living battlefield
  for (let r = 2; r <= 5; r++) {
    const row = [...terrain[r]];
    const dir = r % 2 === 0 ? 1 : -1;
    for (let c = 0; c < 8; c++) {
      terrain[r][(c + dir + 8) % 8] = row[c];
    }
  }
}

export function executeSpell(
  currentState: BoardState,
  spellId: SpellId,
  targets: Coord[]
): { nextState: BoardState; logText: string } | null {
  const next = cloneBoard(currentState);
  const caster = next.turn;

  if (spellId === 'AETHER_SHIELD' && targets.length === 1) {
    const t = targets[0];
    const p = next.grid[t.r][t.c];
    if (!p || p.color !== caster || next.aether[caster] < 2) return null;
    next.aether[caster] -= 2;
    p.maxArmor = Math.max(p.maxArmor, 2);
    p.armor = Math.min(2, p.armor + 1);
    return {
      nextState: next,
      logText: `Mantra Perisai Kristal memperkuat ${coordToAlgebraic(t)} (+1 Perisai)!`,
    };
  }

  if (spellId === 'CHRONO_FREEZE' && targets.length === 1) {
    const t = targets[0];
    const p = next.grid[t.r][t.c];
    if (!p || p.color === caster || p.type === 'k' || next.aether[caster] < 3) return null;
    next.aether[caster] -= 3;
    p.frozenTurns = 2; // Frozen through enemy's upcoming turn
    return {
      nextState: next,
      logText: `Bekukan Waktu mengunci bidak lawan di ${coordToAlgebraic(t)}!`,
    };
  }

  if (spellId === 'QUANTUM_SWAP' && targets.length === 2) {
    const [a, b] = targets;
    const pa = next.grid[a.r][a.c];
    const pb = next.grid[b.r][b.c];
    if (
      !pa ||
      !pb ||
      pa.color !== caster ||
      pb.color !== caster ||
      pa.type === 'k' ||
      pb.type === 'k' ||
      next.aether[caster] < 3
    ) {
      return null;
    }
    next.aether[caster] -= 3;
    next.grid[a.r][a.c] = pb;
    next.grid[b.r][b.c] = pa;
    return {
      nextState: next,
      logText: `Tukar Kuantum: ${coordToAlgebraic(a)} ⇄ ${coordToAlgebraic(b)}!`,
    };
  }

  if (spellId === 'TECTONIC_SHIFT') {
    if (next.aether[caster] < 4) return null;
    next.aether[caster] -= 4;
    shiftMiddleTerrain(next.terrain);
    // Also reinforce caster's King with +1 Armor
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = next.grid[r][c];
        if (p && p.color === caster && p.type === 'k') {
          p.maxArmor = 2;
          p.armor = Math.min(2, p.armor + 1);
        }
      }
    }
    return {
      nextState: next,
      logText: `Gempa Cakrawala menggeser petak elemen & memperkuat perisai Raja!`,
    };
  }

  return null;
}

export function computeVisibility(state: BoardState, viewer: PieceColor): boolean[][] {
  const vis: boolean[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => false)
  );

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.grid[r][c];
      if (p && p.color === viewer) {
        // Vision radius of 2 around every friendly piece
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (inBounds(r + dr, c + dc) && Math.abs(dr) + Math.abs(dc) <= 3) {
              vis[r + dr][c + dc] = true;
            }
          }
        }
        // Plus all legal destination squares
        const moves = getLegalMovesForPiece(state, { r, c });
        for (const m of moves) {
          vis[m.to.r][m.to.c] = true;
          if (m.teleportDest) {
            vis[m.teleportDest.r][m.teleportDest.c] = true;
          }
        }
      }
      // Aether Wells act as luminous beacons
      if (state.terrain[r][c] === 'AETHER_WELL') {
        vis[r][c] = true;
      }
    }
  }

  return vis;
}

function evaluateBoard(state: BoardState, aiColor: PieceColor): number {
  if (state.winner === aiColor) return 999999;
  if (state.winner && state.winner !== 'DRAW') return -999999;

  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.grid[r][c];
      if (!p) continue;
      const sign = p.color === aiColor ? 1 : -1;
      let val = PIECE_VALUES[p.type];
      val += p.armor * 140;
      if (p.soulTrait !== 'NONE') val += 110;
      if (p.frozenTurns > 0) val -= 120;

      // Positional center bonus
      const centerDist = Math.abs(3.5 - r) + Math.abs(3.5 - c);
      val += (7 - centerDist) * 12;

      // Terrain control bonus
      const terr = state.terrain[r][c];
      if (terr === 'AETHER_WELL') val += 65;
      else if (terr === 'SANCTUARY') val += 50;
      else if (terr === 'EMBER_FORGE') val += 55;

      // Pawn advancement
      if (p.type === 'p') {
        const adv = p.color === 'w' ? 6 - r : r - 1;
        val += adv * 22;
      }

      score += sign * val;
    }
  }

  score += (state.aether[aiColor] - state.aether[aiColor === 'w' ? 'b' : 'w']) * 25;
  return score;
}

export function chooseAIAction(
  state: BoardState,
  difficulty: Difficulty,
  mode: GameMode
): {
  spell?: { id: SpellId; targets: Coord[] };
  move: LegalMove;
} | null {
  const aiColor = state.turn;
  const enemyColor: PieceColor = aiColor === 'w' ? 'b' : 'w';

  let workingState = cloneBoard(state);
  let chosenSpell: { id: SpellId; targets: Coord[] } | undefined;

  // On Tactician or Grandmaster, AI can strategically cast a spell before moving
  if (difficulty !== 'NOVICE') {
    // 1. Try Chrono Freeze on high-value un-frozen enemy piece if aether >= 4
    if (workingState.aether[aiColor] >= 4) {
      let bestEnemy: { coord: Coord; val: number } | null = null;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = workingState.grid[r][c];
          if (p && p.color === enemyColor && p.type !== 'k' && p.frozenTurns === 0) {
            const v = PIECE_VALUES[p.type] + (p.soulTrait !== 'NONE' ? 150 : 0);
            if (v >= 500 && (!bestEnemy || v > bestEnemy.val)) {
              bestEnemy = { coord: { r, c }, val: v };
            }
          }
        }
      }
      if (bestEnemy && Math.random() < (difficulty === 'GRANDMASTER' ? 0.75 : 0.45)) {
        const res = executeSpell(workingState, 'CHRONO_FREEZE', [bestEnemy.coord]);
        if (res) {
          workingState = res.nextState;
          chosenSpell = { id: 'CHRONO_FREEZE', targets: [bestEnemy.coord] };
        }
      }
    }

    // 2. Or Aether Shield on unshielded Queen/Rook/King if aether >= 3
    if (!chosenSpell && workingState.aether[aiColor] >= 3) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = workingState.grid[r][c];
          if (p && p.color === aiColor && (p.type === 'q' || p.type === 'k') && p.armor === 0) {
            const res = executeSpell(workingState, 'AETHER_SHIELD', [{ r, c }]);
            if (res) {
              workingState = res.nextState;
              chosenSpell = { id: 'AETHER_SHIELD', targets: [{ r, c }] };
              break;
            }
          }
        }
      }
    }
  }

  const legalMoves = getAllLegalMoves(workingState, aiColor);
  if (legalMoves.length === 0) return null;

  if (difficulty === 'NOVICE') {
    // Novice picks mostly random with slight preference for captures
    const scored = legalMoves.map((m) => {
      const sim = executeMove(workingState, m, mode);
      return {
        move: m,
        score: evaluateBoard(sim.nextState, aiColor) + (Math.random() * 260 - 130),
      };
    });
    scored.sort((a, b) => b.score - a.score);
    return { spell: chosenSpell, move: scored[0].move };
  }

  // Tactician & Grandmaster: 1-to-2 ply minimax with tactical evaluation
  let bestMove = legalMoves[0];
  let bestScore = -Infinity;

  for (const m of legalMoves) {
    const sim1 = executeMove(workingState, m, mode);
    let score = evaluateBoard(sim1.nextState, aiColor);

    if (difficulty === 'GRANDMASTER' && !sim1.nextState.winner) {
      // Check opponent's strongest reply
      const enemyReplies = getAllLegalMoves(sim1.nextState, enemyColor);
      let worstReplyScore = score;
      // Sample top captures/threats for fast 60fps response
      const priorityReplies = enemyReplies
        .filter((er) => er.isCapture || er.isRiftTeleport)
        .slice(0, 12);
      const repliesToTest = priorityReplies.length > 0 ? priorityReplies : enemyReplies.slice(0, 8);

      for (const er of repliesToTest) {
        const sim2 = executeMove(sim1.nextState, er, mode);
        const replyEval = evaluateBoard(sim2.nextState, aiColor);
        if (replyEval < worstReplyScore) {
          worstReplyScore = replyEval;
        }
      }
      score = worstReplyScore;
    } else {
      // Tactician jitter
      score += Math.random() * 45 - 22;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return { spell: chosenSpell, move: bestMove };
}
