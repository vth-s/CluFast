import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { servers, channels, serverMembers } from "../db/schema.js";

export default async function serverRoutes(app: FastifyInstance) {
  app.get(
    "/users/me/servers",
    { preHandler: [app.authenticate] },
    async (request) => {
      const rows = await app.db
        .select({
          id: servers.id,
          name: servers.name,
          ownerId: servers.ownerId,
          iconUrl: servers.iconUrl,
          createdAt: servers.createdAt,
        })
        .from(servers)
        .innerJoin(serverMembers, eq(servers.id, serverMembers.serverId))
        .where(eq(serverMembers.userId, request.user.id));

      return { servers: rows };
    },
  );

  app.post<{
    Body: { name: string };
  }>(
    "/servers",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      const { name } = request.body;
      const userId = request.user.id;

      const [server] = await app.db
        .insert(servers)
        .values({ name, ownerId: userId })
        .returning();

      await app.db.insert(serverMembers).values({
        userId,
        serverId: server.id,
      });

      await app.db.insert(channels).values({
        serverId: server.id,
        name: "general",
        type: "text",
      });

      return reply.code(201).send({ server });
    },
  );

  app.get<{
    Params: { serverId: string };
  }>(
    "/servers/:serverId/channels",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { serverId } = request.params;

      const [server] = await app.db
        .select({ id: servers.id })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      const rows = await app.db
        .select()
        .from(channels)
        .where(eq(channels.serverId, serverId));

      return { channels: rows };
    },
  );

  app.post<{
    Params: { serverId: string };
    Body: { name: string; type?: "text" | "voice" };
  }>(
    "/servers/:serverId/channels",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["serverId"],
          properties: {
            serverId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            type: { type: "string", enum: ["text", "voice"] },
          },
        },
      },
    },
    async (request, reply) => {
      const { serverId } = request.params;
      const { name, type = "text" } = request.body;

      const [server] = await app.db
        .select({ id: servers.id })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      if (!server) {
        return reply.code(404).send({ error: "Server not found" });
      }

      const [channel] = await app.db
        .insert(channels)
        .values({ serverId, name, type })
        .returning();

      return reply.code(201).send({ channel });
    },
  );
}
