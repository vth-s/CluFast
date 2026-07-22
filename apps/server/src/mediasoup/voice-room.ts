import { mediasoupServer } from "./server.js";

interface VoiceParticipant {
  userId: string;
  username: string;
  channelId: string;
  producerIds: Set<string>;
}

class VoiceRoomManager {
  private participants = new Map<string, VoiceParticipant>();
  private channelParticipants = new Map<string, Set<string>>();

  join(
    channelId: string,
    userId: string,
    username: string,
  ): string[] {
    let participant = this.participants.get(userId);
    if (participant) {
      participant.channelId = channelId;
    } else {
      participant = {
        userId,
        username,
        channelId,
        producerIds: new Set(),
      };
      this.participants.set(userId, participant);
    }

    if (!this.channelParticipants.has(channelId)) {
      this.channelParticipants.set(channelId, new Set());
    }
    this.channelParticipants.get(channelId)!.add(userId);

    // Return existing producers in this channel (excluding self)
    const existing: string[] = [];
    for (const [otherId, other] of this.participants) {
      if (otherId !== userId && other.channelId === channelId) {
        for (const pid of other.producerIds) {
          existing.push(pid);
        }
      }
    }

    return existing;
  }

  leave(userId: string) {
    const participant = this.participants.get(userId);
    if (!participant) return;

    const { channelId } = participant;
    this.channelParticipants.get(channelId)?.delete(userId);
    this.participants.delete(userId);
    mediasoupServer.removePeer(userId);

    if (
      this.channelParticipants.get(channelId)?.size === 0
    ) {
      this.channelParticipants.delete(channelId);
      mediasoupServer.destroyRouter(channelId);
    }
  }

  registerProducer(userId: string, producerId: string) {
    const participant = this.participants.get(userId);
    if (participant) {
      participant.producerIds.add(producerId);
    }
  }

  unregisterProducer(userId: string, producerId: string) {
    const participant = this.participants.get(userId);
    if (participant) {
      participant.producerIds.delete(producerId);
    }
  }

  getChannelUserIds(channelId: string): string[] {
    return [...(this.channelParticipants.get(channelId) ?? [])];
  }

  getUser(userId: string): VoiceParticipant | undefined {
    return this.participants.get(userId);
  }

  getChannelSize(channelId: string): number {
    return this.channelParticipants.get(channelId)?.size ?? 0;
  }
}

export const voiceRoomManager = new VoiceRoomManager();
