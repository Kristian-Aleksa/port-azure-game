// ---------------------------------------------------------------------------
// Boot, main loop, saving and loading (four slots, in this browser and in the
// player's private cloud slot when running inside Claude).
// ---------------------------------------------------------------------------
let lastT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000 || 0);
  lastT = now;
  try {
    tickGame(dt, now);
    render(now);
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(frame);
}
function tickGame(dt, now) {
  advance(dt);
  recomputeAll();
  if (IN.selected || IN.overlay || R.ranges) { const key = G.rev + ':' + Math.floor(G.t / 60); if (UI.ovRev !== key) { UI.ovRev = key; updateOverlay(); } }
  updateAgents(dt);
  uiTick(dt, now);
}

// ---- persistence ---------------------------------------------------------------------------------
function rle(arr) { const out = []; let i = 0; while (i < arr.length) { const v = arr[i]; let n = 1; while (i + n < arr.length && arr[i + n] === v) n++; out.push(v, n); i += n; } return out; }
function unrle(a, len, Type = Uint8Array) { const out = new Type(len); let p = 0; for (let i = 0; i < a.length; i += 2) { out.fill(a[i], p, p + a[i + 1]); p += a[i + 1]; } return out; }
const BF = ['id', 'type', 'x', 'y', 'lv', 'v', 'facing', 'done', 'doneAt', 'res', 'stock', 'sat', 'plv', 'lowDays', 'reserved', 'closed', 'idleDays', 'leftUntil', 'guests'];
const round2 = (o) => { const r = {}; for (const k in o || {}) r[k] = Math.round(o[k] * 100) / 100; return r; };
function serialize() {
  return {
    v: SAVE_VERSION, mapV: G.mapV, seed: G.seed, name: G.name, t: G.t, money: Math.round(G.money), loans: G.loans, paper: G.paper, debtDays: G.debtDays, tax: G.tax,
    movingList: G.movingList, level: G.level, weather: G.weather, forecast: G.forecast,
    history: G.history.slice(-20), goals: G.goals, stats: G.stats, moods: G.moods, f1: G.f1, petition: G.petition, lastPetition: G.lastPetition,
    unrestDays: G.unrestDays, strikeDays: G.strikeDays, pending: G.pending, tourists: G.tourists,
    net: rle(G.net), lvl: rle(G.lvl), ramp: rle(G.ramp),
    busStops: [...G.busStops].map(([k, v]) => [k, v.side]),
    spans: [...G.spans.values()].map((s) => [s.id, s.kind, s.bit, s.ax, s.ay, s.bx, s.by, s.dir, s.len, s.z]),
    lines: [...G.lines.values()].map((l) => ({ id: l.id, kind: l.kind, name: l.name, color: l.color, stops: l.stops, vehicles: l.vehicles })),
    circuit: G.circuit,
    bf: BF, buildings: [...G.buildings.values()].map((b) => BF.map((k) => k === 'done' || k === 'closed' ? (b[k] ? 1 : 0) : k === 'stock' || k === 'sat' ? round2(b[k]) : k === 'doneAt' ? Math.round(b.doneAt) : (b[k] || 0))),
    nextId: G.nextId, nextLine: G.nextLine, nextSpan: G.nextSpan, view: G.view, cam: [R.cam.x, R.cam.y], zoom: R.zoom, pop: G.pop, savedAt: Date.now(),
  };
}
const SAVES = { auto: null, 1: null, 2: null, 3: null };
const CLOUD = { db: null, uid: null, ready: false, busy: {}, pending: {} };
function readLocal() {
  for (const s of SLOTS) {
    try { const d = JSON.parse(localStorage.getItem(SAVE_PREFIX + s) || 'null'); if (d && d.v === SAVE_VERSION) SAVES[s] = d; } catch (e) { /* storage unavailable */ }
  }
}
function saveGame(slot = 'auto') {
  if (!G.started || G.over) return;
  // a copy of the demo city never replaces the player's own autosave until they save it themselves
  if (G.demo && slot === 'auto') return;
  if (slot !== 'auto') G.demo = false;
  const data = serialize();
  const json = JSON.stringify(data);
  SAVES[slot] = data;
  try { localStorage.setItem(SAVE_PREFIX + slot, json); } catch (e) { /* the cloud copy still works */ }
  if (json.length < 250000) cloudSave(slot, json, data.savedAt);
}
function deleteSave(slot) {
  SAVES[slot] = null;
  try { localStorage.removeItem(SAVE_PREFIX + slot); } catch (e) { /* ignore */ }
  if (CLOUD.ready) { try { CLOUD.db.doc(`data/users/${CLOUD.uid}/portazur-${slot}`).set({ json: '', savedAt: Date.now() }).catch(() => {}); } catch (e) { /* ignore */ } }
}
function cloudSave(slot, json, savedAt) {
  if (!CLOUD.ready) return;
  if (CLOUD.busy[slot]) { CLOUD.pending[slot] = [json, savedAt]; return; }
  CLOUD.busy[slot] = true;
  CLOUD.db.doc(`data/users/${CLOUD.uid}/portazur-${slot}`).set({ json, savedAt }).catch(() => {}).finally(() => {
    CLOUD.busy[slot] = false;
    const p = CLOUD.pending[slot]; if (p) { CLOUD.pending[slot] = null; cloudSave(slot, p[0], p[1]); }
  });
}
async function initCloud() {
  try {
    const cl = window.claude;
    if (!cl || typeof cl.use !== 'function') return;
    const [db, user] = await Promise.all([cl.use('db'), cl.use('user')]);
    if (!db || !user) return;
    const id = await user.id();
    if (!id) return;
    CLOUD.db = db; CLOUD.uid = id; CLOUD.ready = true;
    const timeout = new Promise((r) => setTimeout(() => r(null), 10000));
    const snaps = await Promise.race([Promise.all(SLOTS.map((s) => db.doc(`data/users/${id}/portazur-${s}`).get().catch(() => null))), timeout]);
    if (!snaps) return;
    let changed = false;
    snaps.forEach((snap, i) => {
      if (!snap || !snap.exists) return;
      const d = snap.data();
      const s = d && typeof d.json === 'string' && d.json ? JSON.parse(d.json) : null;
      if (s && s.v === SAVE_VERSION && (!SAVES[SLOTS[i]] || (s.savedAt || 0) > (SAVES[SLOTS[i]].savedAt || 0))) { SAVES[SLOTS[i]] = s; changed = true; }
    });
    const title = document.getElementById('title');
    if (changed && title && !title.hidden) { const box = document.getElementById('tSlots'); showTitle(!!box && !box.hidden); }
  } catch (e) { /* not inside Claude, or offline */ }
}
function resetWorld() {
  for (const k of [...R.cache.keys()]) if (/^(land|ter|deck|mvilla)\|/.test(k)) R.cache.delete(k);
  AG.list = []; AG.ships = []; AG.sail = []; AG.rev = -1; AG.lineRev = -1; AG.race = null; AG.fans = []; AG.crowd = [];
  R.fx = []; R.bubbles = []; IN.selected = null; IN.moving = null; IN.draft = null; IN.tool = 'inspect';
  R.mtn = genMountainDecor();
  R.view = -1; R.rev = -1; R.chunks = new Map();
  G.touched = [];
  UI.tourT = 0; UI.goalKey = null;
}
function startNewCity(seed) {
  newGame(seed, 'Port Azur');
  G.demo = false;
  resetWorld();
  setView(0);
  R.zoom = window.innerWidth < 700 ? 1 : 2;
  centerOnTile(START.portX + 2.5, G.map.coast[START.portX] - 2);
  if (G.minute() >= 360 && G.minute() < 760) spawnShips();
  G.started = true;
  saveGame('auto');
}
function loadGame(s) {
  s = JSON.parse(JSON.stringify(s)); // play on a copy: the save (or the built-in demo) never changes underneath
  newGame(s.seed, s.name, s.mapV || 1); // saves from before map version 2 keep their tunnels where they were
  const N = MAP_W * MAP_H;
  G.net = unrle(s.net, N); G.lvl = unrle(s.lvl, N, Int8Array); G.ramp = unrle(s.ramp, N);
  G.bid = new Int32Array(N);
  G.buildings = new Map();
  for (const row of s.buildings) {
    const o = {}; (s.bf || BF).forEach((k, i) => { o[k] = row[i]; });
    o.done = !!o.done; o.closed = !!o.closed;
    const b = Object.assign({ demand: {}, happy: 0.7, stock: {}, sat: {}, res: 0 }, o);
    b.stock = b.stock && typeof b.stock === 'object' ? b.stock : {};
    b.sat = b.sat && typeof b.sat === 'object' ? b.sat : {};
    G.buildings.set(b.id, b);
    for (const [tx, ty] of footprint(b.type, b.x, b.y)) G.bid[G.idx(tx, ty)] = b.id;
  }
  G.busStops = new Map((s.busStops || []).map(([k, side]) => [k, { side }]));
  G.spans = new Map(); G.spanTile = new Map(); G.spanEnd = new Map();
  for (const r of s.spans || []) addSpan({ id: r[0], kind: r[1], bit: r[2], ax: r[3], ay: r[4], bx: r[5], by: r[6], dir: r[7], len: r[8], z: r[9] });
  G.lines = new Map((s.lines || []).map((l) => [l.id, Object.assign({ riders: 0, demand: 0 }, l)]));
  G.circuit = s.circuit || null;
  Object.assign(G, {
    t: s.t, money: s.money, debtDays: s.debtDays || 0,
    // loans; a save from before the loan rework carries one plain loan at the old rate
    paper: s.paper ? JSON.parse(JSON.stringify(s.paper)) : null,
    loans: (s.loans || (s.loan > 0 ? [{ id: 'legacy', owed: s.loan, rate: ECON.loanRate, day: 0 }] : [])).map((l) => Object.assign({}, l)), tax: s.tax || 'normal', movingList: s.movingList, level: s.level,
    weather: s.weather, forecast: s.forecast, history: s.history || [], goals: s.goals || {}, stats: s.stats || { built: 0, races: 0 },
    moods: s.moods || [], f1: s.f1 || null, petition: s.petition || null, lastPetition: s.lastPetition || 0, unrestDays: s.unrestDays || 0,
    strikeDays: s.strikeDays || 0, pending: s.pending || null, tourists: Object.assign({ day: 0, guests: 0, cap: 0, beds: 0, potential: 0, turnedAway: 0 }, s.tourists || {}),
    nextId: s.nextId, nextLine: s.nextLine || 1, nextSpan: s.nextSpan || 1, over: false, race: null, demo: !!s.demo,
  });
  if (G.f1 && (G.f1.nextRace < G.day() || (G.f1.nextRace === G.day() && G.minute() > EV.RACE))) G.f1.nextRace = G.day() + 1;
  newToday();
  G.view = s.view || 0;
  resetWorld();
  G.dirtyNet = true; G.dirtyHappy = true; G.rev++;
  recomputeAll();
  setView(G.view);
  R.zoom = s.zoom || 2;
  if (s.cam) { R.cam.x = s.cam[0]; R.cam.y = s.cam[1]; clampCam(); }
  if (G.minute() >= 360 && G.minute() < 760) spawnShips();
  const nm = document.getElementById('cityName'); if (nm) nm.value = G.name;
}

function boot() {
  const canvas = document.getElementById('game');
  initRenderer(canvas);
  loadSettings();
  readLocal();
  titleBackdrop();
  initInput();
  initUI();
  window.addEventListener('pagehide', () => saveGame('auto'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame('auto'); });
  initCloud();
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => (G.started ? serialize() : {})); } catch (e) { /* not in the viewer */ }
  window.__PA = { G, R, B, NET, AG, IN, SAVES, renderBackdrop, BD, GOALS, addBuilding, newGame, placeBuilding, placeDrag, planDrag, linePath, setView, centerOnTile, advance, recomputeAll, render, canPlace, upgrade, demolish, startNewCity, loadGame, serialize, saveGame, closeTitle, setTool, rotateView, zoomAt, updateHover, terra, canTerra, buildSpan, planSpan, createLine, buyLicence, buildCircuit, lineVehicles, MODEL_FN, renderModel, takeLoan, repayLoan, takeAd, dropJob, paperEnsure, uiOpenPaper, uiOpenFinance, finishDraft, uiOpenMenu, uiCloseModal, emit, select, updateOverlay, uiOpenDrawer, uiCloseDrawer, uiToggleRanges, uiToggleOverlay, uiToast, tileToScreen: (x, y) => worldPxToScreen(...(() => { const [X, Y] = toPx(x + 0.5, y + 0.5); return [X, Y - surfaceZ(x + 0.5, y + 0.5)]; })()) };
  window.__PA_READY = true;
  requestAnimationFrame(frame);
}
function start(data) {
  boot();
  if (data && data.v === SAVE_VERSION && data.buildings) { loadGame(data); closeTitle(); }
}
function whenReady(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
whenReady(() => {
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
});
