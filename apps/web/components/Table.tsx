"use client";

import { cardsPerPlayerFor, coiffeurDirection, isCoiffeur, type Card as CardType } from "@jassen/game-engine";
import type { ClientRoomState } from "@/lib/types";
import { ellipsePositions, useLayout } from "@/lib/useLayout";
import Card from "./Card";
import { CardBack, CardFan } from "./CardBack";
import Hand from "./Hand";

// Table badge path from env; falls back to the bundled default badge.
const TABLE_BADGE_PATH = process.env.NEXT_PUBLIC_TABLE_BADGE_PATH || "/table/default-badge.svg";

interface TableProps {
  state: ClientRoomState;
  myId: string;
  legal: CardType[];
  onPlay: (card: CardType) => void;
  /** Schieber: shown above the hand so the player can declare Weis before playing. */
  weisPrompt?: { amount: number; onWeis: () => void };
  /** FYN "Mit Stechen": when set, the whole hand is selectable for a special action
   *  (play into the Stechen, or discard), with a message shown. */
  handOverride?: { message: string; onSelect: (card: CardType) => void };
}

function orderedFromMe<T extends { id: string; seat: number }>(players: T[], myId: string): T[] {
  const bySeat = [...players].sort((a, b) => a.seat - b.seat);
  const myIdx = bySeat.findIndex((p) => p.id === myId);
  if (myIdx < 0) return bySeat;
  return [...bySeat.slice(myIdx), ...bySeat.slice(0, myIdx)];
}

const COIFFEUR_LABELS: Record<string, string> = {
  "slalom-obe": "Slalom Obenabe",
  "slalom-une": "Slalom Undenufe",
  "guschti-obe-4": "Guschti Obenabe",
  "guschti-obe-5": "Guschti Obenabe",
  "guschti-une-4": "Guschti Undenufe",
  "guschti-une-5": "Guschti Undenufe",
};

function trumpLabel(state: ClientRoomState): string {
  if (state.mode === "custom") return "8 hoch";
  if (!state.trumpMode) return "Trumpf wird gewählt…";
  if (state.trumpMode === "obenabe") return "Obenabe";
  if (state.trumpMode === "undenufe") return "Undenufe";
  if (COIFFEUR_LABELS[state.trumpMode]) return COIFFEUR_LABELS[state.trumpMode];
  return `Trumpf: ${state.trumpMode}`;
}

/** Game mode + variant shown at the very top of the table. */
function gameModeLabel(state: ClientRoomState): string {
  if (state.mode === "schieber")
    return `Schieber - ${state.schieberCoiffeur ? "Coiffeur" : "Klassisch"}`;
  if (state.mode === "differenzler")
    return `Differenzler - ${state.differenzlerGstoert === false ? "Klassisch" : "Gstört"}`;
  if (state.mode === "pandur") return "Pandur";
  if (state.mode === "bieter") return "Bieterjass";
  if (state.customStechen) return "Fuck Your Neighbour - Mit Stechen";
  if (state.customHaerti) return "Fuck Your Neighbour - Härte";
  return "Fuck Your Neighbour";
}

export default function Table({ state, myId, legal, onPlay, weisPrompt, handOverride }: TableProps) {
  const layout = useLayout();
  const ordered = orderedFromMe(state.players, myId);
  const positions = ellipsePositions(ordered.length);

  const myHand = state.hands[myId] ?? [];
  const myTurn = state.turnPlayerId === myId;
  const nameById = new Map(state.players.map((p) => [p.id, p.name]));
  // Badge size mirrors the `.table-badge` CSS (width min(38vmin, 260px), aspect 864x1222).
  const badgeW = Math.min(0.28 * Math.min(layout.w, layout.h), 190);
  const badgeHalf = (badgeW * 1222) / 864 / 2;
  // Coiffeur games alternate obenabe/undenufe per trick — show the current direction.
  const coiffeurNow =
    state.mode === "schieber" && state.phase === "playing" && isCoiffeur(state.trumpMode)
      ? coiffeurDirection(state.trumpMode!, Object.values(state.tricksWon).reduce((s, v) => s + v, 0))
      : null;
  const bidTotal = Object.values(state.bids).reduce((sum, v) => sum + v, 0);
  // Tricks available this round — constant; does NOT count down as cards are played.
  const trickCount =
    state.mode === "custom"
      ? cardsPerPlayerFor(state.roundIndex, state.players.length)
      : state.handCounts[myId] ?? 0;

  // FYN variants (Mit Stechen / Härti) don't use the plain "8 hoch" order, so we hide
  // that label and show only the mode/variant name.
  const isCustomStechen =
    state.mode === "custom" && (state.customStechen || state.customHaerti);

  return (
    <div className="table-root">
      {/* Game mode + variant — Hidden entirely if in custom ("8 hoch" / "Stechen") mode */}
      {state.mode !== "custom" && (
        <div
          style={{
            textAlign: "center",
            padding: "4px 0",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--gold-bright)",
            background: "rgba(0,0,0,0.35)",
          }}
        >
          {gameModeLabel(state)}
        </div>
      )}

      {/* Header */}
      <div className="table-header">
        <div>
          {/* Show "8 hoch" ONLY if it's NOT the custom stechen variant */}
          {!isCustomStechen && trumpLabel(state)}
          
          {/* Appends the variant text based on whether "8 hoch" is hidden or not */}
          {state.mode === "custom" && (
            <span 
              style={{ 
                marginLeft: isCustomStechen ? 0 : 12, 
                fontSize: "1.15rem", 
                fontWeight: 700, 
                color: "var(--gold-bright)" 
              }}
            >
              {isCustomStechen ? gameModeLabel(state) : `· ${gameModeLabel(state)}`}
            </span>
          )}
          
          {state.mode === "schieber" && state.trumpFactor > 1 ? ` ×${state.trumpFactor}` : ""}
          {coiffeurNow ? ` · ${coiffeurNow === "obenabe" ? "Obenabe" : "Undenufe"}` : ""}
        </div>
        <div>
          Runde {state.roundIndex + 1}
          {state.mode === "custom" && (
            <span style={{ marginLeft: 10, opacity: 0.85 }}>
              Ansagen {bidTotal}/{trickCount}
            </span>
          )}
          {state.handsRevealed && (
            <span
              style={{
                marginLeft: 10,
                padding: "2px 10px",
                borderRadius: 10,
                background: "var(--gold)",
                color: "var(--ink)",
                fontSize: 13,
              }}
            >
              Stirnrunde — du siehst deine eigene Karte nicht
            </span>
          )}
        </div>
        <div>
          {state.turnPlayerId
            ? myTurn
              ? "Du bist dran"
              : `${nameById.get(state.turnPlayerId) ?? "…"} ist dran`
            : "…"}
        </div>
      </div>

      {/* Felt oval with opponents + trick */}
      <div className="felt">
        {/* Center club badge — override via NEXT_PUBLIC_TABLE_BADGE_PATH */}
        {TABLE_BADGE_PATH && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={TABLE_BADGE_PATH} alt="Table Badge" className="table-badge" />
        )}

        {ordered.map((p, i) => {
          if (p.id === myId) return null;
          const pos = positions[i];
          const count = state.handCounts[p.id] ?? 0;
          const revealedCard = state.handsRevealed ? state.hands[p.id]?.[0] : undefined;
          return (
            <div
              key={p.id}
              className="seat"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className={`seat-name ${state.turnPlayerId === p.id ? "seat-active" : ""}`}>
                {p.name} ·{" "}
                {state.mode === "differenzler"
                  ? state.roundPoints[p.id] ?? 0
                  : state.tricksWon[p.id] ?? 0}
                {state.mode !== "schieber" && state.bids[p.id] !== undefined ? `/${state.bids[p.id]}` : ""}
              </div>
              {revealedCard ? (
                <Card card={revealedCard} width={layout.smallCardW} />
              ) : (
                <CardFan count={count} width={layout.smallCardW} />
              )}
            </div>
          );
        })}

        {/* Played cards sit in front of the player who played them (seat → centre). */}
        {state.currentTrick.map((pc) => {
          const idx = ordered.findIndex((p) => p.id === pc.playerId);
          const seat = positions[idx] ?? { x: 50, y: 50 };
          const x = 50 + (seat.x - 50) * 0.5;
          const y = 50 + (seat.y - 50) * 0.5;
          return (
            <div key={pc.playerId} className="trick-card" style={{ left: `${x}%`, top: `${y}%` }}>
              <Card card={pc.card} width={layout.trickCardW} />
            </div>
          );
        })}

        {/* Stechen: contenders' cards appear at their seat as soon as each is played. */}
        {state.stechen &&
          Object.entries(state.stechenPlays ?? {}).map(([playerId, card]) => {
            const idx = ordered.findIndex((p) => p.id === playerId);
            const seat = positions[idx] ?? { x: 50, y: 50 };
            const x = 50 + (seat.x - 50) * 0.5;
            const y = 50 + (seat.y - 50) * 0.5;
            return (
              <div key={`stechen-${playerId}`} className="trick-card" style={{ left: `${x}%`, top: `${y}%` }}>
                <Card card={card} width={layout.trickCardW} />
              </div>
            );
          })}

        {/* Weis: declare before your first card (Schieber) — sits below the centre badge. */}
        {weisPrompt && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, ${badgeHalf + 14}px)`,
              zIndex: 4,
            }}
          >
            <button type="button" className="btn" onClick={weisPrompt.onWeis}>
              Wysse ({weisPrompt.amount})
            </button>
          </div>
        )}
      </div>

      {/* Your own bid / tricks (opponents show theirs at their seats) */}
      {state.mode !== "schieber" && (
        <div style={{ textAlign: "center", fontSize: 13, opacity: 0.9, paddingTop: 4 }}>
          Du ·{" "}
          {state.mode === "differenzler"
            ? `Punkte ${state.roundPoints[myId] ?? 0}`
            : `Stiche ${state.tricksWon[myId] ?? 0}`}
          {state.bids[myId] !== undefined ? ` · Ansage ${state.bids[myId]}` : ""}
        </div>
      )}


      {/* My hand — height pinned to a card so playing the last card doesn't collapse it. */}
      <div className="my-hand" style={{ minHeight: layout.cardW * (246.62 / 158.74) + 30 }}>
        {state.handsRevealed ? (
          (state.handCounts[myId] ?? 0) > 0 ? (
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              <CardBack width={layout.cardW} />
              <span style={{ alignSelf: "center", color: "var(--cream)" }}>
                (deine Karte ist diese Runde verdeckt)
              </span>
            </div>
          ) : null
        ) : (
          <Hand
            hand={myHand}
            legal={handOverride ? myHand : legal}
            myTurn={handOverride ? true : state.phase === "playing" && myTurn}
            cardW={layout.cardW}
            onPlay={handOverride ? handOverride.onSelect : onPlay}
          />
        )}
      </div>

      {/* Stechen prompt (play a card / discard) */}
      {handOverride && (
        <div
          className="panel"
          style={{
            position: "fixed",
            top: 52,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 15,
            textAlign: "center",
          }}
        >
          {handOverride.message}
        </div>
      )}
      {!handOverride && state.stechen && (
        <div
          className="panel"
          style={{
            position: "fixed",
            top: 52,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 15,
            textAlign: "center",
            opacity: 0.85,
          }}
        >
          Stechen läuft…
        </div>
      )}
    </div>
  );
}