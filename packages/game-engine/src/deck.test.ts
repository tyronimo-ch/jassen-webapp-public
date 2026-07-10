import { describe, expect, it } from "vitest";
import { buildDeck, dealFromDeck, seededRng, shuffle } from "./deck";

describe("deck", () => {
  it("builds 36 unique cards", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(36);
    const keys = new Set(deck.map((c) => `${c.suit}-${c.rank}`));
    expect(keys.size).toBe(36);
  });

  it("shuffle keeps the same multiset and is deterministic with a seed", () => {
    const deck = buildDeck();
    const a = shuffle(deck, seededRng(42));
    const b = shuffle(deck, seededRng(42));
    expect(a).toEqual(b);
    expect(a).toHaveLength(36);
    expect(new Set(a.map((c) => `${c.suit}-${c.rank}`)).size).toBe(36);
  });

  it("deals evenly and leaves the remaining deck", () => {
    const deck = buildDeck();
    const ids = ["a", "b", "c", "d"];
    const { hands, rest } = dealFromDeck(deck, ids, 9);
    for (const id of ids) expect(hands[id]).toHaveLength(9);
    expect(rest).toHaveLength(0);
  });
});
