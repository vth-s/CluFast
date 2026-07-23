import {
  encodeWsMessage,
  decodeWsMessage,
} from "@cordfast/shared";

type Handler<T = unknown> = (data: T) => void;

const WS_URL =
  import.meta.env.VITE_WS_URL || "wss://cordfast.dpdns.org/ws";

export class WsClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;
  private _connected = false;

  get connected() {
    return this._connected;
  }

  connect(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.token = token;
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.ws!.send(
        encodeWsMessage("auth", { token }),
      );
    };

    this.ws.onmessage = (event) => {
      const msg = decodeWsMessage(event.data);
      if (!msg) return;

      if (msg.event === "auth:ok") {
        this._connected = true;
        this.emit("auth:ok", msg.data);
        return;
      }

      this.emit(msg.event, msg.data);
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.emit("disconnected", null);
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.token = null;
    this._connected = false;
    this.ws?.close();
    this.ws = null;
  }

  send<T>(event: string, data: T) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(encodeWsMessage(event, data));
  }

  on<T>(event: string, handler: Handler<T>) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as Handler);
    return () => {
      this.handlers.get(event)?.delete(handler as Handler);
    };
  }

  private emit(event: string, data: unknown) {
    this.handlers.get(event)?.forEach((h) => h(data));
    this.handlers.get("*")?.forEach((h) => h({ event, data }));
  }

  private scheduleReconnect() {
    if (!this.token || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) this.connect(this.token);
    }, 3000);
  }
}

export const wsClient = new WsClient();
