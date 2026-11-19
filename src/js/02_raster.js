// ---------------------------------------------------------------------------
// Software rasterizer that turns little 3D models into crisp 2:1 pixel-art
// sprites. Model space: X,Y in units (16 per tile), Z in pixels (up).
// Projection: sx = (x - y) * 2, sy = (x + y) - z. Depth = x + y + z / 3.
// ---------------------------------------------------------------------------
const ZK = 2.449;                       // pixels per metric unit vertically
const CAM = [0.612, 0.612, 0.5];        // direction toward the camera (metric)
const LW = [0.20, 0.40, 0.58];          // light weights: right wall 0.62, left wall 0.82, roof 1.0
const AMB = 0.42;

class Model {
  constructor(pivotX = 8, pivotY = 8) { this.faces = []; this.blobs = []; this.lines = []; this.px = pivotX; this.py = pivotY; }

  // Generic convex polygon. pts: [[x,y,z]...]; texture frame: point = o + s*u + t*v.
  poly(pts, o, u, v, mat, w = 0, h = 0, tag = '') {
    this.faces.push({ pts, o, u, v, mat, w, h, tag });
    return this;
  }

  // Axis-aligned box. m: material, or {top, side, px, nx, py, ny, bottom}
  box(x, y, z, w, d, h, m, tag = '') {
    const mt = m.fn ? { top: m, side: m } : m;
    const side = mt.side || mt.top;
    const X1 = x + w, Y1 = y + d, Z1 = z + h;
    if (mt.top !== null) this.poly([[x, y, Z1], [X1, y, Z1], [X1, Y1, Z1], [x, Y1, Z1]], [x, y, Z1], [1, 0, 0], [0, 1, 0], mt.top || side, w, d, tag + 'top');
    if (h > 0) {
      this.poly([[X1, Y1, z], [x, Y1, z], [x, Y1, Z1], [X1, Y1, Z1]], [X1, Y1, z], [-1, 0, 0], [0, 0, 1], mt.py || side, w, h, tag + 'py');
      this.poly([[X1, y, z], [X1, Y1, z], [X1, Y1, Z1], [X1, y, Z1]], [X1, y, z], [0, 1, 0], [0, 0, 1], mt.px || side, d, h, tag + 'px');
      this.poly([[x, y, z], [X1, y, z], [X1, y, Z1], [x, y, Z1]], [x, y, z], [1, 0, 0], [0, 0, 1], mt.ny || side, w, h, tag + 'ny');
      this.poly([[x, Y1, z], [x, y, z], [x, y, Z1], [x, Y1, Z1]], [x, Y1, z], [0, -1, 0], [0, 0, 1], mt.nx || side, d, h, tag + 'nx');
    }
    return this;
  }

  // Gable roof over [x,x+w]x[y,y+d] from z, ridge height h, ridge along 'x' or 'y'
  gable(x, y, z, w, d, h, axis, roof, gableMat, over = 0.6) {
    const X1 = x + w, Y1 = y + d, Z1 = z + h;
    if (axis === 'x') {
      const ym = y + d / 2;
      const ya = y - over, yb = Y1 + over, za = z - over * (h / (d / 2)), zb = za;
      const xa = x - over * 0.5, xb = X1 + over * 0.5;
      this.poly([[xa, ya, za], [xb, ya, za], [xb, ym, Z1], [xa, ym, Z1]], [xa, ya, za], [1, 0, 0], [0, (ym - ya) / Math.hypot(ym - ya, (Z1 - za) / ZK), (Z1 - za) / Math.hypot(ym - ya, (Z1 - za) / ZK)], roof, xb - xa, 1, 'roof');
      this.poly([[xb, yb, zb], [xa, yb, zb], [xa, ym, Z1], [xb, ym, Z1]], [xb, yb, zb], [-1, 0, 0], [0, -(yb - ym) / Math.hypot(yb - ym, (Z1 - zb) / ZK), (Z1 - zb) / Math.hypot(yb - ym, (Z1 - zb) / ZK)], roof, xb - xa, 1, 'roof');
      this.poly([[X1, y, z], [X1, Y1, z], [X1, ym, Z1]], [X1, y, z], [0, 1, 0], [0, 0, 1], gableMat, d, h, 'gable');
      this.poly([[x, Y1, z], [x, y, z], [x, ym, Z1]], [x, Y1, z], [0, -1, 0], [0, 0, 1], gableMat, d, h, 'gable');
    } else {
      const xm = x + w / 2;
      const xa = x - over, xb = X1 + over, za = z - over * (h / (w / 2));
      const ya = y - over * 0.5, yb = Y1 + over * 0.5;
      const L1 = Math.hypot(xm - xa, (Z1 - za) / ZK);
      this.poly([[xa, yb, za], [xa, ya, za], [xm, ya, Z1], [xm, yb, Z1]], [xa, yb, za], [0, -1, 0], [(xm - xa) / L1, 0, (Z1 - za) / L1], roof, yb - ya, 1, 'roof');
      this.poly([[xb, ya, za], [xb, yb, za], [xm, yb, Z1], [xm, ya, Z1]], [xb, ya, za], [0, 1, 0], [-(xb - xm) / L1, 0, (Z1 - za) / L1], roof, yb - ya, 1, 'roof');
      this.poly([[X1, Y1, z], [x, Y1, z], [xm, Y1, Z1]], [X1, Y1, z], [-1, 0, 0], [0, 0, 1], gableMat, w, h, 'gable');
      this.poly([[x, y, z], [X1, y, z], [xm, y, Z1]], [x, y, z], [1, 0, 0], [0, 0, 1], gableMat, w, h, 'gable');
    }
    return this;
  }

  // Polygon whose texture frame runs along its first edge (p0->p1) and up toward its last vertex.
  // The outward side is the one for which (p1-p0) x (toward last) points out.
  facet(pts, m, tag = 'roof') {
    const [u, v] = triFrame(pts[0], pts[1], pts[pts.length - 1]);
    return this.poly(pts, pts[0], u, v, m, 20, 20, tag);
  }

  // Hip roof with the ridge along the longer side
  hip(x, y, z, w, d, h, roof, over = 0.6) {
    x -= over; y -= over; w += 2 * over; d += 2 * over; z -= over * 0.8;
    const X1 = x + w, Y1 = y + d, Z1 = z + h;
    const A = [x, y, z], Bp = [X1, y, z], C = [X1, Y1, z], D = [x, Y1, z];
    if (w >= d) {
      const i = d / 2, r0 = [x + i, y + d / 2, Z1], r1 = [X1 - i, y + d / 2, Z1];
      this.facet([A, Bp, r1, r0], roof); this.facet([C, D, r0, r1], roof);
      this.facet([D, A, r0], roof); this.facet([Bp, C, r1], roof);
    } else {
      const i = w / 2, r0 = [x + w / 2, y + i, Z1], r1 = [x + w / 2, Y1 - i, Z1];
      this.facet([D, A, r0, r1], roof); this.facet([Bp, C, r1, r0], roof);
      this.facet([A, Bp, r0], roof); this.facet([C, D, r1], roof);
    }
    return this;
  }

  pyramid(x, y, z, w, d, h, m) {
    const X1 = x + w, Y1 = y + d, ap = [x + w / 2, y + d / 2, z + h];
    const c = [[x, y, z], [X1, y, z], [X1, Y1, z], [x, Y1, z]];
    for (let i = 0; i < 4; i++) this.facet([c[i], c[(i + 1) % 4], ap], m);
    return this;
  }

  // n-sided vertical prism approximating a cylinder
  cyl(cx, cy, z, r, h, mat, n = 8, topMat) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const ux = q[0] - p[0], uy = q[1] - p[1], l = Math.hypot(ux, uy);
      this.poly([[q[0], q[1], z], [p[0], p[1], z], [p[0], p[1], z + h], [q[0], q[1], z + h]], [p[0], p[1], z], [ux / l, uy / l, 0], [0, 0, 1], mat, l, h, 'side');
    }
    if (topMat !== null) this.poly(pts.map((p) => [p[0], p[1], z + h]), [cx - r, cy - r, z + h], [1, 0, 0], [0, 1, 0], topMat || mat, 2 * r, 2 * r, 'top');
    return this;
  }

  blob(cx, cy, cz, rx, rz, mat, ry) { this.blobs.push({ cx, cy, cz, rx, ry: ry || rx, rz, mat }); return this; }
  line(x0, y0, z0, x1, y1, z1, col) { this.lines.push({ a: [x0, y0, z0], b: [x1, y1, z1], col: packC(col) }); return this; }
}

// Frame for a planar polygon: u along p->q, v in-plane, perpendicular to u, pointing toward r (metric-normalised)
function triFrame(p, q, r) {
  const e1 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const l1 = Math.hypot(e1[0], e1[1], e1[2] / ZK) || 1;
  const u = [e1[0] / l1, e1[1] / l1, e1[2] / l1];
  const e2 = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
  const dot = e2[0] * u[0] + e2[1] * u[1] + (e2[2] * u[2]) / (ZK * ZK);
  const pe = [e2[0] - dot * u[0], e2[1] - dot * u[1], e2[2] - dot * u[2]];
  const l2 = Math.hypot(pe[0], pe[1], pe[2] / ZK) || 1;
  return [u, [pe[0] / l2, pe[1] / l2, pe[2] / l2]];
}

// ---------- materials ------------------------------------------------------
// A material is {fn(s,t,f,out) -> 0 transparent | 1 lit | 2 emissive}. out = [r,g,b,kmul]
function mat(fn, extra) { return Object.assign({ fn }, extra || {}); }
function flat(c, noise = 0, seed = 0) {
  const cc = typeof c === 'string' ? hex(c) : c;
  return mat((s, t, f, o) => {
    if (noise) {
      const n = (hash2(Math.floor(s * 2), Math.floor(t), seed + f.seed) - 0.5) * noise;
      o[0] = cc[0] * (1 + n); o[1] = cc[1] * (1 + n); o[2] = cc[2] * (1 + n);
    } else { o[0] = cc[0]; o[1] = cc[1]; o[2] = cc[2]; }
    return 1;
  });
}
function emissive(c) { const cc = hex(c); return mat((s, t, f, o) => { o[0] = cc[0]; o[1] = cc[1]; o[2] = cc[2]; return 2; }); }

// Facade with a grid of windows. opt: {floorH, base, winW, winH, gap, shutter, glass, sill, ground:'shop'|'door'|'arcade'|null, groundH, sign, awning}
function wallMat(color, opt = {}) {
  const C = hex(color);
  const glass = hex(opt.glass || '#3d4d63');
  const glassHi = mixC(glass, [190, 214, 230], 0.55);
  const sh = opt.shutter ? hex(opt.shutter) : null;
  const sill = mixC(C, [255, 255, 255], 0.45);
  const floorH = opt.floorH || 9, base = opt.base == null ? 3 : opt.base, winH = opt.winH || 5, winW = opt.winW || 1.5, gap = opt.gap || 3;
  const groundH = opt.groundH || 0;
  const shopGlass = hex(opt.shopGlass || '#5b7187');
  const doorC = hex(opt.doorColor || '#6b4a32');
  const plinth = mixC(C, [80, 70, 60], 0.35);
  return mat((s, t, f, o) => {
    let r = C[0], g = C[1], b = C[2]; o[3] = 1;
    const w = f.w, h = f.h;
    // cornice / parapet highlight and ground shadow
    if (t >= h - 1) { o[0] = sill[0]; o[1] = sill[1]; o[2] = sill[2]; return 1; }
    if (t < 1.5 && !groundH) { o[0] = plinth[0]; o[1] = plinth[1]; o[2] = plinth[2]; o[3] = 0.9; return 1; }
    if (groundH && t < groundH) {
      // ground floor treatment
      if (opt.ground === 'shop') {
        if (t >= groundH - 1.5) { o[0] = sill[0]; o[1] = sill[1]; o[2] = sill[2]; return 1; }
        const inGlass = t > 1 && t < groundH - 2.5 && s > 0.8 && s < w - 0.8 && ((s % 4) > 0.5);
        if (inGlass) {
          const hi = (t > groundH - 4.5 && (s % 4) < 1.7);
          const c = hi ? glassHi : shopGlass; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 1.05; return 1;
        }
        o[0] = plinth[0]; o[1] = plinth[1]; o[2] = plinth[2]; return 1;
      }
      if (opt.ground === 'arcade') {
        const m = s % 3;
        if (m > 0.7 && t < groundH - 2 - (Math.abs(m - 1.85) > 0.7 ? 1 : 0)) { o[0] = 70; o[1] = 62; o[2] = 60; o[3] = 1; return 1; }
        o[0] = plinth[0]; o[1] = plinth[1]; o[2] = plinth[2]; return 1;
      }
      if (opt.ground === 'door') {
        const dc = w / 2;
        if (Math.abs(s - dc) < 0.9 && t < groundH - 1) { o[0] = doorC[0]; o[1] = doorC[1]; o[2] = doorC[2]; return 1; }
      }
    }
    // windows
    const tt = t - base - groundH;
    if (tt >= 0) {
      const fl = Math.floor(tt / floorH), ft = tt - fl * floorH;
      const remain = (h - base - groundH) - fl * floorH;
      if (remain > winH + 2) {
        const n = Math.max(1, Math.floor((w - 1) / gap));
        const start = (w - (n - 1) * gap) / 2;
        const k = Math.round((s - start) / gap);
        if (k >= 0 && k < n) {
          const dx = s - (start + k * gap), ad = Math.abs(dx);
          if (opt.door && fl === 0 && k === (n >> 1) && ad < winW / 2 + 0.25 && ft < 1 + winH + 0.5) {
            const c = ft > winH ? sill : doorC; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
          }
          if (ft >= 1 && ft < 1 + winH) {
            if (ad < winW / 2) {
              if (f.night && hash2(k + f.seed * 7, fl + 31 * f.fid, 9) < 0.5) { o[0] = 255; o[1] = 212; o[2] = 118; return 2; }
              const hi = ft >= winH || (dx < -winW / 2 + 0.5 && ft > winH - 1.5);
              const c = hi ? glassHi : glass; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 1;
            }
            if (sh && ad < winW / 2 + 0.5) { o[0] = sh[0]; o[1] = sh[1]; o[2] = sh[2]; return 1; }
          } else if (ft < 1 && opt.sill !== false && ad < winW / 2 + (sh ? 0.5 : 0.25)) {
            o[0] = sill[0]; o[1] = sill[1]; o[2] = sill[2]; return 1;
          }
        }
      }
      if (opt.bands && ft < 1) { o[0] = sill[0]; o[1] = sill[1]; o[2] = sill[2]; return 1; }
    }
    // subtle wall texture
    const n = (hash2(Math.floor(s * 2), Math.floor(t), f.seed) - 0.5) * 0.05;
    o[0] = r * (1 + n); o[1] = g * (1 + n); o[2] = b * (1 + n);
    return 1;
  });
}

// Curtain wall: glass panels with mullions and a vertical reflection gradient
function glassMat(color, opt = {}) {
  const C = hex(color), M = hex(opt.mullion || '#dfe6ea');
  const floorH = opt.floorH || 6, col = opt.col || 2;
  const sky = [200, 225, 240];
  return mat((s, t, f, o) => {
    const ft = t % floorH;
    if (ft < 1 || (s % col) < 0.5) { o[0] = M[0]; o[1] = M[1]; o[2] = M[2]; o[3] = 1; return 1; }
    if (f.night && hash2(Math.floor(s / col), Math.floor(t / floorH), f.seed) < 0.4) { o[0] = 250; o[1] = 220; o[2] = 150; return 2; }
    const g = clamp(t / f.h, 0, 1);
    const refl = 0.25 + 0.35 * g + (((s + t * 0.25) % 9) < 1.2 ? 0.25 : 0);
    o[0] = lerp(C[0], sky[0], refl * 0.6); o[1] = lerp(C[1], sky[1], refl * 0.6); o[2] = lerp(C[2], sky[2], refl * 0.6); o[3] = 1;
    return 1;
  });
}

function roofTileMat(color) {
  const C = hex(color), D = mulC(C, 0.72), L = mixC(C, [255, 230, 200], 0.18);
  return mat((s, t, f, o) => {
    const row = Math.floor(t * 1.6);
    const off = (row & 1) * 0.75;
    const inRow = t * 1.6 - row;
    let c = C;
    if (inRow < 0.32) c = D; else if (((s + off) % 1.5) < 0.35) c = mixC(C, D, 0.6);
    else if (inRow > 0.8) c = L;
    const n = (hash2(Math.floor(s * 2), row, f.seed) - 0.5) * 0.08;
    o[0] = c[0] * (1 + n); o[1] = c[1] * (1 + n); o[2] = c[2] * (1 + n); o[3] = 1;
    return 1;
  });
}

function flatRoofMat(color, opt = {}) {
  const C = hex(color), P = mixC(C, [255, 255, 255], 0.35), D = mulC(C, 0.85);
  const edge = opt.edge == null ? 0.8 : opt.edge;
  return mat((s, t, f, o) => {
    if (edge && (s < edge || t < edge || s > f.w - edge || t > f.h - edge)) { o[0] = P[0]; o[1] = P[1]; o[2] = P[2]; o[3] = 1; return 1; }
    const n = hash2(Math.floor(s * 2), Math.floor(t * 2), f.seed + 3);
    const c = n < 0.08 ? D : C;
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 1;
    return 1;
  });
}

function stripeMat(c1, c2, w = 1, axis = 's') {
  const A = hex(c1), Bc = hex(c2);
  return mat((s, t, f, o) => {
    const v = axis === 's' ? s : t; const c = (Math.floor(v / w) & 1) ? Bc : A;
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 1; return 1;
  });
}

function paveMat(color, cell = 2) {
  const C = hex(color), J = mulC(C, 0.86);
  return mat((s, t, f, o) => {
    const js = (s % cell) < 0.35 || (t % cell) < 0.35;
    const c = js ? J : C; const n = (hash2(Math.floor(s / cell), Math.floor(t / cell), 5) - 0.5) * 0.06;
    o[0] = c[0] * (1 + n); o[1] = c[1] * (1 + n); o[2] = c[2] * (1 + n); o[3] = 1; return 1;
  });
}

function stoneMat(color) {
  const C = hex(color), J = mulC(C, 0.7);
  return mat((s, t, f, o) => {
    const row = Math.floor(t / 3), off = (row & 1) * 1.5;
    const j = (t % 3) < 0.9 || ((s + off) % 3) < 0.4;
    const n = (hash2(Math.floor((s + off) / 3), row, f.seed + 11) - 0.5) * 0.18;
    const c = j ? J : C;
    o[0] = c[0] * (1 + n); o[1] = c[1] * (1 + n); o[2] = c[2] * (1 + n); o[3] = 1; return 1;
  });
}

function waterMat(c1 = '#4fc3d9', c2 = '#8fe1ec') {
  const A = hex(c1), Bc = hex(c2);
  return mat((s, t, f, o) => {
    const w = ((s * 1.3 + t * 0.6) % 4) < 0.6 && hash2(Math.floor(s), Math.floor(t), 4) < 0.5;
    const c = w ? Bc : A; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 1; return 1;
  });
}

function grassMat(seed = 0) {
  const ramp = [hex('#5f8f3e'), hex('#77a44a'), hex('#8db857'), hex('#a3c966')];
  return mat((s, t, f, o) => {
    const n = vnoise(s * 0.35, t * 0.35, seed) + (hash2(Math.floor(s * 2), Math.floor(t * 2), seed + 1) - 0.5) * 0.35;
    const c = ramp[clamp(Math.floor(n * 3.2), 0, 3)];
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 1; return 1;
  });
}

// Leafy canopy for blobs: 4-tone ramp with clumpy noise
function leafMat(ramp, seed = 0, clump = 0.7) {
  const R = ramp.map(hex);
  return mat((nx, ny, nz, P, o) => {
    let k = AMB + nx * LW[0] + ny * LW[1] + nz * LW[2];
    k += (vnoise(P[0] * clump + P[2] * 0.21, P[1] * clump - P[2] * 0.17, seed) - 0.5) * 0.55;
    k += (hash2(Math.floor(P[0] * 3), Math.floor(P[1] * 3 + P[2]), seed) - 0.5) * 0.12;
    const i = k < 0.5 ? 0 : k < 0.72 ? 1 : k < 0.93 ? 2 : 3;
    const c = R[i]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return 2;
  }, { blob: true });
}
function blobMat(color) {
  const C = hex(color);
  return mat((nx, ny, nz, P, o) => {
    const k = AMB + nx * LW[0] + ny * LW[1] + nz * LW[2];
    shadeTo(o, C[0], C[1], C[2], clamp(k, 0.35, 1.15)); return 2;
  }, { blob: true });
}

// ---------- rasterizer ----------------------------------------------------
class PixBuf {
  constructor(w, h) { this.w = w; this.h = h; this.data = new Uint32Array(w * h); this.depth = new Float32Array(w * h).fill(-1e9); }
}

const _out = [0, 0, 0, 1];
const _sh = [0, 0, 0];

// rot: {c, s} rotation applied about the model pivot. Returns a sprite {cv, ax, ay, w, h, data}
function renderModel(model, ang = 0, opt = {}) {
  const c = Math.round(Math.cos(ang) * 1e6) / 1e6, sn = Math.round(Math.sin(ang) * 1e6) / 1e6;
  const pxv = model.px, pyv = model.py;
  const R = (p) => { const dx = p[0] - pxv, dy = p[1] - pyv; return [pxv + dx * c - dy * sn, pyv + dx * sn + dy * c, p[2]]; };
  const RV = (v) => [v[0] * c - v[1] * sn, v[0] * sn + v[1] * c, v[2]];
  const projX = (p) => (p[0] - p[1]) * 2, projY = (p) => (p[0] + p[1]) - p[2];

  // transform faces
  const faces = [];
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const ext = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
  for (const f of model.faces) {
    const P = f.pts.map(R);
    // normal (metric) from Newell's method
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const az = a[2] / ZK, bz = b[2] / ZK;
      nx += (a[1] - b[1]) * (az + bz); ny += (az - bz) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    // the frame's u x v gives the intended outward direction; flip Newell normal to agree
    const u = RV(f.u), v = RV(f.v);
    const cx = u[1] * (v[2] / ZK) - (u[2] / ZK) * v[1], cy = (u[2] / ZK) * v[0] - u[0] * (v[2] / ZK), cz = u[0] * v[1] - u[1] * v[0];
    if (cx * nx + cy * ny + cz * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const vis = nx * CAM[0] + ny * CAM[1] + nz * CAM[2];
    if (vis <= 1e-4 && !opt.noCull) continue;
    for (const p of P) ext(projX(p), projY(p));
    faces.push({ f, P, o: R(f.o), u, v, nx, ny, nz, fid: faces.length });
  }
  const blobs = [];
  for (const b of model.blobs) {
    const C = R([b.cx, b.cy, b.cz]);
    const rr = Math.max(b.rx, b.ry);
    ext(projX(C) - rr * 2.9, projY(C) - b.rz - rr * 1.5); ext(projX(C) + rr * 2.9, projY(C) + b.rz + rr * 1.5);
    blobs.push({ b, C, rr });
  }
  const lines = [];
  for (const l of model.lines) { const a = R(l.a), b = R(l.b); ext(projX(a), projY(a)); ext(projX(b), projY(b)); lines.push({ a, b, col: l.col }); }
  if (minX > maxX) { minX = maxX = 0; minY = maxY = 0; }
  const ox = Math.ceil(-minX) + 2, oy = Math.ceil(-minY) + 2;
  const W = Math.ceil(maxX - minX) + 5, H = Math.ceil(maxY - minY) + 5;
  const buf = new PixBuf(W, H);
  const seed = opt.seed || 0;
  // multi-tile buildings: keep only the pixels whose model-space point falls in footprint tile (i, j)
  if (opt.part) {
    const pi = opt.part[0], pj = opt.part[1], pw = opt.part[2], ph = opt.part[3];
    opt = Object.assign({}, opt, {
      clipFn: (X, Y) => {
        const dX = X - pxv, dY = Y - pyv;
        const mx = pxv + dX * c + dY * sn, my = pyv - dX * sn + dY * c;
        const ti = clamp(Math.floor(mx / 16), 0, pw - 1), tj = clamp(Math.floor(my / 16), 0, ph - 1);
        return ti === pi && tj === pj;
      },
    });
  }

  for (const F of faces) rasterFace(buf, F, ox, oy, seed, opt);
  for (const B0 of blobs) rasterBlob(buf, B0, ox, oy, c, sn, pxv, pyv, opt.lightsOnly, opt.clipFn);
  if (!opt.lightsOnly) for (const L of lines) rasterLine(buf, L, ox, oy, opt.clipFn);
  if (opt.outline) outlineBuf(buf, opt.outline);

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  new Uint32Array(img.data.buffer).set(buf.data);
  ctx.putImageData(img, 0, 0);
  // anchor: projection of the pivot at ground level
  const ax = ox + (pxv - pyv) * 2, ay = oy + (pxv + pyv);
  return { cv, ax, ay, w: W, h: H, data: opt.keepData ? buf.data : null };
}

function rasterFace(buf, F, ox, oy, seed, opt) {
  const { f, P, o, u, v, nx, ny, nz } = F;
  const n = P.length;
  const SX = new Float64Array(n), SY = new Float64Array(n);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) {
    const p = P[i]; const sx = ox + (p[0] - p[1]) * 2, sy = oy + (p[0] + p[1]) - p[2];
    SX[i] = sx; SY[i] = sy;
    if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
  }
  let area = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += SX[i] * SY[j] - SX[j] * SY[i]; }
  if (Math.abs(area) < 1e-6) return;
  const sg = area > 0 ? 1 : -1;
  const Ox = ox + (o[0] - o[1]) * 2, Oy = oy + (o[0] + o[1]) - o[2];
  const Ux = (u[0] - u[1]) * 2, Uy = (u[0] + u[1]) - u[2];
  const Vx = (v[0] - v[1]) * 2, Vy = (v[0] + v[1]) - v[2];
  const det = Ux * Vy - Uy * Vx;
  if (Math.abs(det) < 1e-9) return;
  const d0 = o[0] + o[1] + o[2] / 3, du = u[0] + u[1] + u[2] / 3, dv = v[0] + v[1] + v[2] / 3;
  let k = AMB + nx * LW[0] + ny * LW[1] + nz * LW[2];
  k = clamp(k, 0.3, 1.2);
  // role: front edge of left walls gets a 1px highlight
  const vertical = Math.abs(nz) < 0.2;
  const role = vertical ? (ny > nx ? 'L' : 'R') : 'T';
  const frontS = role === 'L' ? (u[0] > 0 ? f.w : 0) : role === 'R' ? (u[1] > 0 ? f.w : 0) : -99;
  const fi = { w: f.w, h: f.h, tag: f.tag, seed: seed, k, role, night: opt.night, n: [nx, ny, nz], fid: F.fid || 0, f };
  const W = buf.w, Hh = buf.h, data = buf.data, depth = buf.depth;
  const xs = Math.max(0, Math.floor(x0)), xe = Math.min(W - 1, Math.ceil(x1));
  const ys = Math.max(0, Math.floor(y0)), ye = Math.min(Hh - 1, Math.ceil(y1));
  const mfn = f.mat.fn;
  const clipFn = opt.clipFn;
  for (let y = ys; y <= ye; y++) {
    const py = y + 0.5;
    for (let x = xs; x <= xe; x++) {
      const px = x + 0.5;
      let inside = true;
      for (let i = 0; i < n; i++) {
        const j = i + 1 === n ? 0 : i + 1;
        const e = (SX[j] - SX[i]) * (py - SY[i]) - (SY[j] - SY[i]) * (px - SX[i]);
        if (e * sg < -1e-7) { inside = false; break; }
      }
      if (!inside) continue;
      const dx = px - Ox, dy = py - Oy;
      const s = (dx * Vy - dy * Vx) / det, t = (Ux * dy - Uy * dx) / det;
      const d = d0 + s * du + t * dv;
      const idx = y * W + x;
      if (d <= depth[idx] + 1e-4) continue;
      if (clipFn && !clipFn(o[0] + s * u[0] + t * v[0], o[1] + s * u[1] + t * v[1])) continue;
      _out[3] = 1;
      const r = mfn(s, t, fi, _out);
      if (!r) continue;
      if (opt.lightsOnly) { data[idx] = r === 2 ? packC(_out) : 0; depth[idx] = d; continue; }
      if (r === 2) data[idx] = packC(_out);
      else {
        let kk = k * _out[3];
        if (role === 'L' && Math.abs(s - frontS) < 0.5 && f.h > 4) kk *= 1.1;
        shadeTo(_sh, _out[0], _out[1], _out[2], kk);
        data[idx] = packC(_sh);
      }
      depth[idx] = d;
    }
  }
}

function rasterBlob(buf, B0, ox, oy, c, sn, pxv, pyv, lightsOnly, clipFn) {
  const { b, C } = B0;
  const rx = b.rx, rz = b.rz;
  const cx = C[0], cy = C[1], cz = C[2];
  const sxc = ox + (cx - cy) * 2, syc = oy + (cx + cy) - cz;
  const rr = Math.max(b.rx, b.ry);
  const hw = rr * 2.9 + 1, hh = rz + rr * 1.5 + 1;
  const W = buf.w, data = buf.data, depth = buf.depth;
  const xs = Math.max(0, Math.floor(sxc - hw)), xe = Math.min(W - 1, Math.ceil(sxc + hw));
  const ys = Math.max(0, Math.floor(syc - hh)), ye = Math.min(buf.h - 1, Math.ceil(syc + hh));
  const irx2 = 1 / (rx * rx), irz2 = 1 / (rz * rz);
  const a = 0.5 * irx2 + irz2;
  const fn = b.mat.fn;
  const P = [0, 0, 0];
  for (let y = ys; y <= ye; y++) {
    for (let x = xs; x <= xe; x++) {
      const A = (x + 0.5 - ox) / 2, Bq = (y + 0.5 - oy);
      const p = Bq + A - 2 * cx, q = Bq - A - 2 * cy;
      const bb = (p + q) * 0.5 * irx2 - 2 * cz * irz2;
      const cc = (p * p + q * q) * 0.25 * irx2 + cz * cz * irz2 - 1;
      const disc = bb * bb - 4 * a * cc;
      if (disc < 0) continue;
      const Z = (-bb + Math.sqrt(disc)) / (2 * a);
      const X = (Bq + Z + A) / 2, Y = (Bq + Z - A) / 2;
      const d = X + Y + Z / 3;
      const idx = y * W + x;
      if (d <= depth[idx] + 1e-4) continue;
      if (clipFn && !clipFn(X, Y)) continue;
      let nx = (X - cx) * irx2, ny = (Y - cy) * irx2, nz = (Z - cz) * ZK * irz2;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      // model-space (pre-rotation) position for stable texture
      const dx = X - pxv, dy = Y - pyv;
      P[0] = pxv + dx * c + dy * sn; P[1] = pyv - dx * sn + dy * c; P[2] = Z;
      const r = fn(nx, ny, nz, P, _out);
      if (!r) continue;
      data[idx] = lightsOnly ? 0 : packC(_out);
      depth[idx] = d;
    }
  }
}

function rasterLine(buf, L, ox, oy, clipFn) {
  const a = L.a, b = L.b;
  const ax = ox + (a[0] - a[1]) * 2, ay = oy + (a[0] + a[1]) - a[2];
  const bx = ox + (b[0] - b[1]) * 2, by = oy + (b[0] + b[1]) - b[2];
  const da = a[0] + a[1] + a[2] / 3, db = b[0] + b[1] + b[2] / 3;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.floor(ax + (bx - ax) * t), y = Math.floor(ay + (by - ay) * t);
    if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) continue;
    const d = da + (db - da) * t + 0.05, idx = y * buf.w + x;
    if (d <= buf.depth[idx]) continue;
    if (clipFn && !clipFn(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) continue;
    buf.data[idx] = L.col; buf.depth[idx] = d;
  }
}

function outlineBuf(buf, col) {
  const W = buf.w, H = buf.h, d = buf.data, oc = packC(hex(col), 255);
  const out = new Uint32Array(d);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (d[i] >>> 24) continue;
    if ((d[i - 1] >>> 24) || (d[i + 1] >>> 24) || (d[i - W] >>> 24) || (d[i + W] >>> 24)) out[i] = oc;
  }
  buf.data = out;
}
