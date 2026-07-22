import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { users } from "../db/schema.js";

export default async function authRoutes(app: FastifyInstance) {
  app.post<{
    Body: { username: string; email: string; password: string };
  }>(
    "/auth/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["username", "email", "password"],
          properties: {
            username: { type: "string", minLength: 2, maxLength: 32 },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      const { username, email, password } = request.body;

      const existing = await app.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({ error: "Email already registered" });
      }

      const existingUsername = await app.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUsername.length > 0) {
        return reply.code(409).send({ error: "Username already taken" });
      }

      const passwordHash = await argon2.hash(password);

      const [user] = await app.db
        .insert(users)
        .values({ username, email, passwordHash })
        .returning({ id: users.id, username: users.username, email: users.email });

      const token = app.jwt.sign({ id: user.id });

      return reply.code(201).send({
        user: { id: user.id, username: user.username, email: user.email },
        token,
      });
    },
  );

  app.post<{
    Body: { email: string; password: string };
  }>(
    "/auth/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const [user] = await app.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const valid = await argon2.verify(user.passwordHash, password);

      if (!valid) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const token = app.jwt.sign({ id: user.id });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        },
        token,
      };
    },
  );

  app.get(
    "/users/me",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const [user] = await app.db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1);

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      return { user };
    },
  );
}
