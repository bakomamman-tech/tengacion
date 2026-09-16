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
} = vi.hoisted(() => ({
  getAvailabilityMock: vi.fn(),
  saveAvailabilityMock: vi.fn(),
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

describe("TengaAgentAvailabilitySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAvailabilityMock.mockResolvedValue({
      ok: true,
      schedule: SCHEDULE,
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

  it("loads internal scheduling scope and saves weekly availability", async () => {
    const user = userEvent.setup();

    render(<TengaAgentAvailabilitySettings />);

    expect(
      await screen.findByText(/real tengaagent meeting slots/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/google calendar and outlook are not connected yet/i)
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
    await user.clear(
      screen.getByLabelText("Start time 2")
    );
    await user.type(
      screen.getByLabelText("Start time 2"),
      "13:00"
    );
    await user.clear(
      screen.getByLabelText("End time 2")
    );
    await user.type(
      screen.getByLabelText("End time 2"),
      "16:00"
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
              startMinutes: 780,
              endMinutes: 960,
            },
          ]),
        })
      );
    });
  });
});
