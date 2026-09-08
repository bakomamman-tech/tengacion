const {
  AfricasTalkingRecordingFetchError,
  isBlockedAddress,
  validatePublicHttpsUrl,
  inferAudioFormat,
  fetchRecordingIntoMemory,
} = require(
  "../services/africasTalkingRecordingFetchService"
);


const publicLookup =
  async () => [
    {
      address: "8.8.8.8",
      family: 4,
    },
  ];


const headers = (
  values = {}
) => ({
  get: (name) =>
    values[
      String(name)
        .toLowerCase()
    ] ?? null,
});


const bodyFrom = (
  ...chunks
) => ({
  async *[Symbol.asyncIterator]() {
    for (const chunk of chunks) {
      yield Buffer.from(chunk);
    }
  },
});


describe(
  "Africa's Talking recording fetch service",
  () => {

    test(
      "blocks private IPv4 and IPv6 addresses",
      () => {

        expect(
          isBlockedAddress("127.0.0.1")
        ).toBe(true);

        expect(
          isBlockedAddress("10.0.0.1")
        ).toBe(true);

        expect(
          isBlockedAddress("192.168.1.10")
        ).toBe(true);

        expect(
          isBlockedAddress("::1")
        ).toBe(true);

        expect(
          isBlockedAddress("8.8.8.8")
        ).toBe(false);
      }
    );


    test(
      "requires HTTPS and rejects literal IP hosts",
      async () => {

        await expect(
          validatePublicHttpsUrl(
            "http://recordings.example.com/call.wav",
            {
              lookupImpl: publicLookup,
            }
          )
        ).rejects.toMatchObject({
          code:
            "AFRICASTALKING_INSECURE_RECORDING_URL",
        });

        await expect(
          validatePublicHttpsUrl(
            "https://8.8.8.8/call.wav",
            {
              lookupImpl: publicLookup,
            }
          )
        ).rejects.toMatchObject({
          code:
            "AFRICASTALKING_RECORDING_IP_LITERAL_BLOCKED",
        });
      }
    );


    test(
      "blocks hostname resolving to private address",
      async () => {

        await expect(
          validatePublicHttpsUrl(
            "https://recordings.example.com/call.wav",
            {
              lookupImpl: async () => [
                {
                  address: "10.10.10.10",
                  family: 4,
                },
              ],
            }
          )
        ).rejects.toMatchObject({
          code:
            "AFRICASTALKING_RECORDING_PRIVATE_ADDRESS_BLOCKED",
        });
      }
    );


    test(
      "recognizes WAV and MP3 formats",
      () => {

        expect(
          inferAudioFormat({
            contentType: "audio/wav",
            url:
              "https://recordings.example.com/call",
          })
        ).toEqual({
          mimeType: "audio/wav",
          extension: ".wav",
        });

        expect(
          inferAudioFormat({
            contentType:
              "application/octet-stream",
            url:
              "https://recordings.example.com/call.mp3",
          })
        ).toEqual({
          mimeType: "audio/mpeg",
          extension: ".mp3",
        });
      }
    );


    test(
      "downloads WAV audio into memory without disk persistence",
      async () => {

        const fetchImpl =
          jest.fn()
            .mockResolvedValue({
              ok: true,
              status: 200,

              headers: headers({
                "content-type":
                  "audio/wav",
                "content-length":
                  "6",
              }),

              body: bodyFrom(
                "abc",
                "def"
              ),
            });

        const result =
          await fetchRecordingIntoMemory(
            "https://recordings.example.com/call.wav",
            {
              fetchImpl,
              lookupImpl: publicLookup,
            }
          );

        expect(fetchImpl)
          .toHaveBeenCalledTimes(1);

        expect(result.buffer)
          .toEqual(
            Buffer.from("abcdef")
          );

        expect(result.filename)
          .toBe(
            "voicebridge-call.wav"
          );

        expect(result.mimeType)
          .toBe("audio/wav");

        expect(result.byteLength)
          .toBe(6);

        expect(result.stored)
          .toBe(false);

        expect(result.diskWritePerformed)
          .toBe(false);
      }
    );


    test(
      "revalidates HTTPS redirects before following them",
      async () => {

        const fetchImpl =
          jest.fn()
            .mockResolvedValueOnce({
              ok: false,
              status: 302,

              headers: headers({
                location:
                  "https://cdn.example.com/call.mp3",
              }),

              body: bodyFrom(),
            })
            .mockResolvedValueOnce({
              ok: true,
              status: 200,

              headers: headers({
                "content-type":
                  "audio/mpeg",
              }),

              body: bodyFrom(
                "audio"
              ),
            });

        const result =
          await fetchRecordingIntoMemory(
            "https://recordings.example.com/start",
            {
              fetchImpl,
              lookupImpl: publicLookup,
            }
          );

        expect(
          result.redirectsFollowed
        ).toBe(1);

        expect(
          result.mimeType
        ).toBe("audio/mpeg");
      }
    );


    test(
      "rejects recordings larger than configured limit",
      async () => {

        const fetchImpl =
          jest.fn()
            .mockResolvedValue({
              ok: true,
              status: 200,

              headers: headers({
                "content-type":
                  "audio/wav",
                "content-length":
                  "100",
              }),

              body: bodyFrom(
                "audio"
              ),
            });

        await expect(
          fetchRecordingIntoMemory(
            "https://recordings.example.com/call.wav",
            {
              fetchImpl,
              lookupImpl: publicLookup,
              maxBytes: 10,
            }
          )
        ).rejects.toMatchObject({
          code:
            "AFRICASTALKING_RECORDING_TOO_LARGE",
          statusCode: 413,
        });
      }
    );


    test(
      "rejects unsupported recording formats",
      async () => {

        const fetchImpl =
          jest.fn()
            .mockResolvedValue({
              ok: true,
              status: 200,

              headers: headers({
                "content-type":
                  "text/html",
              }),

              body: bodyFrom(
                "not audio"
              ),
            });

        await expect(
          fetchRecordingIntoMemory(
            "https://recordings.example.com/call",
            {
              fetchImpl,
              lookupImpl: publicLookup,
            }
          )
        ).rejects.toBeInstanceOf(
          AfricasTalkingRecordingFetchError
        );
      }
    );
  }
);
