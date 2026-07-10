import { randomUUID } from "node:crypto";
import {
  createInitialState,
  DEFAULT_TARGET_SCORE,
  type Card,
  type GameMode,
  type Player,
  type RoomState,
} from "@jassen/game-engine";

export const MIN_PLAYERS: Record<GameMode, number> = {
  schieber: 4,
  differenzler: 4,
  custom: 2,
  pandur: 2,
  bieter: 3,
};
export const MAX_PLAYERS: Record<GameMode, number> = {
  schieber: 4,
  differenzler: 4,
  custom: 6,
  pandur: 4,
  bieter: 3,
};

export interface ServerRoom {
  state: RoomState;
  hostId: string;
  socketByPlayer: Map<string, string>;
  playerBySocket: Map<string, string>;
}

const rooms = new Map<string, ServerRoom>();

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "";
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

function makePlayer(name: string, seat: number): Player {
  return { id: randomUUID(), name: name.slice(0, 20) || `Player ${seat + 1}`, seat, connected: true };
}

export function getRoom(code: string): ServerRoom | undefined {
  return rooms.get(code);
}

export function createRoom(mode: GameMode, hostName: string, targetScore?: number): ServerRoom {
  const code = generateCode();
  const host = makePlayer(hostName, 0);
  const target = targetScore ?? DEFAULT_TARGET_SCORE;
  const room: ServerRoom = {
    state: createInitialState(code, mode, [host], target),
    hostId: host.id,
    socketByPlayer: new Map(),
    playerBySocket: new Map(),
  };
  rooms.set(code, room);
  return room;
}

export function joinRoom(code: string, name: string): { room: ServerRoom; player: Player } | { error: string } {
  const room = rooms.get(code);
  if (!room) return { error: "Raum nicht gefunden" };
  if (room.state.phase !== "lobby") return { error: "Spiel läuft bereits" };
  if (room.state.players.length >= MAX_PLAYERS[room.state.mode]) return { error: "Raum ist voll" };

  const player = makePlayer(name, room.state.players.length);
  room.state = {
    ...room.state,
    players: [...room.state.players, player],
    scores: { ...room.state.scores, [player.id]: 0 },
  };
  return { room, player };
}

export function bindSocket(room: ServerRoom, playerId: string, socketId: string): void {
  room.socketByPlayer.set(playerId, socketId);
  room.playerBySocket.set(socketId, playerId);
}

/** Remove a socket. Returns the affected room (if any) for re-broadcast. */
export function leaveBySocket(socketId: string): ServerRoom | undefined {
  for (const room of rooms.values()) {
    const playerId = room.playerBySocket.get(socketId);
    if (!playerId) continue;

    room.playerBySocket.delete(socketId);
    room.socketByPlayer.delete(playerId);

    if (room.state.phase === "lobby") {
      // Drop the player entirely while still in the lobby.
      room.state = {
        ...room.state,
        players: room.state.players.filter((p) => p.id !== playerId),
      };
    } else {
      // Mark disconnected mid-game so they can rejoin their seat.
      room.state = {
        ...room.state,
        players: room.state.players.map((p) =>
          p.id === playerId ? { ...p, connected: false } : p
        ),
      };
    }

    if (room.state.players.length === 0) {
      rooms.delete(room.state.code);
      return undefined;
    }
    if (room.hostId === playerId) {
      room.hostId = room.state.players[0].id;
    }
    return room;
  }
  return undefined;
}

/** Build the per-viewer view of the state, masking hidden hands. */
export function toClientStateFor(room: ServerRoom, viewerId: string) {
  const handCounts: Record<string, number> = {};
  for (const [playerId, cards] of Object.entries(room.state.hands)) {
    handCounts[playerId] = cards.length;
  }

  let visibleHands: Record<string, Card[]>;
  if (room.state.handsRevealed) {
    // Indian-poker rounds: see everyone else's hand but not your own.
    visibleHands = {};
    for (const [playerId, cards] of Object.entries(room.state.hands)) {
      if (playerId !== viewerId) visibleHands[playerId] = cards;
    }
  } else {
    visibleHands = { [viewerId]: room.state.hands[viewerId] ?? [] };
  }

  // Stechen: each contender always sees their own card, but everyone else's stays
  // hidden until all contenders have chosen — then they're revealed to everyone
  // at once, at the same time, instead of trickling in one by one.
  let visibleStechenPlays = room.state.stechenPlays;
  if (room.state.stechen) {
    const plays = room.state.stechenPlays ?? {};
    const allPlayed = room.state.stechen.contenders.every((pid) => plays[pid] !== undefined);
    const myPlay = plays[viewerId];
    visibleStechenPlays = allPlayed ? plays : myPlay !== undefined ? { [viewerId]: myPlay } : {};
  }

  return {
    ...room.state,
    // The hidden Bieterjass stock must never reach clients (the Bodentrumpf is revealed
    // separately via bieterBodentrumpf once it's turned over).
    bieterStock: undefined,
    hands: visibleHands,
    stechenPlays: visibleStechenPlays,
    handCounts,
    hostId: room.hostId,
    minPlayers: MIN_PLAYERS[room.state.mode],
    maxPlayers: MAX_PLAYERS[room.state.mode],
  };
}
