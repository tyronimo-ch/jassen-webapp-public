import { buildDeck, dealFromDeck, shuffle } from "../deck";
import {
  forehandOf,
  legalTrickMoves,
  nextActiveCcw,
  playerIdsOf,
  playTrickCard,
  resolveTrickCcw,
} from "./trickPlay";
import {
  bidOrder,
  bidPoints,
  decodePandurTrump,
  isMisereBid,
  isNumericBid,
  isOhneTrump,
  isPandurBid,
  isSpecialBid,
  needsTrumpChoice,
  PANDUR_PASS,
} from "../pandurBids";
import type { Card, ModeEngine, RoomState, TrumpMode } from "../types";

export const PANDUR_DECK_SIZE = 24;
export const PANDUR_DEFAULT_TARGET = 17;
export const PANDUR_TARGET_OPTIONS = [15, 17, 21];

/** Pandur uses a 24-card deck: only 9, 10, Under, Ober, König, Ass of each suit. */
function pandurDeck(): Card[] {
  return buildDeck().filter((c) => c.rank !== "6" && c.rank !== "7" && c.rank !== "8");
}

/** Move into the play phase once the contract (soloist + trump) is settled. */
function startPlay(state: RoomState, trumpMode: TrumpMode): RoomState {
  return {
    ...state,
    trumpMode,
    pandurAwaitingTrump: false,
    phase: "playing",
    turnPlayerId: forehandOf(state),
  };
}

/** Resolve the auction: the sole remaining bidder becomes the soloist. */
function resolveAuction(state: RoomState, passed: string[]): RoomState {
  const ids = playerIdsOf(state);
  const remaining = ids.filter((id) => !passed.includes(id));
  const bid = state.pandurBid;

  // Nobody bid at all — redeal the same round with a fresh shuffle.
  if (bid === undefined || remaining.length === 0) {
    return pandurEngine.dealRound(state);
  }

  const soloist = state.pandurBidder ?? remaining[0];
  const withSoloist = { ...state, pandurPassed: passed, pandurSoloist: soloist };

  if (needsTrumpChoice(bid)) {
    // Soloist must still pick a trump suit before play.
    return { ...withSoloist, pandurAwaitingTrump: true, turnPlayerId: soloist };
  }
  // "Ohne Trumpf" announcements play top-down (Ace high) — modelled as obenabe.
  return startPlay(withSoloist, "obenabe");
}

export const pandurEngine: ModeEngine = {
  dealRound(state) {
    const ids = playerIdsOf(state);
    const n = ids.length;
    const cardsPerPlayer = Math.floor(PANDUR_DECK_SIZE / n);
    const deck = shuffle(pandurDeck());
    const { hands } = dealFromDeck(deck, ids, cardsPerPlayer);

    return {
      ...state,
      hands,
      currentTrick: [],
      bids: {},
      tricksWon: Object.fromEntries(ids.map((id) => [id, 0])),
      roundPoints: Object.fromEntries(ids.map((id) => [id, 0])),
      trumpMode: null,
      trumpFactor: 1,
      schiebenUsed: false,
      stoeckBonus: {},
      handsRevealed: false,
      pandurSoloist: undefined,
      pandurBid: undefined,
      pandurBidder: undefined,
      pandurPassed: [],
      pandurAwaitingTrump: false,
      phase: "bidding",
      turnPlayerId: forehandOf(state),
    };
  },

  submitBid(state, playerId, value) {
    if (state.phase !== "bidding") return state;

    // Trump-selection sub-phase: only the soloist picks a suit.
    if (state.pandurAwaitingTrump) {
      if (playerId !== state.pandurSoloist) return state;
      const suit = decodePandurTrump(value);
      if (!suit) return state;
      return startPlay(state, suit);
    }

    if (state.turnPlayerId !== playerId) return state;
    const passed = state.pandurPassed ?? [];
    if (passed.includes(playerId)) return state;
    const ids = playerIdsOf(state);

    if (value === PANDUR_PASS) {
      const newPassed = [...passed, playerId];
      const remaining = ids.filter((id) => !newPassed.includes(id));
      // Auction ends when at most one bidder is left.
      if (remaining.length <= 1) return resolveAuction(state, newPassed);
      const next = nextActiveCcw(ids, playerId, newPassed);
      return { ...state, pandurPassed: newPassed, turnPlayerId: next };
    }

    // Otherwise it's a raise: must be a legal bid strictly above the current high.
    const isValid = isNumericBid(value) || isSpecialBid(value);
    if (!isValid) return state;
    if (state.pandurBid !== undefined && bidOrder(value) <= bidOrder(state.pandurBid)) {
      return state;
    }

    const bids = { ...state.bids, [playerId]: value };
    const next = nextActiveCcw(ids, playerId, passed);
    // If this raise leaves nobody else to respond, the raiser wins outright.
    if (next === null || next === playerId) {
      return resolveAuction(
        { ...state, bids, pandurBid: value, pandurBidder: playerId },
        ids.filter((id) => id !== playerId)
      );
    }
    return { ...state, bids, pandurBid: value, pandurBidder: playerId, turnPlayerId: next };
  },

  legalMoves(state, playerId) {
    return legalTrickMoves(state, playerId);
  },

  playCard(state, playerId, card) {
    return playTrickCard(state, playerId, card);
  },

  resolveTrick(state) {
    return resolveTrickCcw(state);
  },

  scoreRound(state) {
    const ids = playerIdsOf(state);
    const soloist = state.pandurSoloist;
    const bid = state.pandurBid;
    const scores = { ...state.scores };

    if (soloist && bid !== undefined) {
      const totalTricks = Object.values(state.tricksWon).reduce((s, v) => s + v, 0);
      const soloTricks = state.tricksWon[soloist] ?? 0;
      let success: boolean;
      if (isMisereBid(bid)) success = soloTricks === 0;
      else if (isPandurBid(bid)) success = soloTricks === totalTricks;
      else success = (state.roundPoints[soloist] ?? 0) >= bid; // numeric points bid

      const pts = bidPoints(bid);
      if (success) {
        scores[soloist] = (scores[soloist] ?? 0) + pts;
      } else {
        // Defenders inherit the points when the soloist fails.
        for (const id of ids) if (id !== soloist) scores[id] = (scores[id] ?? 0) + pts;
      }
    }

    return { ...state, scores, phase: "roundEnd" };
  },

  isRoundComplete(state) {
    return playerIdsOf(state).every((id) => (state.hands[id]?.length ?? 0) === 0);
  },

  isGameComplete(state) {
    const target = state.targetScore || PANDUR_DEFAULT_TARGET;
    return Object.values(state.scores).some((s) => s >= target);
  },
};

// Re-export the "ohne Trumpf" helper so callers can reason about the contract.
export { isOhneTrump };
