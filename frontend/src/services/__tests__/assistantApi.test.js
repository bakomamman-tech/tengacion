import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequestMock = vi.hoisted(() => vi.fn());
const getSessionAccessTokenMock = vi.hoisted(() => vi.fn(() => ""));

vi.mock("../../api", () => ({
  API_BASE: "/api",
  apiRequest: (...args) => apiRequestMock(...args),
}));

vi.mock("../../authSession", () => ({
  getSessionAccessToken: (...args) => getSessionAccessTokenMock(...args),
}));

import {
  fetchAssistantHints,
  sendAssistantFeedback,
  sendAssistantMessage,
  streamAssistantMessage,
} from "../assistantApi";

describe("assistantApi", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    getSessionAccessTokenMock.mockReset();
    getSessionAccessTokenMock.mockReturnValue("");
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("sends Akuso chat requests with the new schema and normalizes responses for the dock", async () => {
    apiRequestMock.mockResolvedValue({
      ok: true,
      mode: "creator_writing",
      category: "SAFE_ANSWER",
      answer: "Here are a few launch ideas.",
      warnings: [],
      suggestions: ["Make it shorter", "Rewrite it for fans"],
      actions: [{ type: "navigate", label: "Open creator dashboard", target: "/creator/dashboard" }],
      drafts: ["Draft one", "Draft two"],
      traceId: "trace-123",
      feedbackToken: "feedback-123",
      conversationId: "conversation-123",
      meta: {
        provider: "openai",
        model: "gpt-5.4-mini",
        task: "creator_writing",
        grounded: true,
        usedModel: true,
        safetyLevel: "safe",
        sources: ["Creator writing"],
      },
    });

    const response = await sendAssistantMessage({
      message: "Write a launch caption for my new EP",
      conversationId: "conversation-123",
      context: {
        currentPath: "/creator/music/upload",
        currentSearch: "?draft=true",
        surface: "creator_music_upload",
        pageTitle: "Creator music upload",
        selectedChatId: "",
        selectedContentId: "track-1",
      },
      assistantModeHint: "writing",
      preferences: {
        tone: "premium",
        audience: "fans",
        length: "long",
        simplicity: "standard",
        language: "English",
      },
    });

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/akuso/chat",
      expect.objectContaining({
        method: "POST",
        suppressAuthFailure: true,
      })
    );

    const [, requestOptions] = apiRequestMock.mock.calls[0];
    const requestBody = JSON.parse(requestOptions.body);

    expect(requestBody).toEqual({
      message: "Write a launch caption for my new EP",
      mode: "creator_writing",
      sessionKey: expect.any(String),
      stream: false,
      conversationId: "conversation-123",
      currentRoute: "/creator/music/upload",
      currentPage: "Creator music upload",
      contextHints: {
        surface: "creator_music_upload",
        pageTitle: "Creator music upload",
        section: "?draft=true",
        selectedEntity: "track-1",
      },
      preferences: {
        answerLength: "detailed",
        tone: "premium",
        preferredMode: "writing",
        creatorStyle: "standard",
        audience: "fans",
        language: "English",
      },
    });

    expect(response).toEqual(
      expect.objectContaining({
        responseId: "trace-123",
        feedbackToken: "feedback-123",
        conversationId: "conversation-123",
        mode: "writing",
        message: "Here are a few launch ideas.",
        cards: [
          expect.objectContaining({
            type: "draft",
            payload: expect.objectContaining({
              text: "Draft one",
            }),
          }),
          expect.objectContaining({
            type: "draft",
            payload: expect.objectContaining({
              text: "Draft two",
            }),
          }),
        ],
        followUps: [
          expect.objectContaining({
            prompt: "Make it shorter",
          }),
          expect.objectContaining({
            prompt: "Rewrite it for fans",
          }),
        ],
        actions: [
          expect.objectContaining({
            target: "/creator/dashboard",
          }),
        ],
        trust: expect.objectContaining({
          provider: "openai",
          usedModel: true,
          mode: "creator-writing",
        }),
      })
    );
  });

  it("streams Akuso responses progressively and returns the final normalized reply", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                [
                  'event: ready\ndata: {"traceId":"trace-stream-1"}\n\n',
                  'event: status\ndata: {"phase":"analyzing","label":"Checking policy and grounding"}\n\n',
                  'event: message_start\ndata: {"responseId":"trace-stream-1","conversationId":"conversation-stream-1","mode":"knowledge_learning","category":"SAFE_ANSWER"}\n\n',
                  'event: message_delta\ndata: {"delta":"Nigeria is "}\n\n',
                  'event: message_delta\ndata: {"delta":"diverse."}\n\n',
                  'event: complete\ndata: {"response":{"traceId":"trace-stream-1","conversationId":"conversation-stream-1","mode":"knowledge_learning","category":"SAFE_ANSWER","answer":"Nigeria is diverse.","suggestions":["Explain it more simply"],"actions":[],"drafts":[],"details":[{"title":"Key idea","body":"Nigeria has many cultures."}],"sources":[{"id":"knowledge:nigerian-culture","type":"knowledge_base","label":"Nigerian culture","summary":"Grounded local knowledge."}],"cards":[{"type":"knowledge","title":"Nigerian culture","subtitle":"Grounded answer","description":"Grounded local knowledge.","route":"","payload":{"text":"Explain Nigerian culture more simply"}}],"feedbackToken":"feedback-stream-1","meta":{"provider":"local_fallback","grounded":true,"usedModel":false,"safetyLevel":"safe","sources":["Nigerian culture"]}}}\n\n',
                ].join("")
              )
            );
            controller.close();
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
          },
        }
      )
    );

    const statuses = [];
    const starts = [];
    const deltas = [];

    const response = await streamAssistantMessage({
      message: "Explain Nigerian culture simply",
      assistantModeHint: "knowledge",
      onStatus: (event) => statuses.push(event),
      onStart: (event) => starts.push(event),
      onDelta: (event) => deltas.push(event),
    });

    expect(statuses).toEqual([
      expect.objectContaining({
        label: "Checking policy and grounding",
      }),
    ]);
    expect(starts).toEqual([
      expect.objectContaining({
        responseId: "trace-stream-1",
      }),
    ]);
    expect(deltas.at(-1)).toEqual(
      expect.objectContaining({
        content: "Nigeria is diverse.",
      })
    );

    expect(response).toEqual(
      expect.objectContaining({
        responseId: "trace-stream-1",
        conversationId: "conversation-stream-1",
        message: "Nigeria is diverse.",
        cards: [
          expect.objectContaining({
            type: "knowledge",
            title: "Nigerian culture",
          }),
        ],
        details: [
          expect.objectContaining({
            title: "Key idea",
          }),
        ],
        sources: [
          expect.objectContaining({
            type: "knowledge_base",
          }),
        ],
      })
    );
  });

  it("fetches route-aware hints for the current page", async () => {
    apiRequestMock.mockResolvedValue({
      ok: true,
      mode: "app_help",
      currentRoute: "/creator/dashboard",
      traceId: "trace-hints-1",
      hints: ["Upload a song", "Open creator earnings"],
    });

    const response = await fetchAssistantHints({
      context: {
        currentPath: "/creator/dashboard",
        pageTitle: "Creator Dashboard",
      },
      assistantModeHint: "copilot",
    });

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/akuso/hints?currentRoute=%2Fcreator%2Fdashboard&currentPage=Creator+Dashboard&mode=app_help",
      expect.objectContaining({
        method: "GET",
        suppressAuthFailure: true,
      })
    );

    expect(response).toEqual({
      mode: "copilot",
      currentRoute: "/creator/dashboard",
      traceId: "trace-hints-1",
      hints: ["Upload a song", "Open creator earnings"],
    });
  });

  it("sends Akuso feedback with trace and category metadata", async () => {
    apiRequestMock.mockResolvedValue({ ok: true, feedbackId: "feedback-1" });

    await sendAssistantFeedback({
      conversationId: "conversation-321",
      responseId: "trace-321",
      feedbackToken: "feedback-token-321",
      rating: "not_helpful",
      mode: "copilot",
      category: "APP_GUIDANCE",
    });

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/akuso/feedback",
      expect.objectContaining({
        method: "POST",
        suppressAuthFailure: true,
      })
    );

    const [, requestOptions] = apiRequestMock.mock.calls[0];
    expect(JSON.parse(requestOptions.body)).toEqual({
      conversationId: "conversation-321",
      traceId: "trace-321",
      feedbackToken: "feedback-token-321",
      rating: "not_helpful",
      mode: "app_help",
      category: "APP_GUIDANCE",
    });
  });
});
