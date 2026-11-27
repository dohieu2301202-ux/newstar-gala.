// Tiến lên miền Nam — máy chủ giữ bài, kiểm tra luật, đổi lượt (2–4 người mỗi bàn)
// Mã lá bài: 0..51, giá trị = hạng*4 + chất. Hạng 3 thấp nhất … 2 cao nhất; chất ♠ < ♣ < ♦ < ♥.
const RANKS = ["3","4","5","6","7","8","9","10","J","Q","K","A","2"];
const SUITS = ["♠","♣","♦","♥"];
const TURN_MS = 30000;
const rank = (v) => v >> 2;
const cardName = (v) => RANKS[rank(v)] + SUITS[v & 3];

function combo(cards) {
  const c = [...cards].sort((a, b) => a - b), n = c.length;
  if (!n) return null;
  const r = c.map(rank), hi = c[n - 1];
  if (r.every((x) => x === r[0])) {
    if (n === 1) return { t: "single", n, hi };
    if (n === 2) return { t: "pair", n, hi };
    if (n === 3) return { t: "triple", n, hi };
    if (n === 4) return { t: "four", n, hi };
    return null;
  }
  if (n >= 3 && r[n - 1] !== 12 && r.every((x, i) => i === 0 || x === r[i - 1] + 1)) return { t: "straight", n, hi };
  if (n >= 6 && n % 2 === 0 && r[n - 1] !== 12) {
    let ok = true;
    for (let i = 0; i < n; i += 2) {
      if (r[i] !== r[i + 1]) ok = false;
      if (i > 0 && r[i] !== r[i - 2] + 1) ok = false;
    }
    if (ok) return { t: "dstraight", n, len: n / 2, hi };
  }
  return null;
}

// a có chặn được b không (kể cả luật chặt heo)
function beats(a, b) {
  if (!b) return true;
  if (a.t === b.t && a.n === b.n) return a.hi > b.hi;
  const twoSingle = b.t === "single" && rank(b.hi) === 12;
  const twoPair = b.t === "pair" && rank(b.hi) === 12;
  if (twoSingle) return a.t === "four" || (a.t === "dstraight" && a.len >= 3);
  if (twoPair) return a.t === "four" || (a.t === "dstraight" && a.len >= 4);
  if (b.t === "four") return a.t === "dstraight" && a.len >= 4;
  if (b.t === "dstraight" && b.len === 3) return a.t === "four" || (a.t === "dstraight" && a.len >= 4);
  return false;
}

function describe(cb, cards) {
  const names = { single: "", pair: "đôi ", triple: "sám cô ", four: "tứ quý ", straight: "sảnh ", dstraight: cb.len + " đôi thông " };
  return (names[cb.t] || "") + [...cards].sort((a, b) => a - b).map(cardName).join(" ");
}

module.exports = function attachTienLen(io, nameOf) {
  const tables = [1, 2, 3, 4].map((i) => ({
    id: "ban-" + i, title: "Bàn " + i, seats: [null, null, null, null], state: "waiting",
    hands: {}, turn: -1, cur: null, passed: new Set(), inGame: new Set(),
    first: false, firstCard: -1, winnerSeat: -1, ranking: [], log: [], deadline: 0,
  }));
  const where = new Map(); // socket.id -> bàn

  const lobby = () => tables.map((t) => ({ id: t.id, title: t.title, state: t.state, players: t.seats.filter(Boolean).length, names: t.seats.filter(Boolean).map(nameOf) }));
  const addLog = (t, s) => { t.log.push(s); if (t.log.length > 10) t.log.shift(); };

  function view(t, sid) {
    const you = t.seats.indexOf(sid);
    return {
      id: t.id, title: t.title, state: t.state, you, turn: t.turn, first: t.first,
      firstCard: t.firstCard, winnerSeat: t.winnerSeat, ranking: t.ranking, log: t.log,
      deadline: t.deadline, now: Date.now(),
      seats: t.seats.map((s, i) => s ? { name: nameOf(s), count: (t.hands[s] || []).length, passed: t.passed.has(i), playing: t.inGame.has(i) } : null),
      cur: t.cur ? { cards: t.cur.cards, seat: t.cur.seat, name: t.cur.name, t: t.cur.combo.t } : null,
      hand: you >= 0 ? (t.hands[sid] || []) : [],
    };
  }
  function push(t) {
    for (const [sid, tb] of where) if (tb === t) { const s = io.sockets.sockets.get(sid); if (s) s.emit("tl:table", view(t, sid)); }
    io.emit("tl:lobby", lobby());
  }

  function deal(t) {
    const deck = [...Array(52).keys()];
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    t.inGame = new Set(t.seats.map((s, i) => (s ? i : -1)).filter((i) => i >= 0));
    t.hands = {}; let k = 0, start = -1, low = 99;
    for (const i of t.inGame) {
      const h = deck.slice(k, k + 13).sort((a, b) => a - b); k += 13;
      t.hands[t.seats[i]] = h;
      if (h[0] < low) { low = h[0]; start = i; }
    }
    Object.assign(t, { state: "playing", turn: start, cur: null, passed: new Set(), winnerSeat: -1, ranking: [], first: true, firstCard: low, log: [] });
    addLog(t, nameOf(t.seats[start]) + " có lá nhỏ nhất (" + cardName(low) + "), đánh trước.");
    t.deadline = Date.now() + TURN_MS;
  }

  function nextTurn(t) {
    let i = t.turn, found = false;
    for (let k = 0; k < 4; k++) {
      i = (i + 1) % 4;
      if (!t.inGame.has(i) || !t.seats[i]) continue;
      if (t.cur && i === t.cur.seat) { found = true; break; }
      if (t.passed.has(i)) continue;
      found = true; break;
    }
    if (!found) { // người cầm cái đã rời bàn: người kế tiếp được đánh mới
      i = t.turn; for (let k = 0; k < 4; k++) { i = (i + 1) % 4; if (t.inGame.has(i) && t.seats[i]) break; }
      t.cur = { seat: i, cards: [], combo: null, name: "" };
    }
    if (t.cur && i === t.cur.seat) {
      t.cur = null; t.passed.clear();
      addLog(t, nameOf(t.seats[i]) + " giành lượt, được đánh mới.");
    }
    t.turn = i;
    t.deadline = Date.now() + TURN_MS;
  }

  function finish(t, winSeat) {
    t.state = "ended"; t.winnerSeat = winSeat;
    const others = [...t.inGame].filter((i) => i !== winSeat && t.seats[i]).sort((a, b) => t.hands[t.seats[a]].length - t.hands[t.seats[b]].length);
    t.ranking = [winSeat, ...others].map((i, k) => ({ seat: i, name: nameOf(t.seats[i]), left: (t.hands[t.seats[i]] || []).length, place: k + 1 }));
    addLog(t, "🏆 " + nameOf(t.seats[winSeat]) + " về nhất!");
    t.turn = -1; t.cur = null; t.deadline = 0;
    io.emit("tl:win", { name: nameOf(t.seats[winSeat]), table: t.title, players: t.inGame.size });
  }

  function play(sid, cards, auto) {
    const t = where.get(sid);
    if (!t || t.state !== "playing") return "Ván chưa bắt đầu.";
    const seat = t.seats.indexOf(sid);
    if (seat !== t.turn) return "Chưa tới lượt bạn.";
    const hand = t.hands[sid] || [];
    if (!Array.isArray(cards) || !cards.length || cards.length > 13) return "Hãy chọn bài để đánh.";
    const set = new Set(cards);
    if (set.size !== cards.length || !cards.every((c) => Number.isInteger(c) && hand.includes(c))) return "Bài không hợp lệ.";
    const cb = combo(cards);
    if (!cb) return "Bộ này không hợp lệ: chỉ đánh lẻ, đôi, sám cô, tứ quý, sảnh (≥3 lá, không có 2) hoặc đôi thông.";
    if (t.first && !set.has(t.firstCard)) return "Lượt đầu phải đánh kèm lá " + cardName(t.firstCard) + ".";
    const prev = t.cur && t.cur.combo;
    if (!beats(cb, prev)) return "Bài này không chặn được bài trên bàn.";
    const chop = prev && (prev.t !== cb.t || prev.n !== cb.n);
    t.hands[sid] = hand.filter((c) => !set.has(c));
    t.first = false;
    t.cur = { cards: [...cards].sort((a, b) => a - b), seat, combo: cb, name: nameOf(sid) };
    addLog(t, nameOf(sid) + (auto ? " (hết giờ)" : "") + (chop ? " CHẶT! " : " đánh ") + describe(cb, cards));
    if (!t.hands[sid].length) finish(t, seat); else nextTurn(t);
    push(t);
    return null;
  }

  function pass(sid, auto) {
    const t = where.get(sid);
    if (!t || t.state !== "playing") return "Ván chưa bắt đầu.";
    const seat = t.seats.indexOf(sid);
    if (seat !== t.turn) return "Chưa tới lượt bạn.";
    if (!t.cur) return "Bạn đang được đánh mới, không bỏ lượt được.";
    t.passed.add(seat);
    addLog(t, nameOf(sid) + (auto ? " hết giờ, bỏ lượt." : " bỏ lượt."));
    nextTurn(t); push(t);
    return null;
  }

  function leave(sid) {
    const t = where.get(sid); if (!t) return;
    const seat = t.seats.indexOf(sid);
    where.delete(sid);
    if (seat < 0) return;
    t.seats[seat] = null;
    if (t.state === "playing" && t.inGame.has(seat)) {
      addLog(t, nameOf(sid) + " rời bàn.");
      t.inGame.delete(seat); t.passed.delete(seat); delete t.hands[sid];
      const left = [...t.inGame].filter((i) => t.seats[i]);
      if (left.length < 2) { if (left.length === 1) finish(t, left[0]); else t.state = "waiting"; }
      else if (t.turn === seat) { nextTurn(t); }
    }
    if (!t.seats.some(Boolean)) Object.assign(t, { state: "waiting", log: [], cur: null, turn: -1, inGame: new Set(), hands: {}, ranking: [], winnerSeat: -1 });
    push(t);
  }

  setInterval(() => {
    const now = Date.now();
    for (const t of tables) {
      if (t.state !== "playing" || now < t.deadline) continue;
      const sid = t.seats[t.turn]; if (!sid) { nextTurn(t); push(t); continue; }
      if (t.cur) pass(sid, true);
      else play(sid, [t.first ? t.firstCard : t.hands[sid][0]], true);
    }
  }, 1000);

  io.on("connection", (socket) => {
    socket.emit("tl:lobby", lobby());
    const ack = (fn) => (typeof fn === "function" ? fn : () => {});
    socket.on("tl:join", (id, cb) => {
      const t = tables.find((x) => x.id === id); if (!t) return ack(cb)("Không có bàn này.");
      if (where.get(socket.id) === t) { push(t); return ack(cb)(null); }
      leave(socket.id);
      const seat = t.seats.indexOf(null); if (seat < 0) return ack(cb)("Bàn đã đủ 4 người.");
      t.seats[seat] = socket.id; where.set(socket.id, t);
      addLog(t, nameOf(socket.id) + " vào bàn" + (t.state === "playing" ? " (chờ ván sau)." : "."));
      push(t); ack(cb)(null);
    });
    socket.on("tl:leave", () => leave(socket.id));
    socket.on("tl:start", (cb) => {
      const t = where.get(socket.id); if (!t) return ack(cb)("Bạn chưa ngồi bàn nào.");
      if (t.state === "playing") return ack(cb)("Ván đang diễn ra.");
      if (t.seats.filter(Boolean).length < 2) return ack(cb)("Cần ít nhất 2 người để bắt đầu.");
      deal(t); push(t); ack(cb)(null);
    });
    socket.on("tl:play", (cards, cb) => ack(cb)(play(socket.id, cards, false)));
    socket.on("tl:pass", (cb) => ack(cb)(pass(socket.id, false)));
    socket.on("disconnect", () => leave(socket.id));
  });
};
