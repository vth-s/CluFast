import "dotenv/config";
import Fastify from "fastify";
import dbPlugin from "./plugins/db.js";
import authPlugin from "./plugins/auth.js";
import corsPlugin from "./plugins/cors.js";
import wsPlugin from "./plugins/ws.js";
import wsGateway from "./plugins/ws-gateway.js";
import authRoutes from "./routes/auth.js";
import messagesRoutes from "./routes/messages.js";
import serverRoutes from "./routes/servers.js";
import { mediasoupServer } from "./mediasoup/server.js";

const app = Fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  },
});

await mediasoupServer.run();

await app.register(corsPlugin);
await app.register(dbPlugin);
await app.register(authPlugin);
await app.register(wsPlugin);
await app.register(wsGateway);
await app.register(authRoutes);
await app.register(messagesRoutes);
await app.register(serverRoutes);

app.get("/health", async () => {
  return { status: "ok", timestamp: Date.now() };
});

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`CordFast server running on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
