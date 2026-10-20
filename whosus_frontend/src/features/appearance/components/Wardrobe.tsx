import { Modal } from "@/components/ui/Modal";
import { Pip } from "@/features/appearance/components/Pip";
import {
DEFAULT_APPEARANCE,
normalizeAppearance,
useAppearance,
WARDROBE,
type Appearance,
type CosmeticSlot,
} from "@/features/appearance/model/appearance-store";
import "@/features/appearance/styles/wardrobe.css";
import { useGame } from "@/features/game/model/game-store";
import { motion } from "@/features/game/model/motion";
import { COLORS } from "@/features/game/model/types";
import { act } from "@/features/game/network/game-client";
import { OrbitControls } from "@react-three/drei";
import { Canvas,useThree } from "@react-three/fiber";
import {
Backpack,
Cat,
Check,
Crown,
Footprints,
Glasses,
Headphones,
Leaf,
Paintbrush,
Radio,
RotateCcw,
Shirt,
Shuffle,
Sparkles,
WandSparkles,
X,
type LucideIcon,
} from "lucide-react";
import { Suspense,useEffect,useLayoutEffect,useState } from "react";
import { OrthographicCamera } from "three";

const ICONS: Record<CosmeticSlot | "color", LucideIcon> = {
  color: Paintbrush,
  hat: Crown,
  outfit: Shirt,
  visor: Glasses,
  accessory: Backpack,
  boots: Footprints,
};
const ITEM_ICONS: Record<string, LucideIcon> = {
  none: X,
  sprout: Leaf,
  antenna: Radio,
  headphones: Headphones,
  crown: Crown,
  wizard: WandSparkles,
  cat: Cat,
  halo: Sparkles,
};
const COLOR_NAMES = [
  "Sunflower",
  "Mint",
  "Coral",
  "Lavender",
  "Sky",
  "Peach",
  "Lime",
  "Rose",
  "Ivory",
  "Sage",
  "Clay",
  "Periwinkle",
];
const TABS = ["color", ...Object.keys(WARDROBE)] as (CosmeticSlot | "color")[];

function FitPreview() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    if (camera instanceof OrthographicCamera) {
      camera.zoom = Math.min(100, size.height / 2.6);
      camera.updateProjectionMatrix();
    }
  }, [camera, size.height]);
  return null;
}

export function Wardrobe() {
  const { appearance, update } = useAppearance();
  const room = useGame((s) => s.room),
    id = useGame((s) => s.id),
    status = useGame((s) => s.status);
  const me = room?.players.find((p) => p.id === id);
  const look = me
    ? normalizeAppearance({ ...me, color: COLORS.indexOf(me.color) })
    : appearance;
  const [tab, setTab] = useState<CosmeticSlot | "color">("outfit");
  const [turn, setTurn] = useState(0);
  const close = () => useGame.setState({ wardrobe: false });
  const available = !room || (room.phase === "lobby" && status === "connected");
  useEffect(() => {
    motion.keys.clear();
    motion.dx = motion.dz = 0;
    return () => {
      motion.keys.clear();
      motion.dx = motion.dz = 0;
    };
  }, []);
  useEffect(() => {
    if (room && room.phase !== "lobby") close();
  }, [room?.phase]);
  function change(patch: Partial<Appearance>) {
    if (!available) return;
    if (!room) update(patch);
    else
      for (const [key, value] of Object.entries(patch)) {
        if (key === "color") act("color", "", Number(value));
        else act("customize", key, value);
      }
  }
  function shuffle() {
    const patch: Partial<Appearance> = {};
    for (const slot of Object.keys(WARDROBE) as CosmeticSlot[]) {
      const items = WARDROBE[slot].items;
      patch[slot] = items[Math.floor(Math.random() * items.length)][0];
    }
    change(patch);
  }
  return (
    <Modal title="Explorer wardrobe" wide close={close}>
      <div className="wardrobe">
        <section
          className="wardrobe-preview"
          aria-label="Live character preview"
        >
          <div className="wardrobe-kicker">
            <span /> YOUR EXPLORER, YOUR STYLE
          </div>
          <div className="wardrobe-canvas">
            <Canvas
              orthographic
              camera={{ position: [2.7, 1.9, 4.5], zoom: 100 }}
              dpr={[1, 1.5]}
            >
              <ambientLight intensity={1.8} />
            <FitPreview />
              <directionalLight position={[3, 5, 4]} intensity={3} />
              <directionalLight
                position={[-3, 2, -3]}
                intensity={2}
                color="#91ded6"
              />
              <Suspense fallback={null}>
                <group rotation={[0, turn, 0]}>
                  <Pip
                    {...look}
                    color={COLORS[look.color]}
                    idleBounce={0.018}
                  />
                </group>
                <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.9, 48]} />
                  <meshStandardMaterial color="#294b54" />
                </mesh>
                <OrbitControls
                  target={[0, 1.05, 0]}
                  enablePan={false}
                  enableZoom={false}
                  minPolarAngle={Math.PI / 3}
                  maxPolarAngle={Math.PI / 2}
                />
              </Suspense>
            </Canvas>
          </div>
          <button
            className="wardrobe-turn"
            onClick={() => setTurn((t) => t + Math.PI / 2)}
          >
            <RotateCcw size={15} /> Turn character
          </button>
          <strong>{me?.name || "Ready for a new look?"}</strong>
          <p>Drag to look around. Mix it up.</p>
          <div className="wardrobe-look">
            <span>
              {WARDROBE.outfit.items.find(([key]) => key === look.outfit)?.[1]}
            </span>
            <span>
              {WARDROBE.hat.items.find(([key]) => key === look.hat)?.[1]}
            </span>
          </div>
        </section>
        <section className="wardrobe-picker">
          <div
            className="wardrobe-tabs"
            role="tablist"
            aria-label="Wardrobe categories"
          >
            {TABS.map((slot) => {
              const Icon = ICONS[slot];
              return (
                <button
                  key={slot}
                  role="tab"
                  id={`wardrobe-tab-${slot}`}
                  aria-controls="wardrobe-options"
                  aria-selected={tab === slot}
                  tabIndex={tab === slot ? 0 : -1}
                  onKeyDown={(e) => {
                    if (
                      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        e.key,
                      )
                    )
                      return;
                    e.preventDefault();
                    const next =
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? TABS.length - 1
                          : (TABS.indexOf(slot) +
                              (e.key === "ArrowRight" ? 1 : -1) +
                              TABS.length) %
                            TABS.length;
                    setTab(TABS[next]);
                    document
                      .getElementById(`wardrobe-tab-${TABS[next]}`)
                      ?.focus();
                  }}
                  onClick={() => setTab(slot)}
                >
                  <Icon size={18} />
                  <span>
                    {slot === "color" ? "Color" : WARDROBE[slot].label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="wardrobe-section-title">
            <div>
              <small>MAKE IT YOURS</small>
              <h3>
                {tab === "color"
                  ? "Pick your signature color."
                  : `Find your ${WARDROBE[tab].label.toLowerCase()}.`}
              </h3>
            </div>
            <span>
              {tab === "color" ? COLORS.length : WARDROBE[tab].items.length}{" "}
              options
            </span>
          </div>
          <div
            className="wardrobe-options"
            id="wardrobe-options"
            role="tabpanel"
            aria-labelledby={`wardrobe-tab-${tab}`}
          >
            {tab === "color"
              ? COLORS.map((color, index) => {
                  const owner = room?.players.find(
                    (p) => p.id !== id && p.color === color,
                  );
                  return (
                    <button
                      key={color}
                      className="wardrobe-item"
                      aria-label={COLOR_NAMES[index]}
                      aria-pressed={look.color === index}
                      disabled={!!owner || !available}
                      onClick={() => change({ color: index })}
                    >
                      <span
                        className="wardrobe-swatch"
                        style={{ background: color }}
                      >
                        {look.color === index && <Check />}
                        {owner && <X />}
                      </span>
                      <strong>{COLOR_NAMES[index]}</strong>
                      <small>
                        {owner
                          ? `Taken by ${owner.name}`
                          : look.color === index
                            ? "Equipped"
                            : "Available"}
                      </small>
                    </button>
                  );
                })
              : WARDROBE[tab].items.map(([key, label], index) => {
                  const Icon = ITEM_ICONS[key] || ICONS[tab],
                    selected = look[tab] === key;
                  return (
                    <button
                      key={key}
                      className="wardrobe-item"
                      aria-label={label}
                      aria-pressed={selected}
                      disabled={!available}
                      onClick={() => change({ [tab]: key })}
                    >
                      <span
                        className="wardrobe-item-art"
                        style={
                          {
                            "--item-tint": [
                              "#a9c5c2",
                              "#e9c786",
                              "#a8b2e1",
                              "#df9bb3",
                              "#95c8c2",
                            ][index % 5],
                          } as React.CSSProperties
                        }
                      >
                        <Icon size={32} strokeWidth={1.5} />
                        {selected && (
                          <i>
                            <Check size={12} />
                          </i>
                        )}
                      </span>
                      <strong>{label}</strong>
                      <small>{selected ? "Equipped" : "Try on"}</small>
                    </button>
                  );
                })}
          </div>
          <div className="wardrobe-tools">
            <button
              className="text-button"
              disabled={!available}
              onClick={shuffle}
            >
              <Shuffle size={15} /> Surprise me
            </button>
            <button
              className="text-button"
              disabled={!available}
              onClick={() => {
                const { color: _color, ...original } = DEFAULT_APPEARANCE;
                change(original);
              }}
            >
              Reset outfit
            </button>
          </div>
        </section>
      </div>
      <footer className="wardrobe-footer">
        <span>
          <Check size={15} />
          {!available
            ? "Reconnecting to the room…"
            : room
              ? "Changes are visible to your crew"
              : "Your look is saved automatically"}
        </span>
        <button className="primary" onClick={close}>
          Done <Check size={17} />
        </button>
      </footer>
    </Modal>
  );
}
