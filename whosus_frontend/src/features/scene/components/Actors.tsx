import { Pip } from "@/features/appearance/components/Pip";
import { useAppearance } from "@/features/appearance/model/appearance-store";
import { useGame } from "@/features/game/model/game-store";
import { motion } from "@/features/game/model/motion";
import { COLORS, type Player } from "@/features/game/model/types";
import { move as movePlayer } from "@/features/game/model/world";

import { Avatar } from "@/features/scene/components/Avatar";
import { EliminationEffect } from "@/features/scene/components/EliminationEffect";
import {
  heroCanOccupy,
  isVisibleToPlayer,
} from "@/features/scene/model/visibility";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
export const showcase: Player[] = Array.from({ length: 5 }, (_, i) => ({
  id: `show${i}`,
  name: ["Miso", "Sprout", "Pip", "Echo", "Pebble"][i],
  color: COLORS[i],
  hat: i % 2 ? "antenna" : "sprout",
  x: [-2, 1.9, -9, 9, 0][i],
  z: [2, -1, 1, 1, 10][i],
  alive: true,
  connected: true,
  ready: true,
  ack: 0,
  voted: false,
}));

export function Actors({
  menu,
  color,
  hat,
}: {
  menu: boolean;
  color: number;
  hat: string;
}) {
  const r = useGame((s) => s.room),
    id = useGame((s) => s.id),
    map = useGame((s) => s.map);
  const hero = useRef<THREE.Group>(null);
  const appearance = useAppearance((s) => s.appearance);
  const heroPosition = useRef({ x: -2, z: 2 });
  const heroWalking = useRef(false);
  const heroStep = useRef(0);
  const heroDirection = useRef({ x: 0, z: 0 });
  const me = r?.players.find((p) => p.id === id);
  const isGhost = me ? !me.alive : false;
  const lx = motion.renderX,
    lz = motion.renderZ;
  const events = r?.eliminations || [];
  useFrame((_, dt) => {
    if (!menu) {
      heroWalking.current = false;
      return;
    }
    const held = (a: string, b: string) =>
      motion.keys.has(a) || motion.keys.has(b) ? 1 : 0;
    let x = held("KeyD", "ArrowRight") - held("KeyA", "ArrowLeft") + motion.dx;
    let z = held("KeyS", "ArrowDown") - held("KeyW", "ArrowUp") + motion.dz;
    const length = Math.max(1, Math.hypot(x, z));
    x /= length;
    z /= length;
    const directionLength = Math.hypot(18, 13);
    const dx = (18 * x + 13 * z) / directionLength;
    const dz = (-13 * x + 18 * z) / directionLength;
    heroWalking.current = Math.hypot(dx, dz) > 0;
    if (heroWalking.current) {
      heroDirection.current = { x: dx, z: dz };
      heroStep.current += dt;
      while (heroStep.current >= 0.05) {
        const [nextX, nextZ] = movePlayer(
          heroPosition.current.x,
          heroPosition.current.z,
          dx,
          dz,
        );
        if (heroCanOccupy(nextX, nextZ)) {
          heroPosition.current.x = nextX;
          heroPosition.current.z = nextZ;
        } else {
          const [slideX] = movePlayer(
            heroPosition.current.x,
            heroPosition.current.z,
            dx,
            0,
          );
          const [, slideZ] = movePlayer(
            heroPosition.current.x,
            heroPosition.current.z,
            0,
            dz,
          );
          if (heroCanOccupy(slideX, heroPosition.current.z))
            heroPosition.current.x = slideX;
          if (heroCanOccupy(heroPosition.current.x, slideZ))
            heroPosition.current.z = slideZ;
        }
        heroStep.current -= 0.05;
      }
    } else {
      heroStep.current = 0;
    }
    hero.current?.position.set(
      heroPosition.current.x,
      0,
      heroPosition.current.z,
    );
    if (heroWalking.current && hero.current) {
      const target = Math.atan2(
        heroDirection.current.x,
        heroDirection.current.z,
      );
      hero.current.rotation.y +=
        Math.atan2(
          Math.sin(target - hero.current.rotation.y),
          Math.cos(target - hero.current.rotation.y),
        ) * Math.min(1, dt * 12);
    }
  });
  const animated = new Set(events.flatMap((e) => [e.attacker.id, e.victim.id]));
  const visibleEvents = map
    ? []
    : events.filter((e) => {
        if (!r || r.phase !== "playing" || isGhost) return true;
        if (e.attacker.id === id || e.victim.id === id) return true;
        return isVisibleToPlayer(
          e.victim.x,
          e.victim.z,
          lx,
          lz,
          isGhost,
          r.phase,
        );
      });
  const visibleBodies = map
    ? []
    : (r?.bodies || []).filter((b) => {
        if (animated.has(b.id)) return false;
        if (!r || r.phase !== "playing" || isGhost) return true;
        return isVisibleToPlayer(b.x, b.z, lx, lz, isGhost, r.phase);
      });
  const visiblePlayers = menu
    ? showcase
    : (r?.players || []).filter((p) => {
        if (animated.has(p.id)) return false;
        if (p.id === id) return map || (r?.vent ?? -1) < 0;
        if (map) return false;
        if (!r || r.phase !== "playing" || isGhost) return true;
        return isVisibleToPlayer(p.x, p.z, lx, lz, isGhost, r.phase);
      });

  return (
    <>
      {visiblePlayers.map((p, i) =>
        menu ? (
          <group
            key={p.id}
            ref={i === 0 ? hero : undefined}
            position={
              i === 0
                ? [heroPosition.current.x, 0, heroPosition.current.z]
                : [p.x, 0, p.z]
            }
            rotation={[0, i * 0.8 + 0.3, 0]}
          >
            <Pip
              outfit={i === 0 ? appearance.outfit : p.outfit}
              visor={i === 0 ? appearance.visor : p.visor}
              accessory={i === 0 ? appearance.accessory : p.accessory}
              boots={i === 0 ? appearance.boots : p.boots}
              color={i === 0 ? COLORS[color] : p.color}
              hat={i === 0 ? hat : p.hat}
              walking={i === 0 ? heroWalking : false}
              idleBounce={i === 0 ? 0.2 : undefined}
            />
          </group>
        ) : (
          <Avatar key={p.id} p={p} local={p.id === id} />
        ),
      )}
      {visibleEvents.map((e) => (
        <EliminationEffect key={e.id} event={e} Actor={Pip} />
      ))}
      {visibleBodies.map((b) => (
        <group
          key={b.id}
          position={[b.x, 0.24, b.z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <Pip color={b.color} hat="none" />
        </group>
      ))}
    </>
  );
}
