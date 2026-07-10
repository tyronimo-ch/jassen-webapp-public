"use client";
import type { WeisMeld } from "@jassen/game-engine";
import Card from "./Card";

export default function WeisReveal({
  melds,
  nameById,
}: {
  melds: WeisMeld[];
  nameById: Map<string, string>;
}) {
  if (!melds.length) return null;
  return (
    <div className="panel" style={{ minWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
      <strong style={{ fontSize: 20 }}>Wyss</strong>
      {melds.map((m, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, minWidth: 180 }}>
            {nameById.get(m.playerId) ?? "?"} · {m.label} ({m.value})
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {m.cards.map((c) => (
              <Card key={`${c.suit}-${c.rank}`} card={c} width={64} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
