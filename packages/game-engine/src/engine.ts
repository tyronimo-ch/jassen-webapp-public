import { bieterEngine } from "./modes/bieter";
import { customEngine } from "./modes/custom";
import { differenzlerEngine } from "./modes/differenzler";
import { pandurEngine } from "./modes/pandur";
import { DEFAULT_TARGET_SCORE, schieberEngine } from "./modes/schieber";
import type { GameMode, ModeEngine, Player, RoomState } from "./types";

const ENGINES: Record<GameMode, ModeEngine> = {
  schieber: schieberEngine,
  differenzler: differenzlerEngine,
  custom: customEngine,
  pandur: pandurEngine,
  bieter: bieterEngine,
};

export function getModeEngine(mode: GameMode): ModeEngine {
  const engine = ENGINES[mode];
  if (!engine) throw new Error(`Unknown game mode: ${mode}`);
  return engine;
}

/** Build a fresh lobby-phase room state. */
export function createInitialState(
  code: string,
  mode: GameMode,
  players: Player[],
  targetScore: number = DEFAULT_TARGET_SCORE
): RoomState {
  return {
    code,
    mode,
    players,
    phase: "lobby",
    roundIndex: 0,
    dealerIndex: 0,
    hands: {},
    currentTrick: [],
    bids: {},
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    tricksWon: {},
    roundPoints: {},
    turnPlayerId: null,
    trumpMode: null,
    schiebenUsed: false,
    stoeckBonus: {},
    targetScore,
    trumpFactor: 1,
    handsRevealed: false,
  };
}

/**
 * Advance to the next round from a roundEnd state: bump the round index, rotate the
 * dealer clockwise, then deal. Used by the host's "next round" action.
 */
export function advanceRound(state: RoomState): RoomState {
  const engine = getModeEngine(state.mode);
  const n = state.players.length || 1;
  const next: RoomState = {
    ...state,
    roundIndex: state.roundIndex + 1,
    dealerIndex: (state.dealerIndex - 1 + n) % n,
  };
  return engine.dealRound(next);
}
