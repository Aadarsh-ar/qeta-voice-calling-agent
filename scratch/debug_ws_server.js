import { createServer } from "http";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

const app = next({ dev: true, port: 3009 });
await app.prepare();

const server = createServer((req, res) => {
  res.end("OK");
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  console.log("UPGRADE HIT:", req.url);
  socket.on("close", (hadErr) => console.log("SERVER SOCKET CLOSED, hadErr=", hadErr));
  socket.on("end", () => console.log("SERVER SOCKET END"));
  socket.on("error", (e) => console.log("SERVER SOCKET ERROR:", e.message));

  wss.handleUpgrade(req, socket, head, (ws) => {
    console.log("WS UPGRADED SUCCESSFULLY!");
    ws.on("message", (m) => console.log("SERVER WS MSG:", m.toString()));
    ws.on("close", (c, r) => console.log("SERVER WS CLOSED:", c, r.toString()));
    ws.on("error", (e) => console.log("SERVER WS ERROR:", e.message));
  });
});

server.listen(3009, () => {
  console.log("Server listening on 3009");

  const client = new WebSocket("ws://localhost:3009/test");
  client.on("open", () => {
    console.log("CLIENT OPENED");
    client._socket.on("close", (hadErr) => console.log("CLIENT SOCKET CLOSED, hadErr=", hadErr));
    client._socket.on("end", () => console.log("CLIENT SOCKET END"));
    client.send("hello from client");
  });
  client.on("message", (m) => console.log("CLIENT MSG:", m.toString()));
  client.on("close", (c, r) => {
    console.log("CLIENT CLOSED:", c, r.toString());
    process.exit(0);
  });
  client.on("error", (e) => console.log("CLIENT ERROR:", e.message));
});
