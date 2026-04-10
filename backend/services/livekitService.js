const { AccessToken, RoomServiceClient } = require("livekit-server-sdk");
const { config } = require("../config/env");

const ensureLiveKitConfig = () => {
  if (!config.LIVEKIT_API_KEY || !config.LIVEKIT_API_SECRET) {
    throw new Error("LiveKit credentials are not configured");
  }
};

const normalizeLivekitHost = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return "";
  }

  if (parsed.protocol === "ws:") {
    parsed.protocol = "http:";
  } else if (parsed.protocol === "wss:") {
    parsed.protocol = "https:";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "";
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
};

const getRoomServiceClient = () => {
  ensureLiveKitConfig();

  const host = normalizeLivekitHost(config.LIVEKIT_HOST || config.LIVEKIT_WS_URL);
  if (!host) {
    throw new Error("LiveKit host is not configured");
  }

  return new RoomServiceClient(host, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);
};

const createLiveToken = async ({
  identity,
  name,
  roomName,
  canPublish = false,
  ttl = "2h",
}) => {
  ensureLiveKitConfig();

  const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl,
  });

  token.metadata = JSON.stringify({ userId: identity });
  token.name = name;

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: Boolean(canPublish),
    canSubscribe: true,
  });

  return token.toJwt();
};

const deleteLiveRoom = async (roomName) => {
  const trimmedRoomName = String(roomName || "").trim();
  if (!trimmedRoomName) {
    return;
  }

  const client = getRoomServiceClient();
  await client.deleteRoom(trimmedRoomName);
};

module.exports = {
  createLiveToken,
  deleteLiveRoom,
};
