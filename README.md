# Cakrawala: Rift Chess — A New Dimension of Tactical Chess

**Cakrawala: Rift Chess** is a turn-based strategy game that reworks classic chess rules into a full-action tactical battle. Unlike conventional chess, where every capture eliminates a piece instantly and every square is passive, **Cakrawala** introduces **Crystal Shields**, **Soul Absorption from Defeated Enemies**, **Elemental Terrain Tiles**, **Aether Spells**, and **Fog of War**.

---

## Main features & mechanics

### 1. Crystal Shield System & Mental Strike (Shield Strike & Recoil)
- Heavy pieces (**Rook**, **Queen**, and **King**) start the game with **1 Crystal Shield** (marked by a blue number indicator in the top-right corner of the piece).
- When a shielded piece is attacked by a normal strike, it does **not fall immediately**:
  - The shield breaks to absorb the hit (`Shield -1`).
  - The attacking piece **rebounds (recoil)** back to its original square.
  - The attacker still gains **+1 Aether Energy** for successfully breaking the enemy shield.
- A second attack against a piece that has already lost its shield finally brings it down.

### 2. Soul Absorption from Defeated Enemies
Every piece (except the King) that brings down an enemy piece for the first time absorbs the **Soul** of the defeated piece and permanently evolves:

| Defeated piece | Absorbed soul | Symbol | Evolution effect on the attacking piece |
| :--- | :--- | :---: | :--- |
| **Knight** | **Knight Soul** | `L` | Can also move in an L-shape like a Knight in addition to its normal movement. |
| **Bishop / Pawn** | **Shadow Step** | `P` | Can shift 1 square in any direction (8 surrounding squares) like a King. |
| **Rook / Queen** | **Ember Spear** | `B` | Attacks become **Piercing** — instantly destroy a shielded piece in a single strike without rebounding! |

### 3. Elemental terrain tiles on the board
The 8×8 board has symmetric elemental tiles in the central battle area:
- **Rift Portal ($\alpha$ & $\beta$)**: a pair of dimensional portals. A piece that stops on `RIFT α` instantly teleports to `RIFT β` if the destination square is empty (and vice versa).
- **Aether Well (`+AETHER`)**: grants **+1 extra Aether Energy** at the start of each turn while controlled by your piece, and grants **+1 Crystal Shield** the first time it is occupied.
- **Guardian Forest (`LINDUNG`)**: protects pieces inside it from ranged attacks. Opponents cannot capture a piece on this square from more than 2 squares away.
- **Ember Crater (`BARA`)**: any piece that attacks from this square gains the **Piercing Attack** effect, instantly eliminating a shielded piece in a single strike.

### 4. Four Aether Spells (Chrono & Rift Spells)
Players accumulate **Aether Energy** each turn (+1 base per turn, +1 per Aether Well controlled, and +2 per enemy defeated, maximum 10 Aether). Spells can be activated **before moving** without consuming the piece's move action:

1. **`[1]` Crystal Shield (2 Aether)**: grants +1 Crystal Shield to one allied piece (maximum 2 Shields).
2. **`[2]` Freeze Time (3 Aether)**: freezes 1 enemy piece (except the King) for a full turn so it cannot move or attack.
3. **`[3]` Quantum Swap (3 Aether)**: instantly swaps the positions of 2 allied pieces (except the King) on the board.
4. **`[4]` Rift Quake (4 Aether)**: dynamically shifts the elemental tile layout in the board's middle rows while granting +1 Shield to your King.

---

## Game modes & opponents

### 3 tactical modes
- **01. Cakrawala Rift**: standard full mode with Rift Portals, Aether Wells, Guardian Forest, Ember Crater, Soul Absorption, and 4 Aether Spells.
- **02. Fog of War**: squares beyond an allied piece's sight range are covered in dark fog. Enemy movement is only visible if it enters your piece's watch radius or stands on an Aether Well.
- **03. Quantum Shift**: a living battlefield — every 4 full turns, tectonic currents automatically shift the positions of the elemental tiles in the center of the board.

### Opponent options
- **Tactical AI (3 difficulty levels)**:
  - **Novice**: AI plays more casually to help you learn the elemental and shield mechanics.
  - **Tactician**: AI evaluates shield value, elemental tiles, and actively uses Aether Spells.
  - **Grandmaster**: AI calculates counter-moves, targets Aether Wells, and combines spells with piercing attacks.
- **2-Player Local (Pass & Play)**: take turns playing White and Black on a single device.

---

## Game controls

| Input / Button | Function |
| :--- | :--- |
| **Left Mouse Click** | Select a piece, select a destination square, or select a spell target |
| **`W` `A` `S` `D` / Arrow Keys** | Move the square cursor on the board |
| **`Space` / `Enter`** | Select a piece / confirm a move on the cursor (or start the game on the title screen) |
| **`1` `2` `3` `4`** | Activate or cancel Aether Spells 1–4 |
| **`M`** | Toggle sound effects (*Mute / Unmute*) |
| **`Esc`** | Cancel spell/piece selection or open the *Pause* menu |

---

## Project structure

```text
├── index.html                  # HTML entry point & font config (Cinzel, Plus Jakarta Sans, JetBrains Mono)
├── metadata.json               # App metadata
├── src/
│   ├── main.tsx                # React DOM bootstrap
│   ├── App.tsx                 # Main game shell, HUD, mode selector, and Aether Spell controls
│   ├── index.css               # Tailwind CSS v4 config & typography variables
│   ├── components/
│   │   └── RiftBoardCanvas.tsx # 60fps HTML5 Canvas renderer, particle effects, hitstop, & AI attack telegraphs
│   └── game/
│       ├── types.ts            # Type definitions for pieces, souls, elemental tiles, and spells
│       ├── engine.ts           # Move rules, shields, rift portals, Fog of War, and AI evaluation
│       └── sound.ts            # Procedural sound-effect synthesizer based on the Web Audio API
```

---

## Running locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server (port 3000):
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```
