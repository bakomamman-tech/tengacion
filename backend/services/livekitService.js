const { AccessToken } = require("livekit-server-sdk");
const { config } = require("../config/env");

const ensureLiveKitConfig = () => {
  if (!config.LIVEKIT_API_KEY || !config.LIVEKIT_API_SECRET) {
    throw new Error("LiveKit credentials are not configured");
  }
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

module.exports = {
  createLiveToken,
};
