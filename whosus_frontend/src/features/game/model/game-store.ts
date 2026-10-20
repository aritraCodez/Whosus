import type {
  Chat,
  Snapshot,
  Challenge,
  ConnectionStatus,
} from "@/features/game/model/types";
import type { VoiceStatus } from "@/features/voice/types";
import { create } from "zustand";
type State = {
  room: Snapshot | null;
  id: string;
  status: ConnectionStatus;
  error: string;
  chat: Chat[];
  speaking: string[];
  muted: boolean;
  deafened: boolean;
  ptt: boolean;
  voiceStatus: VoiceStatus;
  voiceError: string;
  playbackBlocked: boolean;
  map: boolean;
  settings: boolean;
  wardrobe: boolean;
  chatOpen: boolean;
  quality: "high" | "low";
  sound: boolean;
  eliminationStyle: number;
  fakeChallenge: Challenge | null;
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
