// The valley: seeded terrain height, the two runways, the river, the rings and
// every collision question the physics asks ("am I below the ground here?").
// Terrain is a sum of two smooth noise layers plus a gentle valley bowl, then
// flattened near both runways so take-off and landing have flat ground.
import { WORLD, MISSION } from './config.js';
import { makeNoise1D } from './random.js';

export const RING_STATE_OPEN = 0;
export const RING_STATE_PASSED = 1;

export class ValleyWorld {
  constructor(seed) {
    this.seed = seed;
    this.hills = makeNoise1D(seed ^ 0x51ab, 900, WORLD.hillAmp);
    this.rough = makeNoise1D(seed ^ 0x77c3, 260, 34);
    this.rings = MISSION.rings.map((r) => ({
      x: r.x,
      y: r.y,
      radius: MISSION.ringRadius,
      state: RING_STATE_OPEN,
    }));
    this.passedRings = 0;
  }

  // Ground height in metres at horizontal position x.
  groundHeight(x) {
    if (x < 0) x = 0;
    if (x > WORLD.length) x = WORLD.length;
    const bowl = Math.sin((x / WORLD.length) * Math.PI) * 40;
    let h = WORLD.baseHeight + bowl + this.hills(x) + this.rough(x);
    // Flatten the ground across both runways (with a smooth ramp either side).
    h = this.flattenNear(h, x, WORLD.runway1.x, WORLD.runway1.width);
    h = this.flattenNear(h, x, WORLD.runway2.x, WORLD.runway2.width);
    return Math.max(20, h);
  }

  flattenNear(h, x, rx, rw) {
    const margin = 260;
    const start = rx - margin;
    const end = rx + rw + margin;
    if (x < start || x > end) return h;
    const flat = WORLD.baseHeight;
    const t = x < rx ? (x - start) / margin : x > rx + rw ? (end - x) / margin : 1;
    const s = t * t * (3 - 2 * t);
    return flat + (h - flat) * (1 - s);
  }

  // Is x over a runway strip? Returns which runway (1 or 2) or 0.
  runwayAt(x) {
    if (x >= WORLD.runway1.x && x <= WORLD.runway1.x + WORLD.runway1.width) return 1;
    if (x >= WORLD.runway2.x && x <= WORLD.runway2.x + WORLD.runway2.width) return 2;
    return 0;
  }

  isRiver(x) {
    return x >= WORLD.river.x && x <= WORLD.river.x + WORLD.river.width;
  }

  nextRing() {
    return this.rings.find((r) => r.state === RING_STATE_OPEN) ?? null;
  }

  // True when the plane's nose is inside an open ring.
  checkRing(px, py) {
    for (const ring of this.rings) {
      if (ring.state !== RING_STATE_OPEN) continue;
      const dx = px - ring.x;
      const dy = py - ring.y;
      if (dx * dx + dy * dy < ring.radius * ring.radius) {
        ring.state = RING_STATE_PASSED;
        this.passedRings += 1;
        return ring;
      }
    }
    return null;
  }

  reset() {
    for (const ring of this.rings) ring.state = RING_STATE_OPEN;
    this.passedRings = 0;
  }
}
