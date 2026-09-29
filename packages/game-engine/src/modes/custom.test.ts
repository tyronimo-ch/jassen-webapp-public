import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine";
import type { Card, Player, PlayedCard, RoomState } from "../types";
import { customEngine, roundCardCounts } from "./custom";

function players(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    seat: i,
    connected: true,
  }));
}

function baseState(n: number): RoomState {
  return createInitialState("ROOM", "custom", players(n), 0);
}

const c = (suit: Card["suit"], rank: Card["rank"]): Card => ({ suit, rank });

function trickState(trick: PlayedCard[], n: number): RoomState {
  return {
    ...baseState(n),
    phase: "playing",
    currentTrick: trick,
    tricksWon: Object.fromEntries(players(n).map((p) => [p.id, 0])),
  };
}

describe("custom / fuck your neighbour", () => {
  it("the 8 is the highest rank and beats the Ace", () => {
    const trick: PlayedCard[] = [
      { playerId: "p0", card: c("Rosen", "A") },
      { playerId: "p1", card: c("Schilten", "8") },
    ];
    expect(customEngine.resolveTrick(trickState(trick, 2)).turnPlayerId).toBe("p1");
  });

  it("breaks equal-rank ties by suit hierarchy (Rosen highest)", () => {
    const trick: PlayedCard[] = [
      { playerId: "p0", card: c("Eichel", "8") },
      { playerId: "p1", card: c("Rosen", "8") },
    ];
    expect(customEngine.resolveTrick(trickState(trick, 2)).turnPlayerId).toBe("p1");
  });

  it("Härti: a higher suit beats any lower suit regardless of rank", () => {
    // Schilten is the top suit, so Schilten 6 beats Schellen A.
    const trick: PlayedCard[] = [
      { playerId: "p0", card: c("Schelle", "A") },
      { playerId: "p1", card: c("Schilten", "6") },
    ];
    const state = { ...trickState(trick, 2), customHaerti: true };
    expect(customEngine.resolveTrick(state).turnPlayerId).toBe("p1");
  });

  it("Härti: within the same suit, normal order (Ace high) decides", () => {
    const trick: PlayedCard[] = [
      { playerId: "p0", card: c("Rosen", "A") },
      { playerId: "p1", card: c("Rosen", "8") },
    ];
    const state = { ...trickState(trick, 2), customHaerti: true };
    expect(customEngine.resolveTrick(state).turnPlayerId).toBe("p0"); // Ace beats 8 (8 not high here)
  });

  it("Mit Stechen: a rank tie starts an interactive Stechen the contenders play out", () => {
    const state: RoomState = {
      ...baseState(2),
      customStechen: true,
      phase: "playing",
      currentTrick: [
        { playerId: "p0", card: c("Rosen", "8") },
        { playerId: "p1", card: c("Schilten", "8") },
      ],
      hands: { p0: [c("Rosen", "A")], p1: [c("Schilten", "6")] },
      tricksWon: { p0: 0, p1: 0 },
    };
    const inStechen = customEngine.resolveTrick(state);
    expect(inStechen.stechen?.contenders).toEqual(["p0", "p1"]); // interactive, not resolved yet
    expect(inStechen.tricksWon.p0).toBe(0);

    const s1 = customEngine.playStechen!(inStechen, "p0", c("Rosen", "A"));
    const s2 = customEngine.playStechen!(s1, "p1", c("Schilten", "6"));
    // Both cards are played but resolution is a separate step, so the Stechen
    // (and both played cards) stay visible until resolveStechen is called.
    expect(s2.stechen?.contenders).toEqual(["p0", "p1"]);
    expect(s2.stechenPlays?.p0).toEqual(c("Rosen", "A"));
    expect(s2.stechenPlays?.p1).toEqual(c("Schilten", "6"));

    const resolved = customEngine.resolveStechen!(s2);
    expect(resolved.stechen).toBeUndefined();
    expect(resolved.turnPlayerId).toBe("p0"); // higher card wins, not by suit
    expect(resolved.tricksWon.p0).toBe(2); // 1 + one Stechen round
  });

  it("Mit Stechen: non-Stechen players discard while the contenders play", () => {
    const state: RoomState = {
      ...baseState(3),
      customStechen: true,
      phase: "playing",
      currentTrick: [
        { playerId: "p0", card: c("Rosen", "8") },
        { playerId: "p1", card: c("Schilten", "8") }, // tie with p0
        { playerId: "p2", card: c("Rosen", "6") }, // not in the Stechen
      ],
      hands: { p0: [c("Rosen", "A")], p1: [c("Schilten", "6")], p2: [c("Eichel", "7")] },
      tricksWon: { p0: 0, p1: 0, p2: 0 },
    };
    const inStechen = customEngine.resolveTrick(state);
    expect(inStechen.stechen?.contenders).toEqual(["p0", "p1"]);
    expect(inStechen.pendingDiscard).toEqual({ p2: 1 }); // p2 must discard

    let s = customEngine.discardCard!(inStechen, "p2", c("Eichel", "7"));
    s = customEngine.playStechen!(s, "p0", c("Rosen", "A"));
    s = customEngine.playStechen!(s, "p1", c("Schilten", "6"));
    expect(s.stechen?.contenders).toEqual(["p0", "p1"]); // still visible, not yet resolved
    expect(s.pendingDiscard).toBeUndefined();
    expect(s.hands.p2).toHaveLength(0);

    const resolved = customEngine.resolveStechen!(s);
    expect(resolved.stechen).toBeUndefined();
    expect(resolved.turnPlayerId).toBe("p0");
    expect(resolved.tricksWon.p0).toBe(2);
  });

  it("Mit Stechen: a tie on the last trick goes to the second-highest card", () => {
    const state: RoomState = {
      ...baseState(3),
      customStechen: true,
      phase: "playing",
      currentTrick: [
        { playerId: "p0", card: c("Rosen", "A") },
        { playerId: "p1", card: c("Schilten", "A") }, // tie with p0, no cards left
        { playerId: "p2", card: c("Eichel", "9") },
      ],
      hands: { p0: [], p1: [], p2: [] },
      tricksWon: { p0: 0, p1: 0, p2: 0 },
    };
    const resolved = customEngine.resolveTrick(state);
    expect(resolved.stechen).toBeUndefined();
    expect(resolved.turnPlayerId).toBe("p2");
    expect(resolved.tricksWon).toEqual({ p0: 0, p1: 0, p2: 1 });
  });

  it("Mit Stechen: last-trick tie skips further tied ranks to the next unique card", () => {
    const state: RoomState = {
      ...baseState(5),
      customStechen: true,
      phase: "playing",
      currentTrick: [
        { playerId: "p0", card: c("Rosen", "K") },
        { playerId: "p1", card: c("Schilten", "K") },
        { playerId: "p2", card: c("Eichel", "10") },
        { playerId: "p3", card: c("Schelle", "10") },
        { playerId: "p4", card: c("Rosen", "6") },
      ],
      hands: { p0: [], p1: [], p2: [], p3: [], p4: [] },
      tricksWon: { p0: 0, p1: 0, p2: 0, p3: 0, p4: 0 },
    };
    expect(customEngine.resolveTrick(state).turnPlayerId).toBe("p4");
  });

  it("Mit Stechen: a Stechen tied again on the last cards goes to the second-highest play", () => {
    const state: RoomState = {
      ...baseState(3),
      customStechen: true,
      phase: "playing",
      hands: { p0: [], p1: [], p2: [] },
      tricksWon: { p0: 0, p1: 0, p2: 0 },
      stechen: { contenders: ["p0", "p1", "p2"], rounds: 0 },
      stechenPlays: { p0: c("Rosen", "K"), p1: c("Schilten", "K"), p2: c("Eichel", "7") },
    };
    const resolved = customEngine.resolveStechen!(state);
    expect(resolved.stechen).toBeUndefined();
    expect(resolved.turnPlayerId).toBe("p2");
    expect(resolved.tricksWon.p2).toBe(2); // 1 + one Stechen round
  });

  it("Mit Stechen: two contenders tied again on the last cards — first one keeps it", () => {
    const state: RoomState = {
      ...baseState(2),
      customStechen: true,
      phase: "playing",
      hands: { p0: [], p1: [] },
      tricksWon: { p0: 0, p1: 0 },
      stechen: { contenders: ["p0", "p1"], rounds: 0 },
      stechenPlays: { p0: c("Rosen", "K"), p1: c("Schilten", "K") },
    };
    expect(customEngine.resolveStechen!(state).tricksWon.p0).toBe(2);
  });

  it("reveals hands only in 1-card rounds", () => {
    expect(customEngine.dealRound({ ...baseState(4), roundIndex: 0 }).handsRevealed).toBe(true);
    expect(customEngine.dealRound({ ...baseState(4), roundIndex: 1 }).handsRevealed).toBe(false);
  });

  it("allows two zero bids in a row (no consecutive-zero restriction)", () => {
    const state: RoomState = {
      ...baseState(3),
      phase: "bidding",
      dealerIndex: 2,
      hands: { p0: [c("Rosen", "6"), c("Rosen", "7")], p1: [c("Eichel", "6"), c("Eichel", "7")], p2: [c("Schelle", "6"), c("Schelle", "7")] },
      bids: {},
      turnPlayerId: "p0",
    };
    // Play is counter-clockwise: after p0 the turn goes to p2.
    const afterP0 = customEngine.submitBid(state, "p0", 0);
    expect(afterP0.turnPlayerId).toBe("p2");
    const afterP2 = customEngine.submitBid(afterP0, "p2", 0);
    expect(afterP2.bids.p2).toBe(0); // second 0 in a row accepted
    expect(afterP2.turnPlayerId).toBe("p1");
  });

  it("forbids the last bidder from making the bids sum to the trick count", () => {
    let state: RoomState = {
      ...baseState(3),
      phase: "bidding",
      hands: { p0: [c("Rosen", "6"), c("Rosen", "7")], p1: [c("Eichel", "6"), c("Eichel", "7")], p2: [c("Schelle", "6"), c("Schelle", "7")] },
      bids: {},
      turnPlayerId: "p0",
    };
    // Counter-clockwise bidding order: p0 -> p2 -> p1 (p1 is last).
    state = customEngine.submitBid(state, "p0", 1);
    state = customEngine.submitBid(state, "p2", 0); // running total 1, cards = 2
    expect(customEngine.submitBid(state, "p1", 1)).toBe(state); // 1+1==2 -> forbidden
    const ok = customEngine.submitBid(state, "p1", 0); // total 1 != 2 -> allowed
    expect(ok.phase).toBe("playing");
  });

  it("scores exact bids as 10 + bid and misses as -deviation", () => {
    const state: RoomState = {
      ...baseState(3),
      bids: { p0: 2, p1: 0, p2: 1 },
      tricksWon: { p0: 2, p1: 1, p2: 3 },
    };
    const scored = customEngine.scoreRound(state);
    expect(scored.scores.p0).toBe(12); // exact: 10 + 2
    expect(scored.scores.p1).toBe(-1); // |0-1|
    expect(scored.scores.p2).toBe(-2); // |1-3|
  });

  it("ramps to a player-based max and ends after all rounds", () => {
    expect(roundCardCounts(2).length).toBe(35); // max 18 -> 18*2-1
    expect(Math.max(...roundCardCounts(4))).toBe(9);
    expect(Math.max(...roundCardCounts(6))).toBe(6);
    const rounds4 = roundCardCounts(4).length; // 9*2-1 = 17
    expect(customEngine.isGameComplete({ ...baseState(4), roundIndex: rounds4 - 2 })).toBe(false);
    expect(customEngine.isGameComplete({ ...baseState(4), roundIndex: rounds4 - 1 })).toBe(true);
  });
});
