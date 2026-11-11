// Przepływ aplikacji: menu -> poczekalnia -> gra. Telefon twórcy gry prowadzi symulację.
import { createGame, step, applyAction, viewFor, CFG } from './game.js';
import { makeBot } from './bot.js';
import { makeCode, hostRoom, joinRoom } from './net.js';
import { initUI, render, toast, overlay, endScreen } from './ui.js';

const $ = (id) => document.getElementById(id);
const other = (role) => (role === 'virus' ? 'def' : 'virus');
const show = (id) => ['home', 'lobby', 'game'].forEach((s) => $(s).classList.toggle('hidden', s !== id));
const ROLE_NAME = { virus: 'Patogen', def: 'Obrońca' };

let myRole = 'virus';
let room = null; // otwarty pokój (host)

// ------------------------------------------------------------------ menu
$('rolePick').onclick = (e) => {
  const b = e.target.closest('.role'); if (!b) return;
  myRole = b.dataset.role;
  for (const x of $('rolePick').children) x.classList.toggle('sel', x === b);
  document.body.classList.toggle('virus', myRole === 'virus');
};
document.body.classList.add('virus');

$('btnBot').onclick = () => runHost({ role: myRole, bot: makeBot(other(myRole)) });
$('btnCreate').onclick = createRoom;
$('btnJoin').onclick = () => join($('codeInput').value);
$('codeInput').oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); };
$('codeInput').onkeydown = (e) => { if (e.key === 'Enter') join(e.target.value); };
$('btnCancel').onclick = () => { if (room) room.close(); location.href = location.pathname + (location.search.includes('local') ? '?local=1' : ''); };

const joinParam = new URLSearchParams(location.search).get('join');
if (joinParam) { $('codeInput').value = joinParam.toUpperCase().slice(0, 4); join(joinParam); }

function fail(msg) {
  show('home');
  $('homeErr').textContent = msg;
}

async function keepAwake() {
  try {
    if (!navigator.wakeLock) return;
    await navigator.wakeLock.request('screen');
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(() => {}); });
  } catch { /* brak zgody – trudno */ }
}

// ------------------------------------------------------- tworzenie gry
async function createRoom() {
  const code = makeCode();
  const role = myRole;
  show('lobby');
  $('lobbyCode').textContent = code;
  $('lobbyMsg').textContent = 'Łączenie z serwerem…';
  let host = null;
  room = await hostRoom(code, (guest) => {
    if (host) host.attach(guest); // powrót po rozłączeniu
    else host = runHost({ role, guest, code });
  }, (msg) => { if (!host) fail(msg); });
  $('lobbyMsg').textContent = `Grasz jako: ${ROLE_NAME[role]}. Podaj ten kod przeciwnikowi i nie zamykaj tej strony.`;
  const url = `${location.origin}${location.pathname}?join=${code}`;
  const share = $('btnShare');
  share.classList.remove('hidden');
  share.onclick = async () => {
    const text = `Zagraj ze mną w OGNISKO. Kod gry: ${code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'OGNISKO', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); share.textContent = 'Skopiowano link'; }
    } catch { /* anulowano */ }
  };
}

// --------------------------------------------------- prowadzenie gry
function runHost({ role, guest = null, bot = null, code = '' }) {
  const g = createGame();
  const remote = other(role);
  let paused = false, lastPing = Date.now(), ended = false;

  const push = () => {
    const mine = viewFor(g, role);
    render(mine);
    if (guest) guest.send({ t: 'view', v: viewFor(g, remote) });
    if (g.phase === 'over' && !ended) { ended = true; clearInterval(timer); endScreen(mine); }
  };
  const act = (a) => {
    const r = applyAction(g, role, a);
    if (!r.ok && r.msg) toast(r.msg);
    push();
  };
  const setPaused = (p, why) => {
    if (p === paused || ended) return;
    paused = p;
    overlay(p ? `<h2>Pauza</h2><p>${why}</p><p class="small dim">Kod gry: <b>${code}</b>. Gra ruszy, gdy przeciwnik wróci.</p>` : '');
  };
  const attach = (link) => {
    guest = link;
    lastPing = Date.now();
    link.onMessage = (m) => {
      lastPing = Date.now();
      if (m.t === 'hello') { link.send({ t: 'welcome', role: remote }); setPaused(false); push(); }
      if (m.t === 'act') {
        const r = applyAction(g, remote, m.a);
        if (!r.ok && r.msg) link.send({ t: 'toast', msg: r.msg });
        push();
      }
    };
    link.onClose = () => { if (guest === link) setPaused(true, 'Przeciwnik się rozłączył.'); };
  };

  show('game');
  initUI({ role, act });
  keepAwake();
  if (guest) attach(guest);

  const timer = setInterval(() => {
    if (guest && !bot) {
      const silent = Date.now() - lastPing > 6000;
      if (silent) setPaused(true, 'Przeciwnik nie odpowiada (zablokowany ekran lub słaby internet).');
      else if (paused) setPaused(false);
    }
    if (paused) return;
    if (bot) for (const a of bot(viewFor(g, remote))) applyAction(g, remote, a);
    step(g);
    push();
  }, CFG.dayMs);
  push();
  return { attach };
}

// ---------------------------------------------------------- dołączanie
async function join(raw) {
  const code = (raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 4) { $('homeErr').textContent = 'Kod ma 4 litery.'; return; }
  show('lobby');
  $('lobbyCode').textContent = code;
  $('lobbyMsg').textContent = 'Łączenie z przeciwnikiem…';
  $('btnShare').classList.add('hidden');
  let started = false, over = false, lastView = Date.now();
  const link = await joinRoom(code, (msg) => { if (!started) fail(msg); });

  link.onMessage = (m) => {
    if (m.t === 'welcome') {
      started = true;
      show('game');
      initUI({ role: m.role, act: (a) => link.send({ t: 'act', a }) });
      keepAwake();
    }
    if (m.t === 'toast') toast(m.msg);
    if (m.t === 'view' && started) {
      lastView = Date.now();
      if (!over) overlay('');
      render(m.v);
      if (m.v.phase === 'over' && !over) { over = true; endScreen(m.v); }
    }
  };
  const lost = () => { if (!over) overlay(`<h2>Brak połączenia</h2><p>Utracono łączność z przeciwnikiem.</p><button class="btn primary" onclick="location.href=location.pathname+'?join=${code}${location.search.includes('local') ? '&local=1' : ''}'">Połącz ponownie</button>`); };
  link.onClose = lost;
  link.send({ t: 'hello' });
  setInterval(() => {
    link.send({ t: 'ping' });
    if (started && !over && Date.now() - lastView > 8000) overlay('<h2>Pauza</h2><p>Czekam na przeciwnika…</p>');
  }, 2000);
}
