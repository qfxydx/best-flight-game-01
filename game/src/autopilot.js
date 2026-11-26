// Autopilot for the screenshot scenes and for players who press A: a simple
// PD controller that steers at the next ring (or the far runway, once the rings
// are done) and holds a cruise speed, flaring gently for the landing.
import { PLANE, WORLD } from './config.js';

export class Autopilot {
  constructor() {
    this.enabled = false;
  }

  // Returns { pitch: -1..1, throttle: -1..1 } for this frame.
  control(plane, world) {
    // Take-off phase: full power, nose level until rotation speed, then a
    // gentle pull. Chasing a ring at 30 m/s would stall the wing. This phase
    // ends once the plane is past the home runway — the approach must never
    // fall back into it just because the speed dips on final.
    const takingOff = plane.onGround || (plane.x < 1200 && plane.speed < 45);
    if (takingOff) {
      return { pitch: plane.speed > 32 ? 0.3 : 0, throttle: 1 };
    }
    const ring = world.nextRing();
    let targetY;
    let targetSpeed = PLANE.cruiseSpeed;
    if (ring) {
      targetY = ring.y;
    } else {
      // All rings done: a long, gentle approach onto the far runway. Start
      // down early — a fast, high arrival runs out of strip. The targets are
      // measured from the strip itself (flat at base height), not from the
      // rising ground before it, so the descent stays smooth. Final speed
      // stays above the stall: the flare is 35 m/s, never 30.
      const runway = WORLD.runway2;
      const stripY = WORLD.baseHeight;
      const dist = runway.x + runway.width / 2 - plane.x;
      if (dist > 2000) {
        targetY = 260;
        targetSpeed = 55;
      } else if (dist > 1200) {
        targetY = 180;
        targetSpeed = 48;
      } else if (dist > 600) {
        targetY = stripY + 45;
        targetSpeed = 42;
      } else if (dist > 250) {
        targetY = stripY + 12;
        targetSpeed = 38;
      } else {
        // Final flare: aim at the strip itself, so the wheels settle onto
        // it — aiming 7 m above it would hold the plane off forever.
        targetY = stripY + 1;
        targetSpeed = 35;
      }
    }
    const altError = targetY - plane.y;
    const pitch = Math.max(-1, Math.min(1, altError * 0.02 - plane.vy * 0.06));
    const speedError = targetSpeed - plane.speed;
    const throttle = Math.max(-1, Math.min(1, speedError * 0.08));
    return { pitch, throttle };
  }
}
