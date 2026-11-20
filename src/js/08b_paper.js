// ---------------------------------------------------------------------------
// The Town paper: classified ads that pay cash for reaching goals. Four ads
// are always on offer; the player takes on at most two at a time, and the
// reward is paid the moment a job is done.
// ---------------------------------------------------------------------------
const PAPER_OFFERS = 4, PAPER_JOBS = 2, PAPER_STALE = 5; // ads on offer, jobs at once, days an ad stays up

const PAPER_SPONSORS = {
  build: ["The Builders' Guild", 'Riviera Construction Co.', "The Mayor's Office", 'Quayside Property Fund'],
  pop: ["The Mayor's Office", 'Chamber of Commerce', 'The Harbour Authority'],
  happy: ["The Residents' Association", 'Café Owners of the Riviera', 'The Town Council'],
  tourists: ['Riviera Tourism Board', 'The Hoteliers of the Coast'],
  riders: ['Transport Committee', 'The Green Coast Society'],
};
const roundTo = (v, n) => Math.max(n, Math.round(v / n) * n);
const nicePop = (v) => (v < 100 ? roundTo(v, 5) : v < 1000 ? roundTo(v, 10) : roundTo(v, 50));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const lineRiders = () => [...G.lines.values()].reduce((a, l) => a + (l.valid && !LINE_KIND[l.kind].outside ? l.riders || 0 : 0), 0);

// what can be asked for: unlocked homes, shops, leisure, tourism and bus stops (no landmarks)
function paperBuildTypes() {
  return B_ORDER.filter((k) => {
    const d = B[k];
    if (!['housing', 'shops', 'leisure', 'tourism'].includes(d.cat) && k !== 'busstop') return false;
    if (LANDMARK.has(k) || !unlocked(k) || !d.cost) return false;
    return !(d.cat === 'tourism' && d.cost > 20000);
  });
}
function paperTaken(kind, type) {
  const all = G.paper.offers.concat(G.paper.jobs);
  return all.some((a) => a.kind === kind && (kind !== 'build' || a.type === type));
}
function makeAd() {
  const P = G.paper;
  const kinds = [['build', 5], ['pop', 2.5], ['happy', 1.5]];
  if (G.level >= 2 || [...G.buildings.values()].some((b) => b.type === 'tourist')) kinds.push(['tourists', 1]);
  if ([...G.lines.values()].some((l) => l.valid && !LINE_KIND[l.kind].outside)) kinds.push(['riders', 1]);
  for (let tries = 0; tries < 20; tries++) {
    let r = Math.random() * kinds.reduce((a, k) => a + k[1], 0), kind = kinds[0][0];
    for (const [k, w] of kinds) { if ((r -= w) <= 0) { kind = k; break; } }
    const ad = { id: P.seq, kind, day: G.day(), sponsor: pick(PAPER_SPONSORS[kind]) };
    if (kind === 'build') {
      const types = paperBuildTypes().filter((t) => !paperTaken('build', t));
      if (!types.length) continue;
      const t = pick(types), c = B[t].cost;
      const n = c <= 500 ? 3 + Math.floor(Math.random() * 3) : c <= 2500 ? 2 + Math.floor(Math.random() * 2) : c <= 9000 ? 1 + Math.floor(Math.random() * 2) : 1;
      Object.assign(ad, { type: t, n, reward: roundTo(n * c * 0.35 + 100, 50) });
    } else if (kind === 'pop') {
      if (paperTaken('pop')) continue;
      const n = nicePop(G.pop + Math.max(25, G.pop * 0.3));
      Object.assign(ad, { n, reward: roundTo((n - G.pop) * 7 + 150, 50) });
    } else if (kind === 'happy') {
      if (paperTaken('happy')) continue;
      const n = clamp(roundTo(G.happy * 100 + 7, 5), 60, 92);
      if (n <= Math.round(G.happy * 100)) continue;
      Object.assign(ad, { n, reward: roundTo(250 + G.pop * 1.2 + (n - 50) * 15, 50) });
    } else if (kind === 'tourists') {
      if (paperTaken('tourists')) continue;
      const n = nicePop(Math.max(20, G.tourists.day * 1.4 + 20));
      Object.assign(ad, { n, reward: roundTo(n * 6 + 200, 50) });
    } else {
      if (paperTaken('riders')) continue;
      const n = nicePop(lineRiders() * 1.4 + 30);
      Object.assign(ad, { n, reward: roundTo(n * 4 + 200, 50) });
    }
    P.seq++;
    return ad;
  }
  return null;
}
// keep four ads on offer; with refresh, one ad that has been up too long is swapped for a new one
function paperEnsure(refresh) {
  if (!G.paper) G.paper = { offers: [], jobs: [], seq: 1, done: 0 };
  const P = G.paper;
  if (refresh) {
    const old = P.offers.filter((a) => G.day() - a.day >= PAPER_STALE).sort((a, b) => a.day - b.day)[0];
    if (old) P.offers = P.offers.filter((a) => a !== old);
  }
  let guard = 0;
  while (P.offers.length < PAPER_OFFERS && guard++ < 10) { const ad = makeAd(); if (ad) P.offers.push(ad); else break; }
  return P;
}
function adHead(a) {
  if (a.kind === 'build') return `Wanted: ${a.n} new ${a.n > 1 ? plural(B[a.type].name) : B[a.type].name}`;
  if (a.kind === 'pop') return `Grow to ${fmtNum(a.n)} residents`;
  if (a.kind === 'happy') return `Happiness to ${a.n}%`;
  if (a.kind === 'tourists') return `${fmtNum(a.n)} tourists in a day`;
  return `${fmtNum(a.n)} transit riders a day`;
}
function adBody(a) {
  if (a.kind === 'build') return `${a.sponsor} will pay when ${a.n > 1 ? `${a.n} more ${plural(B[a.type].name)} are` : `another ${B[a.type].name} is`} finished, counting from when you take the job.`;
  if (a.kind === 'pop') return `${a.sponsor} offers a reward once ${fmtNum(a.n)} people call the town home.`;
  if (a.kind === 'happy') return `${a.sponsor} pays out when the town's happiness reaches ${a.n}%.`;
  if (a.kind === 'tourists') return `${a.sponsor} rewards a day with ${fmtNum(a.n)} visitors in town.`;
  return `${a.sponsor} pays once your bus and rail lines carry ${fmtNum(a.n)} riders in a day.`;
}
function plural(name) { return /s$/.test(name) ? name : /y$/.test(name) && !/[aeiou]y$/.test(name) ? name.slice(0, -1) + 'ies' : /(ch|sh|x)$/.test(name) ? name + 'es' : name + 's'; }
function jobNow(j) {
  if (j.kind === 'build') return j.got || 0;
  if (j.kind === 'pop') return G.pop;
  if (j.kind === 'happy') return Math.round(G.happy * 100);
  if (j.kind === 'tourists') return G.tourists.day || 0;
  return lineRiders();
}
function jobFrac(j) {
  const now = jobNow(j);
  if (j.kind === 'build') return clamp(now / j.n, 0, 1);
  return clamp((now - j.from) / Math.max(1, j.n - j.from), 0, 1);
}
function takeAd(id) {
  const P = paperEnsure();
  const a = P.offers.find((x) => x.id === id);
  if (!a) return { ok: false, why: 'That ad is gone' };
  if (P.jobs.length >= PAPER_JOBS) return { ok: false, why: `You can work on ${PAPER_JOBS} ads at once. Finish or drop one first.` };
  P.offers = P.offers.filter((x) => x !== a);
  const j = Object.assign({}, a, { took: G.day(), got: 0 });
  if (j.kind !== 'build') j.from = jobNow(j);
  P.jobs.push(j);
  paperEnsure();
  paperCheck();
  return { ok: true, job: j };
}
function dropJob(id) {
  const P = paperEnsure();
  P.jobs = P.jobs.filter((j) => j.id !== id);
  return { ok: true };
}
// a building finished: count it towards build jobs
function paperBuilt(type) {
  if (!G.paper) return;
  for (const j of G.paper.jobs) if (j.kind === 'build' && j.type === type) j.got = (j.got || 0) + 1;
  paperCheck();
}
// pay out any job that is done
function paperCheck() {
  if (!G.paper || !G.paper.jobs.length || !G.started) return;
  const done = G.paper.jobs.filter((j) => jobNow(j) >= j.n);
  if (!done.length) return;
  G.paper.jobs = G.paper.jobs.filter((j) => !done.includes(j));
  for (const j of done) {
    G.money += j.reward; G.today.grants += j.reward; G.paper.done = (G.paper.done || 0) + 1;
    emit('paperDone', j);
  }
}

// ---- the page ----
function uiOpenPaper() {
  if (!G.started) return;
  paperEnsure();
  openModal('paper', `<div class="sheet paper" role="dialog" aria-label="Town paper"><button class="x" aria-label="Close" ${tipAttr('Close', '', 'Esc')}>×</button><div id="paperBody"></div></div>`);
  renderPaper();
}
function renderPaper() {
  const el = $('paperBody'); if (!el) return;
  const P = paperEnsure(), full = P.jobs.length >= PAPER_JOBS;
  const jobs = P.jobs.map((j) => `<div class="job">
      <div class="job-t"><b>${esc(adHead(j))}</b><span class="job-r">${fmtMoney(j.reward)}</span></div>
      <div class="meter"><i style="width:${Math.round(jobFrac(j) * 100)}%"></i></div>
      <div class="job-f"><span>${j.kind === 'build' ? `${jobNow(j)} of ${j.n} built` : `${fmtNum(jobNow(j))}${j.kind === 'happy' ? '%' : ''} of ${fmtNum(j.n)}${j.kind === 'happy' ? '%' : ''}`}</span><button class="drop" data-drop="${j.id}" ${tipAttr('Drop this job', 'No penalty, but the reward is lost and the ad is gone.')}>Drop</button></div>
    </div>`).join('') || '<p class="paper-empty">No jobs yet. Pick an ad below to start one.</p>';
  const ads = P.offers.map((a) => `<article class="ad ${a.kind}">
      <p class="ad-k">${a.kind === 'build' ? 'Builders wanted' : a.kind === 'pop' ? 'Growth' : a.kind === 'happy' ? 'Good cheer' : a.kind === 'tourists' ? 'Visitors' : 'Transit'}</p>
      <h3>${esc(adHead(a))}</h3>
      <p class="ad-b">${esc(adBody(a))}</p>
      <p class="ad-r">Reward <b>${fmtMoney(a.reward)}</b></p>
      <button class="ad-take" data-take="${a.id}" ${full ? `aria-disabled="true" ${tipAttr('Two jobs already', 'Finish or drop one of your jobs to take this ad.')}` : ''}>Take the job</button>
    </article>`).join('');
  el.innerHTML = `<header class="mast">
      <p class="mast-top"><span>Day ${G.day()}</span><span>${esc(G.name)} edition</span><span>Price: one franc</span></p>
      <h2>The Town Paper</h2>
      <p class="mast-sub">Rewards for the town's builders · ${P.done || 0} job${P.done === 1 ? '' : 's'} paid out so far</p>
    </header>
    <section class="paper-jobs"><h3>Your jobs <span>${P.jobs.length} of ${PAPER_JOBS}</span></h3>${jobs}</section>
    <section class="paper-ads"><h3>Classifieds</h3><div class="ads">${ads}</div>
      <p class="paper-foot">Rewards are paid in cash the moment a job is done. Ads stay up for ${PAPER_STALE} days; new ones arrive as old ones go.</p></section>`;
  el.querySelectorAll('[data-take]').forEach((b) => b.addEventListener('click', () => {
    if (b.getAttribute('aria-disabled') === 'true') return fail(`You can work on ${PAPER_JOBS} ads at once. Finish or drop one first.`);
    const r = takeAd(+b.dataset.take); if (!r.ok) return fail(r.why);
    sfx('click'); uiToast(`<b>Job taken:</b> ${esc(adHead(r.job))} · reward ${fmtMoney(r.job.reward)}`, 'good'); renderPaper(); refreshHUD();
  }));
  el.querySelectorAll('[data-drop]').forEach((b) => b.addEventListener('click', () => {
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Drop it?'; return; }
    dropJob(+b.dataset.drop); sfx('click'); renderPaper(); refreshHUD();
  }));
}
// the jobs in the side panel, and the count on the lower bar's button
function paperHud() {
  const P = G.paper, jobs = P ? P.jobs : [];
  const badge = $('paperBadge');
  if (badge) { badge.hidden = !jobs.length; badge.textContent = jobs.length; }
  const box = $('paperJobs'); if (!box) return;
  box.hidden = !jobs.length;
  const html = jobs.map((j) => `<div class="pj"><span>${esc(adHead(j))}</span><b>${fmtMoney(j.reward)}</b><div class="meter"><i style="width:${Math.round(jobFrac(j) * 100)}%"></i></div></div>`).join('');
  if (box.dataset.h !== html) { box.dataset.h = html; $('paperJobList').innerHTML = html; }
}
