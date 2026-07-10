import { OBENABE_ORDER } from "./rules";
import type { Card, Rank } from "./types";

// Sequence ("Blatt") values by length: 3 = 20, 4 = 50, 5+ = 100 and up.
const SEQ_VALUE: Record<number, number> = {
  3: 20,
  4: 50,
  5: 100,
  6: 150,
  7: 200,
  8: 250,
  9: 300,
};

// Four-of-a-kind values. Four 6/7/8 do not count.
const FOUR_VALUE: Partial<Record<Rank, number>> = {
  U: 200, // four Under (Buur)
  "9": 150, // four Nell
  A: 100,
  K: 100,
  O: 100,
  "10": 100,
};

const RANK_LABEL: Record<Rank, string> = {
  "6": "Sechser", "7": "Siebner", "8": "Achter", "9": "Nell", "10": "Zehner",
  U: "Under", O: "Ober", K: "König", A: "Ass",
};

/** One meld: its cards, value, and a German label. */
export interface WeisPart {
  cards: Card[];
  value: number;
  label: string;
}

function rankIdx(rank: Rank): number {
  return OBENABE_ORDER.indexOf(rank);
}

/**
 * Detect the Weis (melds) in a hand: sequences of 3+ consecutive cards in a suit, and
 * four-of-a-kind. Returns the summed value, a comparable `key` for the single best Weis
 * (used to decide which team may score), and the individual melds with their cards.
 * Trump-independent.
 */
export function detectWeis(hand: Card[]): { total: number; key: number; melds: WeisPart[] } {
  const melds: WeisPart[] = [];
  let total = 0;
  let key = 0;
  const add = (cards: Card[], value: number, label: string, tiebreak: number) => {
    melds.push({ cards, value, label });
    total += value;
    const k = value * 100 + tiebreak; // tiebreak stays in [0, 99]
    if (k > key) key = k;
  };

  // Sequences within each suit (ranks are unique per suit).
  const bySuit = new Map<string, Card[]>();
  for (const c of hand) {
    const arr = bySuit.get(c.suit) ?? [];
    arr.push(c);
    bySuit.set(c.suit, arr);
  }
  for (const cards of bySuit.values()) {
    const sorted = [...cards].sort((a, b) => rankIdx(a.rank) - rankIdx(b.rank));
    let runStart = 0;
    for (let i = 1; i <= sorted.length; i++) {
      const consecutive =
        i < sorted.length && rankIdx(sorted[i].rank) === rankIdx(sorted[i - 1].rank) + 1;
      if (consecutive) continue;
      const len = i - runStart;
      if (len >= 3) {
        const runCards = sorted.slice(runStart, i);
        const value = SEQ_VALUE[Math.min(len, 9)] ?? 300;
        const top = rankIdx(sorted[i - 1].rank);
        add(runCards, value, `${len}er-Blatt`, len * 10 + top);
      }
      runStart = i;
    }
  }

  // Four-of-a-kind.
  const byRank = new Map<Rank, Card[]>();
  for (const c of hand) {
    const arr = byRank.get(c.rank) ?? [];
    arr.push(c);
    byRank.set(c.rank, arr);
  }
  for (const [rank, cards] of byRank) {
    if (cards.length === 4) {
      const value = FOUR_VALUE[rank] ?? 0;
      if (value > 0) add(cards, value, `Vier ${RANK_LABEL[rank]}`, 90 + rankIdx(rank));
    }
  }

  return { total, key, melds };
}
