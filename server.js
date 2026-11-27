// Máy chủ game sảnh sự kiện — nhiều người chơi cùng lúc qua Socket.io
const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 300);
const TICK_MS = 100; // gửi gộp cập nhật 10 lần/giây

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, players: players.size }));

const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 16 * 1024, cors: { origin: false } });

// Chỉ nhận các trường game dùng tới, giá trị đơn giản và ngắn
const ALLOWED = new Set(["n","c","a","g","x","y","d","m","z","da","st","say","sayT","emo","emoT","win","winT","act","actT","actTo","xu","cardT","cardMsg"]);
function sanitize(patch) {
  const out = {};
  if (!patch || typeof patch !== "object") return out;
  for (const k of Object.keys(patch)) {
    if (!ALLOWED.has(k)) continue;
    const v = patch[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 160);
  }
  return out;
}

const players = new Map(); // socket.id -> trạng thái đầy đủ
let dirty = new Map();     // socket.id -> phần thay đổi chờ gửi

io.on("connection", (socket) => {
  if (players.size >= MAX_PLAYERS) {
    socket.emit("full");
    socket.disconnect(true);
    return;
  }
  socket.emit("hello", {
    id: socket.id,
    peers: [...players].map(([peer, presence]) => ({ peer, presence })),
  });

  socket.on("presence", (raw) => {
    const patch = sanitize(raw);
    if (!Object.keys(patch).length) return;
    const cur = { ...(players.get(socket.id) || {}), ...patch };
    if (JSON.stringify(cur).length > 4096) return;
    players.set(socket.id, cur);
    dirty.set(socket.id, { ...(dirty.get(socket.id) || {}), ...patch });
  });

  socket.on("disconnect", () => {
    dirty.delete(socket.id);
    if (players.delete(socket.id)) io.emit("left", { peer: socket.id });
  });
});

setInterval(() => {
  if (!dirty.size) return;
  const batch = [...dirty].map(([peer, patch]) => ({ peer, patch }));
  dirty = new Map();
  io.emit("batch", batch);
}, TICK_MS);

server.listen(PORT, () => {
  console.log(`Sảnh sự kiện đang chạy: http://localhost:${PORT}`);
});
