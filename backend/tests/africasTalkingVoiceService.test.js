const {
  AfricasTalkingVoiceError,
  escapeXml,
  buildRecordingCallbackUrl,
  buildVoiceCallbackXml,
  validateRecordingMetadata,
  summarizeVoiceEvent,
} = require(
  "../services/africasTalkingVoiceService"
);


describe(
  "africasTalkingVoiceService",
  () => {

    test(
      "escapes XML-sensitive values",
      () => {

        expect(
          escapeXml(
            `<caller a="b">Tom & Jerry's</caller>`
          )
        ).toBe(
          "&lt;caller a=&quot;b&quot;&gt;Tom &amp; Jerry&apos;s&lt;/caller&gt;"
        );
      }
    );


    test(
      "builds safe Say and Record XML",
      () => {

        const xml =
          buildVoiceCallbackXml({
            greeting:
              `Welcome <caller> & "friend"`,

            recordingPrompt:
              "Describe what's wrong & press #.",

            callbackBaseUrl:
              "https://voicebridge.example.com",
          });


        expect(
          xml
        ).toContain(
          '<?xml version="1.0" encoding="UTF-8"?>'
        );

        expect(
          xml
        ).toContain(
          "<Response>"
        );

        expect(
          xml
        ).toContain(
          "<Record"
        );

        expect(
          xml
        ).toContain(
          'callbackUrl="https://voicebridge.example.com/api/codeswitch/africastalking/voice/recording"'
        );

        expect(
          xml
        ).toContain(
          "&lt;caller&gt;"
        );

        expect(
          xml
        ).toContain(
          "&amp;"
        );

        expect(
          xml
        ).not.toContain(
          "<caller>"
        );

        expect(
          xml.endsWith(
            "</Response>"
          )
        ).toBe(
          true
        );
      }
    );


    test(
      "can build recording XML before callback base URL is configured",
      () => {

        const xml =
          buildVoiceCallbackXml({
            callbackBaseUrl:
              "",
          });


        expect(
          xml
        ).toContain(
          "<Record"
        );

        expect(
          xml
        ).not.toContain(
          "callbackUrl="
        );
      }
    );


    test.each([
      "http://voicebridge.example.com",
      "ftp://voicebridge.example.com",
      "not-a-url",
      "https://user:password@voicebridge.example.com",
    ])(
      "rejects unsafe callback base URL %p",
      (value) => {

        expect(
          () =>
            buildRecordingCallbackUrl(
              value
            )
        ).toThrow(
          AfricasTalkingVoiceError
        );
      }
    );


    test(
      "accepts HTTPS recording metadata without returning sensitive URL",
      () => {

        const sensitiveUrl =
          "https://recordings.example.com/audio.wav?signature=VERY_SECRET";


        const result =
          validateRecordingMetadata({
            recordingUrl:
              sensitiveUrl,

            sessionId:
              "session-test",

            durationInSeconds:
              "14.5",
          });


        expect(
          result
        ).toMatchObject({
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
            14.5,

          remoteFetchPerformed:
            false,

          audioDownloaded:
            false,
        });


        const serialized =
          JSON.stringify(
            result
          );


        expect(
          serialized
        ).not.toContain(
          sensitiveUrl
        );

        expect(
          serialized
        ).not.toContain(
          "VERY_SECRET"
        );
      }
    );


    test.each([
      "",
      "http://recordings.example.com/audio.wav",
      "ftp://recordings.example.com/audio.wav",
      "not-a-url",
      "https://user:password@recordings.example.com/audio.wav",
    ])(
      "rejects unsafe recording URL %p",
      (recordingUrl) => {

        expect(
          () =>
            validateRecordingMetadata({
              recordingUrl,
            })
        ).toThrow(
          AfricasTalkingVoiceError
        );
      }
    );


    test(
      "summarizes voice events without echoing private fields",
      () => {

        const result =
          summarizeVoiceEvent({
            event:
              "CallCompleted",

            sessionId:
              "PRIVATE_SESSION",

            callerNumber:
              "+2348012345678",

            hidden:
              "PRIVATE_VALUE",
          });


        expect(
          result
        ).toMatchObject({
          provider:
            "africastalking",

          channel:
            "voice",

          event:
            "CallCompleted",

          sessionIdPresent:
            true,

          callerPresent:
            true,

          rawPayloadEchoed:
            false,
        });


        const serialized =
          JSON.stringify(
            result
          );


        expect(
          serialized
        ).not.toContain(
          "PRIVATE_SESSION"
        );

        expect(
          serialized
        ).not.toContain(
          "+2348012345678"
        );

        expect(
          serialized
        ).not.toContain(
          "PRIVATE_VALUE"
        );
      }
    );
  }
);