// ---------------------------------------------------------------------------
// Agents: ships, supply trucks, line buses, trains and coaches, cars,
// residents, tourists, protesters, sailboats and the Grand Prix.
// Paths are points {x, y, z, h}: z fixed (bridges, tunnels) or null (follow
// the ground), h hidden (inside a tunnel).
// ---------------------------------------------------------------------------
const AG = { list: [], ships: [], sail: [], rev: -1, spawnT: 0, lineRev: -1, race: null, crowd: [] };
const SKIN = ['#e9c4a3', '#c99572', '#8d5a3b', '#f1d3b8', '#b07a55'];
const SHIRT = ['#e04f3c', '#2d6fb8', '#f2c94c', '#f4f1e8', '#4f8a5b', '#d86f2c', '#7c4f8f', '#2b2f36'];
const F1_TEAMS = [['Rosso', '#d8202a'], ['Argento', '#c9ced3'], ['Azzurro', '#2b6fd6'], ['Arancio', '#f08a24'], ['Verde', '#1f8a4c'], ['Rosa', '#e86fa8'], ['Giallo', '#f2c230'], ['Nero', '#2b2f36'], ['Blu Notte', '#203a7a'], ['Bianco', '#f2efe8']];

function makePath(pts, round = 0.35) {
  let P = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i === 0 || i === pts.length - 1 || round <= 0) { P.push(p); continue; }
    const a = pts[i - 1], c = pts[i + 1];
    const d1 = [p.x - a.x, p.y - a.y], d2 = [c.x - p.x, c.y - p.y];
    if (Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) < 1e-6) { P.push(p); continue; }
    const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
    const r = Math.min(round, l1 / 2, l2 / 2);
    const s = [p.x - d1[0] / l1 * r, p.y - d1[1] / l1 * r], e = [p.x + d2[0] / l2 * r, p.y + d2[1] / l2 * r];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4, u = 1 - t;
      P.push({ x: u * u * s[0] + 2 * u * t * p.x + t * t * e[0], y: u * u * s[1] + 2 * u * t * p.y + t * t * e[1], z: p.z, h: p.h });
    }
  }
  P = P.filter((p, i) => i === 0 || Math.hypot(p.x - P[i - 1].x, p.y - P[i - 1].y) > 1e-4);
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y));
  return { P, L, len: L[L.length - 1] };
}
const _sp = { x: 0, y: 0, dx: 1, dy: 0, z: 0, h: false, fixed: false };
function samplePath(path, s) {
  const { P, L } = path, o = _sp;
  if (P.length === 1) { o.x = P[0].x; o.y = P[0].y; o.dx = 1; o.dy = 0; o.z = P[0].z != null ? P[0].z : surfaceZ(o.x, o.y); o.h = !!P[0].h; o.fixed = P[0].z != null; return o; }
  s = clamp(s, 0, path.len);
  let lo = 0, hi = L.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] <= s) lo = mid; else hi = mid; }
  const seg = L[hi] - L[lo] || 1, t = (s - L[lo]) / seg;
  const a = P[lo], b = P[hi];
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  o.x = a.x + dx * t; o.y = a.y + dy * t; o.dx = dx / l; o.dy = dy / l;
  o.h = a.h && b.h ? true : a.h || b.h ? (t >= 0.5 ? !!b.h : !!a.h) : false;
  if (a.z != null && b.z != null) { o.z = a.z + (b.z - a.z) * t; o.fixed = true; }
  else if (a.z != null || b.z != null) { const za = a.z != null ? a.z : surfaceZ(a.x, a.y), zb = b.z != null ? b.z : surfaceZ(b.x, b.y); o.z = za + (zb - za) * t; o.fixed = false; }
  else { o.z = surfaceZ(o.x, o.y); o.fixed = false; }
  return o;
}

// tile sequence (with span hops) -> path points
const kc = (k) => [(k % MAP_W) + 0.5, ((k / MAP_W) | 0) + 0.5];
function tilePts(tiles, idxMap) {
  const pts = [];
  const isPortal = (k) => (G.net[k] & N_PORTAL) !== 0;
  for (let i = 0; i < tiles.length; i++) {
    const k = tiles[i], [x, y] = kc(k);
    if (idxMap) idxMap[i] = pts.length;
    pts.push({ x, y, z: isPortal(k) ? 0 : null, h: isPortal(k) });
    if (i + 1 >= tiles.length) break;
    const k2 = tiles[i + 1];
    const ax = k % MAP_W, ay = (k / MAP_W) | 0, bx = k2 % MAP_W, by = (k2 / MAP_W) | 0;
    if (Math.abs(ax - bx) + Math.abs(ay - by) <= 1) continue;
    const ends = G.spanEnd.get(k) || [];
    const s = ends.find((q) => (q.ax === bx && q.ay === by) || (q.bx === bx && q.by === by));
    if (!s) continue;
    const sx = Math.sign(bx - ax), sy = Math.sign(by - ay), n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let j = 1; j < n; j++) pts.push({ x: ax + sx * j + 0.5, y: ay + sy * j + 0.5, z: s.z, h: s.kind === 'tunnel' });
  }
  return pts;
}
function bfsRoad(starts, goal, avoid) {
  const prev = new Map(), q = [], nb = [];
  for (const s of starts) { prev.set(s, -1); q.push(s); }
  for (let h = 0; h < q.length && h < 5000; h++) {
    const k = q[h];
    if (goal.has(k)) { const out = []; let c = k; while (c !== -1) { out.push(c); c = prev.get(c); } return out.reverse(); }
    for (const [k2] of netNext(k, N_ROAD, nb)) {
      if (prev.has(k2) || (G.net[k2] & N_PORTAL) || (avoid && avoid.has(k2))) continue;
      prev.set(k2, k); q.push(k2);
    }
  }
  return null;
}
function addAgent(a) { a.s = a.s || 0; a.wait = a.wait || 0; AG.list.push(a); return a; }
const count = (kind) => { let n = 0; for (const a of AG.list) if (a.kind === kind) n++; return n; };

// ---- ships ---------------------------------------------------------------------------------
function shipRoute(port) {
  const map = G.map, by = port.y + 1;
  const water = (k) => map.type[k] === T_SEA && !G.decorBlock.has(k);
  const tryFrom = (ax, dir) => {
    if (!G.inMap(ax, by) || !water(G.idx(ax, by))) return null;
    const clear = (k) => water(k) && (map.shore[k] >= 2 || ((k / MAP_W) | 0) <= by + 1);
    const prev = new Map([[G.idx(ax, by), -1]]), q = [G.idx(ax, by)];
    let goal = -1;
    for (let h = 0; h < q.length; h++) {
      const k = q[h];
      if (((k / MAP_W) | 0) >= MAP_H - 1) { goal = k; break; }
      const x = k % MAP_W, y = (k / MAP_W) | 0;
      for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (!G.inMap(nx, ny)) continue; const k2 = G.idx(nx, ny); if (prev.has(k2) || !clear(k2)) continue; prev.set(k2, k); q.push(k2); }
    }
    if (goal < 0) return null;
    const tiles = []; let c = goal; while (c !== -1) { tiles.push(c); c = prev.get(c); }
    const pts = tiles.map((k) => { const [x, y] = kc(k); return { x, y, z: 0, h: false }; });
    const simp = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) { const a = simp[simp.length - 1], b = pts[i], cc = pts[i + 1]; if ((b.x - a.x) * (cc.y - b.y) !== (b.y - a.y) * (cc.x - b.x)) simp.push(b); }
    simp.push(pts[pts.length - 1]);
    const P = (x, y) => ({ x, y, z: 0, h: false });
    return makePath([P(simp[0].x + dir * 4, MAP_H + 6), P(simp[0].x, MAP_H - 0.5), ...simp, P(port.x + 2.5, by + 0.5)], 1.6);
  };
  const P = (x, y) => ({ x, y, z: 0, h: false });
  return tryFrom(port.x - 2, -1) || tryFrom(port.x + 6, 1) || makePath([P(port.x + 2.5, MAP_H + 6), P(port.x + 2.5, by + 0.5)]);
}
function spawnShips() {
  AG.ships = [];
  for (const b of G.buildings.values()) if (b.type === 'port' && b.done) AG.ships.push({ port: b, path: shipRoute(b), size: PORT_LV[b.plv].ship });
}
function shipState(sh) {
  const m = G.minute(), p = sh.path;
  if (m < 360 || m > 760) return null;
  let s, out = false;
  if (m < 480) s = p.len * smooth((m - 360) / 120);
  else if (m < 630) s = p.len;
  else { s = p.len * (1 - smooth((m - 630) / 130)); out = true; }
  const q = samplePath(p, s);
  return { x: q.x, y: q.y, dx: out ? -q.dx : q.dx, dy: out ? -q.dy : q.dy, docked: m >= 480 && m < 630 };
}

// ---- lines: vehicles follow the player's routes -----------------------------------------------------
function rebuildLines() {
  AG.list = AG.list.filter((a) => !a.line);
  for (const line of G.lines.values()) {
    if (!line.valid || !line.route) continue;
    const L = LINE_KIND[line.kind];
    const tiles = line.route.tiles;
    const idxMap = [];
    const pts = tilePts(tiles, idxMap);
    const path = makePath(pts, line.kind === 'rail' || line.kind === 'irail' ? 0.45 : 0.3);
    const stopS = line.route.stopIdx.map((i) => {
      const p = pts[Math.min(pts.length - 1, idxMap[i] || 0)];
      let best = 0, bd = 1e9; for (let j = 0; j < path.P.length; j++) { const d = Math.abs(path.P[j].x - p.x) + Math.abs(path.P[j].y - p.y); if (d < bd) { bd = d; best = j; } }
      return path.L[best];
    });
    const rail = line.kind === 'rail' || line.kind === 'irail';
    for (let i = 0; i < line.vehicles; i++) {
      addAgent({
        kind: rail ? 'train' : line.kind === 'coach' ? 'coach' : 'bus', line: line.id, color: line.color, path, loop: true,
        s: (path.len * i) / line.vehicles, speed: rail ? 3.6 : 2.0, lane: rail ? 0 : 0.13, stopS,
        cars: rail ? (line.kind === 'irail' ? 4 : 3) : 1, car: line.kind === 'irail' ? 3 : 0,
      });
    }
  }
  AG.lineRev = G.rev;
}

// ---- spawning -------------------------------------------------------------------------------------------
function homesAndShops() {
  const homes = [], shops = [], centres = [], marks = [];
  for (const b of G.buildings.values()) {
    if (!b.done || !b.roadAccess) continue;
    if (HOUSING.has(b.type)) homes.push(b);
    else if (SHOPS.has(b.type) && !b.closed) shops.push(b);
    if (b.type === 'tourist') centres.push(b);
    if (LANDMARK.has(b.type) || b.type === 'plaza' || b.type === 'beachclub' || b.type === 'garden') marks.push(b);
  }
  return { homes, shops, centres, marks };
}
function walkPath(from, to, avoid) {
  const sr = doorTiles(from), gr = new Set(doorTiles(to));
  if (!sr.length || !gr.size || from === to) return null;
  const seg = bfsRoad(sr, gr, avoid);
  if (!seg || seg.length < 2) return null;
  const pts = tilePts(seg);
  const c = (b) => { const [w, h] = sizeOf(b.type); return { x: b.x + w / 2, y: b.y + h / 2, z: null, h: false }; };
  pts.unshift(c(from)); pts.push(c(to));
  return makePath(pts, 0.2);
}
function spawnTick(dt) {
  AG.spawnT -= dt;
  if (AG.spawnT > 0) return;
  AG.spawnT = 0.3;
  if (AG.lineRev !== G.rev) rebuildLines();
  const { homes, shops, centres, marks } = homesAndShops();
  const m = G.minute(), night = m < 360 || m >= 1320;
  const race = isRaceDay() && G.circuit ? new Set(G.circuit.tiles) : null;
  // cars
  const carT = clamp(Math.round(G.pop / 30), 2, 30) * (night ? 0.3 : 1) * (G.weather === 'storm' ? 0.6 : 1);
  if (count('car') < carT && homes.length) {
    const from = homes[(Math.random() * homes.length) | 0];
    const pool = homes.concat(shops), to = pool[(Math.random() * pool.length) | 0];
    if (to !== from) {
      const seg = bfsRoad(doorTiles(from), new Set(doorTiles(to)), race);
      if (seg && seg.length > 2) addAgent({ kind: 'car', path: makePath(tilePts(seg), 0.3), speed: 2.3 + Math.random() * 0.6, lane: 0.14, color: (Math.random() * CAR_COLORS.length) | 0 });
    }
  }
  // residents walking to the shops in their reach
  const pedT = clamp(Math.round(G.pop / 12), 3, 46) * (night ? 0.2 : 1) * (G.weather === 'rain' || G.weather === 'storm' ? 0.4 : 1);
  if (count('ped') < pedT && homes.length) {
    const from = homes[(Math.random() * homes.length) | 0];
    const opts = [];
    for (const g in from.reach || {}) for (const e of from.reach[g]) opts.push(e.s);
    const target = opts.length && Math.random() < 0.8 ? opts[(Math.random() * opts.length) | 0] : homes[(Math.random() * homes.length) | 0];
    const path = walkPath(from, target);
    if (path) addAgent({ kind: 'ped', path, speed: 0.4 + Math.random() * 0.15, lane: Math.random() < 0.5 ? 0.36 : -0.36, color: (Math.random() * SHIRT.length) | 0, skin: (Math.random() * SKIN.length) | 0 });
  }
  // tourists stroll between the tourist centre and attractions in the daytime
  const tourT = m >= 600 && m < 1140 ? clamp(Math.round(G.tourists.day / 10), 0, 40) : 0;
  if (count('tourist') < tourT && centres.length) {
    const c = centres[(Math.random() * centres.length) | 0];
    const near = marks.concat(shops).filter((b) => distTo(c, b.x, b.y) <= radiusOf(c));
    const to = near.length ? near[(Math.random() * near.length) | 0] : null;
    const path = to && (Math.random() < 0.5 ? walkPath(c, to) : walkPath(to, c));
    if (path) addAgent({ kind: 'tourist', path, speed: 0.32 + Math.random() * 0.1, lane: Math.random() < 0.5 ? 0.38 : -0.38, color: (Math.random() * SHIRT.length) | 0, skin: (Math.random() * SKIN.length) | 0, hat: ['#f4efe3', '#e2533d', '#f2c94c', '#2d6fb8'][(Math.random() * 4) | 0] });
  }
  // the morning freight train from the rail tunnel
  const fr = NET.stations.find((s) => s.freight);
  if (fr && G.links.rail && m > 420 && m < 560 && !count('freight') && !G.strike) {
    const seg = routeTiles(NET.railPortalK, fr.k, N_RAIL);
    if (seg) { const pts = tilePts(seg); addAgent({ kind: 'freight', path: makePath(pts.concat(pts.slice(0, -1).reverse()), 0.45), speed: 2.6, lane: 0, cars: 4, car: 2, stopS: [], oneway: true }); }
  }
  if (!AG.sail.length) for (let i = 0; i < 3; i++) AG.sail.push({ x: PLAY_X0 + 10 + i * 24 + Math.random() * 6, y: MAP_H - 6 + Math.random() * 4, v: 0.08 + Math.random() * 0.05, kind: i });
}

// supply trucks leave their depot at dawn, one per shop on the list
function spawnTrucks(dels) {
  dels.forEach((d, i) => {
    const s = G.buildings.get(d.id); if (!s) return;
    const goal = new Set(doorTiles(s));
    const seg = bfsRoad(d.src.from, goal, null);
    if (!seg) return;
    const pts = tilePts(seg);
    const there = makePath(pts, 0.3);
    const back = pts.slice().reverse();
    const path = makePath(pts.concat(back.slice(1)), 0.3);
    addAgent({ kind: 'truck', path, speed: 2.2, lane: 0.14, wait: i * 0.5 + Math.random() * 0.3, stopS: [there.len], color: d.src.kind === 'port' ? 0 : d.src.kind === 'tunnel' ? 1 : 2 });
  });
}

// a protest gathers in the street nearest the unhappiest homes
function spawnProtest(p) {
  AG.crowd = [];
  if (!p) return;
  let best = null, bd = 1e9;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = p.x + dx, y = p.y + dy; if (!G.inMap(x, y)) continue;
    const k = G.idx(x, y);
    if (!(G.net[k] & N_ROAD) || (G.net[k] & N_PORTAL)) continue;
    const d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = [x, y]; }
  }
  if (!best) return;
  const n = clamp(Math.round(G.pop / 25), 8, 40);
  for (let i = 0; i < n; i++) {
    const a = hash2(i, 3, 7) * Math.PI * 2, r = 0.15 + hash2(i, 4, 7) * 0.55;
    AG.crowd.push({ x: best[0] + 0.5 + Math.cos(a) * r, y: best[1] + 0.5 + Math.sin(a) * r * 0.8, color: i % SHIRT.length, skin: i % SKIN.length, sign: i % 3 === 0, ph: hash2(i, 5, 7) * 6 });
  }
}

// ---- the Grand Prix ---------------------------------------------------------------------------------------
function raceStart() {
  if (!G.circuit) return;
  const pts = G.circuit.tiles.map((k) => { const [x, y] = kc(k); return { x, y, z: null, h: false }; });
  pts.push(pts[0]);
  const path = makePath(pts, 0.45);
  const cars = [];
  for (let i = 0; i < F1.cars; i++) {
    const [name, color] = F1_TEAMS[i];
    cars.push({ i, name, color, skill: 0.9 + hash2(i, G.day(), 77) * 0.2, s: -i * 0.55, lap: 0, done: false, speed: 0 });
  }
  AG.race = { path, cars, t: 0, start: 3.2, finished: [], len: path.len };
  // spectators line the sidewalks of the circuit
  AG.crowd = AG.crowd || [];
  AG.fans = [];
  const tiles = [...new Set(G.circuit.tiles)];
  const n = Math.min(260, tiles.length * 5);
  for (let i = 0; i < n; i++) {
    const k = tiles[(hash2(i, 9, 3) * tiles.length) | 0];
    const [cx, cy] = kc(k);
    const mask = netMask(G, k % MAP_W, (k / MAP_W) | 0, N_ROAD);
    const free = [0, 1, 2, 3].filter((d) => !(mask & (1 << d)));
    if (!free.length) continue;
    const d = free[(hash2(i, 11, 3) * free.length) | 0];
    const along = (hash2(i, 12, 3) - 0.5) * 0.7;
    const off = 0.4;
    const x = cx + DIRS[d][0] * off + (DIRS[d][1] ? along : 0), y = cy + DIRS[d][1] * off + (DIRS[d][0] ? along : 0);
    AG.fans.push({ x, y, color: i % SHIRT.length, skin: i % SKIN.length, ph: hash2(i, 13, 3) * 6, flag: i % 4 === 0 });
  }
}
function raceTick(dt) {
  const R0 = AG.race; if (!R0) return;
  R0.t += dt;
  if (R0.t < R0.start) return;
  const L = R0.len, top = 8.5;
  for (const c of R0.cars) {
    if (c.done) { c.speed = Math.max(0, c.speed - dt * 6); c.s += c.speed * dt * 0.4; continue; }
    const target = top * c.skill * (0.94 + 0.12 * Math.sin(R0.t * (0.7 + c.i * 0.13) + c.i));
    c.speed += (target - c.speed) * Math.min(1, dt * 1.5);
    c.s += c.speed * dt;
    const lap = Math.floor(c.s / L);
    if (lap > c.lap) {
      c.lap = lap;
      if (c.lap >= F1.laps) { c.done = true; R0.finished.push(c); }
    }
  }
  const leader = R0.cars.reduce((a, b) => (b.s > a.s ? b : a));
  R0.leader = leader;
  if (R0.finished.length && (R0.finished.length === R0.cars.length || R0.t - (R0.finishT || (R0.finishT = R0.t)) > 6)) {
    const order = R0.finished.concat(R0.cars.filter((c) => !c.done).sort((a, b) => b.s - a.s));
    const results = order.map((c) => c.name);
    AG.race = null; AG.fans = [];
    finishRace(results);
  }
}
function raceStandings() {
  const R0 = AG.race; if (!R0) return null;
  const order = R0.finished.concat(R0.cars.filter((c) => !c.done).sort((a, b) => b.s - a.s));
  return { lap: Math.min(F1.laps, Math.max(0, Math.floor((R0.leader ? R0.leader.s : 0) / R0.len) + 1)), laps: F1.laps, order, countdown: Math.max(0, R0.start - R0.t) };
}

// ---- update ------------------------------------------------------------------------------------------------
function updateAgents(dt) {
  if (AG.race && G.speed) raceTick(dt);
  if (!G.speed && !R.attract) return;
  const mult = G.speed ? SPEEDS[G.speed] : 1;
  if (AG.rev !== G.rev) {
    AG.list = AG.list.filter((a) => a.kind === 'truck' || a.kind === 'freight');
    AG.rev = G.rev; AG.lineRev = -1;
  }
  if (AG.race) return;
  spawnTick(dt);
  for (const a of AG.list) {
    if (a.wait > 0) { a.wait -= dt * mult; continue; }
    const step = a.speed * dt * mult;
    const prevS = a.s;
    a.s += step;
    if (a.stopS) {
      for (const st of a.stopS) {
        if (prevS < st && a.s >= st) { a.s = st + 0.001; a.wait = a.kind === 'truck' ? 1.6 : a.kind === 'train' ? 2.2 : 1.2; break; }
      }
    }
    if (a.loop) { if (a.s >= a.path.len) a.s -= a.path.len; }
    else if (a.s >= a.path.len) a.dead = true;
  }
  AG.list = AG.list.filter((a) => !a.dead);
  for (const sb of AG.sail) { sb.x += sb.v * dt * mult; if (sb.x > MAP_W + 8) sb.x = -8; }
}

// everything to draw this frame: {x, y, z, dx, dy, kind, deck}
function agentDraws() {
  const out = [];
  for (const a of AG.list) {
    const cars = a.cars || 1;
    for (let i = 0; i < cars; i++) {
      const s = a.loop ? ((a.s - i * 0.5) % a.path.len + a.path.len) % a.path.len : a.s - i * 0.5;
      if (s < 0) continue;
      const q = samplePath(a.path, s);
      if (q.h) continue;
      const lx = -q.dy * a.lane, ly = q.dx * a.lane;
      out.push({ x: q.x + lx, y: q.y + ly, z: q.z, dx: q.dx, dy: q.dy, kind: a.kind, a, i, deck: q.fixed });
    }
  }
  for (const sh of AG.ships) { const st = shipState(sh); if (st) out.push({ x: st.x, y: st.y, z: 0, dx: st.dx, dy: st.dy, kind: 'ship', size: sh.size, ship: true }); }
  for (const sb of AG.sail) out.push({ x: sb.x, y: sb.y, z: 0, dx: 1, dy: 0, kind: 'sail', v: sb.kind });
  if (G.protest) for (const p of AG.crowd) out.push({ x: p.x, y: p.y, z: surfaceZ(p.x, p.y), dx: 1, dy: 0, kind: 'protester', p });
  if (AG.fans) for (const p of AG.fans) out.push({ x: p.x, y: p.y, z: surfaceZ(p.x, p.y), dx: 1, dy: 0, kind: 'fan', p });
  if (AG.race) {
    const R0 = AG.race;
    for (const c of R0.cars) {
      const s = ((c.s % R0.len) + R0.len) % R0.len;
      const q = samplePath(R0.path, s);
      const lane = ((c.i % 3) - 1) * 0.16;
      out.push({ x: q.x - q.dy * lane, y: q.y + q.dx * lane, z: q.z, dx: q.dx, dy: q.dy, kind: 'f1', c, deck: q.fixed });
    }
  }
  return out;
}
