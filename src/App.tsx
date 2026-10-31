import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AIWindupTelegraph,
  CanvasFXTrigger,
  RiftBoardCanvas,
} from './components/RiftBoardCanvas';
import {
  BoardState,
  chooseAIAction,
  coordToAlgebraic,
  createInitialBoard,
  executeMove,
  executeSpell,
  getLegalMovesForPiece,
  inBounds,
} from './game/engine';
import { sound } from './game/sound';
import {
  CombatEvent,
  Coord,
  Difficulty,
  GameMode,
  GameState,
  OpponentType,
  PIECE_NAMES_ID,
  SOUL_TRAIT_INFO,
  SPELLS,
  SpellId,
  TERRAIN_INFO,
} from './game/types';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [gameMode, setGameMode] = useState<GameMode>('RIFT_TACTICS');
  const [difficulty, setDifficulty] = useState<Difficulty>('TACTICIAN');
  const [opponentType, setOpponentType] = useState<OpponentType>('AI');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);

  const [boardState, setBoardState] = useState<BoardState>(() =>
    createInitialBoard('RIFT_TACTICS')
  );
  const [selectedCoord, setSelectedCoord] = useState<Coord | null>(null);
  const [cursorCoord, setCursorCoord] = useState<Coord>({ r: 6, c: 4 });
  const [hoveredCoord, setHoveredCoord] = useState<Coord | null>(null);

  const [activeSpell, setActiveSpell] = useState<SpellId | null>(null);
  const [spellFirstTarget, setSpellFirstTarget] = useState<Coord | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Giliran Putih · Pilih bidak atau aktifkan Mantra Aether [1-4]'
  );

  const [combatLog, setCombatLog] = useState<CombatEvent[]>([]);
  const [fxTrigger, setFxTrigger] = useState<CanvasFXTrigger | null>(null);
  const [aiTelegraph, setAiTelegraph] = useState<AIWindupTelegraph | null>(null);

  const fxCounterRef = useRef(1);
  const aiTimersRef = useRef<number[]>([]);

  const clearAiTimers = useCallback(() => {
    aiTimersRef.current.forEach((id) => window.clearTimeout(id));
    aiTimersRef.current = [];
  }, []);

  const triggerCanvasFX = useCallback(
    (
      kind: CanvasFXTrigger['kind'],
      coord: Coord,
      bannerText?: string,
      pieceAnim?: CanvasFXTrigger['pieceAnim']
    ) => {
      fxCounterRef.current += 1;
      setFxTrigger({
        id: fxCounterRef.current,
        kind,
        coord,
        bannerText,
        pieceAnim,
      });
    },
    []
  );

  const pushLog = useCallback(
    (
      turnNumber: number,
      color: 'w' | 'b',
      text: string,
      kind: CombatEvent['kind']
    ) => {
      setCombatLog((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          turnNumber,
          color,
          text,
          kind,
        },
        ...prev.slice(0, 14),
      ]);
    },
    []
  );

  // Start or Restart Game
  const startNewGame = useCallback(
    (modeOverride?: GameMode) => {
      clearAiTimers();
      const targetMode = modeOverride ?? gameMode;
      const fresh = createInitialBoard(targetMode);
      setBoardState(fresh);
      setSelectedCoord(null);
      setActiveSpell(null);
      setSpellFirstTarget(null);
      setAiTelegraph(null);
      setCombatLog([
        {
          id: 'init',
          turnNumber: 1,
          color: 'w',
          text:
            targetMode === 'RIFT_TACTICS'
              ? 'Medan Cakrawala terbuka. Kuasai Sumur Aether & Portal Rift!'
              : targetMode === 'FOG_OF_WAR'
              ? 'Kabut Perang menyelimuti papan. Intai pergerakan lawan!'
              : 'Mode Kuantum aktif: Medan elemen bergeser setiap 4 putaran!',
          kind: 'SHIFT',
        },
      ]);
      setStatusMessage('Giliran Putih · Pilih bidak untuk bergerak');
      setGameState('PLAYING');
      sound.playSelect();
    },
    [clearAiTimers, gameMode]
  );

  // Handle Spell Activation Button or Hotkey [1-4]
  const handleSelectSpell = useCallback(
    (spellId: SpellId) => {
      if (gameState !== 'PLAYING') return;
      if (opponentType === 'AI' && boardState.turn === 'b') return;

      const spellDef = SPELLS.find((s) => s.id === spellId);
      if (!spellDef) return;

      if (activeSpell === spellId) {
        setActiveSpell(null);
        setSpellFirstTarget(null);
        setStatusMessage('Mantra dibatalkan · Pilih bidak untuk bergerak');
        return;
      }

      const currentAether = boardState.aether[boardState.turn];
      if (currentAether < spellDef.cost) {
        setStatusMessage(
          `Aether tidak cukup untuk ${spellDef.name} (Butuh ${spellDef.cost}, Tersedia ${currentAether})`
        );
        return;
      }

      // Instant board spell (TECTONIC_SHIFT) executes immediately!
      if (spellDef.targetRule === 'INSTANT_BOARD') {
        const res = executeSpell(boardState, 'TECTONIC_SHIFT', []);
        if (res) {
          setBoardState(res.nextState);
          setSelectedCoord(null);
          setActiveSpell(null);
          sound.playSpell('SHIFT');
          triggerCanvasFX('SHIFT', { r: 3, c: 3 }, 'GEMPA CAKRAWALA!');
          pushLog(boardState.turnNumber, boardState.turn, res.logText, 'SPELL');
          setStatusMessage(res.logText);
        }
        return;
      }

      setSelectedCoord(null);
      setActiveSpell(spellId);
      setSpellFirstTarget(null);
      sound.playSelect();

      if (spellId === 'AETHER_SHIELD') {
        setStatusMessage('Pilih 1 bidak kawan untuk diberi +1 Perisai Kristal');
      } else if (spellId === 'CHRONO_FREEZE') {
        setStatusMessage('Pilih 1 bidak lawan (selain Raja) untuk dibekukan');
      } else if (spellId === 'QUANTUM_SWAP') {
        setStatusMessage('Pilih bidak kawan pertama (selain Raja) untuk ditukar');
      }
    },
    [activeSpell, boardState, gameState, opponentType, pushLog, triggerCanvasFX]
  );

  // Handle Tile Click (Player Move or Spell Target)
  const handleTileClick = useCallback(
    (coord: Coord) => {
      if (gameState !== 'PLAYING' || boardState.winner) return;
      if (opponentType === 'AI' && boardState.turn === 'b') return;

      const activeColor = boardState.turn;
      const clickedPiece = boardState.grid[coord.r][coord.c];

      // 1. If a Spell is currently awaiting target selection
      if (activeSpell) {
        if (activeSpell === 'AETHER_SHIELD') {
          if (clickedPiece && clickedPiece.color === activeColor) {
            const res = executeSpell(boardState, 'AETHER_SHIELD', [coord]);
            if (res) {
              setBoardState(res.nextState);
              setActiveSpell(null);
              sound.playSpell('SHIELD');
              triggerCanvasFX('SPELL', coord, '+1 PERISAI!');
              pushLog(boardState.turnNumber, activeColor, res.logText, 'SPELL');
              setStatusMessage(res.logText);
              return;
            }
          }
          setStatusMessage('Target tidak valid · Pilih bidak kawan Anda');
          return;
        }

        if (activeSpell === 'CHRONO_FREEZE') {
          if (clickedPiece && clickedPiece.color !== activeColor && clickedPiece.type !== 'k') {
            const res = executeSpell(boardState, 'CHRONO_FREEZE', [coord]);
            if (res) {
              setBoardState(res.nextState);
              setActiveSpell(null);
              sound.playSpell('FREEZE');
              triggerCanvasFX('SPELL', coord, 'BEKU WAKTU!');
              pushLog(boardState.turnNumber, activeColor, res.logText, 'SPELL');
              setStatusMessage(res.logText);
              return;
            }
          }
          setStatusMessage('Target tidak valid · Pilih bidak lawan selain Raja');
          return;
        }

        if (activeSpell === 'QUANTUM_SWAP') {
          if (!clickedPiece || clickedPiece.color !== activeColor || clickedPiece.type === 'k') {
            setStatusMessage('Pilih bidak kawan selain Raja untuk Tukar Kuantum');
            return;
          }
          if (!spellFirstTarget) {
            setSpellFirstTarget(coord);
            sound.playSelect();
            setStatusMessage(
              `Bidak pertama (${coordToAlgebraic(coord)}) dipilih · Pilih bidak kawan kedua`
            );
            return;
          }
          if (spellFirstTarget.r === coord.r && spellFirstTarget.c === coord.c) {
            setSpellFirstTarget(null);
            setStatusMessage('Pilih bidak kawan pertama untuk Tukar Kuantum');
            return;
          }
          const res = executeSpell(boardState, 'QUANTUM_SWAP', [spellFirstTarget, coord]);
          if (res) {
            setBoardState(res.nextState);
            setActiveSpell(null);
            setSpellFirstTarget(null);
            sound.playSpell('SWAP');
            triggerCanvasFX('TELEPORT', coord, 'TUKAR KUANTUM!');
            pushLog(boardState.turnNumber, activeColor, res.logText, 'SPELL');
            setStatusMessage(res.logText);
          }
          return;
        }
      }

      // 2. If a piece is already selected, check if clicked square is a legal move
      if (selectedCoord) {
        const legalMoves = getLegalMovesForPiece(boardState, selectedCoord);
        const move = legalMoves.find(
          (m) => m.to.r === coord.r && m.to.c === coord.c
        );

        if (move) {
          const movingPiece = boardState.grid[selectedCoord.r][selectedCoord.c]!;
          const exec = executeMove(boardState, move, gameMode);
          setBoardState(exec.nextState);
          setSelectedCoord(null);

          // Audio & Visual Feedback
          if (exec.logKind === 'SHIELD_BREAK') {
            sound.playShieldBreak();
            triggerCanvasFX('SHIELD_BREAK', move.to, 'PERISAI PECAH!', {
              piece: movingPiece,
              from: move.from,
              to: move.to,
              isRecoil: true,
            });
          } else if (exec.logKind === 'CAPTURE') {
            sound.playCapture(true);
            triggerCanvasFX(
              'CAPTURE',
              move.to,
              exec.absorbedSoul
                ? `SERAP ${SOUL_TRAIT_INFO[exec.absorbedSoul].name.toUpperCase()}!`
                : 'TUMBANG!',
              {
                piece: movingPiece,
                from: move.from,
                to: move.to,
              }
            );
          } else if (exec.logKind === 'TELEPORT') {
            sound.playTeleport();
            triggerCanvasFX('TELEPORT', exec.impactCoord, 'LOMPATAN RIFT!', {
              piece: movingPiece,
              from: move.from,
              to: exec.impactCoord,
            });
          } else {
            sound.playMove();
            triggerCanvasFX(
              exec.triggeredShift ? 'SHIFT' : 'MOVE',
              exec.impactCoord,
              exec.triggeredShift ? 'PERGESERAN KUANTUM!' : undefined,
              {
                piece: movingPiece,
                from: move.from,
                to: exec.impactCoord,
              }
            );
          }

          pushLog(boardState.turnNumber, activeColor, exec.logText, exec.logKind);

          if (exec.nextState.winner) {
            sound.playVictory(exec.nextState.winner === 'w');
            setGameState('GAME_OVER');
            return;
          }

          if (exec.nextState.inCheck[exec.nextState.turn]) {
            sound.playCheck();
          }

          setStatusMessage(
            opponentType === 'AI' && exec.nextState.turn === 'b'
              ? 'AI Cakrawala sedang memperhitungkan taktik...'
              : `Giliran ${exec.nextState.turn === 'w' ? 'Putih' : 'Hitam'} · ${exec.logText}`
          );
          return;
        }
      }

      // 3. Otherwise, select friendly piece
      if (clickedPiece && clickedPiece.color === activeColor) {
        if (clickedPiece.frozenTurns > 0) {
          setStatusMessage(
            `${PIECE_NAMES_ID[clickedPiece.type]} di ${coordToAlgebraic(
              coord
            )} sedang membeku (${clickedPiece.frozenTurns} giliran)!`
          );
          return;
        }
        setSelectedCoord(coord);
        sound.playSelect();
        const traitLabel =
          clickedPiece.soulTrait !== 'NONE'
            ? ` · ${SOUL_TRAIT_INFO[clickedPiece.soulTrait].name}`
            : '';
        setStatusMessage(
          `${PIECE_NAMES_ID[clickedPiece.type]} (${coordToAlgebraic(coord)}) dipilih · Perisai: ${
            clickedPiece.armor
          }${traitLabel}`
        );
      } else {
        setSelectedCoord(null);
      }
    },
    [
      activeSpell,
      boardState,
      gameMode,
      gameState,
      opponentType,
      pushLog,
      selectedCoord,
      spellFirstTarget,
      triggerCanvasFX,
    ]
  );

  // AI Turn Execution with visible Windup Telegraph
  useEffect(() => {
    if (
      gameState !== 'PLAYING' ||
      opponentType !== 'AI' ||
      boardState.turn !== 'b' ||
      boardState.winner
    ) {
      return;
    }

    const decision = chooseAIAction(boardState, difficulty, gameMode);
    if (!decision) return;

    // Step 1: Wait 250ms, then start AI Windup Telegraph (laser target line on canvas)
    const t1 = window.setTimeout(() => {
      sound.playWindup();
      let step = 0;
      const totalSteps = 10;
      const intervalId = window.setInterval(() => {
        step += 1;
        setAiTelegraph({
          from: decision.move.from,
          to: decision.move.to,
          isCapture: decision.move.isCapture,
          progress: Math.min(1, step / totalSteps),
        });
        if (step >= totalSteps) {
          window.clearInterval(intervalId);
        }
      }, 40);
      aiTimersRef.current.push(intervalId);
    }, 220);

    // Step 2: Execute AI Spell (if any) + AI Move after windup completes (700ms)
    const t2 = window.setTimeout(() => {
      setAiTelegraph(null);
      let working = boardState;

      if (decision.spell) {
        const spellRes = executeSpell(
          working,
          decision.spell.id,
          decision.spell.targets
        );
        if (spellRes) {
          working = spellRes.nextState;
          sound.playSpell(decision.spell.id === 'CHRONO_FREEZE' ? 'FREEZE' : 'SHIELD');
          pushLog(working.turnNumber, 'b', `[AI] ${spellRes.logText}`, 'SPELL');
        }
      }

      const movingPiece = working.grid[decision.move.from.r][decision.move.from.c];
      const exec = executeMove(working, decision.move, gameMode);
      setBoardState(exec.nextState);

      if (movingPiece) {
        if (exec.logKind === 'SHIELD_BREAK') {
          sound.playShieldBreak();
          triggerCanvasFX('SHIELD_BREAK', decision.move.to, 'PERISAI PECAH!', {
            piece: movingPiece,
            from: decision.move.from,
            to: decision.move.to,
            isRecoil: true,
          });
        } else if (exec.logKind === 'CAPTURE') {
          sound.playCapture(true);
          triggerCanvasFX('CAPTURE', decision.move.to, 'SERANGAN AI!', {
            piece: movingPiece,
            from: decision.move.from,
            to: decision.move.to,
          });
        } else if (exec.logKind === 'TELEPORT') {
          sound.playTeleport();
          triggerCanvasFX('TELEPORT', exec.impactCoord, 'LOMPATAN RIFT!', {
            piece: movingPiece,
            from: decision.move.from,
            to: exec.impactCoord,
          });
        } else {
          sound.playMove();
          triggerCanvasFX(
            exec.triggeredShift ? 'SHIFT' : 'MOVE',
            exec.impactCoord,
            exec.triggeredShift ? 'PERGESERAN KUANTUM!' : undefined,
            {
              piece: movingPiece,
              from: decision.move.from,
              to: exec.impactCoord,
            }
          );
        }
      }

      pushLog(working.turnNumber, 'b', exec.logText, exec.logKind);

      if (exec.nextState.winner) {
        sound.playVictory(exec.nextState.winner === 'w');
        setGameState('GAME_OVER');
        return;
      }

      if (exec.nextState.inCheck.w) {
        sound.playCheck();
        setStatusMessage('PERINGATAN: Raja Putih sedang terancam! Lindungi Raja Anda.');
      } else {
        setStatusMessage(`Giliran Putih · AI melangkah: ${exec.logText}`);
      }
    }, 720);

    aiTimersRef.current.push(t1, t2);
    return () => clearAiTimers();
  }, [
    boardState,
    clearAiTimers,
    difficulty,
    gameMode,
    gameState,
    opponentType,
    pushLog,
    triggerCanvasFX,
  ]);

  // Global Keyboard Controls (Edge-triggered actions)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (gameState === 'TITLE_MENU') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startNewGame();
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (showRulesModal) {
          setShowRulesModal(false);
          return;
        }
        if (activeSpell) {
          setActiveSpell(null);
          setSpellFirstTarget(null);
          setStatusMessage('Mantra dibatalkan');
          return;
        }
        if (selectedCoord) {
          setSelectedCoord(null);
          return;
        }
        setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : 'PLAYING'));
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        const muted = sound.toggleMute();
        setIsMuted(muted);
        return;
      }

      if (gameState !== 'PLAYING') return;

      // Hotkeys 1-4 for Spells
      if (e.key === '1') handleSelectSpell('AETHER_SHIELD');
      if (e.key === '2') handleSelectSpell('CHRONO_FREEZE');
      if (e.key === '3') handleSelectSpell('QUANTUM_SWAP');
      if (e.key === '4') handleSelectSpell('TECTONIC_SHIFT');

      // Cursor navigation (WASD / Arrows)
      let dr = 0;
      let dc = 0;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dr = -1;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dr = 1;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dc = -1;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dc = 1;

      if (dr !== 0 || dc !== 0) {
        e.preventDefault();
        setCursorCoord((prev) => {
          const nr = inBounds(prev.r + dr, prev.c) ? prev.r + dr : prev.r;
          const nc = inBounds(prev.r, prev.c + dc) ? prev.c + dc : prev.c;
          return { r: nr, c: nc };
        });
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleTileClick(cursorCoord);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeSpell,
    cursorCoord,
    gameState,
    handleSelectSpell,
    handleTileClick,
    selectedCoord,
    showRulesModal,
    startNewGame,
  ]);

  // Inspected tile details (from hover or selection)
  const inspectCoord = hoveredCoord ?? selectedCoord ?? cursorCoord;
  const inspectedPiece = boardState.grid[inspectCoord.r][inspectCoord.c];
  const inspectedTerrain = boardState.terrain[inspectCoord.r][inspectCoord.c];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0B0F17] text-[#F1F5F9] select-none">
      {/* Isolated 60fps Canvas Playfield */}
      <div className="absolute inset-0 z-0">
        <RiftBoardCanvas
          gameState={gameState}
          gameMode={gameMode}
          boardState={boardState}
          selectedCoord={selectedCoord}
          cursorCoord={cursorCoord}
          activeSpell={activeSpell}
          spellFirstTarget={spellFirstTarget}
          aiTelegraph={aiTelegraph}
          fxTrigger={fxTrigger}
          onTileClick={handleTileClick}
          onHoverTile={setHoveredCoord}
          onCursorMove={setCursorCoord}
        />
      </div>

      {/* =====================================================================
          STATE 1: TITLE MENU (Full-Viewport Game Shell with Live-World Backdrop)
         ===================================================================== */}
      {gameState === 'TITLE_MENU' && (
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 md:p-12 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/80 to-[#0B0F17]/40">
          {/* Top Perimeter Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono-num">
              <span>EDISI TAKTIS DIMENSI</span>
              <span aria-hidden="true">·</span>
              <span>64 PETAK ELEMEN</span>
              <span aria-hidden="true">·</span>
              <span>PENYERAPAN JIWA</span>
            </div>
            <button
              onClick={() => {
                const m = sound.toggleMute();
                setIsMuted(m);
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900/90 border border-slate-700/80 rounded-lg hover:border-amber-400/60 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isMuted ? 'Suara: Mati [M]' : 'Suara: Aktif [M]'}
            </button>
          </div>

          {/* Centerpiece Lockup with 35%+ negative space */}
          <div className="my-auto max-w-3xl mx-auto w-full flex flex-col items-center text-center">
            {/* Bespoke Inline SVG Emblem & Lockup */}
            <svg
              viewBox="0 0 120 120"
              className="w-20 h-20 mb-4 text-amber-400"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="60"
                cy="60"
                r="52"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                opacity="0.45"
              />
              <polygon
                points="60,10 105,60 60,110 15,60"
                stroke="#38BDF8"
                strokeWidth="1.8"
                fill="rgba(56, 189, 248, 0.08)"
              />
              {/* Crown + Rift Spear Silhouette */}
              <path
                d="M36 78L28 46L48 58L60 30L72 58L92 46L84 78H36Z"
                fill="currentColor"
                stroke="#F8FAFC"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="34" y="82" width="52" height="7" rx="2" fill="#38BDF8" />
            </svg>

            <p className="text-xs font-mono-num tracking-widest text-sky-400 mb-2">
              CATUR EVOLUSI · PERISAI · PORTAL RIFT · MANTRA WAKTU
            </p>
            <h1
              className="font-display font-bold tracking-tight text-white mb-3"
              style={{ fontSize: 'clamp(2.25rem, 4.5vw, 3.75rem)', textWrap: 'balance' }}
            >
              CAKRAWALA: RIFT CHESS
            </h1>
            <p className="text-sm md:text-base text-slate-300 max-w-xl mb-8 leading-relaxed">
              Bukan catur biasa. Bidak berat dilindungi <strong className="text-sky-300 font-semibold">Perisai Kristal</strong>, setiap bidak yang menumbangkan lawan menyerap <strong className="text-amber-300 font-semibold">Kekuatan Jiwa</strong> mereka, dan papan pertempuran dipenuhi <strong className="text-purple-300 font-semibold">Portal Dimensi</strong> serta <strong className="text-rose-300 font-semibold">Kawah Bara</strong>.
            </p>

            {/* Interactive Mode & Difficulty Configuration Panel */}
            <div className="w-full max-w-2xl bg-[#111827]/95 border border-slate-800 rounded-xl p-5 mb-6 text-left shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {(
                  [
                    {
                      id: 'RIFT_TACTICS',
                      title: '01. Cakrawala Rift',
                      desc: 'Portal teleportasi, Perisai Kristal, Serap Jiwa & 4 Mantra Aether.',
                    },
                    {
                      id: 'FOG_OF_WAR',
                      title: '02. Kabut Perang',
                      desc: 'Pergerakan lawan tersembunyi di balik kabut gelap di luar jarak pandang.',
                    },
                    {
                      id: 'QUANTUM_SHIFT',
                      title: '03. Gempa Kuantum',
                      desc: 'Petak elemen di tengah papan bergeser secara dinamis tiap 4 putaran.',
                    },
                  ] as const
                ).map((m) => {
                  const active = gameMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setGameMode(m.id);
                        setBoardState(createInitialBoard(m.id));
                        sound.playSelect();
                      }}
                      className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-slate-800/90 border-amber-400/80 text-white shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold text-amber-400 mb-1 whitespace-nowrap">
                        {m.title}
                      </div>
                      <div className="text-xs leading-snug text-slate-300">{m.desc}</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
                {/* Opponent Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 mr-1">Lawan:</span>
                  <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                    <button
                      onClick={() => {
                        setOpponentType('AI');
                        sound.playSelect();
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        opponentType === 'AI'
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      AI Taktis
                    </button>
                    <button
                      onClick={() => {
                        setOpponentType('LOCAL_2P');
                        sound.playSelect();
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        opponentType === 'LOCAL_2P'
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      2 Pemain Lokal
                    </button>
                  </div>
                </div>

                {/* AI Difficulty Selector */}
                {opponentType === 'AI' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 mr-1">Tingkat AI:</span>
                    <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                      {(
                        [
                          { id: 'NOVICE', label: 'Pemula' },
                          { id: 'TACTICIAN', label: 'Taktisi' },
                          { id: 'GRANDMASTER', label: 'Grandmaster' },
                        ] as const
                      ).map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setDifficulty(d.id);
                            sound.playSelect();
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            difficulty === d.id
                              ? 'bg-sky-400 text-slate-950 font-semibold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Primary CTA Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => startNewGame()}
                className="px-8 py-3.5 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-transform active:scale-95 shadow-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                Mulai Pertempuran [Enter]
              </button>
              <button
                onClick={() => setShowRulesModal(true)}
                className="px-5 py-3.5 text-sm font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Aturan & Elemen Unik
              </button>
            </div>
          </div>

          {/* Flat Control-Hint Line */}
          <div className="text-center text-xs text-slate-400 font-mono-num">
            Klik / WASD Pilih Bidak · 1–4 Mantra Aether · Spasi Konfirmasi · Esc Jeda
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 2: ACTIVE PLAY HUD (Perimeter Low-Occlusion Overlays)
         ===================================================================== */}
      {gameState !== 'TITLE_MENU' && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 md:p-5">
          {/* TOP PERIMETER BAR */}
          <div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto bg-[#0F172A]/95 border border-slate-800 rounded-xl px-4 py-2.5 shadow-lg">
            {/* Left: Game Title & Mode Readout */}
            <div className="flex items-center gap-3">
              <span className="font-display font-bold text-sm md:text-base text-amber-400 whitespace-nowrap shrink-0">
                CAKRAWALA
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-slate-300 font-mono-num whitespace-nowrap">
                Putaran {boardState.turnNumber}
              </span>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-sky-300 hidden sm:inline whitespace-nowrap">
                {gameMode === 'RIFT_TACTICS'
                  ? 'Mode Rift Taktis'
                  : gameMode === 'FOG_OF_WAR'
                  ? 'Mode Kabut Perang'
                  : 'Mode Gempa Kuantum'}
              </span>
            </div>

            {/* Center: Turn & Aether Meters */}
            <div className="flex items-center gap-5 font-mono-num text-xs">
              {/* White Status */}
              <div
                className={`flex items-center gap-2 px-2.5 py-1 rounded-md border ${
                  boardState.turn === 'w'
                    ? 'bg-amber-500/15 border-amber-400/70 text-amber-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                }`}
              >
                <span className="font-semibold">PUTIH</span>
                <span>·</span>
                <span className="text-sky-300">
                  Aether: {boardState.aether.w}/{boardState.maxAether}
                </span>
                {boardState.inCheck.w && (
                  <span className="text-rose-400 font-bold">· BAHAYA!</span>
                )}
              </div>

              {/* Black Status */}
              <div
                className={`flex items-center gap-2 px-2.5 py-1 rounded-md border ${
                  boardState.turn === 'b'
                    ? 'bg-purple-500/20 border-purple-400/70 text-purple-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                }`}
              >
                <span className="font-semibold">
                  {opponentType === 'AI' ? 'AI HITAM' : 'HITAM'}
                </span>
                <span>·</span>
                <span className="text-sky-300">
                  Aether: {boardState.aether.b}/{boardState.maxAether}
                </span>
                {boardState.inCheck.b && (
                  <span className="text-rose-400 font-bold">· BAHAYA!</span>
                )}
              </div>
            </div>

            {/* Right: Utility Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRulesModal(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Panduan Elemen
              </button>
              <button
                onClick={() => {
                  const m = sound.toggleMute();
                  setIsMuted(m);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isMuted ? 'Suara: Mati' : 'Suara: Aktif'}
              </button>
              <button
                onClick={() =>
                  setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : 'PLAYING'))
                }
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 hover:border-amber-400/60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Menu [Esc]
              </button>
            </div>
          </div>

          {/* MIDDLE SIDE PANELS (Desktop Left & Right Contextual Readouts — Low Occlusion) */}
          <div className="hidden xl:flex items-start justify-between my-auto pointer-events-none">
            {/* Left Inspector Card: Tile Terrain & Inspected Piece */}
            <div className="w-64 pointer-events-auto bg-[#0F172A]/95 border border-slate-800 rounded-xl p-4 shadow-xl">
              <div className="text-xs font-mono-num text-slate-400 mb-2">
                INSPEKSI PETAK · {coordToAlgebraic(inspectCoord).toUpperCase()}
              </div>

              {/* Terrain Info */}
              <div className="mb-3 pb-3 border-b border-slate-800">
                <div
                  className="text-sm font-bold mb-1"
                  style={{ color: TERRAIN_INFO[inspectedTerrain].color }}
                >
                  {TERRAIN_INFO[inspectedTerrain].name}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {TERRAIN_INFO[inspectedTerrain].desc}
                </p>
              </div>

              {/* Piece Info */}
              {inspectedPiece ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-white">
                      {PIECE_NAMES_ID[inspectedPiece.type]}{' '}
                      {inspectedPiece.color === 'w' ? 'Putih' : 'Hitam'}
                    </span>
                    <span className="text-xs font-mono-num text-sky-300">
                      Perisai: {inspectedPiece.armor}/{inspectedPiece.maxArmor}
                    </span>
                  </div>
                  <div className="text-xs text-amber-300 font-medium mb-1">
                    Jiwa: {SOUL_TRAIT_INFO[inspectedPiece.soulTrait].name}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {SOUL_TRAIT_INFO[inspectedPiece.soulTrait].desc}
                  </p>
                  {inspectedPiece.frozenTurns > 0 && (
                    <p className="text-xs text-sky-400 font-semibold mt-1.5">
                      Membeku ({inspectedPiece.frozenTurns} giliran tersisa)
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Petak kosong. Arahkan kursor ke bidak untuk melihat Perisai & Kekuatan Jiwa.
                </div>
              )}
            </div>

            {/* Right Combat Log */}
            <div className="w-64 pointer-events-auto bg-[#0F172A]/95 border border-slate-800 rounded-xl p-4 shadow-xl">
              <div className="text-xs font-mono-num text-slate-400 mb-2">
                RIWAYAT PERTEMPURAN
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {combatLog.slice(0, 6).map((ev) => (
                  <div
                    key={ev.id}
                    className="text-xs leading-snug pb-1.5 border-b border-slate-800/70 last:border-none"
                  >
                    <span className="font-mono-num text-slate-500 mr-1.5">
                      #{ev.turnNumber}
                    </span>
                    <span
                      className={
                        ev.kind === 'CAPTURE'
                          ? 'text-amber-300 font-medium'
                          : ev.kind === 'SHIELD_BREAK'
                          ? 'text-sky-300'
                          : ev.kind === 'TELEPORT'
                          ? 'text-purple-300'
                          : ev.kind === 'SPELL'
                          ? 'text-emerald-300'
                          : 'text-slate-300'
                      }
                    >
                      {ev.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM PERIMETER DOCK: Aether Spells [1-4] & Live Status Bar */}
          <div className="flex flex-col items-center gap-2 pointer-events-auto">
            {/* Status instruction line */}
            <div className="px-4 py-1.5 rounded-lg bg-[#0F172A]/95 border border-slate-800 text-xs text-slate-200 font-medium shadow">
              {statusMessage}
            </div>

            {/* 4 Tactical Chrono/Aether Spells */}
            <div className="flex flex-wrap items-center justify-center gap-2 bg-[#0F172A]/95 border border-slate-800 rounded-xl p-2 shadow-xl">
              {SPELLS.map((sp) => {
                const currentAether = boardState.aether[boardState.turn];
                const canAfford =
                  currentAether >= sp.cost &&
                  !(opponentType === 'AI' && boardState.turn === 'b');
                const isSelected = activeSpell === sp.id;

                return (
                  <button
                    key={sp.id}
                    onClick={() => handleSelectSpell(sp.id)}
                    disabled={!canAfford && !isSelected}
                    title={sp.shortDesc}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-left transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-sky-500/25 border-sky-400 text-white shadow-sm'
                        : canAfford
                        ? 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-amber-400/70 hover:text-white'
                        : 'bg-slate-950/60 border-slate-800/60 text-slate-500 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span className="font-mono-num text-xs font-bold text-amber-400">
                      [{sp.hotkey}]
                    </span>
                    <div>
                      <div className="text-xs font-semibold leading-none mb-0.5">
                        {sp.name}
                      </div>
                      <div className="text-[11px] font-mono-num text-sky-400">
                        {sp.cost} Aether
                      </div>
                    </div>
                  </button>
                );
              })}

              <button
                onClick={() => startNewGame()}
                className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-700/80 hover:border-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ulangi Papan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 3: PAUSE / GAME OVER MODAL
         ===================================================================== */}
      {(gameState === 'PAUSED' || gameState === 'GAME_OVER') && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
          <div className="w-full max-w-md bg-[#111827] border border-slate-700 rounded-xl p-6 text-center shadow-2xl">
            <p className="text-xs font-mono-num text-amber-400 mb-1">
              {gameState === 'GAME_OVER' ? 'PERTEMPURAN SELESAI' : 'PERMAINAN DIJEDA'}
            </p>
            <h2 className="font-display text-2xl font-bold text-white mb-2">
              {gameState === 'GAME_OVER'
                ? boardState.winner === 'w'
                  ? 'Kemenangan Putih!'
                  : 'Kemenangan Hitam!'
                : 'Jedakan Taktik'}
            </h2>
            <p className="text-sm text-slate-300 mb-6">
              {gameState === 'GAME_OVER'
                ? boardState.winReason
                : 'Pilih untuk melanjutkan pertempuran atau kembali ke menu utama.'}
            </p>

            {/* Summary Metrics */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-lg mb-6 font-mono-num">
              <div>
                <div className="text-xs text-slate-400">Putaran</div>
                <div className="text-base font-bold text-white">
                  {boardState.turnNumber}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Tangkapan Putih</div>
                <div className="text-base font-bold text-amber-400">
                  {boardState.capturedBy.w.length}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Tangkapan Hitam</div>
                <div className="text-base font-bold text-purple-400">
                  {boardState.capturedBy.b.length}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {gameState === 'PAUSED' && (
                <button
                  onClick={() => setGameState('PLAYING')}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Lanjutkan Main [Esc]
                </button>
              )}
              <button
                onClick={() => startNewGame()}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Main Lagi
              </button>
              <button
                onClick={() => {
                  clearAiTimers();
                  setGameState('TITLE_MENU');
                }}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Menu Utama
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CODEX / RULES MODAL (Aturan & Elemen Unik Cakrawala)
         ===================================================================== */}
      {showRulesModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#111827] border border-slate-700 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div>
                <h2 className="font-display text-xl font-bold text-amber-400">
                  Hukum & Elemen Cakrawala Chess
                </h2>
                <p className="text-xs text-slate-400">
                  4 mekanik utama yang membedakan Cakrawala dari catur konvensional
                </p>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                Tutup [Esc]
              </button>
            </div>

            <div className="space-y-5 text-xs leading-relaxed text-slate-300">
              <div>
                <h3 className="text-sm font-bold text-sky-300 mb-1">
                  01. Sistem Perisai Kristal & Serangan Mental (Shield Strike)
                </h3>
                <p>
                  Bidak berat (<strong>Benteng, Menteri, Raja</strong>) memulai permainan dengan{' '}
                  <strong>1 Perisai Kristal</strong> (angka biru di kanan atas bidak). Saat diserang biasa, perisai akan pecah menahan serangan dan penyerang terpental kembali ke petak asalnya! Serangan berikutnya baru menumbangkan bidak tersebut.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-amber-300 mb-1">
                  02. Penyerapan Jiwa Lawan (Soul Absorption)
                </h3>
                <p>
                  Bidak pertama kali yang menumbangkan bidak lawan akan menyerap jiwa mereka dan berevolusi:
                </p>
                <ul className="mt-1.5 space-y-1 text-slate-300">
                  <li>
                    · Menumbangkan <strong>Kuda</strong> → Mendapat <strong>Jiwa Kuda [L]</strong> (bisa ikut melompat huruf L).
                  </li>
                  <li>
                    · Menumbangkan <strong>Gajah / Pion</strong> → Mendapat <strong>Langkah Bayangan [P]</strong> (bisa bergeser 1 petak ke 8 arah sekitar).
                  </li>
                  <li>
                    · Menumbangkan <strong>Benteng / Menteri</strong> → Mendapat <strong>Tombak Bara [B]</strong> (serangannya langsung menembus Perisai lawan!).
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-purple-300 mb-1">
                  03. Petak Medan Elemen di Papan
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-purple-300">Portal Rift α & β</div>
                    <p className="text-slate-400">
                      Melangkah ke salah satu portal langsung memindahkan bidak ke portal pasangannya jika kosong.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-sky-300">Sumur Aether (+AETHER)</div>
                    <p className="text-slate-400">
                      Menghasilkan +1 Energi Aether tiap giliran & memberi +1 Perisai saat pertama kali ditempati.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-emerald-300">Hutan Lindung (LINDUNG)</div>
                    <p className="text-slate-400">
                      Bidak di petak ini kebal terhadap serangan jarak jauh (&gt; 2 petak). Lawan harus mendekat!
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-rose-300">Kawah Bara (BARA)</div>
                    <p className="text-slate-400">
                      Menyerang dari petak ini menembus Perisai lawan dalam sekali hantam.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-emerald-300 mb-1">
                  04. Empat Mantra Aether (Tanpa Menguras Giliran Langkah!)
                </h3>
                <p>
                  Gunakan Energi Aether di bilah bawah (tombol <strong>[1]–[4]</strong>) sebelum melangkah untuk memasang Perisai Kristal, membekukan bidak lawan dengan <strong>Bekukan Waktu</strong>, menukar posisi 2 bidak kawan dengan <strong>Tukar Kuantum</strong>, atau memicu <strong>Gempa Cakrawala</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
