import { describe, expect, it } from "vitest";
import type { Card } from "./types";
import { detectWeis } from "./weis";

const c = (suit: Card["suit"], rank: Card["rank"]): Card => ({ suit, rank });

describe("detectWeis", () => {
  it("finds no Weis in a scattered hand", () => {
    const hand = [c("Rosen", "6"), c("Eichel", "9"), c("Schelle", "K"), c("Schilten", "7")];
    expect(detectWeis(hand).total).toBe(0);
  });

  it("scores a three-card sequence as 20", () => {
    const hand = [c("Rosen", "6"), c("Rosen", "7"), c("Rosen", "8"), c("Eichel", "A")];
    expect(detectWeis(hand).total).toBe(20);
  });

  it("scores a four-card sequence as 50 (not two overlapping threes)", () => {
    const hand = [c("Rosen", "7"), c("Rosen", "8"), c("Rosen", "9"), c("Rosen", "10")];
    expect(detectWeis(hand).total).toBe(50);
  });

  it("scores four Under as 200 and sums with a sequence", () => {
    const hand = [
      c("Rosen", "U"),
      c("Eichel", "U"),
      c("Schelle", "U"),
      c("Schilten", "U"),
      c("Rosen", "6"),
      c("Rosen", "7"),
      c("Rosen", "8"),
    ];
    const w = detectWeis(hand);
    expect(w.total).toBe(220); // 200 (four Under) + 20 (three-sequence)
    expect(w.key).toBeGreaterThan(200 * 100); // best Weis is the four Under
  });

  it("does not count four 6s", () => {
    const hand = [c("Rosen", "6"), c("Eichel", "6"), c("Schelle", "6"), c("Schilten", "6")];
    expect(detectWeis(hand).total).toBe(0);
  });
});
