const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const https = require("https");
const fs = require("fs");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Load local certificates (GitHub-friendly fallback)
const certPath = "cert.pem";
const keyPath = "key.pem";
let httpServer;

app.prepare().then(() => {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    httpServer = https.createServer(httpsOptions, (req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });
    console.log("> Mode: Secure (HTTPS)");
  } else {
    httpServer = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });
    console.log("> Mode: Standard (HTTP) - [No certificates found]");
  }

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    let dataCount = 0;
    // When a sensor sends vibration data
    socket.on("vibration_data", (data) => {
      const enrichedData = { ...data, sensorId: socket.id };
      socket.broadcast.emit("vibration_update", enrichedData);
    });

    // When dashboard updates configuration
    socket.on("update_config", (config) => {
      socket.broadcast.emit("config_changed", config);
    });

    // When dashboard kicks a specific node
    socket.on("kick_node", (targetId) => {
      socket.to(targetId).emit("kicked");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
