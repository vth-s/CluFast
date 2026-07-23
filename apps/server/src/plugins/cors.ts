import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

export default fp(async function corsPlugin(app: FastifyInstance) {
  app.register(cors, {
    origin: [
      "http://localhost:1420",
      "http://tauri.localhost",
      "https://tauri.localhost",
      "https://cordfast.dpdns.org",
    ],
    credentials: true,
  });
});
