import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { TikTokLiveConnection } from "tiktok-live-connector";
import http from "node:http";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

app.get("/", (_req, res) => {
  res.send("Cuanhehe connector is running");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

let connection = null;
let currentRoom = "";
const clients = new Set();

wss.on("connection", (socket) => {
  clients.add(socket);
  socket.send(JSON.stringify({ type: "status", message: "Đã kết nối máy chủ" }));
  socket.on("close", () => clients.delete(socket));
});

function broadcast(data) {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

app.get("/connect", async (req, res) => {
  const username = String(req.query.username || "")
    .trim()
    .replace(/^@/, "");

  if (!/^[a-zA-Z0-9._]{1,24}$/.test(username)) {
    return res.status(400).json({ error: "Tên TikTok không hợp lệ" });
  }

  try {
    if (connection) {
      try { await connection.disconnect(); } catch {}
    }

    currentRoom = username;
    connection = new TikTokLiveConnection(username);

    connection.on("chat", (data) => {
      broadcast({
        type: "chat",
        username: data.uniqueId || data.nickname || "Người xem",
        comment: data.comment || ""
      });
    });

    connection.on("connected", () => {
      broadcast({ type: "status", message: "Đã kết nối LIVE" });
    });

    connection.on("disconnected", () => {
      broadcast({ type: "status", message: "LIVE đã ngắt kết nối" });
    });

    await connection.connect();
    res.json({ ok: true, username: currentRoom });
  } catch (error) {
    broadcast({ type: "status", message: "Không kết nối được LIVE" });
    res.status(502).json({
      error: "Không kết nối được LIVE công khai. Hãy kiểm tra tài khoản đang phát trực tiếp."
    });
  }
});

const port = process.env.PORT || 10000;
server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on ${port}`);
});
