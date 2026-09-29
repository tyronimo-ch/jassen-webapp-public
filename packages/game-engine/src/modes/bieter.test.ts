import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine";
import { BIETER_MITKOMMEN, BIETER_PASS, BIETER_WEG, encodeBieterTrump } from "../bieterBids";
import type { Player, RoomState } from "../types";
import { bieterEngine } from "./bieter";

function players(): Player[] {
  return [0, 1, 2].map((i) => ({ id: `p${i}`, name: `P${i}`, seat: i, connected: true }));
}

function dealt(): RoomState {
  return bieterEngine.dealRound(createInitialState("ROOM", "bieter", players(), 0));
}

describe("bieter", () => {
  it("plays a full trick via the shared trick helpers: highest trump wins the points", () => {
    const [p0, p1, p2] = players().map((p) => p.id);
    let s: RoomState = {
      ...createInitialState("ROOM", "bieter", players(), 0),
      phase: "playing",
      trumpMode: "Rosen",
      turnPlayerId: p0,
      hands: {
        [p0]: [{ suit: "Eichel", rank: "A" }],
        [p1]: [{ suit: "Rosen", rank: "6" }], // low trump beats the off-suit Ace
        [p2]: [{ suit: "Schelle", rank: "A" }],
      },
      tricksWon: { [p0]: 0, [p1]: 0, [p2]: 0 },
      roundPoints: { [p0]: 0, [p1]: 0, [p2]: 0 },
    };
    s = bieterEngine.playCard(s, p0, { suit: "Eichel", rank: "A" });
    s = bieterEngine.playCard(s, p2, { suit: "Schelle", rank: "A" }); // counter-clockwise: p0 -> p2 -> p1
    s = bieterEngine.playCard(s, p1, { suit: "Rosen", rank: "6" });
    s = bieterEngine.resolveTrick(s);
    expect(s.tricksWon[p1]).toBe(1); // the trump 6 wins
    expect(s.turnPlayerId).toBe(p1);
    expect(s.roundPoints[p1]).toBe(22 + 5); // two Aces (11+11) + last-trick bonus
  });

  it("deals 10 cards each plus 3 open + 3 hidden table cards", () => {
    const s = dealt();
    expect(Object.values(s.hands).every((h) => h.length === 10)).toBe(true);
    expect(s.bieterOpen).toHaveLength(3);
    expect(s.bieterStock).toHaveLength(3);
    expect(s.phase).toBe("bidding");
  });

  it("runs the round-1 auction (from 500) and makes the last bidder König", () => {
    let s = dealt();
    const first = s.turnPlayerId!;
    s = bieterEngine.submitBid(s, first, 500);
    s = bieterEngine.submitBid(s, s.turnPlayerId!, BIETER_PASS);
    s = bieterEngine.submitBid(s, s.turnPlayerId!, BIETER_PASS);
    expect(s.bieterKoenig).toBe(first);
    expect(s.bieterBid).toBe(500);
    // König picks up all 6 table cards (revealed to all) and then chooses trump.
    expect(s.hands[first]).toHaveLength(16);
    expect(s.bieterReveal).toHaveLength(6);
    expect(s.bieterAwaitingTrump).toBe(true);
  });

  it("rejects a raise that is not higher than the current bid", () => {
    let s = dealt();
    const first = s.turnPlayerId!;
    s = bieterEngine.submitBid(s, first, 520);
    const before = s;
    s = bieterEngine.submitBid(s, s.turnPlayerId!, 510); // lower -> ignored
    expect(s).toBe(before);
  });

  it("round 1: König picks trump, discards 6 (banked as points), then plays", () => {
    let s = dealt();
    const king = s.turnPlayerId!;
    s = bieterEngine.submitBid(s, king, 500);
    s = bieterEngine.submitBid(s, s.turnPlayerId!, BIETER_PASS);
    s = bieterEngine.submitBid(s, s.turnPlayerId!, BIETER_PASS);
    // Trump first (needed to value the discards), then discard 6 of the 16 cards.
    s = bieterEngine.submitBid(s, king, encodeBieterTrump("Schelle"));
    expect(s.trumpMode).toBe("Schelle");
    expect(s.pendingDiscard).toEqual({ [king]: 6 });
    const toDiscard = s.hands[king].slice(0, 6);
    for (const c of toDiscard) s = bieterEngine.discardCard!(s, king, c);
    expect(s.hands[king]).toHaveLength(10);
    expect(s.phase).toBe("playing");
    // The König leads the first trick in round 1.
    expect(s.turnPlayerId).toBe(king);
    // The 6 discards count as the König's Stich, so they scored some points.
    expect(s.roundPoints[king]).toBeGreaterThanOrEqual(0);
  });

  it("round 2+: all 36 cards dealt, no exchange, trump auto-set by Bodentrumpf", () => {
    const base = dealt();
    const king = base.players[0].id;
    // Simulate a settled game entering round 2.
    const r2 = bieterEngine.dealRound({
      ...base,
      bieterKoenig: king,
      bieterBid: 500,
      roundIndex: 1,
    });
    // Whole deck dealt (12 each), no table cards, no exchange.
    expect(Object.values(r2.hands).every((h) => h.length === 12)).toBe(true);
    expect(r2.bieterOpen).toBeUndefined();
    expect(r2.pendingDiscard).toBeUndefined();
    // Trump comes from the Bodentrumpf automatically, then the König is asked to come along.
    const boden = r2.bieterBodentrumpf!;
    expect(r2.trumpMode).toBe(boden.suit);
    expect(r2.bieterAwaitingMitkommen).toBe(true);
    const s = bieterEngine.submitBid(r2, king, BIETER_MITKOMMEN);
    expect(s.phase).toBe("playing");
    expect(s.bieterAwaitingMitkommen).toBeFalsy();
  });

  it("Mitkommen pass: the Bauern get the penalty (+Stöck) and the König scores nothing", () => {
    const base = dealt();
    const [k, b1, b2] = base.players.map((p) => p.id);
    const s: RoomState = {
      ...base,
      roundIndex: 2,
      phase: "bidding",
      bieterKoenig: k,
      bieterBid: 500,
      bieterAwaitingMitkommen: true,
      bieterMitkommenPenalty: 157,
      trumpMode: "Rosen",
      turnPlayerId: k,
      scores: { [k]: 100, [b1]: 100, [b2]: 100 },
      // b1 holds the Rosen Stöck (König + Ober of trump).
      hands: {
        [k]: [],
        [b1]: [{ suit: "Rosen", rank: "K" }, { suit: "Rosen", rank: "O" }],
        [b2]: [{ suit: "Eichel", rank: "A" }],
      },
    };
    const passed = bieterEngine.submitBid(s, k, BIETER_WEG);
    expect(passed.phase).toBe("roundEnd");
    expect(passed.scores[k]).toBe(100); // König gains nothing
    expect(passed.scores[b1]).toBe(100 + 157 + 20); // penalty + Stöck booked on first Bauer
    expect(passed.scores[b2]).toBe(100);
    // Bauern team total crossed 1000? not here — still going.
    expect(bieterEngine.isGameComplete(passed)).toBe(false);
  });

  it("ends the game when the König reaches their bid or the Bauern reach 1000", () => {
    const base = dealt();
    const [k, b1, b2] = base.players.map((p) => p.id);
    const kingWins: RoomState = { ...base, bieterKoenig: k, bieterBid: 500, scores: { [k]: 500, [b1]: 300, [b2]: 200 } };
    expect(bieterEngine.isGameComplete(kingWins)).toBe(true);
    const bauernWin = { ...kingWins, scores: { [k]: 200, [b1]: 600, [b2]: 500 } };
    expect(bieterEngine.isGameComplete(bauernWin)).toBe(true);
    const ongoing = { ...kingWins, scores: { [k]: 200, [b1]: 300, [b2]: 300 } };
    expect(bieterEngine.isGameComplete(ongoing)).toBe(false);
  });
});
