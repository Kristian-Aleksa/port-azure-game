// ---------------------------------------------------------------------------
// Interface: HUD, build dock and drawers, info panel, town talk, petitions,
// goals, toasts, banners and hover tooltips.
// ---------------------------------------------------------------------------
const UI = { drawer: null, tipText: null, lastRefresh: 0, bubbleT: 0, thumbs: {}, modal: null };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// data attributes for the hover tooltip: title, description and an optional key
const tipAttr = (title, desc = '', key = '') => `data-tip="${esc(title)}"${desc ? ` data-desc="${esc(desc)}"` : ''}${key ? ` data-key="${esc(key)}"` : ''} aria-label="${esc(title)}"`;

function initUI() {
  const ui = $('ui');
  ui.innerHTML = `
  <header class="hud">
    <section class="card city" aria-label="City">
      <input id="cityName" class="city-name" value="${esc(G.name)}" maxlength="24" aria-label="City name" spellcheck="false">
      <div class="lvl"><span class="badge" id="lvlName">Hamlet</span><span><b id="popNum">0</b> residents</span></div>
      <div class="bar" aria-hidden="true"><i id="popBar"></i></div>
      <div class="next" id="nextLvl"></div>
    </section>
    <section class="card clock" aria-label="Time and weather">
      <div class="row"><span class="day">Day <b id="dayNum">1</b></span><span class="time" id="clockTime">06:00</span><span class="wx" id="wx"></span></div>
      <div class="row speeds" role="group" aria-label="Game speed">
        <button id="sp0" ${tipAttr('Pause', 'Stop the clock. You can still build.', 'Space')}>${icon('pause')}</button>
        <button id="sp1" ${tipAttr('Normal speed', 'A day lasts about a minute.', ',')}>${icon('play')}</button>
        <button id="sp2" ${tipAttr('Fast', 'Twice as fast.')}>${icon('fast')}</button>
        <button id="sp3" ${tipAttr('Fastest', 'Four times as fast.', '.')}>${icon('faster')}</button>
        <span class="ship" id="shipEta"></span>
      </div>
    </section>
    <section class="card money" aria-label="Treasury" id="moneyCard" ${tipAttr('Treasury', 'Click for the finances: income, costs, loans and taxes.', 'F')}>
      <div class="cash" id="money">$0</div>
      <div class="sub" id="moneySub">&nbsp;</div>
    </section>
  </header>
  <section class="card stats" aria-label="City stats">
    <div class="stat" ${tipAttr('Happiness', 'Average happiness of residents. Below 45% the town protests; below 40% the docks strike and people start moving out.')}><span class="lab">${icon('smile')} Happiness</span><b id="happyNum">0%</b><div class="meter"><i id="happyBar"></i></div></div>
    <div class="stat" ${tipAttr('Moving list', 'People waiting to move in. New homes need this many people ready. It only grows while residents are happy.')}><span class="lab">${icon('list')} Moving list</span><b id="listNum">0</b><span class="delta" id="listDelta"></span></div>
    <div class="stat" ${tipAttr('Harbour load', 'Residents the harbour can serve. Over 100% the ship cannot pay for everyone.')}><span class="lab">${icon('anchor')} Harbour load</span><b id="portNum">0%</b><div class="meter"><i id="portBar"></i></div></div>
    <div class="stat" ${tipAttr('Delivery trucks', 'Trucks that restock shops each morning: harbour, road tunnel and rail freight. One truck restocks one shop.')}><span class="lab">${icon('truck')} Trucks</span><b id="truckNum">0</b><span class="delta" id="truckDelta"></span></div>
    <div class="stat" id="tourStat" ${tipAttr('Tourists', 'Day visitors arriving on your intercity routes, and hotel guests staying the night.')}><span class="lab">${icon('camera')} Tourists</span><b id="tourNum">0</b><span class="delta" id="tourDelta"></span></div>
    <div class="stat" id="f1Stat" hidden ${tipAttr('Grand Prix', 'Days until the next race on your circuit.')}><span class="lab">${icon('flag')} Grand Prix</span><b id="f1Num">-</b></div>
    <div class="links" id="links"></div>
  </section>
  <aside class="side">
    <section class="card petition" id="petition" hidden aria-live="polite"></section>
    <section class="card talk" aria-label="Town talk"><h2>Town talk</h2><ul id="talk"></ul></section>
    <section class="card goals" aria-label="Goals"><h2>Harbourmaster's notes</h2><div id="goal"></div></section>
  </aside>
  <section class="card info" id="info" hidden aria-live="polite"></section>
  <nav class="dock" aria-label="Build">
    <div class="drawer" id="drawer" hidden></div>
    <div class="active-tool" id="activeTool" hidden></div>
    <div class="toolbar">
      <div class="group cats" id="cats">
        ${CATS.map((c) => `<button class="cat" data-cat="${c.id}" ${tipAttr(c.name, c.tip, c.key)}>${icon(c.icon)}<span>${c.name}</span></button>`).join('')}
      </div>
      <div class="group tools">
        <button class="tool" data-tool="inspect" ${tipAttr('Inspect', 'Click buildings, roads and stops to see details and actions.', 'I')}>${icon('cursor')}<span>Inspect</span></button>
        <button class="tool" data-tool="move" ${tipAttr('Move', 'Pick up a building and put it on another plot, for a quarter of its price.', 'M')}>${icon('move')}<span>Move</span></button>
        <button class="tool" data-tool="demolish" ${tipAttr('Demolish', 'Remove buildings, roads, bridges and stops for a fee. Drag over roads.', 'X')}>${icon('bulldoze')}<span>Demolish</span></button>
      </div>
      <div class="group view">
        <button id="btnRotate" ${tipAttr('Rotate view', 'Turn the city a quarter.', 'Q / E')}>${icon('rotate')}</button>
        <button id="btnZoomOut" ${tipAttr('Zoom out', '', '−')}>${icon('minus')}</button>
        <button id="btnZoomIn" ${tipAttr('Zoom in', '', '+')}>${icon('plus')}</button>
        <button id="btnRanges" ${tipAttr('Ranges', 'Show the radius of every shop, park, landmark, stop and tourist centre.', 'G')}>${icon('ranges')}</button>
        <button id="btnHappy" ${tipAttr('Happiness map', 'Colour homes by how happy they are.', 'H')}>${icon('smile')}</button>
        <button id="btnTransit" ${tipAttr('Transit map', 'Show your lines and which homes have a stop within walking distance.', 'T')}>${icon('route')}</button>
        <button id="btnMenu" ${tipAttr('Menu', 'Save, load, finances, settings and help.', 'Esc')}>${icon('menu')}</button>
      </div>
    </div>
  </nav>
  <div id="raceHud" class="card race" hidden></div>
  <div id="toasts" aria-live="polite"></div>
  <div id="banner" hidden></div>
  <div id="tip" hidden></div>
  <div id="tooltip" role="tooltip" hidden></div>
  <div id="modal" class="modal" hidden></div>
  <div id="title" class="title-screen"></div>`;

  $('cityName').addEventListener('change', (e) => { G.name = e.target.value.trim() || 'Port Azur'; });
  $('cityName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  for (let i = 0; i < 4; i++) $('sp' + i).addEventListener('click', () => uiSetSpeed(i));
  document.querySelectorAll('.cat').forEach((b) => b.addEventListener('click', () => uiOpenDrawer(b.dataset.cat, true)));
  document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => { uiCloseDrawer(); setTool(b.dataset.tool); }));
  $('btnRotate').addEventListener('click', rotateView);
  $('btnZoomIn').addEventListener('click', () => zoomAt(1, innerWidth / 2, innerHeight / 2));
  $('btnZoomOut').addEventListener('click', () => zoomAt(-1, innerWidth / 2, innerHeight / 2));
  $('btnRanges').addEventListener('click', uiToggleRanges);
  $('btnHappy').addEventListener('click', () => uiToggleOverlay('happy'));
  $('btnTransit').addEventListener('click', () => uiToggleOverlay('transit'));
  $('btnMenu').addEventListener('click', () => uiOpenMenu());
  $('moneyCard').addEventListener('click', () => uiOpenMenu('finance'));
  initTooltips();
  bindEvents();
  uiSetSpeed(G.speed);
  uiToolChanged();
  refreshHUD();
  showTitle();
}

function bindEvents() {
  on('levelup', (d) => { banner(LEVELS[d.level].name, d.unlocks); sfx('level'); if (UI.drawer) renderDrawer(); });
  on('cash', (d) => addFx({ kind: 'text', x: d.x, y: d.y + 0.5, text: '+' + fmtMoney(d.amount), h: d.kind === 'port' ? 60 : 50, size: d.kind === 'port' ? 26 : 18, life: 2600, color: d.kind === 'hotel' ? '#ffb3e0' : '#ffd75a' }));
  on('unload', (d) => {
    sfx('coin');
    if (d.strike) uiToast('Dock strike: the ship paid half and no harbour trucks ran today.', 'bad');
    else if (d.storm) uiToast('The storm slowed the ship. It paid 25% less.', 'warn');
    if (d.full) uiToast('The harbour is over capacity. Upgrade it or build a new one to earn from everyone.', 'warn');
  });
  on('sail', () => { if (G.speed) sfx('horn'); spawnShips(); });
  on('trucks', (dels) => { spawnTrucks(dels); const s = G.supply; if (s && s.short) uiToast(`${s.short} shop${s.short > 1 ? 's' : ''} got no delivery truck this morning. Link the road tunnel, add rail freight or upgrade the harbour.`, 'warn', 6000); });
  on('coin', (s) => { if (Math.random() < 0.3) addFx({ kind: 'coin', x: s.x, y: s.y, seed: Math.random() * 6, life: 900 }); });
  on('built', (b) => { addFx({ kind: 'dust', x: b.x, y: b.y, seed: 1, life: 700 }); if (HOUSING.has(b.type)) addFx({ kind: 'text', x: b.x + 0.5, y: b.y + 0.5, text: `+${b.res} residents`, color: '#9fe8ff', size: 20, h: 50 }); });
  on('abandon', (b) => { uiToast(`The last residents left a ${B[b.type].name}. The plot is empty again.`, 'bad'); sfx('bad'); addFx({ kind: 'dust', x: b.x, y: b.y, seed: 2, life: 1200 }); });
  on('moveout', (d) => addFx({ kind: 'text', x: d.b.x + 0.5, y: d.b.y + 0.5, text: `-${d.n} moved away`, color: '#ff8a6a', size: 18, h: 50, life: 3000 }));
  on('weather', (w) => { if (w === 'heat') uiToast('Heatwave! Pools and beach clubs keep their neighbours cool.', 'warn'); if (w === 'storm') uiToast('Storm warning: the ship will be slow and pay less today.', 'warn'); if (w === 'rain') uiToast('A rare rainy day. Residents without a stop nearby are grumpy.', 'warn'); });
  on('strike', () => { uiToast('<b>Dock strike!</b> Unhappy dockers walked out: no harbour trucks today and the ship pays half.', 'bad', 7000); sfx('bad'); });
  on('protest', (p) => { spawnProtest(p); uiToast(`<b>Protest in the streets</b> about ${esc(COMPLAINT_NAME[p.issue] || p.issue)}. Shops sell less today. Fix it: ${esc(FIX[p.issue] || '')}.`, 'bad', 8000); sfx('bad'); centerHint(p.x, p.y); });
  on('unrestWarn', (p) => uiToast(`${p.strike ? 'The dockers vote to strike tomorrow. ' : ''}${p.protest ? 'Residents are organising a protest for tomorrow. ' : ''}Raise happiness to stop it.`, 'bad', 7000));
  on('petition', (p) => { uiToast(`<b>Petition:</b> ${fmtNum(p.n0)} residents demand action on ${esc(COMPLAINT_NAME[p.key] || p.key)}. You have 4 days.`, 'warn', 7000); sfx('err'); });
  on('petitionWon', (p) => { uiToast(`<b>Petition answered!</b> Residents are delighted. +${fmtMoney(p.reward)} civic grant and a happiness boost.`, 'good', 6000); sfx('coin'); });
  on('petitionLost', (p) => { uiToast(`<b>Petition ignored.</b> Residents hold a grudge: happiness down for a few days.`, 'bad', 6000); sfx('bad'); });
  on('storeWarn', (s) => uiToast(`${B[s.type].name} has too few customers and full shelves. It closes in 2 days unless more homes are in its radius.`, 'warn', 6500));
  on('storeClosed', (s) => { uiToast(`${B[s.type].name} closed down: not enough customers. Reopen it later or demolish it.`, 'bad', 6500); sfx('bad'); });
  on('debt', (d) => { uiToast(`<b>The treasury is in the red.</b> ${d.days} day${d.days > 1 ? 's' : ''} until the bank takes over the city. Borrow, cut costs or earn fast.`, 'bad', 8000); sfx('bad'); });
  on('gameover', () => showGameOver());
  on('tourists', (n) => { if (n > 0 && !UI.tourT) { UI.tourT = 1; uiToast(`${fmtNum(n)} tourists arrived today. They shop, buy tickets and fill the hotels.`, 'good'); } });
  on('raceday', () => { uiToast('<b>Grand Prix today!</b> The race starts at 14:00. Fans are lining the circuit.', 'good', 7000); updateOverlay(); IN.raceFollow = true; });
  on('raceStart', () => { raceStart(); sfx('race'); uiSetSpeed(Math.max(1, G.speed)); if (G.circuit) { const [x, y] = kc(G.circuit.tiles[0]); centerOnTile(x, y); } });
  on('raceEnd', (d) => { $('raceHud').hidden = true; uiToast(`<b>${esc(d.results[0])} wins the Grand Prix!</b> ${fmtNum(d.specs)} fans · tickets ${fmtMoney(d.tickets)} + TV ${fmtMoney(d.tv)} − costs ${fmtMoney(F1.raceCost)} = <b>${fmtMoney(d.net)}</b>`, 'good', 9000); sfx('level'); });
  on('raceCancelled', (fine) => { uiToast(`<b>Grand Prix cancelled:</b> no circuit. The organisers fined you ${fmtMoney(fine)}. Design one from the Landmarks menu.`, 'bad', 8000); sfx('bad'); });
  on('circuitBroken', () => uiToast('You removed part of the Grand Prix circuit. Design a new one before race day.', 'warn', 6000));
  on('dayend', (rec) => {
    const net = rec.income - rec.expenses;
    const lg = Math.round(rec.listGrowth);
    uiToast(`<b>Day ${rec.day} closed.</b> Income ${fmtMoney(rec.income)} · costs ${fmtMoney(rec.expenses)} · <b class="${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${fmtMoney(net)}</b> · moving list ${lg >= 0 ? '+' : ''}${lg}`, 'day', 6500);
    checkGoals();
    if (SETTINGS.autosave) saveGame('auto');
  });
}
const COMPLAINT_NAME = { noRoad: 'homes without road access', noGroceries: 'no grocer nearby', noClothes: 'no clothes shop nearby', noUtilities: 'no hardware store nearby', emptyShelves: 'empty shelves', noPark: 'no parks', heat: 'the heat', noTransit: 'no public transport', packed: 'packed buses and trains', rain: 'the rain', storm: 'the storm', portNoise: 'harbour noise', noise: 'noise', crowded: 'overcrowding', portFull: 'an overloaded harbour', tourists: 'too many tourists', taxes: 'high taxes', broke: 'service cuts', left: 'neighbours leaving', strike: 'the strike', grudge: 'being ignored', raceNoise: 'race noise' };
function centerHint(x, y) { UI.hint = { x, y, t: performance.now() }; }

// ---- HUD -----------------------------------------------------------------------------------------
function refreshHUD() {
  const m = G.minute();
  $('dayNum').textContent = G.day();
  $('clockTime').textContent = fmtTime(m);
  const w = G.weather, f = G.forecast;
  const wxKey = w + '|' + f;
  if (UI.wxKey !== wxKey) { UI.wxKey = wxKey; $('wx').innerHTML = `<span ${tipAttr(WEATHER[w].name, `Tomorrow: ${WEATHER[f].name.toLowerCase()}.`)}>${icon(w)}</span><span>${WEATHER[w].name}</span><small>tomorrow ${WEATHER[f].name.toLowerCase()}</small>`; }
  const mEl = $('money');
  mEl.textContent = fmtMoney(G.money);
  mEl.classList.toggle('neg', G.money < 0);
  const last = G.history[G.history.length - 1];
  const td = G.today;
  const tIn = td.port + td.stores + td.tourism + td.hotels + td.fares + td.grants + Math.max(0, td.race);
  const tOut = td.wholesale + td.staff + td.upkeep + td.services + td.transit + td.interest;
  let sub = '';
  if (G.money < 0) sub = `<span class="neg">In debt · ${ECON.bankruptDays - G.debtDays} days to bankruptcy</span>`;
  else if (last) sub = `Yesterday <b class="${last.income - last.expenses >= 0 ? 'pos' : 'neg'}">${last.income - last.expenses >= 0 ? '+' : ''}${fmtMoney(last.income - last.expenses)}</b>`;
  else sub = 'First ship docks at 08:00';
  if (G.loan) sub += ` · loan ${fmtMoney(G.loan)}`;
  if (UI.moneySub !== sub) { UI.moneySub = sub; $('moneySub').innerHTML = sub; }
  const lv = G.level, nx = LEVELS[lv + 1];
  $('lvlName').textContent = LEVELS[lv].name;
  $('popNum').textContent = fmtNum(G.pop);
  $('popBar').style.width = (nx ? clamp((G.pop - LEVELS[lv].pop) / (nx.pop - LEVELS[lv].pop), 0, 1) * 100 : 100) + '%';
  $('nextLvl').textContent = nx ? `${nx.name} at ${fmtNum(nx.pop)}` : 'Long live the Principality';
  const hp = Math.round(G.happy * 100);
  $('happyNum').textContent = hp + '%';
  const hb = $('happyBar'); hb.style.width = hp + '%'; hb.dataset.level = hp >= 65 ? 'good' : hp >= 50 ? 'ok' : hp >= 40 ? 'low' : 'bad';
  $('listNum').textContent = fmtNum(Math.floor(G.movingList));
  $('listDelta').textContent = last ? `${last.listGrowth >= 0 ? '+' : ''}${Math.round(last.listGrowth)}/day` : '';
  const cap = portCap(), load = cap ? G.effPop / cap : 0;
  $('portNum').textContent = Math.round(load * 100) + '%';
  const pb = $('portBar'); pb.style.width = clamp(load, 0, 1) * 100 + '%'; pb.dataset.level = load > 1 ? 'bad' : load > 0.85 ? 'low' : 'good';
  const totalTrucks = NET.sources.reduce((a, s) => a + (G.strike && s.kind === 'port' ? 0 : s.trucks), 0);
  const nShops = liveStores().length;
  $('truckNum').textContent = `${Math.min(nShops, totalTrucks)}/${nShops}`;
  $('truckDelta').textContent = G.supply && G.supply.short ? `${G.supply.short} shop${G.supply.short > 1 ? 's' : ''} missed a delivery` : `${totalTrucks} trucks each morning`;
  $('truckDelta').classList.toggle('neg', !!(G.supply && G.supply.short));
  const tour = G.tourists;
  $('tourStat').hidden = !(tour.cap || tour.day || tour.beds);
  $('tourNum').textContent = fmtNum(tour.day);
  $('tourDelta').textContent = `${fmtNum(tour.guests || 0)} in hotels${tour.turnedAway ? ` · ${fmtNum(tour.turnedAway)} turned away` : ''}`;
  const f1 = G.f1 && G.f1.licensed;
  $('f1Stat').hidden = !f1;
  if (f1) $('f1Num').textContent = G.race ? 'Racing!' : isRaceDay() ? 'Today 14:00' : `${G.f1.nextRace - G.day()} days`;
  const L = G.links;
  const linksHtml = [
    ['road', 'Road tunnel', L.road, `adds ${TUNNEL_TRUCKS} delivery trucks every morning`],
    ['train', 'Rail freight', L.rail, `adds ${FREIGHT_TRUCKS} delivery trucks every morning`],
    ['bus', 'Intercity coaches', [...G.lines.values()].some((l) => l.kind === 'coach' && l.valid && l.tourOk), 'brings day tourists'],
    ['globe', 'Intercity rail', [...G.lines.values()].some((l) => l.kind === 'irail' && l.valid && l.tourOk), 'brings many tourists'],
  ].map(([ic, name, onn, why]) => `<span class="link ${onn ? 'on' : ''}" ${tipAttr(`${name}: ${onn ? 'connected' : 'not connected'}`, why[0].toUpperCase() + why.slice(1) + '.')}>${icon(ic)}</span>`).join('');
  if (UI.linksHtml !== linksHtml) { UI.linksHtml = linksHtml; $('links').innerHTML = linksHtml; }
  $('shipEta').textContent = G.strike ? 'Dock strike today' : m < 360 ? 'Ship sails 06:00' : m < 480 ? 'Ship arriving' : m < 540 ? 'Unloading…' : m < 630 ? 'Ship docked' : m < 760 ? 'Ship departing' : 'Next ship 06:00';
  refreshPetition();
  refreshRaceHud();
}
const TALK_ICON = { road: 'road', cart: 'cart', shirt: 'shirt', bulb: 'bulb', box: 'warn', tree: 'leaf', sun: 'heat', bus: 'bus', crowd: 'people', rain: 'rain', storm: 'storm', noise: 'sound', ship: 'ship', camera: 'camera', coin: 'coin', home: 'home', fist: 'fist', flag: 'flag' };
function refreshTalk() {
  const list = [];
  const pick = (arr, seed) => arr[Math.floor(hash2(seed, G.day()) * arr.length)];
  for (const c of G.complaints.slice(0, 4)) list.push(`<li class="bad">${icon(TALK_ICON[ICON[c.k]] || 'frown')}<div><q>${esc(pick(SAY[c.k] || ['…'], c.k.length))}</q><small>${fmtNum(c.n)} residents · ${esc(FIX[c.k] || '')}</small></div></li>`);
  for (const p of G.praise.slice(0, 4 - Math.min(3, list.length))) list.push(`<li class="good">${icon('smile')}<div><q>${esc(pick(PRAISE[p.k], p.k.length + 3))}</q><small>${fmtNum(p.n)} residents</small></div></li>`);
  if (!list.length) list.push('<li class="quiet"><div><q>All quiet on the waterfront.</q></div></li>');
  const html = list.join('');
  if (UI.talkHtml !== html) { UI.talkHtml = html; $('talk').innerHTML = html; }
}
function refreshPetition() {
  const p = G.petition, el = $('petition');
  if (!p) { el.hidden = true; return; }
  const left = p.deadline - G.day();
  const prog = clamp(1 - (p.now - p.n0 * 0.4) / (p.n0 * 0.6), 0, 1);
  const html = `<h2>${icon('petition')} Petition</h2><p>${fmtNum(p.n0)} residents demand action on <b>${esc(COMPLAINT_NAME[p.key] || p.key)}</b>.</p><p class="muted">${esc(FIX[p.key] || '')}</p>
    <div class="meter"><i style="width:${Math.round(prog * 100)}%"></i></div><p class="small">${fmtNum(p.now)} still upset · fix it for ${left <= 0 ? 'today' : `${left} day${left > 1 ? 's' : ''}`} · reward ${fmtMoney(p.reward)}</p>`;
  if (UI.petHtml !== html) { UI.petHtml = html; el.innerHTML = html; }
  el.hidden = false;
}

// ---- speed, tools, drawer ------------------------------------------------------------------------------
function uiSetSpeed(i) {
  G.speed = i; if (i) IN.lastSpeed = i;
  for (let k = 0; k < 4; k++) $('sp' + k).classList.toggle('on', k === i);
}
function uiToolChanged() {
  const at = $('activeTool');
  if (at) {
    let html = '';
    if (IN.tool === 'build') {
      const d = B[IN.type], pl = d.place;
      const how = pl === 'drag' ? ' per tile · drag to build' : pl === 'span' ? ' per tile · drag from end to end' : pl === 'terra' ? ' per plot · click or drag a rectangle' : pl === 'line' ? (LINE_KIND[d.line].outside ? ' · click a stop near a Tourist Centre' : ' · click stops in order, then Enter') : '';
      html = `<img class="th" alt="" src="${thumb(IN.type)}"><span><b>${esc(d.name)}</b> · ${fmtMoney(pl === 'line' ? newLineCost(d.line, LINE_KIND[d.line].outside ? 2 : 2) : d.cost)}${how}</span>${pl === 'line' && !LINE_KIND[d.line].outside ? '<button class="mini" id="finishDraft">Finish line</button>' : ''}<button class="x" aria-label="Stop building">×</button>`;
    } else if (IN.tool === 'circuit') html = `<span><b>Grand Prix circuit</b> · click road tiles around a loop, then click the first one again · ${fmtMoney(F1.tileFee)} per tile</span><button class="mini" id="finishDraft">Build circuit</button><button class="x" aria-label="Stop">×</button>`;
    else if (IN.tool === 'demolish' || IN.tool === 'move') html = `<span><b>${IN.tool === 'demolish' ? 'Demolish' : 'Move'}</b> · ${IN.tool === 'demolish' ? 'click or drag over what to remove' : 'pick a building, then a new plot'}</span><button class="x" aria-label="Stop">×</button>`;
    at.innerHTML = html; at.hidden = !html;
    if (html) at.querySelector('.x').addEventListener('click', () => setTool('inspect'));
    const fd = $('finishDraft'); if (fd) fd.addEventListener('click', finishDraft);
  }
  document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', IN.tool === b.dataset.tool));
  document.querySelectorAll('.card-b').forEach((c) => c.classList.toggle('on', IN.tool === 'build' && IN.type === c.dataset.type));
  document.body.dataset.tool = IN.tool;
}
function uiToggleOverlay(k) {
  IN.overlay = IN.overlay === k ? null : k;
  $('btnHappy').classList.toggle('on', IN.overlay === 'happy');
  $('btnTransit').classList.toggle('on', IN.overlay === 'transit');
  updateOverlay();
}
function uiToggleRanges() { R.ranges = !R.ranges; $('btnRanges').classList.toggle('on', R.ranges); updateOverlay(); }
function uiCloseDrawer() { UI.drawer = null; $('drawer').hidden = true; document.querySelectorAll('.cat').forEach((b) => b.classList.remove('on')); }
function uiOpenDrawer(cat, toggle) {
  if (toggle && UI.drawer === cat) { uiCloseDrawer(); return; }
  UI.drawer = cat;
  document.querySelectorAll('.cat').forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
  renderDrawer();
  $('drawer').hidden = false;
}
const goodsName = (g) => GOODS[g].name.toLowerCase();
function statLine(t) {
  const d = B[t];
  if (d.cap) return `${d.cap[0]} residents${d.spend ? ' · rich' : ''}`;
  if (d.goods && d.cat === 'shops') return `${Object.keys(d.goods).map(goodsName).join(' + ')} · r${lvAt(d.radius, 1)}`;
  if (d.beds) return `${d.beds[0]} beds · ${fmtMoney(d.rate)}/night`;
  if (d.line) return LINE_KIND[d.line].outside ? `${LINE_KIND[d.line].seats * LINE_KIND[d.line].trips} visitors/day` : `${fmtMoney(LINE_KIND[d.line].run)}/day per vehicle`;
  if (d.joy) return `+${(lvAt(d.joy, 1) * 6).toFixed(0)} joy · r${lvAt(d.radius, 1)}${d.heat ? ' · cools' : ''}`;
  if (d.place === 'drag') return 'per tile · drag';
  if (d.place === 'span') return 'per tile · straight';
  if (d.place === 'terra') return 'per plot';
  if (t === 'port') return '5 beach tiles';
  if (d.radius) return `radius ${lvAt(d.radius, 1)}`;
  return d.upkeep ? `upkeep ${fmtMoney(d.upkeep)}/day` : '';
}
function tipFor(t) {
  const d = B[t], parts = [d.desc];
  if (d.cap) parts.push(`Homes ${d.cap.join(' / ')} residents by level. Needs ${d.cap[0]} people on the moving list.`);
  if (d.goods && d.cat === 'shops') parts.push(`Sells ${Object.keys(d.goods).map((g) => `${goodsName(g)} at ${fmtMoney(d.price[g])}`).join(', ')}. Stock ${Object.values(d.goods).map((a) => a[0]).join(' + ')}. Radius ${lvAt(d.radius, 1)}. Staff ${fmtMoney(d.staff)}/day.`);
  if (d.joy && !d.goods) parts.push(`Happiness +${(lvAt(d.joy, 1) * 6).toFixed(0)} at the centre of a ${lvAt(d.radius, 1)}-tile radius.${d.appeal ? ` Tourist appeal ${d.appeal}.` : ''}${d.ticket ? ` Tickets ${fmtMoney(d.ticket)}.` : ''}`);
  if (d.beds) parts.push(`${d.beds[0]} beds at ${fmtMoney(d.rate)} a night.`);
  if (d.upkeep) parts.push(`Upkeep ${fmtMoney(d.upkeep)}/day.`);
  if (d.size) parts.push(`Footprint ${d.size[0]}×${d.size[1]} plots.`);
  return parts.join(' ');
}
function thumb(t) {
  if (UI.thumbs[t]) return UI.thumbs[t];
  const W = 116, H = 80;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  const d = B[t];
  let sp = null;
  if (d.place === 'drag' || d.span || t === 'busline' || t === 'trainline' || t === 'coach' || t === 'irail' || d.terra || t === 'f1') {
    const ic = { road: 'road', rail: 'train', rtunnel: 'tunnel', ttunnel: 'tunnel', rbridge: 'bridge', tbridge: 'bridge', busline: 'route', trainline: 'route', coach: 'bus', irail: 'globe', raise: 'raise', lower: 'lower', f1: 'flag' }[t] || 'help';
    const img = new Image();
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(iconSvg(ic).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" '));
    return (UI.thumbs[t] = img.src);
  }
  if (t === 'busstop') sp = renderModel(mBusStop(2), 0, {});
  else if (t === 'station') sp = renderModel(mStationPart(0), 0, {});
  else if (t === 'port') sp = renderModel(mPort(0, 0), 0, {});
  else sp = renderModel(MODEL_FN[t](1, 1), 0, { seed: 3 });
  let s = 1;
  if (sp.w * 2 <= W && sp.h * 2 <= H) s = 2;
  else if (sp.w > W || sp.h > H) s = 0.5;
  const dw = Math.floor(sp.w * s), dh = Math.floor(sp.h * s);
  x.drawImage(sp.cv, 0, 0, sp.w, sp.h, Math.floor((W - dw) / 2), H - dh, dw, dh);
  return (UI.thumbs[t] = cv.toDataURL());
}
const DRAWER_TEXT = {
  housing: 'Homes need people on the moving list and a road on the same level. Each resident pays into the morning ship.',
  shops: 'Shops sell to homes inside their radius (or along a line). Trucks restock one shop each morning. Too few customers and a shop closes.',
  leisure: 'Each kind helps differently: parks calm crowds, cafés earn, pools cool heatwaves, beach clubs draw tourists but are loud.',
  landmark: 'The biggest happiness boost in a wide radius, ticket income from visitors, and a big tourist draw. Expensive to run.',
  tourism: 'Build a Tourist Centre, then an intercity route to a stop inside its radius. Hotels let visitors stay the night.',
  transport: 'Drag roads and rails. Stops do nothing until you create a line. Tunnels go through high ground, bridges over low ground.',
  terrain: 'Raise or lower empty plots one level at a time. Roads climb one level per tile with a ramp. Higher homes get better sea views.',
  port: 'The harbour pays for every resident it can serve and sends delivery trucks. Upgrades and new harbours are big projects.',
};
function renderDrawer() {
  const cat = UI.drawer; if (!cat) return;
  const types = B_ORDER.filter((k) => B[k].cat === cat);
  let html = `<div class="drawer-head"><h2>${icon(CATS.find((c) => c.id === cat).icon)} ${CATS.find((c) => c.id === cat).name}</h2><span>${DRAWER_TEXT[cat]}</span></div><div class="cards">`;
  for (const t of types) {
    const d = B[t];
    let lock = !unlocked(t), extra = '';
    if (t === 'f1' && G.f1 && G.f1.licensed) {
      html += `<button class="card-b special" data-act="circuit" ${tipAttr('Design the circuit', 'Click road tiles around a loop of streets. Kerbs and barriers cost ' + fmtMoney(F1.tileFee) + ' per tile.')}><img class="th" alt="" src="${thumb('f1')}"><span class="nm">Design circuit</span><span class="st">${G.circuit ? `${new Set(G.circuit.tiles).size} tiles` : 'no circuit yet'}</span><span class="co">${G.f1.nextRace - G.day()} days</span></button>`;
      continue;
    }
    if (d.line && LINE_KIND[d.line].outside && !lock && !countType('tourist')) extra = 'needs a Tourist Centre';
    const cost = d.line ? newLineCost(d.line, 2) : d.cost;
    html += `<button class="card-b ${lock ? 'locked' : ''}" data-type="${t}" ${lock ? 'aria-disabled="true"' : ''} ${tipAttr(d.name, tipFor(t) + (lock ? ` Unlocks at ${LEVELS[d.lvl].name}.` : ''))}>
      <img class="th" alt="" src="${thumb(t)}"><span class="nm">${esc(d.name)}</span><span class="st">${esc(extra || statLine(t))}</span>
      <span class="co">${lock ? `${icon('lock')} ${LEVELS[d.lvl].name}` : fmtMoney(cost)}</span></button>`;
  }
  if (cat === 'port') {
    const ports = [...G.buildings.values()].filter((b) => b.type === 'port');
    html += `<div class="note">${ports.map((p, i) => `<button class="mini" data-port="${p.id}">Harbour ${i + 1}: ${PORT_LV[p.plv].name}</button>`).join('')}<span>Select a harbour to see upgrades.</span></div>`;
  }
  html += '</div>';
  if (cat === 'transport' || cat === 'tourism') html += linesPanel(cat === 'tourism');
  $('drawer').innerHTML = html;
  $('drawer').querySelectorAll('.card-b[data-type]').forEach((c) => c.addEventListener('click', () => {
    const t = c.dataset.type, d = B[t];
    if (!unlocked(t)) { uiToast(`${d.name} unlocks at ${LEVELS[d.lvl].name} (${fmtNum(LEVELS[d.lvl].pop)} residents).`, 'warn'); return; }
    if (t === 'f1') { const r = buyLicence(); if (!r.ok) return fail(r.why); sfx('level'); uiToast(`<b>Grand Prix licence bought!</b> Now design a circuit on your streets. First race in ${F1.every} days.`, 'good', 7000); renderDrawer(); setTool('circuit'); return; }
    if (d.line && LINE_KIND[d.line].outside && !countType('tourist')) { uiToast('Build a Tourist Centre first: the route must end at a stop inside its radius.', 'warn'); return; }
    setTool('build', t); sfx('click'); uiCloseDrawer();
  }));
  const cb = $('drawer').querySelector('[data-act="circuit"]');
  if (cb) cb.addEventListener('click', () => { setTool('circuit'); uiCloseDrawer(); });
  $('drawer').querySelectorAll('[data-port]').forEach((c) => c.addEventListener('click', () => { const b = G.buildings.get(+c.dataset.port); setTool('inspect'); select(b); centerOnTile(b.x + 2.5, b.y); }));
  bindLineButtons($('drawer'));
  uiToolChanged();
}
function linesPanel(outside) {
  const lines = [...G.lines.values()].filter((l) => !!LINE_KIND[l.kind].outside === outside);
  if (!lines.length) return '';
  return `<div class="lines"><h3>${outside ? 'Intercity routes' : 'Your lines'}</h3>${lines.map(lineRow).join('')}</div>`;
}
function lineRow(l) {
  const L = LINE_KIND[l.kind], cap = lineCapacity(l);
  const stat = !l.valid ? `<span class="neg">${esc(l.why || 'Broken')}</span>` : L.outside ? (l.tourOk ? `${fmtNum(cap)} visitors/day` : `<span class="neg">${esc(l.why)}</span>`) : `${fmtNum(Math.round(l.riders || 0))} riders · ${Math.round((l.load || 0) * 100)}% full · fares ${fmtMoney(l.lastFares || 0)}`;
  return `<div class="line-row"><i class="sw" style="background:${l.color}"></i><span class="nm">${esc(l.name)}</span><span class="st">${l.stops.length - (L.outside ? 1 : 0)} stop${l.stops.length - (L.outside ? 1 : 0) > 1 ? 's' : ''} · ${stat}</span>
    <span class="veh">${l.vehicles} ${esc(L.vehicle.toLowerCase())}${l.vehicles > 1 ? 's' : ''} · ${fmtMoney(l.vehicles * L.run)}/day</span>
    <button class="mini" data-line="${l.id}" data-d="-1" ${tipAttr('Remove a vehicle', `Sell one ${L.vehicle.toLowerCase()} back for ${fmtMoney(Math.round(L.buy * 0.3))}.`)}>−</button>
    <button class="mini" data-line="${l.id}" data-d="1" ${tipAttr('Add a vehicle', `Buy another ${L.vehicle.toLowerCase()} for ${fmtMoney(L.buy)}. Running cost ${fmtMoney(L.run)}/day.`)}>+</button>
    <button class="mini danger" data-line="${l.id}" data-d="0" ${tipAttr('Delete line', 'Stops stay in place. Vehicles are scrapped.')}>${icon('trash')}</button></div>`;
}
function bindLineButtons(root) {
  root.querySelectorAll('[data-line]').forEach((btn) => btn.addEventListener('click', () => {
    const l = G.lines.get(+btn.dataset.line); if (!l) return;
    const d = +btn.dataset.d;
    if (d === 0) { if (btn.dataset.sure) { deleteLine(l); uiToast(`${l.name} deleted.`); sfx('demolish'); } else { btn.dataset.sure = '1'; btn.innerHTML = 'Sure?'; return; } }
    else { const r = lineVehicles(l, d); if (!r.ok) return fail(r.why); sfx(d > 0 ? 'build' : 'click'); }
    recomputeAll();
    if (UI.drawer) renderDrawer();
    if (IN.selected) renderInfo();
  }));
}

// ---- info panel ---------------------------------------------------------------------------------------
function uiSelect(b) {
  const el = $('info');
  if (!b) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false; renderInfo();
}
function bar(v, cls = '') { return `<div class="meter ${cls}"><i style="width:${clamp(v, 0, 1) * 100}%"></i></div>`; }
const FACTOR_NAME = { noRoad: 'No road', noGroceries: 'No grocer in reach', noClothes: 'No clothes shop', noUtilities: 'No hardware store', shops: 'Shops nearby', emptyShelves: 'Empty shelves', parks: 'Parks & leisure', noPark: 'No parks', landmarks: 'Landmarks', heat: 'Heatwave', transit: 'Public transport', noTransit: 'No transit', packed: 'Packed vehicles', rain: 'Rain', weather: 'Weather', storm: 'Storm', portNoise: 'Harbour noise', noise: 'Noise', seaView: 'Sea view', crowded: 'Crowded', tourists: 'Too many tourists', taxes: 'Taxes', broke: 'City broke', portFull: 'Harbour overloaded', strike: 'Strike', buzz: 'Civic buzz', grudge: 'Ignored petition', raceNoise: 'Race noise', left: 'Neighbours left' };
const kv = (k, v, cls = '') => `<div class="kv ${cls}"><span>${k}</span><b>${v}</b></div>`;
function renderInfo() {
  const b = IN.selected, el = $('info');
  if (!b) return;
  if (b.tile) { renderTileInfo(b, el); return; }
  if (!G.buildings.has(b.id)) { select(null); return; }
  const d = B[b.type];
  let body = '';
  if (!b.done) body += `<p class="muted">Under construction · ready at ${fmtTime(b.doneAt % DAY_MIN)}${Math.floor(b.doneAt / DAY_MIN) + 1 > G.day() ? ' tomorrow' : ''}</p>`;
  else if (HOUSING.has(b.type)) {
    const F = b.factors || {};
    const rows = Object.entries(F).sort((a, c) => a[1] - c[1]).map(([k, v]) => `<li class="${v < 0 ? 'neg' : 'pos'}"><span>${FACTOR_NAME[k] || k}</span><b>${v > 0 ? '+' : ''}${Math.round(v)}</b></li>`).join('');
    const goods = Object.keys(GOODS).filter((g) => g === 'groceries' || G.pop >= GOODS[g].minPop).map((g) => { const n = (b.reach && b.reach[g] || []).length; return `<span class="chip ${n ? 'on' : 'off'}">${icon({ groceries: 'cart', clothes: 'shirt', utilities: 'bulb' }[g])} ${n ? n : 'none'}</span>`; }).join('');
    body += kv('Residents', `${b.res} / ${capOf(b)}`) + kv('Happiness', Math.round(b.happy * 100) + '%') + bar(b.happy, 'happy')
      + (b.lowDays ? `<p class="why">Unhappy for ${b.lowDays} day${b.lowDays > 1 ? 's' : ''}: a quarter of the residents leave each day below 40%.</p>` : '')
      + `<ul class="factors">${rows}</ul><div class="supply">${goods}</div>`
      + kv('Transit', b.transit ? b.lines.map((l) => `<i class="sw" style="background:${l.color}"></i>${esc(l.name)}`).join(' ') : 'No line stop within walking distance')
      + kv('Pays the ship', `${fmtMoney(ECON.portRate * b.res * (B[b.type].spend || 1))}/day`);
  } else if (SHOPS.has(b.type)) {
    if (b.closed) body += `<p class="why">Closed for lack of customers. Reopen it for ${fmtMoney(reopenCost(b))} once more homes are in its radius, or demolish it.</p>`;
    for (const g in d.goods) {
      const cap = goodsCap(b, g), st = b.stock[g] || 0;
      body += `<div class="goodrow">${icon({ groceries: 'cart', clothes: 'shirt', utilities: 'bulb' }[g])}<b>${GOODS[g].name}</b><span>${Math.round(st)} / ${cap}</span>${bar(st / cap, 'stock')}<small>Demand ${Math.round((b.demand && b.demand[g]) || 0)}/day${b.tourDemand && b.tourDemand[g] ? ` + ${Math.round(b.tourDemand[g])} tourists` : ''} · price ${fmtMoney(d.price[g])} · served ${Math.round(((b.sat && b.sat[g]) != null ? b.sat[g] : 1) * 100)}%</small></div>`;
    }
    const l = b.last;
    if (l) body += `<div class="ledger">${kv('Sales yesterday', fmtMoney(l.rev))}${kv('Stock bought', '−' + fmtMoney(l.ws))}${kv('Staff', '−' + fmtMoney(l.staff))}${kv('Profit', `${l.profit >= 0 ? '+' : ''}${fmtMoney(l.profit)}`, l.profit >= 0 ? 'pos' : 'neg')}</div>`;
    else body += kv('Staff', fmtMoney(d.staff) + '/day');
    body += `<p class="muted">${b.delivered === G.day() ? 'Restocked by truck this morning.' : b.noTruck ? 'No truck was free for this shop this morning.' : 'Trucks come at dawn when stock runs low.'}${b.idleDays ? ` Too few customers: closes in ${4 - b.idleDays} day${4 - b.idleDays > 1 ? 's' : ''}.` : ''}</p>`;
    if (!b.roadAccess) body += '<p class="why">Not on a road: trucks cannot reach it.</p>';
  } else if (b.type === 'port') {
    const lv = PORT_LV[b.plv], cap = portCap();
    body += kv('Level', lv.name) + kv('Serves', `${fmtNum(lv.cap)} residents`) + kv('City load', `${fmtNum(G.effPop)} / ${fmtNum(cap)}`) + bar(G.effPop / cap, 'port')
      + kv('Delivery trucks', `${lv.trucks} each morning`) + kv('Ship income yesterday', fmtMoney((G.history[G.history.length - 1] || {}).port || 0))
      + '<p class="muted">A ship docks every morning and pays for every resident the harbour can serve, more when they are happy.</p>';
  } else if (b.type === 'station') {
    const lines = NET.stopLines.get(G.idx(b.x, b.y)) || [];
    const st = NET.stations.find((s) => s.b === b);
    body += kv('Lines', lines.length ? lines.map((l) => `<i class="sw" style="background:${l.color}"></i>${esc(l.name)}`).join(' ') : 'None yet') + `<p class="muted">${st && st.freight ? `Connected to the rail tunnel: freight brings ${FREIGHT_TRUCKS} extra delivery trucks every morning.` : 'Connect the track to the rail tunnel for freight. Create a train line from the Transport menu.'}</p>`;
  } else if (HOTELS.has(b.type)) {
    body += kv('Beds', bedsOf(b)) + kv('Guests tonight', fmtNum(b.guests || 0)) + bar((b.guests || 0) / bedsOf(b), 'stock') + kv('Room rate', fmtMoney(d.rate)) + kv('Takings last night', fmtMoney(b.lastRev || 0)) + kv('Upkeep', fmtMoney(d.upkeep) + '/day')
      + '<p class="muted">Guests arrive on intercity routes in the evening, stay the night and leave the next day.</p>';
  } else if (b.type === 'tourist') {
    const routes = [...G.lines.values()].filter((l) => LINE_KIND[l.kind].outside && l.tourOk);
    body += kv('Radius', `${radiusOf(b)} plots`) + kv('Intercity routes', routes.length ? routes.map((l) => esc(l.name)).join(', ') : 'None yet') + kv('Tourists today', fmtNum(G.tourists.day)) + kv('Visitors who could come', fmtNum(G.tourists.potential || 0))
      + '<p class="muted">Routes must end at a stop inside this radius. Day tourists shop at stores in the radius and visit landmarks.</p>';
  } else if (d.joy != null) {
    const fx = [];
    if (d.calm) fx.push('calms crowded streets');
    if (d.cafe) fx.push('earns from residents and tourists nearby');
    if (d.heat) fx.push('keeps neighbours cool in heatwaves');
    if (d.noise) fx.push('noisy for homes within 2 plots');
    if (d.appeal) fx.push(`tourist appeal ${d.appeal}`);
    if (d.night) fx.push('busy at night');
    body += kv('Radius', `${radiusOf(b)} plots`) + kv('Happiness at the centre', `+${(joyOf(b) * (LANDMARK.has(b.type) ? 5 : 6)).toFixed(0)}`) + (fx.length ? `<p class="muted">${esc(fx.join(' · '))}</p>` : '')
      + (d.ticket ? kv('Tickets', fmtMoney(d.ticket)) + kv('Takings yesterday', fmtMoney(b.lastRev || 0)) : '') + (d.cafe ? kv('Takings yesterday', fmtMoney(b.lastRev || 0)) : '') + (d.upkeep ? kv('Upkeep', fmtMoney(d.upkeep) + '/day') : '');
  }
  const acts = [];
  if (b.done || b.type === 'port') {
    const u = upgradeInfo(b);
    if (u.why !== 'Fully upgraded') acts.push(`<button data-act="upgrade" ${u.ok ? '' : 'aria-disabled="true"'} ${tipAttr(b.type === 'port' ? `Upgrade to ${u.name || ''}` : `Upgrade to level ${b.lv + 1}`, u.ok ? 'Bigger, more capacity, more effect.' : u.why)}>${b.type === 'port' ? `Upgrade to ${u.name || ''}` : `Upgrade to Lv ${b.lv + 1}`} · ${fmtMoney(u.cost || 0)}</button>`);
  }
  if (b.closed) acts.push(`<button data-act="reopen" ${tipAttr('Reopen', 'Restaff the shop. Its shelves start empty until the next truck.')}>Reopen · ${fmtMoney(reopenCost(b))}</button>`);
  const multi = sizeOf(b.type)[0] * sizeOf(b.type)[1] > 1;
  if (b.type !== 'port' && b.type !== 'station' && !multi) acts.push(`<button data-act="move" ${tipAttr('Move', 'Put this building on another plot.')}>Move · ${fmtMoney(moveCost(b))}</button>`);
  const dc = demolishCost(b.x, b.y);
  if (dc.ok) acts.push(`<button data-act="demolish" class="danger" ${tipAttr('Demolish', HOUSING.has(b.type) ? 'Residents go back on the moving list.' : 'The plot becomes empty.')}>Demolish · ${fmtMoney(dc.cost)}</button>`);
  const u = upgradeInfo(b);
  el.innerHTML = `<header><h2>${esc(d.name)}${b.type === 'port' || d.maxLevel === 1 ? '' : ` <small>Lv ${b.lv}</small>`}</h2><button class="x" aria-label="Close">×</button></header>${body}
    <div class="acts">${acts.join('')}</div>${!u.ok && u.why && u.why !== 'Fully upgraded' && b.done ? `<p class="why">${esc(u.why)}</p>` : ''}`;
  el.querySelector('.x').addEventListener('click', () => select(null));
  el.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => {
    const a = btn.dataset.act;
    if (a === 'upgrade') { const r = upgrade(b); if (!r.ok) fail(r.why); else { sfx('build'); b.flash = performance.now(); uiToast(`${d.name} upgraded.`, 'good'); } }
    else if (a === 'reopen') { const r = reopenStore(b); if (!r.ok) fail(r.why); else { sfx('build'); uiToast(`${d.name} reopened.`, 'good'); } }
    else if (a === 'move') { setTool('move'); IN.moving = b; uiToast(`Moving ${d.name}. Click a new plot, or press Esc.`); }
    else if (a === 'demolish') { const r = demolish(b.x, b.y); if (!r.ok) fail(r.why); else { sfx('demolish'); addFx({ kind: 'dust', x: b.x, y: b.y, seed: 3, life: 900 }); select(null); return; } }
    renderInfo();
  }));
}
function renderTileInfo(b, el) {
  const k = G.idx(b.x, b.y);
  const sp = G.spanTile.get(k);
  let title = tileLabel(b.x, b.y), body = '';
  const acts = [];
  if (G.busStops.has(k)) {
    const lines = NET.stopLines.get(k) || [];
    body += kv('Lines', lines.length ? lines.map((l) => `<i class="sw" style="background:${l.color}"></i>${esc(l.name)}`).join(' ') : 'None yet');
    body += lines.length ? lines.map(lineRow).join('') : '<p class="muted">A stop does nothing until a line calls here. Homes within 4 plots of a line stop count as served by transit.</p>';
    if (unlocked('busline')) acts.push(`<button data-act="newline" ${tipAttr('New bus line from here', 'Click more stops in order, then Enter.')}>New bus line from here</button>`);
  } else if (sp) {
    body += `<p>${sp.kind === 'bridge' ? `A ${sp.len}-tile viaduct at level ${sp.z / STEP}.` : `A ${sp.len}-tile tunnel bored through the high ground.`} Upkeep ${fmtMoney(6 + sp.len * 3)}/day.</p>`;
  } else if (G.net[k] & N_ROAD) {
    const comp = NET.roadComp[k];
    body += `<p>${comp >= 0 && comp === NET.roadPortalComp ? 'This road network reaches the road tunnel: tunnel trucks can restock shops on it.' : 'This road network does not reach the road tunnel.'}${G.ramp[k] ? ' This tile is a ramp up to the next terrace.' : ''}${G.net[k] & N_CIRCUIT ? ' Part of the Grand Prix circuit.' : ''}</p>`;
  } else if (G.net[k] & N_RAIL) body += '<p>Trains only run on lines you create between stations. Track that reaches the rail tunnel brings freight.</p>';
  const dc = demolishCost(b.x, b.y);
  if (dc.ok) acts.push(`<button data-act="demolish" class="danger">Remove ${esc(dc.what)} · ${fmtMoney(dc.cost)}</button>`);
  el.innerHTML = `<header><h2>${esc(title)}</h2><button class="x" aria-label="Close">×</button></header>${body}<div class="acts">${acts.join('')}</div>`;
  el.querySelector('.x').addEventListener('click', () => select(null));
  bindLineButtons(el);
  el.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => {
    const a = btn.dataset.act;
    if (a === 'demolish') { const r = demolish(b.x, b.y); if (!r.ok) fail(r.why); else { sfx('demolish'); select(null); } }
    else if (a === 'newline') { setTool('build', 'busline'); IN.draft.stops.push(k); updateOverlay(); }
  }));
}

// ---- goals --------------------------------------------------------------------------------------------
const has = (t, f) => [...G.buildings.values()].some((b) => b.type === t && (!f || f(b)));
const GOALS = [
  { id: 'house', text: 'Build a Cottage beside the road', hint: 'Open Homes (1). A home needs people on the moving list.', done: () => has('cottage'), reward: 300 },
  { id: 'park', text: 'Build a Pocket Park near your homes', hint: 'Parks lift happiness in a radius. Watch the ring when placing it.', done: () => has('park'), reward: 200 },
  { id: 'tunnel', text: 'Connect a road from the harbour to the road tunnel', hint: `The tunnel adds ${TUNNEL_TRUCKS} delivery trucks every morning.`, done: () => G.links.road, reward: 600, show: () => [G.map.roadPortal.x + 0.5, G.map.roadPortal.y + 1.5] },
  { id: 'village', text: 'Grow to 60 residents', hint: 'Keep happiness above 55% so the moving list grows.', done: () => G.pop >= 60, reward: 800 },
  { id: 'busline', text: 'Create a bus line with two stops', hint: 'Place bus stops on roads, then New Bus Line in Transport (6) and click the stops.', done: () => [...G.lines.values()].some((l) => l.kind === 'bus' && l.valid), reward: 700 },
  { id: 'clothes', text: 'Open a Boutique', hint: 'From 60 residents people want clothes too.', done: () => has('boutique') || has('fashion') || has('dept'), reward: 600 },
  { id: 'town', text: 'Grow to 180 residents', hint: 'Tourism, rail and pools unlock at Town.', done: () => G.pop >= 180, reward: 1500 },
  { id: 'tourist', text: 'Build a Tourist Centre and an intercity coach route', hint: 'The route runs from the road tunnel to a bus stop inside the centre\'s radius.', done: () => [...G.lines.values()].some((l) => LINE_KIND[l.kind].outside && l.tourOk), reward: 3000 },
  { id: 'hotel', text: 'Build a Guest House for overnight visitors', hint: 'Without beds, tourists go home in the evening.', done: () => has('guesthouse') || has('hotel'), reward: 2000 },
  { id: 'terrace', text: 'Raise a plot and build a home on it', hint: 'Terrain (7): raise land, then drag a road up with a ramp. Raised homes see the sea.', done: () => [...G.buildings.values()].some((b) => HOUSING.has(b.type) && tileLevel(b.x, b.y) > 0), reward: 1500 },
  { id: 'large', text: 'Grow to 450 residents', hint: 'Supermarkets, villas and the first landmarks unlock.', done: () => G.pop >= 450, reward: 3000 },
  { id: 'landmark', text: 'Build a landmark', hint: 'Landmarks give the biggest happiness boost and draw tourists.', done: () => [...G.buildings.values()].some((b) => LANDMARK.has(b.type) && b.done), reward: 6000 },
  { id: 'city', text: 'Grow to 1,100 residents', hint: 'At City level you can upgrade the harbour.', done: () => G.pop >= 1100, reward: 6000 },
  { id: 'port2', text: 'Upgrade your harbour', hint: 'Select the harbour and press Upgrade.', done: () => has('port', (b) => b.plv > 0), reward: 8000 },
  { id: 'lcity', text: 'Grow to 2,800 residents', hint: 'Skyscrapers, the mall, the zoo and the Grand Prix licence unlock.', done: () => G.pop >= 2800, reward: 12000 },
  { id: 'f1', text: 'Hold your first Grand Prix', hint: 'Buy the licence in Landmarks (4), design a circuit, and wait for race day.', done: () => (G.stats.races || 0) > 0, reward: 20000 },
  { id: 'metro', text: 'Grow to 6,500 residents', hint: 'The container port and the Prince\'s Palace unlock.', done: () => G.pop >= 6500, reward: 30000 },
  { id: 'prince', text: 'Grow to 13,000 residents', hint: 'Long live the Principality!', done: () => G.pop >= 13000, reward: 60000 },
];
function currentGoal() { return GOALS.find((g) => !G.goals[g.id]); }
function checkGoals() {
  let g = currentGoal(), guard = 0;
  while (g && g.done() && guard++ < 20) {
    G.goals[g.id] = true; G.money += g.reward; G.today.grants += g.reward;
    uiToast(`<b>Goal complete:</b> ${esc(g.text)} · +${fmtMoney(g.reward)}`, 'good', 5000); sfx('coin');
    g = currentGoal();
  }
  const done = GOALS.filter((x) => G.goals[x.id]).length;
  const key = g ? g.id + done : 'all';
  if (UI.goalKey === key) return;
  UI.goalKey = key;
  $('goal').innerHTML = g ? `<p class="goal-t">${esc(g.text)}</p><p class="goal-h">${esc(g.hint)}</p><p class="goal-r">Reward ${fmtMoney(g.reward)} · ${done}/${GOALS.length} done${g.show ? ' <button class="mini show" id="goalShow">Show me</button>' : ''}</p>` : '<p class="goal-t">Every note is ticked off. Keep building!</p>';
  const sb = $('goalShow');
  if (sb) sb.addEventListener('click', () => { const [x, y] = g.show(); centerOnTile(x, y); sfx('click'); });
}

// ---- toasts, tips, banners, tooltips -------------------------------------------------------------------
function uiToast(html, kind = 'info', life = 4200) {
  const box = $('toasts'); if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.innerHTML = html;
  box.prepend(t);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, life);
}
function uiTip(text) {
  const tip = $('tip'); if (!tip) return;
  if (!text || (IN.pan && IN.pan.moved)) { tip.hidden = true; return; }
  tip.hidden = false;
  if (UI.tipText !== text) { tip.textContent = text; UI.tipText = text; }
  tip.style.transform = `translate(${Math.min(IN.mouse.x + 16, innerWidth - tip.offsetWidth - 8)}px, ${Math.min(IN.mouse.y + 18, innerHeight - 40)}px)`;
  tip.classList.toggle('bad', R.ghost ? !R.ghost.ok : false);
}
function banner(title, unlocks) {
  const b = $('banner');
  b.innerHTML = `<small>Your city is now a</small><h1>${esc(title)}</h1>${unlocks.length ? `<p>New: ${unlocks.map(esc).join(' · ')}</p>` : ''}`;
  b.hidden = false; b.classList.remove('out');
  clearTimeout(UI.bannerT);
  UI.bannerT = setTimeout(() => { b.classList.add('out'); setTimeout(() => { b.hidden = true; }, 500); }, 4800);
}
// hover tooltips with a title, a description and the keyboard shortcut
function initTooltips() {
  const tt = $('tooltip');
  let cur = null, timer = 0;
  const show = (el) => {
    const r = el.getBoundingClientRect();
    tt.innerHTML = `<b>${esc(el.dataset.tip)}</b>${el.dataset.key ? `<kbd>${esc(el.dataset.key)}</kbd>` : ''}${el.dataset.desc ? `<span>${esc(el.dataset.desc)}</span>` : ''}`;
    tt.hidden = false;
    const w = tt.offsetWidth, h = tt.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
    if (y < 6) y = r.bottom + 8;
    x = clamp(x, 6, innerWidth - w - 6);
    tt.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el === cur) return;
    cur = el; clearTimeout(timer); tt.hidden = true;
    if (el) timer = setTimeout(() => { if (cur === el && document.body.contains(el)) show(el); }, 280);
  });
  document.addEventListener('pointerdown', () => { clearTimeout(timer); tt.hidden = true; cur = null; }, true);
  document.addEventListener('pointerout', (e) => { if (cur && !cur.contains(e.relatedTarget)) { clearTimeout(timer); tt.hidden = true; cur = null; } });
}

// ---- per-frame UI -------------------------------------------------------------------------------------
function uiTick(dt, now) {
  panTick(dt);
  if (R.attract) { R.attractT = (R.attractT || 0) + dt; attractCam(R.attractT); }
  if (G.race && G.race.live && AG.race && IN.raceFollow !== false && AG.race.leader) {
    const q = samplePath(AG.race.path, ((AG.race.leader.s % AG.race.len) + AG.race.len) % AG.race.len);
    const [X, Y] = toPx(q.x, q.y);
    R.cam.x += (X - R.cam.x) * Math.min(1, dt * 3); R.cam.y += (Y - q.z - R.cam.y) * Math.min(1, dt * 3);
  }
  if (now - UI.lastRefresh > 250) {
    UI.lastRefresh = now;
    refreshHUD();
    if (IN.selected && !$('info').hidden && !$('info').matches(':hover')) renderInfo();
    if (now - (UI.talkT || 0) > 2000 || UI.talkRev !== G.rev) { refreshTalk(); UI.talkT = now; UI.talkRev = G.rev; }
    if (UI.drawer && UI.drawerLvl !== G.level) { UI.drawerLvl = G.level; renderDrawer(); }
    if (++UI.goalTick % 4 === 0) checkGoals();
  }
  UI.bubbleT -= dt * (G.speed ? 1 : 0);
  if (UI.bubbleT <= 0 && SETTINGS.bubbles) {
    UI.bubbleT = 1.4 + Math.random() * 1.4;
    const homes = [...G.buildings.values()].filter((b) => HOUSING.has(b.type) && b.done);
    if (homes.length) {
      const h = homes[(Math.random() * homes.length) | 0];
      const ic = h.worst ? ICON[h.worst] : (h.happy > 0.72 ? 'heart' : null);
      if (ic) R.bubbles.push({ b: h, icon: ic, t0: now });
    }
  }
}
UI.goalTick = 0;
