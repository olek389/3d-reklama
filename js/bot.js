// Prosty przeciwnik komputerowy dla obu ról. Bot korzysta wyłącznie z widoku
// swojej roli (viewFor), więc podlega tej samej mgle wojny co gracz.
import { VIRUS_UPGRADES, DEF_BY_ID, VIRUS_BY_ID, REGIONS, MEASURES } from './data.js';

const VIRUS_START = ['ind', 'chn', 'sea', 'waf', 'eaf', 'bra', 'mea', 'idn'];

const DEF_ORDER = [
  'i_test', 'm_lab', 'c_air', 'm_seq', 'm_hosp', 'c_quar', 'm_cons', 'i_coop', 'c_port',
  'm_antiv', 'm_trial', 'c_dist', 'c_border', 'm_immun', 'i_surv', 'c_water', 'c_vector',
  'i_media', 'i_gen', 'i_stab', 'i_model',
];

export function makeBot(role, skill = 1) {
  let cooldown = 0;
  return function act(view) {
    if (view.phase === 'pick') {
      return role === 'virus' ? [{ t: 'pick', r: VIRUS_START[Math.floor(Math.random() * VIRUS_START.length)] }] : [];
    }
    if (view.phase !== 'running') return [];
    if (cooldown-- > 0) return [];
    cooldown = Math.round(4 / skill);
    return role === 'virus' ? virusBot(view) : defBot(view);
  };
}

function virusBot(view) {
  const { money, owned, shuffles } = view.me;
  const infFrac = view.world.I / view.world.N;
  const can = (u) => (!owned[u.id] || u.repeatable) && (!u.req || u.req.some((r) => owned[r]));
  const costOf = (u) => u.cost + (u.repeatable ? u.costStep * shuffles : 0);

  // ratuj się przed lekiem
  if (view.research !== null && view.research >= 50) {
    const s = VIRUS_BY_ID.shuffle;
    if (money >= costOf(s)) return [{ t: 'buy', id: 'shuffle' }];
  }
  let pool;
  if (infFrac < 0.35) {
    pool = VIRUS_UPGRADES.filter((u) => can(u) && u.id !== 'shuffle' && (u.tree !== 'symp' || !u.fx.leth));
  } else {
    pool = VIRUS_UPGRADES.filter((u) => can(u) && u.id !== 'shuffle' && u.tree === 'symp');
    if (!pool.length) pool = VIRUS_UPGRADES.filter((u) => can(u) && u.id !== 'shuffle');
  }
  if (!pool.length) return [];
  pool.sort((a, b) => costOf(a) - costOf(b));
  const pick = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
  return money >= costOf(pick) ? [{ t: 'buy', id: pick.id }] : [];
}

function defBot(view) {
  const { money, owned, trust, unlock } = view.me;
  const acts = [];
  let budget = money;
  // działania w regionach
  for (const r of view.regions) {
    if (r.I === null) continue;
    const pop = REGIONS.find((x) => x.id === r.id).pop * 1e6;
    const f = r.I / pop;
    if (unlock.air && !r.closed.air && f > 0.002 && f < 0.5 && trust > 45 && budget >= MEASURES.air.cost + 6) {
      acts.push({ t: 'measure', r: r.id, kind: 'air', on: true }); budget -= MEASURES.air.cost; break;
    }
    if (unlock.quar && !r.quar && f > 0.01 && f < 0.4 && trust > 55 && budget >= MEASURES.quar.cost + 6) {
      acts.push({ t: 'measure', r: r.id, kind: 'quar', on: true }); budget -= MEASURES.quar.cost; break;
    }
    // zdejmij środki tam, gdzie już nic nie dają
    if (f > 0.8 || trust < 30) {
      for (const k of ['air', 'sea', 'land']) if (r.closed[k]) { acts.push({ t: 'measure', r: r.id, kind: k, on: false }); break; }
      if (r.quar) acts.push({ t: 'measure', r: r.id, kind: 'quar', on: false });
      if (acts.length) break;
    }
  }
  if (acts.length) return acts;
  const next = DEF_ORDER.find((id) => !owned[id] && (!DEF_BY_ID[id].req || DEF_BY_ID[id].req.some((q) => owned[q])));
  if (next && budget >= DEF_BY_ID[next].cost) acts.push({ t: 'buy', id: next });
  return acts;
}
