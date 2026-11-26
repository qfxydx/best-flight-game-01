// Keyboard and mouse input. Arrows / WASD fly the plane, Space is the brake,
// A toggles the autopilot, P pauses, R restarts, M mutes. The same object feeds
// both the live game and the screenshot autopilot, so a shot is a real flight.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pitch = 0;
    this.throttle = 0;
    this.brake = false;
    this.autopilotToggle = false;
    this.pauseToggle = false;
    this.restartToggle = false;
    this.muteToggle = false;
  }

  attach(target) {
    target.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) {
        if (e.key === 'a' || e.key === 'A') this.autopilotToggle = true;
        if (e.key === 'p' || e.key === 'P') this.pauseToggle = true;
        if (e.key === 'r' || e.key === 'R') this.restartToggle = true;
        if (e.key === 'm' || e.key === 'M') this.muteToggle = true;
      }
      this.keys.add(e.key.toLowerCase());
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    target.addEventListener('blur', () => this.keys.clear());
  }

  // Read the held keys into one frame of stick input, then clear edge triggers.
  poll() {
    const k = this.keys;
    const up = k.has('arrowup') || k.has('w');
    const down = k.has('arrowdown') || k.has('s');
    const left = k.has('arrowleft');
    const right = k.has('arrowright');
    this.pitch = (up ? 1 : 0) - (down ? 1 : 0);
    this.throttle = (right ? 1 : 0) - (left ? 1 : 0);
    this.brake = k.has(' ');
    const out = {
      pitch: this.pitch,
      throttle: this.throttle,
      brake: this.brake,
      autopilotToggle: this.autopilotToggle,
      pauseToggle: this.pauseToggle,
      restartToggle: this.restartToggle,
      muteToggle: this.muteToggle,
    };
    this.autopilotToggle = false;
    this.pauseToggle = false;
    this.restartToggle = false;
    this.muteToggle = false;
    return out;
  }
}
