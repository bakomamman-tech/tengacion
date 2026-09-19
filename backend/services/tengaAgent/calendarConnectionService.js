const crypto = require("crypto");

const CalendarConnection = require(
  "../../models/tengaAgent/CalendarConnection"
);
const {
  findOwnerWorkspace,
} = require("./ownerWorkspaceService");
const {
  decryptJson,
  encryptJson,
  isCalendarEncryptionConfigured,
} = require("./calendarCryptoService");
const {
  PROVIDERS,
  buildAuthorizationUrl,
  createPkcePair,
  exchangeAuthorizationCode,
  fetchProviderBusyIntervals,
  getProviderConfiguration,
  normalizeProvider,
  refreshProviderToken,
} = require("./calendarProviderService");

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000;

const cleanText = (value, max = 500) =>
  String(value || "")
    .trim()
    .slice(0, max);

const tokenExpiry = (payload) => {
  const seconds = Number(payload?.expires_in);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000);
};

const tokenScopes = (payload, fallback) => {
  const raw = cleanText(payload?.scope, 4000);

  if (!raw) {
    return [...fallback];
  }

  return raw
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const providerLabel = (provider) =>
  provider === "google"
    ? "Google Calendar"
    : "Microsoft Outlook";

const serializeConnection = (connection) => {
  if (!connection) {
    return null;
  }

  return {
    id: connection._id,
    provider: connection.provider,
    status: connection.status,
    calendarId: connection.calendarId,
    displayName:
      connection.displayName ||
      providerLabel(connection.provider),
    scopes: connection.scopes || [],
    tokenExpiresAt: connection.tokenExpiresAt || null,
    lastSyncedAt: connection.lastSyncedAt || null,
    lastError: connection.lastError || "",
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
};

const getOwnerCalendarConnections = async ({
  userId,
}) => {
  const workspace = await findOwnerWorkspace(userId);

  if (!workspace?.agent) {
    return null;
  }

  const connections =
    await CalendarConnection.find({
      organizationId: workspace.organization._id,
      agentId: workspace.agent._id,
    }).lean();

  const byProvider = new Map(
    connections.map((connection) => [
      connection.provider,
      connection,
    ])
  );

  return {
    organization: workspace.organization,
    agent: workspace.agent,
    providers: PROVIDERS.map((provider) => {
      const settings =
        getProviderConfiguration(provider);
      const connection =
        byProvider.get(provider) || null;

      return {
        provider,
        label: providerLabel(provider),
        configured:
          settings.configured &&
          isCalendarEncryptionConfigured(),
        connected: Boolean(
          connection &&
            connection.status !== "revoked"
        ),
        connection:
          serializeConnection(connection),
      };
    }),
  };
};

const startOwnerCalendarConnection = async ({
  userId,
  provider,
}) => {
  const normalizedProvider =
    normalizeProvider(provider);
  const workspace = await findOwnerWorkspace(userId);

  if (!workspace?.agent) {
    return null;
  }

  const settings =
    getProviderConfiguration(normalizedProvider);

  if (
    !settings.configured ||
    !isCalendarEncryptionConfigured()
  ) {
    throw new Error(
      `${providerLabel(normalizedProvider)} integration is not configured.`
    );
  }

  const pkce = createPkcePair();
  const state = encryptJson({
    version: 1,
    provider: normalizedProvider,
    userId: String(userId),
    organizationId: String(
      workspace.organization._id
    ),
    agentId: String(workspace.agent._id),
    codeVerifier: pkce.verifier,
    nonce: crypto.randomUUID(),
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  });

  return {
    provider: normalizedProvider,
    authorizationUrl: buildAuthorizationUrl({
      provider: normalizedProvider,
      state,
      codeChallenge: pkce.challenge,
    }),
  };
};

const decodeOAuthState = ({ state, userId }) => {
  let payload;

  try {
    payload = decryptJson(state);
  } catch {
    throw new Error(
      "Calendar authorization state is invalid or expired."
    );
  }

  const expiresAt = Number(payload?.expiresAt);

  if (
    !payload ||
    payload.version !== 1 ||
    !PROVIDERS.includes(payload.provider) ||
    String(payload.userId) !== String(userId) ||
    !payload.organizationId ||
    !payload.agentId ||
    !payload.codeVerifier ||
    !Number.isFinite(expiresAt) ||
    expiresAt < Date.now()
  ) {
    throw new Error(
      "Calendar authorization state is invalid or expired."
    );
  }

  return payload;
};

const completeOwnerCalendarConnection = async ({
  userId,
  state,
  code,
  oauthError,
}) => {
  const payload = decodeOAuthState({
    state,
    userId,
  });
  const workspace = await findOwnerWorkspace(userId);

  if (
    !workspace?.agent ||
    String(workspace.organization._id) !==
      String(payload.organizationId) ||
    String(workspace.agent._id) !==
      String(payload.agentId)
  ) {
    throw new Error(
      "Calendar authorization no longer matches this TengaAgent workspace."
    );
  }

  if (oauthError) {
    throw new Error(
      "Calendar authorization was cancelled or denied."
    );
  }

  const cleanCode = cleanText(code, 8000);

  if (!cleanCode) {
    throw new Error(
      "Calendar authorization code is required."
    );
  }

  const settings =
    getProviderConfiguration(payload.provider);

  if (
    !settings.configured ||
    !isCalendarEncryptionConfigured()
  ) {
    throw new Error(
      `${providerLabel(payload.provider)} integration is not configured.`
    );
  }

  const existing =
    await CalendarConnection.findOne({
      organizationId: workspace.organization._id,
      agentId: workspace.agent._id,
      provider: payload.provider,
    }).select("+encryptedCredentials");

  let previousCredentials = {};

  if (existing?.encryptedCredentials) {
    try {
      previousCredentials = decryptJson(
        existing.encryptedCredentials
      );
    } catch {
      previousCredentials = {};
    }
  }

  const tokens = await exchangeAuthorizationCode({
    provider: payload.provider,
    code: cleanCode,
    codeVerifier: payload.codeVerifier,
  });
  const accessToken = cleanText(
    tokens?.access_token,
    12000
  );
  const refreshToken = cleanText(
    tokens?.refresh_token ||
      previousCredentials.refreshToken,
    12000
  );

  if (!accessToken) {
    throw new Error(
      "Calendar provider did not return an access token."
    );
  }

  const expiresAt = tokenExpiry(tokens);
  const credentials = {
    accessToken,
    refreshToken,
    tokenType:
      cleanText(tokens?.token_type, 80) || "Bearer",
    expiresAt:
      expiresAt?.toISOString() || null,
  };

  const connection =
    await CalendarConnection.findOneAndUpdate(
      {
        organizationId: workspace.organization._id,
        agentId: workspace.agent._id,
        provider: payload.provider,
      },
      {
        $set: {
          status: "active",
          calendarId: "primary",
          displayName: providerLabel(payload.provider),
          scopes: tokenScopes(
            tokens,
            settings.scopes
          ),
          encryptedCredentials:
            encryptJson(credentials),
          tokenExpiresAt: expiresAt,
          lastError: "",
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

  return {
    provider: payload.provider,
    connection: serializeConnection(connection),
  };
};

const disconnectOwnerCalendarConnection = async ({
  userId,
  provider,
}) => {
  const normalizedProvider =
    normalizeProvider(provider);
  const workspace = await findOwnerWorkspace(userId);

  if (!workspace?.agent) {
    return null;
  }

  await CalendarConnection.deleteOne({
    organizationId: workspace.organization._id,
    agentId: workspace.agent._id,
    provider: normalizedProvider,
  });

  return {
    provider: normalizedProvider,
    disconnected: true,
  };
};

const refreshConnectionAccessToken = async (
  connection,
  credentials
) => {
  const refreshToken = cleanText(
    credentials?.refreshToken,
    12000
  );

  if (!refreshToken) {
    const error = new Error(
      "Calendar refresh token is unavailable. Reconnect the calendar."
    );
    error.status = 401;
    throw error;
  }

  const tokens = await refreshProviderToken({
    provider: connection.provider,
    refreshToken,
  });
  const accessToken = cleanText(
    tokens?.access_token,
    12000
  );

  if (!accessToken) {
    const error = new Error(
      "Calendar provider did not return a refreshed access token."
    );
    error.status = 401;
    throw error;
  }

  const expiresAt = tokenExpiry(tokens);
  const nextCredentials = {
    accessToken,
    refreshToken: cleanText(
      tokens?.refresh_token || refreshToken,
      12000
    ),
    tokenType:
      cleanText(tokens?.token_type, 80) ||
      credentials?.tokenType ||
      "Bearer",
    expiresAt:
      expiresAt?.toISOString() || null,
  };

  connection.encryptedCredentials =
    encryptJson(nextCredentials);
  connection.tokenExpiresAt = expiresAt;
  connection.status = "active";
  connection.lastError = "";
  await connection.save();

  return nextCredentials;
};

const resolveConnectionCredentials = async (
  connection
) => {
  const credentials = decryptJson(
    connection.encryptedCredentials
  );
  const accessToken = cleanText(
    credentials?.accessToken,
    12000
  );
  const expiresAt = credentials?.expiresAt
    ? new Date(credentials.expiresAt)
    : null;
  const expiresAtIsValid =
    expiresAt &&
    !Number.isNaN(expiresAt.getTime());
  const stillValid = Boolean(
    accessToken &&
      (!expiresAt ||
        (expiresAtIsValid &&
          expiresAt.getTime() -
            TOKEN_REFRESH_SKEW_MS >
            Date.now()))
  );

  if (stillValid) {
    return credentials;
  }

  return refreshConnectionAccessToken(
    connection,
    credentials
  );
};

const getExternalCalendarBusyContext = async ({
  organizationId,
  agentId,
  from,
  to,
}) => {
  const connections =
    await CalendarConnection.find({
      organizationId,
      agentId,
      status: {
        $in: ["active", "error"],
      },
    }).select("+encryptedCredentials");

  if (connections.length === 0) {
    return {
      busyIntervals: [],
      connectedProviders: [],
      unavailableProviders: [],
    };
  }

  const busyIntervals = [];
  const unavailableProviders = [];

  for (const connection of connections) {
    try {
      const credentials =
        await resolveConnectionCredentials(
          connection
        );
      const intervals =
        await fetchProviderBusyIntervals({
          provider: connection.provider,
          accessToken: credentials.accessToken,
          from,
          to,
          calendarId:
            connection.calendarId || "primary",
        });

      busyIntervals.push(...intervals);
      connection.status = "active";
      connection.lastSyncedAt = new Date();
      connection.lastError = "";
      await connection.save();
    } catch (error) {
      unavailableProviders.push(
        connection.provider
      );
      connection.lastError = cleanText(
        error?.message ||
          "Calendar availability could not be read.",
        500
      );

      if (
        error?.status === 400 ||
        error?.status === 401 ||
        error?.status === 403
      ) {
        connection.status = "error";
      }

      await connection.save();
    }
  }

  return {
    busyIntervals,
    connectedProviders:
      connections.map(
        (connection) => connection.provider
      ),
    unavailableProviders,
  };
};

module.exports = {
  completeOwnerCalendarConnection,
  disconnectOwnerCalendarConnection,
  getExternalCalendarBusyContext,
  getOwnerCalendarConnections,
  serializeConnection,
  startOwnerCalendarConnection,
};
