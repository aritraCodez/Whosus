import {
RoundedBox
} from "@react-three/drei";
import { memo } from "react";
export const Box = memo(function Box({
  at,
  size,
  color,
  round = 0.07,
}: {
  at: [number, number, number];
  size: [number, number, number];
  color: string;
  round?: number;
}) {
  return (
    <RoundedBox
      position={at}
      args={size}
      radius={round}
      smoothness={2}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.7} />
    </RoundedBox>
  );
});