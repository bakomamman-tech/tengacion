import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminTuitionPaymentsPage from "../AdminTuitionPayments";
import { adminListTuitionPayments } from "../../api";

vi.mock("../../components/AdminShell", () => ({
  default: ({ title, subtitle, actions, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div>{actions}</div>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("../../api", () => ({
  adminListTuitionPayments: vi.fn(),
}));

describe("AdminTuitionPaymentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminListTuitionPayments.mockResolvedValue({
      payments: [
        {
          _id: "payment-1",
          parentName: "Grace Parent",
          childName: "Ada Learner",
          childClass: "Primary 2",
          bankName: "Opay",
          verifiedBankName: "OPAY",
          email: "grace@example.com",
          phoneNumber: "08030000000",
          homeAddress: "12 Narayi Road, Kaduna",
          amount: 25000,
          currency: "NGN",
          status: "paid",
          reference: "TGN_SCHOOL_TUITION_TEST",
          paymentChannel: "bank_transfer",
          paidAt: "2026-06-29T12:00:00.000Z",
          createdAt: "2026-06-29T11:55:00.000Z",
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      summary: { totalRecords: 1, paidRecords: 1, pendingRecords: 0, paidAmount: 25000, currency: "NGN" },
      classes: ["Primary 2"],
    });
  });

  it("stores and displays complete online tuition payment records for admins", async () => {
    render(<AdminTuitionPaymentsPage user={{ role: "admin" }} />);

    expect(await screen.findByText("Grace Parent")).toBeInTheDocument();
    expect(screen.getByText("Ada Learner")).toBeInTheDocument();
    expect(screen.getByText("Opay")).toBeInTheDocument();
    expect(screen.getByText("TGN_SCHOOL_TUITION_TEST")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Grace Parent" }));
    expect(screen.getByText("12 Narayi Road, Kaduna")).toBeInTheDocument();
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();
    expect(screen.getByText("bank_transfer")).toBeInTheDocument();
  });
});
