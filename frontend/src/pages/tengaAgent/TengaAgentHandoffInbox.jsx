import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getTengaAgentOwnerConversation,
  getTengaAgentOwnerConversations,
  sendTengaAgentOwnerHumanMessage,
  updateTengaAgentOwnerConversationAction,
} from "../../services/tengaAgentApi";

import "./tengaagent-handoff.css";

const FILTERS = [
  "queue",
  "handoff_requested",
  "human_active",
  "closed",
  "all",
];

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

const displayContact = (conversation) => {
  const record = conversation.lead || conversation.appointment;

  if (!record) {
    return "Anonymous visitor";
  }

  return (
    record.name ||
    record.email ||
    record.phone ||
    "Anonymous visitor"
  );
};

const queueMatch = (conversation) =>
  ["handoff_requested", "human_active"].includes(
    conversation.status
  );

function TranscriptMessage({ message }) {
  const label =
    message.sender === "customer"
      ? "Visitor"
      : message.sender === "human"
        ? "Human"
        : message.sender === "agent"
          ? "AI"
          : "System";

  return (
    <article
      className={`tengaagent-handoff__message tengaagent-handoff__message--${message.sender}`}
    >
      <div>
        <strong>{label}</strong>
        <time dateTime={message.createdAt || ""}>
          {formatDate(message.createdAt)}
        </time>
      </div>
      <p>{message.content}</p>
    </article>
  );
}

export default function TengaAgentHandoffInbox() {
  const [conversations, setConversations] = useState([]);
  const [filter, setFilter] = useState("queue");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response =
        await getTengaAgentOwnerConversations({
          status: "all",
          limit: 100,
        });

      const next = Array.isArray(response?.conversations)
        ? response.conversations
        : [];

      setConversations(next);

      if (
        selectedId &&
        !next.some((conversation) => conversation.id === selectedId)
      ) {
        setSelectedId("");
        setDetail(null);
      }
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not load the human handoff queue."
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (conversationId) => {
    if (!conversationId) {
      setDetail(null);
      return;
    }

    setIsLoadingDetail(true);
    setError("");

    try {
      const response =
        await getTengaAgentOwnerConversation({
          conversationId,
        });
      setDetail(response);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not load that transcript."
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    }
  }, [loadDetail, selectedId]);

  const counts = useMemo(() => {
    const result = {
      queue: 0,
      handoff_requested: 0,
      human_active: 0,
      closed: 0,
      all: conversations.length,
    };

    for (const conversation of conversations) {
      if (queueMatch(conversation)) {
        result.queue += 1;
      }
      if (result[conversation.status] !== undefined) {
        result[conversation.status] += 1;
      }
    }

    return result;
  }, [conversations]);

  const visible = useMemo(() => {
    if (filter === "all") {
      return conversations;
    }

    if (filter === "queue") {
      return conversations.filter(queueMatch);
    }

    return conversations.filter(
      (conversation) => conversation.status === filter
    );
  }, [conversations, filter]);

  const updateConversationLocally = (nextConversation) => {
    if (!nextConversation?.id) {
      return;
    }

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === nextConversation.id
          ? { ...conversation, ...nextConversation }
          : conversation
      )
    );
    setDetail((current) =>
      current?.conversation?.id === nextConversation.id
        ? {
            ...current,
            conversation: {
              ...current.conversation,
              ...nextConversation,
            },
          }
        : current
    );
  };

  const runAction = async (action) => {
    if (!selectedId || busyAction) {
      return;
    }

    setBusyAction(action);
    setError("");

    try {
      const response =
        await updateTengaAgentOwnerConversationAction({
          conversationId: selectedId,
          action,
        });

      updateConversationLocally(response?.conversation);
      await loadDetail(selectedId);
      await loadConversations();
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not update that handoff."
      );
    } finally {
      setBusyAction("");
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();

    const content = reply.trim();
    if (!content || !selectedId || isSending) {
      return;
    }

    setIsSending(true);
    setError("");

    try {
      await sendTengaAgentOwnerHumanMessage({
        conversationId: selectedId,
        content,
      });
      setReply("");
      await loadDetail(selectedId);
      await loadConversations();
    } catch (requestError) {
      setError(
        requestError?.message ||
          "TengaAgent could not send that human reply."
      );
    } finally {
      setIsSending(false);
    }
  };

  const selectedConversation = detail?.conversation || null;
  const canReply =
    selectedConversation?.status === "human_active" &&
    Boolean(selectedConversation?.assignedToUser);

  return (
    <section className="tengaagent-handoff" id="owner-handoff">
      <div className="tengaagent-handoff__header">
        <div>
          <span>HUMAN HANDOFF</span>
          <h3>Conversation queue</h3>
          <p>
            Claim conversations before replying. While a
            conversation is human-active, TengaAgent stops
            generating AI replies for that visitor.
          </p>
        </div>
        <button
          type="button"
          onClick={loadConversations}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing…" : "Refresh queue"}
        </button>
      </div>

      {error ? (
        <div className="tengaagent-handoff__error" role="alert">
          {error}
        </div>
      ) : null}

      <div
        className="tengaagent-handoff__filters"
        role="group"
        aria-label="Conversation status filter"
      >
        {FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            className={filter === status ? "active" : ""}
            onClick={() => setFilter(status)}
          >
            {status.replaceAll("_", " ")}
            <span>{counts[status]}</span>
          </button>
        ))}
      </div>

      <div className="tengaagent-handoff__layout">
        <div className="tengaagent-handoff__list">
          {!isLoading && visible.length === 0 ? (
            <div className="tengaagent-handoff__empty">
              No conversations in this view.
            </div>
          ) : null}

          {visible.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={
                selectedId === conversation.id ? "active" : ""
              }
              onClick={() => setSelectedId(conversation.id)}
            >
              <div>
                <strong>{displayContact(conversation)}</strong>
                <span>{conversation.status.replaceAll("_", " ")}</span>
              </div>
              <p>
                {conversation.lastMessage?.content ||
                  "Conversation started"}
              </p>
              <time dateTime={conversation.lastMessageAt || ""}>
                {formatDate(conversation.lastMessageAt)}
              </time>
            </button>
          ))}
        </div>

        <div className="tengaagent-handoff__detail">
          {!selectedId ? (
            <div className="tengaagent-handoff__empty">
              Select a conversation to review its transcript.
            </div>
          ) : null}

          {selectedId && isLoadingDetail ? (
            <div className="tengaagent-handoff__empty">
              Loading transcript…
            </div>
          ) : null}

          {selectedConversation && !isLoadingDetail ? (
            <>
              <div className="tengaagent-handoff__detail-head">
                <div>
                  <strong>{displayContact(selectedConversation)}</strong>
                  <span>
                    {selectedConversation.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="tengaagent-handoff__actions">
                  {["handoff_requested", "ai_active"].includes(
                    selectedConversation.status
                  ) ? (
                    <button
                      type="button"
                      onClick={() => runAction("claim")}
                      disabled={Boolean(busyAction)}
                    >
                      {busyAction === "claim" ? "Claiming…" : "Claim"}
                    </button>
                  ) : null}

                  {selectedConversation.status === "human_active" ? (
                    <button
                      type="button"
                      onClick={() => runAction("release")}
                      disabled={Boolean(busyAction)}
                    >
                      Release
                    </button>
                  ) : null}

                  {selectedConversation.status !== "closed" ? (
                    <button
                      type="button"
                      onClick={() => runAction("close")}
                      disabled={Boolean(busyAction)}
                    >
                      Close
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runAction("reopen")}
                      disabled={Boolean(busyAction)}
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>

              {selectedConversation.lead ? (
                <div className="tengaagent-handoff__context">
                  <strong>Lead</strong>
                  <span>
                    {selectedConversation.lead.email ||
                      selectedConversation.lead.phone ||
                      "Contact captured"}
                  </span>
                  {selectedConversation.lead.projectSummary ? (
                    <p>{selectedConversation.lead.projectSummary}</p>
                  ) : null}
                </div>
              ) : null}

              {selectedConversation.appointment ? (
                <div className="tengaagent-handoff__context">
                  <strong>Appointment request</strong>
                  <span>{selectedConversation.appointment.purpose || "Meeting"}</span>
                  <p>
                    {formatDate(
                      selectedConversation.appointment.preferredStartAt
                    )}
                  </p>
                </div>
              ) : null}

              <div className="tengaagent-handoff__transcript">
                {(detail?.messages || []).map((message) => (
                  <TranscriptMessage
                    key={message.id}
                    message={message}
                  />
                ))}
              </div>

              {canReply ? (
                <form
                  className="tengaagent-handoff__composer"
                  onSubmit={sendReply}
                >
                  <label htmlFor="tengaagent-human-reply">
                    Human reply
                  </label>
                  <textarea
                    id="tengaagent-human-reply"
                    value={reply}
                    maxLength={6000}
                    rows={3}
                    placeholder="Reply as the business owner…"
                    onChange={(event) => setReply(event.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={isSending || !reply.trim()}
                  >
                    {isSending ? "Sending…" : "Send human reply"}
                  </button>
                </form>
              ) : (
                <p className="tengaagent-handoff__hint">
                  Claim this conversation before sending a human reply.
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
