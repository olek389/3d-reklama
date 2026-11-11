// Połączenie między dwoma telefonami przez publiczny przekaźnik wiadomości (MQTT po WebSocket).
// Oba telefony łączą się tylko „na zewnątrz”, więc działa to w dowolnej sieci (Wi-Fi, dane komórkowe).
// Dla pewności używamy kilku przekaźników naraz: każda wiadomość idzie wszystkimi, odbiorca odrzuca duplikaty.
// Z parametrem ?local=1: BroadcastChannel (dwie karty tej samej przeglądarki, do testów bez internetu).

const QS = new URLSearchParams(location.search);
const LOCAL = QS.has('local');
const BROKERS = QS.get('broker') ? QS.get('broker').split(',') : [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];
const TOPIC = 'ognisko/v1/';

export function makeCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
}

const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Wspólny kształt połączenia: { send(obj), onMessage, onClose, close() }
function link() {
  return { send() {}, close() {}, onMessage: null, onClose: null };
}

// ------------------------------------------------ minimalny klient MQTT 3.1.1
const enc = new TextEncoder();
const dec = new TextDecoder();

function str(s) {
  const b = enc.encode(s);
  return [b.length >> 8, b.length & 255, ...b];
}

function packet(type, body) {
  const len = [];
  let n = body.length;
  do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; len.push(d); } while (n > 0);
  const out = new Uint8Array(1 + len.length + body.length);
  out[0] = type;
  out.set(len, 1);
  out.set(body, 1 + len.length);
  return out;
}

// Jeden przekaźnik: łączy się, subskrybuje temat i sam wznawia połączenie po zerwaniu.
function broker(url, subTopic, onPayload, onState) {
  let ws = null, up = false, closed = false, buf = new Uint8Array(0), ping = null, retry = null, lastRx = 0;

  const open = () => {
    if (closed) return;
    try { ws = new WebSocket(url, 'mqtt'); } catch { retry = setTimeout(open, 4000); return; }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws.send(packet(0x10, [...str('MQTT'), 4, 2, 0, 30, ...str('ogn' + randomId())]));
    ws.onmessage = (e) => {
      lastRx = Date.now();
      const add = new Uint8Array(e.data);
      const merged = new Uint8Array(buf.length + add.length);
      merged.set(buf); merged.set(add, buf.length);
      buf = merged;
      parse();
    };
    const sock = ws;
    ws.onclose = () => {
      if (sock !== ws) return; // stare gniazdo, już zastąpione
      clearInterval(ping);
      if (up) { up = false; onState(); }
      buf = new Uint8Array(0);
      if (!closed) retry = setTimeout(open, 2500);
    };
    ws.onerror = () => { try { sock.close(); } catch { /* już zamknięty */ } };
  };

  const parse = () => {
    for (;;) {
      if (buf.length < 2) return;
      let len = 0, mul = 1, i = 1, d;
      do { if (i >= buf.length) return; d = buf[i++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
      if (buf.length < i + len) return;
      const type = buf[0] >> 4, body = buf.subarray(i, i + len);
      buf = buf.slice(i + len);
      if (type === 2) { // CONNACK
        if (body[1] !== 0) { ws.close(); return; }
        ws.send(packet(0x82, [0, 1, ...str(subTopic), 0]));
        ping = setInterval(() => { if (ws.readyState === 1) ws.send(packet(0xC0, [])); }, 15000);
      } else if (type === 9) { // SUBACK – dopiero teraz jesteśmy gotowi
        up = true; onState();
      } else if (type === 3) { // PUBLISH (QoS 0)
        const tl = (body[0] << 8) | body[1];
        try { onPayload(JSON.parse(dec.decode(body.subarray(2 + tl)))); } catch { /* cudza lub uszkodzona wiadomość */ }
      }
    }
  };

  open();
  return {
    get up() { return up; },
    publish(topic, obj) {
      if (!up || ws.readyState !== 1) return;
      const payload = enc.encode(JSON.stringify(obj));
      const head = str(topic);
      const body = new Uint8Array(head.length + payload.length);
      body.set(head); body.set(payload, head.length);
      ws.send(packet(0x30, body));
    },
    // Po powrocie strony z tła: sprawdź, czy połączenie żyje, a jeśli nie – połącz od razu.
    kick() {
      if (closed) return;
      if (!ws || ws.readyState > 1) { clearTimeout(retry); open(); return; }
      if (ws.readyState !== 1) return;
      const t = Date.now(), sock = ws;
      try { sock.send(packet(0xC0, [])); } catch { /* nic */ }
      setTimeout(() => { if (lastRx < t && sock === ws) { try { sock.close(); } catch { /* nic */ } clearTimeout(retry); if (up) { up = false; onState(); } open(); } }, 3000);
    },
    close() { closed = true; clearTimeout(retry); clearInterval(ping); try { ws.close(); } catch { /* nic */ } },
  };
}

// Kanał na wszystkich przekaźnikach naraz, z numeracją wiadomości i odrzucaniem duplikatów.
function channel(code, side, onData, onStatus) {
  const me = randomId();
  const pubTopic = TOPIC + code + (side === 'host' ? '/h2g' : '/g2h');
  const subTopic = TOPIC + code + (side === 'host' ? '/g2h' : '/h2g');
  const seen = {}; // nadawca -> ostatni numer
  let seq = 0, onReady = null;
  const list = BROKERS.map((url) => broker(url, subTopic, (m) => {
    if (!m || !m.id || typeof m.s !== 'number') return;
    if (seen[m.id] >= m.s) return;
    seen[m.id] = m.s;
    onData(m.id, m.d, m.to);
  }, () => {
    if (onStatus) onStatus(list.filter((b) => b.up).length, list.length);
    if (onReady && list.some((b) => b.up)) { onReady(); onReady = null; }
  }));
  const wake = () => { if (document.visibilityState === 'visible') for (const b of list) b.kick(); };
  document.addEventListener('visibilitychange', wake);
  addEventListener('online', wake);
  return {
    me,
    ready: (ms) => new Promise((resolve, reject) => {
      if (list.some((b) => b.up)) return resolve();
      const t = setTimeout(() => { onReady = null; reject(new Error('timeout')); }, ms);
      onReady = () => { clearTimeout(t); resolve(); };
    }),
    send(d, to) { const m = { id: me, s: ++seq, d, to }; for (const b of list) b.publish(pubTopic, m); },
    close() { document.removeEventListener('visibilitychange', wake); removeEventListener('online', wake); for (const b of list) b.close(); },
  };
}

const NO_NET = 'Brak połączenia z serwerem gry. Sprawdź internet i spróbuj ponownie.';

async function hostRelay(code, onGuest, onError, onStatus) {
  let guestId = null, cur = null;
  const ch = channel(code, 'host', (from, d) => {
    if (d && d.sys === 'open') {
      if (from !== guestId) { // nowy gość albo powrót po odświeżeniu strony
        guestId = from;
        cur = link();
        cur.send = (o) => ch.send(o, guestId);
        ch.send({ sys: 'ack' }, from);
        onGuest(cur);
      } else ch.send({ sys: 'ack' }, from);
      return;
    }
    if (from === guestId && cur && cur.onMessage) cur.onMessage(d);
  }, onStatus);
  try { await ch.ready(12000); } catch { ch.close(); onError(NO_NET); return { close() {} }; }
  return { close: () => ch.close() };
}

async function joinRelay(code, onError, onStatus) {
  const l = link();
  let hostId = null, acked = null;
  const ch = channel(code, 'guest', (from, d, to) => {
    if (to && to !== ch.me) return; // wiadomość dla poprzedniego gościa
    if (d && d.sys === 'ack') { hostId = from; if (acked) acked(); return; }
    if (from === hostId && l.onMessage) l.onMessage(d);
  }, onStatus);
  l.send = (o) => ch.send(o);
  l.close = () => ch.close();
  try { await ch.ready(12000); } catch { ch.close(); onError(NO_NET); return new Promise(() => {}); }
  // Pukaj co sekundę, aż gospodarz odpowie. Nie poddawaj się: telefon gospodarza mógł
  // uśpić stronę (np. gdy wysyła kod w komunikatorze) i odpowie dopiero po powrocie.
  await new Promise((resolve) => {
    let tries = 0;
    const knock = setInterval(() => { ch.send({ sys: 'open' }); if (++tries === 8 && onStatus) onStatus(-1); }, 1000);
    acked = () => { clearInterval(knock); acked = null; resolve(); };
    ch.send({ sys: 'open' });
  });
  return l;
}

// ------------------------------------------------- BroadcastChannel
function hostLocal(code, onGuest) {
  const ch = new BroadcastChannel(TOPIC + code);
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
  const ch = new BroadcastChannel(TOPIC + code);
  const l = link();
  l.send = (o) => ch.postMessage({ from: 'guest', data: o });
  l.close = () => { ch.postMessage({ from: 'guest', sys: 'close' }); ch.close(); };
  ch.onmessage = (e) => { if (e.data.from === 'host' && l.onMessage) l.onMessage(e.data.data); };
  ch.postMessage({ from: 'guest', sys: 'open' });
  addEventListener('pagehide', () => ch.postMessage({ from: 'guest', sys: 'close' }));
  return Promise.resolve(l);
}

export const hostRoom = (code, onGuest, onError, onStatus) => (LOCAL ? hostLocal(code, onGuest) : hostRelay(code, onGuest, onError, onStatus));
export const joinRoom = (code, onError, onStatus) => (LOCAL ? joinLocal(code) : joinRelay(code, onError, onStatus));
