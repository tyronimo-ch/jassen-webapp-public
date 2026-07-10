import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine";
import { encodeTrumpChoice, SCHIEBEN_CHOICE } from "../trumpChoice";
import type { Card, Player, RoomState } from "../types";
import { schieberEngine } from "./schieber";

function players(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    seat: i,
    connected: true,
  }));
}

function baseState(): RoomState {
  return createInitialState("ROOM", "schieber", players(4), 2500);
}

describe("schieber", () => {
  it("round 1 forehand is the holder of Rosen 10", () => {
    for (let i = 0; i < 20; i++) {
      const dealt = schieberEngine.dealRound(baseState());
      const holder = Object.entries(dealt.hands).find(([, hand]) =>
        hand.some((c) => c.suit === "Rosen" && c.rank === "10")
      );
      expect(holder).toBeDefined();
      expect(dealt.turnPlayerId).toBe(holder![0]);
    }
  });

  it("later rounds put the forehand before the dealer (counter-clockwise)", () => {
    const state = { ...baseState(), roundIndex: 3, dealerIndex: 1 };
    const dealt = schieberEngine.dealRound(state);
    expect(dealt.turnPlayerId).toBe("p0"); // forehand = dealer - 1
  });

  it("choosing a suit sets the multiplier; schieben passes to the partner", () => {
    const dealt = { ...schieberEngine.dealRound(baseState()), turnPlayerId: "p0", roundIndex: 5 };

    const passed = schieberEngine.submitBid(dealt, "p0", SCHIEBEN_CHOICE);
    expect(passed.schiebenUsed).toBe(true);
    expect(passed.turnPlayerId).toBe("p2"); // partner

    const chosen = schieberEngine.submitBid(passed, "p2", encodeTrumpChoice("obenabe"));
    expect(chosen.trumpMode).toBe("obenabe");
    expect(chosen.trumpFactor).toBe(3);
    expect(chosen.phase).toBe("playing");
    // forehand (p0) leads the first trick even though p2 chose trump
    expect(chosen.turnPlayerId).toBe("p0");
  });

  it("scoreRound multiplies the team total by the trump factor and adds match bonus", () => {
    const state: RoomState = {
      ...baseState(),
      phase: "playing",
      trumpMode: "Schelle",
      trumpFactor: 2,
      roundPoints: { p0: 50, p1: 30, p2: 20, p3: 52 },
      stoeckBonus: { p0: 20, p1: 0, p2: 0, p3: 0 },
      tricksWon: { p0: 3, p1: 2, p2: 2, p3: 2 },
    };
    const scored = schieberEngine.scoreRound(state);
    // Team A = (50 + 20 stoeck + 20) * 2 = 180 ; Team B = (30 + 52) * 2 = 164
    expect(scored.scores.p0).toBe(180);
    expect(scored.scores.p2).toBe(180);
    expect(scored.scores.p1).toBe(164);
    expect(scored.phase).toBe("roundEnd");
  });

  it("awards Weis only to the team holding the strongest Weis (times the factor)", () => {
    const state: RoomState = {
      ...baseState(),
      phase: "playing",
      trumpMode: "Rosen",
      trumpFactor: 1,
      roundPoints: { p0: 0, p1: 0, p2: 0, p3: 0 },
      stoeckBonus: {},
      tricksWon: { p0: 0, p1: 0, p2: 0, p3: 0 },
      weis: { p0: 20, p1: 50, p2: 0, p3: 0 },
      weisKey: { p0: 2030, p1: 5040, p2: 0, p3: 0 },
    };
    const scored = schieberEngine.scoreRound(state);
    // Team B has the stronger Weis (p1), so only Team B scores its Weis total (50).
    expect(scored.scores.p1).toBe(50);
    expect(scored.scores.p3).toBe(50);
    expect(scored.scores.p0).toBe(0);
    expect(scored.scores.p2).toBe(0);
  });

  it("only counts Weis that was declared (button pressed), and only for the stronger team", () => {
    const c = (suit: Card["suit"], rank: Card["rank"]): Card => ({ suit, rank });
    const p0hand = [c("Rosen", "6"), c("Rosen", "7"), c("Rosen", "8"), c("Rosen", "9"), c("Schilten", "6"), c("Schelle", "A"), c("Eichel", "K"), c("Schilten", "10"), c("Schelle", "O")]; // 4-seq = 50
    const p1hand = [c("Eichel", "6"), c("Eichel", "7"), c("Eichel", "8"), c("Rosen", "10"), c("Rosen", "K"), c("Schelle", "7"), c("Schilten", "9"), c("Schilten", "A"), c("Schelle", "10")]; // 3-seq = 20
    const state: RoomState = {
      ...baseState(),
      phase: "playing",
      trumpMode: "Rosen",
      trumpFactor: 1,
      hands: { p0: p0hand, p1: p1hand, p2: [], p3: [] },
      roundPoints: { p0: 0, p1: 0, p2: 0, p3: 0 },
      stoeckBonus: {},
      tricksWon: { p0: 0, p1: 0, p2: 0, p3: 0 },
      weis: {},
      weisKey: {},
      weisMelds: {},
    };
    // p0 (team A) declares; p1 (team B) also has Weis but does NOT press -> ignored.
    const declared = schieberEngine.declareWeis!(state, "p0");
    expect(declared.weis?.p0).toBe(50);
    expect(declared.weis?.p1).toBeUndefined();

    const scored = schieberEngine.scoreRound(declared);
    expect(scored.scores.p0).toBe(50); // team A scores its declared Weis
    expect(scored.scores.p1).toBe(0); // team B declared nothing
  });

  it("play proceeds counter-clockwise", () => {
    const dealt = schieberEngine.dealRound(baseState());
    const state: RoomState = {
      ...dealt,
      phase: "playing",
      trumpMode: "Rosen",
      turnPlayerId: "p0",
      currentTrick: [],
    };
    const after = schieberEngine.playCard(state, "p0", state.hands.p0[0]);
    expect(after.turnPlayerId).toBe("p3"); // 0 -> 3 (counter-clockwise)
  });

  it("respects the configurable target score", () => {
    const notDone = { ...baseState(), scores: { p0: 900, p1: 0, p2: 900, p3: 0 } };
    expect(schieberEngine.isGameComplete(notDone)).toBe(false);
    const done = { ...baseState(), scores: { p0: 2500, p1: 0, p2: 2500, p3: 0 } };
    expect(schieberEngine.isGameComplete(done)).toBe(true);
  });
});
