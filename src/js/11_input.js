// ---------------------------------------------------------------------------
// Input: tools (inspect, build, drag roads, tunnels and bridges, terraform,
// lines and the circuit, move, demolish), ranges, camera controls, sounds.
// ---------------------------------------------------------------------------
const IN = {
  tool: 'inspect', type: null, drag: null, pan: null, moving: null, selected: null, draft: null,
  keys: new Set(), mouse: { x: 0, y: 0, in: false }, pointers: new Map(), pinch: null, overlay: null,
};
const placeOf = (t) => (B[t] ? B[t].place : null);

function setTool(tool, type) {
  IN.tool = tool; IN.type = type || null; IN.drag = null; IN.moving = null; IN.draft = null;
  R.ghost = null;
  if (tool === 'build' && placeOf(type) === 'line') {
    const kind = B[type].line;
    IN.draft = { kind, stops: kind === 'coach' ? [NET.roadPortalK] : kind === 'irail' ? [NET.railPortalK] : [] };
  }
  if (tool === 'circuit') IN.draft = { kind: 'circuit', points: [] };
  if (tool !== 'inspect') select(null);
  updateHover();
  updateOverlay();
  if (typeof uiToolChanged === 'function') uiToolChanged();
}
function select(b) {
  IN.selected = b;
  if (typeof uiSelect === 'function') uiSelect(b);
  updateOverlay();
}

function pickBuilding(sx, sy) {
  const [X, Y] = screenToWorldPx(sx, sy);
  const bk = R.buckets; if (!bk) return null;
  for (let k = bk.length - 1; k >= 0; k--) {
    const list = bk[k];
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (!o.b) continue;
      const s = o.get(); if (!s) continue;
      const px = Math.floor(X - Math.round(o.X - s.ax)), py = Math.floor(Y - Math.round(o.Y - s.ay));
      if (px < 0 || py < 0 || px >= s.cv.width || py >= s.cv.height) continue;
      if (s.data) { if (s.data[py * s.cv.width + px] >>> 24) return o.b; }
      else return o.b;
    }
  }
  return null;
}

// ghost sprites for placing a building: [{x, y (anchor in tiles), z, s}]
function ghostSprites(type, x, y) {
  const z = G.inMap(x, y) ? tileLevel(x, y) * STEP : 0;
  if (type === 'busstop') { const side = busSide(x, y); if (side < 0) return []; const q = (FACE_Q[side] + G.view) & 3; return [{ x: x + 0.5, y: y + 0.5, z: surfaceZ(x + 0.5, y + 0.5), s: sprite(`bus|${q}`, () => mBusStop(side), QA(q)) }]; }
  if (type === 'station') { const m = netMask(G, x, y, N_RAIL); const axisQ = (m & 5) && !(m & 10) ? 1 : 0; return [{ x: x + 0.5, y: y + 0.5, z, s: sprite(`station|1|${(axisQ + G.view) & 3}`, () => mStationPart(1), QA(axisQ + G.view)) }]; }
  if (type === 'port') return footprint('port', x, y).filter(([a, b]) => G.inMap(a, b)).map(([a, b], i) => ({ x: a + 0.5, y: b + 0.5, z: 0, s: sprite(`port|${i}|0|${G.view & 3}`, () => mPort(i, 0), QA(FACE_Q[2] + G.view)) }));
  if (!MODEL_FN[type]) return [];
  const [w, h] = sizeOf(type);
  const col = buildPaint(type), C = col ? `|c${col}` : '';
  const build = () => withPaint(col, () => MODEL_FN[type](1, 0));
  if (w * h > 1) return [{ x: x + w / 2, y: y + h / 2, z, s: sprite(`${type}|1|0|${G.view & 3}|ghost${C}`, build, QA(G.view), { seed: 1 }) }];
  const q = (FACE_Q[chooseFacing(type, x, y)] + G.view) & 3;
  return [{ x: x + 0.5, y: y + 0.5, z, s: sprite(`${type}|1|0|${q}${C}`, build, QA(q), { seed: 1, keepData: true }) }];
}
const rectTiles = (x0, y0, x1, y1) => { const out = []; for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, y]); return out; };
function stopAt(kind, x, y) {
  if (!G.inMap(x, y)) return null;
  const k = G.idx(x, y);
  if (LINE_KIND[kind].stop === 'busstop') return G.busStops.has(k) ? k : null;
  const b = G.building(x, y);
  return b && b.type === 'station' && b.done ? G.idx(b.x, b.y) : null;
}
function draftPreview() {
  const d = IN.draft; if (!d) return null;
  if (d.kind === 'circuit') {
    if (d.points.length < 2) return { tiles: d.points.slice(), ok: false };
    let tiles = [];
    for (let i = 0; i + 1 < d.points.length; i++) { const seg = routeTiles(d.points[i], d.points[i + 1], N_ROAD); if (!seg) return { tiles, ok: false, why: 'Those points are not connected by road' }; tiles = tiles.concat(seg); }
    return { tiles, ok: true };
  }
  const L = LINE_KIND[d.kind];
  let tiles = [];
  for (let i = 0; i + 1 < d.stops.length; i++) { const seg = routeTiles(d.stops[i], d.stops[i + 1], L.net); if (!seg) return { tiles, ok: false, why: `No ${L.net === N_ROAD ? 'road' : 'track'} connects those stops` }; tiles = tiles.concat(seg); }
  return { tiles, ok: true };
}

function updateHover() {
  if (!IN.mouse.in || !R.ground) { R.hover = null; R.ghost = null; R.fade = null; return; }
  const [x, y] = tileAtScreen(IN.mouse.x, IN.mouse.y);
  R.hover = G.inMap(x, y) ? { x, y } : null;
  R.ghost = null; R.fade = null;
  let tip = null;
  if (!R.hover) { uiTip(null); updateOverlay(); return; }
  if (IN.tool === 'build') {
    const t = IN.type, d = B[t], pl = d.place;
    if (pl === 'drag') {
      const pts = IN.drag ? linePath(IN.drag.x, IN.drag.y, x, y) : [[x, y]];
      const p = planDrag(t, pts);
      R.ghost = { tiles: pts, ok: p.ok, bad: p.bad };
      tip = p.ok ? `${d.name}: ${p.tiles.length} tile${p.tiles.length === 1 ? '' : 's'}${p.ramps.length ? ` + ${p.ramps.length} ramp${p.ramps.length > 1 ? 's' : ''}` : ''} · ${fmtMoney(p.cost)}` : p.why;
    } else if (pl === 'span') {
      if (!IN.drag) { tip = `${d.name}: drag from one end to the other, in a straight line`; R.ghost = { tiles: [[x, y]], ok: true }; }
      else {
        const p = planSpan(t, IN.drag.x, IN.drag.y, x, y);
        R.ghost = { tiles: p.pts, ok: p.ok };
        tip = p.ok ? `${d.name}: ${p.len} tile${p.len > 1 ? 's' : ''} · ${fmtMoney(p.cost)}` : p.why;
      }
    } else if (pl === 'terra') {
      const tiles = IN.drag ? rectTiles(IN.drag.x, IN.drag.y, x, y) : [[x, y]];
      let n = 0, why = null;
      const okT = [], bad = [];
      for (const [px, py] of tiles) { const r = canTerra(px, py, d.terra); if (r.ok) { n++; okT.push([px, py]); } else { why = why || r.why; bad.push([px, py]); } }
      R.ghost = { tiles: okT, ok: n > 0 && n * ECON.terraform <= G.money, bad: IN.drag ? [] : bad };
      tip = n ? `${d.name}: ${n} plot${n > 1 ? 's' : ''} · ${fmtMoney(n * ECON.terraform)}${n * ECON.terraform > G.money ? ' · not enough money' : ''}` : why;
    } else if (pl === 'line') {
      const dr = IN.draft, L = LINE_KIND[dr.kind];
      const k = stopAt(dr.kind, x, y);
      const pv = draftPreview();
      R.ghost = { tiles: [[x, y]], ok: k != null };
      if (L.outside) tip = k != null ? `Run ${L.name.toLowerCase()} from the ${L.net === N_ROAD ? 'road' : 'rail'} tunnel to here · ${fmtMoney(newLineCost(dr.kind, 2))}` : `Click a ${L.stop === 'busstop' ? 'bus stop' : 'station'} inside a Tourist Centre's radius`;
      else if (k != null && dr.stops[0] === k && dr.stops.length >= 2) tip = `Close the line here · ${fmtMoney(newLineCost(dr.kind, dr.stops.length))}`;
      else tip = k != null ? `Add stop ${dr.stops.length + 1}` : `Click ${L.stop === 'busstop' ? 'bus stops' : 'stations'} in order${dr.stops.length >= 2 ? ', then press Enter or click the first stop again' : ''}`;
      if (pv && !pv.ok && pv.why) tip = pv.why;
    } else {
      const r = canPlace(t, x, y);
      R.ghost = { tiles: footprint(t, x, y).filter(([a, b]) => G.inMap(a, b)), ok: r.ok, sprites: ghostSprites(t, x, y) };
      tip = r.ok ? `${d.name} · ${fmtMoney(r.cost)}` : r.why;
      R.fade = fadeAround(x, y);
    }
  } else if (IN.tool === 'circuit') {
    const k = G.inMap(x, y) && (G.net[G.idx(x, y)] & N_ROAD) && !(G.net[G.idx(x, y)] & N_PORTAL) ? G.idx(x, y) : null;
    R.ghost = { tiles: [[x, y]], ok: k != null };
    const dr = IN.draft;
    if (k != null && dr.points.length >= 3 && dr.points[0] === k) { const r = circuitRoute(dr.points); tip = r.ok ? `Close the circuit: ${r.n} tiles · ${fmtMoney(r.cost)}` : r.why; }
    else tip = k != null ? `Add point ${dr.points.length + 1} of the circuit` : 'Click road tiles around a loop of streets';
  } else if (IN.tool === 'demolish') {
    const pts = IN.drag ? linePath(IN.drag.x, IN.drag.y, x, y) : [[x, y]];
    let cost = 0, n = 0, why = null;
    for (const [px, py] of pts) { const r = demolishCost(px, py); if (r.ok) { cost += r.cost; n++; } else why = why || r.why; }
    R.ghost = { tiles: pts, ok: n > 0 };
    const r1 = demolishCost(x, y);
    tip = n ? (pts.length > 1 ? `Remove ${n} · ${fmtMoney(cost)}` : `Remove ${r1.what} · ${fmtMoney(r1.cost)}`) : why;
  } else if (IN.tool === 'move') {
    if (IN.moving) {
      const b = IN.moving, r = canPlace(b.type, x, y, b);
      R.ghost = { tiles: [[x, y]], ok: r.ok && G.money >= moveCost(b), sprites: ghostSprites(b.type, x, y) };
      tip = r.ok ? `Move ${B[b.type].name} here · ${fmtMoney(moveCost(b))}` : r.why;
      R.fade = fadeAround(x, y);
    } else {
      const b = pickBuilding(IN.mouse.x, IN.mouse.y);
      tip = b ? (sizeOf(b.type)[0] * sizeOf(b.type)[1] > 1 || b.type === 'station' ? `${B[b.type].name} cannot be moved` : `Pick up ${B[b.type].name} · moving costs ${fmtMoney(moveCost(b))}`) : 'Click a building to move it';
    }
  } else {
    const b = pickBuilding(IN.mouse.x, IN.mouse.y);
    tip = b ? `${B[b.type].name}${b.closed ? ' (closed)' : ''}` : tileLabel(x, y);
  }
  uiTip(tip);
  updateOverlay();
}
function fadeAround(x, y) {
  const [X, Y] = toPx(x + 0.5, y + 0.5);
  const [a, b] = G.viewOf(x, y);
  return { d: (a + b) * 4 + 3, X0: X - 40, X1: X + 40, Y0: Y - 160, Y1: Y + 20 };
}
function tileLabel(x, y) {
  const k = G.idx(x, y), t = G.map.type[k];
  if (G.net[k] & N_PORTAL) return G.isRailPortal(x, y) ? 'Rail tunnel to the outside world' : 'Road tunnel to the outside world';
  const sp = G.spanTile.get(k);
  if (sp) return sp.kind === 'bridge' ? (sp.bit === N_ROAD ? 'Road bridge' : 'Rail bridge') : (sp.bit === N_ROAD ? 'Road tunnel under the hill' : 'Rail tunnel under the hill');
  if (G.busStops.has(k)) return 'Bus Stop' + (NET.stopLines.has(k) ? '' : ' (not on a line yet)');
  if ((G.net[k] & N_ROAD) && (G.net[k] & N_RAIL)) return 'Level crossing';
  if (G.net[k] & N_ROAD) return (G.ramp[k] ? 'Road ramp' : 'Road') + (G.net[k] & N_CIRCUIT ? ' · Grand Prix circuit' : '');
  if (G.net[k] & N_RAIL) return G.ramp[k] ? 'Rail ramp' : 'Rail track';
  const lv = t === T_GRASS || t === T_BEACH ? G.lvl[k] : 0;
  const lvs = lv ? ` · level ${lv > 0 ? '+' : ''}${lv}` : '';
  return (t === T_SEA ? 'Sea' : t === T_BEACH ? 'Beach' : t === T_MOUNT ? 'Mountain' : 'Empty plot') + lvs;
}

// ---- overlays and ranges ---------------------------------------------------------------------
function homesIn(ring) { const out = []; for (const h of G.buildings.values()) if (HOUSING.has(h.type) && h.done && Math.hypot(h.x + 0.5 - ring.cx, h.y + 0.5 - ring.cy) <= ring.r) out.push(h); return out; }
function updateOverlay() {
  const rings = [], marks = [];
  const b = IN.selected;
  let lines = null;
  if (IN.tool === 'build' && R.hover && B[IN.type]) {
    const t = IN.type, pl = B[t].place;
    if (!['drag', 'span', 'terra', 'line', 'none'].includes(pl)) {
      const ring = ringOf(t, R.hover.x, R.hover.y);
      if (ring) {
        rings.push(ring);
        if (HOUSING.has(t)) { for (const s of G.buildings.values()) if ((SHOPS.has(s.type) || LEISURE.has(s.type)) && s.done && distTo(s, R.hover.x, R.hover.y) <= radiusOf(s)) marks.push({ x: s.x, y: s.y, color: RANGE_COL[B[s.type].cat] }); }
        else for (const h of homesIn(ring)) marks.push({ x: h.x, y: h.y, color: ring.color });
      }
    }
  } else if (b && !b.tile && G.buildings.has(b.id)) {
    const ring = ringOf(b.type, b.x, b.y, b.lv);
    if (ring) { ring.solid = true; rings.push(ring); }
    if (HOUSING.has(b.type)) { const seen = new Set(); for (const g in b.reach || {}) for (const e of b.reach[g]) if (!seen.has(e.s)) { seen.add(e.s); marks.push({ x: e.s.x, y: e.s.y, color: RANGE_COL.shops }); } for (const e of b.amen || []) marks.push({ x: e.l.x, y: e.l.y, color: RANGE_COL[B[e.l.type].cat] }); }
    else if (SHOPS.has(b.type)) { for (const h of G.buildings.values()) if (h.reach && Object.values(h.reach).some((l) => l.some((e) => e.s === b))) marks.push({ x: h.x, y: h.y, color: RANGE_COL.shops }); }
    else if (ring) for (const h of homesIn(ring)) marks.push({ x: h.x, y: h.y, color: ring.color });
  } else if (b && b.tile && G.busStops.has(G.idx(b.x, b.y))) {
    const ring = ringOf('busstop', b.x, b.y); if (ring) { ring.solid = true; rings.push(ring); }
  }
  if (R.ranges) {
    for (const o of G.buildings.values()) {
      if (!o.done || (b && o === b)) continue;
      const ring = ringOf(o.type, o.x, o.y, o.lv); if (!ring || HOUSING.has(o.type)) continue;
      ring.outlineOnly = true; rings.push(ring);
    }
    for (const k of G.busStops.keys()) { const ring = ringOf('busstop', k % MAP_W, (k / MAP_W) | 0); ring.outlineOnly = true; rings.push(ring); }
  }
  // lines: the draft being drawn, or every line on the transit map
  if (IN.draft) {
    const pv = draftPreview();
    const col = IN.draft.kind === 'circuit' ? '#ff4f6a' : LINE_KIND[IN.draft.kind].colors[G.nextLine % LINE_KIND[IN.draft.kind].colors.length];
    lines = [{ tiles: pv ? pv.tiles : [], color: pv && pv.ok ? col : '#ff6b5a', stops: IN.draft.kind === 'circuit' ? IN.draft.points : IN.draft.stops.filter((k) => !(G.net[k] & N_PORTAL)), w: 2 }];
    if (IN.draft.kind === 'circuit' && G.circuit) lines.push({ tiles: G.circuit.tiles, color: '#ff4f6a', loop: true, alpha: 0.35, w: 3 });
  } else if (IN.overlay === 'transit' || (b && b.tile && NET.stopLines.has(G.idx(b.x, b.y)))) {
    lines = [];
    const only = b && b.tile ? NET.stopLines.get(G.idx(b.x, b.y)) : null;
    for (const l of G.lines.values()) if (l.route && (!only || only.includes(l))) lines.push({ tiles: l.route.tiles, color: l.valid ? l.color : '#ff6b5a', stops: l.stops.filter((k) => !(G.net[k] & N_PORTAL)), w: 2 });
  }
  if (!lines && G.circuit && (IN.overlay === 'transit' || isRaceDay())) lines = [{ tiles: G.circuit.tiles, color: '#ff4f6a', loop: true, alpha: 0.5, w: 2 }];
  R.rings = rings.length ? rings : null;
  R.marks = marks.length ? marks : null;
  R.lines = lines && lines.length ? lines : null;
  const top = [];
  if (IN.overlay === 'happy') {
    for (const h of G.buildings.values()) if (HOUSING.has(h.type) && h.done) {
      const v = h.happy;
      top.push({ x: h.x, y: h.y, color: v > 0.7 ? '#7be08a' : v > 0.5 ? '#ffd25a' : v > 0.4 ? '#ff9a4a' : '#ff5a4a', fill: 0.75 });
    }
  } else if (IN.overlay === 'transit') {
    for (const h of G.buildings.values()) if (HOUSING.has(h.type) && h.done) top.push({ x: h.x, y: h.y, color: h.transit === 'rail' ? '#6fb8ff' : h.transit ? '#7be08a' : '#ff5a4a', fill: 0.75 });
  }
  R.overlayTop = top.length ? top : null;
  R.overlay = null;
}

// ---- actions ---------------------------------------------------------------------------------------
function fail(why) { if (why) uiToast(why, 'warn'); sfx('err'); }
function actAt(x, y) {
  if (!G.inMap(x, y)) return;
  if (IN.tool === 'build') {
    const t = IN.type, pl = placeOf(t);
    if (pl === 'line') { lineClick(x, y); updateHover(); return; }
    if (pl === 'drag' || pl === 'span' || pl === 'terra') return;
    const r = placeBuilding(t, x, y, buildPaint(t));
    if (!r.ok) return fail(r.why);
    if (r.b) { addFx({ kind: 'dust', x, y, seed: Math.random() * 6, life: 900 }); r.b.flash = performance.now(); }
    sfx('build');
    if (!IN.keys.has('Shift') && (LANDMARK.has(t) || t === 'port' || B[t].unique || t === 'hotel')) setTool('inspect');
  } else if (IN.tool === 'circuit') circuitClick(x, y);
  else if (IN.tool === 'move') {
    if (!IN.moving) {
      const b = pickBuilding(IN.mouse.x, IN.mouse.y);
      if (!b) return;
      if (b.type === 'port' || b.type === 'station' || sizeOf(b.type)[0] * sizeOf(b.type)[1] > 1) return fail(`${B[b.type].name} cannot be moved`);
      IN.moving = b; uiToast(`Moving ${B[b.type].name}. Click a new plot, or press Esc.`);
    } else {
      const b = IN.moving, r = moveBuilding(b, x, y);
      if (!r.ok) return fail(r.why);
      sfx('build'); addFx({ kind: 'dust', x, y, seed: Math.random() * 6, life: 900 });
      IN.moving = null;
    }
  } else if (IN.tool === 'inspect') {
    const b = pickBuilding(IN.mouse.x, IN.mouse.y);
    if (b) { select(b); sfx('click'); return; }
    const k = G.idx(x, y);
    if ((G.net[k] & (N_ROAD | N_RAIL)) || G.spanTile.has(k)) select({ tile: true, x, y }); else select(null);
  }
  updateHover();
}
function lineClick(x, y) {
  const dr = IN.draft, L = LINE_KIND[dr.kind];
  const k = stopAt(dr.kind, x, y);
  if (k == null) return fail(`Click a ${L.stop === 'busstop' ? 'bus stop' : 'station'}`);
  if (L.outside) {
    const [sx, sy] = stopXY(k);
    if (![...G.buildings.values()].some((b) => b.type === 'tourist' && b.done && distTo(b, sx, sy) <= radiusOf(b) + 0.5)) return fail('Pick a stop inside a Tourist Centre\'s radius');
    const r = createLine(dr.kind, [dr.stops[0], k]);
    if (!r.ok) return fail(r.why);
    G.dirtyNet = true; recomputeAll();
    if (!r.line.tourOk) uiToast(`${r.line.name} needs a Tourist Centre covering its last stop before tourists come.`, 'warn', 6000);
    else uiToast(`${r.line.name} opened. Tourists arrive from tomorrow morning.`, 'good');
    sfx('build'); setTool('inspect'); return;
  }
  if (dr.stops.length >= 2 && dr.stops[0] === k) return finishDraft();
  if (dr.stops[dr.stops.length - 1] === k) return;
  dr.stops.push(k); sfx('click');
}
function circuitClick(x, y) {
  const k = G.idx(x, y);
  if (!(G.net[k] & N_ROAD) || (G.net[k] & N_PORTAL)) return fail('The circuit runs on your roads. Click a road tile.');
  const dr = IN.draft;
  if (dr.points.length >= 3 && dr.points[0] === k) return finishDraft();
  dr.points.push(k); sfx('click');
}
function finishDraft() {
  const dr = IN.draft; if (!dr) return;
  if (dr.kind === 'circuit') {
    const r = buildCircuit(dr.points);
    if (!r.ok) return fail(r.why);
    uiToast(`Grand Prix circuit ready: ${r.n} tiles of kerbs and barriers. Race day in ${G.f1.nextRace - G.day()} days.`, 'good', 6000);
    sfx('build'); setTool('inspect'); return;
  }
  if (dr.stops.length < 2) return fail('A line needs at least two stops');
  const r = createLine(dr.kind, dr.stops);
  if (!r.ok) return fail(r.why);
  recomputeAll();
  uiToast(`${r.line.name} opened with ${dr.stops.length} stops and one ${LINE_KIND[dr.kind].vehicle.toLowerCase()} · ${fmtMoney(r.cost)}`, 'good');
  sfx('build'); setTool('inspect'); select({ tile: true, x: dr.stops[0] % MAP_W, y: (dr.stops[0] / MAP_W) | 0 });
}
function finishDrag(x, y) {
  const d = IN.drag; IN.drag = null;
  if (!d) return;
  if (IN.tool === 'build') {
    const t = IN.type, pl = placeOf(t);
    if (pl === 'drag') {
      const r = placeDrag(t, linePath(d.x, d.y, x, y));
      if (!r.ok) return fail(r.why === 'Already built' ? null : r.why);
      sfx('road');
    } else if (pl === 'span') {
      const r = buildSpan(t, d.x, d.y, x, y);
      if (!r.ok) return fail(r.why);
      sfx('build'); uiToast(`${B[t].name} built · ${fmtMoney(r.cost)}`, 'good');
    } else if (pl === 'terra') {
      let n = 0, why = null;
      for (const [px, py] of rectTiles(d.x, d.y, x, y)) { const r = terra(px, py, B[t].terra); if (r.ok) n++; else why = why || r.why; }
      if (!n) return fail(why);
      sfx('road');
    }
  } else if (IN.tool === 'demolish') {
    let n = 0; const tiles = [];
    for (const [px, py] of linePath(d.x, d.y, x, y)) { const r = demolish(px, py); if (r.ok) { n++; tiles.push(...r.tiles); } }
    if (n) { sfx('demolish'); for (const [px, py] of tiles.slice(0, 8)) addFx({ kind: 'dust', x: px, y: py, seed: Math.random() * 6, life: 800 }); }
    else { const r = demolishCost(x, y); if (r.why) uiToast(r.why, 'warn'); }
    if (IN.selected && !IN.selected.tile && !G.buildings.has(IN.selected.id)) select(null);
  }
}

// ---- camera -----------------------------------------------------------------------------------------
// the farthest zoom-out still covered by the scenery on this screen size
function minZoomIdx() {
  const need = Math.max(window.innerWidth / 4200, window.innerHeight / 2400);
  let i = 0; while (i < ZOOMS.length - 1 && ZOOMS[i] < need) i++;
  return i;
}
function zoomAt(dir, sx, sy) {
  let i = ZOOMS.indexOf(R.zoom); if (i < 0) i = 4;
  const ni = clamp(i + dir, minZoomIdx(), ZOOMS.length - 1);
  if (ni === i) return;
  const [X0, Y0] = screenToWorldPx(sx, sy);
  R.zoom = ZOOMS[ni]; R.S = R.zoom * R.dpr;
  const [X1, Y1] = screenToWorldPx(sx, sy);
  R.cam.x += X0 - X1; R.cam.y += Y0 - Y1; clampCam();
}
function rotateView() { const i = VIEWS.indexOf(G.view); setView(VIEWS[(i + 1) % VIEWS.length]); updateHover(); sfx('click'); }
function panTick(dt) {
  let vx = 0, vy = 0;
  const k = IN.keys;
  if (k.has('ArrowLeft') || k.has('a')) vx -= 1;
  if (k.has('ArrowRight') || k.has('d')) vx += 1;
  if (k.has('ArrowUp') || k.has('w')) vy -= 1;
  if (k.has('ArrowDown') || k.has('s')) vy += 1;
  if (!vx && !vy) return;
  const sp = 900 / R.zoom * dt;
  R.cam.x += vx * sp; R.cam.y += vy * sp; clampCam();
  updateHover();
}
const dragTool = () => IN.tool === 'demolish' || (IN.tool === 'build' && ['drag', 'span', 'terra'].includes(placeOf(IN.type)));

function initInput() {
  const cv = R.cv;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    IN.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    IN.mouse.x = e.clientX; IN.mouse.y = e.clientY; IN.mouse.in = true;
    if (IN.pointers.size === 2) { const [a, b] = [...IN.pointers.values()]; IN.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; IN.pan = null; IN.drag = null; return; }
    if (e.button === 1 || e.button === 2) { IN.pan = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y, moved: false, right: e.button === 2 }; return; }
    const [x, y] = tileAtScreen(e.clientX, e.clientY);
    if (dragTool()) { IN.drag = { x, y }; updateHover(); return; }
    IN.pan = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y, moved: false, left: true };
  });
  cv.addEventListener('pointermove', (e) => {
    if (IN.pointers.has(e.pointerId)) IN.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    IN.mouse.x = e.clientX; IN.mouse.y = e.clientY; IN.mouse.in = true;
    if (IN.pinch && IN.pointers.size === 2) {
      const [a, b] = [...IN.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d / IN.pinch.d > 1.35) { zoomAt(1, (a.x + b.x) / 2, (a.y + b.y) / 2); IN.pinch.d = d; }
      else if (d / IN.pinch.d < 0.74) { zoomAt(-1, (a.x + b.x) / 2, (a.y + b.y) / 2); IN.pinch.d = d; }
      return;
    }
    if (IN.pan) {
      const dx = e.clientX - IN.pan.x, dy = e.clientY - IN.pan.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) IN.pan.moved = true;
      if (IN.pan.moved) { R.cam.x = IN.pan.cx - dx * R.dpr / R.S; R.cam.y = IN.pan.cy - dy * R.dpr / R.S; clampCam(); }
    }
    updateHover();
  });
  const up = (e) => {
    IN.pointers.delete(e.pointerId);
    if (IN.pointers.size < 2) IN.pinch = null;
    const [x, y] = tileAtScreen(e.clientX, e.clientY);
    if (IN.pan) {
      const p = IN.pan; IN.pan = null;
      if (!p.moved) { if (p.right) cancelTool(); else if (p.left) actAt(x, y); }
      return;
    }
    if (IN.drag) { finishDrag(x, y); updateHover(); }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', (e) => { IN.pointers.delete(e.pointerId); IN.pan = null; IN.drag = null; IN.pinch = null; });
  cv.addEventListener('pointerleave', () => { IN.mouse.in = false; R.hover = null; R.ghost = null; R.fade = null; uiTip(null); });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY); updateHover(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if (uiModalOpen()) { if (e.key === 'Escape') uiCloseModal(); return; }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
    if (k === 'Shift') IN.keys.add('Shift');
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(k)) { IN.keys.add(k); return; }
    if (e.repeat) return;
    if (!G.started) return;
    if (k === 'Escape') { if (IN.tool !== 'inspect' || IN.selected) cancelTool(); else uiOpenMenu(); }
    else if (k === 'Enter') { if (IN.draft) finishDraft(); }
    else if (k === 'Backspace') { const d = IN.draft; if (d) { if (d.points && d.points.length) d.points.pop(); else if (d.stops && d.stops.length > (LINE_KIND[d.kind] && LINE_KIND[d.kind].outside ? 1 : 0)) d.stops.pop(); updateOverlay(); } }
    else if (k === 'q' || k === 'e') rotateView();
    else if (k === '+' || k === '=') zoomAt(1, innerWidth / 2, innerHeight / 2);
    else if (k === '-' || k === '_') zoomAt(-1, innerWidth / 2, innerHeight / 2);
    else if (k === ' ') uiSetSpeed(G.speed ? 0 : (IN.lastSpeed || 1));
    else if (k === 'x') setTool('demolish');
    else if (k === 'm') setTool('move');
    else if (k === 'i') setTool('inspect');
    else if (k === 'h') uiToggleOverlay('happy');
    else if (k === 't') uiToggleOverlay('transit');
    else if (k === 'g') uiToggleRanges();
    else if (k === 'r') setTool('build', 'road');
    else if (k === 'f') uiOpenFinance();
    else if (k === 'n') uiOpenPaper();
    else if (k === '.' || k === '>') uiSetSpeed(Math.min(3, G.speed + 1));
    else if (k === ',' || k === '<') uiSetSpeed(Math.max(0, G.speed - 1));
    else { const c = CATS.find((c) => c.key === k); if (c) uiOpenDrawer(c.id); }
  });
  window.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; IN.keys.delete(k); if (k === 'Shift') IN.keys.delete('Shift'); });
  window.addEventListener('blur', () => IN.keys.clear());
}
function cancelTool() {
  if (IN.draft && ((IN.draft.stops && IN.draft.stops.length > (LINE_KIND[IN.draft.kind] && LINE_KIND[IN.draft.kind].outside ? 1 : 0)) || (IN.draft.points && IN.draft.points.length))) { setTool(IN.tool, IN.type); return; }
  if (IN.tool !== 'inspect') setTool('inspect'); else select(null);
  uiCloseDrawer();
}

// ---- tiny synthesized sounds ---------------------------------------------------------------------------
const AU = { ctx: null, on: true, vol: 1 };
function sfx(kind) {
  if (!AU.on || !AU.vol) return;
  try {
    if (!AU.ctx) AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const ac = AU.ctx; if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime, V = AU.vol;
    const tone = (f, d, type = 'square', v = 0.05, at = 0, f2) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + at + d);
      g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(v * V, t + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + at + d);
      o.connect(g); g.connect(ac.destination); o.start(t + at); o.stop(t + at + d + 0.02);
    };
    if (kind === 'click') tone(880, 0.05, 'square', 0.025);
    else if (kind === 'build') { tone(220, 0.08, 'square', 0.05); tone(330, 0.1, 'square', 0.04, 0.06); }
    else if (kind === 'road') tone(180, 0.06, 'triangle', 0.06);
    else if (kind === 'demolish') tone(120, 0.18, 'sawtooth', 0.05, 0, 60);
    else if (kind === 'err') tone(140, 0.12, 'square', 0.04, 0, 110);
    else if (kind === 'coin') { tone(988, 0.07, 'square', 0.035); tone(1319, 0.12, 'square', 0.035, 0.07); }
    else if (kind === 'horn') { tone(110, 0.9, 'sawtooth', 0.05); tone(138.6, 0.9, 'sawtooth', 0.035); }
    else if (kind === 'level') { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.04, i * 0.1)); }
    else if (kind === 'bad') { tone(196, 0.25, 'square', 0.04); tone(147, 0.35, 'square', 0.04, 0.2); }
    else if (kind === 'race') { for (let i = 0; i < 3; i++) tone(440, 0.18, 'square', 0.05, i * 0.6); tone(880, 0.5, 'square', 0.06, 1.8); }
    else if (kind === 'engine') tone(90 + Math.random() * 40, 0.4, 'sawtooth', 0.02, 0, 300);
  } catch (err) { AU.on = false; }
}
