import { describe, expect, it } from "vitest";
import { buildDeck } from "./deck";
import { cardPoints, trickPoints, trickWinner } from "./jassPoints";
import type { Card, PlayedCard, TrumpMode } from "./types";

const c = (suit: Card["suit"], rank: Card["rank"]): Card => ({ suit, rank });

function deckPoints(mode: TrumpMode): number {
  return buildDeck().reduce((sum, card) => sum + cardPoints(card, mode), 0);
}

describe("jassPoints", () => {
  it("every trump mode totals 152 card points across the deck", () => {
    for (const mode of ["Rosen", "obenabe", "undenufe"] as TrumpMode[]) {
      expect(deckPoints(mode)).toBe(152);
    }
  });

  it("trump Under is worth 20 and Nell 14; plain Under only 2", () => {
    expect(cardPoints(c("Rosen", "U"), "Rosen")).toBe(20);
    expect(cardPoints(c("Rosen", "9"), "Rosen")).toBe(14);
    expect(cardPoints(c("Eichel", "U"), "Rosen")).toBe(2);
  });

  it("undenufe makes the 6 worth 11 and the Ace worth 0", () => {
    expect(cardPoints(c("Rosen", "6"), "undenufe")).toBe(11);
    expect(cardPoints(c("Rosen", "A"), "undenufe")).toBe(0);
  });

  it("a trump beats a higher non-trump", () => {
    const trick: PlayedCard[] = [
      { playerId: "p1", card: c("Eichel", "A") }, // lead, non-trump
      { playerId: "p2", card: c("Rosen", "6") }, // trump
    ];
    expect(trickWinner(trick, "Rosen")).toBe("p2");
  });

  it("trump Under beats trump Ace", () => {
    const trick: PlayedCard[] = [
      { playerId: "p1", card: c("Rosen", "A") },
      { playerId: "p2", card: c("Rosen", "U") },
    ];
    expect(trickWinner(trick, "Rosen")).toBe("p2");
  });

  it("Coiffeur Slalom alternates direction per trick; points follow the start", () => {
    const trick: PlayedCard[] = [
      { playerId: "p1", card: c("Rosen", "A") },
      { playerId: "p2", card: c("Rosen", "6") },
    ];
    expect(trickWinner(trick, "slalom-obe", 0)).toBe("p1"); // trick 0 = obenabe -> A wins
    expect(trickWinner(trick, "slalom-obe", 1)).toBe("p2"); // trick 1 = undenufe -> 6 wins
    expect(cardPoints(c("Rosen", "A"), "slalom-obe")).toBe(11); // obenabe scoring
    expect(cardPoints(c("Rosen", "6"), "slalom-obe")).toBe(0);
  });

  it("Coiffeur Guschti switches after N tricks; points follow the start", () => {
    const trick: PlayedCard[] = [
      { playerId: "p1", card: c("Eichel", "A") },
      { playerId: "p2", card: c("Eichel", "6") },
    ];
    expect(trickWinner(trick, "guschti-obe-5", 4)).toBe("p1"); // first 5 obenabe
    expect(trickWinner(trick, "guschti-obe-5", 5)).toBe("p2"); // then undenufe
    expect(trickWinner(trick, "guschti-une-4", 3)).toBe("p2"); // first 4 undenufe
    expect(trickWinner(trick, "guschti-une-4", 4)).toBe("p1"); // then obenabe
    expect(cardPoints(c("Rosen", "6"), "guschti-une-4")).toBe(11); // undenufe scoring
    expect(cardPoints(c("Rosen", "A"), "guschti-une-4")).toBe(0);
  });

  it("trickPoints sums card values for the mode", () => {
    const trick: PlayedCard[] = [
      { playerId: "p1", card: c("Rosen", "A") }, // 11
      { playerId: "p2", card: c("Rosen", "10") }, // 10
    ];
    expect(trickPoints(trick, "Eichel")).toBe(21);
  });
});
