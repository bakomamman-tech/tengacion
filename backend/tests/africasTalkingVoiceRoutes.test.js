const express =
  require("express");

const request =
  require("supertest");


jest.mock(
  "../services/saharaService",
  () => ({
    SaharaServiceError:
      class SaharaServiceError extends Error {},

    transcribeWithSahara:
      jest.fn(),
  })
);


jest.mock(
  "../services/openAiCodeswitchService",
  () => ({
    OpenAiCodeswitchError:
      class OpenAiCodeswitchError extends Error {},

    transcribeWithOpenAI:
      jest.fn(),
  })
);


jest.mock(
  "../services/whisperCodeswitchService",
  () => ({
    WhisperCodeswitchError:
      class WhisperCodeswitchError extends Error {},

    transcribeWithWhisper:
      jest.fn(),
  })
);


jest.mock(
  "../services/geminiCodeswitchService",
  () => ({
    GeminiCodeswitchError:
      class GeminiCodeswitchError extends Error {},

    transcribeWithGemini:
      jest.fn(),
  })
);


jest.mock(
  "../services/chirpCodeswitchService",
  () => ({
    ChirpCodeswitchError:
      class ChirpCodeswitchError extends Error {},

    transcribeWithChirp:
      jest.fn(),
  })
);


jest.mock(
  "../services/codeswitchBenchmarkService",
  () => ({
    runCodeswitchBenchmark:
      jest.fn(),
  })
);


jest.mock(
  "../services/codeswitchActionService",
  () => ({
    CodeswitchActionError:
      class CodeswitchActionError extends Error {},

    executeCodeswitchAction:
      jest.fn(),
  })
);


const {
  transcribeWithSahara,
} = require(
  "../services/saharaService"
);

const {
  transcribeWithOpenAI,
} = require(
  "../services/openAiCodeswitchService"
);

const {
  transcribeWithWhisper,
} = require(
  "../services/whisperCodeswitchService"
);

const {
  transcribeWithGemini,
} = require(
  "../services/geminiCodeswitchService"
);

const {
  transcribeWithChirp,
} = require(
  "../services/chirpCodeswitchService"
);

const {
  runCodeswitchBenchmark,
} = require(
  "../services/codeswitchBenchmarkService"
);

const {
  executeCodeswitchAction,
} = require(
  "../services/codeswitchActionService"
);


const codeswitchRouter =
  require(
    "../routes/codeswitch"
  );


const app =
  express();


app.use(
  express.json({
    limit:
      "512kb",
  })
);


app.use(
  express.urlencoded({
    extended:
      true,

    limit:
      "512kb",

    parameterLimit:
      1000,
  })
);


app.use(
  "/api/codeswitch",
  codeswitchRouter
);


const expectNoProviderOrActionCalls =
  () => {

    expect(
      transcribeWithSahara
    ).not.toHaveBeenCalled();

    expect(
      transcribeWithOpenAI
    ).not.toHaveBeenCalled();

    expect(
      transcribeWithWhisper
    ).not.toHaveBeenCalled();

    expect(
      transcribeWithGemini
    ).not.toHaveBeenCalled();

    expect(
      transcribeWithChirp
    ).not.toHaveBeenCalled();

    expect(
      runCodeswitchBenchmark
    ).not.toHaveBeenCalled();

    expect(
      executeCodeswitchAction
    ).not.toHaveBeenCalled();
  };


describe(
  "Africa's Talking Voice callback routes",
  () => {

    let originalFetch;


    beforeAll(
      () => {

        originalFetch =
          global.fetch;

        global.fetch =
          jest.fn();
      }
    );


    afterAll(
      () => {

        global.fetch =
          originalFetch;
      }
    );


    afterEach(
      () => {

        jest.clearAllMocks();
      }
    );


    test(
      "voice callback returns HTTP 200 XML",
      async () => {

        const response =
          await request(
            app
          )
            .post(
              "/api/codeswitch/africastalking/voice/callback"
            )
            .type(
              "form"
            )
            .send({
              sessionId:
                "test-session",

              callerNumber:
                "+2348012345678",
            });


        expect(
          response.status
        ).toBe(
          200
        );


        expect(
          response.headers[
            "content-type"
          ]
        ).toMatch(
          /application\/xml/
        );


        expect(
          response.headers[
            "cache-control"
          ]
        ).toBe(
          "no-store"
        );


        expect(
          response.text
        ).toContain(
          "<Response>"
        );


        expect(
          response.text
        ).toContain(
          "<Say>"
        );


        expect(
          response.text
        ).toContain(
          "</Response>"
        );


        expect(
          global.fetch
        ).not.toHaveBeenCalled();


        expectNoProviderOrActionCalls();
      }
    );


    test(
      "voice event callback acknowledges safely without echoing raw caller data",
      async () => {

        const rawPhone =
          "+2348012345678";

        const privateSession =
          "PRIVATE_SESSION_ID";

        const hiddenValue =
          "DO_NOT_ECHO_THIS";


        const response =
          await request(
            app
          )
            .post(
              "/api/codeswitch/africastalking/voice/events"
            )
            .type(
              "form"
            )
            .send({
              event:
                "CallCompleted",

              callerNumber:
                rawPhone,

              sessionId:
                privateSession,

              hidden:
                hiddenValue,
            });


        expect(
          response.status
        ).toBe(
          200
        );


        expect(
          response.body
        ).toMatchObject({
          ok:
            true,

          acknowledged:
            true,

          eventReceived:
            true,

          sessionIdPresent:
            true,

          callerPresent:
            true,

          rawPayloadEchoed:
            false,

          providerCallsPerformed:
            false,

          moneyMovementPerformed:
            false,
        });


        const serialized =
          JSON.stringify(
            response.body
          );


        expect(
          serialized
        ).not.toContain(
          rawPhone
        );


        expect(
          serialized
        ).not.toContain(
          privateSession
        );


        expect(
          serialized
        ).not.toContain(
          hiddenValue
        );


        expect(
          global.fetch
        ).not.toHaveBeenCalled();


        expectNoProviderOrActionCalls();
      }
    );


    test(
      "recording callback accepts HTTPS metadata but performs no fetch or ASR",
      async () => {

        const recordingUrl =
          "https://recordings.example.com/audio.wav?token=PRIVATE_TEST_TOKEN";


        const response =
          await request(
            app
          )
            .post(
              "/api/codeswitch/africastalking/voice/recording"
            )
            .type(
              "form"
            )
            .send({
              recordingUrl,

              sessionId:
                "PRIVATE_RECORDING_SESSION",

              durationInSeconds:
                "12.7",
            });


        expect(
          response.status
        ).toBe(
          202
        );


        expect(
          response.body
        ).toMatchObject({
          ok:
            true,

          recordingAccepted:
            true,

          processingEnabled:
            false,

          providerCallsPerformed:
            false,

          remoteFetchPerformed:
            false,

          audioDownloaded:
            false,

          moneyMovementPerformed:
            false,

          recording: {
            provider:
              "africastalking",

            channel:
              "voice",

            recordingUrlPresent:
              true,

            recordingUrlHttps:
              true,

            sessionIdPresent:
              true,

            durationSeconds:
              12.7,

            remoteFetchPerformed:
              false,

            audioDownloaded:
              false,
          },
        });


        const serialized =
          JSON.stringify(
            response.body
          );


        expect(
          serialized
        ).not.toContain(
          recordingUrl
        );


        expect(
          serialized
        ).not.toContain(
          "PRIVATE_TEST_TOKEN"
        );


        expect(
          serialized
        ).not.toContain(
          "PRIVATE_RECORDING_SESSION"
        );


        expect(
          global.fetch
        ).not.toHaveBeenCalled();


        expectNoProviderOrActionCalls();
      }
    );


    test(
      "recording callback rejects non-HTTPS URL before any fetch",
      async () => {

        const response =
          await request(
            app
          )
            .post(
              "/api/codeswitch/africastalking/voice/recording"
            )
            .type(
              "form"
            )
            .send({
              recordingUrl:
                "http://recordings.example.com/audio.wav",
            });


        expect(
          response.status
        ).toBe(
          400
        );


        expect(
          response.body
        ).toMatchObject({
          ok:
            false,

          recordingAccepted:
            false,

          processingEnabled:
            false,

          providerCallsPerformed:
            false,

          remoteFetchPerformed:
            false,

          audioDownloaded:
            false,

          moneyMovementPerformed:
            false,

          error: {
            code:
              "AFRICASTALKING_INVALID_RECORDING_URL",
          },
        });


        expect(
          global.fetch
        ).not.toHaveBeenCalled();


        expectNoProviderOrActionCalls();
      }
    );


    test(
      "recording callback rejects missing URL without processing",
      async () => {

        const response =
          await request(
            app
          )
            .post(
              "/api/codeswitch/africastalking/voice/recording"
            )
            .type(
              "form"
            )
            .send({
              sessionId:
                "session-with-no-url",
            });


        expect(
          response.status
        ).toBe(
          400
        );


        expect(
          response.body
            ?.error
            ?.code
        ).toBe(
          "AFRICASTALKING_INVALID_RECORDING_URL"
        );


        expect(
          global.fetch
        ).not.toHaveBeenCalled();


        expectNoProviderOrActionCalls();
      }
    );
  }
);