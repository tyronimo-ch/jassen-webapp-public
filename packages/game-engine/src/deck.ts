import type { Card, Rank, Suit } from "./types";

export const SUITS: Suit[] = ["Rosen", "Eichel", "Schelle", "Schilten"];
export const RANKS: Rank[] = ["6", "7", "8", "9", "10", "U", "O", "K", "A"];

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Fisher-Yates shuffle. Accepts an optional rng (default Math.random) for deterministic tests. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Deal `cardsPerPlayer` cards to each player id in order. Returns the hands map and
 * the remaining (undealt) deck.
 */
export function dealFromDeck(
  deck: Card[],
  playerIds: string[],
  cardsPerPlayer: number
): { hands: Record<string, Card[]>; rest: Card[] } {
  const hands: Record<string, Card[]> = {};
  for (const id of playerIds) hands[id] = [];
  let cursor = 0;
  for (let c = 0; c < cardsPerPlayer; c++) {
    for (const id of playerIds) {
      hands[id].push(deck[cursor]);
      cursor++;
    }
  }
  return { hands, rest: deck.slice(cursor) };
}

/** Mulberry32 seeded PRNG — handy for deterministic shuffles in tests. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
