// Builds the fully grown demo city with the game's own placement rules (run by make-demo.mjs).
// Evaluated inside the page; returns a report. Districts follow Monaco:
// Fontvieille (west), the Rock, La Condamine around the harbour, Monte Carlo,
// Larvotto (east), Moneghetti and the Jardin Exotique up the hill.
(() => {
  const P = __PA, G = P.G, B = P.B;
  P.newGame(12345, 'Port Azur');
  G.money = 1e9; G.level = 7; G.movingList = 1e6;
  const fails = [];
  const K = (x, y) => y * 96 + x;
  const maxLv = (t) => B[t].maxLevel || 3;
  // terrain
  const terraRect = (x0, y0, x1, y1, d) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      for (let i = 0; i < Math.abs(d); i++) { const r = P.terra(x, y, Math.sign(d)); if (!r.ok) { fails.push(['terra', x, y, r.why]); break; } }
    }
  };
  const terraTile = (x, y, d) => terraRect(x, y, x, y, d);
  // networks
  const drag = (type, pts) => { const r = P.placeDrag(type, pts); if (!r.ok && r.why !== 'Already built') fails.push([type, pts[0].join(','), pts[pts.length - 1].join(','), r.why, JSON.stringify(r.bad)]); };
  const road = (x0, y0, x1, y1) => drag('road', P.linePath(x0, y0, x1, y1));
  const roadPts = (pts) => drag('road', pts);
  const rail = (x0, y0, x1, y1) => drag('rail', P.linePath(x0, y0, x1, y1));
  const span = (type, x0, y0, x1, y1) => { const r = P.buildSpan(type, x0, y0, x1, y1); if (!r.ok) fails.push([type, x0, y0, x1, y1, r.why]); };
  // buildings at their top level
  const put = (type, x, y, o = {}) => {
    const r = P.canPlace(type, x, y);
    if (!r.ok) { fails.push([type, x, y, r.why]); return null; }
    const b = P.addBuilding(type, x, y, { done: true, lv: o.lv || maxLv(type), facing: o.facing });
    if (type === 'port') b.plv = 2;
    return b;
  };
  const row = (y, x0, list) => { list.forEach((t, i) => { if (t) put(t, x0 + i, y); }); };
  const stop = (x, y) => { const r = P.placeBuilding('busstop', x, y); if (!r.ok) fails.push(['busstop', x, y, r.why]); return K(x, y); };

  // ---- clear the starting town (the harbour stays) ------------------------------------------
  P.demolish(43, 24); P.demolish(45, 23);

  // ---- terrain ---------------------------------------------------------------------------------
  // Moneghetti: a villa terrace one level up, garden terraces above it
  for (let y = 17; y <= 19; y++) for (let x = 18; x <= 26; x++) if (!(x === 22 && y === 19) && G.map.type[K(x, y)] === 2) terraTile(x, y, 1);
  for (let x = 20; x <= 26; x++) terraTile(x, 16, 2);
  // the ravine under the two bridges
  terraRect(24, 20, 25, 23, -2);
  // the Rock: stepped gardens up to the old town plateau
  for (let x = 28; x <= 34; x++) { terraTile(x, 27, 1); terraTile(x, 28, 2); }
  terraTile(35, 28, 1); terraTile(35, 29, 2);
  const rock = [[29, 28, 34], [30, 28, 35], [31, 28, 34], [32, 28, 34], [33, 28, 33], [34, 29, 33], [35, 30, 33]];
  for (const [y, x0, x1] of rock) for (let x = x0; x <= x1; x++) terraTile(x, y, 3);
  // Monte Carlo point: the garden hill over the tunnel
  terraRect(53, 28, 57, 30, 2);

  // ---- rail: from the mountain tunnel down to the city, along the foot of the hill -------------
  rail(28, 15, 28, 18); rail(28, 18, 49, 18);

  // ---- streets -----------------------------------------------------------------------------------
  road(15, 26, 80, 26);                           // Boulevard Albert 1er to Avenue Princesse Grace
  road(16, 23, 23, 23); road(26, 23, 69, 23);     // Boulevard Princesse Charlotte
  road(17, 20, 23, 20); road(26, 20, 54, 20);     // Boulevard de Belgique / Rainier III
  span('rbridge', 23, 23, 26, 23); span('rbridge', 23, 20, 26, 20);
  road(17, 20, 17, 32); road(22, 20, 22, 32); road(27, 20, 27, 32);
  road(12, 29, 27, 29); road(17, 32, 27, 32);     // Fontvieille
  road(33, 15, 33, 26); road(29, 17, 36, 17);     // Jardin Exotique
  road(38, 19, 38, 26); road(44, 19, 44, 26); road(47, 19, 47, 20); road(50, 19, 50, 26);
  road(56, 21, 56, 26); road(58, 20, 58, 29); road(52, 26, 52, 29);
  span('rtunnel', 52, 29, 58, 29);                // the Grand Prix tunnel under the garden hill
  road(58, 28, 83, 28);                           // Larvotto beach road
  road(62, 23, 62, 28); road(68, 23, 68, 28); road(74, 23, 74, 28); road(80, 26, 80, 28);
  roadPts([[22, 20], [22, 19], [22, 18]]); road(18, 18, 26, 18);   // up to the villa terrace
  roadPts([[35, 26], [35, 27], [35, 28], [35, 29], [35, 30]]);     // Rampe Major up the Rock
  road(28, 30, 35, 30); road(31, 30, 31, 34);                    // the old town

  // ---- stations -----------------------------------------------------------------------------------
  const station = (x, y) => { const r = P.canPlace('station', x, y); if (!r.ok) { fails.push(['station', x, y, r.why]); return null; } P.addBuilding('station', x, y, { done: true }); return K(x, y); };
  const sJardin = station(28, 17), sCond = station(38, 18), sMC = station(47, 18);

  // ---- harbours -------------------------------------------------------------------------------------
  for (const b of G.buildings.values()) if (b.type === 'port') b.plv = 2;
  put('port', 18, 33);

  const PK = 'park', AP = 'apartment', BE = 'belle', TH = 'townhouse', VI = 'villa', TO = 'tower', SK = 'skyscraper', CA = 'cafe', PL = 'plaza';
  // ---- Moneghetti villa terrace (+1) and garden terraces ----------------------------------------------
  row(17, 19, [VI, VI, VI, 'supermarket', VI, VI, VI, VI]);
  row(19, 18, [VI, VI, VI, VI, null, VI, CA, VI, VI]);
  row(16, 20, [PK, null, PK, PK, null, PK, PK]);
  // ---- Jardin Exotique ---------------------------------------------------------------------------------
  put('garden', 31, 16); put('obstower', 34, 16); put(VI, 29, 16); put(CA, 30, 16); put(VI, 32, 16); put(VI, 32, 15); put(PK, 34, 15); put(PK, 29, 15);
  // ---- Moneghetti below the terrace ----------------------------------------------------------------------
  row(21, 18, [AP, BE, BE, AP, null, CA, PK, PK, BE]);
  row(22, 18, [TH, 'electronics', PK, TH, null, AP, PK, PK, AP]);
  put(PK, 17, 19);
  row(19, 27, [PK, PK, AP, BE, BE, AP]);
  row(21, 28, ['supermarket', BE, PK, BE, 'fashion']);
  row(22, 28, [AP, BE, BE, AP, 'supermarket']);
  // ---- Fontvieille ---------------------------------------------------------------------------------------
  put(AP, 16, 21); put(AP, 16, 22);
  row(24, 16, [TO, null, SK, PK, SK, PK, null, SK]);
  row(25, 16, [TO, null, BE, AP, BE, 'electronics', null, TO]);
  put('zoo', 24, 24);
  put(TO, 26, 24); put(AP, 26, 25);
  row(27, 12, [PK, PK, PK, TO, TO, null, PL, 'electronics', 'dept', 'supermarket', null, TO, PK, TO, AP]);
  row(28, 12, [AP, AP, BE, BE, PK, null, PK, CA, PL, 'hardware', null, BE, AP, BE, 'markethall']);
  put('stadium', 18, 30); put('mall', 20, 30); put('garden', 25, 30);
  put('guesthouse', 15, 30); put(CA, 16, 30); put(PK, 16, 31);
  put('tourist', 23, 30); put(CA, 24, 30); put('pool', 26, 30); put(PK, 23, 31); put(PK, 24, 31); put('guesthouse', 25, 31); put('fashion', 26, 31);
  put('aquarium', 25, 33);
  // ---- the Rock (old town, +3) ------------------------------------------------------------------------------
  for (let x = 28; x <= 34; x++) { put(PK, x, 27); }
  for (let x = 28; x <= 34; x += 2) put(PK, x, 28);
  put('museum', 28, 29); put(CA, 30, 29); put(TH, 31, 29); put(TH, 32, 29); put('grocer', 33, 29); put('boutique', 34, 29);
  put(TH, 28, 31); put(TH, 29, 31); put(TH, 30, 31); put('castle', 32, 31); put(TH, 34, 31);
  put(PK, 28, 32); put(PK, 29, 32); put(TH, 30, 32); put(PK, 34, 32);
  put(PK, 28, 33); put(PK, 29, 33); put(TH, 30, 33); put(TH, 32, 33); put(PK, 33, 33);
  put(PL, 29, 34); put(TH, 30, 34); put(CA, 32, 34); put(PK, 33, 34);
  put(PK, 30, 35); put(PL, 31, 35); put(PK, 32, 35); put(PK, 33, 35);
  put(PK, 57, 20); put(VI, 59, 20); put(AP, 15, 25); put(PK, 15, 24); put(CA, 50, 27);
  // Place d'Armes at the foot of the Rock
  row(24, 28, [BE, BE, PK, BE, BE]);
  row(25, 28, [CA, 'supermarket', PL, CA, 'guesthouse']);
  // ---- La Condamine ------------------------------------------------------------------------------------------
  row(19, 34, [AP, AP, BE, BE]);
  row(19, 39, ['guesthouse', BE, BE, AP, AP]);
  row(19, 45, [BE, BE]); put(BE, 48, 19); put(BE, 49, 19);
  row(21, 34, [BE, BE, PK, BE]);
  row(22, 34, [AP, 'markethall', 'supermarket', AP]);
  row(21, 39, [BE, TO, PK, TO, BE]);
  row(22, 39, ['fashion', CA, 'electronics', 'supermarket', BE]);
  row(21, 45, [BE, BE, PK, 'tourist', BE]);
  row(22, 45, [AP, 'fashion', 'gallery', BE, AP]);
  row(24, 34, [AP, BE, BE, AP]);
  row(25, 34, ['markethall', CA, PK, 'supermarket']);
  row(24, 39, [BE, BE, PK, BE, BE]);
  row(25, 39, ['electronics', CA, 'boutique', 'pool', PL]);
  row(24, 45, [BE, BE, PK, BE, BE]);
  row(25, 45, [CA, 'fashion', 'markethall', 'fashion', 'supermarket']);
  put(PK, 36, 27); put(CA, 37, 27);
  // ---- Monte Carlo -----------------------------------------------------------------------------------------
  put(PK, 51, 19); put(BE, 52, 19);
  row(21, 51, [BE, BE, 'hotel', null, PK]);
  row(22, 51, ['fashion', 'fashion', BE, BE, 'fashion']);
  row(24, 51, [BE, PL, PL, BE, 'dept']);
  put('hotel', 51, 25); put('casino', 53, 25); put(CA, 54, 25); put('fashion', 55, 25);
  put(AP, 57, 21); put(AP, 57, 22); put(BE, 57, 24); put('markethall', 57, 25);
  put(PK, 51, 27); put(BE, 51, 28);
  row(27, 53, ['fashion', CA, 'boutique', 'guesthouse', BE]);
  for (let y = 28; y <= 30; y++) for (let x = 53; x <= 57; x++) if ((x + y) % 2 === 0 || y === 29) put(PK, x, y);
  put(CA, 52, 30); put(PK, 58, 30); put(PK, 59, 30);
  // ---- Larvotto ------------------------------------------------------------------------------------------------
  put(TO, 59, 21);
  row(22, 59, [BE, BE, AP, BE, BE, 'electronics', BE, AP, BE, 'markethall']);
  row(24, 59, [BE, BE, AP, null, PK, SK, PK, SK, PK, null, SK, PK, PK, PK, SK, null, BE, PK, PK]);
  row(25, 59, ['fashion', 'fashion', BE, null, TO, CA, TO, 'markethall', TO, null, TO, 'markethall', 'garden', 'homecenter', TO, null, AP, CA, BE]);
  put(PK, 72, 23); put(VI, 73, 23); put(VI, 75, 23);
  put('hotel', 59, 27); put('guesthouse', 61, 27);
  row(27, 63, [BE, PK, 'tourist', 'pool', BE]);
  row(27, 69, [AP, CA, BE, BE, 'guesthouse']);
  row(27, 75, [PK, 'boutique', 'fashion', VI, VI]);
  put(PK, 81, 27); put('disco', 82, 27); put(PK, 83, 27); put(PK, 82, 26); put(PK, 83, 26); put(PK, 83, 25);
  put(VI, 59, 29); put(VI, 60, 29);
  put('beachclub', 65, 29); put('beachclub', 76, 29);
  put(PK, 81, 29); put(CA, 82, 29); put(PK, 83, 29);

  // ---- bus stops and lines ---------------------------------------------------------------------------------------
  const busLine = (name, stops, veh) => {
    const ok = stops.filter((k) => G.busStops.has(k));
    const r = P.createLine('bus', ok);
    if (!r.ok) { fails.push(['line', name, r.why]); return null; }
    r.line.vehicles = veh; r.line.name = name; return r.line;
  };
  const f1 = stop(14, 29), f2 = stop(20, 29), f3 = stop(25, 32), f4 = stop(20, 26), f5 = stop(25, 26), f6 = stop(19, 23), f7 = stop(17, 27);
  const m1 = stop(20, 20), m2 = stop(30, 20), m3 = stop(25, 18), m4 = stop(29, 23);
  const r1 = stop(29, 30), r2 = stop(31, 33);
  const c1 = stop(36, 23), c2 = stop(41, 23), c3 = stop(46, 23), c4 = stop(41, 26), c5 = stop(36, 20), c6 = stop(42, 20);
  const k1 = stop(53, 23), k2 = stop(54, 20), k3 = stop(55, 26), k4 = stop(52, 28);
  const l0 = stop(61, 28), l1 = stop(60, 23), l2 = stop(65, 23), l3 = stop(64, 26), l4 = stop(71, 26), l5 = stop(77, 26), l6 = stop(66, 28), l7 = stop(72, 28), l8 = stop(78, 28), l9 = stop(58, 24);
  busLine('Fontvieille – Condamine', [f1, f2, f3, f4, f5, c4, c1, m4, f6, f7], 8);
  busLine('Old Town shuttle', [r1, r2, c4, c2, c1], 3);
  busLine('Moneghetti – Monte Carlo', [m3, m1, m2, c5, c6, k2, k1, c3, c2, m4], 8);
  busLine('Monte Carlo – Larvotto', [k3, k4, l0, l6, l7, l8, l5, l4, l3, l9, k1], 8);
  busLine('Larvotto Express', [l1, l2, l4, l8, l6], 7);
  // trains
  if (sJardin && sCond && sMC) {
    const r = P.createLine('rail', [sJardin, sCond, sMC]);
    if (r.ok) { r.line.vehicles = 3; r.line.name = 'Riviera Métro'; } else fails.push(['rail line', r.why]);
  }
  // intercity routes to the tourist centres
  const roadPortalK = K(G.map.roadPortal.x, G.map.roadPortal.y), railPortalK = K(G.map.railPortal.x, G.map.railPortal.y);
  const coachStop = stop(64, 28);
  P.recomputeAll();
  let r = P.createLine('coach', [roadPortalK, coachStop]); if (r.ok) { r.line.vehicles = 3; r.line.name = 'Coaches from Nice'; } else fails.push(['coach', r.why]);
  r = P.createLine('irail', [railPortalK, sMC]); if (r.ok) { r.line.vehicles = 2; r.line.name = 'Riviera Express'; } else fails.push(['irail', r.why]);
  const coach2 = stop(26, 29);
  r = P.createLine('coach', [roadPortalK, coach2]); if (r.ok) { r.line.vehicles = 2; r.line.name = 'Coaches to Fontvieille'; } else fails.push(['coach2', r.why]);

  // ---- the Grand Prix -------------------------------------------------------------------------------------------
  r = P.buyLicence(); if (!r.ok) fails.push(['licence', r.why]);
  r = P.buildCircuit([K(38, 26), K(52, 26), K(52, 29), K(58, 29), K(58, 23), K(38, 23)]); if (!r.ok) fails.push(['circuit', r.why]);

  G.dirtyNet = true; G.dirtyHappy = true; G.rev++;
  P.recomputeAll();
  const counts = {}; for (const b of G.buildings.values()) counts[b.type] = (counts[b.type] || 0) + 1;
  const bad = {};
  for (const b of G.buildings.values()) if (b.factors) for (const k in b.factors) if (b.factors[k] < 0 && !['taxes'].includes(k)) (bad[k] = bad[k] || []).push(b.type[0] + b.type[1] + '@' + b.x + ',' + b.y);
  // empty plots that still have a road beside them
  const empty = [];
  for (let y = 0; y < 46; y++) for (let x = 0; x < 96; x++) {
    const k = K(x, y), t = G.map.type[k];
    if ((t !== 2 && t !== 1) || G.bid[k] || G.net[k] || G.spanTile.has(k)) continue;
    const l = G.lvl[k];
    if ([[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => { const kk = K(x + dx, y + dy); return (G.net[kk] & 1) && !(G.net[kk] & 4) && !G.ramp[kk] && G.lvl[kk] === l; })) empty.push((t === 1 ? 'b' : '') + x + ',' + y);
  }
  return JSON.stringify({ empty, bad, fails, pop: G.pop, happy: +G.happy.toFixed(3), level: G.level, counts, complaints: G.complaints.slice(0, 8), lines: [...G.lines.values()].map((l) => [l.name, l.valid, l.why, l.load && +l.load.toFixed(2)]) });
})()
