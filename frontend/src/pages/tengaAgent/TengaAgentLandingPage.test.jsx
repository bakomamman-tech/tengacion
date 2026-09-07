import {
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  sendTengaAgentMessage,
} from "../../services/tengaAgentApi";

import TengaAgentLandingPage
  from "./TengaAgentLandingPage";

vi.mock(
  "../../services/tengaAgentApi",
  () => ({
    sendTengaAgentMessage:
      vi.fn(),
  })
);

describe(
  "TengaAgentLandingPage",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

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
          })
        );

        expect(
          await screen.findByText(
            "Yes. Tengacion develops AI-enabled software."
          )
        ).toBeInTheDocument();
      }
    );

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
