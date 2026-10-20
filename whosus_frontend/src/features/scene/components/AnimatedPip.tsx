import { Pip } from '@/features/appearance/components/Pip';
export function AnimatedPip({
  walking,
  ...props
}: {
  walking: React.RefObject<boolean>;
  outfit?: string;
  visor?: string;
  accessory?: string;
  boots?: string;
  color: string;
  hat: string;
  ghost: boolean;
  seated?: boolean;
}) {
  return <Pip {...props} walking={walking} />;
}