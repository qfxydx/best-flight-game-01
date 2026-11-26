// Flight physics: one plane, one step. Throttle sets the speed the plane chases,
// pitch trades speed for climb, slow flight stalls, and fuel burns with throttle.
// The step returns events the game loop turns into score, sound and screens.
import { PLANE, WORLD, MISSION } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;
export const EVENT_FUEL_EMPTY = 8;

export class Plane {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = WORLD.runway1.x + 120; // parked on runway 1
    this.y = WORLD.baseHeight + 2; // sitting on the strip, not above it
    this.speed = 0;
    this.vy = 0; // vertical speed, m/s
    this.pitch = 0; // nose angle, radians, + is up
    this.throttle = 0;
    this.fuel = PLANE.fuelStart;
    this.onGround = true;
    this.landed = false;
    this.crashed = false;
    this.crashReason = '';
    this.score = 0;
    this.flightTime = 0;
  }

  // input: { pitch: -1..1, throttle: -1..1 } per frame, dt seconds.
  step(dt, input, world) {
    if (this.crashed || this.landed) return EVENT_NONE;
    let events = EVENT_NONE;
    this.flightTime += dt;

    // Throttle lever.
    this.throttle = Math.max(0, Math.min(1, this.throttle + input.throttle * PLANE.throttleRate * dt));
    const targetSpeed = this.throttle * PLANE.maxSpeed;
    this.speed += (targetSpeed - this.speed) * Math.min(1, PLANE.accel * dt / PLANE.maxSpeed);
    this.speed -= PLANE.drag * this.speed * dt * 0.02;

    // Pitch: the nose follows the stick, harder at speed, weaker near stall.
    // On the ground the nose stays level: rotation comes after lift-off speed.
    const authority = this.speed < PLANE.stallSpeed ? 0.35 + (0.65 * this.speed) / PLANE.stallSpeed : 1;
    if (this.onGround) {
      this.pitch += (0 - this.pitch) * Math.min(1, 6 * dt);
    } else {
      this.pitch += input.pitch * PLANE.pitchRate * authority * dt;
      this.pitch = Math.max(-PLANE.maxPitch, Math.min(PLANE.maxPitch, this.pitch));
      // Hands off the stick, the nose trims gently back toward level: the
      // plane forgives a moment of inattention instead of holding a dive.
      if (input.pitch === 0) this.pitch += (0 - this.pitch) * Math.min(1, 0.35 * dt);
    }
    // Hard pitch at high speed costs energy: throttle discipline matters.
    this.speed -= Math.abs(input.pitch) * PLANE.pitchBleed * dt * (this.speed / PLANE.maxSpeed);
    if (this.speed < 0) this.speed = 0;

    // Climb from pitch; near stall the wing quits and the plane sinks.
    if (this.onGround) {
      this.vy = 0;
    } else if (this.speed >= PLANE.stallSpeed) {
      this.vy = Math.sin(this.pitch) * PLANE.climbFactor * (this.speed / PLANE.cruiseSpeed);
    } else {
      // Stalled: nose drops, sink rate grows as speed falls further.
      this.vy -= (18 - this.speed * 0.4) * dt;
      this.pitch -= 0.25 * dt;
    }
    this.vy = Math.max(-28, Math.min(28, this.vy));

    // Fuel burns with throttle; empty tanks mean a glide, not a fall.
    if (this.fuel > 0) {
      this.fuel -= this.throttle * PLANE.burnRate * dt;
      if (this.fuel <= 0) {
        this.fuel = 0;
        this.throttle = 0;
        events |= EVENT_FUEL_EMPTY;
      }
    }

    this.x += this.speed * dt;
    if (!this.onGround) this.y += this.vy * dt;

    // Rings: flying through an open one scores and buys a little fuel.
    const ring = world.checkRing(this.x, this.y);
    if (ring) {
      this.score += MISSION.ringPoints;
      this.fuel = Math.min(PLANE.fuelStart, this.fuel + PLANE.ringFuelBonus);
      events |= EVENT_RING;
    }

    // Ground handling. On a runway the plane rolls; rotation speed is 32 m/s,
    // and only a pull on the stick lifts it off. Anywhere else, the ground
    // is a crash unless the touch is gentle on a runway strip.
    const ground = world.groundHeight(this.x);
    if (this.onGround) {
      this.y = ground + 2;
      // Gentle rolling resistance only — the old hard brake killed take-off.
      this.speed *= 1 - 0.12 * dt;
      if (this.speed > 32 && input.pitch > 0.15) {
        this.onGround = false;
        this.vy = Math.sin(this.pitch) * PLANE.climbFactor * 0.4;
      }
    } else if (this.y <= ground + 2) {
      const runway = world.runwayAt(this.x);
      const gentle = this.vy >= -PLANE.maxLandingSink && Math.abs(this.pitch) <= PLANE.maxLandingPitch;
      if (runway === 2 && gentle && this.speed < 46 && world.passedRings >= world.rings.length) {
        this.land(world);
        events |= EVENT_LANDED;
      } else if (runway !== 0 && gentle && this.speed < 60) {
        // A survivable touch on a strip: roll it out, take off again if you like.
        this.y = ground + 2;
        this.vy = 0;
        this.onGround = true;
        this.pitch = 0;
      } else {
        this.crash(this.speed > 60 ? 'terrain at speed' : 'terrain');
        events |= EVENT_CRASHED;
      }
    }

    if (this.x >= WORLD.length + 400) {
      this.crash('flew past the valley');
      events |= EVENT_CRASHED;
    }
    return events;
  }

  land(world) {
    this.landed = true;
    this.y = world.groundHeight(this.x) + 2;
    this.vy = 0;
    this.pitch = 0;
    this.score += MISSION.landingPoints + Math.round(this.fuel) * MISSION.fuelBonusPerUnit;
  }

  crash(reason) {
    this.crashed = true;
    this.crashReason = reason;
    this.vy = 0;
  }

  // Heading for the HUD: the valley runs east, pitch reads as climb angle.
  headingDeg() {
    return 90 + (this.pitch * 180) / Math.PI;
  }
}
