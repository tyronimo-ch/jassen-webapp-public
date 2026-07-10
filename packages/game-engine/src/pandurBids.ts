import type { Suit } from "./types";

/**
 * Pandur bidding: numeric bids (100..PANDUR_MAX_NUMERIC in steps of 10) plus four
 * special announcements. Bid codes are plain numbers so they fit RoomState.bids and
 * the generic game:bid transport:
 *  - numeric bids are their own value (100, 110, …),
 *  - special announcements use sentinel codes (1001..1004),
 *  - a trump-suit pick during the trump sub-phase uses codes 3001..3004,
 *  - PANDUR_PASS is a pass in the auction.
 */
export const PANDUR_SPECIAL = {
  MISERE_OHNE: 1001,
  MISERE_MIT: 1002,
  PANDUR_OHNE: 1003,
  PANDUR_MIT: 1004,
} as const;

export const PANDUR_PASS = 0;
export const PANDUR_MIN_BID = 100;
/** Without Weis the 24-card deck holds 157 points, so numeric bids top out here. */
export const PANDUR_MAX_NUMERIC = 150;
export const PANDUR_BID_STEP = 10;
export const PANDUR_TRUMP_BASE = 3001;

const PANDUR_SUIT_ORDER: Suit[] = ["Rosen", "Eichel", "Schelle", "Schilten"];

export function isSpecialBid(code: number): boolean {
  return code >= 1001 && code <= 1004;
}
export function isNumericBid(code: number): boolean {
  return code >= PANDUR_MIN_BID && code <= PANDUR_MAX_NUMERIC && code % PANDUR_BID_STEP === 0;
}
export function isMisereBid(code: number): boolean {
  return code === PANDUR_SPECIAL.MISERE_OHNE || code === PANDUR_SPECIAL.MISERE_MIT;
}
export function isPandurBid(code: number): boolean {
  return code === PANDUR_SPECIAL.PANDUR_OHNE || code === PANDUR_SPECIAL.PANDUR_MIT;
}
/** "Ohne Trumpf" announcements — played with no trump (top-down, Ace high). */
export function isOhneTrump(code: number): boolean {
  return code === PANDUR_SPECIAL.MISERE_OHNE || code === PANDUR_SPECIAL.PANDUR_OHNE;
}
/** Numeric bids and the "mit" announcements let the soloist pick a trump suit. */
export function needsTrumpChoice(code: number): boolean {
  if (isSpecialBid(code)) return !isOhneTrump(code);
  return isNumericBid(code);
}

/** A monotonic ordering for the ascending auction (specials slot between numeric ranges). */
export function bidOrder(code: number): number {
  switch (code) {
    case PANDUR_SPECIAL.MISERE_OHNE:
      return 200.1;
    case PANDUR_SPECIAL.MISERE_MIT:
      return 200.2;
    case PANDUR_SPECIAL.PANDUR_OHNE:
      return 250.1;
    case PANDUR_SPECIAL.PANDUR_MIT:
      return 300.1;
    default:
      return code;
  }
}

/** Schreibpunkte (game points) awarded for a bid, per the standard Pandur table. */
export function bidPoints(code: number): number {
  switch (code) {
    case PANDUR_SPECIAL.MISERE_OHNE:
    case PANDUR_SPECIAL.MISERE_MIT:
      return 4;
    case PANDUR_SPECIAL.PANDUR_OHNE:
      return 5;
    case PANDUR_SPECIAL.PANDUR_MIT:
      return 6;
    default:
      if (code <= 140) return 2;
      if (code <= 190) return 3;
      if (code <= 240) return 4;
      if (code <= 290) return 5;
      return 6;
  }
}

export function bidLabel(code: number): string {
  switch (code) {
    case PANDUR_SPECIAL.MISERE_OHNE:
      return "Misère ohne";
    case PANDUR_SPECIAL.MISERE_MIT:
      return "Misère mit";
    case PANDUR_SPECIAL.PANDUR_OHNE:
      return "Pandur ohne";
    case PANDUR_SPECIAL.PANDUR_MIT:
      return "Pandur mit";
    default:
      return String(code);
  }
}

export function encodePandurTrump(suit: Suit): number {
  return PANDUR_TRUMP_BASE + PANDUR_SUIT_ORDER.indexOf(suit);
}
export function decodePandurTrump(code: number): Suit | null {
  return PANDUR_SUIT_ORDER[code - PANDUR_TRUMP_BASE] ?? null;
}

/** All valid raises strictly above `currentHigh` (or the opening bids if none yet). */
export function legalPandurRaises(currentHigh: number | undefined): number[] {
  const floor = currentHigh === undefined ? -Infinity : bidOrder(currentHigh);
  const bids: number[] = [];
  for (let n = PANDUR_MIN_BID; n <= PANDUR_MAX_NUMERIC; n += PANDUR_BID_STEP) {
    if (bidOrder(n) > floor) bids.push(n);
  }
  for (const s of [
    PANDUR_SPECIAL.MISERE_OHNE,
    PANDUR_SPECIAL.MISERE_MIT,
    PANDUR_SPECIAL.PANDUR_OHNE,
    PANDUR_SPECIAL.PANDUR_MIT,
  ]) {
    if (bidOrder(s) > floor) bids.push(s);
  }
  return bids.sort((a, b) => bidOrder(a) - bidOrder(b));
}
