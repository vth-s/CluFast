export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface Server {
  id: string;
  name: string;
  ownerId: string;
  iconUrl: string | null;
  createdAt: Date;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: "text" | "voice";
  createdAt: Date;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
