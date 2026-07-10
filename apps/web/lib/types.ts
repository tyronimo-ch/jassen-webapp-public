import type { Card, RoomState } from "@jassen/game-engine";

/** The masked room state the server sends to each client. */
export interface ClientRoomState extends Omit<RoomState, "hands"> {
  /** Own hand normally; in revealed rounds, everyone else's hands. */
  hands: Record<string, Card[]>;
  handCounts: Record<string, number>;
  hostId: string;
  minPlayers: number;
  maxPlayers: number;
}
