import { buildDeck, dealFromDeck, shuffle } from "../deck";
import { obenabeValue } from "../rules";
import type { Card, ModeEngine, PlayedCard, Rank, RoomState, Suit } from "../types";

/**
 * "Fuck Your Neighbour" house variant:
 * - Round sizes ramp 1 -> max -> 1, where max = floor(36 / players) (2p=18, 3p=12,
 *   4p=9, 5p=7, 6p=6).
 * - Round 1 dealer is random; afterwards the deal rotates clockwise.
 * - 8 is the highest rank; everything else keeps normal Jass order beneath it.
 * - No follow-suit: any card is legal, and the single highest-ranked card wins the
 *   trick outright, ties broken by suit hierarchy (Rosen > Eichel > Schelle > Schilten).
 * - Bidding starts left of the dealer, clockwise. The last bidder may not make the
 *   total of all bids equal the trick count (e.g. with 4 cards the bids can't sum to 4).
 * - In 1-card rounds each player sees everyone else's card but not their own.
 * - Scoring: exact prediction = 10 + bid; otherwise -1 per trick of deviation.
 */
/** Max cards a player holds in a round = the 36-card deck split among the players. */
export function maxCardsFor(playerCount: number): number {
  return Math.floor(36 / Math.max(1, playerCount));
}

/** Card counts per round: ramp up 1..max then back down to 1 (max depends on player count). */
export function roundCardCounts(playerCount: number): number[] {
  const max = maxCardsFor(playerCount);
  const up = Array.from({ length: max }, (_, i) => i + 1);
  return [...up, ...up.slice(0, -1).reverse()];
}

const RANK_ORDER: Rank[] = ["6", "7", "9", "10", "U", "O", "K", "A", "8"];
const SUIT_HIERARCHY: Suit[] = ["Schilten", "Schelle", "Eichel", "Rosen"]; // low -> high

function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

function suitIndex(suit: Suit): number {
  return SUIT_HIERARCHY.indexOf(suit);
}

function compositeValue(card: Card): number {
  return rankIndex(card.rank) * 10 + suitIndex(card.suit);
}

function trickWinner(trick: PlayedCard[]): string {
  return trick.reduce((best, cur) =>
    compositeValue(cur.card) > compositeValue(best.card) ? cur : best
  ).playerId;
}

// "Härti": suit strength fully overrides card value. Suit order (low -> high):
// Rosen < Eichel < Schelle < Schilten; within a suit, normal order (Ace high, 6 low).
const HAERTI_SUIT_HIERARCHY: Suit[] = ["Rosen", "Eichel", "Schelle", "Schilten"];
const NORMAL_RANK_ORDER: Rank[] = ["6", "7", "8", "9", "10", "U", "O", "K", "A"];

function haertiValue(card: Card): number {
  return HAERTI_SUIT_HIERARCHY.indexOf(card.suit) * 100 + NORMAL_RANK_ORDER.indexOf(card.rank);
}

function haertiWinner(trick: PlayedCard[]): string {
  return trick.reduce((best, cur) =>
    haertiValue(cur.card) > haertiValue(best.card) ? cur : best
  ).playerId;
}

/**
 * Player ids in the trick that hold the highest card (ignoring suit). "Mit Stechen" uses
 * NORMAL card order (Ace high, 8 is just an 8) — not the 8-high game order — so ties that
 * trigger a Stechen are decided the same way the Stechen itself is.
 */
function topRankPlayers(trick: PlayedCard[]): string[] {
  const maxRank = Math.max(...trick.map((pc) => obenabeValue(pc.card.rank)));
  return trick.filter((pc) => obenabeValue(pc.card.rank) === maxRank).map((pc) => pc.playerId);
}

/**
 * "Mit Stechen": no suit hierarchy. A rank tie starts an interactive Stechen — the tied
 * players each choose a card to play again (highest wins), everyone else discards one card
 * so hands stay equal. The trick is worth 1 + (number of Stechen rounds). If the tied
 * players have no cards left (last card), the first one wins (Erben, simplified).
 */

/** Players (with cards) not in the Stechen owe one discard this round. */
function nonContenderDiscards(
  state: RoomState,
  contenders: string[]
): Record<string, number> | undefined {
  const pending: Record<string, number> = {};
  for (const p of state.players) {
    if (contenders.includes(p.id)) continue;
    if ((state.hands[p.id]?.length ?? 0) > 0) pending[p.id] = 1;
  }
  return Object.keys(pending).length ? pending : undefined;
}

/** Begin (or continue) a Stechen round: contenders must play, everyone else discards. */
function startStechenRound(state: RoomState, contenders: string[], rounds: number): RoomState {
  return {
    ...state,
    stechen: { contenders, rounds },
    stechenPlays: {},
    pendingDiscard: nonContenderDiscards(state, contenders),
    turnPlayerId: null,
  };
}

/** Award the trick (1 + rounds points) and clear the Stechen. */
function finishStechen(state: RoomState, winnerId: string, rounds: number): RoomState {
  return {
    ...state,
    tricksWon: { ...state.tricksWon, [winnerId]: (state.tricksWon[winnerId] ?? 0) + 1 + rounds },
    stechen: undefined,
    stechenPlays: undefined,
    pendingDiscard: undefined,
    turnPlayerId: winnerId,
  };
}

/**
 * Resolve the current Stechen round once all contenders have played and discards are done.
 * The Stechen uses NORMAL card order (Ace high, 8 is just an 8) — not the 8-high game order.
 * Called by the server after a short reveal delay so everyone sees the played cards.
 */
function resolveStechenRoundFn(state: RoomState): RoomState {
  const st = state.stechen;
  if (!st) return state;
  const plays = state.stechenPlays ?? {};
  const allPlayed = st.contenders.every((pid) => plays[pid] !== undefined);
  if (!allPlayed || state.pendingDiscard) return state; // still waiting on someone

  const value = (pid: string) => obenabeValue(plays[pid].rank);
  const maxRank = Math.max(...st.contenders.map(value));
  const winners = st.contenders.filter((pid) => value(pid) === maxRank);
  const rounds = st.rounds + 1;
  if (winners.length === 1) return finishStechen(state, winners[0], rounds);
  // Tie again: another round, or Erben if the tied players are out of cards.
  if (winners.some((pid) => (state.hands[pid]?.length ?? 0) === 0)) {
    return finishStechen(state, winners[0], rounds);
  }
  return startStechenRound(state, winners, rounds);
}

function playerIdsOf(state: RoomState): string[] {
  return state.players.map((p) => p.id);
}

export function cardsPerPlayerFor(roundIndex: number, playerCount: number): number {
  const counts = roundCardCounts(playerCount);
  return counts[roundIndex] ?? counts[counts.length - 1];
}

function computeLegalMoves(state: RoomState, playerId: string): Card[] {
  if (state.phase !== "playing" || state.turnPlayerId !== playerId) return [];
  return state.hands[playerId] ?? [];
}

export const customEngine: ModeEngine = {
  dealRound(state) {
    const deck = shuffle(buildDeck());
    const ids = playerIdsOf(state);
    const n = ids.length;
    const cardsPerPlayer = cardsPerPlayerFor(state.roundIndex, n);

    const dealerIndex =
      state.roundIndex === 0 ? Math.floor(Math.random() * n) : state.dealerIndex;
    const { hands } = dealFromDeck(deck, ids, cardsPerPlayer);
    const firstBidder = ids[(dealerIndex - 1 + n) % n];

    return {
      ...state,
      hands,
      dealerIndex,
      currentTrick: [],
      bids: {},
      tricksWon: Object.fromEntries(ids.map((id) => [id, 0])),
      roundPoints: Object.fromEntries(ids.map((id) => [id, 0])),
      trumpMode: null,
      trumpFactor: 1,
      schiebenUsed: false,
      stoeckBonus: {},
      handsRevealed: cardsPerPlayer === 1,
      phase: "bidding",
      turnPlayerId: firstBidder,
    };
  },

  submitBid(state, playerId, value) {
    if (state.phase !== "bidding" || state.turnPlayerId !== playerId) return state;
    const ids = playerIdsOf(state);
    const n = ids.length;
    const cardsPerPlayer = state.hands[playerId]?.length ?? 0;

    if (!Number.isInteger(value) || value < 0 || value > cardsPerPlayer) return state;

    const bidCount = Object.keys(state.bids).length;
    const currentIdx = ids.indexOf(playerId);
    const isLastBidder = bidCount === n - 1;

    // Hook rule: the last bidder may not make the TOTAL of all bids equal the number of
    // tricks (cards in hand this round). E.g. with 4 cards the bids may not sum to 4, so
    // someone is always wrong. The last bidder always keeps at least one legal value.
    if (isLastBidder) {
      const runningTotal = Object.values(state.bids).reduce((s, v) => s + v, 0);
      if (runningTotal + value === cardsPerPlayer) return state;
    }

    const bids = { ...state.bids, [playerId]: value };

    if (bidCount + 1 === n) {
      const firstBidder = ids[(state.dealerIndex - 1 + n) % n];
      return { ...state, bids, phase: "playing", turnPlayerId: firstBidder };
    }
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
    if (state.currentTrick.length === 0 || state.currentTrick.length !== state.players.length) {
      return state;
    }
    // "Härti": suit strength overrides card value — highest suit (then highest rank) wins.
    if (state.customHaerti) {
      const winnerId = haertiWinner(state.currentTrick);
      const tricksWon = { ...state.tricksWon, [winnerId]: (state.tricksWon[winnerId] ?? 0) + 1 };
      return { ...state, tricksWon, currentTrick: [], turnPlayerId: winnerId };
    }
    // "Mit Stechen": no suit tiebreak — a rank tie starts an interactive Stechen.
    if (state.customStechen) {
      const contenders = topRankPlayers(state.currentTrick);
      const cleared = { ...state, currentTrick: [] };
      if (contenders.length === 1) {
        const winnerId = contenders[0];
        return {
          ...cleared,
          tricksWon: { ...state.tricksWon, [winnerId]: (state.tricksWon[winnerId] ?? 0) + 1 },
          turnPlayerId: winnerId,
        };
      }
      // Tie, but the tied players have no cards to play out the Stechen -> Erben (worth 2).
      if (contenders.some((pid) => (state.hands[pid]?.length ?? 0) === 0)) {
        return finishStechen(cleared, contenders[0], 1);
      }
      return startStechenRound(cleared, contenders, 0);
    }
    const winnerId = trickWinner(state.currentTrick);
    const tricksWon = { ...state.tricksWon, [winnerId]: (state.tricksWon[winnerId] ?? 0) + 1 };
    return { ...state, tricksWon, currentTrick: [], turnPlayerId: winnerId };
  },

  /** A contender plays their chosen card into the current Stechen round. */
  playStechen(state, playerId, card) {
    const st = state.stechen;
    if (!st || !st.contenders.includes(playerId)) return state;
    if ((state.stechenPlays ?? {})[playerId] !== undefined) return state; // already played
    const hand = state.hands[playerId] ?? [];
    if (!hand.some((c) => c.suit === card.suit && c.rank === card.rank)) return state;

    // Resolution (winner/next round) is triggered separately, after a delay, so
    // everyone gets to see all the played cards before they're cleared.
    const newHand = hand.filter((c) => !(c.suit === card.suit && c.rank === card.rank));
    return {
      ...state,
      hands: { ...state.hands, [playerId]: newHand },
      stechenPlays: { ...(state.stechenPlays ?? {}), [playerId]: card },
    };
  },

  /** A non-Stechen player discards one of their cards (any card) during the Stechen. */
  discardCard(state, playerId, card) {
    const pending = state.pendingDiscard ?? {};
    if (!pending[playerId] || pending[playerId] <= 0) return state;
    const hand = state.hands[playerId] ?? [];
    if (!hand.some((c) => c.suit === card.suit && c.rank === card.rank)) return state;

    const newHand = hand.filter((c) => !(c.suit === card.suit && c.rank === card.rank));
    const newPending = { ...pending, [playerId]: pending[playerId] - 1 };
    if (newPending[playerId] <= 0) delete newPending[playerId];
    const stillPending = Object.keys(newPending).length > 0;

    // Resolution is triggered separately, after a delay (see resolveStechen below).
    return {
      ...state,
      hands: { ...state.hands, [playerId]: newHand },
      pendingDiscard: stillPending ? newPending : undefined,
    };
  },

  /** Resolve a completed Stechen round (all contenders played, all discards done). */
  resolveStechen(state) {
    return resolveStechenRoundFn(state);
  },

  scoreRound(state) {
    const scores = { ...state.scores };
    for (const player of state.players) {
      const bid = state.bids[player.id] ?? 0;
      const actual = state.tricksWon[player.id] ?? 0;
      const delta = bid === actual ? 10 + bid : -Math.abs(bid - actual);
      scores[player.id] = (scores[player.id] ?? 0) + delta;
    }
    return { ...state, scores, phase: "roundEnd" };
  },

  isRoundComplete(state) {
    return playerIdsOf(state).every((id) => (state.hands[id]?.length ?? 0) === 0);
  },

  isGameComplete(state) {
    return state.roundIndex >= roundCardCounts(state.players.length).length - 1;
  },
};
