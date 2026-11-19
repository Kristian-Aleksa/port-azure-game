// ---------------------------------------------------------------------------
// Menu (save, load, finances, settings, help), title screen, game over and
// the Grand Prix race HUD.
// ---------------------------------------------------------------------------
const SETTINGS = { sound: true, volume: 0.8, autosave: true, bubbles: true, weatherFx: true, edgeHints: true, dayNight: false };
function loadSettings() {
  try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem(SAVE_PREFIX + 'settings') || '{}')); } catch (e) { /* storage unavailable */ }
  AU.on = SETTINGS.sound; AU.vol = SETTINGS.volume;
}
function storeSettings() { try { localStorage.setItem(SAVE_PREFIX + 'settings', JSON.stringify(SETTINGS)); } catch (e) { /* storage unavailable */ } }

function uiModalOpen() { return !$('modal').hidden; }
function uiCloseModal() {
  const m = $('modal');
  if (m.hidden || UI.modal === 'gameover') return;
  m.hidden = true; m.innerHTML = '';
  if (UI.modalSpeed != null) { uiSetSpeed(UI.modalSpeed); UI.modalSpeed = null; }
  UI.modal = null;
}
function openModal(kind, html) {
  const m = $('modal');
  if (m.hidden && G.started) { UI.modalSpeed = G.speed; uiSetSpeed(0); }
  UI.modal = kind;
  m.innerHTML = html; m.hidden = false;
  const x = m.querySelector('.x'); if (x) x.addEventListener('click', uiCloseModal);
  m.onclick = (e) => { if (e.target === m) uiCloseModal(); };
}

// ---- the menu --------------------------------------------------------------------------------------
const MENU_TABS = [['game', 'save', 'Save & load'], ['finance', 'chart', 'Finances'], ['settings', 'gear', 'Settings'], ['help', 'help', 'How to play']];
function uiOpenMenu(tab = 'game') {
  if (!G.started) return;
  UI.menuTab = tab;
  openModal('menu', `<div class="sheet menu"><header><h2>${icon('menu')} Menu</h2><button class="x" aria-label="Close" ${tipAttr('Close', '', 'Esc')}>×</button></header>
    <nav class="tabs" role="tablist">${MENU_TABS.map(([id, ic, name]) => `<button role="tab" data-tab="${id}" class="${id === tab ? 'on' : ''}" aria-selected="${id === tab}">${icon(ic)}<span>${name}</span></button>`).join('')}</nav>
    <div class="tab-body" id="tabBody"></div></div>`);
  $('modal').querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { UI.menuTab = b.dataset.tab; $('modal').querySelectorAll('[data-tab]').forEach((t) => { t.classList.toggle('on', t === b); t.setAttribute('aria-selected', t === b); }); renderTab(); }));
  renderTab();
}
function renderTab() {
  const el = $('tabBody'); if (!el) return;
  const t = UI.menuTab;
  if (t === 'game') renderSlots(el);
  else if (t === 'finance') renderFinance(el);
  else if (t === 'settings') renderSettings(el);
  else renderHelp(el);
}
function ago(ms) { const s = (Date.now() - ms) / 1000; if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`; return `${Math.floor(s / 86400)} days ago`; }
function slotName(s) { return s === 'auto' ? 'Autosave' : `Slot ${s}`; }
// the built-in demo city: always there, never overwritten
function demoInfo() { const d = DEMO_SAVE; return `Day ${Math.floor(d.t / DAY_MIN) + 1} · ${fmtNum(d.pop || 0)} residents · every landmark, fully upgraded`; }
function loadDemo() {
  loadGame(DEMO_SAVE); closeTitle();
  uiToast('<b>Demo city loaded.</b> It never overwrites your autosave: save it to a slot to keep your changes.', 'good', 7000);
}
function renderSlots(el) {
  const demoRow = `<div class="slot demo"><span class="sn">Demo</span><div class="si"><b>${esc(DEMO_SAVE.name)}</b><small>${demoInfo()}</small></div><div class="sa">
      <button class="mini" data-demo="1" ${tipAttr('Load the demo city', 'A copy opens. The demo itself never changes, and unsaved progress in the current city is lost.')}>${icon('load')} Load</button></div></div>`;
  const rows = demoRow + SLOTS.map((s) => {
    const d = SAVES[s];
    const info = d ? `<b>${esc(d.name)}</b><small>Day ${Math.floor(d.t / DAY_MIN) + 1} · ${fmtNum(d.pop || 0)} residents · ${fmtMoney(d.money)} · ${ago(d.savedAt)}</small>` : '<small class="muted">Empty</small>';
    return `<div class="slot"><span class="sn">${slotName(s)}</span><div class="si">${info}</div><div class="sa">
      ${s !== 'auto' ? `<button class="mini" data-save="${s}" ${tipAttr('Save here', d ? 'Overwrite this slot with the current city.' : 'Save the current city in this slot.')}>${icon('save')} Save</button>` : ''}
      ${d ? `<button class="mini" data-load="${s}" ${tipAttr('Load', 'Unsaved progress in the current city is lost.')}>${icon('load')} Load</button>` : ''}
      ${d ? `<button class="mini danger" data-del="${s}" ${tipAttr('Delete save', 'Removes this save for good. Click again to confirm.')}>${icon('trash')} Delete</button>` : ''}</div></div>`;
  }).join('');
  el.innerHTML = `<p class="muted">Saves stay in this browser${CLOUD.ready ? ' and in your private cloud slot, so they follow you to other devices' : ''}. The autosave is written at the end of every day.</p>
    <div class="slots">${rows}</div>
    <div class="row-acts"><button class="mini" id="mNew" ${tipAttr('New city', 'Start again on a fresh stretch of coast.')}>New city</button><button class="mini" id="mTitle">Back to title</button></div>`;
  el.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => { saveGame(b.dataset.save); sfx('coin'); uiToast(`Saved to ${slotName(b.dataset.save)}.`, 'good'); renderTab(); }));
  el.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.innerHTML = 'Sure?'; return; }
    const d = SAVES[b.dataset.load]; if (!d) return;
    UI.modalSpeed = null; $('modal').hidden = true; UI.modal = null;
    loadGame(d); closeTitle(); uiToast(`Loaded ${esc(d.name)}.`, 'good');
  }));
  el.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.innerHTML = 'Sure?'; return; }
    UI.modalSpeed = null; $('modal').hidden = true; UI.modal = null;
    loadDemo();
  }));
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { if (!b.dataset.sure) { b.dataset.sure = '1'; b.innerHTML = 'Delete?'; return; } const n = SAVES[b.dataset.del] && SAVES[b.dataset.del].name; deleteSave(b.dataset.del); uiToast(`Deleted ${slotName(b.dataset.del)}${n ? ' · ' + esc(n) : ''}.`); renderTab(); }));
  $('mNew').addEventListener('click', (e) => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Lose this city?'; return; } UI.modalSpeed = null; $('modal').hidden = true; UI.modal = null; startNewCity(Math.floor(Math.random() * 1e9)); closeTitle(); });
  $('mTitle').addEventListener('click', () => { saveGame('auto'); UI.modalSpeed = null; $('modal').hidden = true; UI.modal = null; showTitle(); });
}
function ledgerRows(r) {
  const inc = [['Harbour ship', r.port], ['Shop sales', r.stores], ['Tourism & tickets', r.tourism], ['Hotels', r.hotels], ['Transit fares', r.fares], ['Grants & rewards', r.grants], ['Grand Prix', Math.max(0, r.race)]];
  const exp = [['Shop stock', r.wholesale], ['Shop staff', r.staff], ['City services', r.services], ['Upkeep', r.upkeep], ['Vehicles', r.transit], ['Loan interest', r.interest], ['Grand Prix costs', Math.max(0, -r.race)]];
  return { inc, exp };
}
function renderFinance(el) {
  const last = G.history[G.history.length - 1];
  const T = Object.assign({}, G.today, { income: 0, expenses: 0 });
  const col = (r, label) => {
    const { inc, exp } = ledgerRows(r);
    const ti = inc.reduce((a, x) => a + x[1], 0), te = exp.reduce((a, x) => a + x[1], 0);
    return `<div class="ledger-col"><h3>${label}</h3>${inc.filter((x) => x[1]).map(([n, v]) => kv(n, '+' + fmtMoney(v), 'pos')).join('') || '<p class="muted small">No income yet</p>'}
      ${exp.filter((x) => x[1]).map(([n, v]) => kv(n, '−' + fmtMoney(v), 'neg')).join('')}
      <div class="kv total ${ti - te >= 0 ? 'pos' : 'neg'}"><span>Net</span><b>${ti - te >= 0 ? '+' : ''}${fmtMoney(ti - te)}</b></div>
      ${r.spent ? kv('Construction', '−' + fmtMoney(r.spent), 'muted') : ''}</div>`;
  };
  const hist = G.history.slice(-14);
  const maxV = Math.max(1, ...hist.map((h) => Math.max(h.income, h.expenses)));
  const bars = hist.map((h) => `<div class="hb" ${tipAttr(`Day ${h.day}`, `Income ${fmtMoney(h.income)} · costs ${fmtMoney(h.expenses)} · net ${fmtMoney(h.income - h.expenses)}`)}><i class="in" style="height:${Math.round(h.income / maxV * 100)}%"></i><i class="out" style="height:${Math.round(h.expenses / maxV * 100)}%"></i><small>${h.day}</small></div>`).join('');
  const L = maxLoan();
  el.innerHTML = `<div class="fin-grid">${col(T, 'Today so far')}${last ? col(last, `Yesterday (day ${last.day})`) : '<div class="ledger-col"><h3>Yesterday</h3><p class="muted">The first day is not over yet.</p></div>'}</div>
    ${hist.length ? `<h3>Last ${hist.length} days</h3><div class="hist" role="img" aria-label="Income and costs per day">${bars}</div><p class="legend"><i class="in"></i> income <i class="out"></i> costs</p>` : ''}
    <div class="fin-grid">
      <div class="ledger-col"><h3>${icon('bank')} Bank loan</h3>${kv('Borrowed', fmtMoney(G.loan))}${kv('Interest', `${fmtMoney(Math.round(G.loan * ECON.loanRate))}/day (${(ECON.loanRate * 100).toFixed(2)}% a day)`)}${kv('Credit limit', fmtMoney(L))}
        <div class="row-acts"><button class="mini" id="fBorrow" ${G.loan + ECON.loanStep > L ? 'aria-disabled="true"' : ''}>Borrow ${fmtMoney(ECON.loanStep)}</button><button class="mini" id="fRepay" ${G.loan <= 0 ? 'aria-disabled="true"' : ''}>Repay ${fmtMoney(Math.min(ECON.loanStep, G.loan || ECON.loanStep))}</button></div>
        <p class="muted small">Below ${fmtMoney(0)} for ${ECON.bankruptDays} days in a row and the bank takes over the city.${G.debtDays ? ` <b class="neg">${G.debtDays} day${G.debtDays > 1 ? 's' : ''} in debt so far.</b>` : ''}</p></div>
      <div class="ledger-col"><h3>${icon('coin')} Taxes</h3><div class="seg">${Object.entries(TAX).map(([k, t]) => `<button class="mini ${G.tax === k ? 'on' : ''}" data-tax="${k}">${t.name}</button>`).join('')}</div>
        <p class="muted small">Low: ship income ×0.85, happiness +4. High: ship income ×1.2, happiness −7 for every home.</p></div>
    </div>`;
  $('fBorrow').addEventListener('click', () => { const r = borrow(); if (!r.ok) return fail(r.why); sfx('coin'); renderTab(); });
  $('fRepay').addEventListener('click', () => { const r = repay(); if (!r.ok) return fail(r.why); sfx('click'); renderTab(); });
  el.querySelectorAll('[data-tax]').forEach((b) => b.addEventListener('click', () => { G.tax = b.dataset.tax; G.dirtyHappy = true; sfx('click'); renderTab(); }));
}
function renderSettings(el) {
  const sw = (k, label, desc) => `<label class="sw-row" ${tipAttr(label, desc)}><input type="checkbox" data-set="${k}" ${SETTINGS[k] ? 'checked' : ''}><span class="sw-box"></span><span><b>${label}</b><small>${desc}</small></span></label>`;
  el.innerHTML = `<div class="settings">
    ${sw('sound', 'Sound effects', 'Little chiptune clicks, coins and the ship horn.')}
    <label class="sw-row"><span class="vol">${icon('sound')}</span><input type="range" id="setVol" min="0" max="1" step="0.05" value="${SETTINGS.volume}" aria-label="Volume"><span><b>Volume</b></span></label>
    ${sw('autosave', 'Autosave', 'Save to the autosave slot at the end of every day.')}
    ${sw('bubbles', 'Speech bubbles', 'Residents pop up icons about what bothers them.')}
    ${sw('weatherFx', 'Weather effects', 'Rain streaks, storm flashes and cloud shadows.')}
    ${sw('dayNight', 'Day and night', 'Evenings get dark and the city lights up. Off keeps it daytime.')}
  </div>`;
  el.querySelectorAll('[data-set]').forEach((c) => c.addEventListener('change', () => { SETTINGS[c.dataset.set] = c.checked; AU.on = SETTINGS.sound; storeSettings(); if (c.dataset.set === 'sound' && c.checked) sfx('click'); }));
  $('setVol').addEventListener('input', (e) => { SETTINGS.volume = +e.target.value; AU.vol = SETTINGS.volume; storeSettings(); });
  $('setVol').addEventListener('change', () => sfx('coin'));
}
function renderHelp(el) {
  el.innerHTML = `<ol class="help">
    <li><b>A ship docks every morning.</b> It pays for every resident the harbour can serve, more when they are happy. Upkeep, staff wages, city services and loan interest come out every evening, so watch the Finances tab.</li>
    <li><b>Homes need the moving list.</b> Happy residents (55%+) attract newcomers. Below 45% the town protests, below 40% the dockers strike and unhappy homes empty a quarter at a time until the plot is bare.</li>
    <li><b>Shops serve their radius.</b> Groceries matter from day one, clothes from 60 residents, utilities from 120. Trucks restock one shop each at dawn: the harbour, the road tunnel and rail freight each add trucks. Empty shelves upset people; shops with too few customers close.</li>
    <li><b>Transit is yours to plan.</b> Stops do nothing until you create a line and click its stops in order. Lines cost money to run, earn fares, and let homes reach shops along the route.</li>
    <li><b>Shape the land.</b> Raise or lower plots, ramp roads up one level per tile, tunnel through hills and bridge over valleys.</li>
    <li><b>Tourists</b> come on intercity routes that end inside a Tourist Centre's radius. Hotels let them stay the night. Landmarks sell tickets and give the biggest happiness boost.</li>
    <li><b>Petitions</b> give you four days to fix the top complaint. Succeed for a grant, fail and residents hold a grudge.</li>
    <li><b>The Grand Prix</b> needs a licence and a circuit of your streets. Every ${F1.every} days the race fills the city with fans and money.</li>
  </ol>
  <h3>Controls</h3>
  <ul class="keys">
    <li><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> pan · drag the map</li><li><kbd>Wheel</kbd> <kbd>+</kbd> <kbd>−</kbd> zoom</li>
    <li><kbd>Q</kbd> <kbd>E</kbd> rotate view</li><li><kbd>1</kbd>–<kbd>8</kbd> build menus · <kbd>R</kbd> road</li>
    <li><kbd>Space</kbd> pause · <kbd>,</kbd> <kbd>.</kbd> speed</li><li><kbd>M</kbd> move · <kbd>X</kbd> demolish</li>
    <li><kbd>G</kbd> ranges · <kbd>H</kbd> happiness · <kbd>T</kbd> transit</li><li><kbd>Enter</kbd> finish a line · <kbd>Backspace</kbd> undo a stop</li>
    <li><kbd>F</kbd> finances</li><li><kbd>Esc</kbd> cancel · open this menu</li>
  </ul>`;
}

// ---- title screen ----------------------------------------------------------------------------------
// Behind the title: the demo city, its clock stopped mid-morning, the camera drifting along the coast
// from Fontvieille to Larvotto and back while traffic, boats and people go about their day.
function titleBackdrop() {
  loadGame(DEMO_SAVE);
  G.started = false; G.speed = 0;
  R.zoom = window.innerWidth < 700 ? 1 : 1.5;
  R.attract = true; R.attractT = 0; UI.backdrop = true;
  attractCam(0);
}
function attractCam(t) {
  const T = 160, k = (t % (2 * T)) / T, u = (1 - Math.cos(Math.PI * k)) / 2;
  centerOnTile(lerp(20, 74, u), lerp(26.5, 24.5, u) + 0.5);
}
function showTitle(openSlots) {
  if (!UI.backdrop) titleBackdrop();
  const t = $('title');
  const any = SLOTS.some((s) => SAVES[s]);
  t.innerHTML = `<div class="title-card">
    <h1>Port Azur</h1>
    <p class="tag">A harbour city squeezed between a giant mountain and the sea.</p>
    <div class="title-acts">
      <button id="tNew" class="primary">New city <small>a fresh stretch of coast · ${fmtMoney(ECON.start)}</small></button>
      ${any ? '<button id="tLoad">Load game <small>continue a saved city</small></button>' : ''}
      <button id="tDemo">Explore the demo city <small>${fmtNum(DEMO_SAVE.pop || 0)} residents · every landmark, fully upgraded</small></button>
    </div>
    <div id="tSlots" class="slots title-slots" hidden></div>
    <p class="hint">A ship docks every morning. Keep the books in the black and the residents on side.</p>
  </div>`;
  t.hidden = false;
  document.body.classList.add('at-title');
  G.speed = 0; R.attract = true; G.started = false;
  $('tDemo').addEventListener('click', () => loadDemo());
  const fillSlots = () => {
    const box = $('tSlots');
    // newest first
    const list = SLOTS.filter((s) => SAVES[s]).sort((p, q) => (SAVES[q].savedAt || 0) - (SAVES[p].savedAt || 0));
    box.innerHTML = list.map((s) => {
      const d = SAVES[s];
      return `<div class="tslot"><button class="slot-btn" data-slot="${s}"><b>${slotName(s)} · ${esc(d.name)}</b><small>Day ${Math.floor(d.t / DAY_MIN) + 1} · ${fmtNum(d.pop || 0)} residents · ${fmtMoney(d.money)} · ${ago(d.savedAt)}</small></button>`
        + `<button class="slot-del" data-del="${s}" ${tipAttr('Delete save', 'Removes this save for good. Click again to confirm.')}>${icon('trash')}<span>Delete</span></button></div>`;
    }).join('');
    box.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => { const d = SAVES[b.dataset.slot]; if (!d) return; loadGame(d); closeTitle(); }));
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.classList.add('sure'); b.querySelector('span').textContent = 'Sure?'; return; }
      deleteSave(b.dataset.del); sfx('click');
      if (SLOTS.some((s) => SAVES[s])) fillSlots(); else showTitle();
    }));
  };
  if (any) {
    $('tLoad').addEventListener('click', () => { const box = $('tSlots'); box.hidden = !box.hidden; if (!box.hidden) fillSlots(); });
    if (openSlots) { $('tSlots').hidden = false; fillSlots(); }
  }
  $('tNew').addEventListener('click', () => {
    startNewCity(Math.floor(Math.random() * 1e9)); closeTitle();
    setTimeout(() => uiOpenMenu('help'), 300);
  });
}
function closeTitle() {
  $('title').hidden = true; R.attract = false; UI.backdrop = false;
  document.body.classList.remove('at-title');
  G.started = true;
  $('cityName').value = G.name;
  uiSetSpeed(1); sfx('click');
  UI.goalKey = null;
  refreshHUD(); refreshTalk(); checkGoals();
}
function showGameOver() {
  uiSetSpeed(0);
  const days = G.day(), pop = G.pop;
  openModal('gameover', `<div class="sheet over"><header><h2>${icon('bank')} The bank takes over</h2></header>
    <p>After ${ECON.bankruptDays} days in the red, the creditors have seized ${esc(G.name)}. You ran it for ${days} day${days === 1 ? '' : 's'} and housed ${fmtNum(pop)} residents.</p>
    <p class="muted">Every resident pays into the ship, but staff, upkeep and services are paid every evening. Grow homes before amenities you cannot afford, and borrow early rather than late.</p>
    <div class="row-acts"><button class="mini" id="goLoad">${icon('load')} Load a save</button><button class="mini" id="goNew">New city</button></div></div>`);
  $('goLoad').addEventListener('click', () => { UI.modal = null; $('modal').hidden = true; G.over = false; showTitle(); });
  $('goNew').addEventListener('click', () => { UI.modal = null; $('modal').hidden = true; G.over = false; startNewCity(Math.floor(Math.random() * 1e9)); closeTitle(); });
}

// ---- the race HUD -------------------------------------------------------------------------------------
function refreshRaceHud() {
  const el = $('raceHud');
  const st = raceStandings();
  if (!st) { el.hidden = true; return; }
  el.hidden = false;
  const lap = st.countdown > 0 ? `<b class="go">${st.countdown > 2.2 ? 'Ready' : st.countdown > 1.1 ? 'Set' : 'Go!'}</b>` : `Lap <b>${st.lap}</b> / ${st.laps}`;
  const html = `<h2>${icon('flag')} Grand Prix de ${esc(G.name)}</h2><div class="lap">${lap} · ${fmtNum(G.race ? G.race.specs : 0)} fans</div>
    <ol>${st.order.slice(0, 6).map((c) => `<li><i class="sw" style="background:${c.color}"></i>${esc(c.name)}${c.done ? ' ' + icon('flag') : ''}</li>`).join('')}</ol>
    <button class="mini" id="raceFollow">${icon('watch')} ${IN.raceFollow !== false ? 'Stop following' : 'Follow the leader'}</button>`;
  if (UI.raceHtml !== html) {
    UI.raceHtml = html; el.innerHTML = html;
    $('raceFollow').addEventListener('click', () => { IN.raceFollow = IN.raceFollow === false; UI.raceHtml = null; });
  }
}
