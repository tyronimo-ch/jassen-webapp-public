import { SUITS } from "./deck";
import type { TrumpMode } from "./types";

export const OBENABE_CHOICE = 4;
export const UNDENUFE_CHOICE = 5;
export const SCHIEBEN_CHOICE = -1;

// Coiffeur games (only offered when the room's schieberCoiffeur is on).
const COIFFEUR_CODES: Record<number, TrumpMode> = {
  6: "slalom-obe",
  7: "slalom-une",
  8: "guschti-obe-4",
  9: "guschti-obe-5",
  10: "guschti-une-4",
  11: "guschti-une-5",
};
const COIFFEUR_BY_MODE: Partial<Record<TrumpMode, number>> = Object.fromEntries(
  Object.entries(COIFFEUR_CODES).map(([code, mode]) => [mode, Number(code)])
);

/** Encode a Schieber trump choice into the numeric `bids` value used on the wire. */
export function encodeTrumpChoice(mode: TrumpMode): number {
  if (mode === "obenabe") return OBENABE_CHOICE;
  if (mode === "undenufe") return UNDENUFE_CHOICE;
  const coiffeur = COIFFEUR_BY_MODE[mode];
  if (coiffeur !== undefined) return coiffeur;
  return SUITS.indexOf(mode as (typeof SUITS)[number]);
}

/** Decode a numeric choice back to a TrumpMode, or null if invalid / schieben. */
export function decodeTrumpChoice(value: number): TrumpMode | null {
  if (value === OBENABE_CHOICE) return "obenabe";
  if (value === UNDENUFE_CHOICE) return "undenufe";
  if (COIFFEUR_CODES[value]) return COIFFEUR_CODES[value];
  if (value >= 0 && value < SUITS.length) return SUITS[value];
  return null;
}

/** Trump multipliers for Schieber round scoring. */
export const TRUMP_FACTOR: Record<TrumpMode, number> = {
  Rosen: 1,
  Eichel: 1,
  Schelle: 2,
  Schilten: 2,
  obenabe: 3,
  undenufe: 3,
  "slalom-obe": 4,
  "slalom-une": 4,
  "guschti-obe-4": 5,
  "guschti-obe-5": 5,
  "guschti-une-4": 5,
  "guschti-une-5": 5,
};
