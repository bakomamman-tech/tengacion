import { beforeEach, describe, expect, it, vi } from "vitest";

const socketInstances = [];

const createMockSocket = () => {
  const handlers = new Map();
  const socket = {
    auth: {},
    connected: true,
    disconnected: false,
    on: vi.fn((event, handler) => {
      const nextHandlers = handlers.get(event) || [];
      nextHandlers.push(handler);
      handlers.set(event, nextHandlers);
      return socket;
    }),
    off: vi.fn((event, handler) => {
      if (!handlers.has(event)) {
        return socket;
      }
      if (!handler) {
        handlers.delete(event);
        return socket;
      }
      handlers.set(
        event,
        (handlers.get(event) || []).filter((entry) => entry !== handler)
      );
      return socket;
    }),
    emit: vi.fn(),
    connect: vi.fn(() => {
      socket.connected = true;
      socket.disconnected = false;
      return socket;
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
      socket.disconnected = true;
      return socket;
    }),
    removeAllListeners: vi.fn(() => {
      handlers.clear();
    }),
    trigger: (event, payload) => {
      for (const handler of handlers.get(event) || []) {
        handler(payload);
      }
    },
  };

  return socket;
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => {
    const socket = createMockSocket();
    socketInstances.push(socket);
    return socket;
  }),
}));

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("socket auth recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    socketInstances.length = 0;
  });

  it("refreshes the session instead of logging out on socket token expiry", async () => {
    const authSession = await import("../authSession");
    const { SESSION_LOGOUT_EVENT, getSessionAccessToken, setSessionAccessToken } = authSession;
    const logoutListener = vi.fn();
    window.addEventListener(SESSION_LOGOUT_EVENT, logoutListener);

    try {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        jsonResponse({ token: "fresh-token", user: { _id: "user-1" } })
      );

      setSessionAccessToken("stale-token");

      const { connectSocket } = await import("../socket");
      const socket = connectSocket({ userId: "user-1" });

      expect(socket).toBeTruthy();
      expect(socket.connect).toHaveBeenCalledTimes(1);

      socket.trigger("auth:logout", {
        code: "TOKEN_EXPIRED",
        message: "Session expired",
      });

      await vi.waitFor(() => {
        expect(getSessionAccessToken()).toBe("fresh-token");
      });

      expect(socket.disconnect).toHaveBeenCalledTimes(1);
      expect(socket.connect).toHaveBeenCalledTimes(2);
      expect(socket.auth).toMatchObject({
        token: "fresh-token",
        userId: "user-1",
      });
      expect(logoutListener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(SESSION_LOGOUT_EVENT, logoutListener);
      authSession.clearSessionAccessToken();
    }
  });

  it("dispatches a logout when socket recovery cannot refresh the session", async () => {
    const authSession = await import("../authSession");
    const { SESSION_LOGOUT_EVENT, getSessionAccessToken, setSessionAccessToken } = authSession;
    const logoutListener = vi.fn();
    window.addEventListener(SESSION_LOGOUT_EVENT, logoutListener);

    try {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        jsonResponse({ error: "Session revoked" }, 401)
      );

      setSessionAccessToken("stale-token");

      const { connectSocket } = await import("../socket");
      const socket = connectSocket({ userId: "user-1" });

      socket.trigger("auth:logout", {
        code: "SESSION_REVOKED",
        message: "Session revoked",
      });

      await vi.waitFor(() => {
        expect(logoutListener).toHaveBeenCalledTimes(1);
      });

      expect(getSessionAccessToken()).toBe("");
    } finally {
      window.removeEventListener(SESSION_LOGOUT_EVENT, logoutListener);
      authSession.clearSessionAccessToken();
    }
  });
});
