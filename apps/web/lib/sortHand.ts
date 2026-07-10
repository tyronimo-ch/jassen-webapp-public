import { RANKS, SUITS, type Card } from "@jassen/game-engine";

const suitOrder = new Map(SUITS.map((s, i) => [s, i]));
const rankOrder = new Map(RANKS.map((r, i) => [r, i]));

/** Sort a hand by suit then rank for stable display. */
export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    const s = (suitOrder.get(a.suit) ?? 0) - (suitOrder.get(b.suit) ?? 0);
    if (s !== 0) return s;
    return (rankOrder.get(a.rank) ?? 0) - (rankOrder.get(b.rank) ?? 0);
  });
}
