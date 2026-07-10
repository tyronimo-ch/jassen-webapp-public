import { buildDeck, dealFromDeck, shuffle } from "../deck";
import { trickPoints, trickWinner } from "../jassPoints";
import { legalMovesWithTrump } from "../rules";
import type { Card, ModeEngine, RoomState, Suit, TrumpMode } from "../types";

const CARDS_PER_PLAYER = 9;
const LAST_TRICK_BONUS = 5;
export const DIFFERENZLER_ROUNDS = 12;
/** Selectable round counts (host picks in the lobby; stored in state.targetScore). */
export const DIFFERENZLER_ROUND_OPTIONS = [3, 6, 9, 12];
/** Max points obtainable in a round: 152 card points + 5 last-trick bonus. */
export const MAX_PREDICTION = 157;

const SUIT_TRUMPS: TrumpMode[] = ["Rosen", "Eichel", "Schelle", "Schilten"];
// "Klassisch" = suit trumps only; "Gstört" (default) also allows obenabe / undenufe.
const CLASSIC_POOL: TrumpMode[] = SUIT_TRUMPS;
const GSTOERT_POOL: TrumpMode[] = [...SUIT_TRUMPS, "obenabe", "undenufe"];

function playerIdsOf(state: RoomState): string[] {
  return state.players.map((p) => p.id);
}

function leadSuit(state: RoomState): Suit | null {
  return state.currentTrick[0]?.card.suit ?? null;
}

function computeLegalMoves(state: RoomState, playerId: string): Card[] {
  if (state.phase !== "playing" || state.turnPlayerId !== playerId) return [];
  const hand = state.hands[playerId] ?? [];
  return legalMovesWithTrump(hand, leadSuit(state), state.trumpMode);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export const differenzlerEngine: ModeEngine = {
  dealRound(state) {
    const deck = shuffle(buildDeck());
    const ids = playerIdsOf(state);
    const { hands } = dealFromDeck(deck, ids, CARDS_PER_PLAYER);
    const n = ids.length;

    // Round 0: random forehand (encoded into dealerIndex so it rotates cleanly after).
    let dealerIndex = state.dealerIndex;
    if (state.roundIndex === 0) {
      const starterSeat = Math.floor(Math.random() * n);
      dealerIndex = (starterSeat + 1) % n; // forehand = dealer - 1 = starterSeat
    }
    const forehand = ids[(dealerIndex - 1 + n) % n];

    return {
      ...state,
      hands,
      dealerIndex,
      currentTrick: [],
      bids: {},
      tricksWon: Object.fromEntries(ids.map((id) => [id, 0])),
      roundPoints: Object.fromEntries(ids.map((id) => [id, 0])),
      trumpMode: pick(state.differenzlerGstoert === false ? CLASSIC_POOL : GSTOERT_POOL),
      trumpFactor: 1,
      schiebenUsed: false,
      stoeckBonus: {},
      handsRevealed: false,
      phase: "bidding",
      turnPlayerId: forehand,
    };
  },

  /** value is a predicted point total (0..MAX_PREDICTION). */
  submitBid(state, playerId, value) {
    if (state.phase !== "bidding" || state.turnPlayerId !== playerId) return state;
    if (value < 0 || value > MAX_PREDICTION) return state;

    const ids = playerIdsOf(state);
    const n = ids.length;
    const bids = { ...state.bids, [playerId]: value };
    const allBid = ids.every((id) => bids[id] !== undefined);

    if (allBid) {
      const forehand = ids[(state.dealerIndex - 1 + n) % n];
      return { ...state, bids, phase: "playing", turnPlayerId: forehand };
    }

    const currentIdx = ids.indexOf(playerId);
    return { ...state, bids, turnPlayerId: ids[(currentIdx - 1 + n) % n] };
  },

  legalMoves(state, playerId) {
    return computeLegalMoves(state, playerId);
  },

  playCard(state, playerId, card) {
    const legal = computeLegalMoves(state, playerId);
    if (!legal.some((c) => c.suit === card.suit && c.rank === card.rank)) return state;

    const hand = state.hands[playerId] ?? [];
    const newHand = hand.filter((c) => !(c.suit === card.suit && c.rank === card.rank));
    const newTrick = [...state.currentTrick, { playerId, card }];
    const ids = playerIdsOf(state);
    const currentIdx = ids.indexOf(playerId);
    const trickComplete = newTrick.length === ids.length;

    return {
      ...state,
      hands: { ...state.hands, [playerId]: newHand },
      currentTrick: newTrick,
      turnPlayerId: trickComplete ? null : ids[(currentIdx - 1 + ids.length) % ids.length],
    };
  },

  resolveTrick(state) {
    if (!state.trumpMode || state.currentTrick.length !== state.players.length) return state;

    const winnerId = trickWinner(state.currentTrick, state.trumpMode);
    const tricksWon = { ...state.tricksWon, [winnerId]: (state.tricksWon[winnerId] ?? 0) + 1 };

    let points = trickPoints(state.currentTrick, state.trumpMode);
    const wasLastTrick = Object.values(state.hands).every((h) => h.length === 0);
    if (wasLastTrick) points += LAST_TRICK_BONUS;

    const roundPoints = {
      ...state.roundPoints,
      [winnerId]: (state.roundPoints[winnerId] ?? 0) + points,
    };

    return { ...state, tricksWon, roundPoints, currentTrick: [], turnPlayerId: winnerId };
  },

  scoreRound(state) {
    // Penalty = |predicted - actual points|. Stored negatively so higher score = better.
    const scores = { ...state.scores };
    for (const player of state.players) {
      const predicted = state.bids[player.id] ?? 0;
      const actual = state.roundPoints[player.id] ?? 0;
      const penalty = Math.abs(predicted - actual);
      scores[player.id] = (scores[player.id] ?? 0) - penalty;
    }
    return { ...state, scores, phase: "roundEnd" };
  },

  isRoundComplete(state) {
    return playerIdsOf(state).every((id) => (state.hands[id]?.length ?? 0) === 0);
  },

  isGameComplete(state) {
    const rounds = DIFFERENZLER_ROUND_OPTIONS.includes(state.targetScore)
      ? state.targetScore
      : DIFFERENZLER_ROUNDS;
    return state.roundIndex >= rounds - 1;
  },
};
