import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { eq, and } from "drizzle-orm";
import {
  encodeWsMessage,
  decodeWsMessage,
} from "@cordfast/shared";
import type { WsClientEvents } from "@cordfast/shared";
import { channels, messages, users } from "../db/schema.js";
import { mediasoupServer } from "../mediasoup/server.js";
import { voiceRoomManager } from "../mediasoup/voice-room.js";

interface Connection {
  ws: WebSocket;
  userId: string;
  username: string;
  joinedChannels: Set<string>;
  voiceChannelId: string | null;
}

const connections = new Map<string, Connection>();
const channelMembers = new Map<string, Set<string>>();

function sendTo(conn: Connection, event: string, data: unknown) {
  if (conn.ws.readyState === conn.ws.OPEN) {
    conn.ws.send(encodeWsMessage(event, data));
  }
}

function broadcastToChannel(
  channelId: string,
  event: string,
  data: unknown,
  excludeUserId?: string,
) {
  const members = channelMembers.get(channelId);
  if (!members) return;

  const payload = encodeWsMessage(event, data);
  for (const memberId of members) {
    if (memberId === excludeUserId) continue;
    const conn = connections.get(memberId);
    if (conn && conn.ws.readyState === conn.ws.OPEN) {
      conn.ws.send(payload);
    }
  }
}

export default async function wsGateway(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, async (socket) => {
    let userId: string | null = null;
    let connection: Connection | null = null;

    socket.on("message", async (raw) => {
      const msg = decodeWsMessage(raw.toString());
      if (!msg) {
        socket.send(
          encodeWsMessage("error", { message: "Invalid message format" }),
        );
        return;
      }

      // ── First message must be auth ─────────────────────────
      if (!userId) {
        if (msg.event !== "auth") {
          socket.send(
            encodeWsMessage("error", {
              message: "Must authenticate first. Send { event: 'auth', data: { token } }",
            }),
          );
          return;
        }

        try {
          const decoded = app.jwt.verify<{ id: string }>(
            (msg.data as { token: string }).token,
          );
          userId = decoded.id;

          const [user] = await app.db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

          if (!user) {
            socket.send(
              encodeWsMessage("error", { message: "User not found" }),
            );
            socket.close();
            return;
          }

          connection = {
            ws: socket,
            userId: user.id,
            username: user.username,
            joinedChannels: new Set(),
            voiceChannelId: null,
          };
          connections.set(user.id, connection);

          socket.send(encodeWsMessage("auth:ok", { userId: user.id }));
          app.log.info(`WS connected: ${user.username} (${user.id})`);
        } catch {
          socket.send(
            encodeWsMessage("error", { message: "Invalid token" }),
          );
          socket.close();
        }
        return;
      }

      // ── Authenticated events ───────────────────────────────
      const conn = connection!;

      switch (msg.event) {
        // ─── Chat events ─────────────────────────────────────
        case "channel:join": {
          const { channelId } = msg.data as WsClientEvents["channel:join"];

          let ch;
          try {
            [ch] = await app.db
              .select()
              .from(channels)
              .where(eq(channels.id, channelId))
              .limit(1);
          } catch {
            socket.send(
              encodeWsMessage("error", { message: "Invalid channel ID" }),
            );
            return;
          }

          if (!ch) {
            socket.send(
              encodeWsMessage("error", { message: "Channel not found" }),
            );
            return;
          }

          conn.joinedChannels.add(channelId);

          if (!channelMembers.has(channelId)) {
            channelMembers.set(channelId, new Set());
          }
          channelMembers.get(channelId)!.add(conn.userId);

          socket.send(
            encodeWsMessage("channel:joined", { channelId }),
          );

          broadcastToChannel(
            channelId,
            "typing:user-stop",
            { channelId, userId: conn.userId },
            conn.userId,
          );

          app.log.info(`${conn.username} joined channel ${channelId}`);
          break;
        }

        case "channel:leave": {
          const { channelId } = msg.data as WsClientEvents["channel:leave"];
          conn.joinedChannels.delete(channelId);
          channelMembers.get(channelId)?.delete(conn.userId);
          socket.send(encodeWsMessage("channel:left", { channelId }));
          break;
        }

        case "message:send": {
          const { channelId, content } =
            msg.data as WsClientEvents["message:send"];

          const trimmed = content.trim();
          if (!trimmed || trimmed.length > 2000) {
            socket.send(
              encodeWsMessage("error", {
                message: "Message must be 1-2000 characters",
              }),
            );
            return;
          }

          const [inserted] = await app.db
            .insert(messages)
            .values({
              channelId,
              authorId: conn.userId,
              content: trimmed,
            })
            .returning({
              id: messages.id,
              channelId: messages.channelId,
              authorId: messages.authorId,
              content: messages.content,
              createdAt: messages.createdAt,
              updatedAt: messages.updatedAt,
            });

          const [author] = await app.db
            .select({
              id: users.id,
              username: users.username,
              avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(eq(users.id, conn.userId))
            .limit(1);

          broadcastToChannel(channelId, "message:new", {
            ...inserted,
            author: {
              id: author!.id,
              username: author!.username,
              avatarUrl: author!.avatarUrl,
            },
          });
          break;
        }

        case "message:update": {
          const { messageId, content } =
            msg.data as WsClientEvents["message:update"];
          const trimmed = content.trim();
          if (!trimmed || trimmed.length > 2000) return;

          const [existing] = await app.db
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.id, messageId),
                eq(messages.authorId, conn.userId),
              ),
            )
            .limit(1);

          if (!existing) {
            socket.send(
              encodeWsMessage("error", {
                message: "Message not found or not yours",
              }),
            );
            return;
          }

          const [updated] = await app.db
            .update(messages)
            .set({ content: trimmed, updatedAt: new Date() })
            .where(eq(messages.id, messageId))
            .returning();

          broadcastToChannel(
            existing.channelId,
            "message:updated",
            updated,
          );
          break;
        }

        case "message:delete": {
          const { messageId } =
            msg.data as WsClientEvents["message:delete"];

          const [existing] = await app.db
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.id, messageId),
                eq(messages.authorId, conn.userId),
              ),
            )
            .limit(1);

          if (!existing) {
            socket.send(
              encodeWsMessage("error", {
                message: "Message not found or not yours",
              }),
            );
            return;
          }

          await app.db
            .delete(messages)
            .where(eq(messages.id, messageId));

          broadcastToChannel(existing.channelId, "message:deleted", {
            messageId,
            channelId: existing.channelId,
          });
          break;
        }

        case "typing:start": {
          const { channelId } =
            msg.data as WsClientEvents["typing:start"];
          broadcastToChannel(
            channelId,
            "typing:user-start",
            {
              channelId,
              userId: conn.userId,
              username: conn.username,
            },
            conn.userId,
          );
          break;
        }

        case "typing:stop": {
          const { channelId } =
            msg.data as WsClientEvents["typing:stop"];
          broadcastToChannel(
            channelId,
            "typing:user-stop",
            { channelId, userId: conn.userId },
            conn.userId,
          );
          break;
        }

        // ─── RTC / Voice events ──────────────────────────────
        case "rtc:join-voice": {
          const { channelId } =
            msg.data as WsClientEvents["rtc:join-voice"];

          const [ch] = await app.db
            .select()
            .from(channels)
            .where(eq(channels.id, channelId))
            .limit(1);

          if (!ch || ch.type !== "voice") {
            sendTo(conn, "error", {
              message: "Invalid voice channel",
            });
            return;
          }

          mediasoupServer.ensurePeer(conn.userId);
          const existingProducerIds = voiceRoomManager.join(
            channelId,
            conn.userId,
            conn.username,
          );
          conn.voiceChannelId = channelId;

          const participants = voiceRoomManager
            .getChannelUserIds(channelId)
            .map((uid) => ({
              userId: uid,
              username: connections.get(uid)?.username ?? "Unknown",
            }));

          sendTo(conn, "rtc:voice-state", {
            channelId,
            participants,
          });

          for (const uid of voiceRoomManager.getChannelUserIds(channelId)) {
            if (uid === conn.userId) continue;
            const other = connections.get(uid);
            if (other) {
              sendTo(other, "rtc:peer-joined", {
                userId: conn.userId,
                username: conn.username,
                channelId,
              });
            }
          }

          // Tell this user about existing producers
          for (const pid of existingProducerIds) {
            const producerPeer = mediasoupServer
              .getChannelProducers(channelId)
              .find((p) => p.producerId === pid);
            if (producerPeer) {
              sendTo(conn, "rtc:new-producer", {
                producerId: pid,
                producerPeerId: producerPeer.peerId,
                kind: producerPeer.kind as "audio" | "video",
              });
            }
          }

          app.log.info(
            `${conn.username} joined voice channel ${channelId}`,
          );
          break;
        }

        case "rtc:leave-voice": {
          cleanupVoiceFor(conn);
          break;
        }

        case "rtc:get-rtp-capabilities": {
          const { channelId } =
            msg.data as WsClientEvents["rtc:get-rtp-capabilities"];

          // Ensure router exists before querying capabilities
          await mediasoupServer.getOrCreateRouter(channelId);

          const caps = mediasoupServer.getRouterRtpCapabilities(channelId);
          if (!caps) {
            sendTo(conn, "error", {
              message: "Router not available",
            });
            return;
          }
          sendTo(conn, "rtc:rtp-capabilities", {
            rtpCapabilities: caps as unknown as Record<string, unknown>,
          });
          break;
        }

        case "rtc:create-transport": {
          const { channelId, direction } =
            msg.data as WsClientEvents["rtc:create-transport"];

          try {
            const transport =
              await mediasoupServer.createWebRtcTransport(
                channelId,
                conn.userId,
              );

            const t = mediasoupServer
              .ensurePeer(conn.userId)
              .transports.get(transport.id);
            if (t) {
              (t as unknown as { appData: Record<string, unknown> }).appData =
                { direction, channelId };
            }

            sendTo(conn, "rtc:transport-created", {
              ...transport,
              direction,
            });
          } catch (err) {
            app.log.error(err);
            sendTo(conn, "error", {
              message: "Failed to create transport",
            });
          }
          break;
        }

        case "rtc:connect-transport": {
          const { transportId, dtlsParameters } =
            msg.data as WsClientEvents["rtc:connect-transport"];

          try {
            await mediasoupServer.connectTransport(
              transportId,
              conn.userId,
              dtlsParameters as never,
            );
            sendTo(conn, "rtc:transport-connected", { transportId });
          } catch (err) {
            app.log.error(err);
            sendTo(conn, "error", {
              message: "Failed to connect transport",
            });
          }
          break;
        }

        case "rtc:produce": {
          const { transportId, kind, rtpParameters } =
            msg.data as WsClientEvents["rtc:produce"];

          try {
            const channelId = conn.voiceChannelId;
            if (!channelId) {
              sendTo(conn, "error", {
                message: "Not in a voice channel",
              });
              return;
            }

            const { producerId } = await mediasoupServer.produce(
              channelId,
              conn.userId,
              transportId,
              kind,
              rtpParameters as never,
            );

            voiceRoomManager.registerProducer(
              conn.userId,
              producerId,
            );

            sendTo(conn, "rtc:produced", { producerId });

            // Notify others in the channel
            for (const uid of voiceRoomManager.getChannelUserIds(channelId)) {
              if (uid === conn.userId) continue;
              const other = connections.get(uid);
              if (other) {
                sendTo(other, "rtc:new-producer", {
                  producerId,
                  producerPeerId: conn.userId,
                  kind,
                });
              }
            }
          } catch (err) {
            app.log.error(err);
            sendTo(conn, "error", {
              message: "Failed to produce",
            });
          }
          break;
        }

        case "rtc:consume": {
          const { producerPeerId, producerId } =
            msg.data as WsClientEvents["rtc:consume"];

          try {
            const channelId = conn.voiceChannelId;
            if (!channelId) {
              sendTo(conn, "error", {
                message: "Not in a voice channel",
              });
              return;
            }

            const result = await mediasoupServer.consume(
              channelId,
              producerPeerId,
              conn.userId,
              producerId,
            );

            sendTo(conn, "rtc:consumed", {
              ...result,
              producerPeerId,
            });
          } catch (err) {
            app.log.error(err);
            sendTo(conn, "error", {
              message: "Failed to consume",
            });
          }
          break;
        }

        case "rtc:consumer-resume": {
          const { consumerId } =
            msg.data as WsClientEvents["rtc:consumer-resume"];
          mediasoupServer.resumeConsumer(consumerId, conn.userId);
          sendTo(conn, "rtc:consumer-resumed", { consumerId });
          break;
        }

        case "rtc:producer-close": {
          const { producerId } =
            msg.data as WsClientEvents["rtc:producer-close"];
          mediasoupServer.closeProducer(producerId, conn.userId);
          voiceRoomManager.unregisterProducer(
            conn.userId,
            producerId,
          );

          // Notify peers
          const channelId = conn.voiceChannelId;
          if (channelId) {
            for (const uid of voiceRoomManager.getChannelUserIds(channelId)) {
              if (uid === conn.userId) continue;
              const other = connections.get(uid);
              if (other) {
                sendTo(other, "rtc:producer-closed", { producerId });
              }
            }
          }
          break;
        }

        case "rtc:consumer-close": {
          const { consumerId } =
            msg.data as WsClientEvents["rtc:consumer-close"];
          mediasoupServer.closeConsumer(consumerId, conn.userId);
          break;
        }

        default:
          socket.send(
            encodeWsMessage("error", {
              message: `Unknown event: ${msg.event}`,
            }),
          );
      }
    });

    socket.on("close", () => {
      if (!connection) return;

      // Leave voice channel if in one
      if (connection.voiceChannelId) {
        cleanupVoiceFor(connection);
      }

      for (const channelId of connection.joinedChannels) {
        channelMembers.get(channelId)?.delete(connection.userId);
      }

      connections.delete(connection.userId);
      app.log.info(`WS disconnected: ${connection.username}`);
    });
  });
}

function cleanupVoiceFor(conn: Connection) {
  if (!conn.voiceChannelId) return;

  const channelId = conn.voiceChannelId;
  conn.voiceChannelId = null;

  voiceRoomManager.leave(conn.userId);

  for (const uid of voiceRoomManager.getChannelUserIds(channelId)) {
    const other = connections.get(uid);
    if (other) {
      sendTo(other, "rtc:peer-left", {
        userId: conn.userId,
        channelId,
      });
    }
  }
}

// ── Helper exported for REST routes that need to push data ──
export { broadcastToChannel };
