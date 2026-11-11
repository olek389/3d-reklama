// Interfejs gry. Rysuje wyłącznie na podstawie widoku (viewFor) swojej roli.
import {
  REGIONS, LINKS, REGION_BY_ID, VIRUS_TREES, DEF_TREES, VIRUS_UPGRADES, DEF_UPGRADES,
  VIRUS_BY_ID, MEASURES, CLIMATE_NAMES, WEALTH_NAMES,
} from './data.js';
import { CFG } from './game.js';

const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(SVG, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
// Podmienia HTML tylko gdy się zmienił, żeby nie gubić dotknięć przycisków.
const setHTML = (node, html) => { if (node._h !== html) { node._h = html; node.innerHTML = html; } };

export function fmt(n) {
  if (n === null || n === undefined) return '—';
  const f = (x, d) => x.toFixed(d).replace('.', ',');
  if (n >= 1e9) return f(n / 1e9, 2) + ' mld';
  if (n >= 1e6) return f(n / 1e6, n >= 1e8 ? 0 : 1) + ' mln';
  if (n >= 1e4) return Math.round(n / 1e3) + ' tys.';
  return String(Math.round(n));
}
const pct = (x) => (x * 100 >= 10 || x === 0 ? Math.round(x * 100) : (x * 100).toFixed(1).replace('.', ',')) + '%';
const radius = (pop) => 9 + Math.sqrt(pop) * 0.36;

let S = null; // stan interfejsu

export function initUI({ role, act }) {
  S = { role, act, view: null, sel: null, tab: 'map', tree: role === 'virus' ? 'trans' : 'med', nodes: {}, links: [], seenNews: 0, known: {} };
  document.body.classList.toggle('virus', role === 'virus');
  $('hudRole').textContent = role === 'virus' ? 'Patogen' : 'Obrońca';
  $('hudTrust').classList.toggle('hidden', role !== 'def');
  $('goalMark').style.left = CFG.killGoal * 100 + '%';
  $('tabUp').textContent = role === 'virus' ? 'Ewolucja' : 'Działania';
  buildMap();
  buildTreeTabs();
  $('tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); };
  $('shClose').onclick = () => select(null);
  $('upList').onclick = (e) => { const b = e.target.closest('[data-buy]'); if (b) S.act({ t: 'buy', id: b.dataset.buy }); };
  $('shActs').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pick) { S.act({ t: 'pick', r: b.dataset.pick }); select(null); }
    if (b.dataset.kind) S.act({ t: 'measure', r: S.sel, kind: b.dataset.kind, on: b.dataset.on === '1' });
  };
  setTab('map');
  // na telefonie zacznij z mapą wyśrodkowaną na Europie/Afryce
  requestAnimationFrame(() => { const w = $('mapwrap'); w.scrollLeft = (w.scrollWidth - w.clientWidth) * 0.5; });
}

function setTab(tab) {
  S.tab = tab;
  for (const b of $('tabs').children) b.classList.toggle('sel', b.dataset.tab === tab);
  $('p-map').classList.toggle('hidden', tab !== 'map');
  $('p-up').classList.toggle('hidden', tab !== 'up');
  $('p-rep').classList.toggle('hidden', tab !== 'rep');
  if (tab !== 'map') select(null);
  if (S.view) render(S.view);
}

function buildTreeTabs() {
  const trees = S.role === 'virus' ? VIRUS_TREES : DEF_TREES;
  $('treeTabs').innerHTML = trees.map((t) => `<button data-tree="${t.id}">${t.name}</button>`).join('');
  $('treeTabs').onclick = (e) => { const b = e.target.closest('button'); if (b) { S.tree = b.dataset.tree; if (S.view) render(S.view); } };
}

// ------------------------------------------------------------------ mapa
function buildMap() {
  const svg = $('map');
  svg.innerHTML = '';
  const grid = el('g', { class: 'grid' }, svg);
  for (let x = 0; x <= 1000; x += 50) el('line', { x1: x, y1: 0, x2: x, y2: 520 }, grid);
  for (let y = 20; y <= 520; y += 50) el('line', { x1: 0, y1: y, x2: 1000, y2: y }, grid);

  const gl = el('g', {}, svg);
  S.links = LINKS.map((l) => {
    const a = REGION_BY_ID[l.a], b = REGION_BY_ID[l.b];
    let d;
    if (Math.abs(a.x - b.x) > 520) { // trasa przez Pacyfik: wyjdź poza krawędzie mapy
      const [w, e] = a.x < b.x ? [a, b] : [b, a];
      const my = (w.y + e.y) / 2;
      d = `M${w.x},${w.y} L0,${my} M1000,${my} L${e.x},${e.y}`;
    } else if (l.type === 'land') d = `M${a.x},${a.y} L${b.x},${b.y}`;
    else {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
      const k = l.type === 'air' ? -0.16 : 0.14;
      d = `M${a.x},${a.y} Q${mx - dy * k},${my + dx * k} ${b.x},${b.y}`;
    }
    return { l, path: el('path', { d, class: 'link ' + l.type }, gl) };
  });

  const gn = el('g', {}, svg);
  for (const r of REGIONS) {
    const R = radius(r.pop);
    const g = el('g', { class: 'node', transform: `translate(${r.x},${r.y})` }, gn);
    el('circle', { class: 'hit', r: Math.max(R + 8, 24) }, g);
    el('circle', { class: 'base', r: R }, g);
    const inf = el('circle', { class: 'inf', r: 0 }, g);
    const dead = el('circle', { class: 'dead', r: 0 }, g);
    const label = el('text', { y: R + 14 }, g); label.textContent = r.name;
    const ico = el('text', { class: 'ico', y: -R - 5 }, g);
    g.addEventListener('click', () => select(r.id));
    S.nodes[r.id] = { g, inf, dead, ico, R };
  }
}

function select(id) {
  S.sel = id;
  for (const k in S.nodes) S.nodes[k].g.classList.toggle('sel', k === id);
  $('sheet').classList.toggle('hidden', !id);
  if (id && S.view) renderSheet(S.view);
}

// ------------------------------------------------------------- rysowanie
export function render(view) {
  S.view = view;
  const v = view, role = S.role;

  // HUD
  $('hudDay').textContent = v.phase === 'pick' ? 'Start' : `Dzień ${v.day}`;
  const left = Math.max(0, (CFG.dayCap - v.day) * CFG.dayMs / 1000);
  $('hudTime').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  $('hudMoney').textContent = (role === 'virus' ? 'DNA ' : 'Budżet ') + Math.floor(v.me.money);
  if (role === 'def') {
    $('hudTrust').textContent = 'Zaufanie ' + Math.round(v.me.trust);
    $('hudTrust').classList.toggle('low', v.me.trust < CFG.lowTrust);
  }
  const fi = v.world.I / v.world.N, fd = v.world.D / v.world.N;
  $('barInf').style.width = fi * 100 + '%';
  $('valInf').textContent = fmt(v.world.I);
  $('barDead').style.width = fd * 100 + '%';
  $('valDead').textContent = pct(fd);
  const cure = $('barCure');
  cure.classList.toggle('unknown', v.research === null);
  cure.style.width = (v.research || 0) + '%';
  $('valCure').textContent = v.research === null ? 'brak prac' : (v.researchExact ? Math.floor(v.research) + '%' : `ok. ${v.research}%`);

  // baner
  const banner = $('banner');
  let msg = '';
  if (v.phase === 'pick') {
    const sec = Math.ceil(v.pickLeft * CFG.dayMs / 1000);
    msg = role === 'virus' ? `Dotknij regionu, w którym zacznie się epidemia (${sec} s)` : `Patogen wybiera miejsce startu… (${sec} s)`;
  } else if (role === 'def' && v.phase === 'running' && !v.detected) msg = 'Brak doniesień o chorobie. Wykorzystaj ten czas na przygotowania.';
  else if (role === 'def' && v.me.trust < CFG.lowTrust) msg = 'Niskie zaufanie: ludzie łamią ograniczenia, blokady są nieszczelne.';
  banner.textContent = msg;
  banner.classList.toggle('hidden', !msg);

  // mapa
  for (const r of v.regions) {
    const n = S.nodes[r.id], meta = REGION_BY_ID[r.id], N = meta.pop * 1e6;
    const unknown = r.I === null;
    const fDead = Math.min(1, r.D / N);
    const fTot = Math.min(1, ((r.I || 0) + r.D) / N);
    // minimalny widoczny punkt, gdy w regionie jest choć jeden zakażony
    n.inf.setAttribute('r', fTot > 0 ? Math.max(3, n.R * Math.sqrt(fTot)) : 0);
    n.dead.setAttribute('r', fDead > 0.002 ? n.R * Math.sqrt(fDead) : 0);
    n.g.classList.toggle('unknown', unknown);
    n.g.classList.toggle('quar', r.quar);
    n.ico.textContent = ['air', 'sea', 'land'].filter((k) => r.closed[k]).map((k) => MEASURES[k].icon).join(' ') + (r.quar ? ' ' + MEASURES.quar.icon : '');
    const has = (r.I || 0) > 0;
    if (has && !S.known[r.id] && v.phase === 'running') { n.g.classList.remove('pulse'); void n.g.getBBox(); n.g.classList.add('pulse'); }
    S.known[r.id] = has;
  }
  const byId = Object.fromEntries(v.regions.map((r) => [r.id, r]));
  for (const { l, path } of S.links) path.classList.toggle('shut', byId[l.a].closed[l.type] || byId[l.b].closed[l.type]);

  // pasek wiadomości
  const last = v.news[v.news.length - 1];
  const tk = $('ticker');
  tk.textContent = last ? `Dzień ${last.day}: ${last.text}` : '';
  tk.className = last ? last.kind : '';
  if (last && last.n > S.seenNews) {
    if (S.tab !== 'rep' && S.seenNews) $('tabs').children[2].classList.add('dotted');
    S.seenNews = last.n;
  }
  if (S.tab === 'rep') $('tabs').children[2].classList.remove('dotted');

  // kropka na zakładce rozwoju, gdy stać nas na coś nowego
  const list = role === 'virus' ? VIRUS_UPGRADES : DEF_UPGRADES;
  const affordable = v.phase === 'running' && list.some((u) => state(u, v) === 'can');
  $('tabUp').classList.toggle('dotted', affordable && S.tab !== 'up');

  if (S.tab === 'up') renderUpgrades(v);
  if (S.tab === 'rep') renderReport(v);
  if (S.sel) renderSheet(v);
}

function costOf(u, v) { return u.cost + (u.repeatable ? (u.costStep || 0) * (v.me.shuffles || 0) : 0); }

function state(u, v) {
  if (v.me.owned[u.id] && !u.repeatable) return 'owned';
  if (u.req && !u.req.some((r) => v.me.owned[r])) return 'locked';
  if (u.needsDetection && !v.detected) return 'wait';
  return v.me.money >= costOf(u, v) ? 'can' : 'poor';
}

function renderUpgrades(v) {
  for (const b of $('treeTabs').children) b.classList.toggle('sel', b.dataset.tree === S.tree);
  const list = (S.role === 'virus' ? VIRUS_UPGRADES : DEF_UPGRADES).filter((u) => u.tree === S.tree);
  const all = S.role === 'virus' ? VIRUS_UPGRADES : DEF_UPGRADES;
  const name = (id) => all.find((u) => u.id === id).name;
  setHTML($('upList'), list.map((u) => {
    const st = state(u, v);
    let btn;
    if (st === 'owned') btn = '<span class="buy">✓ Masz</span>';
    else if (st === 'locked') btn = `<span class="buy">Wymaga:<br>${u.req.map(name).join(' lub ')}</span>`;
    else if (st === 'wait') btn = '<span class="buy">Po wykryciu</span>';
    else btn = `<button class="buy" data-buy="${u.id}" ${st === 'can' ? '' : 'disabled'}>${costOf(u, v)} ${S.role === 'virus' ? 'DNA' : 'pkt'}</button>`;
    const times = u.repeatable && v.me.shuffles ? ` (użyto ${v.me.shuffles}×)` : '';
    return `<div class="up ${st === 'wait' ? 'locked' : st}"><h4>${u.name}${times}</h4>${btn}<p>${u.desc}</p></div>`;
  }).join(''));
}

const statBar = (label, val, max, cls) => `<div class="statbar"><span>${label}</span><div class="track"><i class="fill ${cls}" style="width:${Math.min(100, val / max * 100)}%"></i></div><b class="mono">${val}</b></div>`;
const statBars = (s) => statBar('Zakaźność', s.inf, 30, 'inf') + statBar('Uciążliwość', s.sev, 18, 'cure') + statBar('Śmiertelność', s.leth, 18, 'dead');
const chips = (ids) => (ids.length ? `<div class="chips">${ids.map((id) => `<span class="chip">${VIRUS_BY_ID[id].name}</span>`).join('')}</div>` : '<span class="dim small">Brak</span>');

function renderReport(v) {
  let h = '';
  if (S.role === 'virus') {
    h += `<h5>Twój patogen</h5><div class="box">${statBars(v.stats)}</div>`;
    const m = v.regions.reduce((s, r) => s + (r.closed.air ? 1 : 0) + (r.closed.sea ? 1 : 0) + (r.closed.land ? 1 : 0) + (r.quar ? 1 : 0), 0);
    h += `<h5>Ludzkość</h5><div class="box small"><span>${v.detected ? 'Patogen został wykryty. Trwają prace nad lekiem.' : 'Nikt jeszcze nie wie o twoim istnieniu.'}</span><span>Aktywne blokady i kwarantanny: <b>${m}</b></span></div>`;
  } else {
    const e = v.enemy;
    h += '<h5>Patogen</h5><div class="box">';
    h += e.stats ? statBars(e.stats) + '<span class="dim small">Objawy:</span>' + chips(e.symp) : '<span class="dim small">Siła i objawy nieznane. Wymaga: Nadzór epidemiologiczny (Wywiad).</span>';
    h += e.traits ? '<span class="dim small">Przenoszenie i zdolności:</span>' + chips(e.traits.filter((x) => x !== 'shuffle')) + (e.shuffles ? `<span class="small">Mutacje cofające badania: ${e.shuffles}</span>` : '')
      : '<span class="dim small">Drogi przenoszenia i zdolności nieznane. Wymaga: Analiza genetyczna (Wywiad).</span>';
    h += '</div>';
  }
  const rows = v.regions.filter((r) => (r.I || 0) > 0 || r.D > 0).sort((a, b) => (b.I || 0) + b.D - (a.I || 0) - a.D);
  h += `<h5>Regiony z chorobą (${rows.length}/${v.regions.length})</h5><div class="box">`;
  h += rows.length ? `<table><tr><th>Region</th><th>Zakażeni</th><th>Zgony</th><th></th></tr>${rows.map((r) => `<tr><td>${REGION_BY_ID[r.id].name}</td><td>${fmt(r.I)}</td><td>${fmt(r.D)}</td><td>${['air', 'sea', 'land'].filter((k) => r.closed[k]).map((k) => MEASURES[k].icon).join('')}${r.quar ? MEASURES.quar.icon : ''}</td></tr>`).join('')}</table>`
    : '<span class="dim small">Brak znanych ognisk.</span>';
  h += '</div><h5>Wiadomości</h5><div class="box feed">';
  h += v.news.length ? v.news.slice().reverse().map((n) => `<div class="${n.kind}"><span class="dim mono">d. ${n.day}</span><span>${n.text}</span></div>`).join('') : '<span class="dim small">Cisza.</span>';
  h += '</div>';
  setHTML($('report'), h);
}

function renderSheet(v) {
  const r = v.regions.find((x) => x.id === S.sel), meta = REGION_BY_ID[S.sel], N = meta.pop * 1e6;
  $('shName').textContent = meta.name;
  $('shMeta').textContent = `Ludność ${fmt(N)} · klimat ${CLIMATE_NAMES[meta.climate]} · ${WEALTH_NAMES[meta.wealth]}`;
  const unk = r.I === null;
  setHTML($('shStats'), `<div><small>Zdrowi</small><b>${unk ? 'brak danych' : fmt(Math.max(0, N - r.I - r.D))}</b></div><div><small>Zakażeni</small><b>${unk ? 'brak danych' : fmt(r.I)}</b></div><div><small>Zgony</small><b>${fmt(r.D)}</b></div>`);
  const con = { land: [], air: [], sea: [] };
  for (const l of LINKS) if (l.a === S.sel || l.b === S.sel) con[l.type].push(REGION_BY_ID[l.a === S.sel ? l.b : l.a].name);
  $('shLinks').textContent = [['Ląd', con.land], ['✈', con.air], ['⚓', con.sea]].filter(([, a]) => a.length).map(([k, a]) => `${k}: ${a.join(', ')}`).join('  ·  ');

  let h = '';
  if (S.role === 'virus' && v.phase === 'pick') h = `<button class="btn primary wide" data-pick="${S.sel}">Zacznij epidemię tutaj</button>`;
  else if (S.role === 'def' && v.phase === 'running') {
    for (const k of ['air', 'sea', 'land', 'quar']) {
      if (k !== 'quar' && !con[k].length) continue;
      const m = MEASURES[k], on = k === 'quar' ? r.quar : r.closed[k], un = v.me.unlock[k];
      if (!un) h += `<button class="btn" disabled>${m.icon} ${m.name}<small>odblokuj w: Działania → Kontrola</small></button>`;
      else if (on) h += `<button class="btn on" data-kind="${k}" data-on="0">${m.icon} ${m.off}<small>aktywne</small></button>`;
      else h += `<button class="btn" data-kind="${k}" data-on="1" ${v.me.money >= m.cost ? '' : 'disabled'}>${m.icon} ${m.name}<small>${m.cost} pkt · zaufanie −${m.trust}</small></button>`;
    }
  }
  setHTML($('shActs'), h);
}

// --------------------------------------------------------- komunikaty
let toastTimer;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

export function overlay(html) {
  $('overlay').classList.toggle('hidden', !html);
  if (html) setHTML($('overlayBox'), html);
}

export function endScreen(v) {
  const won = v.winner === S.role;
  const names = (ids, by) => ids.map((id) => by.find((u) => u.id === id)?.name).filter(Boolean).join(', ') || 'nic';
  overlay(`<h2 class="${won ? 'win' : 'lose'}">${won ? 'Zwycięstwo' : 'Porażka'}</h2>
    <p>${v.reason}</p>
    <p class="small dim">Dzień ${v.day} · zgony ${pct(v.world.D / v.world.N)} · lek ${Math.floor(v.research)}%</p>
    <p class="small dim"><b>Patogen:</b> ${names(v.final.virusOwned, VIRUS_UPGRADES)}</p>
    <p class="small dim"><b>Obrońca:</b> ${names(v.final.defOwned, DEF_UPGRADES)}</p>
    <button class="btn primary" onclick="location.href=location.pathname+location.search.replace(/[?&]join=[^&]*/,'')">Wróć do menu</button>
    <button class="btn" onclick="document.getElementById('overlay').classList.add('hidden')">Obejrzyj mapę</button>`);
}
