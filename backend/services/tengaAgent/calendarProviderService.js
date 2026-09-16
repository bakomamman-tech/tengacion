const crypto = require("crypto");

const { config } = require("../../config/env");

const PROVIDERS = ["google", "microsoft"];
const REQUEST_TIMEOUT_MS = 10000;
const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/calendar.freebusy";
const MICROSOFT_SCOPE = "Calendars.ReadBasic";

const cleanText = (value, max = 500) =>
  String(value || "")
    .trim()
    .slice(0, max);

const normalizeProvider = (value) => {
  const provider = cleanText(value, 40).toLowerCase();

  if (!PROVIDERS.includes(provider)) {
    throw new Error("Unsupported calendar provider.");
  }

  return provider;
};

const normalizeBaseUrl = (value) =>
  cleanText(value, 1000).replace(/\/+$/, "");

const callbackBaseUrl = () =>
  normalizeBaseUrl(
    process.env.TENGAAGENT_CALENDAR_CALLBACK_BASE_URL ||
      config.clientUrl
  );

const defaultRedirectUri = () =>
  `${callbackBaseUrl()}/tengaagent`;

const getProviderConfiguration = (input) => {
  const provider = normalizeProvider(input);

  if (provider === "google") {
    const clientId = cleanText(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      1000
    );
    const clientSecret = cleanText(
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      1000
    );
    const redirectUri = cleanText(
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
        defaultRedirectUri(),
      1000
    );

    return {
      provider,
      configured: Boolean(
        clientId && clientSecret && redirectUri
      ),
      clientId,
      clientSecret,
      redirectUri,
      scopes: [GOOGLE_SCOPE],
      authorizationEndpoint:
        "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint:
        "https://oauth2.googleapis.com/token",
    };
  }

  const tenant =
    cleanText(
      process.env.MICROSOFT_CALENDAR_TENANT,
      120
    ) || "common";
  const clientId = cleanText(
    process.env.MICROSOFT_CALENDAR_CLIENT_ID,
    1000
  );
  const clientSecret = cleanText(
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET,
    1000
  );
  const redirectUri = cleanText(
    process.env.MICROSOFT_CALENDAR_REDIRECT_URI ||
      defaultRedirectUri(),
    1000
  );

  return {
    provider,
    configured: Boolean(
      clientId && clientSecret && redirectUri
    ),
    clientId,
    clientSecret,
    redirectUri,
    scopes: ["offline_access", MICROSOFT_SCOPE],
    authorizationEndpoint:
      `https://login.microsoftonline.com/${encodeURIComponent(
        tenant
      )}/oauth2/v2.0/authorize`,
    tokenEndpoint:
      `https://login.microsoftonline.com/${encodeURIComponent(
        tenant
      )}/oauth2/v2.0/token`,
  };
};

const createPkcePair = () => {
  const verifier = crypto
    .randomBytes(48)
    .toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  return {
    verifier,
    challenge,
  };
};

const buildAuthorizationUrl = ({
  provider,
  state,
  codeChallenge,
}) => {
  const settings =
    getProviderConfiguration(provider);

  if (!settings.configured) {
    throw new Error(
      `${settings.provider} calendar integration is not configured.`
    );
  }

  const url = new URL(
    settings.authorizationEndpoint
  );

  url.searchParams.set("client_id", settings.clientId);
  url.searchParams.set("redirect_uri", settings.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    settings.scopes.join(" ")
  );
  url.searchParams.set("state", state);
  url.searchParams.set(
    "code_challenge",
    codeChallenge
  );
  url.searchParams.set(
    "code_challenge_method",
    "S256"
  );

  if (settings.provider === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  } else {
    url.searchParams.set("response_mode", "query");
  }

  return url.toString();
};

const fetchWithTimeout = async (
  url,
  options = {}
) => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const parseJsonResponse = async (
  response,
  label
) => {
  const raw = await response.text();
  let data = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        `${label} returned an invalid response.`
      );
    }
  }

  if (!response.ok) {
    const error = new Error(
      `${label} request failed with status ${response.status}.`
    );
    error.status = response.status;
    throw error;
  }

  return data;
};

const tokenRequest = async ({
  settings,
  params,
}) => {
  const body = new URLSearchParams({
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    ...params,
  });

  const response = await fetchWithTimeout(
    settings.tokenEndpoint,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  return parseJsonResponse(
    response,
    `${settings.provider} OAuth token`
  );
};

const exchangeAuthorizationCode = async ({
  provider,
  code,
  codeVerifier,
}) => {
  const settings =
    getProviderConfiguration(provider);

  if (!settings.configured) {
    throw new Error(
      `${settings.provider} calendar integration is not configured.`
    );
  }

  const params = {
    code,
    redirect_uri: settings.redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  };

  if (settings.provider === "microsoft") {
    params.scope = settings.scopes.join(" ");
  }

  return tokenRequest({ settings, params });
};

const refreshProviderToken = async ({
  provider,
  refreshToken,
}) => {
  const settings =
    getProviderConfiguration(provider);

  if (!settings.configured) {
    throw new Error(
      `${settings.provider} calendar integration is not configured.`
    );
  }

  const params = {
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  };

  if (settings.provider === "microsoft") {
    params.scope = settings.scopes.join(" ");
  }

  return tokenRequest({ settings, params });
};

const googleBusyIntervals = async ({
  accessToken,
  from,
  to,
  calendarId = "primary",
}) => {
  const response = await fetchWithTimeout(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: [
          {
            id: calendarId || "primary",
          },
        ],
      }),
    }
  );

  const data = await parseJsonResponse(
    response,
    "Google Calendar free/busy"
  );
  const calendars = data?.calendars || {};
  const calendar =
    calendars[calendarId] ||
    calendars.primary ||
    Object.values(calendars)[0] ||
    {};

  return Array.isArray(calendar.busy)
    ? calendar.busy
        .map((entry) => ({
          startAt: new Date(entry.start),
          endAt: new Date(entry.end),
          kind: "google_calendar",
        }))
        .filter(
          (entry) =>
            !Number.isNaN(entry.startAt.getTime()) &&
            !Number.isNaN(entry.endAt.getTime()) &&
            entry.startAt < entry.endAt
        )
    : [];
};

const graphDate = (value) => {
  const dateTime = cleanText(value?.dateTime, 100);
  const timeZone = cleanText(value?.timeZone, 100);

  if (!dateTime) {
    return new Date(NaN);
  }

  if (
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateTime)
  ) {
    return new Date(dateTime);
  }

  if (/^(UTC|Etc\/UTC)$/i.test(timeZone)) {
    return new Date(`${dateTime}Z`);
  }

  return new Date(dateTime);
};

const microsoftBusyIntervals = async ({
  accessToken,
  from,
  to,
  calendarId = "primary",
}) => {
  const base =
    !calendarId || calendarId === "primary"
      ? "https://graph.microsoft.com/v1.0/me/calendar/calendarView"
      : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(
          calendarId
        )}/calendarView`;
  const url = new URL(base);
  url.searchParams.set(
    "startDateTime",
    from.toISOString()
  );
  url.searchParams.set(
    "endDateTime",
    to.toISOString()
  );
  url.searchParams.set(
    "$select",
    "start,end,showAs,isCancelled"
  );
  url.searchParams.set("$top", "200");

  const events = [];
  let nextUrl = url.toString();
  let page = 0;

  while (nextUrl && page < 10) {
    const response = await fetchWithTimeout(
      nextUrl,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: 'outlook.timezone="UTC"',
        },
      }
    );
    const data = await parseJsonResponse(
      response,
      "Microsoft Calendar view"
    );

    if (Array.isArray(data.value)) {
      events.push(...data.value);
    }

    const candidate = cleanText(
      data["@odata.nextLink"],
      4000
    );

    if (candidate) {
      const parsed = new URL(candidate);
      nextUrl =
        parsed.origin ===
        "https://graph.microsoft.com"
          ? parsed.toString()
          : "";
    } else {
      nextUrl = "";
    }

    page += 1;
  }

  const nonBlocking = new Set([
    "free",
    "workingElsewhere",
  ]);

  return events
    .filter(
      (event) =>
        event?.isCancelled !== true &&
        !nonBlocking.has(
          cleanText(event?.showAs, 40)
        )
    )
    .map((event) => ({
      startAt: graphDate(event.start),
      endAt: graphDate(event.end),
      kind: "microsoft_calendar",
    }))
    .filter(
      (entry) =>
        !Number.isNaN(entry.startAt.getTime()) &&
        !Number.isNaN(entry.endAt.getTime()) &&
        entry.startAt < entry.endAt
    );
};

const fetchProviderBusyIntervals = async ({
  provider,
  accessToken,
  from,
  to,
  calendarId,
}) => {
  const normalizedProvider =
    normalizeProvider(provider);

  if (normalizedProvider === "google") {
    return googleBusyIntervals({
      accessToken,
      from,
      to,
      calendarId,
    });
  }

  return microsoftBusyIntervals({
    accessToken,
    from,
    to,
    calendarId,
  });
};

module.exports = {
  PROVIDERS,
  buildAuthorizationUrl,
  createPkcePair,
  exchangeAuthorizationCode,
  fetchProviderBusyIntervals,
  getProviderConfiguration,
  normalizeProvider,
  refreshProviderToken,
};
