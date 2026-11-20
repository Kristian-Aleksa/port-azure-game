// ---------------------------------------------------------------------------
// Simulation: the daily ship, supply trucks, shop sales, tourists and hotels,
// transit fares, upkeep and loans, happiness, unrest, the moving list,
// people moving out, shops closing, the Grand Prix and the daily ledger.
// ---------------------------------------------------------------------------
const EV = { WEATHER: 300, SAIL: 360, TRUCKS: 390, DELIVER: 510, UNLOAD: 540, TOUR_IN: 600, RACE: 840, HOTEL: 1080, CLOSE: 1260 };
const SALES_HOURS = [600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200];
const EVENT_MINS = [...new Set([EV.WEATHER, EV.SAIL, EV.TRUCKS, EV.DELIVER, EV.UNLOAD, EV.TOUR_IN, EV.RACE, EV.HOTEL, ...SALES_HOURS, EV.CLOSE])].sort((a, b) => a - b);

const SAY = {
  noRoad: ['Our building is not even connected to a road!', 'How are we supposed to get home? There is no road.'],
  noGroceries: ['Nowhere to buy groceries around here.', 'I walked twenty minutes for a baguette.', 'We need a grocer on this street.'],
  noClothes: ['I have to take the train to Nice for a shirt.', 'Not a single clothes shop nearby.'],
  noUtilities: ['Where am I supposed to buy a light bulb?', 'No hardware store within reach.'],
  emptyShelves: ['The shop was out of stock AGAIN.', 'Empty shelves since the morning.', 'No delivery truck came today.'],
  noPark: ['Would it kill them to build a park?', 'Not a single tree to sit under.', 'The kids need somewhere green to play.'],
  heat: ['It is sweltering. A pool would be heaven.', 'Too hot to think. Where can we cool off?'],
  noTransit: ['We need a bus line out here.', 'Everything is so far without a tram.', 'Walking everywhere is wearing me out.'],
  packed: ['The bus is packed like a sardine tin.', 'Three full trains went past my stop.'],
  rain: ['Soaked again, and no bus in sight.', 'Rain all day and nowhere to shelter.'],
  storm: ['This storm is terrifying.', 'The wind nearly took my balcony plants.'],
  portNoise: ['Those cranes start at dawn. So loud.', 'The harbour horn rattles our windows.'],
  noise: ['The bass from that club goes on all night.', 'Match day again. I cannot hear myself think.'],
  crowded: ['It is getting crowded and grey around here.', 'Concrete everywhere, not a patch of green.'],
  portFull: ['The port cannot keep up with the city.', 'Half the cargo stayed on the ship.'],
  tourists: ['Tour groups block the whole pavement.', 'This used to be a quiet street before the coaches.'],
  taxes: ['Taxes went up again. Outrageous.', 'I pay a fortune in taxes for this?'],
  broke: ['The council is broke. The bins were not even emptied.', 'They cut the street cleaning. Disgraceful.'],
  left: ['The neighbours packed up and left.', 'Half our street moved away.'],
  strike: ['The dockers are on strike. Nothing gets delivered.', 'Strike day. The whole port is shut.'],
  grudge: ['They ignored our petition. Typical.', 'Nobody at the town hall listens to us.'],
  raceNoise: ['Engines screaming past my window all afternoon.', 'I cannot even cross the street on race day.'],
};
const PRAISE = {
  shops: ['Love the shops on our street.', 'Fresh bread every morning!'],
  parks: ['The park is lovely in the evening.', 'Best bench in the city.'],
  landmarks: ['What a view from up there!', 'We have the finest museum on the coast.'],
  transit: ['The bus gets me anywhere.', 'The train makes life easy.'],
  seaView: ['What a view of the sea!', 'I can hear the waves from my balcony.'],
  weather: ['Glorious sunshine today.', 'Perfect day for the beach.'],
  buzz: ['The town hall actually listened!', 'What a weekend, the whole city is buzzing.'],
};
const ICON = { noRoad: 'road', noGroceries: 'cart', noClothes: 'shirt', noUtilities: 'bulb', emptyShelves: 'box', noPark: 'tree', heat: 'sun', noTransit: 'bus', packed: 'crowd', rain: 'rain', storm: 'storm', portNoise: 'noise', noise: 'noise', crowded: 'crowd', portFull: 'ship', tourists: 'camera', taxes: 'coin', broke: 'coin', left: 'home', strike: 'fist', grudge: 'fist', raceNoise: 'flag' };
const FIX = {
  noRoad: 'connect it to a road on the same level', noGroceries: 'build a grocer whose radius covers these homes, or link them with a line', noClothes: 'build a boutique in range',
  noUtilities: 'build a hardware store in range', emptyShelves: 'more delivery trucks: link the road tunnel, rail freight, or upgrade the harbour', noPark: 'build parks or plazas nearby',
  heat: 'build a pool or beach club', noTransit: 'add stops and set up a bus or train line', packed: 'add vehicles to the busy line', rain: 'transit stops nearby help', storm: 'it will pass',
  portNoise: 'keep homes away from the quay', noise: 'keep clubs and stadiums away from homes; parks soften it', crowded: 'add a park nearby', portFull: 'upgrade the harbour or build a new one',
  tourists: 'spread attractions out, or keep homes outside tourist centre radius', taxes: 'lower taxes in the menu', broke: 'get the treasury out of the red', left: 'it fades in a few days',
  strike: 'raise happiness above 40%', grudge: 'fix the next petition in time', raceNoise: 'it is over tomorrow',
};

function rollWeather(prev, rnd) {
  if ((prev === 'sunny' || prev === 'cloudy') && rnd() < 0.35) return prev;
  let r = rnd(), acc = 0;
  for (const k of Object.keys(WEATHER)) { acc += WEATHER[k].p; if (r < acc) return k; }
  return 'sunny';
}

// ---- layout-dependent recompute ---------------------------------------------------------
function recomputeAll() {
  if (G.dirtyNet) { computeNetworks(); G.dirtyNet = false; G.dirtyHappy = true; }
  if (G.dirtyHappy) { computeAccess(); computeHappiness(); G.dirtyHappy = false; }
}
function portCap() { let c = 0; for (const b of G.buildings.values()) if (b.type === 'port' && b.done) c += PORT_LV[b.plv].cap; return c; }
function isRaceDay() { return !!(G.f1 && G.f1.licensed && G.day() === G.f1.nextRace); }

function computeHappiness() {
  let pop = 0, eff = 0;
  const homes = [], ports = [], noisy = [], centres = [];
  for (const b of G.buildings.values()) {
    if (!b.done) continue;
    if (HOUSING.has(b.type)) { homes.push(b); pop += b.res; eff += b.res * (B[b.type].spend || 1); }
    else if (b.type === 'port') ports.push(b);
    else if (b.type === 'tourist') centres.push(b);
    if (B[b.type].noise && !b.closed) noisy.push(b);
  }
  G.pop = pop; G.effPop = eff;
  const cap = portCap(), day = G.day();
  const raceNear = isRaceDay() && G.circuit ? new Set(G.circuit.tiles) : null;
  const tourHeavy = G.tourists.day > Math.max(60, pop * 0.6);
  const tally = {}, praise = {};
  let hsum = 0;
  for (const h of homes) {
    const F = {};
    if (!h.roadAccess) F.noRoad = -30;
    let shelf = 0, shopJoy = 0;
    for (const g in GOODS) {
      if (g !== 'groceries' && pop < GOODS[g].minPop) continue;
      const list = h.reach && h.reach[g];
      if (!list || !list.length) { F['no' + g[0].toUpperCase() + g.slice(1)] = GOODS[g].missing; continue; }
      let sat = 0, ws = 0;
      for (const e of list) { sat += e.share * (e.s.sat[g] != null ? e.s.sat[g] : 1); ws += e.share; }
      sat = ws ? sat / ws : 1;
      if (sat >= 0.95) shopJoy += GOODS[g].has; else shelf -= (1 - sat) * GOODS[g].short;
    }
    if (shopJoy) F.shops = shopJoy;
    if (shelf < -0.5) F.emptyShelves = shelf;
    let park = 0, land = 0;
    for (const e of h.amen || []) { const j = joyOf(e.l) * e.f; if (LANDMARK.has(e.l.type)) land += j; else park += j; }
    if (park > 0) F.parks = Math.min(14, park * 6); else if (pop >= 40) F.noPark = pop >= 400 ? -9 : -6;
    if (land > 0) F.landmarks = Math.min(18, land * 5);
    if (h.transit) { F.transit = h.transit === 'rail' ? 8 : 5; if (h.lines.some((l) => l.load > 1.15)) F.packed = -4; }
    else if (pop >= 150) F.noTransit = pop >= 600 ? -10 : -6;
    let pd = 99; for (const p of ports) pd = Math.min(pd, distTo(p, h.x, h.y));
    if (pd <= 2) F.portNoise = -6;
    let nz = 0; for (const n of noisy) { if (distTo(n, h.x, h.y) <= 2.5) nz = Math.min(nz, -3 * B[n.type].noise * (h.calm ? 0.5 : 1)); }
    if (nz) F.noise = nz;
    const sd = G.seaDist[G.idx(h.x, h.y)] || 99, lvl = tileLevel(h.x, h.y);
    if (sd <= 3 + Math.max(0, lvl)) F.seaView = (h.type === 'villa' ? 7 : 3) + Math.max(0, lvl);
    let crowd = 0; for (const o of homes) if (Math.abs(o.x - h.x) <= 3 && Math.abs(o.y - h.y) <= 3) crowd += o.res;
    if (crowd > 300 && !h.calm) F.crowded = -6;
    if (tourHeavy && centres.some((c) => distTo(c, h.x, h.y) <= radiusOf(c))) F.tourists = -3;
    if (TAX[G.tax].joy) F.taxes = TAX[G.tax].joy;
    if (G.money < 0) F.broke = -6;
    if (eff > cap) F.portFull = -5;
    if (G.strike) F.strike = -3;
    for (const md of G.moods) F[md.key] = (F[md.key] || 0) + md.v;
    if (raceNear) { let near = false; for (const [dx, dy] of [[0, 0], ...DIRS]) if (raceNear.has(G.idx(h.x + dx, h.y + dy))) near = true; if (near) F.raceNoise = -6; }
    if (h.leftUntil && h.leftUntil >= day) F.left = -4;
    // the weather no longer sways anyone's mood; everything the city does counts for more instead
    for (const k in F) F[k] = Math.round(F[k] * HAPPY_GAIN);
    let H = 50;
    for (const k in F) H += F[k];
    h.happy = clamp(H / 100, 0, 1);
    h.factors = F;
    hsum += h.happy * h.res;
    let worst = null, wv = 0, best = null, bv = 0;
    for (const k in F) { if (F[k] < wv && SAY[k]) { wv = F[k]; worst = k; } if (F[k] > bv && PRAISE[k]) { bv = F[k]; best = k; } }
    h.worst = worst; h.best = best;
    if (worst) tally[worst] = (tally[worst] || 0) + h.res;
    if (best && h.happy > 0.7) praise[best] = (praise[best] || 0) + h.res;
  }
  G.happy = pop ? hsum / pop : 0.7;
  G.complaints = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n }));
  G.praise = Object.entries(praise).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n }));
  checkLevel();
}

function checkLevel() {
  while (G.level < LEVELS.length - 1 && G.pop >= LEVELS[G.level + 1].pop) {
    G.level++;
    const unlocks = B_ORDER.filter((k) => B[k].lvl === G.level).map((k) => B[k].name);
    for (const p of PORT_LV) if (p.lvl === G.level && p.cost) unlocks.push('Harbour upgrade: ' + p.name);
    if (UPGRADE_LVL.includes(G.level)) unlocks.push(`Building upgrades to level ${UPGRADE_LVL.indexOf(G.level) + 1}`);
    for (const l of LOANS) if (l.lvl === G.level) unlocks.push(`the ${fmtMoney(l.amount)} ${l.name.toLowerCase()} at the bank`);
    emit('levelup', { level: G.level, unlocks });
  }
}

// ---- time ---------------------------------------------------------------------------------
function advance(realDt) {
  if (!G.speed || G.over) return;
  if (G.race && G.race.live) return;            // the clock stops while the cars race
  const mult = SPEEDS[G.speed];
  const m = G.minute();
  const rate = m >= 360 && m < 1320 ? DAY_RATE : NIGHT_RATE;
  const t0 = G.t, t1 = G.t + realDt * rate * mult;
  const d0 = Math.floor(t0 / DAY_MIN);
  for (let d = d0; d <= Math.floor(t1 / DAY_MIN); d++) {
    for (const e of EVENT_MINS) {
      const at = d * DAY_MIN + e;
      if (at > t0 && at <= t1) {
        G.t = at; fireEvent(e);
        if ((G.race && G.race.live) || G.over) return;
      }
    }
  }
  G.t = t1;
  for (const b of G.buildings.values()) if (!b.done && G.t >= b.doneAt) completeBuilding(b);
}

function completeBuilding(b) {
  b.done = true;
  if (HOUSING.has(b.type)) { b.res = capOf(b); G.today.movedIn += b.res; b.reserved = 0; }
  initBuilding(b);
  if (HOUSING.has(b.type)) b.res = capOf(b);
  footTouch(b);
  G.dirtyNet = true; G.rev++;
  emit('built', b);
  paperBuilt(b.type);
}

function fireEvent(e) {
  if (e === EV.WEATHER) { G.weather = G.forecast; G.dirtyHappy = true; emit('weather', G.weather); startDay(); }
  else if (e === EV.SAIL) emit('sail');
  else if (e === EV.TRUCKS) planDeliveries();
  else if (e === EV.DELIVER) deliver();
  else if (e === EV.UNLOAD) shipDay();
  if (e === EV.TOUR_IN) touristsArrive();
  if (e === EV.RACE && isRaceDay()) startRace();
  if (SALES_HOURS.includes(e)) salesHour();
  if (e === EV.HOTEL) hotelsCheckIn();
  if (e === EV.CLOSE) endOfDay();
  paperCheck();
}

// strikes and protests decided the evening before take effect at dawn
function startDay() {
  G.strike = !!(G.pending && G.pending.strike);
  G.protest = G.pending && G.pending.protest ? G.pending.protest : null;
  G.pending = null;
  if (G.strike) emit('strike');
  if (G.protest) emit('protest', G.protest);
  if (isRaceDay()) emit('raceday');
  G.dirtyHappy = true;
}

function liveStores() { const out = []; for (const b of G.buildings.values()) if (SHOPS.has(b.type) && b.done && !b.closed) out.push(b); return out; }
function fillOf(s) { let st = 0, cp = 0; for (const g in B[s.type].goods) { st += s.stock[g] || 0; cp += goodsCap(s, g); } return cp ? st / cp : 1; }

function planDeliveries() {
  recomputeAll();
  const stores = liveStores().sort((a, b) => fillOf(a) - fillOf(b));
  const src = NET.sources.filter((s) => !(G.strike && s.kind === 'port')).map((s) => ({ s, left: s.trucks }));
  const dels = [];
  for (const st of stores) {
    st.noTruck = false;
    if (fillOf(st) > 0.92) continue;
    const pick = src.find((q) => q.left > 0 && [...q.s.comps].some((c) => st.access.has(c)));
    if (!pick) { st.noTruck = true; continue; }
    pick.left--;
    dels.push({ id: st.id, src: pick.s });
  }
  G.deliveries = dels.map((d) => d.id);
  G.supply = { trucks: src.reduce((a, q) => a + q.s.trucks, 0), used: dels.length, short: stores.filter((s) => s.noTruck).length };
  emit('trucks', dels);
}
function deliver() {
  let cost = 0;
  for (const id of G.deliveries || []) {
    const s = G.buildings.get(id);
    if (!s || !s.done || s.closed) continue;
    for (const g in B[s.type].goods) {
      const add = Math.max(0, goodsCap(s, g) - (s.stock[g] || 0));
      const c = add * B[s.type].price[g] * ECON.wholesale;
      s.stock[g] = goodsCap(s, g); s.wsToday = (s.wsToday || 0) + c; cost += c;
    }
    s.delivered = G.day();
  }
  G.deliveries = [];
  G.money -= cost; G.today.wholesale += cost;
}

function shipDay() {
  recomputeAll();
  const ports = [...G.buildings.values()].filter((b) => b.type === 'port' && b.done);
  const cap = portCap();
  const served = Math.min(G.effPop, cap);
  const mult = (0.55 + 0.6 * G.happy) * (G.weather === 'storm' ? 0.75 : 1) * TAX[G.tax].mult * (G.strike ? 0.5 : 1) * (G.protest ? 0.9 : 1);
  let total = 0;
  for (const p of ports) {
    const lv = PORT_LV[p.plv];
    const share = cap ? lv.cap / cap : 0;
    const inc = Math.round((lv.base + ECON.portRate * served * share) * mult);
    total += inc;
    emit('cash', { x: p.x + 2, y: p.y, amount: inc, kind: 'port' });
  }
  G.money += total; G.today.port += total;
  emit('unload', { total, storm: G.weather === 'storm', full: G.effPop > cap, strike: G.strike });
}

// ---- tourists --------------------------------------------------------------------------------------
function cityAppeal() {
  let a = 2;
  for (const b of G.buildings.values()) if (b.done && !b.closed && B[b.type].appeal) a += B[b.type].appeal * (b.lv > 1 ? 1 + (b.lv - 1) * 0.25 : 1);
  return a;
}
function routeCapacity() {
  let c = 0;
  for (const l of G.lines.values()) if (LINE_KIND[l.kind].outside && l.valid && l.tourOk) c += lineCapacity(l);
  return c;
}
function touristsArrive() {
  const cap = routeCapacity();
  const wx = G.weather === 'rain' || G.weather === 'storm' ? 0.5 : G.weather === 'sunny' ? 1.1 : 1;
  const potential = (30 + cityAppeal() * 22) * (0.4 + G.happy) * wx * (isRaceDay() ? 2 : 1);
  const n = Math.round(Math.min(cap, potential));
  G.tourists.day = n; G.tourists.cap = cap; G.tourists.potential = Math.round(potential);
  // tourists shop near the tourist centres they arrive at
  const centres = [...G.buildings.values()].filter((b) => b.type === 'tourist' && b.done);
  const stores = liveStores();
  for (const s of stores) s.tourDemand = {};
  if (n && centres.length) {
    for (const g of ['groceries', 'clothes']) {
      const near = stores.filter((s) => B[s.type].goods[g] && centres.some((c) => distTo(c, s.x, s.y) <= radiusOf(c)));
      const tot = near.reduce((a, s) => a + goodsCap(s, g), 0);
      for (const s of near) s.tourDemand[g] = n * (g === 'clothes' ? 0.3 : 0.25) * goodsCap(s, g) / tot;
    }
  }
  if (n) emit('tourists', n);
  G.dirtyHappy = true;
}
function hotelsCheckIn() {
  const hotels = [...G.buildings.values()].filter((b) => HOTELS.has(b.type) && b.done);
  const beds = hotels.reduce((a, h) => a + bedsOf(h), 0);
  const want = Math.round(G.tourists.day * 0.55 + (isRaceDay() ? beds : 0));
  const guests = Math.min(beds, want);
  let inc = 0;
  for (const h of hotels) {
    const g = beds ? Math.round(guests * bedsOf(h) / beds) : 0;
    h.guests = g; const r = g * B[h.type].rate; h.lastRev = r; inc += r;
    if (r > 0) emit('cash', { x: h.x + 0.5, y: h.y, amount: r, kind: 'hotel' });
  }
  G.tourists.guests = guests; G.tourists.beds = beds; G.tourists.turnedAway = Math.max(0, want - beds);
  G.money += inc; G.today.hotels += inc;
}

// ---- shops ----------------------------------------------------------------------------------------
function salesHour() {
  let rev = 0;
  const damp = G.protest ? 0.75 : 1;
  for (const s of liveStores()) {
    const d = B[s.type];
    s.soldT = s.soldT || {}; s.wantT = s.wantT || {};
    for (const g in d.goods) {
      const want = ((s.demand[g] || 0) + ((s.tourDemand && s.tourDemand[g]) || 0)) * damp / SALES_HOURS.length;
      const sold = Math.min(s.stock[g] || 0, want);
      s.stock[g] = (s.stock[g] || 0) - sold;
      s.soldT[g] = (s.soldT[g] || 0) + sold; s.wantT[g] = (s.wantT[g] || 0) + want;
      const r = sold * d.price[g];
      s.revT = (s.revT || 0) + r; rev += r;
    }
    if (s.revT > 0 && Math.random() < 0.2) emit('coin', s);
  }
  G.money += rev; G.today.stores += rev;
}
function closeStores() {
  let staff = 0;
  const closed = [];
  for (const s of liveStores()) {
    const d = B[s.type];
    let want = 0, cap = 0, stock = 0, sold = 0;
    for (const g in d.goods) {
      s.sat[g] = (s.wantT && s.wantT[g] > 0.01) ? clamp((s.soldT[g] || 0) / s.wantT[g], 0, 1) : 1;
      want += (s.wantT && s.wantT[g]) || 0; sold += (s.soldT && s.soldT[g]) || 0;
      cap += goodsCap(s, g); stock += s.stock[g] || 0;
    }
    staff += d.staff || 0;
    s.last = { rev: s.revT || 0, ws: s.wsToday || 0, staff: d.staff || 0, sold, want, cap };
    s.last.profit = s.last.rev - s.last.ws - s.last.staff;
    s.revT = 0; s.wsToday = 0; s.soldT = {}; s.wantT = {};
    // too few customers while the shelves stay full: the shop is on borrowed time
    if (want < cap * 0.22 && stock > cap * 0.7) s.idleDays = (s.idleDays || 0) + 1; else s.idleDays = 0;
    if (s.idleDays === 2) emit('storeWarn', s);
    if (s.idleDays >= 4) { s.closed = true; s.idleDays = 0; closed.push(s); }
  }
  for (const s of closed) { emit('storeClosed', s); footTouch(s); }
  if (closed.length) { G.dirtyNet = true; G.rev++; }
  G.money -= staff; G.today.staff += staff;
}
function reopenCost(b) { return Math.round(B[b.type].cost * 0.25); }
function reopenStore(b) {
  const c = reopenCost(b);
  if (G.money < c) return { ok: false, why: `Reopening costs ${fmtMoney(c)}` };
  spend(c, 'fees');
  b.closed = false; b.idleDays = 0;
  for (const g in B[b.type].goods) { b.stock[g] = 0; b.sat[g] = 1; }
  footTouch(b);
  G.dirtyNet = true; G.rev++;
  return { ok: true };
}

// ---- the Grand Prix ------------------------------------------------------------------------------
function raceSpectators() {
  const beds = [...G.buildings.values()].filter((b) => HOTELS.has(b.type) && b.done).reduce((a, h) => a + bedsOf(h), 0);
  return Math.round(Math.min(40000, 1500 + cityAppeal() * 120 + routeCapacity() * 2 + beds * 4 + G.pop * 0.5));
}
function startRace() {
  if (!G.circuit) {
    const fine = 20000;
    G.money -= fine; G.today.race -= fine;
    G.f1.nextRace = G.day() + F1.every;
    emit('raceCancelled', fine);
    return;
  }
  const specs = raceSpectators();
  G.race = { live: true, specs, t: 0, laps: F1.laps, results: null };
  emit('raceStart', G.race);
}
// called by the race agents when the chequered flag falls
function finishRace(results) {
  const r = G.race; if (!r) return;
  r.live = false; r.results = results;
  const tickets = r.specs * 18, tv = 40000;
  const net = tickets + tv - F1.raceCost;
  G.money += net; G.today.race += net;
  G.f1.lastRace = G.day(); G.f1.nextRace = G.day() + F1.every; G.f1.races = (G.f1.races || 0) + 1;
  G.f1.lastIncome = net; G.f1.lastSpecs = r.specs; G.f1.winner = results[0];
  G.moods.push({ key: 'buzz', v: 6, until: G.day() + 3 });
  G.stats.races = (G.stats.races || 0) + 1;
  G.dirtyHappy = true;
  emit('raceEnd', { net, specs: r.specs, tickets, tv, results });
  G.race = null;
}

// ---- end of day ------------------------------------------------------------------------------------
function countNet() {
  let roads = 0, rails = 0;
  for (let i = 0; i < G.net.length; i++) { if ((G.net[i] & N_ROAD) && !(G.net[i] & N_PORTAL)) roads++; if ((G.net[i] & N_RAIL) && !(G.net[i] & N_PORTAL)) rails++; }
  return { roads, rails };
}
function endOfDay() {
  recomputeAll();
  closeStores();
  const day = G.day();
  // landmark tickets, café terraces and line fares
  let tickets = 0, cafes = 0, fares = 0, running = 0;
  const appeal = cityAppeal();
  for (const b of G.buildings.values()) {
    if (!b.done || b.closed) continue;
    const d = B[b.type];
    if (d.ticket) {
      const visitors = G.tourists.day * (d.appeal || 1) / (appeal + 8) * 1.3 + G.pop * 0.015;
      const r = Math.round(visitors * d.ticket); b.lastRev = r; tickets += r;
    }
    if (d.cafe) {
      let res = 0; for (const h of G.buildings.values()) if (HOUSING.has(h.type) && h.done && distTo(b, h.x, h.y) <= radiusOf(b)) res += h.res;
      const r = Math.round(res * 0.18 * b.lv + G.tourists.day * 0.05 * b.lv); b.lastRev = r; cafes += r;
    }
  }
  for (const l of G.lines.values()) {
    const L = LINE_KIND[l.kind];
    running += l.vehicles * L.run;
    if (l.valid && !L.outside) { const r = Math.round(l.riders * L.fare); l.lastFares = r; fares += r; }
  }
  // upkeep, city services, loan interest
  const { roads, rails } = countNet();
  let upkeep = roads * ECON.roadUpkeep + rails * ECON.railUpkeep;
  for (const s of G.spans.values()) upkeep += 6 + s.len * 3;
  for (const b of G.buildings.values()) if (b.done && !b.closed && B[b.type].upkeep) upkeep += B[b.type].upkeep;
  upkeep += G.busStops.size * B.busstop.upkeep;
  const services = Math.round(G.pop * ECON.services);
  const interest = loanInterest();
  G.money += tickets + cafes + fares - upkeep - services - running - interest;
  Object.assign(G.today, { tourism: G.today.tourism + tickets + cafes, fares, upkeep, services, transit: running, interest });
  // moods expire
  G.moods = G.moods.filter((m) => m.until > day);
  G.dirtyHappy = true; recomputeAll();
  // the moving list
  // happy cities and famous ones attract newcomers; miserable ones scare them away
  const h = G.happy, pop = G.pop;
  let growth;
  if (h >= 0.5) growth = (h - 0.5) * 4 * (12 + pop * 0.12) + appeal * 0.3;
  else if (h >= 0.45) growth = 0.5;
  else growth = -(0.45 - h) * 3 * (6 + G.movingList * 0.3);
  const capL = Math.max(40, pop * 0.6 + 30);
  const before = G.movingList;
  G.movingList = clamp(G.movingList + growth, 0, Math.max(capL, G.movingList));
  // homes: unhappy ones empty out, happy half-empty ones refill from the moving list
  const left = [];
  let movedOut = 0;
  const homes = [...G.buildings.values()].filter((b) => HOUSING.has(b.type) && b.done);
  for (const b of homes) {
    if (b.happy < ABANDON_HOME) b.lowDays = (b.lowDays || 0) + 1; else b.lowDays = 0;
    if (b.lowDays >= 2) {
      const n = Math.min(b.res, Math.ceil(capOf(b) * 0.25));
      b.res -= n; movedOut += n;
      if (b.res <= 0) left.push(b);
      else emit('moveout', { b, n });
    } else if (b.res < capOf(b) && b.happy >= 0.5 && G.movingList >= 1) {
      const n = Math.min(capOf(b) - b.res, Math.floor(G.movingList));
      b.res += n; G.movingList -= n; G.today.movedIn += n;
    }
  }
  for (const b of left) {
    emit('abandon', b);
    for (const o of homes) if (o !== b && Math.abs(o.x - b.x) <= 3 && Math.abs(o.y - b.y) <= 3) o.leftUntil = day + 3;
    removeBuilding(b);
  }
  G.today.movedOut += movedOut;
  if (left.length || movedOut) { G.dirtyNet = true; recomputeAll(); }
  // unrest: protests and dock strikes are announced for tomorrow
  G.unrestDays = G.happy < UNREST && pop > 20 ? (G.unrestDays || 0) + 1 : 0;
  G.strikeDays = G.happy < STRIKE && pop > 20 ? (G.strikeDays || 0) + 1 : 0;
  G.pending = {};
  if (G.unrestDays >= 2 && G.complaints.length) {
    const worst = homes.filter((b) => G.buildings.has(b.id)).sort((a, b) => a.happy - b.happy)[0];
    if (worst) G.pending.protest = { issue: G.complaints[0].k, x: worst.x, y: worst.y };
  }
  if (G.strikeDays >= 2) G.pending.strike = true;
  if (G.pending.protest || G.pending.strike) emit('unrestWarn', G.pending);
  updatePetition(day);
  paperEnsure(true); // the morning paper: ads that have been up too long make way for new ones
  // debt and bankruptcy
  if (G.money < 0) {
    G.debtDays++;
    if (G.debtDays >= ECON.bankruptDays) { G.over = true; emit('gameover', { reason: 'bankrupt' }); }
    else emit('debt', { days: ECON.bankruptDays - G.debtDays });
  } else G.debtDays = 0;
  // ledger
  const T = G.today;
  T.income = T.port + T.stores + T.tourism + T.hotels + T.fares + T.grants + Math.max(0, T.race);
  T.expenses = T.wholesale + T.staff + T.services + T.upkeep + T.transit + T.interest + Math.max(0, -T.race);
  const rec = Object.assign({ day, pop: G.pop, happy: G.happy, list: G.movingList, listGrowth: G.movingList - before, money: G.money, weather: G.weather, left: left.length, tourists: G.tourists.day, guests: G.tourists.guests }, T);
  G.history.push(rec); if (G.history.length > 60) G.history.shift();
  const rnd = mulberry32(G.seed * 31 + day);
  G.forecast = rollWeather(G.weather, rnd);
  emit('dayend', rec);
  newToday();
}

// petitions: the top complaint becomes a demand with a deadline
function updatePetition(day) {
  const p = G.petition;
  if (p) {
    const now = (G.complaints.find((c) => c.k === p.key) || { n: 0 }).n;
    p.now = now;
    if (now <= p.n0 * 0.4) {
      G.moods.push({ key: 'buzz', v: 5, until: day + 5 });
      G.money += p.reward; G.today.grants += p.reward;
      emit('petitionWon', p); G.petition = null;
    } else if (day >= p.deadline) {
      G.moods.push({ key: 'grudge', v: -5, until: day + 4 });
      emit('petitionLost', p); G.petition = null;
    }
    return;
  }
  if (G.pop < 30 || G.lastPetition && day - G.lastPetition < 2) return;
  const top = G.complaints.find((c) => c.n >= G.pop * 0.15 && !['storm', 'rain', 'left', 'grudge', 'strike', 'raceNoise', 'broke'].includes(c.k));
  if (!top) return;
  G.petition = { key: top.k, n0: top.n, now: top.n, deadline: day + 4, reward: Math.round(300 + G.pop * 1.5) };
  G.lastPetition = day;
  emit('petition', G.petition);
}

// ---- events to the UI ---------------------------------------------------------------------------------
const LISTENERS = {};
function on(ev, fn) { (LISTENERS[ev] = LISTENERS[ev] || []).push(fn); }
function emit(ev, data) { for (const fn of LISTENERS[ev] || []) fn(data); }
