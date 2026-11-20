// ---------------------------------------------------------------------------
// Renderer: a low-resolution pixel buffer scaled up with nearest-neighbour.
// Pass 1 draws the sea canvas and every terrain sprite back to front.
// Pass 2 draws buildings, props, decks and agents in depth buckets, re-drawing
// the terrain tiles that stand in front of lower ground so hills hide what is
// behind them. Then overlays, weather, night lights and effects.
// ---------------------------------------------------------------------------
const R = {
  cv: null, ctx: null, low: null, lctx: null, zoom: 2, cam: { x: 0, y: 0 }, ground: null,
  cache: new Map(), buckets: null, rev: -1, view: -1, mtn: null, hover: null, ghost: null,
  dpr: 1, fx: [], bubbles: [], overlay: null, overlayTop: null, frame: 0, bounds: null, S: 1,
  ranges: false, rings: null, marks: null, fade: null, lines: null, chunks: new Map(), chunkIdx: new Map(),
};
const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3, 4];
const FACE_Q = [2, 3, 0, 1];
const VAR = 4;
const LIT_OPT = { night: true, lightsOnly: true };

function sprite(key, build, ang = 0, opt) {
  let s = R.cache.get(key);
  if (!s) { s = renderModel(build(), ang, opt || {}); R.cache.set(key, s); }
  return s;
}
const QA = (q) => (q & 3) * Math.PI / 2;

// world tile coords (continuous) -> world px in the current view, at ground level z = 0
function toPx(x, y) {
  const [a, b] = G.viewOfC(x, y);
  return [(a - b) * HTW + R.ground.OX, (a + b) * HTH + R.ground.OY];
}
function pxToTile(X, Y) {
  const ap = (X - R.ground.OX) / HTW, bp = (Y - R.ground.OY) / HTH;
  return G.worldOfC((bp + ap) / 2, (bp - ap) / 2);
}
function screenToWorldPx(sx, sy) { return [R.cam.x + (sx * R.dpr - R.cv.width / 2) / R.S, R.cam.y + (sy * R.dpr - R.cv.height / 2) / R.S]; }
function worldPxToScreen(X, Y) { return [((X - R.cam.x) * R.S + R.cv.width / 2) / R.dpr, ((Y - R.cam.y) * R.S + R.cv.height / 2) / R.dpr]; }
// the front-most tile whose surface lies under the screen point
function tileAtScreen(sx, sy) {
  const [X, Y] = screenToWorldPx(sx, sy);
  let best = null, bd = -1e9;
  for (let L = LVL_MAX; L >= LVL_MIN; L--) {
    const [fx, fy] = pxToTile(X, Y + L * STEP);
    const x = Math.floor(fx), y = Math.floor(fy);
    if (!G.inMap(x, y)) continue;
    const t = G.map.type[G.idx(x, y)];
    if (t === T_MOUNT || t === T_SEA) continue;
    const z = surfaceZ(fx, fy);
    if (Math.abs(z - L * STEP) <= STEP / 2 + 0.01) {
      const [a, b] = G.viewOf(x, y);
      if (a + b > bd) { bd = a + b; best = [x, y]; }
    }
  }
  if (best) return best;
  const [fx, fy] = pxToTile(X, Y);
  return [Math.floor(fx), Math.floor(fy)];
}

// ---- sprites ------------------------------------------------------------------------
function greySprite(s, key) {
  let g = R.cache.get(key);
  if (g) return g;
  const cv = document.createElement('canvas'); cv.width = s.cv.width; cv.height = s.cv.height;
  const ctx = cv.getContext('2d'); ctx.drawImage(s.cv, 0, 0);
  const img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const l = d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15; d[i] = l * 0.78 + 14; d[i + 1] = l * 0.76 + 14; d[i + 2] = l * 0.74 + 18; }
  ctx.putImageData(img, 0, 0);
  g = { cv, ax: s.ax, ay: s.ay, w: s.w, h: s.h, data: s.data };
  R.cache.set(key, g); return g;
}
function buildingSprite(b, part, lit) {
  const vq = G.view & 3;
  const L = lit ? '|L' : '';
  const lo = lit ? LIT_OPT : undefined;
  if (b.type === 'port') {
    if (!b.done) return lit ? null : sprite(`site|0|40`, () => mSite(1, 40), 0);
    return sprite(`port|${part}|${b.plv}|${vq}${L}`, () => mPort(part, b.plv), QA(FACE_Q[2] + vq), lo);
  }
  if (b.type === 'station') {
    const m = netMask(G, b.x, b.y, N_RAIL);
    const axisQ = (m & 5) && !(m & 10) ? 1 : 0;
    return sprite(`station|${part}|${(axisQ + vq) & 3}${L}`, () => mStationPart(part), QA(axisQ + vq), lo);
  }
  const [w, h] = sizeOf(b.type);
  const multi = w * h > 1;
  const q = multi ? vq : (FACE_Q[b.facing] + vq) & 3;
  if (!b.done) {
    if (lit) return null;
    const dur = LANDMARK.has(b.type) || b.type === 'hotel' ? 300 : HOUSING.has(b.type) ? 150 : 120;
    const stage = clamp(Math.floor((1 - (b.doneAt - G.t) / dur) * 4), 0, 3);
    const top = Math.min(120, Math.round(modelTop(b.type, 1) / 10) * 10);
    return sprite(`site|${stage}|${top}`, () => mSite(stage, top), QA(q));
  }
  const v = b.v % VAR, col = b.col | 0;
  const C = col ? `|c${col}` : '';
  const build = () => withPaint(col, () => MODEL_FN[b.type](b.lv, v));
  if (multi) {
    const i = part % w, j = (part / w) | 0;
    const key = `${b.type}|${b.lv}|${v}|${q}|p${i}.${j}${C}`;
    if (lit) return sprite(key + '|L', build, QA(q), { seed: v * 13 + 1, night: true, lightsOnly: true, part: [i, j, w, h] });
    return sprite(key, build, QA(q), { seed: v * 13 + 1, keepData: true, part: [i, j, w, h] });
  }
  const key = `${b.type}|${b.lv}|${v}|${q}${C}`;
  if (lit) return b.closed ? null : sprite(key + '|L', build, QA(q), { seed: v * 13 + 1, night: true, lightsOnly: true });
  const s = sprite(key, build, QA(q), { seed: v * 13 + 1, keepData: true });
  return b.closed ? greySprite(s, key + '|grey') : s;
}
function treeSprite(kind, v) {
  return sprite(`tree|${kind}|${v}|${G.view}`, () => {
    const m = new Model();
    if (kind === 'palm') addPalm(m, 8, 8, 0, 0.92 + 0.08 * v, 40 + v);
    else if (kind === 'pine') addUmbrellaPine(m, 8, 8, 0, 0.9 + 0.12 * v, 60 + v);
    else if (kind === 'cypress') addCypress(m, 8, 8, 0, 0.8 + 0.15 * v, 70 + v);
    else if (kind === 'bush') addBush(m, 8, 8, 0, 1.3 + 0.3 * v, LEAF.olive, 80 + v);
    else addPlaneTree(m, 8, 8, 0, 0.82 + 0.08 * v, LEAF.plane, 20 + v);
    return m;
  }, QA(G.view));
}
const landSprite = (x, y) => sprite(`land|${G.idx(x, y)}|${G.view}`, () => landModel(x, y), QA(G.view));
const terrainSprite = (x, y) => sprite(`ter|${x}|${y}|${G.view}`, () => terrainModel(x, y), QA(G.view));
const deckSprite = (x, y, s) => sprite(`deck|${G.idx(x, y)}|${G.view}`, () => deckModel(x, y, s), QA(G.view));

// ---- statics in depth buckets ---------------------------------------------------------------
function genMountainDecor() {
  const map = G.map, out = [];
  const rnd = mulberry32(G.seed * 977 + 5);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (map.type[y * MAP_W + x] !== T_MOUNT || (G.net[G.idx(x, y)] & N_PORTAL)) continue;
    // nothing right beside a tunnel mouth
    if ([map.roadPortal, map.railPortal].some((p) => Math.abs(p.x - x) <= 2 && Math.abs(p.y - y) <= 2)) continue;
    const c = tileCorners(map, x, y), rise = Math.max(...c) - Math.min(...c);
    const d = map.dist[y * MAP_W + x];
    if (rise > 70 || Math.max(...c) > 900) continue;
    if (d <= 3.2 && rise < 34 && rnd() < 0.05 && x > 2 && x < MAP_W - 3) { out.push({ kind: 'villa', x, y, v: Math.floor(rnd() * 4) }); continue; }
    if (rnd() < 0.62) {
      const n = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const u = 2 + rnd() * 12, v = 2 + rnd() * 12;
        const r = rnd();
        const kind = rise > 45 ? 'bush' : r < 0.42 ? 'pine' : r < 0.62 ? 'cypress' : 'bush';
        out.push({ kind, x, y, u, v, z: terrainZ(map, x + u / 16, y + v / 16), vv: Math.floor(rnd() * 3) });
      }
    }
  }
  return out;
}
function mVillaPlatform(map, x, y, v) {
  const c = tileCorners(map, x, y), lo = Math.min(...c), hi = Math.max(...c);
  const m = new Model();
  m.box(1, 1, lo - 2, 14, 14, hi - lo + 4, { top: paveMat('#d9cdb3', 2), side: WALL_MAT });
  const z = hi + 2, fc = FACADES[v * 2 % FACADES.length];
  m.box(3, 3, z, 9, 7, 19, { top: flat(fc), side: wallMat(fc, { floorH: 9, base: 1, shutter: SHUTTERS[v] }) });
  m.hip(3, 3, z + 19, 9, 7, 5, roofTileMat(TERRACOTTA));
  m.box(4, 11, z, 6, 3, 0.3, waterMat());
  addCypress(m, 13.5, 13.5, z, 0.8, v);
  return m;
}
function tileTop(x, y) { const t = G.map.type[G.idx(x, y)]; return t === T_MOUNT ? Math.max(...tileCorners(G.map, x, y)) : t === T_SEA ? SEA_Z : Math.max(...corners(x, y)); }
function tileBottom(x, y) { const t = G.map.type[G.idx(x, y)]; return t === T_MOUNT ? Math.min(...tileCorners(G.map, x, y)) : t === T_SEA ? SEA_Z : Math.min(...corners(x, y)); }

// ---- terrain chunks: the terrain pass is cached in 512px tiles of the world ---------------------
const CHUNK = 512;
function terrainBox(X, Y, top) { return [X - 36, Y - top - 22, X + 36, Y + 64]; }
function markChunks(box) {
  for (let cy = Math.floor(box[1] / CHUNK); cy <= Math.floor(box[3] / CHUNK); cy++) for (let cx = Math.floor(box[0] / CHUNK); cx <= Math.floor(box[2] / CHUNK); cx++) {
    const ch = R.chunks.get(cx + ',' + cy); if (ch) ch.dirty = true;
  }
}
function flushTouched() {
  if (!G.touched.length) return;
  clearTreeCache(null);
  for (const [x0, y0, x1, y1] of G.touched) {
    for (let y = Math.max(0, y0); y <= Math.min(MAP_H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(MAP_W - 1, x1); x++) {
      const k = G.idx(x, y);
      for (const v of VIEWS) { R.cache.delete(`land|${k}|${v}`); R.cache.delete(`ter|${x}|${y}|${v}`); R.cache.delete(`deck|${k}|${v}`); }
      if (R.ground && R.ground.cv && G.map.type[k] !== T_SEA) { const [X, Y] = toPx(x + 0.5, y + 0.5); markChunks(terrainBox(X, Y, tileTop(x, y))); }
    }
  }
  G.touched.length = 0;
}

function rebuildStatics() {
  flushTouched();
  const VW = R.ground.VW, VH = R.ground.VH;
  const buckets = new Array(VW + VH + 2);
  for (let i = 0; i < buckets.length; i++) buckets[i] = [];
  const push = (o) => { const k = Math.floor(o.d / 4); if (k >= 0 && k < buckets.length) buckets[k].push(o); };
  const map = G.map, vq = G.view & 3;
  const local = (x, y, u, v, z = 0) => {
    const [du, dv] = rotQ(u - 8, v - 8, vq);
    const [cx, cy] = toPx(x + 0.5, y + 0.5);
    const [a, b] = G.viewOf(x, y);
    return { X: cx + (du - dv) * 2, Y: cy + (du + dv) - z, d: (a + b) * 4 + 2 + clamp((du + dv + 16) / 32, 0, 0.999) };
  };
  // terrain: every land and mountain tile; tiles standing above the ground behind them also occlude
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = map.type[y * MAP_W + x];
    if (t === T_SEA) continue;
    const [a, b] = G.viewOf(x, y);
    const [X, Y] = toPx(x + 0.5, y + 0.5);
    const top = tileTop(x, y);
    let occ = false;
    for (const [da, db] of [[-1, 0], [0, -1], [-1, -1]]) {
      const na = a + da, nb = b + db;
      if (na < 0 || nb < 0 || na >= VW || nb >= VH) continue;
      const [wx, wy] = G.worldOf(na, nb);
      if (tileBottom(wx, wy) < top - 1) { occ = true; break; }
    }
    const mount = t === T_MOUNT;
    push({ d: (a + b) * 4, X, Y, hgt: top + 30, kind: mount ? 'ter' : 'land', terrain: true, occ, tx: x, ty: y, get: mount ? () => terrainSprite(x, y) : () => landSprite(x, y) });
  }
  for (const t of R.mtn) {
    if (t.kind === 'villa') {
      const [a, b] = G.viewOf(t.x, t.y), [X, Y] = toPx(t.x + 0.5, t.y + 0.5);
      push({ d: (a + b) * 4 + 2.5, X, Y, hgt: 900, get: () => sprite(`mvilla|${t.x}|${t.y}|${G.view}`, () => mVillaPlatform(map, t.x, t.y, t.v), QA(G.view)), lit: () => sprite(`mvilla|${t.x}|${t.y}|${G.view}|L`, () => mVillaPlatform(map, t.x, t.y, t.v), QA(G.view), LIT_OPT) });
      continue;
    }
    // mountain trees never change: they are baked into the terrain chunks with the slopes
    const o = local(t.x, t.y, t.u, t.v, t.z); o.hgt = 70; o.terrain = true; o.occ = false; o.get = () => treeSprite(t.kind, t.vv);
    push(o);
  }
  // sea decor
  for (const dc of map.decor) {
    const [a, b] = G.viewOf(dc.x, dc.y), [X, Y] = toPx(dc.x + 0.5, dc.y + 0.5);
    if (dc.kind === 'jetty') push({ d: (a + b) * 4 + 1, X, Y, hgt: 40, get: () => sprite(`jetty|${G.view}`, () => mJetty(false), QA(G.view)), lit: () => sprite(`jetty|${G.view}|L`, () => mJetty(false), QA(G.view), LIT_OPT) });
    else if (dc.kind === 'lighthouse') push({ d: (a + b) * 4 + 1.5, X, Y, hgt: 50, get: () => sprite(`lighthouse|${G.view}`, () => mJetty(true), QA(G.view)), lit: () => sprite(`lighthouse|${G.view}|L`, () => mJetty(true), QA(G.view), LIT_OPT), beam: true });
    else if (dc.kind === 'pontoon') push({ d: (a + b) * 4 + 1, X, Y, hgt: 20, get: () => sprite(`pontoon|${dc.v || 0}|${G.view}`, () => mPontoon(), QA(G.view + (dc.v || 0))), lit: () => sprite(`pontoon|${dc.v || 0}|${G.view}|L`, () => mPontoon(), QA(G.view + (dc.v || 0)), LIT_OPT) });
    else if (dc.kind === 'yacht' || dc.kind === 'fishboat') {
      const ang = (dc.v % 2 ? 0 : Math.PI / 2) + QA(G.view);
      const fn = dc.kind === 'yacht' ? () => mYacht(dc.v) : () => mFishBoat(dc.v);
      push({ d: (a + b) * 4 + 2.5, X, Y, hgt: 40, bob: dc.x * 0.7 + dc.y, get: () => sprite(`${dc.kind}|${dc.v}|${Math.round(ang * 100)}`, fn, ang) });
    }
  }
  // bridge decks
  for (const s of G.spans.values()) {
    if (s.kind !== 'bridge') continue;
    for (let i = 1; i <= s.len; i++) {
      const x = s.ax + DIRS[s.dir][0] * i, y = s.ay + DIRS[s.dir][1] * i;
      const [a, b] = G.viewOf(x, y), [X, Y] = toPx(x + 0.5, y + 0.5);
      push({ d: (a + b) * 4 + 3.96, X, Y: Y - s.z, hgt: 30, deck: true, get: () => deckSprite(x, y, s) });
    }
  }
  // buildings
  for (const b of G.buildings.values()) {
    const z = tileLevel(b.x, b.y) * STEP;
    if (b.type === 'port') {
      for (let i = 0; i < 5; i++) {
        const [a, bb] = G.viewOf(b.x + i, b.y), [X, Y] = toPx(b.x + i + 0.5, b.y + 0.5);
        push({ d: (a + bb) * 4 + 2.5, X, Y, hgt: 90, b, part: i, get: () => buildingSprite(b, i), lit: () => buildingSprite(b, i, true) });
      }
      continue;
    }
    if (b.type === 'station') {
      const m = netMask(G, b.x, b.y, N_RAIL), axisY = (m & 5) && !(m & 10);
      for (const part of [0, 1]) {
        const o = axisY ? local(b.x, b.y, part === 0 ? 13.5 : 2.5, 8) : local(b.x, b.y, 8, part === 0 ? 2.5 : 13.5);
        const [X, Y] = toPx(b.x + 0.5, b.y + 0.5);
        push({ d: o.d, X, Y: Y - z, hgt: 24, b, part, get: () => buildingSprite(b, part), lit: () => buildingSprite(b, part, true) });
      }
      continue;
    }
    const [w, h] = sizeOf(b.type);
    const top = (b.done ? modelTop(b.type, b.lv) : 40) + 40;
    if (w * h > 1) {
      const [X, Y] = toPx(b.x + w / 2, b.y + h / 2);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const part = j * w + i;
        const [a, bb] = G.viewOf(b.x + i, b.y + j);
        if (!b.done) { const [Xp, Yp] = toPx(b.x + i + 0.5, b.y + j + 0.5); push({ d: (a + bb) * 4 + 2.5, X: Xp, Y: Yp - z, hgt: top, b, get: () => buildingSprite(b, part) }); continue; }
        push({ d: (a + bb) * 4 + 2.5, X, Y: Y - z, hgt: top, b, part, get: () => buildingSprite(b, part), lit: () => buildingSprite(b, part, true) });
      }
      continue;
    }
    const [a, bb] = G.viewOf(b.x, b.y), [X, Y] = toPx(b.x + 0.5, b.y + 0.5);
    push({ d: (a + bb) * 4 + 2.5, X, Y: Y - z, hgt: top, b, get: () => buildingSprite(b, 0), lit: () => buildingSprite(b, 0, true) });
  }
  // street furniture: sidewalk trees, lamps, parked cars, bus shelters; beach life
  const raceDay = isRaceDay();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const k = y * MAP_W + x, n = G.net[k];
    const zc = surfaceZ(x + 0.5, y + 0.5);
    if ((n & N_ROAD) && !(n & N_PORTAL)) {
      const coastal = (G.seaDist[k] || 99) <= 2;
      // no trees or lamps on the road right at a tunnel mouth, where they would hide it
      const atMouth = [G.map.roadPortal, G.map.railPortal].some((p) => p.x === x && p.y + 1 === y);
      const spots = atMouth ? [] : roadTreeSpots(x, y);
      for (const [u, v, d] of spots) {
        const lamp = hash2(x, y * 4 + d, 79) < 0.28;
        const o = local(x, y, u, v, zc);
        if (lamp) { o.hgt = 20; o.get = () => sprite('lamp', () => mLampPost(), 0); o.lit = () => sprite('lamp|L', () => mLampPost(), 0, LIT_OPT); o.glow = true; }
        else { const kind = coastal ? 'palm' : 'plane', vv = Math.floor(hash2(x, y * 4 + d, 78) * 3); o.hgt = 34; o.get = () => treeSprite(kind, vv); }
        push(o);
      }
      const mask = netMask(G, x, y, N_ROAD);
      const straight = (mask === 5 || mask === 10) && !(n & N_RAIL) && !G.ramp[k] && !G.busStops.has(k) && !G.spanEnd.has(k);
      if (straight && !(raceDay && (n & N_CIRCUIT)) && hash2(x, y, 81) < 0.32) {
        const alongX = mask === 10, side = hash2(x, y, 82) < 0.5 ? 1 : -1;
        const u = alongX ? 4 + hash2(x, y, 83) * 8 : 8 + side * 3.1, v = alongX ? 8 + side * 3.1 : 4 + hash2(x, y, 83) * 8;
        const o = local(x, y, u, v, zc);
        const c = Math.floor(hash2(x, y, 84) * CAR_COLORS.length), ang = (alongX ? 0 : Math.PI / 2) + QA(G.view);
        o.hgt = 10; o.get = () => sprite(`pcar|${c}|${Math.round(ang * 100)}`, () => mParkedCar(c), ang);
        push(o);
      }
      const stop = G.busStops.get(k);
      if (stop) {
        const o = local(x, y, stop.side === 1 ? 14 : stop.side === 3 ? 2 : 8, stop.side === 0 ? 2 : stop.side === 2 ? 14 : 8, zc);
        const [X, Y] = toPx(x + 0.5, y + 0.5);
        const q = (FACE_Q[stop.side] + vq) & 3;
        push({ d: o.d, X, Y: Y - zc, hgt: 30, get: () => sprite(`bus|${q}`, () => mBusStop(stop.side), QA(q)) });
      }
    } else if (map.type[k] === T_BEACH && !G.bid[k] && !n && hash2(x, y, 91) < 0.45) {
      const cnt = 1 + Math.floor(hash2(x, y, 92) * 3);
      for (let i = 0; i < cnt; i++) {
        const u = 3 + hash2(x, y, 93 + i) * 10, v = 4 + hash2(x, y, 96 + i) * 8, vv = Math.floor(hash2(x, y, 99 + i) * 12);
        const o = local(x, y, u, v, 0);
        const ang = (hash2(x, y, 100 + i) < 0.5 ? 0 : Math.PI / 2) + QA(G.view);
        o.hgt = 12; o.get = () => sprite(`sun|${vv}|${Math.round(ang * 100)}`, () => mSunbather(vv), ang);
        push(o);
      }
    }
  }
  for (const bk of buckets) bk.sort((p, q) => p.d - q.d);
  // index terrain entries by chunk, in painter's order
  const idx = new Map();
  for (const bk of buckets) for (const o of bk) {
    if (!o.terrain) continue;
    const box = terrainBox(o.X, o.Y, o.hgt - 30);
    for (let cy = Math.floor(box[1] / CHUNK); cy <= Math.floor(box[3] / CHUNK); cy++) for (let cx = Math.floor(box[0] / CHUNK); cx <= Math.floor(box[2] / CHUNK); cx++) {
      const key = cx + ',' + cy; let l = idx.get(key); if (!l) { l = []; idx.set(key, l); } l.push(o);
    }
  }
  R.chunkIdx = idx;
  R.buckets = buckets; R.rev = G.rev; R.view = G.view;
}

// ---- camera -----------------------------------------------------------------------------------
function computeBounds() {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let x = PLAY_X0; x <= PLAY_X1; x++) {
    for (const y of [G.map.inland[x] + 1, G.map.coast[x] + 1]) {
      const [X, Y] = toPx(x + 0.5, y);
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
  }
  R.bounds = { x0: x0 - 64, x1: x1 + 64, y0: y0 - 480, y1: y1 + 120 };
}
function clampCam() { const b = R.bounds; if (!b) return; R.cam.x = clamp(R.cam.x, b.x0, b.x1); R.cam.y = clamp(R.cam.y, b.y0, b.y1); }
function centerOnTile(x, y) { const [X, Y] = toPx(x, y); R.cam.x = X; R.cam.y = Y - surfaceZ(x, y); clampCam(); }
function setView(v) {
  const [cx, cy] = R.ground && R.ground.cv ? pxToTile(R.cam.x, R.cam.y) : [START.portX + 2, G.map.coast[START.portX] - 3];
  G.view = v;
  R.ground.build(v);
  R.chunks = new Map();
  computeBounds();
  rebuildStatics();
  centerOnTile(cx, cy);
}

// ---- small pixel icons for bubbles -------------------------------------------------------------
const ICONS = {
  cart: ['.......', '#......', '.#####.', '.#####.', '.####..', '..#.#..'],
  box: ['.#####.', '#.....#', '#######', '#.#.#.#', '#######', '.......'],
  tree: ['..###..', '.#####.', '#######', '.#####.', '...#...', '...#...'],
  sun: ['#..#..#', '.#####.', '##...##', '.#####.', '#..#..#', '.......'],
  bus: ['#######', '#.#.#.#', '#######', '#######', '.#...#.', '.......'],
  rain: ['.####..', '######.', '.......', '#.#.#..', '.#.#.#.', '.......'],
  storm: ['.####..', '######.', '...#...', '..##...', '.##....', '.#.....'],
  noise: ['..#....', '.##.#..', '###..#.', '###..#.', '.##.#..', '..#....'],
  crowd: ['.#...#.', '###.###', '.#...#.', '###.###', '#.#.#.#', '.......'],
  road: ['.#...#.', '.#.#.#.', '.#...#.', '.#.#.#.', '.#...#.', '.......'],
  ship: ['...#...', '...##..', '...#...', '#######', '.#####.', '.......'],
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  shirt: ['##...##', '#######', '.#####.', '.#####.', '.#####.', '.......'],
  bulb: ['..###..', '.#####.', '.#####.', '..###..', '..#.#..', '..###..'],
  camera: ['..##...', '#######', '##...##', '##...##', '#######', '.......'],
  coin: ['.#####.', '##.#.##', '#..#..#', '##.#.##', '.#####.', '.......'],
  fist: ['.#.#.#.', '#######', '#######', '.######', '..####.', '..###..'],
  flag: ['#.#.#..', '.#.#.#.', '#.#.#..', '.#.#.#.', '#......', '#......'],
  home: ['...#...', '..###..', '.#####.', '.#...#.', '.#.#.#.', '.#####.'],
};
const ICON_COL = { cart: '#2e7b59', box: '#c2412f', tree: '#3f7a3a', sun: '#e08a1e', bus: '#2d6fb8', rain: '#4a6f9a', storm: '#5b5f70', noise: '#7c4f8f', crowd: '#6b5f55', road: '#5f636b', ship: '#2d5d8e', heart: '#e04f6a', shirt: '#2d6fb8', bulb: '#d9a21a', camera: '#5b2a86', coin: '#b8860b', fist: '#c2412f', flag: '#2b2f36', home: '#8a5b4a' };
function makeBubble(icon) {
  const key = 'bub|' + icon;
  let c = R.cache.get(key); if (c) return c;
  const cv = document.createElement('canvas'); cv.width = 13; cv.height = 13;
  const x = cv.getContext('2d');
  x.fillStyle = '#2b2f36'; x.fillRect(1, 0, 11, 1); x.fillRect(1, 9, 11, 1); x.fillRect(0, 1, 1, 8); x.fillRect(12, 1, 1, 8);
  x.fillStyle = '#fbf8f0'; x.fillRect(1, 1, 11, 8);
  x.fillStyle = '#2b2f36'; x.fillRect(4, 10, 3, 1); x.fillRect(4, 11, 2, 1); x.fillRect(4, 12, 1, 1);
  x.fillStyle = '#fbf8f0'; x.fillRect(5, 9, 2, 1);
  x.fillStyle = ICON_COL[icon] || '#2b2f36';
  (ICONS[icon] || ICONS.heart).forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') x.fillRect(3 + i, 2 + j, 1, 1); });
  c = { cv, ax: 6, ay: 13 }; R.cache.set(key, c); return c;
}
function diamondSprite(color, fill) {
  const key = `dia|${color}|${fill}`;
  let c = R.cache.get(key); if (c) return c;
  const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
  const x = cv.getContext('2d'); const img = x.createImageData(TW, TH); const buf = new Uint32Array(img.data.buffer);
  const col = packC(hex(color), 255), fc = packC(hex(color), Math.round(fill * 255));
  const inside = (px, py) => { const sx = px + 0.5 - HTW, sy = py + 0.5; const up = (sy + sx / 2) / 2, vp = (sy - sx / 2) / 2; return up >= 0 && vp >= 0 && up < 16 && vp < 16; };
  for (let py = 0; py < TH; py++) for (let px = 0; px < TW; px++) {
    if (!inside(px, py)) continue;
    const edge = !inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1);
    buf[py * TW + px] = edge ? col : fc;
  }
  x.putImageData(img, 0, 0);
  c = { cv, ax: HTW, ay: 0 }; R.cache.set(key, c); return c;
}
function drawDiamond(ctx, x, y, color, fill) {
  const s = diamondSprite(color, fill);
  const [X, Y] = toPx(x + 0.5, y + 0.5);
  const z = G.inMap(x, y) && G.map.type[G.idx(x, y)] !== T_MOUNT ? (G.map.type[G.idx(x, y)] === T_SEA ? SEA_Z : surfaceZ(x + 0.5, y + 0.5)) : 0;
  ctx.drawImage(s.cv, Math.round(X - s.ax), Math.round(Y - HTH - z));
}

// ---- effects ----------------------------------------------------------------------------------------
function addFx(fx) { fx.t0 = performance.now(); R.fx.push(fx); if (R.fx.length > 80) R.fx.splice(0, R.fx.length - 80); }

// ---- frame ----------------------------------------------------------------------------------------------
function initRenderer(canvas) {
  R.cv = canvas; R.ctx = canvas.getContext('2d');
  R.low = document.createElement('canvas'); R.lctx = R.low.getContext('2d');
  R.ground = new Ground();
}
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.round(R.cv.clientWidth * dpr), h = Math.round(R.cv.clientHeight * dpr);
  if (R.cv.width !== w || R.cv.height !== h) { R.cv.width = w; R.cv.height = h; }
  R.dpr = dpr;
}
function nightFactor(m) {
  if (!SETTINGS.dayNight) return 0;
  const h = m / 60;
  if (h >= 20.5 || h < 5) return 1;
  if (h >= 18.5) return (h - 18.5) / 2;
  if (h < 6.5) return 1 - (h - 5) / 1.5;
  return 0;
}
function skyTint(m) {
  if (!SETTINGS.dayNight) return null;
  const h = m / 60;
  if (h >= 7 && h < 18.5) return null;
  if (h >= 18.5 && h < 20.5) { const t = (h - 18.5) / 2; return [255, lerp(225, 150, t), lerp(190, 170, t), t]; }
  if (h >= 20.5 || h < 5) return [70, 86, 150, 1];
  if (h >= 5 && h < 7) { const t = (h - 5) / 2; return [lerp(70, 255, t), lerp(86, 215, t), lerp(150, 185, t), 1 - t * 0.6]; }
  return null;
}

function render(now) {
  resizeCanvas();
  if (ZOOMS.indexOf(R.zoom) < minZoomIdx()) R.zoom = ZOOMS[minZoomIdx()];
  if (R.view !== G.view || !R.ground.cv) setView(G.view);
  if (R.rev !== G.rev || G.touched.length) rebuildStatics();
  const cv = R.cv, dpr = R.dpr;
  const S = R.zoom * dpr; R.S = S;
  let ctx, vw, vh, ox, oy;
  const low = S >= 1;
  if (low) {
    vw = Math.ceil(cv.width / S) + 1; vh = Math.ceil(cv.height / S) + 1;
    if (R.low.width !== vw || R.low.height !== vh) { R.low.width = vw; R.low.height = vh; }
    ctx = R.lctx;
    ox = Math.round(R.cam.x - cv.width / S / 2); oy = Math.round(R.cam.y - cv.height / S / 2);
    ctx.setTransform(1, 0, 0, 1, -ox, -oy);
    ctx.imageSmoothingEnabled = false;
  } else {
    ctx = R.ctx;
    vw = cv.width / S; vh = cv.height / S; ox = R.cam.x - vw / 2; oy = R.cam.y - vh / 2;
    ctx.setTransform(S, 0, 0, S, -ox * S, -oy * S);
    ctx.imageSmoothingEnabled = true;
  }
  R.vx0 = ox; R.vy0 = oy; R.vw = vw; R.vh = vh;
  const minute = G.minute();
  // open sea under everything; the scenery chunks paint mountains and coast over it
  ctx.fillStyle = cssC(SEA_DEEP); ctx.fillRect(ox, oy, vw, vh);
  const g = R.ground;
  const sx0 = Math.max(0, Math.floor(ox)), sy0 = Math.max(0, Math.floor(oy));
  const sx1 = Math.min(g.W, Math.ceil(ox + vw)), sy1 = Math.min(g.H, Math.ceil(oy + vh));
  if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(g.cv, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
  updateBackdrop(ox, oy, vw, vh);
  drawBackdropLayer(ctx, ox, oy, vw, vh, 'under');
  drawSparkles(ctx, ox, oy, vw, vh, now);
  drawWakes(ctx, now);
  drawTerrain(ctx, ox, oy, vw, vh);
  drawBackdropLayer(ctx, ox, oy, vw, vh, 'over');
  drawOverlayTiles(ctx);
  drawRangeFills(ctx);
  const nf = nightFactor(minute);
  let lctx = null;
  if (nf > 0.02) {
    if (!R.light) { R.light = document.createElement('canvas'); R.lightCtx = R.light.getContext('2d'); }
    const tw = low ? vw : cv.width, th = low ? vh : cv.height;
    if (R.light.width !== tw || R.light.height !== th) { R.light.width = tw; R.light.height = th; }
    lctx = R.lightCtx;
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, tw, th);
    if (low) lctx.setTransform(1, 0, 0, 1, -ox, -oy); else lctx.setTransform(S, 0, 0, S, -ox * S, -oy * S);
    lctx.imageSmoothingEnabled = !low;
  }
  drawObjects(ctx, ox, oy, vw, vh, now, lctx);
  if (R.overlayTop) {
    ctx.fillStyle = 'rgba(9,18,28,0.55)'; ctx.fillRect(ox, oy, vw, vh);
    for (const t of R.overlayTop) drawDiamond(ctx, t.x, t.y, t.color, t.fill);
  }
  drawWeather(ctx, ox, oy, vw, vh, now, minute);
  if (lctx) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(1, nf * 1.1); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(R.light, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = nf * 0.35; ctx.drawImage(R.light, 0, 0);
    ctx.restore();
  }
  drawLines(ctx, now);
  drawRangeRings(ctx, now);
  drawCursor(ctx, now);
  drawBubbles(ctx, now);
  if (low) {
    R.ctx.setTransform(1, 0, 0, 1, 0, 0);
    R.ctx.imageSmoothingEnabled = false;
    const fx = (ox - (R.cam.x - cv.width / S / 2)) * S, fy = (oy - (R.cam.y - cv.height / S / 2)) * S;
    R.ctx.drawImage(R.low, 0, 0, vw, vh, Math.round(fx), Math.round(fy), Math.round(vw * S), Math.round(vh * S));
  }
  drawFloatingText(now);
  R.frame++;
}

function drawSparkles(ctx, ox, oy, vw, vh, now) {
  const t = Math.floor(now / 260);
  ctx.fillStyle = 'rgba(235,250,255,0.85)';
  const step = 18;
  for (let Y = Math.floor(oy / step) * step; Y < oy + vh; Y += step) {
    for (let X = Math.floor(ox / (step * 2)) * step * 2; X < ox + vw; X += step * 2) {
      const h = hash2(X / step, Y / step, 3);
      if (h > 0.32) continue;
      if (((t + Math.floor(h * 97)) % 9) > 1) continue;
      const jx = X + Math.floor(hash2(X, Y, 4) * step * 2), jy = Y + Math.floor(hash2(X, Y, 5) * step);
      const [wx, wy] = pxToTile(jx, jy - SEA_Z);
      const tx = Math.floor(wx), ty = Math.floor(wy);
      if (G.inMap(tx, ty) ? G.map.type[ty * MAP_W + tx] !== T_SEA : !backdropSea(jx, jy)) continue;
      ctx.fillRect(jx, jy, 2, 1);
    }
  }
}
// white water behind moving boats
function drawWakes(ctx, now) {
  ctx.fillStyle = 'rgba(240,250,252,0.75)';
  for (const sh of AG.ships) {
    const st = shipState(sh); if (!st || st.docked) continue;
    for (let i = 3; i < 26; i++) {
      const spread = i * 0.035, back = 1.6 + i * 0.22;
      for (const side of [-1, 1]) {
        if (hash2(i, side, Math.floor(now / 180)) < 0.35) continue;
        const [X, Y] = toPx(st.x - st.dx * back - st.dy * spread * side, st.y - st.dy * back + st.dx * spread * side);
        ctx.fillRect(Math.round(X), Math.round(Y - SEA_Z), i < 8 ? 2 : 1, 1);
      }
    }
  }
  for (const sb of AG.sail) for (let i = 1; i < 8; i++) { if (hash2(i, Math.floor(now / 200), 3) < 0.4) continue; const [X, Y] = toPx(sb.x - i * 0.12, sb.y + (i % 2 ? 0.03 : -0.03)); ctx.fillRect(Math.round(X), Math.round(Y - SEA_Z), 1, 1); }
}
function renderChunk(ch, cx, cy) {
  const list = R.chunkIdx.get(cx + ',' + cy);
  ch.dirty = false;
  if (!list || !list.length) { ch.cv = null; return; }
  if (!ch.cv) { ch.cv = document.createElement('canvas'); ch.cv.width = CHUNK; ch.cv.height = CHUNK; }
  const c = ch.cv.getContext('2d');
  c.clearRect(0, 0, CHUNK, CHUNK);
  const bx = cx * CHUNK, by = cy * CHUNK;
  for (const o of list) {
    const s = o.get();
    const X = Math.round(o.X - s.ax) - bx, Y = Math.round(o.Y - s.ay) - by;
    if (X > CHUNK || Y > CHUNK || X + s.cv.width < 0 || Y + s.cv.height < 0) continue;
    c.drawImage(s.cv, X, Y);
  }
}
// Draw a pre-rendered CHUNK-sized canvas (sw x sh source px) at world px (X, Y). Zoomed out
// (fewer than one screen pixel per world pixel) the chunk lands on whole screen pixels, so two
// neighbouring chunks meet exactly: drawn at fractional spots their soft edges would both be
// part-transparent and the sea colour underneath would show through as thin lines.
function blitChunk(ctx, cv, X, Y, sw, sh, crisp) {
  const sm = ctx.imageSmoothingEnabled;
  if (crisp) ctx.imageSmoothingEnabled = false;
  if (R.S >= 1) ctx.drawImage(cv, 0, 0, sw, sh, X, Y, CHUNK, CHUNK);
  else {
    const S = R.S, x0 = Math.round((X - R.vx0) * S), y0 = Math.round((Y - R.vy0) * S);
    const x1 = Math.round((X + CHUNK - R.vx0) * S), y1 = Math.round((Y + CHUNK - R.vy0) * S);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(cv, 0, 0, sw, sh, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = sm;
}
function drawTerrain(ctx, ox, oy, vw, vh) {
  for (let cy = Math.floor(oy / CHUNK); cy <= Math.floor((oy + vh) / CHUNK); cy++) for (let cx = Math.floor(ox / CHUNK); cx <= Math.floor((ox + vw) / CHUNK); cx++) {
    const key = cx + ',' + cy;
    let ch = R.chunks.get(key);
    if (!ch) { ch = { cv: null, dirty: true }; R.chunks.set(key, ch); }
    if (ch.dirty) renderChunk(ch, cx, cy);
    if (ch.cv) blitChunk(ctx, ch.cv, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK, false);
  }
}

function drawObjects(ctx, ox, oy, vw, vh, now, lctx) {
  const buckets = R.buckets;
  const dyn = new Map();
  for (const d of agentDraws()) {
    const [a, b] = G.viewOfC(d.x, d.y);
    let depth = (Math.floor(a) + Math.floor(b)) * 4 + 2 + ((a - Math.floor(a)) + (b - Math.floor(b))) / 2;
    if (d.deck) depth = (Math.floor(a) + Math.floor(b)) * 4 + 3.97 + ((a - Math.floor(a)) + (b - Math.floor(b))) * 0.01;
    if (d.ship) {
      const L = [2.8, 3.8, 4.9][d.size] / 2;
      const ends = [[d.x + d.dx * L, d.y + d.dy * L], [d.x - d.dx * L, d.y - d.dy * L]].map(([px, py]) => G.viewOfC(px, py));
      depth = Math.floor(Math.max(...ends.map(([aa, bb]) => aa + bb))) * 4 + 3.9;
    }
    d.depth = depth;
    const k = Math.floor(depth / 4);
    if (!dyn.has(k)) dyn.set(k, []);
    dyn.get(k).push(d);
  }
  for (const list of dyn.values()) list.sort((p, q) => p.depth - q.depth);
  const fade = R.fade;
  for (let k = 0; k < buckets.length; k++) {
    const st = buckets[k], dl = dyn.get(k);
    let i = 0, j = 0;
    const ns = st.length, nd = dl ? dl.length : 0;
    while (i < ns || j < nd) {
      if (j >= nd || (i < ns && st[i].d <= dl[j].depth)) {
        const o = st[i++];
        if (o.terrain && !o.occ) continue;
        if (o.X + 70 < ox || o.X - 70 > ox + vw || o.Y + 50 < oy || o.Y - o.hgt - 40 > oy + vh) continue;
        const s = o.get(); if (!s) continue;
        let Y = o.Y;
        if (o.bob) Y += Math.round(Math.sin(now / 900 + o.bob) * 0.6);
        const X = Math.round(o.X - s.ax), YY = Math.round(Y - s.ay);
        if (X > ox + vw || X + s.cv.width < ox || YY > oy + vh || YY + s.cv.height < oy) continue;
        if (fade && o.b && o.d > fade.d && X < fade.X1 && X + s.cv.width > fade.X0 && YY < fade.Y1 && YY + s.cv.height > fade.Y0) {
          ctx.globalAlpha = 0.32; ctx.drawImage(s.cv, X, YY); ctx.globalAlpha = 1;
        } else ctx.drawImage(s.cv, X, YY);
        if (lctx) {
          lctx.globalCompositeOperation = 'destination-out'; lctx.drawImage(s.cv, X, YY); lctx.globalCompositeOperation = 'source-over';
          if (o.lit) { const ls = o.lit(); if (ls) lctx.drawImage(ls.cv, Math.round(o.X - ls.ax), Math.round(Y - ls.ay)); }
          if (o.glow) { lctx.fillStyle = 'rgba(255,214,140,0.22)'; lctx.beginPath(); lctx.ellipse(Math.round(o.X), Math.round(o.Y), 9, 4.5, 0, 0, Math.PI * 2); lctx.fill(); }
          if (o.beam) { const a = now / 1400; lctx.fillStyle = 'rgba(255,240,180,0.18)'; lctx.beginPath(); lctx.moveTo(o.X, o.Y - 22); lctx.lineTo(o.X + Math.cos(a) * 160, o.Y - 22 + Math.sin(a) * 50); lctx.lineTo(o.X + Math.cos(a + 0.12) * 160, o.Y - 22 + Math.sin(a + 0.12) * 50); lctx.closePath(); lctx.fill(); }
        }
        if (o.b && o.b.flash && now - o.b.flash < 400) { ctx.globalAlpha = 0.5 * (1 - (now - o.b.flash) / 400); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(s.cv, X, YY); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      } else drawAgent(ctx, dl[j++], ox, oy, vw, vh, lctx, now);
    }
  }
}

function agentSprite(d) {
  const ang = Math.atan2(d.dy, d.dx) + QA(G.view);
  const n = d.kind === 'ship' ? 32 : 16;
  const qi = ((Math.round(ang / (Math.PI * 2 / n)) % n) + n) % n;
  const qa = qi * Math.PI * 2 / n;
  switch (d.kind) {
    case 'car': return sprite(`car|${d.a.color}|${qi}`, () => mCar(CAR_COLORS[d.a.color]), qa);
    case 'bus': return sprite(`busv|${d.a.color}|${qi}`, () => mBus(d.a.color), qa);
    case 'coach': return sprite(`coach|${qi}`, () => mCoach(), qa);
    case 'truck': return sprite(`truck|${qi}`, () => mTruck(), qa);
    case 'train': return sprite(`train|${d.a.car}|${d.a.color}|${qi}`, () => mTrainCar(d.a.car, d.a.color), qa);
    case 'freight': return sprite(`freight|${d.i === 0 ? 0 : 2}|${qi}`, () => mTrainCar(d.i === 0 ? 1 : 2), qa);
    case 'ped': return sprite(`ped|${d.a.color}|${d.a.skin}`, () => mPerson(SHIRT[d.a.color], SKIN[d.a.skin]), 0);
    case 'tourist': return sprite(`tour|${d.a.color}|${d.a.skin}|${d.a.hat}`, () => mPerson(SHIRT[d.a.color], SKIN[d.a.skin], d.a.hat), 0);
    case 'protester': case 'fan': return sprite(`ped|${d.p.color}|${d.p.skin}`, () => mPerson(SHIRT[d.p.color], SKIN[d.p.skin]), 0);
    case 'f1': return sprite(`f1|${d.c.i}|${qi}`, () => mF1Car(d.c.color), qa);
    case 'ship': return sprite(`ship|${d.size}|${qi}`, () => mShip(d.size), qa);
    case 'sail': return sprite(`sail|${d.v}|${qi}`, () => mSailboat(d.v), qa);
  }
  return null;
}
function drawAgent(ctx, d, ox, oy, vw, vh, lctx, now) {
  const [X, Y0] = toPx(d.x, d.y), Y = Y0 - (d.z || 0);
  if (X + 200 < ox || X - 200 > ox + vw || Y + 100 < oy || Y - 120 > oy + vh) return;
  const s = agentSprite(d); if (!s) return;
  let hop = 0;
  if (d.kind === 'protester' || d.kind === 'fan') hop = Math.sin(now / 160 + d.p.ph) > 0.6 ? 1 : 0;
  const px = Math.round(X - s.ax), py = Math.round(Y - s.ay) - hop;
  if (!d.ship && d.kind !== 'sail') { ctx.fillStyle = 'rgba(20,26,40,0.22)'; ctx.fillRect(Math.round(X - (d.kind === 'ped' || d.kind === 'tourist' || d.kind === 'protester' || d.kind === 'fan' ? 1 : 4)), Math.round(Y), d.kind === 'ped' || d.kind === 'tourist' || d.kind === 'protester' || d.kind === 'fan' ? 3 : 8, 1); }
  ctx.drawImage(s.cv, px, py);
  if ((d.kind === 'protester' && d.p.sign) || (d.kind === 'fan' && d.p.flag)) {
    ctx.fillStyle = '#3a3f46'; ctx.fillRect(Math.round(X) + 1, py - 4, 1, 5);
    ctx.fillStyle = d.kind === 'fan' ? (d.p.color % 2 ? '#ce1126' : '#f4efe3') : '#f4efe3'; ctx.fillRect(Math.round(X) - 1, py - 7, 5, 3);
    if (d.kind === 'protester') { ctx.fillStyle = '#c2412f'; ctx.fillRect(Math.round(X), py - 6, 3, 1); }
  }
  if (lctx) {
    lctx.globalCompositeOperation = 'destination-out'; lctx.drawImage(s.cv, px, py); lctx.globalCompositeOperation = 'source-over';
    if (d.kind === 'car' || d.kind === 'bus' || d.kind === 'truck' || d.kind === 'coach') { lctx.fillStyle = 'rgba(255,236,170,0.9)'; lctx.fillRect(Math.round(X + d.dx * 6 - d.dy * 2), Math.round(Y + d.dy * 3 - 4), 2, 1); }
    if (d.kind === 'ship') { lctx.fillStyle = '#ffe9a8'; lctx.fillRect(Math.round(X - d.dx * 30), Math.round(Y - 22 - d.dy * 15), 2, 1); lctx.fillStyle = '#ff5a40'; lctx.fillRect(Math.round(X), Math.round(Y - 30), 1, 1); }
  }
}

function drawOverlayTiles(ctx) {
  if (!R.overlay) return;
  for (const t of R.overlay) drawDiamond(ctx, t.x, t.y, t.color, t.fill == null ? 0.35 : t.fill);
}

// ---- ranges --------------------------------------------------------------------------------------
const RANGE_COL = { housing: '#f4efe3', shops: '#ffd25a', leisure: '#5fe0d2', landmark: '#ff8fc8', tourism: '#b78cff', transport: '#6fb8ff', port: '#7fe0d2' };
function ringOf(type, x, y, lv = 1) {
  const d = B[type]; if (!d) return null;
  const r = d.radius ? lvAt(d.radius, lv) : HOUSING.has(type) ? (d.walk || 5) : 0;
  if (!r) return null;
  const [w, h] = sizeOf(type);
  return { cx: x + w / 2, cy: y + h / 2, z: G.inMap(x, y) ? tileLevel(x, y) * STEP : 0, r: r + 0.5 + Math.max(w, h) / 2 - 0.5, color: RANGE_COL[d.cat] || '#ffffff' };
}
function ellipsePts(ring, fn) {
  const [X, Y0] = toPx(ring.cx, ring.cy), Y = Y0 - ring.z;
  const rx = ring.r * HTW * Math.SQRT2, ry = ring.r * HTH * Math.SQRT2;
  const n = Math.max(24, Math.round(rx * 1.2));
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; fn(Math.round(X + Math.cos(a) * rx), Math.round(Y + Math.sin(a) * ry), i, n); }
  return [X, Y, rx, ry];
}
function drawRangeFills(ctx) {
  if (!R.rings) return;
  for (const ring of R.rings) {
    if (ring.outlineOnly) continue;
    const [X, Y0] = toPx(ring.cx, ring.cy), Y = Y0 - ring.z;
    ctx.fillStyle = ring.color; ctx.globalAlpha = 0.14;
    ctx.beginPath(); ctx.ellipse(X, Y, ring.r * HTW * Math.SQRT2, ring.r * HTH * Math.SQRT2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function drawRangeRings(ctx, now) {
  if (R.marks) for (const m of R.marks) {
    const [X, Y0] = toPx(m.x + 0.5, m.y + 0.5), Y = Y0 - surfaceZ(m.x + 0.5, m.y + 0.5) - 22 - (Math.floor(now / 400) % 2);
    ctx.fillStyle = '#0b1520'; ctx.fillRect(Math.round(X) - 3, Math.round(Y) - 3, 7, 7);
    ctx.fillStyle = m.color; ctx.fillRect(Math.round(X) - 2, Math.round(Y) - 2, 5, 5);
  }
  if (!R.rings) return;
  const dash = Math.floor(now / 120);
  for (const ring of R.rings) {
    const on = (i) => ring.solid || ((i + dash) >> 1) % 2 === 0;
    ctx.fillStyle = 'rgba(8,14,22,0.7)';
    ellipsePts(ring, (x, y, i) => { if (on(i)) ctx.fillRect(x, y + 1, 1, 1); });
    ctx.fillStyle = ring.color;
    ellipsePts(ring, (x, y, i) => { if (on(i)) ctx.fillRect(x, y, 1, 1); });
  }
}
// transit lines and the circuit, drawn over the city when relevant
function drawLines(ctx, now) {
  const L = R.lines; if (!L) return;
  for (const l of L) {
    ctx.strokeStyle = l.color; ctx.lineWidth = l.w || 2; ctx.globalAlpha = l.alpha || 0.9;
    ctx.beginPath();
    let first = true;
    for (const k of l.tiles) {
      const x = k % MAP_W + 0.5, y = ((k / MAP_W) | 0) + 0.5;
      const [X, Y] = toPx(x, y); const z = surfaceZ(x, y);
      if (first) { ctx.moveTo(X, Y - z - 3); first = false; } else ctx.lineTo(X, Y - z - 3);
    }
    if (l.loop) ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (l.stops) for (let i = 0; i < l.stops.length; i++) {
      const k = l.stops[i], x = k % MAP_W + 0.5, y = ((k / MAP_W) | 0) + 0.5;
      const [X, Y] = toPx(x, y), z = surfaceZ(x, y);
      ctx.fillStyle = '#0b1520'; ctx.fillRect(Math.round(X) - 4, Math.round(Y - z) - 10, 9, 9);
      ctx.fillStyle = l.color; ctx.fillRect(Math.round(X) - 3, Math.round(Y - z) - 9, 7, 7);
      ctx.fillStyle = '#f4efe3'; ctx.font = '7px monospace'; ctx.fillText(String(i + 1), Math.round(X) - 2, Math.round(Y - z) - 3);
    }
  }
}

function drawCursor(ctx, now) {
  const sel = IN.selected;
  if (sel && !sel.tile && G.buildings.has(sel.id)) for (const [x, y] of footprint(sel.type, sel.x, sel.y)) drawDiamond(ctx, x, y, '#ffd25a', 0.18);
  else if (sel && sel.tile) drawDiamond(ctx, sel.x, sel.y, '#ffd25a', 0.18);
  const h = R.hover; if (!h) return;
  const ghost = R.ghost;
  if (ghost && ghost.tiles) {
    for (const [x, y] of ghost.tiles) drawDiamond(ctx, x, y, ghost.ok ? '#7fe0a0' : '#ff6b5a', 0.28);
    if (ghost.bad) for (const [x, y] of ghost.bad) drawDiamond(ctx, x, y, '#ff6b5a', 0.5);
    if (ghost.sprites) {
      ctx.globalAlpha = ghost.ok ? 0.8 : 0.5;
      for (const gs of ghost.sprites) { const [X, Y] = toPx(gs.x, gs.y); ctx.drawImage(gs.s.cv, Math.round(X - gs.s.ax), Math.round(Y - gs.z - gs.s.ay)); }
      ctx.globalAlpha = 1;
    }
    return;
  }
  drawDiamond(ctx, h.x, h.y, '#fff8e6', 0.12);
}

function drawBubbles(ctx, now) {
  R.bubbles = R.bubbles.filter((b) => now - b.t0 < 3200 && G.buildings.has(b.b.id));
  for (const bb of R.bubbles) {
    const b = bb.b, [X, Y] = toPx(b.x + 0.5, b.y + 0.5);
    const s = makeBubble(bb.icon);
    const age = (now - bb.t0) / 3200, lift = Math.round(Math.min(1, age * 6) * 4);
    const top = Y - tileLevel(b.x, b.y) * STEP - modelTop(b.type, b.lv) - 8 - lift;
    ctx.globalAlpha = age > 0.85 ? (1 - age) / 0.15 : 1;
    ctx.drawImage(s.cv, Math.round(X - s.ax), Math.round(top - s.ay));
    ctx.globalAlpha = 1;
  }
  R.fx = R.fx.filter((f) => now - f.t0 < (f.life || 1200));
  for (const f of R.fx) {
    if (f.kind !== 'dust' && f.kind !== 'coin') continue;
    const [X, Y0] = toPx(f.x + 0.5, f.y + 0.5), Y = Y0 - (G.inMap(f.x, f.y) ? surfaceZ(f.x + 0.5, f.y + 0.5) : 0), age = (now - f.t0) / (f.life || 1200);
    if (f.kind === 'dust') {
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4 + f.seed, r = 6 + age * 22;
        ctx.fillStyle = `rgba(214,204,186,${0.8 * (1 - age)})`;
        ctx.fillRect(Math.round(X + Math.cos(a) * r), Math.round(Y - 6 + Math.sin(a) * r * 0.5 - age * 10), 3, 2);
      }
    } else {
      ctx.fillStyle = `rgba(245,200,66,${1 - age})`;
      ctx.fillRect(Math.round(X - 1 + Math.sin(f.seed) * 6), Math.round(Y - 26 - age * 18), 3, 3);
      ctx.fillStyle = `rgba(255,240,180,${1 - age})`;
      ctx.fillRect(Math.round(X + Math.sin(f.seed) * 6), Math.round(Y - 26 - age * 18), 1, 1);
    }
  }
}

// a soft round shadow, faded to nothing at the edge (drawn stretched for each cloud puff)
let SOFT_BLOB = null;
function softBlob() {
  if (SOFT_BLOB) return SOFT_BLOB;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(20,32,58,1)'); gr.addColorStop(0.45, 'rgba(20,32,58,0.7)'); gr.addColorStop(1, 'rgba(20,32,58,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return (SOFT_BLOB = c);
}
function drawWeather(ctx, ox, oy, vw, vh, now, minute) {
  const w = G.weather, fx = SETTINGS.weatherFx;
  // cloud shadows drifting over the city: each cloud a few soft puffs, never a hard-edged oval
  const shadows = !fx ? 0 : w === 'cloudy' ? 34 : w === 'rain' || w === 'storm' ? 40 : w === 'sunny' ? 8 : 6;
  const Wd = R.ground.W, Hd = R.ground.H, ts = now / 1000, blob = softBlob();
  ctx.save();
  ctx.globalAlpha = (w === 'rain' || w === 'storm' ? 0.11 : 0.075) * clamp(R.zoom, 0.6, 1);
  for (let i = 0; i < shadows; i++) {
    const X = ((hash2(i, 2) * (Wd + 1600) + ts * (8 + hash2(i, 1) * 8)) % (Wd + 1600)) - 800;
    const Y = hash2(i, 3) * (Hd + 400) - 700;
    const rx = 120 + hash2(i, 4) * 160, ry = 55 + hash2(i, 5) * 55;
    if (X + rx * 1.6 < ox || X - rx * 1.6 > ox + vw || Y + ry * 1.6 < oy || Y - ry * 1.6 > oy + vh) continue;
    for (let j = 0; j < 3; j++) {
      const px = X + (hash2(i, 10 + j) - 0.5) * rx * 1.1, py = Y + (hash2(i, 20 + j) - 0.5) * ry * 0.8;
      const sx = rx * (0.7 + hash2(i, 30 + j) * 0.5), sy = ry * (0.7 + hash2(i, 40 + j) * 0.5);
      ctx.drawImage(blob, px - sx, py - sy, sx * 2, sy * 2);
    }
  }
  ctx.restore();
  const tint = w === 'storm' ? 'rgba(40,50,70,0.32)' : w === 'rain' ? 'rgba(60,72,92,0.2)' : w === 'cloudy' ? 'rgba(120,128,140,0.12)' : w === 'heat' ? 'rgba(255,170,60,0.10)' : null;
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(ox, oy, vw, vh); }
  const sk = skyTint(minute);
  if (sk) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(${sk[0] | 0},${sk[1] | 0},${sk[2] | 0},${sk[3]})`;
    ctx.fillRect(ox, oy, vw, vh);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (fx && (w === 'rain' || w === 'storm')) {
    const n = w === 'storm' ? 260 : 150;
    ctx.fillStyle = 'rgba(200,215,235,0.55)';
    const t = now / 1000;
    for (let i = 0; i < n; i++) {
      const sx = (hash2(i, 7) * vw + t * 90) % vw, sy = (hash2(i, 8) * vh + t * (260 + hash2(i, 9) * 120)) % vh;
      ctx.fillRect(Math.floor(ox + sx), Math.floor(oy + sy), 1, 4);
    }
    if (w === 'storm' && (Math.floor(now / 1000) % 7 === 0) && (now % 1000) < 90) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(ox, oy, vw, vh); }
  }
}

function drawFloatingText(now) {
  const ctx = R.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const f of R.fx) {
    if (f.kind !== 'text') continue;
    const age = (now - f.t0) / (f.life || 2200);
    const [X, Y] = toPx(f.x, f.y);
    const [sx, sy] = worldPxToScreen(X, Y - (f.h || 40));
    const dpr = R.dpr;
    ctx.globalAlpha = age > 0.7 ? (1 - age) / 0.3 : 1;
    ctx.font = `${Math.round((f.size || 22) * dpr)}px "Jersey 10", "Silkscreen", ui-monospace, monospace`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round((f.size || 22) * dpr * 0.05)}px`;
    ctx.textAlign = 'center';
    const y = (sy - age * 40) * dpr;
    ctx.fillStyle = 'rgba(20,24,36,0.75)';
    ctx.fillText(f.text, sx * dpr + 2 * dpr, y + 2 * dpr);
    ctx.fillStyle = f.color || '#ffd75a';
    ctx.fillText(f.text, sx * dpr, y);
  }
  ctx.globalAlpha = 1;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}
