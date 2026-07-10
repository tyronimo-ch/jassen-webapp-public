import { trickPoints, trickWinner } from "../jassPoints";
import { legalMovesWithTrump } from "../rules";
import type { Card, RoomState, Suit } from "../types";

/**
 * Shared trick-play primitives for the solo bidding modes (Pandur, Bieterjass). Both deal
 * one hand per player, play counter-clockwise (seat index − 1), and score card points to
 * the trick winner — so the play/resolve logic is identical.
 */

export const LAST_TRICK_BONUS = 5;

export function playerIdsOf(state: RoomState): string[] {
  return state.players.map((p) => p.id);
}

/** The forehand (player to the dealer's right) leads the bidding / first trick. */
export function forehandOf(state: RoomState): string {
  const ids = playerIdsOf(state);
  const n = ids.length;
  return ids[(state.dealerIndex - 1 + n) % n];
}

export function leadSuitOf(state: RoomState): Suit | null {
  return state.currentTrick[0]?.card.suit ?? null;
}

export function legalTrickMoves(state: RoomState, playerId: string): Card[] {
  if (state.phase !== "playing" || state.turnPlayerId !== playerId) return [];
  const hand = state.hands[playerId] ?? [];
  return legalMovesWithTrump(hand, leadSuitOf(state), state.trumpMode);
}

/** The next player counter-clockwise from `fromId` who is not in `excluded`. */
export function nextActiveCcw(ids: string[], fromId: string, excluded: string[]): string | null {
  const n = ids.length;
  const start = ids.indexOf(fromId);
  for (let step = 1; step <= n; step++) {
    const cand = ids[((start - step) % n + n) % n];
    if (!excluded.includes(cand)) return cand;
  }
  return null;
}

/** Play a card into the current trick and advance the turn counter-clockwise. */
export function playTrickCard(state: RoomState, playerId: string, card: Card): RoomState {
  const legal = legalTrickMoves(state, playerId);
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
}

/** Resolve a completed trick: award it (with card points + last-trick bonus) to the winner. */
export function resolveTrickCcw(state: RoomState): RoomState {
  if (!state.trumpMode || state.currentTrick.length !== state.players.length) return state;

  const trickIndex = Object.values(state.tricksWon).reduce((s, v) => s + v, 0);
  const winnerId = trickWinner(state.currentTrick, state.trumpMode, trickIndex);
  const tricksWon = { ...state.tricksWon, [winnerId]: (state.tricksWon[winnerId] ?? 0) + 1 };

  let points = trickPoints(state.currentTrick, state.trumpMode);
  const wasLastTrick = Object.values(state.hands).every((h) => h.length === 0);
  if (wasLastTrick) points += LAST_TRICK_BONUS;

  const roundPoints = {
    ...state.roundPoints,
    [winnerId]: (state.roundPoints[winnerId] ?? 0) + points,
  };
  return { ...state, tricksWon, roundPoints, currentTrick: [], turnPlayerId: winnerId };
}
