// ---------------------------------------------------------------------------
// Terrain: the sea is painted per pixel into one canvas per view; every land
// tile (with its level, ramp, roads, terrace walls and baked shadows), each
// mountain tile and each bridge deck is a small sprite sorted with buildings.
// ---------------------------------------------------------------------------
const SEA_RAMP = ['#6ccdd2', '#4db4cb', '#3496bd', '#2a7cad', '#246897'].map(hex);
const SEA_DEEP = SEA_RAMP[4];
const SAND = ['#ead9a7', '#e0cb93', '#f2e5bf', '#d3bb84'].map(hex);
const ROCKS = ['#a59d90', '#bdb5a6', '#857e73', '#cfc7b8'].map(hex);
const GRASS = ['#6a9443', '#7ca44c', '#8fb257', '#a3c062'].map(hex);
const WALK = hex('#d6ccb8'), WALK_J = hex('#c3b8a3'), CURB = hex('#efe9dc'), CURB_D = hex('#a69d8d');
const ASPH = hex('#5f636b'), ASPH_L = hex('#6c7078'), PAINT = hex('#ece6d6');
const BALLAST = hex('#8e8476'), SLEEPER = hex('#6a5038'), RAIL_HI = hex('#d5d9dd');
const KERB_R = hex('#d8402f'), KERB_W = hex('#f4efe3');

// view-local (u', v') in units -> world-local (u, v)
function viewToWorldLocal(view, up, vp) { return view === 3 ? [16 - vp, up] : [up, vp]; }

function roadColor(u, v, mask, out, wx, wy, circuit) {
  const inB = (c) => c >= 4 && c < 12;
  const arms = ((mask & 1) ? 1 : 0) + ((mask & 2) ? 1 : 0) + ((mask & 4) ? 1 : 0) + ((mask & 8) ? 1 : 0);
  let asphalt = false;
  if (inB(u) && inB(v)) asphalt = true;
  else if (inB(v) && (((mask & 2) && u >= 8) || ((mask & 8) && u < 8))) asphalt = true;
  else if (inB(u) && (((mask & 1) && v < 8) || ((mask & 4) && v >= 8))) asphalt = true;
  if (asphalt) {
    let c = hash2(Math.floor(wx * 1.5), Math.floor(wy * 1.5), 21) < 0.12 ? ASPH_L : ASPH;
    if (hash2(Math.floor(wx / 3), Math.floor(wy / 3), 23) < 0.05 && hash2(Math.floor(wx), Math.floor(wy), 24) < 0.5) c = mulC(c, 0.9);
    const straightEW = (mask & 10) === 10 && !(mask & 5), straightNS = (mask & 5) === 5 && !(mask & 10);
    const centre = inB(u) && inB(v);
    if (circuit) {
      // grid boxes at the start line, otherwise a clean racing line
      if (Math.abs(v - 8) < 0.45 && straightEW && ((wx % 8) + 8) % 8 < 1) c = PAINT;
      if (Math.abs(u - 8) < 0.45 && straightNS && ((wy % 8) + 8) % 8 < 1) c = PAINT;
    } else {
      if (straightEW || (!centre && (((mask & 2) && u >= 12) || ((mask & 8) && u < 4)))) { if (Math.abs(v - 8) < 0.45 && (((wx % 5) + 5) % 5) < 2.6) c = PAINT; }
      if (straightNS || (!centre && (((mask & 1) && v < 4) || ((mask & 4) && v >= 12)))) { if (Math.abs(u - 8) < 0.45 && (((wy % 5) + 5) % 5) < 2.6) c = PAINT; }
      if (arms >= 3) { // zebra crossings just outside the junction
        if (((mask & 2) && u >= 12.6 && u < 14.4) || ((mask & 8) && u < 3.4 && u >= 1.6)) { if (((v - 4) % 1.6) < 0.8) c = PAINT; }
        if (((mask & 1) && v < 3.4 && v >= 1.6) || ((mask & 4) && v >= 12.6 && v < 14.4)) { if (((u - 4) % 1.6) < 0.8) c = PAINT; }
      }
    }
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    return;
  }
  // curb: sidewalk pixels adjacent to asphalt (red and white kerbs on the circuit)
  const near = (uu, vv) => (inB(uu) && inB(vv)) || (inB(vv) && (((mask & 2) && uu >= 8) || ((mask & 8) && uu < 8))) || (inB(uu) && (((mask & 1) && vv < 8) || ((mask & 4) && vv >= 8)));
  if (near(u + 0.8, v) || near(u - 0.8, v) || near(u, v + 0.8) || near(u, v - 0.8)) {
    let c = (near(u + 0.8, v) || near(u, v + 0.8)) ? CURB_D : CURB;
    if (circuit) c = (Math.floor((wx + wy) / 1.6) & 1) ? KERB_R : KERB_W;
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; return;
  }
  if (circuit && (near(u + 2, v) || near(u - 2, v) || near(u, v + 2) || near(u, v - 2))) { const c = [96, 100, 108]; out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; return; }
  const j = ((wx % 2) + 2) % 2 < 0.4 || ((wy % 2) + 2) % 2 < 0.4;
  const c = j ? WALK_J : WALK;
  const n = (hash2(Math.floor(wx / 2), Math.floor(wy / 2), 31) - 0.5) * 0.06;
  out[0] = c[0] * (1 + n); out[1] = c[1] * (1 + n); out[2] = c[2] * (1 + n);
}

function railColor(u, v, mask, out, onRoad) {
  const m = mask || 10; // an isolated piece is drawn east-west
  let ball = false, rail = false, sleeper = false;
  if (m === 3 || m === 6 || m === 12 || m === 9) {
    const cx = (m & 2) ? 16 : 0, cy = (m & 1) ? 0 : 16;
    const r = Math.hypot(u - cx, v - cy);
    if (r >= 4.6 && r <= 11.4) {
      ball = true;
      rail = Math.abs(r - 6.6) < 0.5 || Math.abs(r - 9.4) < 0.5;
      const ang = Math.atan2(v - cy, u - cx);
      sleeper = (((ang * 16 / Math.PI) % 1) + 1) % 1 < 0.42;
    }
  } else {
    const bandV = v >= 4.6 && v <= 11.4, bandU = u >= 4.6 && u <= 11.4;
    const ew = bandV && (((m & 2) && u >= 4.6) || ((m & 8) && u <= 11.4));
    const ns = bandU && (((m & 1) && v <= 11.4) || ((m & 4) && v >= 4.6));
    if (ew) { ball = true; rail = rail || Math.abs(v - 6.6) < 0.5 || Math.abs(v - 9.4) < 0.5; sleeper = sleeper || (u % 2) < 0.8; }
    if (ns) { ball = true; rail = rail || Math.abs(u - 6.6) < 0.5 || Math.abs(u - 9.4) < 0.5; sleeper = sleeper || (v % 2) < 0.8; }
  }
  if (!ball) return false;
  let c;
  if (rail) c = RAIL_HI;
  else if (onRoad) return false;
  else if (sleeper) c = SLEEPER;
  else c = hash2(Math.floor(u * 3), Math.floor(v * 3), 41) < 0.3 ? mulC(BALLAST, 0.86) : BALLAST;
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  return true;
}

// ---- shadows ----------------------------------------------------------------------
// Shadows fall to the right of the screen, slightly away from the camera, in every view.
const SHADOW_V = [0.243, -0.970];
const SHADOW_LEN = 0.8;            // shadow length per metric unit of height
function shadowDir() { return G.view === 3 ? [-SHADOW_V[1], SHADOW_V[0]] : SHADOW_V; }
// sidewalk tree spots on a road tile: [u, v, armDir]
const TREE_SPOTS = [[8, 2.2, 0], [13.8, 8, 1], [8, 13.8, 2], [2.2, 8, 3]];
function roadTreeSpots(x, y) {
  const k = G.idx(x, y), out = [];
  if (!(G.net[k] & N_ROAD) || (G.net[k] & (N_PORTAL | N_RAIL)) || G.ramp[k]) return out;
  const mask = netMask(G, x, y, N_ROAD), stop = G.busStops.get(k);
  for (const [u, v, d] of TREE_SPOTS) {
    if (mask & (1 << d)) continue;
    if (stop && stop.side === d) continue;
    if (hash2(x * 4 + d, y, 77) < 0.08) continue;
    out.push([u, v, d]);
  }
  return out;
}
function shadowCasters(x, y, zHere) {
  const out = [], seen = new Set();
  const [dx, dy] = shadowDir();
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
    // only tiles on the lit side can shade this one
    if (i * dx + j * dy > 1.2) continue;
    const tx = x + i, ty = y + j;
    if (!G.inMap(tx, ty)) continue;
    const id = G.bid[G.idx(tx, ty)];
    if (id && !seen.has(id)) {
      seen.add(id);
      const b = G.buildings.get(id);
      if (!b || !b.done) continue;
      const [w, h] = sizeOf(b.type);
      const top = (b.type === 'port' ? 26 : modelTop(b.type, b.lv) * 0.92) + tileLevel(b.x, b.y) * STEP - zHere;
      if (top > 3) out.push({ kind: 0, x0: b.x * 16 + 1.4, y0: b.y * 16 + 1.4, x1: (b.x + w) * 16 - 1.4, y1: (b.y + h) * 16 - 1.4, h: top / ZK * SHADOW_LEN });
    }
    if (Math.abs(i) <= 2 && Math.abs(j) <= 2) {
      const tz = surfaceZ(tx + 0.5, ty + 0.5) - zHere;
      for (const [u, v] of roadTreeSpots(tx, ty)) {
        const off = (11 + tz) / ZK * SHADOW_LEN;
        out.push({ kind: 1, cx: tx * 16 + u + dx * off, cy: ty * 16 + v + dy * off, r2: 7.5 });
      }
    }
  }
  return out;
}
function inShadow(casters, wx, wy) {
  const [dx, dy] = shadowDir();
  const lx = -dx, ly = -dy;
  for (const c of casters) {
    if (c.kind === 1) { const ex = wx - c.cx, ey = wy - c.cy; if (ex * ex + ey * ey < c.r2) return true; continue; }
    // slab test of the ray toward the light against the building box
    let t0 = -1e9, t1 = 1e9;
    if (Math.abs(lx) < 1e-6) { if (wx < c.x0 || wx > c.x1) continue; } else { let a = (c.x0 - wx) / lx, b = (c.x1 - wx) / lx; if (a > b) { const q = a; a = b; b = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (Math.abs(ly) < 1e-6) { if (wy < c.y0 || wy > c.y1) continue; } else { let a = (c.y0 - wy) / ly, b = (c.y1 - wy) / ly; if (a > b) { const q = a; a = b; b = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (t1 >= Math.max(t0, 0) && Math.max(t0, 0) <= c.h) return true;
  }
  return false;
}

// ---- land pixels -----------------------------------------------------------------------
function tileInfo(x, y) {
  const k = G.idx(x, y), map = G.map;
  const isSea = (i, j) => G.inMap(i, j) && map.type[j * MAP_W + i] === T_SEA;
  const info = {
    type: map.type[k],
    road: !!(G.net[k] & N_ROAD), rail: !!(G.net[k] & N_RAIL),
    roadMask: netMask(G, x, y, N_ROAD), railMask: netMask(G, x, y, N_RAIL),
    circuit: !!(G.net[k] & N_CIRCUIT),
    seaN: isSea(x, y - 1), seaS: isSea(x, y + 1), seaW: isSea(x - 1, y), seaE: isSea(x + 1, y),
    rocks: [], casters: null,
  };
  if (map.type[k] === T_BEACH) {
    const t = x - PLAY_X0;
    const rocky = (t >= 15 && t <= 26) || t <= 3 || t >= 66 ? 0.75 : 0.22;
    const n = hash2(x, y, 101) < rocky ? 1 + Math.floor(hash2(x, y, 102) * 4) : 0;
    for (let i = 0; i < n; i++) {
      let rx = 2 + hash2(x, y, 110 + i) * 12, ry = 2 + hash2(x, y, 120 + i) * 12;
      if (info.seaS) ry = 9 + hash2(x, y, 130 + i) * 6;
      info.rocks.push([rx, ry, 1 + hash2(x, y, 140 + i) * 1.7]);
    }
  }
  info.casters = shadowCasters(x, y, surfaceZ(x + 0.5, y + 0.5));
  return info;
}

function landPixel(x, y, u, v, info, out) {
  const wx = x * 16 + u, wy = y * 16 + v;
  let done = false;
  if (info.road || info.rail) {
    if (info.road) {
      roadColor(u, v, info.roadMask, out, wx, wy, info.circuit);
      if (info.rail) { const s0 = out[0], s1 = out[1], s2 = out[2]; if (!railColor(u, v, info.railMask, out, true)) { out[0] = s0; out[1] = s1; out[2] = s2; } }
      done = true;
    } else done = railColor(u, v, info.railMask, out, false);
  }
  if (!done && info.type === T_BEACH) {
    let c = null;
    for (const r of info.rocks) {
      const dx = u - r[0], dy = v - r[1];
      if (dx * dx + dy * dy < r[2] * r[2]) {
        const lit = (-dx - dy) / (r[2] * 1.4) + (hash2(Math.floor(wx * 2), Math.floor(wy * 2), 9) - 0.5) * 0.4;
        c = lit > 0.45 ? ROCKS[3] : lit > -0.1 ? ROCKS[1] : lit > -0.6 ? ROCKS[0] : ROCKS[2];
        break;
      }
    }
    if (!c) {
      const n = vnoise(wx * 0.22, wy * 0.22, 7) + (hash2(Math.floor(wx * 2), Math.floor(wy * 2), 8) - 0.5) * 0.5;
      c = n < 0.3 ? SAND[1] : n > 0.8 ? SAND[2] : SAND[0];
      if (hash2(Math.floor(wx * 2), Math.floor(wy * 2), 12) < 0.015) c = ROCKS[2];
      let edge = 99;
      if (info.seaN) edge = Math.min(edge, v); if (info.seaS) edge = Math.min(edge, 16 - v);
      if (info.seaW) edge = Math.min(edge, u); if (info.seaE) edge = Math.min(edge, 16 - u);
      if (edge < 3) c = mixC(c, SAND[3], edge < 1.4 ? 0.9 : 0.45);
      // seaweed line and footprints
      if (edge > 3.4 && edge < 3.9 && hash2(Math.floor(wx), Math.floor(wy), 13) < 0.5) c = mixC(c, [120, 110, 80], 0.4);
    }
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; done = true;
  }
  if (!done) {
    // grass plot: mown stripes, tufts and wildflowers; plot edges slightly darker
    const n = fbm(wx * 0.045, wy * 0.045, 2, 3) * 1.2 + (hash2(Math.floor(wx * 2), Math.floor(wy * 2), 4) - 0.5) * 0.35;
    let c = GRASS[clamp(Math.floor(n * 2.6), 0, 3)];
    if (((Math.floor(wx / 4) + Math.floor(wy / 16)) & 1) && n > 0.45) c = mixC(c, GRASS[3], 0.18);
    const h = hash2(Math.floor(wx * 2), Math.floor(wy * 2), 5);
    if (h < 0.0025) c = [244, 240, 228]; else if (h < 0.0038) c = [240, 200, 70]; else if (h < 0.0046) c = [222, 120, 150];
    else if (h > 0.985) c = mulC(c, 0.82);
    if (u < 0.5 || v < 0.5) c = mulC(c, 0.9);
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  }
  if (info.casters.length && inShadow(info.casters, wx, wy)) shadeTo(out, out[0], out[1], out[2], 0.74);
}

// ---- sea canvas ------------------------------------------------------------------------
function seaPixel(x, y, u, v, px, py, info) {
  const map = G.map;
  const fx = x + u / 16 - 0.5, fy = y + v / 16 - 0.5;
  const ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
  const E = map.ext;
  const sd = (i, j) => { const ei = i + E.PX, ej = j + E.PB; return (ei < 0 || ej < 0 || ei >= E.EW || ej >= E.EH) ? 8 : Math.min(8, E.shore[ej * E.EW + ei]); };
  const d = lerp(lerp(sd(ix, iy), sd(ix + 1, iy), ax), lerp(sd(ix, iy + 1), sd(ix + 1, iy + 1), ax), ay);
  const lv = clamp((d - 0.6) / 1.35, 0, 3.999);
  const li = Math.floor(lv), lf = lv - li;
  let c = lf > bayer(px, py) ? SEA_RAMP[Math.min(4, li + 1)] : SEA_RAMP[li];
  let edge = 99;
  if (info.landN) edge = Math.min(edge, v); if (info.landS) edge = Math.min(edge, 16 - v);
  if (info.landW) edge = Math.min(edge, u); if (info.landE) edge = Math.min(edge, 16 - u);
  if (edge < 1.6) {
    const f = (1.6 - edge) / 1.6 + (hash2(px >> 1, py, 3) - 0.5) * 0.5;
    if (f > 0.55) c = [236, 248, 246]; else if (f > 0.3) c = mixC(c, [220, 244, 244], 0.5);
  }
  if (hash2(Math.floor(px / 5), py, 17) < 0.016 && d > 1.4) c = mixC(c, [210, 238, 245], 0.55);
  // rocky shallows near the cliffs
  if (d < 1.2 && hash2(Math.floor(px / 3), Math.floor(py / 2), 19) < 0.06) c = mixC(c, [70, 120, 120], 0.35);
  return packC(c);
}

// land on each side of a sea tile, looking past the map edge into the scenery
function extTypeAt(x, y) { const E = G.map.ext, i = x + E.PX, j = y + E.PB; return (i < 0 || j < 0 || i >= E.EW || j >= E.EH) ? -1 : E.type[j * E.EW + i]; }
function seaInfo(x, y) {
  const land = (i, j) => { const t = extTypeAt(i, j); return t >= 0 && t !== T_SEA; };
  return { landN: land(x, y - 1), landS: land(x, y + 1), landW: land(x - 1, y), landE: land(x + 1, y) };
}

class Ground {
  constructor() { this.cv = null; }
  layout(view) {
    const VW = view === 3 ? MAP_H : MAP_W, VH = view === 3 ? MAP_W : MAP_H;
    this.VW = VW; this.VH = VH; this.OX = VH * HTW; this.OY = 0;
    this.W = (VW + VH) * HTW; this.H = (VW + VH) * HTH + 10;
  }
  build(view) {
    this.view = view;
    this.layout(view);
    if (!this.cv) this.cv = document.createElement('canvas');
    this.cv.width = this.W; this.cv.height = this.H;
    const ctx = this.cv.getContext('2d');
    const img = ctx.createImageData(this.W, this.H);
    const buf = new Uint32Array(img.data.buffer);
    const map = G.map;
    for (let s = 0; s < this.VW + this.VH - 1; s++) {
      for (let a = Math.max(0, s - this.VH + 1); a <= Math.min(s, this.VW - 1); a++) {
        const b = s - a;
        const [x, y] = G.worldOf(a, b);
        if (map.type[y * MAP_W + x] !== T_SEA) continue;
        this.rasterSea(buf, a, b, x, y);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  rasterSea(buf, a, b, x, y) {
    const BW = this.W, BH = this.H;
    const info = seaInfo(x, y);
    const topX = (a - b) * HTW + this.OX, topY = (a + b) * HTH + this.OY - SEA_Z;
    for (let dy = 0; dy < TH; dy++) {
      const py = topY + dy; if (py < 0 || py >= BH) continue;
      const half = dy < HTH ? (dy + 1) * 2 : (TH - dy) * 2;
      for (let dx = -half; dx < half; dx++) {
        const px = topX + dx; if (px < 0 || px >= BW) continue;
        const sx = dx + 0.5, sy = dy + 0.5;
        const up = (sy + sx / 2) / 2, vp = (sy - sx / 2) / 2;
        if (up < 0 || vp < 0 || up >= 16 || vp >= 16) continue;
        const [u, v] = viewToWorldLocal(this.view, up, vp);
        buf[py * BW + px] = seaPixel(x, y, u, v, px, py, info);
      }
    }
  }
}

// ---- terrace walls, banks and tunnel mouths -------------------------------------------------
const ROCK_C = ['#c9c3b5', '#aaa294', '#dfdacf', '#8c8478', '#b9b1a1'].map(hex);
const SCRUB_C = ['#7a8a4a', '#5b6b37', '#94a35b', '#b09b76', '#6c7d42'].map(hex);
const WALL_STONE = hex('#d6c7a8'), WALL_JOINT = hex('#ad9f84'), WALL_COPE = hex('#ece3cf');
const BOUGAIN = [hex('#c23a7a'), hex('#e0569a'), hex('#4f7a3a')];
// retaining wall: coursed stone, a pale coping under a grass or sand lip, bougainvillea here and there
function terraceMat(x, y, d, ha, hb, base, lip) {
  return mat((s, t, f, o) => {
    const Z = base + t, top = lerp(ha, hb, clamp(s / 16, 0, 1));
    if (Z > top - 1.1) { const c = lip; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }
    if (Z > top - 2.2) { o[0] = WALL_COPE[0]; o[1] = WALL_COPE[1]; o[2] = WALL_COPE[2]; return 1; }
    const wx = x * 16 + (d === 0 || d === 2 ? s : 0) + y * 7, row = Math.floor(Z / 2.6), off = (row & 1) * 1.6;
    const joint = (Z % 2.6 + 2.6) % 2.6 < 0.55 || ((s + off + wx) % 3.2 + 3.2) % 3.2 < 0.45;
    let c = joint ? WALL_JOINT : WALL_STONE;
    const n = (hash2(Math.floor((s + off) / 3.2) + x * 13, row + y * 7, 11) - 0.5) * 0.14;
    c = mulC(c, 1 + n);
    if (top - base > 10 && hash2(x * 4 + d, y, 51) < 0.4) {
      const vine = vnoise((s + x * 16) * 0.35, Z * 0.3, 52 + d) - (top - Z) / (top - base) * 0.55;
      if (vine > 0.42) c = BOUGAIN[(hash2(Math.floor(s * 2), Math.floor(Z * 2), 53) * 3) | 0];
    }
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  });
}
function bankMat(top, base, sand) {
  return mat((s, t, f, o) => {
    const Z = base + t;
    let c;
    if (Z > top - 1.6) c = sand ? SAND[3] : GRASS[0];
    else { const n = hash2(Math.floor(s * 1.5), Math.floor(Z / 2), 61); c = n < 0.4 ? ROCKS[0] : n < 0.7 ? ROCKS[2] : ROCKS[1]; }
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  });
}
// edge heights of any tile at the shared edge with direction d (0 N, 1 E, 2 S, 3 W): [a, b] in this tile's corner order
const EDGE_IDX = [[0, 1], [1, 2], [2, 3], [3, 0]];
const EDGE_PTS = [[[0, 0], [16, 0]], [[16, 0], [16, 16]], [[16, 16], [0, 16]], [[0, 16], [0, 0]]];
function anyCorners(x, y) {
  if (!G.inMap(x, y)) return null;
  const t = G.map.type[G.idx(x, y)];
  if (t === T_SEA) return [SEA_Z - 1, SEA_Z - 1, SEA_Z - 1, SEA_Z - 1];
  return corners(x, y);
}
// height of the neighbour across edge d at this tile's two edge endpoints
function neighbourEdge(x, y, d) {
  const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
  const nc = anyCorners(nx, ny);
  if (!nc) return null;
  const o = EDGE_IDX[OPP[d]];
  // the neighbour's opposite edge runs the other way round
  return [nc[o[1]], nc[o[0]]];
}
// is the neighbour across edge d the end tile of a tunnel that enters this tile?
function tunnelMouth(x, y, d) {
  const s = G.spanTile.get(G.idx(x, y));
  if (!s || s.kind !== 'tunnel') return null;
  const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
  if ((nx === s.ax && ny === s.ay) || (nx === s.bx && ny === s.by)) return s;
  return null;
}
function addSkirts(m, x, y, c, lipC, isMount) {
  const type = G.map.type[G.idx(x, y)];
  for (let d = 0; d < 4; d++) {
    const ne = neighbourEdge(x, y, d);
    if (!ne) continue;
    const ha = c[EDGE_IDX[d][0]], hb = c[EDGE_IDX[d][1]];
    const ba = Math.min(ha, ne[0]), bb = Math.min(hb, ne[1]);
    if (ha - ba < 0.5 && hb - bb < 0.5) continue;
    const [pa, pb] = EDGE_PTS[d];
    const ux = (pb[0] - pa[0]) / 16, uy = (pb[1] - pa[1]) / 16;
    const base = Math.min(ba, bb);
    const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
    const nt = G.map.type[G.idx(nx, ny)];
    let mt;
    const mouth = tunnelMouth(x, y, d) || ((G.net[G.idx(x, y)] & N_PORTAL) && d === 2 ? { bit: G.isRailPortal(x, y) ? N_RAIL : N_ROAD } : null);
    if (mouth) mt = portalFaceMat(mouth.bit === N_RAIL ? 'rail' : 'road', Math.min(ha, hb) - base);
    else if (isMount) mt = nt === T_SEA ? CLIFF_MAT : WALL_MAT;
    else if (nt === T_SEA) mt = bankMat(Math.max(ha, hb), base, type === T_BEACH);
    else mt = terraceMat(x, y, d, ha, hb, base, lipC);
    const pts = [];
    pts.push([pb[0], pb[1], bb], [pa[0], pa[1], ba]);
    if (ha - ba > 0.01) pts.push([pa[0], pa[1], ha]);
    if (hb - bb > 0.01) pts.push([pb[0], pb[1], hb]);
    if (pts.length < 3) continue;
    m.poly(pts, [pa[0], pa[1], base], [ux, uy, 0], [0, 0, 1], mt, 16, Math.max(ha, hb) - base, 'skirt');
  }
}

// a land tile: its surface (flat or a ramp) and walls down to lower neighbours
function landModel(x, y) {
  const m = new Model();
  const c = corners(x, y);
  const P = [[0, 0, c[0]], [16, 0, c[1]], [16, 16, c[2]], [0, 16, c[3]]];
  const info = tileInfo(x, y);
  // cliff tops catch the light, and higher terraces read a touch brighter
  const low = [0, 1, 2, 3].map((d) => { const ne = neighbourEdge(x, y, d); return !!ne && (c[EDGE_IDX[d][0]] - ne[0] > 2 || c[EDGE_IDX[d][1]] - ne[1] > 2); });
  const lift = 1 + clamp(G.lvl[G.idx(x, y)], -3, 4) * 0.035;
  const top = mat((s, t, f, o) => {
    const F = f.f;
    const X = F.o[0] + s * F.u[0] + t * F.v[0], Y = F.o[1] + s * F.u[1] + t * F.v[1];
    landPixel(x, y, clamp(X, 0, 15.999), clamp(Y, 0, 15.999), info, o);
    let k = lift;
    if ((low[0] && Y < 0.8) || (low[2] && Y > 15.2) || (low[3] && X < 0.8) || (low[1] && X > 15.2)) k *= 1.16;
    if (k !== 1) { o[0] = Math.min(255, o[0] * k); o[1] = Math.min(255, o[1] * k); o[2] = Math.min(255, o[2] * k); }
    return 1;
  });
  if (c[0] === c[1] && c[1] === c[2] && c[2] === c[3]) m.poly(P, P[0], [1, 0, 0], [0, 1, 0], top, 16, 16, 'land');
  else {
    const tri = (a, b2, d) => { const [u, v] = triFrame(P[a], P[b2], P[d]); m.poly([P[a], P[b2], P[d]], P[a], u, v, top, 16, 16, 'land'); };
    if (Math.abs(c[0] - c[2]) <= Math.abs(c[1] - c[3])) { tri(0, 1, 2); tri(0, 2, 3); } else { tri(1, 2, 3); tri(1, 3, 0); }
  }
  const lip = info.type === T_BEACH ? SAND[3] : (info.road ? CURB : GRASS[0]);
  addSkirts(m, x, y, c, lip, false);
  return m;
}

// ---- mountain tiles -------------------------------------------------------------------------
// ---- the mountain's surface: rock, scrub, forest and snow -----------------------------------------
// One function colours and lights every point of the mountain, both the map's own tiles and the
// landscape beyond the map, so the two always match. It is drawn as pixel art:
//  - light comes from smooth per-vertex normals (no visible tile triangles) plus craggy relief on the
//    rock, and is kept to a few steps with an ordered dither on the screen's own pixel grid;
//  - textures are 3D, so steep faces are not streaked by stretching;
//  - little pixel trees (stone pines, holm oaks, cypresses and, higher up, firs) stand on the gentler
//    slopes and cast short shadows, and snow lies on the high summits and in their gullies.
const ROCK_P = ['#8b8376', '#a19a8c', '#b6af9f', '#c9c2b3', '#dcd7cb'].map(hex);
const OCHRE_P = ['#93806a', '#a9957b', '#beaa8f', '#d0c0a5'].map(hex);
const SCRUB_P = ['#4a5d32', '#5c713b', '#718744', '#879b51', '#9fae64'].map(hex);
const SOIL_P = ['#8e7b5c', '#a5906d', '#b9a580'].map(hex);
const SNOW_P = ['#a9b7c6', '#c3cfdb', '#dbe3ea', '#eef2f5', '#fbfcfd'].map(hex);
const SNOW_Z = 1480, TREE_Z = 1150, LSTEP = 0.07;
function terrainLight(nx, ny, nz) {
  if (G.view === 3) { const t = nx; nx = ny; ny = -t; }
  return clamp(AMB + nx * LW[0] + ny * LW[1] + nz * LW[2], 0.3, 1.2);
}
// how rocky the ground is: steep and high ground is bare (above ~0.55)
function rockiness(wx, wy, wz, flat, Z) {
  return smooth(clamp((0.7 - flat) / 0.32, 0, 1)) + smooth(clamp((Z - 450) / 700, 0, 1)) * 0.4
    + (fbm3(wx * 0.04, wy * 0.04, wz * 0.04, 3, 2) - 0.5) * 1.1;
}
// height of the mountain surface at world tile point (fx, fy) (clamped to the generated field)
function mtnZ(E, fx, fy) {
  const lx = clamp(fx, -E.PX + 1e-3, MAP_W + E.PX - 1e-3), ly = clamp(fy, -E.PB + 1e-3, E.EH - E.PB - 1e-3);
  const tx = Math.floor(lx), ty = Math.floor(ly);
  return extMountZ(E, tx + E.PX, ty + E.PB, lx - tx, ly - ty);
}

// ---- mountain trees ----
// Trees sit on a jittered grid of cells (TC tiles); how likely a cell holds one comes from a density
// field kept at half-tile steps over the whole landscape (forest patches, gentle ground, below the
// tree line, not on rock, not on the villas' plots).
const TC = 0.24, SHX = 4, SHY = -1, TS = 1.3;
function treeDensity(wx, wy, Z, flat) {
  const wz = Z / ZK;
  const rk = rockiness(wx, wy, wz, flat, Z);
  const forest = fbm3(wx * 0.02, wy * 0.02, wz * 0.02, 41, 3);
  return (0.08 + smooth(clamp((forest - 0.4) / 0.2, 0, 1)) * 0.86)
    * clamp((flat - 0.42) / 0.25, 0, 1) * clamp(1 - (Z - TREE_Z) / 260, 0, 1) * clamp((0.52 - rk) / 0.2, 0, 1);
}
function mountTrees(E) {
  if (E.tr) return E.tr;
  const W2 = 2 * E.EW + 1, H2 = 2 * E.EH + 1, VW = E.EW + 1, N = W2 * H2;
  const T = new Float32Array(N), D = new Float32Array(N), tmp = new Float32Array(N);
  const villa = new Set();
  for (const t of R.mtn || []) if (t.kind === 'villa') villa.add((t.y + E.PB) * E.EW + t.x + E.PX);
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
    const ia = (i - 1) >> 1, ib = i >> 1, ja = (j - 1) >> 1, jb = j >> 1;
    let ok = true;
    for (let tj = ja; tj <= jb && ok; tj++) for (let ti = ia; ti <= ib; ti++) {
      if (ti < 0 || tj < 0 || ti >= E.EW || tj >= E.EH) continue;
      const k = tj * E.EW + ti;
      if (E.type[k] !== T_MOUNT || villa.has(k)) { ok = false; break; }
    }
    if (!ok) continue;
    const vi = i >> 1, vj = j >> 1, u = (i & 1) * 0.5, v = (j & 1) * 0.5;
    const vi1 = Math.min(vi + 1, E.EW), vj1 = Math.min(vj + 1, E.EH);
    const bl = (A) => lerp(lerp(A[vj * VW + vi], A[vj * VW + vi1], u), lerp(A[vj1 * VW + vi], A[vj1 * VW + vi1], u), v);
    T[j * W2 + i] = treeDensity((i / 2 - E.PX) * 16, (j / 2 - E.PB) * 16, bl(E.hv), bl(E.slopeV));
  }
  // the densest cell within a tile or so of each node: a quick "no trees near here" test
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
    let m = 0;
    for (let d = -3; d <= 3; d++) { const ii = i + d; if (ii >= 0 && ii < W2 && T[j * W2 + ii] > m) m = T[j * W2 + ii]; }
    tmp[j * W2 + i] = m;
  }
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
    let m = 0;
    for (let d = -4; d <= 2; d++) { const jj = j + d; if (jj >= 0 && jj < H2 && tmp[jj * W2 + i] > m) m = tmp[jj * W2 + i]; }
    D[j * W2 + i] = m;
  }
  E.tr = { W2, H2, T, D };
  return E.tr;
}
// tree density at world tile point (fx, fy): A = TF.T (smooth) or TF.D (the "near here" maximum)
function treeP(TF, E, A, fx, fy) {
  const gx = clamp((fx + E.PX) * 2, 0, TF.W2 - 1.001), gy = clamp((fy + E.PB) * 2, 0, TF.H2 - 1.001);
  const i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j, k = j * TF.W2 + i;
  return lerp(lerp(A[k], A[k + 1], u), lerp(A[k + TF.W2], A[k + TF.W2 + 1], u), v);
}
// the pixel trees, drawn once with the same leafy blobs as the town's trees, at about 60% size
let MTS = null;
function mtSprites() {
  if (MTS) return MTS;
  const HOLM = ['#34472a', '#435a31', '#57703c', '#6f8849'], FIR = ['#1f3826', '#2a4930', '#375d3b', '#4a7449'];
  const make = (build) => { const m = new Model(); build(m); for (const b of m.blobs) { b.cx = 8 + (b.cx - 8) * TS; b.cy = 8 + (b.cy - 8) * TS; b.cz *= TS; b.rx *= TS; b.ry *= TS; b.rz *= TS; } for (const l of m.lines) { l.a = [8 + (l.a[0] - 8) * TS, 8 + (l.a[1] - 8) * TS, l.a[2] * TS]; l.b = [8 + (l.b[0] - 8) * TS, 8 + (l.b[1] - 8) * TS, l.b[2] * TS]; } const s = renderModel(m, 0, { keepData: true }); return { w: s.w, h: s.h, ax: s.ax, ay: s.ay, d: s.data }; };
  const list = [
    // 0, 1: stone pines
    (m) => { m.line(8, 8, 0, 8.3, 8, 5.2, hex('#6a5341')); m.blob(8.4, 8, 6.6, 2.1, 1.7, leafMat(LEAF.pine, 61, 1.1)); m.blob(7.4, 8.5, 6.0, 1.3, 1.3, leafMat(LEAF.pine, 61, 1.1)); },
    (m) => { m.line(8, 8, 0, 7.7, 8, 4.4, hex('#6a5341')); m.blob(7.6, 8, 5.8, 1.8, 1.5, leafMat(LEAF.pine, 62, 1.1)); },
    // 2, 3: holm oaks
    (m) => { m.line(8, 8, 0, 8, 8, 2, hex('#5a4636')); m.blob(8, 8, 4.4, 1.9, 2.9, leafMat(HOLM, 63, 1.2)); m.blob(7.2, 8.6, 3.4, 1.2, 2, leafMat(HOLM, 64, 1.2)); },
    (m) => { m.line(8, 8, 0, 8, 8, 1.6, hex('#5a4636')); m.blob(8, 8, 3.7, 1.6, 2.5, leafMat(HOLM, 65, 1.2)); },
    // 4, 5: firs and black pines
    (m) => { m.line(8, 8, 0, 8, 8, 1.5, hex('#4e3d30')); m.blob(8, 8, 3.2, 1.6, 2.4, leafMat(FIR, 66, 1.3)); m.blob(8, 8, 6, 1.15, 2.2, leafMat(FIR, 66, 1.3)); m.blob(8, 8, 8.5, 0.7, 1.8, leafMat(FIR, 66, 1.3)); },
    (m) => { m.line(8, 8, 0, 8, 8, 1.2, hex('#4e3d30')); m.blob(8, 8, 2.8, 1.35, 2, leafMat(FIR, 67, 1.3)); m.blob(8, 8, 5.2, 0.95, 1.9, leafMat(FIR, 67, 1.3)); m.blob(8, 8, 7.3, 0.55, 1.5, leafMat(FIR, 67, 1.3)); },
    // 6: cypress
    (m) => { m.blob(8, 8, 5.6, 0.85, 5.4, leafMat(LEAF.cypress, 68, 1.2)); },
  ];
  MTS = list.map(make);
  let xl = 0, xr = 0, yl = 0, yh = 0;
  for (const s of MTS) { xl = Math.max(xl, s.w - s.ax); xr = Math.max(xr, s.ax); yl = Math.max(yl, s.h - s.ay); yh = Math.max(yh, s.ay); }
  // range of base offsets (from the pixel, in screen px) whose crown or shadow could reach a pixel
  MTS.XL = -xl - SHX - 1; MTS.XR = xr + 1; MTS.YL = -yl - 1 + Math.min(0, -SHY); MTS.YH = yh + 1 + Math.max(0, -SHY);
  return MTS;
}
function treeKind(h2, h3, z) {
  const r = (h2 * 7.13 + h3 * 3.71) % 1, v = ((h2 * 53.7) | 0) & 1;
  if (z > 950) return r < 0.82 ? 4 + v : 2 + v;
  if (z > 450) return r < 0.55 ? 2 + v : r < 0.9 ? 4 + v : 6;
  return r < 0.4 ? v : r < 0.82 ? 2 + v : 6;
}
const portalNear = (x, y) => {
  for (let j = Math.max(0, y - 1); j <= Math.min(MAP_H - 1, y + 1); j++) for (let i = Math.max(0, x - 1); i <= Math.min(MAP_W - 1, x + 1); i++) if (G.net[j * MAP_W + i] & N_PORTAL) return true;
  return false;
};
// Does a tree's crown (1) or its shadow (2) cover screen pixel (SX, SY), whose ground point is at
// world (fx, fy), view depth dP? Ground slope (gx, gy) is in px of height per tile. Crown colour into o.
const TCC_MASK = 8191;
const TCC = { E: null, view: -1, i: new Int32Array(TCC_MASK + 1), j: new Int32Array(TCC_MASK + 1), k: new Int8Array(TCC_MASK + 1), d: new Float64Array(TCC_MASK + 1), x: new Int32Array(TCC_MASK + 1), y: new Int32Array(TCC_MASK + 1) };
// forget the cached trees (new map, turned view, or a tunnel dug where trees stood)
function clearTreeCache(E) { TCC.E = E || null; TCC.view = G.view; TCC.i.fill(-2147483648); }
function treeOver(E, TF, fx, fy, gx, gy, SX, SY, dP, o) {
  const S = mtSprites(), v3 = G.view === 3;
  // a base dX, dY screen px away (dY > 0: below) lies about (da, db) away in view tiles
  const gA = v3 ? gy : gx, gB = v3 ? -gx : gy;
  const kA = Math.max(4, 16 - gA), kB = Math.max(4, 16 - gB), inv = 1 / (kA + kB);
  let aLo = 1e9, aHi = -1e9, bLo = 1e9, bHi = -1e9;
  for (let c = 0; c < 4; c++) {
    const dX = c & 1 ? S.XR : S.XL, dY = c & 2 ? S.YH : S.YL;
    const u = dX / 32, db = (dY - kA * u) * inv, da = db + u;
    if (da < aLo) aLo = da; if (da > aHi) aHi = da; if (db < bLo) bLo = db; if (db > bHi) bHi = db;
  }
  aLo = Math.max(aLo, -1.2) - 0.04; aHi = Math.min(aHi, 1.2) + 0.04; bLo = Math.max(bLo, -1.2) - 0.04; bHi = Math.min(bHi, 1.2) + 0.04;
  // back to world tiles
  let x0, x1, y0, y1;
  if (v3) { x0 = fx - bHi; x1 = fx - bLo; y0 = fy + aLo; y1 = fy + aHi; } else { x0 = fx + aLo; x1 = fx + aHi; y0 = fy + bLo; y1 = fy + bHi; }
  const i0 = Math.floor(x0 / TC), i1 = Math.floor(x1 / TC), j0 = Math.floor(y0 / TC), j1 = Math.floor(y1 / TC);
  let best = -1e9, col = 0, shadow = false;
  if (TCC.E !== E || TCC.view !== G.view) clearTreeCache(E);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    // each cell's tree is worked out once and kept in a small cache: neighbouring pixels share cells
    const slot = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) & TCC_MASK;
    if (TCC.i[slot] !== i || TCC.j[slot] !== j) {
      TCC.i[slot] = i; TCC.j[slot] = j; TCC.k[slot] = -1;
      const h = hash2(i, j, 77), h2 = hash2(i, j, 78), h3 = hash2(i, j, 79);
      const bx = (i + 0.12 + 0.76 * h2) * TC, by = (j + 0.12 + 0.76 * h3) * TC;
      if (h < treeP(TF, E, TF.T, bx, by) && !(bx >= 0 && by >= 0 && bx < MAP_W && by < MAP_H && portalNear(bx | 0, by | 0))) {
        const zb = mtnZ(E, bx, by);
        const ab = v3 ? by : bx, bb = v3 ? MAP_W - bx : by;
        TCC.k[slot] = treeKind(h2, h3, zb); TCC.d[slot] = ab + bb;
        TCC.x[slot] = Math.floor((ab - bb) * 32); TCC.y[slot] = Math.floor((ab + bb) * 16 - zb);
      }
    }
    const kind = TCC.k[slot];
    if (kind < 0) continue;
    const dB = TCC.d[slot];
    if (dB < dP - 0.08 || dB <= best) continue;
    const s = S[kind];
    const ix = s.ax + SX - TCC.x[slot], iy = s.ay + SY - TCC.y[slot];
    if (ix >= 0 && iy >= 0 && ix < s.w && iy < s.h) {
      const c = s.d[iy * s.w + ix];
      if (c >>> 24) { best = dB; col = c; continue; }
    }
    const jx = ix - SHX, jy = iy - SHY;
    if (!shadow && jx >= 0 && jy >= 0 && jx < s.w && jy < s.h && s.d[jy * s.w + jx] >>> 24) shadow = true;
  }
  if (col) { o[0] = col & 255; o[1] = (col >>> 8) & 255; o[2] = (col >>> 16) & 255; return 1; }
  return shadow ? 2 : 0;
}

// craggy relief: sharp-crested ridged noise, stretched up and down the faces into flutes and
// buttresses; the normal (nx, ny, nz) is tilted along the surface by its slope, into CR
const CR = [0, 0, 1];
function crag(wx, wy, wz, nx, ny, nz, BS) {
  let gx = 0, gy = 0, gz = 0;
  for (let q = 0; q < 2; q++) {
    const f = q ? 0.21 : 0.085, w = q ? 0.55 : 1;
    const n = vnoise3d(wx * f, wy * f, wz * f * 0.45, 31 + q) * 2 - 1, sg = n > 0 ? -w : w;
    gx += VD[0] * f * sg; gy += VD[1] * f * sg; gz += VD[2] * f * 0.45 * sg;
  }
  const dn = gx * nx + gy * ny + gz * nz;
  const x = nx - (gx - dn * nx) * BS, y = ny - (gy - dn * ny) * BS, z = nz - (gz - dn * nz) * BS;
  const l = Math.hypot(x, y, z); CR[0] = x / l; CR[1] = y / l; CR[2] = z / l;
}
// colour of the mountain at world tile point (fx, fy), height Z (px) into o; returns the light factor
function mountainSurface(E, fx, fy, Z, o) {
  const lx = clamp(fx, -E.PX + 1e-3, MAP_W + E.PX - 1e-3), ly = clamp(fy, -E.PB + 1e-3, E.EH - E.PB - 1e-3);
  const i0 = Math.floor(lx), j0 = Math.floor(ly), u = lx - i0, v = ly - j0;
  const VW = E.EW + 1, b = (j0 + E.PB) * VW + i0 + E.PX;
  const bil = (A) => lerp(lerp(A[b], A[b + 1], u), lerp(A[b + VW], A[b + VW + 1], u), v);
  let nx = bil(E.nx), ny = bil(E.ny), nz = bil(E.slopeV);
  const flat = nz;
  const wx = fx * 16, wy = fy * 16, wz = Z / ZK;
  // the screen pixel this point lands on: ordered dither and tree sprites are aligned to it
  const v3 = G.view === 3, va = v3 ? fy : fx, vb = v3 ? MAP_W - fx : fy;
  const SX = Math.floor((va - vb) * 32), SY = Math.floor((va + vb) * 16 - Z);
  const bd = BAYER[(SY & 3) * 4 + (SX & 3)];
  // trees stand in front of whatever ground is behind them
  const TF = mountTrees(E);
  let shade = 1, forest = 0;
  const dmax = treeP(TF, E, TF.D, fx, fy);
  if (dmax > 0.003) {
    const gs = ZK * 16 / Math.max(0.12, nz);
    const r = treeOver(E, TF, fx, fy, -nx * gs, -ny * gs, SX, SY, va + vb, o);
    if (r === 1) return 1;
    if (r === 2) shade = 0.74;
    forest = treeP(TF, E, TF.T, fx, fy);
  }
  // snow on the summits, lying on gentle ground and in the gullies first, with rock showing through
  if (Z > SNOW_Z - 330) {
    const line = SNOW_Z + (fbm(wx * 0.011, wy * 0.011, 21, 2) - 0.5) * 380;
    const lie = (Z - line) / 150 + (flat - 0.45) * 1.5 + (vnoise3(wx * 0.1, wy * 0.1, wz * 0.035, 24) - 0.5) * 1.3
      + (vnoise3(wx * 0.35, wy * 0.35, wz * 0.35, 26) - 0.5) * 0.35;
    if (lie > 0) {
      crag(wx, wy, wz, nx, ny, nz, 2.6);
      const k = terrainLight(CR[0], CR[1], CR[2]) * shade;
      const c = SNOW_P[clamp(Math.floor((k - 0.55) / 0.17 + 0.5 + (bd - 0.5) * 0.6), 0, 4)];
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      return 1;
    }
  }
  const rk = rockiness(wx, wy, wz, flat, Z);
  if (rk + (bd - 0.5) * 0.03 > 0.55) {
    // limestone: broad patches of tone, faint bedding and warm staining
    const big = fbm3(wx * 0.018, wy * 0.018, wz * 0.03, 51, 2);
    const bed = vnoise(wz * 0.08 + big * 5, (wx + wy) * 0.006, 52);
    const fine = vnoise3(wx * 0.24, wy * 0.24, wz * 0.24, 53);
    const T = big * 0.62 + bed * 0.27 + fine * 0.14 - 0.015;
    const c = ROCK_P[clamp(Math.floor((T - 0.5) * 10 + 2.5 + (bd - 0.5) * 0.35), 0, 4)];
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    const st = vnoise3(wx * 0.02, wy * 0.02, wz * 0.02, 56) + (fine - 0.5) * 0.2;
    if (st > 0.62) { const t = Math.min(0.42, (st - 0.62) * 3); o[0] += (OCHRE_P[1][0] - o[0]) * t; o[1] += (OCHRE_P[1][1] - o[1]) * t; o[2] += (OCHRE_P[1][2] - o[2]) * t; }
    crag(wx, wy, wz, nx, ny, nz, 5.5);
    nx = CR[0]; ny = CR[1]; nz = CR[2];
  } else {
    // scrub and meadow, darker on the forest floor, with bare earth here and there
    const n1 = fbm3(wx * 0.07, wy * 0.07, wz * 0.07, 8, 2), n2 = vnoise3(wx * 0.4, wy * 0.4, wz * 0.4, 9);
    const soil = vnoise3(wx * 0.05, wy * 0.05, wz * 0.05, 10) + (n2 - 0.5) * 0.25 + rk * 0.25;
    let c;
    if (soil > 0.86 && forest < 0.35) c = SOIL_P[clamp(Math.floor(n2 * 3 + (bd - 0.5) * 0.3), 0, 2)];
    else {
      const g = n1 * 0.62 + n2 * 0.38 - forest * 0.3 + (rk - 0.3) * 0.12;
      c = SCRUB_P[clamp(Math.floor((g - 0.5) * 9 + 2.5 + (bd - 0.5) * 0.3), 0, 4)];
    }
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
  }
  const l = Math.hypot(nx, ny, nz);
  const k = terrainLight(nx / l, ny / l, nz / l) * shade;
  return Math.floor(k / LSTEP + 0.5 + (bd - 0.5) * 0.6) * LSTEP;
}
function terrainMatFor(tx, ty) {
  const E = G.map.ext;
  return mat((s, t, f, o) => {
    const F = f.f;
    const X = F.o[0] + s * F.u[0] + t * F.v[0], Y = F.o[1] + s * F.u[1] + t * F.v[1], Z = F.o[2] + s * F.u[2] + t * F.v[2];
    const k = mountainSurface(E, tx + clamp(X / 16, 0, 1), ty + clamp(Y / 16, 0, 1), Z, o);
    o[3] = k / f.k; // replaces the flat triangle's light with the smooth one
    return 1;
  });
}
const WALL_MAT = stoneMat('#d3c4a6');
function cliffRGB(s, t, o) {
  const strata = ((t + vnoise(s * 0.3, 2, 5) * 3) % 6) < 1;
  const n = hash2(Math.floor(s * 1.5), Math.floor(t / 2), 19);
  const c = strata ? ROCK_C[3] : n < 0.3 ? ROCK_C[1] : ROCK_C[0];
  o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
}
const CLIFF_MAT = mat((s, t, f, o) => { cliffRGB(s, t, o); return 1; });
function terrainModel(x, y) {
  const m = new Model();
  const c = tileCorners(G.map, x, y);
  const P = [[0, 0, c[0]], [16, 0, c[1]], [16, 16, c[2]], [0, 16, c[3]]];
  const tm = terrainMatFor(x, y);
  const tri = (a, b2, d) => { const [u, v] = triFrame(P[a], P[b2], P[d]); m.poly([P[a], P[b2], P[d]], P[a], u, v, tm, 16, 16, 'terrain'); };
  if (Math.abs(c[0] - c[2]) <= Math.abs(c[1] - c[3])) { tri(0, 1, 2); tri(0, 2, 3); } else { tri(1, 2, 3); tri(1, 3, 0); }
  addSkirts(m, x, y, c, GRASS[0], true);
  return m;
}

// ---- bridge decks ------------------------------------------------------------------------------
// One tile of a viaduct: the deck surface at z = 0 (drawn at the span height), parapets,
// and arched stone side walls that reach down to the ground below.
function deckModel(x, y, s) {
  const m = new Model();
  const alongX = s.dir === 1 || s.dir === 3;
  const mask = alongX ? 10 : 5;
  const rail = s.bit === N_RAIL;
  const top = mat((u0, v0, f, o) => {
    const u = clamp(u0, 0, 15.99), v = clamp(v0, 0, 15.99);
    if (rail) { if (!railColor(u, v, mask, o, false)) { const c = [176, 170, 160]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; } }
    else roadColor(u, v, mask, o, x * 16 + u, y * 16 + v, false);
    return 1;
  });
  m.box(0, 0, -3, 16, 16, 3, { top, side: flat('#cdbfa3') });
  const gc = corners(x, y), ground = Math.min(...gc) - s.z;
  const stone = hex('#d9cbb0'), joint = hex('#b3a587'), dark = hex('#cbbd9f');
  const archMat = mat((u, t, f, o) => {
    const H = f.h, cx = 8, r = 5.5, spring = H - 3 - r;
    const dx = Math.abs(u - cx);
    if (H > 9 && dx < r && (t < spring || (t - spring) * (t - spring) + dx * dx < r * r)) return 0;
    if (H <= 9 && t < H - 3 && dx < 6.5) return 0;
    const row = Math.floor(t / 2.6), off = (row & 1) * 1.6;
    const c = (t % 2.6) < 0.5 || ((u + off) % 3.2) < 0.4 ? joint : (t > H - 3 ? dark : stone);
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
  });
  const H = -3 - ground;
  // both faces of each side wall; back faces are culled, so the far wall's inside shows through the arches
  const wall2 = (ax, ay, bx, by) => {
    const ux = (bx - ax) / 16, uy = (by - ay) / 16;
    m.poly([[bx, by, ground], [ax, ay, ground], [ax, ay, -3], [bx, by, -3]], [ax, ay, ground], [ux, uy, 0], [0, 0, 1], archMat, 16, H, 'arch');
    m.poly([[ax, ay, ground], [bx, by, ground], [bx, by, -3], [ax, ay, -3]], [bx, by, ground], [-ux, -uy, 0], [0, 0, 1], archMat, 16, H, 'arch');
  };
  if (H > 0.5) {
    if (alongX) { wall2(0, 0.02, 16, 0.02); wall2(0, 15.98, 16, 15.98); }
    else { wall2(0.02, 0, 0.02, 16); wall2(15.98, 0, 15.98, 16); }
  }
  const par = { top: flat('#efe6d2'), side: mat((u, t, f, o) => { const c = t > f.h - 0.6 ? [239, 230, 210] : ((u % 1.2) < 0.45 ? [226, 214, 190] : [196, 184, 160]); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1; }) };
  if (alongX) { m.box(0, 0, 0, 16, 0.7, 2.2, par); m.box(0, 15.3, 0, 16, 0.7, 2.2, par); }
  else { m.box(0, 0, 0, 0.7, 16, 2.2, par); m.box(15.3, 0, 0, 0.7, 16, 2.2, par); }
  if (!rail && (x + y) % 2 === 0) addLamp(m, alongX ? 8 : 0.35, alongX ? 0.35 : 8, 2.2, 7);
  return m;
}
