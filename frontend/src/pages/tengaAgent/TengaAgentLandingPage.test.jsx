import {
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  sendTengaAgentMessage,
  getTengaAgentPilotVisitorReplies,
  getTengaAgentPilotVisitorTranscript,
} from "../../services/tengaAgentApi";

import TengaAgentLandingPage
  from "./TengaAgentLandingPage";

vi.mock(
  "../../services/tengaAgentApi",
  () => ({
    sendTengaAgentMessage:
      vi.fn(),
    getTengaAgentPilotVisitorReplies: vi.fn(),
    getTengaAgentPilotVisitorTranscript: vi.fn(),
  })
);

describe(
  "TengaAgentLandingPage",
  () => {
    afterEach(() => { vi.unstubAllGlobals(); });
    beforeEach(() => {
      vi.clearAllMocks();
      window.sessionStorage.clear();
      getTengaAgentPilotVisitorReplies.mockResolvedValue({ messages: [] });
      getTengaAgentPilotVisitorTranscript.mockResolvedValue({ messages: [] });

      sendTengaAgentMessage
        .mockResolvedValue({
          ok: true,
          reply:
            "Yes. Tengacion develops AI-enabled software.",
          sessionId:
            "test-session",
          actions: [],
        });
    });

    it(
      "renders the live TengaAgent product experience",
      () => {
        render(
          <TengaAgentLandingPage />
        );

        expect(
          screen.getByText(
            /Never miss another/i
          )
        ).toBeInTheDocument();

        expect(
          screen.getByPlaceholderText(
            "Ask TengaAgent anything..."
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "₦59,900"
          )
        ).toBeInTheDocument();
      }
    );

    it(
      "sends a live demo message through the TengaAgent API client",
      async () => {
        const user =
          userEvent.setup();

        render(
          <TengaAgentLandingPage />
        );

        const input =
          screen.getByPlaceholderText(
            "Ask TengaAgent anything..."
          );

        await user.type(
          input,
          "Do you build AI software?"
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Send message",
            }
          )
        );

        expect(
          sendTengaAgentMessage
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            agentId:
              "tengacion-demo",

            message:
              "Do you build AI software?",
            sessionId: expect.stringMatching(
              /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            ),
          })
        );

        expect(
          await screen.findByText(
            "Yes. Tengacion develops AI-enabled software."
          )
        ).toBeInTheDocument();
      }
    );

    it("restores the full server transcript after a page reload with the same session", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ pilotMode: true }),
      }));
      getTengaAgentPilotVisitorTranscript.mockResolvedValue({
        ok: true,
        messages: [
          { id: "stored-customer", sender: "customer", content: "Hello, what can you do for my business?" },
          { id: "stored-ai", sender: "agent", content: "I can answer customer questions and help capture leads." },
          { id: "stored-human", sender: "human", content: "Our team can help as well." },
        ],
      });
      const first = render(<TengaAgentLandingPage />);
      expect(await screen.findByText("Hello, what can you do for my business?")).toBeInTheDocument();
      expect(screen.getByText("I can answer customer questions and help capture leads.")).toBeInTheDocument();
      expect(screen.getByText("Our team can help as well.")).toBeInTheDocument();
      const firstSession = window.sessionStorage.getItem("tengaagent:tengacion-demo:session");
      expect(firstSession).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      first.unmount();
      render(<TengaAgentLandingPage />);
      expect(await screen.findByText("Hello, what can you do for my business?")).toBeInTheDocument();
      expect(screen.getByText("I can answer customer questions and help capture leads.")).toBeInTheDocument();
      expect(getTengaAgentPilotVisitorTranscript).toHaveBeenCalledTimes(2);
      expect(getTengaAgentPilotVisitorTranscript).toHaveBeenLastCalledWith({
        agentId: "tengacion-demo", sessionId: firstSession,
      });
    });

    it(
      "switches between Nigerian and international pricing",
      async () => {
        const user =
          userEvent.setup();

        render(
          <TengaAgentLandingPage />
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /International/i,
            }
          )
        );

        expect(
          screen.getByText(
            "$149"
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "₦59,900"
          )
        ).not.toBeInTheDocument();
      }
    );
  }
);
