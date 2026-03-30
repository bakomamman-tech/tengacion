import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminMessagesPage from "../AdminMessages";
import {
  adminGetComplaints,
  adminGetMessagesOverview,
  adminUpdateComplaint,
  sendChatMessageDirect,
} from "../../api";

vi.mock("../../api", () => ({
  adminGetComplaints: vi.fn(),
  adminGetMessagesOverview: vi.fn(),
  adminUpdateComplaint: vi.fn(),
  sendChatMessageDirect: vi.fn(),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
  },
}));

describe("AdminMessages reply flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminGetMessagesOverview).mockResolvedValue({
      summary: {
        totalMessages: 12,
        conversations: 4,
        activeSenders: 3,
        unreadMessages: 1,
        readMessages: 11,
        averagePerConversation: 3,
      },
      series: [],
      recentConversations: [],
    });
    vi.mocked(adminGetComplaints).mockResolvedValue({
      summary: { open: 1, resolved: 0, critical: 0 },
      complaints: [
        {
          _id: "complaint-1",
          subject: "Need a follow-up",
          category: "safety",
          details: "Please reply to the user about this complaint.",
          status: "open",
          priority: "high",
          createdAt: "2026-03-30T10:00:00.000Z",
          sourceLabel: "Home",
          sourcePath: "/home",
          reporter: {
            _id: "user-55",
            name: "Daniel Stephen Kurah",
            username: "daniel",
          },
        },
      ],
    });
    vi.mocked(sendChatMessageDirect).mockResolvedValue({ success: true });
    vi.mocked(adminUpdateComplaint).mockResolvedValue({ success: true });
  });

  it("opens the reply composer and sends a message to the complaint reporter", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/messages"]}>
        <AdminMessagesPage user={{ _id: "admin-1", name: "Admin User", role: "admin" }} />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: /reply user/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reply user/i }));

    expect(await screen.findByRole("dialog", { name: /reply to user/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Hello Daniel, we have reviewed your report." },
    });

    fireEvent.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(sendChatMessageDirect).toHaveBeenCalledWith({
        receiverId: "user-55",
        text: "Hello Daniel, we have reviewed your report.",
      });
    });
  }, 15000);
});
