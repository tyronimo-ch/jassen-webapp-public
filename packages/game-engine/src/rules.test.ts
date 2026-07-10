import { describe, expect, it } from "vitest";
import { legalMoves, legalMovesWithTrump, obenabeValue, trickWinnerNoTrump, undenufeValue } from "./rules";
import type { Card, PlayedCard } from "./types";

const c = (suit: Card["suit"], rank: Card["rank"]): Card => ({ suit, rank });

describe("rules", () => {
  it("obenabe orders 6 low to A high; undenufe is the reverse", () => {
    expect(obenabeValue("6")).toBeLessThan(obenabeValue("A"));
    expect(undenufeValue("6")).toBeGreaterThan(undenufeValue("A"));
  });

  it("must follow the lead suit when able", () => {
    const hand = [c("Rosen", "A"), c("Eichel", "K"), c("Rosen", "7")];
    const legal = legalMoves(hand, "Rosen");
    expect(legal).toHaveLength(2);
    expect(legal.every((card) => card.suit === "Rosen")).toBe(true);
  });

  it("may play anything when void in the lead suit", () => {
    const hand = [c("Eichel", "K"), c("Schelle", "7")];
    expect(legalMoves(hand, "Rosen")).toHaveLength(2);
  });

  it("lets you trump in on a non-trump lead even when you can follow suit", () => {
    const hand = [c("Rosen", "A"), c("Rosen", "7"), c("Eichel", "U"), c("Eichel", "6")];
    const legal = legalMovesWithTrump(hand, "Rosen", "Eichel");
    // both Rosen (follow) and both Eichel (trump) are legal
    expect(legal).toHaveLength(4);
    expect(legal.some((card) => card.suit === "Eichel")).toBe(true);
  });

  it("must follow trump when trump is led, but may keep a lone Buur", () => {
    const twoTrumps = [c("Eichel", "K"), c("Eichel", "9"), c("Rosen", "A")];
    expect(legalMovesWithTrump(twoTrumps, "Eichel", "Eichel")).toHaveLength(2);

    const loneBuur = [c("Eichel", "U"), c("Rosen", "A"), c("Schelle", "K")];
    expect(legalMovesWithTrump(loneBuur, "Eichel", "Eichel")).toHaveLength(3); // may keep the Buur
  });

  it("obenabe has no trump exception (plain follow-suit)", () => {
    const hand = [c("Rosen", "A"), c("Eichel", "K")];
    expect(legalMovesWithTrump(hand, "Rosen", "obenabe")).toHaveLength(1);
  });

  it("no-trump winner is the highest of the lead suit", () => {
    const trick: PlayedCard[] = [
      { playerId: "p1", card: c("Rosen", "K") },
      { playerId: "p2", card: c("Rosen", "A") },
      { playerId: "p3", card: c("Eichel", "A") }, // off-suit, ignored
      { playerId: "p4", card: c("Rosen", "7") },
    ];
    expect(trickWinnerNoTrump(trick)).toBe("p2");
  });
});
