import type { Chat,Snapshot } from "@/features/game/model/types";
import { create } from "zustand";
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
  wardrobe: boolean;
  chatOpen: boolean;
  quality: "high" | "low";
  sound: boolean;
  eliminationStyle: number;
  fakeChallenge: import("./types").Challenge | null;
  fakeDone: Record<string, boolean>;
  practiceOpen: boolean;
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
  wardrobe: false,
  chatOpen: false,
  quality:
    typeof window !== "undefined" &&
    (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 700)
      ? "low"
      : "high",
  sound: true,
  eliminationStyle: -1,
  fakeChallenge: null,
  fakeDone: {},
  practiceOpen: false,
  set,
}));
