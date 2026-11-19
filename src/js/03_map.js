// ---------------------------------------------------------------------------
// Map generation: a Monaco-shaped coastal strip wedged under a giant mountain.
// West -> east: Fontvieille, the Rock, Port Hercule bay, Monte Carlo, Larvotto.
// ---------------------------------------------------------------------------
function interpProfile(pts, t) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
      return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
    }
  }
  return pts[pts.length - 1][1];
}

const COAST_PROFILE = [
  [0, 30], [2, 30], [3, 31], [4, 32], [5, 33], [15, 33],      // Fontvieille (reclaimed land)
  [16, 34], [17, 35], [18, 36], [21, 36], [22, 35],           // the Rock
  [23, 32], [24, 30], [25, 28], [26, 27], [37, 27],           // Port Hercule bay
  [38, 28], [39, 30], [40, 31], [47, 31],                     // Monte Carlo point
  [48, 30], [49, 29], [63, 29], [66, 29], [71, 30],           // Larvotto and the east
];
const INLAND_PROFILE = [
  [0, 26], [2, 26], [3, 23], [4, 20], [5, 18], [6, 17], [8, 15], [22, 15], // Jardin Exotique heights
  [24, 16], [26, 17], [37, 17],                                            // La Condamine
  [39, 18], [47, 19],                                                      // Monte Carlo
  [50, 21], [63, 22], [66, 24], [71, 25],                                  // Larvotto, narrowing
];
const START = { portX: PLAY_X0 + 30, portLen: 5 }; // port spans x..x+4 at the bay's back

function genMap(seed, ver = MAP_V) {
  const rnd = mulberry32(seed * 7919 + 13);
  const W = MAP_W, H = MAP_H;
  const type = new Uint8Array(W * H).fill(T_SEA);
  const coast = new Int16Array(W), inland = new Int16Array(W);
  const idx = (x, y) => y * W + x;

  // jitter the inland boundary away from the starting town and the bay
  const jit = [];
  for (let t = 0; t <= 71; t++) jit.push(0);
  for (let t = 3; t <= 71; t++) {
    if (t >= 24 && t <= 38) continue;
    const n = fbm(t * 0.21, 3.1, seed, 3) - 0.5;
    jit[t] = Math.round(n * 3.2);
  }

  for (let x = 0; x < W; x++) {
    const t = x - PLAY_X0;
    let c, m;
    if (t < 0) { c = 30 + Math.round((-t) * 0.35); m = c; }          // Cap d'Ail: mountain into the sea
    else if (t > 71) { c = 30 + Math.round((t - 71) * 0.45); m = c; } // Cap Martin
    else {
      c = Math.round(interpProfile(COAST_PROFILE, t));
      m = Math.round(interpProfile(INLAND_PROFILE, t)) + jit[t];
      m = Math.min(m, c - 3);
    }
    coast[x] = c; inland[x] = m;
    for (let y = 0; y < H; y++) {
      if (y <= m) type[idx(x, y)] = T_MOUNT;
      else if (y <= c) type[idx(x, y)] = T_GRASS;
      else type[idx(x, y)] = T_SEA;
    }
  }
  // any land touching the sea becomes beach (sand and rocks)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (type[idx(x, y)] !== T_GRASS) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && type[idx(nx, ny)] === T_SEA) { type[idx(x, y)] = T_BEACH; break; }
    }
  }

  // tunnel portals at the mountain's edge, where the outside road and railway come in.
  // Map version 1 (saves from before) kept them in fixed stretches: road east of town, rail west.
  // From version 2 each new map puts them at random spots along the whole back wall, well apart.
  let roadPortal, railPortal;
  if (ver < 2) {
    const pickPortal = (t0, t1) => {
      for (let tries = 0; tries < 40; tries++) {
        const t = t0 + Math.floor(rnd() * (t1 - t0 + 1));
        const x = PLAY_X0 + t;
        const y = inland[x];
        if (inland[x - 1] >= y && inland[x + 1] >= y && type[idx(x, y + 1)] === T_GRASS && type[idx(x, y + 2)] === T_GRASS) return { x, y };
      }
      const x = PLAY_X0 + t0; return { x, y: inland[x] };
    };
    roadPortal = pickPortal(42, 52);
    railPortal = pickPortal(8, 18);
  } else {
    // a spot works if the mountain flanks it on both sides and there is open ground in front
    const ok = (x) => {
      const y = inland[x];
      if (inland[x - 1] < y || inland[x + 1] < y) return false;
      for (let dx = -2; dx <= 2; dx++) for (let dy = 1; dy <= 4; dy++) {
        const xx = x + dx, yy = Math.max(y, inland[xx]) + dy;
        if (yy >= H || type[idx(xx, yy)] !== T_GRASS) return false;
      }
      return true;
    };
    const spots = [];
    for (let t = 4; t <= 67; t++) if (ok(PLAY_X0 + t)) spots.push(PLAY_X0 + t);
    const pick = (avoid) => {
      const list = spots.filter((x) => avoid === null || Math.abs(x - avoid) >= 16);
      const from = list.length ? list : spots.length ? spots : [PLAY_X0 + 30];
      const x = from[Math.floor(rnd() * from.length)];
      return { x, y: inland[x] };
    };
    roadPortal = pick(null);
    railPortal = pick(roadPortal.x);
  }
  // Keep each tunnel mouth in plain view: the mountain beside it may not stand further forward
  // than the portal itself, or it would hide the mouth and the road or track coming out.
  for (const p of [roadPortal, railPortal]) {
    for (let x = Math.max(0, p.x - 2); x <= Math.min(W - 1, p.x + 2); x++) {
      if (inland[x] <= p.y) continue;
      for (let y = p.y + 1; y <= inland[x]; y++) if (type[idx(x, y)] === T_MOUNT) type[idx(x, y)] = T_GRASS;
      inland[x] = p.y;
    }
  }

  // ---- terrain heights, on a field that runs well past the map ------------------------------
  // The map is the middle of a larger landscape: the mountain keeps climbing behind it and runs
  // down to the sea on both capes, and the open sea fills the front. Only the map part is
  // playable; the rest is scenery drawn by the backdrop renderer.
  const PX = EXT_PX, PB = EXT_PB, EW = W + 2 * PX, EH = H + PB + EXT_PF;
  const ex = (x, y) => (y + PB) * EW + (x + PX);
  const etype = new Uint8Array(EW * EH);
  for (let y = -PB; y < H + EXT_PF; y++) for (let x = -PX; x < W + PX; x++) {
    let t;
    if (x >= 0 && x < W && y >= 0 && y < H) t = type[idx(x, y)];
    else if (x >= 0 && x < W) t = y < 0 ? T_MOUNT : T_SEA;
    else {
      // the capes: mountain straight into the sea, with a few coves
      const tt = x - PLAY_X0;
      let c = tt < 0 ? 30 + (-tt) * 0.35 : 30 + (tt - 71) * 0.45;
      c += (fbm(x * 0.16, 7.7, seed + 31, 3) - 0.5) * 5.5 * Math.min(1, Math.abs(x < 0 ? x : x - W + 1) / 6);
      t = y <= Math.round(c) ? T_MOUNT : T_SEA;
    }
    etype[ex(x, y)] = t;
  }
  // chamfer distance (in tiles) from any non-mountain tile
  const INF = 1e9;
  const edist = new Float32Array(EW * EH).fill(INF);
  for (let i = 0; i < EW * EH; i++) if (etype[i] !== T_MOUNT) edist[i] = 0;
  const relax = (i, j, ni, nj, w) => { if (ni < 0 || nj < 0 || ni >= EW || nj >= EH) return; const v = edist[nj * EW + ni] + w; if (v < edist[j * EW + i]) edist[j * EW + i] = v; };
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < EH; j++) for (let i = 0; i < EW; i++) { relax(i, j, i - 1, j, 1); relax(i, j, i, j - 1, 1); relax(i, j, i - 1, j - 1, 1.41); relax(i, j, i + 1, j - 1, 1.41); }
    for (let j = EH - 1; j >= 0; j--) for (let i = EW - 1; i >= 0; i--) { relax(i, j, i + 1, j, 1); relax(i, j, i, j + 1, 1); relax(i, j, i + 1, j + 1, 1.41); relax(i, j, i - 1, j + 1, 1.41); }
  }
  // height above the foot of the mountain: steep near town, then a long climb to the summits
  const base = (d) => (d <= 9 ? 30 * d + 3.5 * d * d : 553 + 95 * (d - 9) - 2.5 * Math.min(d - 9, 19) * (d - 9));
  const B30 = base(30);
  const profile = (d) => (d <= 30 ? base(d) : B30 + (d - 30) * 26 - (d - 30) * (d - 30) * 0.12);
  const colMult = (i) => {
    if (i < PLAY_X0) return 1 - 0.15 * smooth(clamp((PLAY_X0 - i) / 8, 0, 1));
    if (i > PLAY_X1 + 1) return 1 - 0.4 * smooth(clamp((i - PLAY_X1 - 1) / 8, 0, 1)) + 0.25 * smooth(clamp((i - W - 6) / 20, 0, 1));
    return 1;
  };
  const EVW = EW + 1;
  const ehv = new Float32Array(EVW * (EH + 1));
  for (let j = 0; j <= EH; j++) for (let i = 0; i <= EW; i++) {
    const vx = i - PX, vy = j - PB;
    let dmin = INF, allM = true, touchLand = false;
    for (const [ti, tj] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) {
      if (ti < 0 || tj < 0 || ti >= EW || tj >= EH) continue;
      const k = tj * EW + ti;
      if (etype[k] !== T_MOUNT) { allM = false; if (etype[k] !== T_SEA) touchLand = true; }
      dmin = Math.min(dmin, edist[k]);
    }
    let h;
    if (!allM) h = touchLand ? WALL_H : WALL_H - 2;
    else {
      const d = Math.max(0.6, dmin - 0.5);
      const big = 0.8 + 0.42 * fbm(vx / 7.5, vy / 6.5, seed + 5, 4);
      h = WALL_H + profile(d) * colMult(vx) * big + (vnoise(vx * 0.7, vy * 0.7, seed + 9) - 0.5) * (6 + Math.min(d, 30) * 2.5);
      // far summits: ridges and peaks instead of one endless wall
      if (d > 22) h += (fbm(vx / 6.5, vy / 5.5, seed + 21, 3) - 0.42) * 520 * smooth(clamp((d - 22) / 14, 0, 1));
    }
    ehv[j * EVW + i] = Math.max(WALL_H - 2, h);
  }
  // portal blocks: a rock face with the tunnel mouth
  const PORTAL_H = 46;
  for (const p of [roadPortal, railPortal]) {
    for (const [i, j] of [[p.x, p.y], [p.x + 1, p.y], [p.x, p.y + 1], [p.x + 1, p.y + 1]]) ehv[(j + PB) * EVW + i + PX] = Math.max(ehv[(j + PB) * EVW + i + PX], PORTAL_H);
    for (const [i, j] of [[p.x - 1, p.y], [p.x + 2, p.y], [p.x, p.y - 1], [p.x + 1, p.y - 1]]) ehv[(j + PB) * EVW + i + PX] = Math.max(ehv[(j + PB) * EVW + i + PX], PORTAL_H * 0.8);
  }
  // smooth slope field at vertices (normal z, metric) so rock/scrub patches don't follow triangle edges
  // and the smooth surface normal at every vertex, so the mountain is lit as one surface
  // instead of showing every tile's two flat triangles
  const eslope = new Float32Array(EVW * (EH + 1)), enx = new Float32Array(EVW * (EH + 1)), eny = new Float32Array(EVW * (EH + 1));
  for (let j = 0; j <= EH; j++) for (let i = 0; i <= EW; i++) {
    const g = (ii, jj) => ehv[clamp(jj, 0, EH) * EVW + clamp(ii, 0, EW)];
    const gx = (g(i + 1, j) - g(i - 1, j)) / 2 / ZK / 16, gy = (g(i, j + 1) - g(i, j - 1)) / 2 / ZK / 16;
    const inv = 1 / Math.sqrt(1 + gx * gx + gy * gy);
    eslope[j * EVW + i] = inv; enx[j * EVW + i] = -gx * inv; eny[j * EVW + i] = -gy * inv;
  }
  // shore distance for water colour (BFS in tiles from land)
  const eshore = new Float32Array(EW * EH).fill(99);
  const q = [];
  for (let i = 0; i < EW * EH; i++) if (etype[i] !== T_SEA) { eshore[i] = 0; q.push(i); }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % EW, y = (i / EW) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= EW || ny >= EH) continue;
      const k = ny * EW + nx; if (eshore[k] > eshore[i] + 1) { eshore[k] = eshore[i] + 1; q.push(k); }
    }
  }
  // the playable map is a window onto the larger field
  const VW = W + 1;
  const hv = new Float32Array(VW * (H + 1)), slopeV = new Float32Array(VW * (H + 1));
  for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) { hv[j * VW + i] = ehv[(j + PB) * EVW + i + PX]; slopeV[j * VW + i] = eslope[(j + PB) * EVW + i + PX]; }
  const dist = new Float32Array(W * H), shore = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { dist[idx(x, y)] = edist[ex(x, y)]; shore[idx(x, y)] = eshore[ex(x, y)]; }
  const ext = { PX, PB, EW, EH, type: etype, hv: ehv, slopeV: eslope, nx: enx, ny: eny, shore: eshore, dist: edist };

  // decor: harbour breakwater with a lighthouse, moored yachts
  const decor = [];
  const bayX = START.portX, bayY = coast[bayX];
  for (let x = bayX + 6; x <= bayX + 9; x++) if (type[idx(x, 31)] === T_SEA) decor.push({ kind: 'jetty', x, y: 31 });
  if (decor.length) decor.push({ kind: 'lighthouse', x: decor[0].x, y: 31 });
  // Port Hercule marina: two pontoons with yachts moored on both sides
  for (const px of [bayX - 5, bayX - 9]) {
    const c0 = coast[px];
    for (let y = c0 + 1; y <= c0 + 3; y++) {
      if (type[idx(px, y)] !== T_SEA) continue;
      decor.push({ kind: 'pontoon', x: px, y, v: 0 });
      for (const sx of [px - 1, px + 1]) if (type[idx(sx, y)] === T_SEA && rnd() < 0.8) decor.push({ kind: 'yacht', x: sx, y, v: 1 + 2 * Math.floor(rnd() * 2) });
    }
  }
  // fishing boats by the breakwater, yachts off Fontvieille and Larvotto
  for (const [x, y, v] of [[bayX + 6, 28, 0], [bayX + 7, 29, 1], [bayX + 8, 28, 2]]) if (type[idx(x, y)] === T_SEA) decor.push({ kind: 'fishboat', x, y, v });
  const yachtSpots = [[PLAY_X0 + 6, 35], [PLAY_X0 + 9, 35], [PLAY_X0 + 55, 31], [PLAY_X0 + 58, 31], [PLAY_X0 + 62, 32]];
  for (const [x, y] of yachtSpots) if (type[idx(x, y)] === T_SEA && rnd() < 0.85) decor.push({ kind: 'yacht', x, y, v: Math.floor(rnd() * 4) });

  return { seed, ver, W, H, type, coast, inland, hv, slopeV, shore, roadPortal, railPortal, decor, PORTAL_H, dist, ext };
}

// per-tile terrain corner heights [nw, ne, se, sw]
function tileCorners(map, x, y) {
  const VW = map.W + 1, hv = map.hv;
  return [hv[y * VW + x], hv[y * VW + x + 1], hv[(y + 1) * VW + x + 1], hv[(y + 1) * VW + x]];
}
// bilinear terrain height at a continuous position (x,y in tiles)
function terrainZ(map, x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  if (i < 0 || j < 0 || i >= map.W || j >= map.H) return 0;
  if (map.type[j * map.W + i] !== T_MOUNT) return map.type[j * map.W + i] === T_SEA ? SEA_Z : 0;
  const c = tileCorners(map, i, j), fx = x - i, fy = y - j;
  return lerp(lerp(c[0], c[1], fx), lerp(c[3], c[2], fx), fy);
}
