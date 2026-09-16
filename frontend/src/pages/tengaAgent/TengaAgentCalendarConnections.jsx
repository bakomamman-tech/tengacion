import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  completeTengaAgentCalendarConnection,
  disconnectTengaAgentCalendarConnection,
  getTengaAgentCalendarConnections,
  startTengaAgentCalendarConnection,
} from "../../services/tengaAgentCalendarApi";

import "./tengaagent-calendar-connections.css";

const cleanOAuthQuery = () => {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  [
    "code",
    "state",
    "scope",
    "authuser",
    "prompt",
    "session_state",
    "error",
    "error_description",
    "error_subcode",
  ].forEach((key) => url.searchParams.delete(key));

  window.history.replaceState(
    {},
    document.title,
    `${url.pathname}${
      url.searchParams.toString()
        ? `?${url.searchParams.toString()}`
        : ""
    }${url.hash}`
  );
};

const formatDate = (value) => {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function TengaAgentCalendarConnections() {
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionProvider, setActionProvider] =
    useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const oauthHandledRef = useRef(false);

  const loadConnections = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response =
        await getTengaAgentCalendarConnections();
      setProviders(
        Array.isArray(response?.providers)
          ? response.providers
          : []
      );
    } catch (requestError) {
      if (requestError?.status === 404) {
        setProviders([]);
      } else {
        setError(
          requestError?.message ||
            "TengaAgent could not load calendar connections."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (
      oauthHandledRef.current ||
      typeof window === "undefined"
    ) {
      return;
    }

    const params = new URLSearchParams(
      window.location.search
    );
    const state = params.get("state") || "";
    const code = params.get("code") || "";
    const oauthError = params.get("error") || "";

    if (!state || (!code && !oauthError)) {
      return;
    }

    oauthHandledRef.current = true;
    setIsLoading(true);
    setError("");
    setNotice("");

    completeTengaAgentCalendarConnection({
      code,
      state,
      error: oauthError,
    })
      .then((response) => {
        setNotice(
          `${
            response?.connection?.displayName ||
            "Calendar"
          } connected successfully.`
        );
        return loadConnections();
      })
      .catch((requestError) => {
        setError(
          requestError?.message ||
            "Calendar connection could not be completed."
        );
      })
      .finally(() => {
        cleanOAuthQuery();
        setIsLoading(false);
      });
  }, [loadConnections]);

  const connect = async (provider) => {
    if (actionProvider) {
      return;
    }

    setActionProvider(provider);
    setError("");
    setNotice("");

    try {
      const response =
        await startTengaAgentCalendarConnection(
          provider
        );

      if (!response?.authorizationUrl) {
        throw new Error(
          "Calendar authorization URL was not returned."
        );
      }

      window.location.assign(
        response.authorizationUrl
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Calendar connection could not be started."
      );
      setActionProvider("");
    }
  };

  const disconnect = async (provider) => {
    if (actionProvider) {
      return;
    }

    setActionProvider(provider);
    setError("");
    setNotice("");

    try {
      await disconnectTengaAgentCalendarConnection(
        provider
      );
      setNotice("Calendar disconnected.");
      await loadConnections();
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Calendar could not be disconnected."
      );
    } finally {
      setActionProvider("");
    }
  };

  return (
    <div className="tengaagent-calendar-connections">
      <div className="tengaagent-calendar-connections__intro">
        <strong>External calendars</strong>
        <span>
          Connect a read-only calendar so TengaAgent can
          remove externally busy times from public meeting
          slots. OAuth tokens stay encrypted on the server.
        </span>
      </div>

      {isLoading && providers.length === 0 ? (
        <div className="tengaagent-calendar-connections__loading">
          Loading calendar connections…
        </div>
      ) : (
        <div className="tengaagent-calendar-connections__grid">
          {providers.map((provider) => {
            const connection = provider.connection;
            const isBusy =
              actionProvider === provider.provider;

            return (
              <article
                key={provider.provider}
                className="tengaagent-calendar-connections__card"
              >
                <div>
                  <span className="tengaagent-calendar-connections__provider">
                    {provider.label}
                  </span>
                  <strong>
                    {provider.connected
                      ? "Connected"
                      : provider.configured
                        ? "Ready to connect"
                        : "Admin setup required"}
                  </strong>
                  <small>
                    {provider.connected
                      ? `Last checked: ${formatDate(
                          connection?.lastSyncedAt
                        )}`
                      : provider.configured
                        ? "Connect your calendar with read-only availability access."
                        : "Tengacion must configure this provider's OAuth credentials first."}
                  </small>
                  {connection?.lastError ? (
                    <small className="tengaagent-calendar-connections__provider-error">
                      {connection.lastError}
                    </small>
                  ) : null}
                </div>

                {provider.connected ? (
                  <button
                    type="button"
                    onClick={() =>
                      disconnect(provider.provider)
                    }
                    disabled={Boolean(actionProvider)}
                  >
                    {isBusy
                      ? "Disconnecting…"
                      : "Disconnect"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      connect(provider.provider)
                    }
                    disabled={
                      Boolean(actionProvider) ||
                      !provider.configured
                    }
                  >
                    {isBusy
                      ? "Opening provider…"
                      : `Connect ${provider.label}`}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {error ? (
        <div
          className="tengaagent-calendar-connections__notice tengaagent-calendar-connections__notice--error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          className="tengaagent-calendar-connections__notice"
          role="status"
        >
          {notice}
        </div>
      ) : null}
    </div>
  );
}
