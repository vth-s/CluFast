import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

export default fp(async function corsPlugin(app: FastifyInstance) {
  app.register(cors, {
    origin: process.env.CORS_ORIGIN || "http://localhost:1420",
    credentials: true,
  });
});
