import { isRecord } from "@/lib/guards";
import { getJson } from "@/services/api-client";

export interface PublicRoomSummary {
  code: string;
  players: number;
  capacity: number;
  host: string;
}

export async function fetchPublicRooms(
  signal?: AbortSignal,
): Promise<PublicRoomSummary[]> {
  const data = await getJson("/api/rooms", signal);
  const isRoom = (value: unknown): value is PublicRoomSummary =>
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.host === "string" &&
    typeof value.players === "number" &&
    Number.isFinite(value.players) &&
    typeof value.capacity === "number" &&
    Number.isFinite(value.capacity);
  if (!Array.isArray(data) || !data.every(isRoom))
    throw new Error("The server returned an invalid room list.");
  return data;
}
