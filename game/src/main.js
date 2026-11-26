// Ridge Runner — game loop and screens. Wires input, physics, autopilot, sound
// and rendering together, and owns the camera, particles and centre messages.
// The page reads ?shot=start|play|end&seed=N: with a shot, the game stages that
// scene once and freezes on it (for screenshots); without one, it plays live.
import { VIEW, STEP } from './config.js';
import { ValleyWorld } from './world.js';
import { Plane, EVENT_RING, EVENT_LANDED, EVENT_CRASHED, EVENT_FUEL_EMPTY } from './physics.js';
import { Autopilot } from './autopilot.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { Renderer, Camera, SCREEN_TITLE, SCREEN_PLAY, SCREEN_LANDED, SCREEN_CRASHED, SCREEN_PAUSED } from './render.js';
import { stageShot } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.camera = new Camera();
    this.input = new Input();
    this.input.attach(window);
    this.sound = new SoundEngine();
    this.pilot = new Autopilot();
    this.seed = 1;
    this.world = new ValleyWorld(this.seed);
    this.plane = new Plane();
    this.screen = SCREEN_TITLE;
    this.particles = [];
    this.message = null;
    this.time = 0;
    this.paused = false;
    this.shotMode = false;
    this.lastTimestamp = 0;
    // Smoothed stick: the raw keys are binary, the plane answers gradually.
    this.smoothPitch = 0;
    this.smoothThrottle = 0;
  }

  resetWorld(seed) {
    if (seed !== undefined) this.seed = seed;
    this.world = new ValleyWorld(this.seed);
    this.plane = new Plane();
    this.particles = [];
    this.message = null;
    this.camera = new Camera();
    this.camera.x = this.plane.x - 400 / 1.6;
    this.camera.y = this.plane.y - 400 / 0.85;
    this.screen = SCREEN_TITLE;
    this.paused = false;
  }

  // One fixed physics step. Returns a plain object of what happened, so the
  // screenshot stager can watch for landing and crashes without the loop.
  stepFixed(dt, input) {
    const events = this.plane.step(dt, input, this.world);
    this.time += dt;
    if (events & EVENT_RING) {
      this.showMessage(`RING ${this.world.passedRings}/6  +100`);
      this.sound.ring();
      this.burstRing(this.plane.x, this.plane.y);
      this.camera.addShake(2);
    }
    if (events & EVENT_LANDED) {
      this.screen = SCREEN_LANDED;
      this.sound.land();
      this.burstLanding(this.plane.x, this.plane.y);
      this.camera.addShake(3);
    }
    if (events & EVENT_CRASHED) {
      this.screen = SCREEN_CRASHED;
      this.sound.crash();
      this.burstCrash(this.plane.x, this.plane.y);
      this.camera.addShake(12);
    }
    if (events & EVENT_FUEL_EMPTY) this.showMessage('FUEL EMPTY — GLIDING');
    this.camera.follow(this.plane);
    this.updateParticles(dt);
    return { landed: !!(events & EVENT_LANDED), crashed: !!(events & EVENT_CRASHED), ring: !!(events & EVENT_RING) };
  }

  showMessage(text) {
    this.message = { text, age: 0 };
  }

  burstRing(x, y) {
    const sx = this.camera.toScreenX(x);
    const sy = this.camera.toScreenY(y);
    // Expanding shockwave plus the spark burst: the pass reads instantly.
    this.particles.push({
      x: sx, y: sy, vx: 0, vy: 0, life: 0.6, maxLife: 0.6, size: 0,
      color: '#ffcf5e', shock: true,
    });
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      this.particles.push({
        x: sx,
        y: sy,
        vx: Math.cos(a) * 90,
        vy: Math.sin(a) * 90,
        life: 0.7,
        maxLife: 0.7,
        size: 3 + (i % 3),
        color: '#ffb02e',
      });
    }
  }

  burstLanding(x, y) {
    // Dust kicked up by the wheels on touchdown.
    const sx = this.camera.toScreenX(x);
    const sy = this.camera.toScreenY(y);
    for (let i = 0; i < 26; i += 1) {
      this.particles.push({
        x: sx + (Math.random() - 0.5) * 40,
        y: sy - Math.random() * 6,
        vx: (Math.random() - 0.5) * 120,
        vy: -10 - Math.random() * 40,
        life: 0.9,
        maxLife: 0.9,
        size: 4 + Math.random() * 5,
        color: '#c9b18a',
      });
    }
  }

  burstCrash(x, y) {
    const sx = this.camera.toScreenX(x);
    const sy = this.camera.toScreenY(y);
    for (let i = 0; i < 40; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 120;
      this.particles.push({
        x: sx,
        y: sy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 1.2,
        maxLife: 1.2,
        size: 4 + Math.random() * 6,
        color: i % 3 === 0 ? '#ff6b5e' : '#5a5f6b',
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 20 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.message) {
      this.message.age += dt;
      if (this.message.age > 2.2) this.message = null;
    }
    // Engine exhaust puffs while the throttle is open and the plane is moving.
    // A faint wingtip contrail at high speed and in hard turns.
    if (this.plane.throttle > 0.4 && this.plane.speed > 5 && !this.plane.crashed) {
      if (Math.random() < 0.5) {
        this.particles.push({
          x: this.camera.toScreenX(this.plane.x) - 80,
          y: this.camera.toScreenY(this.plane.y) + 6,
          vx: -40 - Math.random() * 30,
          vy: 10 + Math.random() * 20,
          life: 0.5,
          maxLife: 0.5,
          size: 3 + Math.random() * 3,
          color: 'rgba(230, 230, 235, 0.8)',
        });
      }
    }
    if (this.plane.speed > 72 && !this.plane.onGround && !this.plane.crashed) {
      if (Math.random() < 0.4) {
        this.particles.push({
          x: this.camera.toScreenX(this.plane.x) - 70,
          y: this.camera.toScreenY(this.plane.y) - 8,
          vx: -90 - Math.random() * 40,
          vy: (Math.random() - 0.5) * 12,
          life: 0.45,
          maxLife: 0.45,
          size: 2 + Math.random() * 2,
          color: 'rgba(255, 255, 255, 0.55)',
        });
      }
    }
  }

  frame(timestamp) {
    requestAnimationFrame((t) => this.frame(t));
    if (this.shotMode) return; // frozen on the staged frame
    const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000 || STEP);
    this.lastTimestamp = timestamp;
    const input = this.input.poll();
    if (input.restartToggle) {
      this.resetWorld();
      this.screen = SCREEN_TITLE;
    }
    if (input.pauseToggle && this.screen === SCREEN_PLAY) this.paused = !this.paused;
    if (input.muteToggle) this.sound.muted = !this.sound.muted;
    if (input.autopilotToggle && this.screen === SCREEN_PLAY) {
      this.pilot.enabled = !this.pilot.enabled;
      this.showMessage(this.pilot.enabled ? 'AUTOPILOT ON' : 'AUTOPILOT OFF');
    }
    if (this.paused) {
      this.renderer.render(this.renderState(SCREEN_PAUSED));
      return;
    }
    if (this.screen === SCREEN_TITLE) {
      if (input.pitch !== 0 || input.throttle !== 0 || this.input.keys.has('enter') || this.input.keys.has(' ')) {
        this.sound.ensure();
        this.screen = SCREEN_PLAY;
      }
      this.time += dt;
      this.renderer.render(this.renderState(SCREEN_TITLE));
      return;
    }
    if (this.screen === SCREEN_LANDED || this.screen === SCREEN_CRASHED) {
      this.time += dt;
      this.renderer.render(this.renderState(this.screen));
      return;
    }
    // Live flight: ease the binary keys into a smooth stick, so the plane
    // answers gradually instead of snapping. Autopilot bypasses the stick.
    this.sound.ensure();
    this.smoothPitch += (input.pitch - this.smoothPitch) * Math.min(1, 10 * dt);
    this.smoothThrottle += (input.throttle - this.smoothThrottle) * Math.min(1, 8 * dt);
    let stick = { pitch: this.smoothPitch, throttle: this.smoothThrottle, brake: input.brake };
    if (this.pilot.enabled) stick = this.pilot.control(this.plane, this.world);
    if (stick.brake) stick.throttle = -1;
    // Near stall, the airframe shudders: a shake plus the HUD warning.
    if (!this.plane.onGround && this.plane.speed < 30 && !this.plane.crashed && !this.plane.landed) {
      this.camera.addShake(1.6);
    }
    const sub = Math.max(1, Math.round(dt / STEP));
    for (let i = 0; i < sub; i += 1) this.stepFixed(STEP, stick);
    this.sound.setEngine(this.plane.throttle, this.plane.speed);
    this.renderer.render(this.renderState(SCREEN_PLAY));
  }

  renderState(screen) {
    return {
      plane: this.plane,
      world: this.world,
      camera: this.camera,
      screen,
      particles: this.particles,
      time: this.time,
      message: this.message,
    };
  }

  start() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const seed = Number(params.get('seed') || '1') || 1;
    this.resetWorld(seed);
    if (shot) {
      // Screenshot mode: stage the scene once and freeze on it.
      this.shotMode = true;
      const staged = stageShot(shot, this);
      this.screen = staged.screen;
      this.renderer.render(this.renderState(this.screen));
      document.title = `Ridge Runner — shot ${shot}`;
      return;
    }
    // Click also launches, for mouse players.
    this.canvas.addEventListener('click', () => {
      if (this.screen === SCREEN_TITLE) {
        this.sound.ensure();
        this.screen = SCREEN_PLAY;
      }
    });
    this.lastTimestamp = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }
}

// Boot: the canvas fills a fixed 1280x720 stage, scaled by CSS to the window.
const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const game = new Game(canvas);
// Test hook: playtests drive the game through this handle (not part of the game).
window.__ridgeRunner = game;
game.start();
