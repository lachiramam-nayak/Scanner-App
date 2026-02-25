import type { UserLocation } from '../store/appStore';

const TURN_RADIUS = 40;

const distance = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
};

export const getTurnInstruction = (
  userLocation: UserLocation | null | undefined,
  route: Array<{ x: number; y: number; type: string }> | undefined
) => {
  if (!userLocation || !route || route.length < 2) return null;

  let closestIndex = -1;
  let closestDist = Number.POSITIVE_INFINITY;

  for (let i = 1; i < route.length; i += 1) {
    const p = route[i];
    const d = distance(userLocation.x, userLocation.y, p.x, p.y);
    if (d < closestDist) {
      closestDist = d;
      closestIndex = i;
    }
  }

  if (closestDist > TURN_RADIUS || closestIndex < 0) return null;

  if (closestIndex === route.length - 1) {
    return 'You have arrived';
  }

  if (closestIndex === 0 || closestIndex >= route.length - 1) {
    return null;
  }

  const prev = route[closestIndex - 1];
  const curr = route[closestIndex];
  const next = route[closestIndex + 1];

  const v1x = curr.x - prev.x;
  const v1y = curr.y - prev.y;
  const v2x = next.x - curr.x;
  const v2y = next.y - curr.y;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (mag1 === 0 || mag2 === 0) return null;

  const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
  const distanceLabel = Math.max(1, Math.round(closestDist));
  if (angle < 20) return `In ${distanceLabel} m, continue straight`;

  const cross = v1x * v2y - v1y * v2x;
  return cross > 0
    ? `In ${distanceLabel} m, turn right`
    : `In ${distanceLabel} m, turn left`;
};
