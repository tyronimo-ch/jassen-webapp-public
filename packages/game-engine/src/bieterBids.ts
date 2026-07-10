import type { Suit } from "./types";

/**
 * Bieterjass auction: numeric bids only, opening at BIETER_MIN_BID and rising in steps of
 * BIETER_BID_STEP. A pass is BIETER_PASS. During the trump sub-phase the König picks a
 * suit, encoded as BIETER_TRUMP_BASE + suit index.
 */
export const BIETER_PASS = 0;
export const BIETER_MIN_BID = 500;
export const BIETER_BID_STEP = 10;
/** König must reach their bid; the Bauern team races to this fixed total. */
export const BIETER_BAUERN_TARGET = 1000;
/** Practical ceiling for the opening auction (deck holds 157 card points per round). */
export const BIETER_MAX_BID = 1000;
export const BIETER_TRUMP_BASE = 4001;
/** König's "Mitkommen" decision in follow-up rounds: play along, or pass ("weg"). */
export const BIETER_MITKOMMEN = 5001;
export const BIETER_WEG = 5002;
export const BIETER_DEFAULT_PENALTY = 157;
export const BIETER_PENALTY_OPTIONS = [157, 257];

const BIETER_SUIT_ORDER: Suit[] = ["Rosen", "Eichel", "Schelle", "Schilten"];

export function isBieterBid(code: number): boolean {
  return code >= BIETER_MIN_BID && code <= BIETER_MAX_BID && code % BIETER_BID_STEP === 0;
}

export function encodeBieterTrump(suit: Suit): number {
  return BIETER_TRUMP_BASE + BIETER_SUIT_ORDER.indexOf(suit);
}
export function decodeBieterTrump(code: number): Suit | null {
  return BIETER_SUIT_ORDER[code - BIETER_TRUMP_BASE] ?? null;
}

/** The next few legal raises above `currentHigh` (or the opening bids if none yet). */
export function legalBieterRaises(currentHigh: number | undefined, count = 8): number[] {
  const from = currentHigh === undefined ? BIETER_MIN_BID : currentHigh + BIETER_BID_STEP;
  const bids: number[] = [];
  for (let n = Math.max(from, BIETER_MIN_BID); n <= BIETER_MAX_BID && bids.length < count; n += BIETER_BID_STEP) {
    bids.push(n);
  }
  return bids;
}
