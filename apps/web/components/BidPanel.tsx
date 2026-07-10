"use client";
import { useState } from "react";

interface BidPanelProps {
  label: string;
  min: number;
  max: number;
  myTurn: boolean;
  onBid: (value: number) => void;
  /** FYN only: running total of bids placed so far this round. */
  total?: number;
  /** FYN only: number of tricks available this round. */
  trickCount?: number;
  /** FYN only: the value the (last) bidder is not allowed to pick, if any. */
  forbidden?: number | null;
  /** Names of players who still need to bid (includes you when it's your turn). */
  pending?: string[];
}

export default function BidPanel({
  label,
  min,
  max,
  myTurn,
  onBid,
  total,
  trickCount,
  forbidden,
  pending,
}: BidPanelProps) {
  const [value, setValue] = useState(min);
  const [error, setError] = useState("");

  if (!myTurn) {
    const waiting = pending && pending.length > 0 ? pending.join(", ") : "andere Spieler";
    return <div className="panel">Warte auf {waiting}…</div>;
  }

  // When it's your turn, `pending` still includes you first; the rest bid after you.
  const afterYou = pending && pending.length > 1 ? pending.length - 1 : 0;

  const submit = () => {
    if (forbidden != null && value === forbidden) {
      setError(
        `Du kannst nicht ${value} ansagen — die Ansagen würden ${trickCount} ergeben (die Anzahl Stiche). Wähle eine andere Zahl.`
      );
      return;
    }
    setError("");
    onBid(value);
  };

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      {total != null && trickCount != null && (
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Ansagen bisher: <strong>{total}</strong> von {trickCount} Stichen
        </div>
      )}
      {afterYou > 0 && (
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Noch {afterYou} Spieler {afterYou > 1 ? "sagen" : "sagt"} nach dir an
        </div>
      )}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          setValue(Math.max(min, Math.min(max, Number(e.target.value))));
          setError("");
        }}
        style={{ fontSize: 20, padding: "8px 10px", width: 120, textAlign: "center" }}
      />
      <button type="button" className="btn" onClick={submit}>
        Bestätigen ({value})
      </button>
      {error && <div style={{ color: "var(--danger)", fontSize: 13, maxWidth: 260 }}>{error}</div>}
    </div>
  );
}
