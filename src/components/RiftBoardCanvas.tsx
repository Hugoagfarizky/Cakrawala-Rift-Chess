import React, { useEffect, useRef } from 'react';
import {
  BoardState,
  computeVisibility,
   getLegalMovesForPiece,
  inBounds,
} from '../game/engine';
import {
  Coord,
  GameMode,
  GameState,
  LegalMove,
  Piece,
  PieceType,
  SOUL_TRAIT_INFO,
  SpellId,
  TileTerrain,
} from '../game/types';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FloatingBanner {
  text: string;
  subtext?: string;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface PieceAnim {
  piece: Piece;
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  progress: number;
  duration: number;
  isRecoil?: boolean;
}

export interface AIWindupTelegraph {
  from: Coord;
  to: Coord;
  isCapture: boolean;
  spellTarget?: Coord;
  progress: number; // 0..1
}

export interface CanvasFXTrigger {
  id: number;
  kind: 'MOVE' | 'CAPTURE' | 'SHIELD_BREAK' | 'TELEPORT' | 'SPELL' | 'SHIFT' | 'CHECK';
  coord: Coord;
  fromCoord?: Coord;
  bannerText?: string;
  pieceAnim?: {
    piece: Piece;
    from: Coord;
    to: Coord;
    isRecoil?: boolean;
  };
}

interface RiftBoardCanvasProps {
  gameState: GameState;
  gameMode: GameMode;
  boardState: BoardState;
  selectedCoord: Coord | null;
  cursorCoord: Coord;
  activeSpell: SpellId | null;
  spellFirstTarget: Coord | null;
  aiTelegraph: AIWindupTelegraph | null;
  fxTrigger: CanvasFXTrigger | null;
  onTileClick: (coord: Coord) => void;
  onHoverTile: (coord: Coord | null) => void;
  onCursorMove: (coord: Coord) => void;
}

const PARTICLE_POOL_SIZE = 180;

export const RiftBoardCanvas: React.FC<RiftBoardCanvasProps> = ({
  gameState,
  gameMode,
  boardState,
  selectedCoord,
  cursorCoord,
  activeSpell,
  spellFirstTarget,
  aiTelegraph,
  fxTrigger,
  onTileClick,
  onHoverTile,
  onCursorMove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutable simulation ref so 60fps requestAnimationFrame never restarts on React state updates
  const simRef = useRef({
    gameState,
    gameMode,
    boardState,
    selectedCoord,
    cursorCoord,
    activeSpell,
    spellFirstTarget,
    aiTelegraph,
    legalMoves: [] as LegalMove[],
    visibility: null as boolean[][] | null,
    hoveredCoord: null as Coord | null,
    time: 0,
    hitstopTimer: 0,
    shakeIntensity: 0,
    flashAlpha: 0,
    flashColor: '#FFFFFF',
    flashCoord: null as Coord | null,
    pieceAnims: [] as PieceAnim[],
    banners: [] as FloatingBanner[],
    particles: Array.from({ length: PARTICLE_POOL_SIZE }, (): Particle => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 3,
      color: '#38BDF8',
      alpha: 1,
      life: 0,
      maxLife: 1,
    })),
    boardRect: { x: 0, y: 0, size: 512, tileSize: 64 },
    lastFxId: 0,
    heldKeys: new Set<string>(),
  });

  // Sync props into mutable ref
  useEffect(() => {
    const s = simRef.current;
    s.gameState = gameState;
    s.gameMode = gameMode;
    s.boardState = boardState;
    s.selectedCoord = selectedCoord;
    s.cursorCoord = cursorCoord;
    s.activeSpell = activeSpell;
    s.spellFirstTarget = spellFirstTarget;
    s.aiTelegraph = aiTelegraph;

    if (selectedCoord) {
      s.legalMoves = getLegalMovesForPiece(boardState, selectedCoord);
    } else {
      s.legalMoves = [];
    }

    if (gameMode === 'FOG_OF_WAR') {
      // In Fog of War, show current human viewer visibility (White in AI mode, or active turn in 2P)
      s.visibility = computeVisibility(boardState, 'w');
    } else {
      s.visibility = null;
    }
  }, [
    gameState,
    gameMode,
    boardState,
    selectedCoord,
    cursorCoord,
    activeSpell,
    spellFirstTarget,
    aiTelegraph,
  ]);

  // Trigger visual FX when fxTrigger increments
  useEffect(() => {
    if (!fxTrigger || fxTrigger.id === simRef.current.lastFxId) return;
    const s = simRef.current;
    s.lastFxId = fxTrigger.id;

    const { tileSize, x: bx, y: by } = s.boardRect;
    const cx = bx + (fxTrigger.coord.c + 0.5) * tileSize;
    const cy = by + (fxTrigger.coord.r + 0.5) * tileSize;

    const spawnBurst = (count: number, colors: string[], speedScale = 1) => {
      let spawned = 0;
      for (let i = 0; i < s.particles.length && spawned < count; i++) {
        const p = s.particles[i];
        if (!p.active) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (40 + Math.random() * 160) * speedScale;
          p.active = true;
          p.x = cx + (Math.random() - 0.5) * 14;
          p.y = cy + (Math.random() - 0.5) * 14;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.size = 2.5 + Math.random() * 4.5;
          p.color = colors[spawned % colors.length];
          p.life = 0;
          p.maxLife = 0.35 + Math.random() * 0.4;
          p.alpha = 1;
          spawned++;
        }
      }
    };

    if (fxTrigger.pieceAnim) {
      s.pieceAnims.push({
        piece: fxTrigger.pieceAnim.piece,
        fromR: fxTrigger.pieceAnim.from.r,
        fromC: fxTrigger.pieceAnim.from.c,
        toR: fxTrigger.pieceAnim.to.r,
        toC: fxTrigger.pieceAnim.to.c,
        progress: 0,
        duration: fxTrigger.pieceAnim.isRecoil ? 0.24 : 0.18,
        isRecoil: fxTrigger.pieceAnim.isRecoil,
      });
    }

    switch (fxTrigger.kind) {
      case 'CAPTURE':
        s.hitstopTimer = 0.065; // 65ms heavy impact hitstop
        s.shakeIntensity = 11;
        s.flashAlpha = 0.65;
        s.flashColor = '#F97316';
        s.flashCoord = fxTrigger.coord;
        spawnBurst(36, ['#F97316', '#FACC15', '#FB7185', '#FFFFFF'], 1.35);
        break;
      case 'SHIELD_BREAK':
        s.hitstopTimer = 0.05; // 50ms shield deflection hitstop
        s.shakeIntensity = 8;
        s.flashAlpha = 0.7;
        s.flashColor = '#38BDF8';
        s.flashCoord = fxTrigger.coord;
        spawnBurst(28, ['#38BDF8', '#E0F2FE', '#818CF8'], 1.15);
        break;
      case 'TELEPORT':
        s.shakeIntensity = 5;
        s.flashAlpha = 0.6;
        s.flashColor = '#C084FC';
        s.flashCoord = fxTrigger.coord;
        spawnBurst(32, ['#C084FC', '#A855F7', '#F0ABFC'], 1.2);
        break;
      case 'SPELL':
        s.shakeIntensity = 6;
        s.flashAlpha = 0.55;
        s.flashColor = '#38BDF8';
        s.flashCoord = fxTrigger.coord;
        spawnBurst(26, ['#38BDF8', '#34D399', '#FDE047'], 1.0);
        break;
      case 'SHIFT':
        s.shakeIntensity = 12;
        s.flashAlpha = 0.45;
        s.flashColor = '#A855F7';
        spawnBurst(40, ['#C084FC', '#38BDF8', '#F59E0B'], 1.4);
        break;
      case 'MOVE':
        spawnBurst(10, ['#94A3B8', '#CBD5E1'], 0.55);
        break;
      case 'CHECK':
        s.shakeIntensity = 9;
        s.flashAlpha = 0.6;
        s.flashColor = '#EF4444';
        s.flashCoord = fxTrigger.coord;
        break;
    }

    if (fxTrigger.bannerText) {
      s.banners.push({
        text: fxTrigger.bannerText,
        x: cx,
        y: cy - 12,
        color:
          fxTrigger.kind === 'CAPTURE'
            ? '#FBBF24'
            : fxTrigger.kind === 'SHIELD_BREAK'
            ? '#38BDF8'
            : fxTrigger.kind === 'TELEPORT'
            ? '#E879F9'
            : '#34D399',
        life: 0,
        maxLife: 1.25,
      });
    }
  }, [fxTrigger]);

  // Main 60fps Canvas Loop + ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;
    const updateSize = () => {
      dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));

      // Compute board geometry with clean margin inside the dedicated middle playfield
      const w = rect.width;
      const h = rect.height;
      const maxBoard = Math.min(w - 44, h - 44, 680);
      const boardSize = Math.max(240, Math.floor(maxBoard / 8) * 8);
      const tileSize = boardSize / 8;
      const bx = Math.floor((w - boardSize) / 2);
      const by = Math.floor((h - boardSize) / 2);
      simRef.current.boardRect = { x: bx, y: by, size: boardSize, tileSize };
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);

    const onBlur = () => {
      simRef.current.heldKeys.clear();
    };
    window.addEventListener('blur', onBlur);

    let lastTime = performance.now();
    let rafId = 0;

    const renderLoop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05); // Clamp frame delta time per guidelines

      const s = simRef.current;
      s.time += dt;

      // Hitstop pause for heavy impacts
      const simDt = s.hitstopTimer > 0 ? 0 : dt;
      if (s.hitstopTimer > 0) {
        s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
      }

      // Update camera shake & flash
      if (s.shakeIntensity > 0) {
        s.shakeIntensity = Math.max(0, s.shakeIntensity - dt * 38);
      }
      if (s.flashAlpha > 0) {
        s.flashAlpha = Math.max(0, s.flashAlpha - dt * 2.6);
      }

      // Update piece animations
      for (let i = s.pieceAnims.length - 1; i >= 0; i--) {
        const pa = s.pieceAnims[i];
        pa.progress += simDt / pa.duration;
        if (pa.progress >= 1) {
          s.pieceAnims.splice(i, 1);
        }
      }

      // Update particles
      for (let i = 0; i < s.particles.length; i++) {
        const p = s.particles[i];
        if (!p.active) continue;
        p.life += simDt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        p.x += p.vx * simDt;
        p.y += p.vy * simDt;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.alpha = 1 - p.life / p.maxLife;
      }

      // Update floating banners
      for (let i = s.banners.length - 1; i >= 0; i--) {
        const b = s.banners[i];
        b.life += dt;
        b.y -= dt * 28;
        if (b.life >= b.maxLife) {
          s.banners.splice(i, 1);
        }
      }

      // Draw scene
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear ambient background
      ctx.fillStyle = '#0B0F17';
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric grid & ambient dimensional glow
      drawAmbientWorld(ctx, width, height, s.time, s.gameState === 'TITLE_MENU');

      // Apply decaying camera shake
      if (s.shakeIntensity > 0.2) {
        const sx = (Math.random() - 0.5) * s.shakeIntensity;
        const sy = (Math.random() - 0.5) * s.shakeIntensity;
        ctx.translate(sx, sy);
      }

      // Draw the 8x8 Cakrawala Rift Board
      drawBoard(ctx, s);

      // Draw active particles
      for (let i = 0; i < s.particles.length; i++) {
        const p = s.particles[i];
        if (!p.active) continue;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw floating combat banners
      for (const b of s.banners) {
        const alpha = Math.min(1, (1 - b.life / b.maxLife) * 1.5);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#090D16';
        ctx.fillText(b.text, b.x + 1, b.y + 1);
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, b.x, b.y);
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Convert mouse position to board coordinates
  const getCoordFromMouse = (e: React.MouseEvent<HTMLCanvasElement>): Coord | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x, y, tileSize } = simRef.current.boardRect;
    const c = Math.floor((mx - x) / tileSize);
    const r = Math.floor((my - y) / tileSize);
    if (inBounds(r, c)) return { r, c };
    return null;
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onClick={(e) => {
          if (simRef.current.gameState !== 'PLAYING') return;
          const coord = getCoordFromMouse(e);
          if (coord) {
            onCursorMove(coord);
            onTileClick(coord);
          }
        }}
        onMouseMove={(e) => {
          const coord = getCoordFromMouse(e);
          simRef.current.hoveredCoord = coord;
          onHoverTile(coord);
        }}
        onMouseLeave={() => {
          simRef.current.hoveredCoord = null;
          onHoverTile(null);
        }}
        className="block w-full h-full cursor-pointer"
      />
    </div>
  );
};

function drawAmbientWorld(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  isTitle: boolean
) {
  // Subtle radial luminescence behind the board
  const grad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    20,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.6
  );
  grad.addColorStop(0, isTitle ? 'rgba(88, 28, 135, 0.22)' : 'rgba(30, 41, 59, 0.35)');
  grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.18)');
  grad.addColorStop(1, 'rgba(11, 15, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle geometric constellation lines in deep background
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.04)';
  ctx.lineWidth = 1;
  const spacing = 64;
  const offset = (time * 6) % spacing;
  for (let x = offset; x < width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = offset; y < height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, s: typeof EasySimType) {
  const { x: bx, y: by, size: boardSize, tileSize } = s.boardRect;
  const { boardState, selectedCoord, cursorCoord, legalMoves, visibility, time, hoveredCoord } = s;

  // Outer board obsidian frame
  ctx.save();
  ctx.fillStyle = '#111827';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  const pad = 16;
  ctx.beginPath();
  ctx.roundRect(bx - pad, by - pad, boardSize + pad * 2, boardSize + pad * 2, 12);
  ctx.fill();
  ctx.stroke();

  // Algebraic coordinate labels along outer rim
  ctx.fillStyle = '#64748B';
  ctx.font = '600 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  for (let i = 0; i < 8; i++) {
    // Bottom file labels
    ctx.fillText(files[i], bx + (i + 0.5) * tileSize, by + boardSize + 9);
    // Left rank labels
    ctx.fillText(`${8 - i}`, bx - 9, by + (i + 0.5) * tileSize);
  }

  // Draw 64 squares & Elemental Terrain effects
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const tx = bx + c * tileSize;
      const ty = by + r * tileSize;
      const isLight = (r + c) % 2 === 0;
      const isVisible = !visibility || visibility[r][c];

      // Base slate/obsidian square
      ctx.fillStyle = isLight ? '#1E293B' : '#0F172A';
      ctx.fillRect(tx, ty, tileSize, tileSize);

      // Subtle inner tile border
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx + 0.5, ty + 0.5, tileSize - 1, tileSize - 1);

      // Elemental Terrain rendering
      const terrain = boardState.terrain[r][c];
      if (terrain !== 'NORMAL') {
        drawTerrainOverlay(ctx, tx, ty, tileSize, terrain, time);
      }

      // Fog of War shroud if unseen
      if (!isVisible) {
        ctx.fillStyle = 'rgba(7, 10, 18, 0.82)';
        ctx.fillRect(tx, ty, tileSize, tileSize);
        // Subtle fog hatch
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.12)';
        ctx.beginPath();
        ctx.moveTo(tx + 8, ty + tileSize - 8);
        ctx.lineTo(tx + tileSize - 8, ty + 8);
        ctx.stroke();
      }

      // Selected tile highlight
      if (selectedCoord && selectedCoord.r === r && selectedCoord.c === c) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.26)';
        ctx.fillRect(tx, ty, tileSize, tileSize);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(tx + 1.5, ty + 1.5, tileSize - 3, tileSize - 3);
      }

      // Spell first target highlight (for Quantum Swap)
      if (s.spellFirstTarget && s.spellFirstTarget.r === r && s.spellFirstTarget.c === c) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.fillRect(tx, ty, tileSize, tileSize);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
      }

      // Hovered or Keyboard Cursor outline
      const isHovered = hoveredCoord && hoveredCoord.r === r && hoveredCoord.c === c;
      const isCursor = cursorCoord.r === r && cursorCoord.c === c && s.gameState === 'PLAYING';
      if (isHovered || isCursor) {
        ctx.strokeStyle = s.activeSpell
          ? '#38BDF8'
          : isHovered
          ? 'rgba(248, 250, 252, 0.45)'
          : 'rgba(245, 158, 11, 0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
      }
    }
  }

  // Impact Flash on tile
  if (s.flashAlpha > 0 && s.flashCoord) {
    const fx = bx + s.flashCoord.c * tileSize;
    const fy = by + s.flashCoord.r * tileSize;
    ctx.save();
    ctx.globalAlpha = s.flashAlpha;
    ctx.fillStyle = s.flashColor;
    ctx.fillRect(fx, fy, tileSize, tileSize);
    ctx.restore();
  }

  // Draw Legal Move Indicators
  for (const m of legalMoves) {
    const mx = bx + (m.to.c + 0.5) * tileSize;
    const my = by + (m.to.r + 0.5) * tileSize;

    if (m.isCapture) {
      // Attack target reticle
      ctx.save();
      ctx.strokeStyle = m.isShieldStrike ? '#38BDF8' : '#F43F5E';
      ctx.lineWidth = 2.5;
      const rad = tileSize * 0.42;
      ctx.beginPath();
      ctx.arc(mx, my, rad, 0, Math.PI * 2);
      ctx.stroke();

      // Label tag for Shield Strike vs Lethal
      ctx.fillStyle = m.isShieldStrike ? '#0284C7' : '#E11D48';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        m.isShieldStrike ? 'PECAH PERISAI' : m.isPiercing ? 'TEMBUS!' : 'TUMBANG',
        mx,
        my - tileSize * 0.34
      );
      ctx.restore();
    } else {
      // Destination dot (purple diamond if Rift Teleport, cyan if Soul Trait move, amber if normal)
      ctx.save();
      if (m.isRiftTeleport) {
        ctx.fillStyle = '#C084FC';
        ctx.beginPath();
        ctx.arc(mx, my, tileSize * 0.16, 0, Math.PI * 2);
        ctx.fill();
        // Draw dashed line to teleport destination
        if (m.teleportDest) {
          const dx = bx + (m.teleportDest.c + 0.5) * tileSize;
          const dy = by + (m.teleportDest.r + 0.5) * tileSize;
          ctx.strokeStyle = 'rgba(192, 132, 252, 0.75)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(dx, dy);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = m.fromSoulTrait ? '#38BDF8' : 'rgba(245, 158, 11, 0.75)';
        ctx.beginPath();
        ctx.arc(mx, my, tileSize * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Draw AI Windup Telegraph (if AI is charging its move)
  if (s.aiTelegraph) {
    const { from, to, isCapture, progress } = s.aiTelegraph;
    const fx = bx + (from.c + 0.5) * tileSize;
    const fy = by + (from.r + 0.5) * tileSize;
    const tx = bx + (to.c + 0.5) * tileSize;
    const ty = by + (to.r + 0.5) * tileSize;

    ctx.save();
    // Pulsing warning ring on origin piece
    ctx.strokeStyle = isCapture ? '#F43F5E' : '#F59E0B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fx, fy, tileSize * (0.3 + 0.12 * Math.sin(progress * Math.PI * 4)), 0, Math.PI * 2);
    ctx.stroke();

    // Laser telegraph line from AI origin to target
    ctx.strokeStyle = isCapture ? 'rgba(244, 63, 94, 0.85)' : 'rgba(245, 158, 11, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + (tx - fx) * Math.min(1, progress * 1.4), fy + (ty - fy) * Math.min(1, progress * 1.4));
    ctx.stroke();

    // Target reticle
    ctx.beginPath();
    ctx.arc(tx, ty, tileSize * 0.36 * progress, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Collect animated piece IDs so we don't double-draw them at static grid slots
  const animIds = new Set(s.pieceAnims.map((a) => a.piece.id));

  // Draw Pieces on board
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = boardState.grid[r][c];
      if (!piece || animIds.has(piece.id)) continue;

      const isVisible = !visibility || visibility[r][c];
      if (!isVisible && piece.color !== 'w') continue; // Hidden in Fog of War!

      const px = bx + (c + 0.5) * tileSize;
      const py = by + (r + 0.5) * tileSize;
      const isKingInCheck =
        piece.type === 'k' && boardState.inCheck[piece.color];

      drawPiece(ctx, piece, px, py, tileSize, time, 1, 1, isKingInCheck);
    }
  }

  // Draw active moving / recoiling pieces with squash-and-stretch
  for (const anim of s.pieceAnims) {
    const t = anim.progress;
    let curR: number;
    let curC: number;

    if (anim.isRecoil) {
      // Lunge halfway toward target then bounce back to from
      const lunge = t < 0.5 ? t * 2 : (1 - t) * 2;
      curR = anim.fromR + (anim.toR - anim.fromR) * 0.65 * lunge;
      curC = anim.fromC + (anim.toC - anim.fromC) * 0.65 * lunge;
    } else {
      // Smooth ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      curR = anim.fromR + (anim.toR - anim.fromR) * ease;
      curC = anim.fromC + (anim.toC - anim.fromC) * ease;
    }

    const px = bx + (curC + 0.5) * tileSize;
    const py = by + (curR + 0.5) * tileSize;
    // Squash and stretch during flight
    const stretch = 1 + Math.sin(t * Math.PI) * 0.16;
    const squash = 1 - Math.sin(t * Math.PI) * 0.1;
    drawPiece(ctx, anim.piece, px, py - Math.sin(t * Math.PI) * 10, tileSize, time, squash, stretch, false);
  }

  ctx.restore();
}

function drawTerrainOverlay(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  tileSize: number,
  terrain: TileTerrain,
  time: number
) {
  const cx = tx + tileSize / 2;
  const cy = ty + tileSize / 2;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);

  ctx.save();
  if (terrain === 'RIFT_A' || terrain === 'RIFT_B') {
    // Swirling Void Portal
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, tileSize * 0.44);
    grad.addColorStop(0, 'rgba(216, 180, 254, 0.42)');
    grad.addColorStop(0.6, 'rgba(147, 51, 234, 0.22)');
    grad.addColorStop(1, 'rgba(147, 51, 234, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(tx, ty, tileSize, tileSize);

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * (0.24 + 0.05 * pulse), time * 2, time * 2 + Math.PI * 1.35);
    ctx.stroke();

    ctx.fillStyle = 'rgba(233, 213, 255, 0.75)';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(terrain === 'RIFT_A' ? 'RIFT α' : 'RIFT β', tx + 4, ty + 11);
  } else if (terrain === 'AETHER_WELL') {
    // Luminous Cyan Aether Conduit
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, tileSize * 0.44);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.36)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(tx, ty, tileSize, tileSize);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(tx + 5, ty + 5, tileSize - 10, tileSize - 10);

    ctx.fillStyle = 'rgba(125, 211, 252, 0.8)';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('+AETHER', tx + 4, ty + 11);
  } else if (terrain === 'SANCTUARY') {
    // Emerald Sanctuary Ward
    ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
    ctx.fillRect(tx, ty, tileSize, tileSize);
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 0.36, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(110, 231, 183, 0.8)';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LINDUNG', tx + 4, ty + 11);
  } else if (terrain === 'EMBER_FORGE') {
    // Crimson Magma Forge (Piercing Strike)
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, tileSize * 0.44);
    grad.addColorStop(0, 'rgba(244, 63, 94, 0.35)');
    grad.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(tx, ty, tileSize, tileSize);

    ctx.fillStyle = 'rgba(253, 164, 175, 0.8)';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('BARA', tx + 4, ty + 11);
  }
  ctx.restore();
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  px: number,
  py: number,
  tileSize: number,
  time: number,
  scaleX: number,
  scaleY: number,
  isInCheck: boolean
) {
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(scaleX, scaleY);

  const r = tileSize * 0.34;
  const isWhite = piece.color === 'w';

  // Red danger pulse if King in check
  if (isInCheck) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.32, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soul Trait aura ring if piece has absorbed an enemy soul
  if (piece.soulTrait !== 'NONE') {
    const soulColor = SOUL_TRAIT_INFO[piece.soulTrait].color;
    ctx.strokeStyle = soulColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, time * 1.5, time * 1.5 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.beginPath();
  ctx.arc(0, 3, r, 0, Math.PI * 2);
  ctx.fill();

  // Piece medallion base
  const baseGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
  if (isWhite) {
    baseGrad.addColorStop(0, '#FFFBEB');
    baseGrad.addColorStop(0.7, '#E2E8F0');
    baseGrad.addColorStop(1, '#94A3B8');
  } else {
    baseGrad.addColorStop(0, '#334155');
    baseGrad.addColorStop(0.7, '#1E293B');
    baseGrad.addColorStop(1, '#090D16');
  }

  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Outer rim (Gold for White, Crimson-Violet for Black, or Cyan if Armored)
  ctx.strokeStyle =
    piece.armor > 0
      ? '#38BDF8'
      : isWhite
      ? '#F59E0B'
      : '#A855F7';
  ctx.lineWidth = piece.armor > 0 ? 2.8 : 2;
  ctx.stroke();

  // Second outer shield ring if armor === 2
  if (piece.armor >= 2) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw crisp bespoke geometric chess glyph inside medallion
  drawPieceGlyph(ctx, piece.type, isWhite ? '#0F172A' : '#F8FAFC', r * 0.62);

  // Frozen ice overlay if affected by Chrono Freeze
  if (piece.frozenTurns > 0) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 2;
    ctx.strokeRect(-r * 0.65, -r * 0.65, r * 1.3, r * 1.3);
  }

  // Armor shield pip badge (top-right of piece)
  if (piece.armor > 0) {
    const bx = r * 0.72;
    const by = -r * 0.72;
    ctx.fillStyle = '#0284C7';
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, by, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${piece.armor}`, bx, by + 0.5);
  }

  // Soul Trait badge pip (bottom-right of piece)
  if (piece.soulTrait !== 'NONE') {
    const sx = r * 0.72;
    const sy = r * 0.72;
    const traitColor = SOUL_TRAIT_INFO[piece.soulTrait].color;
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = traitColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = traitColor;
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const letter =
      piece.soulTrait === 'KNIGHT_LEAP'
        ? 'L'
        : piece.soulTrait === 'PHANTOM_STEP'
        ? 'P'
        : 'B';
    ctx.fillText(letter, sx, sy + 0.5);
  }

  ctx.restore();
}

function drawPieceGlyph(
  ctx: CanvasRenderingContext2D,
  type: PieceType,
  color: string,
  s: number
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (type) {
    case 'p': {
      // Stylized Pawn: head orb + tapered collar + base
      ctx.beginPath();
      ctx.arc(0, -s * 0.42, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, s * 0.55);
      ctx.lineTo(-s * 0.18, -s * 0.08);
      ctx.lineTo(s * 0.18, -s * 0.08);
      ctx.lineTo(s * 0.35, s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.48, s * 0.55, s * 0.96, s * 0.16);
      break;
    }
    case 'r': {
      // Stylized Rook: battlements + tower body
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.55);
      ctx.lineTo(-s * 0.45, -s * 0.2);
      ctx.lineTo(-s * 0.32, s * 0.55);
      ctx.lineTo(s * 0.32, s * 0.55);
      ctx.lineTo(s * 0.45, -s * 0.2);
      ctx.lineTo(s * 0.45, -s * 0.55);
      ctx.lineTo(s * 0.22, -s * 0.55);
      ctx.lineTo(s * 0.22, -s * 0.35);
      ctx.lineTo(s * 0.08, -s * 0.35);
      ctx.lineTo(s * 0.08, -s * 0.55);
      ctx.lineTo(-s * 0.08, -s * 0.55);
      ctx.lineTo(-s * 0.08, -s * 0.35);
      ctx.lineTo(-s * 0.22, -s * 0.35);
      ctx.lineTo(-s * 0.22, -s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.5, s * 0.55, s * 1.0, s * 0.16);
      break;
    }
    case 'n': {
      // Stylized Knight crest
      ctx.beginPath();
      ctx.moveTo(-s * 0.38, s * 0.55);
      ctx.lineTo(-s * 0.25, -s * 0.15);
      ctx.lineTo(-s * 0.48, -s * 0.05);
      ctx.lineTo(-s * 0.42, -s * 0.35);
      ctx.lineTo(-s * 0.05, -s * 0.65);
      ctx.lineTo(s * 0.15, -s * 0.72);
      ctx.lineTo(s * 0.12, -s * 0.48);
      ctx.lineTo(s * 0.38, -s * 0.15);
      ctx.lineTo(s * 0.38, s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.48, s * 0.55, s * 0.96, s * 0.16);
      break;
    }
    case 'b': {
      // Stylized Bishop miter + orb tip
      ctx.beginPath();
      ctx.arc(0, -s * 0.65, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.bezierCurveTo(s * 0.48, -s * 0.15, s * 0.42, s * 0.35, s * 0.32, s * 0.55);
      ctx.lineTo(-s * 0.32, s * 0.55);
      ctx.bezierCurveTo(-s * 0.42, s * 0.35, -s * 0.48, -s * 0.15, 0, -s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.48, s * 0.55, s * 0.96, s * 0.16);
      break;
    }
    case 'q': {
      // Stylized Queen coronet with 3 spikes
      ctx.beginPath();
      ctx.moveTo(-s * 0.38, s * 0.52);
      ctx.lineTo(-s * 0.55, -s * 0.38);
      ctx.lineTo(-s * 0.18, s * 0.05);
      ctx.lineTo(0, -s * 0.58);
      ctx.lineTo(s * 0.18, s * 0.05);
      ctx.lineTo(s * 0.55, -s * 0.38);
      ctx.lineTo(s * 0.38, s * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.48, s * 0.55, s * 0.96, s * 0.16);
      break;
    }
    case 'k': {
      // Stylized King crown + royal cross
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.78);
      ctx.lineTo(0, -s * 0.32);
      ctx.moveTo(-s * 0.22, -s * 0.58);
      ctx.lineTo(s * 0.22, -s * 0.58);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-s * 0.38, s * 0.52);
      ctx.lineTo(-s * 0.48, -s * 0.22);
      ctx.lineTo(0, -s * 0.35);
      ctx.lineTo(s * 0.48, -s * 0.22);
      ctx.lineTo(s * 0.38, s * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.48, s * 0.55, s * 0.96, s * 0.16);
      break;
    }
  }

  ctx.restore();
}

// Type helper for internal drawBoard signature
const EasySimType = null as unknown as {
  gameState: GameState;
  gameMode: GameMode;
  boardState: BoardState;
  selectedCoord: Coord | null;
  cursorCoord: Coord;
  activeSpell: SpellId | null;
  spellFirstTarget: Coord | null;
  aiTelegraph: AIWindupTelegraph | null;
  legalMoves: LegalMove[];
  visibility: boolean[][] | null;
  hoveredCoord: Coord | null;
  time: number;
  hitstopTimer: number;
  shakeIntensity: number;
  flashAlpha: number;
  flashColor: string;
  flashCoord: Coord | null;
  pieceAnims: PieceAnim[];
  banners: FloatingBanner[];
  particles: Particle[];
  boardRect: { x: number; y: number; size: number; tileSize: number };
};
