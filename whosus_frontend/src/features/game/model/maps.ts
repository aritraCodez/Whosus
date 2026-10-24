import { STATIONS } from "@/features/game/model/world";

export const MAPS = {
  cloudline: {
    name: "Cloudline Station",
    description: "9 rooms · floating station · interactive tasks",
  },
  mosslight: {
    name: "Mosslight",
    description: "9 forest clearings · amber crystals · glowing trails",
  },
} as const;
export type MapId = keyof typeof MAPS;
export function mapInfo(id?: string) {
  return MAPS[id === "mosslight" ? "mosslight" : "cloudline"];
}
export const MOSS_ROOMS = [
  "Gathering Grove",
  "Fern Sanctuary",
  "Amber Heart",
  "Echo Glade",
  "Nectar Hollow",
  "Firefly Lookout",
  "Spore Meadow",
  "Rootworks",
  "Moonwell",
];
const MOSS_TASKS: Record<string, [string, string]> = {
  security: ["Tune the firefly signal", "Firefly Lookout"],
  reactor_monitor: ["Balance the amber heart", "Amber Heart"],
  garden: ["Restore the moss garden", "Fern Sanctuary"],
  swipe: ["Read the grove pass", "Gathering Grove"],
  id_code: ["Decode the ancient rune", "Echo Glade"],
  wires: ["Reconnect the root network", "Rootworks"],
  relay: ["Align the echo stones", "Echo Glade"],
  prime_shields: ["Light the ward stones", "Moonwell"],
  chart_course: ["Chart the forest trail", "Moonwell"],
  clear_asteroids: ["Clear drifting spores", "Spore Meadow"],
  clean_filter: ["Clean the spore filter", "Spore Meadow"],
  start_reactor: ["Awaken the amber heart", "Amber Heart"],
  submit_scan: ["Scan the forest life", "Fern Sanctuary"],
  divert_power: ["Channel the root energy", "Rootworks"],
  fuel_engines: ["Collect golden nectar", "Nectar Hollow"],
};
const mossStations = STATIONS.map((s) => ({
  ...s,
  name: MOSS_TASKS[s.id][0],
  room: MOSS_TASKS[s.id][1],
}));
export function stationsFor(mapId?: string) {
  return mapId === "mosslight" ? mossStations : STATIONS;
}
