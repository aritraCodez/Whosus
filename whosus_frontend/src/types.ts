export interface Player {
  id: string;
  name: string;
  color: string;
  hat: string;
  x: number;
  z: number;
  alive: boolean;
  connected: boolean;
  ready: boolean;
  ack: number;
  role?: "crew" | "impostor";
  voted: boolean;
}
export interface Task {
  id: string;
  name: string;
  room: string;
  x: number;
  z: number;
  kind: string;
  done: boolean;
}
export interface Challenge extends Task {
  nonce: string;
  sequence: number[];
  step: number;
  started: number;
}
export interface Snapshot {
  code: string;
  host: string;
  public: boolean;
  capacity: number;
  impostors: number;
  phase: string;
  round: number;
  players: Player[];
  bodies: { id: string; x: number; z: number; color: string }[];
  remaining: number;
  result: string;
  winner: string;
  sabotage: number;
  killCooldown: number;
  sabotageCooldown: number;
  meetingCooldown: number;
  emergency: number;
  vent: number;
  tasks: Task[];
  challenge: Challenge | null;
  progress: number;
  tally: Record<string, number>;
  population: number;
}
export interface Chat {
  id: string;
  name: string;
  player: string;
  text: string;
  time: number;
  channel: string;
}
export const COLORS = [
  "#f6bd4f",
  "#6ad9c5",
  "#f47785",
  "#a99af4",
  "#75b8ed",
  "#f59e6d",
  "#c5db79",
  "#e69ed0",
  "#ded9cc",
  "#73a49c",
  "#cb8b75",
  "#8e9bd1",
];
