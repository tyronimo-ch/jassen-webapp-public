import { buildDeck, dealFromDeck, shuffle } from "../deck";
import { trickPoints, trickWinner } from "../jassPoints";
import { isCoiffeur, legalMovesWithTrump } from "../rules";
import { SCHIEBEN_CHOICE, TRUMP_FACTOR, decodeTrumpChoice } from "../trumpChoice";
import { detectWeis } from "../weis";
import type { Card, ModeEngine, RoomState, Suit } from "../types";

const CARDS_PER_PLAYER = 9;
const MATCH_BONUS = 100;
const LAST_TRICK_BONUS = 5;
const STOECK_BONUS = 20;

export const DEFAULT_TARGET_SCORE = 2500;
export const MIN_TARGET_SCORE = 1000;
export const MAX_TARGET_SCORE = 10000;

function playerIdsOf(state: RoomState): string[] {
  return state.players.map((p) => p.id);
}

function partnerOf(state: RoomState, playerId: string): string {
  const ids = playerIdsOf(state);
  const idx = ids.indexOf(playerId);
  return ids[(idx + 2) % 4];
}

function leadSuit(state: RoomState): Suit | null {
  return state.currentTrick[0]?.card.suit ?? null;
}

function computeLegalMoves(state: RoomState, playerId: string): Card[] {
  if (state.phase !== "playing" || state.turnPlayerId !== playerId) return [];
  const hand = state.hands[playerId] ?? [];
  return legalMovesWithTrump(hand, leadSuit(state), state.trumpMode);
}

function computeStoeckBonus(state: RoomState, trumpSuit: Suit): Record<string, number> {
  const bonus: Record<string, number> = {};
  for (const [playerId, hand] of Object.entries(state.hands)) {
    const hasKing = hand.some((c) => c.suit === trumpSuit && c.rank === "K");
    const hasOber = hand.some((c) => c.suit === trumpSuit && c.rank === "O");
    bonus[playerId] = hasKing && hasOber ? STOECK_BONUS : 0;
  }
  return bonus;
}

export const schieberEngine: ModeEngine = {
  dealRound(state) {
    const deck = shuffle(buildDeck());
    const ids = playerIdsOf(state);
    const { hands } = dealFromDeck(deck, ids, CARDS_PER_PLAYER);
    const n = ids.length;

    // Round 1: the Rosen 10 holder is forehand. Anchor the dealer to them so the forehand
    // rotates consistently (counter-clockwise) from that player in later rounds.
    let dealerIndex = state.dealerIndex;
    if (state.roundIndex === 0) {
      const holderIdx = ids.findIndex((id) =>
        (hands[id] ?? []).some((c) => c.suit === "Rosen" && c.rank === "10")
      );
      if (holderIdx >= 0) dealerIndex = (holderIdx + 1) % n; // forehand = dealer - 1
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
      trumpMode: null,
      trumpFactor: 1,
      schiebenUsed: false,
      stoeckBonus: {},
      weis: {},
      weisKey: {},
      weisMelds: {},
      weisReveal: [],
      handsRevealed: false,
      phase: "bidding",
      turnPlayerId: forehand,
    };
  },

  /** value is a trump choice encoded via encodeTrumpChoice, or SCHIEBEN_CHOICE. */
  submitBid(state, playerId, value) {
    if (state.phase !== "bidding" || state.turnPlayerId !== playerId) return state;

    if (value === SCHIEBEN_CHOICE) {
      if (state.schiebenUsed) return state;
      return { ...state, schiebenUsed: true, turnPlayerId: partnerOf(state, playerId) };
    }

    const trumpMode = decodeTrumpChoice(value);
    if (!trumpMode) return state;

    const stoeckBonus =
      trumpMode !== "obenabe" && trumpMode !== "undenufe" && !isCoiffeur(trumpMode)
        ? computeStoeckBonus(state, trumpMode as Suit)
        : {};

    // The forehand leads the first trick even if trump was passed to the partner.
    const forehand = state.schiebenUsed ? partnerOf(state, playerId) : playerId;

    // Weis is now declared manually by each player before their first card (see declareWeis).
    return {
      ...state,
      trumpMode,
      trumpFactor: TRUMP_FACTOR[trumpMode],
      stoeckBonus,
      weis: {},
      weisKey: {},
      weisMelds: {},
      weisReveal: [],
      phase: "playing",
      turnPlayerId: forehand,
    };
  },

  /** A player declares their Weis. Only allowed before they have played a card this round. */
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

    // Reveal the currently-winning team's declared melds to everyone.
    const ids = playerIdsOf(state);
    const teamA = [ids[0], ids[2]];
    const teamB = [ids[1], ids[3]];
    const bestKey = (team: string[]) => Math.max(0, ...team.map((id) => weisKey[id] ?? 0));
    const weisReveal: RoomState["weisReveal"] = [];
    if (bestKey(teamA) > 0 || bestKey(teamB) > 0) {
      const winners = bestKey(teamA) >= bestKey(teamB) ? teamA : teamB;
      for (const pid of winners) for (const m of weisMelds[pid] ?? []) weisReveal.push(m);
    }

    return { ...state, weis, weisKey, weisMelds, weisReveal };
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
  },

  scoreRound(state) {
    const ids = playerIdsOf(state);
    const teamA = [ids[0], ids[2]];
    const teamB = [ids[1], ids[3]];
    const factor = state.trumpFactor || 1;

    const sum = (team: string[], src: Record<string, number>) =>
      team.reduce((acc, id) => acc + (src[id] ?? 0), 0);

    let teamAPoints = sum(teamA, state.roundPoints) + sum(teamA, state.stoeckBonus);
    let teamBPoints = sum(teamB, state.roundPoints) + sum(teamB, state.stoeckBonus);

    // Weis: only the team holding the single strongest Weis scores its total (ties -> team A).
    const weis = state.weis ?? {};
    const weisKey = state.weisKey ?? {};
    const bestKey = (team: string[]) => Math.max(0, ...team.map((id) => weisKey[id] ?? 0));
    const weisSum = (team: string[]) => team.reduce((acc, id) => acc + (weis[id] ?? 0), 0);
    const keyA = bestKey(teamA);
    const keyB = bestKey(teamB);
    if (keyA > 0 || keyB > 0) {
      if (keyA >= keyB) teamAPoints += weisSum(teamA);
      else teamBPoints += weisSum(teamB);
    }

    const tricksFor = (team: string[]) => sum(team, state.tricksWon);
    if (tricksFor(teamA) === 9) teamAPoints += MATCH_BONUS;
    if (tricksFor(teamB) === 9) teamBPoints += MATCH_BONUS;

    teamAPoints *= factor;
    teamBPoints *= factor;

    const scores = { ...state.scores };
    for (const id of teamA) scores[id] = (scores[id] ?? 0) + teamAPoints;
    for (const id of teamB) scores[id] = (scores[id] ?? 0) + teamBPoints;

    return { ...state, scores, phase: "roundEnd" };
  },

  isRoundComplete(state) {
    return playerIdsOf(state).every((id) => (state.hands[id]?.length ?? 0) === 0);
  },

  isGameComplete(state) {
    const target = state.targetScore || DEFAULT_TARGET_SCORE;
    return Object.values(state.scores).some((s) => s >= target);
  },
};
