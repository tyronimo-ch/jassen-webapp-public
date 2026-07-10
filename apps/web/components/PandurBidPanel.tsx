"use client";
import {
  bidLabel,
  encodePandurTrump,
  isSpecialBid,
  legalPandurRaises,
  PANDUR_PASS,
  type Suit,
} from "@jassen/game-engine";
import type { ClientRoomState } from "@/lib/types";

const SUITS: Suit[] = ["Rosen", "Eichel", "Schelle", "Schilten"];

export default function PandurBidPanel({
  state,
  myId,
  onBid,
}: {
  state: ClientRoomState;
  myId: string;
  onBid: (value: number) => void;
}) {
  const nameOf = (id?: string) => state.players.find((p) => p.id === id)?.name ?? "?";
  const highBid = state.pandurBid;
  const highInfo =
    highBid !== undefined ? (
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Höchstes Gebot: <strong>{bidLabel(highBid)}</strong> ({nameOf(state.pandurBidder)})
      </div>
    ) : (
      <div style={{ fontSize: 13, opacity: 0.7 }}>Noch kein Gebot</div>
    );

  // Trump-selection sub-phase: only the soloist picks a suit.
  if (state.pandurAwaitingTrump) {
    if (myId !== state.pandurSoloist) {
      return (
        <div className="panel">Warte auf die Trumpfwahl von {nameOf(state.pandurSoloist)}…</div>
      );
    }
    return (
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Du bist Alleinspieler — wähle den Trumpf</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SUITS.map((s) => (
            <button
              key={s}
              type="button"
              className="btn"
              onClick={() => onBid(encodePandurTrump(s))}
              style={{ flex: "1 0 45%" }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const passed = state.pandurPassed ?? [];
  if (passed.includes(myId)) {
    return (
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div>Du hast gepasst. Warte auf die übrigen Spieler…</div>
        {highInfo}
      </div>
    );
  }

  if (state.turnPlayerId !== myId) {
    return (
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div>Warte auf {nameOf(state.turnPlayerId ?? undefined)}…</div>
        {highInfo}
      </div>
    );
  }

  const raises = legalPandurRaises(highBid);
  const numeric = raises.filter((c) => !isSpecialBid(c));
  const specials = raises.filter(isSpecialBid);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340 }}>
      <div style={{ fontWeight: 600 }}>Du bist am Zug — reize oder passe</div>
      {highInfo}
      {numeric.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {numeric.map((c) => (
            <button
              key={c}
              type="button"
              className="btn btn-secondary"
              onClick={() => onBid(c)}
              style={{ padding: "4px 12px", minWidth: 52 }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {specials.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {specials.map((c) => (
            <button
              key={c}
              type="button"
              className="btn btn-secondary"
              onClick={() => onBid(c)}
              style={{ padding: "4px 12px" }}
            >
              {bidLabel(c)}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn" onClick={() => onBid(PANDUR_PASS)}>
        Passen
      </button>
    </div>
  );
}
