// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by the
// autopilot, so the frame is what a real flight looks like and the same seed
// always gives the same frame. The start scene keeps the title screen up; the
// play scene stops mid-flight beside a ring; the end scene flies the whole
// mission and lands, so it shows the mission-complete panel.
import { STEP } from './config.js';
import { Autopilot } from './autopilot.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_LANDED, SCREEN_CRASHED } from './render.js';

const START_STEPS = 210; // 3.5 s: full-power roll, rotation, just lifting off
const PLAY_MAX_STEPS = 60 * 60; // safety cap: 60 s of flight
const END_MAX_STEPS = 60 * 300; // up to 5 minutes to finish the mission

/**
 * Stage `game` for the named scene and return the screen to draw.
 * The game object is the live Game from main.js: reset it, drive it, and leave
 * it frozen on the chosen frame.
 */
export function stageShot(name, game) {
  const pilot = new Autopilot();
  game.resetWorld();
  if (name !== 'play' && name !== 'end') {
    // Start: roll down runway 1 at take-off power, title screen still up.
    for (let i = 0; i < START_STEPS; i += 1) {
      game.stepFixed(STEP, { pitch: 0.3, throttle: 1, brake: false });
    }
    return { screen: SCREEN_TITLE };
  }
  if (name === 'play') {
    // Stop ~120 m short of ring 1: the plane sits low over the valley with
    // the glowing ring big ahead of it, HUD alive, terrain close below.
    // A fixed step count would frame a different ring on a different seed.
    const firstRing = game.world.rings[0];
    const stopX = firstRing.x - 120;
    for (let i = 0; i < PLAY_MAX_STEPS; i += 1) {
      const input = pilot.control(game.plane, game.world);
      const events = game.stepFixed(STEP, input);
      if (events.landed || events.crashed || game.plane.x >= stopX) break;
    }
    return { screen: game.plane.crashed ? SCREEN_CRASHED : SCREEN_PLAY };
  }
  // End: fly the whole mission and land.
  for (let i = 0; i < END_MAX_STEPS; i += 1) {
    const input = pilot.control(game.plane, game.world);
    const events = game.stepFixed(STEP, input);
    if (events.landed || events.crashed) break;
  }
  if (game.plane.landed) {
    // Slide the camera so the parked plane sits left of the results panel
    // instead of hidden behind it.
    game.camera.x = game.plane.x - 220 / 1.6;
    return { screen: SCREEN_LANDED };
  }
  if (game.plane.crashed) return { screen: SCREEN_CRASHED };
  return { screen: SCREEN_PLAY };
}
