export type Suit = "Rosen" | "Eichel" | "Schelle" | "Schilten";
export type Rank = "6" | "7" | "8" | "9" | "10" | "U" | "O" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type GameMode = "schieber" | "differenzler" | "custom" | "pandur" | "bieter";

/**
 * A suit trump, the two directional variants, or a Coiffeur "game" whose direction
 * (obenabe/undenufe) alternates per trick:
 *  - slalom-obe / slalom-une: alternate every trick, starting obenabe / undenufe.
 *  - guschti-{obe,une}-{4,5}: N tricks of the start direction, then the rest reversed.
 */
export type TrumpMode =
  | Suit
  | "obenabe"
  | "undenufe"
  | "slalom-obe"
  | "slalom-une"
  | "guschti-obe-4"
  | "guschti-obe-5"
  | "guschti-une-4"
  | "guschti-une-5";

export type GamePhase = "lobby" | "bidding" | "playing" | "roundEnd" | "gameEnd";

export interface Player {
  id: string;
  name: string;
  seat: number;
  connected: boolean;
}

export interface PlayedCard {
  playerId: string;
  card: Card;
}

/** A single Weis (meld) — its cards, value, and a label — attributed to a player. */
export interface WeisMeld {
  playerId: string;
  cards: Card[];
  value: number;
  label: string;
}

export interface RoomState {
  code: string;
  mode: GameMode;
  players: Player[];
  phase: GamePhase;

  roundIndex: number;
  dealerIndex: number;

  hands: Record<string, Card[]>;
  currentTrick: PlayedCard[];

  /** Meaning depends on mode: Schieber = trump choice code; Differenzler = predicted points; FYN = predicted tricks. */
  bids: Record<string, number>;
  /** Cumulative game score per player. For Differenzler this is a running penalty total (lower is better). */
  scores: Record<string, number>;
  tricksWon: Record<string, number>;
  /** Card points collected this round (per player), before team aggregation / multipliers. */
  roundPoints: Record<string, number>;

  turnPlayerId: string | null;
  trumpMode: TrumpMode | null;

  // --- Schieber ---
  schiebenUsed: boolean;
  stoeckBonus: Record<string, number>;
  targetScore: number;
  /** Trump multiplier applied to this round's team totals (Schieber only). */
  trumpFactor: number;
  /** Weis points per player this round (Schieber). */
  weis?: Record<string, number>;
  /** Comparable strength of each player's best Weis, to decide which team scores. */
  weisKey?: Record<string, number>;
  /** Declared melds per player (present key = that player has declared their Weis). */
  weisMelds?: Record<string, WeisMeld[]>;
  /** The winning team's Weis (with cards), revealed to everyone once declared. */
  weisReveal?: WeisMeld[];

  // --- FYN ---
  /** When true, players see everyone's hand except their own (1-card rounds). */
  handsRevealed: boolean;

  // --- Differenzler ---
  /** "Gstört" (default): trump pool includes obenabe/undenufe. false = "Klassisch" (suits only). */
  differenzlerGstoert?: boolean;

  // --- Fuck Your Neighbour ---
  /** "Mit Stechen": no suit tiebreak — rank ties are resolved by a Stechen. */
  customStechen?: boolean;
  /**
   * "Härti": suit strength fully overrides card value. Suit order (high -> low)
   * Schilten > Schelle > Eichel > Rosen; within a suit, normal order (Ace high, 6 low).
   */
  customHaerti?: boolean;
  /** Active Stechen: the still-tied players who must each play a card, and the round count. */
  stechen?: { contenders: string[]; rounds: number };
  /** Cards the contenders have played into the current Stechen round. */
  stechenPlays?: Record<string, Card>;
  /** During a Stechen, players not involved must discard: playerId -> cards still to drop. */
  pendingDiscard?: Record<string, number>;

  // --- Schieber ---
  /** When true, the trump chooser may also pick Coiffeur games (Slalom / Guschti). */
  schieberCoiffeur?: boolean;

  // --- Pandur ---
  /** The player who won the auction and plays alone against the rest. */
  pandurSoloist?: string;
  /** The winning bid code (numeric points or a special-announcement sentinel). */
  pandurBid?: number;
  /** The current highest bidder during the auction. */
  pandurBidder?: string;
  /** Players who have passed and are out of the current auction. */
  pandurPassed?: string[];
  /** True while the soloist still has to pick a trump suit before play begins. */
  pandurAwaitingTrump?: boolean;

  // --- Bieterjass ---
  /** The König (auction winner), fixed for the whole game; the other two are the Bauern. */
  bieterKoenig?: string;
  /** The König's winning bid — their personal target for the game. */
  bieterBid?: number;
  /** Current highest bidder during the round-1 auction. */
  bieterBidder?: string;
  /** Players who have passed and are out of the round-1 auction. */
  bieterPassed?: string[];
  /** True while the König still has to pick a trump suit (round 1 only). */
  bieterAwaitingTrump?: boolean;
  /** True in follow-up rounds while the König decides whether to play ("Mitkommen"). */
  bieterAwaitingMitkommen?: boolean;
  /** Points the Bauern get uncontested if the König passes a follow-up round (157 or 257). */
  bieterMitkommenPenalty?: number;
  /** The three open table cards the König picks up for the exchange. */
  bieterOpen?: Card[];
  /** The three hidden stock cards; from round 2 the bottom one is the Bodentrumpf. */
  bieterStock?: Card[];
  /** All 6 table cards, revealed to everyone while the König exchanges (then cleared). */
  bieterReveal?: Card[];
  /** The revealed Bodentrumpf card (round 2+), shown to everyone before play. */
  bieterBodentrumpf?: Card;
}

export interface ModeEngine {
  dealRound(state: RoomState): RoomState;
  submitBid(state: RoomState, playerId: string, value: number): RoomState;
  /** Optional: a player declares their Weis (Schieber). */
  declareWeis?(state: RoomState, playerId: string): RoomState;
  /** Optional: a contender plays their card into the current Stechen (FYN). */
  playStechen?(state: RoomState, playerId: string, card: Card): RoomState;
  /** Optional: a non-Stechen player discards a card during the Stechen (FYN). */
  discardCard?(state: RoomState, playerId: string, card: Card): RoomState;
  /** Optional: resolve a completed Stechen round once all plays/discards are in (FYN). */
  resolveStechen?(state: RoomState): RoomState;
  legalMoves(state: RoomState, playerId: string): Card[];
  playCard(state: RoomState, playerId: string, card: Card): RoomState;
  resolveTrick(state: RoomState): RoomState;
  scoreRound(state: RoomState): RoomState;
  isRoundComplete(state: RoomState): boolean;
  isGameComplete(state: RoomState): boolean;
}
