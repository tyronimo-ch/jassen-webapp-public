import {
  advanceRound,
  getModeEngine,
  DIFFERENZLER_ROUND_OPTIONS,
  type Card,
  type GameMode,
} from "@jassen/game-engine";
import type { Server, Socket } from "socket.io";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  ServerRoom,
  bindSocket,
  createRoom,
  getRoom,
  joinRoom,
  leaveBySocket,
  toClientStateFor,
} from "./rooms.js";

const TRICK_RESOLUTION_DELAY_MS = 2000;
const STECHEN_RESOLUTION_DELAY_MS = 2000;
const VALID_MODES: GameMode[] = ["schieber", "differenzler", "custom", "pandur", "bieter"];

function broadcastRoomState(io: Server, room: ServerRoom): void {
  for (const player of room.state.players) {
    const socketId = room.socketByPlayer.get(player.id);
    if (socketId) io.to(socketId).emit("room:state", toClientStateFor(room, player.id));
  }
}

const HIDDEN_PLAY_DELAY_MS = 900;
const HIDDEN_REVEAL_PAUSE_MS = 3500;

/**
 * In a 1-card "Indian poker" round each player holds a single forced card, so once
 * bidding is done the server plays the cards out automatically (one per tick).
 */
function playHiddenTrick(io: Server, room: ServerRoom): void {
  const engine = getModeEngine(room.state.mode);
  const step = () => {
    const current = getRoom(room.state.code);
    if (!current || current.state.phase !== "playing" || !current.state.handsRevealed) return;
    const turnId = current.state.turnPlayerId;
    if (!turnId) return;
    const card = current.state.hands[turnId]?.[0];
    if (!card) return;

    current.state = engine.playCard(current.state, turnId, card);
    broadcastRoomState(io, current);

    if (current.state.currentTrick.length === current.state.players.length) {
      advanceAfterPlay(io, current);
    } else {
      setTimeout(step, HIDDEN_PLAY_DELAY_MS);
    }
  };
  // Pause first so everyone can take in the revealed cards before the forced cards play.
  setTimeout(step, HIDDEN_REVEAL_PAUSE_MS);
}

/** After a completed trick, resolve it (and score/advance) on a short delay for animation. */
function advanceAfterPlay(io: Server, room: ServerRoom): void {
  const engine = getModeEngine(room.state.mode);
  if (room.state.currentTrick.length !== room.state.players.length) return;

  setTimeout(() => {
    const current = getRoom(room.state.code);
    if (!current) return;

    current.state = engine.resolveTrick(current.state);
    // A Stechen (interactive) or pending discards must finish before scoring the round.
    if (
      !current.state.stechen &&
      !current.state.pendingDiscard &&
      engine.isRoundComplete(current.state)
    ) {
      current.state = engine.scoreRound(current.state);
      if (engine.isGameComplete(current.state)) {
        current.state = { ...current.state, phase: "gameEnd" };
      }
    }
    broadcastRoomState(io, current);
  }, TRICK_RESOLUTION_DELAY_MS);
}

/** Advance a round once the Stechen and its discards are fully resolved. */
function finishAfterStechen(io: Server, room: ServerRoom): void {
  if (room.state.stechen || room.state.pendingDiscard) return;
  const engine = getModeEngine(room.state.mode);
  if (engine.isRoundComplete(room.state)) {
    room.state = engine.scoreRound(room.state);
    if (engine.isGameComplete(room.state)) {
      room.state = { ...room.state, phase: "gameEnd" };
    }
  }
  broadcastRoomState(io, room);
}

/**
 * Once every contender has played and all discards are in, hold the fully-played
 * Stechen on screen for a moment (so everyone can see the cards) before resolving
 * the winner and clearing them.
 */
function maybeScheduleStechenResolution(io: Server, room: ServerRoom): void {
  const engine = getModeEngine(room.state.mode);
  if (!engine.resolveStechen) return;
  const st = room.state.stechen;
  if (!st || room.state.pendingDiscard) return;
  const plays = room.state.stechenPlays ?? {};
  if (!st.contenders.every((pid) => plays[pid] !== undefined)) return;

  setTimeout(() => {
    const current = getRoom(room.state.code);
    if (!current) return;
    current.state = engine.resolveStechen!(current.state);
    broadcastRoomState(io, current);
    finishAfterStechen(io, current);
  }, STECHEN_RESOLUTION_DELAY_MS);
}

export function registerHandlers(io: Server, socket: Socket): void {
  socket.on("ping", (payload?: unknown) => {
    socket.emit("pong", { receivedAt: Date.now(), payload });
  });

  socket.on(
    "room:create",
    ({
      mode,
      name,
      targetScore,
      gstoert,
      coiffeur,
      stechen,
      haerti,
    }: {
      mode: GameMode;
      name: string;
      targetScore?: number;
      gstoert?: boolean;
      coiffeur?: boolean;
      stechen?: boolean;
      haerti?: boolean;
    }) => {
    if (!VALID_MODES.includes(mode)) return socket.emit("room:error", { message: "Ungültiger Spielmodus" });
    if (typeof name !== "string" || name.trim().length === 0) {
      return socket.emit("room:error", { message: "Name erforderlich" });
    }
    const room = createRoom(mode, name, targetScore);
    if (mode === "differenzler" && typeof gstoert === "boolean") {
      room.state = { ...room.state, differenzlerGstoert: gstoert };
    }
    if (mode === "schieber" && typeof coiffeur === "boolean") {
      room.state = { ...room.state, schieberCoiffeur: coiffeur };
    }
    if (mode === "custom" && typeof stechen === "boolean") {
      room.state = { ...room.state, customStechen: stechen };
    }
    if (mode === "custom" && typeof haerti === "boolean") {
      room.state = { ...room.state, customHaerti: haerti };
    }
    const hostId = room.hostId;
    bindSocket(room, hostId, socket.id);
    socket.join(room.state.code);
    socket.emit("room:joined", { code: room.state.code, playerId: hostId, hostId });
    broadcastRoomState(io, room);
  });

  socket.on("room:join", ({ code, name }: { code: string; name: string }) => {
    const result = joinRoom((code ?? "").toUpperCase(), name ?? "");
    if ("error" in result) return socket.emit("room:error", { message: result.error });
    const { room, player } = result;
    bindSocket(room, player.id, socket.id);
    socket.join(room.state.code);
    socket.emit("room:joined", { code: room.state.code, playerId: player.id, hostId: room.hostId });
    broadcastRoomState(io, room);
  });

  // Reconnect / refresh: rebind an existing playerId to this socket.
  socket.on("room:sync", ({ code, playerId }: { code: string; playerId?: string }) => {
    const room = getRoom((code ?? "").toUpperCase());
    if (!room) return socket.emit("room:error", { message: "Raum nicht gefunden" });
    if (playerId && room.state.players.some((p) => p.id === playerId)) {
      bindSocket(room, playerId, socket.id);
      socket.join(room.state.code);
      room.state = {
        ...room.state,
        players: room.state.players.map((p) => (p.id === playerId ? { ...p, connected: true } : p)),
      };
    }
    broadcastRoomState(io, room);
  });

  // Host reorders players in the lobby (Schieber teams = seats 0&2 vs 1&3).
  socket.on("room:reorder", ({ code, order }: { code: string; order: string[] }) => {
    const room = getRoom((code ?? "").toUpperCase());
    if (!room) return;
    const playerId = room.playerBySocket.get(socket.id);
    if (playerId !== room.hostId) return;
    if (room.state.phase !== "lobby") return;

    const ids = room.state.players.map((p) => p.id);
    const valid =
      Array.isArray(order) &&
      order.length === ids.length &&
      new Set(order).size === ids.length &&
      order.every((id) => ids.includes(id));
    if (!valid) return;

    const byId = new Map(room.state.players.map((p) => [p.id, p]));
    const players = order.map((id, i) => ({ ...byId.get(id)!, seat: i }));
    room.state = { ...room.state, players };
    broadcastRoomState(io, room);
  });

  // Host removes a player from the lobby.
  socket.on("room:kick", ({ code, playerId }: { code: string; playerId: string }) => {
    const room = getRoom((code ?? "").toUpperCase());
    if (!room) return;
    const requester = room.playerBySocket.get(socket.id);
    if (requester !== room.hostId) return; // host only
    if (room.state.phase !== "lobby") return; // only in the lobby
    if (playerId === room.hostId) return; // host can't kick themselves
    if (!room.state.players.some((p) => p.id === playerId)) return;

    const targetSocket = room.socketByPlayer.get(playerId);
    if (targetSocket) {
      io.to(targetSocket).emit("room:kicked", { message: "Du wurdest vom Host entfernt." });
      room.socketByPlayer.delete(playerId);
      room.playerBySocket.delete(targetSocket);
    }
    room.state = {
      ...room.state,
      players: room.state.players.filter((p) => p.id !== playerId),
    };
    broadcastRoomState(io, room);
  });

  // Host changes the points target (Schieber) / round count (Differenzler) in the lobby.
  socket.on("room:setTarget", ({ code, targetScore }: { code: string; targetScore: number }) => {
    const room = getRoom((code ?? "").toUpperCase());
    if (!room) return;
    const requester = room.playerBySocket.get(socket.id);
    if (requester !== room.hostId) return;
    if (room.state.phase !== "lobby") return;

    let value = Number(targetScore);
    if (room.state.mode === "schieber") {
      if (!Number.isFinite(value)) return;
      value = Math.max(1000, Math.min(10000, Math.round(value / 500) * 500));
    } else if (room.state.mode === "differenzler") {
      if (!DIFFERENZLER_ROUND_OPTIONS.includes(value)) return;
    } else {
      return;
    }
    room.state = { ...room.state, targetScore: value };
    broadcastRoomState(io, room);
  });

  // Host toggles a mode variant in the lobby: Differenzler (Klassisch/Gstört) or
  // Schieber (Klassisch/Coiffeur).
  socket.on(
    "room:setVariant",
    ({ code, gstoert, coiffeur, stechen, haerti }: { code: string; gstoert?: boolean; coiffeur?: boolean; stechen?: boolean; haerti?: boolean }) => {
      const room = getRoom((code ?? "").toUpperCase());
      if (!room) return;
      const requester = room.playerBySocket.get(socket.id);
      if (requester !== room.hostId) return;
      if (room.state.phase !== "lobby") return;

      if (room.state.mode === "differenzler" && typeof gstoert === "boolean") {
        room.state = { ...room.state, differenzlerGstoert: gstoert };
      } else if (room.state.mode === "schieber" && typeof coiffeur === "boolean") {
        room.state = { ...room.state, schieberCoiffeur: coiffeur };
      } else if (
        room.state.mode === "custom" &&
        (typeof stechen === "boolean" || typeof haerti === "boolean")
      ) {
        // The FYN variants are mutually exclusive; the client sends both flags.
        room.state = {
          ...room.state,
          customStechen: stechen ?? false,
          customHaerti: haerti ?? false,
        };
      } else {
        return;
      }
      broadcastRoomState(io, room);
    }
  );

  socket.on("room:start", ({ code }: { code: string }) => {
    const room = getRoom((code ?? "").toUpperCase());
    if (!room) return socket.emit("room:error", { message: "Raum nicht gefunden" });
    const playerId = room.playerBySocket.get(socket.id);
    if (playerId !== room.hostId) return socket.emit("room:error", { message: "Nur der Host kann starten" });

    const mode = room.state.mode;
    const count = room.state.players.length;
    if (count < MIN_PLAYERS[mode] || count > MAX_PLAYERS[mode]) {
      return socket.emit("room:error", { message: `Benötigt ${MIN_PLAYERS[mode]}-${MAX_PLAYERS[mode]} Spieler` });
    }

    const engine = getModeEngine(mode);
    if (room.state.phase === "lobby") {
      room.state = engine.dealRound({ ...room.state, roundIndex: 0 });
    } else if (room.state.phase === "roundEnd") {
      room.state = advanceRound(room.state);
    } else if (room.state.phase === "gameEnd") {
      // Restart a fresh game: reset scores and round counter, keep players/target.
      room.state = engine.dealRound({
        ...room.state,
        roundIndex: 0,
        dealerIndex: 0,
        scores: Object.fromEntries(room.state.players.map((p) => [p.id, 0])),
      });
    } else {
      return; // ignore start during an active round
    }
    broadcastRoomState(io, room);
  });

  socket.on("game:bid", ({ code, value }: { code: string; value: number }) => {
    const room = getRoom((code ?? "").toUpperCase());
    if (!room) return;
    const playerId = room.playerBySocket.get(socket.id);
    if (!playerId) return;

    const engine = getModeEngine(room.state.mode);
    const before = room.state;
    room.state = engine.submitBid(room.state, playerId, value);
    if (room.state === before) return;

    broadcastRoomState(io, room);
    // Auto-play forced 1-card rounds once bidding completes.
    if (room.state.phase === "playing" && room.state.handsRevealed) {
      playHiddenTrick(io, room);
    }
  });

  socket.on("game:weis", ({ code }: { code: string }) => {
    const room = getRoom((code ?? "").toUpperCase());
    if (!room) return;
    const playerId = room.playerBySocket.get(socket.id);
    if (!playerId) return;

    const engine = getModeEngine(room.state.mode);
    if (!engine.declareWeis) return;
    const before = room.state;
    room.state = engine.declareWeis(room.state, playerId);
    if (room.state !== before) broadcastRoomState(io, room);
  });

  socket.on("game:stechen", ({ code, card }: { code: string; card: Card }) => {
    const room = getRoom((code ?? "").toUpperCase());
    if (!room) return;
    const playerId = room.playerBySocket.get(socket.id);
    if (!playerId) return;

    const engine = getModeEngine(room.state.mode);
    if (!engine.playStechen) return;
    const before = room.state;
    room.state = engine.playStechen(room.state, playerId, card);
    if (room.state === before) return;

    broadcastRoomState(io, room);
    maybeScheduleStechenResolution(io, room);
  });

  socket.on("game:discard", ({ code, card }: { code: string; card: Card }) => {
    const room = getRoom((code ?? "").toUpperCase());
    if (!room) return;
    const playerId = room.playerBySocket.get(socket.id);
    if (!playerId) return;

    const engine = getModeEngine(room.state.mode);
    if (!engine.discardCard) return;
    const before = room.state;
    room.state = engine.discardCard(room.state, playerId, card);
    if (room.state === before) return;

    broadcastRoomState(io, room);
    maybeScheduleStechenResolution(io, room);
  });

  socket.on("game:playCard", ({ code, card }: { code: string; card: Card }) => {
    const room = getRoom((code ?? "").toUpperCase());
    if (!room) return;
    const playerId = room.playerBySocket.get(socket.id);
    if (!playerId) return;

    const engine = getModeEngine(room.state.mode);
    const before = room.state;
    room.state = engine.playCard(room.state, playerId, card);
    if (room.state === before) return;

    broadcastRoomState(io, room);
    advanceAfterPlay(io, room);
  });

  socket.on("room:leave", () => {
    const room = leaveBySocket(socket.id);
    if (room) broadcastRoomState(io, room);
  });

  socket.on("disconnect", () => {
    const room = leaveBySocket(socket.id);
    if (room) broadcastRoomState(io, room);
  });
}
