// Połączenie między dwoma telefonami.
// Domyślnie: WebRTC przez PeerJS (bezpośrednio telefon–telefon, bez własnego serwera).
// Z parametrem ?local=1: BroadcastChannel (dwie karty tej samej przeglądarki, do testów).

const PREFIX = 'ognisko-v1-';
const LOCAL = new URLSearchParams(location.search).has('local');

export function makeCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
}

// Wspólny kształt połączenia: { send(obj), onMessage, onClose, close() }
function link() {
  return { send() {}, close() {}, onMessage: null, onClose: null };
}

// ----------------------------------------------------------- PeerJS
function wrapConn(conn) {
  const l = link();
  l.send = (o) => { if (conn.open) conn.send(o); };
  l.close = () => conn.close();
  conn.on('data', (d) => l.onMessage && l.onMessage(d));
  conn.on('close', () => l.onClose && l.onClose());
  conn.on('error', () => l.onClose && l.onClose());
  return l;
}

function peerError(e) {
  const t = e && e.type;
  if (t === 'unavailable-id') return 'Ten kod jest już zajęty. Spróbuj ponownie.';
  if (t === 'peer-unavailable') return 'Nie znaleziono gry o tym kodzie.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error') return 'Brak połączenia z serwerem pośredniczącym. Sprawdź internet.';
  if (t === 'browser-incompatible') return 'Ta przeglądarka nie obsługuje połączeń WebRTC.';
  return 'Błąd połączenia' + (t ? ` (${t})` : '') + '.';
}

function hostPeer(code, onGuest, onError) {
  const peer = new window.Peer(PREFIX + code);
  peer.on('connection', (conn) => conn.on('open', () => onGuest(wrapConn(conn))));
  peer.on('error', (e) => onError(peerError(e)));
  peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* zamknięty */ } });
  return new Promise((resolve) => peer.on('open', () => resolve({ close: () => peer.destroy() })));
}

function joinPeer(code, onError) {
  const peer = new window.Peer();
  peer.on('error', (e) => onError(peerError(e)));
  return new Promise((resolve) => {
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true });
      const timer = setTimeout(() => onError('Nie udało się połączyć z drugim telefonem. Spróbujcie innej sieci (np. Wi-Fi zamiast danych komórkowych).'), 15000);
      conn.on('open', () => { clearTimeout(timer); const l = wrapConn(conn); const c = l.close; l.close = () => { c(); peer.destroy(); }; resolve(l); });
    });
  });
}

// ------------------------------------------------- BroadcastChannel
function hostLocal(code, onGuest) {
  const ch = new BroadcastChannel(PREFIX + code);
  let cur = null;
  ch.onmessage = (e) => {
    const m = e.data;
    if (m.from !== 'guest') return;
    if (m.sys === 'open') {
      cur = link();
      cur.send = (o) => ch.postMessage({ from: 'host', data: o });
      onGuest(cur);
    } else if (m.sys === 'close') { if (cur && cur.onClose) cur.onClose(); cur = null; } else if (cur && cur.onMessage) cur.onMessage(m.data);
  };
  return Promise.resolve({ close: () => ch.close() });
}

function joinLocal(code) {
  const ch = new BroadcastChannel(PREFIX + code);
  const l = link();
  l.send = (o) => ch.postMessage({ from: 'guest', data: o });
  l.close = () => { ch.postMessage({ from: 'guest', sys: 'close' }); ch.close(); };
  ch.onmessage = (e) => { if (e.data.from === 'host' && l.onMessage) l.onMessage(e.data.data); };
  ch.postMessage({ from: 'guest', sys: 'open' });
  addEventListener('pagehide', () => ch.postMessage({ from: 'guest', sys: 'close' }));
  return Promise.resolve(l);
}

export const hostRoom = (code, onGuest, onError) => (LOCAL ? hostLocal(code, onGuest) : hostPeer(code, onGuest, onError));
export const joinRoom = (code, onError) => (LOCAL ? joinLocal(code) : joinPeer(code, onError));
