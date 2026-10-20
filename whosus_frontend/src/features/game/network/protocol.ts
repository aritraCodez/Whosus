import type { Chat, Snapshot } from "@/features/game/model/types";
import type { VoicePeer, VoiceSignal } from "@/features/voice/types";
import { isRecord, isStringArray } from "@/lib/guards";

export type ServerMessage =
  | { type: "joined"; id: string; token: string; iceServers: RTCIceServer[] }
  | {
      type: "snapshot";
      room: Snapshot;
      speaking: string[];
      voicePeers?: VoicePeer[];
    }
  | { type: "chat"; message: Chat }
  | ({ type: "voice_signal" } & VoiceSignal)
  | { type: "error" | "kicked" | "expired"; message: string }
  | { type: "pong" | "left" };

// The backend owns the full domain schema; validate message envelopes at the
// transport boundary and use the shared domain types inside the application.
export function parseServerMessage(raw: string): ServerMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  switch (value.type) {
    case "joined":
      if (
        typeof value.id !== "string" ||
        typeof value.token !== "string" ||
        !Array.isArray(value.iceServers) ||
        !value.iceServers.every(
          (server: unknown) =>
            isRecord(server) &&
            (typeof server.urls === "string" || isStringArray(server.urls)),
        )
      )
        return null;
      break;
    case "snapshot":
      if (
        !isRecord(value.room) ||
        !Array.isArray(value.room.players) ||
        typeof value.room.code !== "string" ||
        typeof value.room.phase !== "string" ||
        typeof value.room.round !== "number" ||
        !isStringArray(value.speaking)
      )
        return null;
      if (
        value.voicePeers !== undefined &&
        (!Array.isArray(value.voicePeers) ||
          !value.voicePeers.every(
            (peer: unknown) =>
              isRecord(peer) &&
              typeof peer.id === "string" &&
              typeof peer.gain === "number" &&
              typeof peer.sendGain === "number",
          ))
      )
        return null;
      break;
    case "chat":
      if (
        !isRecord(value.message) ||
        typeof value.message.id !== "string" ||
        typeof value.message.text !== "string" ||
        typeof value.message.name !== "string" ||
        typeof value.message.player !== "string" ||
        typeof value.message.time !== "number" ||
        typeof value.message.channel !== "string"
      )
        return null;
      break;
    case "voice_signal":
      if (
        typeof value.from !== "string" ||
        typeof value.generation !== "number" ||
        !Number.isSafeInteger(value.generation) ||
        !["offer", "answer", "ice", "reset"].includes(String(value.kind))
      )
        return null;
      if (
        (value.kind === "offer" || value.kind === "answer") &&
        typeof value.sdp !== "string"
      )
        return null;
      if (
        value.kind === "ice" &&
        value.candidate !== null &&
        value.candidate !== undefined &&
        (!isRecord(value.candidate) ||
          typeof value.candidate.candidate !== "string")
      )
        return null;
      break;
    case "error":
    case "kicked":
    case "expired":
      if (typeof value.message !== "string") return null;
      break;
    case "pong":
    case "left":
      break;
    default:
      return null;
  }
  return value as ServerMessage;
}
