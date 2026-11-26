// Ridge Runner — tuning constants. One place for every number the rest of the
// game reads, so the feel can be tuned without hunting through the code.
export const VIEW = {
  width: 1280,
  height: 720,
  // How far ahead of the plane the camera looks, in pixels, at rest.
  lookAhead: 260,
};

export const WORLD = {
  // The valley is this long, in metres. Runway 1 sits at the start, runway 2 at the end.
  length: 10400,
  runway1: { x: 0, width: 700 },
  runway2: { x: 9400, width: 800 },
  // Base terrain height (metres above sea level) and the hills on top of it.
  baseHeight: 60,
  hillAmp: 150,
  // The river crossing, drawn as a blue band across the valley floor.
  river: { x: 4400, width: 260 },
  // The road that runs the valley floor, and the village beside runway 2.
  road: { x: 8600, width: 90 },
  village: { x: 8900, width: 420 },
};

export const MISSION = {
  // Six rings, each a (x, altitude) pair the pilot must fly through.
  // Spaced tighter than the first cut so a sortie runs about 150 s.
  rings: [
    { x: 1400, y: 320 },
    { x: 2600, y: 430 },
    { x: 3800, y: 300 },
    { x: 5000, y: 480 },
    { x: 6300, y: 340 },
    { x: 7700, y: 420 },
  ],
  ringRadius: 55,
  ringPoints: 100,
  landingPoints: 500,
  fuelBonusPerUnit: 5,
};

export const PLANE = {
  // Speeds in metres per second; altitudes in metres.
  cruiseSpeed: 70,
  maxSpeed: 105,
  stallSpeed: 30,
  // How fast the throttle lever moves, and how fast speed chases it.
  throttleRate: 0.9,
  accel: 22,
  drag: 0.35,
  // Pitch: how fast the nose moves, and how much climb a pitch angle buys.
  pitchRate: 1.5,
  maxPitch: 0.5,
  climbFactor: 42,
  // Pitching hard at speed bleeds energy; pitching at low speed barely answers.
  pitchBleed: 9,
  // Fuel: units, burned per second in proportion to throttle.
  fuelStart: 100,
  burnRate: 0.75,
  ringFuelBonus: 5,
  // Landing: touch down this gently, on a runway, and it counts.
  maxLandingSink: 7,
  maxLandingPitch: 0.28,
};

export const STEP = 1 / 60;

export const COLORS = {
  skyTop: '#232c52',
  skyMid: '#c85a3c',
  skyLow: '#f7c873',
  sun: '#ffd98a',
  sunCore: '#fff3c4',
  farMountain: '#6d6fa8',
  farSnow: '#e8e4f2',
  midMountain: '#4c6a58',
  nearHill: '#3d5c3a',
  fieldA: '#7fae62',
  fieldB: '#a8b45e',
  fieldC: '#5f9151',
  fieldD: '#c2a95e',
  hedge: '#33502e',
  road: '#8a7a5e',
  roadMark: '#f2ead8',
  river: '#5fa8c9',
  riverGlint: 'rgba(255, 244, 200, 0.55)',
  runway: '#5a5f6b',
  runwayMark: '#f2ead8',
  roofA: '#a44a35',
  roofB: '#7a5a3a',
  wallLit: '#f7e3b0',
  treeDark: '#2c4a2e',
  treeLight: '#4a7a3e',
  ring: '#ffb02e',
  ringGlow: 'rgba(255, 176, 46, 0.35)',
  ringCore: '#fff3d0',
  planeRed: '#c0392b',
  planeRedDark: '#8e2418',
  planeRedLight: '#e0654f',
  planeWhite: '#f4efe4',
  planeDark: '#2e2a26',
  hudPanel: 'rgba(12, 18, 28, 0.72)',
  hudText: '#ffe9b0',
  hudGreen: '#8be28b',
  hudRed: '#ff6b5e',
  hudAmber: '#ffb02e',
};
