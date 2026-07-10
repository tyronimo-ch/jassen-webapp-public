"use client";
import type { ClientRoomState } from "@/lib/types";

interface ScoreboardProps {
  state: ClientRoomState;
  title: string;
}

export default function Scoreboard({ state, title }: ScoreboardProps) {
  const isDifferenzler = state.mode === "differenzler";
  const isSchieber = state.mode === "schieber";
  const anyWeis = Object.values(state.weis ?? {}).some((w) => w > 0);

  // Schieber: group teammates (seats 0&2 vs 1&3) into two team rows.
  if (isSchieber && state.players.length === 4) {
    const p = state.players;
    const weisKey = state.weisKey ?? {};
    const teamKey = (a: number, b: number) => Math.max(0, weisKey[p[a].id] ?? 0, weisKey[p[b].id] ?? 0);
    const key1 = teamKey(0, 2);
    const key2 = teamKey(1, 3);
    // Only the team with the strongest Wyss receives (and is shown) any Wyss.
    const weisWinner = key1 === 0 && key2 === 0 ? null : key1 >= key2 ? 1 : 2;
    const team = (a: number, b: number, teamNo: number) => ({
      key: p[a].id,
      label: `${p[a].name} & ${p[b].name}`,
      tricks: (state.tricksWon[p[a].id] ?? 0) + (state.tricksWon[p[b].id] ?? 0),
      weis: weisWinner === teamNo ? (state.weis?.[p[a].id] ?? 0) + (state.weis?.[p[b].id] ?? 0) : 0,
      score: state.scores[p[a].id] ?? 0, // teammates share the cumulative score
    });
    const teams = [team(0, 2, 1), team(1, 3, 2)].sort((x, y) => y.score - x.score);
    return (
      <div className="panel" style={{ minWidth: 320 }}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--gold-bright)" }}>
              <th>Team</th>
              <th>Stiche</th>
              {anyWeis && <th>Wyss</th>}
              <th>Punkte</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.key} style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                <td style={{ padding: "6px 0" }}>{t.label}</td>
                <td>{t.tricks}</td>
                {anyWeis && <td>{t.weis}</td>}
                <td style={{ fontWeight: 600 }}>{t.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Scores are stored so that higher is always better (Differenzler penalties are negative).
  const rows = [...state.players].sort(
    (a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0)
  );

  return (
    <div className="panel" style={{ minWidth: 300 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--gold-bright)" }}>
            <th>Spieler</th>
            <th>Ansage</th>
            <th>Stiche</th>
            <th>{isDifferenzler ? "Minuspunkte" : "Punkte"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
              <td style={{ padding: "6px 0" }}>{p.name}</td>
              <td>{state.bids[p.id] ?? "—"}</td>
              <td>{state.tricksWon[p.id] ?? 0}</td>
              <td style={{ fontWeight: 600 }}>{state.scores[p.id] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
