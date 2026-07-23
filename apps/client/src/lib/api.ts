const API_URL = import.meta.env.VITE_API_URL || "https://cordfast.dpdns.org";

interface ApiOptions extends RequestInit {
  token?: string;
}

async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { token, ...init } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || `API error ${res.status}`);
  }

  return body as T;
}

export const api = {
  register: (data: { username: string; email: string; password: string }) =>
    request<{ user: import("@cordfast/shared").User; token: string }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(data) },
    ),

  login: (data: { email: string; password: string }) =>
    request<{ user: import("@cordfast/shared").User; token: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(data) },
    ),

  getMe: (token: string) =>
    request<{ user: import("@cordfast/shared").User }>("/users/me", {
      token,
    }),

  getServers: (token: string) =>
    request<{ servers: import("@cordfast/shared").Server[] }>(
      "/users/me/servers",
      { token },
    ),

  createServer: (name: string, token: string) =>
    request<{ server: import("@cordfast/shared").Server }>("/servers", {
      method: "POST",
      body: JSON.stringify({ name }),
      token,
    }),

  getChannels: (serverId: string, token: string) =>
    request<{ channels: import("@cordfast/shared").Channel[] }>(
      `/servers/${serverId}/channels`,
      { token },
    ),

  createChannel: (
    serverId: string,
    name: string,
    type: "text" | "voice",
    token: string,
  ) =>
    request<{ channel: import("@cordfast/shared").Channel }>(
      `/servers/${serverId}/channels`,
      {
        method: "POST",
        body: JSON.stringify({ name, type }),
        token,
      },
    ),

  getMessages: (channelId: string, token: string, before?: string) => {
    const params = before ? `?before=${before}` : "";
    return request<{
      messages: Array<
        import("@cordfast/shared").Message & {
          author: { id: string; username: string; avatarUrl: string | null };
          authorUsername: string;
          authorAvatarUrl: string | null;
        }
      >;
      hasMore: boolean;
    }>(`/channels/${channelId}/messages${params}`, { token });
  },
};
