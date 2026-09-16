import React from "react";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  getAvailabilityMock,
  saveAvailabilityMock,
  getCalendarConnectionsMock,
  startCalendarConnectionMock,
  completeCalendarConnectionMock,
  disconnectCalendarConnectionMock,
} = vi.hoisted(() => ({
  getAvailabilityMock: vi.fn(),
  saveAvailabilityMock: vi.fn(),
  getCalendarConnectionsMock: vi.fn(),
  startCalendarConnectionMock: vi.fn(),
  completeCalendarConnectionMock: vi.fn(),
  disconnectCalendarConnectionMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentApi",
  () => ({
    getTengaAgentOwnerAvailability: (...args) =>
      getAvailabilityMock(...args),
    saveTengaAgentOwnerAvailability: (...args) =>
      saveAvailabilityMock(...args),
  })
);

vi.mock(
  "../../../services/tengaAgentCalendarApi",
  () => ({
    getTengaAgentCalendarConnections: (...args) =>
      getCalendarConnectionsMock(...args),
    startTengaAgentCalendarConnection: (...args) =>
      startCalendarConnectionMock(...args),
    completeTengaAgentCalendarConnection: (...args) =>
      completeCalendarConnectionMock(...args),
    disconnectTengaAgentCalendarConnection: (...args) =>
      disconnectCalendarConnectionMock(...args),
  })
);

import TengaAgentAvailabilitySettings from "../TengaAgentAvailabilitySettings";

const SCHEDULE = {
  enabled: false,
  timezone: "Africa/Lagos",
  source: "internal_schedule",
  minimumNoticeMinutes: 60,
  bookingHorizonDays: 30,
  slotStepMinutes: 30,
  defaultDurationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  weeklyHours: [
    {
      dayOfWeek: 1,
      startMinutes: 540,
      endMinutes: 1020,
    },
  ],
  blockedIntervals: [],
};

const PROVIDERS = [
  {
    provider: "google",
    label: "Google Calendar",
    configured: false,
    connected: false,
    connection: null,
  },
  {
    provider: "microsoft",
    label: "Microsoft Outlook",
    configured: false,
    connected: false,
    connection: null,
  },
];

describe("TengaAgentAvailabilitySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAvailabilityMock.mockResolvedValue({
      ok: true,
      schedule: SCHEDULE,
    });
    getCalendarConnectionsMock.mockResolvedValue({
      ok: true,
      providers: PROVIDERS,
    });
    saveAvailabilityMock.mockImplementation(
      async (payload) => ({
        ok: true,
        schedule: {
          ...SCHEDULE,
          ...payload,
        },
      })
    );
  });

  it("loads calendar-aware scheduling scope and saves weekly availability", async () => {
    const user = userEvent.setup();

    render(<TengaAgentAvailabilitySettings />);

    expect(
      await screen.findByText(/real tengaagent meeting slots/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/internal weekly rules remain the base schedule/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/^google calendar$/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^microsoft outlook$/i)
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", {
        name: /show real available slots/i,
      })
    );

    await user.selectOptions(
      screen.getByLabelText(/minimum notice/i),
      "120"
    );

    await user.click(
      screen.getByRole("button", {
        name: /save booking availability/i,
      })
    );

    await waitFor(() => {
      expect(saveAvailabilityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          timezone: "Africa/Lagos",
          minimumNoticeMinutes: 120,
          bookingHorizonDays: 30,
          slotStepMinutes: 30,
          defaultDurationMinutes: 30,
          weeklyHours: [
            {
              dayOfWeek: 1,
              startMinutes: 540,
              endMinutes: 1020,
            },
          ],
        })
      );
    });

    expect(
      await screen.findByText(/booking availability is active/i)
    ).toBeInTheDocument();
  });

  it("adds another weekly window without discarding the existing one", async () => {
    const user = userEvent.setup();

    render(<TengaAgentAvailabilitySettings />);
    await screen.findByText(/weekly booking hours/i);

    await user.click(
      screen.getByRole("button", {
        name: /add window/i,
      })
    );

    expect(
      screen.getAllByRole("button", {
        name: /remove/i,
      })
    ).toHaveLength(2);

    await user.selectOptions(
      screen.getByLabelText("Booking day 2"),
      "2"
    );

    await user.click(
      screen.getByRole("button", {
        name: /save booking availability/i,
      })
    );

    await waitFor(() => {
      expect(saveAvailabilityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          weeklyHours: expect.arrayContaining([
            {
              dayOfWeek: 1,
              startMinutes: 540,
              endMinutes: 1020,
            },
            {
              dayOfWeek: 2,
              startMinutes: 540,
              endMinutes: 1020,
            },
          ]),
        })
      );
    });
  });
});
