"use client";
import { encodeTrumpChoice, SCHIEBEN_CHOICE, type TrumpMode } from "@jassen/game-engine";

interface TrumpPanelProps {
  myTurn: boolean;
  canSchieben: boolean;
  coiffeur?: boolean;
  onChoose: (value: number) => void;
}

const OPTIONS: { mode: TrumpMode; label: string }[] = [
  { mode: "Rosen", label: "Rosen (×1)" },
  { mode: "Eichel", label: "Eichel (×1)" },
  { mode: "Schelle", label: "Schelle (×2)" },
  { mode: "Schilten", label: "Schilten (×2)" },
  { mode: "obenabe", label: "Obenabe (×3)" },
  { mode: "undenufe", label: "Undenufe (×3)" },
];

const COIFFEUR_OPTIONS: { mode: TrumpMode; label: string }[] = [
  { mode: "slalom-obe", label: "Slalom Obenabe (×4)" },
  { mode: "slalom-une", label: "Slalom Undenufe (×4)" },
  { mode: "guschti-obe-5", label: "Guschti Obenabe (×5)" },
  { mode: "guschti-une-5", label: "Guschti Undenufe (×5)" },
];

export default function TrumpPanel({ myTurn, canSchieben, coiffeur, onChoose }: TrumpPanelProps) {
  if (!myTurn) {
    return <div className="panel">Warte auf Trumpfwahl…</div>;
  }
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontWeight: 600 }}>Trumpf wählen</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            className="btn"
            onClick={() => onChoose(encodeTrumpChoice(opt.mode))}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {coiffeur && (
        <>
          <div style={{ fontWeight: 600, fontSize: 13, opacity: 0.85 }}>Coiffeur</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {COIFFEUR_OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                type="button"
                className="btn btn-secondary"
                onClick={() => onChoose(encodeTrumpChoice(opt.mode))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
      {canSchieben && (
        <button type="button" className="btn btn-secondary" onClick={() => onChoose(SCHIEBEN_CHOICE)}>
          Schieben (an Partner weitergeben)
        </button>
      )}
    </div>
  );
}
