// ---------------------------------------------------------------------------
// Models: buildings, trees, vehicles, ships and props, built from boxes,
// roofs and blobs. Tile models span 0..16 in X/Y; the front faces +Y.
// Multi-tile models span w*16 x h*16 with their pivot at the centre.
// ---------------------------------------------------------------------------
Model.prototype.prism = function (outline, z0, z1, side, top) {
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const p = outline[i], q = outline[(i + 1) % n];
    const ux = q[0] - p[0], uy = q[1] - p[1], l = Math.hypot(ux, uy) || 1;
    this.poly([[q[0], q[1], z0], [p[0], p[1], z0], [p[0], p[1], z1], [q[0], q[1], z1]], [p[0], p[1], z0], [ux / l, uy / l, 0], [0, 0, 1], side, l, z1 - z0, 'side');
  }
  if (top !== null) this.poly(outline.map((p) => [p[0], p[1], z1]), [outline[0][0], outline[0][1], z1], [1, 0, 0], [0, 1, 0], top || side, 20, 20, 'top');
  return this;
};

const FACADES = ['#efe1c4', '#e8b878', '#eba892', '#f1ccbb', '#f0da93', '#f2eee4', '#dcd5c5', '#d5e2cb', '#e9c7a0'];
const SHUTTERS = ['#4e7c5b', '#58789a', '#7b8f58', '#8a5b4a'];
const AWNINGS = [['#2e7b59', '#f4efe2'], ['#c2412f', '#f4efe2'], ['#2d5d8e', '#f4efe2'], ['#d68a1e', '#f6efe0'], ['#7a3b6b', '#f4efe2']];
const CAR_COLORS = ['#c7372f', '#2e5c9a', '#e9e4d8', '#2b2f36', '#e3b23c', '#4f8a5b', '#9aa3ad', '#d86f2c'];
const TERRACOTTA = '#c4643f';

const M_LOT = {
  pave: paveMat('#d8ccb6', 2), paveDark: paveMat('#c3b59c', 2), concrete: flat('#cfcac0', 0.06),
  edge: flat('#a69b88'), grass: grassMat(3), sand: flat('#e4d09c', 0.12), wood: stripeMat('#b9875a', '#a4744b', 1),
  asphalt: flat('#6b6f76', 0.08), dirt: flat('#b59a73', 0.15),
};
const LEAF = {
  plane: ['#3f6b35', '#56873f', '#6fa34a', '#8fbf5c'],
  pine: ['#2f4f2e', '#3d6338', '#4f7a42', '#66924f'],
  olive: ['#55613a', '#6b7a47', '#83935a', '#9fae72'],
  lemon: ['#3a6332', '#4f8240', '#6a9e4c', '#87b85e'],
  hedge: ['#3b6431', '#4d7d3c', '#64974a', '#7fb05a'],
  cypress: ['#24402a', '#2f5233', '#3d6640', '#4f7a4c'],
};

// ---------- trees & small props ------------------------------------------------
function addPlaneTree(m, x, y, z, s = 1, ramp = LEAF.plane, seed = 1) {
  m.box(x - 0.3, y - 0.3, z, 0.6, 0.6, 7 * s, flat('#6b5139'));
  const leaf = leafMat(ramp, seed);
  m.blob(x, y, z + 11 * s, 2.9 * s, 6.4 * s, leaf);
  m.blob(x - 1.2 * s, y + 0.8 * s, z + 9 * s, 2.1 * s, 5 * s, leaf);
  m.blob(x + 1.1 * s, y - 0.9 * s, z + 13 * s, 1.9 * s, 4.6 * s, leaf);
}
function addPalm(m, x, y, z, s = 1, seed = 1) {
  const lean = (hash2(seed, 3) - 0.5) * 1.2;
  const H = 15 * s;
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6, t1 = (i + 1) / 6;
    const b = (t) => [x + lean * t * t, y + lean * 0.4 * t * t, z + H * t];
    const p0 = b(t0);
    m.box(p0[0] - 0.32, p0[1] - 0.32, p0[2], 0.64, 0.64, H / 6 + 0.4, flat(i % 2 ? '#8a6a48' : '#7a5c3d'));
  }
  const top = [x + lean, y + lean * 0.4, z + H];
  const greens = ['#3f7a3a', '#5a9a44', '#4c8a3f'];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    const len = (3.6 + hash2(i, seed) * 1.2) * s;
    let px = top[0], py = top[1], pz = top[2];
    for (let k = 1; k <= 5; k++) {
      const t = k / 5;
      const nx = top[0] + Math.cos(a) * len * t, ny = top[1] + Math.sin(a) * len * t, nz = top[2] + 2.2 * s * t - 7.5 * s * t * t;
      m.line(px, py, pz, nx, ny, nz, hex(greens[(i + k) % 3]));
      px = nx; py = ny; pz = nz;
    }
  }
  m.blob(top[0], top[1], top[2] + 0.5, 0.8 * s, 2 * s, blobMat('#4a7d3a'));
}
function addUmbrellaPine(m, x, y, z, s = 1, seed = 1) {
  const lean = (hash2(seed, 7) - 0.5) * 1.4;
  m.line(x, y, z, x + lean * 0.6, y, z + 9 * s, hex('#6e5640'));
  m.line(x + 0.25, y, z, x + lean * 0.6 + 0.25, y, z + 9 * s, hex('#5b4634'));
  const leaf = leafMat(LEAF.pine, seed, 0.9);
  m.blob(x + lean, y, z + 12 * s, 3.6 * s, 3.4 * s, leaf);
  m.blob(x + lean - 1.6 * s, y + 0.6, z + 11 * s, 2.2 * s, 2.6 * s, leaf);
}
function addCypress(m, x, y, z, s = 1, seed = 1) {
  m.blob(x, y, z + 9 * s, 1.25 * s, 9 * s, leafMat(LEAF.cypress, seed, 1.2));
}
function addBush(m, x, y, z, r = 1.4, ramp = LEAF.olive, seed = 1) {
  m.blob(x, y, z + r * 1.6, r, r * 2.2, leafMat(ramp, seed, 1.1));
}
function addBench(m, x, y, z, along = 'x') {
  if (along === 'x') { m.box(x - 1.2, y - 0.35, z, 2.4, 0.7, 2, flat('#8c6a4a')); }
  else m.box(x - 0.35, y - 1.2, z, 0.7, 2.4, 2, flat('#8c6a4a'));
}
const LAMP_MAT = mat((s, t, f, o) => { o[0] = 255; o[1] = 236; o[2] = 170; return f.night ? 2 : 1; });
function addLamp(m, x, y, z, h = 9) {
  m.line(x, y, z, x, y, z + h, hex('#3a3f46'));
  m.box(x - 0.3, y - 0.3, z + h, 0.6, 0.6, 1.2, LAMP_MAT);
}
function addUmbrella(m, x, y, z, c1, c2, r = 1.6) {
  m.line(x, y, z, x, y, z + 6, hex('#e8e2d4'));
  const C1 = hex(c1), C2 = hex(c2);
  m.blob(x, y, z + 6.3, r, 1.3, mat((nx, ny, nz, P, o) => {
    const a = Math.atan2(P[1] - y, P[0] - x);
    const c = (Math.floor((a + Math.PI) / (Math.PI / 4)) & 1) ? C1 : C2;
    shadeTo(o, c[0], c[1], c[2], clamp(AMB + nx * LW[0] + ny * LW[1] + nz * LW[2], 0.5, 1.15)); return 2;
  }, { blob: true }));
}
function railingMat(color) {
  const C = hex(color);
  return mat((s, t, f, o) => {
    if (t > f.h - 0.8 || (s % 0.8) < 0.35) { o[0] = C[0]; o[1] = C[1]; o[2] = C[2]; return 1; }
    return 0;
  });
}
function lot(m, top, z = 1, edge = M_LOT.edge) { m.box(0, 0, 0, 16, 16, z, { top, side: edge }); }

// ---------- homes ----------------------------------------------------------------
function mCottage(lv, v) {
  const m = new Model();
  const fc = FACADES[v % FACADES.length], sh = SHUTTERS[v % 4];
  lot(m, M_LOT.grass);
  m.box(6.8, 12, 1, 2.4, 4, 0.15, M_LOT.pave);
  const w = [9, 10, 11][lv - 1], d = [8, 9, 9][lv - 1], fl = lv === 3 ? 3 : 2;
  const x0 = (16 - w) / 2, y0 = 3.2, h = 3 + fl * 9;
  const wall = wallMat(fc, { floorH: 9, base: 3, shutter: sh, door: true });
  const side = wallMat(fc, { floorH: 9, base: 3, shutter: sh });
  m.box(x0, y0, 1, w, d, h, { top: flat(fc), side, py: wall });
  m.hip(x0, y0, 1 + h, w, d, 6, roofTileMat(TERRACOTTA));
  m.box(x0 + w - 2.6, y0 + 1.6, 1 + h + 2, 1.4, 1.4, 6, { top: flat('#8e5a44'), side: flat('#d9cdb6') });
  if (lv >= 2) { // side terrace extension
    m.box(x0 + w, y0 + 2, 1, 2.2, d - 3, 9, { top: flat('#d7cfbe'), side: wallMat(fc, { floorH: 9, base: 3 }) });
    m.box(x0 + w, y0 + 2, 10, 2.2, d - 3, 2.5, { top: null, side: railingMat('#f2efe8') });
  }
  addPlaneTree(m, 2.6, 13, 1, 0.62, LEAF.lemon, v + 3);
  if (v % 2) addCypress(m, 14, 3, 1, 0.8, v);
  else addBush(m, 13.5, 13.5, 1, 1.3, LEAF.hedge, v);
  return m;
}

function mTownhouse(lv, v) {
  const m = new Model();
  lot(m, M_LOT.pave);
  const base = [3, 4, 5][lv - 1];
  for (let k = 0; k < 3; k++) {
    const fc = FACADES[(v * 2 + k * 3 + 1) % FACADES.length];
    const sh = SHUTTERS[(v + k) % 4];
    const fl = base + (k === 1 ? 1 : 0) - (k === 2 && v % 2 ? 1 : 0);
    const h = 3 + fl * 9;
    const x = 0.8 + k * 4.8;
    m.box(x, 2.6, 1, 4.8, 11, h, { top: flat(fc), side: wallMat(fc, { floorH: 9, base: 3, shutter: sh, gap: 2.4, winW: 1.2 }), py: wallMat(fc, { floorH: 9, base: 3, shutter: sh, gap: 2.4, winW: 1.2, door: true }) });
    m.hip(x, 2.6, 1 + h, 4.8, 11, 5, roofTileMat(k === 1 ? '#b85a3a' : TERRACOTTA), 0.4);
  }
  addPlaneTree(m, 14.6, 14.6, 1, 0.55, LEAF.plane, v + 11);
  return m;
}

function mApartment(lv, v) {
  const m = new Model();
  const fc = ['#e6b57a', '#e9a88e', '#efe0c2', '#f0d58e'][v % 4];
  lot(m, M_LOT.pave);
  const fl = [4, 6, 8][lv - 1], fh = 8;
  const h = 3 + fl * fh + 2;
  const x0 = 1.5, y0 = 1.8, w = 13, d = 11.5;
  const wall = wallMat(fc, { floorH: fh, base: 3, winH: 4, gap: 2.6, winW: 1.4, shutter: SHUTTERS[(v + 1) % 4] });
  m.box(x0, y0, 1, w, d, h, { top: flatRoofMat('#cfc6b6'), side: wall, py: wallMat(fc, { floorH: fh, base: 3, winH: 4, gap: 2.6, winW: 1.4, door: true, shutter: SHUTTERS[(v + 1) % 4] }) });
  const rail = railingMat('#f4f1ea'), slab = { top: flat('#f2eee6'), side: flat('#e4ddd0') };
  for (let f = 1; f < fl; f++) {
    const z = 1 + 3 + f * fh;
    m.box(x0 + 1, y0 + d, z, w - 2, 1.4, 1, slab);
    m.box(x0 + 1, y0 + d + 1.15, z + 1, w - 2, 0.25, 3, { top: null, side: rail });
    m.box(x0 + w, y0 + 1.2, z, 1.4, d - 2.4, 1, slab);
    m.box(x0 + w + 1.15, y0 + 1.2, z + 1, 0.25, d - 2.4, 3, { top: null, side: rail });
  }
  const rz = 1 + h;
  m.cyl(4.5, 5, rz, 1.4, 5, flat('#bfc4c8'), 8, flat('#d5d9dc'));
  m.box(9, 4, rz, 3, 2.6, 4, { top: flat('#b9b2a5'), side: wallMat(fc, { floorH: 99, base: 99 }) });
  m.box(10.5, 9, rz, 1.6, 1.2, 1.6, flat('#9fa4a8'));
  m.line(4, 10, rz + 3, 8, 12, rz + 3, hex('#7c7c7c'));
  return m;
}

// Belle Époque facade: arcaded ground floor, pilasters between window bays, cornice bands
function belleMat(color, opt) {
  const base = wallMat(color, Object.assign({ base: 1, ground: 'arcade', bands: true }, opt));
  const P = mixC(hex(color), [255, 255, 255], 0.3), gap = opt.gap || 2.4, gh = opt.groundH || 0;
  return mat((s, t, f, o) => {
    const r = base.fn(s, t, f, o);
    if (r === 1 && t > gh + 1 && t < f.h - 1) {
      const n = Math.max(1, Math.floor((f.w - 1) / gap)), start = (f.w - (n - 1) * gap) / 2;
      const k = (s - start) / gap, fr = k - Math.floor(k);
      if (Math.abs(fr - 0.5) < 0.09) { o[0] = P[0]; o[1] = P[1]; o[2] = P[2]; o[3] = 1; }
    }
    return r;
  });
}
function addFrenchBalconies(m, x0, x1, y, z0, floors, fh, gap, side) {
  const rail = railingMat('#2f3438'), slab = { top: flat('#e9e2d4'), side: flat('#d8d0c0') };
  const n = Math.max(1, Math.floor((x1 - x0 - 1) / gap)), start = x0 + ((x1 - x0) - (n - 1) * gap) / 2;
  for (let f = 0; f < floors; f++) {
    const z = z0 + f * fh;
    for (let k = 0; k < n; k++) {
      const cx = start + k * gap;
      if (side === 'y') { m.box(cx - 0.9, y, z, 1.8, 0.7, 0.5, slab); m.box(cx - 0.9, y + 0.55, z + 0.5, 1.8, 0.15, 2.2, { top: null, side: rail }); }
      else { m.box(y, cx - 0.9, z, 0.7, 1.8, 0.5, slab); m.box(y + 0.55, cx - 0.9, z + 0.5, 0.15, 1.8, 2.2, { top: null, side: rail }); }
    }
  }
}
function mBelle(lv, v) {
  const m = new Model();
  const fc = ['#efe3c8', '#ead2b3', '#f2ddc9', '#e9e3d3'][v % 4];
  lot(m, M_LOT.paveDark);
  const fl = [5, 7, 9][lv - 1], fh = 9, gh = 11, h = gh + fl * fh + 2;
  const x0 = 1, y0 = 1, w = 14, d = 13.5;
  const wall = belleMat(fc, { floorH: fh, groundH: gh, winH: 6, winW: 1.3, gap: 2.4 });
  m.box(x0, y0, 1, w, d, h, { top: flatRoofMat('#bfb6a7'), side: wall });
  const corn = { top: flat(fc), side: flat(mixHex(fc, 0.9)) };
  m.box(x0 - 0.4, y0 - 0.4, 1 + h - 1.4, w + 0.8, d + 0.8, 1.4, corn);
  m.box(x0 - 0.2, y0 - 0.2, 1 + gh - 0.6, w + 0.4, d + 0.4, 0.8, corn);
  addFrenchBalconies(m, x0, x0 + w, y0 + d, 1 + gh + 1, fl - 1, fh, 2.4, 'y');
  addFrenchBalconies(m, y0, y0 + d, x0 + w, 1 + gh + 1, fl - 1, fh, 2.4, 'x');
  // slate mansard with zinc ridge, dormers and chimneys
  const rz = 1 + h, slate = roofTileMat('#66727e');
  m.hip(x0 + 0.6, y0 + 0.6, rz, w - 1.2, d - 1.2, 11, slate, 0.2);
  const dormer = { top: flat('#56616c'), side: wallMat(fc, { floorH: 99, base: 99 }), py: wallMat(fc, { floorH: 6, base: 1, winH: 3.5, winW: 1.2, gap: 3, sill: false }), px: wallMat(fc, { floorH: 6, base: 1, winH: 3.5, winW: 1.2, gap: 3, sill: false }) };
  for (const x of [3.2, 7.3, 11.4]) m.box(x, y0 + d - 2.2, rz + 1, 1.8, 1.6, 4.5, dormer);
  for (const y of [3.4, 7.6]) m.box(x0 + w - 2.2, y, rz + 1, 1.6, 1.8, 4.5, dormer);
  for (const [x, y] of [[3, 3.5], [11, 4]]) m.box(x, y, rz + 4, 1.2, 1.2, 6, { top: flat('#8e5a44'), side: stoneMat('#cdbda1') });
  if (lv >= 2) {
    // corner rotunda with a small copper dome
    m.cyl(x0 + w - 0.4, y0 + d - 0.4, 1 + gh, 2.6, h - gh, belleMat(fc, { floorH: fh, groundH: 0, winH: 6, winW: 1, gap: 2.2 }), 12, null);
    m.cyl(x0 + w - 0.4, y0 + d - 0.4, rz, 2.9, 1, flat(fc), 12, flat('#d9cdb5'));
    m.blob(x0 + w - 0.4, y0 + d - 0.4, rz + 1, 2.6, 6.5, blobMat('#6f9d8c'));
    m.line(x0 + w - 0.4, y0 + d - 0.4, rz + 7, x0 + w - 0.4, y0 + d - 0.4, rz + 11, hex('#c9a24a'));
  }
  addPlaneTree(m, 14.6, 15.2, 1, 0.55, LEAF.plane, v + 4);
  return m;
}

// Riviera Tower: cream core, white wraparound balconies on every floor, penthouse pergola
function mTower(lv, v) {
  const m = new Model();
  lot(m, M_LOT.pave);
  addPalm(m, 1.8, 14.2, 1, 0.8, v + 9); addPalm(m, 14.2, 1.8, 1, 0.8, v + 10);
  const fl = [13, 17, 21][lv - 1], fh = 7;
  const x0 = 2.5, y0 = 2.5, w = 11, d = 11, h = 4 + fl * fh;
  const tint = ['#7fa3b4', '#86a9a3', '#8ba0bf'][v % 3];
  m.box(x0, y0, 1, w, d, 5, { top: flat('#ede8dd'), side: wallMat('#f3efe6', { floorH: 5, base: 1, groundH: 5, ground: 'shop', shopGlass: '#4d6a7c' }) });
  m.box(x0 + 0.6, y0 + 0.6, 6, w - 1.2, d - 1.2, h - 5, { top: flatRoofMat('#d9d6cf'), side: glassMat(tint, { floorH: fh, col: 2.2, mullion: '#f1efe8' }) });
  const slab = { top: flat('#f7f5f0'), side: flat('#ece8e0') }, rail = railingMat('#f7f5f0');
  for (let f = 1; f <= fl; f++) {
    const z = 1 + 4 + f * fh - 1;
    m.box(x0 - 0.8, y0 - 0.8, z, w + 1.6, d + 1.6, 1, slab);
    m.box(x0 - 0.8, y0 + d + 0.6, z + 1, w + 1.6, 0.2, 2.2, { top: null, side: rail });
    m.box(x0 + w + 0.6, y0 - 0.8, z + 1, 0.2, d + 1.6, 2.2, { top: null, side: rail });
    if (f % 3 === 0) for (const [px, py] of [[x0 + 1, y0 + d + 0.2], [x0 + w - 2, y0 + d + 0.2]]) addBush(m, px, py, z + 1, 0.55, LEAF.hedge, f + v);
  }
  const rz = 1 + h;
  m.box(4.5, 4.5, rz, 7, 7, 7, { top: flatRoofMat('#d9d6cf'), side: wallMat('#f3f1ec', { floorH: 7, base: 1, winH: 4, winW: 2, gap: 3 }) });
  // pergola and pool deck
  for (const [px, py] of [[3, 12], [6, 12], [3, 13.5], [6, 13.5]]) m.box(px, py, rz, 0.4, 0.4, 4, flat('#f3f1ec'));
  m.box(2.8, 11.8, rz + 4, 4, 2.2, 0.4, stripeMat('#b9875a', '#a4744b', 0.5));
  m.box(8.5, 11.5, rz, 4, 2.6, 0.4, waterMat());
  m.line(10, 6, rz + 7, 10, 6, rz + 17, hex('#c9ccd0'));
  return m;
}

// Twin Odéon: shared stone podium, two glass towers with stepped crowns
function mSkyscraper(lv, v) {
  const m = new Model();
  lot(m, M_LOT.paveDark);
  const fl = [26, 32, 38][lv - 1], fh = 6;
  const tint = ['#5d8fa8', '#4f7f8f', '#6b7fa6'][v % 3];
  m.box(0.8, 0.8, 1, 14.4, 14.4, 14, { top: flatRoofMat('#cbc6bd'), side: wallMat('#ece5d6', { floorH: 7, base: 1, groundH: 7, ground: 'shop', winH: 4, winW: 2, gap: 2.6, shopGlass: '#3e5566' }) });
  const tower = (x, y, s, n, crownC) => {
    const hh = n * fh, z0 = 15;
    m.box(x, y, z0, s, s, hh, { top: flatRoofMat('#cbc6bd'), side: glassMat(tint, { floorH: fh, col: 1.6, mullion: '#e2e7ea' }) });
    for (const [cx, cy] of [[x, y], [x + s, y], [x, y + s], [x + s, y + s]]) m.box(cx - 0.45, cy - 0.45, z0, 0.9, 0.9, hh + 1.5, { top: flat('#f1ece2'), side: flat('#e4dccd') });
    let z = z0 + hh + 1.5, ss = s;
    for (let k = 0; k < 3; k++) {
      const sh = [4, 4, 5][k];
      m.box(x + (s - ss) / 2, y + (s - ss) / 2, z, ss, ss, sh, { top: flat('#e8e2d6'), side: glassMat(crownC, { floorH: sh, col: 1.2, mullion: '#f1ece2' }) });
      z += sh; ss -= 1.6;
    }
    m.pyramid(x + (s - ss) / 2, y + (s - ss) / 2, z, ss, ss, 7, mat((s2, t, f, o) => { o[0] = 214; o[1] = 186; o[2] = 120; return f.night && t > 3 ? 2 : 1; }));
    m.line(x + s / 2, y + s / 2, z + 6, x + s / 2, y + s / 2, z + 22, hex('#d7dade'));
    m.box(x + s / 2 - 0.3, y + s / 2 - 0.3, z + 21, 0.6, 0.6, 1, emissive('#ff5040'));
  };
  // towers side by side along x so both read as separate shafts in every view
  tower(1.2, 4.9, 5.8, fl, '#9fbfd0');
  tower(9.0, 4.9, 5.8, fl - 6, '#b7cfc4');
  for (const zz of [15 + Math.round(fl * 0.3) * fh, 15 + Math.round(fl * 0.6) * fh]) m.box(6.8, 6.5, zz, 2.4, 2.6, 5, { top: flat('#e8e2d6'), side: glassMat('#9fbfd0', { floorH: 5, col: 1.2, mullion: '#f1ece2' }) });
  addPalm(m, 1.5, 15, 1, 0.8, v + 3); addPalm(m, 15, 1.5, 1, 0.8, v + 4);
  return m;
}

function mVilla(lv, v) {
  const m = new Model();
  lot(m, M_LOT.grass);
  // pool deck and pool
  m.box(1, 9.5, 1, 9, 5.5, 0.3, M_LOT.pave);
  m.box(1.8, 10.3, 1.05, 7.4, 3.9, 0.3, waterMat());
  const w = [8, 9, 10][lv - 1], fl = lv === 3 ? 3 : 2;
  const x0 = 5, y0 = 1.5, d = 7;
  const white = '#f4f2ec';
  m.box(x0, y0, 1, w, d, 4 + fl * 9, { top: flatRoofMat('#e7e2d8'), side: wallMat(white, { floorH: 9, base: 3, winH: 6, winW: 2.6, gap: 3.6, glass: '#4b6378' }) });
  m.box(x0 - 2.5, y0 + 1, 1, 2.5, d - 1, 10, { top: flatRoofMat('#e7e2d8'), side: glassMat('#5f7f96', { floorH: 10, col: 2.5 }) });
  m.box(x0 - 2.5, y0 + 1, 11, 2.5, d - 1, 2, { top: null, side: railingMat('#f4f2ec') });
  for (let i = 0; i < 2; i++) m.box(2 + i * 2.6, 15, 1.3, 1.6, 0.7, 0.8, flat('#f4f2ec'));
  addPalm(m, 13.5, 13, 1, 0.9, v + 5);
  addUmbrella(m, 11.5, 11.5, 1.3, '#e8e2d4', '#2d5d8e', 1.4);
  return m;
}

// ---------- shops -----------------------------------------------------------------
function addAwning(m, x0, x1, y, z, c1, c2, depth = 1.8, drop = 3) {
  m.facet([[x0, y, z], [x1, y, z], [x1, y + depth, z - drop], [x0, y + depth, z - drop]], stripeMat(c1, c2, 1, 's'), 'awning');
}
function addAwningX(m, y0, y1, x, z, c1, c2, depth = 1.8, drop = 3) {
  m.facet([[x, y1, z], [x, y0, z], [x + depth, y0, z - drop], [x + depth, y1, z - drop]], stripeMat(c1, c2, 1, 's'), 'awning');
}
function signMat(bg, fg) {
  const Bc = hex(bg), F = hex(fg);
  return mat((s, t, f, o) => {
    const inner = t > 0.8 && t < f.h - 0.8 && s > 0.8 && s < f.w - 0.8;
    const letter = inner && ((Math.floor(s * 1.3) % 3) !== 2) && hash2(Math.floor(s * 1.3), Math.floor(t * 1.2), 77) < 0.75;
    const c = letter ? F : Bc; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return f.night ? 2 : 1;
  });
}

function mGrocer(lv, v) {
  const m = new Model();
  lot(m, M_LOT.pave);
  const fc = FACADES[(v + 2) % FACADES.length], aw = AWNINGS[v % AWNINGS.length];
  const fl = [1, 2, 3][lv - 1], gh = 11, fh = 9, h = gh + fl * fh + 1;
  const x0 = 2, y0 = 2.5, w = 12, d = 11;
  const front = wallMat(fc, { floorH: fh, base: 1, groundH: gh, ground: 'shop', shutter: SHUTTERS[v % 4] });
  m.box(x0, y0, 1, w, d, h, { top: flatRoofMat('#d2c9b8'), side: wallMat(fc, { floorH: fh, base: 1, groundH: gh, shutter: SHUTTERS[v % 4] }), py: front, px: front });
  addAwning(m, x0 + 0.5, x0 + w - 0.5, y0 + d, 1 + gh - 1, aw[0], aw[1]);
  addAwningX(m, y0 + 0.5, y0 + d - 0.5, x0 + w, 1 + gh - 1, aw[0], aw[1]);
  m.box(x0 + 3, y0 + d + 0.05, 1 + gh, w - 6, 0.3, 3.5, { top: flat(aw[0]), side: signMat(aw[0], '#f7f1e3') });
  const crate = ['#d9472b', '#f09a2a', '#7bab3a', '#e8c547'];
  for (let i = 0; i < 4; i++) m.box(x0 + 1 + i * 1.6, y0 + d + 2.2, 1, 1.3, 1, 1.8, { top: flat(crate[i]), side: flat('#9c7550') });
  return m;
}

function mCafe(lv, v) {
  const m = new Model();
  lot(m, M_LOT.paveDark);
  const fc = FACADES[(v + 5) % FACADES.length], aw = AWNINGS[(v + 1) % AWNINGS.length];
  const fl = [0, 1, 2][lv - 1], gh = 11, fh = 9, h = gh + fl * fh + 1;
  const x0 = 1.5, y0 = 1.5, w = 10, d = 9;
  const front = wallMat(fc, { floorH: fh, base: 1, groundH: gh, ground: 'shop', shutter: SHUTTERS[(v + 2) % 4] });
  m.box(x0, y0, 1, w, d, h, { top: flatRoofMat('#d2c9b8'), side: wallMat(fc, { floorH: fh, base: 1, groundH: gh, shutter: SHUTTERS[(v + 2) % 4] }), py: front, px: front });
  addAwning(m, x0 + 0.5, x0 + w - 0.5, y0 + d, gh, aw[0], aw[1], 2.2, 3);
  if (lv >= 2) m.box(x0, y0, 1 + h, w, d, 2.4, { top: null, side: railingMat('#3f4448') });
  // terrace tables with umbrellas
  const ucol = [[aw[0], '#f4efe2'], ['#f4efe2', aw[0]]];
  const spots = [[4, 13.6], [9, 13.6], [13.6, 4.5], [13.6, 9.5]];
  spots.forEach(([x, y], i) => {
    m.cyl(x, y, 1, 0.7, 2.2, flat('#e9e3d6'), 6);
    addUmbrella(m, x, y, 1, ucol[i % 2][0], ucol[i % 2][1], 1.7);
  });
  addPlanter(m, 14.5, 14.5);
  return m;
}
function addPlanter(m, x, y) {
  m.box(x - 0.8, y - 0.8, 1, 1.6, 1.6, 1.6, flat('#b46a45'));
  addBush(m, x, y, 2.6, 0.9, LEAF.hedge, 4);
}

function mSupermarket(lv, v) {
  const m = new Model();
  lot(m, M_LOT.asphalt);
  const w = 15, d = [10, 11, 12][lv - 1], h = [15, 17, 24][lv - 1];
  const sc = ['#2f7a4f', '#d7372f', '#2d5d8e'][v % 3];
  const front = mat((s, t, f, o) => {
    if (t > f.h - 5.5) { const c = hex(sc); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; if (t < f.h - 1.2 && t > f.h - 4.5 && s > 2 && s < f.w - 2 && (Math.floor(s * 1.4) % 3) !== 2) { o[0] = 247; o[1] = 241; o[2] = 227; } return f.night ? 2 : 1; }
    if (t > 1 && t < f.h - 7 && (s % 3) > 0.4) { o[0] = 96; o[1] = 120; o[2] = 140; o[3] = 1.05; return 1; }
    o[0] = 225; o[1] = 220; o[2] = 210; return 1;
  });
  m.box(0.5, 0.5, 1, w, d, h, { top: flatRoofMat('#c9c4ba'), side: wallMat('#e3ddd2', { floorH: 99, base: 99 }), py: front, px: front });
  m.box(3, 3, 1 + h, 2, 2, 1.5, flat('#a9adb0'));
  m.box(8, 4, 1 + h, 3, 2, 1.5, flat('#a9adb0'));
  // parking lines and a parked car
  for (let i = 0; i < 4; i++) m.box(1 + i * 3.6, d + 1.5, 1, 0.3, 3, 0.05, flat('#f2eee4'));
  const car = mCar(CAR_COLORS[(v + 2) % 8], 1);
  for (const f of car.faces) m.faces.push(shiftFace(f, 4.4, d + 3.2, 1, true));
  return m;
}
// rotate a face 90 degrees (swap x/y) and translate: used to drop vehicle models into tiles
function shiftFace(f, dx, dy, dz, rot) {
  const T = (p) => rot ? [dx - p[1], dy + p[0], dz + p[2]] : [dx + p[0], dy + p[1], dz + p[2]];
  const TV = (v) => rot ? [-v[1], v[0], v[2]] : v;
  return { pts: f.pts.map(T), o: T(f.o), u: TV(f.u), v: TV(f.v), mat: f.mat, w: f.w, h: f.h, tag: f.tag };
}

function mBoutique(lv, v) {
  const m = new Model();
  lot(m, paveMat('#e6e0d4', 1.5));
  const fc = '#f1ece2';
  const fl = [2, 3, 4][lv - 1], gh = 11, fh = 10, h = gh + fl * fh + 2;
  const x0 = 2, y0 = 2, w = 12, d = 11;
  const front = wallMat(fc, { floorH: fh, base: 1, groundH: gh, ground: 'shop', winH: 7, winW: 1.6, gap: 3, bands: true, shopGlass: '#3a4450' });
  m.box(x0, y0, 1, w, d, h, { top: flatRoofMat('#d2cbbd'), side: wallMat(fc, { floorH: fh, base: 1, groundH: gh, winH: 7, bands: true }), py: front, px: front });
  addAwning(m, x0 + 0.5, x0 + w - 0.5, y0 + d, gh, '#1f2226', '#1f2226', 1.6, 2);
  addAwningX(m, y0 + 0.5, y0 + d - 0.5, x0 + w, gh, '#1f2226', '#1f2226', 1.6, 2);
  m.box(x0 + 3, y0 + d + 0.05, 1 + gh, w - 6, 0.3, 2.6, { top: flat('#c9a24a'), side: signMat('#1f2226', '#d9b25a') });
  addPlanter(m, 2.5, 14.8); addPlanter(m, 13.2, 14.8);
  return m;
}

function mDept(lv, v) {
  const m = new Model();
  lot(m, M_LOT.paveDark);
  const fl = [4, 5, 6][lv - 1], gh = 12, fh = 10, h = gh + fl * fh + 3;
  const fc = ['#efe6d6', '#e8dccb'][v % 2];
  const wall = wallMat(fc, { floorH: fh, base: 1, groundH: gh, ground: 'arcade', winH: 7, winW: 1.8, gap: 2.6, bands: true });
  m.box(0.6, 0.6, 1, 14.8, 14.8, h, { top: flatRoofMat('#cbc2b2'), side: wall });
  m.blob(8, 8, 1 + h + 1, 4.5, 7.5, mat((nx, ny, nz, P, o) => {
    const rib = (Math.floor((Math.atan2(P[1] - 8, P[0] - 8) + 4) * 2.6) % 2) === 0;
    const k = clamp(AMB + nx * LW[0] + ny * LW[1] + nz * LW[2], 0.5, 1.2);
    const c = rib ? [210, 220, 222] : [120, 165, 180];
    shadeTo(o, c[0], c[1], c[2], k + (nz > 0.8 ? 0.15 : 0)); return 2;
  }, { blob: true }));
  for (const [x, y] of [[1.2, 1.2], [13.8, 1.2], [1.2, 13.8], [13.8, 13.8]]) m.box(x - 0.8, y - 0.8, 1 + h, 1.6, 1.6, 4, flat('#d9cfbe'));
  m.box(4, 15.45, 1 + gh, 8, 0.3, 4, { top: flat('#2d5d8e'), side: signMat('#2d5d8e', '#f7f1e3') });
  return m;
}

// stone arcade with round-headed openings; interiors glow at night
function arcadeMat(color, bay = 3.4, opt = {}) {
  const C = hex(color), J = mulC(C, 0.86), inC = hex(opt.inside || '#4a3c34'), warm = hex(opt.warm || '#c87a3c');
  return mat((s, t, f, o) => {
    const m0 = ((s % bay) + bay) % bay, cx = bay / 2, r = bay * 0.34, top = f.h - (opt.lintel || 2.5);
    const dx = m0 - cx;
    const open = Math.abs(dx) < r && t > 0.6 && (t < top - r || (t - (top - r)) * (t - (top - r)) / 1.4 + dx * dx < r * r);
    if (open) {
      if (f.night && hash2(Math.floor(s / bay), 3, f.seed) < 0.7) { o[0] = 255; o[1] = 196; o[2] = 110; return 2; }
      const c = hash2(Math.floor(s * 2), Math.floor(t), 4) < 0.22 ? warm : inC; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
    }
    const c = (t % 3) < 0.45 ? J : C; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  });
}
function addCrates(m, x, y, z, n, seed) {
  const crate = ['#d9472b', '#f09a2a', '#7bab3a', '#e8c547', '#a8324a'];
  for (let i = 0; i < n; i++) m.box(x + i * 1.6, y, z, 1.3, 1, 1.6, { top: flat(crate[(i + seed) % crate.length]), side: flat('#9c7550') });
}
function addStall(m, x, y, z, c1, seed) {
  m.box(x, y, z, 2.6, 1.6, 1.6, { top: flat('#c9a77c'), side: flat('#a4744b') });
  addCrates(m, x + 0.1, y + 0.2, z + 1.6, 1, seed);
  for (const [px, py] of [[x, y], [x + 2.4, y]]) m.line(px + 0.1, py + 0.1, z, px + 0.1, py + 0.1, z + 5, hex('#5a4a3a'));
  m.facet([[x - 0.3, y - 0.2, z + 5], [x + 2.9, y - 0.2, z + 5], [x + 2.9, y + 2, z + 4], [x - 0.3, y + 2, z + 4]], stripeMat(c1, '#f4efe2', 0.65, 's'), 'awning');
}

function mMarketHall(lv, v) {
  const m = new Model();
  lot(m, paveMat('#d9cdb5', 2));
  const x0 = 1, y0 = 1.2, w = 14, d = 11.5, h = [11, 12, 13][lv - 1];
  m.box(x0, y0, 1, w, d, h, { top: null, side: arcadeMat('#e1cfaa', 3.5, { lintel: 3 }) });
  const iron = glassMat('#9cc0c6', { floorH: 2.6, col: 1.5, mullion: '#3f4b55' });
  m.gable(x0 - 0.4, y0 - 0.4, 1 + h, w + 0.8, d + 0.8, 7, 'x', iron, arcadeMat('#e1cfaa', 3.5, { lintel: 1 }), 0.5);
  m.gable(x0 + 3, y0 + d / 2 - 1.6, 1 + h + 5.4, w - 6, 3.2, 2.6, 'x', flat('#4a5662'), glassMat('#cfe3e6', { floorH: 2, col: 1, mullion: '#3f4b55' }), 0.2);
  // clock on the front gable end
  m.cyl(x0 + w + 0.5, y0 + d / 2, 1 + h + 2.5, 1.2, 0.3, flat('#f4efe2'), 10, null);
  const cols = ['#2e7b59', '#c2412f', '#d68a1e'];
  for (let i = 0; i < 3 + lv; i++) {
    const x = 1 + (i % 4) * 3.6, y = 13.4 + Math.floor(i / 4) * 0.01;
    if (x > 13) continue;
    addStall(m, x, y, 1, cols[(i + v) % 3], i + v);
  }
  return m;
}

function mFashion(lv, v) {
  const m = new Model();
  lot(m, paveMat('#e8e2d6', 1.5));
  const fc = ['#f1ebdf', '#efe3cf', '#e9e1d4'][v % 3];
  const fl = [3, 4, 5][lv - 1], gh = 12, fh = 10, h = gh + fl * fh + 2;
  const x0 = 1.5, y0 = 1.5, w = 13, d = 12;
  const front = belleMat(fc, { floorH: fh, groundH: gh, ground: 'shop', winH: 7, winW: 1.6, gap: 3, shopGlass: '#2f3540', bands: true });
  m.box(x0, y0, 1, w, d, h, { top: flatRoofMat('#d0c8b8'), side: belleMat(fc, { floorH: fh, groundH: gh, ground: null, winH: 7, winW: 1.6, gap: 3 }), py: front, px: front });
  m.box(x0 - 0.3, y0 - 0.3, h - 0.6, w + 0.6, d + 0.6, 1.6, { top: flat(fc), side: flat(mixHex(fc, 0.9)) });
  addAwning(m, x0 + 0.5, x0 + w - 0.5, y0 + d, gh - 0.5, '#15171a', '#15171a', 1.8, 1.8);
  addAwningX(m, y0 + 0.5, y0 + d - 0.5, x0 + w, gh - 0.5, '#15171a', '#15171a', 1.8, 1.8);
  m.box(x0 + 2.5, y0 + d + 0.05, 1 + gh, w - 5, 0.3, 2.8, { top: flat('#c9a24a'), side: signMat('#15171a', '#e3c06a') });
  m.box(x0 + w + 0.05, y0 + 2.5, 1 + gh, 0.3, d - 5, 2.8, { top: flat('#c9a24a'), side: signMat('#15171a', '#e3c06a') });
  addFrenchBalconies(m, x0, x0 + w, y0 + d, 1 + gh + 2, fl - 1, fh, 3, 'y');
  addFlag(m, x0 + 1.5, y0 + d + 0.3, 1 + gh + 6, 7, ['#15171a', '#e3c06a']);
  addFlag(m, x0 + w - 1.5, y0 + d + 0.3, 1 + gh + 6, 7, ['#15171a', '#e3c06a']);
  addPlanter(m, 2.2, 15.2); addPlanter(m, 14.8, 15.2);
  return m;
}

function mHardware(lv, v) {
  const m = new Model();
  lot(m, M_LOT.asphalt);
  const corr = stripeMat('#c9cdd1', '#b3b8bd', 0.6, 's');
  const x0 = 1.5, y0 = 1, w = 12, d = 9, h = [9, 11, 13][lv - 1];
  const front = mat((s, t, f, o) => {
    if (t > f.h - 3.2) { const c = (t > f.h - 0.6 || t < f.h - 2.8) ? [240, 236, 226] : (hash2(Math.floor(s * 1.4), 2, 7) < 0.6 && s > 2 && s < f.w - 2 ? [250, 246, 236] : [226, 112, 32]); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return f.night ? 2 : 1; }
    if (t < 6 && s > 2 && s < 6) { o[0] = 90; o[1] = 98; o[2] = 106; return 1; }
    if (t > 1 && t < 5 && s > 7 && (s % 2.2) > 0.4 && s < f.w - 1) { o[0] = 86; o[1] = 112; o[2] = 132; return 1; }
    return corr.fn(s, t, f, o);
  });
  m.box(x0, y0, 1, w, d, h, { top: null, side: corr, py: front, px: front });
  m.gable(x0, y0, 1 + h, w, d, 3, 'x', stripeMat('#a7adb3', '#959ba1', 0.7, 's'), corr, 0.4);
  // lumber stacks, a ladder and paint pallets in the yard
  for (let i = 0; i < 3; i++) m.box(1.5 + i * 0.1, 11.2 + i * 1.3, 1, 5.5, 1.1, 1.2 + (i % 2) * 0.6, { top: flat('#d6b27a'), side: stripeMat('#c49a5e', '#b0864c', 0.5, 't') });
  m.line(8.5, 11.5, 1, 9.2, 11.5, 8, hex('#d0d4d8')); m.line(9.6, 11.5, 1, 10.3, 11.5, 8, hex('#d0d4d8'));
  for (let k = 1; k < 7; k++) m.line(8.5 + k * 0.1, 11.5, 1 + k, 9.6 + k * 0.1, 11.5, 1 + k, hex('#d0d4d8'));
  for (let i = 0; i < 4; i++) m.box(11.5 + (i % 2) * 1.4, 11 + Math.floor(i / 2) * 1.4, 1, 1.2, 1.2, 1.1, { top: flat(['#2d6fb8', '#e2533d', '#f2b233', '#3fa66a'][i]), side: flat('#d9d2c4') });
  return m;
}

function mElectronics(lv, v) {
  const m = new Model();
  lot(m, paveMat('#dcdde0', 2));
  const fl = [2, 3, 4][lv - 1], fh = 8, gh = 10, h = gh + fl * fh;
  const x0 = 1.5, y0 = 1.5, w = 13, d = 11;
  const panel = mat((s, t, f, o) => {
    const band = Math.floor((t - gh) / fh);
    if (t < gh) {
      if (t > 1 && t < gh - 1.5 && (s % 3.2) > 0.3) { const hi = t > gh - 4 && (s % 3.2) < 1.2; const c = hi ? [180, 210, 230] : [52, 74, 96]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return f.night ? 2 : 1; }
      o[0] = 236; o[1] = 238; o[2] = 240; return 1;
    }
    const ft = (t - gh) % fh;
    if (ft > 1.5 && ft < fh - 1 && (s % 4) > 0.5) { if (f.night && hash2(Math.floor(s / 4), band, f.seed) < 0.6) { o[0] = 210; o[1] = 236; o[2] = 255; return 2; } o[0] = 70; o[1] = 96; o[2] = 120; return 1; }
    o[0] = 240; o[1] = 241; o[2] = 243; return 1;
  });
  m.box(x0, y0, 1, w, d, h, { top: flatRoofMat('#cfd2d6'), side: panel });
  // blue sign band and a giant screen on the corner
  m.box(x0 - 0.2, y0 + d - 0.2, 1 + gh, w + 0.4, 0.6, 2.2, { top: flat('#1f5f9e'), side: signMat('#1f5f9e', '#f4f8ff') });
  m.box(x0 + w - 0.2, y0 - 0.2, 1 + gh, 0.6, d + 0.4, 2.2, { top: flat('#1f5f9e'), side: signMat('#1f5f9e', '#f4f8ff') });
  m.box(x0 + w + 0.05, y0 + 1.5, 1 + gh + 4, 0.4, 7, 5 + lv, mat((s, t, f, o) => {
    const c = t < 0.4 || t > f.h - 0.4 || s < 0.4 || s > f.w - 0.4 ? [30, 34, 40] : (Math.floor(s * 1.5 + t) % 5 < 2 ? [64, 182, 236] : (Math.floor(t * 2) % 3 ? [240, 120, 190] : [250, 214, 90]));
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 2;
  }));
  m.box(4, 4, 1 + h, 3, 2, 1.6, flat('#a9adb0')); m.box(9, 5, 1 + h, 2.4, 2.4, 1.4, flat('#a9adb0'));
  m.cyl(10, 9.5, 1 + h, 1, 0.6, flat('#e9ecef'), 8, flat('#e9ecef'));
  m.line(5.5, 9, 1 + h, 5.5, 9, 1 + h + 8, hex('#c9ccd0'));
  return m;
}

function mHomecenter(lv, v) {
  const m = new Model();
  lot(m, M_LOT.asphalt);
  const x0 = 0.6, y0 = 0.6, w = 11, d = 14.8, h = [12, 14, 16][lv - 1];
  const side = mat((s, t, f, o) => {
    if (t > f.h - 4 && t < f.h - 1) { const c = [222, 110, 34]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; if (s > 2 && s < f.w - 2 && t > f.h - 3.4 && t < f.h - 1.6 && (Math.floor(s * 1.3) % 3) !== 2) { o[0] = 250; o[1] = 246; o[2] = 236; } return f.night ? 2 : 1; }
    if (t < 6 && (s % 7) > 2 && (s % 7) < 5) { o[0] = 84; o[1] = 92; o[2] = 100; return 1; }
    const c = (s % 1.2) < 0.25 ? [206, 208, 210] : [228, 229, 230]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  });
  m.box(x0, y0, 1, w, d, h, { top: flatRoofMat('#c9c4ba'), side });
  // garden centre under shade netting
  m.box(12, 1, 1, 3.6, 14, 0.2, M_LOT.dirt);
  for (let i = 0; i < 6; i++) addBush(m, 12.8 + (i % 2) * 1.8, 2 + Math.floor(i / 2) * 4.4, 1.2, 0.8, i % 2 ? LEAF.lemon : LEAF.olive, i + v);
  for (const y of [1.2, 7.6, 14.4]) m.line(15.4, y, 1, 15.4, y, 7, hex('#4a4f55'));
  m.box(11.8, 1, 7, 3.8, 14, 0.3, mat((s, t, f, o) => { if (((s + t) % 1.2) < 0.45) { o[0] = 46; o[1] = 82; o[2] = 60; return 1; } return 0; }));
  for (let i = 0; i < 3; i++) m.box(3 + i * 3, 4, 1 + h, 2, 2, 1.4, flat('#a9adb0'));
  return m;
}

// ---------- leisure ------------------------------------------------------------------
function mPark(lv, v) {
  const m = new Model();
  lot(m, M_LOT.grass);
  m.box(7, 0, 1, 2, 16, 0.12, M_LOT.dirt);
  m.box(0, 7, 1, 16, 2, 0.12, M_LOT.dirt);
  const n = lv + 1;
  const spots = [[3.5, 3.5], [12.5, 12.5], [12.5, 3.5], [3.5, 12.5]];
  for (let i = 0; i < Math.min(4, n); i++) addPlaneTree(m, spots[i][0], spots[i][1], 1, 0.85 + 0.1 * ((v + i) % 3), LEAF.plane, v * 5 + i);
  addBench(m, 5, 10, 1.1, 'x');
  addBench(m, 10, 5.5, 1.1, 'y');
  const fl = ['#e8475b', '#f2c94c', '#f4f1e8', '#9b6bd1'];
  for (let i = 0; i < 6; i++) m.box(10 + (i % 3) * 1.2, 9.8 + Math.floor(i / 3) * 1.2, 1, 0.9, 0.9, 1.2, flat(fl[(i + v) % 4]));
  if (lv >= 3) { m.cyl(4, 4, 1, 1.6, 0.4, waterMat(), 8); }
  return m;
}

function mPlaza(lv, v) {
  const m = new Model();
  lot(m, paveMat('#e2d6c0', 2), 1);
  m.cyl(8, 8, 1, 3.6, 2.2, stoneMat('#d6cbb6'), 12, flat('#c9bda6'));
  m.cyl(8, 8, 3.2, 3, 0.05, waterMat('#5cc7d6', '#b8eef3'), 12);
  m.cyl(8, 8, 3, 0.6, 4, stoneMat('#d6cbb6'), 6);
  m.blob(8, 8, 8, 1.1, 2.6, blobMat('#cfeef5'));
  const pal = [[2, 2], [14, 14], [14, 2], [2, 14]];
  for (let i = 0; i < 4; i++) addPalm(m, pal[i][0], pal[i][1], 1, 0.8, v * 4 + i);
  addBench(m, 8, 2.2, 1, 'x'); addBench(m, 8, 13.8, 1, 'x'); addBench(m, 2.2, 8, 1, 'y'); addBench(m, 13.8, 8, 1, 'y');
  if (lv >= 2) { addLamp(m, 4.5, 4.5, 1); addLamp(m, 11.5, 11.5, 1); }
  if (lv >= 3) { addLamp(m, 11.5, 4.5, 1); addLamp(m, 4.5, 11.5, 1); }
  return m;
}

function mPool(lv, v) {
  const m = new Model();
  lot(m, flat('#e9e5dc', 0.04), 1);
  m.box(1.2, 5, 1, 13.6, 8.6, 0.25, flat('#f6f4ef'));
  m.box(2, 5.8, 1.05, 12, 7, 0.25, mat((s, t, f, o) => {
    const lane = (t % 2.33) < 0.3 && s > 1 && s < f.w - 1;
    const w = ((s * 1.7 + t * 0.9) % 4) < 0.5 && hash2(Math.floor(s), Math.floor(t), 2) < 0.5;
    const c = lane ? [235, 245, 250] : w ? [150, 226, 238] : [72, 182, 212];
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  }));
  m.box(1, 0.6, 1, 14, 3.4, 9, { top: flatRoofMat('#d9d4ca'), side: wallMat('#f3efe6', { floorH: 9, base: 2, winH: 4, gap: 3 }) });
  for (let i = 0; i < 4; i++) m.box(2 + i * 3.4, 14.2, 1.2, 1, 1.6, 0.7, flat('#f6f4ef'));
  addUmbrella(m, 4, 14.8, 1.2, '#f4efe2', '#2d5d8e', 1.4);
  addUmbrella(m, 11, 14.8, 1.2, '#f4efe2', '#c2412f', 1.4);
  if (lv >= 2) m.box(12.5, 5.2, 1.2, 1.4, 0.4, 5, flat('#f6f4ef'));
  return m;
}

function mBeachClub(lv, v) {
  const m = new Model();
  m.box(0, 0, 0, 16, 16, 0.8, { top: M_LOT.sand, side: flat('#c9b07a') });
  m.box(1, 1, 0.8, 7, 6, 0.5, M_LOT.wood);
  m.box(1.6, 1.6, 1.3, 5.6, 4.6, 7, { top: flat('#e2c78a'), side: stripeMat('#b9875a', '#a4744b', 0.8) });
  m.hip(1.6, 1.6, 8.3, 5.6, 4.6, 4.5, mat((s, t, f, o) => { const c = (Math.floor(t * 2.5) & 1) ? [214, 186, 120] : [196, 166, 102]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }), 0.9);
  const cols = [['#f4efe2', '#e05a2b'], ['#f4efe2', '#2d8fb3'], ['#f4efe2', '#e0b62b']];
  const n = 3 + lv;
  for (let i = 0; i < n; i++) {
    const x = 3 + (i % 3) * 4.5, y = 9.5 + Math.floor(i / 3) * 4;
    addUmbrella(m, x, y, 0.8, cols[i % 3][0], cols[i % 3][1], 1.9);
    m.box(x - 1.6, y + 0.8, 0.8, 1.3, 2.2, 0.6, flat('#f6f4ef'));
    m.box(x + 0.4, y + 0.8, 0.8, 1.3, 2.2, 0.6, flat('#f6f4ef'));
  }
  addPalm(m, 13.5, 3, 0.8, 0.95, v + 21);
  return m;
}

function mGarden(lv, v) {
  const m = new Model();
  lot(m, M_LOT.dirt, 1);
  const stone = { top: flat('#c9b48e', 0.12), side: stoneMat('#bfae8f') };
  m.box(0.5, 0.5, 1, 15, 8, 6, stone);
  m.box(0.5, 0.5, 7, 9, 5, 5, stone);
  const cactus = flat('#5d8f4a', 0.1);
  const addCactus = (x, y, z, s) => {
    m.cyl(x, y, z, 0.6 * s, 7 * s, cactus, 6);
    m.cyl(x + 0.9 * s, y, z + 2.5 * s, 0.4 * s, 2.5 * s, cactus, 6);
    m.box(x + 0.4 * s, y - 0.2, z + 2.5 * s, 0.6 * s, 0.4, 0.8, cactus);
    m.cyl(x - 0.9 * s, y, z + 3.5 * s, 0.4 * s, 2 * s, cactus, 6);
  };
  const addAgave = (x, y, z) => { for (let i = 0; i < 9; i++) { const a = i * 0.7; m.line(x, y, z, x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, z + 2.4 + (i % 3), hex(i % 2 ? '#7aa7a0' : '#8fbab1')); } };
  addCactus(3, 11, 1, 1); addCactus(12, 13, 1, 0.8); addCactus(13, 4, 7, 0.9); addCactus(3, 3, 12, 0.7);
  addAgave(7, 13, 1); addAgave(10, 10.5, 1); addAgave(6, 4, 12);
  addBush(m, 13, 9.5, 1, 1.2, LEAF.olive, 3);
  // glasshouse
  m.box(9.5, 1, 7, 5.5, 4, 5, { top: null, side: glassMat('#8fb8c0', { floorH: 5, col: 1.4, mullion: '#e9eeee' }) });
  m.gable(9.5, 1, 12, 5.5, 4, 3, 'x', glassMat('#a5c9cf', { floorH: 3, col: 1.4, mullion: '#e9eeee' }), glassMat('#8fb8c0', { floorH: 5, col: 1.4, mullion: '#e9eeee' }), 0.2);
  if (lv >= 2) addPalm(m, 1.8, 14, 1, 0.8, v + 2);
  return m;
}

function mCasino(lv, v) {
  const m = new Model();
  lot(m, M_LOT.grass, 1);
  m.box(0, 12, 1, 16, 4, 0.15, paveMat('#e9e0cc', 1.5));
  const cream = '#f1e4c7', copper = '#6fae9a';
  const wall = wallMat(cream, { floorH: 11, base: 1, groundH: 12, ground: 'arcade', winH: 7, winW: 2, gap: 3, bands: true });
  m.box(1, 2, 1, 14, 10, 34, { top: flatRoofMat('#d8ccb2'), side: wall });
  const copperM = flat(copper, 0.1);
  for (const [x, y] of [[0.5, 9.5], [12.5, 9.5], [12.5, 1.5]]) {
    m.box(x, y, 1, 3, 3, 44, { top: flat(cream), side: wallMat(cream, { floorH: 11, base: 1, winH: 7, winW: 1.2, gap: 3 }) });
    m.pyramid(x - 0.2, y - 0.2, 45, 3.4, 3.4, 9, copperM);
    m.line(x + 1.5, y + 1.5, 54, x + 1.5, y + 1.5, 58, hex('#d9b25a'));
  }
  m.blob(8, 7, 36, 3.2, 7, blobMat(copper));
  m.box(7.5, 6.5, 42, 1, 1, 3, flat('#d9b25a'));
  m.cyl(8, 14, 1, 1.6, 0.6, flat('#e8475b'), 10);
  addPalm(m, 1.5, 14.2, 1, 0.85, 31); addPalm(m, 14.5, 14.2, 1, 0.85, 33);
  return m;
}

// ---------- landmarks and tourism ------------------------------------------------------
function lotN(m, w, h, top, z = 1, edge = M_LOT.edge) { m.box(0, 0, 0, w * 16, h * 16, z, { top, side: edge }); }
// a flag on a pole; colours stack top to bottom (Monaco: red over white)
function addFlag(m, x, y, z, h, cols = ['#ce1126', '#f4efe3']) {
  m.line(x, y, z, x, y, z + h, hex('#d9dcdf'));
  const C = cols.map(hex);
  const fm = mat((s, t, f, o) => { const c = C[Math.min(C.length - 1, Math.floor((1 - t / f.h) * C.length))]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; });
  const fx = x + 0.15;
  m.poly([[fx, y, z + h - 2.6], [fx + 2.4, y, z + h - 2.6], [fx + 2.4, y, z + h], [fx, y, z + h]], [fx, y, z + h - 2.6], [1, 0, 0], [0, 0, 1], fm, 2.4, 2.6, 'flag');
  m.poly([[fx + 2.4, y + 0.01, z + h - 2.6], [fx, y + 0.01, z + h - 2.6], [fx, y + 0.01, z + h], [fx + 2.4, y + 0.01, z + h]], [fx + 2.4, y + 0.01, z + h - 2.6], [-1, 0, 0], [0, 0, 1], fm, 2.4, 2.6, 'flag');
}
// neon strip: dim by day, glowing at night
function neonMat(c) { const C = hex(c); return mat((s, t, f, o) => { o[0] = C[0]; o[1] = C[1]; o[2] = C[2]; return f.night ? 2 : 1; }); }
function colonnadeMat(color, bay = 2.2) {
  const C = hex(color), S = mulC(C, 0.55);
  return mat((s, t, f, o) => {
    const m0 = ((s % bay) + bay) % bay;
    const col = m0 < 0.9 || t < 1.2 || t > f.h - 1.6;
    const c = col ? (m0 < 0.3 && !(t < 1.2 || t > f.h - 1.6) ? mixC(C, [255, 255, 255], 0.25) : C) : S;
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  });
}
function addPeople(m, x, y, z, n, seed, along = 'x') {
  const shirts = ['#e04f3c', '#2d6fb8', '#f2c94c', '#f4f1e8', '#4f8a5b', '#d86f2c', '#7c4f8f'];
  for (let i = 0; i < n; i++) {
    const px = along === 'x' ? x + i * 0.9 : x + (hash2(i, seed, 1) - 0.5) * 0.6, py = along === 'x' ? y + (hash2(i, seed, 2) - 0.5) * 0.6 : y + i * 0.9;
    m.box(px - 0.22, py - 0.22, z, 0.44, 0.44, 2.3, flat('#3a3f52'));
    m.box(px - 0.28, py - 0.28, z + 2.1, 0.56, 0.56, 2, flat(shirts[(i + seed) % shirts.length]));
    m.box(px - 0.2, py - 0.2, z + 4.1, 0.4, 0.4, 0.9, flat(['#e9c4a3', '#c99572', '#8d5a3b'][(i + seed) % 3]));
  }
}

function mGallery(lv, v) {
  const m = new Model();
  lot(m, mat((s, t, f, o) => { const n = hash2(Math.floor(s * 2), Math.floor(t * 2), 5); const c = n < 0.5 ? [222, 216, 204] : [210, 204, 192]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }));
  const white = '#f6f5f1';
  m.box(1, 1, 1, 9, 10, 15, { top: flatRoofMat('#e6e4de'), side: flat(white, 0.03), py: glassMat('#5f7f8f', { floorH: 15, col: 2.2, mullion: '#f6f5f1' }) });
  m.box(10, 1, 1, 5, 6, 22, { top: flatRoofMat('#e6e4de'), side: flat(white, 0.03) });
  m.box(10.4, 6.9, 14, 4.2, 0.2, 5, mat((s, t, f, o) => { o[0] = 196; o[1] = 58; o[2] = 47; if (t > 1 && t < 4 && s > 0.6 && s < 3.6 && (Math.floor(s * 1.5) % 3) !== 2) { o[0] = 250; o[1] = 246; o[2] = 236; } return f.night ? 2 : 1; }));
  // sculptures: a red arc and a stack of stones
  for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI; m.box(11 + Math.cos(a) * 2.2 - 0.4, 11.5, 1 + Math.sin(a) * 5, 0.8, 0.8, 1, flat('#d23a2f')); }
  for (let i = 0; i < 4; i++) m.blob(4 + (i % 2) * 0.3, 13.5, 1.6 + i * 1.6, 1.2 - i * 0.18, 0.9, blobMat(['#3a3f46', '#8a8f96', '#c9a24a', '#e6e4de'][i]));
  addCypress(m, 15, 14.8, 1, 0.7, v); addCypress(m, 1.2, 14.8, 1, 0.7, v + 1);
  return m;
}

function mDisco(lv, v) {
  const m = new Model();
  lot(m, flat('#2a2730', 0.05));
  const dark = mat((s, t, f, o) => {
    const stripe = Math.abs(t - f.h * 0.72) < 0.5 ? [255, 64, 180] : Math.abs(t - f.h * 0.45) < 0.5 ? [64, 230, 240] : null;
    if (stripe) { o[0] = stripe[0]; o[1] = stripe[1]; o[2] = stripe[2]; return f.night ? 2 : 1; }
    const c = (s % 2) < 0.15 ? [46, 40, 58] : [36, 32, 46]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  });
  m.box(1, 1, 1, 13, 11, 16, { top: flatRoofMat('#2f2b38'), side: dark });
  // neon sign, glowing door, mirror ball dome and searchlights
  m.box(3, 12.05, 10, 8, 0.4, 4, mat((s, t, f, o) => { const on = t > 0.6 && t < f.h - 0.6 && s > 0.6 && s < f.w - 0.6 && (Math.floor(s * 1.4) % 3) !== 2; const c = on ? [255, 92, 196] : [30, 26, 40]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return f.night || on ? 2 : 1; }));
  m.box(6, 12.02, 1, 2.4, 0.2, 5, neonMat('#ffb347'));
  m.blob(7.5, 6.5, 19, 2.8, 5.6, mat((nx, ny, nz, P, o) => {
    const fac = (Math.floor((Math.atan2(P[1] - 6.5, P[0] - 7.5) + 4) * 3) + Math.floor(P[2] * 0.8)) & 1;
    const k = clamp(AMB + nx * LW[0] + ny * LW[1] + nz * LW[2], 0.5, 1.3);
    const c = fac ? [226, 232, 240] : [150, 160, 178]; shadeTo(o, c[0], c[1], c[2], k + (fac && nz > 0.4 ? 0.2 : 0)); return 2;
  }, { blob: true }));
  m.line(2.5, 2.5, 17, 0, -4, 60, hex('#e0e4ff')); m.line(12.5, 2.5, 17, 18, -6, 60, hex('#ffd6f0'));
  addPeople(m, 2, 14, 1, 7, v + 3, 'x');
  m.box(1.2, 13.4, 1, 11, 0.15, 1.6, railingMat('#c9a24a'));
  return m;
}

function mMuseum(lv, v) {
  // 2x1: neoclassical portico, side wings and a central dome
  const m = new Model(16, 8);
  lotN(m, 2, 1, paveMat('#e4dccb', 2));
  const stone = '#ece3cf';
  const wing = wallMat(stone, { floorH: 11, base: 2, winH: 7, winW: 1.4, gap: 3.2, bands: true, glass: '#455868' });
  m.box(1, 1.5, 1, 30, 10, 22, { top: flatRoofMat('#d8cfbd'), side: wing });
  m.box(0.6, 1.1, 22, 30.8, 10.8, 1.6, { top: flat(stone), side: flat(mixHex(stone, 0.9)) });
  // portico: steps, six columns, pediment
  for (let i = 0; i < 3; i++) m.box(9 - i * 0.4, 11.5 + i * 1.2, 1, 14 + i * 0.8, 1.2, 2.6 - i * 0.8, { top: flat('#e6decb'), side: flat('#cfc4ad') });
  for (let i = 0; i < 6; i++) m.cyl(10 + i * 2.4, 12.4, 3.4, 0.6, 16, flat('#f3ecdc'), 8, flat('#f3ecdc'));
  m.box(9.2, 11.4, 19.4, 13.6, 2.2, 1.6, { top: flat(stone), side: flat('#e1d7c2') });
  m.facet([[22.8, 13.6, 21], [9.2, 13.6, 21], [16, 13.6, 26]], flat('#e9e0cc'), 'gable');
  m.facet([[9.2, 11.4, 21], [16, 11.4, 26], [16, 13.6, 26], [9.2, 13.6, 21]], roofTileMat('#b8b0a0'));
  m.facet([[22.8, 11.4, 21], [22.8, 13.6, 21], [16, 13.6, 26], [16, 11.4, 26]], roofTileMat('#b8b0a0'));
  // dome on a drum
  m.cyl(16, 6.5, 23.6, 4.6, 6, colonnadeMat('#efe6d2', 1.6), 14, flat('#d9cfbb'));
  m.blob(16, 6.5, 29.6, 4.4, 9, blobMat('#7fa89a'));
  m.cyl(16, 6.5, 37.5, 0.8, 3, flat('#efe6d2'), 8, flat('#c9a24a'));
  addFlag(m, 3, 12.5, 1, 14, ['#ce1126', '#f4efe3']); addFlag(m, 29, 12.5, 1, 14, ['#ce1126', '#f4efe3']);
  addPeople(m, 12, 15.2, 1, 6, v + 7, 'x');
  return m;
}

function mObsTower(lv, v) {
  const m = new Model();
  lot(m, paveMat('#e2d9c6', 2));
  m.box(3, 3, 1, 10, 7, 6, { top: flatRoofMat('#d8d2c4'), side: glassMat('#6f8fa0', { floorH: 6, col: 2, mullion: '#eeeae2' }) });
  const shaft = mat((s, t, f, o) => { const c = (t % 6) < 0.6 ? [206, 200, 188] : [232, 228, 218]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; if (f.night && (t % 18) < 1 && (s % 2) < 1) { o[0] = 255; o[1] = 220; o[2] = 150; return 2; } return 1; });
  m.cyl(8, 8, 7, 2, 110, shaft, 10, null);
  m.cyl(8, 8, 112, 5.4, 2, flat('#e9e5dc'), 16, flat('#d9d4c8'));
  m.cyl(8, 8, 114, 5.0, 7, glassMat('#7fa6bc', { floorH: 7, col: 1.4, mullion: '#e9e5dc' }), 16, null);
  m.cyl(8, 8, 121, 5.6, 1.4, flat('#e9e5dc'), 16, flat('#cfcac0'));
  m.cyl(8, 8, 122.4, 3, 4, flat('#e9e5dc'), 12, flat('#d9d4c8'));
  m.line(8, 8, 126, 8, 8, 150, hex('#d23a2f'));
  m.box(7.7, 7.7, 149, 0.6, 0.6, 1.2, emissive('#ff5040'));
  addPalm(m, 1.8, 14.2, 1, 0.85, v + 2); addPalm(m, 14.2, 14.2, 1, 0.85, v + 5);
  addPeople(m, 4, 12, 1, 4, v, 'x');
  return m;
}

function mAquarium(lv, v) {
  // 2x1 on the beach: the Oceanographic facade rising out of the rocks toward the sea (+Y)
  const m = new Model(16, 8);
  m.box(0, 0, -6, 32, 16, 7, { top: paveMat('#e0d4bc', 2), side: stoneMat('#bdb19a') });
  const stone = '#e7dbc2';
  const arches = mat((s, t, f, o) => {
    const bay = 3.2, m0 = ((s % bay) + bay) % bay, dx = m0 - bay / 2, flH = 11, ft = t % flH, fl = Math.floor(t / flH);
    const win = Math.abs(dx) < 0.8 && ft > 2 && (ft < 7.5 || (ft - 7.5) * (ft - 7.5) + dx * dx < 0.64) && t < f.h - 3;
    if (win) { if (f.night && hash2(Math.floor(s / bay), fl, f.seed) < 0.55) { o[0] = 120; o[1] = 220; o[2] = 255; return 2; } const c = ft > 6 ? [120, 160, 180] : [56, 78, 96]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }
    const band = ft < 1.2 || t > f.h - 2.4;
    const c = band ? [248, 240, 222] : (Math.floor(t / 2) + Math.floor(s / 4)) & 1 ? hex(stone) : mulC(hex(stone), 0.95); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  });
  m.box(1, 1, 1, 30, 12.5, 34, { top: flatRoofMat('#d5cab4'), side: arches });
  m.box(10, 0.5, 1, 12, 13.5, 44, { top: flatRoofMat('#d5cab4'), side: arches });
  m.box(0.6, 0.6, 34, 30.8, 13.3, 1.6, { top: flat(stone), side: flat('#efe4cc') });
  m.blob(16, 7, 45, 5, 9, blobMat('#8aa1a8'));
  m.cyl(16, 7, 52, 1, 4, flat(stone), 8, flat('#c9a24a'));
  for (const x of [3, 29]) { m.cyl(x, 12, 35, 1.6, 5, flat(stone), 10, null); m.pyramid(x - 1.8, 10.2, 40, 3.6, 3.6, 5, flat('#8aa1a8')); }
  for (let i = 0; i < 5; i++) m.blob(2 + i * 7, 15, -3, 2.2, 3.4, blobMat(i % 2 ? '#a7a091' : '#8f887b'));
  addFlag(m, 16, 0.6, 52, 8, ['#ce1126', '#f4efe3']);
  return m;
}

function mMall(lv, v) {
  // 2x2: two shopping wings joined by a glass barrel vault, palms and a parking deck
  const m = new Model(16, 16);
  lotN(m, 2, 2, M_LOT.asphalt);
  for (let i = 0; i < 9; i++) m.box(1 + i * 3.4, 28.5, 1, 0.3, 3, 0.05, flat('#f2eee4'));
  const wing = (x, y, w, d) => m.box(x, y, 1, w, d, 18, { top: flatRoofMat('#d2cdc3'), side: wallMat('#efe9de', { floorH: 9, base: 1, groundH: 9, ground: 'shop', winH: 4, winW: 2.4, gap: 3.4, bands: true, shopGlass: '#4d6a7c' }) });
  wing(1, 1, 30, 9); wing(1, 17, 30, 9.5);
  m.box(1, 10, 1, 30, 7, 14, { top: null, side: glassMat('#86aebf', { floorH: 7, col: 2, mullion: '#f2efe8' }) });
  const vault = glassMat('#a9cbd6', { floorH: 2, col: 2.4, mullion: '#e7ebee' });
  for (let i = 0; i < 6; i++) { const a0 = (i / 6) * Math.PI, a1 = ((i + 1) / 6) * Math.PI; const y0 = 13.5 - Math.cos(a0) * 3.5, y1 = 13.5 - Math.cos(a1) * 3.5, z0 = 15 + Math.sin(a0) * 5, z1 = 15 + Math.sin(a1) * 5; m.facet([[1, y0, z0], [31, y0, z0], [31, y1, z1], [1, y1, z1]], vault); }
  for (const [x, y, s] of [[3, 20, '#2d5d8e'], [17, 20, '#c2412f']]) m.box(x, y + 6.55, 12, 10, 0.3, 3.2, { top: flat(s), side: signMat(s, '#f7f1e3') });
  m.box(31.05, 3, 12, 0.3, 6, 3.2, { top: flat('#2e7b59'), side: signMat('#2e7b59', '#f7f1e3') });
  for (let i = 0; i < 4; i++) addPalm(m, 3 + i * 8.5, 31, 1, 0.85, v + i);
  for (let i = 0; i < 3; i++) { const car = mCar(CAR_COLORS[(i * 3 + v) % 8]); for (const f of car.faces) m.faces.push(shiftFace(f, 4 + i * 10.2, 30, 1, true)); }
  return m;
}

function mZoo(lv, v) {
  const m = new Model(16, 16);
  lotN(m, 2, 2, M_LOT.grass);
  const fence = railingMat('#7a6248');
  // paths
  m.box(14.5, 0, 1, 3, 32, 0.1, M_LOT.dirt); m.box(0, 14.5, 1, 32, 3, 0.1, M_LOT.dirt);
  // savanna enclosure with giraffes
  m.box(1, 1, 1, 12.5, 12.5, 0.1, flat('#c9b07a', 0.1));
  m.box(1, 1, 1.1, 12.5, 12.5, 2, { top: null, side: fence });
  const giraffe = (x, y, s) => {
    const sp = mat((s2, t, f, o) => { const c = hash2(Math.floor(s2 * 2), Math.floor(t * 2), 3) < 0.3 ? [140, 90, 40] : [226, 176, 90]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; });
    for (const [dx, dy] of [[0, 0], [1.4, 0], [0, 0.7], [1.4, 0.7]]) m.box(x + dx, y + dy, 1.1, 0.3, 0.3, 4 * s, flat('#b98a4a'));
    m.box(x - 0.2, y - 0.1, 1.1 + 4 * s, 2, 1.1, 2 * s, sp);
    m.box(x + 1.4, y + 0.2, 1.1 + 5 * s, 0.6, 0.6, 5 * s, sp);
    m.box(x + 1.3, y + 0.1, 1.1 + 10 * s, 1.2, 0.8, 0.9, sp);
  };
  giraffe(4, 5, 1); giraffe(8.5, 8, 0.9);
  addUmbrellaPine(m, 10.5, 3, 1, 0.8, v + 1);
  // elephant house and pond with flamingos
  m.box(18, 1.5, 1, 12, 7, 9, { top: null, side: stoneMat('#d6c4a0') });
  m.gable(18, 1.5, 10, 12, 7, 4, 'x', roofTileMat(TERRACOTTA), stoneMat('#d6c4a0'), 0.4);
  m.blob(22, 11, 4.5, 2.2, 3.6, blobMat('#8f9298')); m.blob(23.9, 11, 4.8, 0.9, 2, blobMat('#8f9298'));
  m.cyl(24, 25, 1, 5.5, 0.2, waterMat('#5cc7d6', '#b8eef3'), 14);
  for (let i = 0; i < 7; i++) { const x = 21 + (i % 4) * 1.5, y = 23 + Math.floor(i / 4) * 2.5; m.line(x, y, 1.2, x, y, 4, hex('#e98aa0')); m.blob(x, y, 4.6, 0.55, 0.9, blobMat('#f29bb2')); }
  // monkey island: rocks and trees
  m.blob(7, 24, 2.5, 3.5, 3, blobMat('#a39a8a')); addPlaneTree(m, 7, 24, 4, 0.7, LEAF.lemon, v + 4);
  m.cyl(7, 24, 1, 5.6, 0.2, waterMat(), 14);
  // entrance gate with a sign
  m.box(13.5, 29, 1, 1, 2, 9, flat('#7a6248')); m.box(18, 29, 1, 1, 2, 9, flat('#7a6248'));
  m.box(13, 29.5, 10, 6.5, 1, 3, { top: flat('#2e7b59'), side: signMat('#2e7b59', '#f4efe2') });
  addPeople(m, 15, 25, 1, 6, v + 11, 'y');
  return m;
}

function mStadium(lv, v) {
  const m = new Model(16, 16);
  lotN(m, 2, 2, flat('#cfcac0', 0.05));
  m.box(5, 5, 1, 22, 22, 0.3, mat((s, t, f, o) => {
    const line = Math.abs(s - 11) < 0.2 || s < 0.4 || t < 0.4 || s > 21.6 || t > 21.6 || Math.abs(Math.hypot(s - 11, t - 11) - 3) < 0.2;
    const stripe = (Math.floor(s / 2.2) & 1);
    const c = line ? [240, 242, 236] : stripe ? [94, 160, 72] : [108, 176, 82]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  }));
  const seats = mat((s, t, f, o) => { const r = Math.floor(t / 1.6); const c = (r % 2) ? [196, 58, 47] : [226, 226, 222]; if ((s % 1.2) < 0.2) { o[0] = 160; o[1] = 156; o[2] = 150; return 1; } o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; });
  const arch = arcadeMat('#e6e1d6', 2.4, { lintel: 2, inside: '#3a3f46' });
  // stands on four sides; the back ones are taller with a roof
  m.box(1, 1, 1, 30, 4, 20, { top: flat('#e4ded2'), side: arch, py: seats });
  m.box(1, 5, 1, 4, 22, 20, { top: flat('#e4ded2'), side: arch, px: seats });
  m.box(5, 27, 1, 26, 4, 9, { top: flat('#e4ded2'), side: arch, ny: seats });
  m.box(27, 5, 1, 4, 22, 9, { top: flat('#e4ded2'), side: arch, nx: seats });
  m.box(0.5, 0.5, 21, 31, 6, 1.2, { top: flat('#d9dde0'), side: flat('#bfc4c8') });
  for (const [x, y] of [[2, 2], [30, 2], [2, 30], [30, 30]]) { m.line(x, y, 1, x, y, 40, hex('#9aa1a8')); m.box(x - 1, y - 1, 39, 2, 2, 3, emissive('#fff6d8')); }
  addFlag(m, 16, 1, 22, 9, ['#ce1126', '#f4efe3']);
  return m;
}

function mCastle(lv, v) {
  // 2x2: the Prince's Palace: crenellated ochre walls, towers, a palace block and the guard gate
  const m = new Model(16, 16);
  lotN(m, 2, 2, paveMat('#d9c9a6', 2));
  const ochre = '#e2c08e', wallS = stoneMat('#d8b98a');
  const cren = (x, y, w, d, z, along) => {
    const n = Math.floor((along === 'x' ? w : d) / 1.6);
    for (let i = 0; i < n; i += 2) {
      if (along === 'x') m.box(x + i * 1.6, y, z, 1.2, d, 1.6, { top: flat('#ead2a6'), side: wallS });
      else m.box(x, y + i * 1.6, z, w, 1.2, 1.6, { top: flat('#ead2a6'), side: wallS });
    }
  };
  // outer walls
  m.box(1, 1, 1, 30, 2, 10, { top: flat('#ead2a6'), side: wallS }); cren(1, 1, 30, 2, 11, 'x');
  m.box(1, 3, 1, 2, 26, 10, { top: flat('#ead2a6'), side: wallS }); cren(1, 3, 2, 26, 11, 'y');
  m.box(29, 3, 1, 2, 26, 10, { top: flat('#ead2a6'), side: wallS }); cren(29, 3, 2, 26, 11, 'y');
  m.box(1, 29, 1, 12, 2, 10, { top: flat('#ead2a6'), side: wallS }); cren(1, 29, 12, 2, 11, 'x');
  m.box(19, 29, 1, 12, 2, 10, { top: flat('#ead2a6'), side: wallS }); cren(19, 29, 12, 2, 11, 'x');
  // gate tower
  m.box(13, 28.5, 1, 6, 3, 16, { top: flat('#ead2a6'), side: wallMat(ochre, { floorH: 99, base: 99 }), py: mat((s, t, f, o) => { if (Math.abs(s - 3) < 1.5 && t < 7 + (1.5 - Math.abs(s - 3)) * 1.2) { o[0] = 50; o[1] = 40; o[2] = 34; return 1; } return wallS.fn(s, t, f, o); }) });
  cren(13, 28.5, 6, 3, 17, 'x');
  // palace block
  m.box(6, 6, 1, 20, 14, 26, { top: flat(ochre), side: wallMat(ochre, { floorH: 9, base: 4, winH: 5, winW: 1.3, gap: 2.6, shutter: '#e9e2d4', bands: true }) });
  m.hip(6, 6, 27, 20, 14, 7, roofTileMat(TERRACOTTA), 0.6);
  // corner towers
  for (const [x, y] of [[2, 2], [30, 2], [2, 30], [30, 30], [26, 20]]) {
    m.cyl(x, y, 1, 2.6, 22, stoneMat('#d8b98a'), 10, flat('#ead2a6'));
    for (let i = 0; i < 10; i += 2) { const a = (i / 10) * Math.PI * 2; m.box(x + Math.cos(a) * 2.2 - 0.5, y + Math.sin(a) * 2.2 - 0.5, 23, 1, 1, 1.6, { top: flat('#ead2a6'), side: wallS }); }
  }
  m.cyl(26, 20, 23, 2.8, 1, flat('#ead2a6'), 10, null); m.pyramid(23.6, 17.6, 24, 4.8, 4.8, 9, roofTileMat(TERRACOTTA));
  // guard boxes and the courtyard
  for (const x of [11, 20]) { m.box(x, 30.8, 1, 1.4, 1.4, 4.5, { top: flat('#ce1126'), side: stripeMat('#ce1126', '#f4efe3', 0.7, 's') }); m.pyramid(x - 0.1, 30.7, 5.5, 1.6, 1.6, 1.4, flat('#ce1126')); }
  m.box(8, 21, 1, 16, 7, 0.2, paveMat('#cdb994', 1.5));
  addFlag(m, 16, 13, 34, 12, ['#ce1126', '#f4efe3']);
  addFlag(m, 2, 2, 24, 7, ['#ce1126', '#f4efe3']); addFlag(m, 30, 30, 24, 7, ['#ce1126', '#f4efe3']);
  addPalm(m, 4.5, 26, 1, 0.8, v + 3); addPalm(m, 27.5, 26, 1, 0.8, v + 6);
  return m;
}

function mTouristCentre(lv, v) {
  const m = new Model();
  lot(m, paveMat('#e6dcc8', 2));
  m.box(2, 2, 1, 9, 8, 10, { top: flatRoofMat('#e9e5dc'), side: glassMat('#6f97a8', { floorH: 10, col: 2.2, mullion: '#f6f4ef' }) });
  m.box(1.4, 1.4, 11, 10.2, 9.2, 1.2, { top: flat('#f6f4ef'), side: flat('#e6e2d8') });
  m.facet([[1.4, 1.4, 12.2], [11.6, 1.4, 12.2], [11.6, 10.6, 15], [1.4, 10.6, 15]], flat('#2d8fb3'));
  // big "i" sign on a pole and a map board
  m.line(13.5, 12.5, 1, 13.5, 12.5, 16, hex('#3a3f46'));
  m.box(12.6, 12.4, 13, 1.8, 0.3, 3, mat((s, t, f, o) => { const i = Math.abs(s - 0.9) < 0.25 && (t < 1.9 || (t > 2.2 && t < 2.6)); const c = i ? [250, 250, 245] : [45, 111, 184]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return f.night ? 2 : 1; }));
  m.box(3, 12.5, 1, 4, 0.3, 4.5, mat((s, t, f, o) => { const c = t < 1.2 ? [90, 90, 90] : (hash2(Math.floor(s * 2), Math.floor(t * 2), 9) < 0.4 ? [120, 180, 110] : [236, 228, 200]); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }));
  addPalm(m, 14, 3, 1, 0.85, v + 1); addPalm(m, 1.5, 14.5, 1, 0.8, v + 2);
  addPeople(m, 8, 13, 1, 3, v + 5, 'x');
  return m;
}

function mGuesthouse(lv, v) {
  const m = new Model();
  lot(m, M_LOT.grass);
  const fc = ['#f0d58e', '#eba892', '#d5e2cb', '#e8b878'][v % 4], sh = ['#4e7c5b', '#2d5d8e', '#58789a'][v % 3];
  const fl = [3, 4, 5][lv - 1], h = 3 + fl * 9;
  m.box(2, 2, 1, 12, 9, h, { top: flat(fc), side: wallMat(fc, { floorH: 9, base: 3, shutter: sh, gap: 2.6 }), py: wallMat(fc, { floorH: 9, base: 3, shutter: sh, gap: 2.6, door: true }) });
  m.hip(2, 2, 1 + h, 12, 9, 6, roofTileMat(TERRACOTTA));
  addFrenchBalconies(m, 2, 14, 11, 1 + 12, fl - 1, 9, 2.6, 'y');
  m.box(4.5, 11.05, 1 + 8, 7, 0.3, 2.2, { top: flat(sh), side: signMat(sh, '#f7f1e3') });
  addUmbrella(m, 3, 13.8, 1, '#f4efe2', sh, 1.5); addUmbrella(m, 13, 13.8, 1, '#f4efe2', sh, 1.5);
  addPalm(m, 14.8, 2, 1, 0.8, v + 4);
  return m;
}

function mHotel(lv, v) {
  // 2x1: Belle Époque grand hotel with corner domes, a canopy and a red carpet
  const m = new Model(16, 8);
  lotN(m, 2, 1, paveMat('#e6dcc6', 1.6));
  const fc = '#f1e6cc';
  const fl = [5, 6, 7][lv - 1], fh = 9, gh = 11, h = gh + fl * fh + 2;
  const wall = belleMat(fc, { floorH: fh, groundH: gh, winH: 6, winW: 1.3, gap: 2.6 });
  m.box(1, 1, 1, 30, 11, h, { top: flatRoofMat('#cfc6b4'), side: wall });
  m.box(0.6, 0.6, h - 0.6, 30.8, 11.8, 1.6, { top: flat(fc), side: flat('#e5d8bb') });
  addFrenchBalconies(m, 1, 31, 12, 1 + gh + 1, fl - 1, fh, 2.6, 'y');
  m.hip(1.6, 1.6, 1 + h, 28.8, 9.8, 8, roofTileMat('#66727e'), 0.2);
  for (const x of [3, 29]) {
    m.cyl(x, 10, 1 + h, 2.6, 6, belleMat(fc, { floorH: 6, groundH: 0, winH: 3.5, winW: 1, gap: 2 }), 12, null);
    m.blob(x, 10, 1 + h + 6, 2.6, 6.5, blobMat('#6f9d8c'));
    m.line(x, 10, 1 + h + 12, x, 10, 1 + h + 16, hex('#c9a24a'));
  }
  // canopy and red carpet
  m.box(12, 12, 1 + gh - 2, 8, 3.4, 0.8, { top: flat('#2f3438'), side: flat('#c9a24a') });
  for (const x of [12.2, 19.4]) m.line(x, 15.2, 1, x, 15.2, 1 + gh - 2, hex('#c9a24a'));
  m.box(14, 12, 1.02, 4, 4, 0.06, flat('#b3262a'));
  for (const x of [6, 26]) addPalm(m, x, 14.2, 1, 0.85, v + x);
  for (const x of [10, 22]) addFlag(m, x, 12.4, 1 + gh, 10, x < 16 ? ['#ce1126', '#f4efe3'] : ['#2d5d8e', '#f4efe3', '#c2412f']);
  return m;
}

// ---------- transport props --------------------------------------------------------
function mBusStop(side) {
  const m = new Model();
  // shelter on the sidewalk strip along +Y edge (y 12.6..15.4); rotated by side when drawn
  m.box(5, 13.6, 0, 0.3, 1.6, 6, flat('#3a3f46'));
  m.box(9, 13.6, 0, 0.3, 1.6, 6, flat('#3a3f46'));
  m.box(5, 15, 0, 4.3, 0.2, 5.4, glassMat('#9fc3d3', { floorH: 6, col: 4.3, mullion: '#3a3f46' }));
  m.box(4.6, 13.3, 6, 5.1, 2.2, 0.7, { top: flat('#e04f3c'), side: flat('#b83d2e') });
  m.box(5.3, 13.9, 1.6, 3.7, 0.8, 0.7, flat('#8d6b4c'));
  m.line(11, 13.2, 0, 11, 13.2, 9, hex('#3a3f46'));
  m.box(10.6, 12.9, 8, 0.8, 0.6, 2.2, { top: flat('#2d6fb8'), side: flat('#2d6fb8') });
  return m;
}

function mStationPart(part) {
  // rails run along X through the tile centre; part 0 = platform on -Y side, 1 = platform on +Y side
  const m = new Model();
  const y0 = part === 0 ? 0.5 : 11.5;
  m.box(0, y0, 0, 16, 4, 2.6, { top: paveMat('#d9d1c2', 1.5), side: flat('#b9b0a0') });
  m.box(0, part === 0 ? y0 + 3.2 : y0, 2.6, 16, 0.8, 0.08, flat('#f0c84a'));
  const cy = part === 0 ? y0 + 1.6 : y0 + 2.4;
  for (const x of [2.5, 8, 13.5]) m.box(x - 0.25, cy - 0.25, 2.6, 0.5, 0.5, 8, flat('#4a5058'));
  m.box(0.5, cy - 2, 10.6, 15, 4, 0.8, { top: flat('#5d7f9a'), side: flat('#476378') });
  if (part === 0) {
    m.box(4, y0 - 0.2, 2.6, 7, 2.4, 7, { top: flatRoofMat('#cfc7b8'), side: wallMat('#efe1c4', { floorH: 99, base: 99 }) });
    m.box(9, cy - 0.2, 7, 2.2, 0.4, 1.4, { top: flat('#2d6fb8'), side: flat('#2d6fb8') });
  } else {
    addBench(m, 5, cy, 2.6, 'x'); addBench(m, 11, cy, 2.6, 'x');
  }
  return m;
}

// Tunnel portal face: rock with a stone-ringed arch scaled to fit the face height
function portalFaceMat(kind, faceH = 40) {
  const rock = hex('#bfb39c'), dark = [24, 21, 20], stone = hex('#d9cdb3'), stoneD = hex('#a99c84');
  const k = clamp((faceH - 2) / 21, 0.45, 1);
  const R = (kind === 'rail' ? 4.2 : 5) * Math.max(0.8, k), base = (kind === 'rail' ? 9 : 8) * k, sy = 2.4 * k;
  return mat((s, t, f, o) => {
    const cx = 8;
    const dx = Math.abs(s - cx), rr = dx < R ? Math.sqrt(R * R - dx * dx) * sy : -1;
    const inArch = dx < R && t < base + rr;
    const ring = dx < R + 1.2 && t < base + (dx < R + 1.2 ? Math.sqrt(Math.max(0, (R + 1.2) ** 2 - dx * dx)) * sy : 0);
    if (inArch) { const g = clamp(t / (base + rr), 0, 1); o[0] = dark[0] + 20 * (1 - g); o[1] = dark[1] + 16 * (1 - g); o[2] = dark[2] + 14 * (1 - g); return 2; }
    if (ring) { const blk = ((Math.floor(Math.atan2(t, s - cx) * 6)) & 1); const c = blk ? stone : stoneD; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }
    const strata = ((t + vnoise(s * 0.3, 1, 5) * 4) % 7) < 1;
    const n = hash2(Math.floor(s), Math.floor(t / 2), 13) * 0.16;
    const c = strata ? mulC(rock, 0.8) : rock; o[0] = c[0] * (0.92 + n); o[1] = c[1] * (0.92 + n); o[2] = c[2] * (0.92 + n); return 1;
  });
}

// ---------- harbour --------------------------------------------------------------
function quay(m) {
  m.box(0, 0, 0, 16, 16, 2, { top: mat((s, t, f, o) => {
    const edge = t > 14.6; const bol = edge && (Math.abs((s % 5.3) - 2.6) < 0.5);
    const n = hash2(Math.floor(s * 1.5), Math.floor(t * 1.5), 8) * 0.07;
    const c = bol ? [70, 72, 78] : edge ? [234, 220, 92] : [196, 190, 178];
    o[0] = c[0] * (0.97 + n); o[1] = c[1] * (0.97 + n); o[2] = c[2] * (0.97 + n); return 1;
  }), side: stoneMat('#8f877a') });
  m.box(0, 16, -6, 16, 0.4, 8, { top: flat('#8f877a'), side: stoneMat('#7d766b') });
}
function addContainers(m, x, y, z, nx, ny, nz, seed) {
  const cols = ['#c2412f', '#2d5d8e', '#2e7b59', '#d68a1e', '#e3c34f', '#7c4f8f', '#d9d4c9'];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    if (k > 0 && hash3(i, j, k, seed) < 0.3) continue;
    const c = cols[Math.floor(hash3(i, j, k, seed + 1) * cols.length)];
    m.box(x + i * 3.1, y + j * 1.5, z + k * 3, 3, 1.4, 3, { top: flat(c), side: stripeMat(c, mixHex(c, 0.82), 0.5, 's') });
  }
}
function mixHex(h, k) { const c = mulC(hex(h), k); return '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function addCrane(m, x, y, z, s, color = '#e3b23c') {
  const C = flat(color), D = flat(mixHex(color, 0.7));
  for (const [dx, dy] of [[0, 0], [3, 0], [0, 3], [3, 3]]) m.box(x + dx, y + dy, z, 0.6, 0.6, 16 * s, { top: C, side: D });
  m.box(x - 0.3, y - 0.3, z + 16 * s, 4.2, 4.2, 4, { top: C, side: { fn: D.fn } });
  m.box(x + 0.5, y + 0.5, z + 20 * s, 3, 3, 4, { top: flat('#f2eee4'), side: wallMat('#f2eee4', { floorH: 99, base: 99 }) });
  // jib raised toward the sea (+Y)
  const bx = x + 1.6, by = y + 2, bz = z + 22 * s;
  for (let i = 0; i < 2; i++) m.line(bx + i * 0.8, by, bz, bx + i * 0.8, by + 10 * s, bz + 22 * s, hex(color));
  m.line(bx + 0.4, by + 10 * s, bz + 22 * s, bx + 0.4, by + 10 * s, bz + 12 * s, hex('#3a3f46'));
}
function mPort(part, lv) {
  const m = new Model();
  quay(m);
  // fenders and ladders along the quay wall
  for (let i = 0; i < 3; i++) m.box(2 + i * 5.3, 16.2, -4, 1.2, 0.5, 2.6, flat('#2b2f36'));
  if (part === 0) {
    // harbour master's office with a clock tower and flags
    const fc = '#f3ead6';
    m.box(1.5, 1.5, 2, 9, 8, 20, { top: flatRoofMat('#d6d0c4'), side: wallMat(fc, { floorH: 9, base: 1, winH: 5, gap: 2.6, shutter: '#2d5d8e', door: true }) });
    m.hip(1.5, 1.5, 22, 9, 8, 5, roofTileMat(TERRACOTTA));
    m.box(7.2, 5.5, 2, 3.6, 3.6, 34, { top: flat(fc), side: wallMat(fc, { floorH: 8, base: 2, winH: 4, winW: 1, gap: 3 }) });
    m.cyl(10.85, 7.3, 28, 1.1, 0.3, flat('#f8f4ea'), 10, null);
    m.box(10.82, 7.25, 28.2, 0.1, 0.12, 0.9, flat('#2b2f36'));
    m.pyramid(6.9, 5.2, 36, 4.2, 4.2, 6, roofTileMat('#5d7f6e'));
    m.line(9, 7.3, 42, 9, 7.3, 47, hex('#c9a24a'));
    addFlag(m, 13, 4, 2, 22, ['#ce1126', '#f4efe3']);
    for (let i = 0; i < 3; i++) m.box(3 + i * 3, 11.5, 2, 1.2, 1.2, 1.2, flat('#6b5139'));
    addLamp(m, 14.5, 13.5, 2, 9);
  } else if (part === 1) {
    if (lv === 0) {
      // fish market: open hall under a striped roof, crates of the morning catch
      for (const [x, y] of [[1.5, 2], [14.5, 2], [1.5, 10], [14.5, 10]]) m.box(x - 0.3, y - 0.3, 2, 0.6, 0.6, 9, flat('#e6e1d6'));
      m.gable(1, 1.5, 11, 14, 9, 4, 'x', stripeMat('#2d5d8e', '#f4efe3', 1.2, 's'), flat('#f4efe3'), 0.6);
      for (let i = 0; i < 4; i++) m.box(2.5 + i * 3, 4, 2, 2.4, 3.5, 1.8, { top: flat(['#8fb7c8', '#d9472b', '#a3b4bd', '#e8c547'][i]), side: flat('#e9e3d6') });
      addPeople(m, 3, 9, 2, 5, 4, 'x');
    } else {
      const corr = stripeMat('#9eb0bd', '#8a9ca9', 0.6, 's');
      m.box(1, 1, 2, 15, 10, 24, { top: flatRoofMat('#aeb7bd'), side: corr, py: mat((s, t, f, o) => { if (t < 9 && ((s % 7) > 1.5 && (s % 7) < 5.5)) { o[0] = 70; o[1] = 74; o[2] = 80; return 1; } return corr.fn(s, t, f, o); }) });
      m.gable(1, 1, 26, 15, 10, 4, 'x', flat('#9aa6ad', 0.05), corr, 0.3);
      m.box(2, 11.05, 18, 10, 0.3, 3, { top: flat('#2d5d8e'), side: signMat('#2d5d8e', '#f7f1e3') });
      addContainers(m, 1, 12, 2, 4, 1, lv, 9);
    }
  } else if (part === 2) {
    const corr = stripeMat('#c9b8a0', '#b5a48c', 0.6, 's');
    const h = 18 + lv * 4;
    m.box(0, 1, 2, 15, 10, h, { top: flatRoofMat('#b9b0a2'), side: corr, py: mat((s, t, f, o) => { if (t < 9 && ((s % 7) > 1.5 && (s % 7) < 5.5)) { o[0] = 70; o[1] = 64; o[2] = 58; return 1; } return corr.fn(s, t, f, o); }) });
    m.gable(0, 1, 2 + h, 15, 10, 4, 'x', roofTileMat('#a8563a'), corr, 0.3);
    if (lv >= 1) addContainers(m, 1, 12, 2, 4, 1, lv, 18);
    else { m.box(2, 12, 2, 5, 2.5, 1.2, flat('#8a6e52')); m.box(9, 12.5, 2, 3, 2, 2.4, { top: flat('#c2412f'), side: flat('#9c3427') }); }
  } else if (part === 3) {
    if (lv === 0) {
      // fishing nets, crates and a small boat on a cradle
      m.prism([[3, 6], [10, 6], [11.5, 7.5], [10, 9], [3, 9]], 3.5, 6, flat('#2d6fb8'), flat('#e9e3d6'));
      m.box(4, 6.5, 2, 1, 2, 1.6, flat('#6b5139')); m.box(9, 6.5, 2, 1, 2, 1.6, flat('#6b5139'));
      m.box(4.5, 6.6, 6, 3, 1.8, 2.4, { top: flat('#f4efe3'), side: wallMat('#f4efe3', { floorH: 3, base: 0.5, winH: 1.2, winW: 0.8, gap: 1.2, sill: false }) });
      m.blob(3, 12, 3, 1.8, 1.4, blobMat('#3f7a6a')); m.blob(6, 12.5, 2.8, 1.5, 1.2, blobMat('#b8463a'));
      addCrates(m, 9, 11.5, 2, 3, 2);
    } else addContainers(m, 1, 1.5, 2, 4, 6, 1 + lv, 17 + lv);
  } else {
    addCrane(m, 5, 8, 2, 1 + lv * 0.3, lv >= 2 ? '#d84a32' : '#e3b23c');
    if (lv >= 1) addContainers(m, 1, 1.5, 2, 4, 2, 2, 41);
    else addCrates(m, 2, 2, 2, 4, 5);
  }
  return m;
}

// ---------- decor ----------------------------------------------------------------
function mJetty(lighthouse) {
  const m = new Model();
  m.box(0, 4, SEA_Z, 16, 8, 8, { top: mat((s, t, f, o) => { const n = hash2(Math.floor(s), Math.floor(t), 6) * 0.08; o[0] = 200 * (0.95 + n); o[1] = 194 * (0.95 + n); o[2] = 182 * (0.95 + n); return 1; }), side: stoneMat('#9a9284') });
  for (let i = 0; i < 6; i++) m.blob(1 + i * 2.8, 12.6, SEA_Z + 1.5, 1.3, 2.4, blobMat(i % 2 ? '#a7a091' : '#8f887b'));
  for (let i = 0; i < 3; i++) addLamp(m, 2 + i * 6, 5, 2, 7);
  if (lighthouse) {
    m.cyl(3, 8, 2, 1.8, 18, mat((s, t, f, o) => { const r = (Math.floor(t / 4.5) & 1); const c = r ? [206, 54, 44] : [240, 238, 232]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }), 10, flat('#3a3f46'));
    m.box(2, 7, 20, 2, 2, 3, mat((s, t, f, o) => { if ((s % 1) < 0.2 || t < 0.3) { o[0] = 58; o[1] = 63; o[2] = 70; return 1; } o[0] = 255; o[1] = 236; o[2] = 160; return f.night ? 2 : 1; }));
    m.pyramid(1.8, 6.8, 23, 2.4, 2.4, 3, flat('#c23a2f'));
  }
  return m;
}
// floating pontoon with cleats; yachts moor on both sides
function mPontoon() {
  const m = new Model();
  m.box(6, 0, SEA_Z, 4, 16, 1.6, { top: stripeMat('#c9a27a', '#b38d66', 0.8, 't'), side: flat('#8d6f52') });
  for (let i = 0; i < 4; i++) { m.box(5.8, 1 + i * 4, SEA_Z + 1.6, 0.4, 0.4, 0.6, flat('#d9dcdf')); m.box(9.8, 1 + i * 4, SEA_Z + 1.6, 0.4, 0.4, 0.6, flat('#d9dcdf')); }
  addLamp(m, 8, 8, SEA_Z + 1.6, 6);
  return m;
}
function mFishBoat(v) {
  const m = new Model(0, 0);
  const hull = [[3.4, 0], [2, 1.3], [-3, 1.3], [-3.2, 0], [-3, -1.3], [2, -1.3]];
  const hc = ['#2d6fb8', '#c2412f', '#2e7b59', '#e3b23c'][v % 4];
  m.prism(hull, SEA_Z, SEA_Z + 2.4, mat((s, t, f, o) => { const c = t > f.h - 0.6 ? [244, 239, 227] : hex(hc); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }), flat('#c9a77c'));
  m.box(-2, -0.9, SEA_Z + 2.4, 2.2, 1.8, 2.4, { top: flat('#f4efe3'), side: wallMat('#f4efe3', { floorH: 3, base: 0.5, winH: 1, winW: 0.7, gap: 1.1, sill: false }) });
  m.line(1, 0, SEA_Z + 2.4, 1, 0, SEA_Z + 9, hex('#c9ccd0'));
  m.line(1, 0, SEA_Z + 8, 3.2, 0, SEA_Z + 3, hex('#9aa1a8'));
  return m;
}
function mYacht(v) {
  const m = new Model(0, 0);
  const L = 7 + (v % 3) * 1.6, Bw = 2.2;
  const hull = [[L / 2, 0], [L / 2 - 1.8, Bw / 2], [-L / 2, Bw / 2], [-L / 2, -Bw / 2], [L / 2 - 1.8, -Bw / 2]];
  m.prism(hull, SEA_Z, SEA_Z + 3, mat((s, t, f, o) => { const c = t < 0.6 ? [40, 60, 90] : [244, 244, 240]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }), flat('#d8c6a2'));
  m.box(-L / 2 + 1, -Bw / 2 + 0.4, SEA_Z + 3, L * 0.5, Bw - 0.8, 3, { top: flat('#f4f4f0'), side: wallMat('#f4f4f0', { floorH: 3, base: 0.5, winH: 1.4, winW: 1, gap: 1.6, glass: '#28323e', sill: false }) });
  if (v % 4 === 3) m.box(-L / 2 + 1.6, -Bw / 2 + 0.6, SEA_Z + 6, L * 0.3, Bw - 1.2, 2, { top: flat('#f4f4f0'), side: glassMat('#28323e', { floorH: 2, col: 1, mullion: '#f4f4f0' }) });
  if (v % 2) m.line(0.5, 0, SEA_Z + 3, 0.5, 0, SEA_Z + 22, hex('#c9ccd0'));
  return m;
}
// street furniture and beach life, each a tiny model anchored at its own point
function mLampPost() { const m = new Model(0, 0); addLamp(m, 0, 0, 0, 9); m.box(-0.8, -0.1, 7.6, 0.8, 0.2, 0.2, flat('#3a3f46')); return m; }
function mParkedCar(c) { return mCar(CAR_COLORS[c % CAR_COLORS.length]); }
function mSunbather(v) {
  const m = new Model(0, 0);
  const towel = ['#e2533d', '#2d6fb8', '#f2b233', '#3fa66a', '#e07ab0', '#f4efe3'][v % 6];
  m.box(-1.6, -0.6, 0, 3.2, 1.2, 0.08, stripeMat(towel, '#f4efe3', 0.6, 's'));
  m.box(-1.1, -0.25, 0.08, 2.2, 0.5, 0.45, flat(['#e9c4a3', '#c99572', '#8d5a3b', '#f1d3b8'][v % 4]));
  if (v % 3 === 0) addUmbrella(m, 1.6, 0.8, 0, '#f4efe2', towel, 1.6);
  return m;
}

// ---------- ships (heading +X, pivot at centre) --------------------------------------
function mShip(size) {
  const m = new Model(0, 0);
  const L = [44, 60, 78][size], Bw = [8, 9.5, 11][size];
  const hullH = [8, 10, 12][size];
  const hull = [[L / 2, 0], [L / 2 - 7, Bw / 2], [-L / 2 + 1, Bw / 2], [-L / 2, Bw / 2 - 1], [-L / 2, -Bw / 2 + 1], [-L / 2 + 1, -Bw / 2], [L / 2 - 7, -Bw / 2]];
  const hullC = ['#2b2f36', '#1f3d5c', '#7a1f1f'][size];
  m.prism(hull, SEA_Z - 1, SEA_Z + hullH, mat((s, t, f, o) => {
    const c = t < 2 ? [168, 44, 36] : t > f.h - 1.2 ? [236, 234, 228] : hex(hullC); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  }), flat('#8a6e52'));
  const dz = SEA_Z + hullH;
  // superstructure at the stern
  const sx = -L / 2 + 2;
  m.box(sx, -Bw / 2 + 1, dz, 7, Bw - 2, 14 + size * 3, { top: flatRoofMat('#e9e6df'), side: wallMat('#f3f1ec', { floorH: 4, base: 1, winH: 2, winW: 1.2, gap: 1.8, sill: false, glass: '#2a3644' }) });
  m.box(sx + 7, -Bw / 2 + 1.6, dz + 9 + size * 3, 1.4, Bw - 3.2, 4, { top: flat('#e9e6df'), side: glassMat('#2a3644', { floorH: 4, col: 1.2, mullion: '#f3f1ec' }) });
  m.box(sx + 2, -1, dz + 14 + size * 3, 2.6, 2, 7, { top: flat('#2b2f36'), side: mat((s, t, f, o) => { const c = t > f.h - 2 ? [43, 47, 54] : [196, 54, 44]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }) });
  // cargo
  const cols = ['#c2412f', '#2d5d8e', '#2e7b59', '#d68a1e', '#e3c34f', '#7c4f8f', '#d9d4c9', '#3f7f9f'];
  const rows = Math.floor((L - 18) / 3.2), lanes = Math.max(2, Math.floor((Bw - 2) / 1.6)), tiers = 1 + size;
  for (let i = 0; i < rows; i++) for (let j = 0; j < lanes; j++) for (let k = 0; k < tiers; k++) {
    if (k > 0 && hash3(i, j, k, size) < 0.25) continue;
    const x = sx + 9 + i * 3.2, y = -Bw / 2 + 1 + j * 1.6;
    if (x + 3 > L / 2 - 6 - (j === 0 || j === lanes - 1 ? 2 : 0)) continue;
    const c = cols[Math.floor(hash3(i, j, k, size + 4) * cols.length)];
    m.box(x, y, dz + k * 3, 3, 1.5, 3, { top: flat(c), side: stripeMat(c, mixHex(c, 0.8), 0.5, 's') });
  }
  return m;
}

// ---------- road vehicles (heading +X, pivot at centre) ---------------------------------
const WHEEL = flat('#1e2226');
function addWheels(m, xs, hw) { for (const x of xs) for (const y of [-hw - 0.05, hw - 0.35]) m.box(x - 0.45, y, 0, 0.9, 0.4, 0.9, WHEEL); }
function mCar(color, kind = 0) {
  const m = new Model(0, 0);
  const C = flat(color), glass = flat('#2a3542');
  addWheels(m, [-1.1, 1.1], 0.85);
  m.box(-1.8, -0.85, 0.6, 3.6, 1.7, 2.2, { top: C, side: C });
  m.box(-1.0, -0.75, 2.8, 1.9, 1.5, 1.7, { top: C, side: glass });
  m.box(1.75, -0.6, 1.2, 0.1, 0.4, 0.6, flat('#fff3c8'));
  m.box(1.75, 0.2, 1.2, 0.1, 0.4, 0.6, flat('#fff3c8'));
  m.box(-1.85, -0.6, 1.4, 0.1, 1.2, 0.4, flat('#c7372f'));
  return m;
}
function mBus(color = '#2d6fb8') {
  const m = new Model(0, 0);
  addWheels(m, [-2.2, 2.2], 1);
  m.box(-3.3, -1, 0.6, 6.6, 2, 6.4, { top: flat('#e9ecef'), side: mat((s, t, f, o) => {
    const c = t > 2.6 && t < 5 ? ((s % 1.4) < 0.25 ? [233, 236, 239] : [42, 53, 66]) : t > 5.6 ? [233, 236, 239] : hex(color); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  }) });
  m.box(-1, -0.6, 7, 2.4, 1.2, 0.6, flat('#cfd3d6'));
  return m;
}
function mCoach(color = '#7a3b6b') {
  const m = new Model(0, 0);
  addWheels(m, [-2.8, -1.9, 2.6], 1);
  m.box(-3.9, -1, 0.6, 7.8, 2, 6.8, { top: flat('#f2efe8'), side: mat((s, t, f, o) => {
    const c = t > 2.8 && t < 5.6 ? ((s % 1.8) < 0.2 ? [242, 239, 232] : [36, 40, 52]) : t < 2.2 ? hex(color) : (s > 1 && s < 5 && t > 6 ? hex(color) : [242, 239, 232]); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  }) });
  return m;
}
function mTruck(color = '#e9e4d8') {
  const m = new Model(0, 0);
  addWheels(m, [-2.1, 0.4, 2.3], 0.95);
  m.box(-3, -0.95, 0.6, 4.4, 1.9, 5.2, { top: flat(color), side: mat((s, t, f, o) => { const c = t > 1.6 && t < 3.6 && s > 0.6 && s < f.w - 0.6 && f.w > 3 ? [46, 125, 89] : hex(color); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }) });
  m.box(1.6, -0.9, 0.6, 1.6, 1.8, 3.8, { top: flat('#2e7b59'), side: mat((s, t, f, o) => { const c = t > 2 ? [42, 53, 66] : [46, 123, 89]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }) });
  return m;
}
function mF1Car(color) {
  const m = new Model(0, 0);
  const C = flat(color);
  addWheels(m, [-1.6, 1.5], 0.95);
  m.box(-2.2, -0.45, 0.35, 4.6, 0.9, 0.7, { top: C, side: C });
  m.box(-1.1, -0.75, 0.35, 1.8, 1.5, 0.6, { top: C, side: C });
  m.box(2.2, -1, 0.3, 0.5, 2, 0.25, flat('#2b2f36'));
  m.box(-2.6, -0.9, 1.2, 0.5, 1.8, 0.35, C);
  m.box(-0.5, -0.25, 1.05, 0.6, 0.5, 0.45, flat('#f2c94c'));
  return m;
}
function mTrainCar(kind = 0, color) {
  const m = new Model(0, 0);
  if (kind === 2) { // freight flatcar with containers
    m.box(-3.6, -1, 0.8, 7.2, 2, 1.2, flat('#3a3f46'));
    const cols = ['#c2412f', '#2d5d8e', '#2e7b59', '#d68a1e'];
    m.box(-3.4, -0.9, 2, 3.3, 1.8, 3.4, { top: flat(cols[0]), side: stripeMat(cols[0], mixHex(cols[0], 0.8), 0.5) });
    m.box(0.1, -0.9, 2, 3.3, 1.8, 3.4, { top: flat(cols[1]), side: stripeMat(cols[1], mixHex(cols[1], 0.8), 0.5) });
    return m;
  }
  const body = kind === 3 ? '#f2efe8' : kind === 1 ? '#c2412f' : '#f0e6cf', band = color || (kind === 1 ? '#f0e6cf' : '#c2412f');
  m.box(-3.6, -1.1, 0.8, 7.2, 2.2, 6, { top: flat('#cfd3d6'), side: mat((s, t, f, o) => {
    let c = hex(body);
    if (t > 2.8 && t < 4.9) c = (s % 1.5) < 0.3 ? hex(body) : [42, 53, 66];
    else if (t < 1.4 || (kind === 3 && t > 5.2)) c = hex(band);
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  }) });
  return m;
}
function mPerson(color, skin, hat) {
  const m = new Model(0, 0);
  m.box(-0.25, -0.25, 0, 0.5, 0.5, 2.6, flat('#3a3f52'));
  m.box(-0.3, -0.3, 2.4, 0.6, 0.6, 2.2, flat(color));
  m.blob(0, 0, 5.3, 0.3, 0.8, blobMat(skin));
  if (hat) m.box(-0.38, -0.38, 5.9, 0.76, 0.76, 0.35, flat(hat));
  return m;
}
function mSailboat(v) {
  const m = new Model(0, 0);
  const hull = [[3, 0], [1.6, 1], [-2.6, 1], [-2.6, -1], [1.6, -1]];
  m.prism(hull, SEA_Z, SEA_Z + 1.6, flat('#f4f4f0'), flat('#c9a77c'));
  m.line(0.4, 0, SEA_Z + 1.6, 0.4, 0, SEA_Z + 16, hex('#c9ccd0'));
  m.poly([[0.5, 0, SEA_Z + 3], [0.5, 0, SEA_Z + 15], [-2.4, 0, SEA_Z + 3]], [0.5, 0, SEA_Z + 3], [-1, 0, 0], [0, 0, 1], flat(v % 2 ? '#f6f2e6' : '#f1d9c4'), 3, 12, 'sail');
  m.poly([[-2.4, 0.01, SEA_Z + 3], [0.5, 0.01, SEA_Z + 15], [0.5, 0.01, SEA_Z + 3]], [0.5, 0.01, SEA_Z + 3], [-1, 0, 0], [0, 0, -1], flat(v % 2 ? '#f6f2e6' : '#f1d9c4'), 3, 12, 'sail');
  return m;
}

// construction site with a frame rising to the final height
function mSite(stage, h) {
  const m = new Model();
  lot(m, M_LOT.dirt, 1);
  const fh = Math.max(4, Math.round(h * (stage + 1) / 4));
  const frame = mat((s, t, f, o) => { if ((t % 8) < 1.2 || (s % 3) < 0.6) { o[0] = 160; o[1] = 158; o[2] = 150; return 1; } return 0; });
  m.box(2.5, 2.5, 1, 11, 11, fh, { top: null, side: frame });
  m.box(2.5, 2.5, 1, 11, 11, Math.max(1, fh - 8), { top: flat('#b9b4a8'), side: flat('#a9a497') });
  m.line(13.5, 13.5, 1, 13.5, 13.5, fh + 20, hex('#e3b23c'));
  m.line(13.2, 13.5, fh + 20, 3, 13.5, fh + 20, hex('#e3b23c'));
  m.line(6, 13.5, fh + 20, 6, 13.5, fh + 8, hex('#3a3f46'));
  m.box(12.8, 12.8, fh + 18, 1.4, 1.4, 2, flat('#e3b23c'));
  return m;
}


const MODEL_FN = {
  cottage: mCottage, townhouse: mTownhouse, apartment: mApartment, belle: mBelle, villa: mVilla, tower: mTower, skyscraper: mSkyscraper,
  grocer: mGrocer, supermarket: mSupermarket, markethall: mMarketHall, boutique: mBoutique, fashion: mFashion, dept: mDept,
  hardware: mHardware, electronics: mElectronics, homecenter: mHomecenter,
  park: mPark, cafe: mCafe, plaza: mPlaza, pool: mPool, beachclub: mBeachClub, garden: mGarden,
  gallery: mGallery, disco: mDisco, museum: mMuseum, obstower: mObsTower, aquarium: mAquarium, mall: mMall, zoo: mZoo,
  stadium: mStadium, casino: mCasino, castle: mCastle,
  tourist: mTouristCentre, guesthouse: mGuesthouse, hotel: mHotel,
};
// highest point of a building model (faces and blobs; antennas excluded), cached per type and level
const _topCache = {};
function modelTop(type, lv = 1) {
  const key = type + '|' + lv;
  if (_topCache[key] == null) {
    let z = 8;
    const fn = MODEL_FN[type];
    if (fn) {
      const m = fn(Math.min(lv, B[type].maxLevel || 3), 0);
      for (const f of m.faces) for (const p of f.pts) if (p[2] > z) z = p[2];
      for (const b of m.blobs) if (b.cz + b.rz > z) z = b.cz + b.rz;
    } else if (type === 'port') z = 40;
    else if (type === 'station') z = 12;
    _topCache[key] = z;
  }
  return _topCache[key];
}
