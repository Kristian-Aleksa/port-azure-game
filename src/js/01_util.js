// ---------------------------------------------------------------------------
// Utilities: random numbers, noise, colour packing, formatting
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Deterministic hash of integer coordinates -> [0,1)
function hash2(x, y, s = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
function hash3(x, y, z, s = 0) { return hash2(x * 31 + z * 977, y * 17 - z * 131, s); }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

// 2D value noise in [0,1)
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
}
function fbm(x, y, s = 0, oct = 4) {
  let v = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { v += amp * vnoise(x * f, y * f, s + i * 101); n += amp; amp *= 0.5; f *= 2.03; }
  return v / n;
}
// 4x4 ordered dither threshold in [0,1)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

// Colours are kept as [r,g,b] arrays and packed to 0xAABBGGRR for ImageData.
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const pack = (r, g, b, a = 255) => (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
function packC(c, a = 255) { return pack(clamp(Math.round(c[0]), 0, 255), clamp(Math.round(c[1]), 0, 255), clamp(Math.round(c[2]), 0, 255), a); }
function mixC(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function mulC(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
const cssC = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// Light a base colour with brightness k; shadows drift toward cool blue, highlights toward warm white.
function shadeTo(out, r, g, b, k) {
  if (k < 1) {
    const t = 1 - k;
    out[0] = r * k + 22 * t; out[1] = g * k + 26 * t; out[2] = b * k + 58 * t;
  } else {
    const t = k - 1;
    out[0] = r + (255 - r) * t * 0.55; out[1] = g + (248 - g) * t * 0.5; out[2] = b + (222 - b) * t * 0.35;
  }
  return out;
}

const fmtNum = (n) => Math.round(n).toLocaleString('en-US');
function fmtMoney(n) {
  const s = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e6) return s + '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M';
  return s + '$' + Math.round(n).toLocaleString('en-US');
}
const OPP = [2, 3, 0, 1];
function fmtTime(min) {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W

// Rotate an offset by q quarter turns (q=1 maps +X to +Y).
function rotQ(dx, dy, q) {
  switch (q & 3) {
    case 0: return [dx, dy];
    case 1: return [-dy, dx];
    case 2: return [-dx, -dy];
    default: return [dy, -dx];
  }
}

// Binary min-heap keyed by number, used by Dijkstra searches
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v; const top = v[0], topK = k[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      while (true) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    this.lastKey = topK;
    return top;
  }
}
