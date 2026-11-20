// ---------------------------------------------------------------------------
// Crisp pixel icons: little shapes rasterised on a 16x16 grid, outlined in
// one dark colour and emitted as SVG rectangles (sharp at any screen scale).
// ---------------------------------------------------------------------------
const PAL = {
  k: '#0b1520', w: '#f4efe3', W: '#ffffff', y: '#ffd25a', Y: '#f0b93a', o: '#f08a24', r: '#e2533d', R: '#b83a2c',
  b: '#5aa7e8', B: '#2d6fb8', n: '#1f4a78', g: '#7fd36a', G: '#3f9a4f', d: '#2e6b3e', t: '#34b8ad', T: '#1f8a82',
  c: '#bfe6ff', p: '#ff8fc8', v: '#b48cff', s: '#c9d3dc', m: '#7d8c99', M: '#4d5b68', h: '#b07a4a', H: '#7a5232', l: '#f2e3b3',
};
class IconGrid {
  constructor() { this.px = new Array(256).fill(null); }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < 16 && y < 16) this.px[y * 16 + x] = c; return this; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); return this; }
  disc(cx, cy, r, c) { for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 <= r * r) this.set(i, j, c); return this; }
  ring(cx, cy, r, c, wdt = 1) { for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy); if (d <= r && d > r - wdt) this.set(i, j, c); } return this; }
  poly(pts, c) {
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const x = i + 0.5, y = j + 0.5; let ins = false;
      for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
        const [xa, ya] = pts[a], [xb, yb] = pts[b];
        if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ins = !ins;
      }
      if (ins) this.set(i, j, c);
    }
    return this;
  }
  line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) this.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); return this; }
  clear(x, y, w = 1, h = 1) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < 16 && j < 16) this.px[j * 16 + i] = null; return this; }
  outline(c = 'k') {
    const src = this.px.slice();
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      if (src[j * 16 + i]) continue;
      const n = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && src[y * 16 + x] && src[y * 16 + x] !== c;
      if (n(i - 1, j) || n(i + 1, j) || n(i, j - 1) || n(i, j + 1)) this.px[j * 16 + i] = c;
    }
    return this;
  }
}
const ICON_DEF = {
  // categories
  home: (g) => { g.poly([[0.5, 8], [8, 1.5], [15.5, 8]], 'r').rect(2, 7, 12, 7, 'w').rect(4, 9, 2, 2, 'b').rect(10, 9, 2, 2, 'b').rect(7, 10, 2, 4, 'h').rect(11, 2, 2, 4, 'R'); },
  shop: (g) => { g.rect(1, 2, 14, 4, 'r'); for (let i = 2; i < 15; i += 4) g.rect(i, 2, 2, 4, 'w'); g.rect(2, 6, 12, 8, 'l').rect(3, 8, 5, 4, 'b').rect(10, 8, 3, 6, 'h').set(4, 8, 'c').set(4, 9, 'c'); },
  leaf: (g) => { g.disc(8, 6.5, 5.6, 'G').disc(6.6, 5.4, 3, 'g').rect(7, 11, 2, 4, 'h').rect(4, 14, 8, 1, 'G'); },
  star: (g) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.1 : 7; p.push([8 + Math.cos(a) * r, 8.4 + Math.sin(a) * r]); } g.poly(p, 'y').set(6, 6, 'W').set(7, 6, 'W'); },
  camera: (g) => { g.rect(1, 5, 14, 9, 'm').rect(4, 3, 4, 2, 'm').disc(8.5, 9.5, 3.3, 'k').disc(8.5, 9.5, 2.3, 'b').set(7, 8, 'c').rect(12, 6, 2, 1, 'y'); },
  bus: (g) => { g.rect(2, 2, 12, 11, 'y').rect(3, 4, 4, 4, 'c').rect(9, 4, 4, 4, 'c').rect(2, 9, 12, 1, 'o').rect(3, 13, 3, 2, 'M').rect(10, 13, 3, 2, 'M').set(3, 11, 'W').set(12, 11, 'W'); },
  terrain: (g) => { g.poly([[0.5, 14], [5.5, 5], [8.5, 9], [11, 4], [15.5, 14]], 's').poly([[3.6, 8.5], [5.5, 5], [7.4, 8.5]], 'W').poly([[9.6, 6.7], [11, 4], [12.4, 6.7]], 'W').rect(1, 12, 14, 2, 'G'); },
  anchor: (g) => { g.ring(8, 3.5, 2, 'B', 1).rect(7, 5, 2, 9, 'B').rect(4, 7, 8, 2, 'B').poly([[1.5, 9], [4.5, 10], [3.5, 11.5]], 'B').poly([[14.5, 9], [11.5, 10], [12.5, 11.5]], 'B').line(3, 11, 6, 14, 'B').line(13, 11, 10, 14, 'B').rect(6, 13, 4, 1, 'B'); },
  // tools
  cursor: (g) => { g.poly([[3, 1.5], [3, 13.5], [6, 10.5], [8.5, 15], [10.5, 14], [8.2, 9.6], [12.5, 9.5]], 'w'); },
  move: (g) => { g.rect(7, 2, 2, 12, 'w').rect(2, 7, 12, 2, 'w').poly([[8, 0.5], [11, 3.5], [5, 3.5]], 'w').poly([[8, 15.5], [11, 12.5], [5, 12.5]], 'w').poly([[0.5, 8], [3.5, 5], [3.5, 11]], 'w').poly([[15.5, 8], [12.5, 5], [12.5, 11]], 'w'); },
  bulldoze: (g) => { g.rect(6, 2, 5, 5, 'y').rect(7, 3, 3, 3, 'c').rect(4, 7, 10, 4, 'y').rect(4, 7, 10, 1, 'Y').rect(3, 11, 12, 3, 'M').disc(5, 12.5, 1.1, 's').disc(9, 12.5, 1.1, 's').disc(13, 12.5, 1.1, 's').poly([[0.5, 5.5], [3, 6.5], [3, 14], [0.5, 14.5]], 's'); },
  // view
  rotate: (g) => { g.ring(8, 8, 6, 'w', 2).clear(9, 1, 6, 6).poly([[8, 0.5], [12, 4], [8, 7.5]], 'w'); },
  plus: (g) => { g.rect(7, 3, 2, 10, 'w').rect(3, 7, 10, 2, 'w'); },
  minus: (g) => { g.rect(3, 7, 10, 2, 'w'); },
  ranges: (g) => { g.ring(8, 8, 7, 't', 1).ring(8, 8, 4.5, 't', 1).disc(8, 8, 1.6, 'w'); },
  smile: (g) => { g.disc(8, 8, 6.5, 'y').rect(5, 5, 2, 2, 'k').rect(9, 5, 2, 2, 'k').rect(5, 10, 6, 1, 'k').set(4, 9, 'k').set(11, 9, 'k'); },
  frown: (g) => { g.disc(8, 8, 6.5, 'o').rect(5, 5, 2, 2, 'k').rect(9, 5, 2, 2, 'k').rect(5, 10, 6, 1, 'k').set(4, 11, 'k').set(11, 11, 'k'); },
  route: (g) => { g.line(2, 13, 6, 4, 'b').line(6, 4, 10, 11, 'b').line(10, 11, 14, 3, 'b').line(2, 12, 6, 3, 'b').line(6, 3, 10, 10, 'b').line(10, 10, 14, 2, 'b').disc(2.5, 13, 1.7, 'w').disc(6, 4, 1.7, 'w').disc(10, 11, 1.7, 'w').disc(14, 3, 1.7, 'w'); },
  menu: (g) => { g.rect(2, 3, 12, 2, 'w').rect(2, 7, 12, 2, 'w').rect(2, 11, 12, 2, 'w'); },
  fold: (g) => { g.poly([[2.5, 11], [8, 4.5], [13.5, 11], [11.4, 13], [8, 9.2], [4.6, 13]], 'w'); },
  unfold: (g) => { g.poly([[2.5, 5], [8, 11.5], [13.5, 5], [11.4, 3], [8, 6.8], [4.6, 3]], 'w'); },
  help: (g) => { g.disc(8, 8, 7, 'b').rect(6, 4, 4, 1, 'w').rect(9, 5, 2, 2, 'w').rect(7, 7, 2, 2, 'w').rect(7, 11, 2, 2, 'w').set(5, 5, 'w'); },
  sound: (g) => { g.rect(2, 6, 3, 4, 'w').poly([[4, 6], [9, 2], [9, 14], [4, 10]], 'w').line(11, 5, 11, 10, 'w').line(13, 3, 13, 12, 'w'); },
  mute: (g) => { g.rect(2, 6, 3, 4, 'm').poly([[4, 6], [9, 2], [9, 14], [4, 10]], 'm').line(11, 5, 15, 10, 'r').line(15, 5, 11, 10, 'r'); },
  // speeds
  pause: (g) => { g.rect(4, 3, 3, 10, 'w').rect(9, 3, 3, 10, 'w'); },
  play: (g) => { g.poly([[4, 2.5], [13, 8], [4, 13.5]], 'w'); },
  fast: (g) => { g.poly([[1.5, 3], [8, 8], [1.5, 13]], 'w').poly([[8, 3], [14.5, 8], [8, 13]], 'w'); },
  faster: (g) => { g.poly([[0.5, 4], [5, 8], [0.5, 12]], 'w').poly([[5, 4], [9.5, 8], [5, 12]], 'w').poly([[9.5, 4], [14, 8], [9.5, 12]], 'w').rect(14, 4, 1, 8, 'w'); },
  // weather
  sunny: (g) => { g.disc(8, 8, 3.8, 'y'); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.set(8 + Math.cos(a) * 6.3 - 0.5, 8 + Math.sin(a) * 6.3 - 0.5, 'y'); } },
  cloudy: (g) => { g.disc(5.5, 9, 3.3, 'w').disc(9.5, 7.2, 4, 'w').disc(12.4, 10, 2.6, 'w').rect(3, 10, 11, 3, 'w'); },
  rain: (g) => { g.disc(5.5, 6, 3, 's').disc(9.5, 4.5, 3.6, 's').disc(12.4, 7, 2.4, 's').rect(3, 7, 11, 2, 's'); for (const [x, y] of [[4, 11], [8, 12], [12, 11], [6, 14], [10, 14]]) g.rect(x, y, 1, 2, 'b'); },
  heat: (g) => { g.rect(7, 1, 3, 10, 'w').disc(8.5, 12, 3.1, 'r').rect(8, 4, 1, 8, 'r').set(11, 3, 'o').set(12, 3, 'o').set(11, 6, 'o').set(12, 6, 'o'); },
  storm: (g) => { g.disc(5.5, 5.5, 3, 'm').disc(9.5, 4, 3.6, 'm').disc(12.4, 6.5, 2.4, 'm').rect(3, 6, 11, 2, 'm').poly([[9, 8], [6, 12], [8, 12], [6.5, 15.5], [11, 10.5], [9, 10.5], [10.5, 8]], 'y'); },
  // stats and misc
  people: (g) => { g.disc(5, 4.5, 2.3, 'l').rect(2, 8, 6, 6, 'b').disc(11, 5.5, 2.1, 'l').rect(8, 9, 6, 5, 'g'); },
  list: (g) => { g.rect(2, 1, 12, 14, 'w').rect(4, 4, 2, 2, 'g').rect(7, 4, 5, 1, 'm').rect(4, 8, 2, 2, 'g').rect(7, 8, 5, 1, 'm').rect(4, 12, 2, 1, 'y').rect(7, 12, 5, 1, 'm'); },
  coin: (g) => { g.disc(8, 8, 6.5, 'y').ring(8, 8, 6.5, 'Y', 1).rect(7, 4, 2, 8, 'Y').rect(5, 5, 6, 2, 'Y').rect(5, 9, 6, 2, 'Y').set(5, 7, 'Y').set(10, 9, 'Y'); },
  truck: (g) => { g.rect(1, 4, 9, 7, 'w').rect(10, 6, 4, 5, 'G').rect(11, 7, 2, 2, 'c').rect(1, 11, 14, 1, 'M').disc(4, 12.5, 1.6, 'M').disc(12, 12.5, 1.6, 'M').rect(2, 6, 6, 2, 'G'); },
  flag: (g) => { g.rect(2, 1, 1, 14, 'm'); for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) g.rect(3 + i * 2, 2 + j * 2, 2, 2, (i + j) % 2 ? 'k' : 'W'); },
  ship: (g) => { g.poly([[1, 9], [15, 9], [12.5, 13.5], [3, 13.5]], 'n').rect(4, 5, 7, 4, 'w').rect(5, 6, 1, 1, 'b').rect(7, 6, 1, 1, 'b').rect(9, 6, 1, 1, 'b').rect(8, 2, 2, 3, 'r').rect(1, 13, 14, 1, 'b'); },
  train: (g) => { g.rect(3, 1, 10, 11, 'r').rect(4, 3, 8, 4, 'c').rect(4, 9, 2, 2, 'y').rect(10, 9, 2, 2, 'y').line(3, 12, 1, 15, 'M').line(12, 12, 14, 15, 'M').rect(4, 13, 8, 1, 'M'); },
  road: (g) => { g.poly([[5, 1], [11, 1], [15, 15], [1, 15]], 'M').rect(7, 2, 2, 2, 'y').rect(7, 6, 2, 3, 'y').rect(7, 11, 2, 3, 'y'); },
  tunnel: (g) => { g.poly([[0.5, 15], [3, 4], [8, 1], [13, 4], [15.5, 15]], 's').disc(8, 10, 4.5, 'k').rect(3.5, 10, 9, 5, 'k').rect(7, 11, 2, 1, 'y').rect(7, 13, 2, 1, 'y'); },
  bridge: (g) => { g.rect(0, 5, 16, 2, 'l').rect(1, 7, 2, 8, 's').rect(13, 7, 2, 8, 's').rect(7, 7, 2, 8, 's').disc(5, 11, 2.4, null).rect(0, 4, 16, 1, 'h'); g.clear(4, 9, 3, 6); g.clear(10, 9, 3, 6); g.rect(0, 14, 16, 2, 'b'); },
  raise: (g) => { g.rect(2, 9, 12, 5, 'G').rect(2, 8, 12, 1, 'g').poly([[8, 1], [12.5, 5.5], [3.5, 5.5]], 'w').rect(7, 5, 2, 3, 'w'); },
  lower: (g) => { g.rect(2, 11, 12, 3, 'G').rect(2, 10, 12, 1, 'g').poly([[8, 9], [12.5, 4.5], [3.5, 4.5]], 'w').rect(7, 1, 2, 4, 'w'); },
  save: (g) => { g.rect(2, 2, 12, 12, 'B').rect(4, 2, 7, 4, 'c').rect(9, 3, 1, 2, 'B').rect(4, 9, 8, 5, 'w').rect(5, 10, 6, 1, 's').rect(5, 12, 6, 1, 's'); },
  load: (g) => { g.rect(1, 3, 6, 2, 'Y').rect(1, 5, 14, 9, 'Y').poly([[3, 8], [15.5, 8], [13, 14], [1, 14]], 'y'); },
  gear: (g) => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.rect(Math.round(8 + Math.cos(a) * 5.6 - 1), Math.round(8 + Math.sin(a) * 5.6 - 1), 2, 2, 's'); } g.disc(8, 8, 5, 's').disc(8, 8, 2, 'M'); },
  paper: (g) => { g.rect(1, 2, 13, 12, 'w').rect(14, 4, 1, 10, 'm').rect(3, 4, 9, 2, 'M').rect(3, 7, 4, 4, 's').rect(8, 7, 4, 1, 'm').rect(8, 9, 4, 1, 'm').rect(3, 12, 9, 1, 'm'); },
  chart: (g) => { g.rect(1, 14, 14, 1, 'w').rect(2, 9, 3, 5, 'r').rect(6, 5, 3, 9, 'y').rect(10, 2, 3, 12, 'g'); },
  bank: (g) => { g.poly([[1, 6], [8, 1.5], [15, 6]], 's').rect(2, 6, 12, 1, 's').rect(3, 7, 2, 6, 'w').rect(7, 7, 2, 6, 'w').rect(11, 7, 2, 6, 'w').rect(1, 13, 14, 2, 's'); },
  cart: (g) => { g.line(1, 2, 3, 2, 'm').line(3, 2, 5, 10, 'm').rect(4, 4, 11, 5, 'g').rect(5, 10, 9, 1, 'm').disc(6, 13, 1.6, 'M').disc(12, 13, 1.6, 'M').set(7, 5, 'r').set(10, 6, 'o').set(12, 5, 'y'); },
  shirt: (g) => { g.poly([[5, 1.5], [11, 1.5], [15, 5], [12.5, 7.5], [11.5, 6.5], [11.5, 14.5], [4.5, 14.5], [4.5, 6.5], [3.5, 7.5], [1, 5]], 'b').rect(7, 2, 2, 2, 'c'); },
  bulb: (g) => { g.disc(8, 6.5, 5, 'y').rect(6, 10, 4, 2, 'y').rect(6, 12, 4, 2, 's').rect(7, 14, 2, 1, 'M').set(6, 4, 'W').set(6, 5, 'W'); },
  hotel: (g) => { g.rect(2, 2, 12, 12, 'p').rect(4, 4, 2, 2, 'c').rect(7, 4, 2, 2, 'c').rect(10, 4, 2, 2, 'c').rect(4, 7, 2, 2, 'c').rect(10, 7, 2, 2, 'c').rect(7, 10, 2, 4, 'h').rect(6, 0, 4, 2, 'y'); },
  bed: (g) => { g.rect(1, 8, 14, 4, 'w').rect(1, 5, 2, 9, 'h').rect(13, 7, 2, 7, 'h').rect(3, 6, 3, 2, 'c').rect(6, 7, 7, 1, 'b'); },
  lock: (g) => { g.ring(8, 6, 4, 's', 2).clear(3, 6, 10, 3).rect(3, 7, 10, 8, 'y').rect(7, 10, 2, 3, 'H'); },
  close: (g) => { g.line(3, 3, 12, 12, 'w').line(4, 3, 13, 12, 'w').line(12, 3, 3, 12, 'w').line(13, 3, 4, 12, 'w'); },
  check: (g) => { g.line(2, 8, 6, 12, 'g').line(2, 9, 6, 13, 'g').line(6, 12, 14, 4, 'g').line(6, 13, 14, 5, 'g'); },
  warn: (g) => { g.poly([[8, 1], [15.5, 14.5], [0.5, 14.5]], 'y').rect(7, 5, 2, 5, 'k').rect(7, 11, 2, 2, 'k'); },
  trash: (g) => { g.rect(3, 4, 10, 1, 's').rect(6, 2, 4, 2, 's').rect(4, 5, 8, 10, 's').rect(6, 7, 1, 6, 'm').rect(9, 7, 1, 6, 'm'); },
  fist: (g) => { g.rect(4, 3, 8, 6, 'l').rect(4, 9, 8, 6, 'l').line(6, 3, 6, 8, 'h').line(8, 3, 8, 8, 'h').line(10, 3, 10, 8, 'h').rect(2, 7, 3, 3, 'l'); },
  petition: (g) => { g.rect(3, 1, 10, 14, 'w').rect(5, 4, 6, 1, 'm').rect(5, 6, 6, 1, 'm').rect(5, 8, 4, 1, 'm').line(5, 12, 11, 11, 'B'); },
  ticket: (g) => { g.rect(1, 4, 14, 8, 'p').clear(1, 7, 1, 2).clear(14, 7, 1, 2).rect(5, 4, 1, 8, 'w').rect(8, 6, 5, 1, 'w').rect(8, 9, 4, 1, 'w'); },
  globe: (g) => { g.disc(8, 8, 6.5, 'b').poly([[4, 4], [8, 3], [9, 6], [6, 9], [4, 8]], 'g').poly([[10, 8], [13, 9], [12, 12], [9.5, 12]], 'g'); },
  watch: (g) => { g.poly([[0.5, 8], [4, 4], [12, 4], [15.5, 8], [12, 12], [4, 12]], 'w').disc(8, 8, 3, 'B').disc(8, 8, 1.4, 'k'); },
};
const _iconSvg = {};
function iconSvg(name) {
  if (_iconSvg[name]) return _iconSvg[name];
  const g = new IconGrid();
  (ICON_DEF[name] || ICON_DEF.help)(g);
  g.outline('k');
  const by = {};
  for (let j = 0; j < 16; j++) {
    let i = 0;
    while (i < 16) {
      const c = g.px[j * 16 + i];
      if (!c) { i++; continue; }
      let n = 1; while (i + n < 16 && g.px[j * 16 + i + n] === c) n++;
      (by[c] = by[c] || []).push(`M${i} ${j}h${n}v1h-${n}z`);
      i += n;
    }
  }
  const paths = Object.entries(by).map(([c, d]) => `<path fill="${PAL[c] || c}" d="${d.join('')}"/>`).join('');
  return (_iconSvg[name] = `<svg class="ico" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${paths}</svg>`);
}
const icon = (name, cls = '') => iconSvg(name).replace('class="ico"', `class="ico ${cls}"`);
