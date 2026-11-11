// Symulacja balansu: bot kontra bot, bez interfejsu.  Uruchom: npm run sim
import { createGame, step, applyAction, viewFor, CFG, TOTAL_POP } from '../js/game.js';
import { makeBot } from '../js/bot.js';

const N = Number(process.argv[2] || 200);
const res = { virus: 0, def: 0 };
const reasons = {};
let days = 0, detDay = 0, deadSum = 0;

for (let i = 0; i < N; i++) {
  const g = createGame();
  const bots = { virus: makeBot('virus'), def: makeBot('def') };
  let det = null;
  while (g.phase !== 'over') {
    for (const role of ['virus', 'def']) for (const a of bots[role](viewFor(g, role))) applyAction(g, role, a);
    step(g);
    if (det === null && g.detected) det = g.day;
  }
  res[g.winner]++;
  reasons[g.reason] = (reasons[g.reason] || 0) + 1;
  days += g.day; detDay += det ?? g.day;
  deadSum += g.regions.reduce((s, r) => s + r.D, 0) / TOTAL_POP;
}
console.log(`gier: ${N}  wirus: ${res.virus}  obrońca: ${res.def}`);
console.log(`średnio dni: ${(days / N).toFixed(0)} (${(days / N * CFG.dayMs / 60000).toFixed(1)} min)  wykrycie: dzień ${(detDay / N).toFixed(0)}  zgony: ${(100 * deadSum / N).toFixed(0)}%`);
console.log(reasons);
