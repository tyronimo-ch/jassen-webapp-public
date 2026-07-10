"use client";
import {
  BIETER_MITKOMMEN,
  BIETER_PASS,
  BIETER_WEG,
  encodeBieterTrump,
  legalBieterRaises,
  type Suit,
} from "@jassen/game-engine";
import type { ClientRoomState } from "@/lib/types";

const SUITS: Suit[] = ["Rosen", "Eichel", "Schelle", "Schilten"];

export default function BieterBidPanel({
  state,
  myId,
  onBid,
}: {
  state: ClientRoomState;
  myId: string;
  onBid: (value: number) => void;
}) {
  const nameOf = (id?: string) => state.players.find((p) => p.id === id)?.name ?? "?";

  // Mitkommen decision (follow-up rounds): only the König answers.
  if (state.bieterAwaitingMitkommen) {
    if (myId !== state.bieterKoenig) {
      return <div className="panel">Warte, ob der König mitkommt…</div>;
    }
    const penalty = state.bieterMitkommenPenalty ?? 157;
    return (
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340 }}>
        <div style={{ fontWeight: 600 }}>Kommst du mit?</div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          Passt du, erhalten die Bauern {penalty} Punkte (plus Stöck) und du gehst leer aus.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" onClick={() => onBid(BIETER_MITKOMMEN)} style={{ flex: 1 }}>
            Mitkommen
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onBid(BIETER_WEG)}
            style={{ flex: 1 }}
          >
            Weg (passen)
          </button>
        </div>
      </div>
    );
  }

  // Trump sub-phase (round 1): only the König picks a suit.
  if (state.bieterAwaitingTrump) {
    if (myId !== state.bieterKoenig) {
      return <div className="panel">Warte auf die Trumpfwahl von {nameOf(state.bieterKoenig)}…</div>;
    }
    return (
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Du bist König — wähle den Trumpf</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SUITS.map((s) => (
            <button
              key={s}
              type="button"
              className="btn"
              onClick={() => onBid(encodeBieterTrump(s))}
              style={{ flex: "1 0 45%" }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const high = state.bieterBid;
  const highInfo =
    high !== undefined ? (
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Höchstes Gebot: <strong>{high}</strong> ({nameOf(state.bieterBidder)})
      </div>
    ) : (
      <div style={{ fontSize: 13, opacity: 0.7 }}>Noch kein Gebot (Start bei 500)</div>
    );

  const passed = state.bieterPassed ?? [];
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

  const raises = legalBieterRaises(high);
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340 }}>
      <div style={{ fontWeight: 600 }}>Du bist am Zug — biete oder passe</div>
      {highInfo}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {raises.map((c) => (
          <button
            key={c}
            type="button"
            className="btn btn-secondary"
            onClick={() => onBid(c)}
            style={{ padding: "4px 12px", minWidth: 56 }}
          >
            {c}
          </button>
        ))}
      </div>
      <button type="button" className="btn" onClick={() => onBid(BIETER_PASS)}>
        Passen
      </button>
    </div>
  );
}
