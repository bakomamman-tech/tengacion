process.env.NODE_ENV =
  "test";

process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-runtime-test";

process.env.JWT_SECRET =
  "tengaagent-runtime-test-secret";

process.env.OPENAI_API_KEY =
  "";

const {
  buildCustomerZeroInstructions,
  respondToCustomerZero,
} = require(
  "../services/tengaAgent/agentRuntimeService"
);

describe(
  "TengaAgent AI runtime",
  () => {
    it(
      "uses the AI responder when a grounded response is available",
      async () => {
        const aiResponder =
          jest.fn(
            async ({
              instructions,
              conversationHistory,
              message,
            }) => {
              expect(
                instructions
              ).toContain(
                "TENGACION KNOWLEDGE"
              );

              expect(
                conversationHistory
              ).toEqual([
                {
                  sender:
                    "customer",
                  content:
                    "I need a website.",
                },
                {
                  sender:
                    "agent",
                  content:
                    "What kind of website?",
                },
              ]);

              expect(
                message
              ).toBe(
                "An ecommerce website."
              );

              return {
                reply:
                  "Yes. Tell me what you plan to sell and which payment methods you need.",
              };
            }
          );

        const result =
          await respondToCustomerZero({
            message:
              "An ecommerce website.",

            conversationHistory:
              [
                {
                  sender:
                    "customer",
                  content:
                    "I need a website.",
                },
                {
                  sender:
                    "agent",
                  content:
                    "What kind of website?",
                },
              ],

            aiResponder,
          });

        expect(
          aiResponder
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          result.reply
        ).toMatch(
          /what you plan to sell/i
        );
      }
    );

    it(
      "falls back safely when AI is unavailable",
      async () => {
        const result =
          await respondToCustomerZero({
            message:
              "Do you build websites?",

            aiResponder:
              async () => null,
          });

        expect(
          result.reply
        ).toMatch(
          /web applications/i
        );
      }
    );

    it(
      "includes anti-hallucination and secret-handling rules",
      () => {
        const instructions =
          buildCustomerZeroInstructions();

        expect(
          instructions
        ).toMatch(
          /Never invent/i
        );

        expect(
          instructions
        ).toMatch(
          /OTP/i
        );

        expect(
          instructions
        ).toMatch(
          /pricing/i
        );
      }
    );
  }
);
