import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine";
import { encodePandurTrump, PANDUR_PASS, PANDUR_SPECIAL } from "../pandurBids";
import type { Player, RoomState } from "../types";
import { pandurEngine } from "./pandur";

function players(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    seat: i,
    connected: true,
  }));
}

function dealt(n: number): RoomState {
  return pandurEngine.dealRound(createInitialState("ROOM", "pandur", players(n), 17));
}

describe("pandur", () => {
  it("deals a 24-card deck split evenly among the players", () => {
    for (const n of [2, 3, 4]) {
      const s = dealt(n);
      const sizes = Object.values(s.hands).map((h) => h.length);
      expect(sizes.every((len) => len === 24 / n)).toBe(true);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(24);
      expect(s.phase).toBe("bidding");
    }
  });

  it("runs an ascending auction and the last bidder becomes soloist", () => {
    let s = dealt(3);
    const order: string[] = [];
    // Reconstruct bidding order from the forehand.
    let turn = s.turnPlayerId!;
    // p? raises 100, next passes, next passes -> raiser is soloist.
    s = pandurEngine.submitBid(s, turn, 100);
    order.push(turn);
    turn = s.turnPlayerId!;
    s = pandurEngine.submitBid(s, turn, PANDUR_PASS);
    turn = s.turnPlayerId!;
    s = pandurEngine.submitBid(s, turn, PANDUR_PASS);
    expect(s.pandurSoloist).toBe(order[0]);
    expect(s.pandurBid).toBe(100);
    // Numeric bid -> soloist must still choose trump.
    expect(s.pandurAwaitingTrump).toBe(true);
    expect(s.turnPlayerId).toBe(order[0]);
  });

  it("a higher bid outranks a lower one", () => {
    let s = dealt(3);
    const first = s.turnPlayerId!;
    s = pandurEngine.submitBid(s, first, 100);
    const second = s.turnPlayerId!;
    s = pandurEngine.submitBid(s, second, 120);
    expect(s.pandurBid).toBe(120);
    expect(s.pandurBidder).toBe(second);
    // A raise below the current high is rejected.
    const third = s.turnPlayerId!;
    const rejected = pandurEngine.submitBid(s, third, 110);
    expect(rejected.pandurBid).toBe(120);
  });

  it("an 'ohne Trumpf' announcement skips trump selection and starts play", () => {
    let s = dealt(3);
    const first = s.turnPlayerId!;
    s = pandurEngine.submitBid(s, first, PANDUR_SPECIAL.MISERE_OHNE);
    s = pandurEngine.submitBid(s, s.turnPlayerId!, PANDUR_PASS);
    s = pandurEngine.submitBid(s, s.turnPlayerId!, PANDUR_PASS);
    expect(s.pandurSoloist).toBe(first);
    expect(s.pandurAwaitingTrump).toBeFalsy();
    expect(s.phase).toBe("playing");
    expect(s.trumpMode).toBe("obenabe");
  });

  it("scores a made numeric bid to the soloist and a failed one to the defenders", () => {
    const base = dealt(3);
    const [a, b, cc] = base.players.map((p) => p.id);
    const made: RoomState = {
      ...base,
      phase: "playing",
      pandurSoloist: a,
      pandurBid: 100,
      roundPoints: { [a]: 110, [b]: 20, [cc]: 27 },
      tricksWon: { [a]: 5, [b]: 2, [cc]: 1 },
      hands: { [a]: [], [b]: [], [cc]: [] },
    };
    const madeScored = pandurEngine.scoreRound(made);
    expect(madeScored.scores[a]).toBe(2); // 100-140 => 2 Schreibpunkte
    expect(madeScored.scores[b]).toBe(0);

    const failed = { ...made, roundPoints: { [a]: 80, [b]: 40, [cc]: 37 } };
    const failedScored = pandurEngine.scoreRound(failed);
    expect(failedScored.scores[a]).toBe(0);
    expect(failedScored.scores[b]).toBe(2);
    expect(failedScored.scores[cc]).toBe(2);
  });

  it("scores Misère only when the soloist takes zero tricks", () => {
    const base = dealt(3);
    const [a, b, cc] = base.players.map((p) => p.id);
    const clean: RoomState = {
      ...base,
      pandurSoloist: a,
      pandurBid: PANDUR_SPECIAL.MISERE_MIT,
      tricksWon: { [a]: 0, [b]: 5, [cc]: 3 },
    };
    expect(pandurEngine.scoreRound(clean).scores[a]).toBe(4);
    const dirty = { ...clean, tricksWon: { [a]: 1, [b]: 4, [cc]: 3 } };
    const scored = pandurEngine.scoreRound(dirty);
    expect(scored.scores[a]).toBe(0);
    expect(scored.scores[b]).toBe(4);
  });

  it("lets the soloist pick a trump suit for a numeric bid", () => {
    let s = dealt(2);
    const first = s.turnPlayerId!;
    s = pandurEngine.submitBid(s, first, 110);
    s = pandurEngine.submitBid(s, s.turnPlayerId!, PANDUR_PASS);
    expect(s.pandurAwaitingTrump).toBe(true);
    s = pandurEngine.submitBid(s, first, encodePandurTrump("Eichel"));
    expect(s.trumpMode).toBe("Eichel");
    expect(s.phase).toBe("playing");
  });
});
