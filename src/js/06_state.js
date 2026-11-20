// ---------------------------------------------------------------------------
// Game state: layers, terrain levels, buildings, spans, placement and actions
// ---------------------------------------------------------------------------
const G = {
  map: null, net: null, bid: null, lvl: null, ramp: null,
  buildings: new Map(), nextId: 1, busStops: new Map(),
  spans: new Map(), spanTile: new Map(), spanEnd: new Map(), nextSpan: 1,
  lines: new Map(), nextLine: 1, circuit: null,
  view: 0, money: 0, loans: [], debtDays: 0, tax: 'normal',
  t: 0, speed: 1, movingList: 0, pop: 0, effPop: 0, happy: 0.7, level: 0,
  weather: 'sunny', forecast: 'sunny', unhappyDays: 0, buzz: 0, strike: false, protest: null,
  links: { road: false, rail: false },
  tourists: { day: 0, guests: 0, cap: 0, beds: 0, potential: 0, turnedAway: 0 },
  moods: [], f1: null, race: null, pending: null, petition: null, lastPetition: 0, unrestDays: 0, strikeDays: 0,
  deliveries: [], supply: null, touched: [],
  today: null, history: [], goals: {}, name: 'Port Azur', seed: 1,
  complaints: [], praise: [], dirtyNet: true, dirtyHappy: true, rev: 0, terraRev: 0,
  stats: { built: 0, races: 0 }, started: false, over: false,
};

// ---- coordinates -----------------------------------------------------------------
G.viewOf = function (x, y) { return this.view === 3 ? [y, MAP_W - 1 - x] : [x, y]; };
G.worldOf = function (a, b) { return this.view === 3 ? [MAP_W - 1 - b, a] : [a, b]; };
G.viewOfC = function (x, y) { return this.view === 3 ? [y, MAP_W - x] : [x, y]; };
G.worldOfC = function (a, b) { return this.view === 3 ? [MAP_W - b, a] : [a, b]; };
G.inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
G.idx = (x, y) => y * MAP_W + x;
G.typeAt = function (x, y) { return this.inMap(x, y) ? this.map.type[y * MAP_W + x] : T_MOUNT; };
G.isRailPortal = function (x, y) { const p = this.map.railPortal; return p.x === x && p.y === y; };
G.day = function () { return Math.floor(this.t / DAY_MIN) + 1; };
G.minute = function () { return this.t % DAY_MIN; };
G.building = function (x, y) { if (!this.inMap(x, y)) return null; const id = this.bid[y * MAP_W + x]; return id ? this.buildings.get(id) : null; };
const isLand = (t) => t === T_GRASS || t === T_BEACH;

// ---- terrain shape -----------------------------------------------------------------
// corner heights in px: [nw, ne, se, sw]
function corners(x, y) {
  if (!G.inMap(x, y)) return [0, 0, 0, 0];
  const k = y * MAP_W + x, t = G.map.type[k];
  if (t === T_MOUNT) return tileCorners(G.map, x, y);
  if (t === T_SEA) return [SEA_Z, SEA_Z, SEA_Z, SEA_Z];
  const h = G.lvl[k] * STEP, c = [h, h, h, h];
  const r = G.ramp[k];
  if (r) { const d = r - 1; const up = [[0, 1], [1, 2], [2, 3], [3, 0]][d]; c[up[0]] += STEP; c[up[1]] += STEP; }
  return c;
}
// edge heights matched with the neighbour's opposite edge: N [nw,ne] S [sw,se] E [ne,se] W [nw,sw]
function edgeH(x, y, d) {
  const c = corners(x, y);
  return d === 0 ? [c[0], c[1]] : d === 2 ? [c[3], c[2]] : d === 1 ? [c[1], c[2]] : [c[0], c[3]];
}
function surfaceZ(fx, fy) {
  const x = Math.floor(fx), y = Math.floor(fy);
  if (!G.inMap(x, y)) return 0;
  const c = corners(x, y), ax = fx - x, ay = fy - y;
  return lerp(lerp(c[0], c[1], ax), lerp(c[3], c[2], ax), ay);
}
const flatTile = (x, y) => { const k = G.idx(x, y); return isLand(G.map.type[k]) && !G.ramp[k]; };
const tileZ = (x, y) => G.lvl[G.idx(x, y)] * STEP;

// two adjacent tiles joined for a network bit (same edge heights, or a tunnel stub)
function linked(x, y, d, bit) {
  const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
  if (!G.inMap(nx, ny)) return false;
  const k = G.idx(x, y), k2 = G.idx(nx, ny);
  if (!(G.net[k] & bit) || !(G.net[k2] & bit)) return false;
  if (G.net[k] & N_PORTAL) return d === 2;
  if (G.net[k2] & N_PORTAL) return d === 0;
  const a = edgeH(x, y, d), b = edgeH(nx, ny, OPP[d]);
  return a[0] === b[0] && a[1] === b[1];
}
// arms: linked neighbours plus span directions
function netMask(Gm, x, y, bit) {
  let m = 0;
  for (let d = 0; d < 4; d++) if (linked(x, y, d, bit)) m |= 1 << d;
  const ends = G.spanEnd.get(G.idx(x, y));
  if (ends) for (const s of ends) if (s.bit === bit) m |= 1 << (s.ax === x && s.ay === y ? s.dir : OPP[s.dir]);
  return m;
}
// network neighbours of tile k: adjacent linked tiles and span partners [k2, cost, span]
function netNext(k, bit, out) {
  out.length = 0;
  const x = k % MAP_W, y = (k / MAP_W) | 0;
  for (let d = 0; d < 4; d++) if (linked(x, y, d, bit)) out.push([G.idx(x + DIRS[d][0], y + DIRS[d][1]), 1, null]);
  const ends = G.spanEnd.get(k);
  if (ends) for (const s of ends) if (s.bit === bit) {
    const other = s.ax === x && s.ay === y ? G.idx(s.bx, s.by) : G.idx(s.ax, s.ay);
    out.push([other, s.len + 1, s]);
  }
  return out;
}

// ---- new game ---------------------------------------------------------------------
function newGame(seed, name, mapV = MAP_V) {
  G.seed = seed; G.name = name || 'Port Azur'; G.mapV = mapV;
  G.map = genMap(seed, mapV);
  const N = MAP_W * MAP_H;
  G.net = new Uint8Array(N); G.bid = new Int32Array(N); G.lvl = new Int8Array(N); G.ramp = new Uint8Array(N);
  G.buildings = new Map(); G.nextId = 1; G.busStops = new Map();
  G.spans = new Map(); G.spanTile = new Map(); G.spanEnd = new Map(); G.nextSpan = 1;
  G.lines = new Map(); G.nextLine = 1; G.circuit = null;
  G.money = ECON.start; G.loans = []; G.debtDays = 0; G.tax = 'normal'; G.paper = null;
  G.t = 5 * 60 + 40; G.speed = 1; G.movingList = 20; G.level = 0;
  G.weather = 'sunny'; G.forecast = 'sunny'; G.unhappyDays = 0; G.buzz = 0; G.strike = false; G.protest = null;
  G.history = []; G.goals = {}; G.stats = { built: 0, races: 0 }; G.over = false;
  G.tourists = { day: 0, guests: 0, cap: 0, beds: 0, potential: 0, turnedAway: 0 };
  G.moods = []; G.f1 = null; G.race = null; G.pending = null; G.petition = null; G.lastPetition = 0;
  G.unrestDays = 0; G.strikeDays = 0; G.deliveries = []; G.supply = null; G.touched = [];
  newToday();
  computeSeaDist();
  G.decorBlock = new Set(G.map.decor.filter((d) => d.kind !== 'lighthouse').map((d) => G.idx(d.x, d.y)));
  const rp = G.map.roadPortal, lp = G.map.railPortal;
  G.net[G.idx(rp.x, rp.y)] = N_ROAD | N_PORTAL;
  G.net[G.idx(lp.x, lp.y)] = N_RAIL | N_PORTAL;
  G.net[G.idx(rp.x, rp.y + 1)] |= N_ROAD;
  G.net[G.idx(lp.x, lp.y + 1)] |= N_RAIL;
  // starting town: a small harbour, an apartment block, a corner grocer and five road tiles
  const px = START.portX, py = G.map.coast[px];
  addBuilding('port', px, py, { done: true, plv: 0 });
  const rx = px + 2;
  for (let k = 1; k <= 5; k++) G.net[G.idx(rx, py - k)] |= N_ROAD;
  addBuilding('apartment', rx - 1, py - 3, { done: true, facing: 1 });
  addBuilding('grocer', rx + 1, py - 4, { done: true, facing: 3 });
  G.view = 0;
  G.dirtyNet = true; G.dirtyHappy = true;
  recomputeAll();
  G.movingList = 20;
}

function computeSeaDist() {
  const d = new Uint8Array(MAP_W * MAP_H).fill(99), q = [];
  for (let i = 0; i < MAP_W * MAP_H; i++) if (G.map.type[i] === T_SEA) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MAP_W, y = (i / MAP_W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy; if (!G.inMap(nx, ny)) continue;
      const k = G.idx(nx, ny); if (d[k] > d[i] + 1) { d[k] = d[i] + 1; q.push(k); }
    }
  }
  G.seaDist = d;
}
function newToday() {
  G.today = { port: 0, stores: 0, tourism: 0, hotels: 0, fares: 0, grants: 0, race: 0, upkeep: 0, services: 0, wholesale: 0, staff: 0, transit: 0, interest: 0, fees: 0, spent: 0, built: 0, movedIn: 0, movedOut: 0 };
}

// ---- redraw bookkeeping: rectangles of tiles whose sprites must be rebuilt -----------------------
function touch(x0, y0, x1, y1) { G.touched.push([x0, y0, x1, y1]); }
function footTouch(b, r = 5) { const [w, h] = sizeOf(b.type); touch(b.x - r, b.y - r, b.x + w - 1 + r, b.y + h - 1 + r); }
function tilesTouch(tiles, r = 1) { for (const [x, y] of tiles) touch(x - r, y - r, x + r, y + r); }

// ---- building helpers -------------------------------------------------------------------
function sizeOf(type) { return B[type].size || [1, 1]; }
function footprint(type, x, y) {
  const [w, h] = sizeOf(type), r = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) r.push([x + i, y + j]);
  return r;
}
const lvAt = (arr, lv) => (Array.isArray(arr) ? arr[Math.min(lv, arr.length) - 1] : arr || 0);
function capOf(b) { return lvAt(B[b.type].cap, b.lv); }
function goodsCap(b, g) { const d = B[b.type]; return d.goods && d.goods[g] ? lvAt(d.goods[g], b.lv) : 0; }
function radiusOf(b) { return lvAt(B[b.type].radius, b.lv); }
function joyOf(b) { return lvAt(B[b.type].joy, b.lv); }
function bedsOf(b) { return lvAt(B[b.type].beds, b.lv); }
function walkOf(b) { return B[b.type].walk || 5; }
// distance from a tile to the nearest tile of a building's footprint
function distTo(b, x, y) {
  const [w, h] = sizeOf(b.type);
  const dx = x < b.x ? b.x - x : x > b.x + w - 1 ? x - (b.x + w - 1) : 0;
  const dy = y < b.y ? b.y - y : y > b.y + h - 1 ? y - (b.y + h - 1) : 0;
  return Math.hypot(dx, dy);
}

function addBuilding(type, x, y, o = {}) {
  const id = G.nextId++;
  const b = {
    id, type, x, y, lv: o.lv || 1, v: o.v != null ? o.v : Math.floor(hash2(x, y, G.seed + id) * 9),
    facing: o.facing != null ? o.facing : chooseFacing(type, x, y), done: !!o.done, doneAt: o.doneAt || 0,
    res: 0, stock: {}, demand: {}, sat: {}, happy: 0.7, lowDays: 0, idleDays: 0, sold: 0, rev: 0, plv: o.plv || 0, age: 0,
  };
  for (const [tx, ty] of footprint(type, x, y)) G.bid[G.idx(tx, ty)] = id;
  if (sizeOf(type)[0] * sizeOf(type)[1] > 1) b.facing = 2;
  if (b.done) initBuilding(b);
  G.buildings.set(id, b);
  footTouch(b);
  G.dirtyNet = true; G.dirtyHappy = true; G.rev++;
  return b;
}
function initBuilding(b) {
  if (HOUSING.has(b.type)) b.res = capOf(b);
  const d = B[b.type];
  if (d.goods) for (const g in d.goods) { b.stock[g] = goodsCap(b, g) * 0.6; b.sat[g] = 1; }
}
function removeBuilding(b) {
  for (const [tx, ty] of footprint(b.type, b.x, b.y)) G.bid[G.idx(tx, ty)] = 0;
  G.buildings.delete(b.id);
  if (b.type === 'station') removeStopFromLines(G.idx(b.x, b.y));
  footTouch(b);
  G.dirtyNet = true; G.dirtyHappy = true; G.rev++;
}
function chooseFacing(type, x, y) {
  if (sizeOf(type)[0] * sizeOf(type)[1] > 1) return 2;
  for (const d of [2, 1, 3, 0]) if (roadAt(x + DIRS[d][0], y + DIRS[d][1], tileLevel(x, y))) return d;
  return 2;
}
const tileLevel = (x, y) => (G.inMap(x, y) ? G.lvl[G.idx(x, y)] : 0);
// a usable road beside a building: same terrace level, flat, not the tunnel mouth
function roadAt(x, y, lvl) {
  if (!G.inMap(x, y)) return false;
  const k = G.idx(x, y);
  return (G.net[k] & N_ROAD) && !(G.net[k] & N_PORTAL) && !G.ramp[k] && G.lvl[k] === lvl;
}
function roadAdjacentFoot(type, x, y) {
  for (const [tx, ty] of footprint(type, x, y)) for (const [dx, dy] of DIRS) if (roadAt(tx + dx, ty + dy, tileLevel(tx, ty))) return true;
  return false;
}
function unlocked(type) { return G.level >= B[type].lvl; }
function countType(type) { let n = 0; for (const b of G.buildings.values()) if (b.type === type) n++; return n; }

// ---- placement ------------------------------------------------------------------------
function money(cost) { return G.money >= cost ? { ok: true, cost } : { ok: false, why: `Costs ${fmtMoney(cost)}`, cost }; }
function lockWhy(type) { const d = B[type]; return `Unlocks at ${LEVELS[d.lvl].name} (${fmtNum(LEVELS[d.lvl].pop)} residents)`; }

function canPlace(type, x, y, ignore) {
  const d = B[type];
  if (!G.inMap(x, y)) return { ok: false, why: 'Outside the map' };
  if (!unlocked(type)) return { ok: false, why: lockWhy(type) };
  const cost = ignore ? 0 : d.cost;
  const k = G.idx(x, y), ty = G.map.type[k];
  if (type === 'busstop') {
    if (!(G.net[k] & N_ROAD) || (G.net[k] & N_PORTAL)) return { ok: false, why: 'Place bus stops on a road' };
    if (G.net[k] & N_RAIL) return { ok: false, why: 'Not on a level crossing' };
    if (G.ramp[k]) return { ok: false, why: 'Not on a ramp' };
    if (G.busStops.has(k)) return { ok: false, why: 'There is already a stop here' };
    if (busSide(x, y) < 0) return { ok: false, why: 'No free sidewalk on this tile' };
    return money(cost);
  }
  if (type === 'station') {
    if (!(G.net[k] & N_RAIL) || (G.net[k] & N_PORTAL)) return { ok: false, why: 'Place stations on a rail track' };
    if (G.net[k] & N_ROAD) return { ok: false, why: 'Not on a level crossing' };
    if (G.ramp[k]) return { ok: false, why: 'Not on a ramp' };
    if (G.bid[k] && G.bid[k] !== (ignore && ignore.id)) return { ok: false, why: 'Occupied' };
    const m = netMask(G, x, y, N_RAIL);
    if (m !== 5 && m !== 10 && m !== 1 && m !== 4 && m !== 2 && m !== 8) return { ok: false, why: 'Stations need a straight piece of track' };
    if (!roadAdjacentFoot('station', x, y)) return { ok: false, why: 'Needs a road next to it, on the same level' };
    return money(cost);
  }
  if (d.unique && countType(type) > 0 && !ignore) return { ok: false, why: 'You can only build one' };
  const tiles = footprint(type, x, y);
  const lvl0 = tileLevel(x, y);
  for (const [tx, ty2] of tiles) {
    if (!G.inMap(tx, ty2)) return { ok: false, why: 'Outside the map' };
    const kk = G.idx(tx, ty2), t2 = G.map.type[kk];
    if (G.bid[kk] && G.bid[kk] !== (ignore && ignore.id)) return { ok: false, why: 'Occupied' };
    if (G.net[kk]) return { ok: false, why: 'Remove the road or track first' };
    if (G.spanTile.has(kk) && G.spanTile.get(kk).kind === 'bridge') return { ok: false, why: 'A bridge passes over here' };
    if (G.ramp[kk]) return { ok: false, why: 'Not on a slope' };
    if (G.lvl[kk] !== lvl0) return { ok: false, why: 'The ground must be level' };
    if (type === 'port') {
      if (t2 !== T_BEACH) return { ok: false, why: 'Needs five straight beach tiles' };
      if (G.typeAt(tx, ty2 + 1) !== T_SEA || G.typeAt(tx, ty2 + 2) !== T_SEA) return { ok: false, why: 'Open sea must lie directly south' };
      continue;
    }
    if (d.place === 'beach' && t2 !== T_BEACH) return { ok: false, why: 'Must be built on the beach' };
    if (d.place === 'grass' && t2 !== T_GRASS) return { ok: false, why: t2 === T_BEACH ? 'Too sandy to build here' : 'Can only build on grass plots' };
  }
  if (d.road && !roadAdjacentFoot(type, x, y)) return { ok: false, why: 'Needs a road next to it, on the same level' };
  if (HOUSING.has(type) && !ignore) {
    const need = d.cap[0];
    if (G.movingList < need) return { ok: false, why: `Needs ${need} people on the moving list (${Math.floor(G.movingList)} now)` };
  }
  return money(cost);
}

// ---- roads and rails (drag) ----------------------------------------------------------------
function busSide(x, y) {
  const m = netMask(G, x, y, N_ROAD);
  for (const d of [2, 1, 3, 0]) if (!(m & (1 << d))) return d;
  return -1;
}
// check a dragged path; returns {ok, why, tiles:[new tiles], ramps:[[k,dir]], cost}
function planDrag(type, pts) {
  const bit = type === 'road' ? N_ROAD : N_RAIL, other = bit === N_ROAD ? N_RAIL : N_ROAD;
  const res = { ok: true, why: null, tiles: [], ramps: [], cost: 0, bad: [] };
  const fail = (why, x, y) => { res.ok = false; if (!res.why) res.why = why; if (x != null) res.bad.push([x, y]); };
  const rampSet = new Map();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (!G.inMap(x, y)) { fail('Outside the map'); continue; }
    const k = G.idx(x, y), t = G.map.type[k];
    if (G.net[k] & bit) continue;
    if (t === T_SEA) { fail(`Use a ${type === 'road' ? 'road' : 'rail'} bridge to cross water`, x, y); continue; }
    if (t === T_MOUNT) { fail(`Too steep. Use a ${type === 'road' ? 'road' : 'rail'} tunnel`, x, y); continue; }
    if (G.bid[k]) { fail('A building is in the way', x, y); continue; }
    if (G.spanTile.has(k) && G.spanTile.get(k).kind === 'tunnel') { /* building on top of a tunnel is fine */ }
    if (G.net[k] & other) {
      const om = netMask(G, x, y, other);
      if (G.busStops.has(k)) { fail('Remove the bus stop first', x, y); continue; }
      if (G.ramp[k]) { fail('No crossings on ramps', x, y); continue; }
      if (om !== 5 && om !== 10) { fail('Crossings need a straight piece to cross', x, y); continue; }
    }
    res.tiles.push([x, y]); res.cost += B[type].cost;
  }
  // level changes between consecutive tiles
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (!G.inMap(x0, y0) || !G.inMap(x1, y1)) continue;
    const k0 = G.idx(x0, y0), k1 = G.idx(x1, y1);
    if (!isLand(G.map.type[k0]) || !isLand(G.map.type[k1])) continue;
    const d = DIRS.findIndex(([dx, dy]) => dx === x1 - x0 && dy === y1 - y0);
    const e0 = edgeH(x0, y0, d), e1 = edgeH(x1, y1, OPP[d]);
    if (e0[0] === e1[0] && e0[1] === e1[1]) continue;
    const l0 = G.lvl[k0], l1 = G.lvl[k1];
    if (Math.abs(l0 - l1) !== 1) { fail('Too steep. Use a tunnel or a bridge', x1, y1); continue; }
    const lowK = l0 < l1 ? k0 : k1, dirUp = l0 < l1 ? d : OPP[d];
    const lx = lowK % MAP_W, ly = (lowK / MAP_W) | 0;
    const prev = rampSet.get(lowK);
    if (prev != null && prev !== dirUp) { fail('A ramp can only climb one way', lx, ly); continue; }
    if (G.ramp[lowK] && G.ramp[lowK] - 1 !== dirUp) { fail('A ramp can only climb one way', lx, ly); continue; }
    if (G.busStops.has(lowK) || G.spanEnd.has(lowK) || G.bid[lowK]) { fail('Ramps need a clear tile', lx, ly); continue; }
    // existing arms on the low tile must run along the ramp
    for (const b of [N_ROAD, N_RAIL]) {
      if (!(G.net[lowK] & b)) continue;
      const m = netMask(G, lx, ly, b);
      const axis = (1 << dirUp) | (1 << OPP[dirUp]);
      if (m & ~axis) { fail('Ramps must run straight', lx, ly); }
    }
    if ((G.net[lowK] & N_ROAD) && (G.net[lowK] & N_RAIL)) fail('No crossings on ramps', lx, ly);
    rampSet.set(lowK, dirUp);
  }
  for (const [k, d] of rampSet) if (!G.ramp[k]) res.ramps.push([k, d]);
  if (res.ok && res.cost > G.money) { res.ok = false; res.why = `Costs ${fmtMoney(res.cost)}`; }
  if (res.ok && !res.tiles.length && !res.ramps.length) { res.ok = false; res.why = 'Already built'; }
  return res;
}
function placeDrag(type, pts) {
  const p = planDrag(type, pts);
  if (!p.ok) return p;
  const bit = type === 'road' ? N_ROAD : N_RAIL;
  for (const [x, y] of p.tiles) G.net[G.idx(x, y)] |= bit;
  for (const [k, d] of p.ramps) G.ramp[k] = d + 1;
  spend(p.cost);
  G.dirtyNet = true; G.dirtyHappy = true; G.rev++; G.terraRev++;
  const tiles = p.tiles.concat(p.ramps.map(([k]) => [k % MAP_W, (k / MAP_W) | 0]));
  tilesTouch(tiles, 2);
  return { ok: true, tiles, cost: p.cost, n: p.tiles.length };
}
// L-shaped tile path from a to b (x first, then y)
function linePath(x0, y0, x1, y1) {
  const pts = [];
  const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
  let x = x0, y = y0; pts.push([x, y]);
  while (x !== x1) { x += sx; pts.push([x, y]); }
  while (y !== y1) { y += sy; pts.push([x, y]); }
  return pts;
}
// straight path (dominant axis) used by tunnels and bridges
function straightPath(x0, y0, x1, y1) {
  if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) y1 = y0; else x1 = x0;
  return linePath(x0, y0, x1, y1);
}

// ---- terraforming -------------------------------------------------------------------------
function canTerra(x, y, dir) {
  if (!G.inMap(x, y)) return { ok: false, why: 'Outside the map' };
  const k = G.idx(x, y), t = G.map.type[k];
  if (t !== T_GRASS) return { ok: false, why: t === T_BEACH ? 'The beach stays at sea level' : t === T_SEA ? 'Cannot reshape the sea' : 'The mountain is solid rock' };
  if (G.bid[k] || G.net[k]) return { ok: false, why: 'Clear the plot first' };
  if (G.spanTile.has(k)) return { ok: false, why: G.spanTile.get(k).kind === 'bridge' ? 'A bridge passes over here' : 'A tunnel runs under here' };
  const nl = G.lvl[k] + dir;
  if (nl > LVL_MAX) return { ok: false, why: 'As high as it goes' };
  if (nl < LVL_MIN) return { ok: false, why: 'As low as it goes' };
  if (nl < 0) for (const [dx, dy] of DIRS) if (G.typeAt(x + dx, y + dy) === T_SEA || G.typeAt(x + dx, y + dy) === T_BEACH) return { ok: false, why: 'Too close to the sea to dig down' };
  for (let d = 0; d < 4; d++) {
    const nx = x + DIRS[d][0], ny = y + DIRS[d][1]; if (!G.inMap(nx, ny)) continue;
    const r = G.ramp[G.idx(nx, ny)];
    if (r && r - 1 === OPP[d]) return { ok: false, why: 'A ramp climbs onto this plot' };
  }
  return money(ECON.terraform);
}
function terra(x, y, dir) {
  const r = canTerra(x, y, dir);
  if (!r.ok) return r;
  spend(r.cost);
  G.lvl[G.idx(x, y)] += dir;
  touch(x - 1, y - 1, x + 1, y + 1);
  G.dirtyNet = true; G.dirtyHappy = true; G.rev++; G.terraRev++;
  return { ok: true, tiles: [[x, y]], cost: r.cost };
}

// ---- tunnels and bridges -------------------------------------------------------------------
function planSpan(type, x0, y0, x1, y1) {
  const d = B[type], kind = d.span, bit = d.net;
  const pts = straightPath(x0, y0, x1, y1);
  const res = { ok: false, why: null, pts, kind, bit, cost: 0 };
  if (!unlocked(type)) { res.why = lockWhy(type); return res; }
  if (pts.length < 3) { res.why = `Drag across at least one tile`; return res; }
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const len = pts.length - 2;
  if (len > (kind === 'tunnel' ? 14 : 10)) { res.why = `Too long (max ${kind === 'tunnel' ? 14 : 10} tiles)`; return res; }
  const endOk = (x, y) => {
    if (!G.inMap(x, y)) return 'Outside the map';
    const k = G.idx(x, y);
    if (!isLand(G.map.type[k])) return 'Both ends must be on land';
    if (G.ramp[k]) return 'Ends cannot be on a ramp';
    if (G.bid[k]) return 'A building is in the way';
    if (G.net[k] & (bit === N_ROAD ? N_RAIL : N_ROAD)) return 'Not on a level crossing';
    if (G.busStops.has(k)) return 'Not on a bus stop';
    return null;
  };
  const ea = endOk(ax, ay), eb = endOk(bx, by);
  if (ea || eb) { res.why = ea || eb; return res; }
  const L = G.lvl[G.idx(ax, ay)];
  if (G.lvl[G.idx(bx, by)] !== L) { res.why = 'Both ends must be at the same height'; return res; }
  const z = L * STEP;
  for (let i = 1; i <= len; i++) {
    const [x, y] = pts[i], k = G.idx(x, y), t = G.map.type[k];
    if (G.spanTile.has(k)) { res.why = 'Another tunnel or bridge is in the way'; return res; }
    if (G.net[k] & N_PORTAL) { res.why = 'The mountain tunnel is in the way'; return res; }
    const c = corners(x, y);
    if (kind === 'tunnel') {
      if (t === T_SEA) { res.why = 'Tunnels cannot run under the sea'; return res; }
      if (Math.min(...c) < z + 12) { res.why = 'The ground above is not high enough (2 levels or the mountain)'; return res; }
    } else {
      if (t === T_MOUNT) { res.why = 'Bridges cannot cross the mountain'; return res; }
      if (t === T_SEA) { res.why = 'Bridges span lowered land, not the open sea'; return res; }
      if (G.bid[k]) { res.why = 'A building is in the way'; return res; }
      if (Math.max(...c) > z - STEP) { res.why = 'The ground below must be at least one level lower than both ends'; return res; }
    }
  }
  let cost = len * d.cost;
  for (const [x, y] of [[ax, ay], [bx, by]]) if (!(G.net[G.idx(x, y)] & bit)) cost += B[bit === N_ROAD ? 'road' : 'rail'].cost;
  res.cost = cost; res.len = len; res.a = [ax, ay]; res.b = [bx, by]; res.z = z;
  res.dir = DIRS.findIndex(([dx, dy]) => dx === Math.sign(bx - ax) && dy === Math.sign(by - ay));
  if (cost > G.money) { res.why = `Costs ${fmtMoney(cost)}`; return res; }
  res.ok = true;
  return res;
}
function buildSpan(type, x0, y0, x1, y1) {
  const p = planSpan(type, x0, y0, x1, y1);
  if (!p.ok) return p;
  const s = { id: G.nextSpan++, kind: p.kind, bit: p.bit, ax: p.a[0], ay: p.a[1], bx: p.b[0], by: p.b[1], dir: p.dir, len: p.len, z: p.z };
  addSpan(s);
  G.net[G.idx(s.ax, s.ay)] |= s.bit; G.net[G.idx(s.bx, s.by)] |= s.bit;
  tilesTouch(spanTiles(s), 2);
  spend(p.cost);
  G.dirtyNet = true; G.dirtyHappy = true; G.rev++; G.terraRev++;
  return { ok: true, span: s, tiles: p.pts, cost: p.cost };
}
function addSpan(s) {
  G.spans.set(s.id, s);
  for (let i = 1; i <= s.len; i++) G.spanTile.set(G.idx(s.ax + DIRS[s.dir][0] * i, s.ay + DIRS[s.dir][1] * i), s);
  for (const [x, y] of [[s.ax, s.ay], [s.bx, s.by]]) { const k = G.idx(x, y); if (!G.spanEnd.has(k)) G.spanEnd.set(k, []); G.spanEnd.get(k).push(s); }
}
function removeSpan(s) {
  G.spans.delete(s.id);
  for (let i = 1; i <= s.len; i++) G.spanTile.delete(G.idx(s.ax + DIRS[s.dir][0] * i, s.ay + DIRS[s.dir][1] * i));
  for (const [x, y] of [[s.ax, s.ay], [s.bx, s.by]]) {
    const k = G.idx(x, y), l = (G.spanEnd.get(k) || []).filter((q) => q !== s);
    if (l.length) G.spanEnd.set(k, l); else G.spanEnd.delete(k);
  }
  tilesTouch(spanTiles(s), 2);
  G.dirtyNet = true; G.dirtyHappy = true; G.rev++; G.terraRev++;
}
function spanTiles(s) { const r = []; for (let i = 0; i <= s.len + 1; i++) r.push([s.ax + DIRS[s.dir][0] * i, s.ay + DIRS[s.dir][1] * i]); return r; }

// ---- spending, demolish, upgrade, move, loans ---------------------------------------------------
function spend(n, kind = 'spent') { G.money -= n; G.today[kind] = (G.today[kind] || 0) + n; }

function placeBuilding(type, x, y) {
  const r = canPlace(type, x, y);
  if (!r.ok) return r;
  if (type === 'busstop') {
    spend(r.cost); G.busStops.set(G.idx(x, y), { side: busSide(x, y) }); G.net[G.idx(x, y)] |= N_BUS;
    paperBuilt('busstop');
    touch(x - 2, y - 2, x + 2, y + 2);
    G.dirtyNet = true; G.dirtyHappy = true; G.rev++;
    return { ok: true, tiles: [[x, y]] };
  }
  spend(r.cost);
  const d = B[type];
  const big = LANDMARK.has(type) || type === 'port' || type === 'hotel';
  const buildMin = big ? 300 : HOUSING.has(type) ? 150 : 120;
  const b = addBuilding(type, x, y, { done: false, doneAt: G.t + buildMin });
  if (HOUSING.has(type)) { b.reserved = d.cap[0]; G.movingList -= d.cap[0]; }
  G.stats.built++; G.today.built++;
  return { ok: true, b, tiles: footprint(type, x, y) };
}

function demolishCost(x, y) {
  if (!G.inMap(x, y)) return { ok: false, why: 'Nothing to remove' };
  const k = G.idx(x, y), b = G.building(x, y);
  if (b) {
    if (b.type === 'port' && countType('port') <= 1) return { ok: false, why: 'Your city needs its harbour' };
    return { ok: true, cost: Math.max(10, Math.round(B[b.type].cost * DEMOLISH_FEE)), what: B[b.type].name, b };
  }
  const sp = G.spanTile.get(k);
  if (sp && sp.kind === 'bridge') return { ok: true, cost: Math.round(sp.len * 60), what: sp.bit === N_ROAD ? 'Road bridge' : 'Rail bridge', span: sp };
  if (G.busStops.has(k)) return { ok: true, cost: 20, what: 'Bus Stop' };
  if (G.net[k] & N_PORTAL) return { ok: false, why: 'The mountain tunnels cannot be removed' };
  if (G.net[k] & (N_ROAD | N_RAIL)) {
    const ends = G.spanEnd.get(k);
    const what = ends ? (ends[0].kind === 'tunnel' ? 'Tunnel entrance' : 'Bridge end') : (G.net[k] & N_ROAD) && (G.net[k] & N_RAIL) ? 'Level crossing' : (G.net[k] & N_ROAD) ? 'Road' : 'Rail track';
    return { ok: true, cost: 10 + (ends ? ends.reduce((a, s) => a + s.len * 60, 0) : 0), what };
  }
  return { ok: false, why: 'Nothing to remove' };
}
function demolish(x, y) {
  const r = demolishCost(x, y);
  if (!r.ok) return r;
  spend(r.cost, 'fees');
  const k = G.idx(x, y);
  let tiles = [[x, y]];
  if (r.b) {
    const b = r.b;
    tiles = footprint(b.type, b.x, b.y);
    if (HOUSING.has(b.type)) G.movingList += b.done ? b.res : (b.reserved || 0);
    removeBuilding(b);
  } else if (r.span) { tiles = spanTiles(r.span); removeSpan(r.span); }
  else if (G.busStops.has(k)) { G.busStops.delete(k); G.net[k] &= ~N_BUS; removeStopFromLines(k); }
  else {
    const ends = G.spanEnd.get(k);
    if (ends) for (const s of [...ends]) { tiles = tiles.concat(spanTiles(s)); removeSpan(s); }
    G.net[k] &= ~(N_ROAD | N_RAIL | N_BUS | N_CIRCUIT);
    if (G.busStops.has(k)) { G.busStops.delete(k); removeStopFromLines(k); }
    G.ramp[k] = 0;
    if (G.circuit && G.circuit.tiles.includes(k)) breakCircuit();
  }
  tilesTouch(tiles, 2);
  G.dirtyNet = true; G.dirtyHappy = true; G.rev++; G.terraRev++;
  return { ok: true, tiles, cost: r.cost };
}

function upgradeInfo(b) {
  const d = B[b.type];
  if (b.type === 'port') {
    const next = PORT_LV[b.plv + 1];
    if (!next) return { ok: false, why: 'Fully upgraded' };
    if (G.level < next.lvl) return { ok: false, why: `Unlocks at ${LEVELS[next.lvl].name} (${fmtNum(LEVELS[next.lvl].pop)} residents)`, cost: next.cost, name: next.name };
    if (G.money < next.cost) return { ok: false, why: `Costs ${fmtMoney(next.cost)}`, cost: next.cost, name: next.name };
    return { ok: true, cost: next.cost, name: next.name };
  }
  const max = d.maxLevel || 3;
  if (!b.done) return { ok: false, why: 'Still under construction' };
  if (b.lv >= max) return { ok: false, why: 'Fully upgraded' };
  const need = UPGRADE_LVL[b.lv];
  const cost = Math.round(d.cost * UPGRADE_COST[b.lv]);
  if (G.level < need) return { ok: false, why: `Level ${b.lv + 1} unlocks at ${LEVELS[need].name}`, cost };
  if (d.cap) {
    const extra = d.cap[b.lv] - d.cap[b.lv - 1];
    if (G.movingList < extra) return { ok: false, why: `Needs ${extra} people on the moving list`, cost };
  }
  if (G.money < cost) return { ok: false, why: `Costs ${fmtMoney(cost)}`, cost };
  return { ok: true, cost };
}
function upgrade(b) {
  const r = upgradeInfo(b);
  if (!r.ok) return r;
  spend(r.cost);
  if (b.type === 'port') b.plv++;
  else {
    const d = B[b.type];
    if (d.cap) { const extra = d.cap[b.lv] - d.cap[b.lv - 1]; G.movingList -= extra; b.res += extra; G.today.movedIn += extra; }
    b.lv++;
  }
  footTouch(b);
  G.dirtyNet = true; G.dirtyHappy = true; G.rev++;
  return { ok: true };
}

function moveCost(b) { return Math.max(50, Math.round(B[b.type].cost * MOVE_FEE)); }
function moveBuilding(b, x, y) {
  if (sizeOf(b.type)[0] * sizeOf(b.type)[1] > 1 || b.type === 'station') return { ok: false, why: 'This building cannot be moved' };
  const cost = moveCost(b);
  const r = canPlace(b.type, x, y, b);
  if (!r.ok) return r;
  if (G.money < cost) return { ok: false, why: `Moving costs ${fmtMoney(cost)}` };
  spend(cost, 'fees');
  const old = [[b.x, b.y]];
  footTouch(b);
  G.bid[G.idx(b.x, b.y)] = 0;
  b.x = x; b.y = y; G.bid[G.idx(x, y)] = b.id;
  footTouch(b);
  b.facing = chooseFacing(b.type, x, y);
  G.dirtyNet = true; G.dirtyHappy = true; G.rev++;
  return { ok: true, tiles: old.concat([[x, y]]) };
}

function buyLicence() {
  if (G.f1 && G.f1.licensed) return { ok: false, why: 'You already hold the Grand Prix licence' };
  if (!unlocked('f1')) return { ok: false, why: lockWhy('f1') };
  if (G.money < B.f1.cost) return { ok: false, why: `Costs ${fmtMoney(B.f1.cost)}` };
  spend(B.f1.cost);
  G.f1 = { licensed: true, nextRace: G.day() + F1.every, races: 0 };
  return { ok: true };
}

// ---- bank loans: interest every evening until paid off; one of each kind, two at most ----
const loanDef = (id) => LOANS.find((l) => l.id === id);
function loanOwed() { return G.loans.reduce((a, l) => a + l.owed, 0); }
function loanInterest() { return G.loans.reduce((a, l) => a + Math.round(l.owed * l.rate), 0); }
// why a loan cannot be taken right now (or '' if it can)
function loanBlock(id) {
  const d = loanDef(id);
  if (!d) return 'No such loan';
  if (G.level < d.lvl) return `Unlocks at ${LEVELS[d.lvl].name} (${fmtNum(LEVELS[d.lvl].pop)} residents)`;
  if (G.loans.some((l) => l.id === id)) return 'Already taken: pay it off to borrow it again';
  if (G.loans.length >= MAX_LOANS) return `At most ${MAX_LOANS} loans at once: pay one off first`;
  return '';
}
function takeLoan(id) {
  const why = loanBlock(id);
  if (why) return { ok: false, why };
  const d = loanDef(id);
  G.loans.push({ id, owed: d.amount, rate: d.rate, day: G.day() });
  G.money += d.amount;
  G.dirtyHappy = true;
  return { ok: true, amount: d.amount };
}
// pay back part of a loan (a quarter of its size), or all of it with full = true
function repayLoan(id, full) {
  const l = G.loans.find((x) => x.id === id);
  if (!l) return { ok: false, why: 'No such loan' };
  const d = loanDef(id), step = d ? Math.ceil(d.amount / 4) : l.owed;
  const n = full ? l.owed : Math.min(step, l.owed);
  if (G.money < n) return { ok: false, why: `Needs ${fmtMoney(n)} in the bank` };
  G.money -= n; l.owed -= n;
  if (l.owed <= 0) G.loans = G.loans.filter((x) => x !== l);
  return { ok: true, paid: n, cleared: l.owed <= 0 };
}
