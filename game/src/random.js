// Seeded random numbers, so the valley, the rings and every screenshot are the
// same every run for the same seed. Mulberry32: small, fast, good enough here.
export function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1-D value noise from a seeded stream: a fixed table of control points,
// linearly interpolated with a smoothstep, so terrain is rolling, not jagged.
export function makeNoise1D(seed, spacing, amp) {
  const rand = makeRandom(seed);
  const points = [];
  const count = 64;
  for (let i = 0; i < count; i += 1) points.push(rand() * 2 - 1);
  return function noise(x) {
    const u = x / spacing;
    const i = Math.floor(u);
    const f = u - i;
    const a = points[((i % count) + count) % count];
    const b = points[(((i + 1) % count) + count) % count];
    const s = f * f * (3 - 2 * f);
    return (a + (b - a) * s) * amp;
  };
}
