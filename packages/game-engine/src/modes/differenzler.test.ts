import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine";
import type { Player, RoomState, TrumpMode } from "../types";
import { differenzlerEngine, DIFFERENZLER_ROUNDS, MAX_PREDICTION } from "./differenzler";

function players(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    seat: i,
    connected: true,
  }));
}

function baseState(): RoomState {
  return createInitialState("ROOM", "differenzler", players(4), 0);
}

const POOL: TrumpMode[] = ["Rosen", "Eichel", "Schelle", "Schilten", "obenabe", "undenufe"];

describe("differenzler", () => {
  it("deals a random trump from the full pool and enters bidding", () => {
    for (let i = 0; i < 20; i++) {
      const dealt = differenzlerEngine.dealRound(baseState());
      expect(dealt.phase).toBe("bidding");
      expect(POOL).toContain(dealt.trumpMode!);
      expect(dealt.turnPlayerId).not.toBeNull();
    }
  });

  it("predicts a point total and rejects out-of-range bids", () => {
    let state = differenzlerEngine.dealRound(baseState());
    const first = state.turnPlayerId!;
    expect(differenzlerEngine.submitBid(state, first, MAX_PREDICTION + 1)).toBe(state); // rejected
    state = differenzlerEngine.submitBid(state, first, 80);
    expect(state.bids[first]).toBe(80);
    expect(state.turnPlayerId).not.toBe(first); // advanced
  });

  it("scores penalty as |predicted - actual points|, stored negatively", () => {
    const state: RoomState = {
      ...baseState(),
      trumpMode: "obenabe",
      bids: { p0: 80, p1: 40, p2: 20, p3: 17 },
      roundPoints: { p0: 70, p1: 40, p2: 30, p3: 17 },
    };
    const scored = differenzlerEngine.scoreRound(state);
    expect(scored.scores.p0).toBe(-10); // |80-70|
    expect(scored.scores.p1).toBe(0); // exact
    expect(scored.scores.p2).toBe(-10); // |20-30|
    expect(scored.scores.p3).toBe(0);
  });

  it("ends after the configured number of rounds", () => {
    expect(differenzlerEngine.isGameComplete({ ...baseState(), roundIndex: DIFFERENZLER_ROUNDS - 2 })).toBe(false);
    expect(differenzlerEngine.isGameComplete({ ...baseState(), roundIndex: DIFFERENZLER_ROUNDS - 1 })).toBe(true);
  });
});
