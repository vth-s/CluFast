import type { FastifyInstance } from "fastify";
import { eq, desc, lt } from "drizzle-orm";
import { messages, users } from "../db/schema.js";

const PAGE_SIZE = 50;

function formatMessages(rows: any[]) {
  return rows.map((row) => ({
    id: row.id,
    channelId: row.channelId,
    authorId: row.authorId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: {
      id: row.authorId,
      username: row.authorUsername,
      avatarUrl: row.authorAvatarUrl,
    },
  }));
}

export default async function messagesRoutes(app: FastifyInstance) {
  app.get<{
    Params: { channelId: string };
    Querystring: { before?: string };
  }>(
    "/channels/:channelId/messages",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { channelId } = request.params;
      const { before } = request.query;

      if (before) {
        const [cursor] = await app.db
          .select({ createdAt: messages.createdAt })
          .from(messages)
          .where(eq(messages.id, before))
          .limit(1);

        if (!cursor) {
          return { messages: [], hasMore: false };
        }

        const rows = await app.db
          .select({
            id: messages.id,
            channelId: messages.channelId,
            authorId: messages.authorId,
            content: messages.content,
            createdAt: messages.createdAt,
            updatedAt: messages.updatedAt,
            authorUsername: users.username,
            authorAvatarUrl: users.avatarUrl,
          })
          .from(messages)
          .innerJoin(users, eq(messages.authorId, users.id))
          .where(
            eq(messages.channelId, channelId) &&
              lt(messages.createdAt, cursor.createdAt),
          )
          .orderBy(desc(messages.createdAt))
          .limit(PAGE_SIZE + 1);

        const hasMore = rows.length > PAGE_SIZE;
        const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

        return {
          messages: formatMessages(items.reverse()),
          hasMore,
        };
      }

      const rows = await app.db
        .select({
          id: messages.id,
          channelId: messages.channelId,
          authorId: messages.authorId,
          content: messages.content,
          createdAt: messages.createdAt,
          updatedAt: messages.updatedAt,
          authorUsername: users.username,
          authorAvatarUrl: users.avatarUrl,
        })
        .from(messages)
        .innerJoin(users, eq(messages.authorId, users.id))
        .where(eq(messages.channelId, channelId))
        .orderBy(desc(messages.createdAt))
        .limit(PAGE_SIZE + 1);

      const hasMore = rows.length > PAGE_SIZE;
      const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

      return {
        messages: formatMessages(items.reverse()),
        hasMore,
      };
    },
  );
}
