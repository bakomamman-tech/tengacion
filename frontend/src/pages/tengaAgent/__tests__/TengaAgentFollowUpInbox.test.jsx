import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
  completeFollowUpMock,
  getActivityMock,
  getFollowUpsMock,
  logContactMock,
  rescheduleFollowUpMock,
  sendEmailMock,
} = vi.hoisted(() => ({
  completeFollowUpMock: vi.fn(),
  getActivityMock: vi.fn(),
  getFollowUpsMock: vi.fn(),
  logContactMock: vi.fn(),
  rescheduleFollowUpMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));

vi.mock(
  "../../../services/tengaAgentFollowUpApi",
  () => ({
    getTengaAgentOwnerFollowUps: (...args) => getFollowUpsMock(...args),
    getTengaAgentOwnerFollowUpActivity: (...args) => getActivityMock(...args),
    completeTengaAgentOwnerFollowUp: (...args) => completeFollowUpMock(...args),
    logTengaAgentOwnerFollowUpContact: (...args) => logContactMock(...args),
    rescheduleTengaAgentOwnerFollowUp: (...args) => rescheduleFollowUpMock(...args),
    sendTengaAgentOwnerFollowUpEmail: (...args) => sendEmailMock(...args),
  })
);

import TengaAgentFollowUpInbox from "../TengaAgentFollowUpInbox";

const FOLLOW_UP = {
  appointmentId: "appointment-follow-up-1",
  name: "Follow Up Visitor",
  email: "followup@example.com",
  phone: "+2348000000000",
  consentToContact: true,
  purpose: "Review commercial proposal",
  appointmentStatus: "completed",
  outcomeDisposition: "qualified",
  outcomeNotes: "Send revised implementation scope.",
  followUpAt: "2026-09-16T10:00:00.000Z",
  overdue: true,
  dueState: "overdue",
  reminder: {
    id: "reminder-1",
    status: "sent",
    attempts: 1,
    sentAt: "2026-09-16T10:01:00.000Z",
    lastError: "",
  },
};

const RESPONSE = {
  ok: true,
  filter: "all",
  followUps: [FOLLOW_UP],
  metrics: {
    open: 1,
    overdue: 1,
    upcoming: 0,
    dueNext7Days: 0,
  },
};

const SENT_ACTIVITY = {
  id: "activity-email-1",
  appointmentId: FOLLOW_UP.appointmentId,
  channel: "email",
  direction: "outbound",
  status: "sent",
  recipient: FOLLOW_UP.email,
  subject: "Revised proposal",
  message: "Here is the revised scope.",
  notes: "",
  provider: "smtp",
  occurredAt: "2026-09-17T00:00:00.000Z",
  lastError: "",
};

describe("TengaAgentFollowUpInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFollowUpsMock.mockResolvedValue(RESPONSE);
    getActivityMock.mockResolvedValue({ ok: true, activities: [] });
    completeFollowUpMock.mockResolvedValue({ ok: true });
    logContactMock.mockResolvedValue({ ok: true });
    rescheduleFollowUpMock.mockResolvedValue({ ok: true });
    sendEmailMock.mockResolvedValue({ ok: true, activity: SENT_ACTIVITY });
  });

  it("shows reminder state and completes an owner follow-up", async () => {
    const user = userEvent.setup();

    render(<TengaAgentFollowUpInbox user={{ id: "owner-1" }} />);

    expect(await screen.findByText("Follow Up Visitor")).toBeInTheDocument();
    expect(screen.getByText("Reminder sent")).toBeInTheDocument();

    const overdueMetric = screen.getByText("Overdue").closest("article");
    expect(overdueMetric).not.toBeNull();
    expect(within(overdueMetric).getByText("1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /mark follow-up done/i })
    );

    await waitFor(() => {
      expect(completeFollowUpMock).toHaveBeenCalledWith({
        appointmentId: "appointment-follow-up-1",
      });
    });
    expect(getFollowUpsMock).toHaveBeenCalledTimes(2);
  });

  it("reloads filters and reschedules with an ISO due time", async () => {
    const user = userEvent.setup();

    render(<TengaAgentFollowUpInbox user={{ id: "owner-1" }} />);
    await screen.findByText("Follow Up Visitor");

    await user.click(screen.getByRole("button", { name: "overdue" }));
    await waitFor(() => {
      expect(getFollowUpsMock).toHaveBeenLastCalledWith({
        filter: "overdue",
        limit: 100,
      });
    });

    await user.click(screen.getByRole("button", { name: "Reschedule" }));
    const input = screen.getByLabelText("New follow-up due");
    fireEvent.change(input, { target: { value: "2026-09-19T12:30" } });

    await user.click(
      screen.getByRole("button", { name: /save new due time/i })
    );

    await waitFor(() => {
      expect(rescheduleFollowUpMock).toHaveBeenCalledWith({
        appointmentId: "appointment-follow-up-1",
        followUpAt: new Date("2026-09-19T12:30").toISOString(),
      });
    });
  });

  it("sends an explicit owner-approved email and refreshes contact history", async () => {
    const user = userEvent.setup();
    getActivityMock
      .mockResolvedValueOnce({ ok: true, activities: [] })
      .mockResolvedValueOnce({ ok: true, activities: [SENT_ACTIVITY] });

    render(<TengaAgentFollowUpInbox user={{ id: "owner-1" }} />);
    await screen.findByText("Follow Up Visitor");

    await user.click(screen.getByRole("button", { name: "Send email" }));
    await screen.findByText("Send follow-up email");

    const subjectInput = screen.getByLabelText("Email subject");
    await user.clear(subjectInput);
    await user.type(subjectInput, "Revised proposal");
    await user.type(
      screen.getByLabelText("Email message"),
      "Here is the revised scope."
    );

    await user.click(
      screen.getByRole("button", { name: `Send to ${FOLLOW_UP.email}` })
    );

    await waitFor(() => {
      expect(sendEmailMock).toHaveBeenCalledWith({
        appointmentId: FOLLOW_UP.appointmentId,
        subject: "Revised proposal",
        message: "Here is the revised scope.",
      });
    });

    expect(getActivityMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Email sent")).toBeInTheDocument();
    expect(screen.getByText("Revised proposal")).toBeInTheDocument();
  });

  it("logs a manual owner contact and shows it in the activity timeline", async () => {
    const user = userEvent.setup();
    const phoneActivity = {
      id: "activity-phone-1",
      appointmentId: FOLLOW_UP.appointmentId,
      channel: "phone",
      direction: "outbound",
      status: "logged",
      recipient: FOLLOW_UP.phone,
      subject: "",
      message: "",
      notes: "Customer asked for a revised timeline.",
      provider: "manual",
      occurredAt: "2026-09-17T00:10:00.000Z",
      lastError: "",
    };
    getActivityMock
      .mockResolvedValueOnce({ ok: true, activities: [] })
      .mockResolvedValueOnce({ ok: true, activities: [phoneActivity] });

    render(<TengaAgentFollowUpInbox user={{ id: "owner-1" }} />);
    await screen.findByText("Follow Up Visitor");

    await user.click(screen.getByRole("button", { name: "Log contact" }));
    await screen.findByText("Log owner contact");
    await user.type(
      screen.getByLabelText("Contact notes"),
      "Customer asked for a revised timeline."
    );
    await user.click(
      screen.getByRole("button", { name: "Save contact activity" })
    );

    await waitFor(() => {
      expect(logContactMock).toHaveBeenCalledWith({
        appointmentId: FOLLOW_UP.appointmentId,
        channel: "phone",
        direction: "outbound",
        notes: "Customer asked for a revised timeline.",
      });
    });

    expect(await screen.findByText("Phone contact logged")).toBeInTheDocument();
    expect(
      screen.getByText("Customer asked for a revised timeline.")
    ).toBeInTheDocument();
  });

  it("disables email outreach when customer contact consent is absent", async () => {
    getFollowUpsMock.mockResolvedValue({
      ...RESPONSE,
      followUps: [{ ...FOLLOW_UP, consentToContact: false }],
    });

    render(<TengaAgentFollowUpInbox user={{ id: "owner-1" }} />);
    await screen.findByText("Follow Up Visitor");

    expect(screen.getByRole("button", { name: "Send email" })).toBeDisabled();
    expect(
      screen.getByText(
        "Email outreach unavailable: customer contact consent is not recorded."
      )
    ).toBeInTheDocument();
  });
});
