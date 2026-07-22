import fp from "fastify-plugin";
import fjwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply,
    ) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string };
    user: { id: string };
  }
}

export default fp(async function authPlugin(app: FastifyInstance) {
  app.register(fjwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
    sign: { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  });

  app.decorate(
    "authenticate",
    async function authenticate(
      request: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply,
    ) {
      try {
        await request.jwtVerify();
      } catch {
        reply.code(401).send({ error: "Unauthorized" });
      }
    },
  );
});
