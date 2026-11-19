// ---------------------------------------------------------------------------
// Networks: level-aware road/rail components (tunnels and bridges included),
// the player's bus and train lines, the Grand Prix circuit, and who can reach
// which shops, leisure and stops.
// ---------------------------------------------------------------------------
const NET = { roadComp: null, railComp: null, nRoad: 0, nRail: 0, stations: [], roadPortalComp: -1, railPortalComp: -1, stopLines: new Map(), sources: [] };
const _nb = [];

function components(bit) {
  const comp = new Int32Array(MAP_W * MAP_H).fill(-1);
  let n = 0; const q = [], nb = [];
  for (let i = 0; i < MAP_W * MAP_H; i++) {
    if (!(G.net[i] & bit) || comp[i] >= 0) continue;
    comp[i] = n; q.length = 0; q.push(i);
    for (let h = 0; h < q.length; h++) {
      for (const [k2] of netNext(q[h], bit, nb)) if (comp[k2] < 0) { comp[k2] = n; q.push(k2); }
    }
    n++;
  }
  return { comp, n };
}

// road components touching a building's footprint on the same level
function accessComps(b) {
  const s = new Set();
  for (const [tx, ty] of footprint(b.type, b.x, b.y)) {
    const lvl = tileLevel(tx, ty);
    for (const [dx, dy] of DIRS) {
      const nx = tx + dx, ny = ty + dy;
      if (!roadAt(nx, ny, lvl)) continue;
      const c = NET.roadComp[G.idx(nx, ny)]; if (c >= 0) s.add(c);
    }
  }
  return s;
}
// road tiles a vehicle can use to reach a building
function doorTiles(b) {
  const out = [];
  for (const [tx, ty] of footprint(b.type, b.x, b.y)) {
    const lvl = tileLevel(tx, ty);
    for (const [dx, dy] of DIRS) { const nx = tx + dx, ny = ty + dy; if (roadAt(nx, ny, lvl)) out.push(G.idx(nx, ny)); }
  }
  return out;
}

function computeNetworks() {
  const r = components(N_ROAD), l = components(N_RAIL);
  NET.roadComp = r.comp; NET.nRoad = r.n; NET.railComp = l.comp; NET.nRail = l.n;
  const map = G.map;
  NET.roadPortalK = G.idx(map.roadPortal.x, map.roadPortal.y);
  NET.railPortalK = G.idx(map.railPortal.x, map.railPortal.y);
  NET.roadPortalComp = NET.roadComp[NET.roadPortalK];
  NET.railPortalComp = NET.railComp[NET.railPortalK];
  NET.stations = [];
  for (const b of G.buildings.values()) {
    b.access = b.type === 'port' || b.type === 'station' ? accessComps(b) : accessComps(b);
    b.roadAccess = b.access.size > 0;
    if (b.type === 'station' && b.done) {
      const k = G.idx(b.x, b.y);
      NET.stations.push({ b, k, rail: NET.railComp[k], freight: NET.railComp[k] === NET.railPortalComp && NET.railPortalComp >= 0 });
    }
  }
  // supply truck sources: harbours, the road tunnel, rail freight stations
  const src = [];
  for (const b of G.buildings.values()) if (b.type === 'port' && b.done) src.push({ kind: 'port', b, comps: b.access, trucks: PORT_LV[b.plv].trucks, from: doorTiles(b) });
  // the road tunnel only counts once its road reaches a shop or a harbour
  if (NET.roadPortalComp >= 0 && [...G.buildings.values()].some((b) => (SHOPS.has(b.type) || b.type === 'port') && b.access.has(NET.roadPortalComp))) src.push({ kind: 'tunnel', comps: new Set([NET.roadPortalComp]), trucks: TUNNEL_TRUCKS, from: [NET.roadPortalK] });
  const fr = NET.stations.find((s) => s.freight && s.b.access.size);
  if (fr) src.push({ kind: 'freight', b: fr.b, comps: fr.b.access, trucks: FREIGHT_TRUCKS, from: doorTiles(fr.b) });
  NET.sources = src;
  let roadLink = false;
  for (const b of G.buildings.values()) if (b.type === 'port' && b.access.has(NET.roadPortalComp)) roadLink = true;
  G.links = { road: NET.roadPortalComp >= 0 && roadLink, rail: !!fr };
  validateLines();
}

// ---- lines ------------------------------------------------------------------------------------
function lineStopOk(kind, k) {
  const L = LINE_KIND[kind];
  if (L.stop === 'busstop') return G.busStops.has(k);
  const b = G.buildings.get(G.bid[k]);
  return !!(b && b.type === 'station' && b.done);
}
// tile route between two tiles over one network (tiles and span hops)
function routeTiles(a, b, bit) {
  if (a === b) return [a];
  const prev = new Map([[a, -1]]), q = [a], nb = [];
  for (let h = 0; h < q.length; h++) {
    const k = q[h];
    if (k === b) break;
    for (const [k2] of netNext(k, bit, nb)) { if (prev.has(k2)) continue; prev.set(k2, k); q.push(k2); }
  }
  if (!prev.has(b)) return null;
  const out = []; let c = b;
  while (c !== -1) { out.push(c); c = prev.get(c); }
  return out.reverse();
}
function lineRoute(line) {
  const L = LINE_KIND[line.kind], bit = L.net;
  const stops = line.stops.slice();
  if (stops.length < 2) return { ok: false, why: 'A line needs at least two stops' };
  const loop = line.kind === 'bus' || line.kind === 'rail';
  const legs = [];
  const n = loop && stops.length > 2 ? stops.length : stops.length - 1;
  for (let i = 0; i < n; i++) {
    const a = stops[i], b = stops[(i + 1) % stops.length];
    const seg = routeTiles(a, b, bit);
    if (!seg) return { ok: false, why: `No ${bit === N_ROAD ? 'road' : 'track'} connects stop ${i + 1} and stop ${((i + 1) % stops.length) + 1}` };
    legs.push(seg);
  }
  if (!loop || stops.length === 2) {
    // shuttle: run the legs back in reverse
    const back = legs.slice().reverse().map((s) => s.slice().reverse());
    for (const s of back) legs.push(s);
  }
  let tiles = [];
  const stopIdx = [];
  for (const seg of legs) { stopIdx.push(tiles.length ? tiles.length - 1 : 0); tiles = tiles.length ? tiles.concat(seg.slice(1)) : seg.slice(); }
  return { ok: true, tiles, stopIdx, length: tiles.length };
}
function lineCapacity(line) { const L = LINE_KIND[line.kind]; return line.valid ? line.vehicles * L.seats * L.trips : 0; }
function validateLines() {
  NET.stopLines = new Map();
  for (const line of G.lines.values()) {
    const r = lineRoute(line);
    line.valid = r.ok && line.stops.every((k, i) => (LINE_KIND[line.kind].outside && i === 0) || lineStopOk(line.kind, k));
    line.why = r.ok ? (line.valid ? null : 'A stop is missing') : r.why;
    line.route = r.ok ? r : null;
    if (LINE_KIND[line.kind].outside) {
      line.tourOk = line.valid && G.buildings.size && [...G.buildings.values()].some((b) => b.type === 'tourist' && b.done && distTo(b, line.stops[1] % MAP_W, (line.stops[1] / MAP_W) | 0) <= radiusOf(b) + 0.5);
      if (line.valid && !line.tourOk) line.why = 'The last stop is outside every Tourist Centre radius';
    }
    if (!line.valid) continue;
    for (const k of line.stops) { if (!NET.stopLines.has(k)) NET.stopLines.set(k, []); NET.stopLines.get(k).push(line); }
  }
}
function newLineCost(kind, nStops) { const L = LINE_KIND[kind]; return L.setup + L.perStop * nStops + L.buy; }
function createLine(kind, stops) {
  const L = LINE_KIND[kind];
  const line = { id: G.nextLine++, kind, stops: stops.slice(), vehicles: 1, color: L.colors[(G.nextLine - 1) % L.colors.length], riders: 0, demand: 0 };
  const r = lineRoute(line);
  if (!r.ok) return { ok: false, why: r.why };
  const cost = newLineCost(kind, stops.length);
  if (G.money < cost) return { ok: false, why: `Costs ${fmtMoney(cost)}` };
  spend(cost);
  line.name = `${L.name} ${[...G.lines.values()].filter((q) => q.kind === kind).length + 1}`;
  G.lines.set(line.id, line);
  G.dirtyNet = true; G.rev++;
  return { ok: true, line, cost };
}
function lineVehicles(line, delta) {
  const L = LINE_KIND[line.kind];
  if (delta > 0) {
    if (line.vehicles >= 8) return { ok: false, why: 'At most eight vehicles per line' };
    if (G.money < L.buy) return { ok: false, why: `A ${L.vehicle.toLowerCase()} costs ${fmtMoney(L.buy)}` };
    spend(L.buy); line.vehicles++;
  } else {
    if (line.vehicles <= 1) return { ok: false, why: 'A line needs at least one vehicle. Delete the line instead.' };
    line.vehicles--; G.money += Math.round(L.buy * 0.3);
  }
  G.dirtyHappy = true; G.rev++;
  return { ok: true };
}
function deleteLine(line) { G.lines.delete(line.id); G.dirtyNet = true; G.rev++; }
function removeStopFromLines(k) {
  for (const line of [...G.lines.values()]) {
    if (!line.stops.includes(k)) continue;
    line.stops = line.stops.filter((s) => s !== k);
    const outside = LINE_KIND[line.kind].outside;
    if (line.stops.length < 2 || (outside && line.stops.length < 2)) G.lines.delete(line.id);
  }
  G.dirtyNet = true;
}
// distance in tiles between a tile and a building footprint (0 when touching)
const stopXY = (k) => [k % MAP_W, (k / MAP_W) | 0];

// ---- the Grand Prix circuit ---------------------------------------------------------------------
function circuitRoute(points) {
  if (points.length < 3) return { ok: false, why: 'Click at least three points around your streets' };
  let tiles = [];
  for (let i = 0; i < points.length; i++) {
    const seg = routeTiles(points[i], points[(i + 1) % points.length], N_ROAD);
    if (!seg) return { ok: false, why: 'The roads between two of your points are not connected' };
    tiles = tiles.length ? tiles.concat(seg.slice(1)) : seg.slice();
  }
  tiles.pop();
  if (tiles.some((k) => G.net[k] & N_PORTAL)) return { ok: false, why: 'The circuit cannot use the mountain tunnel' };
  const uniq = new Set(tiles);
  if (uniq.size < F1.minTiles) return { ok: false, why: `Too short: ${uniq.size} road tiles, the Grand Prix needs ${F1.minTiles}` };
  const fresh = [...uniq].filter((k) => !(G.net[k] & N_CIRCUIT)).length;
  return { ok: true, tiles, n: uniq.size, cost: fresh * F1.tileFee };
}
function buildCircuit(points) {
  const r = circuitRoute(points);
  if (!r.ok) return r;
  if (G.money < r.cost) return { ok: false, why: `Costs ${fmtMoney(r.cost)}` };
  if (G.circuit) for (const k of G.circuit.tiles) G.net[k] &= ~N_CIRCUIT;
  spend(r.cost);
  for (const k of r.tiles) G.net[k] |= N_CIRCUIT;
  G.circuit = { points: points.slice(), tiles: r.tiles };
  for (const k of r.tiles) touch(k % MAP_W - 1, ((k / MAP_W) | 0) - 1, k % MAP_W + 1, ((k / MAP_W) | 0) + 1);
  G.dirtyHappy = true; G.rev++;
  return { ok: true, n: r.n, cost: r.cost };
}
function breakCircuit() {
  if (!G.circuit) return;
  for (const k of G.circuit.tiles) { G.net[k] &= ~N_CIRCUIT; touch(k % MAP_W - 1, ((k / MAP_W) | 0) - 1, k % MAP_W + 1, ((k / MAP_W) | 0) + 1); }
  G.circuit = null;
  emit('circuitBroken');
}

// ---- who reaches what ------------------------------------------------------------------------------
// Shops sell to homes inside their radius; a line extends a shop's reach to homes near any stop of
// that line when one of its stops lies inside the shop's radius.
function computeAccess() {
  const homes = [], stores = [], amen = [];
  for (const b of G.buildings.values()) {
    if (!b.done) continue;
    if (HOUSING.has(b.type)) { homes.push(b); b.reach = {}; b.lines = []; b.transit = null; }
    if (SHOPS.has(b.type) && !b.closed) { stores.push(b); b.demand = {}; b.custHomes = 0; for (const g in B[b.type].goods) b.demand[g] = 0; }
    if (LEISURE.has(b.type) && !b.closed) amen.push(b);
  }
  // lines near each home
  const lineList = [...G.lines.values()].filter((l) => l.valid && !LINE_KIND[l.kind].outside);
  for (const line of lineList) { line.demand = 0; line.nearHomes = []; line.stopTiles = line.stops.map(stopXY); }
  for (const h of homes) {
    for (const line of lineList) {
      const walk = TRANSIT_WALK + (line.kind === 'rail' ? 1 : 0);
      if (line.stopTiles.some(([sx, sy]) => distTo(h, sx, sy) <= walk)) { h.lines.push(line); line.nearHomes.push(h); line.demand += h.res * 0.3; }
    }
    if (h.lines.length) h.transit = h.lines.some((l) => l.kind === 'rail') ? 'rail' : 'bus';
  }
  // shops: direct radius and line-extended reach
  for (const s of stores) {
    const R = radiusOf(s), goods = Object.keys(B[s.type].goods);
    const viaLines = lineList.filter((line) => line.stopTiles.some(([sx, sy]) => distTo(s, sx, sy) <= R));
    for (const h of homes) {
      const d = Math.hypot((h.x + sizeOf(h.type)[0] / 2) - (s.x + sizeOf(s.type)[0] / 2), (h.y + sizeOf(h.type)[1] / 2) - (s.y + sizeOf(s.type)[1] / 2));
      let w = 0;
      if (distTo(s, h.x, h.y) <= R + 0.01) w = 1 / (1 + d * 0.12);
      else if (viaLines.length && h.lines.some((l) => viaLines.includes(l))) w = 0.55 / (1 + d * 0.05);
      if (!w) continue;
      for (const g of goods) (h.reach[g] = h.reach[g] || []).push({ s, w });
    }
  }
  // split each home's daily need between the shops that reach it
  const minPop = (g) => G.pop >= GOODS[g].minPop;
  for (const h of homes) {
    for (const g in h.reach) {
      const list = h.reach[g];
      let ws = 0; for (const e of list) ws += e.w * (0.4 + 0.6 * (e.s.sat && e.s.sat[g] != null ? e.s.sat[g] : 1));
      for (const e of list) {
        e.share = ws ? (e.w * (0.4 + 0.6 * (e.s.sat && e.s.sat[g] != null ? e.s.sat[g] : 1))) / ws : 0;
        if (minPop(g) || g === 'groceries') e.s.demand[g] += h.res * GOODS[g].need * e.share;
        e.s.custHomes++;
      }
    }
  }
  // leisure and landmarks: happiness in a radius
  for (const h of homes) {
    h.amen = []; let calm = false, heat = false;
    for (const l of amen) {
      const r = radiusOf(l), dd = distTo(l, h.x, h.y);
      if (dd > r + 0.5) continue;
      h.amen.push({ l, f: 1 - dd / (r + 1.5) });
      if (B[l.type].calm) calm = true;
      if (B[l.type].heat) heat = true;
    }
    h.calm = calm; h.heatCover = heat;
  }
  // line demand vs capacity
  for (const line of lineList) { const cap = lineCapacity(line); line.riders = Math.min(line.demand, cap); line.load = cap ? line.demand / cap : 0; }
}
