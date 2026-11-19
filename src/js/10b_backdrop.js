// ---------------------------------------------------------------------------
// Backdrop: the landscape beyond the map. The mountain keeps climbing behind
// the town and runs down to the sea on both capes; the open sea fills the
// front. It is ray-marched per 512px chunk with the same rock, scrub, cliff and
// water colours and the same light as the map's own terrain, so the edge of the
// playable area disappears. Each chunk gets up to two layers:
//   under: scenery sea and the mountains behind the map (drawn before the map)
//   over:  scenery mountains standing in front of the map (drawn after it)
// plus a mask of open-sea pixels for the sparkles.
// ---------------------------------------------------------------------------
const HAZE = hex('#cddbe2');
const BD = { maxH: null, pMin: 0, view: -1, grad: [0, 0], col: [0, 0, 0], sh: [0, 0, 0], budget: 9 };

// Past the edge of the generated field the terrain simply carries on: every lookup is clamped to
// the field, so ridges run on into the haze instead of stopping at a wall.
const XT = 64; // how far the clamped carry-on is considered when sizing rays
function cfx(E, fx) { return clamp(fx, -E.PX + 1e-3, MAP_W + E.PX - 1e-3); }
function cfy(E, fy) { return clamp(fy, -E.PB + 1e-3, E.EH - E.PB - 1e-3); }
function extTypeC(E, fx, fy) { const i = Math.floor(cfx(E, fx)) + E.PX, j = Math.floor(cfy(E, fy)) + E.PB; return E.type[j * E.EW + i]; }
// per view: the tallest terrain in every screen column band, to start each ray just high enough
function backdropPrep() {
  const E = G.map.ext;
  const span = E.EW + E.EH + 4 * XT;
  const pMin = -span, n = 2 * span + 8;
  const mh = new Float32Array(n).fill(SEA_Z);
  const VW = E.EW + 1;
  for (let y = -E.PB - XT; y < E.EH - E.PB + XT; y++) for (let x = -E.PX - XT; x < MAP_W + E.PX + XT; x++) {
    const i = clamp(x, -E.PX, MAP_W + E.PX - 1) + E.PX, j = clamp(y, -E.PB, E.EH - E.PB - 1) + E.PB;
    if (E.type[j * E.EW + i] !== T_MOUNT) continue;
    const top = Math.max(E.hv[j * VW + i], E.hv[j * VW + i + 1], E.hv[(j + 1) * VW + i], E.hv[(j + 1) * VW + i + 1]);
    const [a, b] = G.viewOf(x, y);
    const p = Math.floor(a - b) - pMin;
    for (let q = p - 1; q <= p + 2; q++) if (q >= 0 && q < n && mh[q] < top) mh[q] = top;
  }
  BD.maxH = mh; BD.pMin = pMin; BD.view = G.view;
}

// height of the extended terrain triangle at tile (i, j) of the field, local (u, v) in 0..1;
// BD.grad gets dz per tile along x and y
function extMountZ(E, i, j, u, v) {
  const VW = E.EW + 1, hv = E.hv, g = BD.grad;
  const c0 = hv[j * VW + i], c1 = hv[j * VW + i + 1], c2 = hv[(j + 1) * VW + i + 1], c3 = hv[(j + 1) * VW + i];
  if (Math.abs(c0 - c2) <= Math.abs(c1 - c3)) {
    if (u >= v) { g[0] = c1 - c0; g[1] = c2 - c1; } else { g[0] = c2 - c3; g[1] = c3 - c0; }
    return c0 + g[0] * u + g[1] * v;
  }
  if (u + v < 1) { g[0] = c1 - c0; g[1] = c3 - c0; return c0 + g[0] * u + g[1] * v; }
  g[0] = c2 - c3; g[1] = c2 - c1;
  return c2 + g[0] * (u - 1) + g[1] * (v - 1);
}
// light factor of a surface with world normal (nx, ny, nz), as the rasterizer computes it
function lightK(nx, ny, nz) {
  if (G.view === 3) { const t = nx; nx = ny; ny = -t; }
  return clamp(AMB + nx * LW[0] + ny * LW[1] + nz * LW[2], 0.3, 1.2);
}
const outside = (fx, fy) => Math.max(0, -fx, fx - MAP_W, -fy, fy - MAP_H);
function packHaze(o, fx, fy) {
  const hz = clamp((outside(fx, fy) - 5) / 34, 0, 1) * 0.42;
  if (hz > 0) { o[0] += (HAZE[0] - o[0]) * hz; o[1] += (HAZE[1] - o[1]) * hz; o[2] += (HAZE[2] - o[2]) * hz; }
  return packC(o);
}
// colour of the mountain surface at world point (fx, fy) and height z
function mountPix(E, fx, fy, z) {
  const lx = cfx(E, fx), ly = cfy(E, fy);
  const tx = Math.floor(lx), ty = Math.floor(ly), i = tx + E.PX, j = ty + E.PB;
  const u = lx - tx, v = ly - ty;
  extMountZ(E, i, j, u, v);
  const gx = BD.grad[0] / (16 * ZK), gy = BD.grad[1] / (16 * ZK), nl = Math.sqrt(gx * gx + gy * gy + 1);
  const k = lightK(-gx / nl, -gy / nl, 1 / nl);
  const VW = E.EW + 1, sv = E.slopeV;
  const nz = lerp(lerp(sv[j * VW + i], sv[j * VW + i + 1], u), lerp(sv[(j + 1) * VW + i], sv[(j + 1) * VW + i + 1], u), v);
  const c = BD.col;
  mountainRGB(fx * 16, fy * 16, z, nz, c);
  shadeTo(c, c[0], c[1], c[2], k);
  return packHaze(c, fx, fy);
}
// a cliff face from mountain down to the water; (dx, dy) points from the rock to the sea
function cliffPix(fx, fy, z, dx, dy) {
  const c = BD.col;
  cliffRGB(((dx ? fy : fx) * 16 % 16 + 16) % 16, z - (SEA_Z - 1), c);
  shadeTo(c, c[0], c[1], c[2], lightK(dx, dy, 0));
  return packHaze(c, fx, fy);
}
function seaPix(fx, fy, px, py) {
  const x = Math.floor(fx), y = Math.floor(fy);
  return seaPixel(x, y, (fx - x) * 16, (fy - y) * 16, px, py, seaInfo(x, y));
}

// march state shared with paintRows (kept outside the hot loop to avoid closures)
const MS = { E: null, n: 0, r: 1, ci: 0, Y0: 0, p: 0, px: 0, view3: false, M: null, s: 0, z: 0, fx: 0, fy: 0, tx: 0, ty: 0, sea: false, pS: 0, pY: 0, pKind: 0, pTx: 0, pTy: 0 };
const wx3 = (a, b) => (MS.view3 ? MAP_W - b : a), wy3 = (a, b) => (MS.view3 ? a : b);
// paint rows [Y, yb) of one layer for the current sample; returns true if any row was painted
function paintRows(buf, Y, yb, isUnder) {
  const { n, r, ci, Y0, p, E } = MS;
  const j0 = Math.max(0, Math.ceil((Y - Y0) / r - 0.5)), j1 = Math.min(n, Math.ceil((yb - Y0) / r - 0.5));
  if (j1 <= j0) return false;
  const s = MS.s;
  // crossing from water onto rock: the shore line, for the cliff under the rock's edge
  let cliff = false, sb = 0, hi = 0, bx = 0, by = 0, btx = 0, bty = 0, yEdge = 0, cdx = 0, cdy = 0;
  if (!MS.sea && MS.pKind === 1 && (MS.pTx !== MS.tx || MS.pTy !== MS.ty)) {
    let lo = s; hi = MS.pS;
    for (let it = 0; it < 6; it++) {
      const m = (lo + hi) / 2, am = (m + p) / 2, bm = (m - p) / 2;
      if (extTypeC(E, wx3(am, bm), wy3(am, bm)) === T_SEA) hi = m; else lo = m;
    }
    sb = lo;
    const ab = (sb + p) / 2, bb = (sb - p) / 2;
    bx = wx3(ab, bb); by = wy3(ab, bb);
    const lbx = cfx(E, bx), lby = cfy(E, by); btx = Math.floor(lbx); bty = Math.floor(lby);
    const ze = extTypeC(E, bx, by) === T_MOUNT ? extMountZ(E, btx + E.PX, bty + E.PB, lbx - btx, lby - bty) : MS.z;
    yEdge = 16 * sb - ze;
    const ah = (hi + p) / 2, bh = (hi - p) / 2;
    cdx = Math.sign(Math.floor(cfx(E, wx3(ah, bh))) - btx); cdy = Math.sign(Math.floor(cfy(E, wy3(ah, bh))) - bty);
    cliff = true;
  }
  for (let j = j0; j < j1; j++) {
    const py = Y0 + (j + 0.5) * r, k = j * n + ci;
    if (MS.sea) {
      const ss = (py + SEA_Z) / 16, aa = (ss + p) / 2, bb = (ss - p) / 2;
      buf[k] = seaPix(wx3(aa, bb), wy3(aa, bb), Math.floor(MS.px), Math.floor(py));
      if (isUnder) MS.M[k] = 1;
      continue;
    }
    let sr;
    if (cliff) {
      if (py >= yEdge) { buf[k] = cliffPix(bx, by, 16 * sb - py, cdx, cdy); continue; }
      sr = sb + (s - sb) * clamp((yEdge - py) / Math.max(1e-6, yEdge - Y), 0, 1);
    } else sr = MS.pKind === 2 && MS.pY > Y ? MS.pS + (s - MS.pS) * clamp((MS.pY - py) / (MS.pY - Y), 0, 1) : s;
    const ar = (sr + p) / 2, br = (sr - p) / 2, rx = wx3(ar, br), ry = wy3(ar, br);
    buf[k] = extTypeC(E, rx, ry) === T_MOUNT ? mountPix(E, rx, ry, 16 * sr - py) : mountPix(E, MS.fx, MS.fy, MS.z);
  }
  return true;
}
// A chunk is marched column by column so a big one can be spread over several frames.
function newBackdropJob(cx, cy, r) {
  const n = CHUNK / r;
  return { cx, cy, r, n, ci: 0, U: new Uint32Array(n * n), O: new Uint32Array(n * n), M: new Uint8Array(n * n), anyU: false, anyO: false };
}
function runBackdropJob(job, deadline) {
  if (BD.view !== G.view || !BD.maxH) backdropPrep();
  const E = G.map.ext, g = R.ground, view3 = G.view === 3;
  const { n, r, U, O, M } = job;
  const X0 = job.cx * CHUNK, Y0 = job.cy * CHUNK, Y1 = Y0 + CHUNK;
  const VWv = g.VW, VHv = g.VH;
  const h = 0.125 * r;
  const [aA, bA] = G.viewOfC(-E.PX - XT, -E.PB - XT), [aB, bB] = G.viewOfC(MAP_W + E.PX + XT, E.EH - E.PB + XT);
  const aLo = Math.min(aA, aB), aHi = Math.max(aA, aB), bLo = Math.min(bA, bB), bHi = Math.max(bA, bB);
  Object.assign(MS, { E, n, r, Y0, view3, M });
  for (; job.ci < n; job.ci++) {
    if ((job.ci & 7) === 0 && deadline && performance.now() > deadline) return false;
    const ci = job.ci;
    const px = X0 + (ci + 0.5) * r, p = (px - g.OX) / HTW;
    MS.ci = ci; MS.px = px; MS.p = p;
    const q = Math.floor(p) - BD.pMin;
    const zTop = q >= 0 && q < BD.maxH.length ? BD.maxH[q] : SEA_Z;
    let s = Math.min((Y1 + zTop) / 16 + h, 2 * aHi - p, 2 * bHi + p);
    const sEnd = Math.max((Y0 + SEA_Z) / 16 - h, 2 * aLo - p, 2 * bLo + p);
    let yU = Y1, yO = Y1, overDone = false;
    MS.pKind = 0;
    for (; s >= sEnd; s -= h) {
      if (yU <= Y0 && (overDone || yO <= Y0)) break;
      const a = (s + p) / 2, b = (s - p) / 2;
      const fx = view3 ? MAP_W - b : a, fy = view3 ? a : b;
      const lx = cfx(E, fx), ly = cfy(E, fy);
      const tx = Math.floor(lx), ty = Math.floor(ly), ei = tx + E.PX, ej = ty + E.PB;
      const t = E.type[ej * E.EW + ei];
      const sea = t === T_SEA;
      const z = sea ? SEA_Z : t === T_MOUNT ? extMountZ(E, ei, ej, lx - tx, ly - ty) : surfaceZ(fx, fy);
      const Y = 16 * s - z;
      if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H) {
        // the map draws itself and hides the scenery behind it; a thin band along its border is
        // painted here too (with the very same colours) so no pixel slips between the two
        overDone = true;
        if (Y < yU) {
          if (fx < 0.2 || fy < 0.2 || fx > MAP_W - 0.2 || fy > MAP_H - 0.2) {
            MS.s = s; MS.z = z; MS.fx = fx; MS.fy = fy; MS.tx = tx; MS.ty = ty; MS.sea = sea;
            if (paintRows(U, Y, yU, true)) job.anyU = true;
          }
          yU = Y;
        }
      } else {
        const front = (a >= VWv || b >= VHv) && a >= 0 && b >= 0;
        if (!front) overDone = true;
        MS.s = s; MS.z = z; MS.fx = fx; MS.fy = fy; MS.tx = tx; MS.ty = ty; MS.sea = sea;
        if (front && !sea) {
          if (!overDone && Y < yO) { if (paintRows(O, Y, yO, false)) job.anyO = true; yO = Y; }
          if (Y < yU) yU = Y;
        } else {
          if (Y < yU) { if (paintRows(U, Y, yU, true)) job.anyU = true; yU = Y; }
          if (front && !overDone && Y < yO) yO = Y;
        }
      }
      MS.pS = s; MS.pY = Y; MS.pKind = sea ? 1 : 2; MS.pTx = tx; MS.pTy = ty;
    }
  }
  return true;
}
function finishBackdropJob(job) {
  const n = job.n;
  const toCanvas = (buf) => {
    const cv = document.createElement('canvas'); cv.width = n; cv.height = n;
    const ctx = cv.getContext('2d'); const img = ctx.createImageData(n, n);
    new Uint32Array(img.data.buffer).set(buf); ctx.putImageData(img, 0, 0);
    return cv;
  };
  return { r: job.r, done: true, under: job.anyU ? toCanvas(job.U) : null, over: job.anyO ? toCanvas(job.O) : null, mask: job.anyU ? job.M : null };
}
function renderBackdrop(cx, cy, r) { const job = newBackdropJob(cx, cy, r); runBackdropJob(job, 0); return finishBackdropJob(job); }

// Keep the visible chunks' scenery up to date within a time budget: a quick 1/4 resolution pass
// so nothing is left blank, then the final pass (full resolution near the town, half far away)
// a few columns at a time, nearest the middle of the screen first.
function finalRes(cx, cy) {
  const b = R.bounds; if (!b) return 1;
  const X = (cx + 0.5) * CHUNK, Y = (cy + 0.5) * CHUNK, m = 700;
  return X > b.x0 - m && X < b.x1 + m && Y > b.y0 - m && Y < b.y1 + m ? 1 : 2;
}
function updateBackdrop(ox, oy, vw, vh) {
  const t0 = performance.now();
  const want = [];
  for (let cy = Math.floor(oy / CHUNK); cy <= Math.floor((oy + vh) / CHUNK); cy++) for (let cx = Math.floor(ox / CHUNK); cx <= Math.floor((ox + vw) / CHUNK); cx++) {
    const key = cx + ',' + cy;
    let ch = R.chunks.get(key);
    if (!ch) { ch = { cv: null, dirty: true }; R.chunks.set(key, ch); }
    if (!ch.bd || !ch.bd.done) want.push({ ch, cx, cy, d: Math.hypot((cx + 0.5) * CHUNK - (ox + vw / 2), (cy + 0.5) * CHUNK - (oy + vh / 2)) });
  }
  if (!want.length) return;
  want.sort((p, q) => p.d - q.d);
  for (const w of want) {
    if (w.ch.bd) continue;
    const pv = renderBackdrop(w.cx, w.cy, 4);
    pv.done = false;
    w.ch.bd = pv;
    if (performance.now() - t0 > BD.budget * 1.5) return;
  }
  const deadline = t0 + BD.budget;
  for (const w of want) {
    const ch = w.ch;
    if (!ch.bd || ch.bd.done) continue;
    if (!ch.job) ch.job = newBackdropJob(w.cx, w.cy, finalRes(w.cx, w.cy));
    if (runBackdropJob(ch.job, deadline)) { ch.bd = finishBackdropJob(ch.job); ch.job = null; }
    if (performance.now() > deadline) return;
  }
}
function drawBackdropLayer(ctx, ox, oy, vw, vh, layer) {
  for (let cy = Math.floor(oy / CHUNK); cy <= Math.floor((oy + vh) / CHUNK); cy++) for (let cx = Math.floor(ox / CHUNK); cx <= Math.floor((ox + vw) / CHUNK); cx++) {
    const ch = R.chunks.get(cx + ',' + cy);
    const cv = ch && ch.bd && ch.bd[layer];
    if (!cv) continue;
    if (ch.bd.r === 1) ctx.drawImage(cv, cx * CHUNK, cy * CHUNK);
    else { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK); ctx.imageSmoothingEnabled = sm; }
  }
}
// is the scenery at world px (X, Y) open water? (for sparkles outside the map)
function backdropSea(X, Y) {
  const cx = Math.floor(X / CHUNK), cy = Math.floor(Y / CHUNK);
  const ch = R.chunks.get(cx + ',' + cy);
  if (!ch || !ch.bd || !ch.bd.mask) return false;
  const r = ch.bd.r, n = CHUNK / r;
  const i = Math.floor((X - cx * CHUNK) / r), j = Math.floor((Y - cy * CHUNK) / r);
  return ch.bd.mask[j * n + i] === 1;
}
