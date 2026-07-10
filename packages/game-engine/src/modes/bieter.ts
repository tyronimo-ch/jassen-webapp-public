import { buildDeck, shuffle } from "../deck";
import { cardPoints } from "../jassPoints";
import { detectWeis } from "../weis";
import {
  BIETER_BAUERN_TARGET,
  BIETER_DEFAULT_PENALTY,
  BIETER_MITKOMMEN,
  BIETER_PASS,
  BIETER_WEG,
  decodeBieterTrump,
  isBieterBid,
} from "../bieterBids";
import {
  forehandOf,
  legalTrickMoves,
  nextActiveCcw,
  playerIdsOf,
  playTrickCard,
  resolveTrickCcw,
} from "./trickPlay";
import type { Card, ModeEngine, RoomState } from "../types";

const CARDS_PER_PLAYER = 10;
const STOECK_BONUS = 20;
export const BIETER_PLAYERS = 3;

/**
 * Who leads the first trick: the König in round 1, then one seat counter-clockwise per
 * round after that.
 */
function leaderOf(state: RoomState): string {
  const ids = playerIdsOf(state);
  const n = ids.length;
  const kingIdx = Math.max(0, ids.indexOf(state.bieterKoenig ?? ids[0]));
  return ids[((kingIdx - state.roundIndex) % n + n) % n];
}

function bauernOf(state: RoomState): string[] {
  return playerIdsOf(state).filter((id) => id !== state.bieterKoenig);
}

/**
 * Once the König is known, reveal all 6 table cards to everyone and hand them to the König
 * (hand grows to 16). The König will then discard 6 — those become their first Stich.
 */
function takeTableCards(state: RoomState, koenig: string): RoomState {
  const all6 = [...(state.bieterOpen ?? []), ...(state.bieterStock ?? [])];
  const hand = [...(state.hands[koenig] ?? []), ...all6];
  return {
    ...state,
    hands: { ...state.hands, [koenig]: hand },
    bieterReveal: all6, // shown to all players (the discards themselves stay hidden)
    bieterOpen: undefined,
    turnPlayerId: koenig,
  };
}

/** Put the König into the 6-card discard step (trump must already be set). */
function startDiscard(state: RoomState, koenig: string): RoomState {
  return { ...state, bieterAwaitingTrump: false, pendingDiscard: { [koenig]: 6 }, turnPlayerId: koenig };
}

/** Follow-up rounds: after the exchange, the König decides whether to play ("Mitkommen"). */
function startMitkommen(state: RoomState): RoomState {
  return {
    ...state,
    bieterReveal: undefined,
    pendingDiscard: undefined,
    bieterAwaitingMitkommen: true,
    phase: "bidding",
    turnPlayerId: state.bieterKoenig ?? null,
  };
}

/**
 * The König passed a follow-up round ("weg"): the Bauern get the agreed penalty (157/257)
 * plus any Stöck they hold, the König scores nothing, and the round ends.
 */
function resolveMitkommenPass(state: RoomState): RoomState {
  const bauern = bauernOf(state);
  const trump = state.trumpMode;
  const penalty = state.bieterMitkommenPenalty ?? BIETER_DEFAULT_PENALTY;
  const scores = { ...state.scores };

  // The uncontested penalty goes to the Bauern team (booked on the first Bauer).
  if (bauern[0]) scores[bauern[0]] = (scores[bauern[0]] ?? 0) + penalty;
  // Plus any Stöck (König + Ober of trump) a Bauer holds.
  for (const id of bauern) {
    const hand = state.hands[id] ?? [];
    const hasStoeck =
      !!trump &&
      hand.some((c) => c.suit === trump && c.rank === "K") &&
      hand.some((c) => c.suit === trump && c.rank === "O");
    if (hasStoeck) scores[id] = (scores[id] ?? 0) + STOECK_BONUS;
  }

  const scored: RoomState = { ...state, scores, bieterAwaitingMitkommen: false, turnPlayerId: null };
  return { ...scored, phase: bieterEngine.isGameComplete(scored) ? "gameEnd" : "roundEnd" };
}

/** Begin the play phase. Trump is already fixed; forehand leads the first trick. */
function startPlay(state: RoomState): RoomState {
  return {
    ...state,
    bieterAwaitingTrump: false,
    pendingDiscard: undefined,
    bieterReveal: undefined,
    bieterOpen: undefined,
    phase: "playing",
    turnPlayerId: leaderOf(state),
  };
}

export const bieterEngine: ModeEngine = {
  dealRound(state) {
    const ids = playerIdsOf(state);
    const n = ids.length;
    const deck = shuffle(buildDeck());
    // Round 1 deals 10 each + a 6-card table (auction + exchange). From round 2 the König
    // is fixed, so the whole 36-card deck is dealt out and trump comes from the Bodentrumpf.
    const followUp = !!state.bieterKoenig;
    const perPlayer = followUp ? Math.floor(36 / n) : CARDS_PER_PLAYER;

    const hands: Record<string, Card[]> = {};
    let cursor = 0;
    for (const id of ids) {
      hands[id] = deck.slice(cursor, cursor + perPlayer);
      cursor += perPlayer;
    }
    const open = followUp ? undefined : deck.slice(cursor, cursor + 3);
    const stock = followUp ? undefined : deck.slice(cursor + 3, cursor + 6);

    const base: RoomState = {
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
      weis: {},
      weisKey: {},
      weisMelds: {},
      weisReveal: [],
      handsRevealed: false,
      bieterOpen: open,
      bieterStock: stock,
      bieterReveal: undefined,
      bieterBodentrumpf: undefined,
      bieterAwaitingTrump: false,
      bieterAwaitingMitkommen: false,
      pendingDiscard: undefined,
    };

    // Round 1: run the auction to decide the König.
    if (!followUp) {
      return {
        ...base,
        bieterBid: undefined,
        bieterBidder: undefined,
        bieterPassed: [],
        phase: "bidding",
        turnPlayerId: forehandOf(state),
      };
    }
    // Round 2+: all cards dealt, no exchange. The last dealt card is the Bodentrumpf and
    // sets trump automatically; the König is then asked to come along ("Mitkommen").
    const boden = deck[perPlayer * n - 1];
    return startMitkommen({ ...base, trumpMode: boden.suit, bieterBodentrumpf: boden });
  },

  submitBid(state, playerId, value) {
    if (state.phase !== "bidding") return state;

    // Trump-selection sub-phase (round 1): the König picks a suit, then discards 6.
    if (state.bieterAwaitingTrump) {
      if (playerId !== state.bieterKoenig) return state;
      const suit = decodeBieterTrump(value);
      if (!suit) return state;
      return startDiscard({ ...state, trumpMode: suit }, state.bieterKoenig);
    }

    // Mitkommen decision (follow-up rounds): only the König answers.
    if (state.bieterAwaitingMitkommen) {
      if (playerId !== state.bieterKoenig) return state;
      if (value === BIETER_MITKOMMEN) return startPlay({ ...state, bieterAwaitingMitkommen: false });
      if (value === BIETER_WEG) return resolveMitkommenPass(state);
      return state;
    }

    // Only the round-1 auction uses submitBid for bidding; later rounds have no auction.
    if (state.bieterKoenig) return state;
    if (state.turnPlayerId !== playerId) return state;
    const passed = state.bieterPassed ?? [];
    if (passed.includes(playerId)) return state;
    const ids = playerIdsOf(state);

    if (value === BIETER_PASS) {
      const newPassed = [...passed, playerId];
      const remaining = ids.filter((id) => !newPassed.includes(id));
      if (remaining.length <= 1 && state.bieterBid !== undefined) {
        return resolveAuction({ ...state, bieterPassed: newPassed });
      }
      if (remaining.length === 0) return bieterEngine.dealRound(state); // nobody bid -> redeal
      return { ...state, bieterPassed: newPassed, turnPlayerId: nextActiveCcw(ids, playerId, newPassed) };
    }

    if (!isBieterBid(value)) return state;
    if (state.bieterBid !== undefined && value <= state.bieterBid) return state;

    const bids = { ...state.bids, [playerId]: value };
    const next = nextActiveCcw(ids, playerId, passed);
    const raised = { ...state, bids, bieterBid: value, bieterBidder: playerId };
    if (next === null || next === playerId) return resolveAuction(raised);
    return { ...raised, turnPlayerId: next };
  },

  /** The König declares Weis (allowed every round, before playing their first card). */
  declareWeis(state, playerId) {
    if (state.phase !== "playing") return state;
    const hand = state.hands[playerId] ?? [];
    if (hand.length !== CARDS_PER_PLAYER) return state; // already played -> too late
    const weisKey = { ...(state.weisKey ?? {}) };
    if (weisKey[playerId] !== undefined) return state; // already declared

    const w = detectWeis(hand);
    const weis = { ...(state.weis ?? {}), [playerId]: w.total };
    weisKey[playerId] = w.key;
    const weisMelds = {
      ...(state.weisMelds ?? {}),
      [playerId]: w.melds.map((m) => ({ playerId, cards: m.cards, value: m.value, label: m.label })),
    };

    // Reveal the currently-winning side's melds (König alone vs. the two Bauern).
    const koenig = state.bieterKoenig;
    const bauern = bauernOf(state);
    const bestKey = (side: string[]) => Math.max(0, ...side.map((id) => weisKey[id] ?? 0));
    const keyK = koenig ? weisKey[koenig] ?? 0 : 0;
    const keyB = bestKey(bauern);
    const weisReveal: RoomState["weisReveal"] = [];
    if (keyK > 0 || keyB > 0) {
      const winners = keyK >= keyB && koenig ? [koenig] : bauern;
      for (const pid of winners) for (const m of weisMelds[pid] ?? []) weisReveal.push(m);
    }

    return { ...state, weis, weisKey, weisMelds, weisReveal };
  },

  legalMoves(state, playerId) {
    return legalTrickMoves(state, playerId);
  },

  /**
   * The König discards one of their 16 cards. Each discarded card's points go to the König
   * (the 6 discards form their first Stich). After 6 discards, play begins.
   */
  discardCard(state, playerId, card) {
    const pending = state.pendingDiscard ?? {};
    if (!pending[playerId] || pending[playerId] <= 0) return state;
    if (playerId !== state.bieterKoenig || !state.trumpMode) return state;
    const hand = state.hands[playerId] ?? [];
    if (!hand.some((c) => c.suit === card.suit && c.rank === card.rank)) return state;

    const newHand = hand.filter((c) => !(c.suit === card.suit && c.rank === card.rank));
    const left = pending[playerId] - 1;
    const state2: RoomState = {
      ...state,
      hands: { ...state.hands, [playerId]: newHand },
      // The discarded card counts as the König's Stich.
      roundPoints: {
        ...state.roundPoints,
        [playerId]: (state.roundPoints[playerId] ?? 0) + cardPoints(card, state.trumpMode),
      },
      pendingDiscard: left > 0 ? { [playerId]: left } : undefined,
    };
    if (left > 0) return state2;
    // Round 1 König already committed via the auction; follow-up rounds get the Mitkommen ask.
    return state.roundIndex === 0 ? startPlay(state2) : startMitkommen(state2);
  },

  playCard(state, playerId, card) {
    return playTrickCard(state, playerId, card);
  },

  resolveTrick(state) {
    return resolveTrickCcw(state);
  },

  scoreRound(state) {
    const koenig = state.bieterKoenig;
    const bauern = bauernOf(state);
    const scores = { ...state.scores };
    const weis = state.weis ?? {};
    const weisKey = state.weisKey ?? {};

    // Weis: only the side holding the single strongest meld scores its total.
    const keyK = koenig ? weisKey[koenig] ?? 0 : 0;
    const keyB = Math.max(0, ...bauern.map((id) => weisKey[id] ?? 0));
    let koenigWeis = 0;
    let bauernWeis = 0;
    if (keyK > 0 || keyB > 0) {
      if (keyK >= keyB) koenigWeis = koenig ? weis[koenig] ?? 0 : 0;
      else bauernWeis = bauern.reduce((acc, id) => acc + (weis[id] ?? 0), 0);
    }

    if (koenig) {
      scores[koenig] = (scores[koenig] ?? 0) + (state.roundPoints[koenig] ?? 0) + koenigWeis;
    }
    // Each Bauer keeps their own card points; the shared Weis lands on the first Bauer.
    bauern.forEach((id, i) => {
      scores[id] = (scores[id] ?? 0) + (state.roundPoints[id] ?? 0) + (i === 0 ? bauernWeis : 0);
    });

    return { ...state, scores, phase: "roundEnd" };
  },

  isRoundComplete(state) {
    return playerIdsOf(state).every((id) => (state.hands[id]?.length ?? 0) === 0);
  },

  isGameComplete(state) {
    const koenig = state.bieterKoenig;
    if (!koenig || state.bieterBid === undefined) return false;
    const koenigTotal = state.scores[koenig] ?? 0;
    const bauernTotal = bauernOf(state).reduce((acc, id) => acc + (state.scores[id] ?? 0), 0);
    return koenigTotal >= state.bieterBid || bauernTotal >= BIETER_BAUERN_TARGET;
  },
};

/**
 * Resolve the round-1 auction: the standing high bidder becomes König. All 6 table cards are
 * revealed and taken; the König then picks a trump suit (round 1), after which they discard 6.
 */
function resolveAuction(state: RoomState): RoomState {
  const koenig = state.bieterBidder;
  if (!koenig || state.bieterBid === undefined) return bieterEngine.dealRound(state);
  const taken = takeTableCards({ ...state, bieterKoenig: koenig }, koenig);
  return { ...taken, bieterAwaitingTrump: true, turnPlayerId: koenig };
}
