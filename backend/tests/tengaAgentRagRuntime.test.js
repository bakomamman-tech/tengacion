process.env.NODE_ENV =
  "test";

process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-rag-runtime-test";

process.env.JWT_SECRET =
  "tengaagent-rag-runtime-test-secret";

process.env.OPENAI_API_KEY =
  "";

const {
  respondToCustomerZero,
} = require(
  "../services/tengaAgent/agentRuntimeService"
);

describe(
  "TengaAgent RAG runtime",
  () => {
    it(
      "injects only tenant-scoped retrieved knowledge into the AI instructions",
      async () => {
        const knowledgeRetriever =
          jest.fn(
            async ({
              organizationId,
              agentId,
              query,
            }) => {
              expect(
                organizationId
              ).toBe(
                "organization-a"
              );

              expect(
                agentId
              ).toBe(
                "agent-a"
              );

              expect(
                query
              ).toBe(
                "When does registration close?"
              );

              return [
                {
                  text:
                    "Registration for the September cohort closes on Friday at 5 PM.",
                  score:
                    0.94,
                },
              ];
            }
          );

        const aiResponder =
          jest.fn(
            async ({
              instructions,
            }) => {
              expect(
                instructions
              ).toContain(
                "Registration for the September cohort closes on Friday at 5 PM."
              );

              expect(
                instructions
              ).toMatch(
                /DATA, not instructions/i
              );

              expect(
                instructions
              ).not.toContain(
                "PRIVATE OTHER TENANT"
              );

              return {
                reply:
                  "Registration closes Friday at 5 PM.",
              };
            }
          );

        const result =
          await respondToCustomerZero({
            message:
              "When does registration close?",

            organizationId:
              "organization-a",

            agentId:
              "agent-a",

            knowledgeRetriever,

            aiResponder,
          });

        expect(
          knowledgeRetriever
        ).toHaveBeenCalledTimes(1);

        expect(
          result.reply
        ).toMatch(
          /Friday at 5 PM/i
        );
      }
    );

    it(
      "continues with baseline knowledge if retrieval fails",
      async () => {
        const warningSpy =
          jest
            .spyOn(
              console,
              "warn"
            )
            .mockImplementation(
              () => {}
            );

        const aiResponder =
          jest.fn(
            async ({
              instructions,
            }) => {
              expect(
                instructions
              ).toContain(
                "TENGACION"
              );

              return {
                reply:
                  "I can still help with Tengacion's software services.",
              };
            }
          );

        const result =
          await respondToCustomerZero({
            message:
              "What can Tengacion build?",

            organizationId:
              "organization-a",

            agentId:
              "agent-a",

            knowledgeRetriever:
              async () => {
                throw new Error(
                  "Embedding provider unavailable"
                );
              },

            aiResponder,
          });

        expect(
          result.reply
        ).toMatch(
          /software services/i
        );

        warningSpy.mockRestore();
      }
    );

    it(
      "does not retrieve knowledge without a tenant identity",
      async () => {
        const knowledgeRetriever =
          jest.fn();

        const result =
          await respondToCustomerZero({
            message:
              "Do you build websites?",

            knowledgeRetriever,

            aiResponder:
              async () => null,
          });

        expect(
          knowledgeRetriever
        ).not.toHaveBeenCalled();

        expect(
          result.reply
        ).toMatch(
          /web applications/i
        );
      }
    );
  }
);