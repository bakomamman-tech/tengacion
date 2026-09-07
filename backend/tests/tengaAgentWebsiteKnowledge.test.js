process.env.NODE_ENV =
  "test";

process.env.MONGO_URI =
  "mongodb://127.0.0.1:27017/tengaagent-website-knowledge-test";

process.env.JWT_SECRET =
  "tengaagent-website-knowledge-test-secret";

process.env.OPENAI_API_KEY =
  "";

const mongoose =
  require("mongoose");

const {
  MongoMemoryServer,
} = require(
  "mongodb-memory-server"
);

const KnowledgeSource =
  require(
    "../models/tengaAgent/KnowledgeSource"
  );

const KnowledgeChunk =
  require(
    "../models/tengaAgent/KnowledgeChunk"
  );

const {
  fetchWebsiteText,
  htmlToKnowledgeText,
  validateCustomerZeroWebsiteUrl,
} = require(
  "../services/tengaAgent/websiteKnowledgeService"
);

const {
  syncKnowledgeSource,
} = require(
  "../services/tengaAgent/knowledgeIngestionService"
);

let mongod;

beforeAll(async () => {
  mongod =
    await MongoMemoryServer.create();

  await mongoose.connect(
    mongod.getUri()
  );
});

beforeEach(async () => {
  await mongoose.connection.db
    .dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();

  if (mongod) {
    await mongod.stop();
  }
});

describe(
  "TengaAgent website knowledge",
  () => {
    it(
      "extracts readable page text without scripts or styles",
      () => {
        const text =
          htmlToKnowledgeText(`
            <!doctype html>
            <html>
              <head>
                <title>Tengacion</title>
                <style>.secret { display:none; }</style>
                <script>window.hiddenSecret = "NO";</script>
              </head>
              <body>
                <main>
                  <h1>About Tengacion</h1>
                  <p>
                    Tengacion helps fans discover African creators.
                  </p>
                  <ul>
                    <li>Music</li>
                    <li>Books</li>
                  </ul>
                </main>
              </body>
            </html>
          `);

        expect(
          text
        ).toMatch(
          /About Tengacion/i
        );

        expect(
          text
        ).toMatch(
          /African creators/i
        );

        expect(
          text
        ).not.toMatch(
          /hiddenSecret/
        );

        expect(
          text
        ).not.toMatch(
          /display:none/
        );
      }
    );

    it(
      "allows only approved Tengacion HTTPS website URLs",
      () => {
        expect(
          validateCustomerZeroWebsiteUrl(
            "https://tengacion.com/about"
          ).hostname
        ).toBe(
          "tengacion.com"
        );

        expect(
          () =>
            validateCustomerZeroWebsiteUrl(
              "http://tengacion.com/about"
            )
        ).toThrow(
          /HTTPS/i
        );

        expect(
          () =>
            validateCustomerZeroWebsiteUrl(
              "https://127.0.0.1/private"
            )
        ).toThrow(
          /not allowed/i
        );

        expect(
          () =>
            validateCustomerZeroWebsiteUrl(
              "https://evil.example/"
            )
        ).toThrow(
          /not allowed/i
        );
      }
    );

    it(
      "fetches and normalizes an allowed public page",
      async () => {
        const fetchImpl =
          jest.fn(
            async () => ({
              ok: true,
              status: 200,

              headers: {
                get:
                  (name) => {
                    const key =
                      String(name)
                        .toLowerCase();

                    if (
                      key ===
                      "content-type"
                    ) {
                      return "text/html; charset=utf-8";
                    }

                    return null;
                  },
              },

              text:
                async () =>
                  `
                    <html>
                      <body>
                        <h1>How Tengacion works</h1>
                        <p>
                          Creator profiles anchor public releases and discovery.
                        </p>
                      </body>
                    </html>
                  `,
            })
          );

        const result =
          await fetchWebsiteText({
            url:
              "https://tengacion.com/how-it-works",
            fetchImpl,
          });

        expect(
          fetchImpl
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          result.text
        ).toMatch(
          /Creator profiles/i
        );
      }
    );

    it(
      "does not re-embed unchanged business knowledge",
      async () => {
        const organizationId =
          new mongoose.Types.ObjectId();

        const embedder =
          jest.fn(
            async (texts) =>
              texts.map(
                () => [
                  1,
                  0,
                ]
              )
          );

        const args = {
          organizationId,
          agentId: null,
          type:
            "website",
          title:
            "About Tengacion",
          sourceUrl:
            "https://tengacion.com/about",
          text:
            "Tengacion helps fans discover African creators across music, books, podcasts, videos, and public profiles.",
          embedder,
        };

        const first =
          await syncKnowledgeSource(
            args
          );

        const second =
          await syncKnowledgeSource(
            args
          );

        expect(
          first.unchanged
        ).toBe(false);

        expect(
          second.unchanged
        ).toBe(true);

        expect(
          embedder
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          await KnowledgeSource.countDocuments({
            organizationId,
            status:
              "ready",
          })
        ).toBe(1);

        expect(
          await KnowledgeChunk.countDocuments({
            organizationId,
          })
        ).toBeGreaterThan(
          0
        );
      }
    );
  }
);