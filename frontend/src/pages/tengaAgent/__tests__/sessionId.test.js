import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createTengaAgentSessionId,
  readTengaAgentSessionId,
} from "../sessionId";

describe("TengaAgent secure session IDs", () => {
  it("prefers crypto.randomUUID when available", () => {
    const randomUUID = vi.fn(() =>
      "2ef21742-d0af-40a3-8b63-2fe9852fa1d8"
    );

    expect(
      createTengaAgentSessionId({ randomUUID })
    ).toBe("2ef21742-d0af-40a3-8b63-2fe9852fa1d8");
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("uses cryptographic bytes when randomUUID is unavailable", () => {
    const getRandomValues = vi.fn((bytes) => {
      bytes.set([
        0, 1, 2, 3, 4, 5, 6, 7,
        8, 9, 10, 11, 12, 13, 14, 15,
      ]);
      return bytes;
    });

    const sessionId = createTengaAgentSessionId({
      getRandomValues,
    });

    expect(sessionId).toBe(
      "00010203-0405-4607-8809-0a0b0c0d0e0f"
    );
    expect(getRandomValues).toHaveBeenCalledTimes(1);
  });

  it("fails closed instead of using Math.random when secure randomness is unavailable", () => {
    expect(() =>
      createTengaAgentSessionId({})
    ).toThrow(/secure browser randomness/i);
  });

  it("rotates weak legacy session IDs before using them as bearer capabilities", () => {
    const storage = {
      getItem: vi.fn(() => "tengaagent-unsafe-legacy-session"),
      setItem: vi.fn(),
    };
    const randomUUID = vi.fn(() => "d401bc2a-4f7b-4fa8-8752-4d0bc8e01f3c");
    const nextId = readTengaAgentSessionId(
      "pilot-demo-session",
      storage,
      { randomUUID }
    );

    expect(nextId).toBe("d401bc2a-4f7b-4fa8-8752-4d0bc8e01f3c");
    expect(storage.setItem).toHaveBeenCalledWith("pilot-demo-session", nextId);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("reuses a stored session and securely creates one when missing", () => {
    const store = new Map();
    const storage = {
      getItem: vi.fn((key) => store.get(key) || null),
      setItem: vi.fn((key, value) => store.set(key, value)),
    };
    const cryptoSource = {
      randomUUID: vi.fn(() =>
        "864764fb-eb87-4de8-8465-8fb3c8a75414"
      ),
    };

    expect(
      readTengaAgentSessionId(
        "agent-session",
        storage,
        cryptoSource
      )
    ).toBe("864764fb-eb87-4de8-8465-8fb3c8a75414");

    expect(
      readTengaAgentSessionId(
        "agent-session",
        storage,
        cryptoSource
      )
    ).toBe("864764fb-eb87-4de8-8465-8fb3c8a75414");

    expect(cryptoSource.randomUUID).toHaveBeenCalledTimes(1);
  });
});
