// Side-view drag strip renderer (canvas 2D). Purely visual: it draws whatever the race simulation says.
// World units are metres along the strip; the camera follows the player's car.
import type { Units } from "../units";

/** Scene palette: the strip at dusk. Literal colours are correct here, like the 3D scene's palette. */
const P = {
  skyTop: "#0d1320",
  skyMid: "#283048",
  skyLow: "#c0603a",
  city: "#141a26",
  cityLit: "#f2c46a",
  field: "#161b1c",
  pole: "#2a2f38",
  lamp: "#ffe9b8",
  asphaltFar: "#2b2e33",
  asphaltNear: "#33363c",
  rubber: "#202226",
  lane: "#e8e2d0",
  wall: "#b9b6ae",
  wallShade: "#8c8a84",
  wallTop: "#d8d5cd",
  sponsor: ["#d9541a", "#1d1f24", "#e6c229", "#2b67b0"],
  rail: "#5d636b",
  tyre: "#121315",
  glass: "#1a2733",
  trim: "#121417",
  light: "#f6f2e6",
  tail: "#e0261a",
  ghost: "#7fe7ff",
};

export interface Kit {
  aero: "stock" | "lip" | "gt";
  wing: "ducktail" | "lip" | "gt" | "swan";
  body: "stock" | "overfender" | "widebody";
}

export interface CarDraw {
  x: number;
  kmh: number;
  accel: number;
  spin: number;
  pop: number;
  wheelAngle: number;
  paint: string;
  rim: string;
  tint: number;
  kit: Kit;
  ghost: boolean;
  /** Name tag drawn above the car (the rival's name and rating). */
  label?: string;
  rimStyle?: "five" | "mesh" | "dish" | "turbine";
  caliper?: string;
  stripe?: "none" | "twin" | "center" | "side";
  stripeColor?: string;
  /** 0 matte .. 1 pearl: strength of the paint's highlight. */
  gloss?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  lane: 0 | 1;
}

export interface RaceView {
  particles: Particle[];
  shake: number;
  lastT: number;
}

export function newRaceView(): RaceView {
  return { particles: [], shake: 0, lastT: 0 };
}

const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const FT = 0.3048;
/** Distance boards: (metres, label) for each unit system. */
function boards(distance: number, units: Units): [number, string][] {
  const out: [number, string][] = [];
  if (units === "imperial") {
    const marks: [number, string][] = [[60, "60'"], [330, "330'"], [660, "1/8"], [1000, "1000'"], [1320, "1/4"], [2640, "1/2"], [3960, "3/4"], [5280, "MILE"]];
    for (const [ft, label] of marks) if (ft * FT <= distance + 1) out.push([ft * FT, label]);
  } else {
    for (let m = 100; m <= distance + 1; m += 100) out.push([m, `${m} m`]);
    out.push([18.29, "18 m"]);
  }
  return out;
}

export function drawRace(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  view: RaceView,
  frame: { t: number; player: CarDraw; rival: CarDraw; distance: number; units: Units; dt: number },
) {
  const S = Math.max(20, Math.min(56, w / 21)); // px per metre: close on the cars, no grandstand
  const { player, rival, distance, dt } = frame;
  const camX = player.x - (w * 0.34) / S;
  view.shake = Math.max(0, view.shake - dt * 3);
  ctx.save();
  if (view.shake > 0.01) ctx.translate((hash(frame.t * 90) - 0.5) * view.shake * 10, (hash(frame.t * 77 + 3) - 0.5) * view.shake * 6);
  const sx = (x: number) => (x - camX) * S;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.6, P.skyMid);
  sky.addColorStop(1, P.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, w + 40, h * 0.5 + 20);

  // City skyline (far parallax)
  const horizon = h * 0.44;
  const cityOff = camX * S * 0.04;
  for (let i = Math.floor(cityOff / 46) - 1; i < Math.floor(cityOff / 46) + w / 46 + 2; i++) {
    const bx = i * 46 - cityOff;
    const bh = 30 + hash(i) * h * 0.16;
    ctx.fillStyle = P.city;
    ctx.fillRect(bx, horizon - bh, 40, bh);
    ctx.fillStyle = P.cityLit;
    for (let k = 0; k < 6; k++) if (hash(i * 13 + k) > 0.55) ctx.fillRect(bx + 6 + (k % 3) * 11, horizon - bh + 8 + Math.floor(k / 3) * 14, 4, 5);
  }

  // Infield between the skyline and the strip
  ctx.fillStyle = P.field;
  ctx.fillRect(-20, horizon, w + 40, h * 0.53 - horizon);

  // Light poles (near parallax)
  const poleOff = camX * S * 0.6;
  for (let i = Math.floor(poleOff / 180) - 1; i < Math.floor(poleOff / 180) + w / 180 + 2; i++) {
    const px = i * 180 - poleOff;
    ctx.fillStyle = P.pole;
    ctx.fillRect(px, h * 0.18, 4, h * 0.36);
    ctx.fillRect(px - 14, h * 0.18, 32, 4);
    const g = ctx.createRadialGradient(px + 2, h * 0.19, 0, px + 2, h * 0.19, 26);
    g.addColorStop(0, P.lamp);
    g.addColorStop(1, "rgba(255,233,184,0)");
    ctx.fillStyle = g;
    ctx.fillRect(px - 26, h * 0.19 - 26, 54, 54);
  }

  // Far lane (rival) asphalt
  const rivalGround = h * 0.66;
  const rS = S * 0.94;
  ctx.fillStyle = P.asphaltFar;
  ctx.fillRect(-20, h * 0.52, w + 40, h * 0.13);
  drawLaneMarks(ctx, sx, camX, w, S, h * 0.6, distance, 0.7);

  // Rival car (behind the wall)
  drawSmoke(ctx, view, sx, S, 1, rivalGround);
  drawCar(ctx, (rival.x - camX) * S, rivalGround, rS, rival);

  // Centre wall: hides the rival's wheels, like a real strip's concrete divider.
  // Low enough that the rival's whole body shows above it; only the tyres are hidden.
  const wallTop = rivalGround - rS * 0.4;
  const wallBot = h * 0.71;
  ctx.fillStyle = P.wallShade;
  ctx.fillRect(-20, wallTop, w + 40, wallBot - wallTop);
  ctx.fillStyle = P.wall;
  ctx.fillRect(-20, wallTop + 3, w + 40, (wallBot - wallTop) * 0.55);
  ctx.fillStyle = P.wallTop;
  ctx.fillRect(-20, wallTop, w + 40, 3);
  // sponsor panels and distance boards on the wall
  for (let i = Math.floor(camX / 24) - 1; i < Math.floor(camX / 24) + w / S / 24 + 2; i++) {
    const x0 = sx(i * 24);
    ctx.fillStyle = P.sponsor[((i % 4) + 4) % 4]!;
    ctx.fillRect(x0 + 6, wallTop + 6, S * 9, (wallBot - wallTop) * 0.4);
  }
  for (const [m, label] of boards(distance, frame.units)) {
    const bx = sx(m);
    if (bx < -80 || bx > w + 80) continue;
    const bw = Math.max(52, S * 1.9);
    const bh = Math.max(22, S * 0.62);
    ctx.fillStyle = P.trim;
    ctx.fillRect(bx - bw / 2, wallTop - bh - 4, bw, bh);
    ctx.fillStyle = P.lamp;
    ctx.font = `600 ${Math.round(Math.max(12, S * 0.36))}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, bx, wallTop - 4 - bh / 2);
    ctx.textBaseline = "alphabetic";
    ctx.fillRect(bx - 1, wallTop - 4, 2, 4);
  }

  // Rival name tag rides above the ghost so it is easy to track.
  if (rival.label) {
    const lx = (rival.x - camX) * S;
    if (lx > -S * 3 && lx < w + S * 3) drawTag(ctx, lx - rS * 0.3, rivalGround - rS * 1.75, rival.label, S);
  }

  // Near lane (player) asphalt with rubbered launch area
  const ground = h * 0.88;
  const lane = ctx.createLinearGradient(0, wallBot, 0, h);
  lane.addColorStop(0, P.asphaltFar);
  lane.addColorStop(1, P.asphaltNear);
  ctx.fillStyle = lane;
  ctx.fillRect(-20, wallBot, w + 40, h - wallBot);
  const rubberEnd = sx(80);
  if (rubberEnd > 0) {
    ctx.fillStyle = P.rubber;
    ctx.fillRect(Math.max(-20, sx(-10)), ground - S * 0.3, rubberEnd - Math.max(-20, sx(-10)), S * 0.5);
  }
  drawLaneMarks(ctx, sx, camX, w, S, ground + S * 0.5, distance, 1);

  // Start line and finish line across both lanes
  for (const [mx, kind] of [[0, "start"], [distance, "finish"]] as const) {
    const x = sx(mx);
    if (x < -60 || x > w + 60) continue;
    if (kind === "finish") {
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = k % 2 ? P.trim : P.lane;
        ctx.fillRect(x - 6, wallBot + k * ((h - wallBot) / 14), 6, (h - wallBot) / 14);
        ctx.fillStyle = k % 2 ? P.lane : P.trim;
        ctx.fillRect(x, wallBot + k * ((h - wallBot) / 14), 6, (h - wallBot) / 14);
      }
      ctx.fillStyle = P.lane;
      ctx.fillRect(x - 2, h * 0.52, 4, h * 0.1);
      ctx.fillStyle = P.trim;
      ctx.fillRect(x - 40, h * 0.1, 80, 24);
      ctx.fillStyle = P.lamp;
      ctx.font = `700 14px "Barlow Condensed", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("FINISH", x, h * 0.1 + 17);
      ctx.fillStyle = P.pole;
      ctx.fillRect(x - 42, h * 0.1, 3, h * 0.42);
      ctx.fillRect(x + 39, h * 0.1, 3, h * 0.42);
    } else {
      ctx.fillStyle = P.lane;
      ctx.fillRect(x - 2, wallBot, 3, h - wallBot);
      ctx.fillRect(x - 2, h * 0.53, 3, h * 0.1);
      // the tree on its pole
      ctx.fillStyle = P.pole;
      ctx.fillRect(x + S * 1.2, h * 0.3, 4, wallTop - h * 0.3);
      ctx.fillStyle = P.trim;
      ctx.fillRect(x + S * 1.2 - 8, h * 0.3, 20, 50);
    }
  }

  // Speed streaks
  if (player.kmh > 90) {
    const n = Math.min(14, Math.floor((player.kmh - 90) / 12));
    ctx.strokeStyle = "rgba(230,230,220,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const y = wallBot + hash(i + Math.floor(frame.t * 20)) * (h - wallBot);
      const x = hash(i * 3 + Math.floor(frame.t * 20)) * w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - player.kmh * 0.6, y);
      ctx.stroke();
    }
  }

  // Smoke behind the player, then the player's car
  emitSmoke(view, player, 0, dt);
  emitSmoke(view, rival, 1, dt);
  updateSmoke(view, dt);
  drawSmoke(ctx, view, sx, S, 0, ground);
  drawCar(ctx, sx(player.x), ground, S, player);

  // Foreground guard rail
  ctx.fillStyle = P.rail;
  ctx.fillRect(-20, h * 0.955, w + 40, 5);
  for (let i = Math.floor(camX / 4) - 1; i < Math.floor(camX / 4) + w / S / 4 + 2; i++) ctx.fillRect(sx(i * 4), h * 0.955, 3, h * 0.05);

  // Off-screen rival marker
  const rx = (rival.x - camX) * S;
  if (rx > w + 10 || rx < -S * 4) {
    const gap = Math.abs(rival.x - player.x);
    const ahead = rx > w;
    ctx.fillStyle = P.ghost;
    ctx.font = `600 13px "JetBrains Mono", monospace`;
    ctx.textAlign = ahead ? "right" : "left";
    const txt = `${ahead ? "" : "◀ "}RIVAL ${frame.units === "imperial" ? `${Math.round(gap / FT)} ft` : `${Math.round(gap)} m`}${ahead ? " ▶" : ""}`;
    ctx.fillText(txt, ahead ? w - 12 : 12, rivalGround - S * 1.6);
  }
  ctx.restore();
}

function drawLaneMarks(ctx: CanvasRenderingContext2D, sx: (x: number) => number, camX: number, w: number, S: number, y: number, distance: number, alpha: number) {
  ctx.fillStyle = `rgba(232,226,208,${0.35 * alpha})`;
  for (let i = Math.floor(camX / 10) - 1; i < Math.floor(camX / 10) + w / S / 10 + 2; i++) {
    const m = i * 10;
    if (m < -20 || m > distance + 200) continue;
    ctx.fillRect(sx(m), y, S * 3, 2);
  }
}

function emitSmoke(view: RaceView, car: CarDraw, lane: 0 | 1, dt: number) {
  if (car.spin < 0.05) return;
  const n = Math.min(6, Math.ceil(car.spin * 40 * dt * 10));
  for (let i = 0; i < n; i++) {
    view.particles.push({
      x: car.x - 1.33 + (Math.random() - 0.5) * 0.4,
      y: 0.1 + Math.random() * 0.2,
      vx: -1 - Math.random() * 3 + car.kmh / 3.6 * 0.15,
      vy: 0.4 + Math.random() * 0.9,
      life: 0,
      max: 1.2 + Math.random() * 1.4,
      size: 0.4 + Math.random() * 0.5,
      lane,
    });
  }
  if (view.particles.length > 260) view.particles.splice(0, view.particles.length - 260);
}

function updateSmoke(view: RaceView, dt: number) {
  for (const p of view.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-1.5 * dt);
    p.vy *= Math.exp(-0.8 * dt);
    p.size += dt * 1.6;
  }
  view.particles = view.particles.filter((p) => p.life < p.max);
}

function drawSmoke(ctx: CanvasRenderingContext2D, view: RaceView, sx: (x: number) => number, S: number, lane: 0 | 1, ground: number) {
  const scale = lane === 1 ? 0.94 : 1;
  for (const p of view.particles) {
    if (p.lane !== lane) continue;
    const a = 0.32 * (1 - p.life / p.max);
    const r = p.size * S * scale;
    const x = sx(p.x) * (lane === 1 ? 1 : 1);
    const y = ground - p.y * S * scale;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(215,215,210,${a})`);
    g.addColorStop(1, "rgba(215,215,210,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The AM-20 coupe in profile, facing right. Origin: car centre at ground level. */
function drawCar(ctx: CanvasRenderingContext2D, cx: number, ground: number, S: number, car: CarDraw) {
  const X = (m: number) => cx + m * S;
  const Y = (m: number) => ground - m * S;
  const wheelR = 0.33;
  const wheels = [1.33, -1.33];
  const pitch = Math.max(-0.035, Math.min(0.06, car.accel * 0.0065));
  ctx.save();

  // Body, pitched about the rear axle (launch squat lifts the nose)
  ctx.save();
  ctx.translate(X(-1.33), Y(wheelR));
  ctx.rotate(-pitch);
  ctx.translate(-X(-1.33), -Y(wheelR));
  if (car.ghost) {
    ctx.shadowColor = P.ghost;
    ctx.shadowBlur = Math.max(18, S * 0.6);
  }
  const flare = car.kit.body !== "stock";
  ctx.beginPath();
  ctx.moveTo(X(-2.1), Y(0.22));
  ctx.lineTo(X(-1.76), Y(0.22));
  ctx.arc(X(-1.33), Y(0.33), 0.42 * S, Math.PI, 0, false);
  ctx.lineTo(X(0.92), Y(0.22));
  ctx.arc(X(1.33), Y(0.33), 0.42 * S, Math.PI, 0, false);
  ctx.lineTo(X(2.06), Y(0.22));
  ctx.quadraticCurveTo(X(2.22), Y(0.26), X(2.22), Y(0.45));
  ctx.quadraticCurveTo(X(2.22), Y(0.72), X(2.06), Y(0.78));
  ctx.quadraticCurveTo(X(1.3), Y(0.93), X(0.62), Y(0.98));
  ctx.quadraticCurveTo(X(0.22), Y(1.22), X(-0.1), Y(1.3));
  ctx.quadraticCurveTo(X(-0.55), Y(1.36), X(-1.0), Y(1.3));
  ctx.quadraticCurveTo(X(-1.45), Y(1.16), X(-1.78), Y(0.99));
  ctx.quadraticCurveTo(X(-2.08), Y(0.99), X(-2.2), Y(0.9));
  ctx.lineTo(X(-2.23), Y(0.6));
  ctx.quadraticCurveTo(X(-2.24), Y(0.3), X(-2.1), Y(0.22));
  ctx.closePath();
  const body = ctx.createLinearGradient(0, Y(1.35), 0, Y(0.2));
  body.addColorStop(0, shade(car.paint, 1.35));
  body.addColorStop(0.45, car.paint);
  body.addColorStop(1, shade(car.paint, 0.55));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.shadowBlur = 0;
  if (car.stripe && car.stripe !== "none" && car.stripeColor) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = car.stripeColor;
    if (car.stripe === "side") ctx.fillRect(X(-2.3), Y(0.6), 4.6 * S, 0.09 * S);
    else {
      const band = car.stripe === "twin" ? 0.07 : 0.11;
      ctx.fillRect(X(0.55), Y(1.0), 1.8 * S, band * S);
      ctx.fillRect(X(-1.1), Y(1.42), 1.5 * S, band * 1.6 * S);
      ctx.fillRect(X(-2.3), Y(1.02), 0.55 * S, band * S);
    }
    ctx.restore();
  }
  if (car.ghost) {
    ctx.strokeStyle = P.ghost;
    ctx.lineWidth = Math.max(2, S * 0.07);
    ctx.stroke();
  }
  // windows
  ctx.beginPath();
  ctx.moveTo(X(0.5), Y(0.99));
  ctx.quadraticCurveTo(X(0.18), Y(1.2), X(-0.1), Y(1.26));
  ctx.quadraticCurveTo(X(-0.55), Y(1.31), X(-0.98), Y(1.26));
  ctx.quadraticCurveTo(X(-1.4), Y(1.14), X(-1.66), Y(1.0));
  ctx.closePath();
  ctx.fillStyle = mix(P.glass, "#04060a", car.tint);
  ctx.fill();
  ctx.fillStyle = P.trim;
  ctx.fillRect(X(-0.58), Y(1.28), 0.07 * S, 0.3 * S);
  // shoulder highlight
  ctx.strokeStyle = `rgba(255,255,255,${0.06 + 0.26 * (car.gloss ?? 0.6)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(X(1.9), Y(0.8));
  ctx.quadraticCurveTo(X(0), Y(0.86), X(-2.0), Y(0.86));
  ctx.stroke();
  // door shut line, handle, skirt
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.moveTo(X(0.5), Y(0.95));
  ctx.lineTo(X(0.45), Y(0.27));
  ctx.moveTo(X(-0.66), Y(0.96));
  ctx.lineTo(X(-0.66), Y(0.27));
  ctx.stroke();
  ctx.fillStyle = P.trim;
  ctx.fillRect(X(-0.55), Y(0.85), 0.14 * S, 0.03 * S);
  ctx.fillRect(X(-0.9), Y(0.25), 1.8 * S, 0.06 * S);
  // lights
  ctx.fillStyle = P.light;
  ctx.fillRect(X(2.0), Y(0.72), 0.2 * S, 0.06 * S);
  ctx.fillStyle = P.tail;
  ctx.fillRect(X(-2.23), Y(0.82), 0.06 * S, 0.08 * S);

  // Aero kit
  ctx.fillStyle = P.trim;
  if (car.kit.aero === "lip" || car.kit.aero === "gt") {
    ctx.fillRect(X(1.85), Y(0.22), (car.kit.aero === "gt" ? 0.55 : 0.42) * S, 0.035 * S);
    ctx.fillRect(X(-0.95), Y(0.2), 1.9 * S, 0.05 * S);
  }
  if (car.kit.aero === "gt") {
    ctx.beginPath();
    ctx.moveTo(X(2.05), Y(0.5));
    ctx.lineTo(X(2.3), Y(0.47));
    ctx.lineTo(X(2.1), Y(0.44));
    ctx.fill();
    for (let k = 0; k < 4; k++) ctx.fillRect(X(-2.25 + k * 0.06), Y(0.3), 0.025 * S, 0.12 * S);
  }
  // Rear wing
  if (car.kit.wing === "ducktail") {
    ctx.fillStyle = car.paint;
    ctx.beginPath();
    ctx.moveTo(X(-1.9), Y(0.99));
    ctx.lineTo(X(-2.2), Y(1.02));
    ctx.lineTo(X(-2.18), Y(0.93));
    ctx.fill();
  } else if (car.kit.wing === "lip") {
    ctx.fillStyle = P.trim;
    ctx.beginPath();
    ctx.moveTo(X(-1.95), Y(0.97));
    ctx.lineTo(X(-2.24), Y(1.0));
    ctx.lineTo(X(-2.2), Y(0.93));
    ctx.fill();
  } else {
    const swan = car.kit.wing === "swan";
    const wy = swan ? 1.32 : 1.22;
    ctx.fillStyle = P.trim;
    // uprights
    if (swan) {
      ctx.lineWidth = 0.05 * S;
      ctx.strokeStyle = P.trim;
      ctx.beginPath();
      ctx.moveTo(X(-1.9), Y(0.98));
      ctx.quadraticCurveTo(X(-1.85), Y(1.25), X(-2.0), Y(wy + 0.03));
      ctx.stroke();
    } else {
      ctx.fillRect(X(-2.02), Y(wy), 0.05 * S, (wy - 0.95) * S);
    }
    // main plane + flap + endplate
    ctx.beginPath();
    ctx.moveTo(X(-1.78), Y(wy + 0.02));
    ctx.quadraticCurveTo(X(-1.95), Y(wy + 0.07), X(-2.28), Y(wy + 0.03));
    ctx.lineTo(X(-2.28), Y(wy - 0.01));
    ctx.quadraticCurveTo(X(-2.0), Y(wy), X(-1.78), Y(wy + 0.02));
    ctx.fill();
    ctx.fillRect(X(-2.3), Y(wy + 0.12), 0.05 * S, 0.2 * S);
  }
  ctx.restore();

  // Fender flares follow the wheels, not the pitched body
  if (flare) {
    ctx.fillStyle = car.kit.body === "widebody" ? shade(car.paint, 0.85) : P.trim;
    for (const wx of wheels) {
      ctx.beginPath();
      ctx.arc(X(wx), Y(0.33), (0.5 + (car.kit.body === "widebody" ? 0.03 : 0)) * S, Math.PI * 1.05, Math.PI * 1.95, false);
      ctx.arc(X(wx), Y(0.33), 0.43 * S, Math.PI * 1.95, Math.PI * 1.05, true);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Wheels
  for (const wx of wheels) {
    const x = X(wx);
    const y = Y(wheelR);
    ctx.fillStyle = P.tyre;
    ctx.beginPath();
    ctx.arc(x, y, wheelR * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(car.rim, 0.5);
    ctx.beginPath();
    ctx.arc(x, y, wheelR * S * 0.68, 0, Math.PI * 2);
    ctx.fill();
    const blur = Math.min(1, car.kmh / 60);
    if (car.caliper) {
      ctx.fillStyle = car.caliper;
      ctx.beginPath();
      ctx.arc(x, y, wheelR * S * 0.5, wx > 0 ? -2.4 : -0.75, wx > 0 ? -1.4 : 0.25);
      ctx.lineTo(x, y);
      ctx.fill();
    }
    const style = car.rimStyle ?? "five";
    const spokes = style === "mesh" ? 10 : style === "dish" ? 6 : style === "turbine" ? 9 : 5;
    ctx.strokeStyle = car.rim;
    ctx.lineWidth = Math.max(1.2, S * (style === "mesh" ? 0.025 : style === "turbine" ? 0.035 : 0.05));
    ctx.globalAlpha = 1 - blur * 0.7;
    if (style === "dish") {
      ctx.beginPath();
      ctx.arc(x, y, wheelR * S * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let k = 0; k < spokes; k++) {
      const a = car.wheelAngle + (k / spokes) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * S * 0.05, y + Math.sin(a) * S * 0.05);
      ctx.lineTo(x + Math.cos(a) * wheelR * S * 0.66, y + Math.sin(a) * wheelR * S * 0.66);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (blur > 0.3) {
      ctx.fillStyle = `rgba(200,205,210,${blur * 0.25})`;
      ctx.beginPath();
      ctx.arc(x, y, wheelR * S * 0.66, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = car.rim;
    ctx.beginPath();
    ctx.arc(x, y, S * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  // Exhaust flames on pops (shifts, limiter)
  if (car.pop > 0.05) {
    const f = car.pop * (0.6 + 0.4 * Math.sin(performance.now() / 18));
    const x = X(-2.26);
    const y = Y(0.27);
    const len = (0.35 + f * 0.6) * S;
    const g = ctx.createRadialGradient(x, y, 0, x, y, len * 1.4);
    g.addColorStop(0, `rgba(255,220,140,${0.5 * f})`);
    g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - len * 1.4, y - len * 1.4, len * 2.8, len * 2.8);
    ctx.fillStyle = `rgba(255,140,40,${0.85 * f})`;
    ctx.beginPath();
    ctx.moveTo(x, y - S * 0.06);
    ctx.quadraticCurveTo(x - len * 0.6, y - S * 0.1, x - len, y);
    ctx.quadraticCurveTo(x - len * 0.6, y + S * 0.1, x, y + S * 0.06);
    ctx.fill();
    ctx.fillStyle = `rgba(150,190,255,${0.8 * f})`;
    ctx.beginPath();
    ctx.ellipse(x - S * 0.06, y, S * 0.08, S * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Rounded name tag with a pointer down to the car. */
function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, S: number) {
  ctx.save();
  ctx.font = `600 ${Math.round(Math.max(11, S * 0.3))}px "JetBrains Mono", monospace`;
  const tw = ctx.measureText(text).width + 16;
  const th = Math.max(18, S * 0.48);
  ctx.fillStyle = "rgba(8,20,26,0.82)";
  ctx.strokeStyle = P.ghost;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - tw / 2, y - th, tw, th, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 5, y);
  ctx.lineTo(x + 5, y);
  ctx.lineTo(x, y + 6);
  ctx.closePath();
  ctx.fillStyle = P.ghost;
  ctx.fill();
  ctx.fillStyle = P.ghost;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - th / 2 + 1);
  ctx.restore();
}
