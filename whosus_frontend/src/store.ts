import { create } from "zustand";
import type { Snapshot, Chat } from "./types";
type State = {
  room: Snapshot | null;
  id: string;
  status: string;
  error: string;
  chat: Chat[];
  speaking: string[];
  muted: boolean;
  deafened: boolean;
  ptt: boolean;
  voiceStatus: string;
  voiceError: string;
  playbackBlocked: boolean;
  map: boolean;
  settings: boolean;
  chatOpen: boolean;
  quality: "high" | "low";
  sound: boolean;
  set: (v: Partial<State>) => void;
};
export const useGame = create<State>((set) => ({
  room: null,
  id: "",
  status: "offline",
  error: "",
  chat: [],
  speaking: [],
  muted: true,
  deafened: false,
  ptt: false,
  voiceStatus: "off",
  voiceError: "",
  playbackBlocked: false,
  map: false,
  settings: false,
  chatOpen: false,
  quality: "high",
  sound: true,
  set,
}));
