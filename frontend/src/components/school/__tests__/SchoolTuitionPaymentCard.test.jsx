import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SchoolTuitionPaymentCard from "../SchoolTuitionPaymentCard";
import {
  initializeSchoolTuitionPayment,
  verifySchoolTuitionPayment,
} from "../../../services/schoolPageService";

vi.mock("../../../services/schoolPageService", () => ({
  fetchSchoolTuitionReceipt: vi.fn(),
  getSchoolTuitionReceiptUrl: vi.fn(
    (_slug, reference) => `/api/schools/public/kurahtechandartsacademy/tuition-payments/receipt/${reference}`
  ),
  initializeSchoolTuitionPayment: vi.fn(),
  verifySchoolTuitionPayment: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe("SchoolTuitionPaymentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.open = vi.fn();
    window.history.replaceState({}, "", "/kurahtechandartsacademy");
  });

  it("collects the required parent, learner, bank, contact, address, and amount fields", async () => {
    initializeSchoolTuitionPayment.mockRejectedValue(new Error("Checkout unavailable in test"));
    render(
      <SchoolTuitionPaymentCard
        slug="kurahtechandartsacademy"
        canonicalPath="/kurahtechandartsacademy"
      />
    );

    fireEvent.change(screen.getByLabelText(/name of parent/i), { target: { value: "Grace Parent" } });
    fireEvent.change(screen.getByLabelText(/name of child/i), { target: { value: "Ada Learner" } });
    fireEvent.change(screen.getByLabelText(/class of child/i), { target: { value: "Primary 2" } });
    fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: "Opay" } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "grace@example.com" } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "08030000000" } });
    fireEvent.change(screen.getByLabelText(/amount to pay/i), { target: { value: "25000" } });
    fireEvent.change(screen.getByLabelText(/home address/i), { target: { value: "12 Narayi Road" } });
    fireEvent.click(screen.getByRole("button", { name: /continue to paystack/i }));

    await waitFor(() => {
      expect(initializeSchoolTuitionPayment).toHaveBeenCalledWith(
        "kurahtechandartsacademy",
        expect.objectContaining({
          parentName: "Grace Parent",
          childName: "Ada Learner",
          childClass: "Primary 2",
          bankName: "Opay",
          email: "grace@example.com",
          phoneNumber: "08030000000",
          homeAddress: "12 Narayi Road",
          amount: 25000,
        })
      );
    });
    expect(screen.getByText(/checkout unavailable in test/i)).toBeInTheDocument();
  });

  it("verifies a returning Paystack reference and shows the recorded learner payment", async () => {
    window.history.replaceState(
      {},
      "",
      "/kurahtechandartsacademy?tuition=verify&reference=TGN_SCHOOL_TUITION_TEST"
    );
    verifySchoolTuitionPayment.mockResolvedValue({
      verified: true,
      status: "paid",
      payment: {
        status: "paid",
        schoolName: "Kurah Tech and Arts Academy",
        childName: "Ada Learner",
        childClass: "Primary 2",
        amount: 25000,
        currency: "NGN",
      },
    });

    render(
      <SchoolTuitionPaymentCard
        slug="kurahtechandartsacademy"
        canonicalPath="/kurahtechandartsacademy"
      />
    );

    expect(await screen.findByText(/payment successful/i)).toBeInTheDocument();
    expect(screen.getByText("Ada Learner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download pdf receipt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share receipt/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /send with whatsapp/i }));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/?text="),
      "_blank",
      "noopener,noreferrer"
    );
    expect(verifySchoolTuitionPayment).toHaveBeenCalledWith(
      "kurahtechandartsacademy",
      "TGN_SCHOOL_TUITION_TEST"
    );
  });
});
