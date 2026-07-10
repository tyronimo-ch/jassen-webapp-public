"use client";
import {
  detectWeis,
  getModeEngine,
  bidLabel as pandurBidLabel,
  DIFFERENZLER_ROUND_OPTIONS,
  MAX_PREDICTION,
  type Card,
  type RoomState,
} from "@jassen/game-engine";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import BidPanel from "@/components/BidPanel";
import CardFace from "@/components/Card";
import BieterBidPanel from "@/components/BieterBidPanel";
import PandurBidPanel from "@/components/PandurBidPanel";
import RulesOverlay from "@/components/RulesOverlay";
import Scoreboard from "@/components/Scoreboard";
import Table from "@/components/Table";
import TrumpPanel from "@/components/TrumpPanel";
import WeisReveal from "@/components/WeisReveal";
import { getSocket } from "@/lib/socket";
import type { ClientRoomState } from "@/lib/types";

interface Creds {
  playerId: string;
  name: string;
}

const MODE_LABELS: Record<string, string> = {
  schieber: "Schieber",
  differenzler: "Differenzler",
  custom: "Fuck Your Neighbour",
};

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [creds, setCreds] = useState<Creds | null>(null);
  const [state, setState] = useState<ClientRoomState | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [weisSeenRound, setWeisSeenRound] = useState(-1);
  const [targetInput, setTargetInput] = useState(0);

  const copyCode = async () => {
    // Copy the full room URL so friends can click straight in.
    const roomUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(roomUrl);
    } catch {
      // Fallback for non-secure contexts where the Clipboard API is unavailable.
      const ta = document.createElement("textarea");
      ta.value = roomUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Load stored credentials for this room.
  useEffect(() => {
    const raw = sessionStorage.getItem(`jassen:${code}`);
    if (raw) setCreds(JSON.parse(raw));
  }, [code]);

  // Wire up socket listeners.
  useEffect(() => {
    const socket = getSocket();
    const onState = (s: ClientRoomState) => setState(s);
    const onJoined = (data: { code: string; playerId: string }) => {
      const c = { playerId: data.playerId, name };
      sessionStorage.setItem(`jassen:${code}`, JSON.stringify(c));
      setCreds(c);
    };
    const onError = ({ message }: { message: string }) => setError(message);
    const onKicked = () => {
      sessionStorage.removeItem(`jassen:${code}`);
      router.push("/");
    };
    socket.on("room:state", onState);
    socket.on("room:joined", onJoined);
    socket.on("room:error", onError);
    socket.on("room:kicked", onKicked);
    return () => {
      socket.off("room:state", onState);
      socket.off("room:joined", onJoined);
      socket.off("room:error", onError);
      socket.off("room:kicked", onKicked);
    };
  }, [code, name, router]);

  // Once we know who we are, sync (also handles refresh/reconnect).
  useEffect(() => {
    if (creds) getSocket().emit("room:sync", { code, playerId: creds.playerId });
  }, [code, creds]);

  // Mirror the room's target so the lobby slider stays responsive while dragging.
  useEffect(() => {
    if (state) setTargetInput(state.targetScore);
  }, [state?.targetScore]);

  // Show the Wyss reveal after the first trick; auto-close it after 10s.
  const weisTricksPlayed = state
    ? Object.values(state.tricksWon ?? {}).reduce((a, b) => a + b, 0)
    : 0;
  const weisRevealActive =
    !!state &&
    state.phase === "playing" &&
    (state.weisReveal?.length ?? 0) > 0 &&
    weisTricksPlayed >= 1 &&
    weisSeenRound !== state.roundIndex;
  useEffect(() => {
    if (!weisRevealActive || !state) return;
    const round = state.roundIndex;
    const t = setTimeout(() => setWeisSeenRound(round), 10000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weisRevealActive, state?.roundIndex]);

  const myId = creds?.playerId ?? "";
  const myTurn = !!state && state.turnPlayerId === myId;

  const legal = useMemo<Card[]>(() => {
    if (!state || state.phase !== "playing" || !myTurn) return [];
    return getModeEngine(state.mode).legalMoves(state as unknown as RoomState, myId);
  }, [state, myTurn, myId]);

  if (!creds) {
    return (
      <main className="center-screen">
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 12, width: 360 }}>
          <strong>Raum {code} beitreten</strong>
          <input value={name} maxLength={20} placeholder="Dein Name" onChange={(e) => setName(e.target.value)} />
          <button
            type="button"
            className="btn"
            onClick={() => name.trim() && getSocket().emit("room:join", { code, name })}
          >
            Beitreten
          </button>
          {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
        </div>
      </main>
    );
  }

  if (!state) {
    return <main className="center-screen">Verbinde mit Raum {code}…</main>;
  }

  const isHost = state.hostId === myId;
  const emit = getSocket();

  // Lobby
  if (state.phase === "lobby") {
    const enough = state.players.length >= state.minPlayers;
    const isSchieberTeams = state.mode === "schieber" && state.players.length === 4;
    const move = (idx: number, dir: -1 | 1) => {
      const ids = state.players.map((pp) => pp.id);
      const j = idx + dir;
      if (j < 0 || j >= ids.length) return;
      [ids[idx], ids[j]] = [ids[j], ids[idx]];
      emit.emit("room:reorder", { code, order: ids });
    };
    return (
      <main className="center-screen">
        <div className="panel" style={{ width: 400, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <h1 style={{ margin: 0 }}>Raum {code}</h1>
            <div style={{ opacity: 0.8 }}>
              {MODE_LABELS[state.mode] ?? state.mode} · {state.players.length}/{state.maxPlayers} Spieler
            </div>
          </div>
          {(state.mode === "schieber" || state.mode === "differenzler") && (
            <label style={{ fontSize: 13 }}>
              {state.mode === "schieber" ? "Zielpunktzahl" : "Runden"}:{" "}
              <strong>{targetInput}</strong>
              {isHost ? (
                <input
                  type="range"
                  min={state.mode === "schieber" ? 1000 : DIFFERENZLER_ROUND_OPTIONS[0]}
                  max={
                    state.mode === "schieber"
                      ? 10000
                      : DIFFERENZLER_ROUND_OPTIONS[DIFFERENZLER_ROUND_OPTIONS.length - 1]
                  }
                  step={
                    state.mode === "schieber"
                      ? 500
                      : DIFFERENZLER_ROUND_OPTIONS[1] - DIFFERENZLER_ROUND_OPTIONS[0]
                  }
                  value={targetInput}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTargetInput(v);
                    emit.emit("room:setTarget", { code, targetScore: v });
                  }}
                  style={{ width: "100%", marginTop: 6 }}
                />
              ) : null}
            </label>
          )}
          {state.mode === "schieber" && (
            <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span>Variante:</span>
              {isHost ? (
                <>
                  <button
                    type="button"
                    className={!state.schieberCoiffeur ? "btn" : "btn btn-secondary"}
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => emit.emit("room:setVariant", { code, coiffeur: false })}
                  >
                    Klassisch
                  </button>
                  <button
                    type="button"
                    className={state.schieberCoiffeur ? "btn" : "btn btn-secondary"}
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => emit.emit("room:setVariant", { code, coiffeur: true })}
                  >
                    Coiffeur
                  </button>
                </>
              ) : (
                <strong>{state.schieberCoiffeur ? "Coiffeur" : "Klassisch"}</strong>
              )}
            </div>
          )}
          {state.mode === "differenzler" && (
            <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span>Variante:</span>
              {isHost ? (
                <>
                  <button
                    type="button"
                    className={state.differenzlerGstoert === false ? "btn" : "btn btn-secondary"}
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => emit.emit("room:setVariant", { code, gstoert: false })}
                  >
                    Klassisch
                  </button>
                  <button
                    type="button"
                    className={state.differenzlerGstoert !== false ? "btn" : "btn btn-secondary"}
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => emit.emit("room:setVariant", { code, gstoert: true })}
                  >
                    Gstört
                  </button>
                </>
              ) : (
                <strong>{state.differenzlerGstoert === false ? "Klassisch" : "Gstört"}</strong>
              )}
            </div>
          )}
          {state.mode === "custom" && (
            <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span>Variante:</span>
              {isHost ? (
                <>
                  <button
                    type="button"
                    className={!state.customStechen && !state.customHaerti ? "btn" : "btn btn-secondary"}
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => emit.emit("room:setVariant", { code, stechen: false, haerti: false })}
                  >
                    Klassisch
                  </button>
                  <button
                    type="button"
                    className={state.customStechen ? "btn" : "btn btn-secondary"}
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => emit.emit("room:setVariant", { code, stechen: true, haerti: false })}
                  >
                    Mit Stechen
                  </button>
                  <button
                    type="button"
                    className={state.customHaerti ? "btn" : "btn btn-secondary"}
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => emit.emit("room:setVariant", { code, stechen: false, haerti: true })}
                  >
                    Härte
                  </button>
                </>
              ) : (
                <strong>
                  {state.customStechen ? "Mit Stechen" : state.customHaerti ? "Härte" : "Klassisch"}
                </strong>
              )}
            </div>
          )}
          {isSchieberTeams && (
            <div style={{ fontSize: 13, display: "grid", gap: 2 }}>
              <div>
                <strong style={{ color: "var(--gold-bright)" }}>Team 1:</strong>{" "}
                {state.players[0].name} &amp; {state.players[2].name}
              </div>
              <div>
                <strong style={{ color: "var(--gold-bright)" }}>Team 2:</strong>{" "}
                {state.players[1].name} &amp; {state.players[3].name}
              </div>
              {isHost && (
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  Ordne die Spieler mit ↑ / ↓, um die Teams zu wählen.
                </div>
              )}
            </div>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {state.players.map((p, idx) => (
              <li
                key={p.id}
                className="panel"
                style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}
              >
                {isSchieberTeams && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 8,
                      background:
                        idx % 2 === 0 ? "rgba(200,168,75,0.3)" : "rgba(120,180,140,0.3)",
                    }}
                  >
                    Team {(idx % 2) + 1}
                  </span>
                )}
                <span style={{ flex: 1 }}>
                  {p.name} {p.id === state.hostId ? "· Host" : ""} {p.id === myId ? "· du" : ""}
                </span>
                {isHost && isSchieberTeams && (
                  <span style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "2px 8px", fontSize: 12 }}
                      disabled={idx === 0}
                      onClick={() => move(idx, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "2px 8px", fontSize: 12 }}
                      disabled={idx === state.players.length - 1}
                      onClick={() => move(idx, 1)}
                    >
                      ↓
                    </button>
                  </span>
                )}
                {isHost && p.id !== myId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    title="Entfernen"
                    aria-label={`${p.name} entfernen`}
                    style={{ padding: "2px 8px", fontSize: 12, color: "var(--danger)" }}
                    onClick={() => emit.emit("room:kick", { code, playerId: p.id })}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isHost ? (
            <button type="button" className="btn" disabled={!enough} onClick={() => emit.emit("room:start", { code })}>
              {enough ? "Spiel starten" : `Benötigt ${state.minPlayers} Spieler`}
            </button>
          ) : (
            <div style={{ opacity: 0.8 }}>Warte auf den Host…</div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: 0.85 }}>
            <span>Code: <strong>{code}</strong></span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={copyCode}
              style={{ padding: "4px 10px", fontSize: 13 }}
            >
              {copied ? "Link kopiert!" : "Link kopieren"}
            </button>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setShowRules(true)}>
            Regeln
          </button>
        </div>
        {showRules && <RulesOverlay mode={state.mode} onClose={() => setShowRules(false)} />}
      </main>
    );
  }

  // Round end / game end
  if (state.phase === "roundEnd" || state.phase === "gameEnd") {
    const title =
      state.phase === "gameEnd" ? "Spiel beendet" : `Runde ${state.roundIndex + 1} abgeschlossen`;
    return (
      <main className="center-screen">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <Scoreboard state={state} title={title} />
          {state.weisReveal && state.weisReveal.length > 0 && (
            <WeisReveal
              melds={state.weisReveal}
              nameById={new Map(state.players.map((p) => [p.id, p.name]))}
            />
          )}
          {state.phase === "roundEnd" && isHost && (
            <button type="button" className="btn" onClick={() => emit.emit("room:start", { code })}>
              Nächste Runde
            </button>
          )}
          {state.phase === "roundEnd" && !isHost && (
            <div>Warte auf den Host für die nächste Runde…</div>
          )}
          {state.phase === "gameEnd" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {isHost ? (
                <button type="button" className="btn" onClick={() => emit.emit("room:start", { code })}>
                  Neues Spiel
                </button>
              ) : (
                <span style={{ opacity: 0.8 }}>Warte auf den Host für ein neues Spiel…</span>
              )}
              <a className="btn btn-secondary" href="/">
                Zurück zur Lobby
              </a>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Bidding / playing
  const showTrumpPanel = state.mode === "schieber" && state.phase === "bidding";
  const showPandurBid = state.mode === "pandur" && state.phase === "bidding";
  // Bieter uses the "bidding" phase for the auction + trump pick; the exchange discard
  // (pendingDiscard) is handled by the hand overlay instead.
  const showBieterBid =
    state.mode === "bieter" &&
    state.phase === "bidding" &&
    !(state.pendingDiscard && (state.pendingDiscard[myId] ?? 0) > 0);
  const showBidPanel =
    state.mode !== "schieber" &&
    state.mode !== "pandur" &&
    state.mode !== "bieter" &&
    state.phase === "bidding";
  const bidMax = state.mode === "differenzler" ? MAX_PREDICTION : state.handCounts[myId] ?? 0;
  const bidLabel =
    state.mode === "differenzler" ? "Sage deine Punktzahl an" : "Sage deine Stiche an";

  // FYN hook helpers: running total of bids + the value the last bidder can't pick.
  const isCustom = state.mode === "custom";
  const bidTotal = Object.values(state.bids).reduce((sum, v) => sum + v, 0);
  const trickCount = state.handCounts[myId] ?? 0;
  const bidsPlaced = Object.keys(state.bids).length;
  const isLastBidder = bidsPlaced === state.players.length - 1;
  const forbiddenBid =
    isCustom && isLastBidder && trickCount - bidTotal >= 0 && trickCount - bidTotal <= trickCount
      ? trickCount - bidTotal
      : null;
  // Players who still need to bid, in seat order starting from whoever is on turn.
  const pendingBidders = [...state.players]
    .sort((a, b) => a.seat - b.seat)
    .filter((p) => state.bids[p.id] === undefined)
    .sort((a, b) => (a.id === state.turnPlayerId ? -1 : b.id === state.turnPlayerId ? 1 : 0))
    .map((p) => p.name);

  // Leaderboard rows as { label, score }.
  // Schieber: two teams (seats 0&2 vs 1&3), grouped names, live score = cumulative +
  // round points won so far, so it updates every trick. Other modes: per player.
  let boardRows: { key: string; label: string; score: number; base: number; round: number }[];
  if (state.mode === "schieber" && state.players.length === 4) {
    const p = state.players; // array order = seat order = engine team order
    const factor = state.trumpFactor || 1;
    const weisKey = state.weisKey ?? {};
    const bestKey = (a: number, b: number) => Math.max(0, weisKey[p[a].id] ?? 0, weisKey[p[b].id] ?? 0);
    const key1 = bestKey(0, 2);
    const key2 = bestKey(1, 3);
    const weisWinner = key1 === 0 && key2 === 0 ? 0 : key1 >= key2 ? 1 : 2;
    const team = (a: number, b: number, teamNo: number) => {
      const base = state.scores[p[a].id] ?? 0; // teammates share the cumulative score
      const rawPoints = (state.roundPoints[p[a].id] ?? 0) + (state.roundPoints[p[b].id] ?? 0);
      const stoeck = (state.stoeckBonus[p[a].id] ?? 0) + (state.stoeckBonus[p[b].id] ?? 0);
      const weis = weisWinner === teamNo ? (state.weis?.[p[a].id] ?? 0) + (state.weis?.[p[b].id] ?? 0) : 0;
      const round = (rawPoints + stoeck + weis) * factor; // live: with multiplier + Wyss
      return { key: p[a].id, label: `${p[a].name} & ${p[b].name}`, score: base + round, base, round };
    };
    boardRows = [team(0, 2, 1), team(1, 3, 2)].sort((x, y) => y.score - x.score);
  } else if (state.mode === "differenzler") {
    // Live: cumulative penalty + this round's provisional penalty |prediction - points|.
    boardRows = [...state.players]
      .map((pl) => {
        const base = state.scores[pl.id] ?? 0; // cumulative penalty (negative)
        const provisional =
          state.phase === "playing" && state.bids[pl.id] !== undefined
            ? Math.abs((state.bids[pl.id] ?? 0) - (state.roundPoints[pl.id] ?? 0))
            : 0;
        return { key: pl.id, label: pl.name, score: base - provisional, base, round: -provisional };
      })
      .sort((a, b) => b.score - a.score);
  } else if (state.mode === "bieter" && state.bieterKoenig) {
    // König (target = their bid) vs. the two Bauern as a team (target = 1000).
    const koenig = state.players.find((p) => p.id === state.bieterKoenig);
    const bauern = state.players.filter((p) => p.id !== state.bieterKoenig);
    const kScore = state.scores[state.bieterKoenig] ?? 0;
    const bScore = bauern.reduce((acc, p) => acc + (state.scores[p.id] ?? 0), 0);
    boardRows = [
      {
        key: "koenig",
        label: `König: ${koenig?.name ?? "?"} (Ziel ${state.bieterBid ?? "?"})`,
        score: kScore,
        base: kScore,
        round: 0,
      },
      {
        key: "bauern",
        label: `Bauern: ${bauern.map((p) => p.name).join(" & ")} (Ziel 1000)`,
        score: bScore,
        base: bScore,
        round: 0,
      },
    ].sort((a, b) => b.score - a.score);
  } else {
    boardRows = [...state.players]
      .sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))
      .map((pl) => ({
        key: pl.id,
        label: pl.name,
        score: state.scores[pl.id] ?? 0,
        base: state.scores[pl.id] ?? 0,
        round: 0,
      }));
  }

  // Schieber: the local player may declare Weis until they play their first card.
  const myHandCards = state.hands[myId] ?? [];
  const declaredWeis = state.weisKey?.[myId] !== undefined;
  const canWeis =
    ((state.mode === "schieber" && myHandCards.length === 9) ||
      (state.mode === "bieter" && myHandCards.length === 10)) &&
    state.phase === "playing" &&
    !declaredWeis;
  const myWeis = canWeis ? detectWeis(myHandCards) : null;
  const weisPrompt =
    myWeis && myWeis.total > 0
      ? { amount: myWeis.total, onWeis: () => emit.emit("game:weis", { code }) }
      : undefined;

  return (
    <>
      <Table
        state={state}
        myId={myId}
        legal={legal}
        weisPrompt={weisPrompt}
        handOverride={
          state.stechen?.contenders.includes(myId) && state.stechenPlays?.[myId] === undefined
            ? {
                message: "Stechen! Wähle deine Karte.",
                onSelect: (card) => emit.emit("game:stechen", { code, card }),
              }
            : (state.pendingDiscard?.[myId] ?? 0) > 0
              ? {
                  message:
                    state.mode === "bieter"
                      ? `Du bist König — wirf ${state.pendingDiscard?.[myId]} Karte${(state.pendingDiscard?.[myId] ?? 0) > 1 ? "n" : ""} ab (Tausch).`
                      : `Stechen! Du bist nicht beteiligt — wirf ${state.pendingDiscard?.[myId]} Karte${(state.pendingDiscard?.[myId] ?? 0) > 1 ? "n" : ""} ab (beliebig).`,
                  onSelect: (card) => emit.emit("game:discard", { code, card }),
                }
              : undefined
        }
        onPlay={(card) => emit.emit("game:playCard", { code, card })}
      />

      {/* Pandur: show the running contract (soloist + bid) during play. */}
      {state.mode === "pandur" &&
        state.pandurSoloist &&
        state.pandurBid !== undefined &&
        state.phase === "playing" && (
          <div
            style={{
              position: "fixed",
              top: 52,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 15,
              padding: "4px 14px",
              borderRadius: 10,
              fontSize: 13,
              background: "rgba(0,0,0,0.45)",
              color: "var(--gold-bright)",
              whiteSpace: "nowrap",
            }}
          >
            Alleinspieler: {state.players.find((p) => p.id === state.pandurSoloist)?.name} · Gebot:{" "}
            {pandurBidLabel(state.pandurBid)}
          </div>
        )}

      {/* Bieterjass table cards. During the auction: the 3 open cards (everyone). Once the
          König is known: all 6 revealed cards, shown to the other players (the König sees
          them in their own hand while discarding). */}
      {state.mode === "bieter" &&
        state.phase === "bidding" &&
        (() => {
          const reveal =
            state.bieterReveal && myId !== state.bieterKoenig ? state.bieterReveal : null;
          const openOnly =
            !state.bieterKoenig && state.bieterOpen && state.bieterOpen.length > 0
              ? state.bieterOpen
              : null;
          const cards = reveal ?? openOnly;
          if (!cards) return null;
          return (
            <div
              style={{
                position: "fixed",
                top: 80,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 14,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.75, color: "var(--gold-bright)" }}>
                {reveal ? "Karten des Königs (Tausch)" : "Offene Karten (für den König)"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: "92vw" }}>
                {cards.map((c) => (
                  <CardFace key={`${c.suit}-${c.rank}`} card={c} width={56} />
                ))}
              </div>
            </div>
          );
        })()}

      {/* Bieterjass: show the König, their bid, and the Bodentrumpf during play. */}
      {state.mode === "bieter" &&
        state.bieterKoenig &&
        state.bieterBid !== undefined &&
        state.phase === "playing" && (
          <div
            style={{
              position: "fixed",
              top: 52,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 15,
              padding: "4px 14px",
              borderRadius: 10,
              fontSize: 13,
              background: "rgba(0,0,0,0.45)",
              color: "var(--gold-bright)",
              whiteSpace: "nowrap",
            }}
          >
            König: {state.players.find((p) => p.id === state.bieterKoenig)?.name} · Gebot:{" "}
            {state.bieterBid}
            {state.bieterBodentrumpf
              ? ` · Bodentrumpf: ${state.bieterBodentrumpf.suit}`
              : state.trumpMode
                ? ` · Trumpf: ${state.trumpMode}`
                : ""}
          </div>
        )}

      {/* Wyss reveal on the table, shown once the first trick has been played. */}
      {weisRevealActive && state.weisReveal && (
        <div
          style={{
            position: "fixed",
            top: 52,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 15,
            maxWidth: "94vw",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "center",
          }}
        >
          <WeisReveal
            melds={state.weisReveal}
            nameById={new Map(state.players.map((p) => [p.id, p.name]))}
          />
          <button
            type="button"
            onClick={() => setWeisSeenRound(state.roundIndex)}
            style={{
              padding: "3px 14px",
              fontSize: 13,
              borderRadius: 8,
              cursor: "pointer",
              background: "rgba(255, 255, 255, 0.08)",
              color: "rgba(242, 238, 221, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}
          >
            Schliessen
          </button>
        </div>
      )}


      {/* Help: rules of the current game */}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setShowRules(true)}
        style={{ position: "fixed", bottom: 14, left: 14, zIndex: 20, padding: "6px 12px", fontSize: 13 }}
      >
        Regeln
      </button>
      {showRules && <RulesOverlay mode={state.mode} onClose={() => setShowRules(false)} />}

      {/* In-game leaderboard — updates automatically at the end of each round. */}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setShowBoard((v) => !v)}
        style={{ position: "fixed", bottom: 14, right: 14, zIndex: 20, padding: "6px 12px", fontSize: 13 }}
      >
        {showBoard ? "Rangliste ausblenden" : "Rangliste"}
      </button>
      {showBoard && (
        <div
          className="panel"
          style={{ position: "fixed", bottom: 56, right: 14, zIndex: 20, minWidth: 230 }}
        >
          <strong style={{ display: "block", marginBottom: 8 }}>Rangliste — Score</strong>
          {boardRows.map((r, i) => (
            <div
              key={r.key}
              style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "2px 0" }}
            >
              <span>
                {i + 1}. {r.label}
              </span>
              <strong>
                {r.round !== 0 ? (
                  <>
                    {r.base}{" "}
                    <span style={{ opacity: 0.7, fontWeight: 400 }}>
                      {r.round > 0 ? "+" : "−"}
                      {Math.abs(r.round)}
                    </span>
                  </>
                ) : (
                  r.score
                )}
              </strong>
            </div>
          ))}
        </div>
      )}

      {showTrumpPanel && (
        <div className="overlay">
          <TrumpPanel
            myTurn={myTurn}
            canSchieben={!state.schiebenUsed}
            coiffeur={state.schieberCoiffeur}
            onChoose={(value) => emit.emit("game:bid", { code, value })}
          />
        </div>
      )}
      {showPandurBid && (
        <div className="overlay">
          <PandurBidPanel
            state={state}
            myId={myId}
            onBid={(value) => emit.emit("game:bid", { code, value })}
          />
        </div>
      )}
      {showBieterBid && (
        <div className="overlay">
          <BieterBidPanel
            state={state}
            myId={myId}
            onBid={(value) => emit.emit("game:bid", { code, value })}
          />
        </div>
      )}
      {showBidPanel && (
        <div className="overlay">
          <BidPanel
            label={bidLabel}
            min={0}
            max={bidMax}
            myTurn={myTurn}
            onBid={(value) => emit.emit("game:bid", { code, value })}
            total={isCustom ? bidTotal : undefined}
            trickCount={isCustom ? trickCount : undefined}
            forbidden={forbiddenBid}
            pending={pendingBidders}
          />
        </div>
      )}
    </>
  );
}
