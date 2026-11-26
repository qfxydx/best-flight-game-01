// All drawing: golden-hour sky, parallax mountains, the valley floor with
// patchwork fields, river, road and village, the glowing rings, the bush plane,
// and the lit HUD with its instruments. Nothing here loads an image; every
// pixel is drawn from vectors.
import { VIEW, WORLD, COLORS } from './config.js';
import { makeRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LANDED = 'landed';
export const SCREEN_CRASHED = 'crashed';
export const SCREEN_PAUSED = 'paused';

// World metres -> screen pixels. Horizontal scale is generous so the next ring
// stays in frame; vertical scale is compressed so the ground stays visible.
const SCALE_X = 1.6;
const SCALE_Y = 0.85;
const PLANE_SCREEN_X = 400;
const PLANE_SCREEN_Y = 400;

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.shake = 0;
  }

  addShake(amount) {
    this.shake = Math.min(14, this.shake + amount);
  }

  follow(plane) {
    // Look further ahead as speed rises, and pull back a touch: fast flight
    // reads faster and the next ring stays in frame.
    const zoomTarget = 1 - Math.min(0.13, (plane.speed / 105) * 0.13);
    this.zoom += (zoomTarget - this.zoom) * 0.05;
    const planeScreenX = PLANE_SCREEN_X - Math.min(140, plane.speed * 1.2);
    const targetX = plane.x - planeScreenX / (SCALE_X * this.zoom);
    const targetY = plane.y - PLANE_SCREEN_Y / (SCALE_Y * this.zoom);
    this.x += (targetX - this.x) * 0.12;
    this.y += (targetY - this.y) * 0.1;
    this.shake *= 0.88;
    if (this.shake < 0.2) this.shake = 0;
  }

  spanX() {
    return VIEW.width / (SCALE_X * this.zoom);
  }

  toScreenX(wx) {
    return (wx - this.x) * SCALE_X * this.zoom;
  }

  toScreenY(wy) {
    return VIEW.height - 130 - (wy - this.y) * SCALE_Y * this.zoom;
  }
}

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cloudRand = makeRandom(20261126);
    // Three cloud layers: high faint wisps, mid puffs, low big volumes.
    this.clouds = [];
    for (let i = 0; i < 22; i += 1) {
      const layer = i % 3;
      this.clouds.push({
        x: this.cloudRand() * 14000,
        y: layer === 0 ? 40 + this.cloudRand() * 90 : layer === 1 ? 110 + this.cloudRand() * 130 : 220 + this.cloudRand() * 130,
        w: layer === 0 ? 50 + this.cloudRand() * 70 : layer === 1 ? 70 + this.cloudRand() * 90 : 110 + this.cloudRand() * 130,
        a: layer === 0 ? 0.1 + this.cloudRand() * 0.1 : layer === 1 ? 0.14 + this.cloudRand() * 0.14 : 0.16 + this.cloudRand() * 0.16,
        par: layer === 0 ? 0.12 : layer === 1 ? 0.2 : 0.32,
        shade: layer === 2,
      });
    }
    // A few distant birds, drifting slowly across the sky.
    this.birds = [];
    for (let i = 0; i < 5; i += 1) {
      this.birds.push({ x: this.cloudRand() * 12000, y: 120 + this.cloudRand() * 160, s: 6 + this.cloudRand() * 5 });
    }
    // Livestock: grazing herds along the valley floor, fixed by a seeded
    // random so every run places the same animals in the same spots.
    // Two herds sit in the cover frame (near ring 1), one past runway 1, one
    // on the riverbank, one mid-valley, one past runway 2 for the end shot.
    this.pastureRand = makeRandom(20261127);
    const pastureSpots = [
      { x: 800, herd: ['cow', 'sheep', 'sheep', 'sheep'], fence: null, hay: null },
      { x: 1300, herd: ['cow', 'cow', 'sheep', 'sheep', 'sheep'], fence: [1240, 1520], hay: 1420 },
      { x: 1760, herd: ['cow', 'sheep', 'sheep', 'sheep'], fence: null, hay: null },
      { x: 4150, herd: ['sheep', 'sheep', 'sheep'], fence: null, hay: 4180 },
      { x: 5600, herd: ['cow', 'sheep', 'sheep', 'sheep', 'sheep'], fence: null, hay: null },
      { x: 10320, herd: ['cow', 'sheep', 'sheep'], fence: [10260, 10390], hay: null },
    ];
    this.pastures = pastureSpots.map((spot) => ({
      x: spot.x,
      fence: spot.fence,
      hay: spot.hay,
      animals: spot.herd.map((kind) => ({
        kind,
        dx: (this.pastureRand() - 0.5) * 90,
        face: this.pastureRand() > 0.5 ? 1 : -1,
        phase: this.pastureRand() * Math.PI * 2,
        patch: this.pastureRand(),
      })),
    }));
    // Dirt tracks from the ground line down to the frame bottom, so the
    // lower half of the valley floor has a path in it.
    this.tracks = [1330, 10330];
  }

  render(state) {
    const { ctx } = this;
    const { plane, world, camera, screen, particles, time, message } = state;
    ctx.save();
    if (camera.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * camera.shake, (Math.random() - 0.5) * camera.shake);
    }
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    this.drawSky(time, camera);
    this.drawMountainLayer(camera, 0.25, 520, COLORS.farMountain, COLORS.farSnow, 1);
    this.drawHazeBand(camera);
    this.drawMountainLayer(camera, 0.5, 430, COLORS.midMountain, null, 2);
    this.drawMountainLayer(camera, 0.75, 340, COLORS.nearHill, null, 3);
    // The low sun draws over the ranges, so its disc is never lost behind a
    // peak: the halo reads as dusk light over the ridge, not a hole in it.
    this.drawSun();
    this.drawGround(world, camera, time);
    this.drawRings(world, camera, time, plane);
    this.drawPlane(plane, camera, time);
    this.drawParticles(particles);
    if (screen === SCREEN_PLAY && plane.speed > 70 && !plane.crashed) this.drawSpeedLines(plane, time);
    this.drawHUD(plane, world, time);
    if (screen === SCREEN_TITLE) this.drawTitleScreen(time);
    if (screen === SCREEN_PAUSED) this.drawPausedScreen();
    if (screen === SCREEN_LANDED) this.drawLandedScreen(plane, world);
    if (screen === SCREEN_CRASHED) this.drawCrashedScreen(plane);
    if (message) this.drawCentreMessage(message, time);
    ctx.restore();
  }

  drawSky(time, camera) {
    const { ctx } = this;
    // Four-stop dusk gradient: deep indigo up high, ember orange, gold low.
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    g.addColorStop(0, COLORS.skyTop);
    g.addColorStop(0.42, '#7a4a6e');
    g.addColorStop(0.62, COLORS.skyMid);
    g.addColorStop(0.82, COLORS.skyLow);
    g.addColorStop(1, '#8a6a4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Horizon haze: a soft bright band where the sky meets the ranges.
    const haze = ctx.createLinearGradient(0, 300, 0, 430);
    haze.addColorStop(0, 'rgba(255, 200, 130, 0)');
    haze.addColorStop(0.5, 'rgba(255, 200, 130, 0.16)');
    haze.addColorStop(1, 'rgba(255, 200, 130, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 300, VIEW.width, 130);
    // Clouds in three parallax layers, each a puffy cluster with a shaded base.
    for (const c of this.clouds) {
      const span = VIEW.width + 500;
      const x = (((c.x - camera.x * c.par - time * (3 + c.par * 6)) % span) + span) % span - 250;
      ctx.globalAlpha = c.a;
      ctx.fillStyle = '#fff2dd';
      ctx.beginPath();
      ctx.arc(x, c.y, c.w * 0.42, 0, Math.PI * 2);
      ctx.arc(x + c.w * 0.4, c.y + 6, c.w * 0.34, 0, Math.PI * 2);
      ctx.arc(x - c.w * 0.38, c.y + 8, c.w * 0.3, 0, Math.PI * 2);
      ctx.arc(x + c.w * 0.1, c.y - 12, c.w * 0.3, 0, Math.PI * 2);
      ctx.arc(x - c.w * 0.12, c.y - 6, c.w * 0.26, 0, Math.PI * 2);
      ctx.fill();
      if (c.shade) {
        ctx.globalAlpha = c.a * 0.5;
        ctx.fillStyle = '#d8a887';
        ctx.beginPath();
        ctx.ellipse(x, c.y + c.w * 0.2, c.w * 0.5, c.w * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // Distant birds: tiny v-shapes crossing the dusk.
    ctx.strokeStyle = 'rgba(40, 32, 40, 0.7)';
    ctx.lineWidth = 2;
    for (const b of this.birds) {
      const span = VIEW.width + 300;
      const x = (((b.x - camera.x * 0.15 - time * 12) % span) + span) % span - 150;
      const flap = Math.sin(time * 5 + b.x) * 3;
      ctx.beginPath();
      ctx.moveTo(x - b.s, b.y + flap);
      ctx.lineTo(x, b.y);
      ctx.lineTo(x + b.s, b.y + flap);
      ctx.stroke();
    }
  }

  drawSun() {
    // Low sun with a bright core and a wide warm halo, drawn over the
    // ranges so the disc itself is always in frame.
    const { ctx } = this;
    const sunX = VIEW.width * 0.72;
    const sunY = VIEW.height * 0.5;
    const halo = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 260);
    halo.addColorStop(0, 'rgba(255, 220, 140, 0.85)');
    halo.addColorStop(0.35, 'rgba(255, 180, 100, 0.32)');
    halo.addColorStop(1, 'rgba(255, 180, 100, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 260, sunY - 260, 520, 520);
    ctx.fillStyle = COLORS.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawHazeBand(camera) {
    const { ctx } = this;
    // Warm haze between the far range and the mid range, so the depth reads.
    ctx.fillStyle = 'rgba(247, 200, 115, 0.10)';
    ctx.fillRect(0, 330, VIEW.width, 90);
  }

  drawMountainLayer(camera, parallax, baseY, color, snow, seed) {
    const { ctx } = this;
    // Smooth ridgeline: control points every ~300 px, smoothstep between them,
    // so the range reads as mountains, not a row of pine spikes.
    const ridge = (wx) => {
      const seg = 300;
      const i = Math.floor(wx / seg);
      const f = wx / seg - i;
      const s = f * f * (3 - 2 * f);
      const a = hash(i * 7 + seed * 97) * 130 + hash(i * 3 + seed * 31) * 55;
      const b = hash((i + 1) * 7 + seed * 97) * 130 + hash((i + 1) * 3 + seed * 31) * 55;
      return baseY - (a + (b - a) * s);
    };
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, VIEW.height);
    for (let sx = 0; sx <= VIEW.width; sx += 8) {
      ctx.lineTo(sx, ridge(camera.x * parallax + sx * 2.4));
    }
    ctx.lineTo(VIEW.width, VIEW.height);
    ctx.closePath();
    ctx.fill();
    if (snow) {
      // Snow caps on the highest peaks only.
      ctx.fillStyle = snow;
      for (let sx = 0; sx <= VIEW.width; sx += 8) {
        const wx = camera.x * parallax + sx * 2.4;
        const i = Math.floor(wx / 300);
        const peak = hash(i * 7 + seed * 97);
        if (peak > 0.74 && Math.abs(wx / 300 - i - 0.5) < 0.3) {
          const h = ridge(wx);
          ctx.beginPath();
          ctx.moveTo(sx - 18, h + 30);
          ctx.lineTo(sx, h - 4);
          ctx.lineTo(sx + 18, h + 30);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  drawGround(world, camera, time) {
    const { ctx } = this;
    const groundY = (wx) => this.groundScreenY(world, camera, wx);
    // Valley floor: field strips that alternate with distance, so the ground reads.
    ctx.beginPath();
    ctx.moveTo(0, VIEW.height);
    for (let sx = 0; sx <= VIEW.width; sx += 8) {
      const wx = camera.x + sx / (SCALE_X * camera.zoom);
      ctx.lineTo(sx, groundY(wx));
    }
    ctx.lineTo(VIEW.width, VIEW.height);
    ctx.closePath();
    ctx.fillStyle = COLORS.fieldA;
    ctx.fill();
    // Patchwork fields: varied widths and four tones, with dark hedgerow
    // seams between them, so the floor reads as farmland, not flat slabs.
    const tones = [COLORS.fieldB, COLORS.fieldC, COLORS.fieldD, 'rgba(90, 130, 70, 0.55)'];
    let bx = Math.floor(camera.x / 180) * 180;
    while (bx < camera.x + camera.spanX() + 260) {
      const w = 140 + hash(bx * 3) * 140;
      const x0 = (bx - camera.x) * SCALE_X * camera.zoom;
      const x1 = x0 + w * SCALE_X * camera.zoom;
      if (x1 > 0 && x0 < VIEW.width) {
        ctx.fillStyle = tones[Math.floor(hash(bx * 7) * tones.length)];
        ctx.beginPath();
        ctx.moveTo(x0, groundY(bx));
        ctx.lineTo(x1, groundY(bx + w));
        ctx.lineTo(x1, VIEW.height);
        ctx.lineTo(x0, VIEW.height);
        ctx.closePath();
        ctx.fill();
        // Hedgerow seam at the band's left edge.
        ctx.strokeStyle = COLORS.hedge;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x0, groundY(bx));
        ctx.lineTo(x0, groundY(bx) - 7);
        ctx.stroke();
        // Hay bales in some bands.
        if (hash(bx * 11) > 0.62) {
          const hx = x0 + (x1 - x0) * 0.5;
          const hy = groundY(bx + w * 0.5);
          ctx.fillStyle = '#d8b45e';
          ctx.beginPath();
          ctx.arc(hx, hy - 6, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#b8933f';
          ctx.beginPath();
          ctx.arc(hx + 26, hy - 5, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      bx += w;
    }
    // A dark lip along the terrain surface, so the ground reads as a surface.
    ctx.strokeStyle = 'rgba(30, 50, 30, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let sx = 0; sx <= VIEW.width; sx += 8) {
      const wx = camera.x + sx / (SCALE_X * camera.zoom);
      if (sx === 0) ctx.moveTo(sx, groundY(wx));
      else ctx.lineTo(sx, groundY(wx));
    }
    ctx.stroke();
    // Road: a dusty strip along the valley floor with a dashed centreline.
    {
      const rx0 = (WORLD.road.x - camera.x) * SCALE_X * camera.zoom;
      const rx1 = (WORLD.road.x + 900 - camera.x) * SCALE_X * camera.zoom;
      if (rx1 > 0 && rx0 < VIEW.width) {
        ctx.fillStyle = COLORS.road;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, rx0), groundY(WORLD.road.x));
        for (let sx = Math.max(0, rx0); sx <= Math.min(VIEW.width, rx1); sx += 8) {
          const wx = camera.x + sx / (SCALE_X * camera.zoom);
          ctx.lineTo(sx, groundY(wx) + 10);
        }
        ctx.lineTo(Math.min(VIEW.width, rx1), VIEW.height);
        ctx.lineTo(Math.max(0, rx0), VIEW.height);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = COLORS.roadMark;
        for (let d = WORLD.road.x + 30; d < WORLD.road.x + 900; d += 80) {
          const sx = (d - camera.x) * SCALE_X * camera.zoom;
          if (sx < -20 || sx > VIEW.width + 20) continue;
          ctx.fillRect(sx, groundY(d) + 3, 26, 3);
        }
      }
    }
    // River: a wavy blue band where the valley crosses it, with sun glints.
    {
      const rx0 = (WORLD.river.x - camera.x) * SCALE_X * camera.zoom;
      const rx1 = (WORLD.river.x + WORLD.river.width - camera.x) * SCALE_X * camera.zoom;
      if (rx1 > 0 && rx0 < VIEW.width) {
        const wobble = (wx) => Math.sin(wx * 0.02) * 7;
        ctx.fillStyle = COLORS.river;
        ctx.beginPath();
        for (let sx = Math.max(0, rx0); sx <= Math.min(VIEW.width, rx1); sx += 8) {
          const wx = camera.x + sx / (SCALE_X * camera.zoom);
          const y = groundY(wx) + wobble(wx);
          if (sx === Math.max(0, rx0)) ctx.moveTo(sx, y);
          else ctx.lineTo(sx, y);
        }
        ctx.lineTo(Math.min(VIEW.width, rx1), VIEW.height);
        ctx.lineTo(Math.max(0, rx0), VIEW.height);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = COLORS.riverGlint;
        ctx.lineWidth = 2;
        for (const off of [10, 26]) {
          ctx.beginPath();
          for (let sx = Math.max(0, rx0 + 10); sx <= Math.min(VIEW.width, rx1 - 10); sx += 10) {
            const wx = camera.x + sx / (SCALE_X * camera.zoom);
            const y = groundY(wx) + wobble(wx) + off;
            if (sx === Math.max(0, rx0 + 10)) ctx.moveTo(sx, y);
            else ctx.lineTo(sx, y);
          }
          ctx.stroke();
        }
      }
    }
    // Village beside runway 2: houses with lit windows and a tower house.
    this.drawVillage(world, camera, groundY);
    // Tree clusters: small groups with trunk and two-tone canopy.
    for (let bx = Math.floor(camera.x / 90) * 90; bx < camera.x + camera.spanX() + 90; bx += 90) {
      if (hash(bx) < 0.5) continue;
      if (world.runwayAt(bx) !== 0 || world.isRiver(bx)) continue;
      const sx = (bx - camera.x) * SCALE_X * camera.zoom;
      const sy = groundY(bx);
      const n = 1 + Math.floor(hash(bx + 13) * 3);
      for (let t = 0; t < n; t += 1) {
        const tx = sx + (t - (n - 1) / 2) * 16;
        const s = 9 + hash(bx + t * 31) * 11;
        ctx.strokeStyle = '#4a3423';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx, sy);
        ctx.lineTo(tx, sy - s * 0.7);
        ctx.stroke();
        ctx.fillStyle = COLORS.treeDark;
        ctx.beginPath();
        ctx.arc(tx, sy - s * 1.1, s * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.treeLight;
        ctx.beginPath();
        ctx.arc(tx - s * 0.22, sy - s * 1.3, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Grazing livestock, fences and dirt tracks on the valley floor.
    this.drawLivestock(world, camera, time, groundY);
    this.drawRunway(world, camera, WORLD.runway1, '09');
    this.drawRunway(world, camera, WORLD.runway2, '27');
  }

  drawLivestock(world, camera, time, groundY) {
    const { ctx } = this;
    // Dirt tracks: narrow dusty bands from the ground line down to the frame
    // bottom, drawn the same way as the road, so the lower half of the floor
    // reads as worked land with a path through it.
    for (const tx of this.tracks) {
      const rx0 = (tx - camera.x) * SCALE_X * camera.zoom;
      const rx1 = (tx + 22 - camera.x) * SCALE_X * camera.zoom;
      if (rx1 < 0 || rx0 > VIEW.width) continue;
      ctx.fillStyle = COLORS.trackDust;
      ctx.beginPath();
      ctx.moveTo(Math.max(0, rx0), groundY(tx));
      for (let sx = Math.max(0, rx0); sx <= Math.min(VIEW.width, rx1); sx += 8) {
        const wx = camera.x + sx / (SCALE_X * camera.zoom);
        ctx.lineTo(sx, groundY(wx));
      }
      ctx.lineTo(Math.min(VIEW.width, rx1), VIEW.height);
      ctx.lineTo(Math.max(0, rx0), VIEW.height);
      ctx.closePath();
      ctx.fill();
      // Wheel ruts down the track.
      ctx.strokeStyle = COLORS.trackRut;
      ctx.lineWidth = 2;
      for (const off of [7, 15]) {
        const sx = rx0 + off * SCALE_X * camera.zoom;
        if (sx < 0 || sx > VIEW.width) continue;
        ctx.beginPath();
        ctx.moveTo(sx, groundY(tx + off));
        ctx.lineTo(sx, VIEW.height);
        ctx.stroke();
      }
    }
    // Wooden fences: short runs of posts and two rails along the ground.
    for (const group of this.pastures) {
      if (!group.fence) continue;
      const [f0, f1] = group.fence;
      const p0 = (f0 - camera.x) * SCALE_X * camera.zoom;
      const p1 = (f1 - camera.x) * SCALE_X * camera.zoom;
      if (p1 < -20 || p0 > VIEW.width + 20) continue;
      const tops = [];
      ctx.strokeStyle = COLORS.fenceWood;
      ctx.lineWidth = 2;
      for (let wx = f0; wx <= f1; wx += 14) {
        const sx = (wx - camera.x) * SCALE_X * camera.zoom;
        const sy = groundY(wx);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - 13);
        ctx.stroke();
        tops.push([sx, sy]);
      }
      ctx.lineWidth = 2;
      for (const drop of [5, 10]) {
        ctx.beginPath();
        for (let i = 0; i < tops.length; i += 1) {
          const [sx, sy] = tops[i];
          if (i === 0) ctx.moveTo(sx, sy - drop);
          else ctx.lineTo(sx, sy - drop);
        }
        ctx.stroke();
      }
    }
    // Haystacks: gold cones with a few strokes, beside the herds that have one.
    for (const group of this.pastures) {
      if (group.hay === null || group.hay === undefined) continue;
      const sx = (group.hay - camera.x) * SCALE_X * camera.zoom;
      if (sx < -30 || sx > VIEW.width + 30) continue;
      const sy = groundY(group.hay);
      ctx.fillStyle = COLORS.hayGold;
      ctx.beginPath();
      ctx.moveTo(sx - 15, sy);
      ctx.quadraticCurveTo(sx - 12, sy - 22, sx, sy - 26);
      ctx.quadraticCurveTo(sx + 12, sy - 22, sx + 15, sy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLORS.hayDark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx - 6, sy - 4);
      ctx.lineTo(sx - 3, sy - 16);
      ctx.moveTo(sx + 5, sy - 3);
      ctx.lineTo(sx + 2, sy - 15);
      ctx.stroke();
    }
    // The herds themselves, standing on the ground line. Heads bob slowly on
    // game time, so the graze is the same on every run.
    for (const group of this.pastures) {
      for (const a of group.animals) {
        const wx = group.x + a.dx;
        if (world.runwayAt(wx) !== 0 || world.isRiver(wx)) continue;
        const sx = (wx - camera.x) * SCALE_X * camera.zoom;
        if (sx < -30 || sx > VIEW.width + 30) continue;
        const sy = groundY(wx);
        if (a.kind === 'cow') this.drawCow(sx, sy, a, time);
        else this.drawSheep(sx, sy, a, time);
      }
      // Grass tufts beside each herd, so the ground under them is not bare.
      for (const off of [-30, 12, 34]) {
        const wx = group.x + off;
        const sx = (wx - camera.x) * SCALE_X * camera.zoom;
        if (sx < -10 || sx > VIEW.width + 10) continue;
        const sy = groundY(wx);
        ctx.strokeStyle = '#4a7a3e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 3, sy - 7);
        ctx.moveTo(sx + 2, sy);
        ctx.lineTo(sx + 2, sy - 9);
        ctx.moveTo(sx + 4, sy);
        ctx.lineTo(sx + 6, sy - 6);
        ctx.stroke();
      }
    }
  }

  drawCow(sx, sy, a, time) {
    const { ctx } = this;
    const bob = Math.sin(time * 1.1 + a.phase) * 1.5;
    const front = sx + a.face * 13;
    // Legs.
    ctx.strokeStyle = COLORS.cowBlack;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const lx of [-9, -3, 4, 9]) {
      ctx.moveTo(sx + lx, sy - 5);
      ctx.lineTo(sx + lx, sy);
    }
    ctx.stroke();
    // Body: brown, or white with black patches.
    const coat = a.patch > 0.5 ? COLORS.cowBrown : COLORS.cowWhite;
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 10, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    if (a.patch <= 0.5) {
      ctx.fillStyle = COLORS.cowBlack;
      ctx.beginPath();
      ctx.ellipse(sx - 5, sy - 12, 5, 3.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sx + 6, sy - 8, 4, 3, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Tail with a tuft.
    ctx.strokeStyle = coat === COLORS.cowWhite ? COLORS.cowBlack : COLORS.cowBrown;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - a.face * 13, sy - 13);
    ctx.lineTo(sx - a.face * 15, sy - 4);
    ctx.stroke();
    ctx.fillStyle = COLORS.cowBlack;
    ctx.beginPath();
    ctx.arc(sx - a.face * 15, sy - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    // Lowered grazing head.
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(front, sy - 4 + bob, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c8a8';
    ctx.beginPath();
    ctx.ellipse(front + a.face * 3, sy - 3 + bob, 2.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSheep(sx, sy, a, time) {
    const { ctx } = this;
    const bob = Math.sin(time * 1.4 + a.phase) * 1.5;
    const front = sx + a.face * 9;
    // Legs.
    ctx.strokeStyle = COLORS.sheepDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const lx of [-5, -1, 3, 6]) {
      ctx.moveTo(sx + lx, sy - 4);
      ctx.lineTo(sx + lx, sy);
    }
    ctx.stroke();
    // Woolly body: three overlapping puffs.
    ctx.fillStyle = COLORS.sheepWool;
    for (const [ox, oy, r] of [[-4, -8, 5], [2, -9, 5.5], [6, -7, 4.5]]) {
      ctx.beginPath();
      ctx.arc(sx + ox, sy + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dark grazing head, lowered.
    ctx.fillStyle = COLORS.sheepDark;
    ctx.beginPath();
    ctx.ellipse(front, sy - 3 + bob, 3.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawVillage(world, camera, groundY) {
    const { ctx } = this;
    const vx0 = (WORLD.village.x - camera.x) * SCALE_X * camera.zoom;
    const vx1 = (WORLD.village.x + WORLD.village.width - camera.x) * SCALE_X * camera.zoom;
    if (vx1 < -40 || vx0 > VIEW.width + 40) return;
    for (let i = 0; i < 6; i += 1) {
      const hx = WORLD.village.x + 30 + i * 68;
      const sx = (hx - camera.x) * SCALE_X * camera.zoom;
      if (sx < -50 || sx > VIEW.width + 50) continue;
      const sy = groundY(hx);
      const w = 34 + hash(hx) * 12;
      const h = 20 + hash(hx + 5) * 10;
      const tower = i === 4;
      // Walls.
      ctx.fillStyle = '#e8d9b8';
      ctx.fillRect(sx, sy - h - (tower ? 26 : 0), w, h + (tower ? 26 : 0));
      // Roof.
      ctx.fillStyle = hash(hx + 9) > 0.5 ? COLORS.roofA : COLORS.roofB;
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy - h - (tower ? 26 : 0));
      ctx.lineTo(sx + w / 2, sy - h - (tower ? 26 : 0) - (tower ? 30 : 13));
      ctx.lineTo(sx + w + 3, sy - h - (tower ? 26 : 0));
      ctx.closePath();
      ctx.fill();
      // Lit windows.
      ctx.fillStyle = COLORS.wallLit;
      ctx.fillRect(sx + 6, sy - h + 4, 7, 8);
      ctx.fillRect(sx + w - 13, sy - h + 4, 7, 8);
    }
  }

  groundScreenY(world, camera, wx) {
    return VIEW.height - 130 - (world.groundHeight(wx) - camera.y) * SCALE_Y * camera.zoom;
  }

  drawRunway(world, camera, runway, label) {
    const { ctx } = this;
    const x0 = (runway.x - camera.x) * SCALE_X * camera.zoom;
    const x1 = (runway.x + runway.width - camera.x) * SCALE_X * camera.zoom;
    if (x1 < 0 || x0 > VIEW.width) return;
    const y0 = this.groundScreenY(world, camera, runway.x);
    const y1 = this.groundScreenY(world, camera, runway.x + runway.width);
    ctx.fillStyle = COLORS.runway;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1, VIEW.height);
    ctx.lineTo(x0, VIEW.height);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes.
    ctx.fillStyle = COLORS.runwayMark;
    for (let d = runway.x + 40; d < runway.x + runway.width - 40; d += 90) {
      const sx = (d - camera.x) * SCALE_X * camera.zoom;
      const sy = this.groundScreenY(world, camera, d);
      ctx.fillRect(sx, sy - 3, 44 * SCALE_X * camera.zoom * 0.6, 4);
    }
    // Threshold bars at both ends.
    ctx.fillStyle = COLORS.runwayMark;
    for (const tx of [runway.x + 26, runway.x + runway.width - 52]) {
      const sx = (tx - camera.x) * SCALE_X * camera.zoom;
      const sy = this.groundScreenY(world, camera, tx);
      ctx.fillRect(sx, sy - 8, 26, 3);
    }
    // Edge lights: small amber dots along the strip.
    ctx.fillStyle = '#ffb02e';
    for (let d = runway.x + 60; d < runway.x + runway.width - 20; d += 120) {
      const sx = (d - camera.x) * SCALE_X * camera.zoom;
      const sy = this.groundScreenY(world, camera, d);
      ctx.beginPath();
      ctx.arc(sx, sy - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Big runway number at the threshold.
    ctx.fillStyle = COLORS.runwayMark;
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, (x0 + x1) / 2, Math.min(y0, y1) - 16);
    ctx.textAlign = 'left';
    // Windsock on a pole at the runway's near end.
    const wx = x0 + 30;
    const wy = y0;
    ctx.strokeStyle = '#d8d2c2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx, wy - 46);
    ctx.stroke();
    ctx.fillStyle = '#e86a3a';
    ctx.beginPath();
    ctx.moveTo(wx, wy - 46);
    ctx.lineTo(wx + 26, wy - 40);
    ctx.lineTo(wx, wy - 34);
    ctx.closePath();
    ctx.fill();
  }

  drawRings(world, camera, time, plane) {
    const { ctx } = this;
    for (let idx = 0; idx < world.rings.length; idx += 1) {
      const ring = world.rings[idx];
      const sx = camera.toScreenX(ring.x);
      if (sx < -140 || sx > VIEW.width + 140) continue;
      const sy = camera.toScreenY(ring.y);
      if (ring.state === 1) continue; // passed rings fade out entirely
      const pulse = 1 + Math.sin(time * 3 + ring.x) * 0.05;
      const r = 52 * pulse;
      // Glow halo.
      const glow = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 1.9);
      glow.addColorStop(0, COLORS.ringGlow);
      glow.addColorStop(1, 'rgba(255, 176, 46, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.9, 0, Math.PI * 2);
      ctx.fill();
      // Hoop with a lit top edge and a shaded bottom: two arcs read as a torus.
      ctx.strokeStyle = '#c77f14';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = COLORS.ring;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(sx, sy, r, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
      ctx.strokeStyle = COLORS.ringCore;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r, -0.9, 0.5);
      ctx.stroke();
      // Orbiting sparks around the hoop, so it feels alive and lit.
      for (let s = 0; s < 3; s += 1) {
        const a = time * 1.4 + (s * Math.PI * 2) / 3;
        ctx.fillStyle = COLORS.ringCore;
        ctx.beginPath();
        ctx.arc(sx + Math.cos(a) * r, sy + Math.sin(a) * r, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // Ring number badge above the hoop.
      ctx.fillStyle = 'rgba(12, 18, 28, 0.75)';
      ctx.beginPath();
      ctx.arc(sx, sy - r - 20, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.ringCore;
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, sx, sy - r - 15);
      ctx.textAlign = 'left';
      // Tether down to the ground so the ring sits in the world.
      const gy = this.groundScreenY(world, camera, ring.x);
      ctx.strokeStyle = 'rgba(255, 176, 46, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(sx, sy + r);
      ctx.lineTo(sx, gy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Next-ring pointer: an arrow at the screen edge when the ring is far
    // ahead, kept below the HUD panels so it never covers the instruments.
    const next = world.nextRing();
    if (next) {
      const sx = camera.toScreenX(next.x);
      if (sx > VIEW.width - 60) {
        const sy = camera.toScreenY(next.y);
        const cy = Math.max(140, Math.min(VIEW.height - 180, sy));
        ctx.fillStyle = COLORS.ring;
        ctx.beginPath();
        ctx.moveTo(VIEW.width - 66, cy - 14);
        ctx.lineTo(VIEW.width - 34, cy);
        ctx.lineTo(VIEW.width - 66, cy + 14);
        ctx.closePath();
        ctx.fill();
        ctx.font = 'bold 15px "Courier New", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.max(0, Math.round(next.x - plane.x))}m`, VIEW.width - 74, cy + 5);
        ctx.textAlign = 'left';
      }
    }
  }

  drawPlane(plane, camera, time) {
    const { ctx } = this;
    const sx = camera.toScreenX(plane.x);
    const sy = camera.toScreenY(plane.y);
    if (sx < -200 || sx > VIEW.width + 200 || sy < -140 || sy > VIEW.height + 140) return;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-plane.pitch * 0.9);
    // The plane draws 1.35x bigger than the first cut: it is the hero of the frame.
    ctx.scale(1.35, 1.35);
    if (plane.crashed) {
      // Wreck: tilted, darkened, smoke already rising from the particles.
      ctx.rotate(0.5);
      ctx.globalAlpha = 0.85;
    }
    // Spinning propeller: blur disc plus two blade streaks that spin with time.
    const propX = 52;
    ctx.fillStyle = 'rgba(220, 225, 235, 0.32)';
    ctx.beginPath();
    ctx.ellipse(propX, 0, 5, 27 + Math.sin(time * 40) * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 244, 250, 0.5)';
    ctx.lineWidth = 3;
    const pa = time * 28;
    ctx.beginPath();
    ctx.moveTo(propX - Math.sin(pa) * 26, -Math.cos(pa) * 26);
    ctx.lineTo(propX + Math.sin(pa) * 26, Math.cos(pa) * 26);
    ctx.stroke();
    // Tail with a white stripe.
    ctx.fillStyle = COLORS.planeRed;
    ctx.beginPath();
    ctx.moveTo(-52, -4);
    ctx.lineTo(-66, -26);
    ctx.lineTo(-56, -26);
    ctx.lineTo(-44, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.planeWhite;
    ctx.beginPath();
    ctx.moveTo(-58, -12);
    ctx.lineTo(-52, -14);
    ctx.lineTo(-48, -8);
    ctx.lineTo(-54, -6);
    ctx.closePath();
    ctx.fill();
    // Fuselage: shaded belly to sunlit top, so the plane reads as built.
    const body = ctx.createLinearGradient(0, -13, 0, 13);
    body.addColorStop(0, COLORS.planeRedLight);
    body.addColorStop(0.45, COLORS.planeRed);
    body.addColorStop(1, COLORS.planeRedDark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-56, 2);
    ctx.quadraticCurveTo(-30, -14, 6, -12);
    ctx.quadraticCurveTo(38, -10, 54, 0);
    ctx.quadraticCurveTo(38, 10, 4, 12);
    ctx.quadraticCurveTo(-34, 12, -56, 2);
    ctx.closePath();
    ctx.fill();
    // Belly stripe.
    ctx.fillStyle = COLORS.planeWhite;
    ctx.beginPath();
    ctx.moveTo(-20, 6);
    ctx.quadraticCurveTo(8, 7, 34, 3);
    ctx.lineTo(30, 8);
    ctx.quadraticCurveTo(4, 11, -20, 10);
    ctx.closePath();
    ctx.fill();
    // Cabin windows: warm lit glass with a bright reflection streak.
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(12, -10);
    ctx.lineTo(17, -3);
    ctx.lineTo(-8, -3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.moveTo(-2, -10);
    ctx.lineTo(2, -10);
    ctx.lineTo(5, -3);
    ctx.lineTo(1, -3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.planeDark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, -10);
    ctx.lineTo(4, -3);
    ctx.stroke();
    // Registration mark on the tail.
    ctx.fillStyle = 'rgba(244, 239, 228, 0.9)';
    ctx.font = 'bold 8px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RR-27', -38, 0);
    ctx.textAlign = 'left';
    // High wing with a red tip stripe, held by two struts.
    ctx.strokeStyle = COLORS.planeDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(-14, -13);
    ctx.moveTo(8, -6);
    ctx.lineTo(12, -13);
    ctx.stroke();
    ctx.fillStyle = COLORS.planeWhite;
    ctx.beginPath();
    ctx.moveTo(-16, -12);
    ctx.lineTo(14, -12);
    ctx.lineTo(20, -6);
    ctx.lineTo(-22, -6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.planeRed;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, -12);
    ctx.lineTo(14, -12);
    ctx.stroke();
    ctx.fillStyle = COLORS.planeRed;
    ctx.fillRect(12, -12, 5, 3);
    // Landing gear with fairings.
    ctx.strokeStyle = COLORS.planeDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-28, 10);
    ctx.lineTo(-32, 20);
    ctx.moveTo(18, 10);
    ctx.lineTo(22, 20);
    ctx.stroke();
    ctx.fillStyle = COLORS.planeWhite;
    ctx.beginPath();
    ctx.ellipse(-32, 20, 7, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(22, 20, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1a18';
    ctx.beginPath();
    ctx.arc(-32, 21, 3.5, 0, Math.PI * 2);
    ctx.arc(22, 21, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Navigation lights with a soft glow: red left, green right, blinking.
    if (Math.floor(time * 2) % 2 === 0) {
      for (const [lx, color] of [[-56, '#ff4d4d'], [54, '#4dff88']]) {
        const lg = ctx.createRadialGradient(lx, 0, 1, lx, 0, 12);
        lg.addColorStop(0, color);
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(lx, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(lx, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawParticles(particles) {
    const { ctx } = this;
    for (const p of particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.shock) {
        // Expanding shockwave ring, e.g. the flash of a passed ring.
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * a + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (1 - a) * 110 + 12, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawSpeedLines(plane, time) {
    // Faint streaks at the screen edges once the plane is really moving.
    const { ctx } = this;
    const strength = Math.min(1, (plane.speed - 70) / 35);
    ctx.strokeStyle = `rgba(255, 240, 210, ${0.14 * strength})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const y = 60 + hash(i * 17 + Math.floor(time * 2)) * 600;
      const x = ((hash(i * 29) * 1600 - time * 700) % 1500 + 1500) % 1500 - 110;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 70 + plane.speed, y);
      ctx.stroke();
    }
  }

  drawHUD(plane, world, time) {
    const { ctx } = this;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Top-left instrument cluster.
    this.panel(16, 14, 300, 96);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText('ALT', 30, 36);
    ctx.fillText('SPD', 30, 62);
    ctx.fillText('HDG', 30, 88);
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.max(0, Math.round(plane.y))} m`, 92, 38);
    ctx.fillText(`${Math.round(plane.speed * 3.6)} km/h`, 92, 64);
    ctx.fillText(`${Math.round(plane.headingDeg())}°`, 92, 90);
    // Vertical speed next to altitude, as a number, not just an arrow.
    const vs = plane.vy;
    ctx.fillStyle = vs > 1 ? COLORS.hudGreen : vs < -1 ? COLORS.hudRed : COLORS.hudText;
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText(`${vs > 0 ? '+' : ''}${vs.toFixed(1)} m/s`, 218, 38);
    // Attitude indicator: a small round dial with a moving horizon and a pitch ladder.
    this.drawAttitude(352, 62, 46, plane);
    // Compass tape across the top centre.
    this.drawCompass(plane);
    // Top-right: score, rings, fuel.
    this.panel(VIEW.width - 316, 14, 300, 96);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText('SCORE', VIEW.width - 300, 36);
    ctx.fillText('RINGS', VIEW.width - 300, 62);
    ctx.fillText('FUEL', VIEW.width - 300, 88);
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${plane.score}`, VIEW.width - 218, 38);
    // Ring pips.
    for (let i = 0; i < world.rings.length; i += 1) {
      ctx.fillStyle = world.rings[i].state === 1 ? COLORS.hudGreen : 'rgba(255, 233, 176, 0.25)';
      ctx.beginPath();
      ctx.arc(VIEW.width - 208 + i * 20, 58, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fuel bar: pulses red under a quarter tank.
    const fuelW = 150;
    const lowFuel = plane.fuel < 25;
    ctx.fillStyle = 'rgba(255, 233, 176, 0.2)';
    ctx.fillRect(VIEW.width - 218, 78, fuelW, 12);
    if (lowFuel) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 6);
      ctx.fillStyle = COLORS.hudRed;
    } else {
      ctx.fillStyle = COLORS.hudGreen;
    }
    ctx.fillRect(VIEW.width - 218, 78, fuelW * (plane.fuel / 100), 12);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255, 233, 176, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(VIEW.width - 218, 78, fuelW, 12);
    if (lowFuel) {
      ctx.fillStyle = COLORS.hudRed;
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.fillText('LOW', VIEW.width - 60, 90);
    }
    // Bottom-left: throttle bar.
    this.panel(16, VIEW.height - 74, 220, 58);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText('THR', 30, VIEW.height - 44);
    ctx.fillStyle = 'rgba(255, 233, 176, 0.2)';
    ctx.fillRect(84, VIEW.height - 56, 130, 12);
    ctx.fillStyle = '#ffb02e';
    ctx.fillRect(84, VIEW.height - 56, 130 * plane.throttle, 12);
    ctx.strokeStyle = 'rgba(255, 233, 176, 0.5)';
    ctx.lineWidth = 1;
    for (let t = 1; t < 4; t += 1) ctx.strokeRect(84 + (130 * t) / 4, VIEW.height - 56, 1, 12);
    ctx.fillStyle = COLORS.hudText;
    ctx.fillText(`${Math.round(plane.throttle * 100)}%`, 84, VIEW.height - 28);
    // Bottom-right: objective.
    const next = world.nextRing();
    const objective = plane.landed
      ? 'MISSION COMPLETE'
      : next
        ? `NEXT: RING ${world.passedRings + 1}/6 — then land on RWY 27`
        : 'ALL RINGS DONE — LAND ON RWY 27';
    this.panel(VIEW.width - 420, VIEW.height - 74, 404, 58);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(objective, VIEW.width - 218, VIEW.height - 40);
    ctx.textAlign = 'left';
    // Warnings.
    if (plane.fuel > 0 && plane.fuel < 25 && !plane.landed && !plane.crashed) {
      this.flashText('LOW FUEL', VIEW.width / 2, 150, time, COLORS.hudRed);
    }
    if (plane.speed < 38 && plane.speed >= 30 && !plane.onGround && !plane.landed && !plane.crashed) {
      this.flashText('LOW SPEED — ADD POWER', VIEW.width / 2, 186, time, COLORS.hudAmber);
    }
    if (plane.speed < 30 && !plane.onGround && !plane.landed && !plane.crashed) {
      this.flashText('STALL — NOSE DOWN, ADD POWER', VIEW.width / 2, 186, time, COLORS.hudRed);
    }
  }

  drawCompass(plane) {
    const { ctx } = this;
    const cx = VIEW.width / 2;
    const w = 360;
    const h = 34;
    const x0 = cx - w / 2;
    this.panel(x0, 14, w, h);
    const hdg = ((plane.headingDeg() % 360) + 360) % 360;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + 4, 16, w - 8, h - 4);
    ctx.clip();
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 10) {
      const deg = Math.round((hdg + d) / 10) * 10;
      const off = (deg - hdg) * 3;
      const x = cx + off;
      const label = deg % 360 === 0 ? 'N' : deg % 360 === 90 ? 'E' : deg % 360 === 180 ? 'S' : deg % 360 === 270 ? 'W' : `${((deg % 360) + 360) % 360}`;
      const major = deg % 30 === 0;
      ctx.strokeStyle = 'rgba(255, 233, 176, 0.7)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 22);
      ctx.lineTo(x, major ? 32 : 28);
      ctx.stroke();
      // Labels too close to the panel's edge would clip: draw the tick only.
      if (major && x > x0 + 22 && x < x0 + w - 22) ctx.fillText(label, x, 44);
    }
    ctx.restore();
    // Centre caret.
    ctx.fillStyle = COLORS.hudAmber;
    ctx.beginPath();
    ctx.moveTo(cx - 6, 16);
    ctx.lineTo(cx + 6, 16);
    ctx.lineTo(cx, 24);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'left';
  }

  drawAttitude(x, y, r, plane) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#3a6ea8';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-plane.pitch);
    ctx.translate(0, plane.vy * 0.9);
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(-r, 0, r * 2, r * 2);
    ctx.fillStyle = '#3a6ea8';
    ctx.fillRect(-r, -r * 2, r * 2, r * 2);
    // Pitch ladder: short lines above and below the horizon.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.5;
    for (const off of [-16, 16]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, off);
      ctx.lineTo(r * 0.4, off);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.55, y);
    ctx.lineTo(x - r * 0.15, y);
    ctx.moveTo(x + r * 0.15, y);
    ctx.lineTo(x + r * 0.55, y);
    ctx.stroke();
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 233, 176, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  panel(x, y, w, h) {
    const { ctx } = this;
    ctx.fillStyle = COLORS.hudPanel;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 233, 176, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Subtle top edge highlight so the panel reads as glass, not a flat box.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 0.5);
    ctx.lineTo(x + w - 8, y + 0.5);
    ctx.stroke();
  }

  flashText(text, x, y, time, color) {
    if (Math.floor(time * 2.5) % 2 === 0) return;
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  drawCentreMessage(message, time) {
    const { ctx } = this;
    const isRing = message.text.startsWith('RING');
    ctx.fillStyle = isRing ? COLORS.ringCore : '#ffffff';
    ctx.font = isRing ? 'bold 40px "Courier New", monospace' : 'bold 34px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, message.age * 3);
    if (isRing) {
      ctx.shadowColor = 'rgba(255, 176, 46, 0.9)';
      ctx.shadowBlur = 18;
    }
    ctx.fillText(message.text, VIEW.width / 2, 250);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  drawTitleScreen(time) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(10, 14, 24, 0.45)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('RIDGE RUNNER', VIEW.width / 2, 215);
    ctx.fillStyle = '#ffffff';
    ctx.font = '26px Georgia, serif';
    ctx.fillText('A bush-plane courier run through the golden valley', VIEW.width / 2, 262);
    ctx.font = '18px "Courier New", monospace';
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText('Fly all 6 rings, then land on runway 27. Watch your fuel.', VIEW.width / 2, 314);
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px "Courier New", monospace';
    ctx.fillText('↑ ↓ pitch      ← → throttle      SPACE brake      A autopilot      P pause', VIEW.width / 2, 392);
    if (Math.floor(time * 1.4) % 2 === 0) {
      ctx.fillStyle = '#ffb02e';
      ctx.font = 'bold 24px "Courier New", monospace';
      ctx.fillText('— PRESS ENTER OR CLICK TO FLY —', VIEW.width / 2, 470);
    }
    ctx.textAlign = 'left';
  }

  drawPausedScreen() {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(10, 14, 24, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2);
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText('P to resume · R to restart', VIEW.width / 2, VIEW.height / 2 + 44);
    ctx.textAlign = 'left';
  }

  drawLandedScreen(plane, world) {
    const { ctx } = this;
    this.endPanel('MISSION COMPLETE', '#8be28b', [
      `Rings flown: ${world.passedRings} / ${world.rings.length}`,
      `Fuel left: ${Math.round(plane.fuel)} — worth ${Math.round(plane.fuel) * 5} points`,
      `Flight time: ${Math.round(plane.flightTime)} s`,
      `FINAL SCORE: ${plane.score}`,
      'Press R to fly again',
    ]);
  }

  drawCrashedScreen(plane) {
    const { ctx } = this;
    this.endPanel('CRASHED', '#ff6b5e', [
      `Cause: ${plane.crashReason}`,
      `Score: ${plane.score}`,
      'Press R to fly again',
    ]);
  }

  endPanel(title, color, lines) {
    const { ctx } = this;
    const w = 520;
    const h = 110 + lines.length * 34;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2 - 40;
    ctx.fillStyle = 'rgba(10, 14, 24, 0.82)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 38px Georgia, serif';
    ctx.fillText(title, VIEW.width / 2, y + 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = '19px "Courier New", monospace';
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW.width / 2, y + 104 + i * 34);
    });
    ctx.textAlign = 'left';
  }
}
