// Origami train diorama — shared scene builder.
// Used by the browser preview (index.html) and the GLB exporter (export-glb.mjs).
// Every mesh is faceted (non-indexed, flat normals) so the folded-paper look
// survives import into Spline.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PAPER = new THREE.Color(0xf4f3ef);
const matCache = new Map();

// shade: 0 = bright paper, 1 = darkest crease paper
export function paper(shade = 0, map = null) {
  const key = shade + (map ? ':m' : '');
  if (!matCache.has(key)) {
    const color = PAPER.clone().multiplyScalar(1 - shade * 0.14);
    matCache.set(key, new THREE.MeshStandardMaterial({
      name: `Paper_${Math.round(shade * 100)}`,
      color, map, roughness: 0.93, metalness: 0, flatShading: true, side: THREE.DoubleSide,
    }));
  }
  return matCache.get(key);
}

function facet(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

let paperMap = null;
function mesh(name, geo, shade, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(facet(geo), paper(shade, paperMap));
  m.name = name;
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Box whose six faces are each folded into four triangles meeting at a
// slightly recessed centre — the "X" crease of folded paper.
function foldedBox(w, h, d, inset = 0.05) {
  const half = new THREE.Vector3(w / 2, h / 2, d / 2);
  const faces = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ];
  const pos = [];
  for (const [n, u, v] of faces) {
    const N = new THREE.Vector3(...n), U = new THREE.Vector3(...u), V = new THREE.Vector3(...v);
    const c = N.clone().multiply(half);
    const su = Math.abs(U.dot(half)), sv = Math.abs(V.dot(half));
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) =>
      c.clone().addScaledVector(U, a * su).addScaledVector(V, b * sv));
    const center = c.clone().addScaledVector(N, -inset);
    for (let i = 0; i < 4; i++) {
      const p0 = corners[i], p1 = corners[(i + 1) % 4];
      pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, center.x, center.y, center.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

const cylX = (rt, rb, len, seg = 10) => new THREE.CylinderGeometry(rt, rb, len, seg).rotateZ(Math.PI / 2);
const cylZ = (r, len, seg = 14) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);

// Flat panel (in XY plane, thickness along Z) with rectangular window holes.
function panel(w, h, t, holes = []) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
  for (const [cx, cy, hw, hh] of holes) {
    const p = new THREE.Path();
    p.moveTo(cx - hw / 2, cy - hh / 2); p.lineTo(cx - hw / 2, cy + hh / 2);
    p.lineTo(cx + hw / 2, cy + hh / 2); p.lineTo(cx + hw / 2, cy - hh / 2); p.closePath();
    s.holes.push(p);
  }
  return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2);
}

function wheel(name, r, parent, x, y, z, side) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  const t = 0.09;
  mesh('Disc', cylZ(r * 0.86, t * 0.6, 14), 0.35, g);
  mesh('Tyre', new THREE.TorusGeometry(r * 0.92, r * 0.09, 4, 16), 0.05, g, 0, 0, 0);
  mesh('Flange', cylZ(r, t * 0.4, 16), 0.15, g, 0, 0, -side * t * 0.45);
  const spokes = r > 0.3 ? 10 : 6;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const s = mesh('Spoke', new THREE.BoxGeometry(r * 0.78, 0.045, 0.05), 0, g,
      Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, side * t * 0.3);
    s.rotation.z = a;
  }
  mesh('Hub', cylZ(r * 0.2, t * 1.4, 8), 0, g, 0, 0, side * t * 0.3);
  if (r > 0.3) { // counterweight fold
    const cw = mesh('Counterweight', new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.06, 6, 1, false, 0, Math.PI * 0.6).rotateX(Math.PI / 2), 0.1, g, 0, 0, side * t * 0.4);
    cw.rotation.z = Math.PI * 0.95;
  }
  return g;
}

function ladder(name, parent, x, z, y0, y1) {
  const g = new THREE.Group();
  g.name = name;
  parent.add(g);
  const h = y1 - y0;
  for (const dx of [-0.13, 0.13]) mesh('Rail', new THREE.BoxGeometry(0.04, h, 0.04), 0.05, g, x + dx, y0 + h / 2, z);
  for (let y = y0 + 0.12; y < y1 - 0.05; y += 0.17) mesh('Rung', cylX(0.016, 0.016, 0.26, 6), 0.1, g, x, y, z);
  return g;
}

function buildLocomotive(train) {
  const loco = new THREE.Group();
  loco.name = 'Locomotive';
  train.add(loco);

  // Chassis and running board
  mesh('RunningBoard', foldedBox(4.35, 0.1, 1.42, 0.02), 0.08, loco, -1.0, 0.78, 0);
  mesh('Frame', foldedBox(4.2, 0.32, 0.78, 0.03), 0.3, loco, -1.0, 0.55, 0);
  mesh('BufferBeam', foldedBox(0.16, 0.3, 1.5, 0.03), 0.05, loco, -3.2, 0.68, 0);

  // Cowcatcher: a folded wedge with slats
  const pilotShape = new THREE.Shape([new THREE.Vector2(0, 0.5), new THREE.Vector2(0, 0.06), new THREE.Vector2(-0.5, 0.06)]);
  mesh('Pilot', new THREE.ExtrudeGeometry(pilotShape, { depth: 1.2, bevelEnabled: false }).translate(-3.28, 0, -0.6), 0.12, loco);
  for (let i = -2; i <= 2; i++) {
    const slat = mesh('PilotSlat', new THREE.BoxGeometry(0.66, 0.035, 0.04), 0, loco, -3.52, 0.3, i * 0.24);
    slat.rotation.z = -Math.atan2(0.44, 0.5);
  }

  // Boiler with paper bands
  mesh('Boiler', cylX(0.5, 0.5, 2.35, 10), 0, loco, -1.72, 1.32, 0);
  for (const bx of [-2.6, -1.95, -1.25, -0.6]) mesh('BoilerBand', cylX(0.52, 0.52, 0.05, 10), 0.18, loco, bx, 1.32, 0);
  mesh('Smokebox', cylX(0.55, 0.55, 0.55, 12), 0.04, loco, -3.0, 1.32, 0);
  // Concentric folded rings on the smokebox door (reads strongly from the front)
  [[0.5, 0.2], [0.38, 0.0], [0.26, 0.22], [0.13, 0.0]].forEach(([r, s], i) =>
    mesh('SmokeboxDoorRing', cylX(r, r, 0.05, 12), s, loco, -3.3 - i * 0.04, 1.32, 0));
  mesh('Headlamp', foldedBox(0.22, 0.2, 0.22, 0.02), 0.05, loco, -3.12, 1.98, 0);

  // Faceted diamond smokestack
  mesh('StackBase', new THREE.CylinderGeometry(0.15, 0.18, 0.3, 8), 0.05, loco, -2.95, 1.97, 0);
  mesh('StackFlare', new THREE.CylinderGeometry(0.27, 0.14, 0.38, 8), 0, loco, -2.95, 2.3, 0);
  mesh('StackCrown', new THREE.CylinderGeometry(0.2, 0.29, 0.14, 8), 0.12, loco, -2.95, 2.56, 0);

  // Domes
  mesh('SteamDome', new THREE.CylinderGeometry(0.22, 0.27, 0.32, 8), 0.02, loco, -1.55, 1.92, 0);
  mesh('SteamDomeCap', new THREE.SphereGeometry(0.22, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), 0.08, loco, -1.55, 2.08, 0);
  mesh('SandDome', new THREE.CylinderGeometry(0.16, 0.21, 0.24, 8), 0.02, loco, -2.3, 1.88, 0);
  mesh('SandDomeCap', new THREE.SphereGeometry(0.16, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), 0.08, loco, -2.3, 2.0, 0);
  mesh('Whistle', new THREE.CylinderGeometry(0.04, 0.05, 0.22, 6), 0.1, loco, -0.4, 1.92, 0);

  // Steam cylinders and handrails
  for (const s of [-1, 1]) {
    mesh('SteamCylinder', cylX(0.2, 0.2, 0.7, 8), 0.06, loco, -2.75, 0.7, s * 0.62);
    mesh('Handrail', cylX(0.018, 0.018, 2.3, 6), 0.25, loco, -1.75, 1.55, s * 0.56);
    mesh('SideTank', foldedBox(1.3, 0.12, 0.08, 0.02), 0.12, loco, -1.4, 0.9, s * 0.72);
  }

  // Cab — hollow, so the control station is visible through the windows
  const cab = new THREE.Group();
  cab.name = 'Cab';
  cab.position.set(0.6, 0, 0);
  loco.add(cab);
  for (const s of [-1, 1]) {
    const wall = mesh('CabSideWall', panel(1.3, 1.5, 0.06, [[-0.2, 0.25, 0.55, 0.5]]), 0, cab, 0, 1.58, s * 0.66);
    wall.rotation.y = s > 0 ? 0 : Math.PI;
    mesh('WindowSill', new THREE.BoxGeometry(0.62, 0.04, 0.1), 0.15, cab, -0.2, 1.56, s * 0.66);
    ladder(s > 0 ? 'Ladder_Right' : 'Ladder_Left', cab, 0.42, s * 0.76, 0.3, 2.2);
    for (const y of [0.55, 2.0]) mesh('LadderStandoff', new THREE.BoxGeometry(0.04, 0.04, 0.12), 0.2, cab, 0.42, y, s * 0.71);
  }
  const front = mesh('CabFrontWall', panel(1.38, 1.5, 0.06, [[-0.38, 0.32, 0.32, 0.36], [0.38, 0.32, 0.32, 0.36]]), 0.04, cab, -0.65, 1.58, 0);
  front.rotation.y = Math.PI / 2;
  const back = mesh('CabBackWall', panel(1.38, 0.55, 0.06), 0.06, cab, 0.65, 1.1, 0);
  back.rotation.y = Math.PI / 2;
  for (const s of [-1, 1]) {
    const roof = mesh('CabRoof', foldedBox(1.6, 0.06, 0.84, 0.015), 0, cab, 0.02, 2.4 - 0.05, s * 0.4);
    roof.rotation.x = s * -0.13;
  }
  mesh('CabFloor', foldedBox(1.3, 0.06, 1.3, 0.01), 0.3, cab, 0, 0.86, 0);

  // Control station
  const ctrl = new THREE.Group();
  ctrl.name = 'ControlStation';
  cab.add(ctrl);
  mesh('Backhead', foldedBox(0.12, 0.95, 0.95, 0.02), 0.2, ctrl, -0.55, 1.36, 0);
  mesh('FireboxDoor', foldedBox(0.06, 0.24, 0.3, 0.02), 0.45, ctrl, -0.48, 1.1, 0);
  for (const [gz, gy] of [[-0.24, 1.72], [0.0, 1.78], [0.24, 1.72]]) {
    mesh('Gauge', cylX(0.08, 0.08, 0.04, 10), 0.0, ctrl, -0.47, gy, gz);
    mesh('GaugeFace', cylX(0.06, 0.06, 0.01, 10), 0.4, ctrl, -0.445, gy, gz);
  }
  const lever = mesh('ThrottleLever', cylX(0.025, 0.025, 0.42, 6), 0.1, ctrl, -0.3, 1.52, 0.18);
  lever.rotation.z = -0.5;
  mesh('ThrottleKnob', new THREE.IcosahedronGeometry(0.045, 0), 0.25, ctrl, -0.12, 1.42, 0.18);
  const reverser = mesh('ReverserLever', new THREE.CylinderGeometry(0.022, 0.022, 0.6, 6), 0.1, ctrl, -0.2, 1.2, -0.42);
  reverser.rotation.z = 0.35;
  mesh('ReverserKnob', new THREE.IcosahedronGeometry(0.045, 0), 0.25, ctrl, -0.3, 1.48, -0.42);
  mesh('BrakeValve', cylX(0.05, 0.07, 0.12, 8), 0.3, ctrl, -0.45, 1.5, -0.3);
  mesh('EngineerSeat', foldedBox(0.32, 0.12, 0.32, 0.02), 0.2, ctrl, 0.15, 1.3, 0.42);
  mesh('SeatPost', new THREE.BoxGeometry(0.06, 0.4, 0.06), 0.3, ctrl, 0.15, 1.08, 0.42);

  // Wheels: leading, three drivers, trailing
  const wheels = [];
  for (const s of [-1, 1]) {
    wheels.push(wheel('LeadingWheel', 0.26, loco, -2.75, 0.26, s * 0.6, s));
    for (const [i, x] of [-1.9, -0.95, 0.0].entries()) wheels.push(wheel(`DriverWheel_${i + 1}`, 0.44, loco, x, 0.44, s * 0.62, s));
    wheels.push(wheel('TrailingWheel', 0.28, loco, 0.95, 0.28, s * 0.6, s));
    const rod = mesh('CouplingRod', foldedBox(2.1, 0.07, 0.04, 0.01), 0.05, loco, -0.95, 0.44 - 0.2, s * 0.75);
    rod.userData.side = s;
    const main = mesh('MainRod', foldedBox(1.6, 0.07, 0.04, 0.01), 0.1, loco, -1.95, 0.5, s * 0.8);
    main.rotation.z = 0.15;
  }
  return { loco, wheels };
}

function buildWagon(name, train, x, coal) {
  const w = new THREE.Group();
  w.name = name;
  w.position.x = x;
  train.add(w);
  mesh('Underframe', foldedBox(1.55, 0.14, 1.1, 0.02), 0.3, w, 0, 0.58, 0);
  mesh('Body', foldedBox(1.45, 0.95, 1.3, 0.07), 0, w, 0, 1.15, 0);
  mesh('TopRim', foldedBox(1.5, 0.06, 1.35, 0.01), 0.1, w, 0, 1.64, 0);
  if (coal) {
    const pile = mesh('CoalLoad', new THREE.ConeGeometry(0.62, 0.3, 4).rotateY(Math.PI / 4).scale(1.05, 1, 0.92), 0.25, w, 0, 1.75, 0);
    pile.scale.x = 1.2;
  }
  const wheels = [];
  for (const s of [-1, 1]) {
    for (const wx of [-0.42, 0.42]) wheels.push(wheel('WagonWheel', 0.26, w, wx, 0.26, s * 0.6, s));
    mesh('AxleBox', foldedBox(1.2, 0.12, 0.06, 0.01), 0.15, w, 0, 0.42, s * 0.7);
  }
  for (const cx of [-0.83, 0.83]) mesh('Coupler', foldedBox(0.14, 0.1, 0.18, 0.01), 0.25, w, cx, 0.6, 0);
  return wheels;
}

function buildTrack(length = 44) {
  const track = new THREE.Group();
  track.name = 'Track';
  const rails = [], ties = [];
  for (const s of [-1, 1]) rails.push(facet(new THREE.BoxGeometry(length, 0.08, 0.07).translate(0, -0.04, s * 0.6)));
  for (let x = -length / 2 + 0.25; x < length / 2; x += 0.5) ties.push(facet(new THREE.BoxGeometry(0.22, 0.07, 1.7).translate(x, -0.115, 0)));
  const r = new THREE.Mesh(mergeGeometries(rails), paper(0.12, paperMap));
  r.name = 'Rails';
  const t = new THREE.Mesh(mergeGeometries(ties), paper(0.05, paperMap));
  t.name = 'Sleepers';
  for (const m of [r, t]) { m.castShadow = m.receiveShadow = true; track.add(m); }
  return track;
}

// Deterministic random so the landscape is identical in preview and GLB.
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

function mountain(name, parent, x, z, r, h, rand) {
  const geo = new THREE.ConeGeometry(r, h, 5 + Math.floor(rand() * 2), 1);
  const p = geo.attributes.position;
  const ox = (rand() - 0.5) * r * 0.5, oz = (rand() - 0.5) * r * 0.5;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, ox, p.getY(i), oz);
  const m = mesh(name, geo, 0, parent, x, h / 2 - 0.17, z);
  m.rotation.y = rand() * Math.PI;
  return m;
}

function pineTree(name, parent, x, z, s, rand) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, -0.17, z);
  g.scale.setScalar(s);
  g.rotation.y = rand() * Math.PI;
  parent.add(g);
  mesh('Trunk', new THREE.CylinderGeometry(0.07, 0.09, 0.5, 5), 0.25, g, 0, 0.25, 0);
  [[0.7, 0.9, 0.75], [0.55, 0.8, 1.25], [0.38, 0.7, 1.7]].forEach(([r, h, y]) =>
    mesh('Tier', new THREE.ConeGeometry(r, h, 6), 0, g, 0, y, 0));
  return g;
}

function roundTree(name, parent, x, z, s, rand) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, -0.17, z);
  g.scale.setScalar(s);
  g.rotation.y = rand() * Math.PI;
  parent.add(g);
  mesh('Trunk', new THREE.CylinderGeometry(0.08, 0.11, 0.9, 5), 0.25, g, 0, 0.45, 0);
  mesh('Crown', new THREE.IcosahedronGeometry(0.7, 0), 0, g, 0, 1.35, 0);
  mesh('CrownTop', new THREE.IcosahedronGeometry(0.45, 0), 0.04, g, 0.2, 1.85, 0.1);
  return g;
}

function station(parent) {
  const g = new THREE.Group();
  g.name = 'Station';
  g.position.set(-0.6, -0.17, -2.65);
  parent.add(g);
  mesh('Platform', foldedBox(3.6, 0.36, 1.7, 0.03), 0.02, g, 0, 0.18, 0);
  mesh('PlatformEdge', foldedBox(3.6, 0.05, 0.12, 0.01), 0.15, g, 0, 0.38, 0.8);
  for (const px of [-1.3, 1.3]) {
    mesh('Post', new THREE.BoxGeometry(0.1, 2.2, 0.1), 0.05, g, px, 1.46, -0.55);
    mesh('Post', new THREE.BoxGeometry(0.1, 1.85, 0.1), 0.05, g, px, 1.28, 0.6);
  }
  const roof = mesh('Canopy', foldedBox(3.9, 0.07, 1.7, 0.02), 0, g, 0, 2.38, 0.05);
  roof.rotation.x = 0.22;
  mesh('CanopyBeam', new THREE.BoxGeometry(3.0, 0.08, 0.08), 0.15, g, 0, 2.2, 0.6);
  mesh('Bench', foldedBox(0.9, 0.08, 0.32, 0.01), 0.08, g, 0.3, 0.68, -0.4);
  for (const bx of [-0.08, 0.68]) mesh('BenchLeg', new THREE.BoxGeometry(0.06, 0.3, 0.28), 0.2, g, bx, 0.5, -0.4);
  mesh('SignBoard', foldedBox(0.9, 0.32, 0.05, 0.01), 0, g, -0.9, 1.75, 0.6);
  mesh('Lamp', new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), 0.2, g, 1.6, 1.06, 0.5);
  mesh('LampHead', new THREE.OctahedronGeometry(0.12, 0), 0, g, 1.6, 1.82, 0.5);
  return g;
}

/**
 * Builds the full diorama.
 * @returns {{ root, train, track, landscape, wheels, rods, stackTop, popItems }}
 */
export function buildScene({ texture = null } = {}) {
  paperMap = texture;
  matCache.clear();
  const root = new THREE.Group();
  root.name = 'OrigamiTrainDiorama';

  const diorama = new THREE.Group(); // train + track — the floating hero
  diorama.name = 'Hero';
  root.add(diorama);

  const train = new THREE.Group();
  train.name = 'Train';
  diorama.add(train);
  const { wheels: locoWheels } = buildLocomotive(train);
  const wheels = [...locoWheels,
    ...buildWagon('Tender', train, 2.0, true),
    ...buildWagon('Wagon', train, 3.75, false)];
  train.position.x = -0.35; // centre the ~8.4-unit train
  const rods = [];
  train.traverse(o => { if (o.name === 'CouplingRod') rods.push(o); });

  const track = buildTrack();
  diorama.add(track);

  // Landscape (shown in the station shot)
  const landscape = new THREE.Group();
  landscape.name = 'Landscape';
  root.add(landscape);
  const rand = rng(7);
  const popItems = [];
  const add = o => { popItems.push(o); return o; };

  add(station(landscape));
  [[10, -7, 3.2, 5.2], [13, -2.5, 2.6, 4.2], [8, -11, 2.5, 3.6], [12, 4.5, 3.4, 5.6],
   [9, 9, 2.6, 3.8], [15, 0.8, 2.2, 3.4], [5, -6.5, 1.6, 2.4], [5.5, 6.8, 1.8, 2.6],
   [2.2, 8.5, 1.4, 1.9], [-2, -6.2, 1.1, 1.5], [17, -6, 3.4, 4.8], [17, 9, 3.2, 4.6]]
    .forEach(([x, z, r, h], i) => add(mountain(`Mountain_${i + 1}`, landscape, x, z, r, h, rand)));
  [[-3.2, -4.2, 1.1], [-1.5, -5, 1.4], [3.0, -3.6, 1.3], [4.2, -4.5, 1.0], [6.5, -3.2, 1.2],
   [1.5, 3.4, 1.2], [4.5, 2.6, 1.0], [5.8, 3.6, 1.4], [7.4, 2.8, 1.1], [-2.6, 3.2, 1.0], [9.2, -4.2, 1.5]]
    .forEach(([x, z, s], i) => add(pineTree(`PineTree_${i + 1}`, landscape, x, z, s, rand)));
  [[2.6, 4.6, 1.2], [3.6, 3.0, 0.9], [6.8, 5.2, 1.0]]
    .forEach(([x, z, s], i) => add(roundTree(`RoundTree_${i + 1}`, landscape, x, z, s, rand)));
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1;
    const r = mesh(`Rock_${i + 1}`, new THREE.TetrahedronGeometry(0.25 + rand() * 0.3, 0), 0.04, landscape,
      -3 + rand() * 9, -0.1, side * (1.6 + rand() * 2.4));
    r.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    add(r);
  }
  const cloud = new THREE.Group();
  cloud.name = 'Cloud';
  cloud.position.set(8, 5.6, 4.2);
  landscape.add(cloud);
  mesh('CloudBody', new THREE.IcosahedronGeometry(0.9, 0).scale(1.6, 0.55, 0.9), 0, cloud);
  mesh('CloudPuff', new THREE.IcosahedronGeometry(0.6, 0).scale(1.2, 0.6, 0.8), 0.03, cloud, 0.7, 0.25, 0.1);
  add(cloud);

  const stackTop = new THREE.Vector3(-2.95 - 0.35, 2.65, 0);
  return { root, diorama, train, track, landscape, wheels, rods, stackTop, popItems };
}
