"use client";
import {
  DIFFERENZLER_ROUND_OPTIONS,
  PANDUR_DEFAULT_TARGET,
  PANDUR_TARGET_OPTIONS,
  type GameMode,
} from "@jassen/game-engine";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
import RulesOverlay from "@/components/RulesOverlay";
import Footer from "@/components/Footer";

// Title
const APP_TITLE = process.env.NEXT_PUBLIC_APP_TITLE || "Jassen Webapp";

const MODES: { id: GameMode; label: string; blurb: string }[] = [
  { id: "bieter", label: "Bieter", blurb: "3 Spieler" },
  { id: "schieber", label: "Schieber", blurb: "4 Spieler" },
  { id: "differenzler", label: "Differenzler", blurb: "4 Spieler" },
  { id: "custom", label: "Fuck Your Neighbour", blurb: "2–6 Spieler" },
  // { id: "pandur", label: "Pandur", blurb: "2–4 Spieler" }, // TODO: re-enable Pandur — uncomment to show it again
];

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<GameMode>("schieber");
  const [target, setTarget] = useState(2500);
  const [diffRounds, setDiffRounds] = useState(12);
  const [diffGstoert, setDiffGstoert] = useState(true);
  const [schieberCoiffeur, setSchieberCoiffeur] = useState(false);
  const [customVariant, setCustomVariant] = useState<"klassisch" | "stechen" | "haerti">(
    "klassisch"
  );
  const [pandurTarget, setPandurTarget] = useState(PANDUR_DEFAULT_TARGET);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [rulesMode, setRulesMode] = useState<GameMode | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onJoined = ({ code, playerId }: { code: string; playerId: string }) => {
      sessionStorage.setItem(`jassen:${code}`, JSON.stringify({ playerId, name }));
      router.push(`/room/${code}`);
    };
    const onError = ({ message }: { message: string }) => setError(message);
    socket.on("room:joined", onJoined);
    socket.on("room:error", onError);
    return () => {
      socket.off("room:joined", onJoined);
      socket.off("room:error", onError);
    };
  }, [name, router]);

  const create = () => {
    setError("");
    if (!name.trim()) return setError("Bitte zuerst einen Namen eingeben");
    const targetScore =
      mode === "schieber"
        ? target
        : mode === "differenzler"
          ? diffRounds
          : mode === "pandur"
            ? pandurTarget
            : undefined;
    const gstoert = mode === "differenzler" ? diffGstoert : undefined;
    const coiffeur = mode === "schieber" ? schieberCoiffeur : undefined;
    const stechen = mode === "custom" ? customVariant === "stechen" : undefined;
    const haerti = mode === "custom" ? customVariant === "haerti" : undefined;
    getSocket().emit("room:create", { mode, name, targetScore, gstoert, coiffeur, stechen, haerti });
  };
  const join = () => {
    setError("");
    if (!name.trim()) return setError("Bitte zuerst einen Namen eingeben");
    if (joinCode.trim().length < 4) return setError("Bitte einen 4-stelligen Code eingeben");
    getSocket().emit("room:join", { code: joinCode.trim().toUpperCase(), name });
  };

  return (
    <main className="center-screen">
      <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 420, maxWidth: "100%" }}>
        <h1 style={{ margin: 0, color: "var(--gold-bright)" }}>{APP_TITLE}</h1>
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            Dein Name
            <input
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Alex"
              style={{ width: "100%", marginTop: 6 }}
            />
          </label>
        </div>

        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <strong>Spiel erstellen</strong>
          <div style={{ display: "grid", gap: 8 }}>
            {MODES.map((m) => (
              <div key={m.id} style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={m.id === mode ? "btn" : "btn btn-secondary"}
                  onClick={() => setMode(m.id)}
                  style={{ flex: 1, textAlign: "left" }}
                >
                  {m.label} — <span style={{ opacity: 0.8, fontWeight: 400 }}>{m.blurb}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRulesMode(m.id)}
                  aria-label={`Regeln ${m.label}`}
                  title="Regeln"
                  style={{ padding: "0 14px", fontWeight: 700 }}
                >
                  ?
                </button>
              </div>
            ))}
          </div>
          {mode === "schieber" && (
            <label>
              Zielpunktzahl: <strong>{target}</strong>
              <input
                type="range"
                min={1000}
                max={10000}
                step={500}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                style={{ width: "100%", marginTop: 6 }}
              />
            </label>
          )}
          {mode === "schieber" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={!schieberCoiffeur ? "btn" : "btn btn-secondary"}
                onClick={() => setSchieberCoiffeur(false)}
                style={{ flex: 1 }}
              >
                Klassisch
              </button>
              <button
                type="button"
                className={schieberCoiffeur ? "btn" : "btn btn-secondary"}
                onClick={() => setSchieberCoiffeur(true)}
                style={{ flex: 1 }}
              >
                Coiffeur
              </button>
            </div>
          )}
          {mode === "differenzler" && (
            <label>
              Runden: <strong>{diffRounds}</strong>
              <input
                type="range"
                min={DIFFERENZLER_ROUND_OPTIONS[0]}
                max={DIFFERENZLER_ROUND_OPTIONS[DIFFERENZLER_ROUND_OPTIONS.length - 1]}
                step={DIFFERENZLER_ROUND_OPTIONS[1] - DIFFERENZLER_ROUND_OPTIONS[0]}
                value={diffRounds}
                onChange={(e) => setDiffRounds(Number(e.target.value))}
                style={{ width: "100%", marginTop: 6 }}
              />
            </label>
          )}
          {mode === "differenzler" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={!diffGstoert ? "btn" : "btn btn-secondary"}
                onClick={() => setDiffGstoert(false)}
                style={{ flex: 1 }}
              >
                Klassisch
              </button>
              <button
                type="button"
                className={diffGstoert ? "btn" : "btn btn-secondary"}
                onClick={() => setDiffGstoert(true)}
                style={{ flex: 1 }}
              >
                Gestört
              </button>
            </div>
          )}
          {mode === "custom" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={customVariant === "klassisch" ? "btn" : "btn btn-secondary"}
                onClick={() => setCustomVariant("klassisch")}
                style={{ flex: 1 }}
              >
                Klassisch
              </button>
              <button
                type="button"
                className={customVariant === "stechen" ? "btn" : "btn btn-secondary"}
                onClick={() => setCustomVariant("stechen")}
                style={{ flex: 1 }}
              >
                Mit Stechen
              </button>
              <button
                type="button"
                className={customVariant === "haerti" ? "btn" : "btn btn-secondary"}
                onClick={() => setCustomVariant("haerti")}
                style={{ flex: 1 }}
              >
                Härte
              </button>
            </div>
          )}
          {mode === "pandur" && (
            <div>
              <div style={{ marginBottom: 6 }}>Zielpunktzahl</div>
              <div style={{ display: "flex", gap: 8 }}>
                {PANDUR_TARGET_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={pandurTarget === t ? "btn" : "btn btn-secondary"}
                    onClick={() => setPandurTarget(t)}
                    style={{ flex: 1 }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" className="btn" onClick={create}>
            Raum erstellen
          </button>
        </div>

        <div className="panel" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <label style={{ flex: 1 }}>
            Mit Code beitreten
            <input
              value={joinCode}
              maxLength={4}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              style={{ width: "100%", marginTop: 6, textTransform: "uppercase" }}
            />
          </label>
          <button type="button" className="btn" onClick={join}>
            Beitreten
          </button>
        </div>

        {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
      </div>

      {rulesMode && <RulesOverlay mode={rulesMode} onClose={() => setRulesMode(null)} />}

      <Footer />
    </main>
  );
}