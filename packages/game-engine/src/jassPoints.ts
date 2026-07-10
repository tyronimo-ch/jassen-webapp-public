import { coiffeurDirection, coiffeurStart, isCoiffeur, obenabeValue, undenufeValue } from "./rules";
import type { Card, PlayedCard, Rank, Suit, TrumpMode } from "./types";

/** Trump-suit rank strength, low -> high: 6,7,8,10,O,K,A,9(Nell),U(Bauer). */
const TRUMP_ORDER: Rank[] = ["6", "7", "8", "10", "O", "K", "A", "9", "U"];

function trumpStrength(rank: Rank): number {
  return TRUMP_ORDER.indexOf(rank);
}

function isSuitTrump(mode: TrumpMode): mode is Suit {
  return mode !== "obenabe" && mode !== "undenufe";
}

const TRUMP_POINTS: Record<Rank, number> = {
  "6": 0, "7": 0, "8": 0, "9": 14, "10": 10, U: 20, O: 3, K: 4, A: 11,
};
const PLAIN_POINTS: Record<Rank, number> = {
  "6": 0, "7": 0, "8": 0, "9": 0, "10": 10, U: 2, O: 3, K: 4, A: 11,
};
const OBENABE_POINTS: Record<Rank, number> = {
  "6": 0, "7": 0, "8": 8, "9": 0, "10": 10, U: 2, O: 3, K: 4, A: 11,
};
const UNDENUFE_POINTS: Record<Rank, number> = {
  "6": 11, "7": 0, "8": 8, "9": 0, "10": 10, U: 2, O: 3, K: 4, A: 0,
};

/** Point value of a single card under the given trump mode. */
export function cardPoints(card: Card, mode: TrumpMode): number {
  if (mode === "obenabe") return OBENABE_POINTS[card.rank];
  if (mode === "undenufe") return UNDENUFE_POINTS[card.rank];
  if (isCoiffeur(mode)) {
    // Card values follow the starting direction for the whole round (Zählweise).
    return coiffeurStart(mode) === "undenufe" ? UNDENUFE_POINTS[card.rank] : OBENABE_POINTS[card.rank];
  }
  return card.suit === mode ? TRUMP_POINTS[card.rank] : PLAIN_POINTS[card.rank];
}

/** Total card points in a trick (does not include the +5 last-trick bonus). */
export function trickPoints(trick: PlayedCard[], mode: TrumpMode): number {
  return trick.reduce((sum, p) => sum + cardPoints(p.card, mode), 0);
}

/** Winner of a trick under any trump mode. `trickIndex` (0-based) matters for Coiffeur. */
export function trickWinner(trick: PlayedCard[], mode: TrumpMode, trickIndex = 0): string {
  if (mode === "obenabe") return highestOfLead(trick, obenabeValue);
  if (mode === "undenufe") return highestOfLead(trick, undenufeValue);
  if (isCoiffeur(mode)) {
    const dir = coiffeurDirection(mode, trickIndex);
    return highestOfLead(trick, dir === "undenufe" ? undenufeValue : obenabeValue);
  }

  const leadSuit = trick[0].card.suit;
  const trumps = trick.filter((p) => p.card.suit === mode);
  if (trumps.length > 0) {
    let best = trumps[0];
    for (const p of trumps) {
      if (trumpStrength(p.card.rank) > trumpStrength(best.card.rank)) best = p;
    }
    return best.playerId;
  }
  // No trump played: highest of lead suit by natural (obenabe) order.
  return highestOfLeadSuit(trick, leadSuit, obenabeValue);
}

function highestOfLead(trick: PlayedCard[], value: (r: Rank) => number): string {
  return highestOfLeadSuit(trick, trick[0].card.suit, value);
}

function highestOfLeadSuit(
  trick: PlayedCard[],
  leadSuit: Suit,
  value: (r: Rank) => number
): string {
  let best = trick[0];
  for (const p of trick) {
    if (p.card.suit !== leadSuit) continue;
    if (value(p.card.rank) > value(best.card.rank)) best = p;
  }
  return best.playerId;
}
