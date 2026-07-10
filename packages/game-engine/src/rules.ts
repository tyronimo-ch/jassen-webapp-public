import type { Card, PlayedCard, Rank, Suit, TrumpMode } from "./types";

/** Natural "top-down" (obenabe) rank strength, low -> high. */
export const OBENABE_ORDER: Rank[] = ["6", "7", "8", "9", "10", "U", "O", "K", "A"];

export function obenabeValue(rank: Rank): number {
  return OBENABE_ORDER.indexOf(rank);
}

/** Undenufe reverses obenabe: the 6 is strongest. */
export function undenufeValue(rank: Rank): number {
  return OBENABE_ORDER.length - 1 - obenabeValue(rank);
}

const COIFFEUR_MODES = [
  "slalom-obe",
  "slalom-une",
  "guschti-obe-4",
  "guschti-obe-5",
  "guschti-une-4",
  "guschti-une-5",
] as const;

/** Is this a Coiffeur game (Slalom / Guschti)? */
export function isCoiffeur(mode: TrumpMode | null): boolean {
  return mode != null && (COIFFEUR_MODES as readonly string[]).includes(mode);
}

/** The starting direction of a Coiffeur game (also its scoring scheme). */
export function coiffeurStart(mode: TrumpMode): "obenabe" | "undenufe" | null {
  if (mode === "slalom-obe" || mode.startsWith("guschti-obe")) return "obenabe";
  if (mode === "slalom-une" || mode.startsWith("guschti-une")) return "undenufe";
  return null;
}

/** The active direction for a given trick (0-based) of a Coiffeur game. */
export function coiffeurDirection(
  mode: TrumpMode,
  trickIndex: number
): "obenabe" | "undenufe" | null {
  const start = coiffeurStart(mode);
  if (!start) return null;
  const other = start === "obenabe" ? "undenufe" : "obenabe";
  if (mode.startsWith("slalom")) return trickIndex % 2 === 0 ? start : other;
  const n = mode.endsWith("-5") ? 5 : 4; // guschti: N of the start direction, then reversed
  return trickIndex < n ? start : other;
}

/**
 * Follow-suit legality: if the player holds a card of the lead suit they must
 * play the lead suit; otherwise any card is legal. When there is no lead suit
 * (they are leading) any card is legal.
 */
export function legalMoves(hand: Card[], leadSuit: Suit | null): Card[] {
  if (!leadSuit) return [...hand];
  const followers = hand.filter((c) => c.suit === leadSuit);
  return followers.length > 0 ? followers : [...hand];
}

/**
 * Follow-suit legality with a suit trump in play.
 * - obenabe / undenufe / no trump: plain follow-suit.
 * - Non-trump suit led: you must follow the lead suit if able, but a trump card is
 *   ALWAYS a legal alternative (Trumpf darf immer gespielt werden). Void in the lead
 *   suit => anything.
 * - Trump suit led: you must follow trump if able, except you may keep the Buur
 *   (trump Under) — if that is your only trump you may play anything.
 */
export function legalMovesWithTrump(
  hand: Card[],
  leadSuit: Suit | null,
  trumpMode: TrumpMode | null
): Card[] {
  if (!leadSuit) return [...hand];
  if (!trumpMode || trumpMode === "obenabe" || trumpMode === "undenufe" || isCoiffeur(trumpMode)) {
    return legalMoves(hand, leadSuit); // no trump suit -> plain follow-suit
  }

  const trumpSuit = trumpMode;
  const trumps = hand.filter((c) => c.suit === trumpSuit);

  if (leadSuit === trumpSuit) {
    if (trumps.length === 0) return [...hand];
    if (trumps.length === 1 && trumps[0].rank === "U") return [...hand]; // keep the Buur
    return trumps;
  }

  const followers = hand.filter((c) => c.suit === leadSuit);
  if (followers.length === 0) return [...hand];
  return [...followers, ...trumps]; // follow suit, or trump in
}

/** Winner of a trick with no trump, using obenabe ordering (highest of lead suit wins). */
export function trickWinnerNoTrump(trick: PlayedCard[]): string {
  const leadSuit = trick[0].card.suit;
  let best = trick[0];
  for (const played of trick) {
    if (played.card.suit !== leadSuit) continue;
    if (obenabeValue(played.card.rank) > obenabeValue(best.card.rank)) best = played;
  }
  return best.playerId;
}
