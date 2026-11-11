// Czysta logika gry (bez DOM i sieci). Działa w przeglądarce i w Node.
import {
  REGIONS, LINKS, LINK_NAMES, VIRUS_UPGRADES, DEF_UPGRADES, VIRUS_BY_ID, DEF_BY_ID, MEASURES,
} from './data.js';

export const CFG = {
  dayMs: 500, // 1 dzień gry = pół sekundy
  dayCap: 1500, // limit czasu: 12,5 minuty
  killGoal: 0.6, // wirus wygrywa po zabiciu tylu ludzi
  pickDays: 60, // czas na wybór regionu startowego (w tikach)
  seed: 3, // liczba pierwszych zakażonych
  betaBase: 0.032,
  betaPerInf: 0.0075,
  deathK: 0.00042,
  spread: { land: 0.6, air: 0.22, sea: 0.14 },
  leak: 0.04, // szczelność zamkniętych połączeń
  quarantine: 0.35,
  researchBase: 0.047,
  detectFrac: 0.0002,
  virusStartDna: 12,
  defStartBudget: 12,
  trustStart: 70,
  lowTrust: 35,
};

const TOTAL_POP = REGIONS.reduce((s, r) => s + r.pop * 1e6, 0);

export function createGame() {
  return {
    day: 0,
    pickTicks: 0,
    phase: 'pick', // pick -> running -> over
    winner: null,
    reason: '',
    regions: REGIONS.map((r) => ({
      id: r.id, N: r.pop * 1e6, I: 0, D: 0, detected: false, everInfected: false,
      noise: 0.75 + Math.random() * 0.5,
      closed: { air: false, sea: false, land: false }, quar: false,
    })),
    virus: { dna: CFG.virusStartDna, owned: {}, shuffles: 0 },
    def: { budget: CFG.defStartBudget, owned: {}, trust: CFG.trustStart },
    research: 0,
    detected: false,
    news: [],
    newsSeq: 0,
  };
}

function news(g, to, text, kind = 'info') {
  g.news.push({ n: ++g.newsSeq, day: g.day, to, text, kind });
  if (g.news.length > 120) g.news.splice(0, g.news.length - 120);
}

const regionName = (id) => REGIONS.find((r) => r.id === id).name;

// ------------------------------------------------------------ statystyki
export function virusStats(g) {
  const s = { inf: 0, sev: 0, leth: 0, infAir: 0, infWater: 0, infVector: 0, air: 0, water: 0, vector: 0, land: 0, cold: 0, heat: 0, drug: 0, stealth: 0, harden: 0 };
  for (const id in g.virus.owned) {
    const fx = VIRUS_BY_ID[id].fx;
    for (const k in fx) s[k] += fx[k];
  }
  return s;
}

export function defStats(g) {
  const s = { research: 1, leth: 1, immun: 1, cutAir: 1, cutWater: 1, cutVector: 1, budget: 1, trustRegen: 0, tests: 0, surv: 0, gen: 0, stab: 0, model: 0, unlock: {} };
  for (const id in g.def.owned) {
    const fx = DEF_BY_ID[id].fx;
    for (const k in fx) {
      if (k === 'unlock') s.unlock[fx[k]] = true;
      else if (k === 'trustNow') continue;
      else if (['research', 'leth', 'immun', 'cutAir', 'cutWater', 'cutVector', 'budget'].includes(k)) s[k] *= fx[k];
      else s[k] += fx[k];
    }
  }
  return s;
}

export function upgradeCost(g, role, id) {
  if (role === 'virus') {
    const u = VIRUS_BY_ID[id];
    return u.cost + (u.repeatable ? (u.costStep || 0) * g.virus.shuffles : 0);
  }
  return DEF_BY_ID[id].cost;
}

// Zwraca null gdy można kupić, inaczej powód odmowy.
export function buyBlock(g, role, id) {
  const u = role === 'virus' ? VIRUS_BY_ID[id] : DEF_BY_ID[id];
  if (!u) return 'Nieznane ulepszenie';
  const me = role === 'virus' ? g.virus : g.def;
  if (me.owned[id] && !u.repeatable) return 'Już kupione';
  if (u.req && !u.req.some((r) => me.owned[r])) return 'Zablokowane';
  if (u.needsDetection && !g.detected) return 'Dostępne po wykryciu patogenu';
  const money = role === 'virus' ? me.dna : me.budget;
  if (money < upgradeCost(g, role, id)) return 'Za mało punktów';
  return null;
}

// --------------------------------------------------------------- akcje
export function applyAction(g, role, a) {
  if (!a || g.phase === 'over') return { ok: false, msg: 'Gra zakończona' };
  if (a.t === 'pick') {
    if (role !== 'virus' || g.phase !== 'pick') return { ok: false };
    return startAt(g, a.r);
  }
  if (g.phase !== 'running') return { ok: false, msg: 'Gra jeszcze się nie zaczęła' };
  if (a.t === 'buy') {
    const block = buyBlock(g, role, a.id);
    if (block) return { ok: false, msg: block };
    const cost = upgradeCost(g, role, a.id);
    if (role === 'virus') {
      g.virus.dna -= cost;
      g.virus.owned[a.id] = true;
      if (a.id === 'shuffle') {
        g.virus.shuffles++;
        const cut = defStats(g).stab ? 5 : 10;
        g.research = Math.max(0, g.research - cut);
        news(g, 'def', 'Patogen zmutował. Część badań nad lekiem trzeba powtórzyć.', 'bad');
      }
    } else {
      g.def.budget -= cost;
      g.def.owned[a.id] = true;
      const t = DEF_BY_ID[a.id].fx.trustNow;
      if (t) g.def.trust = clamp(g.def.trust + t, 0, 100);
    }
    return { ok: true };
  }
  if (a.t === 'measure') {
    if (role !== 'def') return { ok: false };
    const r = g.regions.find((x) => x.id === a.r);
    const m = MEASURES[a.kind];
    if (!r || !m) return { ok: false };
    if (!defStats(g).unlock[a.kind]) return { ok: false, msg: 'Najpierw odblokuj to działanie w drzewku Kontrola' };
    const cur = a.kind === 'quar' ? r.quar : r.closed[a.kind];
    if (!!a.on === cur) return { ok: false };
    if (a.on) {
      if (g.def.budget < m.cost) return { ok: false, msg: 'Za mały budżet' };
      g.def.budget -= m.cost;
      g.def.trust = clamp(g.def.trust - m.trust, 0, 100);
    }
    if (a.kind === 'quar') r.quar = !!a.on; else r.closed[a.kind] = !!a.on;
    const what = { air: 'lotnisko', sea: 'port', land: 'granice lądowe', quar: 'kwarantanna' }[a.kind];
    news(g, 'virus', `${regionName(r.id)}: ${what} – ${a.on ? (a.kind === 'quar' ? 'wprowadzona' : 'zamknięte') : (a.kind === 'quar' ? 'zniesiona' : 'otwarte')}.`, a.on ? 'bad' : 'good');
    return { ok: true };
  }
  return { ok: false };
}

function startAt(g, rid) {
  const r = g.regions.find((x) => x.id === rid);
  if (!r) return { ok: false };
  r.I = CFG.seed;
  r.everInfected = true;
  g.phase = 'running';
  news(g, 'virus', `Pacjent zero: ${regionName(rid)}.`, 'good');
  news(g, 'def', 'Świat jest spokojny. Przygotuj się, zanim pojawi się zagrożenie.');
  return { ok: true };
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ------------------------------------------------------------ symulacja
export function step(g) {
  if (g.phase === 'pick') {
    if (++g.pickTicks >= CFG.pickDays) startAt(g, g.regions[Math.floor(Math.random() * g.regions.length)].id);
    return;
  }
  if (g.phase !== 'running') return;
  g.day++;
  const v = virusStats(g);
  const d = defStats(g);
  const lowTrust = g.def.trust < CFG.lowTrust;

  const infPts = v.inf + v.infAir * d.cutAir + v.infWater * d.cutWater + v.infVector * d.cutVector;
  const beta0 = CFG.betaBase + CFG.betaPerInf * infPts;
  const treat = 1 - (1 - d.leth) * Math.max(0, 1 - 0.4 * v.drug); // lekooporność osłabia leczenie
  const quarMod = Math.min(1, (lowTrust ? 0.6 : CFG.quarantine) + 0.25 * v.harden);
  const leak = Math.min(1, CFG.leak * (lowTrust ? 3 : 1) * (1 + 3 * v.harden));

  let dInf = 0, dDead = 0, totI = 0, totD = 0;
  const byId = {};
  g.regions.forEach((r, i) => {
    byId[r.id] = r;
    const meta = REGIONS[i];
    if (r.I > 0) {
      const alive = r.N - r.D;
      const S = Math.max(0, alive - r.I);
      let b = beta0;
      if (meta.climate === 'cold') b *= Math.min(1, 0.5 + 0.5 * v.cold);
      if (meta.climate === 'hot') b *= Math.min(1, 0.5 + 0.5 * v.heat);
      if (meta.wealth === 2) b *= Math.min(1, 0.6 + 0.2 * v.drug) * d.immun;
      else if (meta.wealth === 1) b *= Math.min(1, 0.8 + 0.1 * v.drug) * d.immun;
      else b *= 1 + 0.1 * v.vector * d.cutVector;
      if (r.quar) b *= quarMod;
      const newI = Math.min(S, r.I * b * (alive > 0 ? S / alive : 0));
      const deaths = Math.min(r.I, r.I * v.leth * CFG.deathK * treat * (meta.wealth === 0 ? 1.2 : meta.wealth === 2 ? 0.8 : 1));
      r.I += newI - deaths;
      r.D += deaths;
      dInf += newI; dDead += deaths;
      if (r.I < 0.5) r.I = 0;
    }
    totI += r.I; totD += r.D;
  });

  // rozprzestrzenianie między regionami
  const mult = { land: 1 + 0.8 * v.land, air: 1 + 1.0 * v.air * d.cutAir, sea: 1 + 1.0 * v.water * d.cutWater };
  let newRegions = 0;
  for (const l of LINKS) {
    for (const [src, dst] of [[byId[l.a], byId[l.b]], [byId[l.b], byId[l.a]]]) {
      if (src.I <= 0 || dst.I > 0 || dst.N - dst.D < 1) continue;
      let p = CFG.spread[l.type] * Math.sqrt(src.I / src.N) * mult[l.type] * 0.12;
      if (src.closed[l.type] || dst.closed[l.type]) p *= leak;
      if (src.quar) p *= quarMod;
      if (Math.random() < p) {
        dst.I = CFG.seed;
        if (!dst.everInfected) { dst.everInfected = true; newRegions++; }
        news(g, 'virus', `Nowe ognisko: ${regionName(dst.id)} (${LINK_NAMES[l.type]} z: ${regionName(src.id)}).`, 'good');
      }
    }
  }

  // wykrywanie
  const thrMod = (v.stealth ? 3 : 1) * (d.tests ? 0.25 : 1) / (1 + 0.2 * v.sev);
  for (const r of g.regions) {
    if (r.detected) continue;
    if (r.I >= r.N * CFG.detectFrac * thrMod || r.D >= 10) {
      r.detected = true;
      news(g, 'def', `Wykryto ognisko choroby: ${regionName(r.id)}.`, 'bad');
      if (!g.detected) {
        g.detected = true;
        news(g, 'def', 'Rozpoczęto prace nad lekiem.', 'good');
        news(g, 'virus', 'Ludzkość wykryła patogen. Ruszyły prace nad lekiem.', 'bad');
      }
    }
  }

  // badania nad lekiem
  const deadFrac = totD / TOTAL_POP;
  if (g.detected) {
    const before = g.research;
    g.research += CFG.researchBase * d.research * (1 + 0.05 * v.sev) * (v.stealth ? 0.8 : 1) * (1 - 0.8 * deadFrac);
    const tier = Math.floor(g.research / 25);
    if (tier > Math.floor(before / 25) && tier < 4) news(g, 'virus', `Prace nad lekiem przekroczyły ${tier * 25}%.`, 'bad');
  }

  // dochody
  g.virus.dna += 0.07 + 2.5 * newRegions + 45 * (dInf / TOTAL_POP) + 40 * (dDead / TOTAL_POP);
  g.def.budget += (0.1 + (g.detected ? 0.1 : 0)) * d.budget * (1 - 0.7 * deadFrac);

  // zaufanie społeczne
  let active = 0;
  for (const r of g.regions) active += (r.closed.air ? 1 : 0) + (r.closed.sea ? 1 : 0) + (r.closed.land ? 1 : 0) + (r.quar ? 2 : 0);
  g.def.trust = clamp(g.def.trust + 0.04 + 0.06 * d.trustRegen - 0.012 * active, 0, 100);

  // koniec gry
  if (deadFrac >= CFG.killGoal) end(g, 'virus', `Patogen zabił ${Math.round(CFG.killGoal * 100)}% ludzkości.`);
  else if (g.research >= 100) { g.research = 100; end(g, 'def', 'Lek został ukończony. Ludzkość przetrwała.'); }
  else if (totI <= 0) end(g, 'def', 'Patogen wygasł – zabrakło mu nosicieli.');
  else if (g.day >= CFG.dayCap) end(g, 'def', 'Czas minął. Patogen nie zdołał pokonać ludzkości.');
}

function end(g, winner, reason) {
  g.phase = 'over';
  g.winner = winner;
  g.reason = reason;
}

// ---------------------------------------------------- widok dla gracza
// Jedyna rzecz, jaką dostaje interfejs. Tu działa mgła wojny.
export function viewFor(g, role) {
  const over = g.phase === 'over';
  const v = virusStats(g);
  const d = defStats(g);
  const full = role === 'virus' || over;
  let knownI = 0, totD = 0;
  const regions = g.regions.map((r) => {
    let I = null;
    if (full || (d.tests && (r.detected || d.model))) I = r.I;
    else if (r.detected || d.model) I = Math.min(r.N - r.D, r.I * r.noise);
    if (I !== null) knownI += I;
    totD += r.D;
    return { id: r.id, I: I === null ? null : Math.round(I), D: Math.round(r.D), detected: r.detected, closed: { ...r.closed }, quar: r.quar };
  });
  const out = {
    role, day: g.day, phase: g.phase, winner: g.winner, reason: g.reason,
    pickLeft: Math.max(0, CFG.pickDays - g.pickTicks),
    detected: g.detected,
    world: { N: TOTAL_POP, I: knownI, D: totD },
    regions,
    news: g.news.filter((n) => n.to === role || n.to === 'all').slice(-25),
  };
  if (role === 'virus') {
    out.me = { money: g.virus.dna, owned: { ...g.virus.owned }, shuffles: g.virus.shuffles };
    out.stats = { inf: v.inf + v.infAir + v.infWater + v.infVector, sev: v.sev, leth: v.leth };
    out.research = over ? g.research : (g.detected ? Math.floor(g.research / 10) * 10 : null);
    out.researchExact = over;
  } else {
    out.me = { money: g.def.budget, owned: { ...g.def.owned }, trust: g.def.trust, unlock: d.unlock };
    out.research = g.research;
    out.researchExact = true;
    const enemy = {};
    if (d.surv || over) {
      enemy.stats = { inf: v.inf + v.infAir + v.infWater + v.infVector, sev: v.sev, leth: v.leth };
      enemy.symp = VIRUS_UPGRADES.filter((u) => u.tree === 'symp' && g.virus.owned[u.id]).map((u) => u.id);
    }
    if (d.gen || over) {
      enemy.traits = VIRUS_UPGRADES.filter((u) => u.tree !== 'symp' && g.virus.owned[u.id]).map((u) => u.id);
      enemy.shuffles = g.virus.shuffles;
    }
    out.enemy = enemy;
  }
  if (over) {
    out.final = {
      virusOwned: Object.keys(g.virus.owned), defOwned: Object.keys(g.def.owned),
    };
  }
  return out;
}

export { TOTAL_POP, DEF_UPGRADES };
