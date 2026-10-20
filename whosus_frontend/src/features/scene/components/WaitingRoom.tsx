import {
  interactWithSeat,
  openWardrobe,
} from "@/features/game/actions/interactions";
import { useGame } from "@/features/game/model/game-store";
import {
  LOBBY_OBSTACLES,
  LOBBY_SEATS,
  nearestLobbySeat,
  nearWardrobe,
  WARDROBE_STATION,
} from "@/features/game/model/world";
import { Box } from "@/features/scene/components/Box";
import { Console } from "@/features/scene/components/SceneObjects";
import { Html } from "@react-three/drei";
import { memo } from "react";
export function WardrobeStation({ touchControls }: { touchControls: boolean }) {
  const near = useGame((s) => {
    const me = s.room?.players.find((p) => p.id === s.id);
    return (
      s.room?.phase === "lobby" &&
      !!me &&
      (me.seat ?? -1) < 0 &&
      nearWardrobe(me.x, me.z) &&
      !s.wardrobe &&
      !s.practiceOpen &&
      !s.settings
    );
  });
  return (
    <group position={[WARDROBE_STATION.x, 0, WARDROBE_STATION.z]}>
      <Box
        at={[0, 0.76, 0.94]}
        size={[0.64, 0.56, 0.04]}
        color="#294c50"
        round={0.05}
      />
      <Box
        at={[0, 0.72, 0.97]}
        size={[0.23, 0.27, 0.025]}
        color="#d5e5c8"
        round={0.015}
      />
      <Box
        at={[0, 0.85, 0.97]}
        size={[0.42, 0.12, 0.025]}
        color="#d5e5c8"
        round={0.015}
      />
      <Box
        at={[0, 0.92, 0.98]}
        size={[0.09, 0.06, 0.025]}
        color="#294c50"
        round={0.015}
      />
      {near && (
        <Html position={[0, 2, 0]} center zIndexRange={[14, 11]}>
          <button
            className="station-label active wardrobe-station"
            aria-label="Change outfit"
            onClick={(e) => {
              e.stopPropagation();
              openWardrobe();
            }}
          >
            <strong>Change outfit</strong>
            <small>
              {touchControls ? "Tap to open wardrobe" : "Click or press E"}
            </small>
          </button>
        </Html>
      )}
    </group>
  );
}

export function LobbyChair({
  index,
  touchControls,
}: {
  index: number;
  touchControls: boolean;
}) {
  const chair = LOBBY_SEATS[index];
  const action = useGame((s) => {
    if (s.room?.phase !== "lobby" || s.wardrobe || s.practiceOpen || s.settings)
      return "";
    const me = s.room.players.find((p) => p.id === s.id);
    if (!me) return "";
    if (me.seat === index) return "Stand up";
    if ((me.seat ?? -1) >= 0) return "";
    return nearestLobbySeat(
      me.x,
      me.z,
      s.room.players.map((p) => p.seat ?? -1),
    ) === index
      ? "Sit down"
      : "";
  });
  return (
    <group position={[chair.x, 0, chair.z]}>
      <Box at={[0, 0.4, 0]} size={[0.65, 0.22, 0.85]} color="#5a91a1" />
      <Box
        at={[chair.side * 0.23, 0.8, 0]}
        size={[0.18, 0.8, 0.85]}
        color="#73a7ad"
      />
      <Box at={[0, 0.17, 0]} size={[0.3, 0.35, 0.55]} color="#2a414e" />
      {action && (
        <Html
          position={[-chair.side * 1.15, 0.4, 0.8]}
          center
          zIndexRange={[14, 11]}
        >
          <button
            className="station-label active chair-interaction"
            aria-label={action}
            onClick={(e) => {
              e.stopPropagation();
              interactWithSeat(index);
            }}
          >
            <strong>{action}</strong>
            <small>
              {touchControls ? "Tap to interact" : "Click or press E"}
            </small>
          </button>
        </Html>
      )}
    </group>
  );
}

export const WaitingRoom = memo(function WaitingRoom({
  touchControls,
}: {
  touchControls: boolean;
}) {
  return (
    <group>
      <Box
        at={[0, -0.45, 0]}
        size={[12.6, 0.8, 10.6]}
        color="#263e4d"
        round={0.22}
      />
      <Box
        at={[0, -0.04, 0]}
        size={[12, 0.1, 10]}
        color="#788e91"
        round={0.03}
      />
      {Array.from({ length: 11 }, (_, i) => (
        <Box
          key={`x${i}`}
          at={[i - 5, 0.02, 0]}
          size={[0.025, 0.015, 9.8]}
          color="#acc4b5"
          round={0}
        />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <Box
          key={`z${i}`}
          at={[0, 0.02, i - 4]}
          size={[11.8, 0.015, 0.025]}
          color="#acc4b5"
          round={0}
        />
      ))}
      <Box at={[0, 1.1, -5]} size={[12.4, 2.2, 0.3]} color="#354e5b" />
      {[-1, 1].map((sign) => (
        <group key={sign}>
          <Box at={[sign * 6, 0.65, 0]} size={[0.3, 1.3, 10]} color="#354e5b" />
          <Box
            at={[sign * 4, 0.06, 4.8]}
            size={[3.7, 0.12, 0.12]}
            color="#f5c568"
            round={0.03}
          />
          <Box
            at={[sign * 3.8, 1.7, -4.78]}
            size={[3.1, 0.12, 0.1]}
            color="#a7e4d5"
            round={0.03}
          />
        </group>
      ))}
      {LOBBY_SEATS.map((_, index) => (
        <LobbyChair key={index} index={index} touchControls={touchControls} />
      ))}
      <Box at={[0, 1, -4.8]} size={[2.2, 2, 0.15]} color="#1c303e" />
      {[-0.52, 0.52].map((x) => (
        <Box
          key={x}
          at={[x, 1, -4.68]}
          size={[0.98, 1.8, 0.1]}
          color="#708991"
        />
      ))}
      <Box
        at={[0, 2.1, -4.6]}
        size={[1.8, 0.1, 0.1]}
        color="#bde1c8"
        round={0.03}
      />
      {LOBBY_OBSTACLES.slice(0, 1).map(([a, b, c, d], i) => (
        <group key={i}>
          <Box
            at={[(a + b) / 2, 0.6, (c + d) / 2]}
            size={[b - a, 1.2, d - c]}
            color="#4d716b"
          />
          <Box
            at={[(a + b) / 2, 1.23, (c + d) / 2]}
            size={[b - a + 0.08, 0.08, d - c + 0.08]}
            color="#86aa91"
            round={0.03}
          />
          <Box
            at={[(a + b) / 2, 0.65, d + 0.02]}
            size={[0.15, 1.1, 0.04]}
            color="#e8c37b"
            round={0.01}
          />
        </group>
      ))}
      <WardrobeStation touchControls={touchControls} />
      <Console
        x={0}
        z={-3.8}
        color="#a8e4b3"
        practice
        touchControls={touchControls}
      />
      <Html
        position={[0, 2.5, -5]}
        center
        pointerEvents="none"
        style={{ pointerEvents: "none" }}
        zIndexRange={[2, 0]}
      >
        <span className="bay-sign">CLOUDLINE / DEPARTURE BAY</span>
      </Html>
      <mesh position={[0, 0.035, 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.2, 2.24, 64]} />
        <meshBasicMaterial color="#d9c38d" transparent opacity={0.6} />
      </mesh>
    </group>
  );
});
